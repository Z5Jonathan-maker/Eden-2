from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import os
import time

import aiohttp
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from dependencies import db, get_current_active_user
from services.ai_routing_policy import (
    parse_provider_order as svc_parse_provider_order,
    task_default_provider_orders as svc_task_default_provider_orders,
    resolve_provider_order_for_task as svc_resolve_provider_order_for_task,
    sanitize_provider_order as svc_sanitize_provider_order,
    default_runtime_routing_config as svc_default_runtime_routing_config,
    load_runtime_routing_config as svc_load_runtime_routing_config,
    apply_routing_config_updates as svc_apply_routing_config_updates,
    save_runtime_routing_config as svc_save_runtime_routing_config,
)


router = APIRouter(prefix="/api/ai", tags=["ai-claim-workspace"])


class ClaimBriefRequest(BaseModel):
    include_docs: bool = True
    include_notes: bool = True


class ClaimBriefResponse(BaseModel):
    summary: str
    blockers: List[str]
    next_actions: List[str]
    risk_flags: List[str]
    provider: str = "fallback"
    model: str = "deterministic"
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0


class DraftCommunicationRequest(BaseModel):
    audience: str = Field(pattern="^(client|carrier)$")
    channel: str = Field(pattern="^(email|sms)$")
    intent: str
    tone: str = "professional"


class DraftCommunicationResponse(BaseModel):
    subject: Optional[str] = None
    body: str
    bullets: List[str]
    provider: str = "fallback"
    model: str = "deterministic"
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0


class SupplementJustificationRequest(BaseModel):
    carrier_estimate: Dict[str, Any]
    contractor_estimate: Dict[str, Any]
    scope_notes: Optional[str] = ""


class SupplementJustificationResponse(BaseModel):
    executive_summary: str
    line_items: List[Dict[str, Any]]
    rebuttal_points: List[str]
    provider: str = "fallback"
    model: str = "deterministic"
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0


class DocumentExtractResponse(BaseModel):
    extracted_fields: Dict[str, Any]
    doc_type: str
    confidence: float
    missing_fields: List[str]
    provider: str = "fallback"
    model: str = "deterministic"


class AiTaskRequest(BaseModel):
    task: str = Field(
        pattern=(
            "^(claim_brief|draft_communication|supplement_justification|"
            "summarize_communication_thread|suggest_follow_up_sms)$"
        )
    )
    claim_id: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class AiTaskResponse(BaseModel):
    ok: bool = True
    task: str
    provider: str
    model: str
    output: Dict[str, Any]


class AIRoutingConfigUpdate(BaseModel):
    fallback_enabled: Optional[bool] = None
    task_provider_order: Optional[Dict[str, List[str]]] = None


async def _load_claim_context(claim_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    role = current_user.get("role", "client")
    is_privileged = role in {"admin", "manager"}
    if not is_privileged and claim.get("created_by") != current_user.get("id"):
        if claim.get("assigned_to") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Access denied")

    notes = await db.notes.find({"claim_id": claim_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    documents = await db.documents.find({"claim_id": claim_id}, {"_id": 0}).sort("uploaded_at", -1).to_list(20)
    return {
        "claim": claim,
        "notes": notes,
        "documents": documents,
    }


def _can_view_ai_metrics(user: Dict[str, Any]) -> bool:
    return user.get("role") in {"admin", "manager"}


def _task_budget_env_key(task: str) -> str:
    normalized = "".join(ch if ch.isalnum() else "_" for ch in str(task or "generic")).upper().strip("_")
    return f"AI_TASK_DAILY_BUDGET_USD_{normalized}"


def _task_projected_cost_env_key(task: str) -> str:
    normalized = "".join(ch if ch.isalnum() else "_" for ch in str(task or "generic")).upper().strip("_")
    return f"AI_TASK_PROJECTED_COST_USD_{normalized}"


def _get_task_daily_budget_usd(task: str) -> Optional[float]:
    raw = os.environ.get(_task_budget_env_key(task))
    if raw is None or str(raw).strip() == "":
        return None
    try:
        parsed = float(raw)
    except Exception:
        return None
    return parsed if parsed >= 0 else None


def _get_task_projected_cost_usd(task: str) -> float:
    raw = os.environ.get(_task_projected_cost_env_key(task), os.environ.get("AI_TASK_PROJECTED_COST_USD_DEFAULT", "0.02"))
    try:
        parsed = float(raw)
    except Exception:
        parsed = 0.02
    return max(parsed, 0.0)


async def _enforce_task_daily_budget(user: Dict[str, Any], task: str, projected_cost_usd: float) -> None:
    limit = _get_task_daily_budget_usd(task)
    if limit is None:
        return
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = await db.ai_task_logs.find(
        {
            "user_id": user.get("id"),
            "task": task,
            "created_at": {"$gte": start_of_day},
        },
        {"_id": 0, "estimated_cost_usd": 1},
    ).to_list(5000)
    spent = sum(float(item.get("estimated_cost_usd") or 0.0) for item in rows)
    if spent + projected_cost_usd > limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Task budget exceeded for '{task}' "
                f"(${limit:.2f}/day). Try again later or reduce request size."
            ),
        )


async def _log_ai_task_event(
    *,
    task: str,
    claim_id: str,
    user: Dict[str, Any],
    provider: str,
    model: str,
    latency_ms: int,
    success: bool,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    estimated_cost_usd: Optional[float] = None,
    error: Optional[str] = None,
):
    try:
        await db.ai_task_logs.insert_one(
            {
                "task": task,
                "claim_id": claim_id,
                "user_id": user.get("id"),
                "user_role": user.get("role"),
                "provider": provider,
                "model": model,
                "latency_ms": latency_ms,
                "success": success,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost_usd": estimated_cost_usd,
                "error": error,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:
        # Logging failure should never break request path
        pass


def _missing_core_fields(claim: Dict[str, Any]) -> List[str]:
    required = [
        "client_name",
        "property_address",
        "policy_number",
        "date_of_loss",
        "claim_number",
    ]
    return [field for field in required if not claim.get(field)]


def _parse_provider_order(value: Optional[str], default_order: List[str]) -> List[str]:
    return svc_parse_provider_order(value, default_order)


def _task_default_provider_orders() -> Dict[str, List[str]]:
    return svc_task_default_provider_orders()


def _resolve_provider_order_for_task(task: str) -> List[str]:
    return svc_resolve_provider_order_for_task(task)


def _sanitize_provider_order(order: List[str], default_order: Optional[List[str]] = None) -> List[str]:
    return svc_sanitize_provider_order(order, default_order=default_order)


def _default_runtime_routing_config() -> Dict[str, Any]:
    return svc_default_runtime_routing_config()


async def _load_runtime_routing_config() -> Dict[str, Any]:
    return await svc_load_runtime_routing_config(db)


async def _generate_with_provider(system_prompt: str, user_prompt: str, task: str) -> Dict[str, str]:
    """
    Optional provider call with safe fallback.
    - Uses Anthropic when ANTHROPIC_API_KEY is set for reasoning-heavy tasks.
    - Uses OpenAI when OPENAI_API_KEY is set otherwise.
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    ollama_enabled = os.environ.get("OLLAMA_ENABLED", "false").lower() in {"1", "true", "yes"}
    ollama_base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

    runtime_cfg = await _load_runtime_routing_config()
    configured_order = runtime_cfg.get("task_provider_order", {}).get(task)
    # Task-level routing to keep behavior predictable as the AI surface grows.
    provider_order = _sanitize_provider_order(
        configured_order or _resolve_provider_order_for_task(task),
        default_order=_resolve_provider_order_for_task(task),
    )
    fallback_enabled = bool(runtime_cfg.get("fallback_enabled", True))
    anthropic_model = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    openai_model = os.environ.get("OPENAI_MODEL", "gpt-4.1")

    async def call_anthropic() -> Optional[Dict[str, Any]]:
        if not anthropic_key:
            return None
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
                payload = {
                    "model": anthropic_model,
                    "max_tokens": 800,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                }
                headers = {
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                }
                async with session.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers) as resp:
                    if resp.status >= 300:
                        return None
                    data = await resp.json()
                    text_chunks = [
                        c.get("text", "")
                        for c in data.get("content", [])
                        if c.get("type") == "text"
                    ]
                    if not text_chunks:
                        return None
                    usage = data.get("usage", {}) or {}
                    input_tokens = int(usage.get("input_tokens") or 0)
                    output_tokens = int(usage.get("output_tokens") or 0)
                    est_cost = _estimate_model_cost(payload["model"], input_tokens, output_tokens)
                    return {
                        "provider": "anthropic",
                        "model": payload["model"],
                        "text": "\n".join(text_chunks),
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "estimated_cost_usd": est_cost,
                    }
        except Exception:
            return None

    async def call_ollama() -> Optional[Dict[str, Any]]:
        if not ollama_enabled:
            return None
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
                payload = {
                    "model": ollama_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                }
                async with session.post(f"{ollama_base_url}/api/chat", json=payload) as resp:
                    if resp.status >= 300:
                        return None
                    data = await resp.json()
                    message = data.get("message", {}) or {}
                    text = message.get("content", "")
                    if not text.strip():
                        return None
                    return {
                        "provider": "ollama",
                        "model": ollama_model,
                        "text": text,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "estimated_cost_usd": 0.0,
                    }
        except Exception:
            return None

    def call_openai() -> Optional[Dict[str, Any]]:
        if not openai_key:
            return None
        try:
            from openai import OpenAI

            client = OpenAI(api_key=openai_key)
            model = openai_model
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
            text = response.choices[0].message.content or ""
            if text.strip():
                usage = getattr(response, "usage", None)
                input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
                output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
                est_cost = _estimate_model_cost(model, input_tokens, output_tokens)
                return {
                    "provider": "openai",
                    "model": model,
                    "text": text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "estimated_cost_usd": est_cost,
                }
        except Exception:
            return None

    for provider in provider_order:
        if provider == "ollama":
            result = await call_ollama()
            if result:
                return result
        elif provider == "anthropic":
            result = await call_anthropic()
            if result:
                return result
        elif provider == "openai":
            result = call_openai()
            if result:
                return result

        if not fallback_enabled:
            break

    return {
        "provider": "fallback",
        "model": "deterministic",
        "text": "",
        "input_tokens": 0,
        "output_tokens": 0,
        "estimated_cost_usd": 0.0,
    }


@router.get("/routing")
async def get_ai_routing(
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    """
    Admin observability endpoint for active AI provider/model routing.
    """
    if not _can_view_ai_metrics(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    task_orders: Dict[str, Any] = {}
    for task_name in _task_default_provider_orders().keys():
        env_key = f"AI_TASK_PROVIDER_{task_name.upper()}"
        task_orders[task_name] = {
            "resolved_order": _resolve_provider_order_for_task(task_name),
            "task_override_env_key": env_key,
            "task_override_is_set": bool(os.environ.get(env_key)),
        }

    return {
        "providers_available": {
            "openai": bool(os.environ.get("OPENAI_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "ollama": os.environ.get("OLLAMA_ENABLED", "false").lower() in {"1", "true", "yes"},
        },
        "models": {
            "openai": os.environ.get("OPENAI_MODEL", "gpt-4.1"),
            "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
            "ollama": os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
        },
        "global_default_env_key": "AI_PROVIDER_ORDER_DEFAULT",
        "global_default_is_set": bool(os.environ.get("AI_PROVIDER_ORDER_DEFAULT")),
        "tasks": task_orders,
    }


@router.get("/routing-config")
async def get_ai_routing_config(
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    if not _can_view_ai_metrics(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    runtime_cfg = await _load_runtime_routing_config()
    tasks = {
        task_name: {
            "resolved_order": runtime_cfg["task_provider_order"].get(task_name, _resolve_provider_order_for_task(task_name))
        }
        for task_name in _task_default_provider_orders().keys()
    }
    return {
        "providers_available": {
            "openai": bool(os.environ.get("OPENAI_API_KEY")),
            "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "ollama": os.environ.get("OLLAMA_ENABLED", "false").lower() in {"1", "true", "yes"},
        },
        "models": {
            "openai": os.environ.get("OPENAI_MODEL", "gpt-4.1"),
            "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
            "ollama": os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
        },
        "config": runtime_cfg,
        "tasks": tasks,
    }


@router.put("/routing-config")
async def update_ai_routing_config(
    updates: AIRoutingConfigUpdate,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    role = current_user.get("role")
    if role not in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    current = await _load_runtime_routing_config()
    next_cfg = svc_apply_routing_config_updates(
        current,
        {
            "fallback_enabled": updates.fallback_enabled,
            "task_provider_order": updates.task_provider_order,
        },
    )
    await svc_save_runtime_routing_config(
        db,
        next_cfg,
        actor=current_user.get("email") or current_user.get("id"),
    )

    return {
        "ok": True,
        "config": next_cfg,
    }


@router.get("/providers/health")
async def get_ai_providers_health(
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    """Live provider readiness checks for routing safety."""
    if not _can_view_ai_metrics(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    openai_configured = bool(os.environ.get("OPENAI_API_KEY"))
    anthropic_configured = bool(os.environ.get("ANTHROPIC_API_KEY"))
    ollama_enabled = os.environ.get("OLLAMA_ENABLED", "false").lower() in {"1", "true", "yes"}
    ollama_base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

    ollama_status = {
        "enabled": ollama_enabled,
        "healthy": False,
        "latency_ms": None,
        "base_url": ollama_base_url,
        "model": ollama_model,
        "detail": "disabled",
    }

    if ollama_enabled:
        started = time.perf_counter()
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get(f"{ollama_base_url}/api/tags") as resp:
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    if resp.status < 300:
                        data = await resp.json()
                        models = data.get("models", []) or []
                        installed = any((m.get("name", "") == ollama_model) for m in models)
                        ollama_status.update(
                            {
                                "healthy": installed,
                                "latency_ms": latency_ms,
                                "detail": "ok" if installed else f"model_not_found:{ollama_model}",
                            }
                        )
                    else:
                        ollama_status.update({"healthy": False, "latency_ms": latency_ms, "detail": f"http_{resp.status}"})
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            ollama_status.update({"healthy": False, "latency_ms": latency_ms, "detail": str(exc)[:120]})

    return {
        "providers": {
            "openai": {
                "enabled": openai_configured,
                "healthy": openai_configured,
                "detail": "api_key_present" if openai_configured else "missing_api_key",
            },
            "anthropic": {
                "enabled": anthropic_configured,
                "healthy": anthropic_configured,
                "detail": "api_key_present" if anthropic_configured else "missing_api_key",
            },
            "ollama": ollama_status,
        }
    }


@router.get("/control-plane")
async def get_ai_control_plane(
    days: int = 7,
    failure_rate_alert_pct: float = 15.0,
    p95_latency_alert_ms: int = 2500,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    """
    Unified AI control plane payload:
    - runtime routing config
    - provider health/readiness
    - budget + reliability metrics
    """
    if not _can_view_ai_metrics(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    routing = await get_ai_routing_config(current_user=current_user)
    providers = await get_ai_providers_health(current_user=current_user)
    metrics = await get_ai_task_metrics(
        days=days,
        failure_rate_alert_pct=failure_rate_alert_pct,
        p95_latency_alert_ms=p95_latency_alert_ms,
        current_user=current_user,
    )

    return {
        "ok": True,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "routing": routing,
        "providers": providers.get("providers", {}),
        "metrics": metrics,
        "task_budget_caps": {
            task_name: {
                "limit_env_key": _task_budget_env_key(task_name),
                "limit_usd": _get_task_daily_budget_usd(task_name),
                "projected_cost_env_key": _task_projected_cost_env_key(task_name),
                "projected_cost_usd": _get_task_projected_cost_usd(task_name),
            }
            for task_name in _task_default_provider_orders().keys()
        },
        "summary": {
            "daily_budget_utilization_pct": metrics.get("budget", {}).get("today_utilization_pct", 0.0),
            "fallback_rate_pct": metrics.get("gateway", {}).get("fallback_rate", 0.0),
            "failure_rate_pct": metrics.get("failure_rate", 0.0),
            "p95_latency_ms": metrics.get("latency_ms", {}).get("p95", 0),
            "alert_count": len(metrics.get("alerts", [])),
        },
    }


def _estimate_model_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Simple token-cost estimator using USD per 1M tokens.
    Values are approximate defaults and can be overridden with env vars later.
    """
    m = (model or "").lower()
    pricing = {
        "gpt-4.1": (5.0, 15.0),
        "gpt-4.1-mini": (0.4, 1.6),
        "gpt-4o": (5.0, 15.0),
        "gpt-4o-mini": (0.15, 0.6),
        "claude-3-5-sonnet": (3.0, 15.0),
        "claude-3-7-sonnet": (3.0, 15.0),
    }
    in_rate, out_rate = (0.0, 0.0)
    for key, rates in pricing.items():
        if key in m:
            in_rate, out_rate = rates
            break
    if in_rate == 0 and out_rate == 0:
        return 0.0
    return round(((input_tokens / 1_000_000) * in_rate) + ((output_tokens / 1_000_000) * out_rate), 6)


@router.post("/task", response_model=AiTaskResponse)
async def run_ai_task(
    request: AiTaskRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    """
    Unified AI task gateway for claim workspace operations.
    Keeps frontend integration contract stable while preserving existing route support.
    """
    start = time.perf_counter()
    provider = "fallback"
    model = "deterministic"
    input_tokens = 0
    output_tokens = 0
    estimated_cost_usd = 0.0

    try:
        await _enforce_task_daily_budget(
            current_user,
            request.task,
            projected_cost_usd=_get_task_projected_cost_usd(request.task),
        )

        if request.task == "claim_brief":
            output = await claim_brief(
                request.claim_id,
                ClaimBriefRequest(**request.payload),
                current_user,
            )
            output_dict = output.model_dump()
            provider = output_dict.get("provider", provider)
            model = output_dict.get("model", model)
            input_tokens = int(output_dict.get("input_tokens") or 0)
            output_tokens = int(output_dict.get("output_tokens") or 0)
            estimated_cost_usd = float(output_dict.get("estimated_cost_usd") or 0.0)
            latency_ms = int((time.perf_counter() - start) * 1000)
            await _log_ai_task_event(
                task=request.task,
                claim_id=request.claim_id,
                user=current_user,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimated_cost_usd,
            )
            return AiTaskResponse(
                task=request.task,
                provider=provider,
                model=model,
                output=output_dict,
            )

        if request.task == "draft_communication":
            output = await draft_communication(
                request.claim_id,
                DraftCommunicationRequest(**request.payload),
                current_user,
            )
            output_dict = output.model_dump()
            provider = output_dict.get("provider", provider)
            model = output_dict.get("model", model)
            input_tokens = int(output_dict.get("input_tokens") or 0)
            output_tokens = int(output_dict.get("output_tokens") or 0)
            estimated_cost_usd = float(output_dict.get("estimated_cost_usd") or 0.0)
            latency_ms = int((time.perf_counter() - start) * 1000)
            await _log_ai_task_event(
                task=request.task,
                claim_id=request.claim_id,
                user=current_user,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimated_cost_usd,
            )
            return AiTaskResponse(
                task=request.task,
                provider=provider,
                model=model,
                output=output_dict,
            )

        if request.task == "supplement_justification":
            output = await supplement_justification(
                request.claim_id,
                SupplementJustificationRequest(**request.payload),
                current_user,
            )
            output_dict = output.model_dump()
            provider = output_dict.get("provider", provider)
            model = output_dict.get("model", model)
            input_tokens = int(output_dict.get("input_tokens") or 0)
            output_tokens = int(output_dict.get("output_tokens") or 0)
            estimated_cost_usd = float(output_dict.get("estimated_cost_usd") or 0.0)
            latency_ms = int((time.perf_counter() - start) * 1000)
            await _log_ai_task_event(
                task=request.task,
                claim_id=request.claim_id,
                user=current_user,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimated_cost_usd,
            )
            return AiTaskResponse(
                task=request.task,
                provider=provider,
                model=model,
                output=output_dict,
            )

        if request.task == "summarize_communication_thread":
            output_dict = await summarize_communication_thread(
                request.claim_id,
                request.payload,
                current_user,
            )
            provider = output_dict.get("provider", provider)
            model = output_dict.get("model", model)
            input_tokens = int(output_dict.get("input_tokens") or 0)
            output_tokens = int(output_dict.get("output_tokens") or 0)
            estimated_cost_usd = float(output_dict.get("estimated_cost_usd") or 0.0)
            latency_ms = int((time.perf_counter() - start) * 1000)
            await _log_ai_task_event(
                task=request.task,
                claim_id=request.claim_id,
                user=current_user,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimated_cost_usd,
            )
            return AiTaskResponse(
                task=request.task,
                provider=provider,
                model=model,
                output=output_dict,
            )

        if request.task == "suggest_follow_up_sms":
            output_dict = await suggest_follow_up_sms(
                request.claim_id,
                request.payload,
                current_user,
            )
            provider = output_dict.get("provider", provider)
            model = output_dict.get("model", model)
            input_tokens = int(output_dict.get("input_tokens") or 0)
            output_tokens = int(output_dict.get("output_tokens") or 0)
            estimated_cost_usd = float(output_dict.get("estimated_cost_usd") or 0.0)
            latency_ms = int((time.perf_counter() - start) * 1000)
            await _log_ai_task_event(
                task=request.task,
                claim_id=request.claim_id,
                user=current_user,
                provider=provider,
                model=model,
                latency_ms=latency_ms,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimated_cost_usd,
            )
            return AiTaskResponse(
                task=request.task,
                provider=provider,
                model=model,
                output=output_dict,
            )

        raise HTTPException(status_code=400, detail=f"Unsupported AI task: {request.task}")
    except HTTPException as exc:
        await _log_ai_task_event(
            task=request.task,
            claim_id=request.claim_id,
            user=current_user,
            provider=provider,
            model=model,
            latency_ms=int((time.perf_counter() - start) * 1000),
            success=False,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost_usd,
            error=str(exc.detail),
        )
        raise
    except Exception as exc:
        await _log_ai_task_event(
            task=request.task,
            claim_id=request.claim_id,
            user=current_user,
            provider=provider,
            model=model,
            latency_ms=int((time.perf_counter() - start) * 1000),
            success=False,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost_usd,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="AI task failed")


@router.get("/task/metrics")
async def get_ai_task_metrics(
    days: int = 7,
    failure_rate_alert_pct: float = 15.0,
    p95_latency_alert_ms: int = 2500,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    if not _can_view_ai_metrics(current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await db.ai_task_logs.find(
        {"created_at": {"$gte": since}},
        {"_id": 0},
    ).to_list(5000)

    usage_raw = await db.ai_usage_logs.find({}, {"_id": 0}).to_list(10000)
    usage_rows: List[Dict[str, Any]] = []
    start_of_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_gateway_spend = 0.0

    for item in usage_raw:
        created_raw = item.get("created_at")
        created_dt = None
        if isinstance(created_raw, datetime):
            created_dt = created_raw
        elif isinstance(created_raw, str):
            try:
                created_dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
            except Exception:
                created_dt = None
        if not created_dt:
            continue
        if created_dt >= since:
            usage_rows.append(item)
        if created_dt >= start_of_today:
            today_gateway_spend += float(item.get("estimated_cost_usd") or 0.0)

    if not rows and not usage_rows:
        return {
            "days": days,
            "total_calls": 0,
            "success_rate": 0,
            "failure_rate": 0,
            "by_task": {},
            "by_provider": {},
            "cost_usd": {"total": 0.0, "by_provider": {}},
            "latency_ms": {"p50": 0, "p95": 0},
            "gateway": {
                "calls": 0,
                "fallback_calls": 0,
                "fallback_rate": 0,
                "error_calls": 0,
            },
            "budget": {
                "daily_limit_usd": float(os.environ.get("AI_DAILY_BUDGET_USD", "25")),
                "today_spend_usd": 0.0,
                "today_utilization_pct": 0.0,
            },
            "alerts": [],
        }

    total = len(rows)
    success_count = sum(1 for r in rows if r.get("success"))
    by_task: Dict[str, int] = {}
    by_provider: Dict[str, int] = {}
    by_provider_cost: Dict[str, float] = {}
    task_latency_totals: Dict[str, int] = {}
    task_cost_totals: Dict[str, float] = {}
    latencies = sorted(int(r.get("latency_ms") or 0) for r in rows)
    total_estimated_cost = 0.0

    for row in rows:
        task = row.get("task", "unknown")
        provider = row.get("provider", "unknown")
        est_cost = float(row.get("estimated_cost_usd") or 0.0)
        by_task[task] = by_task.get(task, 0) + 1
        by_provider[provider] = by_provider.get(provider, 0) + 1
        by_provider_cost[provider] = round(by_provider_cost.get(provider, 0.0) + est_cost, 6)
        task_latency_totals[task] = task_latency_totals.get(task, 0) + int(row.get("latency_ms") or 0)
        task_cost_totals[task] = round(task_cost_totals.get(task, 0.0) + est_cost, 6)
        total_estimated_cost += est_cost

    def percentile(sorted_vals: List[int], p: float) -> int:
        if not sorted_vals:
            return 0
        idx = int((len(sorted_vals) - 1) * p)
        return sorted_vals[idx]

    p50_latency = percentile(latencies, 0.5)
    p95_latency = percentile(latencies, 0.95)
    success_rate = round((success_count / total) * 100, 2) if total > 0 else 0.0
    failure_rate = round(100 - success_rate, 2) if total > 0 else 0.0

    gateway_calls = len(usage_rows)
    gateway_fallback_calls = sum(1 for r in usage_rows if str(r.get("status", "")).lower() == "fallback")
    gateway_error_calls = sum(1 for r in usage_rows if str(r.get("status", "")).lower() == "error")
    gateway_success_calls = sum(1 for r in usage_rows if str(r.get("status", "")).lower() in {"success", "fallback"})
    gateway_fallback_rate = round((gateway_fallback_calls / gateway_calls) * 100, 2) if gateway_calls else 0.0

    # Merge gateway traffic into provider/task/cost rollups
    for row in usage_rows:
        task = row.get("task_type", "gateway_unknown")
        provider = row.get("provider", "unknown")
        est_cost = float(row.get("estimated_cost_usd") or 0.0)
        by_task[task] = by_task.get(task, 0) + 1
        by_provider[provider] = by_provider.get(provider, 0) + 1
        by_provider_cost[provider] = round(by_provider_cost.get(provider, 0.0) + est_cost, 6)
        total_estimated_cost += est_cost

    alerts: List[Dict[str, Any]] = []
    if failure_rate >= failure_rate_alert_pct:
        alerts.append(
            {
                "type": "failure_rate",
                "severity": "high" if failure_rate >= failure_rate_alert_pct * 1.5 else "medium",
                "message": f"AI failure rate is {failure_rate}% (threshold {failure_rate_alert_pct}%).",
                "value": failure_rate,
                "threshold": failure_rate_alert_pct,
            }
        )
    if p95_latency >= p95_latency_alert_ms:
        alerts.append(
            {
                "type": "latency_p95",
                "severity": "high" if p95_latency >= p95_latency_alert_ms * 1.5 else "medium",
                "message": f"AI p95 latency is {p95_latency}ms (threshold {p95_latency_alert_ms}ms).",
                "value": p95_latency,
                "threshold": p95_latency_alert_ms,
            }
        )
    if gateway_calls and gateway_fallback_rate >= 25:
        alerts.append(
            {
                "type": "gateway_fallback_rate",
                "severity": "medium" if gateway_fallback_rate < 40 else "high",
                "message": f"Gateway fallback rate is {gateway_fallback_rate}% in the last {days} day(s).",
                "value": gateway_fallback_rate,
                "threshold": 25,
            }
        )

    daily_limit = float(os.environ.get("AI_DAILY_BUDGET_USD", "25"))
    today_utilization = round((today_gateway_spend / daily_limit) * 100, 2) if daily_limit > 0 else 0.0
    if today_utilization >= 80:
        alerts.append(
            {
                "type": "daily_budget_utilization",
                "severity": "high" if today_utilization >= 95 else "medium",
                "message": f"AI budget utilization today is {today_utilization}% (${today_gateway_spend:.4f}/${daily_limit:.2f}).",
                "value": today_utilization,
                "threshold": 80,
            }
        )

    task_stats: List[Dict[str, Any]] = []
    for task_name, count in by_task.items():
        avg_latency = round(task_latency_totals.get(task_name, 0) / max(count, 1), 2)
        total_task_cost = round(task_cost_totals.get(task_name, 0.0), 6)
        task_stats.append(
            {
                "task": task_name,
                "calls": count,
                "avg_latency_ms": avg_latency,
                "total_cost_usd": total_task_cost,
            }
        )
    slowest_tasks = sorted(task_stats, key=lambda x: x["avg_latency_ms"], reverse=True)[:5]
    highest_cost_tasks = sorted(task_stats, key=lambda x: x["total_cost_usd"], reverse=True)[:5]

    return {
        "days": days,
        "total_calls": total + gateway_calls,
        "success_rate": success_rate,
        "failure_rate": failure_rate,
        "by_task": by_task,
        "by_provider": by_provider,
        "cost_usd": {
            "total": round(total_estimated_cost, 6),
            "by_provider": by_provider_cost,
        },
        "latency_ms": {
            "p50": p50_latency,
            "p95": p95_latency,
        },
        "gateway": {
            "calls": gateway_calls,
            "success_calls": gateway_success_calls,
            "fallback_calls": gateway_fallback_calls,
            "fallback_rate": gateway_fallback_rate,
            "error_calls": gateway_error_calls,
        },
        "budget": {
            "daily_limit_usd": daily_limit,
            "today_spend_usd": round(today_gateway_spend, 6),
            "today_utilization_pct": today_utilization,
        },
        "rankings": {
            "slowest_tasks": slowest_tasks,
            "highest_cost_tasks": highest_cost_tasks,
        },
        "alerts": alerts,
    }


@router.post("/claims/{claim_id}/brief", response_model=ClaimBriefResponse)
async def claim_brief(
    claim_id: str,
    payload: ClaimBriefRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    context = await _load_claim_context(claim_id, current_user)
    claim = context["claim"]
    notes = context["notes"] if payload.include_notes else []
    documents = context["documents"] if payload.include_docs else []

    missing = _missing_core_fields(claim)
    blockers: List[str] = []
    risk_flags: List[str] = []

    if missing:
        blockers.append(f"Missing core claim fields: {', '.join(missing)}")
    if not documents:
        blockers.append("No claim documents uploaded")
    if not notes:
        blockers.append("No operational notes logged")
    if claim.get("status", "").lower() in {"new", "intake"}:
        risk_flags.append("Claim is still in early-stage status")

    summary = (
        f"Claim {claim.get('claim_number', claim_id)} for {claim.get('client_name', 'Unknown client')} "
        f"at {claim.get('property_address', 'Unknown address')} is currently {claim.get('status', 'Unknown')}."
    )
    next_actions = [
        "Confirm policy number and date of loss",
        "Upload supporting documents and photos",
        "Send client status update and set next touchpoint",
    ]
    if documents:
        next_actions[1] = "Review uploaded documents for missing evidence gaps"
    if notes:
        next_actions[2] = "Convert latest notes into carrier/client communication"

    provider_out = await _generate_with_provider(
        "You are an insurance claim operations assistant. Return concise summary text only.",
        f"Create a short claim brief for this claim object:\n{claim}\nRecent notes:\n{notes[:5]}\nDocuments:\n{documents[:5]}",
        task="claim_brief",
    )
    if provider_out["text"].strip():
        summary = provider_out["text"].strip()

    return ClaimBriefResponse(
        summary=summary,
        blockers=blockers,
        next_actions=next_actions,
        risk_flags=risk_flags,
        provider=provider_out["provider"],
        model=provider_out["model"],
        input_tokens=int(provider_out.get("input_tokens") or 0),
        output_tokens=int(provider_out.get("output_tokens") or 0),
        estimated_cost_usd=float(provider_out.get("estimated_cost_usd") or 0.0),
    )


@router.post("/claims/{claim_id}/draft-communication", response_model=DraftCommunicationResponse)
async def draft_communication(
    claim_id: str,
    payload: DraftCommunicationRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    context = await _load_claim_context(claim_id, current_user)
    claim = context["claim"]
    audience_name = claim.get("client_name", "Client") if payload.audience == "client" else "Carrier Team"

    subject = None
    if payload.channel == "email":
        subject = f"{claim.get('claim_number', 'Claim Update')} - {payload.intent.title()}"

    bullets = [
        f"Claim: {claim.get('claim_number', 'N/A')}",
        f"Property: {claim.get('property_address', 'N/A')}",
        f"Requested action: {payload.intent}",
    ]

    body = (
        f"Hello {audience_name},\n\n"
        f"This is an update regarding claim {claim.get('claim_number', 'N/A')}.\n"
        f"We are reaching out to {payload.intent.lower()}.\n\n"
        f"Current status: {claim.get('status', 'N/A')}.\n"
        f"Please reply with any required documents or confirmations.\n\n"
        "Thank you."
    )

    provider_out = await _generate_with_provider(
        "You draft concise insurance claim communications. Keep factual and professional.",
        (
            f"Audience: {payload.audience}\nChannel: {payload.channel}\nTone: {payload.tone}\n"
            f"Intent: {payload.intent}\nClaim:\n{claim}"
        ),
        task="draft_communication",
    )
    if provider_out["text"].strip():
        body = provider_out["text"].strip()

    return DraftCommunicationResponse(
        subject=subject,
        body=body,
        bullets=bullets,
        provider=provider_out["provider"],
        model=provider_out["model"],
        input_tokens=int(provider_out.get("input_tokens") or 0),
        output_tokens=int(provider_out.get("output_tokens") or 0),
        estimated_cost_usd=float(provider_out.get("estimated_cost_usd") or 0.0),
    )


async def summarize_communication_thread(
    claim_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    context = await _load_claim_context(claim_id, current_user)
    claim = context["claim"]

    incoming_messages = payload.get("messages") or []
    if not isinstance(incoming_messages, list):
        incoming_messages = []
    recent_messages = incoming_messages[-20:]

    if not recent_messages:
        summary = f"No communication history yet for claim {claim.get('claim_number', claim_id)}."
        return {
            "summary": summary,
            "key_points": ["No messages available", "Send first client update to start thread context"],
            "provider": "fallback",
            "model": "deterministic",
            "input_tokens": 0,
            "output_tokens": 0,
            "estimated_cost_usd": 0.0,
        }

    inbound_count = len([m for m in recent_messages if m.get("direction") == "inbound"])
    outbound_count = len([m for m in recent_messages if m.get("direction") == "outbound"])
    latest = recent_messages[-1]
    latest_snippet = str(latest.get("body") or "").replace("\n", " ").strip()[:180]
    fallback_summary = (
        f"Thread has {len(recent_messages)} recent messages ({outbound_count} outbound, {inbound_count} inbound). "
        f"Latest message: \"{latest_snippet}\"."
    )

    provider_out = await _generate_with_provider(
        "You summarize insurance claim SMS threads for operators. Return concise plain text only.",
        (
            f"Claim number: {claim.get('claim_number', claim_id)}\n"
            f"Client: {claim.get('client_name', 'Unknown')}\n"
            f"Recent messages:\n{recent_messages}\n"
            "Provide a concise summary and top two next actions."
        ),
        task="summarize_communication_thread",
    )
    summary_text = provider_out.get("text", "").strip() or fallback_summary
    key_points = [
        f"Recent traffic: {outbound_count} outbound / {inbound_count} inbound",
        "Next step: send concise follow-up that confirms current status and required documents",
    ]

    return {
        "summary": summary_text,
        "key_points": key_points,
        "provider": provider_out.get("provider", "fallback"),
        "model": provider_out.get("model", "deterministic"),
        "input_tokens": int(provider_out.get("input_tokens") or 0),
        "output_tokens": int(provider_out.get("output_tokens") or 0),
        "estimated_cost_usd": float(provider_out.get("estimated_cost_usd") or 0.0),
    }


async def suggest_follow_up_sms(
    claim_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    context = await _load_claim_context(claim_id, current_user)
    claim = context["claim"]
    tone = str(payload.get("tone") or "professional")
    intent = str(payload.get("intent") or "status update")
    summary_context = str(payload.get("summary_context") or "").strip()
    client_name = claim.get("client_name") or "there"

    fallback_body = (
        f"Hi {client_name}, quick update from Eden: your claim "
        f"{claim.get('claim_number', claim_id)} is currently {claim.get('status', 'in progress')}. "
        f"We are following up regarding {intent.lower()}. Reply if you have questions."
    )

    provider_out = await _generate_with_provider(
        "You draft concise, compliant client SMS messages for insurance claims. Keep under 480 characters.",
        (
            f"Tone: {tone}\n"
            f"Intent: {intent}\n"
            f"Client: {client_name}\n"
            f"Claim: {claim}\n"
            f"Thread summary: {summary_context}\n"
            "Return only the SMS body text."
        ),
        task="suggest_follow_up_sms",
    )

    body = provider_out.get("text", "").strip() or fallback_body

    return {
        "body": body,
        "suggested_message": body,
        "provider": provider_out.get("provider", "fallback"),
        "model": provider_out.get("model", "deterministic"),
        "input_tokens": int(provider_out.get("input_tokens") or 0),
        "output_tokens": int(provider_out.get("output_tokens") or 0),
        "estimated_cost_usd": float(provider_out.get("estimated_cost_usd") or 0.0),
    }


def _line_item_map(estimate: Dict[str, Any]) -> Dict[str, float]:
    lines = estimate.get("line_items", []) if isinstance(estimate, dict) else []
    output: Dict[str, float] = {}
    for line in lines:
        name = str(line.get("name") or line.get("code") or "unknown").strip()
        amount = float(line.get("amount") or 0)
        output[name] = output.get(name, 0.0) + amount
    return output


@router.post("/claims/{claim_id}/supplement-justification", response_model=SupplementJustificationResponse)
async def supplement_justification(
    claim_id: str,
    payload: SupplementJustificationRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    _ = await _load_claim_context(claim_id, current_user)

    carrier = _line_item_map(payload.carrier_estimate)
    contractor = _line_item_map(payload.contractor_estimate)
    keys = sorted(set(carrier.keys()) | set(contractor.keys()))

    diffs: List[Dict[str, Any]] = []
    rebuttal_points: List[str] = []
    total_delta = 0.0

    for name in keys:
        carrier_amount = carrier.get(name, 0.0)
        contractor_amount = contractor.get(name, 0.0)
        delta = round(contractor_amount - carrier_amount, 2)
        total_delta += delta
        if abs(delta) > 0:
            diffs.append(
                {
                    "line_item": name,
                    "carrier_amount": carrier_amount,
                    "contractor_amount": contractor_amount,
                    "delta": delta,
                    "justification": "Scope and pricing variance requires review.",
                }
            )

    diffs = sorted(diffs, key=lambda x: abs(x["delta"]), reverse=True)[:25]
    if diffs:
        rebuttal_points.append("Carrier estimate appears to under-scope one or more high-impact line items.")
        rebuttal_points.append("Recommend attaching photo/document support for top delta items.")
    if payload.scope_notes:
        rebuttal_points.append(f"Scope note support: {payload.scope_notes[:180]}")

    executive_summary = (
        f"Estimated supplement delta is ${total_delta:,.2f} across {len(diffs)} line items requiring reconciliation."
    )

    provider_out = await _generate_with_provider(
        "You are a claims supplement strategist. Return one concise executive summary.",
        (
            f"Carrier estimate: {payload.carrier_estimate}\n"
            f"Contractor estimate: {payload.contractor_estimate}\n"
            f"Scope notes: {payload.scope_notes}"
        ),
        task="supplement_justification",
    )
    if provider_out["text"].strip():
        executive_summary = provider_out["text"].strip()

    return SupplementJustificationResponse(
        executive_summary=executive_summary,
        line_items=diffs,
        rebuttal_points=rebuttal_points,
        provider=provider_out["provider"],
        model=provider_out["model"],
        input_tokens=int(provider_out.get("input_tokens") or 0),
        output_tokens=int(provider_out.get("output_tokens") or 0),
        estimated_cost_usd=float(provider_out.get("estimated_cost_usd") or 0.0),
    )


@router.post("/documents/extract", response_model=DocumentExtractResponse)
async def extract_document(
    file: UploadFile = File(...),
    claim_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
):
    claim = None
    if claim_id:
        context = await _load_claim_context(claim_id, current_user)
        claim = context["claim"]

    contents = await file.read()
    filename = file.filename or "unknown"
    lower_name = filename.lower()
    size_bytes = len(contents or b"")

    if "policy" in lower_name:
        doc_type = "Policy"
    elif "estimate" in lower_name:
        doc_type = "Estimate"
    elif "invoice" in lower_name:
        doc_type = "Invoice"
    elif "contract" in lower_name:
        doc_type = "Contract"
    else:
        doc_type = "Other"

    extracted_fields: Dict[str, Any] = {
        "filename": filename,
        "size_bytes": size_bytes,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    if claim:
        extracted_fields["claim_number"] = claim.get("claim_number")
        extracted_fields["client_name"] = claim.get("client_name")

    missing_fields: List[str] = []
    if claim:
        for field in ["claim_number", "policy_number", "client_name"]:
            if not claim.get(field):
                missing_fields.append(field)

    confidence = 0.45 if doc_type == "Other" else 0.78
    if size_bytes > 0 and claim:
        confidence += 0.1
    confidence = min(confidence, 0.95)

    return DocumentExtractResponse(
        extracted_fields=extracted_fields,
        doc_type=doc_type,
        confidence=confidence,
        missing_fields=missing_fields,
        provider="fallback",
        model="deterministic",
    )
