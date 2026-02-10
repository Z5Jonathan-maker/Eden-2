"""
Harvest Gamification API Routes - Leaderboards, Competitions, Badges
Real backend logic replacing frontend mock data
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/harvest", tags=["Harvest Gamification"])


# ============================================
# Models
# ============================================

class CompetitionCreate(BaseModel):
    title: str
    description: str
    prize: str
    metric: str = "doors"  # doors, appointments, signed
    start_date: str
    end_date: str
    target_value: Optional[int] = None


class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    prize: Optional[str] = None
    is_active: Optional[bool] = None


class BadgeDefinition(BaseModel):
    id: str
    icon: str
    name: str
    description: str
    criteria_type: str  # doors_single_day, streak_days, total_signed, first_sign, etc.
    criteria_value: int
    category: str = "general"  # general, streak, milestone


# Default badges
DEFAULT_BADGES = [
    {"id": "first_fruits", "icon": "🌱", "name": "First Fruits", "description": "First signed contract", "criteria_type": "first_sign", "criteria_value": 1, "category": "milestone"},
    {"id": "100_club", "icon": "🚪", "name": "100 Club", "description": "100 doors in one day", "criteria_type": "doors_single_day", "criteria_value": 100, "category": "milestone"},
    {"id": "on_fire", "icon": "🔥", "name": "On Fire", "description": "5-day streak", "criteria_type": "streak_days", "criteria_value": 5, "category": "streak"},
    {"id": "abundant", "icon": "🌾", "name": "Abundant", "description": "10 appointments in a week", "criteria_type": "appointments_week", "criteria_value": 10, "category": "milestone"},
    {"id": "top_harvester", "icon": "🏆", "name": "Top Harvester", "description": "#1 on weekly leaderboard", "criteria_type": "leaderboard_first", "criteria_value": 1, "category": "achievement"},
    {"id": "diamond", "icon": "💎", "name": "Diamond", "description": "50 signed contracts total", "criteria_type": "total_signed", "criteria_value": 50, "category": "milestone"},
    {"id": "early_bird", "icon": "🦅", "name": "Early Bird", "description": "First knock before 8am", "criteria_type": "early_knock", "criteria_value": 8, "category": "special"},
    {"id": "night_owl", "icon": "🌙", "name": "Night Owl", "description": "Knock after 7pm", "criteria_type": "late_knock", "criteria_value": 19, "category": "special"},
    {"id": "century", "icon": "💯", "name": "Century", "description": "100 total signed contracts", "criteria_type": "total_signed", "criteria_value": 100, "category": "milestone"},
    {"id": "week_warrior", "icon": "⚔️", "name": "Week Warrior", "description": "500 doors in one week", "criteria_type": "doors_week", "criteria_value": 500, "category": "milestone"},
]


# ============================================
# Leaderboard Endpoints
# ============================================

@router.get("/leaderboard")
async def get_leaderboard(
    period: str = "week",  # day, week, month, all
    metric: str = "doors",  # doors, appointments, signed
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get leaderboard rankings based on canvassing performance"""
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    # Aggregate pins by user
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$created_by_name"},
            "total_pins": {"$sum": 1},
            "signed": {"$sum": {"$cond": [{"$eq": ["$disposition", "signed"]}, 1, 0]}},
            "appointments": {"$sum": {"$cond": [{"$eq": ["$disposition", "appointment"]}, 1, 0]}},
            "not_home": {"$sum": {"$cond": [{"$eq": ["$disposition", "not_home"]}, 1, 0]}},
            "not_interested": {"$sum": {"$cond": [{"$eq": ["$disposition", "not_interested"]}, 1, 0]}},
            "callback": {"$sum": {"$cond": [{"$eq": ["$disposition", "callback"]}, 1, 0]}},
        }},
        {"$sort": {metric if metric != "doors" else "total_pins": -1}},
        {"$limit": limit}
    ]
    
    results = await db.canvassing_pins.aggregate(pipeline).to_list(limit)
    
    # Build leaderboard with rank
    leaderboard = []
    for idx, r in enumerate(results):
        # Get user details
        user = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "full_name": 1, "email": 1})
        
        # Calculate streak
        streak = await calculate_user_streak(r["_id"])
        
        leaderboard.append({
            "rank": idx + 1,
            "user_id": r["_id"],
            "name": user.get("full_name") if user else r.get("user_name", "Unknown"),
            "initials": get_initials(user.get("full_name") if user else r.get("user_name", "Unknown")),
            "doors": r["total_pins"],
            "signed": r["signed"],
            "appointments": r["appointments"],
            "not_home": r["not_home"],
            "callback": r["callback"],
            "streak": streak,
            "conversion_rate": round((r["signed"] / r["total_pins"] * 100), 1) if r["total_pins"] > 0 else 0
        })
    
    return {
        "period": period,
        "metric": metric,
        "leaderboard": leaderboard,
        "updated_at": now.isoformat()
    }


@router.get("/leaderboard/my-rank")
async def get_my_rank(
    period: str = "week",
    current_user: dict = Depends(get_current_user)
):
    """Get current user's rank and stats"""
    user_id = current_user.get("id")
    
    # Get full leaderboard
    lb_response = await get_leaderboard(period=period, metric="doors", limit=100, current_user=current_user)
    leaderboard = lb_response["leaderboard"]
    
    # Find user's position
    my_rank = None
    my_stats = None
    for entry in leaderboard:
        if entry["user_id"] == user_id:
            my_rank = entry["rank"]
            my_stats = entry
            break
    
    # If not in top 100, calculate separately
    if not my_rank:
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=now.weekday())
        
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": start_date.isoformat()}}},
            {"$group": {
                "_id": "$user_id",
                "total_pins": {"$sum": 1},
                "signed": {"$sum": {"$cond": [{"$eq": ["$disposition", "signed"]}, 1, 0]}},
                "appointments": {"$sum": {"$cond": [{"$eq": ["$disposition", "appointment"]}, 1, 0]}},
            }}
        ]
        
        results = await db.canvassing_pins.aggregate(pipeline).to_list(1)
        if results:
            my_stats = {
                "user_id": user_id,
                "doors": results[0]["total_pins"],
                "signed": results[0]["signed"],
                "appointments": results[0]["appointments"],
            }
        my_rank = ">100"
    
    return {
        "rank": my_rank,
        "stats": my_stats,
        "total_participants": len(leaderboard)
    }


# ============================================
# Competitions Endpoints
# ============================================

@router.post("/competitions")
async def create_competition(
    comp: CompetitionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new competition (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    comp_id = str(uuid.uuid4())
    doc = {
        "id": comp_id,
        "title": comp.title,
        "description": comp.description,
        "prize": comp.prize,
        "metric": comp.metric,
        "start_date": comp.start_date,
        "end_date": comp.end_date,
        "target_value": comp.target_value,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "participants": []
    }
    
    await db.harvest_competitions.insert_one(doc)
    return {"id": comp_id, "message": "Competition created"}


@router.get("/competitions")
async def get_competitions(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all competitions with progress"""
    query = {}
    if active_only:
        query["is_active"] = True
        query["end_date"] = {"$gte": datetime.now(timezone.utc).isoformat()}
    
    competitions = await db.harvest_competitions.find(query, {"_id": 0}).sort("end_date", 1).to_list(50)
    
    # Enrich with progress data
    user_id = current_user.get("id")
    enriched = []
    
    for comp in competitions:
        # Calculate time remaining
        end_date = datetime.fromisoformat(comp["end_date"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = end_date - now
        
        if delta.days > 0:
            ends_in = f"{delta.days} days"
        elif delta.seconds > 3600:
            ends_in = f"{delta.seconds // 3600} hours"
        else:
            ends_in = f"{delta.seconds // 60} mins"
        
        # Get leaderboard for this competition
        start_date = datetime.fromisoformat(comp["start_date"].replace("Z", "+00:00"))
        metric_field = "total_pins" if comp["metric"] == "doors" else comp["metric"]
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}},
            {"$group": {
                "_id": "$user_id",
                "user_name": {"$first": "$created_by_name"},
                "score": {"$sum": {"$cond": [
                    {"$eq": ["$disposition", comp["metric"]]} if comp["metric"] in ["signed", "appointment"] else True,
                    1, 0
                ]}}
            }},
            {"$sort": {"score": -1}},
            {"$limit": 10}
        ]
        
        results = await db.canvassing_pins.aggregate(pipeline).to_list(10)
        
        # Find user's progress and leader
        my_progress = 0
        leader_progress = 0
        leader_name = "No entries"
        participants = len(results)
        
        for r in results:
            if r["_id"] == user_id:
                my_progress = r["score"]
            if r == results[0]:
                leader_progress = r["score"]
                leader_name = r.get("user_name", "Unknown")
        
        enriched.append({
            **comp,
            "ends_in": ends_in,
            "participants": participants,
            "my_progress": my_progress,
            "leader_progress": leader_progress,
            "leader": leader_name,
            "is_live": now >= start_date and now <= end_date
        })
    
    return {"competitions": enriched}


@router.get("/competitions/{comp_id}")
async def get_competition(
    comp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific competition with full leaderboard"""
    comp = await db.harvest_competitions.find_one({"id": comp_id}, {"_id": 0})
    
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # Get full leaderboard for competition
    start_date = datetime.fromisoformat(comp["start_date"].replace("Z", "+00:00"))
    end_date = datetime.fromisoformat(comp["end_date"].replace("Z", "+00:00"))
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$created_by_name"},
            "score": {"$sum": 1}
        }},
        {"$sort": {"score": -1}},
        {"$limit": 50}
    ]
    
    results = await db.canvassing_pins.aggregate(pipeline).to_list(50)
    
    leaderboard = []
    for idx, r in enumerate(results):
        leaderboard.append({
            "rank": idx + 1,
            "user_id": r["_id"],
            "name": r.get("user_name", "Unknown"),
            "score": r["score"]
        })
    
    comp["leaderboard"] = leaderboard
    return comp


@router.patch("/competitions/{comp_id}")
async def update_competition(
    comp_id: str,
    update: CompetitionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a competition"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    
    result = await db.harvest_competitions.update_one(
        {"id": comp_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    return {"message": "Competition updated"}


@router.post("/competitions/{comp_id}/join")
async def join_competition(
    comp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Join a competition"""
    user_id = current_user.get("id")
    user_name = current_user.get("name", current_user.get("email", "Unknown"))
    
    # Check if competition exists and is active
    comp = await db.harvest_competitions.find_one({"id": comp_id}, {"_id": 0})
    
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    if not comp.get("is_active", True):
        raise HTTPException(status_code=400, detail="Competition is no longer active")
    
    # Check end date
    end_date = datetime.fromisoformat(comp["end_date"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > end_date:
        raise HTTPException(status_code=400, detail="Competition has ended")
    
    # Check if already joined
    participants = comp.get("participants", [])
    if user_id in [p.get("user_id") if isinstance(p, dict) else p for p in participants]:
        return {"message": "Already joined", "already_joined": True}
    
    # Add user to participants
    participant_entry = {
        "user_id": user_id,
        "user_name": user_name,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.harvest_competitions.update_one(
        {"id": comp_id},
        {"$push": {"participants": participant_entry}}
    )
    
    return {"message": "Successfully joined competition", "competition_id": comp_id}


@router.post("/competitions/{comp_id}/leave")
async def leave_competition(
    comp_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a competition"""
    user_id = current_user.get("id")
    
    # Remove user from participants
    result = await db.harvest_competitions.update_one(
        {"id": comp_id},
        {"$pull": {"participants": {"user_id": user_id}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    return {"message": "Left competition"}


# ============================================
# Badges Endpoints
# ============================================

@router.get("/badges")
async def get_badges(
    current_user: dict = Depends(get_current_user)
):
    """Get all badges with user's earned status"""
    user_id = current_user.get("id")
    
    # Ensure badges are seeded
    badge_count = await db.harvest_badges.count_documents({})
    if badge_count == 0:
        for badge in DEFAULT_BADGES:
            await db.harvest_badges.insert_one(badge)
    
    # Get all badge definitions
    badges = await db.harvest_badges.find({}, {"_id": 0}).to_list(100)
    
    # Get user's earned badges
    earned = await db.harvest_user_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    earned_ids = {e["badge_id"]: e for e in earned}
    
    # Combine
    result = []
    for badge in badges:
        is_earned = badge["id"] in earned_ids
        result.append({
            **badge,
            "earned": is_earned,
            "earned_at": earned_ids[badge["id"]].get("earned_at") if is_earned else None
        })
    
    return {
        "badges": result,
        "earned_count": len(earned),
        "total_count": len(badges)
    }


@router.post("/badges/check")
async def check_and_award_badges(
    current_user: dict = Depends(get_current_user)
):
    """Check and award any newly earned badges for current user"""
    user_id = current_user.get("id")
    newly_earned = []
    
    # Get user's stats
    stats = await get_user_harvest_stats(user_id)
    
    # Get all badges
    badges = await db.harvest_badges.find({}, {"_id": 0}).to_list(100)
    
    # Get already earned
    earned = await db.harvest_user_badges.find({"user_id": user_id}, {"badge_id": 1}).to_list(100)
    earned_ids = {e["badge_id"] for e in earned}
    
    for badge in badges:
        if badge["id"] in earned_ids:
            continue
        
        # Check criteria
        should_award = False
        
        if badge["criteria_type"] == "first_sign" and stats["total_signed"] >= 1:
            should_award = True
        elif badge["criteria_type"] == "doors_single_day" and stats["max_doors_day"] >= badge["criteria_value"]:
            should_award = True
        elif badge["criteria_type"] == "streak_days" and stats["current_streak"] >= badge["criteria_value"]:
            should_award = True
        elif badge["criteria_type"] == "total_signed" and stats["total_signed"] >= badge["criteria_value"]:
            should_award = True
        elif badge["criteria_type"] == "appointments_week" and stats["appointments_this_week"] >= badge["criteria_value"]:
            should_award = True
        elif badge["criteria_type"] == "doors_week" and stats["doors_this_week"] >= badge["criteria_value"]:
            should_award = True
        
        if should_award:
            await db.harvest_user_badges.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "badge_id": badge["id"],
                "earned_at": datetime.now(timezone.utc).isoformat()
            })
            newly_earned.append(badge)
    
    return {
        "newly_earned": newly_earned,
        "message": f"Awarded {len(newly_earned)} new badge(s)" if newly_earned else "No new badges earned"
    }


# ============================================
# Stats Endpoints
# ============================================

@router.get("/stats/user")
async def get_user_stats(
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed stats for a user"""
    target_id = user_id or current_user.get("id")
    stats = await get_user_harvest_stats(target_id)
    return stats


@router.get("/stats/team")
async def get_team_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get team-wide stats"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Today's stats
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "total_doors": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"}
        }}
    ]
    
    today_result = await db.canvassing_pins.aggregate(today_pipeline).to_list(1)
    
    # Active users (location updated in last 5 mins)
    cutoff = (now - timedelta(minutes=5)).isoformat()
    active_count = await db.canvassing_locations.count_documents({"timestamp": {"$gte": cutoff}})
    
    # Total team members
    total_users = await db.users.count_documents({"role": {"$in": ["admin", "manager", "adjuster"]}})
    
    return {
        "doors_today": today_result[0]["total_doors"] if today_result else 0,
        "active_users": active_count,
        "users_worked_today": len(today_result[0]["unique_users"]) if today_result else 0,
        "total_team_members": total_users
    }


# ============================================
# Helper Functions
# ============================================

def get_initials(name: str) -> str:
    """Get initials from a name"""
    if not name:
        return "??"
    parts = name.split()
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    return name[:2].upper()


async def calculate_user_streak(user_id: str) -> int:
    """Calculate consecutive days with activity"""
    now = datetime.now(timezone.utc)
    streak = 0
    
    for i in range(30):  # Check last 30 days max
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        count = await db.canvassing_pins.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        })
        
        if count > 0:
            streak += 1
        elif i > 0:  # Allow today to be empty
            break
    
    return streak


async def get_user_harvest_stats(user_id: str) -> dict:
    """Get comprehensive stats for a user"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # All-time stats
    all_time_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_doors": {"$sum": 1},
            "total_signed": {"$sum": {"$cond": [{"$eq": ["$disposition", "signed"]}, 1, 0]}},
            "total_appointments": {"$sum": {"$cond": [{"$eq": ["$disposition", "appointment"]}, 1, 0]}},
        }}
    ]
    
    all_time = await db.canvassing_pins.aggregate(all_time_pipeline).to_list(1)
    all_time = all_time[0] if all_time else {"total_doors": 0, "total_signed": 0, "total_appointments": 0}
    
    # This week stats
    week_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {
            "_id": None,
            "doors": {"$sum": 1},
            "signed": {"$sum": {"$cond": [{"$eq": ["$disposition", "signed"]}, 1, 0]}},
            "appointments": {"$sum": {"$cond": [{"$eq": ["$disposition", "appointment"]}, 1, 0]}},
        }}
    ]
    
    week_stats = await db.canvassing_pins.aggregate(week_pipeline).to_list(1)
    week_stats = week_stats[0] if week_stats else {"doors": 0, "signed": 0, "appointments": 0}
    
    # Max doors in single day
    max_day_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]
    
    max_day = await db.canvassing_pins.aggregate(max_day_pipeline).to_list(1)
    max_doors_day = max_day[0]["count"] if max_day else 0
    
    # Current streak
    streak = await calculate_user_streak(user_id)
    
    return {
        "user_id": user_id,
        "total_doors": all_time["total_doors"],
        "total_signed": all_time["total_signed"],
        "total_appointments": all_time["total_appointments"],
        "doors_this_week": week_stats["doors"],
        "signed_this_week": week_stats["signed"],
        "appointments_this_week": week_stats["appointments"],
        "max_doors_day": max_doors_day,
        "current_streak": streak,
        "conversion_rate": round((all_time["total_signed"] / all_time["total_doors"] * 100), 1) if all_time["total_doors"] > 0 else 0
    }
