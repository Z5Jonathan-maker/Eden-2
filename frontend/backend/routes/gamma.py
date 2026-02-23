"""
Gamma Routes — Presentation generation via Gamma.app API v1.0

Gamma is a presentation/document generation tool. Its API:
  - Base URL: https://public-api.gamma.app/v1.0
  - Auth: X-API-KEY header
  - POST /generations  → returns {generationId}
  - GET  /generations/{id} → poll until status=completed → returns {gammaUrl}
  - GET  /themes → list available themes

NOTE: Gamma does NOT have Notion-style workspace/database/page APIs.
All "sync claim to database" features are stored locally in MongoDB only.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import logging
import asyncio
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

# ── Gamma API v1.0 configuration ─────────────────────────────────
GAMMA_API_KEY = os.environ.get("GAMMA_API_KEY") or os.environ.get("GAMMA_API_TOKEN")
GAMMA_API_URL = "https://public-api.gamma.app/v1.0"

# Polling config
GAMMA_POLL_INTERVAL = 10   # seconds between polls
GAMMA_POLL_MAX_WAIT = 180  # max seconds to wait for generation


def _gamma_headers() -> dict:
    """Auth headers for Gamma API v1.0"""
    return {
        "X-API-KEY": GAMMA_API_KEY or "",
        "Content-Type": "application/json",
    }


# ============ STATUS ============

@router.get("/status")
async def get_gamma_status(current_user: dict = Depends(get_current_active_user)):
    """Check if Gamma API key is configured and valid by listing themes."""
    if not GAMMA_API_KEY:
        return {
            "connected": False,
            "configured": False,
            "message": "Gamma API key not configured. Set GAMMA_API_KEY in .env.",
        }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{GAMMA_API_URL}/themes",
                headers=_gamma_headers(),
            )

            if response.status_code == 200:
                themes = response.json()
                theme_count = len(themes) if isinstance(themes, list) else 0
                return {
                    "connected": True,
                    "configured": True,
                    "message": "Gamma API connected",
                    "theme_count": theme_count,
                }
            else:
                return {
                    "connected": False,
                    "configured": True,
                    "message": f"API key rejected (HTTP {response.status_code})",
                    "error": response.text[:500],
                }
    except Exception as e:
        logger.error(f"Gamma status check error: {e}")
        return {
            "connected": False,
            "configured": True,
            "message": str(e),
        }


# ============ THEMES ============

@router.get("/themes")
async def list_themes(current_user: dict = Depends(get_current_active_user)):
    """List available Gamma themes for presentation styling."""
    if not GAMMA_API_KEY:
        raise HTTPException(status_code=400, detail="Gamma not configured")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{GAMMA_API_URL}/themes",
                headers=_gamma_headers(),
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Gamma API error: {response.text[:500]}")
            return {"themes": response.json()}
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to reach Gamma: {e}")


# ============ LOCAL SYNC TRACKING (MongoDB only, no Gamma API) ============
# These endpoints track which claims have been "synced" by generating
# presentations. They do NOT call any Gamma workspace API (which doesn't exist).

class SyncClaimRequest(BaseModel):
    claim_id: str


@router.post("/sync/claim")
async def sync_claim_to_gamma(
    request: SyncClaimRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Generate a Gamma presentation for a claim and track the sync."""
    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Generate a client-update deck for this claim
    events = await db.claim_events.find(
        {"claim_id": request.claim_id}, {"_id": 0}
    ).sort("occurred_at", 1).to_list(120)
    timeline = _format_timeline(events)
    tasks = []
    if claim.get("next_actions_firm"):
        tasks.append({"label": claim["next_actions_firm"], "owner": "firm", "done": False})
    if claim.get("next_actions_client"):
        tasks.append({"label": claim["next_actions_client"], "owner": "carrier", "done": False})

    content = pack_client_update(claim, timeline, tasks)
    title = f"{claim.get('claim_number', request.claim_id)} - Client Update"

    result = await _create_presentation(title, content, "client_update")

    # Store sync record
    await db.gamma_syncs.update_one(
        {"claim_id": request.claim_id},
        {"$set": {
            "gamma_id": result.get("gamma_id"),
            "gamma_url": result.get("url"),
            "edit_url": result.get("edit_url"),
            "last_synced": datetime.now(timezone.utc).isoformat(),
            "synced_by": current_user.get("id"),
        }},
        upsert=True,
    )

    return {
        "success": True,
        "action": "created",
        "gamma_url": result.get("url"),
        "edit_url": result.get("edit_url"),
        "message": "Claim presentation created in Gamma",
    }


@router.post("/sync/all")
async def sync_all_claims(
    current_user: dict = Depends(get_current_active_user),
):
    """Generate Gamma presentations for all claims."""
    claims = await db.claims.find({}, {"_id": 0, "id": 1}).to_list(1000)

    results = {"total": len(claims), "synced": 0, "failed": 0, "errors": []}

    for claim in claims:
        try:
            await sync_claim_to_gamma(
                SyncClaimRequest(claim_id=claim["id"]),
                current_user,
            )
            results["synced"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"claim_id": claim["id"], "error": str(e)})

    return results


@router.get("/sync/status/{claim_id}")
async def get_sync_status(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get Gamma sync status for a claim."""
    sync_record = await db.gamma_syncs.find_one({"claim_id": claim_id}, {"_id": 0})

    if not sync_record:
        return {"synced": False}

    return {
        "synced": True,
        "gamma_url": sync_record.get("gamma_url"),
        "edit_url": sync_record.get("edit_url"),
        "last_synced": sync_record.get("last_synced"),
    }


# ============ KNOWLEDGE BASE STUB (no Gamma workspace API) ============

@router.get("/knowledge/search")
async def search_knowledge_base(
    query: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Stub: Gamma has no workspace/search API. Returns empty results."""
    return {
        "results": [],
        "message": "Gamma does not have a knowledge-base search API. Use local search instead.",
    }


# ============ CLAIM STRATEGY PAGES (generate as Gamma presentations) ============

class CreateStrategyPageRequest(BaseModel):
    claim_id: str


@router.post("/claim-page/create")
async def create_claim_strategy_page(
    request: CreateStrategyPageRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a Gamma presentation as a 'strategy page' for a claim."""
    # Check if page already exists
    existing = await db.claim_strategy_pages.find_one({"claim_id": request.claim_id})
    if existing:
        return {
            "exists": True,
            "page_id": existing.get("gamma_id"),
            "url": existing.get("gamma_url"),
        }

    claim = await db.claims.find_one({"id": request.claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Build strategy content
    content = f"""
Claim Strategy Document

Claim #: {claim.get('claim_number', 'N/A')}
Client: {claim.get('client_name', 'N/A')}
Property: {claim.get('property_address', 'N/A')}
Loss Type: {claim.get('loss_type', claim.get('claim_type', 'N/A'))}
Date of Loss: {claim.get('date_of_loss', 'N/A')}
Policy: {claim.get('policy_number', 'N/A')}
Carrier: {claim.get('insurance_company', claim.get('carrier', 'N/A'))}
Status: {claim.get('status', 'Active')}

Strategy & Game Plan:
- Document your approach, key arguments, and negotiation tactics here

Adjuster Communications:
- Initial adjuster contact
- Inspection scheduled
- Estimate received

Settlement Tracking:
- Initial Carrier Estimate: $____
- Our Estimate: $____
- Final Settlement: $____
"""
    title = f"{claim.get('claim_number', 'Claim')} - Strategy"
    result = await _create_presentation(title, content, "carrier")

    await db.claim_strategy_pages.insert_one({
        "claim_id": request.claim_id,
        "gamma_id": result.get("gamma_id"),
        "gamma_url": result.get("url"),
        "edit_url": result.get("edit_url"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("id"),
    })

    return {
        "success": True,
        "page_id": result.get("gamma_id"),
        "url": result.get("url"),
        "edit_url": result.get("edit_url"),
        "message": "Strategy page created",
    }


@router.get("/claim-page/{claim_id}")
async def get_claim_strategy_page(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get the Gamma strategy page for a claim."""
    page = await db.claim_strategy_pages.find_one({"claim_id": claim_id}, {"_id": 0})

    if not page:
        return {"exists": False}

    return {
        "exists": True,
        "page_id": page.get("gamma_id"),
        "url": page.get("gamma_url"),
        "edit_url": page.get("edit_url"),
        "created_at": page.get("created_at"),
    }


# ============ GAMMA PRESENTATION GENERATION ============

class GammaPresentationRequest(BaseModel):
    title: str
    content: str
    audience: str = "client_update"
    template: str = "presentation"


async def _poll_generation(generation_id: str) -> dict:
    """Poll Gamma API until generation completes or times out."""
    elapsed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < GAMMA_POLL_MAX_WAIT:
            await asyncio.sleep(GAMMA_POLL_INTERVAL)
            elapsed += GAMMA_POLL_INTERVAL

            try:
                resp = await client.get(
                    f"{GAMMA_API_URL}/generations/{generation_id}",
                    headers=_gamma_headers(),
                )
                if resp.status_code != 200:
                    logger.warning(f"Gamma poll HTTP {resp.status_code}: {resp.text[:300]}")
                    continue

                data = resp.json()
                status = data.get("status", "")

                if status == "completed":
                    return data
                elif status in ("failed", "error"):
                    raise HTTPException(
                        status_code=502,
                        detail=f"Gamma generation failed: {data.get('message', 'unknown error')}",
                    )
                # else still pending, keep polling
            except httpx.RequestError as e:
                logger.warning(f"Gamma poll network error: {e}")
                continue

    raise HTTPException(
        status_code=504,
        detail=f"Gamma generation timed out after {GAMMA_POLL_MAX_WAIT}s",
    )


async def _create_presentation(title: str, content: str, audience: str) -> dict:
    """Create a presentation via Gamma API v1.0.

    1. POST /generations with inputText
    2. Poll GET /generations/{id} until status=completed
    3. Return gammaUrl + constructed edit/share URLs
    """
    if not GAMMA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Gamma API key not configured. Set GAMMA_API_KEY in .env.",
        )

    # Build the prompt with title context
    input_text = f"Title: {title}\n\n{content}"

    payload = {
        "inputText": input_text,
        "textMode": "generate",
        "format": "presentation",
        "numCards": 8,
        "textOptions": {
            "tone": "professional",
            "audience": audience,
        },
        "imageOptions": {
            "source": "stock",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{GAMMA_API_URL}/generations",
                json=payload,
                headers=_gamma_headers(),
            )
            response.raise_for_status()
            data = response.json()

        generation_id = data.get("generationId")
        if not generation_id:
            logger.warning(f"Gamma API returned no generationId: {data}")
            raise HTTPException(
                status_code=502,
                detail="Gamma API returned an unexpected response (no generationId)",
            )

        # Poll for completion
        completed = await _poll_generation(generation_id)
        gamma_url = completed.get("gammaUrl", "")
        gamma_id = generation_id

        # Extract the doc slug from gammaUrl if possible
        # gammaUrl format: https://gamma.app/docs/SLUG
        edit_url = gamma_url
        share_url = gamma_url

        return {
            "gamma_id": gamma_id,
            "edit_url": edit_url,
            "share_url": share_url,
            "url": gamma_url,
            "audience": audience,
            "status": "completed",
            "credits": completed.get("credits"),
        }
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        logger.error(f"Gamma API error: {e}")
        detail = str(e)
        try:
            detail = e.response.json().get("message", str(e))
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Gamma API error: {detail}")
    except httpx.RequestError as e:
        logger.error(f"Gamma request failed: {e}")
        raise HTTPException(status_code=503, detail="Unable to reach Gamma service")


@router.post("/presentation")
async def create_gamma_presentation(
    request: GammaPresentationRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a Gamma presentation deck from content.
    Returns edit_url, share_url, and gamma_url."""
    return await _create_presentation(request.title, request.content, request.audience)


def _format_timeline(events: list[dict]) -> list[dict]:
    out: list[dict] = []
    for event in events:
        out.append({
            "date": str(event.get("occurred_at") or event.get("created_at") or ""),
            "label": event.get("summary") or event.get("event_type") or "Timeline event",
        })
    return out


@router.post("/presentation/{audience}")
async def create_gamma_presentation_for_audience(
    audience: str,
    claim_id: str = Query(...),
    current_user: dict = Depends(get_current_active_user),
):
    """Create a presentation for a specific audience type using claim data."""
    claim = await _get_claim_for_user_or_403(claim_id, current_user)
    events = await db.claim_events.find(
        {"claim_id": claim_id}, {"_id": 0}
    ).sort("occurred_at", 1).to_list(120)
    timeline = _format_timeline(events)

    tasks = []
    if claim.get("next_actions_firm"):
        tasks.append({"label": claim["next_actions_firm"], "owner": "firm", "done": False})
    if claim.get("next_actions_client"):
        tasks.append({"label": claim["next_actions_client"], "owner": "carrier", "done": False})

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
            claim, {"total": estimate_total}, {"total": carrier_total}, [],
        )
    elif audience_token == "settlement":
        gross = float(claim.get("settlement_amount") or claim.get("estimated_value") or 0)
        content = pack_settlement(
            claim,
            {"gross": gross, "deductible": 0, "fee": 0, "net": gross},
            timeline, [],
        )
    elif audience_token == "rep_performance":
        content = pack_rep_performance(
            current_user,
            {
                "period": "Current period",
                "doors": 0, "leads": 0, "appointments": 0, "contracts": 0,
                "lead_to_appt": 0, "appt_to_signed": 0,
                "revenue": 0, "avg_deal": 0,
            },
        )
    elif audience_token == "pastor_report":
        content = pack_pastor_report(
            {"name": "Eden Claims"},
            {"period": "Current period", "families_helped": 0,
             "total_claim_value": 0, "fees_earned": 0, "giving": 0},
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
    """Compatibility alias used by existing frontend hook."""
    return await create_gamma_presentation_for_audience(
        audience="client_update",
        claim_id=claim_id,
        current_user=current_user,
    )


# ============ LEGACY STUBS (Notion-style APIs that Gamma doesn't have) ============
# These endpoints are kept for frontend compatibility but return empty/stub data.
# The admin GammaIntegration UI has been simplified to not depend on these.

@router.get("/databases")
async def list_databases(current_user: dict = Depends(get_current_active_user)):
    """Stub: Gamma has no database API. Returns locally tracked presentations."""
    syncs = await db.gamma_syncs.find({}, {"_id": 0}).to_list(100)
    return {"databases": [], "presentations": syncs}


@router.post("/databases/create")
async def create_claims_database(current_user: dict = Depends(get_current_active_user)):
    """Stub: Gamma has no database API."""
    raise HTTPException(
        status_code=400,
        detail="Gamma does not support database creation. Use 'Generate Deck' to create presentations.",
    )


@router.get("/pages")
async def list_pages(current_user: dict = Depends(get_current_active_user)):
    """Stub: Returns locally tracked strategy pages."""
    pages = await db.claim_strategy_pages.find({}, {"_id": 0}).to_list(100)
    return {"pages": pages}
