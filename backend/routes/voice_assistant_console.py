"""
Voice Assistant Console API Routes
Admin endpoints for managing Voice Assistant configuration
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from dependencies import db, get_current_active_user as get_current_user
from voice_models import (
    AssistantConfig, ScriptSet, GuardrailConfig, CallLog,
    AssistantConfigUpdate, ScriptSetUpdate, GuardrailConfigUpdate,
    CallLogFilter, CallIntent
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice-assistant", tags=["voice-assistant"])


# ============ ASSISTANT CONFIG ============

@router.get("/config")
async def get_assistant_config(current_user: dict = Depends(get_current_user)):
    """Get current voice assistant configuration"""
    config = await db.voice_assistant_config.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    
    if not config:
        # Return default config if none exists
        return AssistantConfig(
            id="default",
            version=1,
            enabled=False,
            twilio_numbers=[],
            created_at=datetime.now(timezone.utc).isoformat()
        ).dict()
    
    return config


@router.put("/config")
async def update_assistant_config(
    update: AssistantConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update voice assistant configuration (creates new version)"""
    # Get current config
    current = await db.voice_assistant_config.find_one({"is_active": True})
    
    if current:
        # Increment version
        new_version = current.get("version", 0) + 1
        
        # Mark current as inactive
        await db.voice_assistant_config.update_one(
            {"id": current["id"]},
            {"$set": {"is_active": False}}
        )
        
        # Create new config with updates
        new_config = {**current, "_id": None}
    else:
        new_version = 1
        new_config = AssistantConfig(
            id=str(uuid.uuid4()),
            version=new_version
        ).dict()
    
    # Apply updates
    update_dict = update.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            if hasattr(value, 'dict'):
                new_config[key] = value.dict()
            else:
                new_config[key] = value
    
    new_config["id"] = str(uuid.uuid4())
    new_config["version"] = new_version
    new_config["is_active"] = True
    new_config["updated_at"] = datetime.now(timezone.utc).isoformat()
    new_config["updated_by"] = current_user.get("id")
    
    # Remove _id if present
    new_config.pop("_id", None)
    
    await db.voice_assistant_config.insert_one(new_config)
    
    logger.info(f"Voice assistant config updated to version {new_version}")
    return {"message": "Configuration updated", "version": new_version}


@router.post("/config/toggle")
async def toggle_assistant(
    enabled: bool,
    current_user: dict = Depends(get_current_user)
):
    """Quick toggle for assistant enabled/disabled"""
    result = await db.voice_assistant_config.update_one(
        {"is_active": True},
        {"$set": {"enabled": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        # Create default config if none exists
        new_config = AssistantConfig(
            id=str(uuid.uuid4()),
            version=1,
            enabled=enabled,
            created_at=datetime.now(timezone.utc).isoformat()
        ).dict()
        new_config["is_active"] = True
        await db.voice_assistant_config.insert_one(new_config)
    
    status = "enabled" if enabled else "disabled"
    logger.info(f"Voice assistant {status} by {current_user.get('email')}")
    return {"message": f"Voice assistant {status}", "enabled": enabled}


# ============ SCRIPTS ============

@router.get("/scripts")
async def get_script_set(current_user: dict = Depends(get_current_user)):
    """Get current active script set"""
    scripts = await db.voice_script_sets.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    
    if not scripts:
        return ScriptSet(
            id="default",
            version=1,
            created_at=datetime.now(timezone.utc).isoformat()
        ).dict()
    
    return scripts


@router.put("/scripts")
async def update_script_set(
    update: ScriptSetUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update scripts (creates new version)"""
    current = await db.voice_script_sets.find_one({"is_active": True})
    
    if current:
        new_version = current.get("version", 0) + 1
        await db.voice_script_sets.update_one(
            {"id": current["id"]},
            {"$set": {"is_active": False}}
        )
        new_scripts = {**current, "_id": None}
    else:
        new_version = 1
        new_scripts = ScriptSet(id=str(uuid.uuid4()), version=new_version).dict()
    
    update_dict = update.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            if hasattr(value, 'dict'):
                new_scripts[key] = value.dict()
            else:
                new_scripts[key] = value
    
    new_scripts["id"] = str(uuid.uuid4())
    new_scripts["version"] = new_version
    new_scripts["is_active"] = True
    new_scripts["updated_at"] = datetime.now(timezone.utc).isoformat()
    new_scripts.pop("_id", None)
    
    await db.voice_script_sets.insert_one(new_scripts)
    
    return {"message": "Scripts updated", "version": new_version}


@router.get("/scripts/history")
async def get_script_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get script version history"""
    scripts = await db.voice_script_sets.find(
        {},
        {"_id": 0, "id": 1, "version": 1, "name": 1, "is_active": 1, "updated_at": 1}
    ).sort("version", -1).limit(limit).to_list(length=limit)
    
    return scripts


# ============ GUARDRAILS ============

@router.get("/guardrails")
async def get_guardrails(current_user: dict = Depends(get_current_user)):
    """Get current guardrail configuration"""
    guardrails = await db.voice_guardrails.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    
    if not guardrails:
        return GuardrailConfig(
            id="default",
            version=1,
            created_at=datetime.now(timezone.utc).isoformat()
        ).dict()
    
    return guardrails


@router.put("/guardrails")
async def update_guardrails(
    update: GuardrailConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update guardrails (creates new version)"""
    current = await db.voice_guardrails.find_one({"is_active": True})
    
    if current:
        new_version = current.get("version", 0) + 1
        await db.voice_guardrails.update_one(
            {"id": current["id"]},
            {"$set": {"is_active": False}}
        )
        new_guardrails = {**current, "_id": None}
    else:
        new_version = 1
        new_guardrails = GuardrailConfig(id=str(uuid.uuid4()), version=new_version).dict()
    
    update_dict = update.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            if hasattr(value, 'dict'):
                new_guardrails[key] = value.dict()
            else:
                new_guardrails[key] = value
    
    new_guardrails["id"] = str(uuid.uuid4())
    new_guardrails["version"] = new_version
    new_guardrails["is_active"] = True
    new_guardrails["updated_at"] = datetime.now(timezone.utc).isoformat()
    new_guardrails.pop("_id", None)
    
    await db.voice_guardrails.insert_one(new_guardrails)
    
    return {"message": "Guardrails updated", "version": new_version}


# ============ CALL LOGS ============

@router.get("/calls")
async def get_call_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    intent: Optional[str] = None,
    flagged_only: bool = False,
    claim_id: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get call logs with filtering"""
    query = {}
    
    if start_date:
        query["start_time"] = {"$gte": start_date}
    if end_date:
        if "start_time" in query:
            query["start_time"]["$lte"] = end_date
        else:
            query["start_time"] = {"$lte": end_date}
    if intent:
        query["intent"] = intent
    if flagged_only:
        query["flagged_for_review"] = True
    if claim_id:
        query["matched_claim_id"] = claim_id
    
    calls = await db.voice_call_logs.find(
        query,
        {"_id": 0}
    ).sort("start_time", -1).skip(offset).limit(limit).to_list(length=limit)
    
    total = await db.voice_call_logs.count_documents(query)
    
    return {
        "calls": calls,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/calls/{call_id}")
async def get_call_detail(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed call log"""
    call = await db.voice_call_logs.find_one(
        {"id": call_id},
        {"_id": 0}
    )
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return call


@router.put("/calls/{call_id}/follow-up")
async def update_call_follow_up(
    call_id: str,
    completed: bool,
    notes: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update call follow-up status"""
    update_data = {
        "follow_up_completed": completed,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if notes:
        update_data["follow_up_notes"] = notes
    if assigned_to:
        update_data["follow_up_assigned_to"] = assigned_to
    
    result = await db.voice_call_logs.update_one(
        {"id": call_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Follow-up updated"}


@router.put("/calls/{call_id}/flag")
async def flag_call(
    call_id: str,
    flagged: bool,
    reasons: List[str] = [],
    current_user: dict = Depends(get_current_user)
):
    """Flag or unflag a call for review"""
    result = await db.voice_call_logs.update_one(
        {"id": call_id},
        {"$set": {
            "flagged_for_review": flagged,
            "flag_reasons": reasons,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Call flag updated"}


# ============ STATS ============

@router.get("/stats")
async def get_voice_stats(
    days: int = Query(default=7, le=30),
    current_user: dict = Depends(get_current_user)
):
    """Get voice assistant statistics"""
    from datetime import timedelta
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total calls
    total_calls = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": start_date}}
    )
    
    # Matched calls
    matched_calls = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": start_date}, "matched_claim_id": {"$ne": None}}
    )
    
    # Flagged calls
    flagged_calls = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": start_date}, "flagged_for_review": True}
    )
    
    # Intent breakdown
    pipeline = [
        {"$match": {"start_time": {"$gte": start_date}}},
        {"$group": {"_id": "$intent", "count": {"$sum": 1}}}
    ]
    intent_results = await db.voice_call_logs.aggregate(pipeline).to_list(length=20)
    intent_breakdown = {r["_id"]: r["count"] for r in intent_results if r["_id"]}
    
    # Appointments confirmed
    appointments_confirmed = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": start_date}, "appointment_action_taken": "confirmed"}
    )
    
    # Follow-ups pending
    follow_ups_pending = await db.voice_call_logs.count_documents(
        {"follow_up_required": True, "follow_up_completed": False}
    )
    
    return {
        "period_days": days,
        "total_calls": total_calls,
        "matched_calls": matched_calls,
        "match_rate": round(matched_calls / total_calls * 100, 1) if total_calls > 0 else 0,
        "flagged_calls": flagged_calls,
        "intent_breakdown": intent_breakdown,
        "appointments_confirmed": appointments_confirmed,
        "follow_ups_pending": follow_ups_pending
    }


@router.get("/stats/today")
async def get_today_stats(current_user: dict = Depends(get_current_user)):
    """Get today's quick stats for dashboard"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    today_calls = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": today_start}}
    )
    
    today_matched = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": today_start}, "matched_claim_id": {"$ne": None}}
    )
    
    today_flagged = await db.voice_call_logs.count_documents(
        {"start_time": {"$gte": today_start}, "flagged_for_review": True}
    )
    
    # Get last 10 calls
    recent_calls = await db.voice_call_logs.find(
        {},
        {"_id": 0, "id": 1, "from_number": 1, "matched_client_name": 1, 
         "matched_claim_id": 1, "intent": 1, "ai_summary": 1, "start_time": 1}
    ).sort("start_time", -1).limit(10).to_list(length=10)
    
    return {
        "today_calls": today_calls,
        "today_matched": today_matched,
        "today_flagged": today_flagged,
        "recent_calls": recent_calls
    }
