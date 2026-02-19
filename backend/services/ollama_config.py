from __future__ import annotations

import os
import re
from typing import Any, Mapping, Optional


DEFAULT_OLLAMA_BASE_URL = "https://ollama.com"
DEFAULT_OLLAMA_MODEL = "gemma3:12b"


def _clean(value: Optional[str]) -> str:
    return str(value or "").strip()


def normalize_ollama_base_url(raw_value: Optional[str]) -> str:
    """
    Normalize the configured Ollama base URL.

    - Accepts values with or without scheme.
    - Accepts values that mistakenly include a trailing /api segment.
    """
    base = _clean(raw_value) or DEFAULT_OLLAMA_BASE_URL
    if not re.match(r"^https?://", base, flags=re.IGNORECASE):
        base = f"https://{base.lstrip('/')}"
    base = base.rstrip("/")
    if base.lower().endswith("/api"):
        base = base[:-4]
    return base


def ollama_endpoint(base_url: Optional[str], path: str) -> str:
    normalized = normalize_ollama_base_url(base_url)
    normalized_path = "/" + str(path or "").lstrip("/")
    return f"{normalized}{normalized_path}"


def get_ollama_api_key(env: Optional[Mapping[str, str]] = None) -> str:
    source = env or os.environ
    for key_name in ("OLLAMA_API_KEY", "OLLAMA_API_TOKEN", "OLLAMA_TOKEN"):
        value = _clean(source.get(key_name))
        if value:
            return value
    return ""


def get_ollama_model(env: Optional[Mapping[str, str]] = None) -> str:
    source = env or os.environ
    return _clean(source.get("OLLAMA_MODEL")) or DEFAULT_OLLAMA_MODEL


def validate_ollama_config(env: Optional[Mapping[str, str]] = None) -> dict:
    """Return diagnostic info about Ollama configuration (no secrets exposed)."""
    source = env or os.environ
    api_key = get_ollama_api_key(source)
    base_url = normalize_ollama_base_url(source.get("OLLAMA_BASE_URL"))
    model = get_ollama_model(source)
    return {
        "api_key_set": bool(api_key),
        "api_key_preview": f"{api_key[:6]}***" if len(api_key) > 6 else ("set" if api_key else "MISSING"),
        "base_url": base_url,
        "chat_endpoint": ollama_endpoint(base_url, "/api/chat"),
        "model": model,
    }


def extract_ollama_error_detail(payload: Any, *, max_len: int = 220) -> str:
    """
    Convert API error payloads into a compact, operator-friendly string.
    """
    detail = ""
    if isinstance(payload, dict):
        for key in ("error", "detail", "message"):
            candidate = payload.get(key)
            if isinstance(candidate, str) and candidate.strip():
                detail = candidate.strip()
                break
        if not detail and payload:
            detail = str(payload)
    elif isinstance(payload, list):
        detail = ", ".join(str(item) for item in payload if item is not None)
    else:
        detail = _clean(str(payload or ""))
    detail = " ".join(detail.split())
    if not detail:
        return "no_detail"
    return detail[:max_len]
