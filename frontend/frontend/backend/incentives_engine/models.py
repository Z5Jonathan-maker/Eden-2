"""
Eden Incentives Engine - Core Models
Enzy-Level Competition & Rewards Platform

Based on EDEN_INCENTIVES_ENGINE_V2_SPEC.md
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============================================
# ENUMS
# ============================================

class MetricAggregation(str, Enum):
    COUNT = "count"
    SUM = "sum"
    AVG = "avg"
    MAX = "max"
    RATIO = "ratio"


class MetricFormat(str, Enum):
    INTEGER = "integer"
    DECIMAL = "decimal"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"


class SeasonStatus(str, Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"


class CompetitionStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CompetitionScope(str, Enum):
    INDIVIDUAL = "individual"
    TEAM = "team"
    COMPANY = "company"


class TeamGrouping(str, Enum):
    OFFICE = "office"
    CREW = "crew"
    REGION = "region"
    CUSTOM = "custom"


class IncentiveRuleType(str, Enum):
    TOP_N = "top_n"
    THRESHOLD = "threshold"
    MILESTONE = "milestone"
    IMPROVEMENT = "improvement"
    LOTTERY = "lottery"


class RewardType(str, Enum):
    GIFT_CARD = "gift_card"
    MERCHANDISE = "merchandise"
    EXPERIENCE = "experience"
    CASH = "cash"
    PTO = "pto"
    POINTS = "points"
    BADGE = "badge"
    CUSTOM = "custom"


class FulfillmentProviderType(str, Enum):
    MANUAL = "manual"
    API = "api"
    WEBHOOK = "webhook"
    INTERNAL = "internal"


class FulfillmentStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PROCESSING = "processing"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class ProviderHealth(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"


class CompetitionCategory(str, Enum):
    SPRINT = "sprint"
    LADDER = "ladder"
    THRESHOLD = "threshold"
    TEAM_BATTLE = "team_battle"
    MILESTONE = "milestone"
    LOTTERY = "lottery"


class DurationType(str, Enum):
    DAY = "day"
    WEEKEND = "weekend"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    CUSTOM = "custom"


# ============================================
# SEASON
# ============================================

class SeasonStanding(BaseModel):
    """Standing within a season"""
    rank: int
    user_id: str
    user_name: str
    total_points: int
    competitions_entered: int
    competitions_won: int


class Season(BaseModel):
    """Groups competitions into time-bounded campaigns"""
    id: str
    name: str  # "Q1 2026 Storm Season"
    description: str
    
    # Timing
    start_date: str  # ISO datetime
    end_date: str
    status: SeasonStatus = SeasonStatus.UPCOMING
    
    # Theme
    theme_name: str = ""  # "Thunder & Lightning"
    theme_color: str = "#6366F1"
    banner_image_url: Optional[str] = None
    
    # Cumulative tracking
    points_multiplier: float = 1.0  # Season-wide multiplier
    
    # Relationships
    competition_ids: List[str] = []
    
    # Results (populated at end)
    final_standings: List[SeasonStanding] = []
    champion_user_id: Optional[str] = None
    
    # Metadata
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


# ============================================
# METRIC
# ============================================

class Metric(BaseModel):
    """Defines trackable KPIs with aggregation logic"""
    id: str
    slug: str  # "doors", "appointments", "close_rate"
    name: str  # "Doors Knocked"
    description: str
    
    # Calculation
    source_collection: str  # "harvest_visits", "appointments"
    source_field: Optional[str] = None  # Field to count/sum (null for count)
    aggregation: MetricAggregation = MetricAggregation.COUNT
    filter_query: Optional[Dict[str, Any]] = None  # MongoDB filter
    
    # For ratio metrics
    numerator_metric_id: Optional[str] = None
    denominator_metric_id: Optional[str] = None
    
    # Display
    icon: str = "📊"
    unit: str = ""  # "doors", "appointments", "$", "%"
    format: MetricFormat = MetricFormat.INTEGER
    
    # Scoping
    supports_individual: bool = True
    supports_team: bool = True
    supports_company: bool = True
    
    # Admin
    is_system: bool = True  # Built-in vs custom
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


# ============================================
# COMPETITION TEMPLATE
# ============================================

class IncentiveRuleConfig(BaseModel):
    """Rule configuration for templates"""
    type: IncentiveRuleType
    config: Dict[str, Any] = {}  # Type-specific configuration
    reward_config: Dict[str, Any] = {}  # reward_id, points_award, badge_id


class CompetitionTemplate(BaseModel):
    """Reusable blueprint for competitions"""
    id: str
    name: str  # "Weekend Blitz"
    description: str
    tagline: str = ""  # "75 doors = $50 guaranteed"
    
    # Default configuration
    default_metric_id: str
    default_duration_type: DurationType = DurationType.WEEK
    default_duration_days: Optional[int] = None
    
    # Scope
    default_scope: CompetitionScope = CompetitionScope.INDIVIDUAL
    default_team_grouping: Optional[TeamGrouping] = None
    
    # Rules template
    default_rules: List[IncentiveRuleConfig] = []
    
    # Suggested rewards
    suggested_reward_ids: List[str] = []
    suggested_points_bonus: int = 0
    
    # Visual
    icon: str = "🎯"
    banner_color: str = "#F97316"
    category: CompetitionCategory = CompetitionCategory.THRESHOLD
    
    # Usage tracking
    times_used: int = 0
    last_used_at: Optional[str] = None
    avg_participation_rate: Optional[float] = None
    
    # Admin
    is_system: bool = True
    is_active: bool = True
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


# ============================================
# COMPETITION
# ============================================

class CompetitionEligibility(BaseModel):
    """Defines who can participate"""
    all_users: bool = True
    min_tenure_days: Optional[int] = None
    max_tenure_days: Optional[int] = None
    required_role_ids: List[str] = []
    required_team_ids: List[str] = []
    excluded_user_ids: List[str] = []
    requires_opt_in: bool = False


class CompetitionReward(BaseModel):
    """Reward pool entry"""
    rank_or_tier: str  # "1", "2", "3" or "threshold" or "gold"
    reward_id: str
    quantity: int = 1


class Competition(BaseModel):
    """Active competition instance"""
    id: str
    template_id: Optional[str] = None
    season_id: Optional[str] = None
    
    # Identity
    name: str
    description: str
    tagline: str = ""
    
    # Visual
    icon: str = "🎯"
    banner_color: str = "#F97316"
    banner_image_url: Optional[str] = None
    
    # Timing
    start_date: str
    end_date: str
    timezone: str = "America/Denver"
    status: CompetitionStatus = CompetitionStatus.DRAFT
    
    # Metric
    metric_id: str
    metric_snapshot: Optional[Dict[str, Any]] = None  # Denormalized for history
    
    # Scope
    scope: CompetitionScope = CompetitionScope.INDIVIDUAL
    team_grouping: Optional[TeamGrouping] = None
    custom_team_ids: List[str] = []
    
    # Eligibility
    eligibility: CompetitionEligibility = Field(default_factory=CompetitionEligibility)
    
    # Rules (populated from IncentiveRule collection)
    rule_ids: List[str] = []
    
    # Rewards
    reward_pool: List[CompetitionReward] = []
    points_bonus: int = 0  # Participation points
    
    # Display settings
    show_in_today: bool = True
    show_in_leaderboard: bool = True
    show_in_challenges: bool = True
    show_real_time_updates: bool = True
    announcement_text: Optional[str] = None
    
    # Participation stats
    participant_count: int = 0
    qualified_count: int = 0
    
    # Results (populated after evaluation)
    evaluated_at: Optional[str] = None
    
    # Metadata
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


# ============================================
# INCENTIVE RULE
# ============================================

class MilestoneConfig(BaseModel):
    """Milestone tier definition"""
    tier: str  # "bronze", "silver", "gold", "diamond"
    value: int
    reward_id: Optional[str] = None
    points_award: int = 0
    badge_id: Optional[str] = None
    icon: str = ""
    color: str = ""


class RewardTierConfig(BaseModel):
    """Tiered rewards for top_n"""
    rank: int  # 1, 2, 3
    reward_id: str
    bonus_points: int = 0


class IncentiveRule(BaseModel):
    """Defines win conditions within a competition"""
    id: str
    competition_id: str
    
    # Rule type
    type: IncentiveRuleType
    priority: int = 1  # Evaluation order
    
    # top_n config
    top_n: Optional[int] = None
    top_n_per_team: bool = False
    tiebreaker: str = "first_to_reach"  # first_to_reach, secondary_metric, random
    secondary_metric_id: Optional[str] = None
    
    # threshold config
    threshold_value: Optional[int] = None
    threshold_operator: str = "gte"  # gte, gt, eq
    max_winners: Optional[int] = None
    
    # milestone config
    milestones: List[MilestoneConfig] = []
    
    # improvement config
    improvement_percent: Optional[float] = None
    baseline_period: Optional[str] = None  # last_week, last_month, etc.
    baseline_metric_id: Optional[str] = None
    
    # lottery config
    lottery_qualifier_threshold: Optional[int] = None
    lottery_winner_count: Optional[int] = None
    lottery_drawn_at: Optional[str] = None
    lottery_seed: Optional[str] = None
    
    # Reward mapping
    reward_id: Optional[str] = None
    reward_tiers: List[RewardTierConfig] = []
    points_award: int = 0
    badge_id: Optional[str] = None
    
    # Display
    display_name: str = ""
    display_description: str = ""
    
    created_at: str = ""


# ============================================
# REWARD
# ============================================

class Reward(BaseModel):
    """Prize catalog item"""
    id: str
    name: str
    description: str
    
    # Type
    type: RewardType = RewardType.GIFT_CARD
    
    # Value
    value_cents: Optional[int] = None
    points_value: Optional[int] = None
    badge_id: Optional[str] = None
    
    # Fulfillment
    fulfillment_provider_id: str = "manual"
    fulfillment_sku: Optional[str] = None
    requires_shipping: bool = False
    requires_approval: bool = True
    
    # Inventory
    stock_quantity: Optional[int] = None  # null = unlimited
    stock_reserved: int = 0
    max_per_user_per_month: Optional[int] = None
    
    # Display
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    icon: str = "🎁"
    
    # Availability
    is_active: bool = True
    is_featured: bool = False
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    
    # Categories
    categories: List[str] = []
    
    created_at: str = ""
    updated_at: str = ""


# ============================================
# FULFILLMENT PROVIDER
# ============================================

class FulfillmentProviderConfig(BaseModel):
    """Provider-specific configuration (encrypted in DB)"""
    api_url: Optional[str] = None
    api_key_encrypted: Optional[str] = None
    webhook_url: Optional[str] = None
    callback_secret: Optional[str] = None


class FulfillmentProvider(BaseModel):
    """Abstracts reward delivery"""
    id: str
    name: str  # "Manual", "Tremendous", "Tango Card"
    type: FulfillmentProviderType = FulfillmentProviderType.MANUAL
    
    # Config
    config: FulfillmentProviderConfig = Field(default_factory=FulfillmentProviderConfig)
    
    # Capabilities
    supported_reward_types: List[str] = []
    supports_bulk_fulfillment: bool = False
    supports_instant_delivery: bool = False
    supports_physical_shipping: bool = False
    
    # Status
    is_active: bool = True
    last_health_check: Optional[str] = None
    health_status: ProviderHealth = ProviderHealth.HEALTHY
    
    # Rate limits
    rate_limit_per_hour: Optional[int] = None
    rate_limit_per_day: Optional[int] = None
    
    created_at: str = ""
    updated_at: str = ""


# ============================================
# FULFILLMENT EVENT
# ============================================

class FulfillmentEvent(BaseModel):
    """Tracks each reward delivery"""
    id: str
    
    # Source
    competition_id: str
    rule_id: str
    participant_id: str
    user_id: str
    
    # Reward
    reward_id: str
    reward_snapshot: Dict[str, Any] = {}  # Denormalized for history
    value_cents: int = 0
    
    # Fulfillment
    provider_id: str = "manual"
    status: FulfillmentStatus = FulfillmentStatus.PENDING_APPROVAL
    
    # Approval workflow
    requires_approval: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    denial_reason: Optional[str] = None
    
    # Provider interaction
    provider_reference: Optional[str] = None
    provider_request: Optional[Dict[str, Any]] = None
    provider_response: Optional[Dict[str, Any]] = None
    
    # Delivery
    delivery_method: Optional[str] = None  # email, physical, in_app, sms
    delivery_address: Optional[Dict[str, Any]] = None
    delivery_email: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    
    # Timeline
    created_at: str = ""
    processed_at: Optional[str] = None
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    failed_at: Optional[str] = None
    failure_reason: Optional[str] = None
    
    # Manual fulfillment
    fulfilled_by: Optional[str] = None
    fulfillment_notes: Optional[str] = None
    
    # Retry handling
    retry_count: int = 0
    next_retry_at: Optional[str] = None


# ============================================
# PARTICIPANT
# ============================================

class NotificationRecord(BaseModel):
    """Tracks notifications sent to avoid spam"""
    type: str
    sent_at: str
    data: Optional[Dict[str, Any]] = None


class Participant(BaseModel):
    """User's state within a competition"""
    id: str
    competition_id: str
    user_id: str
    user_name: str
    team_id: Optional[str] = None
    
    # Current state
    current_value: int = 0
    previous_value: int = 0
    rank: Optional[int] = None
    previous_rank: Optional[int] = None
    percentile: Optional[float] = None
    
    # Progress tracking
    value_at_start: int = 0
    peak_value: int = 0
    peak_rank: Optional[int] = None
    
    # Qualification
    qualified_rules: List[str] = []
    milestone_reached: Optional[str] = None
    improvement_percent: Optional[float] = None
    
    # Engagement
    is_eligible: bool = True
    opted_in: bool = True
    joined_at: str = ""
    last_activity_at: str = ""
    activity_count: int = 0
    
    # Notifications
    notifications_sent: List[NotificationRecord] = []
    
    updated_at: str = ""


# ============================================
# COMPETITION RESULT
# ============================================

class CompetitionResult(BaseModel):
    """Immutable record of final standings"""
    id: str
    competition_id: str
    
    # Standings
    user_id: str
    user_name: str
    team_id: Optional[str] = None
    final_rank: int
    final_value: int
    final_percentile: float = 0
    
    # Rule matched
    rule_id: str
    rule_type: str
    qualification_reason: str  # "Top 3", "Threshold: 75+", "Gold Tier"
    
    # Awards
    reward_id: Optional[str] = None
    reward_name: Optional[str] = None
    reward_value_cents: Optional[int] = None
    points_awarded: int = 0
    badge_id: Optional[str] = None
    badge_name: Optional[str] = None
    
    # Fulfillment link
    fulfillment_event_id: Optional[str] = None
    fulfillment_status: str = "pending"
    
    # Timestamps
    created_at: str = ""
    awarded_at: Optional[str] = None


# ============================================
# TEAM GROUP
# ============================================

class TeamGroupType(str, Enum):
    OFFICE = "office"
    CREW = "crew"
    REGION = "region"
    CUSTOM = "custom"


class TeamGroup(BaseModel):
    """Organizational unit for team competitions"""
    id: str
    name: str
    description: str = ""
    
    # Type
    group_type: TeamGroupType = TeamGroupType.OFFICE
    
    # Hierarchy
    parent_team_id: Optional[str] = None
    
    # Members
    member_user_ids: List[str] = []
    manager_user_ids: List[str] = []
    
    # Display
    icon: str = ""
    color: str = ""
    
    # Stats
    member_count: int = 0
    
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


# ============================================
# METRIC VALUE (Time-Series Cache)
# ============================================

class PeriodType(str, Enum):
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class MetricValue(BaseModel):
    """Pre-aggregated metric values for fast queries"""
    id: str
    user_id: str
    team_id: Optional[str] = None
    metric_id: str
    
    # Value
    value: int = 0
    delta: int = 0  # Change from last period
    
    # Time bucket
    period_type: PeriodType = PeriodType.DAY
    period_start: str = ""
    period_end: str = ""
    
    # Context
    competition_id: Optional[str] = None
    season_id: Optional[str] = None
    
    created_at: str = ""
    updated_at: str = ""


# ============================================
# METRIC EVENT (Raw Events for Audit)
# ============================================

class MetricEvent(BaseModel):
    """Individual metric-affecting events"""
    id: str
    user_id: str
    metric_id: str
    
    # Event
    event_type: str  # "visit_logged", "contract_signed"
    source_collection: str
    source_document_id: str
    
    # Value
    value: int = 1
    
    # Context
    competition_ids: List[str] = []
    
    created_at: str = ""


# ============================================
# API REQUEST MODELS
# ============================================

class SeasonCreate(BaseModel):
    name: str
    description: str
    start_date: str
    end_date: str
    theme_name: str = ""
    theme_color: str = "#6366F1"
    banner_image_url: Optional[str] = None
    icon: str = "🏆"
    grand_prize_description: str = ""
    grand_prize_value_cents: int = 0
    points_multiplier: float = 1.0
    is_active: bool = True


class SeasonUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    theme_name: Optional[str] = None
    theme_color: Optional[str] = None
    banner_image_url: Optional[str] = None
    icon: Optional[str] = None
    grand_prize_description: Optional[str] = None
    grand_prize_value_cents: Optional[int] = None
    status: Optional[SeasonStatus] = None
    is_active: Optional[bool] = None


class MetricCreate(BaseModel):
    slug: str
    name: str
    description: str
    source_collection: str
    source_field: Optional[str] = None
    aggregation: MetricAggregation = MetricAggregation.COUNT
    filter_query: Optional[Dict[str, Any]] = None
    icon: str = "📊"
    unit: str = ""
    format: MetricFormat = MetricFormat.INTEGER


class CompetitionCreate(BaseModel):
    name: str
    description: str
    tagline: str = ""
    start_date: str
    end_date: str
    metric_id: str
    scope: CompetitionScope = CompetitionScope.INDIVIDUAL
    team_grouping: Optional[TeamGrouping] = None
    icon: str = "🎯"
    banner_color: str = "#F97316"
    points_bonus: int = 0
    template_id: Optional[str] = None
    season_id: Optional[str] = None


class CompetitionFromTemplate(BaseModel):
    template_id: str
    name: str
    start_date: str
    end_date: Optional[str] = None  # Optional - if not provided, calculated from template duration
    season_id: Optional[str] = None
    auto_start: bool = True
    overrides: Optional[Dict[str, Any]] = None


class RuleCreate(BaseModel):
    competition_id: str
    type: IncentiveRuleType
    priority: int = 1
    # Type-specific fields
    top_n: Optional[int] = None
    threshold_value: Optional[int] = None
    milestones: List[MilestoneConfig] = []
    improvement_percent: Optional[float] = None
    lottery_winner_count: Optional[int] = None
    # Rewards
    reward_id: Optional[str] = None
    points_award: int = 0
    badge_id: Optional[str] = None


class RewardCreate(BaseModel):
    name: str
    description: str
    type: RewardType = RewardType.GIFT_CARD
    value_cents: Optional[int] = None
    fulfillment_provider_id: str = "manual"
    requires_shipping: bool = False
    requires_approval: bool = True
    stock_quantity: Optional[int] = None
    icon: str = "🎁"
    image_url: Optional[str] = None
    categories: List[str] = []
