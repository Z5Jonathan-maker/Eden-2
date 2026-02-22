from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from services.observability import MetricsCollector, get_logger
from dependencies import require_role, get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = get_logger("eden.admin")

@router.get("/users")
async def list_admin_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    List users for admin turf assignment and management surfaces.
    Returns a compact payload with stable `id` and no sensitive fields.
    """
    users = await db.users.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "password": 0}
    ).to_list(500)
    return users

@router.get("/metrics")
async def get_system_metrics(
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Get system-wide metrics for operational visibility.
    Objective: Metrics & Signals
    """
    logger.audit("view_metrics", current_user["email"], "system", {})
    return MetricsCollector.get_snapshot()

@router.get("/claims/{claim_id}/audit")
async def get_claim_audit_trail(
    claim_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Introspect full lifecycle history of a claim.
    Objective: Admin Introspection Tools
    """
    # Fetch claim
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
        
    # Fetch related events (simulated audit trail from logs or event store)
    # In a real system, we'd query a dedicated audit collection.
    # Here we show the metadata we have.
    
    return {
        "claim_id": claim_id,
        "current_status": claim.get("status"),
        "created_at": claim.get("created_at"),
        "updated_at": claim.get("updated_at"),
        "metadata": {
            "created_by": claim.get("created_by"),
            "assigned_to": claim.get("assigned_to"),
            "is_archived": claim.get("is_archived", False)
        },
        # Placeholder for event sourcing history
        "history": [
            {"event": "Created", "timestamp": claim.get("created_at"), "user": claim.get("created_by")},
            {"event": "Last Update", "timestamp": claim.get("updated_at"), "user": "system"}
        ]
    }

@router.get("/health/deep")
async def deep_health_check(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Deep health check verifying dependencies.
    Objective: Failure Containment
    """
    health_status = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {}
    }
    
    # 1. MongoDB
    try:
        start = datetime.now()
        await db.command("ping")
        latency = (datetime.now() - start).total_seconds() * 1000
        health_status["services"]["mongodb"] = {"status": "ok", "latency_ms": round(latency, 2)}
    except Exception as e:
        health_status["services"]["mongodb"] = {"status": "error", "error": str(e)}
        
    # 2. Stripe (Check API Key presence)
    import os
    if os.environ.get("STRIPE_API_KEY"):
        health_status["services"]["stripe"] = {"status": "configured"}
    else:
        health_status["services"]["stripe"] = {"status": "missing_config"}
        
    return health_status
