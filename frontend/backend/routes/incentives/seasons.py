"""
Incentives Engine - Season Management - CRUD operations for competition seasons
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

@router.get("/seasons")
async def get_seasons(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all seasons"""
    query = {}
    if status:
        query["status"] = status
    
    seasons = await db.incentive_seasons.find(query, {"_id": 0}).sort("start_date", -1).to_list(20)
    
    # Enrich with stats
    for season in seasons:
        # Count competitions
        comp_count = await db.incentive_competitions.count_documents({
            "season_id": season["id"]
        })
        season["competition_count"] = comp_count
        
        # Get top 3 standings
        standings = await db.incentive_season_standings.find(
            {"season_id": season["id"]},
            {"_id": 0}
        ).sort("total_points", -1).limit(3).to_list(3)
        season["top_standings"] = standings
    
    return {"seasons": seasons}


@router.get("/seasons/{season_id}")
async def get_season(
    season_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get season details with full standings"""
    season = await db.incentive_seasons.find_one({"id": season_id}, {"_id": 0})
    
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    
    # Get all competitions in season
    competitions = await db.incentive_competitions.find(
        {"season_id": season_id},
        {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    
    # Get full standings
    standings = await db.incentive_season_standings.find(
        {"season_id": season_id},
        {"_id": 0}
    ).sort("total_points", -1).to_list(100)
    
    # Add ranks
    for i, standing in enumerate(standings):
        standing["rank"] = i + 1
    
    return {
        **season,
        "competitions": competitions,
        "standings": standings
    }


@router.post("/seasons")
async def create_season(
    data: SeasonCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new season (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    season_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine initial status
    # Handle both timezone-aware and naive datetime strings
    start_date_str = data.start_date.replace("Z", "+00:00")
    if "+" not in start_date_str and "-" not in start_date_str[10:]:
        start_date_str = start_date_str + "+00:00"
    start_dt = datetime.fromisoformat(start_date_str)
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    
    now_dt = datetime.now(timezone.utc)
    
    status = "upcoming"
    if start_dt <= now_dt:
        end_date_str = data.end_date.replace("Z", "+00:00")
        if "+" not in end_date_str and "-" not in end_date_str[10:]:
            end_date_str = end_date_str + "+00:00"
        end_dt = datetime.fromisoformat(end_date_str)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        if end_dt > now_dt:
            status = "active"
        else:
            status = "completed"
    
    season_doc = {
        "id": season_id,
        **data.dict(),
        "status": status,
        "competition_ids": [],
        "final_standings": [],
        "champion_user_id": None,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now,
    }
    
    await db.incentive_seasons.insert_one(season_doc)
    
    return {"id": season_id, "status": status, "message": "Season created successfully"}


@router.patch("/seasons/{season_id}")
async def update_season(
    season_id: str,
    data: SeasonUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a season"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.incentive_seasons.update_one(
        {"id": season_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Season not found")
    
    return {"message": "Season updated"}


@router.put("/seasons/{season_id}")
async def replace_season(
    season_id: str,
    data: SeasonCreate,
    current_user: dict = Depends(get_current_user)
):
    """Replace/update a season (full update)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    existing = await db.incentive_seasons.find_one({"id": season_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Season not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Recalculate status based on dates - handle both timezone-aware and naive datetime strings
    start_date_str = data.start_date.replace("Z", "+00:00")
    if "+" not in start_date_str and "-" not in start_date_str[10:]:
        start_date_str = start_date_str + "+00:00"
    start_dt = datetime.fromisoformat(start_date_str)
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    
    end_date_str = data.end_date.replace("Z", "+00:00")
    if "+" not in end_date_str and "-" not in end_date_str[10:]:
        end_date_str = end_date_str + "+00:00"
    end_dt = datetime.fromisoformat(end_date_str)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)
    
    now_dt = datetime.now(timezone.utc)
    
    status = "upcoming"
    if start_dt <= now_dt:
        if end_dt > now_dt:
            status = "active"
        else:
            status = "completed"
    
    result = await db.incentive_seasons.update_one(
        {"id": season_id},
        {"$set": {
            **data.dict(),
            "status": status,
            "updated_at": now
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Season not found or no changes made")
    
    return {"message": "Season updated successfully", "status": status}


@router.delete("/seasons/{season_id}")
async def delete_season(
    season_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a season (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    existing = await db.incentive_seasons.find_one({"id": season_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Season not found")
    
    # Unlink competitions from this season but don't delete them
    await db.incentive_competitions.update_many(
        {"season_id": season_id},
        {"$set": {"season_id": None}}
    )
    
    result = await db.incentive_seasons.delete_one({"id": season_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Season not found")
    
    return {"message": "Season deleted successfully"}


# ============================================
# COMPETITION TEMPLATES
# ============================================

SEED_TEMPLATES = [
    {
        "id": "template-daily-sprint",
        "name": "Daily Sprint",
        "description": "Hit a daily door target for instant rewards",
        "tagline": "Crush today's goal!",
        "default_metric_id": "metric-doors",
        "default_duration_type": "day",
        "default_duration_days": 1,
        "default_scope": "individual",
        "default_rules": [
            {"type": "threshold", "config": {"threshold_value": 25}, "reward_config": {"points_award": 50}}
        ],
        "suggested_points_bonus": 25,
        "icon": "🏃",
        "banner_color": "#10B981",
        "category": "sprint",
        "is_system": True,
    },
    {
        "id": "template-weekend-blitz",
        "name": "Weekend Blitz",
        "description": "Push door volume with guaranteed reward for hitting target",
        "tagline": "75 doors = $50 guaranteed!",
        "default_metric_id": "metric-doors",
        "default_duration_type": "weekend",
        "default_duration_days": 3,
        "default_scope": "individual",
        "default_rules": [
            {"type": "threshold", "config": {"threshold_value": 75}, "reward_config": {"points_award": 150}},
            {"type": "top_n", "config": {"top_n": 3}, "reward_config": {"points_award": 100}}
        ],
        "suggested_points_bonus": 50,
        "icon": "⚡",
        "banner_color": "#F97316",
        "category": "threshold",
        "is_system": True,
    },
    {
        "id": "template-weekly-ladder",
        "name": "Weekly Ladder",
        "description": "Compete for the top spot over a full week",
        "tagline": "Climb to #1!",
        "default_metric_id": "metric-points",
        "default_duration_type": "week",
        "default_duration_days": 7,
        "default_scope": "individual",
        "default_rules": [
            {"type": "top_n", "config": {"top_n": 10}, "reward_config": {"points_award": 200}}
        ],
        "suggested_points_bonus": 25,
        "icon": "🏆",
        "banner_color": "#6366F1",
        "category": "ladder",
        "is_system": True,
    },
    {
        "id": "template-monthly-championship",
        "name": "Monthly Championship",
        "description": "Big stakes, big rewards. The monthly crown awaits.",
        "tagline": "Champion gets $500!",
        "default_metric_id": "metric-revenue",
        "default_duration_type": "month",
        "default_duration_days": 30,
        "default_scope": "individual",
        "default_rules": [
            {"type": "top_n", "config": {"top_n": 3}, "reward_config": {"points_award": 500}}
        ],
        "suggested_points_bonus": 100,
        "icon": "👑",
        "banner_color": "#FBBF24",
        "category": "ladder",
        "is_system": True,
    },
    {
        "id": "template-office-battle",
        "name": "Office Battle",
        "description": "Team vs team competition. Which office dominates?",
        "tagline": "Your team vs theirs!",
        "default_metric_id": "metric-doors",
        "default_duration_type": "week",
        "default_duration_days": 7,
        "default_scope": "team",
        "default_team_grouping": "office",
        "default_rules": [
            {"type": "top_n", "config": {"top_n": 1}, "reward_config": {"points_award": 300}}
        ],
        "suggested_points_bonus": 50,
        "icon": "⚔️",
        "banner_color": "#EF4444",
        "category": "team_battle",
        "is_system": True,
    },
    {
        "id": "template-new-rep-challenge",
        "name": "New Rep Challenge",
        "description": "Onboarding challenge for new hires. Prove yourself!",
        "tagline": "Show us what you've got!",
        "default_metric_id": "metric-appointments",
        "default_duration_type": "custom",
        "default_duration_days": 14,
        "default_scope": "individual",
        "default_rules": [
            {"type": "milestone", "config": {"milestones": [
                {"tier": "bronze", "value": 5, "points_award": 50},
                {"tier": "silver", "value": 10, "points_award": 100},
                {"tier": "gold", "value": 20, "points_award": 250}
            ]}, "reward_config": {}}
        ],
        "suggested_points_bonus": 100,
        "icon": "🌟",
        "banner_color": "#8B5CF6",
        "category": "milestone",
        "is_system": True,
    },
    {
        "id": "template-storm-response",
        "name": "Storm Response",
        "description": "Rapid deployment after weather event. Time to deliver!",
        "tagline": "Strike while the iron is hot!",
        "default_metric_id": "metric-contracts",
        "default_duration_type": "custom",
        "default_duration_days": 5,
        "default_scope": "individual",
        "default_rules": [
            {"type": "top_n", "config": {"top_n": 5}, "reward_config": {"points_award": 400}},
            {"type": "threshold", "config": {"threshold_value": 3}, "reward_config": {"points_award": 200}}
        ],
        "suggested_points_bonus": 100,
        "icon": "🌪️",
        "banner_color": "#14B8A6",
        "category": "sprint",
        "is_system": True,
    },
]


@router.get("/templates")
async def get_templates(
    category: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all competition templates"""
    query = {}
    if active_only:
        query["is_active"] = True
    if category:
        query["category"] = category
    
    templates = await db.incentive_templates.find(query, {"_id": 0}).to_list(50)
    
    # Seed if empty
    if not templates:
        templates = await seed_templates()
    
    return {"templates": templates, "count": len(templates)}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get template details with usage stats"""
    template = await db.incentive_templates.find_one({"id": template_id}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get competitions created from this template
    recent_competitions = await db.incentive_competitions.find(
        {"template_id": template_id},
        {"_id": 0, "id": 1, "name": 1, "status": 1, "participant_count": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    template["recent_competitions"] = recent_competitions
    
    return template


async def seed_templates() -> list:
    """Seed default templates"""
    now = datetime.now(timezone.utc).isoformat()
    
    for template in SEED_TEMPLATES:
        template["times_used"] = 0
        template["last_used_at"] = None
        template["avg_participation_rate"] = None
        template["is_active"] = True
        template["created_by"] = "system"
        template["created_at"] = now
        template["updated_at"] = now
        
        await db.incentive_templates.update_one(
            {"id": template["id"]},
            {"$set": template},
            upsert=True
        )
    
    return SEED_TEMPLATES


# Template CRUD Endpoints

class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    tagline: str = ""
    icon: str = "🎯"
    banner_color: str = "#F97316"
    category: str = "threshold"
    default_metric_id: str
    default_duration_type: str = "week"
    default_duration_days: int = 7
    default_scope: str = "individual"
    default_team_grouping: Optional[str] = None
    default_rules: List[Dict[str, Any]] = []
    suggested_reward_ids: List[str] = []
    suggested_points_bonus: int = 0


@router.post("/templates")
async def create_template(
    data: TemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new competition template (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    template_id = f"template-{str(uuid.uuid4())[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    template_doc = {
        "id": template_id,
        **data.dict(),
        "times_used": 0,
        "last_used_at": None,
        "avg_participation_rate": None,
        "is_system": False,
        "is_active": True,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.incentive_templates.insert_one(template_doc)
    
    return {"id": template_id, "message": "Template created successfully"}


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    data: TemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a template (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.incentive_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.incentive_templates.update_one(
        {"id": template_id},
        {"$set": {**data.dict(), "updated_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template updated successfully"}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a template (admin only, non-system templates only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.incentive_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if existing.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system templates")
    
    result = await db.incentive_templates.delete_one({"id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted successfully"}


# ============================================
# COMPETITIONS
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
# PARTICIPANTS
# ============================================

@router.get("/competitions/{competition_id}/participants")
async def get_participants(
    competition_id: str,
    limit: int = Query(50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get participants with pagination"""
    participants = await db.incentive_participants.find(
        {"competition_id": competition_id},
        {"_id": 0}
    ).sort("current_value", -1).skip(offset).limit(limit).to_list(limit)
    
    # Add ranks
    for i, p in enumerate(participants):
        p["rank"] = offset + i + 1
    
    total = await db.incentive_participants.count_documents({"competition_id": competition_id})
    
    return {
        "participants": participants,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/me/competitions")
async def get_my_competitions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's competition participations"""
    user_id = current_user.get("id")
    
    # Get all participations
    participations = await db.incentive_participants.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(50)
    
    comp_ids = [p["competition_id"] for p in participations]
    
    # Get competition details
    query = {"id": {"$in": comp_ids}}
    if status:
        query["status"] = status
    
    competitions = await db.incentive_competitions.find(
        query, {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    
    # Merge participation data
    part_map = {p["competition_id"]: p for p in participations}
    
    result = []
    for comp in competitions:
        part = part_map.get(comp["id"], {})
        result.append({
            **comp,
            "my_rank": part.get("rank"),
            "my_value": part.get("current_value", 0),
            "qualified_rules": part.get("qualified_rules", []),
            "time_remaining": calculate_time_remaining(comp["end_date"])
        })
    
    return {"competitions": result}


# ============================================
# HELPER FUNCTIONS
# ============================================

def calculate_time_remaining(end_date_str: str) -> str:
    """Calculate human-readable time remaining"""
    try:
        end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        
        if now_dt >= end_dt:
            return "Ended"
        
        delta = end_dt - now_dt
        
        if delta.days > 0:
            return f"{delta.days}d {delta.seconds // 3600}h"
        elif delta.seconds > 3600:
            return f"{delta.seconds // 3600}h {(delta.seconds % 3600) // 60}m"
        else:
            return f"{delta.seconds // 60}m"
    except Exception:
        return "Unknown"


def get_rule_display_name(rule: RuleCreate) -> str:
    """Generate display name for a rule"""
    if rule.type == IncentiveRuleType.TOP_N:
        return f"Top {rule.top_n or 3}"
    elif rule.type == IncentiveRuleType.THRESHOLD:
        return f"Hit {rule.threshold_value or 0}+"
    elif rule.type == IncentiveRuleType.MILESTONE:
        return "Milestone Tiers"
    elif rule.type == IncentiveRuleType.IMPROVEMENT:
        return f"Improve {rule.improvement_percent or 10}%"
    elif rule.type == IncentiveRuleType.LOTTERY:
        return f"Lottery ({rule.lottery_winner_count or 1} winners)"
    return "Custom Rule"


def get_rule_description(rule: RuleCreate) -> str:
    """Generate description for a rule"""
    if rule.type == IncentiveRuleType.TOP_N:
        return f"Top {rule.top_n or 3} performers win prizes"
    elif rule.type == IncentiveRuleType.THRESHOLD:
        return f"Anyone who reaches {rule.threshold_value or 0} qualifies"
    elif rule.type == IncentiveRuleType.MILESTONE:
        tiers = [m.tier for m in rule.milestones] if rule.milestones else ["bronze", "silver", "gold"]
        return f"Reach tiers: {', '.join(tiers)}"
    elif rule.type == IncentiveRuleType.IMPROVEMENT:
        return f"Beat your baseline by {rule.improvement_percent or 10}%"
    elif rule.type == IncentiveRuleType.LOTTERY:
        return f"Random draw from qualifiers ({rule.lottery_winner_count or 1} winners)"
    return "Custom rule"


async def initialize_competition_participants(competition_id: str):
    """Initialize participants for a competition"""
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    if not competition:
        return
    
    eligibility = competition.get("eligibility", {})
    now = datetime.now(timezone.utc).isoformat()
    
    # Get eligible users
    user_query = {"is_active": True}
    
    if not eligibility.get("all_users", True):
        if eligibility.get("required_role_ids"):
            user_query["role"] = {"$in": eligibility["required_role_ids"]}
    
    if eligibility.get("excluded_user_ids"):
        user_query["id"] = {"$nin": eligibility["excluded_user_ids"]}
    
    users = await db.users.find(user_query, {"_id": 0, "id": 1, "full_name": 1, "email": 1}).to_list(1000)
    
    # Create participant records
    participants = []
    for user in users:
        participant = {
            "id": str(uuid.uuid4()),
            "competition_id": competition_id,
            "user_id": user["id"],
            "user_name": user.get("full_name", user.get("email", "Unknown")),
            "current_value": 0,
            "previous_value": 0,
            "rank": None,
            "value_at_start": 0,
            "peak_value": 0,
            "qualified_rules": [],
            "is_eligible": True,
            "opted_in": True,
            "joined_at": now,
            "last_activity_at": now,
            "activity_count": 0,
            "notifications_sent": [],
            "updated_at": now
        }
        participants.append(participant)
    
    if participants:
        await db.incentive_participants.insert_many(participants)
        
        # Update participant count
        await db.incentive_competitions.update_one(
            {"id": competition_id},
            {"$set": {"participant_count": len(participants)}}
        )


async def evaluate_competition(competition_id: str):
    """Evaluate competition results and create result records"""
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    if not competition:
        return
    
    # Get rules
    rules = await db.incentive_rules.find(
        {"competition_id": competition_id}
    ).sort("priority", 1).to_list(20)
    
    # Get all participants
    participants = await db.incentive_participants.find(
        {"competition_id": competition_id}
    ).sort("current_value", -1).to_list(1000)
    
    now = datetime.now(timezone.utc).isoformat()
    results = []
    
    for rule in rules:
        rule_type = rule.get("type")
        
        if rule_type == "top_n":
            top_n = rule.get("top_n", 3)
            winners = participants[:top_n]
            
            for rank, winner in enumerate(winners, 1):
                result = {
                    "id": str(uuid.uuid4()),
                    "competition_id": competition_id,
                    "user_id": winner["user_id"],
                    "user_name": winner.get("user_name", "Unknown"),
                    "final_rank": rank,
                    "final_value": winner["current_value"],
                    "final_percentile": ((len(participants) - rank + 1) / len(participants)) * 100 if participants else 0,
                    "rule_id": rule["id"],
                    "rule_type": rule_type,
                    "qualification_reason": f"#{rank} of {len(participants)}",
                    "points_awarded": rule.get("points_award", 0),
                    "reward_id": rule.get("reward_id"),
                    "badge_id": rule.get("badge_id"),
                    "fulfillment_status": "pending",
                    "created_at": now
                }
                results.append(result)
        
        elif rule_type == "threshold":
            threshold = rule.get("threshold_value", 0)
            qualifiers = [p for p in participants if p["current_value"] >= threshold]
            
            for qualifier in qualifiers:
                rank = next((i + 1 for i, p in enumerate(participants) if p["user_id"] == qualifier["user_id"]), 0)
                result = {
                    "id": str(uuid.uuid4()),
                    "competition_id": competition_id,
                    "user_id": qualifier["user_id"],
                    "user_name": qualifier.get("user_name", "Unknown"),
                    "final_rank": rank,
                    "final_value": qualifier["current_value"],
                    "final_percentile": ((len(participants) - rank + 1) / len(participants)) * 100 if participants else 0,
                    "rule_id": rule["id"],
                    "rule_type": rule_type,
                    "qualification_reason": f"Threshold: {qualifier['current_value']} >= {threshold}",
                    "points_awarded": rule.get("points_award", 0),
                    "reward_id": rule.get("reward_id"),
                    "badge_id": rule.get("badge_id"),
                    "fulfillment_status": "pending",
                    "created_at": now
                }
                results.append(result)
    
    # Insert results
    if results:
        await db.incentive_results.insert_many(results)
    
    # Award points to winners
    for result in results:
        if result.get("points_awarded", 0) > 0:
            await db.harvest_user_stats.update_one(
                {"user_id": result["user_id"]},
                {"$inc": {"total_points": result["points_awarded"]}},
                upsert=True
            )
    
    # Mark competition as completed
    await db.incentive_competitions.update_one(
        {"id": competition_id},
        {
            "$set": {
                "status": "completed",
                "evaluated_at": now,
                "qualified_count": len(results),
                "updated_at": now
            }
        }
    )


# ============================================
# SEEDING / INITIALIZATION
# ============================================

@router.post("/seed")
async def seed_incentives_data(
    current_user: dict = Depends(get_current_user)
):
    """Seed all incentives foundation data"""
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    metrics = await seed_metrics()
    templates = await seed_templates()
    providers = await seed_fulfillment_providers()
    
    return {
        "message": "Incentives data seeded",
        "metrics_count": len(metrics),
        "templates_count": len(templates),
        "providers_count": len(providers)
    }


async def seed_fulfillment_providers():
    """Seed default fulfillment providers"""
    now = datetime.now(timezone.utc).isoformat()
    
    providers = [
        {
            "id": "manual",
            "name": "Manual Fulfillment",
            "type": "manual",
            "config": {},
            "supported_reward_types": ["gift_card", "merchandise", "experience", "cash", "pto", "custom"],
            "supports_bulk_fulfillment": False,
            "supports_instant_delivery": False,
            "supports_physical_shipping": True,
            "is_active": True,
            "health_status": "healthy",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "internal_points",
            "name": "Internal Points",
            "type": "internal",
            "config": {},
            "supported_reward_types": ["points"],
            "supports_bulk_fulfillment": True,
            "supports_instant_delivery": True,
            "supports_physical_shipping": False,
            "is_active": True,
            "health_status": "healthy",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "internal_badge",
            "name": "Internal Badge",
            "type": "internal",
            "config": {},
            "supported_reward_types": ["badge"],
            "supports_bulk_fulfillment": True,
            "supports_instant_delivery": True,
            "supports_physical_shipping": False,
            "is_active": True,
            "health_status": "healthy",
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for provider in providers:
        await db.incentive_providers.update_one(
            {"id": provider["id"]},
            {"$set": provider},
            upsert=True
        )
    
    return providers



# ============================================
# PHASE 2: LEADERBOARDS & EVENT TRACKING
# ============================================

class MetricEventRequest(BaseModel):
    """Request body for recording a metric event"""
    metric_slug: str
    value: int = 1
    event_type: str = "increment"
    source_collection: str = ""
    source_document_id: str = ""


@router.get("/leaderboard/{competition_id}")
async def get_competition_leaderboard(
    competition_id: str,
    limit: int = Query(50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get live leaderboard for a competition.
    Returns ranked participants with their progress.
    """
    competition = await db.incentive_competitions.find_one(
        {"id": competition_id}, {"_id": 0}
    )
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # Get metric info
    metric = await db.incentive_metrics.find_one(
        {"id": competition["metric_id"]}, {"_id": 0}
    )
    
    # Get rules to show qualification info
    rules = await db.incentive_rules.find(
        {"competition_id": competition_id}, {"_id": 0}
    ).to_list(20)
    
    # Find threshold rules for qualification markers
    threshold_rules = [r for r in rules if r.get("type") == "threshold"]
    top_n_rules = [r for r in rules if r.get("type") == "top_n"]
    
    # Get participants
    participants = await db.incentive_participants.find(
        {"competition_id": competition_id},
        {"_id": 0}
    ).sort("current_value", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.incentive_participants.count_documents(
        {"competition_id": competition_id}
    )
    
    # Enrich with qualification info
    for i, p in enumerate(participants):
        actual_rank = offset + i + 1
        p["rank"] = actual_rank
        
        # Check if in winning position for top_n
        for rule in top_n_rules:
            if actual_rank <= rule.get("top_n", 3):
                p["in_prize_position"] = True
                p["prize_position_type"] = f"Top {rule['top_n']}"
                break
        
        # Check if qualified for threshold
        for rule in threshold_rules:
            threshold = rule.get("threshold_value", 0)
            if p["current_value"] >= threshold:
                p["threshold_qualified"] = True
                p["threshold_value"] = threshold
            else:
                p["gap_to_qualify"] = threshold - p["current_value"]
    
    # Find current user's position
    user_id = current_user.get("id")
    my_participant = await db.incentive_participants.find_one(
        {"competition_id": competition_id, "user_id": user_id},
        {"_id": 0}
    )
    
    my_rank = None
    if my_participant:
        # Get actual rank
        higher_count = await db.incentive_participants.count_documents({
            "competition_id": competition_id,
            "current_value": {"$gt": my_participant["current_value"]}
        })
        my_rank = higher_count + 1
        my_participant["rank"] = my_rank
    
    return {
        "competition": {
            "id": competition["id"],
            "name": competition["name"],
            "status": competition["status"],
            "time_remaining": calculate_time_remaining(competition["end_date"]),
            "metric": metric
        },
        "leaderboard": participants,
        "my_position": my_participant,
        "my_rank": my_rank,
        "total_participants": total,
        "rules_summary": {
            "threshold": threshold_rules[0].get("threshold_value") if threshold_rules else None,
            "top_n": top_n_rules[0].get("top_n") if top_n_rules else None,
            "threshold_reward_points": threshold_rules[0].get("points_award") if threshold_rules else 0,
            "top_n_reward_points": top_n_rules[0].get("points_award") if top_n_rules else 0
        },
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": total
        }
    }


@router.post("/events/record")
async def record_metric_event(
    data: MetricEventRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Record a metric event and update all affected competitions.
    Returns notifications and rank changes.
    """
    user_id = current_user.get("id")
    
    evaluator = IncentiveEvaluator(db)
    result = await evaluator.process_metric_event(
        user_id=user_id,
        metric_slug=data.metric_slug,
        value=data.value,
        event_type=data.event_type,
        source_collection=data.source_collection,
        source_document_id=data.source_document_id
    )
    
    return {
        "success": True,
        "affected_competitions": result["affected_competitions"],
        "notifications": result["notifications"],
        "rank_changes": result["rank_changes"],
        "qualifications": result["qualifications"]
    }


@router.post("/events/harvest")
async def record_harvest_event(
    event_type: str = Query(..., description="Event type: visit_logged, review_collected, etc."),
    status: Optional[str] = Query(None, description="Visit status: NH, NI, CB, AP, SG"),
    value: int = Query(1, description="Event value (default 1)"),
    source_id: str = Query("", description="Source document ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Special endpoint for Harvest events that maps to multiple metrics.
    E.g., a 'SG' visit updates doors, contacts, AND contracts.
    """
    user_id = current_user.get("id")
    
    result = await process_harvest_event(
        db=db,
        user_id=user_id,
        event_type=event_type,
        status=status,
        value=value,
        source_collection="harvest_visits",
        source_document_id=source_id
    )
    
    return {
        "success": True,
        "affected_competitions": result["affected_competitions"],
        "notifications": result["notifications"],
        "rank_changes": result["rank_changes"],
        "qualifications": result["qualifications"]
    }


@router.get("/me/dashboard")
async def get_my_incentives_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """
    Get personalized incentives dashboard for the current user.
    Shows active competitions, progress, and upcoming rewards.
    """
    user_id = current_user.get("id")
    
    # Get active competitions user is participating in
    participations = await db.incentive_participants.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(50)
    
    active_comp_ids = [p["competition_id"] for p in participations]
    
    active_competitions = await db.incentive_competitions.find({
        "id": {"$in": active_comp_ids},
        "status": "active"
    }, {"_id": 0}).to_list(20)
    
    # Enrich with user's progress
    dashboard_competitions = []
    for comp in active_competitions:
        participation = next(
            (p for p in participations if p["competition_id"] == comp["id"]),
            None
        )
        
        if not participation:
            continue
        
        # Get metric info
        metric = await db.incentive_metrics.find_one(
            {"id": comp["metric_id"]}, {"_id": 0}
        )
        
        # Get rules for goal info
        rules = await db.incentive_rules.find(
            {"competition_id": comp["id"]}, {"_id": 0}
        ).to_list(10)
        
        # Find threshold target
        threshold_rule = next((r for r in rules if r.get("type") == "threshold"), None)
        target_value = threshold_rule.get("threshold_value") if threshold_rule else None
        
        # Get leader
        leader = await db.incentive_participants.find(
            {"competition_id": comp["id"]}
        ).sort("current_value", -1).limit(1).to_list(1)
        
        dashboard_competitions.append({
            "id": comp["id"],
            "name": comp["name"],
            "tagline": comp.get("tagline", ""),
            "icon": comp.get("icon", "🎯"),
            "banner_color": comp.get("banner_color", "#F97316"),
            "time_remaining": calculate_time_remaining(comp["end_date"]),
            "metric": {
                "name": metric.get("name") if metric else "",
                "unit": metric.get("unit") if metric else "",
                "icon": metric.get("icon") if metric else ""
            },
            "my_progress": {
                "current_value": participation.get("current_value", 0),
                "target_value": target_value,
                "rank": participation.get("rank"),
                "qualified_rules": participation.get("qualified_rules", []),
                "progress_percent": (
                    (participation.get("current_value", 0) / target_value * 100)
                    if target_value and target_value > 0
                    else 0
                )
            },
            "leader": {
                "name": leader[0].get("user_name") if leader else "No entries",
                "value": leader[0].get("current_value", 0) if leader else 0
            }
        })
    
    # Get recent achievements
    recent_results = await db.incentive_results.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Get total points
    user_stats = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    total_points = user_stats.get("total_points", 0) if user_stats else 0
    
    # Get active season
    active_season = await db.incentive_seasons.find_one({
        "status": "active"
    }, {"_id": 0})
    
    season_standing = None
    if active_season:
        season_standing = await db.incentive_season_standings.find_one({
            "season_id": active_season["id"],
            "user_id": user_id
        }, {"_id": 0})
    
    return {
        "active_competitions": dashboard_competitions,
        "total_points": total_points,
        "recent_achievements": recent_results,
        "active_season": {
            "id": active_season["id"] if active_season else None,
            "name": active_season["name"] if active_season else None,
            "my_standing": season_standing
        } if active_season else None
    }


@router.get("/results/{competition_id}")
async def get_competition_results(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get final results for a completed competition"""
    competition = await db.incentive_competitions.find_one(
        {"id": competition_id}, {"_id": 0}
    )
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    if competition["status"] not in ["completed", "evaluating"]:
        raise HTTPException(status_code=400, detail="Competition not yet completed")
    
    # Get results
    results = await db.incentive_results.find(
        {"competition_id": competition_id},
        {"_id": 0}
    ).sort("final_rank", 1).to_list(100)
    
    # Get user's result
    user_id = current_user.get("id")
    my_result = next((r for r in results if r["user_id"] == user_id), None)
    
    return {
        "competition": {
            "id": competition["id"],
            "name": competition["name"],
            "status": competition["status"],
            "evaluated_at": competition.get("evaluated_at")
        },
        "results": results,
        "my_result": my_result,
        "total_winners": len(results)
    }


# ============================================
# PHASE 3: ADVANCED RULES & FULFILLMENT
# ============================================

class ImprovementRuleConfig(BaseModel):
    """Configuration for improvement rules"""
    improvement_percent: float = 10.0
    baseline_period: str = "last_week"  # last_week, last_month, last_quarter


@router.post("/competitions/{competition_id}/calculate-baselines")
async def calculate_competition_baselines(
    competition_id: str,
    baseline_period: str = Query("last_week", description="Period for baseline: last_week, last_month, last_quarter"),
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate baseline values for all participants in an improvement competition.
    Must be called before the competition starts for improvement rules.
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # Determine date range for baseline
    now = datetime.now(timezone.utc)
    if baseline_period == "last_week":
        start_date = now - timedelta(days=7)
    elif baseline_period == "last_month":
        start_date = now - timedelta(days=30)
    elif baseline_period == "last_quarter":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=7)
    
    metric_id = competition["metric_id"]
    metric = await db.incentive_metrics.find_one({"id": metric_id})
    metric_slug = metric.get("slug") if metric else None
    
    # Get all participants
    participants = await db.incentive_participants.find(
        {"competition_id": competition_id}
    ).to_list(1000)
    
    updated_count = 0
    
    for participant in participants:
        user_id = participant["user_id"]
        
        # Calculate baseline from historical events
        baseline_value = 0
        
        if metric_slug:
            # Count metric events in the baseline period
            events = await db.incentive_metric_events.find({
                "user_id": user_id,
                "metric_id": metric_id,
                "created_at": {"$gte": start_date.isoformat()}
            }).to_list(1000)
            
            baseline_value = sum(e.get("value", 1) for e in events)
        
        # Update participant with baseline
        await db.incentive_participants.update_one(
            {"id": participant["id"]},
            {
                "$set": {
                    "baseline_value": baseline_value,
                    "baseline_period": baseline_period,
                    "baseline_calculated_at": now.isoformat()
                }
            }
        )
        updated_count += 1
    
    return {
        "message": f"Calculated baselines for {updated_count} participants",
        "baseline_period": baseline_period,
        "competition_id": competition_id
    }


@router.post("/competitions/{competition_id}/end-and-evaluate")
async def end_and_evaluate_competition(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    End an active competition and run full evaluation.
    Creates results, awards badges, sends notifications.
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    competition = await db.incentive_competitions.find_one({"id": competition_id})
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    if competition["status"] != "active":
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot end competition with status '{competition['status']}'. Must be 'active'."
        )
    
    # Use the enhanced evaluator
    evaluator = IncentiveEvaluator(db)
    result = await evaluator.evaluate_competition_end(competition_id)
    
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "message": f"Competition '{result.get('competition_name')}' ended successfully",
        "results_count": result.get("results_count", 0),
        "badges_awarded": result.get("badges_awarded", []),
        "notifications_sent": result.get("notifications_sent", 0)
    }


@router.get("/lottery/{competition_id}/qualifiers")
async def get_lottery_qualifiers(
    competition_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get list of users who have qualified for the lottery draw"""
    competition = await db.incentive_competitions.find_one(
        {"id": competition_id}, {"_id": 0}
    )
    
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # Find lottery rules
    lottery_rules = await db.incentive_rules.find({
        "competition_id": competition_id,
        "type": "lottery"
    }, {"_id": 0}).to_list(10)
    
    if not lottery_rules:
        raise HTTPException(status_code=400, detail="No lottery rules found for this competition")
    
    rule = lottery_rules[0]
    qualifier_threshold = rule.get("lottery_qualifier_threshold", 0)
    
    # Get qualified participants
    qualifiers = await db.incentive_participants.find({
        "competition_id": competition_id,
        "current_value": {"$gte": qualifier_threshold}
    }, {"_id": 0}).sort("current_value", -1).to_list(100)
    
    return {
        "competition": {
            "id": competition["id"],
            "name": competition["name"],
            "status": competition["status"]
        },
        "lottery_rule": {
            "qualifier_threshold": qualifier_threshold,
            "winner_count": rule.get("lottery_winner_count", 1),
            "drawn_at": rule.get("lottery_drawn_at"),
            "points_award": rule.get("points_award", 0)
        },
        "qualifiers": qualifiers,
        "qualifier_count": len(qualifiers)
    }


@router.get("/notifications/me")
async def get_my_incentive_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get incentive-related notifications for the current user"""
    user_id = current_user.get("id")
    
    query = {
        "user_id": user_id,
        "type": {"$in": [
            "threshold_reached", "threshold_approaching",
            "milestone_reached", "rank_improved",
            "improvement_achieved", "improvement_approaching",
            "lottery_qualified", "competition_result",
            "competition_ended", "badge_earned"
        ]}
    }
    
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        **query,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    user_id = current_user.get("id")
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@router.get("/badges/earned")
async def get_earned_badges(
    current_user: dict = Depends(get_current_user)
):
    """Get all badges earned by the current user"""
    user_id = current_user.get("id")
    
    earned_badges = await db.user_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("earned_at", -1).to_list(50)
    
    return {
        "badges": earned_badges,
        "total_earned": len(earned_badges)
    }


# ============================================
# BADGES CRUD (Admin)
# ============================================

class BadgeCreate(BaseModel):
    name: str
    description: str = ""
    criteria: str
    tier: str = "common"  # legendary, epic, rare, common
    icon: str = "🏆"
    image_url: Optional[str] = None
    points_value: int = 100
    is_active: bool = True


@router.get("/badges/definitions")
async def get_badge_definitions(
    current_user: dict = Depends(get_current_user)
):
    """Get all badge definitions"""
    badges = await db.incentive_badges.find({}, {"_id": 0}).to_list(100)
    
    # If no badges exist, seed default ones
    if not badges:
        badges = await seed_default_badges()
    
    return {"badges": badges}


@router.post("/badges")
async def create_badge(
    data: BadgeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new badge definition (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    badge_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    badge_doc = {
        "id": badge_id,
        **data.dict(),
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.incentive_badges.insert_one(badge_doc)
    
    return {"id": badge_id, "message": "Badge created successfully"}


@router.put("/badges/{badge_id}")
async def update_badge(
    badge_id: str,
    data: BadgeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a badge definition (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.incentive_badges.update_one(
        {"id": badge_id},
        {"$set": {**data.dict(), "updated_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Badge not found")
    
    return {"message": "Badge updated successfully"}


@router.delete("/badges/{badge_id}")
async def delete_badge(
    badge_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a badge definition (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.incentive_badges.delete_one({"id": badge_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Badge not found")
    
    return {"message": "Badge deleted successfully"}


async def seed_default_badges():
    """Seed default badge definitions"""
    now = datetime.now(timezone.utc).isoformat()
    
    default_badges = [
        {
            "id": str(uuid.uuid4()),
            "name": "First Harvest",
            "description": "Welcome to the team!",
            "criteria": "Complete your first door knock",
            "tier": "common",
            "icon": "🌱",
            "points_value": 50,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ten Down",
            "description": "Building momentum",
            "criteria": "Knock 10 doors in a single day",
            "tier": "common",
            "icon": "🚪",
            "points_value": 100,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "On Fire",
            "description": "Keep the streak alive!",
            "criteria": "Maintain a 5-day streak",
            "tier": "rare",
            "icon": "🔥",
            "points_value": 250,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Closer",
            "description": "Sealing the deal",
            "criteria": "Sign your first contract",
            "tier": "rare",
            "icon": "✍️",
            "points_value": 500,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Streak Master",
            "description": "Unstoppable consistency",
            "criteria": "Maintain a 30-day streak",
            "tier": "epic",
            "icon": "⚡",
            "points_value": 1000,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Harvest Legend",
            "description": "The ultimate achiever",
            "criteria": "Sign 100 contracts total",
            "tier": "legendary",
            "icon": "👑",
            "points_value": 5000,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for badge in default_badges:
        await db.incentive_badges.update_one(
            {"name": badge["name"]},
            {"$set": badge},
            upsert=True
        )
    
    return default_badges


# ============================================
# REWARDS CRUD (Admin)
# ============================================

class RewardCreate(BaseModel):
    name: str
    description: str = ""
    type: str = "gift_card"  # gift_card, merchandise, experience, cash, pto, points, badge, custom
    value_cents: Optional[int] = 0
    points_required: int = 0
    icon: str = "🎁"
    image_url: Optional[str] = None
    stock_quantity: Optional[int] = None  # None = unlimited
    is_featured: bool = False
    is_active: bool = True
    categories: List[str] = []


@router.get("/rewards")
async def get_rewards(
    active_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """Get all rewards in the catalog"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    rewards = await db.incentive_rewards.find(query, {"_id": 0}).to_list(100)
    
    # Seed if empty
    if not rewards:
        rewards = await seed_default_rewards()
    
    return {"rewards": rewards}


@router.post("/rewards")
async def create_reward(
    data: RewardCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new reward (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reward_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    reward_doc = {
        "id": reward_id,
        **data.dict(),
        "stock_reserved": 0,
        "fulfillment_provider_id": "manual",
        "requires_shipping": False,
        "requires_approval": True,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.incentive_rewards.insert_one(reward_doc)
    
    return {"id": reward_id, "message": "Reward created successfully"}


@router.put("/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    data: RewardCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a reward (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.incentive_rewards.update_one(
        {"id": reward_id},
        {"$set": {**data.dict(), "updated_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward updated successfully"}


@router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a reward (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.incentive_rewards.delete_one({"id": reward_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward deleted successfully"}


async def seed_default_rewards():
    """Seed default rewards"""
    now = datetime.now(timezone.utc).isoformat()
    
    default_rewards = [
        {
            "id": str(uuid.uuid4()),
            "name": "$25 Amazon Gift Card",
            "description": "Redeemable at Amazon.com",
            "type": "gift_card",
            "value_cents": 2500,
            "points_required": 500,
            "icon": "🎁",
            "is_featured": True,
            "is_active": True,
            "categories": ["gift_cards"],
            "stock_quantity": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "$50 Amazon Gift Card",
            "description": "Redeemable at Amazon.com",
            "type": "gift_card",
            "value_cents": 5000,
            "points_required": 1000,
            "icon": "🎁",
            "is_featured": True,
            "is_active": True,
            "categories": ["gift_cards"],
            "stock_quantity": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "$100 Cash Bonus",
            "description": "Added to next paycheck",
            "type": "cash",
            "value_cents": 10000,
            "points_required": 2000,
            "icon": "💵",
            "is_featured": False,
            "is_active": True,
            "categories": ["cash"],
            "stock_quantity": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Half Day PTO",
            "description": "4 hours of paid time off",
            "type": "pto",
            "value_cents": 0,
            "points_required": 1500,
            "icon": "🏖️",
            "is_featured": False,
            "is_active": True,
            "categories": ["pto"],
            "stock_quantity": 10,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Company Hoodie",
            "description": "Exclusive Eden team hoodie",
            "type": "merchandise",
            "value_cents": 4500,
            "points_required": 800,
            "icon": "👕",
            "is_featured": False,
            "is_active": True,
            "categories": ["merchandise"],
            "stock_quantity": 20,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for reward in default_rewards:
        await db.incentive_rewards.update_one(
            {"name": reward["name"]},
            {"$set": reward},
            upsert=True
        )
    
    return default_rewards
