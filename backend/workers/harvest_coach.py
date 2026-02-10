"""
Harvest Coach Bot Worker
Background worker that generates coaching notifications for Harvest users.

Runs on schedule:
- Hourly: Streak nudges, competition position alerts, daily goal progress nudges
- Nightly (10 PM): Daily highlights summary

Uses the shared notifications system to deliver messages.
Now supports configurable daily goals from company_settings.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Store database reference
_db: Optional[AsyncIOMotorDatabase] = None


def init_harvest_coach(db: AsyncIOMotorDatabase):
    """Initialize the worker with database connection"""
    global _db
    _db = db
    logger.info("Harvest Coach Bot initialized")


def _is_db_initialized() -> bool:
    """Check if database is initialized (handles Motor's truth testing issue)"""
    return _db is not None


async def get_coach_config() -> dict:
    """Get harvest coach configuration from database with fallback to defaults"""
    global _config_cache, _config_last_updated
    
    if not _is_db_initialized():
        return DEFAULT_CONFIG
    
    # Use cache if it's less than 5 minutes old
    now = datetime.now(timezone.utc)
    if (_config_cache and _config_last_updated and 
        (now - _config_last_updated).total_seconds() < 300):
        return _config_cache
    
    try:
        # Try to get config from database
        config_doc = await _db.harvest_coach_config.find_one({"_id": "default"})
        
        if config_doc:
            # Merge with defaults to ensure all keys exist
            config = {**DEFAULT_CONFIG, **config_doc.get("settings", {})}
        else:
            # Create default config in database
            config = DEFAULT_CONFIG.copy()
            await _db.harvest_coach_config.insert_one({
                "_id": "default",
                "settings": config,
                "updated_at": now.isoformat()
            })
        
        # Update cache
        _config_cache = config
        _config_last_updated = now
        
        return config
        
    except Exception as e:
        logger.warning(f"Failed to load coach config from database: {e}")
        return DEFAULT_CONFIG


# ============================================
# CONFIGURATION
# ============================================

# Default configuration - can be overridden by database settings
DEFAULT_CONFIG = {
    "streak_threshold": 10,  # Minimum doors needed for a streak day
    "close_to_top_threshold": 3,  # "You're 3rd, 2 more could put you in 1st"
    "close_to_goal_percent": 0.8,  # 80% of daily goal
    "nightly_summary_hour": 22,  # 10 PM
    "daily_door_goal": 25,  # Default daily door goal for nudges
    "high_performer_threshold": 50,  # Doors for "high performer" recognition
    "nudge_start_hour": 14,  # Start sending nudges after 2 PM
    "nudge_end_hour": 19,  # Stop sending nudges after 7 PM
}

# Default daily goals structure
DEFAULT_DAILY_GOALS = {
    "doors_knocked": 40,
    "appointments_set": 3,
    "signed_contracts": 1
}

# Default streak threshold
DEFAULT_STREAK_THRESHOLD = 10

# Cache for configuration to avoid database hits
_config_cache = None
_config_last_updated = None


# ============================================
# MAIN WORKER FUNCTIONS
# ============================================

async def run_hourly_check():
    """
    Hourly check for all active reps.
    Generates streak nudges, competition position alerts, and daily goal progress nudges.
    """
    if not _is_db_initialized():
        logger.error("Harvest Coach: Database not initialized")
        return
    
    logger.info("Harvest Coach: Running hourly check...")
    
    try:
        # Get configuration
        config = await get_coach_config()
        
        # Get all active users who have used Harvest
        active_users = await get_active_harvest_users()
        
        notifications_created = 0
        
        for user in active_users:
            user_id = user.get("id")
            user_name = user.get("full_name", "Rep")
            
            # Check streak status
            streak_notif = await check_streak_nudge(user_id, user_name, config)
            if streak_notif:
                notifications_created += 1
            
            # Check daily goal progress
            goal_notif = await check_daily_goal_nudge(user_id, user_name, config)
            if goal_notif:
                notifications_created += 1
            
            # Check competition position
            comp_notif = await check_competition_nudge(user_id, user_name)
            if comp_notif:
                notifications_created += 1
        
        logger.info(f"Harvest Coach: Hourly check complete. Created {notifications_created} notifications.")
        
    except Exception as e:
        logger.error(f"Harvest Coach hourly check error: {e}")


async def run_nightly_summary():
    """
    Nightly summary for each rep.
    Sends daily highlights notification with goal achievement status.
    """
    if not _is_db_initialized():
        logger.error("Harvest Coach: Database not initialized")
        return
    
    logger.info("Harvest Coach: Running nightly summary...")
    
    try:
        # Get configuration
        config = await get_coach_config()
        
        active_users = await get_active_harvest_users()
        
        notifications_created = 0
        
        for user in active_users:
            user_id = user.get("id")
            user_name = user.get("full_name", "Rep")
            
            notif = await create_daily_highlights(user_id, user_name, config)
            if notif:
                notifications_created += 1
        
        logger.info(f"Harvest Coach: Nightly summary complete. Created {notifications_created} notifications.")
        
    except Exception as e:
        logger.error(f"Harvest Coach nightly summary error: {e}")


# ============================================
# DAILY GOAL NUDGE LOGIC
# ============================================

async def check_daily_goal_nudge(user_id: str, user_name: str, config: Dict[str, Any]) -> Optional[dict]:
    """
    Check if user should get a daily goal progress nudge.
    
    Conditions:
    - User is at 50-90% of their daily door goal
    - It's afternoon (after 2 PM)
    - Haven't sent a goal nudge in last 3 hours
    """
    from routes.notifications import create_notification
    
    # Check current hour (only nudge in afternoon)
    now = datetime.now(timezone.utc)
    nudge_start_hour = config.get("nudge_start_hour", 14)
    if now.hour < nudge_start_hour:
        return None
    
    three_hours_ago = (now - timedelta(hours=3)).isoformat()
    today = now.strftime("%Y-%m-%d")
    
    # Check if we sent a goal nudge recently
    existing = await _db.notifications.find_one({
        "user_id": user_id,
        "type": "harvest_coach",
        "data.nudge_type": "daily_goal",
        "created_at": {"$gte": three_hours_ago}
    })
    
    if existing:
        return None
    
    # Get today's stats
    user_stats = await _db.harvest_stats_daily.find_one({
        "user_id": user_id,
        "date": today
    })
    
    today_doors = user_stats.get("doors", 0) if user_stats else 0
    today_appointments = user_stats.get("appointments", 0) if user_stats else 0
    
    # Get goals from config
    door_goal = config.get("daily_door_goal", 25)
    appt_goal = config.get("daily_appointment_goal", 3)
    
    # Calculate progress
    door_progress = today_doors / door_goal if door_goal > 0 else 0
    
    # Only nudge if between 50% and 90% - close but not there yet
    if 0.5 <= door_progress < 0.9:
        doors_needed = door_goal - today_doors
        
        # Craft encouraging message
        if door_progress >= 0.75:
            title = "🎯 Almost there!"
            body = f"You're at {today_doors}/{door_goal} doors! Just {doors_needed} more to hit your daily goal."
        else:
            title = "💪 Keep pushing!"
            body = f"You're {int(door_progress * 100)}% to your daily goal. {doors_needed} more doors to go!"
        
        # Add appointment context if relevant
        if today_appointments > 0 and appt_goal > 0:
            appt_progress = today_appointments / appt_goal
            if appt_progress >= 1:
                body += " 🎉 Appointments goal crushed!"
            else:
                body += f" ({today_appointments}/{appt_goal} appointments)"
        
        notification = await create_notification(
            user_id=user_id,
            type="harvest_coach",
            title=title,
            body=body,
            cta_label="Continue Canvassing",
            cta_route="/canvassing",
            data={
                "nudge_type": "daily_goal",
                "today_doors": today_doors,
                "door_goal": door_goal,
                "doors_needed": doors_needed,
                "progress_percent": int(door_progress * 100)
            },
            expires_at=(now + timedelta(hours=4)).isoformat()
        )
        
        logger.info(f"Daily goal nudge sent to {user_name}: {today_doors}/{door_goal} doors")
        return notification
    
    return None


# ============================================
# STREAK NUDGE LOGIC
# ============================================

async def check_streak_nudge(user_id: str, user_name: str, config: Dict[str, Any]) -> Optional[dict]:
    """
    Check if user needs a streak nudge.
    
    Conditions:
    - User has an active streak (1+ days)
    - Today's doors < streak_threshold
    - It's afternoon (after nudge_start_hour) - give them time to work before nudging
    - Haven't sent a streak nudge today already
    """
    from routes.notifications import create_notification
    
    # Get configuration values
    streak_threshold = config.get("streak_threshold", 10)
    nudge_start_hour = config.get("nudge_start_hour", 14)
    nudge_end_hour = config.get("nudge_end_hour", 19)
    
    # Check current hour (only nudge during configured hours)
    now = datetime.now(timezone.utc)
    if now.hour < nudge_start_hour or now.hour >= nudge_end_hour:
        return None
    
    today = now.strftime("%Y-%m-%d")
    
    # Check if we already sent a streak nudge today
    existing = await _db.notifications.find_one({
        "user_id": user_id,
        "type": "harvest_coach",
        "data.nudge_type": "streak",
        "created_at": {"$gte": today}
    })
    
    if existing:
        return None
    
    # Get user's current streak and today's doors
    user_stats = await _db.harvest_stats_daily.find_one({
        "user_id": user_id,
        "date": today
    })
    
    today_doors = user_stats.get("doors", 0) if user_stats else 0
    
    # Get streak from user stats
    streak_data = await get_user_streak(user_id, streak_threshold)
    current_streak = streak_data.get("streak", 0)
    
    # Only nudge if they have a streak and haven't hit threshold today
    if current_streak >= 1 and today_doors < streak_threshold:
        doors_needed = streak_threshold - today_doors
        
        # Craft the message
        if current_streak >= 10:
            urgency = "Your incredible"
            streak_desc = f"{current_streak}-day"
        elif current_streak >= 5:
            urgency = "Your solid"
            streak_desc = f"{current_streak}-day"
        else:
            urgency = "Your"
            streak_desc = f"{current_streak}-day"
        
        notification = await create_notification(
            user_id=user_id,
            type="harvest_coach",
            title="🔥 Keep your streak alive!",
            body=f"{urgency} {streak_desc} streak is at risk! You're {doors_needed} doors away from keeping it. Get out there before {nudge_end_hour}:00!",
            cta_label="Open Harvest",
            cta_route="/canvassing",
            data={
                "nudge_type": "streak",
                "current_streak": current_streak,
                "doors_needed": doors_needed,
                "today_doors": today_doors,
                "streak_threshold": streak_threshold
            },
            expires_at=(now + timedelta(hours=6)).isoformat()  # Expires in 6 hours
        )
        
        logger.info(f"Streak nudge sent to {user_name}: {doors_needed} doors needed (threshold: {streak_threshold})")
        return notification
    
    return None


# ============================================
# COMPETITION NUDGE LOGIC
# ============================================

async def check_competition_nudge(user_id: str, user_name: str) -> Optional[dict]:
    """
    Check if user should get a competition position alert.
    
    Conditions:
    - User is in top 5 but not 1st
    - Small gap to next position
    - Haven't sent a competition nudge in last 4 hours
    """
    from routes.notifications import create_notification
    
    now = datetime.now(timezone.utc)
    four_hours_ago = (now - timedelta(hours=4)).isoformat()
    
    # Check if we sent a competition nudge recently
    existing = await _db.notifications.find_one({
        "user_id": user_id,
        "type": "harvest_coach",
        "data.nudge_type": "competition",
        "created_at": {"$gte": four_hours_ago}
    })
    
    if existing:
        return None
    
    # Get today's leaderboard
    today = now.strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"date": today}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "doors": {"$sum": "$doors"},
            "appointments": {"$sum": "$appointments"}
        }},
        {"$sort": {"doors": -1}},
        {"$limit": 10}
    ]
    
    leaderboard = await _db.harvest_stats_daily.aggregate(pipeline).to_list(10)
    
    # Find user's position
    user_position = None
    user_doors = 0
    
    for i, entry in enumerate(leaderboard):
        if entry["_id"] == user_id:
            user_position = i + 1
            user_doors = entry.get("doors", 0)
            break
    
    # Only nudge if user is in position 2-5 and close to moving up
    if user_position and 2 <= user_position <= 5:
        next_position = leaderboard[user_position - 2]  # Person above them
        next_doors = next_position.get("doors", 0)
        gap = next_doors - user_doors
        
        # Nudge if gap is small (1-3 doors)
        if 1 <= gap <= 3:
            ordinal = {1: "1st", 2: "2nd", 3: "3rd"}.get(user_position - 1, f"{user_position - 1}th")
            
            notification = await create_notification(
                user_id=user_id,
                type="harvest_coach",
                title="🏆 You're close to the top!",
                body=f"You're #{user_position} in today's Daily Blitz. Just {gap} more door{'s' if gap > 1 else ''} could put you in {ordinal}!",
                cta_label="View Leaderboard",
                cta_route="/canvassing?tab=leaderboard",
                data={
                    "nudge_type": "competition",
                    "current_position": user_position,
                    "gap_to_next": gap,
                    "competition": "daily_blitz"
                },
                expires_at=(now + timedelta(hours=4)).isoformat()
            )
            
            logger.info(f"Competition nudge sent to {user_name}: #{user_position}, {gap} doors to move up")
            return notification
    
    return None


# ============================================
# DAILY HIGHLIGHTS
# ============================================

async def create_daily_highlights(user_id: str, user_name: str, config: Dict[str, Any]) -> Optional[dict]:
    """
    Create nightly daily highlights notification.
    Summarizes the day's performance against configured goals.
    """
    from routes.notifications import create_notification
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Check if we already sent a daily highlights today
    existing = await _db.notifications.find_one({
        "user_id": user_id,
        "type": "harvest_coach",
        "data.nudge_type": "daily_highlights",
        "created_at": {"$gte": today}
    })
    
    if existing:
        return None
    
    # Get today's stats
    user_stats = await _db.harvest_stats_daily.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not user_stats:
        return None  # No activity today
    
    doors = user_stats.get("doors", 0)
    appointments = user_stats.get("appointments", 0)
    signed = user_stats.get("signed", 0)
    points = user_stats.get("points", 0)
    
    if doors == 0:
        return None  # No doors knocked, skip summary
    
    # Get configured goals
    goals = config.get("daily_goals", DEFAULT_DAILY_GOALS)
    door_goal = goals.get("doors_knocked", 40)
    appt_goal = goals.get("appointments_set", 3)
    contract_goal = goals.get("signed_contracts", 1)
    
    # Calculate goal achievements
    door_pct = int((doors / door_goal) * 100) if door_goal > 0 else 0
    appt_pct = int((appointments / appt_goal) * 100) if appt_goal > 0 else 0
    contract_pct = int((signed / contract_goal) * 100) if contract_goal > 0 else 0
    
    # Get best territory (if tracked)
    best_territory = await get_best_territory_today(user_id, today)
    
    # Get streak info
    streak_threshold = config.get("streak_threshold", DEFAULT_STREAK_THRESHOLD)
    streak_data = await get_user_streak(user_id, streak_threshold)
    streak = streak_data.get("streak", 0)
    
    # Build message with goal context
    highlights = []
    
    if door_pct >= 100:
        highlights.append(f"✅ Crushed door goal: {doors}/{door_goal}")
    else:
        highlights.append(f"Doors: {doors}/{door_goal} ({door_pct}%)")
    
    if appt_goal > 0:
        if appt_pct >= 100:
            highlights.append(f"✅ {appointments} appointments")
        elif appointments > 0:
            highlights.append(f"{appointments}/{appt_goal} appointments")
    
    if contract_goal > 0 and signed > 0:
        if contract_pct >= 100:
            highlights.append(f"🎉 {signed} contract{'s' if signed != 1 else ''} signed!")
        else:
            highlights.append(f"{signed} contract{'s' if signed != 1 else ''}")
    
    body = " • ".join(highlights)
    
    if best_territory:
        body += f" | Best: {best_territory}"
    
    if streak >= 3:
        body += f" | 🔥 {streak}-day streak!"
    
    # Determine title based on performance
    goals_hit = sum([door_pct >= 100, appt_pct >= 100, contract_pct >= 100])
    
    if goals_hit == 3:
        title = "🏆 Perfect day - All goals hit!"
    elif signed > 0:
        title = "🎉 Great day with closings!"
    elif goals_hit >= 2:
        title = "💪 Strong day - Multiple goals hit!"
    elif door_pct >= 100:
        title = "👍 Door goal achieved!"
    elif appointments >= 3:
        title = "📅 Strong appointment day!"
    elif doors >= 50:
        title = "💪 Impressive door count!"
    elif doors >= 20:
        title = "👍 Solid work today!"
    else:
        title = "📊 Today's Harvest Highlights"
    
    notification = await create_notification(
        user_id=user_id,
        type="harvest_coach",
        title=title,
        body=body,
        cta_label="View Profile",
        cta_route="/canvassing?tab=profile",
        data={
            "nudge_type": "daily_highlights",
            "doors": doors,
            "appointments": appointments,
            "signed": signed,
            "points": points,
            "streak": streak,
            "goals_achieved": {
                "doors": door_pct >= 100,
                "appointments": appt_pct >= 100,
                "contracts": contract_pct >= 100
            }
        }
    )
    
    logger.info(f"Daily highlights sent to {user_name}: {doors} doors, {appointments} appts, {goals_hit}/3 goals hit")
    return notification


# ============================================
# HELPER FUNCTIONS
# ============================================

async def get_active_harvest_users() -> List[dict]:
    """Get users who have used Harvest in the last 30 days"""
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Find users with recent harvest activity
    active_user_ids = await _db.harvest_stats_daily.distinct(
        "user_id",
        {"created_at": {"$gte": thirty_days_ago}}
    )
    
    if not active_user_ids:
        return []
    
    users = await _db.users.find(
        {"id": {"$in": active_user_ids}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1}
    ).to_list(1000)
    
    return users


async def get_user_streak(user_id: str, streak_threshold: int = None) -> dict:
    """Get user's current streak and multiplier
    
    Args:
        user_id: The user ID to check
        streak_threshold: Minimum doors needed for a streak day (uses config default if not provided)
    """
    if streak_threshold is None:
        streak_threshold = DEFAULT_STREAK_THRESHOLD
    
    # Look for recent consecutive days with doors >= threshold
    now = datetime.now(timezone.utc)
    streak = 0
    
    for i in range(30):  # Check last 30 days
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        
        stats = await _db.harvest_stats_daily.find_one({
            "user_id": user_id,
            "date": date
        })
        
        doors = stats.get("doors", 0) if stats else 0
        
        if doors >= streak_threshold:
            streak += 1
        else:
            break
    
    # Calculate multiplier based on streak
    if streak >= 30:
        multiplier = 2.0
    elif streak >= 10:
        multiplier = 1.5
    elif streak >= 5:
        multiplier = 1.25
    elif streak >= 3:
        multiplier = 1.1
    else:
        multiplier = 1.0
    
    return {
        "streak": streak,
        "multiplier": multiplier,
        "streak_threshold": streak_threshold
    }


async def get_best_territory_today(user_id: str, date: str) -> Optional[str]:
    """Get the territory where user had most doors today"""
    pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$regex": f"^{date}"}}},
        {"$lookup": {
            "from": "canvassing_pins",
            "localField": "pin_id",
            "foreignField": "id",
            "as": "pin"
        }},
        {"$unwind": {"path": "$pin", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$pin.territory_id",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]
    
    result = await _db.harvest_visits.aggregate(pipeline).to_list(1)
    
    if result and result[0].get("_id"):
        territory_id = result[0]["_id"]
        territory = await _db.territories.find_one({"id": territory_id})
        if territory:
            return territory.get("name", "Unknown")
    
    return None


# ============================================
# MANUAL TRIGGER (for testing)
# ============================================

async def trigger_manual_run(run_type: str = "hourly"):
    """Manual trigger for testing - call from an API endpoint"""
    if run_type == "hourly":
        await run_hourly_check()
    elif run_type == "nightly":
        await run_nightly_summary()
    else:
        logger.warning(f"Unknown run type: {run_type}")


# ============================================
# CONFIGURATION MANAGEMENT
# ============================================

async def update_coach_config(new_config: dict) -> dict:
    """Update harvest coach configuration"""
    global _config_cache, _config_last_updated
    
    if not _is_db_initialized():
        raise Exception("Database not initialized")
    
    # Validate configuration values
    validated_config = {}
    for key, value in new_config.items():
        if key in DEFAULT_CONFIG:
            # Type validation
            expected_type = type(DEFAULT_CONFIG[key])
            if isinstance(value, expected_type):
                validated_config[key] = value
            else:
                logger.warning(f"Invalid type for config key {key}: expected {expected_type}, got {type(value)}")
        else:
            logger.warning(f"Unknown config key: {key}")
    
    if not validated_config:
        raise ValueError("No valid configuration updates provided")
    
    # Update database
    now = datetime.now(timezone.utc)
    await _db.harvest_coach_config.update_one(
        {"_id": "default"},
        {
            "$set": {
                "settings": {**DEFAULT_CONFIG, **validated_config},
                "updated_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    # Clear cache to force reload
    _config_cache = None
    _config_last_updated = None
    
    logger.info(f"Harvest coach configuration updated: {validated_config}")
    return validated_config


async def get_current_config() -> dict:
    """Get current configuration (for API endpoints)"""
    return await get_coach_config()
