from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

# Role and Permission Definitions
ROLES = {
    "admin": {
        "level": 100,
        "permissions": [
            "users.create", "users.read", "users.update", "users.delete",
            "claims.create", "claims.read", "claims.read_all", "claims.update", "claims.delete", "claims.assign",
            "documents.create",
            "settlements.approve", "settlements.approve_all",
            "reports.view", "reports.export",
            "settings.manage", "integrations.manage",
            "data.import", "data.export",
            "qa.run", "university.access"
        ]
    },
    "manager": {
        "level": 75,
        "permissions": [
            "users.read",
            "claims.create", "claims.read", "claims.read_all", "claims.update", "claims.assign",
            "documents.create",
            "settlements.approve",
            "reports.view", "reports.export",
            "data.export",
            "qa.run", "university.access"
        ]
    },
    "adjuster": {
        "level": 50,
        "permissions": [
            "claims.create", "claims.read", "claims.update",
            "documents.create",
            "reports.view",
            "university.access"
        ]
    },
    "client": {
        "level": 10,
        "permissions": [
            "claims.read_own",
            "documents.create",
            "university.access"
        ]
    }
}

def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission"""
    role_data = ROLES.get(role, ROLES["client"])
    return permission in role_data["permissions"]

def get_role_level(role: str) -> int:
    """Get the authority level of a role"""
    return ROLES.get(role, ROLES["client"])["level"]

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = Field(default="adjuster")  # admin, manager, adjuster, client

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    model_config = ConfigDict(
        ser_json_timedelta='float',
        json_encoders={
            datetime: lambda v: v.isoformat() if isinstance(v, datetime) else v
        }
    )
    
    def has_permission(self, permission: str) -> bool:
        return has_permission(self.role, permission)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Claim Models
class ClaimBase(BaseModel):
    claim_number: str
    client_name: str
    client_email: Optional[str] = ""
    property_address: str
    date_of_loss: Optional[str] = ""
    claim_type: str = "Water Damage"
    policy_number: Optional[str] = ""
    estimated_value: float = 0
    description: Optional[str] = None

class ClaimCreate(ClaimBase):
    pass

class ClaimUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    estimated_value: Optional[float] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    # New client status fields
    stage: Optional[str] = None  # intake, inspection, negotiation, settlement, closed
    next_actions_firm: Optional[str] = None
    next_actions_client: Optional[str] = None

class Claim(ClaimBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "New"
    assigned_to: Optional[str] = None
    priority: str = "Medium"
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # New client status fields
    stage: str = "intake"  # intake, inspection, negotiation, settlement, closed
    next_actions_firm: Optional[str] = None
    next_actions_client: Optional[str] = None
    last_client_update_at: Optional[datetime] = None

# Note Models
class NoteCreate(BaseModel):
    claim_id: str
    content: str
    tags: Optional[List[str]] = []

class Note(NoteCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Document Models
class DocumentCreate(BaseModel):
    claim_id: str
    name: str
    type: str
    size: str

class Document(DocumentCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    file_path: Optional[str] = None

# Inspection Models
class InspectionCreate(BaseModel):
    claim_id: str
    property_address: str

class InspectionRoom(BaseModel):
    name: str
    photos: int
    notes: str
    condition: str

class Inspection(InspectionCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    inspector_id: str
    inspector_name: str
    date: str
    status: str = "In Progress"
    rooms: List[InspectionRoom] = []
    total_photos: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Notification Models
class NotificationCreate(BaseModel):
    user_id: str
    type: str  # claim_created, claim_assigned, claim_status_changed, note_added
    title: str
    message: str
    claim_id: Optional[str] = None
    claim_number: Optional[str] = None

class Notification(NotificationCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
