"""
Florida Statutes Scraper & Database Module
Fetches exact statute text from Online Sunshine (leg.state.fl.us)
Stores verbatim legal text as source of truth for Eve AI
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from dependencies import db, require_role
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import httpx
from bs4 import BeautifulSoup
import re
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statutes", tags=["statutes"])


# ==================== PYDANTIC MODELS ====================

class StatuteCreate(BaseModel):
    jurisdiction: str = "Florida"
    year: int
    title: str
    chapter: str
    section_number: str
    heading: str
    body_text: str  # EXACT verbatim text - NEVER modify
    source_url: str


class StatuteResponse(BaseModel):
    id: str
    jurisdiction: str
    year: int
    title: str
    chapter: str
    section_number: str
    heading: str
    body_text: str
    history: Optional[str] = ""
    source_url: str
    status: Optional[str] = "complete"
    body_length: Optional[int] = 0
    created_at: Optional[str] = None
    last_verified: Optional[str] = None


class StatuteSearchResult(BaseModel):
    id: str
    section_number: str
    heading: str
    excerpt: str
    score: float


# ==================== SCRAPER FUNCTIONS ====================

# Target sections for Chapter 626 Part VI (Insurance Adjusters) and Chapter 627 (Property Insurance)
TARGET_SECTIONS = {
    "626": [
        "626.851", "626.852", "626.854", "626.855", "626.8541", "626.8542",
        "626.858", "626.860", "626.861", "626.8615", "626.862", "626.863",
        "626.864", "626.865", "626.8651", "626.866", "626.8695", "626.870",
        "626.871", "626.872", "626.873", "626.874", "626.875", "626.8755",
        "626.876", "626.877", "626.878", "626.879", "626.8791", "626.8792",
        "626.8793", "626.8794", "626.8795", "626.8796", "626.8797"
    ],
    "627": [
        "627.70", "627.701", "627.7011", "627.70131", "627.70132", "627.7015",
        "627.70151", "627.70152", "627.70153", "627.7016", "627.7017",
        "627.702", "627.7025", "627.7026", "627.7027", "627.7028", "627.703",
        "627.706", "627.7065", "627.707", "627.708", "627.711", "627.712"
    ]
}


async def fetch_statute_from_online_sunshine(section_number: str, year: int = 2025) -> Optional[dict]:
    """
    Fetch exact statute text from Online Sunshine.
    Returns None if fetch fails.
    """
    # Determine chapter from section number
    chapter = section_number.split(".")[0]
    section_part = section_number.split(".")[1] if "." in section_number else section_number
    
    # Build URL for Online Sunshine
    # Format: https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0626/Sections/0626.854.html
    chapter_range_start = (int(chapter) // 100) * 100
    chapter_range_end = chapter_range_start + 99
    chapter_padded = chapter.zfill(4)
    
    url = f"https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL={chapter_range_start:04d}-{chapter_range_end:04d}/{chapter_padded}/Sections/{chapter_padded}.{section_part}.html"
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch {section_number}: HTTP {response.status_code}")
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract section heading from page title or first element
            heading = ""
            title_elem = soup.find('title')
            if title_elem:
                # Title format: "Statutes & Constitution :View Statutes : Online Sunshine"
                # Extract section heading from the content
                pass
            
            # Find the Section div - this is where the actual statute text is
            section_div = soup.find('div', class_='Section')

            if not section_div:
                logger.warning(f"Could not find Section div for {section_number}")
                return None

            # Extract heading from Catchline span
            catchline = section_div.find('span', class_='Catchline')
            if catchline:
                heading = catchline.get_text(strip=True).strip('\u2014\u2014 .—')
            else:
                heading_match = re.search(r'\d+\.\d+[a-zA-Z]?\s+(.+?)(?:\u2014|\.—|\.\(1\))', response.text)
                if heading_match:
                    heading = heading_match.group(1).strip()

            # Extract the FULL statute body from SectionBody span
            body_span = section_div.find('span', class_='SectionBody')
            if body_span:
                body_text = body_span.get_text(separator='\n', strip=True)
            else:
                # Fallback: get all text from section div excluding History
                history_div = section_div.find('div', class_='History')
                if history_div:
                    history_div.extract()
                body_text = section_div.get_text(separator='\n', strip=True)

            # Extract history separately
            history_text = ""
            history_div = section_div.find('div', class_='History')
            if history_div:
                history_text = history_div.get_text(strip=True)

            if not body_text or len(body_text) < 50:
                logger.warning(f"Body text too short for {section_number}: {len(body_text) if body_text else 0} chars")
                return None

            # If no heading found, create one from section number
            if not heading:
                heading = f"§{section_number}"
            
            # Determine title and chapter names
            title_name = "Title XXXVII - Insurance" if chapter in ["626", "627"] else f"Title - Chapter {chapter}"
            chapter_name = {
                "626": "Chapter 626 - Insurance Field Representatives and Operations",
                "627": "Chapter 627 - Insurance Rates and Contracts"
            }.get(chapter, f"Chapter {chapter}")
            
            # Determine integrity status
            status = "complete"
            if not body_text or len(body_text) < 100:
                status = "incomplete"
            elif body_text.strip().startswith("History"):
                status = "history_only"

            return {
                "jurisdiction": "Florida",
                "year": year,
                "title": title_name,
                "chapter": chapter_name,
                "section_number": section_number,
                "heading": heading,
                "body_text": body_text,  # EXACT TEXT - NEVER MODIFY
                "history": history_text,
                "source_url": url,
                "status": status,
                "body_length": len(body_text)
            }
            
    except Exception as e:
        logger.error(f"Error fetching {section_number}: {e}")
        return None


async def scrape_all_target_statutes(year: int = 2025) -> dict:
    """
    Scrape all target statutes from Online Sunshine.
    Returns summary of results.
    """
    results = {"success": [], "failed": [], "total": 0}
    
    for chapter, sections in TARGET_SECTIONS.items():
        for section in sections:
            results["total"] += 1
            
            try:
                statute_data = await fetch_statute_from_online_sunshine(section, year)
                
                if statute_data and statute_data.get("body_text"):
                    # Check if already exists
                    existing = await db.florida_statutes.find_one({
                        "section_number": section,
                        "year": year
                    })
                    
                    if existing:
                        # Update existing
                        await db.florida_statutes.update_one(
                            {"_id": existing["_id"]},
                            {
                                "$set": {
                                    **statute_data,
                                    "last_verified": datetime.now(timezone.utc).isoformat()
                                }
                            }
                        )
                        results["success"].append(f"{section} (updated)")
                    else:
                        # Insert new
                        statute_data["created_at"] = datetime.now(timezone.utc).isoformat()
                        statute_data["last_verified"] = datetime.now(timezone.utc).isoformat()
                        await db.florida_statutes.insert_one(statute_data)
                        results["success"].append(f"{section} (new)")
                else:
                    results["failed"].append(section)
                    
            except Exception as e:
                logger.error(f"Error processing {section}: {e}")
                results["failed"].append(section)
            
            # Rate limiting - be nice to the server
            await asyncio.sleep(0.5)
    
    return results


# ==================== API ENDPOINTS ====================

@router.get("/")
async def list_statutes(chapter: Optional[str] = None, year: int = 2025, skip: int = 0, limit: int = 50):
    """List all stored statutes with optional filtering"""
    query = {"year": year}
    if chapter:
        query["chapter"] = {"$regex": f"Chapter {chapter}", "$options": "i"}
    
    statutes = await db.florida_statutes.find(query, {"_id": 1, "section_number": 1, "heading": 1, "year": 1, "source_url": 1, "last_verified": 1, "status": 1, "body_length": 1}).sort("section_number", 1).skip(skip).limit(limit).to_list(limit)

    total = await db.florida_statutes.count_documents(query)

    # Convert ObjectId to string
    result_statutes = []
    for s in statutes:
        statute_dict = {
            "id": str(s["_id"]),
            "section_number": s.get("section_number"),
            "heading": s.get("heading"),
            "year": s.get("year"),
            "source_url": s.get("source_url"),
            "last_verified": s.get("last_verified"),
            "status": s.get("status", "unknown"),
            "body_length": s.get("body_length", 0)
        }
        result_statutes.append(statute_dict)
    
    return {
        "statutes": result_statutes,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/section/{section_number}")
async def get_statute_by_section(section_number: str, year: int = 2025):
    """
    Get exact statute text by section number.
    Returns verbatim body_text from Online Sunshine.
    """
    statute = await db.florida_statutes.find_one({
        "section_number": section_number,
        "year": year
    }, {"_id": 0})
    
    if not statute:
        raise HTTPException(
            status_code=404,
            detail=f"Statute §{section_number} ({year}) not found in database. Please consult the official Florida Statutes at https://www.leg.state.fl.us/statutes/"
        )
    
    return statute


@router.get("/quote/{section_number}")
async def quote_statute(section_number: str, year: int = 2025):
    """
    QUOTE MODE: Returns ONLY the exact verbatim statute text.
    No interpretation, no modification, no explanation.
    """
    statute = await db.florida_statutes.find_one({
        "section_number": section_number,
        "year": year
    })
    
    if not statute:
        return {
            "error": True,
            "message": f"Statute §{section_number} ({year}) is not in our database. We cannot quote statutes we have not verified. Please consult the official Florida Statutes at https://www.leg.state.fl.us/statutes/"
        }
    
    return {
        "citation": f"§{statute['section_number']}, {statute['year']} Fla. Stat.",
        "heading": statute["heading"],
        "body_text": statute["body_text"],  # EXACT TEXT
        "source_url": statute["source_url"],
        "disclaimer": "This is the exact text as published by the Florida Legislature. Verify at the official source."
    }


@router.get("/search")
async def search_statutes(q: str, year: int = 2025, limit: int = 10):
    """
    Full-text search across statute body_text and headings.
    Returns excerpts with matching context.
    """
    # Create text index if not exists (run once)
    try:
        await db.florida_statutes.create_index([
            ("body_text", "text"),
            ("heading", "text"),
            ("section_number", "text")
        ])
    except:
        pass  # Index may already exist
    
    # Text search
    results = await db.florida_statutes.find(
        {"$text": {"$search": q}, "year": year},
        {"score": {"$meta": "textScore"}, "_id": 1, "section_number": 1, "heading": 1, "body_text": 1, "source_url": 1}
    ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
    
    # Format results with excerpts
    formatted = []
    for r in results:
        # Find relevant excerpt
        body = r.get("body_text", "")
        q_lower = q.lower()
        
        # Find position of query term
        pos = body.lower().find(q_lower)
        if pos >= 0:
            start = max(0, pos - 100)
            end = min(len(body), pos + len(q) + 200)
            excerpt = "..." + body[start:end] + "..."
        else:
            excerpt = body[:300] + "..." if len(body) > 300 else body
        
        formatted.append({
            "id": str(r["_id"]),
            "section_number": r["section_number"],
            "heading": r["heading"],
            "excerpt": excerpt,
            "source_url": r["source_url"],
            "score": r.get("score", 0)
        })
    
    return {"results": formatted, "query": q, "count": len(formatted)}


@router.get("/for-eve")
async def get_statutes_for_eve(query: str, limit: int = 5):
    """
    Retrieve relevant statutes for Eve AI context.
    Returns verbatim text that Eve can quote or explain.
    """
    # Search for relevant statutes
    try:
        await db.florida_statutes.create_index([
            ("body_text", "text"),
            ("heading", "text")
        ])
    except:
        pass
    
    results = await db.florida_statutes.find(
        {"$text": {"$search": query}},
        {"score": {"$meta": "textScore"}, "_id": 0, "section_number": 1, "heading": 1, "body_text": 1, "source_url": 1, "year": 1}
    ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
    
    if not results:
        return {
            "found": False,
            "message": "No relevant Florida statutes found in database for this query.",
            "statutes": []
        }
    
    return {
        "found": True,
        "count": len(results),
        "statutes": results,
        "instructions": "When citing, use ONLY the body_text as stored. Do not modify, paraphrase, or rewrite statute language when user asks for exact wording."
    }


@router.post("/scrape")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    year: int = 2025,
    current_user: dict = Depends(require_role(["admin"])),
):
    """
    Trigger background scraping of all target statutes.
    Admin only.
    """
    background_tasks.add_task(scrape_all_target_statutes, year)
    
    return {
        "status": "started",
        "message": f"Scraping {sum(len(s) for s in TARGET_SECTIONS.values())} statutes from Online Sunshine",
        "target_chapters": list(TARGET_SECTIONS.keys()),
        "year": year
    }


@router.post("/scrape/section/{section_number}")
async def scrape_single_section(
    section_number: str,
    year: int = 2025,
    current_user: dict = Depends(require_role(["admin"])),
):
    """
    Scrape a single statute section from Online Sunshine.
    """
    result = await fetch_statute_from_online_sunshine(section_number, year)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch §{section_number} from Online Sunshine. The section may not exist or the URL format may have changed."
        )
    
    # Store in database
    result["created_at"] = datetime.now(timezone.utc).isoformat()
    result["last_verified"] = datetime.now(timezone.utc).isoformat()
    
    existing = await db.florida_statutes.find_one({"section_number": section_number, "year": year})
    if existing:
        await db.florida_statutes.update_one(
            {"_id": existing["_id"]},
            {"$set": result}
        )
        status = "updated"
    else:
        insert_result = await db.florida_statutes.insert_one(result.copy())
        status = "created"
    
    # Remove _id if present for JSON response
    result.pop("_id", None)
    
    return {"status": status, "section": section_number, "data": result}


@router.get("/status")
async def get_scrape_status():
    """Get current status of statute database"""
    total = await db.florida_statutes.count_documents({})
    by_chapter = {}
    
    for chapter in TARGET_SECTIONS.keys():
        count = await db.florida_statutes.count_documents({
            "chapter": {"$regex": f"Chapter {chapter}", "$options": "i"}
        })
        by_chapter[chapter] = count
    
    # Count integrity stats
    complete_count = await db.florida_statutes.count_documents({"body_length": {"$gt": 200}})
    incomplete_count = await db.florida_statutes.count_documents({"$or": [
        {"status": "history_only"},
        {"body_length": {"$lt": 100, "$gt": 0}}
    ]})

    return {
        "total_statutes": total,
        "by_chapter": by_chapter,
        "target_sections": {ch: len(secs) for ch, secs in TARGET_SECTIONS.items()},
        "coverage": {
            ch: f"{by_chapter.get(ch, 0)}/{len(secs)}"
            for ch, secs in TARGET_SECTIONS.items()
        },
        "integrity": {
            "complete": complete_count,
            "incomplete": incomplete_count,
            "total_target": sum(len(secs) for secs in TARGET_SECTIONS.values())
        }
    }


@router.delete("/clear")
async def clear_statutes(
    confirm: bool = False,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Clear all statutes (admin only, requires confirmation)"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to clear all statutes")
    
    result = await db.florida_statutes.delete_many({})
    return {"deleted": result.deleted_count}
