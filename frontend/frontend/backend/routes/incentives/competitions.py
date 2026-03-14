"""
Incentives Engine - Competition Management - CRUD and lifecycle operations
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

from dependencies import db, get_current_active_user as get_current_user
from incentives_engine.models import (
    MetricAggregation, SeasonStatus, CompetitionStatus, CompetitionScope,
    IncentiveRuleType, DurationType, CompetitionCategory,
    Season, Metric, CompetitionTemplate, Competition, IncentiveRule,
    Participant, CompetitionResult, MilestoneConfig,
    SeasonCreate, SeasonUpdate, MetricCreate,
    CompetitionCreate, CompetitionFromTemplate, RuleCreate,
)
from incentives_engine.evaluator import IncentiveEvaluator, process_harvest_event


router = APIRouter()

# ============================================

@router.get("/competitions")
async def get_competitions(
    status: Optional[str] = None,
    season_id: Optional[str] = None,
    include_past: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all competitions"""
    query = {}
    
    if status:
        query["status"] = status
    elif not include_past:
        # Show active, scheduled, and recently completed
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["$or"] = [
            {"status": {"$in": ["active", "scheduled", "draft", "paused"]}},
            {"end_date": {"$gte": week_ago}}
        ]
    
    if season_id:
        query["season_id"] = season_id
    
    competitions = await db.incentive_competitions.find(
        query, {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    
    user_id = current_user.get("id")
    
    # Enrich with stats
    enriched = []
    for comp in competitions:
        # Calculate time remaining
        time_remaining = calculate_time_remaining(comp["end_date"])
        
        # Get user's progress
        my_participant = await db.incentive_participants.find_one(
            {"competition_id": comp["id"], "user_id": user_id},
            {"_id": 0}
        )
        
        # Get leader
        leader = await db.incentive_participants.find(
            {"competition_id": comp["id"]}
        ).sort("current_value", -1).limit(1).to_list(1)
        
        leader_info = {"name": "No entries", "value": 0}
        if leader:
            leader_info = {
                "name": leader[0].get("user_name", "Unknown"),
                "value": leader[0].get("current_value", 0)
            }
        
        enriched.append({
            **comp,
            "time_remaining": time_remaining,
            "my_rank": my_participant.get("rank") if my_participant else None,
            "my_value": my_participant.get("current_value", 0) if my_participant else 0,
            "leader": leader_info
        })
    
    return {"competitions": enriched}


@router.get("/competitions/{competition_id}")
async def get_competition(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get competition details with leaderboard"""
    competition = await db.incentive_competitions.find_one(
        {"id": competition_id}, {"_id": 0}
    )
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # Get metric info
    metric = await db.incentive_metrics.find_one(
        {"id": competition["metric_id"]}, {"_id": 0}
    )
    
    # Get rules
    rules = await db.incentive_rules.find(
        {"competition_id": competition_id}, {"_id": 0}
    ).sort("priority", 1).to_list(20)
    
    # Get full leaderboard
    leaderboard = await db.incentive_participants.find(
        {"competition_id": competition_id},
        {"_id": 0}
    ).sort("current_value", -1).to_list(100)
    
    # Add ranks
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    # Get user's participation
    user_id = current_user.get("id")
    my_participant = next((p for p in leaderboard if p["user_id"] == user_id), None)
    
    return {
        **competition,
        "metric": metric,
        "rules": rules,
        "leaderboard": leaderboard,
        "my_participation": my_participant,
        "time_remaining": calculate_time_remaining(competition["end_date"])
    }


@router.post("/competitions")
async def create_competition(
    data: CompetitionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new competition"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Validate metric exists
    metric = await db.incentive_metrics.find_one({"id": data.metric_id})
    if not metric:
        raise HTTPException(status_code=400, detail="Invalid metric_id")
    
    competition_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine initial status
    start_dt = datetime.fromisoformat(data.start_date.replace("Z", "+00:00"))
    now_dt = datetime.now(timezone.utc)
    
    status = "scheduled"
    if start_dt <= now_dt:
        status = "active"
    
    competition_doc = {
        "id": competition_id,
        **data.dict(),
        "status": status,
        "metric_snapshot": {k: v for k, v in metric.items() if k != "_id"},
        "eligibility": {
            "all_users": True,
            "min_tenure_days": None,
            "max_tenure_days": None,
            "required_role_ids": [],
            "required_team_ids": [],
            "excluded_user_ids": [],
            "requires_opt_in": False
        },
        "rule_ids": [],
        "reward_pool": [],
        "show_in_today": True,
        "show_in_leaderboard": True,
        "show_in_challenges": True,
        "show_real_time_updates": True,
        "participant_count": 0,
        "qualified_count": 0,
        "evaluated_at": None,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now,
    }
    
    await db.incentive_competitions.insert_one(competition_doc)
    
    # Add to season if specified
    if data.season_id:
        await db.incentive_seasons.update_one(
            {"id": data.season_id},
            {"$push": {"competition_ids": competition_id}}
        )
    
    # Initialize participants for eligible users
    if status == "active":
        await initialize_competition_participants(competition_id)
    
    return {"id": competition_id, "status": status, "message": "Competition created successfully"}


@router.post("/competitions/from-template")
async def create_competition_from_template(
    data: CompetitionFromTemplate,
    current_user: dict = Depends(get_current_user)
):
    """Create a competition from a template"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    template = await db.incentive_templates.find_one({"id": data.template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Calculate end date (use provided or calculate from template)
    start_dt = datetime.fromisoformat(data.start_date.replace("Z", "+00:00"))
    if data.end_date:
        end_dt = datetime.fromisoformat(data.end_date.replace("Z", "+00:00"))
    else:
        duration_days = template.get("default_duration_days", 7)
        end_dt = start_dt + timedelta(days=duration_days)
    
    # Build competition data
    competition_data = CompetitionCreate(
        name=data.name,
        description=template["description"],
        tagline=template.get("tagline", ""),
        start_date=data.start_date,
        end_date=end_dt.isoformat(),
        metric_id=template["default_metric_id"],
        scope=template.get("default_scope", "individual"),
        team_grouping=template.get("default_team_grouping"),
        icon=template["icon"],
        banner_color=template["banner_color"],
        points_bonus=template.get("suggested_points_bonus", 0),
        template_id=data.template_id,
        season_id=data.season_id
    )
    
    # Apply overrides
    if data.overrides:
        for key, value in data.overrides.items():
            if hasattr(competition_data, key):
                setattr(competition_data, key, value)
    
    # Create competition
    result = await create_competition(competition_data, current_user)
    competition_id = result["id"]
    
    # Create rules from template
    for rule_config in template.get("default_rules", []):
        rule_data = RuleCreate(
            competition_id=competition_id,
            type=rule_config["type"],
            **rule_config.get("config", {}),
            **rule_config.get("reward_config", {})
        )
        await create_rule(rule_data, current_user)
    
    # Update template usage stats
    await db.incentive_templates.update_one(
        {"id": data.template_id},
        {
            "$inc": {"times_used": 1},
            "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return result


@router.post("/competitions/{competition_id}/start")
async def start_competition(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a competition (moves from scheduled/draft to active)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    if competition["status"] not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail=f"Cannot start {competition['status']} competition")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.incentive_competitions.update_one(
        {"id": competition_id},
        {"$set": {"status": "active", "start_date": now, "updated_at": now}}
    )
    
    # Initialize participants
    await initialize_competition_participants(competition_id)
    
    return {"message": "Competition started"}


@router.post("/competitions/{competition_id}/end")
async def end_competition(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End a competition early and evaluate results"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    if competition["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Cannot end {competition['status']} competition")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Set to evaluating
    await db.incentive_competitions.update_one(
        {"id": competition_id},
        {"$set": {"status": "evaluating", "end_date": now, "updated_at": now}}
    )
    
    # Evaluate and finalize
    await evaluate_competition(competition_id)
    
    return {"message": "Competition ended and evaluated"}


# ============================================
# RULES
# ============================================

@router.get("/competitions/{competition_id}/rules")
async def get_competition_rules(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get rules for a competition"""
    rules = await db.incentive_rules.find(
        {"competition_id": competition_id}, {"_id": 0}
    ).sort("priority", 1).to_list(20)
    
    return {"rules": rules}


@router.post("/rules")
async def create_rule(
    data: RuleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create an incentive rule"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Verify competition exists
    competition = await db.incentive_competitions.find_one({"id": data.competition_id})
    if not competition:
        raise HTTPException(status_code=400, detail="Competition not found")
    
    rule_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    rule_doc = {
        "id": rule_id,
        **data.dict(),
        "display_name": get_rule_display_name(data),
        "display_description": get_rule_description(data),
        "created_at": now,
    }
    
    await db.incentive_rules.insert_one(rule_doc)
    
    # Add rule ID to competition
    await db.incentive_competitions.update_one(
        {"id": data.competition_id},
        {"$push": {"rule_ids": rule_id}}
    )
    
    return {"id": rule_id, "message": "Rule created successfully"}


# ============================================
