"""
Harvest v2 API Routes - Built from Spotio + Enzy patterns
- Spotio: GPS visits, visit history, territories
- Enzy: Competitions, profiles, AI assistant, gamification

Uses harvest_scoring_engine for unified gamification logic.
Uses incentives_engine/events for unified game event bus.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import uuid
import logging

from dependencies import db, get_current_active_user as get_current_user
from routes.harvest_scoring_engine import (
    init_scoring_engine,
    process_visit_for_scoring,
    get_user_stats,
    get_user_badges,
    get_leaderboard as engine_get_leaderboard,
    ensure_daily_blitz,
    seed_badges,
    BADGES,
    STATUS_POINTS,
    DISPOSITION_TO_STATUS
)
from incentives_engine.events import emit_harvest_visit
from .models import VisitCreate, TerritoryCreate, TerritoryUpdate, CompetitionCreate, AssistantRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize scoring engine with db on first request
_scoring_engine_initialized = False

async def ensure_scoring_engine():
    global _scoring_engine_initialized
    if not _scoring_engine_initialized:
        init_scoring_engine(db)
        _scoring_engine_initialized = True

# ============================================
# MODELS - Spotio + Enzy Patterns
# ============================================

# Default status configurations (can be overridden via company_settings)
VISIT_STATUSES = {
    "NH": {"label": "Not Home", "color": "#F59E0B", "points": 1},
    "NI": {"label": "Not Interested", "color": "#EF4444", "points": 1},
    "CB": {"label": "Callback", "color": "#8B5CF6", "points": 5},
    "AP": {"label": "Appointment", "color": "#3B82F6", "points": 10},
    "SG": {"label": "Signed", "color": "#10B981", "points": 50},
    "DNK": {"label": "Do Not Knock", "color": "#1F2937", "points": 0},
}


# ============================================
# CONFIGURABLE DISPOSITIONS
# ============================================

async def get_harvest_dispositions_config():
    """Get harvest dispositions from company_settings or return defaults"""
    config = await db.company_settings.find_one({"key": "harvest_dispositions"})
    if config and config.get("value"):
        return config["value"]
    
    # Return default dispositions
    return [
        {"code": "NH", "label": "Not Home", "color": "#F59E0B", "points": 1, "icon": "🏠"},
        {"code": "NI", "label": "Not Interested", "color": "#EF4444", "points": 0, "icon": "❌"},
        {"code": "CB", "label": "Callback", "color": "#8B5CF6", "points": 3, "icon": "📞"},
        {"code": "AP", "label": "Appointment", "color": "#3B82F6", "points": 5, "icon": "📅"},
        {"code": "SG", "label": "Signed", "color": "#10B981", "points": 10, "icon": "✅"},
        {"code": "DNK", "label": "Do Not Knock", "color": "#1F2937", "points": 0, "icon": "🚫"},
    ]


async def get_harvest_daily_goals_config():
    """Get daily goals from company_settings or return defaults"""
    config = await db.company_settings.find_one({"key": "harvest_daily_goals"})
    if config and config.get("value"):
        return config["value"]
    
    # Return default daily goals
    return {
        "doors_knocked": 40,
        "appointments_set": 3,
        "signed_contracts": 1
    }


# ============================================
# CONFIGURATION ENDPOINTS
# ============================================

@router.get("/dispositions")
async def get_dispositions(
    current_user: dict = Depends(get_current_user)
):
    """
    Get configurable harvest dispositions.
    Returns list of dispositions with code, label, color, points, icon.
    """
    dispositions = await get_harvest_dispositions_config()
    return {
        "dispositions": dispositions,
        "message": "Use these dispositions for pin status and legend"
    }


@router.put("/dispositions")
async def update_dispositions(
    dispositions: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """
    Update harvest dispositions configuration (admin/manager only).
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Validate disposition structure
    required_fields = {"code", "label", "color", "points"}
    for disp in dispositions:
        if not required_fields.issubset(disp.keys()):
            raise HTTPException(
                status_code=400, 
                detail=f"Each disposition must have: {required_fields}"
            )
    
    await db.company_settings.update_one(
        {"key": "harvest_dispositions"},
        {"$set": {"key": "harvest_dispositions", "value": dispositions}},
        upsert=True
    )
    
    return {"message": "Dispositions updated successfully", "dispositions": dispositions}


@router.get("/daily-goals")
async def get_daily_goals(
    current_user: dict = Depends(get_current_user)
):
    """
    Get harvest daily goals configuration.
    Returns goals for doors_knocked, appointments_set, signed_contracts.
    """
    goals = await get_harvest_daily_goals_config()
    return {
        "goals": goals,
        "message": "Daily goals for harvest rep performance tracking"
    }


@router.put("/daily-goals")
async def update_daily_goals(
    goals: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update harvest daily goals configuration (admin/manager only).
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    await db.company_settings.update_one(
        {"key": "harvest_daily_goals"},
        {"$set": {"key": "harvest_daily_goals", "value": goals}},
        upsert=True
    )
    
    return {"message": "Daily goals updated successfully", "goals": goals}


# Models imported from .models


# ============================================
# DAILY GAME LOOP ENDPOINT
# ============================================

@router.get("/today")
async def get_today_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get today's stats for the current user (Enzy-style daily game loop).
    Returns: date, door stats, goals, streak, progress percentages.
    """
    user_id = current_user.get("id")
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today_start.isoformat()
    
    # Get daily goals from config
    goals = await get_harvest_daily_goals_config()
    dispositions = await get_harvest_dispositions_config()
    
    # Get today's visits
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "created_at": {"$gte": today_iso}
            }
        },
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]
    
    status_counts_raw = await db.harvest_visits.aggregate(pipeline).to_list(20)
    status_counts = {s["_id"]: s["count"] for s in status_counts_raw}
    
    # Calculate metrics
    doors_knocked = sum(status_counts.values())
    appointments_set = status_counts.get("AP", 0)
    signed_contracts = status_counts.get("SG", 0)
    callbacks = status_counts.get("CB", 0)
    not_home = status_counts.get("NH", 0)
    not_interested = status_counts.get("NI", 0)
    
    # Calculate points from dispositions config
    total_points = 0
    for disp in dispositions:
        code = disp.get("code")
        points = disp.get("points", 0)
        count = status_counts.get(code, 0)
        total_points += count * points
    
    # Get streak
    streak_days = await _calculate_streak_days(user_id)
    
    # Calculate progress percentages
    def safe_percent(current, goal):
        if goal <= 0:
            return 100 if current > 0 else 0
        return min(round((current / goal) * 100), 100)
    
    return {
        "date": today_start.strftime("%Y-%m-%d"),
        "doors_knocked": doors_knocked,
        "appointments_set": appointments_set,
        "signed_contracts": signed_contracts,
        "callbacks": callbacks,
        "not_home": not_home,
        "not_interested": not_interested,
        "total_points": total_points,
        "goals": goals,
        "progress": {
            "doors_knocked": safe_percent(doors_knocked, goals.get("doors_knocked", 40)),
            "appointments_set": safe_percent(appointments_set, goals.get("appointments_set", 3)),
            "signed_contracts": safe_percent(signed_contracts, goals.get("signed_contracts", 1))
        },
        "streak_days": streak_days,
        "dispositions": dispositions
    }


async def _calculate_streak_days(user_id: str) -> int:
    """Calculate consecutive days with at least 1 visit (single aggregation)"""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=365)).isoformat()

    # Single aggregation: group visits by date, find all active days
    pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
        {"$addFields": {"date_str": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date_str", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 1}}},
        {"$sort": {"_id": -1}},
    ]
    active_days = await db.harvest_visits.aggregate(pipeline).to_list(365)
    active_dates = {d["_id"] for d in active_days}

    streak = 0
    for days_ago in range(365):
        check_date = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        if check_date in active_dates:
            streak += 1
        else:
            # Allow skipping today if it's early
            if days_ago == 0 and now.hour < 12:
                continue
            break

    return streak


# ============================================
# 1) VISITS - GPS & Visit Logging (SPOTIO)
# ============================================

@router.post("/visits")
async def create_visit(
    visit: VisitCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a door visit with GPS (Spotio-style).
    Every knock = one visit record with lat/lng, timestamp, status.
    Uses the unified scoring engine for points, streaks, badges.
    """
    await ensure_scoring_engine()
    
    visit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Get pin to find territory_id
    pin = await db.canvassing_pins.find_one({"id": visit.pin_id})
    territory_id = pin.get("territory_id") if pin else None
    
    # Create visit record
    doc = {
        "id": visit_id,
        "pin_id": visit.pin_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("full_name", "Unknown"),
        "status": visit.status,
        "lat": visit.lat,
        "lng": visit.lng,
        "notes": visit.notes,
        "created_at": now_iso
    }
    
    await db.harvest_visits.insert_one(doc)
    
    # Update the pin's last_status and visit_count
    await db.canvassing_pins.update_one(
        {"id": visit.pin_id},
        {
            "$set": {
                "disposition": visit.status.lower() if visit.status in ["NH", "NI", "CB", "AP", "SG", "DNK"] else visit.status,
                "last_visit_at": now_iso,
                "updated_at": now_iso
            },
            "$inc": {"visit_count": 1},
            "$push": {
                "history": {
                    "status": visit.status,
                    "user_id": current_user.get("id"),
                    "user_name": current_user.get("full_name"),
                    "timestamp": now_iso,
                    "lat": visit.lat,
                    "lng": visit.lng
                }
            }
        }
    )
    
    # Use the scoring engine for unified gamification
    scoring_result = await process_visit_for_scoring(
        user_id=current_user.get("id"),
        user_name=current_user.get("full_name", "Unknown"),
        status=visit.status,
        pin_id=visit.pin_id,
        timestamp=now,
        territory_id=territory_id
    )
    
    # Emit game event to central event bus for incentives engine
    try:
        await emit_harvest_visit(
            db=db,
            user_id=current_user.get("id"),
            status=visit.status,
            pin_id=visit.pin_id,
            territory_id=territory_id,
            disposition_points=scoring_result.get("points_earned", 0)
        )
    except Exception as e:
        logger.warning(f"Failed to emit game event: {e}")
    
    status_info = VISIT_STATUSES.get(visit.status, {"points": 1, "label": "Unknown", "color": "#9CA3AF"})
    
    return {
        "id": visit_id,
        "status": visit.status,
        "status_info": status_info,
        "points_earned": scoring_result.get("points_earned", 0),
        "base_points": scoring_result.get("base_points", 0),
        "multiplier": scoring_result.get("multiplier", 1.0),
        "streak": scoring_result.get("streak", 0),
        "new_badges": scoring_result.get("new_badges", []),
        "competition_updates": scoring_result.get("competition_updates", []),
        "message": "Visit logged successfully"
    }


@router.get("/visits")
async def get_visits(
    pin_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    since: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Get visits filtered by pin, user, or status (Spotio-style history)"""
    query = {}
    
    if pin_id:
        query["pin_id"] = pin_id
    if user_id:
        query["user_id"] = user_id
    if status:
        query["status"] = status
    if since:
        query["created_at"] = {"$gte": since}
    
    visits = await db.harvest_visits.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return visits


@router.get("/pins-with-history")
async def get_pins_with_history(
    territory_id: Optional[str] = None,
    bounds: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get pins with visit count and last status (Spotio-style map view).
    Returns: id, lat, lng, address, last_status, visit_count, last_visit_at
    """
    query = {}
    
    if territory_id:
        query["territory_id"] = territory_id
    
    if bounds:
        try:
            coords = [float(x) for x in bounds.split(",")]
            if len(coords) == 4:
                sw_lat, sw_lng, ne_lat, ne_lng = coords
                query["latitude"] = {"$gte": sw_lat, "$lte": ne_lat}
                query["longitude"] = {"$gte": sw_lng, "$lte": ne_lng}
        except:
            pass
    
    pins = await db.canvassing_pins.find(
        query,
        {
            "_id": 0,
            "id": 1,
            "latitude": 1,
            "longitude": 1,
            "address": 1,
            "disposition": 1,
            "visit_count": 1,
            "last_visit_at": 1,
            "homeowner_name": 1,
            "territory_id": 1
        }
    ).sort("updated_at", -1).to_list(1000)
    
    # Map disposition to Spotio-style status
    for pin in pins:
        disp = pin.get("disposition", "unmarked")
        # Map old dispositions to new status codes
        status_map = {
            "not_home": "NH",
            "not_interested": "NI", 
            "callback": "CB",
            "appointment": "AP",
            "signed": "SG",
            "do_not_knock": "DNK",
            "unmarked": None
        }
        pin["last_status"] = status_map.get(disp, disp.upper() if disp else None)
        pin["visit_count"] = pin.get("visit_count", 0)
        if pin.get("last_status"):
            pin["status_info"] = VISIT_STATUSES.get(pin["last_status"], {})
    
    return pins


# ============================================
# 2) TERRITORIES (SPOTIO)
# ============================================

@router.post("/territories")
async def create_territory(
    territory: TerritoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a territory with polygon and assignments (Spotio-style)"""
    user_role = current_user.get("role", "adjuster")
    if user_role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only managers can create territories")
    
    territory_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": territory_id,
        "name": territory.name,
        "polygon": territory.polygon,
        "assigned_to": territory.assigned_to or [],
        "color": territory.color,
        "is_active": True,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.harvest_territories.insert_one(doc)
    
    return {"id": territory_id, "message": "Territory created successfully"}


@router.get("/territories")
async def get_territories(
    user_id: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get territories, optionally filtered by assigned user"""
    query = {}
    
    if active_only:
        query["is_active"] = True
    
    if user_id:
        query["assigned_to"] = user_id
    
    territories = await db.harvest_territories.find(
        query,
        {"_id": 0}
    ).sort("name", 1).to_list(100)
    
    # Get stats for each territory
    for territory in territories:
        stats = await get_territory_stats(territory["id"])
        territory["stats"] = stats
    
    return territories


@router.get("/territories/{territory_id}")
async def get_territory(
    territory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific territory with full stats"""
    territory = await db.harvest_territories.find_one(
        {"id": territory_id},
        {"_id": 0}
    )
    
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    # Get detailed stats
    territory["stats"] = await get_territory_stats(territory_id)
    
    # Get assigned user details
    if territory.get("assigned_to"):
        users = await db.users.find(
            {"id": {"$in": territory["assigned_to"]}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1}
        ).to_list(50)
        territory["assigned_users"] = users
    
    return territory


@router.patch("/territories/{territory_id}")
async def update_territory(
    territory_id: str,
    update: TerritoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a territory"""
    user_role = current_user.get("role", "adjuster")
    if user_role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only managers can update territories")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.harvest_territories.update_one(
        {"id": territory_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    return {"message": "Territory updated successfully"}


async def get_territory_stats(territory_id: str) -> dict:
    """Get stats for a territory"""
    # Count pins by status
    pipeline = [
        {"$match": {"territory_id": territory_id}},
        {"$group": {
            "_id": "$disposition",
            "count": {"$sum": 1}
        }}
    ]
    status_counts = await db.canvassing_pins.aggregate(pipeline).to_list(20)
    
    # Total visits
    total_visits = await db.harvest_visits.count_documents({
        "pin_id": {"$in": await db.canvassing_pins.distinct("id", {"territory_id": territory_id})}
    })
    
    # Total pins
    total_pins = await db.canvassing_pins.count_documents({"territory_id": territory_id})
    
    return {
        "total_pins": total_pins,
        "total_visits": total_visits,
        "by_status": {s["_id"]: s["count"] for s in status_counts if s["_id"]}
    }


# ============================================
# 3) LEADERBOARD (ENZY)
# ============================================

@router.get("/leaderboard")
async def get_leaderboard(
    period: Literal["today", "week", "month", "all"] = "week",
    territory_id: Optional[str] = None,
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get leaderboard with Enzy-style metrics.
    Returns: user_id, name, doors, contacts, appointments, contracts, revenue, points, badges
    """
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    start_iso = start_date.isoformat()
    
    # Build aggregation pipeline
    match_stage = {"created_at": {"$gte": start_iso}}
    
    # If territory filter, get pins in that territory first
    if territory_id:
        territory_pins = await db.canvassing_pins.distinct("id", {"territory_id": territory_id})
        match_stage["pin_id"] = {"$in": territory_pins}
    
    # Aggregate visits by user and status
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": {"user_id": "$user_id", "status": "$status"},
            "count": {"$sum": 1},
            "user_name": {"$first": "$user_name"}
        }},
        {"$group": {
            "_id": "$_id.user_id",
            "user_name": {"$first": "$user_name"},
            "status_counts": {
                "$push": {"status": "$_id.status", "count": "$count"}
            },
            "total_visits": {"$sum": "$count"}
        }}
    ]
    
    user_stats = await db.harvest_visits.aggregate(pipeline).to_list(100)
    
    # Build leaderboard entries
    leaderboard = []
    for user in user_stats:
        entry = {
            "user_id": user["_id"],
            "name": user.get("user_name", "Unknown"),
            "doors": user.get("total_visits", 0),
            "contacts": 0,
            "appointments": 0,
            "contracts": 0,
            "points": 0
        }
        
        # Calculate metrics from status counts
        for sc in user.get("status_counts", []):
            status = sc.get("status", "")
            count = sc.get("count", 0)
            status_info = VISIT_STATUSES.get(status, {})
            
            # Aggregate by category
            if status in ["NH", "NI"]:
                entry["doors"] += 0  # Already counted in total
            elif status == "CB":
                entry["contacts"] += count
            elif status == "AP":
                entry["appointments"] += count
            elif status == "SG":
                entry["contracts"] += count
            
            # Calculate points
            entry["points"] += count * status_info.get("points", 1)
        
        # Estimate revenue (avg contract value)
        entry["revenue"] = entry["contracts"] * 15000
        
        leaderboard.append(entry)
    
    # Get badges for each user
    for entry in leaderboard:
        badges = await db.user_badges.find(
            {"user_id": entry["user_id"]},
            {"_id": 0, "badge_id": 1, "badge_name": 1}
        ).to_list(10)
        entry["badges"] = badges
    
    # Sort by points descending
    leaderboard.sort(key=lambda x: x["points"], reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard[:limit]):
        entry["rank"] = i + 1
    
    return leaderboard[:limit]


# ============================================
# 4) COMPETITIONS (ENZY)
# ============================================

@router.post("/competitions")
async def create_competition(
    competition: CompetitionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a competition (Enzy-style)"""
    user_role = current_user.get("role", "adjuster")
    if user_role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only managers can create competitions")
    
    comp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": comp_id,
        "name": competition.name,
        "metric": competition.metric,
        "type": competition.type,
        "start_date": competition.start_date,
        "end_date": competition.end_date,
        "target": competition.target,
        "participants": competition.participants or [],
        "is_active": True,
        "created_by": current_user.get("id"),
        "created_at": now
    }
    
    await db.harvest_competitions.insert_one(doc)
    
    return {"id": comp_id, "message": "Competition created successfully"}


@router.get("/competitions")
async def get_competitions(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get competitions with current standings"""
    query = {}
    if active_only:
        now = datetime.now(timezone.utc).isoformat()
        query["end_date"] = {"$gte": now}
        query["is_active"] = True
    
    competitions = await db.harvest_competitions.find(
        query,
        {"_id": 0}
    ).sort("end_date", 1).to_list(50)
    
    # Get standings for each competition
    for comp in competitions:
        comp["standings"] = await get_competition_standings(comp)
    
    return competitions


@router.get("/competitions/active")
async def get_active_competitions(
    current_user: dict = Depends(get_current_user)
):
    """Get active competitions with user's current standing (Enzy-style)"""
    now = datetime.now(timezone.utc).isoformat()
    
    competitions = await db.harvest_competitions.find(
        {
            "start_date": {"$lte": now},
            "end_date": {"$gte": now},
            "is_active": True
        },
        {"_id": 0}
    ).to_list(20)
    
    user_id = current_user.get("id")
    
    for comp in competitions:
        standings = await get_competition_standings(comp)
        comp["standings"] = standings[:10]  # Top 10
        
        # Find user's position
        user_standing = next((s for s in standings if s["user_id"] == user_id), None)
        if user_standing:
            comp["my_rank"] = user_standing["rank"]
            comp["my_value"] = user_standing["value"]
            comp["my_progress"] = (user_standing["value"] / comp["target"] * 100) if comp.get("target") else 0
        else:
            comp["my_rank"] = None
            comp["my_value"] = 0
            comp["my_progress"] = 0
    
    return competitions


async def get_competition_standings(competition: dict) -> list:
    """Calculate standings for a competition"""
    metric = competition.get("metric", "points")
    start = competition.get("start_date")
    end = competition.get("end_date")
    participants = competition.get("participants", [])
    
    # Get visits in date range
    query = {
        "created_at": {"$gte": start, "$lte": end}
    }
    if participants:
        query["user_id"] = {"$in": participants}
    
    # Map metric to aggregation
    if metric == "doors":
        group_field = {"$sum": 1}
    elif metric == "contacts":
        query["status"] = {"$in": ["CB", "AP", "SG"]}
        group_field = {"$sum": 1}
    elif metric == "appointments":
        query["status"] = "AP"
        group_field = {"$sum": 1}
    elif metric == "contracts":
        query["status"] = "SG"
        group_field = {"$sum": 1}
    elif metric == "revenue":
        query["status"] = "SG"
        group_field = {"$sum": 15000}  # Avg contract value
    else:  # points
        group_field = {"$sum": 1}  # We'll calculate actual points
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "value": group_field
        }},
        {"$sort": {"value": -1}}
    ]
    
    results = await db.harvest_visits.aggregate(pipeline).to_list(100)
    
    standings = []
    for i, r in enumerate(results):
        standings.append({
            "rank": i + 1,
            "user_id": r["_id"],
            "user_name": r.get("user_name", "Unknown"),
            "value": r.get("value", 0)
        })
    
    return standings


# ============================================
# 5) PROFILES (ENZY)
# ============================================

@router.get("/profile/{user_id}")
async def get_harvest_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get Harvest profile for a user (Enzy-style social profile).
    Returns: total doors, total contracts, top territory, badges earned.
    """
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all-time stats from visits
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    status_stats = await db.harvest_visits.aggregate(pipeline).to_list(20)
    
    # Calculate totals
    total_doors = sum(s["count"] for s in status_stats)
    total_contacts = sum(s["count"] for s in status_stats if s["_id"] in ["CB", "AP", "SG"])
    total_appointments = sum(s["count"] for s in status_stats if s["_id"] == "AP")
    total_contracts = sum(s["count"] for s in status_stats if s["_id"] == "SG")
    
    # Calculate total points
    total_points = 0
    for s in status_stats:
        status_info = VISIT_STATUSES.get(s["_id"], {"points": 1})
        total_points += s["count"] * status_info.get("points", 1)
    
    # Get badges
    badges = await db.user_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get top territory (most activity)
    territory_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$lookup": {
            "from": "canvassing_pins",
            "localField": "pin_id",
            "foreignField": "id",
            "as": "pin"
        }},
        {"$unwind": {"path": "$pin", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$pin.territory_id",
            "visits": {"$sum": 1}
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 1}
    ]
    top_territory_result = await db.harvest_visits.aggregate(territory_pipeline).to_list(1)
    
    top_territory = None
    if top_territory_result and top_territory_result[0].get("_id"):
        territory = await db.harvest_territories.find_one(
            {"id": top_territory_result[0]["_id"]},
            {"_id": 0, "id": 1, "name": 1}
        )
        if territory:
            top_territory = {
                "id": territory["id"],
                "name": territory["name"],
                "visits": top_territory_result[0]["visits"]
            }
    
    # Recent activity (last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_visits = await db.harvest_visits.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "user": user,
        "stats": {
            "total_doors": total_doors,
            "total_contacts": total_contacts,
            "total_appointments": total_appointments,
            "total_contracts": total_contracts,
            "total_points": total_points,
            "total_revenue": total_contracts * 15000,
            "recent_activity": recent_visits
        },
        "top_territory": top_territory,
        "badges": badges,
        "badge_count": len(badges)
    }


# ============================================
# 6) HARVEST ASSISTANT (ENZY-STYLE, EVE-POWERED)
# ============================================

@router.post("/assistant")
async def harvest_assistant(
    request: AssistantRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get AI-powered insights from Harvest data (Enzy Assistant style).
    Eve analyzes data and provides:
    - 3 key insights (patterns, standouts)
    - 3 suggested actions for manager/rep
    """
    # Calculate date range
    now = datetime.now(timezone.utc)
    if request.period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif request.period == "this_week":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    start_iso = start_date.isoformat()
    
    # Get team or user stats
    if request.scope == "user" and request.user_id:
        query = {"user_id": request.user_id, "created_at": {"$gte": start_iso}}
    else:
        query = {"created_at": {"$gte": start_iso}}
    
    # Aggregate visits by user
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"user_id": "$user_id", "status": "$status"},
            "count": {"$sum": 1},
            "user_name": {"$first": "$user_name"}
        }},
        {"$group": {
            "_id": "$_id.user_id",
            "user_name": {"$first": "$user_name"},
            "status_counts": {"$push": {"status": "$_id.status", "count": "$count"}},
            "total_visits": {"$sum": "$count"}
        }}
    ]
    
    user_data = await db.harvest_visits.aggregate(pipeline).to_list(100)
    
    # Calculate team stats
    team_stats = {
        "total_visits": sum(u.get("total_visits", 0) for u in user_data),
        "total_reps": len(user_data),
        "avg_visits_per_rep": 0,
        "top_performer": None,
        "contracts": 0,
        "appointments": 0,
        "conversion_rate": 0
    }
    
    if user_data:
        team_stats["avg_visits_per_rep"] = team_stats["total_visits"] / team_stats["total_reps"]
        
        # Find top performer
        top = max(user_data, key=lambda x: x.get("total_visits", 0))
        team_stats["top_performer"] = {
            "name": top.get("user_name"),
            "visits": top.get("total_visits", 0)
        }
        
        # Calculate totals
        for u in user_data:
            for sc in u.get("status_counts", []):
                if sc.get("status") == "SG":
                    team_stats["contracts"] += sc.get("count", 0)
                elif sc.get("status") == "AP":
                    team_stats["appointments"] += sc.get("count", 0)
        
        if team_stats["total_visits"] > 0:
            team_stats["conversion_rate"] = (team_stats["contracts"] / team_stats["total_visits"]) * 100
    
    # Get active competitions
    active_comps = await db.harvest_competitions.find(
        {"is_active": True, "end_date": {"$gte": now.isoformat()}},
        {"_id": 0, "name": 1, "metric": 1, "target": 1}
    ).to_list(5)
    
    # Build context for Eve
    context = f"""
HARVEST DATA SUMMARY ({request.period}):

Team Stats:
- Total reps active: {team_stats['total_reps']}
- Total doors knocked: {team_stats['total_visits']}
- Average per rep: {team_stats['avg_visits_per_rep']:.1f}
- Appointments set: {team_stats['appointments']}
- Contracts signed: {team_stats['contracts']}
- Conversion rate: {team_stats['conversion_rate']:.2f}%

Top Performer:
- {team_stats['top_performer']['name'] if team_stats['top_performer'] else 'N/A'}: {team_stats['top_performer']['visits'] if team_stats['top_performer'] else 0} doors

Active Competitions:
{chr(10).join(f"- {c['name']}: target {c.get('target', 'N/A')} {c['metric']}" for c in active_comps) if active_comps else "- No active competitions"}

Individual Rep Breakdown:
{chr(10).join(f"- {u.get('user_name', 'Unknown')}: {u.get('total_visits', 0)} doors" for u in sorted(user_data, key=lambda x: x.get('total_visits', 0), reverse=True)[:5])}
"""
    
    # Call Eve for insights
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
        
        if not EMERGENT_LLM_KEY:
            # Return basic insights without AI
            return {
                "insights": [
                    f"Team has knocked {team_stats['total_visits']} doors this period.",
                    f"Conversion rate is {team_stats['conversion_rate']:.2f}%.",
                    f"Top performer: {team_stats['top_performer']['name'] if team_stats['top_performer'] else 'N/A'}"
                ],
                "actions": [
                    "Review conversion strategies with reps below average.",
                    "Recognize top performers in team meeting.",
                    "Set daily door goals to improve activity."
                ],
                "data": team_stats
            }
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"harvest-assistant-{current_user.get('id')}",
            system_message="""You are the Harvest Assistant, an AI that analyzes canvassing and sales data for a public adjusting firm. 
Your job is to identify patterns, highlight standout performances, and suggest actionable improvements.
Be specific, data-driven, and encouraging. Focus on what matters for closing more contracts."""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""{context}

Based on this data, provide:
1. Exactly 3 KEY INSIGHTS - specific observations about performance, patterns, or standouts
2. Exactly 3 SUGGESTED ACTIONS - concrete steps the manager or team should take

Format your response as JSON:
{{
    "insights": ["insight 1", "insight 2", "insight 3"],
    "actions": ["action 1", "action 2", "action 3"]
}}

Be specific with names and numbers where relevant."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        import json
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(response[json_start:json_end])
            else:
                result = {"insights": [], "actions": []}
        except json.JSONDecodeError:
            result = {"insights": [], "actions": []}
        
        result["data"] = team_stats
        return result
        
    except Exception as e:
        logger.error(f"Harvest Assistant error: {e}")
        return {
            "insights": [
                f"Team has knocked {team_stats['total_visits']} doors this period.",
                f"Conversion rate is {team_stats['conversion_rate']:.2f}%.",
                f"Top performer: {team_stats['top_performer']['name'] if team_stats['top_performer'] else 'N/A'}"
            ],
            "actions": [
                "Review conversion strategies with reps below average.",
                "Recognize top performers in team meeting.",
                "Set daily door goals to improve activity."
            ],
            "data": team_stats
        }


# ============================================
# 7) GAMIFICATION ENDPOINTS (SCORING ENGINE)
# ============================================

@router.get("/stats/me")
async def get_my_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's comprehensive stats from the scoring engine.
    Returns: all-time, today, this week, streak, multiplier, best day.
    """
    await ensure_scoring_engine()
    
    user_id = current_user.get("id")
    stats = await get_user_stats(user_id)
    
    return {
        "user_id": user_id,
        "user_name": current_user.get("full_name", "Unknown"),
        **stats
    }


@router.get("/badges")
async def get_badges(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all badges with user's earned status.
    Returns: badges array with earned flag and earned_at timestamp.
    """
    await ensure_scoring_engine()
    
    user_id = current_user.get("id")
    result = await get_user_badges(user_id)
    
    return result


@router.get("/badges/definitions")
async def get_badge_definitions():
    """Get all badge definitions (public endpoint for UI)"""
    return {"badges": BADGES}


@router.get("/daily-blitz")
async def get_daily_blitz(
    current_user: dict = Depends(get_current_user)
):
    """
    Get today's Daily Blitz challenge with current standings.
    Auto-creates today's blitz if not exists.
    """
    await ensure_scoring_engine()
    
    blitz = await ensure_daily_blitz()
    
    if not blitz:
        return {"error": "Failed to create Daily Blitz"}
    
    # Get standings for today's blitz
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"date": today}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "doors": {"$sum": "$doors"}
        }},
        {"$sort": {"doors": -1}},
        {"$limit": 20}
    ]
    
    standings_result = await db.harvest_stats_daily.aggregate(pipeline).to_list(20)
    
    standings = []
    user_id = current_user.get("id")
    my_rank = None
    my_doors = 0
    
    for i, s in enumerate(standings_result):
        entry = {
            "rank": i + 1,
            "user_id": s["_id"],
            "user_name": s.get("user_name", "Unknown"),
            "doors": s.get("doors", 0)
        }
        standings.append(entry)
        
        if s["_id"] == user_id:
            my_rank = i + 1
            my_doors = s.get("doors", 0)
    
    return {
        "id": blitz.get("id"),
        "title": blitz.get("title"),
        "description": blitz.get("description"),
        "prize": blitz.get("prize"),
        "metric": blitz.get("metric"),
        "start_date": blitz.get("start_date"),
        "end_date": blitz.get("end_date"),
        "standings": standings,
        "my_rank": my_rank,
        "my_doors": my_doors
    }


@router.get("/leaderboard-v2")
async def get_leaderboard_v2(
    metric: Literal["points", "doors", "appointments", "signed"] = "points",
    period: Literal["today", "week", "month", "all"] = "week",
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get leaderboard using the scoring engine.
    Enhanced version with streaks and detailed metrics.
    """
    await ensure_scoring_engine()
    
    result = await engine_get_leaderboard(
        metric=metric,
        period=period,
        limit=limit
    )
    
    # Find current user's rank
    user_id = current_user.get("id")
    my_entry = next((e for e in result.get("entries", []) if e.get("user_id") == user_id), None)
    
    return {
        **result,
        "my_rank": my_entry.get("rank") if my_entry else None,
        "my_value": my_entry.get("value") if my_entry else 0
    }


@router.post("/seed-badges")
async def seed_badges_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to manually seed badges (if needed)"""
    user_role = current_user.get("role", "adjuster")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await ensure_scoring_engine()
    await seed_badges()
    
    return {"message": "Badges seeded successfully"}


# ============================================
# 8) HARVEST COACH BOT ADMIN ENDPOINTS
# ============================================

@router.get("/coach/status")
async def get_coach_status(
    current_user: dict = Depends(get_current_user)
):
    """Get Harvest Coach Bot scheduler status"""
    try:
        from workers.scheduler import get_scheduler_status
        return get_scheduler_status()
    except Exception as e:
        return {"error": str(e), "running": False, "jobs": []}


@router.post("/coach/trigger")
async def trigger_coach_manually(
    run_type: str = "hourly",
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger Harvest Coach Bot (admin only).
    run_type: "hourly" or "nightly"
    """
    user_role = current_user.get("role", "adjuster")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    try:
        from workers.harvest_coach import trigger_manual_run
        await trigger_manual_run(run_type)
        return {"message": f"Harvest Coach {run_type} run triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

