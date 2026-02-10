"""
Harvest Scoring Engine v2 - Unified scoring for all gamification
Single source of truth for points, streaks, badges, and competitions.

This module is called by all visit/pin operations to ensure consistent scoring.
"""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import uuid

# Will be injected by routes
db = None

def init_scoring_engine(database):
    """Initialize the scoring engine with database connection"""
    global db
    db = database


# ============================================
# CONSTANTS
# ============================================

# Base points per status (Enzy-style)
STATUS_POINTS = {
    "NH": {"points": 1, "event": "door_knocked", "label": "Not Home"},
    "NI": {"points": 3, "event": "contact_made", "label": "Not Interested"},
    "DNK": {"points": 3, "event": "contact_made", "label": "Do Not Knock"},
    "CB": {"points": 5, "event": "callback_scheduled", "label": "Callback"},
    "AP": {"points": 10, "event": "appointment_set", "label": "Appointment"},
    "SG": {"points": 50, "event": "contract_signed", "label": "Signed"},
}

# Legacy disposition mapping
DISPOSITION_TO_STATUS = {
    "not_home": "NH",
    "not_interested": "NI",
    "do_not_knock": "DNK",
    "callback": "CB",
    "appointment": "AP",
    "signed": "SG",
    "unmarked": None,
}

# Streak multipliers
STREAK_MULTIPLIERS = {
    3: 1.1,    # 3+ consecutive days
    5: 1.25,   # 5+ consecutive days
    10: 1.5,   # 10+ consecutive days
    30: 2.0,   # 30+ consecutive days (legendary)
}

# Minimum doors per day to count as streak day
STREAK_THRESHOLD = 10

# Badge definitions
BADGES = [
    {
        "id": "first_fruits",
        "icon": "🌱",
        "name": "First Fruits",
        "description": "First signed contract",
        "criteria_type": "total_signed",
        "criteria_value": 1,
        "category": "milestone",
        "rarity": "common"
    },
    {
        "id": "ten_doors_down",
        "icon": "🚪",
        "name": "Ten Doors Down",
        "description": "10 doors in a single day",
        "criteria_type": "doors_single_day",
        "criteria_value": 10,
        "category": "milestone",
        "rarity": "common"
    },
    {
        "id": "weekend_warrior",
        "icon": "⚔️",
        "name": "Weekend Warrior",
        "description": "Activity on Sat or Sun 3 weeks in a row",
        "criteria_type": "weekend_streak",
        "criteria_value": 3,
        "category": "streak",
        "rarity": "uncommon"
    },
    {
        "id": "closer",
        "icon": "🎯",
        "name": "Closer",
        "description": "10 signed contracts total",
        "criteria_type": "total_signed",
        "criteria_value": 10,
        "category": "milestone",
        "rarity": "rare"
    },
    {
        "id": "territory_titan",
        "icon": "🗺️",
        "name": "Territory Titan",
        "description": "50 doors in a single territory",
        "criteria_type": "territory_doors",
        "criteria_value": 50,
        "category": "milestone",
        "rarity": "epic"
    },
    {
        "id": "hundred_club",
        "icon": "💯",
        "name": "100 Club",
        "description": "100 doors in a single day",
        "criteria_type": "doors_single_day",
        "criteria_value": 100,
        "category": "milestone",
        "rarity": "legendary"
    },
    {
        "id": "on_fire",
        "icon": "🔥",
        "name": "On Fire",
        "description": "5-day activity streak",
        "criteria_type": "streak_days",
        "criteria_value": 5,
        "category": "streak",
        "rarity": "uncommon"
    },
    {
        "id": "unstoppable",
        "icon": "⚡",
        "name": "Unstoppable",
        "description": "10-day activity streak",
        "criteria_type": "streak_days",
        "criteria_value": 10,
        "category": "streak",
        "rarity": "rare"
    },
]


# ============================================
# CORE SCORING FUNCTION
# ============================================

async def process_visit_for_scoring(
    user_id: str,
    user_name: str,
    status: str,
    pin_id: str,
    timestamp: datetime = None,
    territory_id: str = None
) -> Dict[str, Any]:
    """
    Main scoring function - called for every visit.
    
    Flow:
    1. Map status -> event_type + base_points
    2. Calculate user's current streak
    3. Apply streak multiplier
    4. Record score event
    5. Update user stats (daily/weekly/monthly/all-time)
    6. Update active competitions
    7. Check and award badges
    8. Return scoring result
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    
    # 1. Get base points and event type
    status_info = STATUS_POINTS.get(status, {"points": 1, "event": "door_knocked"})
    base_points = status_info["points"]
    event_type = status_info["event"]
    
    # 2. Calculate streak
    streak = await calculate_streak(user_id)
    
    # 3. Apply multiplier
    multiplier = get_streak_multiplier(streak)
    final_points = int(base_points * multiplier)
    
    # 4. Record score event
    score_event_id = str(uuid.uuid4())
    date_str = timestamp.strftime("%Y-%m-%d")
    
    score_event = {
        "id": score_event_id,
        "user_id": user_id,
        "user_name": user_name,
        "event_type": event_type,
        "status": status,
        "base_points": base_points,
        "multiplier": multiplier,
        "final_points": final_points,
        "streak_at_time": streak,
        "pin_id": pin_id,
        "territory_id": territory_id,
        "timestamp": timestamp.isoformat(),
        "date": date_str
    }
    
    await db.harvest_score_events.insert_one(score_event)
    
    # 5. Update user stats
    await update_user_stats(user_id, user_name, final_points, status, date_str, timestamp)
    
    # 6. Update active competitions
    competition_updates = await update_competitions(user_id, status, final_points, timestamp)
    
    # 7. Check badges
    new_badges = await check_and_award_badges(user_id, user_name, status, pin_id, territory_id)
    
    return {
        "points_earned": final_points,
        "base_points": base_points,
        "multiplier": multiplier,
        "streak": streak,
        "new_badges": new_badges,
        "competition_updates": competition_updates,
        "event_id": score_event_id
    }


# ============================================
# STREAK CALCULATION
# ============================================

async def calculate_streak(user_id: str) -> int:
    """
    Calculate consecutive days with >= STREAK_THRESHOLD doors.
    Returns the current streak count.
    """
    now = datetime.now(timezone.utc)
    streak = 0
    
    for i in range(60):  # Check last 60 days max
        check_date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # Count doors for this day
        day_start = datetime.strptime(check_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        
        door_count = await db.harvest_visits.count_documents({
            "user_id": user_id,
            "created_at": {
                "$gte": day_start.isoformat(),
                "$lt": day_end.isoformat()
            }
        })
        
        if door_count >= STREAK_THRESHOLD:
            streak += 1
        elif i > 0:  # Allow today to be incomplete
            break
    
    return streak


def get_streak_multiplier(streak: int) -> float:
    """Get multiplier based on streak length"""
    multiplier = 1.0
    
    for threshold, mult in sorted(STREAK_MULTIPLIERS.items()):
        if streak >= threshold:
            multiplier = mult
    
    return multiplier


# ============================================
# USER STATS
# ============================================

async def update_user_stats(
    user_id: str,
    user_name: str,
    points: int,
    status: str,
    date_str: str,
    timestamp: datetime
):
    """Update all user stat aggregates"""
    
    # Daily stats
    await db.harvest_stats_daily.update_one(
        {"user_id": user_id, "date": date_str},
        {
            "$inc": {
                "points": points,
                "doors": 1,
                f"status_{status}": 1,
                "appointments": 1 if status == "AP" else 0,
                "signed": 1 if status == "SG" else 0,
            },
            "$setOnInsert": {
                "user_name": user_name,
                "created_at": timestamp.isoformat()
            },
            "$set": {"updated_at": timestamp.isoformat()}
        },
        upsert=True
    )
    
    # All-time stats
    await db.harvest_user_stats.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "total_points": points,
                "total_doors": 1,
                "total_appointments": 1 if status == "AP" else 0,
                "total_signed": 1 if status == "SG" else 0,
            },
            "$setOnInsert": {
                "user_name": user_name,
                "created_at": timestamp.isoformat()
            },
            "$set": {
                "last_activity": timestamp.isoformat(),
                "updated_at": timestamp.isoformat()
            }
        },
        upsert=True
    )


async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get comprehensive stats for a user"""
    # All-time stats
    all_time = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not all_time:
        all_time = {
            "total_points": 0,
            "total_doors": 0,
            "total_appointments": 0,
            "total_signed": 0
        }
    
    # Today's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_stats = await db.harvest_stats_daily.find_one(
        {"user_id": user_id, "date": today},
        {"_id": 0}
    )
    
    if not today_stats:
        today_stats = {"points": 0, "doors": 0, "appointments": 0, "signed": 0}
    
    # This week stats
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    week_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": week_start}}},
        {"$group": {
            "_id": None,
            "points": {"$sum": "$points"},
            "doors": {"$sum": "$doors"},
            "appointments": {"$sum": "$appointments"},
            "signed": {"$sum": "$signed"}
        }}
    ]
    week_result = await db.harvest_stats_daily.aggregate(week_pipeline).to_list(1)
    week_stats = week_result[0] if week_result else {"points": 0, "doors": 0, "appointments": 0, "signed": 0}
    
    # Current streak
    streak = await calculate_streak(user_id)
    
    # Best day (max doors)
    best_day_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"doors": -1}},
        {"$limit": 1}
    ]
    best_day_result = await db.harvest_stats_daily.aggregate(best_day_pipeline).to_list(1)
    best_day = best_day_result[0] if best_day_result else None
    
    return {
        "all_time": all_time,
        "today": today_stats,
        "this_week": week_stats,
        "streak": streak,
        "multiplier": get_streak_multiplier(streak),
        "best_day": {
            "date": best_day.get("date") if best_day else None,
            "doors": best_day.get("doors", 0) if best_day else 0
        }
    }


# ============================================
# COMPETITIONS
# ============================================

async def update_competitions(
    user_id: str,
    status: str,
    points: int,
    timestamp: datetime
) -> List[Dict]:
    """Update all active competitions with this event"""
    now_iso = timestamp.isoformat()
    
    # Find active competitions
    active_comps = await db.harvest_competitions.find({
        "is_active": True,
        "start_date": {"$lte": now_iso},
        "end_date": {"$gte": now_iso}
    }).to_list(50)
    
    updates = []
    
    for comp in active_comps:
        # Check if user is participant (empty = all)
        participants = comp.get("participants", [])
        if participants and user_id not in [p.get("user_id") if isinstance(p, dict) else p for p in participants]:
            continue
        
        metric = comp.get("metric", "doors")
        
        # Calculate contribution
        contribution = 0
        if metric == "doors":
            contribution = 1
        elif metric == "points":
            contribution = points
        elif metric == "appointments" and status == "AP":
            contribution = 1
        elif metric == "signed" and status == "SG":
            contribution = 1
        elif metric == "contacts" and status in ["NI", "CB", "AP", "SG"]:
            contribution = 1
        
        if contribution > 0:
            updates.append({
                "competition_id": comp["id"],
                "competition_name": comp.get("title", comp.get("name")),
                "contribution": contribution,
                "metric": metric
            })
    
    return updates


async def ensure_daily_blitz():
    """Ensure today's Daily Blitz challenge exists"""
    today = datetime.now(timezone.utc)
    today_str = today.strftime("%Y-%m-%d")
    
    # Check if today's blitz exists
    existing = await db.harvest_competitions.find_one({
        "type": "daily_blitz",
        "date": today_str
    })
    
    if existing:
        return existing
    
    # Create today's Daily Blitz
    blitz_id = str(uuid.uuid4())
    start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    blitz = {
        "id": blitz_id,
        "type": "daily_blitz",
        "title": f"Daily Blitz - {today.strftime('%b %d')}",
        "name": "Daily Blitz",
        "description": "Most doors knocked today wins!",
        "prize": "Bragging rights + Daily Blitz badge progress",
        "metric": "doors",
        "competition_type": "individual",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "date": today_str,
        "target_value": None,
        "is_active": True,
        "auto_created": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "participants": []  # Empty = all users
    }
    
    await db.harvest_competitions.insert_one(blitz)
    return blitz


# ============================================
# BADGES
# ============================================

async def seed_badges():
    """Seed badge definitions if not exists"""
    for badge in BADGES:
        existing = await db.harvest_badges.find_one({"id": badge["id"]})
        if not existing:
            await db.harvest_badges.insert_one(badge)


async def check_and_award_badges(
    user_id: str,
    user_name: str,
    status: str,
    pin_id: str,
    territory_id: str = None
) -> List[Dict]:
    """Check all badge criteria and award any newly earned"""
    newly_earned = []
    
    # Get user's current badges
    earned_badges = await db.harvest_user_badges.find(
        {"user_id": user_id},
        {"badge_id": 1}
    ).to_list(100)
    earned_ids = {b["badge_id"] for b in earned_badges}
    
    # Get all badge definitions
    badges = await db.harvest_badges.find({}, {"_id": 0}).to_list(100)
    
    # Get user stats
    stats = await get_user_stats(user_id)
    
    now = datetime.now(timezone.utc)
    
    for badge in badges:
        if badge["id"] in earned_ids:
            continue
        
        criteria_type = badge.get("criteria_type")
        criteria_value = badge.get("criteria_value", 1)
        should_award = False
        
        # Check each criteria type
        if criteria_type == "total_signed":
            if stats["all_time"].get("total_signed", 0) >= criteria_value:
                should_award = True
        
        elif criteria_type == "doors_single_day":
            if stats["today"].get("doors", 0) >= criteria_value:
                should_award = True
            elif stats["best_day"]["doors"] >= criteria_value:
                should_award = True
        
        elif criteria_type == "streak_days":
            if stats["streak"] >= criteria_value:
                should_award = True
        
        elif criteria_type == "weekend_streak":
            # Check weekend activity in last N weeks
            weekend_count = await count_weekend_activity(user_id, criteria_value * 2)
            if weekend_count >= criteria_value:
                should_award = True
        
        elif criteria_type == "territory_doors" and territory_id:
            territory_doors = await db.canvassing_pins.count_documents({
                "user_id": user_id,
                "territory_id": territory_id
            })
            if territory_doors >= criteria_value:
                should_award = True
        
        if should_award:
            # Award the badge
            award_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "user_name": user_name,
                "badge_id": badge["id"],
                "badge_name": badge["name"],
                "badge_icon": badge["icon"],
                "earned_at": now.isoformat(),
                "trigger_pin_id": pin_id
            }
            await db.harvest_user_badges.insert_one(award_doc)
            newly_earned.append(badge)
    
    return newly_earned


async def count_weekend_activity(user_id: str, weeks: int) -> int:
    """Count weekends with activity in the last N weeks"""
    now = datetime.now(timezone.utc)
    weekend_count = 0
    
    for i in range(weeks):
        # Find Saturday and Sunday of each week
        week_start = now - timedelta(weeks=i)
        saturday = week_start - timedelta(days=week_start.weekday() + 2)  # Last Saturday
        sunday = saturday + timedelta(days=1)
        
        sat_str = saturday.strftime("%Y-%m-%d")
        sun_str = sunday.strftime("%Y-%m-%d")
        
        # Check if there's activity on either day
        sat_activity = await db.harvest_stats_daily.find_one({
            "user_id": user_id,
            "date": sat_str,
            "doors": {"$gte": 1}
        })
        sun_activity = await db.harvest_stats_daily.find_one({
            "user_id": user_id,
            "date": sun_str,
            "doors": {"$gte": 1}
        })
        
        if sat_activity or sun_activity:
            weekend_count += 1
    
    return weekend_count


async def get_user_badges(user_id: str) -> Dict[str, Any]:
    """Get all badges with user's earned status"""
    # Ensure badges are seeded
    await seed_badges()
    
    # Get all badge definitions
    badges = await db.harvest_badges.find({}, {"_id": 0}).to_list(100)
    
    # Get user's earned badges
    earned = await db.harvest_user_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    earned_map = {e["badge_id"]: e for e in earned}
    
    result = []
    for badge in badges:
        is_earned = badge["id"] in earned_map
        result.append({
            **badge,
            "earned": is_earned,
            "earned_at": earned_map[badge["id"]].get("earned_at") if is_earned else None
        })
    
    return {
        "badges": result,
        "earned_count": len(earned),
        "total_count": len(badges)
    }


# ============================================
# LEADERBOARD
# ============================================

async def get_leaderboard(
    metric: str = "points",
    period: str = "week",
    scope: str = "company",
    territory_id: str = None,
    limit: int = 20
) -> Dict[str, Any]:
    """
    Get leaderboard rankings.
    
    metric: points | doors | appointments | signed
    period: today | week | month | all
    scope: company | team | territory
    """
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
    elif period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    else:
        start_date = "2020-01-01"
    
    # Build aggregation
    match_stage = {"date": {"$gte": start_date}}
    
    # Map metric to field
    metric_field = {
        "points": "points",
        "doors": "doors",
        "appointments": "appointments",
        "signed": "signed"
    }.get(metric, "points")
    
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "value": {"$sum": f"${metric_field}"},
            "doors": {"$sum": "$doors"},
            "appointments": {"$sum": "$appointments"},
            "signed": {"$sum": "$signed"},
            "points": {"$sum": "$points"}
        }},
        {"$sort": {"value": -1}},
        {"$limit": limit}
    ]
    
    results = await db.harvest_stats_daily.aggregate(pipeline).to_list(limit)
    
    # Build entries with rank
    entries = []
    for idx, r in enumerate(results):
        # Get streak for each user
        streak = await calculate_streak(r["_id"])
        
        entries.append({
            "rank": idx + 1,
            "user_id": r["_id"],
            "user_name": r.get("user_name", "Unknown"),
            "value": r["value"],
            "doors": r["doors"],
            "appointments": r["appointments"],
            "signed": r["signed"],
            "points": r["points"],
            "streak": streak
        })
    
    return {
        "metric": metric,
        "period": period,
        "scope": scope,
        "entries": entries,
        "updated_at": now.isoformat()
    }


# ============================================
# INITIALIZATION
# ============================================

async def initialize_harvest_gamification():
    """Initialize badges, ensure Daily Blitz exists"""
    await seed_badges()
    await ensure_daily_blitz()
