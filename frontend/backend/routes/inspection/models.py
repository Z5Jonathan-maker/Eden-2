"""
Inspection Module - Pydantic Models

Request/response models for inspection sessions, photos, annotations, and reports.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid


class PhotoMetadata(BaseModel):
    """Rich metadata for inspection photos"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: Optional[str] = None
    session_id: Optional[str] = None  # Link to inspection session
    filename: str = ""
    original_name: str = ""

    # Location data
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None

    # Timestamps
    captured_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    uploaded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Organization
    room: Optional[str] = None  # e.g., "Kitchen", "Master Bedroom", "Roof"
    category: Optional[str] = None  # e.g., "damage", "before", "after", "overview"
    tags: List[str] = []

    # Annotations
    annotations: Optional[str] = None  # JSON string of annotation data

    # AI-generated
    ai_caption: Optional[str] = None
    ai_damage_assessment: Optional[str] = None

    # Voice notes (matched from session transcript)
    voice_snippet: Optional[str] = None  # Transcript segment matched by timestamp

    # User info
    uploaded_by: str = ""
    uploaded_by_name: str = ""

    # File info
    file_size: int = 0
    mime_type: str = "image/jpeg"

    # Dedup
    sha256_hash: Optional[str] = None

    # Comparison
    is_before: bool = False
    is_after: bool = False
    paired_photo_id: Optional[str] = None  # Link before/after pairs


class PhotoAnnotation(BaseModel):
    """Annotation data for a photo"""
    type: str  # "arrow", "circle", "rectangle", "text", "freehand"
    # Position fields (text and some shapes use x/y; arrow/circle/rect use startX/endX)
    x: Optional[float] = None
    y: Optional[float] = None
    startX: Optional[float] = None
    startY: Optional[float] = None
    endX: Optional[float] = None
    endY: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[List[dict]] = None  # For freehand drawing [{x, y}, ...]
    color: str = "#FF0000"
    strokeWidth: Optional[int] = 3
    text: Optional[str] = None
    fontSize: Optional[int] = 16


class PhotoUploadResponse(BaseModel):
    id: str
    url: str
    thumbnail_url: str
    metadata: dict


class CreateInspectionSession(BaseModel):
    claim_id: str
    name: Optional[str] = None
    notes: Optional[str] = None
    type: str = "initial"  # initial | reinspection | closing


class InspectionSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    name: str = ""
    notes: Optional[str] = None
    type: str = "initial"  # initial | reinspection | closing
    status: str = "in_progress"  # in_progress | completed | archived
    photo_count: int = 0
    created_by: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    rooms_documented: List[str] = []

    # Voice recording fields
    voice_recording_id: Optional[str] = None
    voice_recording_filename: Optional[str] = None
    voice_transcript: Optional[str] = None
    voice_transcribed_at: Optional[str] = None


class InspectionReport(BaseModel):
    """Generated inspection report structure"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    claim_id: str
    report_json: dict  # Structured report sections
    report_markdown: str  # Rendered markdown
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    generated_by: str = ""
    version: int = 1


class PdfExportMode(str, Enum):
    EMAIL_SAFE = "email_safe"
    FULL_FIDELITY = "full_fidelity"


class BulkPhotoAction(BaseModel):
    """Bulk operations on photos"""
    action: str  # "delete" | "recategorize" | "move_room"
    photo_ids: List[str]
    room: Optional[str] = None
    category: Optional[str] = None
