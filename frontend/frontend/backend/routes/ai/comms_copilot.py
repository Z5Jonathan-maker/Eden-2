"""Comms copilot endpoints: claim comms, team comms, and copilot-next-actions."""

from __future__ import annotations

import json
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from dependencies import get_current_active_user

from routes.ai.shared import (
    ClaimCopilotAction,
    ClaimCopilotResponse,
    ClaimEvidenceGap,
    CommsCopilotRequest,
    CommsCopilotResponse,
    TeamCommsCopilotRequest,
    TeamCommsCopilotResponse,
    fetch_claim_context,
    _send_via_ai_gateway,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Copilot fallback / heuristic helpers
# ---------------------------------------------------------------------------

def _build_copilot_fallback_actions(context: dict) -> List[dict]:
    actions = []
    documents_count = int(context.get("documents_count", 0) or 0)
    notes_count = int(context.get("notes_count", 0) or 0)
    status = str(context.get("status", "")).lower()

    if documents_count == 0:
        actions.append({
            "title": "Upload core claim documents",
            "rationale": "No claim documents are currently on file; demand and negotiation workflows will stall.",
            "priority": "critical",
            "owner": "adjuster",
            "eta_hours": 2,
        })
    if notes_count < 2:
        actions.append({
            "title": "Add claim timeline notes",
            "rationale": "Limited notes reduce handoff quality and weaken carrier escalation records.",
            "priority": "high",
            "owner": "adjuster",
            "eta_hours": 1,
        })
    if status in {"new", "intake", "under review"}:
        actions.append({
            "title": "Run client + carrier follow-up",
            "rationale": "Early communication compresses cycle time and reduces stale-claim risk.",
            "priority": "high",
            "owner": "comms",
            "eta_hours": 4,
        })
    if not actions:
        actions.append({
            "title": "Prepare demand-ready packet",
            "rationale": "Claim appears healthy; package evidence and narrative for a stronger payout position.",
            "priority": "medium",
            "owner": "adjuster",
            "eta_hours": 6,
        })
    return actions[:4]


def _derive_claim_evidence_gaps(context: dict) -> List[dict]:
    gaps: List[dict] = []
    documents_count = int(context.get("documents_count", 0) or 0)
    notes_count = int(context.get("notes_count", 0) or 0)

    policy_number = str(context.get("policy_number", "") or "").strip()
    loss_date = str(context.get("loss_date", "") or context.get("date_of_loss", "") or "").strip()
    property_address = str(context.get("property_address", "") or "").strip()
    carrier = str(context.get("carrier", "") or "").strip()
    client_email = str(context.get("client_email", "") or "").strip()
    client_phone = str(context.get("client_phone", "") or "").strip()

    if not policy_number:
        gaps.append({
            "code": "missing_policy_number",
            "title": "Policy number missing",
            "severity": "high",
            "rationale": "Coverage validation and carrier escalation quality drop without policy reference.",
            "recommended_action": "Update claim intake with policy number before next carrier touchpoint.",
            "cta": "edit_claim",
        })

    if not loss_date:
        gaps.append({
            "code": "missing_loss_date",
            "title": "Date of loss missing",
            "severity": "high",
            "rationale": "Timeline-sensitive deadlines and weather correlation checks depend on loss date.",
            "recommended_action": "Capture and save exact date of loss from insured or first notice.",
            "cta": "edit_claim",
        })

    if not property_address:
        gaps.append({
            "code": "missing_property_address",
            "title": "Property address missing",
            "severity": "medium",
            "rationale": "Weather verification, inspections, and legal notices require exact property address.",
            "recommended_action": "Populate property address in claim profile to unlock downstream workflows.",
            "cta": "edit_claim",
        })

    if not carrier:
        gaps.append({
            "code": "missing_carrier",
            "title": "Carrier information missing",
            "severity": "medium",
            "rationale": "Carrier-specific playbooks and communication templates cannot be applied reliably.",
            "recommended_action": "Set carrier on the claim before generating demand or escalation drafts.",
            "cta": "edit_claim",
        })

    if not client_email and not client_phone:
        gaps.append({
            "code": "missing_client_contact",
            "title": "Client contact details missing",
            "severity": "high",
            "rationale": "Client updates and document requests cannot be executed without contact channels.",
            "recommended_action": "Add at least one reachable contact channel (email or phone).",
            "cta": "edit_claim",
        })

    if documents_count <= 0:
        gaps.append({
            "code": "missing_documents",
            "title": "No supporting documents uploaded",
            "severity": "critical",
            "rationale": "Demand packages and supplement justifications require evidence artifacts.",
            "recommended_action": "Upload policy, estimate, and damage evidence documents.",
            "cta": "upload_documents",
        })

    if notes_count < 2:
        gaps.append({
            "code": "thin_claim_timeline",
            "title": "Timeline notes are thin",
            "severity": "medium",
            "rationale": "Weak timeline records increase handoff friction and reduce dispute defensibility.",
            "recommended_action": "Log recent milestones and next commitments in claim notes.",
            "cta": "add_note",
        })

    if documents_count > 0:
        doc_tokens = []
        for item in context.get("documents_summary", [])[:20]:
            token = f"{item.get('type', '')} {item.get('filename', '')}".strip().lower()
            if token:
                doc_tokens.append(token)
        doc_footprint = " ".join(doc_tokens)
        missing_doc_types = []
        if "policy" not in doc_footprint:
            missing_doc_types.append("policy")
        if "estimate" not in doc_footprint:
            missing_doc_types.append("estimate")
        if "photo" not in doc_footprint and "image" not in doc_footprint:
            missing_doc_types.append("photos")
        if missing_doc_types:
            gaps.append({
                "code": "document_mix_gaps",
                "title": "Evidence mix has gaps",
                "severity": "medium",
                "rationale": "Current uploads may be incomplete for negotiation-ready packaging.",
                "recommended_action": f"Add likely missing evidence types: {', '.join(missing_doc_types)}.",
                "cta": "upload_documents",
            })

    return gaps[:6]


def _derive_thread_intent(request: CommsCopilotRequest, recent_messages: List[dict]) -> str:
    explicit = str(request.intent or "").strip().lower()
    if explicit:
        return explicit.replace(" ", "_")
    corpus = " ".join([str(m.get("body", "")).lower() for m in recent_messages[-20:]])
    if any(token in corpus for token in ["docs", "document", "upload", "policy"]):
        return "document_collection"
    if any(token in corpus for token in ["payment", "money", "settlement", "offer"]):
        return "settlement_update"
    if any(token in corpus for token in ["call", "schedule", "appointment", "tomorrow"]):
        return "scheduling"
    return "status_update"


def _derive_comms_risk(context: dict, recent_messages: List[dict]) -> dict:
    flags: List[str] = []
    if not context.get("policy_number"):
        flags.append("Missing policy number in claim profile")
    if not context.get("loss_date") and not context.get("date_of_loss"):
        flags.append("Missing date of loss in claim profile")
    if int(context.get("documents_count", 0) or 0) <= 0:
        flags.append("No supporting documents uploaded")

    corpus = " ".join([str(m.get("body", "")).lower() for m in recent_messages[-20:]])
    legal_tokens = ["attorney", "lawsuit", "bad faith", "department of financial services", "complaint", "civil remedy"]
    urgency_tokens = ["urgent", "asap", "today", "immediately", "now"]
    if any(token in corpus for token in legal_tokens):
        flags.append("Possible legal escalation language in thread")
    if any(token in corpus for token in urgency_tokens):
        flags.append("High urgency language detected in recent messages")

    if any("legal escalation" in flag.lower() for flag in flags):
        risk_level = "high"
    elif len(flags) >= 3:
        risk_level = "high"
    elif len(flags) == 2:
        risk_level = "medium"
    elif len(flags) == 1:
        risk_level = "low"
    else:
        risk_level = "low"
    return {"risk_level": risk_level, "risk_flags": flags[:5]}


def _build_comms_copilot_fallback(context: dict, request: CommsCopilotRequest, recent_messages: List[dict]) -> dict:
    client_name = context.get("client_name") or "there"
    missing = []
    if not context.get("policy_number"):
        missing.append("policy number")
    if not context.get("loss_date") and not context.get("date_of_loss"):
        missing.append("date of loss")
    if int(context.get("documents_count", 0) or 0) <= 0:
        missing.append("supporting documents")

    summary = f"Claim {context.get('claim_number', '')} thread needs a concise progress update and next milestone confirmation."
    if missing:
        next_action = f"Request missing items ({', '.join(missing)}) and confirm expected delivery time."
        suggested_reply = (
            f"Hi {client_name}, quick update from Eden. To keep your claim moving, we still need: "
            f"{', '.join(missing)}. Please send these and we will advance to the next step today."
        )
        reply_options = [
            suggested_reply,
            f"Hi {client_name}, we are ready to advance your claim once we receive: {', '.join(missing)}. Please send what you have today.",
            f"Quick claim update: missing items are {', '.join(missing)}. Reply with availability and we will guide next steps.",
        ]
    else:
        next_action = "Confirm claim timeline and next milestone in one short, confident message."
        suggested_reply = (
            f"Hi {client_name}, quick status update from Eden: your claim is actively progressing. "
            "Our next milestone is in motion, and we will send another update as soon as it posts."
        )
        reply_options = [
            suggested_reply,
            f"Hi {client_name}, your claim is moving forward. We are finalizing the next milestone and will update you again shortly.",
            f"Status update from Eden: file is active and on track. Please reply if you need anything reviewed before our next checkpoint.",
        ]
    return {
        "summary": summary,
        "next_action": next_action,
        "suggested_reply": suggested_reply,
        "reply_options": reply_options,
        "thread_intent": _derive_thread_intent(request, recent_messages),
        **_derive_comms_risk(context, recent_messages),
        "confidence": "medium",
    }


def _build_team_comms_fallback(request: TeamCommsCopilotRequest) -> dict:
    base_summary = "Recent team channel activity indicates a need for clear ownership and next deadline."
    if request.mode == "announcement":
        return {
            "summary": base_summary,
            "next_action": "Post one concise announcement with owner and due time.",
            "suggested_title": "Ops Update",
            "suggested_body": "Team update: next milestone is in motion. Owner is assigned, and we expect completion by end of day. Reply in thread with blockers only.",
            "confidence": "medium",
        }
    return {
        "summary": base_summary,
        "next_action": "Send a short alignment message and request explicit acknowledgements.",
        "suggested_title": None,
        "suggested_body": "Quick sync: we are on track for the next milestone. Please confirm your assigned piece and flag blockers within the next 30 minutes.",
        "confidence": "medium",
    }


# ---------------------------------------------------------------------------
# POST /claims/{claim_id}/copilot-next-actions
# ---------------------------------------------------------------------------

@router.post("/claims/{claim_id}/copilot-next-actions", response_model=ClaimCopilotResponse)
async def claim_copilot_next_actions(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Generate prioritized claim next actions from claim context."""
    from security import check_rate_limit
    user_id = current_user.get("id")
    check_rate_limit(f"ai:{user_id}", "ai")
    context = await fetch_claim_context(claim_id, current_user)
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")

    prompt = (
        "You are a claims operations copilot for Florida public adjusters.\n"
        "Return ONLY valid JSON with this shape:\n"
        "{\"confidence\":\"high|medium|low\",\"actions\":[{\"title\":\"...\",\"rationale\":\"...\",\"priority\":\"critical|high|medium|low\",\"owner\":\"adjuster|comms|ops\",\"eta_hours\":number}],\"evidence_gaps\":[{\"code\":\"...\",\"title\":\"...\",\"severity\":\"critical|high|medium|low\",\"rationale\":\"...\",\"recommended_action\":\"...\",\"cta\":\"edit_claim|upload_documents|add_note|request_client_docs\"}]}\n"
        "Rules: max 4 actions, concrete and execution-focused, no markdown.\n\n"
        f"Claim context:\n{json.dumps(context, default=str)}"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"claims-copilot-{user_id}-{claim_id}",
            system_message="You produce concise operations plans for active insurance claims.",
            prompt_text=prompt,
            task_type="claims_copilot",
        )
        parsed = json.loads(ai_text)
        actions = parsed.get("actions") or []
        evidence_gaps = parsed.get("evidence_gaps") or []
        normalized = []
        for action in actions[:4]:
            normalized.append(ClaimCopilotAction(
                title=str(action.get("title", "Untitled action")),
                rationale=str(action.get("rationale", "")),
                priority=str(action.get("priority", "medium")).lower(),
                owner=str(action.get("owner", "adjuster")).lower(),
                eta_hours=max(1, int(action.get("eta_hours", 4))),
            ))
        normalized_gaps = []
        for gap in evidence_gaps[:6]:
            normalized_gaps.append(ClaimEvidenceGap(
                code=str(gap.get("code", "unspecified_gap")).strip() or "unspecified_gap",
                title=str(gap.get("title", "Unspecified evidence gap")),
                severity=str(gap.get("severity", "medium")).lower(),
                rationale=str(gap.get("rationale", "")),
                recommended_action=str(gap.get("recommended_action", "")),
                cta=str(gap.get("cta", "edit_claim")).lower(),
            ))
        if not normalized:
            raise ValueError("No actions returned by model")
        if not normalized_gaps:
            normalized_gaps = [ClaimEvidenceGap(**item) for item in _derive_claim_evidence_gaps(context)]
        confidence = str(parsed.get("confidence", "medium")).lower()
        return ClaimCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider=provider,
            model=model,
            actions=normalized,
            evidence_gaps=normalized_gaps,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium",
        )
    except Exception as err:
        logger.warning("Claim copilot fallback for %s: %s", claim_id, err)
        fallback_actions = [ClaimCopilotAction(**item) for item in _build_copilot_fallback_actions(context)]
        fallback_gaps = [ClaimEvidenceGap(**item) for item in _derive_claim_evidence_gaps(context)]
        return ClaimCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider="fallback",
            model="heuristic",
            actions=fallback_actions,
            evidence_gaps=fallback_gaps,
            confidence="medium",
        )


# ---------------------------------------------------------------------------
# POST /claims/{claim_id}/comms-copilot
# ---------------------------------------------------------------------------

@router.post("/claims/{claim_id}/comms-copilot", response_model=CommsCopilotResponse)
async def claim_comms_copilot(
    claim_id: str,
    request: CommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Generate communications summary + next-best action + suggested reply for claim thread."""
    from security import check_rate_limit
    user_id = current_user.get("id")
    check_rate_limit(f"ai:{user_id}", "ai")
    context = await fetch_claim_context(claim_id, current_user)
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")

    recent_messages = request.messages or context.get("recent_communications") or []
    prompt = (
        "You are a claim communications copilot for a Florida public adjusting team.\n"
        "Return ONLY valid JSON with keys: summary, next_action, suggested_reply, reply_options, thread_intent, risk_level, risk_flags, confidence.\n"
        "Constraints:\n"
        "- summary: <= 2 sentences\n"
        "- next_action: one concrete operator step\n"
        "- suggested_reply: one SMS-style message <= 320 chars\n"
        "- reply_options: array of exactly 3 distinct SMS-style options <= 320 chars each\n"
        "- thread_intent: snake_case string like status_update, document_collection, scheduling, settlement_update\n"
        "- risk_level: low|medium|high\n"
        "- risk_flags: array of short operator-facing warnings\n"
        "- confidence: high|medium|low\n"
        "- no markdown\n\n"
        f"Intent: {request.intent or 'status update'}\n"
        f"Tone: {request.tone or 'professional'}\n"
        f"Channel: {request.channel or 'sms'}\n"
        f"Claim context: {json.dumps(context, default=str)}\n"
        f"Recent messages: {json.dumps(recent_messages[-20:], default=str)}\n"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"comms-copilot-{user_id}-{claim_id}",
            system_message="You produce concise, compliant claim communications guidance.",
            prompt_text=prompt,
            task_type="comms_copilot",
        )
        parsed = json.loads(ai_text)
        summary = str(parsed.get("summary", "")).strip()
        next_action = str(parsed.get("next_action", "")).strip()
        suggested_reply = str(parsed.get("suggested_reply", "")).strip()
        reply_options_raw = parsed.get("reply_options") or []
        normalized_options: List[str] = []
        if isinstance(reply_options_raw, list):
            for item in reply_options_raw:
                text = str(item or "").strip()
                if text and text not in normalized_options:
                    normalized_options.append(text[:320])
        if suggested_reply and suggested_reply not in normalized_options:
            normalized_options.insert(0, suggested_reply[:320])
        normalized_options = normalized_options[:3]
        thread_intent = str(parsed.get("thread_intent", "")).strip().lower().replace(" ", "_")
        risk_level = str(parsed.get("risk_level", "")).strip().lower()
        raw_flags = parsed.get("risk_flags") or []
        risk_flags: List[str] = []
        if isinstance(raw_flags, list):
            for item in raw_flags:
                text = str(item or "").strip()
                if text and text not in risk_flags:
                    risk_flags.append(text[:160])
        if not thread_intent:
            thread_intent = _derive_thread_intent(request, recent_messages)
        if risk_level not in {"low", "medium", "high"}:
            risk_level = _derive_comms_risk(context, recent_messages)["risk_level"]
        if not risk_flags:
            risk_flags = _derive_comms_risk(context, recent_messages)["risk_flags"]
        confidence = str(parsed.get("confidence", "medium")).lower().strip()

        if not summary or not next_action or not suggested_reply:
            raise ValueError("Incomplete comms copilot response")
        if not normalized_options:
            raise ValueError("Comms copilot reply options missing")

        return CommsCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider=provider,
            model=model,
            summary=summary,
            next_action=next_action,
            suggested_reply=suggested_reply,
            reply_options=normalized_options,
            thread_intent=thread_intent,
            risk_level=risk_level,
            risk_flags=risk_flags,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium",
        )
    except Exception as err:
        logger.warning("Comms copilot fallback for %s: %s", claim_id, err)
        fallback = _build_comms_copilot_fallback(context, request, recent_messages)
        return CommsCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider="fallback",
            model="heuristic",
            summary=fallback["summary"],
            next_action=fallback["next_action"],
            suggested_reply=fallback["suggested_reply"],
            reply_options=fallback.get("reply_options", []),
            thread_intent=fallback.get("thread_intent", "status_update"),
            risk_level=fallback.get("risk_level", "medium"),
            risk_flags=fallback.get("risk_flags", []),
            confidence=fallback["confidence"],
        )


# ---------------------------------------------------------------------------
# POST /comms/team-copilot
# ---------------------------------------------------------------------------

@router.post("/comms/team-copilot", response_model=TeamCommsCopilotResponse)
async def team_comms_copilot(
    request: TeamCommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Generate team-channel comms summary + action + draft for message/announcement mode."""
    user_id = current_user.get("id")
    role = current_user.get("role", "")
    if role not in {"admin", "manager", "adjuster"}:
        raise HTTPException(status_code=403, detail="Insufficient role for team comms copilot")

    recent = (request.recent_messages or [])[-30:]
    prompt = (
        "You are a concise operations communications copilot for an insurance claims team.\n"
        "Return ONLY valid JSON with keys: summary, next_action, suggested_body, suggested_title, confidence.\n"
        "Rules:\n"
        "- summary <= 2 sentences\n"
        "- next_action is one concrete operator step\n"
        "- suggested_body <= 500 chars\n"
        "- suggested_title required only for announcement mode, otherwise empty\n"
        "- confidence: high|medium|low\n"
        "- no markdown\n\n"
        f"Channel name: {request.channel_name or 'Unknown'}\n"
        f"Channel type: {request.channel_type or 'internal_public'}\n"
        f"Mode: {request.mode or 'message'}\n"
        f"Intent: {request.intent or 'status update'}\n"
        f"Tone: {request.tone or 'professional'}\n"
        f"Recent messages: {json.dumps(recent, default=str)}\n"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"team-comms-copilot-{user_id}-{request.channel_id}",
            system_message="You draft high-signal internal team communications.",
            prompt_text=prompt,
            task_type="team_comms_copilot",
        )
        parsed = json.loads(ai_text)
        summary = str(parsed.get("summary", "")).strip()
        next_action = str(parsed.get("next_action", "")).strip()
        suggested_body = str(parsed.get("suggested_body", "")).strip()
        suggested_title = parsed.get("suggested_title")
        suggested_title = str(suggested_title).strip() if suggested_title is not None else None
        confidence = str(parsed.get("confidence", "medium")).lower().strip()
        if not summary or not next_action or not suggested_body:
            raise ValueError("Incomplete team comms copilot response")
        return TeamCommsCopilotResponse(
            provider=provider,
            model=model,
            summary=summary,
            next_action=next_action,
            suggested_body=suggested_body,
            suggested_title=suggested_title if request.mode == "announcement" else None,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium",
        )
    except Exception as err:
        logger.warning("Team comms copilot fallback for %s: %s", request.channel_id, err)
        fallback = _build_team_comms_fallback(request)
        return TeamCommsCopilotResponse(
            provider="fallback",
            model="heuristic",
            summary=fallback["summary"],
            next_action=fallback["next_action"],
            suggested_body=fallback["suggested_body"],
            suggested_title=fallback["suggested_title"] if request.mode == "announcement" else None,
            confidence=fallback["confidence"],
        )
