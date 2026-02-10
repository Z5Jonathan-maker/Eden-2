"""
Harvest Rewards & Campaigns Models
Extended gamification system for Harvest canvassing

Based on HARVEST_GAMIFICATION_SPEC.md
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


# ============================================
# BADGE TIERS (Extended from existing)
# ============================================

class BadgeTier(str, Enum):
    COMMON = "common"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


class BadgeDefinition(BaseModel):
    """Extended badge definition with tiers"""
    id: str
    name: str
    description: str
    icon: str
    tier: BadgeTier = BadgeTier.COMMON
    criteria_type: str  # doors_single_day, streak_days, total_signed, appointments_week, etc.
    criteria_value: int
    category: str = "general"  # general, streak, milestone, achievement
    points_bonus: int = 0
    # Visual customization
    border_color: Optional[str] = None  # Hex color for tier
    glow_effect: bool = False
    animated: bool = False
    created_at: str = ""


# ============================================
# REWARDS
# ============================================

class RewardCategory(str, Enum):
    GIFT_CARD = "gift_card"
    MERCHANDISE = "merchandise"
    EXPERIENCE = "experience"
    CASH_BONUS = "cash_bonus"
    PTO = "pto"


class Reward(BaseModel):
    """Redeemable reward item"""
    id: str
    name: str
    description: str
    image_url: Optional[str] = None
    category: RewardCategory
    points_required: int
    retail_value_cents: Optional[int] = None  # For tracking ROI
    stock_quantity: Optional[int] = None  # null = unlimited
    active_campaign_id: Optional[str] = None  # If tied to specific campaign
    is_featured: bool = False
    available_from: str  # ISO date
    available_until: Optional[str] = None  # null = permanent
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


class RedemptionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FULFILLED = "fulfilled"
    DENIED = "denied"


class RewardRedemption(BaseModel):
    """User's redemption request"""
    id: str
    user_id: str
    user_name: str
    reward_id: str
    reward_name: str
    points_spent: int
    status: RedemptionStatus = RedemptionStatus.PENDING
    requested_at: str
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    fulfilled_at: Optional[str] = None
    fulfillment_notes: Optional[str] = None
    denial_reason: Optional[str] = None


# ============================================
# CAMPAIGNS
# ============================================

class GoalType(str, Enum):
    DOORS = "doors"
    APPOINTMENTS = "appointments"
    CONTRACTS = "contracts"
    POINTS = "points"
    CUSTOM = "custom"


class RewardType(str, Enum):
    TOP_PERFORMERS = "top_performers"  # Top N win
    THRESHOLD = "threshold"  # Anyone who hits target
    LOTTERY = "lottery"  # Random draw from qualifiers


class EligibilityRules(BaseModel):
    """Who can participate in a campaign"""
    min_tenure_days: Optional[int] = None
    teams: Optional[List[str]] = None  # null = all teams
    roles: Optional[List[str]] = None  # null = all roles
    must_be_active: bool = True


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Campaign(BaseModel):
    """Gamification campaign / challenge"""
    id: str
    name: str
    description: str
    
    # Timing
    start_date: str  # ISO
    end_date: str
    status: CampaignStatus = CampaignStatus.DRAFT
    
    # Goal Configuration
    goal_type: GoalType = GoalType.DOORS
    target_value: int
    goal_description: Optional[str] = None  # For custom goals
    
    # Reward Configuration
    reward_type: RewardType = RewardType.THRESHOLD
    reward_ids: List[str] = []  # IDs of rewards from catalog
    top_n: Optional[int] = None  # For top_performers: how many winners
    threshold_value: Optional[int] = None  # For threshold: minimum to qualify
    points_bonus: int = 0  # Bonus points on completion
    
    # Eligibility
    eligibility_rules: EligibilityRules = Field(default_factory=EligibilityRules)
    
    # Display
    announcement_banner_text: Optional[str] = None
    banner_color: str = "#F97316"  # Eden orange
    icon: str = "🎯"
    
    # Template reference
    template_id: Optional[str] = None
    
    # Metadata
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


class CampaignTemplate(BaseModel):
    """Reusable campaign template"""
    id: str
    name: str
    description: str
    duration_days: int
    goal_type: GoalType
    default_target: int
    reward_type: RewardType
    suggested_reward_ids: List[str] = []
    icon: str = "🎯"
    is_active: bool = True
    created_at: str = ""


class CampaignProgress(BaseModel):
    """User's progress in a campaign"""
    id: str
    campaign_id: str
    user_id: str
    user_name: str
    current_value: int = 0
    target_value: int
    percent_complete: float = 0.0
    is_qualified: bool = False  # Met threshold
    is_winner: bool = False  # For top_performers
    rank: Optional[int] = None
    reward_claimed: bool = False
    last_updated: str = ""


# ============================================
# CHALLENGES (Individual user challenges)
# ============================================

class ChallengeState(str, Enum):
    LOCKED = "locked"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLAIMED = "claimed"
    EXPIRED = "expired"


class Challenge(BaseModel):
    """Individual challenge derived from campaigns"""
    id: str
    user_id: str
    campaign_id: Optional[str] = None  # null = standalone challenge
    name: str
    description: str
    icon: str = "🎯"
    
    # Requirements
    requirement_type: str  # doors_today, appointments_week, etc.
    requirement_value: int
    current_progress: int = 0
    
    # Timing
    start_time: str
    end_time: str
    time_remaining_display: Optional[str] = None  # "6h 30m"
    
    # Reward
    points_reward: int = 0
    reward_id: Optional[str] = None
    
    # State
    state: ChallengeState = ChallengeState.IN_PROGRESS
    completed_at: Optional[str] = None
    claimed_at: Optional[str] = None
    
    created_at: str = ""


# ============================================
# STREAKS (Extended)
# ============================================

class UserStreak(BaseModel):
    """User's streak tracking"""
    user_id: str
    current_streak: int = 0
    best_streak: int = 0
    last_activity_date: str = ""
    streak_start_date: Optional[str] = None
    
    # Streak status
    is_at_risk: bool = False  # No activity today by 3 PM
    is_critical: bool = False  # No activity today by 5 PM
    
    # History
    streak_history: List[Dict] = []  # [{date, doors_count, streak_at_time}]
    
    updated_at: str = ""


# ============================================
# API Request/Response Models
# ============================================

class RewardCreate(BaseModel):
    name: str
    description: str
    image_url: Optional[str] = None
    category: RewardCategory
    points_required: int
    retail_value_cents: Optional[int] = None
    stock_quantity: Optional[int] = None
    is_featured: bool = False


class RewardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    points_required: Optional[int] = None
    stock_quantity: Optional[int] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None


class CampaignCreate(BaseModel):
    name: str
    description: str
    start_date: str
    end_date: str
    goal_type: GoalType = GoalType.DOORS
    target_value: int
    reward_type: RewardType = RewardType.THRESHOLD
    reward_ids: List[str] = []
    top_n: Optional[int] = None
    threshold_value: Optional[int] = None
    points_bonus: int = 0
    announcement_banner_text: Optional[str] = None
    banner_color: str = "#F97316"
    icon: str = "🎯"
    template_id: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    end_date: Optional[str] = None
    target_value: Optional[int] = None
    reward_ids: Optional[List[str]] = None
    status: Optional[CampaignStatus] = None
    announcement_banner_text: Optional[str] = None


class RedemptionRequest(BaseModel):
    reward_id: str


class RedemptionAction(BaseModel):
    action: str  # "approve" or "deny"
    notes: Optional[str] = None
