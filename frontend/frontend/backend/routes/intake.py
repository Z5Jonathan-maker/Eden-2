"""
Client Intake Forms — Public-facing digital claim intake system.

Allows potential clients to submit claim information digitally instead of
paper forms or phone calls. Creates a tracked submission that staff can
review and convert into a full Eden claim.

Public endpoints require NO authentication.
Staff endpoints require active user session.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime, timezone
from collections import defaultdict
import logging
import re
import time
import uuid
import secrets

from dependencies import db, get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/intake", tags=["Client Intake"])

# ============================================
# CONSTANTS
# ============================================

LOSS_TYPES = ("wind", "water", "fire", "hail", "hurricane", "other")
PROPERTY_TYPES = ("residential", "commercial")
CONTACT_METHODS = ("email", "phone", "text")
REFERRAL_SOURCES = ("referral", "google", "social", "door_knock", "other")
SUBMISSION_STATUSES = ("new", "reviewed", "converted", "rejected")

# Map intake loss_type to Eden claim_type display names
LOSS_TYPE_TO_CLAIM_TYPE = {
    "wind": "Wind Damage",
    "water": "Water Damage",
    "fire": "Fire Damage",
    "hail": "Hail Damage",
    "hurricane": "Hurricane Damage",
    "other": "Other",
}

US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR", "VI", "GU", "AS", "MP",
}

MAX_TEXT_LENGTH = 2000
MAX_SHORT_TEXT = 200
PHONE_PATTERN = re.compile(r"^[\d\s\-\(\)\+\.]{7,20}$")
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

# ============================================
# RATE LIMITER (intake-specific, stricter)
# ============================================

_intake_rate_store: dict[str, list[float]] = defaultdict(list)
INTAKE_RATE_LIMIT = 5
INTAKE_RATE_WINDOW = 60  # seconds


def _check_intake_rate_limit(ip: str) -> bool:
    """Return True if request should be BLOCKED."""
    now = time.time()
    cutoff = now - INTAKE_RATE_WINDOW
    # Prune old entries
    _intake_rate_store[ip] = [t for t in _intake_rate_store[ip] if t > cutoff]
    if len(_intake_rate_store[ip]) >= INTAKE_RATE_LIMIT:
        return True
    _intake_rate_store[ip].append(now)
    return False


# ============================================
# INPUT SANITIZATION
# ============================================

def _sanitize(value: Optional[str], max_length: int = MAX_SHORT_TEXT) -> Optional[str]:
    """Strip HTML tags, collapse whitespace, enforce length limit."""
    if value is None:
        return None
    cleaned = HTML_TAG_PATTERN.sub("", value)
    cleaned = " ".join(cleaned.split())
    return cleaned[:max_length].strip()


def _sanitize_long(value: Optional[str]) -> Optional[str]:
    """Sanitize longer text fields (descriptions, notes)."""
    return _sanitize(value, max_length=MAX_TEXT_LENGTH)


# ============================================
# REQUEST / RESPONSE MODELS
# ============================================

class IntakeFormSubmission(BaseModel):
    """Public intake form payload — submitted by potential clients."""

    # Client info
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=200)
    phone: str = Field(..., max_length=20)
    preferred_contact_method: Literal["email", "phone", "text"] = "phone"

    # Property info
    address: str = Field(..., min_length=3, max_length=300)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., min_length=5, max_length=10)
    property_type: Literal["residential", "commercial"] = "residential"

    # Loss info
    date_of_loss: str = Field(..., max_length=20)
    loss_type: Literal["wind", "water", "fire", "hail", "hurricane", "other"]
    loss_description: str = Field(..., min_length=10, max_length=MAX_TEXT_LENGTH)

    # Insurance info
    carrier_name: str = Field(..., min_length=1, max_length=200)
    policy_number: Optional[str] = Field(default=None, max_length=100)
    has_filed_with_carrier: bool = False
    carrier_claim_number: Optional[str] = Field(default=None, max_length=100)

    # Additional details
    has_previous_damage: bool = False
    is_habitable: bool = True
    has_photos: bool = False
    emergency_repairs_done: bool = False
    how_did_you_hear: Literal["referral", "google", "social", "door_knock", "other"] = "other"
    referral_name: Optional[str] = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_PATTERN.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_PATTERN.match(v):
            raise ValueError("Invalid phone number")
        return v

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in US_STATE_CODES:
            raise ValueError("Invalid US state code")
        return v

    @field_validator("zip_code")
    @classmethod
    def validate_zip(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{5}(-\d{4})?$", v):
            raise ValueError("Invalid ZIP code (use 12345 or 12345-6789)")
        return v

    @field_validator("date_of_loss")
    @classmethod
    def validate_date_of_loss(cls, v: str) -> str:
        v = v.strip()
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue
        raise ValueError("Invalid date format — use YYYY-MM-DD or MM/DD/YYYY")


class IntakeStatusResponse(BaseModel):
    """Public-facing status response (limited info)."""
    submission_token: str
    status: str
    submitted_at: str
    client_name: str


class IntakeUpdateRequest(BaseModel):
    """Staff update to a submission (notes, status)."""
    notes: Optional[str] = Field(default=None, max_length=MAX_TEXT_LENGTH)
    status: Optional[Literal["new", "reviewed", "converted", "rejected"]] = None


class IntakeRejectRequest(BaseModel):
    """Rejection reason when declining a submission."""
    reason: str = Field(..., min_length=3, max_length=MAX_TEXT_LENGTH)


class IntakeConvertRequest(BaseModel):
    """Options when converting a submission to a claim."""
    assigned_to_user_id: Optional[str] = None
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    notes: Optional[str] = Field(default=None, max_length=MAX_TEXT_LENGTH)


# ============================================
# HELPERS
# ============================================

def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting proxy headers when configured."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _build_submission_doc(
    form: IntakeFormSubmission,
    ip_address: str,
    user_agent: str,
) -> dict:
    """Build the MongoDB document for a new intake submission."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "submission_token": secrets.token_urlsafe(32),

        # Client info (sanitized)
        "first_name": _sanitize(form.first_name),
        "last_name": _sanitize(form.last_name),
        "email": form.email,
        "phone": form.phone,
        "preferred_contact_method": form.preferred_contact_method,

        # Property info (sanitized)
        "address": _sanitize(form.address, max_length=300),
        "city": _sanitize(form.city),
        "state": form.state,
        "zip_code": form.zip_code,
        "property_type": form.property_type,

        # Loss info (sanitized)
        "date_of_loss": form.date_of_loss,
        "loss_type": form.loss_type,
        "loss_description": _sanitize_long(form.loss_description),

        # Insurance info (sanitized)
        "carrier_name": _sanitize(form.carrier_name),
        "policy_number": _sanitize(form.policy_number),
        "has_filed_with_carrier": form.has_filed_with_carrier,
        "carrier_claim_number": _sanitize(form.carrier_claim_number),

        # Additional
        "has_previous_damage": form.has_previous_damage,
        "is_habitable": form.is_habitable,
        "has_photos": form.has_photos,
        "emergency_repairs_done": form.emergency_repairs_done,
        "how_did_you_hear": form.how_did_you_hear,
        "referral_name": _sanitize(form.referral_name),

        # Metadata
        "ip_address": ip_address,
        "user_agent": _sanitize(user_agent, max_length=500),
        "submitted_at": now,

        # Processing state
        "status": "new",
        "reviewed_by": None,
        "reviewed_at": None,
        "claim_id": None,
        "notes": None,
    }


async def _generate_claim_number() -> str:
    """Generate a unique claim number in Eden format: CC-YYYYMMDD-XXXX."""
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    # Count today's claims for sequential suffix
    prefix = f"CC-{date_part}-"
    count = await db.claims.count_documents(
        {"claim_number": {"$regex": f"^{re.escape(prefix)}"}}
    )
    return f"{prefix}{count + 1:04d}"


async def _notify_admins_new_submission(submission: dict) -> None:
    """Create notifications for all admin/manager users about a new intake submission."""
    try:
        from routes.notifications import create_notification

        client_name = f"{submission['first_name']} {submission['last_name']}"
        loss_label = LOSS_TYPE_TO_CLAIM_TYPE.get(submission["loss_type"], submission["loss_type"])
        body = (
            f"New intake from {client_name} — {loss_label} at "
            f"{submission['city']}, {submission['state']}."
        )

        admin_cursor = db.users.find(
            {"role": {"$in": ["admin", "manager"]}, "is_active": True},
            {"id": 1, "_id": 0},
        )
        admins = await admin_cursor.to_list(length=100)

        for admin in admins:
            await create_notification(
                user_id=admin["id"],
                type="claim_created",
                title="New Client Intake Submission",
                body=body,
                cta_label="Review Submission",
                cta_route=f"/intake/{submission['id']}",
                data={
                    "submission_id": submission["id"],
                    "client_name": client_name,
                    "loss_type": submission["loss_type"],
                    "source": "intake_form",
                },
            )
        logger.info(
            "Notified %d admins about new intake submission %s",
            len(admins),
            submission["id"],
        )
    except Exception as exc:
        logger.error("Failed to send intake notifications: %s", exc)


# ============================================
# PUBLIC ENDPOINTS (NO AUTH)
# ============================================

@router.post("/submit")
async def submit_intake_form(form: IntakeFormSubmission, request: Request):
    """
    Public endpoint — submit a new client intake form.

    Rate limited to 5 submissions per minute per IP.
    Returns a submission token for status tracking.
    """
    client_ip = _get_client_ip(request)

    # Rate limit check
    if _check_intake_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many submissions. Please wait a minute and try again.",
        )

    user_agent = request.headers.get("user-agent", "")

    # Build and persist submission
    submission = _build_submission_doc(form, client_ip, user_agent)
    await db.intake_submissions.insert_one(submission)

    logger.info(
        "Intake submission created: id=%s, ip=%s, loss_type=%s",
        submission["id"],
        client_ip,
        submission["loss_type"],
    )

    # Notify staff (fire-and-forget, non-blocking)
    await _notify_admins_new_submission(submission)

    return {
        "success": True,
        "submission_token": submission["submission_token"],
        "message": (
            "Your claim intake has been submitted successfully. "
            "A public adjuster will review your submission and contact you shortly."
        ),
        "status_url": f"/api/intake/status/{submission['submission_token']}",
    }


@router.get("/status/{submission_token}")
async def get_submission_status(submission_token: str):
    """
    Public endpoint — check the status of a submission using the token.

    Returns limited information (no internal notes or reviewer details).
    """
    if not submission_token or len(submission_token) > 64:
        raise HTTPException(status_code=400, detail="Invalid submission token")

    submission = await db.intake_submissions.find_one(
        {"submission_token": submission_token},
        {"_id": 0, "submission_token": 1, "status": 1, "submitted_at": 1,
         "first_name": 1, "last_name": 1},
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Map internal status to client-friendly labels
    status_labels = {
        "new": "Received — Pending Review",
        "reviewed": "Under Review by Our Team",
        "converted": "Accepted — Claim Created",
        "rejected": "Unable to Proceed",
    }

    return {
        "success": True,
        "data": {
            "submission_token": submission["submission_token"],
            "status": submission["status"],
            "status_label": status_labels.get(submission["status"], submission["status"]),
            "submitted_at": submission["submitted_at"],
            "client_name": f"{submission['first_name']} {submission['last_name']}",
        },
    }


# ============================================
# STAFF ENDPOINTS (AUTH REQUIRED)
# ============================================

@router.get("/submissions")
async def list_submissions(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    source: Optional[str] = Query(default=None, description="Filter by how_did_you_hear"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """List all intake submissions with optional filtering and pagination."""
    query: dict = {}

    if status and status in SUBMISSION_STATUSES:
        query["status"] = status

    if source and source in REFERRAL_SOURCES:
        query["how_did_you_hear"] = source

    total = await db.intake_submissions.count_documents(query)
    skip = (page - 1) * limit

    cursor = db.intake_submissions.find(query, {"_id": 0}).sort(
        "submitted_at", -1
    ).skip(skip).limit(limit)
    submissions = await cursor.to_list(length=limit)

    return {
        "success": True,
        "data": submissions,
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


@router.get("/stats")
async def get_intake_stats(
    current_user: dict = Depends(get_current_active_user),
):
    """Submission analytics — counts by status, source, and conversion rate."""
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    pipeline_source = [
        {"$group": {"_id": "$how_did_you_hear", "count": {"$sum": 1}}},
    ]

    status_cursor = db.intake_submissions.aggregate(pipeline_status)
    source_cursor = db.intake_submissions.aggregate(pipeline_source)

    status_counts = {doc["_id"]: doc["count"] async for doc in status_cursor}
    source_counts = {doc["_id"]: doc["count"] async for doc in source_cursor}

    total = sum(status_counts.values())
    converted = status_counts.get("converted", 0)
    conversion_rate = round((converted / total) * 100, 1) if total > 0 else 0.0

    return {
        "success": True,
        "data": {
            "total_submissions": total,
            "by_status": status_counts,
            "by_source": source_counts,
            "conversion_rate": conversion_rate,
            "converted_count": converted,
        },
    }


@router.get("/submissions/{submission_id}")
async def get_submission(
    submission_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get full details of a single intake submission."""
    submission = await db.intake_submissions.find_one(
        {"id": submission_id}, {"_id": 0}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return {"success": True, "data": submission}


@router.post("/submissions/{submission_id}/convert")
async def convert_to_claim(
    submission_id: str,
    body: IntakeConvertRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Convert an intake submission into a full Eden claim.

    - Creates a new claim with auto-populated fields from the submission.
    - Updates the submission status to 'converted' with the new claim_id.
    - Notifies the assigned adjuster.
    """
    submission = await db.intake_submissions.find_one(
        {"id": submission_id}, {"_id": 0}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission["status"] == "converted":
        raise HTTPException(
            status_code=409,
            detail=f"Already converted to claim {submission.get('claim_id')}",
        )
    if submission["status"] == "rejected":
        raise HTTPException(
            status_code=409,
            detail="Cannot convert a rejected submission. Update status first.",
        )

    now = datetime.now(timezone.utc).isoformat()
    claim_number = await _generate_claim_number()

    # Determine assignee
    assigned_user = None
    assigned_name = current_user.get("full_name", "Unassigned")
    if body.assigned_to_user_id:
        assigned_user = await db.users.find_one(
            {"id": body.assigned_to_user_id, "is_active": True}, {"_id": 0}
        )
        if assigned_user:
            assigned_name = assigned_user.get("full_name", assigned_name)

    # Build the claim document matching Eden's Claim model
    full_address = (
        f"{submission['address']}, {submission['city']}, "
        f"{submission['state']} {submission['zip_code']}"
    )
    client_name = f"{submission['first_name']} {submission['last_name']}"
    claim_type = LOSS_TYPE_TO_CLAIM_TYPE.get(
        submission["loss_type"], "Other"
    )

    claim_id = str(uuid.uuid4())
    claim_doc = {
        "id": claim_id,
        "claim_number": claim_number,
        "client_name": client_name,
        "client_email": submission["email"],
        "client_phone": submission["phone"],
        "property_address": full_address,
        "date_of_loss": submission["date_of_loss"],
        "claim_type": claim_type,
        "policy_number": submission.get("policy_number") or "",
        "estimated_value": 0,
        "description": submission.get("loss_description") or "",
        "carrier_name": submission.get("carrier_name") or "",
        "carrier_claim_number": submission.get("carrier_claim_number") or "",
        "carrier_adjuster_name": "",
        "carrier_adjuster_email": "",
        "carrier_adjuster_phone": "",
        "insurance_company_email": "",
        "actual_cash_value": None,
        "replacement_cost_value": None,
        "deductible": None,
        "depreciation": None,
        "net_claim_value": None,
        "settlement_amount": None,
        "mortgage_company": "",
        "status": "New",
        "assigned_to": assigned_name,
        "priority": body.priority,
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
        "stage": "intake",
        "next_actions_firm": "Review intake submission and schedule inspection",
        "next_actions_client": "Gather photos and documentation of damage",
        "last_client_update_at": None,
        "public_status_token": uuid.uuid4().hex,
        "source": "intake_form",
        "intake_submission_id": submission_id,
    }

    await db.claims.insert_one(claim_doc)

    # Update submission with conversion info
    await db.intake_submissions.update_one(
        {"id": submission_id},
        {
            "$set": {
                "status": "converted",
                "claim_id": claim_id,
                "reviewed_by": current_user["id"],
                "reviewed_at": now,
                "notes": body.notes or submission.get("notes"),
            }
        },
    )

    # Notify assigned adjuster (if different from converter)
    try:
        from routes.notifications import create_notification

        target_user_id = (
            body.assigned_to_user_id
            if body.assigned_to_user_id
            else current_user["id"]
        )
        await create_notification(
            user_id=target_user_id,
            type="claim_assigned",
            title="New Claim from Intake Form",
            body=f"Claim {claim_number} for {client_name} — {claim_type} — has been assigned to you.",
            cta_label="View Claim",
            cta_route=f"/claims/{claim_id}",
            data={
                "claim_id": claim_id,
                "claim_number": claim_number,
                "source": "intake_conversion",
            },
        )
    except Exception as exc:
        logger.error("Failed to notify adjuster on intake conversion: %s", exc)

    logger.info(
        "Intake submission %s converted to claim %s (claim_number=%s) by user %s",
        submission_id,
        claim_id,
        claim_number,
        current_user["id"],
    )

    return {
        "success": True,
        "data": {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "assigned_to": assigned_name,
            "message": f"Claim {claim_number} created successfully from intake submission.",
        },
    }


@router.post("/submissions/{submission_id}/reject")
async def reject_submission(
    submission_id: str,
    body: IntakeRejectRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Reject an intake submission with a reason."""
    submission = await db.intake_submissions.find_one(
        {"id": submission_id}, {"_id": 0, "id": 1, "status": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission["status"] == "converted":
        raise HTTPException(
            status_code=409,
            detail="Cannot reject — submission already converted to a claim.",
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.intake_submissions.update_one(
        {"id": submission_id},
        {
            "$set": {
                "status": "rejected",
                "reviewed_by": current_user["id"],
                "reviewed_at": now,
                "notes": _sanitize_long(body.reason),
            }
        },
    )

    logger.info(
        "Intake submission %s rejected by user %s",
        submission_id,
        current_user["id"],
    )

    return {
        "success": True,
        "message": "Submission rejected.",
    }


@router.patch("/submissions/{submission_id}")
async def update_submission(
    submission_id: str,
    body: IntakeUpdateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Update notes or status on a submission."""
    submission = await db.intake_submissions.find_one(
        {"id": submission_id}, {"_id": 0, "id": 1, "status": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    update_fields: dict = {
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }

    if body.notes is not None:
        update_fields["notes"] = _sanitize_long(body.notes)

    if body.status is not None:
        # Prevent illegal transitions
        if submission["status"] == "converted" and body.status != "converted":
            raise HTTPException(
                status_code=409,
                detail="Cannot change status of a converted submission.",
            )
        update_fields["status"] = body.status

    await db.intake_submissions.update_one(
        {"id": submission_id},
        {"$set": update_fields},
    )

    return {
        "success": True,
        "message": "Submission updated.",
    }
