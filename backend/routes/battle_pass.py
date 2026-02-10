"""
Eden Battle Pass System - Progression & Rewards
Gamified progression system inspired by Fortnite/COD battle passes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/battle-pass", tags=["Battle Pass"])


# ============================================
# Models
# ============================================

class BattlePassTier(BaseModel):
    tier: int
    xp_required: int
    reward_type: str  # badge, title, bonus_multiplier, cosmetic
    reward_id: str
    reward_name: str
    reward_description: str
    rarity: str = "common"  # common, uncommon, rare, epic, legendary, mythic
    is_premium: bool = False


class UserProgress(BaseModel):
    user_id: str
    season_id: str
    current_xp: int = 0
    current_tier: int = 1
    is_premium: bool = False
    claimed_rewards: List[int] = []
    daily_missions_completed: List[str] = []
    weekly_missions_completed: List[str] = []


class Mission(BaseModel):
    id: str
    name: str
    description: str
    mission_type: str  # daily, weekly, seasonal
    action_type: str  # doors_knocked, appointments_set, contracts_signed, inspections_completed, photos_taken
    target_value: int
    xp_reward: int
    rarity: str = "common"


# ============================================
# Default Battle Pass Configuration
# ============================================

CURRENT_SEASON = {
    "id": "season_1",
    "name": "Season 1: Field Commander",
    "start_date": "2025-02-01",
    "end_date": "2025-04-30",
    "max_tier": 50,
    "xp_per_tier": 1000,
}

# Default tiers - progressing from common to mythic rewards
DEFAULT_TIERS = [
    # Tier 1-10: Common rewards
    {"tier": 1, "xp_required": 0, "reward_type": "badge", "reward_id": "recruit", "reward_name": "Recruit", "reward_description": "Welcome to Eden Tactical Ops", "rarity": "common"},
    {"tier": 2, "xp_required": 1000, "reward_type": "title", "reward_id": "field_agent", "reward_name": "Field Agent", "reward_description": "Display title: Field Agent", "rarity": "common"},
    {"tier": 3, "xp_required": 2000, "reward_type": "bonus_multiplier", "reward_id": "xp_boost_5", "reward_name": "XP Boost 5%", "reward_description": "+5% XP on all activities", "rarity": "common"},
    {"tier": 4, "xp_required": 3000, "reward_type": "badge", "reward_id": "door_buster", "reward_name": "Door Buster", "reward_description": "Knocked 100 doors", "rarity": "common"},
    {"tier": 5, "xp_required": 4000, "reward_type": "cosmetic", "reward_id": "avatar_frame_bronze", "reward_name": "Bronze Frame", "reward_description": "Bronze avatar frame", "rarity": "common"},
    
    # Tier 6-15: Uncommon rewards
    {"tier": 6, "xp_required": 5000, "reward_type": "badge", "reward_id": "first_blood", "reward_name": "First Blood", "reward_description": "First signed contract", "rarity": "uncommon"},
    {"tier": 7, "xp_required": 6000, "reward_type": "title", "reward_id": "specialist", "reward_name": "Specialist", "reward_description": "Display title: Specialist", "rarity": "uncommon"},
    {"tier": 8, "xp_required": 7000, "reward_type": "bonus_multiplier", "reward_id": "xp_boost_10", "reward_name": "XP Boost 10%", "reward_description": "+10% XP on all activities", "rarity": "uncommon"},
    {"tier": 9, "xp_required": 8000, "reward_type": "badge", "reward_id": "appointment_setter", "reward_name": "Appointment Setter", "reward_description": "Set 25 appointments", "rarity": "uncommon"},
    {"tier": 10, "xp_required": 9000, "reward_type": "cosmetic", "reward_id": "avatar_frame_silver", "reward_name": "Silver Frame", "reward_description": "Silver avatar frame", "rarity": "uncommon"},
    
    # Tier 11-20: Rare rewards
    {"tier": 11, "xp_required": 10000, "reward_type": "badge", "reward_id": "hot_streak", "reward_name": "Hot Streak", "reward_description": "5-day activity streak", "rarity": "rare"},
    {"tier": 12, "xp_required": 11000, "reward_type": "title", "reward_id": "veteran", "reward_name": "Veteran", "reward_description": "Display title: Veteran", "rarity": "rare"},
    {"tier": 13, "xp_required": 12000, "reward_type": "bonus_multiplier", "reward_id": "commission_boost_2", "reward_name": "Commission Boost 2%", "reward_description": "+2% commission bonus", "rarity": "rare"},
    {"tier": 14, "xp_required": 13000, "reward_type": "badge", "reward_id": "closer", "reward_name": "Closer", "reward_description": "Signed 10 contracts", "rarity": "rare"},
    {"tier": 15, "xp_required": 14000, "reward_type": "cosmetic", "reward_id": "avatar_frame_gold", "reward_name": "Gold Frame", "reward_description": "Gold avatar frame", "rarity": "rare"},
    
    # Tier 16-25: Rare+ rewards
    {"tier": 16, "xp_required": 15000, "reward_type": "badge", "reward_id": "recon_expert", "reward_name": "Recon Expert", "reward_description": "Completed 50 inspections", "rarity": "rare"},
    {"tier": 17, "xp_required": 16500, "reward_type": "title", "reward_id": "elite", "reward_name": "Elite", "reward_description": "Display title: Elite", "rarity": "rare"},
    {"tier": 18, "xp_required": 18000, "reward_type": "bonus_multiplier", "reward_id": "xp_boost_15", "reward_name": "XP Boost 15%", "reward_description": "+15% XP on all activities", "rarity": "rare"},
    {"tier": 19, "xp_required": 19500, "reward_type": "badge", "reward_id": "photo_master", "reward_name": "Photo Master", "reward_description": "Captured 500 inspection photos", "rarity": "rare"},
    {"tier": 20, "xp_required": 21000, "reward_type": "cosmetic", "reward_id": "avatar_frame_platinum", "reward_name": "Platinum Frame", "reward_description": "Platinum avatar frame", "rarity": "rare"},
    
    # Tier 21-35: Epic rewards
    {"tier": 21, "xp_required": 22500, "reward_type": "badge", "reward_id": "territory_commander", "reward_name": "Territory Commander", "reward_description": "Dominated a territory for a week", "rarity": "epic"},
    {"tier": 25, "xp_required": 27000, "reward_type": "title", "reward_id": "commander", "reward_name": "Commander", "reward_description": "Display title: Commander", "rarity": "epic"},
    {"tier": 30, "xp_required": 33000, "reward_type": "bonus_multiplier", "reward_id": "commission_boost_5", "reward_name": "Commission Boost 5%", "reward_description": "+5% commission bonus", "rarity": "epic"},
    {"tier": 35, "xp_required": 39000, "reward_type": "badge", "reward_id": "apex_closer", "reward_name": "Apex Closer", "reward_description": "Signed 50 contracts", "rarity": "epic"},
    
    # Tier 36-45: Legendary rewards
    {"tier": 40, "xp_required": 45000, "reward_type": "badge", "reward_id": "legend", "reward_name": "Legend", "reward_description": "Top 3 on monthly leaderboard", "rarity": "legendary"},
    {"tier": 45, "xp_required": 51000, "reward_type": "title", "reward_id": "legendary", "reward_name": "Legendary", "reward_description": "Display title: Legendary", "rarity": "legendary"},
    
    # Tier 50: Mythic reward
    {"tier": 50, "xp_required": 60000, "reward_type": "badge", "reward_id": "field_marshal", "reward_name": "Field Marshal", "reward_description": "Mastered Season 1", "rarity": "mythic"},
]

# Daily missions
DEFAULT_DAILY_MISSIONS = [
    {"id": "daily_doors_50", "name": "Door Patrol", "description": "Knock 50 doors", "mission_type": "daily", "action_type": "doors_knocked", "target_value": 50, "xp_reward": 200, "rarity": "common"},
    {"id": "daily_doors_100", "name": "Door Marathon", "description": "Knock 100 doors", "mission_type": "daily", "action_type": "doors_knocked", "target_value": 100, "xp_reward": 400, "rarity": "uncommon"},
    {"id": "daily_appointments_3", "name": "Schedule Master", "description": "Set 3 appointments", "mission_type": "daily", "action_type": "appointments_set", "target_value": 3, "xp_reward": 300, "rarity": "uncommon"},
    {"id": "daily_photos_10", "name": "Recon Duty", "description": "Take 10 inspection photos", "mission_type": "daily", "action_type": "photos_taken", "target_value": 10, "xp_reward": 150, "rarity": "common"},
    {"id": "daily_inspection_1", "name": "Field Work", "description": "Complete 1 inspection", "mission_type": "daily", "action_type": "inspections_completed", "target_value": 1, "xp_reward": 250, "rarity": "common"},
]

# Weekly missions
DEFAULT_WEEKLY_MISSIONS = [
    {"id": "weekly_doors_500", "name": "Territory Sweep", "description": "Knock 500 doors this week", "mission_type": "weekly", "action_type": "doors_knocked", "target_value": 500, "xp_reward": 1500, "rarity": "rare"},
    {"id": "weekly_appointments_15", "name": "Calendar Stacker", "description": "Set 15 appointments this week", "mission_type": "weekly", "action_type": "appointments_set", "target_value": 15, "xp_reward": 1200, "rarity": "rare"},
    {"id": "weekly_signed_3", "name": "Closing Week", "description": "Sign 3 contracts this week", "mission_type": "weekly", "action_type": "contracts_signed", "target_value": 3, "xp_reward": 2000, "rarity": "epic"},
    {"id": "weekly_inspections_5", "name": "Recon Week", "description": "Complete 5 inspections this week", "mission_type": "weekly", "action_type": "inspections_completed", "target_value": 5, "xp_reward": 1000, "rarity": "uncommon"},
    {"id": "weekly_streak_5", "name": "Consistency", "description": "Maintain 5-day activity streak", "mission_type": "weekly", "action_type": "streak_days", "target_value": 5, "xp_reward": 800, "rarity": "uncommon"},
]


# ============================================
# XP Award Amounts
# ============================================

XP_AWARDS = {
    "door_knocked": 5,
    "appointment_set": 50,
    "contract_signed": 200,
    "inspection_completed": 75,
    "photo_taken": 2,
    "claim_created": 25,
    "document_uploaded": 10,
    "daily_login": 25,
    "daily_mission_complete": 0,  # XP is in mission definition
    "weekly_mission_complete": 0,  # XP is in mission definition
}


# ============================================
# Helper Functions
# ============================================

def calculate_tier_from_xp(xp: int) -> int:
    """Calculate current tier based on XP"""
    for tier in reversed(DEFAULT_TIERS):
        if xp >= tier["xp_required"]:
            return tier["tier"]
    return 1


def get_tier_info(tier: int) -> dict:
    """Get tier information"""
    for t in DEFAULT_TIERS:
        if t["tier"] == tier:
            return t
    return DEFAULT_TIERS[0]


def get_next_tier_xp(current_tier: int) -> int:
    """Get XP required for next tier"""
    for t in DEFAULT_TIERS:
        if t["tier"] > current_tier:
            return t["xp_required"]
    return DEFAULT_TIERS[-1]["xp_required"]


# ============================================
# Endpoints
# ============================================

@router.get("/season")
async def get_current_season():
    """Get current battle pass season info"""
    return {
        "season": CURRENT_SEASON,
        "tiers": DEFAULT_TIERS,
        "total_tiers": CURRENT_SEASON["max_tier"],
    }


@router.get("/progress")
async def get_user_progress(current_user: dict = Depends(get_current_user)):
    """Get current user's battle pass progress"""
    user_id = current_user.get("id") or current_user.get("email")
    
    # Get or create user progress
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"_id": 0}
    )
    
    if not progress:
        # Create new progress
        progress = {
            "user_id": user_id,
            "season_id": CURRENT_SEASON["id"],
            "current_xp": 0,
            "current_tier": 1,
            "is_premium": False,
            "claimed_rewards": [],
            "daily_missions_completed": [],
            "weekly_missions_completed": [],
            "streak_days": 0,
            "last_activity_date": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.battle_pass_progress.insert_one(progress)
        progress.pop("_id", None)
    
    # Calculate progress details
    current_tier_info = get_tier_info(progress.get("current_tier", 1))
    next_tier_xp = get_next_tier_xp(progress.get("current_tier", 1))
    current_tier_xp = current_tier_info.get("xp_required", 0)
    
    xp_in_tier = progress.get("current_xp", 0) - current_tier_xp
    xp_needed = next_tier_xp - current_tier_xp
    tier_progress = (xp_in_tier / xp_needed * 100) if xp_needed > 0 else 100
    
    return {
        **progress,
        "current_tier_info": current_tier_info,
        "next_tier_xp": next_tier_xp,
        "xp_in_tier": max(0, xp_in_tier),
        "xp_needed_for_next": xp_needed,
        "tier_progress_percent": min(100, max(0, tier_progress)),
        "season": CURRENT_SEASON,
    }


@router.get("/missions")
async def get_missions(current_user: dict = Depends(get_current_user)):
    """Get available daily and weekly missions with user progress"""
    user_id = current_user.get("id") or current_user.get("email")
    
    # Get user progress
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"_id": 0}
    )
    
    completed_daily = progress.get("daily_missions_completed", []) if progress else []
    completed_weekly = progress.get("weekly_missions_completed", []) if progress else []
    
    # Get mission progress from activity tracking
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    
    # Aggregate today's activities
    daily_stats = await db.battle_pass_activities.aggregate([
        {"$match": {"user_id": user_id, "timestamp": {"$gte": today.isoformat()}}},
        {"$group": {
            "_id": "$action_type",
            "count": {"$sum": "$count"}
        }}
    ]).to_list(20)
    daily_progress = {s["_id"]: s["count"] for s in daily_stats}
    
    # Aggregate this week's activities
    weekly_stats = await db.battle_pass_activities.aggregate([
        {"$match": {"user_id": user_id, "timestamp": {"$gte": week_start.isoformat()}}},
        {"$group": {
            "_id": "$action_type",
            "count": {"$sum": "$count"}
        }}
    ]).to_list(20)
    weekly_progress = {s["_id"]: s["count"] for s in weekly_stats}
    
    # Build mission list with progress
    daily_missions = []
    for mission in DEFAULT_DAILY_MISSIONS:
        current_progress = daily_progress.get(mission["action_type"], 0)
        daily_missions.append({
            **mission,
            "current_progress": min(current_progress, mission["target_value"]),
            "is_completed": mission["id"] in completed_daily,
            "progress_percent": min(100, current_progress / mission["target_value"] * 100) if mission["target_value"] > 0 else 0,
        })
    
    weekly_missions = []
    for mission in DEFAULT_WEEKLY_MISSIONS:
        current_progress = weekly_progress.get(mission["action_type"], 0)
        weekly_missions.append({
            **mission,
            "current_progress": min(current_progress, mission["target_value"]),
            "is_completed": mission["id"] in completed_weekly,
            "progress_percent": min(100, current_progress / mission["target_value"] * 100) if mission["target_value"] > 0 else 0,
        })
    
    return {
        "daily_missions": daily_missions,
        "weekly_missions": weekly_missions,
        "daily_reset": today.isoformat(),
        "weekly_reset": week_start.isoformat(),
    }


@router.post("/xp/award")
async def award_xp(
    action_type: str,
    count: int = 1,
    current_user: dict = Depends(get_current_user)
):
    """Award XP for an action (internal use - called by other routes)"""
    user_id = current_user.get("id") or current_user.get("email")
    
    xp_amount = XP_AWARDS.get(action_type, 0) * count
    if xp_amount == 0:
        return {"xp_awarded": 0, "message": "Unknown action type"}
    
    # Get current progress
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]}
    )
    
    if not progress:
        # Create new progress
        progress = {
            "user_id": user_id,
            "season_id": CURRENT_SEASON["id"],
            "current_xp": 0,
            "current_tier": 1,
            "is_premium": False,
            "claimed_rewards": [],
            "daily_missions_completed": [],
            "weekly_missions_completed": [],
            "streak_days": 0,
            "last_activity_date": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.battle_pass_progress.insert_one(progress)
    
    # Apply any XP boosts
    # TODO: Check for active XP boost rewards
    
    new_xp = progress.get("current_xp", 0) + xp_amount
    new_tier = calculate_tier_from_xp(new_xp)
    old_tier = progress.get("current_tier", 1)
    
    # Update progress
    await db.battle_pass_progress.update_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"$set": {
            "current_xp": new_xp,
            "current_tier": new_tier,
            "last_activity_date": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Track activity for mission progress
    await db.battle_pass_activities.insert_one({
        "user_id": user_id,
        "action_type": action_type,
        "count": count,
        "xp_awarded": xp_amount,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    # Check for tier up
    tier_up = new_tier > old_tier
    new_rewards = []
    if tier_up:
        # Get all tiers between old and new
        for tier in DEFAULT_TIERS:
            if old_tier < tier["tier"] <= new_tier:
                new_rewards.append(tier)
    
    return {
        "xp_awarded": xp_amount,
        "total_xp": new_xp,
        "current_tier": new_tier,
        "tier_up": tier_up,
        "new_rewards": new_rewards,
        "action_type": action_type,
    }


@router.post("/rewards/{tier}/claim")
async def claim_reward(tier: int, current_user: dict = Depends(get_current_user)):
    """Claim a reward for a completed tier"""
    user_id = current_user.get("id") or current_user.get("email")
    
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]}
    )
    
    if not progress:
        raise HTTPException(status_code=404, detail="Progress not found")
    
    if progress.get("current_tier", 1) < tier:
        raise HTTPException(status_code=400, detail="Tier not yet reached")
    
    if tier in progress.get("claimed_rewards", []):
        raise HTTPException(status_code=400, detail="Reward already claimed")
    
    tier_info = get_tier_info(tier)
    if not tier_info:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Check if premium tier and user is premium
    if tier_info.get("is_premium") and not progress.get("is_premium"):
        raise HTTPException(status_code=400, detail="Premium pass required for this reward")
    
    # Claim the reward
    await db.battle_pass_progress.update_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"$push": {"claimed_rewards": tier}}
    )
    
    # Add reward to user's inventory
    await db.user_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "reward_type": tier_info["reward_type"],
        "reward_id": tier_info["reward_id"],
        "reward_name": tier_info["reward_name"],
        "rarity": tier_info["rarity"],
        "tier": tier,
        "season_id": CURRENT_SEASON["id"],
        "claimed_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "message": "Reward claimed successfully",
        "reward": tier_info,
    }


@router.post("/missions/{mission_id}/complete")
async def complete_mission(mission_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a mission as complete and award XP"""
    user_id = current_user.get("id") or current_user.get("email")
    
    # Find mission
    mission = None
    for m in DEFAULT_DAILY_MISSIONS + DEFAULT_WEEKLY_MISSIONS:
        if m["id"] == mission_id:
            mission = m
            break
    
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    # Check if already completed
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]}
    )
    
    if mission["mission_type"] == "daily":
        completed_list = progress.get("daily_missions_completed", []) if progress else []
        field = "daily_missions_completed"
    else:
        completed_list = progress.get("weekly_missions_completed", []) if progress else []
        field = "weekly_missions_completed"
    
    if mission_id in completed_list:
        raise HTTPException(status_code=400, detail="Mission already completed")
    
    # Mark as complete
    await db.battle_pass_progress.update_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"$push": {field: mission_id}},
        upsert=True
    )
    
    # Award XP
    result = await award_xp(
        action_type=f"{mission['mission_type']}_mission_complete",
        count=1,
        current_user=current_user
    )
    
    # Add mission XP
    new_xp = (progress.get("current_xp", 0) if progress else 0) + mission["xp_reward"]
    new_tier = calculate_tier_from_xp(new_xp)
    
    await db.battle_pass_progress.update_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON["id"]},
        {"$set": {"current_xp": new_xp, "current_tier": new_tier}}
    )
    
    return {
        "message": "Mission completed!",
        "mission": mission,
        "xp_awarded": mission["xp_reward"],
        "total_xp": new_xp,
        "current_tier": new_tier,
    }


@router.get("/rewards/inventory")
async def get_user_rewards(current_user: dict = Depends(get_current_user)):
    """Get all rewards the user has claimed"""
    user_id = current_user.get("id") or current_user.get("email")
    
    rewards = await db.user_rewards.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("claimed_at", -1).to_list(100)
    
    # Group by type
    by_type = {}
    for reward in rewards:
        rtype = reward.get("reward_type", "other")
        if rtype not in by_type:
            by_type[rtype] = []
        by_type[rtype].append(reward)
    
    return {
        "rewards": rewards,
        "by_type": by_type,
        "total_count": len(rewards),
    }


@router.get("/leaderboard")
async def get_xp_leaderboard(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get XP leaderboard for current season"""
    
    pipeline = [
        {"$match": {"season_id": CURRENT_SEASON["id"]}},
        {"$sort": {"current_xp": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0, "user_id": 1, "current_xp": 1, "current_tier": 1}}
    ]
    
    leaders = await db.battle_pass_progress.aggregate(pipeline).to_list(limit)
    
    # Enrich with user names
    for i, leader in enumerate(leaders):
        user = await db.users.find_one({"id": leader["user_id"]}, {"full_name": 1, "email": 1})
        if user:
            leader["user_name"] = user.get("full_name") or user.get("email", "Unknown")
        else:
            leader["user_name"] = leader["user_id"][:8] + "..."
        leader["rank"] = i + 1
        leader["tier_info"] = get_tier_info(leader.get("current_tier", 1))
    
    return {
        "leaderboard": leaders,
        "season": CURRENT_SEASON,
    }
