"""
Compliance & Deadline Tracking API — Florida Insurance Law

Tracks statutory deadlines for PA claims under Florida insurance law.
Missing a deadline = malpractice risk. This module ensures every critical
date is surfaced, alerted on, and auditable.

Key Florida statutes tracked:
  - FL 626.9541  — Carrier must acknowledge claim within 14 days
  - FL 627.70131 — Carrier must pay/deny within 90 days of proof of loss
  - FL 627.70152 — Notice of intent to litigate (60 days before suit)
  - Post-2023    — 2-year statute of limitations from date of loss
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import logging
import math

from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/compliance", tags=["Compliance"])
logger = logging.getLogger(__name__)


# ============================================
# ENUMS
# ============================================

class DeadlineType(str, Enum):
    CARRIER_ACKNOWLEDGMENT = "carrier_acknowledgment"
    CARRIER_DECISION = "carrier_decision"
    NOTICE_OF_INTENT = "notice_of_intent"
    SUPPLEMENT_FOLLOWUP = "supplement_followup"
    STATUTE_OF_LIMITATIONS = "statute_of_limitations"
    CONTRACT_RESCISSION = "contract_rescission"
    PROOF_OF_LOSS = "proof_of_loss"
    CUSTOM = "custom"


class DeadlineStatus(str, Enum):
    ACTIVE = "active"
    MET = "met"
    MISSED = "missed"
    WAIVED = "waived"
    EXTENDED = "extended"


class AlertType(str, Enum):
    UPCOMING = "upcoming"
    OVERDUE = "overdue"
    CRITICAL = "critical"


# ============================================
# REQUEST / RESPONSE MODELS
# ============================================

class DeadlineCreate(BaseModel):
    claim_id: str
    claim_number: str
    client_name: str
    deadline_type: DeadlineType
    description: str
    statute_reference: Optional[str] = None
    start_date: str = Field(..., description="ISO date when the clock started")
    deadline_date: str = Field(..., description="ISO date of the deadline")
    alert_days_before: List[int] = Field(default=[30, 14, 7, 3, 1])
    notes: Optional[str] = None


class DeadlineUpdate(BaseModel):
    status: Optional[DeadlineStatus] = None
    deadline_date: Optional[str] = None
    notes: Optional[str] = None
    alert_days_before: Optional[List[int]] = None
    description: Optional[str] = None


class AutoGenerateRequest(BaseModel):
    date_of_loss: str = Field(..., description="ISO date of loss")
    claim_number: str
    client_name: str
    carrier_name: Optional[str] = None
    date_filed: Optional[str] = Field(None, description="ISO date claim was filed with carrier")
    proof_of_loss_date: Optional[str] = Field(None, description="ISO date proof of loss was submitted")
    supplement_date: Optional[str] = Field(None, description="ISO date supplement was submitted")
    contract_signed_date: Optional[str] = Field(None, description="ISO date PA contract was signed")


# ============================================
# FLORIDA DEADLINE DEFINITIONS
# ============================================

FL_DEADLINE_TEMPLATES = [
    {
        "type": DeadlineType.CARRIER_ACKNOWLEDGMENT,
        "description": "Carrier must acknowledge receipt of claim",
        "statute": "FL 626.9541",
        "days": 14,
        "anchor": "date_filed",
    },
    {
        "type": DeadlineType.CARRIER_DECISION,
        "description": "Carrier must pay or deny claim after proof of loss",
        "statute": "FL 627.70131",
        "days": 90,
        "anchor": "proof_of_loss_date",
    },
    {
        "type": DeadlineType.NOTICE_OF_INTENT,
        "description": "PA must send notice of intent 60 days before filing suit",
        "statute": "FL 627.70152",
        "days": -60,
        "anchor": None,
        "note": "Manual: set deadline_date to 60 days before planned litigation filing",
    },
    {
        "type": DeadlineType.SUPPLEMENT_FOLLOWUP,
        "description": "Follow up on supplement if no carrier response",
        "statute": None,
        "days": 14,
        "anchor": "supplement_date",
    },
    {
        "type": DeadlineType.STATUTE_OF_LIMITATIONS,
        "description": "Statute of limitations — 2 years from date of loss (post-2023 FL law)",
        "statute": "FL 95.11 (amended 2023)",
        "days": 730,
        "anchor": "date_of_loss",
    },
    {
        "type": DeadlineType.CONTRACT_RESCISSION,
        "description": "Client 14-day rescission period after signing PA contract",
        "statute": "FL 627.7142",
        "days": 14,
        "anchor": "contract_signed_date",
    },
    {
        "type": DeadlineType.PROOF_OF_LOSS,
        "description": "Proof of loss deadline — typically 60 days (varies by policy)",
        "statute": None,
        "days": 60,
        "anchor": "date_of_loss",
    },
]


# ============================================
# HELPERS
# ============================================

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_date(iso_str: str) -> datetime:
    """Parse an ISO date string to a timezone-aware datetime."""
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _compute_deadline_fields(doc: dict) -> dict:
    """Add computed days_remaining and is_overdue to a deadline document."""
    try:
        deadline_dt = _parse_date(doc["deadline_date"])
        now = datetime.now(timezone.utc)
        delta = deadline_dt - now
        doc["days_remaining"] = delta.days
        doc["is_overdue"] = delta.days < 0 and doc.get("status") == DeadlineStatus.ACTIVE
    except (KeyError, ValueError):
        doc["days_remaining"] = None
        doc["is_overdue"] = False
    return doc


def _build_deadline_doc(
    claim_id: str,
    claim_number: str,
    client_name: str,
    deadline_type: DeadlineType,
    description: str,
    statute_reference: Optional[str],
    start_date: str,
    deadline_date: str,
    alert_days_before: List[int],
    notes: Optional[str],
    created_by: str,
) -> dict:
    now = _now_iso()
    return {
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "claim_number": claim_number,
        "client_name": client_name,
        "deadline_type": deadline_type.value if isinstance(deadline_type, DeadlineType) else deadline_type,
        "description": description,
        "statute_reference": statute_reference,
        "start_date": start_date,
        "deadline_date": deadline_date,
        "status": DeadlineStatus.ACTIVE,
        "alert_days_before": alert_days_before,
        "notes": notes,
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }


def _build_alert_doc(
    deadline_id: str,
    claim_id: str,
    claim_number: str,
    alert_type: AlertType,
    message: str,
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "deadline_id": deadline_id,
        "claim_id": claim_id,
        "claim_number": claim_number,
        "alert_type": alert_type,
        "message": message,
        "acknowledged": False,
        "acknowledged_by": None,
        "acknowledged_at": None,
        "created_at": _now_iso(),
    }


# ============================================
# DEADLINE ENDPOINTS
# ============================================

@router.post("/deadlines", status_code=201)
async def create_deadline(
    body: DeadlineCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a compliance deadline for a claim."""
    doc = _build_deadline_doc(
        claim_id=body.claim_id,
        claim_number=body.claim_number,
        client_name=body.client_name,
        deadline_type=body.deadline_type,
        description=body.description,
        statute_reference=body.statute_reference,
        start_date=body.start_date,
        deadline_date=body.deadline_date,
        alert_days_before=body.alert_days_before,
        notes=body.notes,
        created_by=current_user.get("id", "unknown"),
    )
    await db.compliance_deadlines.insert_one(doc)
    doc.pop("_id", None)
    return _compute_deadline_fields(doc)


@router.get("/deadlines")
async def list_deadlines(
    status: Optional[DeadlineStatus] = Query(None),
    sort_by: str = Query("deadline_date", regex="^(deadline_date|created_at|claim_number)$"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """List all compliance deadlines with optional filtering, sorting, and pagination."""
    query: dict = {}
    if status:
        query["status"] = status

    sort_dir = 1 if sort_order == "asc" else -1
    skip = (page - 1) * limit

    total = await db.compliance_deadlines.count_documents(query)
    cursor = (
        db.compliance_deadlines.find(query, {"_id": 0})
        .sort(sort_by, sort_dir)
        .skip(skip)
        .limit(limit)
    )
    deadlines = await cursor.to_list(limit)
    deadlines = [_compute_deadline_fields(d) for d in deadlines]

    return {
        "deadlines": deadlines,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total else 0,
    }


@router.get("/deadlines/claim/{claim_id}")
async def get_deadlines_for_claim(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get all compliance deadlines for a specific claim."""
    deadlines = await db.compliance_deadlines.find(
        {"claim_id": claim_id}, {"_id": 0}
    ).sort("deadline_date", 1).to_list(100)
    return [_compute_deadline_fields(d) for d in deadlines]


@router.patch("/deadlines/{deadline_id}")
async def update_deadline(
    deadline_id: str,
    body: DeadlineUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update a compliance deadline (status, date extension, notes)."""
    existing = await db.compliance_deadlines.find_one(
        {"id": deadline_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Deadline not found")

    updates: dict = {"updated_at": _now_iso()}
    update_data = body.model_dump(exclude_none=True)
    updates.update(update_data)

    await db.compliance_deadlines.update_one(
        {"id": deadline_id}, {"$set": updates}
    )

    # If marked as missed, generate a critical alert
    if body.status == DeadlineStatus.MISSED:
        alert = _build_alert_doc(
            deadline_id=deadline_id,
            claim_id=existing["claim_id"],
            claim_number=existing.get("claim_number", ""),
            alert_type=AlertType.CRITICAL,
            message=(
                f"MISSED DEADLINE: {existing.get('description', existing['deadline_type'])} "
                f"for claim {existing.get('claim_number', existing['claim_id'])} — "
                f"was due {existing.get('deadline_date', 'unknown')}"
            ),
        )
        await db.compliance_alerts.insert_one(alert)
        logger.warning(
            "Compliance deadline MISSED: %s for claim %s",
            existing.get("deadline_type"),
            existing.get("claim_number"),
        )

    updated = await db.compliance_deadlines.find_one(
        {"id": deadline_id}, {"_id": 0}
    )
    return _compute_deadline_fields(updated)


@router.delete("/deadlines/{deadline_id}")
async def delete_deadline(
    deadline_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a compliance deadline."""
    result = await db.compliance_deadlines.delete_one({"id": deadline_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deadline not found")

    # Clean up related alerts
    await db.compliance_alerts.delete_many({"deadline_id": deadline_id})

    return {"deleted": True, "id": deadline_id}


# ============================================
# AUTO-GENERATION
# ============================================

@router.post("/auto-generate/{claim_id}", status_code=201)
async def auto_generate_deadlines(
    claim_id: str,
    body: AutoGenerateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Auto-generate all standard Florida compliance deadlines for a claim.

    Skips deadlines whose anchor date is not provided (e.g., if proof_of_loss_date
    is None, the carrier_decision deadline is not created).
    """
    created_by = current_user.get("id", "unknown")
    created: list = []
    skipped: list = []
    anchor_values = body.model_dump()

    for template in FL_DEADLINE_TEMPLATES:
        anchor_key = template["anchor"]

        # Templates with no anchor require manual setup
        if anchor_key is None:
            skipped.append({
                "type": template["type"],
                "reason": template.get("note", "Requires manual configuration"),
            })
            continue

        anchor_date_str = anchor_values.get(anchor_key)
        if not anchor_date_str:
            skipped.append({
                "type": template["type"],
                "reason": f"Missing anchor date: {anchor_key}",
            })
            continue

        anchor_dt = _parse_date(anchor_date_str)
        deadline_dt = anchor_dt + timedelta(days=template["days"])

        # Determine appropriate alert schedule based on deadline distance
        days_until = (deadline_dt - datetime.now(timezone.utc)).days
        if days_until > 60:
            alert_days = [60, 30, 14, 7, 3, 1]
        elif days_until > 14:
            alert_days = [14, 7, 3, 1]
        else:
            alert_days = [7, 3, 1]

        doc = _build_deadline_doc(
            claim_id=claim_id,
            claim_number=body.claim_number,
            client_name=body.client_name,
            deadline_type=template["type"],
            description=template["description"],
            statute_reference=template["statute"],
            start_date=anchor_date_str,
            deadline_date=deadline_dt.isoformat(),
            alert_days_before=alert_days,
            notes=f"Auto-generated. Carrier: {body.carrier_name or 'N/A'}",
            created_by=created_by,
        )
        await db.compliance_deadlines.insert_one(doc)
        doc.pop("_id", None)
        created.append(_compute_deadline_fields(doc))

        # If deadline is already overdue, immediately create critical alert
        if (deadline_dt - datetime.now(timezone.utc)).days < 0:
            alert = _build_alert_doc(
                deadline_id=doc["id"],
                claim_id=claim_id,
                claim_number=body.claim_number,
                alert_type=AlertType.CRITICAL,
                message=(
                    f"AUTO-GEN OVERDUE: {template['description']} for claim "
                    f"{body.claim_number} was due {deadline_dt.strftime('%Y-%m-%d')}"
                ),
            )
            await db.compliance_alerts.insert_one(alert)

    logger.info(
        "Auto-generated %d compliance deadlines for claim %s (skipped %d)",
        len(created), claim_id, len(skipped),
    )

    return {
        "claim_id": claim_id,
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
    }


# ============================================
# DASHBOARD & VIEWS
# ============================================

@router.get("/dashboard")
async def compliance_dashboard(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Compliance dashboard summary: total active, overdue, upcoming 7d, upcoming 30d.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    in_7d = (now + timedelta(days=7)).isoformat()
    in_30d = (now + timedelta(days=30)).isoformat()

    total_active = await db.compliance_deadlines.count_documents(
        {"status": DeadlineStatus.ACTIVE}
    )
    overdue_count = await db.compliance_deadlines.count_documents(
        {"status": DeadlineStatus.ACTIVE, "deadline_date": {"$lt": now_iso}}
    )
    upcoming_7d = await db.compliance_deadlines.count_documents({
        "status": DeadlineStatus.ACTIVE,
        "deadline_date": {"$gte": now_iso, "$lte": in_7d},
    })
    upcoming_30d = await db.compliance_deadlines.count_documents({
        "status": DeadlineStatus.ACTIVE,
        "deadline_date": {"$gte": now_iso, "$lte": in_30d},
    })
    total_met = await db.compliance_deadlines.count_documents(
        {"status": DeadlineStatus.MET}
    )
    total_missed = await db.compliance_deadlines.count_documents(
        {"status": DeadlineStatus.MISSED}
    )
    unacked_alerts = await db.compliance_alerts.count_documents(
        {"acknowledged": False}
    )

    return {
        "total_active": total_active,
        "overdue": overdue_count,
        "upcoming_7_days": upcoming_7d,
        "upcoming_30_days": upcoming_30d,
        "total_met": total_met,
        "total_missed": total_missed,
        "unacknowledged_alerts": unacked_alerts,
        "compliance_health": (
            "critical" if overdue_count > 0
            else "warning" if upcoming_7d > 3
            else "healthy"
        ),
        "generated_at": _now_iso(),
    }


@router.get("/overdue")
async def get_overdue_deadlines(
    current_user: dict = Depends(get_current_active_user),
):
    """Get all overdue active deadlines — CRITICAL priority."""
    now_iso = datetime.now(timezone.utc).isoformat()
    deadlines = await db.compliance_deadlines.find(
        {"status": DeadlineStatus.ACTIVE, "deadline_date": {"$lt": now_iso}},
        {"_id": 0},
    ).sort("deadline_date", 1).to_list(500)

    return {
        "count": len(deadlines),
        "deadlines": [_compute_deadline_fields(d) for d in deadlines],
        "severity": "critical" if deadlines else "clear",
    }


@router.get("/upcoming")
async def get_upcoming_deadlines(
    days: int = Query(14, ge=1, le=90, description="Look-ahead window in days"),
    current_user: dict = Depends(get_current_active_user),
):
    """Get active deadlines due within the specified window (default 14 days)."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    window_end = (now + timedelta(days=days)).isoformat()

    deadlines = await db.compliance_deadlines.find(
        {
            "status": DeadlineStatus.ACTIVE,
            "deadline_date": {"$gte": now_iso, "$lte": window_end},
        },
        {"_id": 0},
    ).sort("deadline_date", 1).to_list(500)

    return {
        "window_days": days,
        "count": len(deadlines),
        "deadlines": [_compute_deadline_fields(d) for d in deadlines],
    }


# ============================================
# ALERTS
# ============================================

@router.get("/alerts")
async def get_unacknowledged_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """Get all unacknowledged compliance alerts, newest first."""
    query = {"acknowledged": False}
    skip = (page - 1) * limit

    total = await db.compliance_alerts.count_documents(query)
    alerts = await db.compliance_alerts.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)

    return {
        "alerts": alerts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total else 0,
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Mark a compliance alert as acknowledged."""
    result = await db.compliance_alerts.update_one(
        {"id": alert_id, "acknowledged": False},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": current_user.get("id", "unknown"),
                "acknowledged_at": _now_iso(),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Alert not found or already acknowledged",
        )

    updated = await db.compliance_alerts.find_one(
        {"id": alert_id}, {"_id": 0}
    )
    return updated
