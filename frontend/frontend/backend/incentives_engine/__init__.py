"""
Eden Incentives Engine Package
Enzy-Level Competition & Rewards Platform
"""

from .models import (
    # Enums
    MetricAggregation, MetricFormat, SeasonStatus, CompetitionStatus,
    CompetitionScope, TeamGrouping, IncentiveRuleType, RewardType,
    FulfillmentProviderType, FulfillmentStatus, ProviderHealth,
    CompetitionCategory, DurationType, PeriodType, TeamGroupType,
    
    # Core Models
    Season, SeasonStanding,
    Metric,
    CompetitionTemplate, IncentiveRuleConfig,
    Competition, CompetitionEligibility, CompetitionReward,
    IncentiveRule, MilestoneConfig, RewardTierConfig,
    Reward,
    FulfillmentProvider, FulfillmentProviderConfig,
    FulfillmentEvent,
    Participant, NotificationRecord,
    CompetitionResult,
    TeamGroup,
    MetricValue, MetricEvent,
    
    # API Request Models
    SeasonCreate, SeasonUpdate,
    MetricCreate,
    CompetitionCreate, CompetitionFromTemplate,
    RuleCreate,
    RewardCreate,
)

from .evaluator import IncentiveEvaluator, process_harvest_event, HARVEST_METRIC_MAP

__all__ = [
    # Enums
    "MetricAggregation", "MetricFormat", "SeasonStatus", "CompetitionStatus",
    "CompetitionScope", "TeamGrouping", "IncentiveRuleType", "RewardType",
    "FulfillmentProviderType", "FulfillmentStatus", "ProviderHealth",
    "CompetitionCategory", "DurationType", "PeriodType", "TeamGroupType",
    
    # Core Models
    "Season", "SeasonStanding",
    "Metric",
    "CompetitionTemplate", "IncentiveRuleConfig",
    "Competition", "CompetitionEligibility", "CompetitionReward",
    "IncentiveRule", "MilestoneConfig", "RewardTierConfig",
    "Reward",
    "FulfillmentProvider", "FulfillmentProviderConfig",
    "FulfillmentEvent",
    "Participant", "NotificationRecord",
    "CompetitionResult",
    "TeamGroup",
    "MetricValue", "MetricEvent",
    
    # API Request Models
    "SeasonCreate", "SeasonUpdate",
    "MetricCreate",
    "CompetitionCreate", "CompetitionFromTemplate",
    "RuleCreate",
    "RewardCreate",
    
    # Evaluator
    "IncentiveEvaluator",
    "process_harvest_event",
    "HARVEST_METRIC_MAP",
]
