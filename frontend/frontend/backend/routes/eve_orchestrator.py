"""
Eve Orchestrator — Eden-2's AI command center.

Jonathan tells Eve what to do in natural language. Eve parses the instruction,
queries the claims database, dispatches the right agents, and reports back.

Example: "All claims over 60 days with no carrier response — draft follow-up
letters, flag for CRN if over 90 days, schedule carrier calls"
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from dependencies import db, get_current_active_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/eve", tags=["Eve Orchestrator"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_AVAILABLE = bool(
    os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
)

VALID_ACTIONS = frozenset({
    "follow_up",
    "draft_letter",
    "schedule_call",
    "flag_crn",
    "generate_report",
    "update_stage",
    "bulk_update",
})

VALID_FILTER_KEYS = frozenset({
    "days_since_update",
    "stage",
    "carrier",
    "status",
    "has_settlement",
    "no_response",
    "overdue_deadline",
    "claim_type",
    "min_rcv",
})

MAX_CLAIMS_PER_RUN = 200
MAX_ACTIONS_HISTORY = 100

INSTRUCTION_PARSE_PROMPT = """You are the AI instruction parser for Eden Claims Management, a Florida public adjusting firm.

Parse the following natural language instruction into structured actions.

Available actions: follow_up, draft_letter, schedule_call, flag_crn, generate_report, update_stage, bulk_update
Available filters:
  - days_since_update: {"gt": N} or {"lt": N} — days since claim was last updated
  - stage: one of intake, inspection, negotiation, settlement, closed
  - carrier: carrier name substring match
  - status: claim status (New, In Progress, etc.)
  - has_settlement: boolean — whether claim has a settlement amount
  - no_response: boolean — no carrier response (no notes/comms in the lookback period)
  - overdue_deadline: boolean — has an overdue compliance deadline
  - claim_type: type of claim (Water Damage, Fire, Wind, etc.)
  - min_rcv: minimum replacement cost value

Return ONLY valid JSON (no markdown, no explanation):
{
  "actions": ["follow_up"],
  "filters": {"days_since_update": {"gt": 60}, "no_response": true},
  "options": {"include_crn": true, "crn_threshold_days": 90},
  "summary": "One sentence describing what will happen"
}

If the instruction is ambiguous or unsafe, return:
{"error": "description of the problem"}

Instruction: """


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class OrchestrateRequest(BaseModel):
    instruction: str = Field(
        ..., min_length=5, max_length=2000,
        description="Natural language instruction for Eve",
    )
    dry_run: bool = Field(
        default=True,
        description="If true, show what would happen without executing",
    )


class FollowUpStaleRequest(BaseModel):
    days: int = Field(default=60, ge=1, le=365, description="Days of inactivity")
    dry_run: bool = True


class CheckComplianceRequest(BaseModel):
    dry_run: bool = True


class DraftCrnRequest(BaseModel):
    dry_run: bool = True


class GenerateDemandLettersRequest(BaseModel):
    min_rcv: float = Field(default=10000, ge=0, description="Minimum RCV threshold")
    dry_run: bool = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cutoff_date(days: int) -> datetime:
    """Return a UTC datetime N days ago."""
    return datetime.now(timezone.utc) - timedelta(days=days)


async def _parse_instruction(instruction: str) -> dict:
    """Send instruction to Gemini for structured parsing."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI provider not configured. Set GEMINI_API_KEY to enable Eve Orchestrator.",
        )

    try:
        from services.claimpilot.llm_router import LLMRouter

        llm = LLMRouter()
        raw = await llm.generate(
            prompt=INSTRUCTION_PARSE_PROMPT + instruction,
            system_prompt="You are a precise JSON-only instruction parser. Never output markdown.",
            task_type="structured_extraction",
            max_tokens=1000,
        )

        # Strip markdown fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        parsed = json.loads(text)

        if "error" in parsed:
            raise HTTPException(status_code=422, detail=f"Eve could not parse instruction: {parsed['error']}")

        return parsed

    except json.JSONDecodeError as exc:
        logger.error("Eve instruction parse failed — invalid JSON: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Eve could not parse the instruction into structured actions. Try rephrasing.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Eve instruction parse error: %s", exc)
        raise HTTPException(status_code=500, detail="AI service error during instruction parsing.")


def _build_mongo_query(filters: dict) -> dict:
    """Convert parsed filters into a MongoDB query against the claims collection."""
    query: dict[str, Any] = {}

    # Days since update
    days_filter = filters.get("days_since_update")
    if isinstance(days_filter, dict):
        gt_days = days_filter.get("gt")
        lt_days = days_filter.get("lt")
        if gt_days is not None:
            query["updated_at"] = {"$lt": _cutoff_date(int(gt_days)).isoformat()}
        if lt_days is not None:
            query.setdefault("updated_at", {})["$gt"] = _cutoff_date(int(lt_days)).isoformat()

    # Stage
    stage = filters.get("stage")
    if stage:
        query["stage"] = stage

    # Carrier (case-insensitive substring)
    carrier = filters.get("carrier")
    if carrier:
        query["carrier_name"] = {"$regex": str(carrier), "$options": "i"}

    # Status
    status_val = filters.get("status")
    if status_val:
        query["status"] = status_val

    # Has settlement
    if filters.get("has_settlement") is True:
        query["settlement_amount"] = {"$gt": 0}
    elif filters.get("has_settlement") is False:
        query["$or"] = [
            {"settlement_amount": None},
            {"settlement_amount": 0},
            {"settlement_amount": {"$exists": False}},
        ]

    # Claim type
    claim_type = filters.get("claim_type")
    if claim_type:
        query["claim_type"] = {"$regex": str(claim_type), "$options": "i"}

    # Minimum RCV
    min_rcv = filters.get("min_rcv")
    if min_rcv is not None:
        query["replacement_cost_value"] = {"$gte": float(min_rcv)}

    # Exclude closed claims by default unless explicitly filtered
    if "stage" not in query and "status" not in query:
        query["stage"] = {"$ne": "closed"}

    return query


async def _fetch_matching_claims(query: dict, limit: int = MAX_CLAIMS_PER_RUN) -> list[dict]:
    """Fetch claims matching the query."""
    projection = {
        "_id": 0,
        "id": 1,
        "claim_number": 1,
        "client_name": 1,
        "carrier_name": 1,
        "stage": 1,
        "status": 1,
        "updated_at": 1,
        "date_of_loss": 1,
        "settlement_amount": 1,
        "replacement_cost_value": 1,
        "property_address": 1,
        "carrier_adjuster_name": 1,
        "carrier_adjuster_email": 1,
        "carrier_adjuster_phone": 1,
    }
    claims = await db.claims.find(query, projection).sort("updated_at", 1).limit(limit).to_list(limit)
    return claims


def _days_since_update(claim: dict) -> int:
    """Calculate days since the claim was last updated."""
    updated = claim.get("updated_at")
    if not updated:
        return 999
    try:
        if isinstance(updated, str):
            dt = datetime.fromisoformat(updated)
        elif isinstance(updated, datetime):
            dt = updated
        else:
            return 999
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).days
    except (ValueError, TypeError):
        return 999


# ---------------------------------------------------------------------------
# Action executors
# ---------------------------------------------------------------------------

async def _execute_follow_up(claim: dict, options: dict, dry_run: bool) -> dict:
    """Draft a follow-up communication for a stale claim."""
    days = _days_since_update(claim)
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "follow_up",
            "result": f"[DRY RUN] Would draft follow-up letter ({days} days stale)",
            "days_stale": days,
        }

    # Generate follow-up text via Eve AI
    try:
        from services.claimpilot.llm_router import LLMRouter

        carrier = claim.get("carrier_name", "the carrier")
        client = claim.get("client_name", "the client")

        prompt = (
            f"Draft a professional follow-up letter for claim {claim_number}.\n"
            f"Client: {client}\n"
            f"Carrier: {carrier}\n"
            f"Days since last activity: {days}\n"
            f"Carrier adjuster: {claim.get('carrier_adjuster_name', 'Unknown')}\n"
            f"Property: {claim.get('property_address', 'On file')}\n\n"
            "Write a firm but professional letter requesting a status update and "
            "timeline for resolution. Reference Florida statute 627.70131 if "
            "applicable. Keep it under 250 words."
        )

        llm = LLMRouter()
        letter_text = await llm.generate(
            prompt=prompt,
            system_prompt="You are a senior public adjuster drafting carrier correspondence.",
            task_type="text_generation",
            max_tokens=1000,
        )

        # Store the drafted letter
        letter_doc = {
            "id": str(uuid.uuid4()),
            "claim_id": claim_id,
            "claim_number": claim_number,
            "type": "follow_up_letter",
            "content": letter_text,
            "generated_by": "eve_orchestrator",
            "status": "draft",
            "created_at": _now_iso(),
        }
        await db.eve_orchestrator_drafts.insert_one(letter_doc)

        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "draft_follow_up",
            "result": f"Follow-up letter drafted ({days} days stale)",
            "draft_id": letter_doc["id"],
            "days_stale": days,
        }
    except Exception as exc:
        logger.error("Follow-up draft failed for %s: %s", claim_number, exc)
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "follow_up",
            "result": f"Error drafting follow-up: {exc}",
            "days_stale": days,
        }


async def _execute_flag_crn(claim: dict, options: dict, dry_run: bool) -> dict:
    """Flag a claim for Civil Remedy Notice when carrier exceeds decision window."""
    days = _days_since_update(claim)
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")
    threshold = options.get("crn_threshold_days", 90)

    if days < threshold:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "flag_crn",
            "result": f"Skipped — {days} days (threshold: {threshold})",
            "days_stale": days,
        }

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "flag_crn",
            "result": f"[DRY RUN] Would flag CRN ({days} days, exceeds {threshold}-day window)",
            "days_stale": days,
        }

    # Create a compliance alert for CRN
    alert_doc = {
        "id": str(uuid.uuid4()),
        "deadline_id": None,
        "claim_id": claim_id,
        "claim_number": claim_number,
        "alert_type": "critical",
        "message": (
            f"CRN FLAG: Claim {claim_number} has had no carrier response for {days} days. "
            f"Exceeds {threshold}-day carrier decision window (FL 627.70131). "
            "Draft Civil Remedy Notice immediately."
        ),
        "acknowledged": False,
        "acknowledged_by": None,
        "acknowledged_at": None,
        "created_at": _now_iso(),
        "source": "eve_orchestrator",
    }
    await db.compliance_alerts.insert_one(alert_doc)

    return {
        "claim_id": claim_id,
        "claim_number": claim_number,
        "action": "flag_crn",
        "result": f"CRN flagged — {days} days no response (alert created)",
        "alert_id": alert_doc["id"],
        "days_stale": days,
    }


async def _execute_schedule_call(claim: dict, options: dict, dry_run: bool) -> dict:
    """Schedule a carrier call for the claim."""
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")
    carrier = claim.get("carrier_name", "Unknown")

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "schedule_call",
            "result": f"[DRY RUN] Would schedule carrier call with {carrier}",
        }

    # Create a calendar event for the carrier call
    now = datetime.now(timezone.utc)
    # Schedule for next business day at 10 AM
    call_date = now + timedelta(days=1)
    if call_date.weekday() == 5:  # Saturday
        call_date += timedelta(days=2)
    elif call_date.weekday() == 6:  # Sunday
        call_date += timedelta(days=1)

    start_time = call_date.replace(hour=10, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(minutes=30)

    event_doc = {
        "id": str(uuid.uuid4()),
        "title": f"Carrier Call: {claim_number} — {carrier}",
        "description": (
            f"Follow-up call with {carrier} regarding claim {claim_number}.\n"
            f"Client: {claim.get('client_name', 'N/A')}\n"
            f"Carrier adjuster: {claim.get('carrier_adjuster_name', 'N/A')}\n"
            f"Phone: {claim.get('carrier_adjuster_phone', 'N/A')}"
        ),
        "event_type": "carrier_call",
        "claim_id": claim_id,
        "claim_number": claim_number,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "all_day": False,
        "location": None,
        "assigned_to": None,
        "assigned_to_id": None,
        "status": "scheduled",
        "reminders": [{"minutes_before": 30, "type": "notification"}],
        "recurrence": "none",
        "created_by": "Eve Orchestrator",
        "created_by_id": "system",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.calendar_events.insert_one(event_doc)

    return {
        "claim_id": claim_id,
        "claim_number": claim_number,
        "action": "schedule_call",
        "result": f"Carrier call scheduled with {carrier} on {start_time.strftime('%Y-%m-%d %H:%M')} UTC",
        "event_id": event_doc["id"],
    }


async def _execute_draft_letter(claim: dict, options: dict, dry_run: bool) -> dict:
    """Generate a demand letter for a claim in negotiation."""
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")
    rcv = claim.get("replacement_cost_value") or 0

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "draft_letter",
            "result": f"[DRY RUN] Would generate demand letter (RCV: ${rcv:,.2f})",
        }

    try:
        from services.claimpilot.llm_router import LLMRouter

        prompt = (
            f"Draft a demand letter for claim {claim_number}.\n"
            f"Client: {claim.get('client_name', 'N/A')}\n"
            f"Carrier: {claim.get('carrier_name', 'N/A')}\n"
            f"Property: {claim.get('property_address', 'On file')}\n"
            f"Replacement Cost Value: ${rcv:,.2f}\n"
            f"Date of Loss: {claim.get('date_of_loss', 'On file')}\n\n"
            "Write a professional demand letter citing the RCV, requesting full "
            "payment, and referencing Florida statute 627.70131 (90-day decision "
            "window). Be firm but professional. Under 400 words."
        )

        llm = LLMRouter()
        letter_text = await llm.generate(
            prompt=prompt,
            system_prompt="You are a senior public adjuster drafting insurance demand letters.",
            task_type="text_generation",
            max_tokens=1500,
        )

        letter_doc = {
            "id": str(uuid.uuid4()),
            "claim_id": claim_id,
            "claim_number": claim_number,
            "type": "demand_letter",
            "content": letter_text,
            "generated_by": "eve_orchestrator",
            "status": "draft",
            "created_at": _now_iso(),
        }
        await db.eve_orchestrator_drafts.insert_one(letter_doc)

        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "draft_letter",
            "result": f"Demand letter drafted (RCV: ${rcv:,.2f})",
            "draft_id": letter_doc["id"],
        }
    except Exception as exc:
        logger.error("Demand letter draft failed for %s: %s", claim_number, exc)
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "draft_letter",
            "result": f"Error drafting demand letter: {exc}",
        }


async def _execute_generate_report(claim: dict, options: dict, dry_run: bool) -> dict:
    """Compile a claim summary report."""
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "generate_report",
            "result": "[DRY RUN] Would generate claim summary report",
        }

    # Gather additional claim data
    notes_count = await db.notes.count_documents({"claim_id": claim_id})
    docs_count = await db.documents.count_documents({"claim_id": claim_id})
    deadlines = await db.compliance_deadlines.find(
        {"claim_id": claim_id, "status": "active"}, {"_id": 0}
    ).to_list(20)

    report = {
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "claim_number": claim_number,
        "type": "summary_report",
        "content": {
            "client_name": claim.get("client_name"),
            "carrier": claim.get("carrier_name"),
            "stage": claim.get("stage"),
            "status": claim.get("status"),
            "property_address": claim.get("property_address"),
            "date_of_loss": claim.get("date_of_loss"),
            "rcv": claim.get("replacement_cost_value"),
            "settlement": claim.get("settlement_amount"),
            "days_since_update": _days_since_update(claim),
            "notes_count": notes_count,
            "documents_count": docs_count,
            "active_deadlines": len(deadlines),
        },
        "generated_by": "eve_orchestrator",
        "created_at": _now_iso(),
    }
    await db.eve_orchestrator_reports.insert_one(report)

    return {
        "claim_id": claim_id,
        "claim_number": claim_number,
        "action": "generate_report",
        "result": "Summary report generated",
        "report_id": report["id"],
    }


async def _execute_update_stage(claim: dict, options: dict, dry_run: bool) -> dict:
    """Update a claim's stage."""
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")
    new_stage = options.get("new_stage")

    if not new_stage:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "update_stage",
            "result": "Skipped — no new_stage specified in options",
        }

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "update_stage",
            "result": f"[DRY RUN] Would update stage from '{claim.get('stage')}' to '{new_stage}'",
        }

    await db.claims.update_one(
        {"id": claim_id},
        {"$set": {"stage": new_stage, "updated_at": _now_iso()}},
    )

    return {
        "claim_id": claim_id,
        "claim_number": claim_number,
        "action": "update_stage",
        "result": f"Stage updated: {claim.get('stage')} -> {new_stage}",
    }


async def _execute_bulk_update(claim: dict, options: dict, dry_run: bool) -> dict:
    """Apply arbitrary field updates to a claim."""
    claim_id = claim["id"]
    claim_number = claim.get("claim_number", "N/A")
    fields = options.get("update_fields", {})

    if not fields:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "bulk_update",
            "result": "Skipped — no update_fields specified in options",
        }

    # Sanitize: only allow safe fields to be updated
    safe_fields = {
        "status", "stage", "priority", "next_actions_firm",
        "next_actions_client", "description",
    }
    sanitized = {k: v for k, v in fields.items() if k in safe_fields}

    if not sanitized:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "bulk_update",
            "result": f"Skipped — no safe fields in update_fields (allowed: {', '.join(sorted(safe_fields))})",
        }

    if dry_run:
        return {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "action": "bulk_update",
            "result": f"[DRY RUN] Would update fields: {sanitized}",
        }

    sanitized["updated_at"] = _now_iso()
    await db.claims.update_one({"id": claim_id}, {"$set": sanitized})

    return {
        "claim_id": claim_id,
        "claim_number": claim_number,
        "action": "bulk_update",
        "result": f"Updated fields: {list(sanitized.keys())}",
    }


# Action dispatcher map
ACTION_EXECUTORS = {
    "follow_up": _execute_follow_up,
    "draft_letter": _execute_draft_letter,
    "schedule_call": _execute_schedule_call,
    "flag_crn": _execute_flag_crn,
    "generate_report": _execute_generate_report,
    "update_stage": _execute_update_stage,
    "bulk_update": _execute_bulk_update,
}


async def _dispatch_actions(
    claims: list[dict],
    actions: list[str],
    options: dict,
    dry_run: bool,
) -> list[dict]:
    """Execute requested actions against each matching claim."""
    results: list[dict] = []
    for claim in claims:
        for action_name in actions:
            executor = ACTION_EXECUTORS.get(action_name)
            if not executor:
                results.append({
                    "claim_id": claim["id"],
                    "claim_number": claim.get("claim_number", "N/A"),
                    "action": action_name,
                    "result": f"Unknown action: {action_name}",
                })
                continue
            result = await executor(claim, options, dry_run)
            results.append(result)
    return results


def _build_summary(actions_taken: list[dict]) -> str:
    """Compile a human-readable summary of all actions taken."""
    total = len(actions_taken)
    if total == 0:
        return "No actions taken."

    # Count unique claims
    unique_claims = len({a["claim_id"] for a in actions_taken})

    # Count by action type
    counts: dict[str, int] = {}
    errors = 0
    skipped = 0
    for action in actions_taken:
        action_type = action.get("action", "unknown")
        result_text = action.get("result", "")
        if "Error" in result_text:
            errors += 1
        elif "Skipped" in result_text:
            skipped += 1
        else:
            counts[action_type] = counts.get(action_type, 0) + 1

    parts = [f"{unique_claims} claims actioned."]
    action_labels = {
        "follow_up": "follow-up letters drafted",
        "draft_follow_up": "follow-up letters drafted",
        "draft_letter": "demand letters drafted",
        "schedule_call": "calls scheduled",
        "flag_crn": "CRN flags raised",
        "generate_report": "reports generated",
        "update_stage": "stages updated",
        "bulk_update": "bulk updates applied",
    }
    for action_type, count in counts.items():
        label = action_labels.get(action_type, f"{action_type} actions")
        parts.append(f"{count} {label}.")

    if skipped:
        parts.append(f"{skipped} skipped.")
    if errors:
        parts.append(f"{errors} errors.")

    return " ".join(parts)


async def _log_orchestrator_run(
    user_id: str,
    instruction: str,
    parsed: dict,
    claims_matched: int,
    actions_taken: list[dict],
    summary: str,
    dry_run: bool,
) -> str:
    """Log orchestrator execution to the database for audit trail."""
    run_id = str(uuid.uuid4())
    doc = {
        "id": run_id,
        "user_id": user_id,
        "instruction": instruction,
        "parsed_instruction": parsed,
        "claims_matched": claims_matched,
        "actions_count": len(actions_taken),
        "summary": summary,
        "dry_run": dry_run,
        "created_at": _now_iso(),
    }
    await db.eve_orchestrator_runs.insert_one(doc)
    return run_id


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/orchestrate")
async def orchestrate(
    request: OrchestrateRequest,
    current_user: dict = Depends(require_role(["admin"])),
):
    """
    Main Eve Orchestrator endpoint.

    Accepts a natural language instruction, parses it with Gemini, queries
    claims, dispatches agents, and reports results.
    """
    from security import check_rate_limit
    user_id = current_user.get("id", "unknown")
    check_rate_limit(f"eve_orchestrate:{user_id}", "ai")

    # 1. Parse instruction
    parsed = await _parse_instruction(request.instruction)
    actions = parsed.get("actions", [])
    filters = parsed.get("filters", {})
    options = parsed.get("options", {})
    parse_summary = parsed.get("summary", "")

    # Validate actions
    valid_actions = [a for a in actions if a in VALID_ACTIONS]
    if not valid_actions:
        raise HTTPException(
            status_code=422,
            detail=f"No valid actions parsed from instruction. Parsed: {actions}. Valid: {sorted(VALID_ACTIONS)}",
        )

    # 2. Build query and fetch claims
    query = _build_mongo_query(filters)
    claims = await _fetch_matching_claims(query)

    # 3. Dispatch actions
    actions_taken = await _dispatch_actions(claims, valid_actions, options, request.dry_run)

    # 4. Build summary
    summary = _build_summary(actions_taken)

    # 5. Log the run
    run_id = await _log_orchestrator_run(
        user_id=user_id,
        instruction=request.instruction,
        parsed=parsed,
        claims_matched=len(claims),
        actions_taken=actions_taken,
        summary=summary,
        dry_run=request.dry_run,
    )

    return {
        "run_id": run_id,
        "dry_run": request.dry_run,
        "instruction_parsed": {
            "actions": valid_actions,
            "filters": filters,
            "options": options,
            "summary": parse_summary,
            "claims_matched": len(claims),
        },
        "actions_taken": actions_taken,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Pre-built command templates
# ---------------------------------------------------------------------------

@router.post("/actions/follow-up-stale")
async def follow_up_stale(
    request: FollowUpStaleRequest,
    current_user: dict = Depends(require_role(["admin", "manager"])),
):
    """Auto follow-up on all claims with no activity in X days."""
    user_id = current_user.get("id", "unknown")

    cutoff = _cutoff_date(request.days).isoformat()
    query = {
        "updated_at": {"$lt": cutoff},
        "stage": {"$ne": "closed"},
    }
    claims = await _fetch_matching_claims(query)

    actions_taken = await _dispatch_actions(
        claims, ["follow_up"], {"crn_threshold_days": 90}, request.dry_run,
    )
    summary = _build_summary(actions_taken)

    run_id = await _log_orchestrator_run(
        user_id=user_id,
        instruction=f"[Template] Follow up stale claims ({request.days} days)",
        parsed={"actions": ["follow_up"], "filters": {"days_since_update": {"gt": request.days}}},
        claims_matched=len(claims),
        actions_taken=actions_taken,
        summary=summary,
        dry_run=request.dry_run,
    )

    return {
        "run_id": run_id,
        "dry_run": request.dry_run,
        "claims_matched": len(claims),
        "actions_taken": actions_taken,
        "summary": summary,
    }


@router.post("/actions/check-compliance")
async def check_compliance(
    request: CheckComplianceRequest,
    current_user: dict = Depends(require_role(["admin", "manager"])),
):
    """Run compliance check across all active claims, flag violations."""
    user_id = current_user.get("id", "unknown")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Find all active deadlines that are overdue
    overdue_deadlines = await db.compliance_deadlines.find(
        {"status": "active", "deadline_date": {"$lt": now_iso}},
        {"_id": 0},
    ).to_list(500)

    actions_taken: list[dict] = []
    for deadline in overdue_deadlines:
        claim_id = deadline.get("claim_id")
        claim_number = deadline.get("claim_number", "N/A")
        deadline_type = deadline.get("deadline_type", "unknown")
        deadline_date = deadline.get("deadline_date", "unknown")

        if request.dry_run:
            actions_taken.append({
                "claim_id": claim_id,
                "claim_number": claim_number,
                "action": "compliance_violation",
                "result": f"[DRY RUN] Would flag overdue {deadline_type} (due: {deadline_date})",
            })
        else:
            # Create critical alert for each violation
            alert_doc = {
                "id": str(uuid.uuid4()),
                "deadline_id": deadline.get("id"),
                "claim_id": claim_id,
                "claim_number": claim_number,
                "alert_type": "critical",
                "message": (
                    f"COMPLIANCE VIOLATION: {deadline.get('description', deadline_type)} "
                    f"for claim {claim_number} — was due {deadline_date}"
                ),
                "acknowledged": False,
                "acknowledged_by": None,
                "acknowledged_at": None,
                "created_at": _now_iso(),
                "source": "eve_orchestrator",
            }
            await db.compliance_alerts.insert_one(alert_doc)
            actions_taken.append({
                "claim_id": claim_id,
                "claim_number": claim_number,
                "action": "compliance_violation",
                "result": f"Alert created: overdue {deadline_type} (due: {deadline_date})",
                "alert_id": alert_doc["id"],
            })

    summary = f"{len(overdue_deadlines)} overdue deadlines found. {len(actions_taken)} compliance alerts {'would be ' if request.dry_run else ''}created."

    run_id = await _log_orchestrator_run(
        user_id=user_id,
        instruction="[Template] Check compliance — flag overdue deadlines",
        parsed={"actions": ["check_compliance"]},
        claims_matched=len(overdue_deadlines),
        actions_taken=actions_taken,
        summary=summary,
        dry_run=request.dry_run,
    )

    return {
        "run_id": run_id,
        "dry_run": request.dry_run,
        "overdue_deadlines": len(overdue_deadlines),
        "actions_taken": actions_taken,
        "summary": summary,
    }


@router.post("/actions/draft-crn")
async def draft_crn(
    request: DraftCrnRequest,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Draft Civil Remedy Notices for claims exceeding 90-day carrier decision window."""
    user_id = current_user.get("id", "unknown")

    cutoff = _cutoff_date(90).isoformat()
    query = {
        "updated_at": {"$lt": cutoff},
        "stage": {"$in": ["inspection", "negotiation"]},
    }
    claims = await _fetch_matching_claims(query)

    actions_taken = await _dispatch_actions(
        claims, ["flag_crn"], {"crn_threshold_days": 90}, request.dry_run,
    )
    summary = _build_summary(actions_taken)

    run_id = await _log_orchestrator_run(
        user_id=user_id,
        instruction="[Template] Draft CRN for claims exceeding 90-day carrier decision window",
        parsed={"actions": ["flag_crn"], "filters": {"days_since_update": {"gt": 90}}},
        claims_matched=len(claims),
        actions_taken=actions_taken,
        summary=summary,
        dry_run=request.dry_run,
    )

    return {
        "run_id": run_id,
        "dry_run": request.dry_run,
        "claims_matched": len(claims),
        "actions_taken": actions_taken,
        "summary": summary,
    }


@router.post("/actions/generate-demand-letters")
async def generate_demand_letters(
    request: GenerateDemandLettersRequest,
    current_user: dict = Depends(require_role(["admin"])),
):
    """Generate demand letters for claims in negotiation with no settlement."""
    user_id = current_user.get("id", "unknown")

    query = {
        "stage": "negotiation",
        "replacement_cost_value": {"$gte": request.min_rcv},
        "$or": [
            {"settlement_amount": None},
            {"settlement_amount": 0},
            {"settlement_amount": {"$exists": False}},
        ],
    }
    claims = await _fetch_matching_claims(query)

    actions_taken = await _dispatch_actions(
        claims, ["draft_letter"], {}, request.dry_run,
    )
    summary = _build_summary(actions_taken)

    run_id = await _log_orchestrator_run(
        user_id=user_id,
        instruction=f"[Template] Generate demand letters (min RCV: ${request.min_rcv:,.2f})",
        parsed={"actions": ["draft_letter"], "filters": {"min_rcv": request.min_rcv}},
        claims_matched=len(claims),
        actions_taken=actions_taken,
        summary=summary,
        dry_run=request.dry_run,
    )

    return {
        "run_id": run_id,
        "dry_run": request.dry_run,
        "claims_matched": len(claims),
        "actions_taken": actions_taken,
        "summary": summary,
    }


@router.get("/actions/status")
async def get_orchestrator_status(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role(["admin", "manager"])),
):
    """Show recent orchestrator runs and their results."""
    skip = (page - 1) * limit
    total = await db.eve_orchestrator_runs.count_documents({})

    runs = await db.eve_orchestrator_runs.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "runs": runs,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if total else 0,  # ceiling division
    }
