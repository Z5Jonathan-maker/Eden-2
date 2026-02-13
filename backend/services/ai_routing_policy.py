from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


ALLOWED_PROVIDERS = {"openai", "anthropic", "ollama"}


def parse_provider_order(value: Optional[str], default_order: List[str]) -> List[str]:
    if not value:
        return default_order
    normalized = [token.strip().lower() for token in value.split(",") if token.strip()]
    allowed = [p for p in normalized if p in ALLOWED_PROVIDERS]
    return allowed or default_order


def task_default_provider_orders() -> Dict[str, List[str]]:
    return {
        "summarize_communication_thread": ["ollama", "anthropic"],
        "suggest_follow_up_sms": ["ollama", "openai"],
        "draft_communication": ["ollama", "openai"],
        "claim_brief": ["anthropic", "openai"],
        "supplement_justification": ["anthropic", "openai"],
    }


def resolve_provider_order_for_task(task: str) -> List[str]:
    defaults = task_default_provider_orders()
    provider_order = defaults.get(task, ["anthropic", "openai"])
    task_env_key = f"AI_TASK_PROVIDER_{task.upper()}"
    provider_order = parse_provider_order(os.environ.get(task_env_key), provider_order)
    provider_order = parse_provider_order(os.environ.get("AI_PROVIDER_ORDER_DEFAULT"), provider_order)
    return provider_order


def sanitize_provider_order(order: List[str], default_order: Optional[List[str]] = None) -> List[str]:
    normalized: List[str] = []
    for item in order or []:
        provider = str(item).strip().lower()
        if provider in ALLOWED_PROVIDERS and provider not in normalized:
            normalized.append(provider)
    if len(normalized) == 1:
        if normalized[0] == "openai":
            fallback = "anthropic"
        elif normalized[0] == "anthropic":
            fallback = "openai"
        else:
            fallback = "openai"
        normalized.append(fallback)
    if normalized:
        return normalized[:2]
    return default_order or ["openai", "anthropic"]


def default_runtime_routing_config() -> Dict[str, Any]:
    return {
        "fallback_enabled": True,
        "task_provider_order": task_default_provider_orders(),
    }


async def load_runtime_routing_config(db) -> Dict[str, Any]:
    saved = await db.ai_routing_config.find_one({"key": "runtime"}, {"_id": 0})
    defaults = default_runtime_routing_config()
    task_defaults = defaults["task_provider_order"]

    saved_orders = (saved or {}).get("task_provider_order", {}) if saved else {}
    merged_orders: Dict[str, List[str]] = {}
    for task_name, default_order in task_defaults.items():
        merged_orders[task_name] = sanitize_provider_order(
            saved_orders.get(task_name) or default_order,
            default_order=default_order,
        )

    return {
        "fallback_enabled": bool((saved or {}).get("fallback_enabled", defaults["fallback_enabled"])),
        "task_provider_order": merged_orders,
    }


def apply_routing_config_updates(current: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    next_cfg = {
        "fallback_enabled": bool(current.get("fallback_enabled", True)),
        "task_provider_order": dict(current.get("task_provider_order", {})),
    }

    if updates.get("fallback_enabled") is not None:
        next_cfg["fallback_enabled"] = bool(updates["fallback_enabled"])

    incoming_orders = updates.get("task_provider_order") or {}
    for task_name, order in incoming_orders.items():
        if task_name in next_cfg["task_provider_order"]:
            next_cfg["task_provider_order"][task_name] = sanitize_provider_order(
                order,
                default_order=next_cfg["task_provider_order"][task_name],
            )
    return next_cfg


async def save_runtime_routing_config(db, next_cfg: Dict[str, Any], actor: Optional[str] = None) -> None:
    await db.ai_routing_config.update_one(
        {"key": "runtime"},
        {
            "$set": {
                "key": "runtime",
                "fallback_enabled": bool(next_cfg.get("fallback_enabled", True)),
                "task_provider_order": next_cfg.get("task_provider_order", {}),
                "updated_at": datetime.now(timezone.utc),
                "updated_by": actor or "system",
            }
        },
        upsert=True,
    )
