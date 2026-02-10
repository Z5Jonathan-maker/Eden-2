from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notion", tags=["notion"])

# Notion API configuration
NOTION_API_TOKEN = os.environ.get("NOTION_API_TOKEN")
NOTION_API_URL = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def get_notion_headers():
    """Get headers for Notion API requests"""
    return {
        "Authorization": f"Bearer {NOTION_API_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
    }


class NotionDatabase(BaseModel):
    id: str
    title: str
    url: Optional[str] = None


class NotionPage(BaseModel):
    id: str
    title: str
    url: Optional[str] = None


class SyncClaimRequest(BaseModel):
    claim_id: str
    database_id: str


class CreateDatabaseRequest(BaseModel):
    parent_page_id: str
    title: str = "Eden Claims"


# ============ STATUS ============

@router.get("/status")
async def get_notion_status(current_user: dict = Depends(get_current_active_user)):
    """Check if Notion is configured and get workspace info"""
    if not NOTION_API_TOKEN:
        return {
            "connected": False,
            "configured": False,
            "message": "Notion API token not configured"
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Get the bot user info to verify token
            response = await client.get(
                f"{NOTION_API_URL}/users/me",
                headers=get_notion_headers()
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return {
                    "connected": True,
                    "configured": True,
                    "bot_name": user_data.get("name", "Eden Claims Bot"),
                    "bot_id": user_data.get("id"),
                    "workspace_name": user_data.get("workspace_name", "Connected Workspace")
                }
            else:
                return {
                    "connected": False,
                    "configured": True,
                    "message": "Token invalid or expired",
                    "error": response.text
                }
    except Exception as e:
        logger.error(f"Notion status check error: {e}")
        return {
            "connected": False,
            "configured": True,
            "message": str(e)
        }


# ============ DATABASES ============

@router.get("/databases")
async def list_databases(current_user: dict = Depends(get_current_active_user)):
    """List all databases the integration has access to"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NOTION_API_URL}/search",
                headers=get_notion_headers(),
                json={
                    "filter": {"property": "object", "value": "database"}
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Notion API error: {response.text}")
            
            data = response.json()
            databases = []
            
            for result in data.get("results", []):
                title = "Untitled"
                if result.get("title"):
                    title = "".join([t.get("plain_text", "") for t in result["title"]])
                
                databases.append({
                    "id": result["id"],
                    "title": title,
                    "url": result.get("url"),
                    "created_time": result.get("created_time"),
                    "last_edited_time": result.get("last_edited_time")
                })
            
            return {"databases": databases}
    
    except httpx.RequestError as e:
        logger.error(f"Notion request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Notion")


@router.post("/databases/create")
async def create_claims_database(
    request: CreateDatabaseRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new Eden Claims database in Notion"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    # Define the database schema for claims
    database_schema = {
        "parent": {"type": "page_id", "page_id": request.parent_page_id},
        "title": [{"type": "text", "text": {"content": request.title}}],
        "properties": {
            "Claim Number": {"title": {}},
            "Client Name": {"rich_text": {}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "New", "color": "blue"},
                        {"name": "In Progress", "color": "yellow"},
                        {"name": "Under Review", "color": "orange"},
                        {"name": "Approved", "color": "green"},
                        {"name": "Denied", "color": "red"},
                        {"name": "Closed", "color": "gray"}
                    ]
                }
            },
            "Carrier": {"rich_text": {}},
            "Policy Number": {"rich_text": {}},
            "Loss Type": {
                "select": {
                    "options": [
                        {"name": "Wind", "color": "blue"},
                        {"name": "Hail", "color": "purple"},
                        {"name": "Water", "color": "blue"},
                        {"name": "Fire", "color": "red"},
                        {"name": "Other", "color": "gray"}
                    ]
                }
            },
            "Date of Loss": {"date": {}},
            "Claim Amount": {"number": {"format": "dollar"}},
            "Address": {"rich_text": {}},
            "Phone": {"phone_number": {}},
            "Email": {"email": {}},
            "Notes": {"rich_text": {}},
            "Eden Link": {"url": {}},
            "Last Synced": {"date": {}}
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NOTION_API_URL}/databases",
                headers=get_notion_headers(),
                json=database_schema
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to create database: {error_data.get('message', response.text)}"
                )
            
            data = response.json()
            
            # Store the database ID for future syncs
            await db.notion_config.update_one(
                {"type": "claims_database"},
                {"$set": {
                    "database_id": data["id"],
                    "database_url": data.get("url"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user.get("id")
                }},
                upsert=True
            )
            
            return {
                "success": True,
                "database_id": data["id"],
                "url": data.get("url"),
                "message": "Claims database created successfully"
            }
    
    except httpx.RequestError as e:
        logger.error(f"Notion request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Notion")


# ============ PAGES ============

@router.get("/pages")
async def list_pages(current_user: dict = Depends(get_current_active_user)):
    """List all pages the integration has access to (for selecting parent)"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NOTION_API_URL}/search",
                headers=get_notion_headers(),
                json={
                    "filter": {"property": "object", "value": "page"}
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Notion API error: {response.text}")
            
            data = response.json()
            pages = []
            
            for result in data.get("results", []):
                # Get title from properties
                title = "Untitled"
                props = result.get("properties", {})
                if "title" in props and props["title"].get("title"):
                    title = "".join([t.get("plain_text", "") for t in props["title"]["title"]])
                elif "Name" in props and props["Name"].get("title"):
                    title = "".join([t.get("plain_text", "") for t in props["Name"]["title"]])
                
                pages.append({
                    "id": result["id"],
                    "title": title,
                    "url": result.get("url"),
                    "created_time": result.get("created_time")
                })
            
            return {"pages": pages}
    
    except httpx.RequestError as e:
        logger.error(f"Notion request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Notion")


# ============ SYNC CLAIMS ============

@router.post("/sync/claim")
async def sync_claim_to_notion(
    request: SyncClaimRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Sync a single claim to Notion database"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    # Get the claim from MongoDB
    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Build the Notion page properties
    properties = {
        "Claim Number": {"title": [{"text": {"content": claim.get("claim_number", "N/A")}}]},
        "Client Name": {"rich_text": [{"text": {"content": claim.get("client_name", "")}}]},
        "Status": {"select": {"name": map_status_to_notion(claim.get("status", "new"))}},
        "Carrier": {"rich_text": [{"text": {"content": claim.get("carrier", "")}}]},
        "Policy Number": {"rich_text": [{"text": {"content": claim.get("policy_number", "")}}]},
        "Address": {"rich_text": [{"text": {"content": claim.get("property_address", "")}}]},
        "Notes": {"rich_text": [{"text": {"content": claim.get("notes", "")[:2000]}}]},  # Notion limit
        "Last Synced": {"date": {"start": datetime.now(timezone.utc).isoformat()}}
    }
    
    # Add optional fields if present
    if claim.get("loss_type"):
        properties["Loss Type"] = {"select": {"name": claim["loss_type"].capitalize()}}
    
    if claim.get("date_of_loss"):
        properties["Date of Loss"] = {"date": {"start": claim["date_of_loss"][:10]}}
    
    if claim.get("claim_amount"):
        try:
            properties["Claim Amount"] = {"number": float(claim["claim_amount"])}
        except (ValueError, TypeError):
            pass
    
    if claim.get("phone"):
        properties["Phone"] = {"phone_number": claim["phone"]}
    
    if claim.get("email"):
        properties["Email"] = {"email": claim["email"]}
    
    # Check if this claim was already synced (has a Notion page ID)
    sync_record = await db.notion_syncs.find_one({
        "claim_id": request.claim_id,
        "database_id": request.database_id
    })
    
    try:
        async with httpx.AsyncClient() as client:
            if sync_record and sync_record.get("notion_page_id"):
                # Update existing page
                response = await client.patch(
                    f"{NOTION_API_URL}/pages/{sync_record['notion_page_id']}",
                    headers=get_notion_headers(),
                    json={"properties": properties}
                )
                action = "updated"
            else:
                # Create new page
                response = await client.post(
                    f"{NOTION_API_URL}/pages",
                    headers=get_notion_headers(),
                    json={
                        "parent": {"database_id": request.database_id},
                        "properties": properties
                    }
                )
                action = "created"
            
            if response.status_code not in [200, 201]:
                error_data = response.json()
                raise HTTPException(
                    status_code=400,
                    detail=f"Notion sync failed: {error_data.get('message', response.text)}"
                )
            
            data = response.json()
            
            # Store sync record
            await db.notion_syncs.update_one(
                {"claim_id": request.claim_id, "database_id": request.database_id},
                {"$set": {
                    "notion_page_id": data["id"],
                    "notion_url": data.get("url"),
                    "last_synced": datetime.now(timezone.utc).isoformat(),
                    "synced_by": current_user.get("id")
                }},
                upsert=True
            )
            
            return {
                "success": True,
                "action": action,
                "notion_page_id": data["id"],
                "notion_url": data.get("url"),
                "message": f"Claim {action} in Notion"
            }
    
    except httpx.RequestError as e:
        logger.error(f"Notion request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Notion")


@router.post("/sync/all")
async def sync_all_claims(
    database_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Sync all claims to Notion database"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    # Get all claims
    claims = await db.claims.find({}, {"_id": 0, "id": 1}).to_list(1000)
    
    results = {
        "total": len(claims),
        "synced": 0,
        "failed": 0,
        "errors": []
    }
    
    for claim in claims:
        try:
            await sync_claim_to_notion(
                SyncClaimRequest(claim_id=claim["id"], database_id=database_id),
                current_user
            )
            results["synced"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"claim_id": claim["id"], "error": str(e)})
    
    return results


@router.get("/sync/status/{claim_id}")
async def get_sync_status(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get Notion sync status for a claim"""
    sync_record = await db.notion_syncs.find_one(
        {"claim_id": claim_id},
        {"_id": 0}
    )
    
    if not sync_record:
        return {"synced": False}
    
    return {
        "synced": True,
        "notion_page_id": sync_record.get("notion_page_id"),
        "notion_url": sync_record.get("notion_url"),
        "last_synced": sync_record.get("last_synced")
    }


def map_status_to_notion(status: str) -> str:
    """Map Eden claim status to Notion select option"""
    status_map = {
        "new": "New",
        "in_progress": "In Progress",
        "under_review": "Under Review",
        "approved": "Approved",
        "denied": "Denied",
        "closed": "Closed",
        "pending": "In Progress",
        "active": "In Progress"
    }
    return status_map.get(status.lower(), "New")


# ============ KNOWLEDGE BASE FOR EVE ============

@router.get("/knowledge/search")
async def search_knowledge_base(
    query: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Search Notion pages for relevant content - used by Eve AI"""
    if not NOTION_API_TOKEN:
        return {"results": [], "message": "Notion not configured"}
    
    try:
        async with httpx.AsyncClient() as client:
            # Search all accessible pages for the query
            response = await client.post(
                f"{NOTION_API_URL}/search",
                headers=get_notion_headers(),
                json={
                    "query": query,
                    "filter": {"property": "object", "value": "page"},
                    "page_size": 5
                }
            )
            
            if response.status_code != 200:
                return {"results": [], "error": response.text}
            
            data = response.json()
            results = []
            
            for page in data.get("results", []):
                page_id = page["id"]
                
                # Get page content (blocks)
                content = await get_page_content(client, page_id)
                
                # Get title
                title = "Untitled"
                props = page.get("properties", {})
                for key in ["title", "Name", "Title"]:
                    if key in props and props[key].get("title"):
                        title = "".join([t.get("plain_text", "") for t in props[key]["title"]])
                        break
                
                if content:
                    results.append({
                        "title": title,
                        "content": content[:2000],  # Limit content length
                        "url": page.get("url")
                    })
            
            return {"results": results}
    
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        return {"results": [], "error": str(e)}


async def get_page_content(client: httpx.AsyncClient, page_id: str) -> str:
    """Extract text content from a Notion page"""
    try:
        response = await client.get(
            f"{NOTION_API_URL}/blocks/{page_id}/children",
            headers=get_notion_headers()
        )
        
        if response.status_code != 200:
            return ""
        
        blocks = response.json().get("results", [])
        content_parts = []
        
        for block in blocks:
            block_type = block.get("type")
            block_data = block.get(block_type, {})
            
            # Extract text from various block types
            if "rich_text" in block_data:
                text = "".join([t.get("plain_text", "") for t in block_data["rich_text"]])
                if text:
                    content_parts.append(text)
            elif "text" in block_data:
                text = "".join([t.get("plain_text", "") for t in block_data["text"]])
                if text:
                    content_parts.append(text)
        
        return "\n".join(content_parts)
    
    except Exception as e:
        logger.error(f"Error getting page content: {e}")
        return ""


# ============ CLAIM STRATEGY PAGES ============

class CreateStrategyPageRequest(BaseModel):
    claim_id: str


@router.post("/claim-page/create")
async def create_claim_strategy_page(
    request: CreateStrategyPageRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a rich Notion page for claim strategy and notes"""
    if not NOTION_API_TOKEN:
        raise HTTPException(status_code=400, detail="Notion not configured")
    
    # Get the claim
    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Check if page already exists
    existing = await db.claim_strategy_pages.find_one({"claim_id": request.claim_id})
    if existing:
        return {
            "exists": True,
            "page_id": existing.get("notion_page_id"),
            "url": existing.get("notion_url")
        }
    
    # Get a parent page (use the first available page)
    try:
        async with httpx.AsyncClient() as client:
            search_response = await client.post(
                f"{NOTION_API_URL}/search",
                headers=get_notion_headers(),
                json={"filter": {"property": "object", "value": "page"}, "page_size": 1}
            )
            
            if search_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Cannot find parent page in Notion")
            
            pages = search_response.json().get("results", [])
            if not pages:
                raise HTTPException(
                    status_code=400, 
                    detail="No Notion pages available. Please share a page with Eden Claims integration first."
                )
            
            parent_page_id = pages[0]["id"]
            
            # Create the strategy page with rich content
            page_content = {
                "parent": {"page_id": parent_page_id},
                "icon": {"emoji": "📋"},
                "properties": {
                    "title": {"title": [{"text": {"content": f"{claim.get('claim_number', 'Claim')} - {claim.get('client_name', 'Strategy')}"}}]}
                },
                "children": [
                    {
                        "object": "block",
                        "type": "callout",
                        "callout": {
                            "icon": {"emoji": "🏠"},
                            "rich_text": [{"type": "text", "text": {"content": f"Claim: {claim.get('claim_number')} | Client: {claim.get('client_name')} | Carrier: {claim.get('carrier', 'N/A')}"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "divider",
                        "divider": {}
                    },
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{"type": "text", "text": {"content": "📍 Claim Overview"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": f"Property: {claim.get('property_address', 'N/A')}"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": f"Loss Type: {claim.get('loss_type', claim.get('claim_type', 'N/A'))}"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": f"Date of Loss: {claim.get('date_of_loss', 'N/A')}"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": f"Policy: {claim.get('policy_number', 'N/A')}"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "divider",
                        "divider": {}
                    },
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{"type": "text", "text": {"content": "🎯 Strategy & Game Plan"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": "Document your approach, key arguments, and negotiation tactics here..."}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "divider",
                        "divider": {}
                    },
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{"type": "text", "text": {"content": "📞 Adjuster Communications"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "to_do",
                        "to_do": {
                            "rich_text": [{"type": "text", "text": {"content": "Initial adjuster contact"}}],
                            "checked": False
                        }
                    },
                    {
                        "object": "block",
                        "type": "to_do",
                        "to_do": {
                            "rich_text": [{"type": "text", "text": {"content": "Inspection scheduled"}}],
                            "checked": False
                        }
                    },
                    {
                        "object": "block",
                        "type": "to_do",
                        "to_do": {
                            "rich_text": [{"type": "text", "text": {"content": "Estimate received"}}],
                            "checked": False
                        }
                    },
                    {
                        "object": "block",
                        "type": "divider",
                        "divider": {}
                    },
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{"type": "text", "text": {"content": "📝 Meeting Notes"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": "Add notes from adjuster meetings, calls, and site visits..."}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "divider",
                        "divider": {}
                    },
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{"type": "text", "text": {"content": "💰 Settlement Tracking"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": "Initial Carrier Estimate: $____"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": "Our Estimate: $____"}}]
                        }
                    },
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [{"type": "text", "text": {"content": "Final Settlement: $____"}}]
                        }
                    }
                ]
            }
            
            response = await client.post(
                f"{NOTION_API_URL}/pages",
                headers=get_notion_headers(),
                json=page_content
            )
            
            if response.status_code not in [200, 201]:
                error_data = response.json()
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to create page: {error_data.get('message', response.text)}"
                )
            
            data = response.json()
            
            # Store the link
            await db.claim_strategy_pages.insert_one({
                "claim_id": request.claim_id,
                "notion_page_id": data["id"],
                "notion_url": data.get("url"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user.get("id")
            })
            
            return {
                "success": True,
                "page_id": data["id"],
                "url": data.get("url"),
                "message": "Strategy page created"
            }
    
    except httpx.RequestError as e:
        logger.error(f"Notion request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Notion")


@router.get("/claim-page/{claim_id}")
async def get_claim_strategy_page(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get the Notion strategy page for a claim"""
    page = await db.claim_strategy_pages.find_one(
        {"claim_id": claim_id},
        {"_id": 0}
    )
    
    if not page:
        return {"exists": False}
    
    return {
        "exists": True,
        "page_id": page.get("notion_page_id"),
        "url": page.get("notion_url"),
        "created_at": page.get("created_at")
    }

