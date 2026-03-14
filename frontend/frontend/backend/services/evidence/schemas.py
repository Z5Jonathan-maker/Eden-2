"""Typed schemas for evidence ingestion/timeline/reporting."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict

from .constants import REPORT_TYPES


class ClaimIdentityProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    claim_id: str
    policyholder_names: List[str] = Field(default_factory=list)
    addresses: List[str] = Field(default_factory=list)
    policy_numbers: List[str] = Field(default_factory=list)
    claim_numbers: List[str] = Field(default_factory=list)
    carrier_names: List[str] = Field(default_factory=list)
    adjuster_emails: List[str] = Field(default_factory=list)
    subject_patterns: List[str] = Field(default_factory=list)


class IngestionRunCounts(BaseModel):
    fetched_messages: int = 0
    ingested_emails: int = 0
    ingested_attachments: int = 0
    review_queued: int = 0
    dedupe_hits: int = 0
    rejected: int = 0
    extraction_errors: int = 0
    errors: int = 0


class IngestionRunCreate(BaseModel):
    mode: Literal["manual", "scheduled"] = "manual"
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    idempotency_key: Optional[str] = None


class ReviewDecision(BaseModel):
    tags: List[str] = Field(default_factory=list)
    note: Optional[str] = ""


class RejectDecision(BaseModel):
    reason: str


class ReportGenerateRequest(BaseModel):
    report_type: Literal[REPORT_TYPES[0], REPORT_TYPES[1]]
    template_id: Optional[str] = None
    template_version: Optional[int] = None
    options: Dict[str, Any] = Field(default_factory=dict)


class ShareLinkRequest(BaseModel):
    expires_hours: int = Field(default=72, ge=1, le=168)
