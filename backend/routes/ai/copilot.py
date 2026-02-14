"""
AI Module - Copilot Routes

Claim copilot, comms copilot, and team copilot AI assistance.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import logging
import uuid
import re
import json

logger = logging.getLogger(__name__)

# Import the Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)

# Get the Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


from .models import (
    ClaimCopilotAction, ClaimEvidenceGap, ClaimCopilotResponse,
    CommsCopilotRequest, CommsCopilotResponse,
    TeamCommsCopilotRequest, TeamCommsCopilotResponse
)
from .prompts import (
    FIRM_CONTEXT,
    fetch_claim_context,
    format_claim_context_for_prompt
)

router = APIRouter()

@router.post("/claims/{claim_id}/copilot-next-actions", response_model=ClaimCopilotResponse)
async def claim_copilot_next_actions(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate prioritized claim next actions from claim context."""
    user_id = current_user.get("id")
    context = await fetch_claim_context(claim_id, user_id)
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
            task_type="claims_copilot"
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
                eta_hours=max(1, int(action.get("eta_hours", 4)))
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
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium"
        )
    except Exception as err:
        logger.warning(f"Claim copilot fallback for {claim_id}: {err}")
        fallback_actions = [ClaimCopilotAction(**item) for item in _build_copilot_fallback_actions(context)]
        fallback_gaps = [ClaimEvidenceGap(**item) for item in _derive_claim_evidence_gaps(context)]
        return ClaimCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider="fallback",
            model="heuristic",
            actions=fallback_actions,
            evidence_gaps=fallback_gaps,
            confidence="medium"
        )


@router.post("/claims/{claim_id}/comms-copilot", response_model=CommsCopilotResponse)
async def claim_comms_copilot(
    claim_id: str,
    request: CommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate communications summary + next-best action + suggested reply for claim thread."""
    user_id = current_user.get("id")
    context = await fetch_claim_context(claim_id, user_id)
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
            task_type="comms_copilot"
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
        logger.warning(f"Comms copilot fallback for {claim_id}: {err}")
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


@router.post("/comms/team-copilot", response_model=TeamCommsCopilotResponse)
async def team_comms_copilot(
    request: TeamCommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user)
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
            task_type="team_comms_copilot"
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
        logger.warning(f"Team comms copilot fallback for {request.channel_id}: {err}")
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


@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all chat sessions for the current user"""
    user_id = current_user.get("id")
    
    sessions = await db.ai_sessions.find(
        {"user_id": user_id},
        {"_id": 0, "session_id": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)
    
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific chat session with all messages"""
    user_id = current_user.get("id")
    
    session = await db.ai_sessions.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a chat session"""
    user_id = current_user.get("id")
    
    result = await db.ai_sessions.delete_one({
        "session_id": session_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}


@router.post("/sessions/new")
async def create_new_session(
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new chat session"""
    session_id = str(uuid.uuid4())
    
    return {"session_id": session_id}



