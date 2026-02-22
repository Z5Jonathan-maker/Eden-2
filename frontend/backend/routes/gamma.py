from fastapi import APIRouter, HTTPException, Depends, Query
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
import httpx
from routes.claims import _get_claim_for_user_or_403
from routes.gamma_helpers import (
    pack_client_approval,
    pack_client_update,
    pack_pastor_report,
    pack_rep_performance,
    pack_settlement,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gamma", tags=["gamma"])

# Gamma API configuration
GAMMA_API_TOKEN = os.environ.get("GAMMA_API_TOKEN")
GAMMA_API_URL = "https://api.gamma.com/v1"
GAMMA_VERSION = "2022-06-28"

# Gamma Presentation API (separate from Notion-style workspace API)
GAMMA_API_KEY = os.environ.get("GAMMA_API_KEY") or GAMMA_API_TOKEN
GAMMA_PRESENTATION_API_URL = "https://api.gamma.app/v1/create"


def get_gamma_headers():
    """Get headers for Gamma API requests"""
    return {
        "Authorization": f"Bearer {GAMMA_API_TOKEN}",
        "Content-Type": "application/json",
        "Gamma-Version": GAMMA_VERSION
    }


class GammaDatabase(BaseModel):
    id: str
    title: str
    url: Optional[str] = None


class GammaPage(BaseModel):
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
async def get_gamma_status(current_user: dict = Depends(get_current_active_user)):
    """Check if Gamma is configured and get workspace info"""
    if not GAMMA_API_TOKEN:
        return {
            "connected": False,
            "configured": False,
            "message": "Gamma API token not configured"
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Get the bot user info to verify token
            response = await client.get(
                f"{GAMMA_API_URL}/users/me",
                headers=get_gamma_headers()
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
        logger.error(f"Gamma status check error: {e}")
        return {
            "connected": False,
            "configured": True,
            "message": str(e)
        }


# ============ DATABASES ============

@router.get("/databases")
async def list_databases(current_user: dict = Depends(get_current_active_user)):
    """List all databases the integration has access to"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GAMMA_API_URL}/search",
                headers=get_gamma_headers(),
                json={
                    "filter": {"property": "object", "value": "database"}
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Gamma API error: {response.text}")
            
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
        logger.error(f"Gamma request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Gamma")


@router.post("/databases/create")
async def create_claims_database(
    request: CreateDatabaseRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new Eden Claims database in Gamma"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
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
                f"{GAMMA_API_URL}/databases",
                headers=get_gamma_headers(),
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
            await db.gamma_config.update_one(
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
        logger.error(f"Gamma request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Gamma")


# ============ PAGES ============

@router.get("/pages")
async def list_pages(current_user: dict = Depends(get_current_active_user)):
    """List all pages the integration has access to (for selecting parent)"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GAMMA_API_URL}/search",
                headers=get_gamma_headers(),
                json={
                    "filter": {"property": "object", "value": "page"}
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Gamma API error: {response.text}")
            
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
        logger.error(f"Gamma request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Gamma")


# ============ SYNC CLAIMS ============

@router.post("/sync/claim")
async def sync_claim_to_gamma(
    request: SyncClaimRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Sync a single claim to Gamma database"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
    # Get the claim from MongoDB
    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Build the Gamma page properties
    properties = {
        "Claim Number": {"title": [{"text": {"content": claim.get("claim_number", "N/A")}}]},
        "Client Name": {"rich_text": [{"text": {"content": claim.get("client_name", "")}}]},
        "Status": {"select": {"name": map_status_to_gamma(claim.get("status", "new"))}},
        "Carrier": {"rich_text": [{"text": {"content": claim.get("carrier", "")}}]},
        "Policy Number": {"rich_text": [{"text": {"content": claim.get("policy_number", "")}}]},
        "Address": {"rich_text": [{"text": {"content": claim.get("property_address", "")}}]},
        "Notes": {"rich_text": [{"text": {"content": claim.get("notes", "")[:2000]}}]},  # Gamma limit
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
    
    # Check if this claim was already synced (has a Gamma page ID)
    sync_record = await db.gamma_syncs.find_one({
        "claim_id": request.claim_id,
        "database_id": request.database_id
    })
    
    try:
        async with httpx.AsyncClient() as client:
            if sync_record and sync_record.get("gamma_page_id"):
                # Update existing page
                response = await client.patch(
                    f"{GAMMA_API_URL}/pages/{sync_record['gamma_page_id']}",
                    headers=get_gamma_headers(),
                    json={"properties": properties}
                )
                action = "updated"
            else:
                # Create new page
                response = await client.post(
                    f"{GAMMA_API_URL}/pages",
                    headers=get_gamma_headers(),
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
                    detail=f"Gamma sync failed: {error_data.get('message', response.text)}"
                )
            
            data = response.json()
            
            # Store sync record
            await db.gamma_syncs.update_one(
                {"claim_id": request.claim_id, "database_id": request.database_id},
                {"$set": {
                    "gamma_page_id": data["id"],
                    "gamma_url": data.get("url"),
                    "last_synced": datetime.now(timezone.utc).isoformat(),
                    "synced_by": current_user.get("id")
                }},
                upsert=True
            )
            
            return {
                "success": True,
                "action": action,
                "gamma_page_id": data["id"],
                "gamma_url": data.get("url"),
                "message": f"Claim {action} in Gamma"
            }
    
    except httpx.RequestError as e:
        logger.error(f"Gamma request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Gamma")


@router.post("/sync/all")
async def sync_all_claims(
    database_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Sync all claims to Gamma database"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
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
            await sync_claim_to_gamma(
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
    """Get Gamma sync status for a claim"""
    sync_record = await db.gamma_syncs.find_one(
        {"claim_id": claim_id},
        {"_id": 0}
    )
    
    if not sync_record:
        return {"synced": False}
    
    return {
        "synced": True,
        "gamma_page_id": sync_record.get("gamma_page_id"),
        "gamma_url": sync_record.get("gamma_url"),
        "last_synced": sync_record.get("last_synced")
    }


def map_status_to_gamma(status: str) -> str:
    """Map Eden claim status to Gamma select option"""
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
    """Search Gamma pages for relevant content - used by Eve AI"""
    if not GAMMA_API_TOKEN:
        return {"results": [], "message": "Gamma not configured"}
    
    try:
        async with httpx.AsyncClient() as client:
            # Search all accessible pages for the query
            response = await client.post(
                f"{GAMMA_API_URL}/search",
                headers=get_gamma_headers(),
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
    """Extract text content from a Gamma page"""
    try:
        response = await client.get(
            f"{GAMMA_API_URL}/blocks/{page_id}/children",
            headers=get_gamma_headers()
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
    """Create a rich Gamma page for claim strategy and notes"""
    if not GAMMA_API_TOKEN:
        raise HTTPException(status_code=400, detail="Gamma not configured")
    
    # Get the claim
    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Check if page already exists
    existing = await db.claim_strategy_pages.find_one({"claim_id": request.claim_id})
    if existing:
        return {
            "exists": True,
            "page_id": existing.get("gamma_page_id"),
            "url": existing.get("gamma_url")
        }
    
    # Get a parent page (use the first available page)
    try:
        async with httpx.AsyncClient() as client:
            search_response = await client.post(
                f"{GAMMA_API_URL}/search",
                headers=get_gamma_headers(),
                json={"filter": {"property": "object", "value": "page"}, "page_size": 1}
            )
            
            if search_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Cannot find parent page in Gamma")
            
            pages = search_response.json().get("results", [])
            if not pages:
                raise HTTPException(
                    status_code=400, 
                    detail="No Gamma pages available. Please share a page with Eden Claims integration first."
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
                f"{GAMMA_API_URL}/pages",
                headers=get_gamma_headers(),
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
                "gamma_page_id": data["id"],
                "gamma_url": data.get("url"),
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
        logger.error(f"Gamma request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Gamma")


@router.get("/claim-page/{claim_id}")
async def get_claim_strategy_page(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get the Gamma strategy page for a claim"""
    page = await db.claim_strategy_pages.find_one(
        {"claim_id": claim_id},
        {"_id": 0}
    )

    if not page:
        return {"exists": False}

    return {
        "exists": True,
        "page_id": page.get("gamma_page_id"),
        "url": page.get("gamma_url"),
        "created_at": page.get("created_at")
    }


# ============ GAMMA PRESENTATION GENERATION ============

class GammaPresentationRequest(BaseModel):
    title: str
    content: str
    audience: str = "client_update"
    template: str = "presentation"


async def _create_presentation(title: str, content: str, audience: str) -> dict:
    if not GAMMA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Gamma presentation API not configured. Set GAMMA_API_KEY in .env.",
        )

    payload = {
        "title": title,
        "mode": "generate",
        "prompt": content,
        "options": {"images": True, "language": "en"},
    }
    headers = {
        "Authorization": f"Bearer {GAMMA_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                GAMMA_PRESENTATION_API_URL,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        gamma_id = data.get("id")
        if not gamma_id:
            logger.warning(f"Gamma API returned no id: {data}")
            raise HTTPException(status_code=502, detail="Gamma API returned an unexpected response")

        return {
            "gamma_id": gamma_id,
            "edit_url": f"https://gamma.app/edit/{gamma_id}",
            "share_url": f"https://gamma.app/{gamma_id}",
            "url": f"https://gamma.app/{gamma_id}",
            "pdf_url": f"https://gamma.app/export/{gamma_id}/pdf",
            "audience": audience,
            "status": "created",
        }
    except httpx.HTTPStatusError as e:
        logger.error(f"Gamma presentation API error: {e}")
        detail = str(e)
        try:
            detail = e.response.json().get("error", str(e))
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Gamma API error: {detail}")
    except httpx.RequestError as e:
        logger.error(f"Gamma presentation request failed: {e}")
        raise HTTPException(status_code=503, detail="Unable to reach Gamma service")


@router.post("/presentation")
async def create_gamma_presentation(
    request: GammaPresentationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a Gamma presentation deck from content.
    Returns edit_url, share_url, and pdf_url."""
    return await _create_presentation(request.title, request.content, request.audience)


def _format_timeline(events: list[dict]) -> list[dict]:
    out: list[dict] = []
    for event in events:
        out.append(
            {
                "date": str(event.get("occurred_at") or event.get("created_at") or ""),
                "label": event.get("summary") or event.get("event_type") or "Timeline event",
            }
        )
    return out


@router.post("/presentation/{audience}")
async def create_gamma_presentation_for_audience(
    audience: str,
    claim_id: str = Query(...),
    current_user: dict = Depends(get_current_active_user),
):
    claim = await _get_claim_for_user_or_403(claim_id, current_user)
    events = await db.claim_events.find({"claim_id": claim_id}, {"_id": 0}).sort("occurred_at", 1).to_list(120)
    timeline = _format_timeline(events)

    tasks = []
    if claim.get("next_actions_firm"):
        tasks.append({"label": claim.get("next_actions_firm"), "owner": "firm", "done": False})
    if claim.get("next_actions_client"):
        tasks.append({"label": claim.get("next_actions_client"), "owner": "carrier", "done": False})

    audience_token = (audience or "client_update").strip().lower()
    title_map = {
        "client_update": "Client Update",
        "client_approval": "Settlement Review",
        "settlement": "Final Settlement",
        "rep_performance": "Rep Performance",
        "pastor_report": "Ministry Report",
    }
    title_suffix = title_map.get(audience_token, "Claim Presentation")
    title = f"{claim.get('claim_number') or claim_id} - {title_suffix}"

    if audience_token == "client_approval":
        estimate_total = float(claim.get("estimated_value") or 0)
        carrier_total = float(claim.get("carrier_offer") or 0)
        content = pack_client_approval(
            claim,
            {"total": estimate_total},
            {"total": carrier_total},
            [],
        )
    elif audience_token == "settlement":
        gross = float(claim.get("settlement_amount") or claim.get("estimated_value") or 0)
        content = pack_settlement(
            claim,
            {"gross": gross, "deductible": 0, "fee": 0, "net": gross},
            timeline,
            [],
        )
    elif audience_token == "rep_performance":
        content = pack_rep_performance(
            current_user,
            {
                "period": "Current period",
                "doors": 0,
                "leads": 0,
                "appointments": 0,
                "contracts": 0,
                "lead_to_appt": 0,
                "appt_to_signed": 0,
                "revenue": 0,
                "avg_deal": 0,
            },
        )
    elif audience_token == "pastor_report":
        content = pack_pastor_report(
            {"name": "Eden Claims"},
            {"period": "Current period", "families_helped": 0, "total_claim_value": 0, "fees_earned": 0, "giving": 0},
        )
    else:
        audience_token = "client_update"
        content = pack_client_update(claim, timeline, tasks)

    return await _create_presentation(title, content, audience_token)


@router.post("/client-update-deck/{claim_id}")
async def create_client_update_deck_alias(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    # Compatibility alias used by existing frontend hook.
    return await create_gamma_presentation_for_audience(
        audience="client_update",
        claim_id=claim_id,
        current_user=current_user,
    )
