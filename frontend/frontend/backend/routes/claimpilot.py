"""ClaimPilot AI API Routes — pending actions, insights, agent triggers, analytics."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import get_current_active_user, db
from models import get_role_level

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/claimpilot", tags=["ClaimPilot AI"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MIN_LEVEL_ADJUSTER = 50
MIN_LEVEL_MANAGER = 75
MIN_LEVEL_ADMIN = 100


def _require_level(user: dict, min_level: int, label: str) -> None:
    """Raise 403 if user role is below *min_level*."""
    level = get_role_level(user.get("role", "client"))
    if level < min_level:
        raise HTTPException(status_code=403, detail=f"{label} access required")


def _envelope(data, **meta):
    """Standard Eden-2 response envelope."""
    return {"success": True, "data": data, "meta": meta or {}}


# ---------------------------------------------------------------------------
# 1. GET /pending — adjuster+ (level >= 50)
# ---------------------------------------------------------------------------

@router.get("/pending")
async def get_pending_actions(
    claim_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """Return pending approval-gate actions."""
    _require_level(current_user, MIN_LEVEL_ADJUSTER, "Adjuster")

    from services.claimpilot.orchestrator import get_orchestrator

    gate = get_orchestrator()._approval_gate
    actions = await gate.get_pending(claim_id=claim_id, limit=limit)
    return _envelope(actions, count=len(actions))


# ---------------------------------------------------------------------------
# 2. POST /pending/{action_id}/approve — manager+ (level >= 75)
# ---------------------------------------------------------------------------

@router.post("/pending/{action_id}/approve")
async def approve_action(
    action_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Approve a pending agent action."""
    _require_level(current_user, MIN_LEVEL_MANAGER, "Manager")

    from services.claimpilot.orchestrator import get_orchestrator

    gate = get_orchestrator()._approval_gate
    ok = await gate.approve(action_id, reviewed_by=current_user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Action not found or not pending")
    return _envelope({"action_id": action_id, "status": "approved"})


# ---------------------------------------------------------------------------
# 3. POST /pending/{action_id}/reject — manager+ (level >= 75)
# ---------------------------------------------------------------------------

@router.post("/pending/{action_id}/reject")
async def reject_action(
    action_id: str,
    reason: str = Query(""),
    current_user: dict = Depends(get_current_active_user),
):
    """Reject a pending agent action."""
    _require_level(current_user, MIN_LEVEL_MANAGER, "Manager")

    from services.claimpilot.orchestrator import get_orchestrator

    gate = get_orchestrator()._approval_gate
    ok = await gate.reject(action_id, reviewed_by=current_user["id"], reason=reason)
    if not ok:
        raise HTTPException(status_code=404, detail="Action not found or not pending")
    return _envelope({"action_id": action_id, "status": "rejected"})


# ---------------------------------------------------------------------------
# 4. GET /claims/{claim_id}/insights — any authenticated user
# ---------------------------------------------------------------------------

@router.get("/claims/{claim_id}/insights")
async def get_claim_insights(
    claim_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Return ClaimPilot insights for a specific claim."""
    docs = (
        await db.claimpilot_insights.find(
            {"claim_id": claim_id}, {"_id": 0}
        )
        .sort("created_at", -1)
        .to_list(limit)
    )
    return _envelope(docs, claim_id=claim_id, count=len(docs))


# ---------------------------------------------------------------------------
# 5. POST /claims/{claim_id}/run/{agent_name} — adjuster+ (level >= 50)
# ---------------------------------------------------------------------------

@router.post("/claims/{claim_id}/run/{agent_name}")
async def run_agent(
    claim_id: str,
    agent_name: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Manually trigger a ClaimPilot agent for a claim."""
    _require_level(current_user, MIN_LEVEL_ADJUSTER, "Adjuster")

    from services.claimpilot.orchestrator import get_orchestrator

    orchestrator = get_orchestrator()
    result = await orchestrator.run_agent(agent_name, claim_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")
    serialized = result.model_dump() if hasattr(result, "model_dump") else vars(result)
    return _envelope(serialized, claim_id=claim_id, agent=agent_name)


# ---------------------------------------------------------------------------
# 6. GET /analytics — admin only (level >= 100)
# ---------------------------------------------------------------------------

@router.get("/analytics")
async def get_analytics(
    current_user: dict = Depends(get_current_active_user),
):
    """Aggregate agent performance stats from the audit collection."""
    _require_level(current_user, MIN_LEVEL_ADMIN, "Admin")

    pipeline = [
        {
            "$group": {
                "_id": "$agent_name",
                "total_runs": {"$sum": 1},
                "successes": {
                    "$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}
                },
                "avg_confidence": {"$avg": "$confidence"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
            }
        }
    ]
    stats = await db.claimpilot_audit.aggregate(pipeline).to_list(100)
    return _envelope(stats, count=len(stats))
