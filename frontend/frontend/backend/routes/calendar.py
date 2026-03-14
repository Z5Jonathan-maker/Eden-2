"""
Calendar & Scheduling system for Eden Claims Management.

Supports inspection scheduling, follow-ups, carrier calls, client meetings,
and deadline tracking — all tied to claims and adjusters.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from dependencies import db, get_current_active_user
from datetime import datetime, timezone, timedelta
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])

# ============================================
# Constants
# ============================================

VALID_EVENT_TYPES = (
    "inspection", "follow_up", "carrier_call",
    "client_meeting", "deadline", "other",
)
VALID_STATUSES = ("scheduled", "completed", "cancelled", "rescheduled")
VALID_REMINDER_TYPES = ("notification", "email")
VALID_RECURRENCE = ("none", "daily", "weekly", "monthly")
MANAGEMENT_ROLES = ("admin", "manager")
FOLLOW_UP_DELAY_DAYS = 3


# ============================================
# Pydantic Models
# ============================================

class ReminderConfig(BaseModel):
    minutes_before: int = Field(..., ge=0, le=10080, description="Minutes before event to remind (max 7 days)")
    type: str = Field("notification", description="notification or email")


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    event_type: str = Field("other", description="inspection, follow_up, carrier_call, client_meeting, deadline, other")
    claim_id: Optional[str] = None
    claim_number: Optional[str] = None
    start_time: str = Field(..., description="ISO 8601 datetime string")
    end_time: str = Field(..., description="ISO 8601 datetime string")
    all_day: bool = False
    location: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_id: Optional[str] = None
    reminders: List[ReminderConfig] = Field(default_factory=list)
    recurrence: str = "none"


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: Optional[str] = None
    claim_id: Optional[str] = None
    claim_number: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_id: Optional[str] = None
    status: Optional[str] = None
    reminders: Optional[List[ReminderConfig]] = None
    recurrence: Optional[str] = None


class InspectionEventCreate(BaseModel):
    claim_id: str
    start_time: str = Field(..., description="ISO 8601 datetime string")
    end_time: str = Field(..., description="ISO 8601 datetime string")
    location: Optional[str] = None
    description: Optional[str] = ""
    reminders: List[ReminderConfig] = Field(
        default_factory=lambda: [ReminderConfig(minutes_before=60, type="notification")]
    )


# ============================================
# Helpers
# ============================================

def _validate_event_type(event_type: str) -> None:
    if event_type not in VALID_EVENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid event_type '{event_type}'. Must be one of: {', '.join(VALID_EVENT_TYPES)}",
        )


def _validate_status(status_val: str) -> None:
    if status_val not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{status_val}'. Must be one of: {', '.join(VALID_STATUSES)}",
        )


def _validate_recurrence(recurrence: str) -> None:
    if recurrence not in VALID_RECURRENCE:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid recurrence '{recurrence}'. Must be one of: {', '.join(VALID_RECURRENCE)}",
        )


def _validate_reminders(reminders: List[ReminderConfig]) -> None:
    for r in reminders:
        if r.type not in VALID_REMINDER_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid reminder type '{r.type}'. Must be one of: {', '.join(VALID_REMINDER_TYPES)}",
            )


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    """Parse an ISO datetime string, return timezone-aware datetime."""
    try:
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid ISO datetime for {field_name}: '{value}'",
        )


def _validate_time_range(start: str, end: str) -> None:
    start_dt = _parse_iso_datetime(start, "start_time")
    end_dt = _parse_iso_datetime(end, "end_time")
    if end_dt <= start_dt:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_management(user: dict) -> bool:
    return user.get("role") in MANAGEMENT_ROLES


def _build_event_doc(
    data: CalendarEventCreate,
    current_user: dict,
) -> dict:
    """Build a complete calendar event document for MongoDB insertion."""
    return {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description or "",
        "event_type": data.event_type,
        "claim_id": data.claim_id,
        "claim_number": data.claim_number,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "all_day": data.all_day,
        "location": data.location,
        "assigned_to": data.assigned_to or current_user.get("full_name"),
        "assigned_to_id": data.assigned_to_id or current_user.get("id"),
        "status": "scheduled",
        "reminders": [r.model_dump() for r in data.reminders],
        "recurrence": data.recurrence,
        "created_by": current_user.get("full_name"),
        "created_by_id": current_user.get("id"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


def _apply_role_filter(query: dict, user: dict) -> dict:
    """Apply role-based access control to a query filter.

    - admin/manager: see all events
    - adjuster: only events assigned to them
    - client: only events linked to claims they own (by client_email)
    """
    role = user.get("role", "client")
    if role in MANAGEMENT_ROLES:
        return query
    if role == "adjuster":
        query["assigned_to_id"] = user["id"]
        return query
    # client — will be further filtered per-claim downstream
    query["$or"] = [
        {"assigned_to_id": user["id"]},
        {"created_by_id": user["id"]},
    ]
    return query


async def _enrich_claim_fields(data: dict) -> dict:
    """If claim_id is set but claim_number is missing, look it up."""
    if data.get("claim_id") and not data.get("claim_number"):
        claim = await db.claims.find_one({"id": data["claim_id"]}, {"claim_number": 1})
        if claim:
            data["claim_number"] = claim.get("claim_number")
    return data


async def _create_follow_up_event(
    inspection_event: dict,
    current_user: dict,
) -> dict:
    """Auto-create a follow-up event N days after an inspection."""
    start_dt = _parse_iso_datetime(inspection_event["start_time"], "start_time")
    follow_up_start = start_dt + timedelta(days=FOLLOW_UP_DELAY_DAYS)
    follow_up_end = follow_up_start + timedelta(hours=1)

    follow_up = {
        "id": str(uuid.uuid4()),
        "title": f"Follow-up: {inspection_event['title']}",
        "description": f"Auto-generated follow-up for inspection '{inspection_event['title']}'. Review findings and contact carrier/client.",
        "event_type": "follow_up",
        "claim_id": inspection_event.get("claim_id"),
        "claim_number": inspection_event.get("claim_number"),
        "start_time": follow_up_start.isoformat(),
        "end_time": follow_up_end.isoformat(),
        "all_day": False,
        "location": None,
        "assigned_to": inspection_event.get("assigned_to"),
        "assigned_to_id": inspection_event.get("assigned_to_id"),
        "status": "scheduled",
        "reminders": [{"minutes_before": 60, "type": "notification"}],
        "recurrence": "none",
        "created_by": "system",
        "created_by_id": current_user.get("id"),
        "parent_event_id": inspection_event["id"],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.calendar_events.insert_one(follow_up)
    logger.info("Auto-created follow-up event %s for inspection %s", follow_up["id"], inspection_event["id"])
    return follow_up


async def _get_client_claim_ids(user: dict) -> list:
    """Return claim IDs the client user owns."""
    email = user.get("email", "")
    claims = await db.claims.find(
        {"client_email": email},
        {"id": 1, "_id": 0},
    ).to_list(500)
    return [c["id"] for c in claims]


# ============================================
# CRUD Endpoints
# ============================================

@router.post("/")
async def create_event(
    data: CalendarEventCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a new calendar event."""
    try:
        _validate_event_type(data.event_type)
        _validate_recurrence(data.recurrence)
        _validate_reminders(data.reminders)
        _validate_time_range(data.start_time, data.end_time)

        doc = _build_event_doc(data, current_user)
        doc = await _enrich_claim_fields(doc)

        await db.calendar_events.insert_one(doc)
        doc.pop("_id", None)

        # Auto-create follow-up for inspections
        follow_up = None
        if data.event_type == "inspection":
            follow_up = await _create_follow_up_event(doc, current_user)
            follow_up.pop("_id", None)

        logger.info("Calendar event created: %s by %s", doc["id"], current_user.get("full_name"))
        return {
            "success": True,
            "data": doc,
            "follow_up": follow_up,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create calendar event error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/")
async def list_events(
    start: Optional[str] = Query(None, description="ISO start date filter"),
    end: Optional[str] = Query(None, description="ISO end date filter"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_active_user),
):
    """List calendar events with optional date range and type filters."""
    try:
        query: dict = {}

        if start:
            _parse_iso_datetime(start, "start")
            query.setdefault("start_time", {})["$gte"] = start

        if end:
            _parse_iso_datetime(end, "end")
            query.setdefault("start_time", {})["$lte"] = end

        if event_type:
            _validate_event_type(event_type)
            query["event_type"] = event_type

        if status:
            _validate_status(status)
            query["status"] = status

        query = _apply_role_filter(query, current_user)

        # Client users: further restrict to their claims only
        if current_user.get("role") == "client":
            claim_ids = await _get_client_claim_ids(current_user)
            query["claim_id"] = {"$in": claim_ids}

        events = await db.calendar_events.find(
            query, {"_id": 0}
        ).sort("start_time", 1).to_list(limit)

        return {"success": True, "data": events, "count": len(events)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("List calendar events error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/my")
async def get_my_events(
    start: Optional[str] = Query(None, description="ISO start date filter"),
    end: Optional[str] = Query(None, description="ISO end date filter"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(get_current_active_user),
):
    """Get all events assigned to the current user."""
    try:
        query = {"assigned_to_id": current_user["id"]}

        if start:
            _parse_iso_datetime(start, "start")
            query.setdefault("start_time", {})["$gte"] = start

        if end:
            _parse_iso_datetime(end, "end")
            query.setdefault("start_time", {})["$lte"] = end

        if status:
            _validate_status(status)
            query["status"] = status

        events = await db.calendar_events.find(
            query, {"_id": 0}
        ).sort("start_time", 1).to_list(limit)

        return {"success": True, "data": events, "count": len(events)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get my events error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/upcoming")
async def get_upcoming_events(
    days: int = Query(7, ge=1, le=90, description="Number of days ahead to look"),
    current_user: dict = Depends(get_current_active_user),
):
    """Get upcoming events for the next N days with overdue highlights."""
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        future_iso = (now + timedelta(days=days)).isoformat()

        query = {
            "status": {"$in": ["scheduled", "rescheduled"]},
        }
        query = _apply_role_filter(query, current_user)

        if current_user.get("role") == "client":
            claim_ids = await _get_client_claim_ids(current_user)
            query["claim_id"] = {"$in": claim_ids}

        # Upcoming: start_time within the window
        upcoming_query = {**query, "start_time": {"$gte": now_iso, "$lte": future_iso}}
        upcoming = await db.calendar_events.find(
            upcoming_query, {"_id": 0}
        ).sort("start_time", 1).to_list(200)

        # Overdue: start_time in the past AND not completed/cancelled
        overdue_query = {**query, "start_time": {"$lt": now_iso}}
        overdue = await db.calendar_events.find(
            overdue_query, {"_id": 0}
        ).sort("start_time", 1).to_list(100)

        return {
            "success": True,
            "data": {
                "upcoming": upcoming,
                "overdue": overdue,
                "upcoming_count": len(upcoming),
                "overdue_count": len(overdue),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get upcoming events error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/availability")
async def check_availability(
    adjuster_id: str = Query(..., description="User ID of the adjuster"),
    start: str = Query(..., description="ISO start of range"),
    end: str = Query(..., description="ISO end of range"),
    current_user: dict = Depends(get_current_active_user),
):
    """Check an adjuster's availability for a date range.

    Returns existing events in the window so the caller can identify open slots.
    """
    try:
        _parse_iso_datetime(start, "start")
        _parse_iso_datetime(end, "end")

        # Only management and the adjuster themselves can check availability
        if not _is_management(current_user) and current_user["id"] != adjuster_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Verify adjuster exists
        adjuster = await db.users.find_one({"id": adjuster_id}, {"_id": 0, "full_name": 1, "id": 1, "role": 1})
        if not adjuster:
            raise HTTPException(status_code=404, detail="Adjuster not found")

        # Find all non-cancelled events in the range for this adjuster
        query = {
            "assigned_to_id": adjuster_id,
            "status": {"$nin": ["cancelled"]},
            "start_time": {"$lte": end},
            "end_time": {"$gte": start},
        }

        busy_events = await db.calendar_events.find(
            query, {"_id": 0, "id": 1, "title": 1, "start_time": 1, "end_time": 1, "event_type": 1, "all_day": 1}
        ).sort("start_time", 1).to_list(200)

        return {
            "success": True,
            "data": {
                "adjuster_id": adjuster_id,
                "adjuster_name": adjuster.get("full_name"),
                "range_start": start,
                "range_end": end,
                "busy_slots": busy_events,
                "busy_count": len(busy_events),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Check availability error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/claim/{claim_id}")
async def get_events_for_claim(
    claim_id: str,
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Get all calendar events linked to a specific claim."""
    try:
        # Verify claim exists and user has access
        claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "id": 1, "client_email": 1, "assigned_to_id": 1})
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        # Client can only access their own claims
        if current_user.get("role") == "client":
            if claim.get("client_email") != current_user.get("email"):
                raise HTTPException(status_code=403, detail="Access denied")

        # Adjuster can access claims assigned to them
        if current_user.get("role") == "adjuster":
            if claim.get("assigned_to_id") != current_user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")

        query: dict = {"claim_id": claim_id}
        if status:
            _validate_status(status)
            query["status"] = status

        events = await db.calendar_events.find(
            query, {"_id": 0}
        ).sort("start_time", 1).to_list(200)

        return {"success": True, "data": events, "count": len(events)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get events for claim error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/inspection")
async def create_inspection_event(
    data: InspectionEventCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create an inspection event, auto-populating fields from claim data.

    Also auto-creates a follow-up event 3 days after the inspection.
    """
    try:
        _validate_time_range(data.start_time, data.end_time)
        _validate_reminders(data.reminders)

        # Fetch claim data
        claim = await db.claims.find_one({"id": data.claim_id}, {"_id": 0})
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        # Build inspection event from claim data
        location = data.location or claim.get("property_address", "")
        assigned_to = claim.get("assigned_to", current_user.get("full_name"))
        assigned_to_id = claim.get("assigned_to_id", current_user.get("id"))
        client_name = claim.get("client_name", "")
        claim_number = claim.get("claim_number", "")

        title = f"Inspection: {client_name} — {claim_number}" if client_name else f"Inspection: {claim_number}"

        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "description": data.description or f"Property inspection for claim {claim_number} at {location}.",
            "event_type": "inspection",
            "claim_id": data.claim_id,
            "claim_number": claim_number,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "all_day": False,
            "location": location,
            "assigned_to": assigned_to,
            "assigned_to_id": assigned_to_id,
            "status": "scheduled",
            "reminders": [r.model_dump() for r in data.reminders],
            "recurrence": "none",
            "created_by": current_user.get("full_name"),
            "created_by_id": current_user.get("id"),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }

        await db.calendar_events.insert_one(doc)
        doc.pop("_id", None)

        # Auto-create follow-up
        follow_up = await _create_follow_up_event(doc, current_user)
        follow_up.pop("_id", None)

        logger.info(
            "Inspection event created: %s for claim %s by %s",
            doc["id"], data.claim_id, current_user.get("full_name"),
        )

        return {
            "success": True,
            "data": doc,
            "follow_up": follow_up,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create inspection event error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{event_id}")
async def get_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a single calendar event by ID."""
    try:
        event = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        # Role-based access check
        role = current_user.get("role", "client")
        if role == "adjuster" and event.get("assigned_to_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if role == "client":
            claim_ids = await _get_client_claim_ids(current_user)
            if event.get("claim_id") not in claim_ids:
                raise HTTPException(status_code=403, detail="Access denied")

        return {"success": True, "data": event}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get calendar event error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/{event_id}")
async def update_event(
    event_id: str,
    updates: CalendarEventUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update a calendar event. Only non-None fields are applied."""
    try:
        existing = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        # Only management or the assigned user can update
        if not _is_management(current_user):
            if existing.get("assigned_to_id") != current_user["id"] and existing.get("created_by_id") != current_user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")

        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

        if not update_data:
            return {"success": True, "data": existing, "message": "No changes provided"}

        # Validate any fields that are being updated
        if "event_type" in update_data:
            _validate_event_type(update_data["event_type"])
        if "status" in update_data:
            _validate_status(update_data["status"])
        if "recurrence" in update_data:
            _validate_recurrence(update_data["recurrence"])
        if "reminders" in update_data:
            _validate_reminders([ReminderConfig(**r) for r in update_data["reminders"]])
            update_data["reminders"] = [r if isinstance(r, dict) else r.model_dump() for r in update_data["reminders"]]

        # Validate time range if either time is updated
        new_start = update_data.get("start_time", existing.get("start_time"))
        new_end = update_data.get("end_time", existing.get("end_time"))
        if "start_time" in update_data or "end_time" in update_data:
            _validate_time_range(new_start, new_end)

        update_data["updated_at"] = _now_iso()

        await db.calendar_events.update_one({"id": event_id}, {"$set": update_data})
        updated = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})

        logger.info("Calendar event updated: %s by %s", event_id, current_user.get("full_name"))
        return {"success": True, "data": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update calendar event error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a calendar event. Only management or event creator can delete."""
    try:
        existing = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        # Only management or creator can delete
        if not _is_management(current_user) and existing.get("created_by_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        await db.calendar_events.delete_one({"id": event_id})

        # Also delete any auto-generated follow-up events linked to this one
        follow_up_result = await db.calendar_events.delete_many({"parent_event_id": event_id})
        deleted_follow_ups = follow_up_result.deleted_count

        logger.info(
            "Calendar event deleted: %s (+ %d follow-ups) by %s",
            event_id, deleted_follow_ups, current_user.get("full_name"),
        )
        return {
            "success": True,
            "message": "Event deleted",
            "follow_ups_deleted": deleted_follow_ups,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete calendar event error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")
