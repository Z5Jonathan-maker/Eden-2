"""
Harvest Scoring Engine - Real-time gamification system
Based on HARVEST ENGINE SPEC
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/harvest/scoring", tags=["Harvest Scoring"])

# ============================================
# Point Values (from spec)
# ============================================
POINT_VALUES = {
    "door_knocked": 1,
    "contact_made": 3,
    "callback_scheduled": 5,
    "appointment_set": 10,
    "contract_signed": 50,
    "first_knock_of_day": 5,
    "doors_50_bonus": 25,
    "doors_100_bonus": 50,
}

# Disposition to event type mapping
DISPOSITION_EVENTS = {
    "unmarked": "door_knocked",
    "not_home": "door_knocked",
    "not_interested": "contact_made",
    "callback": "callback_scheduled",
    "appointment": "appointment_set",
    "signed": "contract_signed",
    "do_not_knock": "contact_made",
    "renter": "contact_made",
}

# Badge definitions
BADGES = {
    "first_fruits": {
        "name": "First Fruits",
        "icon": "🌱",
        "description": "First signed contract",
        "criteria": {"event_type": "contract_signed", "threshold": 1},
        "rarity": "common",
        "points_bonus": 10
    },
    "100_club": {
        "name": "100 Club",
        "icon": "🚪",
        "description": "100 doors in one day",
        "criteria": {"event_type": "door_knocked", "threshold": 100, "period": "day"},
        "rarity": "uncommon",
        "points_bonus": 50
    },
    "on_fire": {
        "name": "On Fire",
        "icon": "🔥",
        "description": "5-day knock streak",
        "criteria": {"streak": 5},
        "rarity": "uncommon",
        "points_bonus": 25
    },
    "abundant": {
        "name": "Abundant",
        "icon": "🌾",
        "description": "10 appointments in a week",
        "criteria": {"event_type": "appointment_set", "threshold": 10, "period": "week"},
        "rarity": "rare",
        "points_bonus": 75
    },
    "top_harvester": {
        "name": "Top Harvester",
        "icon": "🏆",
        "description": "#1 weekly ranking",
        "criteria": {"rank": 1, "period": "week"},
        "rarity": "rare",
        "points_bonus": 100
    },
    "diamond": {
        "name": "Diamond",
        "icon": "💎",
        "description": "50 signed contracts",
        "criteria": {"event_type": "contract_signed", "threshold": 50},
        "rarity": "epic",
        "points_bonus": 200
    },
    "early_bird": {
        "name": "Early Bird",
        "icon": "🦅",
        "description": "First knock before 8am",
        "criteria": {"hour_before": 8},
        "rarity": "common",
        "points_bonus": 5
    },
    "night_owl": {
        "name": "Night Owl",
        "icon": "🌙",
        "description": "Knock after 7pm",
        "criteria": {"hour_after": 19},
        "rarity": "common",
        "points_bonus": 5
    },
    "century": {
        "name": "Century",
        "icon": "💯",
        "description": "100 total signed contracts",
        "criteria": {"event_type": "contract_signed", "threshold": 100},
        "rarity": "epic",
        "points_bonus": 500
    },
    "week_warrior": {
        "name": "Week Warrior",
        "icon": "⚔️",
        "description": "500 doors in one week",
        "criteria": {"event_type": "door_knocked", "threshold": 500, "period": "week"},
        "rarity": "legendary",
        "points_bonus": 250
    }
}

# ============================================
# Models
# ============================================

class ScoreEventCreate(BaseModel):
    event_type: str
    pin_id: Optional[str] = None
    metadata: Optional[dict] = None

class LeaderboardQuery(BaseModel):
    period: str = "day"  # day, week, month, all_time
    kpi: str = "points"  # points, doors, appointments, signed
    limit: int = 50

# ============================================
# Score Event Endpoints
# ============================================

@router.post("/event")
async def record_score_event(
    event: ScoreEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Record a score event and calculate points"""
    user_id = current_user.get("id")
    now = datetime.now(timezone.utc)
    
    # Get base points
    base_points = POINT_VALUES.get(event.event_type, 0)
    
    # Calculate multiplier
    multiplier = await calculate_multiplier(user_id)
    
    # Calculate final points
    final_points = int(base_points * multiplier)
    
    # Create score event
    event_id = str(uuid.uuid4())
    score_event = {
        "id": event_id,
        "user_id": user_id,
        "user_name": current_user.get("full_name", "Unknown"),
        "event_type": event.event_type,
        "base_points": base_points,
        "multiplier": multiplier,
        "final_points": final_points,
        "pin_id": event.pin_id,
        "metadata": event.metadata or {},
        "timestamp": now.isoformat(),
        "date": now.date().isoformat()
    }
    
    await db.harvest_score_events.insert_one(score_event)
    
    # Update user's total score
    await update_user_totals(user_id, event.event_type, final_points)
    
    # Check for badges
    earned_badges = await check_badges(user_id, event.event_type, now)
    
    # Check for daily milestones
    milestones = await check_milestones(user_id, now)
    
    return {
        "event_id": event_id,
        "points_earned": final_points,
        "multiplier": multiplier,
        "new_badges": earned_badges,
        "milestones": milestones
    }


async def calculate_multiplier(user_id: str) -> float:
    """Calculate point multiplier based on streak and competitions"""
    multiplier = 1.0
    
    # Get user's streak
    streak = await get_user_streak(user_id)
    
    # Streak multipliers
    if streak >= 30:
        multiplier *= 2.0
    elif streak >= 10:
        multiplier *= 1.5
    elif streak >= 5:
        multiplier *= 1.25
    elif streak >= 3:
        multiplier *= 1.1
    
    # TODO: Add competition multiplier
    
    return round(multiplier, 2)


async def get_user_streak(user_id: str) -> int:
    """Calculate user's current knock streak"""
    today = datetime.now(timezone.utc).date()
    streak = 0
    
    for i in range(365):  # Check up to a year back
        check_date = (today - timedelta(days=i)).isoformat()
        
        # Count events for this day
        count = await db.harvest_score_events.count_documents({
            "user_id": user_id,
            "date": check_date,
            "event_type": {"$in": ["door_knocked", "contact_made", "callback_scheduled", "appointment_set", "contract_signed"]}
        })
        
        if count >= 10:  # Minimum 10 doors to count as active day
            streak += 1
        elif i == 0:
            # Today - might not have started yet
            continue
        else:
            break
    
    return streak


async def update_user_totals(user_id: str, event_type: str, points: int):
    """Update user's aggregated totals"""
    update_fields = {
        "$inc": {
            "total_points": points,
            f"total_{event_type}": 1
        },
        "$set": {
            "last_activity": datetime.now(timezone.utc).isoformat()
        }
    }
    
    await db.harvest_user_stats.update_one(
        {"user_id": user_id},
        update_fields,
        upsert=True
    )


async def check_badges(user_id: str, event_type: str, now: datetime) -> List[dict]:
    """Check if user earned any new badges"""
    earned = []
    
    for badge_id, badge in BADGES.items():
        # Check if already earned
        existing = await db.harvest_earned_badges.find_one({
            "user_id": user_id,
            "badge_id": badge_id
        })
        
        if existing:
            continue
        
        # Check criteria
        criteria = badge["criteria"]
        earned_badge = False
        
        # Event-based badges
        if criteria.get("event_type") == event_type:
            threshold = criteria.get("threshold", 1)
            period = criteria.get("period")
            
            query = {"user_id": user_id, "event_type": event_type}
            
            if period == "day":
                query["date"] = now.date().isoformat()
            elif period == "week":
                week_start = (now - timedelta(days=now.weekday())).date().isoformat()
                query["date"] = {"$gte": week_start}
            
            count = await db.harvest_score_events.count_documents(query)
            
            if count >= threshold:
                earned_badge = True
        
        # Time-based badges
        if "hour_before" in criteria and event_type == "door_knocked":
            if now.hour < criteria["hour_before"]:
                earned_badge = True
        
        if "hour_after" in criteria and event_type == "door_knocked":
            if now.hour >= criteria["hour_after"]:
                earned_badge = True
        
        # Streak badges
        if "streak" in criteria:
            streak = await get_user_streak(user_id)
            if streak >= criteria["streak"]:
                earned_badge = True
        
        if earned_badge:
            # Award badge
            await db.harvest_earned_badges.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "badge_id": badge_id,
                "earned_at": now.isoformat()
            })
            
            # Award bonus points
            if badge["points_bonus"] > 0:
                bonus_event = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "event_type": "badge_earned",
                    "base_points": badge["points_bonus"],
                    "multiplier": 1.0,
                    "final_points": badge["points_bonus"],
                    "metadata": {"badge_id": badge_id},
                    "timestamp": now.isoformat(),
                    "date": now.date().isoformat()
                }
                await db.harvest_score_events.insert_one(bonus_event)
            
            earned.append({
                "badge_id": badge_id,
                **badge
            })
    
    return earned


async def check_milestones(user_id: str, now: datetime) -> List[dict]:
    """Check for daily milestones (50 doors, 100 doors)"""
    milestones = []
    today = now.date().isoformat()
    
    # Count today's doors
    doors_today = await db.harvest_score_events.count_documents({
        "user_id": user_id,
        "date": today,
        "event_type": {"$in": ["door_knocked", "contact_made"]}
    })
    
    # Check 50 door milestone
    milestone_50 = await db.harvest_milestones.find_one({
        "user_id": user_id,
        "date": today,
        "milestone": "doors_50"
    })
    
    if doors_today >= 50 and not milestone_50:
        await db.harvest_milestones.insert_one({
            "user_id": user_id,
            "date": today,
            "milestone": "doors_50",
            "timestamp": now.isoformat()
        })
        
        # Award bonus
        bonus = POINT_VALUES["doors_50_bonus"]
        await db.harvest_score_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "event_type": "doors_50_bonus",
            "base_points": bonus,
            "multiplier": 1.0,
            "final_points": bonus,
            "timestamp": now.isoformat(),
            "date": today
        })
        
        milestones.append({"type": "doors_50", "points": bonus})
    
    # Check 100 door milestone
    milestone_100 = await db.harvest_milestones.find_one({
        "user_id": user_id,
        "date": today,
        "milestone": "doors_100"
    })
    
    if doors_today >= 100 and not milestone_100:
        await db.harvest_milestones.insert_one({
            "user_id": user_id,
            "date": today,
            "milestone": "doors_100",
            "timestamp": now.isoformat()
        })
        
        bonus = POINT_VALUES["doors_100_bonus"]
        await db.harvest_score_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "event_type": "doors_100_bonus",
            "base_points": bonus,
            "multiplier": 1.0,
            "final_points": bonus,
            "timestamp": now.isoformat(),
            "date": today
        })
        
        milestones.append({"type": "doors_100", "points": bonus})
    
    return milestones


# ============================================
# Leaderboard Endpoints
# ============================================

@router.get("/leaderboard")
async def get_leaderboard(
    period: str = "day",
    kpi: str = "points",
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get leaderboard for specified period and KPI"""
    now = datetime.now(timezone.utc)
    
    # Determine date filter
    if period == "day":
        date_filter = now.date().isoformat()
        match_query = {"date": date_filter}
    elif period == "week":
        week_start = (now - timedelta(days=now.weekday())).date().isoformat()
        match_query = {"date": {"$gte": week_start}}
    elif period == "month":
        month_start = now.replace(day=1).date().isoformat()
        match_query = {"date": {"$gte": month_start}}
    else:  # all_time
        match_query = {}
    
    # Build aggregation pipeline
    if kpi == "points":
        group_field = "$final_points"
    elif kpi == "doors":
        match_query["event_type"] = {"$in": ["door_knocked", "contact_made"]}
        group_field = 1
    elif kpi == "appointments":
        match_query["event_type"] = "appointment_set"
        group_field = 1
    elif kpi == "signed":
        match_query["event_type"] = "contract_signed"
        group_field = 1
    else:
        group_field = "$final_points"
    
    pipeline = [
        {"$match": match_query},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "score": {"$sum": group_field if isinstance(group_field, int) else group_field},
            "events": {"$sum": 1}
        }},
        {"$sort": {"score": -1}},
        {"$limit": limit}
    ]
    
    results = await db.harvest_score_events.aggregate(pipeline).to_list(limit)
    
    # Add rank and user details
    leaderboard = []
    for i, entry in enumerate(results):
        user_id = entry["_id"]
        
        # Get user stats
        user_stats = await db.harvest_user_stats.find_one(
            {"user_id": user_id},
            {"_id": 0}
        ) or {}
        
        # Get earned badges
        badges = await db.harvest_earned_badges.find(
            {"user_id": user_id},
            {"_id": 0, "badge_id": 1}
        ).sort("earned_at", -1).limit(3).to_list(3)
        
        badge_icons = [BADGES.get(b["badge_id"], {}).get("icon", "🏅") for b in badges]
        
        # Get streak
        streak = await get_user_streak(user_id)
        
        leaderboard.append({
            "rank": i + 1,
            "user_id": user_id,
            "user_name": entry["user_name"],
            "score": entry["score"],
            "events": entry["events"],
            "streak": streak,
            "badges": badge_icons,
            "is_current_user": user_id == current_user.get("id")
        })
    
    return {
        "period": period,
        "kpi": kpi,
        "entries": leaderboard,
        "updated_at": now.isoformat()
    }


@router.get("/leaderboard/me")
async def get_my_rank(
    period: str = "day",
    kpi: str = "points",
    current_user: dict = Depends(get_current_user)
):
    """Get current user's rank and nearby entries"""
    user_id = current_user.get("id")
    
    # Get full leaderboard
    leaderboard_data = await get_leaderboard(period, kpi, 1000, current_user)
    entries = leaderboard_data["entries"]
    
    # Find user's position
    user_entry = None
    user_rank = None
    
    for i, entry in enumerate(entries):
        if entry["user_id"] == user_id:
            user_entry = entry
            user_rank = i
            break
    
    if not user_entry:
        return {
            "my_rank": None,
            "my_score": 0,
            "nearby": [],
            "total_participants": len(entries)
        }
    
    # Get nearby entries (2 above, 2 below)
    start = max(0, user_rank - 2)
    end = min(len(entries), user_rank + 3)
    nearby = entries[start:end]
    
    return {
        "my_rank": user_entry["rank"],
        "my_score": user_entry["score"],
        "my_streak": user_entry["streak"],
        "nearby": nearby,
        "total_participants": len(entries)
    }


# ============================================
# Badges Endpoints
# ============================================

@router.get("/badges")
async def get_all_badges(
    current_user: dict = Depends(get_current_user)
):
    """Get all badges with user's earned status"""
    user_id = current_user.get("id")
    
    # Get user's earned badges
    earned = await db.harvest_earned_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    earned_ids = {b["badge_id"]: b["earned_at"] for b in earned}
    
    # Build response
    all_badges = []
    for badge_id, badge in BADGES.items():
        all_badges.append({
            "id": badge_id,
            **badge,
            "earned": badge_id in earned_ids,
            "earned_at": earned_ids.get(badge_id)
        })
    
    return {
        "badges": all_badges,
        "earned_count": len(earned_ids),
        "total_count": len(BADGES)
    }


@router.get("/stats/me")
async def get_my_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's comprehensive stats"""
    user_id = current_user.get("id")
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    
    # Get user stats
    stats = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    ) or {}
    
    # Get today's activity
    today_events = await db.harvest_score_events.aggregate([
        {"$match": {"user_id": user_id, "date": today}},
        {"$group": {
            "_id": "$event_type",
            "count": {"$sum": 1},
            "points": {"$sum": "$final_points"}
        }}
    ]).to_list(20)
    
    today_summary = {}
    total_today = 0
    for e in today_events:
        today_summary[e["_id"]] = {"count": e["count"], "points": e["points"]}
        total_today += e["points"]
    
    # Get streak
    streak = await get_user_streak(user_id)
    
    # Get multiplier
    multiplier = await calculate_multiplier(user_id)
    
    # Get badge count
    badge_count = await db.harvest_earned_badges.count_documents({"user_id": user_id})
    
    return {
        "user_id": user_id,
        "total_points": stats.get("total_points", 0),
        "today_points": total_today,
        "today_activity": today_summary,
        "streak": streak,
        "multiplier": multiplier,
        "badges_earned": badge_count,
        "last_activity": stats.get("last_activity")
    }
