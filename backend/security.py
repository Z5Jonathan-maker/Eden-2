"""
Eden Security Module - Centralized permissions and security utilities

This module provides:
- Centralized permission checking
- Role-based access control
- Rate limiting
- JWT hardening helpers
"""

from functools import wraps
from typing import Optional, List, Callable
from datetime import datetime, timezone, timedelta
import time
from collections import defaultdict

from fastapi import HTTPException, Request, Depends
from core import UserRole, get_role_level, has_min_role

# ============================================
# PERMISSION DEFINITIONS
# ============================================

# Define permissions by resource and action
PERMISSIONS = {
    # Claims
    "claims:create": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "claims:read": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
    "claims:update": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "claims:delete": [UserRole.ADMIN],
    "claims:archive": [UserRole.ADMIN, UserRole.MANAGER],
    "claims:restore": [UserRole.ADMIN],
    "claims:assign": [UserRole.ADMIN, UserRole.MANAGER],
    
    # Inspections
    "inspections:create": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "inspections:read": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
    "inspections:update": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "inspections:delete": [UserRole.ADMIN, UserRole.MANAGER],
    
    # Photos
    "photos:upload": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "photos:read": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
    "photos:delete": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    
    # Contracts
    "contracts:create": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "contracts:read": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER, UserRole.CLIENT],
    "contracts:send": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "contracts:delete": [UserRole.ADMIN],
    
    # Harvest / Canvassing
    "harvest:create": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "harvest:read": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "harvest:update": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    "harvest:delete": [UserRole.ADMIN, UserRole.MANAGER],
    
    # Users
    "users:create": [UserRole.ADMIN],
    "users:read": [UserRole.ADMIN, UserRole.MANAGER],
    "users:update": [UserRole.ADMIN],
    "users:delete": [UserRole.ADMIN],
    
    # Settings
    "settings:read": [UserRole.ADMIN],
    "settings:update": [UserRole.ADMIN],
    
    # AI
    "ai:chat": [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADJUSTER],
    
    # Reports
    "reports:read": [UserRole.ADMIN, UserRole.MANAGER],
    "reports:export": [UserRole.ADMIN, UserRole.MANAGER],
}


def check_permission(user: dict, permission: str) -> bool:
    """
    Check if user has a specific permission.
    
    Args:
        user: User dict with 'role' field
        permission: Permission string like 'claims:create'
    
    Returns:
        True if user has permission, False otherwise
    """
    if not user:
        return False
    
    user_role_str = user.get("role", "client")
    try:
        user_role = UserRole(user_role_str)
    except ValueError:
        return False
    
    allowed_roles = PERMISSIONS.get(permission, [])
    return user_role in allowed_roles


def require_permission(permission: str):
    """
    Dependency factory that checks for a specific permission.
    
    Usage:
        @router.post("/claims/")
        async def create_claim(
            current_user: dict = Depends(require_permission("claims:create"))
        ):
            ...
    """
    def permission_checker(current_user: dict = None):
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        if not check_permission(current_user, permission):
            raise HTTPException(
                status_code=403, 
                detail=f"Permission denied: {permission}"
            )
        
        return current_user
    
    return permission_checker


def can_access_resource(user: dict, resource: dict, resource_type: str) -> bool:
    """
    Check if user can access a specific resource instance.
    
    Rules:
    - Admin/Manager can access everything
    - Adjuster can access resources they created or are assigned to
    - Client can only access their own resources
    """
    if not user or not resource:
        return False
    
    user_role = user.get("role", "client")
    user_id = user.get("id")
    user_email = user.get("email")
    
    # Admin and Manager have full access
    if user_role in [UserRole.ADMIN.value, UserRole.MANAGER.value]:
        return True
    
    # Adjuster access rules
    if user_role == UserRole.ADJUSTER.value:
        # Check if assigned to
        if resource.get("assigned_to") == user.get("full_name"):
            return True
        if resource.get("assigned_to_id") == user_id:
            return True
        # Check if created by
        if resource.get("created_by") == user_id:
            return True
        if resource.get("user_id") == user_id:
            return True
        return False
    
    # Client access rules
    if user_role == UserRole.CLIENT.value:
        # Can only access their own resources
        if resource.get("client_email") == user_email:
            return True
        if resource.get("client_id") == user_id:
            return True
        return False
    
    return False


# ============================================
# RATE LIMITING
# ============================================

class RateLimiter:
    """
    Simple in-memory rate limiter.
    For production, use Redis-based rate limiting.
    """
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked_until = {}
    
    def is_rate_limited(
        self, 
        key: str, 
        limit: int = 60, 
        window: int = 60,
        block_duration: int = 300
    ) -> tuple:
        """
        Check if a key is rate limited.
        
        Args:
            key: Identifier (e.g., user_id or IP)
            limit: Max requests per window
            window: Time window in seconds
            block_duration: How long to block after exceeding limit
        
        Returns:
            (is_limited: bool, remaining: int, reset_time: float)
        """
        now = time.time()
        
        # Check if currently blocked
        if key in self.blocked_until:
            if now < self.blocked_until[key]:
                return (True, 0, self.blocked_until[key])
            else:
                del self.blocked_until[key]
        
        # Clean old requests
        window_start = now - window
        self.requests[key] = [t for t in self.requests[key] if t > window_start]
        
        # Check limit
        request_count = len(self.requests[key])
        remaining = max(0, limit - request_count)
        
        if request_count >= limit:
            # Block the key
            self.blocked_until[key] = now + block_duration
            return (True, 0, self.blocked_until[key])
        
        # Record this request
        self.requests[key].append(now)
        
        return (False, remaining - 1, now + window)
    
    def clear(self, key: str):
        """Clear rate limit data for a key"""
        if key in self.requests:
            del self.requests[key]
        if key in self.blocked_until:
            del self.blocked_until[key]


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations by endpoint type
RATE_LIMITS = {
    "auth": {"limit": 10, "window": 60, "block": 300},      # 10/min, block 5min
    "ai": {"limit": 30, "window": 60, "block": 60},         # 30/min, block 1min
    "upload": {"limit": 50, "window": 60, "block": 120},    # 50/min, block 2min
    "api": {"limit": 100, "window": 60, "block": 60},       # 100/min, block 1min
}


def check_rate_limit(
    key: str, 
    endpoint_type: str = "api"
) -> None:
    """
    Check rate limit and raise HTTPException if exceeded.
    
    Usage:
        check_rate_limit(user_id, "ai")
    """
    config = RATE_LIMITS.get(endpoint_type, RATE_LIMITS["api"])
    
    is_limited, remaining, reset_time = rate_limiter.is_rate_limited(
        key,
        limit=config["limit"],
        window=config["window"],
        block_duration=config["block"]
    )
    
    if is_limited:
        retry_after = int(reset_time - time.time())
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Remaining": "0"
            }
        )


def rate_limit_dependency(endpoint_type: str = "api"):
    """
    FastAPI dependency for rate limiting.
    
    Usage:
        @router.post("/ai/chat")
        async def chat(
            request: Request,
            _: None = Depends(rate_limit_dependency("ai")),
            current_user: dict = Depends(get_current_user)
        ):
            ...
    """
    async def check_limit(request: Request):
        # Use user ID if authenticated, otherwise IP
        client_id = request.state.user_id if hasattr(request.state, 'user_id') else request.client.host
        check_rate_limit(f"{endpoint_type}:{client_id}", endpoint_type)
    
    return check_limit


# ============================================
# JWT UTILITIES
# ============================================

# Token expiration settings
TOKEN_EXPIRE_MINUTES = 60  # Short-lived access tokens
REFRESH_TOKEN_EXPIRE_DAYS = 7  # Longer refresh tokens


def is_token_expired(exp_timestamp: int) -> bool:
    """Check if a token timestamp is expired"""
    return datetime.now(timezone.utc).timestamp() > exp_timestamp


def get_token_expiry(minutes: int = TOKEN_EXPIRE_MINUTES) -> datetime:
    """Get expiry datetime for a new token"""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def get_refresh_token_expiry(days: int = REFRESH_TOKEN_EXPIRE_DAYS) -> datetime:
    """Get expiry datetime for a refresh token"""
    return datetime.now(timezone.utc) + timedelta(days=days)


# ============================================
# EXPORT
# ============================================

__all__ = [
    # Permission checking
    'PERMISSIONS',
    'check_permission',
    'require_permission',
    'can_access_resource',
    
    # Rate limiting
    'RateLimiter',
    'rate_limiter',
    'RATE_LIMITS',
    'check_rate_limit',
    'rate_limit_dependency',
    
    # JWT utilities
    'TOKEN_EXPIRE_MINUTES',
    'REFRESH_TOKEN_EXPIRE_DAYS',
    'is_token_expired',
    'get_token_expiry',
    'get_refresh_token_expiry',
]
