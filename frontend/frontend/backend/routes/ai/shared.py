"""Shared utilities: Pydantic models, claim context helpers, AI gateway, budget enforcement."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from pydantic import BaseModel

from dependencies import db
from emergentintegrations.llm.chat import LlmChat, UserMessage
from routes.knowledge_base import INDUSTRY_EXPERTS, FLORIDA_PA_LAWS
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)
from services.ollama_config import (
    DEFAULT_OLLAMA_MODEL,
    get_ollama_api_key,
    get_ollama_model,
    normalize_ollama_base_url,
    ollama_endpoint,
)

from routes.ai.prompts import (
    EMERGENT_LLM_KEY,
    SUPPORTED_PROVIDERS,
    OLLAMA_MODEL_DEFAULT,
    OPENAI_MODEL_DEFAULT,
    ANTHROPIC_MODEL_DEFAULT,
    AI_DAILY_BUDGET_USD,
    AI_COST_PER_1K_TOKENS,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Knowledge-base helpers (experts, statutes)
# ---------------------------------------------------------------------------

def get_relevant_expert_insights(query: str) -> str:
    """Search industry experts for relevant insights to include in Eve's context"""
    query_lower = query.lower()
    relevant_insights = []

    expert_keywords = {
        "john-senac": ["roof", "hail", "shingle", "c.a.r", "documentation", "storm damage"],
        "matthew-mulholland": ["prove", "burden of proof", "policy exclusion", "denial"],
        "vince-perri": ["florida", "commercial", "metrics", "public adjuster business"],
        "chip-merlin": ["bad faith", "delay", "attorney", "litigation", "katrina", "sandy", "flood"],
        "lynette-young": ["ai", "claimwizard", "workflow", "franchise", "client acquisition"],
        "bill-wilson": ["policy language", "exclusion", "iso", "coverage dispute", "words collide"],
        "john-voelpel": ["appraisal", "umpire", "dispute resolution", "windstorm"],
    }

    for figure in INDUSTRY_EXPERTS["figures"]:
        expert_id = figure["id"]
        keywords = expert_keywords.get(expert_id, [])
        matched = any(kw in query_lower for kw in keywords)

        if matched:
            insights = figure.get("key_insights", [])
            if insights:
                relevant_insights.append(f"\n**{figure['name']}** ({figure['category']}):")
                for insight in insights[:3]:
                    relevant_insights.append(f"  - {insight}")

    if relevant_insights:
        return "\n--- INDUSTRY EXPERT INSIGHTS ---" + "\n".join(relevant_insights) + "\n--- END EXPERT INSIGHTS ---\n"
    return ""


async def get_florida_statute_context(query: str) -> str:
    """
    Fetch relevant Florida statutes from the ACTUAL statute database.
    Returns verbatim text for Eve to use.
    """
    query_lower = query.lower()

    florida_keywords = [
        "florida", "fl ", "statute", "law", "regulation", "license", "fee", "contract",
        "rescission", "bond", "apprentice", "conflict of interest", "ethics", "timeline",
        "aob", "assignment of benefits", "appraisal", "627", "626", "emergency",
        "disclosure", "public adjuster", "quote", "exact", "verbatim", "wording",
    ]

    if not any(kw in query_lower for kw in florida_keywords):
        return ""

    quote_mode = any(kw in query_lower for kw in ["quote", "exact", "verbatim", "word for word", "exact wording"])

    relevant_context: list[str] = []

    try:
        statutes = await db.florida_statutes.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}, "_id": 0, "section_number": 1, "heading": 1, "body_text": 1, "source_url": 1, "year": 1},
        ).sort([("score", {"$meta": "textScore"})]).limit(3).to_list(3)

        if statutes:
            if quote_mode:
                relevant_context.append("\n--- VERBATIM FLORIDA STATUTE TEXT (from Online Sunshine) ---")
                relevant_context.append("IMPORTANT: Use ONLY this exact text when user asks for verbatim/quote. Do NOT modify.\n")
            else:
                relevant_context.append("\n--- FLORIDA STATUTES (from verified database) ---")

            for statute in statutes:
                section = statute.get("section_number", "")
                year = statute.get("year", 2025)
                heading = statute.get("heading", "")
                body = statute.get("body_text", "")
                url = statute.get("source_url", "")

                if quote_mode:
                    relevant_context.append(f"\n**\u00a7{section}, {year} Fla. Stat.**")
                    relevant_context.append(f"Heading: {heading}")
                    relevant_context.append(f"EXACT TEXT:\n{body}")
                    relevant_context.append(f"Source: {url}\n")
                else:
                    body_excerpt = body[:500] + "..." if len(body) > 500 else body
                    relevant_context.append(f"\n**\u00a7{section}** - {heading}")
                    relevant_context.append(f"Excerpt: {body_excerpt}")
                    relevant_context.append(f"Citation: \u00a7{section}, {year} Fla. Stat., {url}\n")

            relevant_context.append("--- END FLORIDA STATUTES ---\n")
    except Exception as e:
        logger.error("Error fetching statutes: %s", e)
        return get_florida_law_context_fallback(query)

    key_nums = FLORIDA_PA_LAWS["key_numbers"]
    relevant_context.append("\n**Quick Reference Numbers:**")
    relevant_context.append(f"  - Max fee (standard): {key_nums['max_fee_standard']}")
    relevant_context.append(f"  - Max fee (emergency): {key_nums['max_fee_emergency']}")
    relevant_context.append(f"  - Surety bond: ${key_nums['surety_bond']}")
    relevant_context.append(f"  - Claim pay/deny deadline: {key_nums['claim_pay_deny_days']} days")

    if relevant_context:
        return "\n".join(relevant_context)
    return ""


def get_florida_law_context_fallback(query: str) -> str:
    """Fallback to static data if database not available"""
    query_lower = query.lower()

    florida_keywords = [
        "florida", "fl ", "statute", "law", "regulation", "license", "fee", "contract",
        "rescission", "bond", "apprentice", "conflict of interest", "ethics", "timeline",
        "aob", "assignment of benefits", "appraisal", "627", "626", "emergency",
        "disclosure", "public adjuster",
    ]

    if not any(kw in query_lower for kw in florida_keywords):
        return ""

    relevant_context: list[str] = []

    key_nums = FLORIDA_PA_LAWS["key_numbers"]
    relevant_context.append("\n**Florida PA Key Numbers:**")
    relevant_context.append(f"  - Max fee (standard): {key_nums['max_fee_standard']}")
    relevant_context.append(f"  - Max fee (emergency): {key_nums['max_fee_emergency']}")
    relevant_context.append(f"  - Surety bond required: ${key_nums['surety_bond']}")
    relevant_context.append(f"  - Claim acknowledgment: {key_nums['claim_acknowledgment_days']} days")
    relevant_context.append(f"  - Claim pay/deny deadline: {key_nums['claim_pay_deny_days']} days")

    statute_keywords = {
        "626.854": ["define", "prohibition", "solicit", "legal advice"],
        "626.865": ["license", "qualification", "bond", "exam", "ce", "continuing education"],
        "626.8651": ["apprentice", "supervise"],
        "626.8795": ["conflict", "contractor", "repair", "restore"],
        "626.8796": ["contract", "disclosure", "rescission", "fraud"],
        "fee-structures": ["fee", "percent", "emergency", "cap", "10%", "20%"],
    }

    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        statute_id = statute["id"]
        keywords = statute_keywords.get(statute_id, [])

        if any(kw in query_lower for kw in keywords):
            relevant_context.append(f"\n**{statute['statute']}:**")
            relevant_context.append(f"  {statute['summary']}")
            details = statute.get("details", "")[:300]
            if details:
                relevant_context.append(f"  {details}...")

    if relevant_context:
        return "\n--- FLORIDA PUBLIC ADJUSTING LAWS (fallback) ---" + "\n".join(relevant_context) + "\n--- END ---\n"
    return ""


# ---------------------------------------------------------------------------
# Claims data access for Eve
# ---------------------------------------------------------------------------

async def extract_claim_reference(message: str) -> Optional[str]:
    """
    Extract claim number or ID from user message.
    Supports formats like: #12345, #CLM-12345, claim 12345, claim id xyz123, TEST-12345
    """
    patterns = [
        r'#([\w-]+)',
        r'claim\s*(?:#|number|id)?\s*[:\s]?\s*([\w-]+)',
        r'CLM[-_]?([\w-]+)',
        r'TEST[-_]?([\w-]+)',
        r'(?:file|case)\s*(?:#|number)?\s*[:\s]?\s*([\w-]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            ref = match.group(1).strip()
            if pattern.startswith(r'#'):
                ref = match.group(1)
            return ref

    return None


def _claim_visibility_filter(current_user: dict) -> dict:
    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return {}
    if role == "client":
        user_email = (current_user.get("email") or "").strip()
        if not user_email:
            return {"client_email": "__no_match__"}
        return {"client_email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}}
    claim_filters = [{"created_by": user_id}, {"assigned_to_id": user_id}]
    full_name = current_user.get("full_name")
    if full_name:
        claim_filters.append({"assigned_to": full_name})
    return {"$or": claim_filters}


def _merge_claim_filters(*filters: dict) -> dict:
    valid = [flt for flt in filters if flt]
    if not valid:
        return {}
    if len(valid) == 1:
        return valid[0]
    return {"$and": valid}


async def fetch_claim_context(claim_ref: str, current_user: dict) -> Optional[dict]:
    """
    Fetch comprehensive claim context for Eve AI.
    Tries to find by claim ID first, then by claim number.
    """
    from utils.claim_access import can_access_claim as _user_can_access_claim

    visibility_filter = _claim_visibility_filter(current_user)

    claim = await db.claims.find_one(
        _merge_claim_filters({"id": claim_ref}, visibility_filter),
        {"_id": 0},
    )
    if not claim:
        claim = await db.claims.find_one(
            _merge_claim_filters(
                {"claim_number": {"$regex": f"^{re.escape(claim_ref)}$", "$options": "i"}},
                visibility_filter,
            ),
            {"_id": 0},
        )

    if not claim:
        return None

    claim_id = claim.get("id")

    notes = []
    try:
        notes_cursor = db.notes.find(
            {"claim_id": claim_id},
            {"_id": 0, "content": 1, "created_by": 1, "created_at": 1, "type": 1},
        ).sort("created_at", -1).limit(10)
        notes = await notes_cursor.to_list(10)
    except Exception:
        pass

    documents = []
    documents_count = 0
    try:
        docs_cursor = db.documents.find(
            {"claim_id": claim_id},
            {"_id": 0, "filename": 1, "type": 1, "created_at": 1, "file_size": 1},
        ).sort("created_at", -1).limit(20)
        documents = await docs_cursor.to_list(20)
        documents_count = await db.documents.count_documents({"claim_id": claim_id})
    except Exception:
        pass

    comms = []
    try:
        comms_cursor = db.communications.find(
            {"claim_id": claim_id},
            {"_id": 0, "type": 1, "direction": 1, "subject": 1, "body": 1, "created_at": 1, "from_name": 1, "to_name": 1},
        ).sort("created_at", -1).limit(10)
        comms = await comms_cursor.to_list(10)
    except Exception:
        pass

    context = {
        "claim_id": claim_id,
        "claim_number": claim.get("claim_number", ""),
        "status": claim.get("status", ""),
        "client_name": claim.get("client_name", ""),
        "client_email": claim.get("client_email", ""),
        "client_phone": claim.get("client_phone", ""),
        "property_address": claim.get("property_address", ""),
        "loss_date": claim.get("loss_date") or claim.get("date_of_loss", ""),
        "carrier": claim.get("carrier", ""),
        "policy_number": claim.get("policy_number", ""),
        "claim_type": claim.get("claim_type", ""),
        "assigned_to": claim.get("assigned_to", ""),
        "settlement_amount": claim.get("settlement_amount"),
        "demand_amount": claim.get("demand_amount"),
        "notes_count": len(notes),
        "recent_notes": notes[:5],
        "documents_count": documents_count,
        "documents_summary": documents[:10],
        "recent_communications": comms[:5],
        "created_at": claim.get("created_at", ""),
        "updated_at": claim.get("updated_at", ""),
    }

    return context


async def get_user_claims_summary(user_id: str, limit: int = 10) -> List[dict]:
    """Get a summary of user's claims for Eve context"""
    claims = await db.claims.find(
        {"$or": [{"created_by": user_id}, {"assigned_to_id": user_id}]},
        {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "carrier": 1},
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    return claims


def format_claim_context_for_prompt(context: dict) -> str:
    """Format claim context into a string suitable for LLM prompt injection."""
    lines = ["\n--- ACTIVE CLAIM CONTEXT ---"]
    lines.append(f"Claim #{context.get('claim_number', 'N/A')} (ID: {context.get('claim_id', 'N/A')})")
    lines.append(f"Status: {context.get('status', 'Unknown')}")
    lines.append(f"Client: {context.get('client_name', 'Unknown')}")
    lines.append(f"Property: {context.get('property_address', 'N/A')}")
    lines.append(f"Loss Date: {context.get('loss_date', 'N/A')}")
    lines.append(f"Carrier: {context.get('carrier', 'N/A')}")
    lines.append(f"Policy: {context.get('policy_number', 'N/A')}")
    lines.append(f"Type: {context.get('claim_type', 'N/A')}")
    lines.append(f"Assigned To: {context.get('assigned_to', 'N/A')}")

    if context.get("settlement_amount"):
        lines.append(f"Settlement: ${context['settlement_amount']}")
    if context.get("demand_amount"):
        lines.append(f"Demand: ${context['demand_amount']}")

    lines.append(f"\nDocuments on file: {context.get('documents_count', 0)}")
    if context.get("documents_summary"):
        for doc in context["documents_summary"][:5]:
            lines.append(f"  - {doc.get('type', 'doc')}: {doc.get('filename', 'unnamed')}")

    if context.get("recent_notes"):
        lines.append("\nRecent Notes:")
        for note in context["recent_notes"][:5]:
            created = note.get("created_at", "")
            content = note.get("content", "")[:200]
            lines.append(f"  [{created}] {content}")

    if context.get("recent_communications"):
        lines.append("\nRecent Communications:")
        for comm in context["recent_communications"][:5]:
            comm_type = comm.get("type", "message")
            direction = comm.get("direction", "")
            subject = comm.get("subject", "")
            body = comm.get("body", "")[:150]
            lines.append(f"  [{comm_type}/{direction}] {subject}: {body}")

    lines.append("--- END CLAIM CONTEXT ---\n")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Budget enforcement & cost tracking
# ---------------------------------------------------------------------------

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


def _default_model_for_provider(provider: str, preferred_model: Optional[str] = None) -> str:
    if preferred_model:
        model = str(preferred_model).strip()
        return model or DEFAULT_OLLAMA_MODEL
    return {
        "ollama": OLLAMA_MODEL_DEFAULT,
        "openai": OPENAI_MODEL_DEFAULT,
        "anthropic": ANTHROPIC_MODEL_DEFAULT,
    }.get(provider, OLLAMA_MODEL_DEFAULT)


def _select_provider_and_model(
    task_type: str,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None,
    provider_order: Optional[List[str]] = None,
):
    # LOCKED TO OLLAMA -- free tier only until OpenAI/Anthropic are paid for.
    return "ollama", OLLAMA_MODEL_DEFAULT


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
        {"_id": 0, "estimated_cost_usd": 1},
    )
    entries = await cursor.to_list(500)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > AI_DAILY_BUDGET_USD:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI budget exceeded (${AI_DAILY_BUDGET_USD:.2f}). Try again tomorrow or reduce request size.",
        )


async def _enforce_task_daily_budget(user_id: str, task_type: str, projected_cost_usd: float):
    task_limit = _get_task_daily_budget_usd(task_type)
    if task_limit is None:
        return
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.ai_usage_logs.find(
        {"user_id": user_id, "task_type": task_type, "created_at": {"$gte": start_of_day}},
        {"_id": 0, "estimated_cost_usd": 1},
    )
    entries = await cursor.to_list(500)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > task_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Task budget exceeded for '{task_type}' "
                f"(${task_limit:.2f}/day). Try again later or reduce request size."
            ),
        )


async def _log_ai_usage(
    user_id: str, task_type: str, provider: str, model: str,
    prompt_text: str, response_text: str,
    status: str = "success", error: Optional[str] = None,
):
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------------------
# AI Gateway — central send function with fallback
# ---------------------------------------------------------------------------

async def _send_via_ai_gateway(
    *,
    user_id: str,
    session_key: str,
    system_message: str,
    prompt_text: str,
    task_type: str,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None,
):
    # Inject user's Writing DNA into every AI call
    try:
        from services.email_intelligence import get_writing_dna_prompt
        dna_prompt = await get_writing_dna_prompt(user_id)
        if dna_prompt:
            system_message = system_message + "\n\n" + dna_prompt
    except Exception:
        pass  # Graceful -- DNA is optional enhancement

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

    def _provider_has_key(p: str) -> bool:
        """Check if a provider has its own API key configured."""
        from emergentintegrations.llm.chat import PROVIDER_CONFIGS
        return bool(PROVIDER_CONFIGS.get(p, {}).get("api_key"))

    # Validate primary provider has a key before calling
    if not _provider_has_key(provider):
        logger.warning("AI provider '%s' has no API key configured -- skipping to fallback", provider)
        if fallback_enabled:
            for fp in provider_order[1:]:
                if _provider_has_key(fp):
                    provider = fp
                    model = _default_model_for_provider(fp)
                    logger.info("Falling back to provider '%s' (has key)", fp)
                    break
            else:
                raise Exception(
                    "No AI provider is configured. Set OLLAMA_API_KEY (free \u2014 get one at https://ollama.com/settings/keys) in your Render environment variables."
                )
        else:
            raise Exception(
                "AI provider 'ollama' is not configured. Set OLLAMA_API_KEY (free \u2014 get one at https://ollama.com/settings/keys) in your Render environment variables."
            )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_key,
            system_message=system_message,
        ).with_model(provider, model)
        response_text = await chat.send_message(UserMessage(text=safe_prompt))
        await _log_ai_usage(
            user_id=user_id,
            task_type=task_type,
            provider=provider,
            model=model,
            prompt_text=safe_prompt,
            response_text=response_text,
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
                error=str(first_err),
            )
            raise

        # Only fallback to providers that have their own key
        for fp in provider_order[1:]:
            if _provider_has_key(fp):
                fallback_provider = fp
                break
        else:
            raise

        fallback_model = _default_model_for_provider(fallback_provider)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{session_key}-fallback",
            system_message=system_message,
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
            error=str(first_err),
        )
        return response_text, fallback_provider, fallback_model
