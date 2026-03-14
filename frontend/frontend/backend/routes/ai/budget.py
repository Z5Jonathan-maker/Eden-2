"""AI health check and model listing endpoints."""

from __future__ import annotations

import os
import logging

from fastapi import APIRouter, Depends

from dependencies import get_current_active_user
from services.ollama_config import (
    get_ollama_api_key,
    get_ollama_model,
    normalize_ollama_base_url,
    ollama_endpoint,
)

from routes.ai.prompts import (
    OLLAMA_CLOUD_MODELS,
    OLLAMA_MODEL_DEFAULT,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@router.get("/health")
async def ai_health_check(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Diagnostic endpoint -- tests AI provider connectivity and reports config status.
    Call this to troubleshoot 'AI not working' issues.
    """
    import httpx
    from services.ollama_config import validate_ollama_config

    ollama_cfg = validate_ollama_config()
    ollama_key = get_ollama_api_key()
    ollama_url = normalize_ollama_base_url(os.environ.get("OLLAMA_BASE_URL"))

    # Test Ollama Cloud connectivity
    ollama_status = {"configured": bool(ollama_key), **ollama_cfg}
    if ollama_key:
        try:
            headers = {"Authorization": f"Bearer {ollama_key}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(ollama_endpoint(ollama_url, "/api/tags"), headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    model_names = [m.get("name") for m in data.get("models", [])]
                    ollama_status["reachable"] = True
                    ollama_status["available_models"] = model_names[:20]
                    configured_model = get_ollama_model()
                    ollama_status["configured_model_available"] = configured_model in model_names
                else:
                    ollama_status["reachable"] = False
                    ollama_status["error"] = f"HTTP {resp.status_code}"
        except Exception as e:
            ollama_status["reachable"] = False
            ollama_status["error"] = str(e)[:200]
    else:
        ollama_status["reachable"] = False
        ollama_status["error"] = "OLLAMA_API_KEY not set. Get one at https://ollama.com/settings/keys"

    # Check Anthropic fallback
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_status = {
        "configured": bool(anthropic_key),
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
    }

    # Check OpenAI fallback
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    openai_status = {
        "configured": bool(openai_key),
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o"),
    }

    # Check Gemini (free tier)
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY", "")
    gemini_status = {
        "configured": bool(gemini_key),
        "model": "gemini-2.5-flash",
    }

    any_provider = bool(gemini_key or ollama_key or anthropic_key or openai_key)

    return {
        "service_ready": any_provider,
        "active_key_source": (
            "GEMINI_API_KEY" if gemini_key
            else "OLLAMA_API_KEY" if ollama_key
            else "ANTHROPIC_API_KEY" if anthropic_key
            else "OPENAI_API_KEY" if openai_key
            else "NONE"
        ),
        "gemini": gemini_status,
        "ollama": ollama_status,
        "anthropic": anthropic_status,
        "openai": openai_status,
        "instructions": (
            "Gemini configured (free tier)." if gemini_key else
            "To enable AI: Set GEMINI_API_KEY (free at https://aistudio.google.com/apikey) on Render"
        ),
    }


# ---------------------------------------------------------------------------
# GET /models
# ---------------------------------------------------------------------------

@router.get("/models")
async def get_available_models(
    current_user: dict = Depends(get_current_active_user),
):
    """Get available AI models for Eve chat"""
    import httpx

    ollama_key = get_ollama_api_key()
    ollama_url = normalize_ollama_base_url(os.environ.get("OLLAMA_BASE_URL"))

    # Try to fetch live model list from Ollama Cloud
    live_models = []
    try:
        headers = {}
        if ollama_key:
            headers["Authorization"] = f"Bearer {ollama_key}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(ollama_endpoint(ollama_url, "/api/tags"), headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                live_ids = {m["name"] for m in data.get("models", [])}
                live_models = [m for m in OLLAMA_CLOUD_MODELS if m["id"] in live_ids]
    except Exception:
        pass

    models = live_models or OLLAMA_CLOUD_MODELS
    return {
        "default_model": OLLAMA_MODEL_DEFAULT,
        "provider": "ollama",
        "models": models,
    }
