"""
Harvest Rewards & Campaigns API Routes
Extended gamification system for incentives, rewards, and campaign management

Based on HARVEST_GAMIFICATION_SPEC.md
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from dependencies import db, get_current_active_user as get_current_user
from harvest_models.harvest_rewards import (
    Reward, RewardCreate, RewardUpdate, RewardCategory, RedemptionStatus,
    Campaign, CampaignCreate, CampaignUpdate, CampaignStatus, CampaignTemplate,
    GoalType, RewardType, RedemptionRequest, RedemptionAction,
    BadgeTier, ChallengeState
)

router = APIRouter(prefix="/api/harvest", tags=["Harvest Rewards & Campaigns"])


# ============================================
# REWARDS CATALOG
# ============================================

@router.get("/rewards")
async def get_rewards(
    category: Optional[str] = None,
    is_active: bool = True,
    featured_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all available rewards"""
    query = {}
    
    if is_active:
        query["is_active"] = True
    
    if category:
        query["category"] = category
    
    if featured_only:
        query["is_featured"] = True
    
    rewards = await db.harvest_rewards.find(
        query, {"_id": 0}
    ).sort("points_required", 1).to_list(100)
    
    # Get user's current points
    user_stats = await db.harvest_user_stats.find_one(
        {"user_id": current_user.get("id")},
        {"_id": 0, "total_points": 1}
    )
    user_points = user_stats.get("total_points", 0) if user_stats else 0
    
    # Mark which rewards user can afford
    for reward in rewards:
        reward["can_redeem"] = user_points >= reward["points_required"]
        reward["points_needed"] = max(0, reward["points_required"] - user_points)
    
    return {
        "rewards": rewards,
        "user_points": user_points,
        "categories": [c.value for c in RewardCategory]
    }


@router.get("/rewards/{reward_id}")
async def get_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific reward details"""
    reward = await db.harvest_rewards.find_one(
        {"id": reward_id}, {"_id": 0}
    )
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Get redemption count
    redemption_count = await db.harvest_redemptions.count_documents({
        "reward_id": reward_id,
        "status": {"$in": ["approved", "fulfilled"]}
    })
    
    reward["total_redeemed"] = redemption_count
    
    return reward


@router.post("/rewards")
async def create_reward(
    reward_data: RewardCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new reward (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    reward_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    reward_doc = {
        "id": reward_id,
        **reward_data.dict(),
        "is_active": True,
        "available_from": now,
        "available_until": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.harvest_rewards.insert_one(reward_doc)
    
    return {"id": reward_id, "message": "Reward created successfully"}


@router.patch("/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    update_data: RewardUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a reward"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.harvest_rewards.update_one(
        {"id": reward_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward updated"}


@router.delete("/rewards/{reward_id}")
async def archive_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive (soft delete) a reward"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    result = await db.harvest_rewards.update_one(
        {"id": reward_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward archived"}


# ============================================
# REWARD REDEMPTIONS
# ============================================

@router.post("/rewards/redeem")
async def redeem_reward(
    request: RedemptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Redeem a reward"""
    user_id = current_user.get("id")
    user_name = current_user.get("full_name", current_user.get("email", "Unknown"))
    
    # Get reward
    reward = await db.harvest_rewards.find_one(
        {"id": request.reward_id, "is_active": True},
        {"_id": 0}
    )
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found or inactive")
    
    # Check stock
    if reward.get("stock_quantity") is not None and reward["stock_quantity"] <= 0:
        raise HTTPException(status_code=400, detail="Reward is out of stock")
    
    # Get user points
    user_stats = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0, "total_points": 1}
    )
    user_points = user_stats.get("total_points", 0) if user_stats else 0
    
    if user_points < reward["points_required"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient points. Need {reward['points_required']}, have {user_points}"
        )
    
    # Create redemption
    redemption_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    redemption_doc = {
        "id": redemption_id,
        "user_id": user_id,
        "user_name": user_name,
        "reward_id": request.reward_id,
        "reward_name": reward["name"],
        "points_spent": reward["points_required"],
        "status": "pending",
        "requested_at": now
    }
    
    await db.harvest_redemptions.insert_one(redemption_doc)
    
    # Deduct points (they stay deducted until refund on denial)
    await db.harvest_user_stats.update_one(
        {"user_id": user_id},
        {"$inc": {"total_points": -reward["points_required"]}}
    )
    
    # Decrement stock if limited
    if reward.get("stock_quantity") is not None:
        await db.harvest_rewards.update_one(
            {"id": request.reward_id},
            {"$inc": {"stock_quantity": -1}}
        )
    
    return {
        "redemption_id": redemption_id,
        "reward_name": reward["name"],
        "points_spent": reward["points_required"],
        "status": "pending",
        "message": "Redemption request submitted. Awaiting approval."
    }


@router.get("/redemptions")
async def get_redemptions(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get redemption requests (admin sees all, users see their own)"""
    query = {}
    
    # Non-admin can only see their own
    if current_user.get("role") not in ["admin", "manager"]:
        query["user_id"] = current_user.get("id")
    elif user_id:
        query["user_id"] = user_id
    
    if status:
        query["status"] = status
    
    redemptions = await db.harvest_redemptions.find(
        query, {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    # Get counts by status
    pending_count = await db.harvest_redemptions.count_documents({"status": "pending"})
    approved_count = await db.harvest_redemptions.count_documents({"status": "approved"})
    fulfilled_count = await db.harvest_redemptions.count_documents({"status": "fulfilled"})
    
    return {
        "redemptions": redemptions,
        "counts": {
            "pending": pending_count,
            "approved": approved_count,
            "fulfilled": fulfilled_count
        }
    }


@router.patch("/redemptions/{redemption_id}")
async def process_redemption(
    redemption_id: str,
    action: RedemptionAction,
    current_user: dict = Depends(get_current_user)
):
    """Process a redemption request (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    redemption = await db.harvest_redemptions.find_one(
        {"id": redemption_id}, {"_id": 0}
    )
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    if redemption["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot modify {redemption['status']} redemption")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now}
    
    if action.action == "approve":
        update_data["status"] = "approved"
        update_data["approved_at"] = now
        update_data["approved_by"] = current_user.get("id")
    elif action.action == "deny":
        update_data["status"] = "denied"
        update_data["denial_reason"] = action.notes
        
        # Refund points
        await db.harvest_user_stats.update_one(
            {"user_id": redemption["user_id"]},
            {"$inc": {"total_points": redemption["points_spent"]}}
        )
        
        # Restore stock if applicable
        reward = await db.harvest_rewards.find_one({"id": redemption["reward_id"]})
        if reward and reward.get("stock_quantity") is not None:
            await db.harvest_rewards.update_one(
                {"id": redemption["reward_id"]},
                {"$inc": {"stock_quantity": 1}}
            )
    elif action.action == "fulfill":
        update_data["status"] = "fulfilled"
        update_data["fulfilled_at"] = now
        update_data["fulfillment_notes"] = action.notes
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.harvest_redemptions.update_one(
        {"id": redemption_id},
        {"$set": update_data}
    )
    
    return {"message": f"Redemption {action.action}d successfully"}


# ============================================
# CAMPAIGNS
# ============================================

@router.get("/campaigns")
async def get_campaigns(
    status: Optional[str] = None,
    include_past: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all campaigns"""
    now = datetime.now(timezone.utc).isoformat()
    query = {}
    
    if status:
        query["status"] = status
    elif not include_past:
        # By default show active + scheduled + recently completed (last 7 days)
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["$or"] = [
            {"status": {"$in": ["active", "scheduled", "draft"]}},
            {"end_date": {"$gte": week_ago}}
        ]
    
    campaigns = await db.harvest_campaigns.find(
        query, {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    
    user_id = current_user.get("id")
    
    # Enrich with user progress and stats
    enriched = []
    for camp in campaigns:
        # Calculate time remaining
        end_date = datetime.fromisoformat(camp["end_date"].replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        
        if now_dt < end_date:
            delta = end_date - now_dt
            if delta.days > 0:
                time_remaining = f"{delta.days}d {delta.seconds // 3600}h"
            else:
                time_remaining = f"{delta.seconds // 3600}h {(delta.seconds % 3600) // 60}m"
        else:
            time_remaining = "Ended"
        
        # Get user's progress
        progress = await get_campaign_progress_for_user(camp["id"], user_id)
        
        # Get participant count
        participant_count = await db.harvest_campaign_progress.count_documents({
            "campaign_id": camp["id"]
        })
        
        # Get leader
        leader = await db.harvest_campaign_progress.find_one(
            {"campaign_id": camp["id"]},
            {"_id": 0}
        )
        leader = await db.harvest_campaign_progress.find(
            {"campaign_id": camp["id"]}
        ).sort("current_value", -1).limit(1).to_list(1)
        
        leader_info = {"name": "No entries", "value": 0}
        if leader:
            leader_info = {"name": leader[0].get("user_name", "Unknown"), "value": leader[0].get("current_value", 0)}
        
        enriched.append({
            **camp,
            "time_remaining": time_remaining,
            "participant_count": participant_count,
            "my_progress": progress.get("current_value", 0) if progress else 0,
            "my_percent": progress.get("percent_complete", 0) if progress else 0,
            "leader": leader_info
        })
    
    return {"campaigns": enriched}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get campaign details with leaderboard"""
    campaign = await db.harvest_campaigns.find_one(
        {"id": campaign_id}, {"_id": 0}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get full leaderboard
    leaderboard = await db.harvest_campaign_progress.find(
        {"campaign_id": campaign_id},
        {"_id": 0}
    ).sort("current_value", -1).to_list(50)
    
    # Add ranks
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    # Get user's progress
    user_id = current_user.get("id")
    my_progress = await get_campaign_progress_for_user(campaign_id, user_id)
    
    # Get linked rewards
    rewards = []
    if campaign.get("reward_ids"):
        rewards = await db.harvest_rewards.find(
            {"id": {"$in": campaign["reward_ids"]}},
            {"_id": 0}
        ).to_list(10)
    
    return {
        **campaign,
        "leaderboard": leaderboard,
        "my_progress": my_progress,
        "rewards": rewards
    }


@router.post("/campaigns")
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new campaign (admin only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine initial status
    start_date = datetime.fromisoformat(campaign_data.start_date.replace("Z", "+00:00"))
    now_dt = datetime.now(timezone.utc)
    
    if start_date <= now_dt:
        status = "active"
    else:
        status = "scheduled"
    
    campaign_doc = {
        "id": campaign_id,
        **campaign_data.dict(),
        "status": status,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.harvest_campaigns.insert_one(campaign_doc)
    
    return {"id": campaign_id, "status": status, "message": "Campaign created successfully"}


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    update_data: CampaignUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a campaign"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.harvest_campaigns.update_one(
        {"id": campaign_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign updated"}


@router.post("/campaigns/{campaign_id}/end")
async def end_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End a campaign early"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.harvest_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "completed",
            "end_date": now,
            "updated_at": now
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Process winners/rewards based on reward_type
    await process_campaign_completion(campaign_id)
    
    return {"message": "Campaign ended"}


# ============================================
# CAMPAIGN TEMPLATES
# ============================================

@router.get("/campaigns/templates/list")
async def get_campaign_templates(
    current_user: dict = Depends(get_current_user)
):
    """Get available campaign templates"""
    templates = await db.harvest_campaign_templates.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(20)
    
    # If no templates, seed defaults
    if not templates:
        templates = await seed_campaign_templates()
    
    return {"templates": templates}


@router.post("/campaigns/from-template/{template_id}")
async def create_campaign_from_template(
    template_id: str,
    name: str = Query(...),
    start_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a campaign from a template"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    template = await db.harvest_campaign_templates.find_one(
        {"id": template_id}, {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Calculate end date
    start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    end_dt = start_dt + timedelta(days=template["duration_days"])
    
    campaign_data = CampaignCreate(
        name=name,
        description=template["description"],
        start_date=start_date,
        end_date=end_dt.isoformat(),
        goal_type=template["goal_type"],
        target_value=template["default_target"],
        reward_type=template["reward_type"],
        reward_ids=template.get("suggested_reward_ids", []),
        icon=template.get("icon", "🎯"),
        template_id=template_id
    )
    
    return await create_campaign(campaign_data, current_user)


# ============================================
# USER CHALLENGES
# ============================================

@router.get("/challenges")
async def get_user_challenges(
    include_completed: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's active challenges"""
    user_id = current_user.get("id")
    now = datetime.now(timezone.utc).isoformat()
    
    query = {"user_id": user_id}
    
    if not include_completed:
        query["state"] = {"$in": ["in_progress", "completed"]}  # Not claimed/expired
        query["end_time"] = {"$gte": now}  # Not expired
    
    challenges = await db.harvest_challenges.find(
        query, {"_id": 0}
    ).sort("end_time", 1).to_list(20)
    
    # Update time remaining
    now_dt = datetime.now(timezone.utc)
    for ch in challenges:
        end_dt = datetime.fromisoformat(ch["end_time"].replace("Z", "+00:00"))
        if end_dt > now_dt:
            delta = end_dt - now_dt
            if delta.days > 0:
                ch["time_remaining_display"] = f"{delta.days}d {delta.seconds // 3600}h"
            elif delta.seconds > 3600:
                ch["time_remaining_display"] = f"{delta.seconds // 3600}h {(delta.seconds % 3600) // 60}m"
            else:
                ch["time_remaining_display"] = f"{delta.seconds // 60}m"
        else:
            ch["time_remaining_display"] = "Ended"
    
    return {"challenges": challenges}


@router.post("/challenges/{challenge_id}/claim")
async def claim_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Claim a completed challenge reward"""
    user_id = current_user.get("id")
    
    challenge = await db.harvest_challenges.find_one(
        {"id": challenge_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if challenge["state"] != "completed":
        raise HTTPException(status_code=400, detail=f"Challenge is {challenge['state']}, not completed")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update challenge
    await db.harvest_challenges.update_one(
        {"id": challenge_id},
        {"$set": {
            "state": "claimed",
            "claimed_at": now
        }}
    )
    
    # Award points
    if challenge.get("points_reward", 0) > 0:
        await db.harvest_user_stats.update_one(
            {"user_id": user_id},
            {"$inc": {"total_points": challenge["points_reward"]}}
        )
        
        # Record score event
        await db.harvest_score_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "event_type": "challenge_complete",
            "base_points": challenge["points_reward"],
            "multiplier": 1.0,
            "final_points": challenge["points_reward"],
            "metadata": {"challenge_id": challenge_id, "challenge_name": challenge["name"]},
            "timestamp": now,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        })
    
    return {
        "message": "Challenge reward claimed!",
        "points_earned": challenge.get("points_reward", 0)
    }


@router.post("/challenges/seed")
async def seed_test_challenges(
    current_user: dict = Depends(get_current_user)
):
    """Seed test challenges for the current user (development only)"""
    user_id = current_user.get("id")
    user_name = current_user.get("full_name", current_user.get("email", "Unknown"))
    now = datetime.now(timezone.utc)
    
    # Get user's current stats
    user_stats = await db.harvest_stats_daily.find_one(
        {"user_id": user_id, "date": now.strftime("%Y-%m-%d")},
        {"_id": 0}
    )
    doors_today = user_stats.get("doors", 0) if user_stats else 0
    
    # Sample challenges
    test_challenges = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "campaign_id": None,
            "name": "Daily Door Sprint",
            "description": "Knock 25 doors today to earn bonus points",
            "icon": "🏃",
            "requirement_type": "doors_today",
            "requirement_value": 25,
            "current_progress": doors_today,
            "start_time": now.isoformat(),
            "end_time": (now.replace(hour=23, minute=59, second=59)).isoformat(),
            "points_reward": 50,
            "state": "completed" if doors_today >= 25 else "in_progress",
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "campaign_id": None,
            "name": "Early Bird Special",
            "description": "Log 10 doors before noon",
            "icon": "🌅",
            "requirement_type": "doors_morning",
            "requirement_value": 10,
            "current_progress": min(doors_today, 10),
            "start_time": now.isoformat(),
            "end_time": (now.replace(hour=12, minute=0, second=0)).isoformat(),
            "points_reward": 30,
            "state": "in_progress",
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "campaign_id": None,
            "name": "Appointment Ace",
            "description": "Set 3 appointments today",
            "icon": "📅",
            "requirement_type": "appointments_today",
            "requirement_value": 3,
            "current_progress": 1,
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(days=1)).isoformat(),
            "points_reward": 75,
            "state": "in_progress",
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "campaign_id": None,
            "name": "Weekend Warrior",
            "description": "Complete 100 doors this weekend",
            "icon": "💪",
            "requirement_type": "doors_weekend",
            "requirement_value": 100,
            "current_progress": 45,
            "start_time": now.isoformat(),
            "end_time": (now + timedelta(days=2)).isoformat(),
            "points_reward": 150,
            "state": "in_progress",
            "created_at": now.isoformat()
        }
    ]
    
    # Clear existing test challenges
    await db.harvest_challenges.delete_many({"user_id": user_id})
    
    # Insert new challenges
    for challenge in test_challenges:
        await db.harvest_challenges.insert_one(challenge)
    
    return {
        "message": f"Seeded {len(test_challenges)} test challenges",
        "challenges": [{"id": c["id"], "name": c["name"], "state": c["state"]} for c in test_challenges]
    }


# ============================================
# PROGRESS TRACKING
# ============================================

@router.get("/progress/rewards")
async def get_reward_progress(
    current_user: dict = Depends(get_current_user)
):
    """Get user's progress toward rewards"""
    user_id = current_user.get("id")
    
    # Get user points
    user_stats = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0, "total_points": 1}
    )
    user_points = user_stats.get("total_points", 0) if user_stats else 0
    
    # Get active rewards sorted by closest to affording
    rewards = await db.harvest_rewards.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("points_required", 1).to_list(20)
    
    progress = []
    next_reward = None
    
    for reward in rewards:
        pts_needed = reward["points_required"] - user_points
        percent = min(100, round(user_points / reward["points_required"] * 100, 1))
        
        item = {
            "reward_id": reward["id"],
            "name": reward["name"],
            "image_url": reward.get("image_url"),
            "points_required": reward["points_required"],
            "points_remaining": max(0, pts_needed),
            "percent_complete": percent,
            "can_redeem": pts_needed <= 0
        }
        progress.append(item)
        
        # Track the next achievable reward
        if next_reward is None and pts_needed > 0:
            next_reward = item
    
    return {
        "current_points": user_points,
        "rewards_progress": progress,
        "next_reward": next_reward
    }


# ============================================
# STREAK ENDPOINTS
# ============================================

@router.get("/streak")
async def get_user_streak(
    current_user: dict = Depends(get_current_user)
):
    """Get user's current streak status"""
    user_id = current_user.get("id")
    
    # Calculate streak from daily stats
    today = datetime.now(timezone.utc)
    streak = 0
    best_streak = 0
    streak_start = None
    
    for i in range(365):  # Check up to a year back
        check_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        
        day_stats = await db.harvest_stats_daily.find_one({
            "user_id": user_id,
            "date": check_date,
            "doors": {"$gte": 10}  # Min 10 doors to count
        })
        
        if day_stats:
            if i == 0 or streak > 0:  # Today or continuing streak
                streak += 1
                if streak_start is None:
                    streak_start = check_date
        elif i > 0:  # Allow today to be incomplete
            break
    
    # Get best streak from user stats
    user_stats = await db.harvest_user_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    best_streak = user_stats.get("best_streak", streak) if user_stats else streak
    
    # Update best streak if current is higher
    if streak > best_streak:
        best_streak = streak
        await db.harvest_user_stats.update_one(
            {"user_id": user_id},
            {"$set": {"best_streak": streak}},
            upsert=True
        )
    
    # Check if at risk (no activity today after 3 PM)
    now_hour = datetime.now(timezone.utc).hour
    today_str = today.strftime("%Y-%m-%d")
    today_stats = await db.harvest_stats_daily.find_one({
        "user_id": user_id,
        "date": today_str
    })
    
    has_activity_today = today_stats and today_stats.get("doors", 0) >= 10
    is_at_risk = not has_activity_today and now_hour >= 15  # 3 PM UTC
    is_critical = not has_activity_today and now_hour >= 17  # 5 PM UTC
    
    # Calculate multiplier
    multiplier = 1.0
    if streak >= 30:
        multiplier = 2.0
    elif streak >= 10:
        multiplier = 1.5
    elif streak >= 5:
        multiplier = 1.25
    elif streak >= 3:
        multiplier = 1.1
    
    return {
        "current_streak": streak,
        "best_streak": best_streak,
        "multiplier": multiplier,
        "streak_start_date": streak_start,
        "has_activity_today": has_activity_today,
        "is_at_risk": is_at_risk,
        "is_critical": is_critical,
        "doors_today": today_stats.get("doors", 0) if today_stats else 0,
        "minimum_doors_required": 10
    }


# ============================================
# HELPER FUNCTIONS
# ============================================

async def get_campaign_progress_for_user(campaign_id: str, user_id: str) -> dict:
    """Get a user's progress in a specific campaign"""
    progress = await db.harvest_campaign_progress.find_one(
        {"campaign_id": campaign_id, "user_id": user_id},
        {"_id": 0}
    )
    return progress or {}


async def process_campaign_completion(campaign_id: str):
    """Process campaign completion - determine winners and award rewards"""
    campaign = await db.harvest_campaigns.find_one(
        {"id": campaign_id}, {"_id": 0}
    )
    
    if not campaign:
        return
    
    reward_type = campaign.get("reward_type", "threshold")
    
    # Get all progress entries sorted by value
    progress_list = await db.harvest_campaign_progress.find(
        {"campaign_id": campaign_id}
    ).sort("current_value", -1).to_list(1000)
    
    winners = []
    
    if reward_type == "top_performers":
        # Top N win
        top_n = campaign.get("top_n", 3)
        winners = progress_list[:top_n]
    elif reward_type == "threshold":
        # Anyone who hit threshold
        threshold = campaign.get("threshold_value") or campaign.get("target_value", 0)
        winners = [p for p in progress_list if p.get("current_value", 0) >= threshold]
    elif reward_type == "lottery":
        # Random draw from qualifiers (not implemented - would need random selection)
        threshold = campaign.get("threshold_value", 1)
        qualifiers = [p for p in progress_list if p.get("current_value", 0) >= threshold]
        if qualifiers:
            import random
            winners = [random.choice(qualifiers)]
    
    # Mark winners and create notifications
    for i, winner in enumerate(winners):
        await db.harvest_campaign_progress.update_one(
            {"id": winner["id"]},
            {"$set": {
                "is_winner": True,
                "rank": i + 1
            }}
        )
        
        # TODO: Create notification for winner
        # TODO: Auto-create reward redemption if applicable


async def seed_campaign_templates() -> list:
    """Seed default campaign templates"""
    templates = [
        {
            "id": "template-weekly-blitz",
            "name": "Weekly Blitz",
            "description": "Push door volume with guaranteed reward for hitting target. Perfect for week-long sprints.",
            "duration_days": 7,
            "goal_type": "doors",
            "default_target": 150,
            "reward_type": "threshold",
            "icon": "⚡",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "template-season-ladder",
            "name": "Season Long Ladder",
            "description": "Quarter-long competition with tiered prizes for top performers. Build momentum over 90 days.",
            "duration_days": 90,
            "goal_type": "points",
            "default_target": 10000,
            "reward_type": "top_performers",
            "icon": "🏆",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "template-new-rep-sprint",
            "name": "New Rep Sprint",
            "description": "Onboarding challenge for new hires. First 14 days, focus on appointments.",
            "duration_days": 14,
            "goal_type": "appointments",
            "default_target": 20,
            "reward_type": "threshold",
            "icon": "🌟",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "template-storm-response",
            "name": "Storm Response",
            "description": "Rapid deployment after weather event. Short burst, contract-focused.",
            "duration_days": 5,
            "goal_type": "contracts",
            "default_target": 3,
            "reward_type": "top_performers",
            "icon": "🌪️",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "template-team-battle",
            "name": "Team Battle",
            "description": "Team vs team competition. Aggregate team doors over 30 days.",
            "duration_days": 30,
            "goal_type": "doors",
            "default_target": 1000,
            "reward_type": "top_performers",
            "icon": "⚔️",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for template in templates:
        await db.harvest_campaign_templates.update_one(
            {"id": template["id"]},
            {"$set": template},
            upsert=True
        )
    
    return templates


# ============================================
# BADGE TIER SYSTEM (Extended)
# ============================================

@router.get("/badges/tiers")
async def get_badges_by_tier(
    current_user: dict = Depends(get_current_user)
):
    """Get all badges organized by tier"""
    user_id = current_user.get("id")
    
    # Get all badges
    badges = await db.harvest_badges.find({}, {"_id": 0}).to_list(100)
    
    # Get user's earned badges
    earned = await db.harvest_user_badges.find(
        {"user_id": user_id},
        {"_id": 0, "badge_id": 1, "earned_at": 1}
    ).to_list(100)
    earned_map = {e["badge_id"]: e["earned_at"] for e in earned}
    
    # Organize by tier
    by_tier = {
        "common": [],
        "rare": [],
        "epic": [],
        "legendary": []
    }
    
    for badge in badges:
        tier = badge.get("rarity", badge.get("tier", "common"))
        is_earned = badge["id"] in earned_map
        badge_data = {
            **badge,
            "earned": is_earned,
            "earned_at": earned_map.get(badge["id"])
        }
        
        if tier in by_tier:
            by_tier[tier].append(badge_data)
        else:
            by_tier["common"].append(badge_data)
    
    # Count stats
    total = len(badges)
    earned_count = len(earned)
    
    return {
        "badges_by_tier": by_tier,
        "earned_count": earned_count,
        "total_count": total,
        "tier_counts": {tier: len(badges_list) for tier, badges_list in by_tier.items()}
    }
