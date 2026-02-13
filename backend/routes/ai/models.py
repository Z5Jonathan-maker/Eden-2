"""
AI Module - Pydantic Models

Request/response models for AI chat, copilot, and context features.
"""

import os
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    claim_context: Optional[dict] = None  # Optional claim data for context
    claim_id: Optional[str] = None  # Direct claim ID reference
    provider: Optional[str] = None
    model: Optional[str] = None
    task_type: Optional[str] = "chat"


class ChatResponse(BaseModel):
    response: str
    session_id: str
    claim_context: Optional[dict] = None  # Return detected claim context


class ClaimCopilotAction(BaseModel):
    title: str
    rationale: str
    priority: str
    owner: str
    eta_hours: int


class ClaimEvidenceGap(BaseModel):
    code: str
    title: str
    severity: str
    rationale: str
    recommended_action: str
    cta: str


class ClaimCopilotResponse(BaseModel):
    claim_id: str
    claim_number: str
    provider: str
    model: str
    actions: List[ClaimCopilotAction]
    evidence_gaps: List[ClaimEvidenceGap] = []
    confidence: str


class CommsCopilotRequest(BaseModel):
    intent: Optional[str] = "status update"
    tone: Optional[str] = "professional"
    channel: Optional[str] = "sms"
    messages: Optional[List[dict]] = None


class CommsCopilotResponse(BaseModel):
    claim_id: str
    claim_number: str
    provider: str
    model: str
    summary: str
    next_action: str
    suggested_reply: str
    reply_options: List[str] = []
    thread_intent: str = "status_update"
    risk_level: str = "medium"
    risk_flags: List[str] = []
    confidence: str


class TeamCommsCopilotRequest(BaseModel):
    channel_id: str
    channel_name: Optional[str] = None
    channel_type: Optional[str] = "internal_public"
    mode: Optional[str] = "message"  # message | announcement
    intent: Optional[str] = "status update"
    tone: Optional[str] = "professional"
    recent_messages: Optional[List[dict]] = None


class TeamCommsCopilotResponse(BaseModel):
    provider: str
    model: str
    summary: str
    next_action: str
    suggested_body: str
    suggested_title: Optional[str] = None
    confidence: str


SUPPORTED_PROVIDERS = {"openai", "anthropic"}
OPENAI_MODEL_DEFAULT = os.environ.get("OPENAI_MODEL", "gpt-4o")
ANTHROPIC_MODEL_DEFAULT = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
AI_DAILY_BUDGET_USD = float(os.environ.get("AI_DAILY_BUDGET_USD", "25"))
AI_COST_PER_1K_TOKENS = {
    "openai": float(os.environ.get("OPENAI_COST_PER_1K_TOKENS", "0.01")),
    "anthropic": float(os.environ.get("ANTHROPIC_COST_PER_1K_TOKENS", "0.012")),
}


def _task_budget_env_key(task_type: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", (task_type or "generic")).upper().strip("_")
    return f"AI_TASK_DAILY_BUDGET_USD_{normalized}"


def _get_task_daily_budget_usd(task_type: str) -> Optional[float]:
    raw = os.environ.get(_task_budget_env_key(task_type))
    if raw is None or str(raw).strip() == "":
        return None
    try:
        parsed = float(raw)
    except Exception:
        return None
    return parsed if parsed >= 0 else None


def _select_provider_and_model(
    task_type: str,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None,
    provider_order: Optional[List[str]] = None,
):
    provider = (preferred_provider or "").strip().lower()
    if provider in SUPPORTED_PROVIDERS:
        model = preferred_model or (OPENAI_MODEL_DEFAULT if provider == "openai" else ANTHROPIC_MODEL_DEFAULT)
        return provider, model

    ordered_supported = [p for p in (provider_order or []) if p in SUPPORTED_PROVIDERS]
    if ordered_supported:
        provider = ordered_supported[0]
        model = preferred_model or (OPENAI_MODEL_DEFAULT if provider == "openai" else ANTHROPIC_MODEL_DEFAULT)
        return provider, model

    high_reasoning_tasks = {"claims_copilot", "legal_analysis", "strategy_memo", "reasoning"}
    if (task_type or "").strip().lower() in high_reasoning_tasks:
        return "anthropic", ANTHROPIC_MODEL_DEFAULT

    return "openai", OPENAI_MODEL_DEFAULT


def _redact_prompt_text(text: str) -> str:
    if not text:
        return text
    redacted = text
    redacted = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', "[REDACTED_EMAIL]", redacted)
    redacted = re.sub(r'\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b', "[REDACTED_PHONE]", redacted)
    redacted = re.sub(r'\b[A-Z0-9]{6,}\b', lambda m: "[REDACTED_ID]" if any(ch.isdigit() for ch in m.group(0)) else m.group(0), redacted)
    return redacted


def _estimate_cost_usd(provider: str, prompt_text: str, response_text: str = "") -> float:
    approx_tokens = max(1, (len(prompt_text) + len(response_text)) // 4)
    cost_per_1k = AI_COST_PER_1K_TOKENS.get(provider, AI_COST_PER_1K_TOKENS["openai"])
    return round((approx_tokens / 1000.0) * cost_per_1k, 6)


async def _enforce_daily_budget(user_id: str, projected_cost_usd: float):
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.ai_usage_logs.find(
        {"user_id": user_id, "created_at": {"$gte": start_of_day}},
        {"_id": 0, "estimated_cost_usd": 1}
    )
    entries = await cursor.to_list(10000)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > AI_DAILY_BUDGET_USD:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI budget exceeded (${AI_DAILY_BUDGET_USD:.2f}). Try again tomorrow or reduce request size."
        )


async def _enforce_task_daily_budget(user_id: str, task_type: str, projected_cost_usd: float):
    task_limit = _get_task_daily_budget_usd(task_type)
    if task_limit is None:
        return
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.ai_usage_logs.find(
        {"user_id": user_id, "task_type": task_type, "created_at": {"$gte": start_of_day}},
        {"_id": 0, "estimated_cost_usd": 1}
    )
    entries = await cursor.to_list(10000)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > task_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Task budget exceeded for '{task_type}' "
                f"(${task_limit:.2f}/day). Try again later or reduce request size."
            ),
        )


async def _log_ai_usage(user_id: str, task_type: str, provider: str, model: str, prompt_text: str, response_text: str, status: str = "success", error: Optional[str] = None):
    await db.ai_usage_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "task_type": task_type,
        "provider": provider,
        "model": model,
        "prompt_chars": len(prompt_text),
        "response_chars": len(response_text or ""),
        "estimated_cost_usd": _estimate_cost_usd(provider, prompt_text, response_text),
        "status": status,
        "error": error,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def _send_via_ai_gateway(*, user_id: str, session_key: str, system_message: str, prompt_text: str, task_type: str, preferred_provider: Optional[str] = None, preferred_model: Optional[str] = None):
    safe_prompt = _redact_prompt_text(prompt_text)
    runtime_cfg = await load_policy_runtime_routing_config(db)
    configured_order = runtime_cfg.get("task_provider_order", {}).get(task_type)
    resolved_order = sanitize_policy_provider_order(
        configured_order or resolve_policy_provider_order_for_task(task_type),
        default_order=resolve_policy_provider_order_for_task(task_type),
    )
    provider_order = [p for p in resolved_order if p in SUPPORTED_PROVIDERS]
    provider, model = _select_provider_and_model(
        task_type,
        preferred_provider,
        preferred_model,
        provider_order=provider_order,
    )
    fallback_enabled = bool(runtime_cfg.get("fallback_enabled", True))
    estimated_cost = _estimate_cost_usd(provider, safe_prompt, "")
    await _enforce_daily_budget(user_id, estimated_cost)
    await _enforce_task_daily_budget(user_id, task_type, estimated_cost)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_key,
            system_message=system_message
        ).with_model(provider, model)
        response_text = await chat.send_message(UserMessage(text=safe_prompt))
        await _log_ai_usage(
            user_id=user_id,
            task_type=task_type,
            provider=provider,
            model=model,
            prompt_text=safe_prompt,
            response_text=response_text
        )
        return response_text, provider, model
    except Exception as first_err:
        if not fallback_enabled or len(provider_order) < 2:
            await _log_ai_usage(
                user_id=user_id,
                task_type=task_type,
                provider=provider,
                model=model,
                prompt_text=safe_prompt,
                response_text="",
                status="error",
                error=str(first_err)
            )
            raise

        fallback_provider = provider_order[1]
        fallback_model = OPENAI_MODEL_DEFAULT
        if fallback_provider == "anthropic":
            fallback_model = ANTHROPIC_MODEL_DEFAULT
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{session_key}-fallback",
            system_message=system_message
        ).with_model(fallback_provider, fallback_model)
        response_text = await chat.send_message(UserMessage(text=safe_prompt))
        await _log_ai_usage(
            user_id=user_id,
            task_type=task_type,
            provider=fallback_provider,
            model=fallback_model,
            prompt_text=safe_prompt,
            response_text=response_text,
            status="fallback",
            error=str(first_err)
        )
        return response_text, fallback_provider, fallback_model


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
            "eta_hours": 2
        })
    if notes_count < 2:
        actions.append({
            "title": "Add claim timeline notes",
            "rationale": "Limited notes reduce handoff quality and weaken carrier escalation records.",
            "priority": "high",
            "owner": "adjuster",
            "eta_hours": 1
        })
    if status in {"new", "intake", "under review"}:
        actions.append({
            "title": "Run client + carrier follow-up",
            "rationale": "Early communication compresses cycle time and reduces stale-claim risk.",
            "priority": "high",
            "owner": "comms",
            "eta_hours": 4
        })
    if not actions:
        actions.append({
            "title": "Prepare demand-ready packet",
            "rationale": "Claim appears healthy; package evidence and narrative for a stronger payout position.",
            "priority": "medium",
            "owner": "adjuster",
            "eta_hours": 6
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
            f"Quick claim update: missing items are {', '.join(missing)}. Reply with availability and we will guide next steps."
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
            f"Status update from Eden: file is active and on track. Please reply if you need anything reviewed before our next checkpoint."
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


