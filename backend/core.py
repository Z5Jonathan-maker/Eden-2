"""
Eden Platform Core - Backend Shared Utilities

This module provides shared functionality across all backend features:
- Standardized status enums
- Error handling utilities
- Response models
- Validation helpers
- Logging utilities
"""

from enum import Enum
from typing import Optional, Any, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from fastapi import HTTPException
from fastapi.responses import JSONResponse
import logging
import uuid

# ============================================
# LOGGING CONFIGURATION
# ============================================

def get_logger(name: str) -> logging.Logger:
    """Get a configured logger for a module"""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


# ============================================
# STATUS ENUMS (Standardized across app)
# ============================================

class ClaimStatus(str, Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    SUBMITTED = "submitted"
    NEGOTIATING = "negotiating"
    SETTLED = "settled"
    CLOSED = "closed"
    ARCHIVED = "archived"


class InspectionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class PinStatus(str, Enum):
    NOT_HOME = "NH"
    NOT_INTERESTED = "NI"
    CALLBACK = "CB"
    APPOINTMENT = "AP"
    SIGNED = "SG"
    DO_NOT_KNOCK = "DNK"


class ContractStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    SIGNED = "signed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    ADJUSTER = "adjuster"
    CLIENT = "client"


class LossType(str, Enum):
    WIND = "wind"
    WATER = "water"
    FIRE = "fire"
    HAIL = "hail"
    FLOOD = "flood"
    THEFT = "theft"
    OTHER = "other"


# ============================================
# ERROR CODES
# ============================================

class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    UNAUTHORIZED = "UNAUTHORIZED"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    SERVER_ERROR = "SERVER_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


# ============================================
# RESPONSE MODELS
# ============================================

class ErrorDetail(BaseModel):
    """Standardized error response"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SuccessResponse(BaseModel):
    """Standardized success response"""
    success: bool = True
    message: str
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    """Standardized paginated response"""
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 20
    has_more: bool = False


class ListResponse(BaseModel):
    """Simple list response"""
    items: List[Any]
    count: int


# ============================================
# EXCEPTION CLASSES
# ============================================

class EdenException(Exception):
    """Base exception for Eden application"""
    def __init__(
        self, 
        code: ErrorCode, 
        message: str, 
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 400
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code
        super().__init__(message)
    
    def to_response(self) -> JSONResponse:
        return JSONResponse(
            status_code=self.status_code,
            content=ErrorDetail(
                code=self.code.value,
                message=self.message,
                details=self.details
            ).model_dump()
        )


class ValidationError(EdenException):
    """Validation error"""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            code=ErrorCode.VALIDATION_ERROR,
            message=message,
            details=details,
            status_code=400
        )


class NotFoundError(EdenException):
    """Resource not found error"""
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            code=ErrorCode.NOT_FOUND,
            message=f"{resource} not found",
            details={"resource": resource, "identifier": identifier},
            status_code=404
        )


class PermissionDeniedError(EdenException):
    """Permission denied error"""
    def __init__(self, action: str, resource: Optional[str] = None):
        super().__init__(
            code=ErrorCode.PERMISSION_DENIED,
            message=f"Permission denied: {action}",
            details={"action": action, "resource": resource},
            status_code=403
        )


class ConflictError(EdenException):
    """Conflict error (e.g., duplicate resource)"""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            code=ErrorCode.CONFLICT,
            message=message,
            details=details,
            status_code=409
        )


# ============================================
# HELPER FUNCTIONS
# ============================================

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix"""
    uid = str(uuid.uuid4())
    return f"{prefix}_{uid}" if prefix else uid


def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


def now_iso() -> str:
    """Get current UTC datetime as ISO string"""
    return datetime.now(timezone.utc).isoformat()


def parse_datetime(dt_str: str) -> Optional[datetime]:
    """Parse datetime string safely"""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO string"""
    if not dt:
        return None
    return dt.isoformat()


def exclude_mongo_id(doc: dict) -> dict:
    """Remove MongoDB _id from document"""
    if doc and '_id' in doc:
        doc = {k: v for k, v in doc.items() if k != '_id'}
    return doc


def clean_mongo_docs(docs: List[dict]) -> List[dict]:
    """Remove _id from list of MongoDB documents"""
    return [exclude_mongo_id(doc) for doc in docs]


# ============================================
# VALIDATION HELPERS
# ============================================

def validate_required(data: dict, required_fields: List[str]) -> List[str]:
    """
    Validate required fields in a dictionary.
    Returns list of missing field names.
    """
    missing = []
    for field in required_fields:
        value = data.get(field)
        if value is None or value == "":
            missing.append(field)
    return missing


def validate_enum(value: str, enum_class: type, field_name: str) -> None:
    """Validate that a value is a valid enum member"""
    try:
        enum_class(value)
    except ValueError:
        valid_values = [e.value for e in enum_class]
        raise ValidationError(
            f"Invalid {field_name}: '{value}'",
            {"valid_values": valid_values}
        )


def validate_email(email: str) -> bool:
    """Basic email validation"""
    import re
    if not email:
        return False
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Basic phone validation (10-15 digits)"""
    import re
    if not phone:
        return False
    cleaned = re.sub(r'\D', '', phone)
    return 10 <= len(cleaned) <= 15


# ============================================
# AUDIT TRAIL HELPERS
# ============================================

class AuditMixin:
    """Mixin fields for audit trail"""
    created_at: str = Field(default_factory=now_iso)
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


def add_audit_fields(doc: dict, user_email: str, is_create: bool = True) -> dict:
    """Add or update audit fields on a document"""
    now = now_iso()
    
    if is_create:
        doc["created_at"] = now
        doc["created_by"] = user_email
    
    doc["updated_at"] = now
    doc["updated_by"] = user_email
    
    return doc


def create_audit_entry(
    entity_type: str,
    entity_id: str,
    action: str,
    user_email: str,
    changes: Optional[Dict] = None
) -> dict:
    """Create an audit log entry"""
    return {
        "id": generate_id("audit"),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "user_email": user_email,
        "changes": changes,
        "timestamp": now_iso()
    }


# ============================================
# PERMISSION HELPERS
# ============================================

ROLE_HIERARCHY = {
    UserRole.ADMIN: 4,
    UserRole.MANAGER: 3,
    UserRole.ADJUSTER: 2,
    UserRole.CLIENT: 1
}


def get_role_level(role: str) -> int:
    """Get numeric level for a role"""
    try:
        return ROLE_HIERARCHY.get(UserRole(role), 0)
    except ValueError:
        return 0


def has_min_role(user_role: str, required_role: str) -> bool:
    """Check if user has at least the required role level"""
    return get_role_level(user_role) >= get_role_level(required_role)


def can_access_claim(user: dict, claim: dict) -> bool:
    """Check if user can access a specific claim"""
    user_role = user.get("role", "client")
    user_id = user.get("id")
    
    # Admin and Manager can access all
    if user_role in [UserRole.ADMIN.value, UserRole.MANAGER.value]:
        return True
    
    # Adjuster can access their assigned claims
    if user_role == UserRole.ADJUSTER.value:
        return claim.get("assigned_to") == user_id
    
    # Client can access their own claims
    if user_role == UserRole.CLIENT.value:
        return claim.get("client_id") == user_id
    
    return False


# ============================================
# QUERY HELPERS
# ============================================

def build_pagination(page: int = 1, page_size: int = 20, max_size: int = 100) -> tuple:
    """Build pagination parameters (skip, limit)"""
    page = max(1, page)
    page_size = min(max(1, page_size), max_size)
    skip = (page - 1) * page_size
    return skip, page_size


def build_sort(sort_by: str = "created_at", sort_order: str = "desc") -> list:
    """Build MongoDB sort parameter"""
    order = -1 if sort_order.lower() == "desc" else 1
    return [(sort_by, order)]


# Export all
__all__ = [
    # Enums
    'ClaimStatus',
    'InspectionStatus', 
    'PinStatus',
    'ContractStatus',
    'UserRole',
    'LossType',
    'ErrorCode',
    
    # Response models
    'ErrorDetail',
    'SuccessResponse',
    'PaginatedResponse',
    'ListResponse',
    
    # Exceptions
    'EdenException',
    'ValidationError',
    'NotFoundError',
    'PermissionDeniedError',
    'ConflictError',
    
    # Helpers
    'get_logger',
    'generate_id',
    'now_utc',
    'now_iso',
    'parse_datetime',
    'to_iso',
    'exclude_mongo_id',
    'clean_mongo_docs',
    
    # Validation
    'validate_required',
    'validate_enum',
    'validate_email',
    'validate_phone',
    
    # Audit
    'AuditMixin',
    'add_audit_fields',
    'create_audit_entry',
    
    # Permissions
    'ROLE_HIERARCHY',
    'get_role_level',
    'has_min_role',
    'can_access_claim',
    
    # Query
    'build_pagination',
    'build_sort'
]
