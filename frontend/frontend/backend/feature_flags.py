"""
Eden Feature Flags System

Allows features to be enabled/disabled per environment or user role.
Usage:
    from feature_flags import is_feature_enabled, get_feature_config

    if is_feature_enabled("rapid_capture", user):
        # Show RapidCapture
"""

import os
from typing import Optional, Dict, Any, List
from core import UserRole

# ============================================
# FEATURE FLAG DEFINITIONS
# ============================================

FEATURE_FLAGS = {
    # Core features (always enabled in production)
    "claims_crud": {
        "name": "Claims Management",
        "description": "Basic claims CRUD operations",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
        "environments": ["development", "staging", "production"]
    },
    
    # Inspection features
    "rapid_capture": {
        "name": "Rapid Capture",
        "description": "Voice-annotated photo capture mode",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"],
        "requires_camera": True
    },
    "inspection_photos": {
        "name": "Inspection Photos",
        "description": "Photo gallery and management",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
        "environments": ["development", "staging", "production"]
    },
    
    # Eve AI features
    "eve_chat": {
        "name": "Eve AI Assistant",
        "description": "AI-powered claims assistant",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"],
        "requires_api_key": "EMERGENT_LLM_KEY"
    },
    "eve_strategy": {
        "name": "Eve Strategy Builder",
        "description": "AI-powered claim strategy generation",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"],
        "requires_api_key": "EMERGENT_LLM_KEY"
    },
    
    # Harvest features
    "harvest_map": {
        "name": "Harvest Canvassing",
        "description": "D2D sales mapping and tracking",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    "harvest_gamification": {
        "name": "Harvest Gamification",
        "description": "Badges, leaderboards, and competitions",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    
    # Contract features
    "contracts": {
        "name": "Contract Management",
        "description": "Contract templates and signing",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    "signnow_integration": {
        "name": "SignNow E-Signatures",
        "description": "Electronic signature integration",
        "enabled_by_default": False,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["staging", "production"],
        "requires_api_key": "SIGNNOW_CLIENT_ID"
    },
    
    # Knowledge base features
    "florida_statutes": {
        "name": "Florida Statutes",
        "description": "Legal statutes database",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    "industry_experts": {
        "name": "Industry Experts",
        "description": "Expert knowledge base",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    
    # Advanced features
    "scales_comparison": {
        "name": "Scales Estimate Comparison",
        "description": "Xactimate estimate comparison engine",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    "weather_verification": {
        "name": "Weather Verification",
        "description": "Historical weather data for claims",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"]
    },
    "property_intelligence": {
        "name": "Property Intelligence",
        "description": "Parcel data via Regrid",
        "enabled_by_default": True,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development", "staging", "production"],
        "requires_api_key": "REGRID_API_TOKEN"
    },
    
    # Experimental features (disabled by default)
    "realtime_sync": {
        "name": "Real-time Team Sync",
        "description": "WebSocket-based real-time updates",
        "enabled_by_default": False,
        "roles": [UserRole.ADMIN, UserRole.MANAGER],
        "environments": ["development"]
    },
    "ai_damage_detection": {
        "name": "AI Damage Detection",
        "description": "Automatic damage identification in photos",
        "enabled_by_default": False,
        "roles": [UserRole.ADMIN],
        "environments": ["development"]
    },
    "offline_mode": {
        "name": "Offline Mode",
        "description": "Work without internet connection",
        "enabled_by_default": False,
        "roles": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
        "environments": ["development"]
    }
}


# ============================================
# FEATURE FLAG FUNCTIONS
# ============================================

def get_current_environment() -> str:
    """Get current environment from env vars"""
    return os.environ.get("ENVIRONMENT", "development")


def is_feature_enabled(
    feature_key: str,
    user: Optional[dict] = None,
    environment: Optional[str] = None
) -> bool:
    """
    Check if a feature is enabled for a user in the current environment.
    
    Args:
        feature_key: The feature flag key
        user: User dict with 'role' field (optional)
        environment: Override environment (optional)
    
    Returns:
        True if feature is enabled, False otherwise
    """
    if feature_key not in FEATURE_FLAGS:
        return False
    
    feature = FEATURE_FLAGS[feature_key]
    env = environment or get_current_environment()
    
    # Check environment
    if env not in feature.get("environments", []):
        return False
    
    # Check if feature has required API key
    required_key = feature.get("requires_api_key")
    if required_key and not os.environ.get(required_key):
        return False
    
    # If no user provided, return default enabled state
    if not user:
        return feature.get("enabled_by_default", True)
    
    # Check user role
    user_role_str = user.get("role", "client")
    try:
        user_role = UserRole(user_role_str)
    except ValueError:
        return False
    
    allowed_roles = feature.get("roles", [])
    return user_role in allowed_roles


def get_feature_config(feature_key: str) -> Optional[Dict[str, Any]]:
    """Get full configuration for a feature flag"""
    return FEATURE_FLAGS.get(feature_key)


def get_enabled_features(
    user: Optional[dict] = None,
    environment: Optional[str] = None
) -> List[str]:
    """Get list of all enabled features for a user"""
    return [
        key for key in FEATURE_FLAGS.keys()
        if is_feature_enabled(key, user, environment)
    ]


def get_all_features() -> Dict[str, Dict[str, Any]]:
    """Get all feature flag definitions"""
    return FEATURE_FLAGS.copy()


def get_feature_status(
    user: Optional[dict] = None,
    environment: Optional[str] = None
) -> Dict[str, bool]:
    """Get enabled/disabled status for all features"""
    return {
        key: is_feature_enabled(key, user, environment)
        for key in FEATURE_FLAGS.keys()
    }


# ============================================
# API ENDPOINT FOR FEATURE FLAGS
# ============================================

# This can be imported in server.py to expose feature flags to frontend

from fastapi import APIRouter, Depends
from dependencies import get_current_user

feature_flags_router = APIRouter(prefix="/api/features", tags=["Features"])


@feature_flags_router.get("/")
async def get_features(current_user: dict = Depends(get_current_user)):
    """Get all feature flags with enabled status for current user"""
    return {
        "features": get_feature_status(current_user),
        "enabled": get_enabled_features(current_user),
        "environment": get_current_environment()
    }


@feature_flags_router.get("/{feature_key}")
async def get_feature(
    feature_key: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a specific feature is enabled"""
    config = get_feature_config(feature_key)
    if not config:
        return {"enabled": False, "error": "Feature not found"}
    
    return {
        "key": feature_key,
        "name": config.get("name"),
        "enabled": is_feature_enabled(feature_key, current_user),
        "description": config.get("description")
    }


# ============================================
# EXPORT
# ============================================

__all__ = [
    'FEATURE_FLAGS',
    'is_feature_enabled',
    'get_feature_config',
    'get_enabled_features',
    'get_all_features',
    'get_feature_status',
    'get_current_environment',
    'feature_flags_router'
]
