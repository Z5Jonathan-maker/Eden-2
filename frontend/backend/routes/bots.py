"""
Bot Management Routes
Endpoints for triggering and monitoring background bots.
"""
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_active_user, require_role
from workers.scheduler import get_scheduler_status
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bots", tags=["Bot Workers"])


@router.get("/status")
async def get_bots_status(current_user: dict = Depends(get_current_active_user)):
    """Get status of all background bot workers"""
    return get_scheduler_status()


@router.post("/trigger/{bot_name}/{job_type}")
async def trigger_bot_job(
    bot_name: str,
    job_type: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Manually trigger a bot job (admin only).
    
    bot_name: harvest_coach, claims_ops, comms_bot
    job_type: hourly, nightly, periodic
    """
    try:
        if bot_name == "harvest_coach":
            from workers.harvest_coach import run_hourly_check, run_nightly_summary
            if job_type == "hourly":
                await run_hourly_check()
            elif job_type == "nightly":
                await run_nightly_summary()
            else:
                raise HTTPException(status_code=400, detail=f"Unknown job type: {job_type}")
        
        elif bot_name == "claims_ops":
            from workers.claims_ops_bot import run_hourly_check, run_nightly_summary
            if job_type == "hourly":
                await run_hourly_check()
            elif job_type == "nightly":
                await run_nightly_summary()
            else:
                raise HTTPException(status_code=400, detail=f"Unknown job type: {job_type}")
        
        elif bot_name == "comms_bot":
            from workers.comms_bot import run_periodic_check
            if job_type == "periodic":
                await run_periodic_check()
            else:
                raise HTTPException(status_code=400, detail=f"Unknown job type: {job_type}")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown bot: {bot_name}")
        
        return {
            "status": "success",
            "message": f"Triggered {bot_name} {job_type} job",
            "triggered_by": current_user.get("email")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bot trigger error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/recent")
async def get_recent_bot_notifications(
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get recent notifications from all bots for the current user"""
    from dependencies import db
    
    notifications = await db.notifications.find(
        {
            "user_id": current_user["id"],
            "type": {"$in": ["harvest_coach", "claims_ops", "comms_bot"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Group by type
    grouped = {
        "harvest_coach": [],
        "claims_ops": [],
        "comms_bot": []
    }
    
    for notif in notifications:
        notif_type = notif.get("type")
        if notif_type in grouped:
            grouped[notif_type].append(notif)
    
    return {
        "total": len(notifications),
        "by_type": grouped
    }
