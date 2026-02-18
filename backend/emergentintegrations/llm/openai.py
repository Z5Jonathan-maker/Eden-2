"""
OpenAI-compatible client helpers.
Uses Ollama as default provider, falls back to OpenAI if configured.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Re-export from chat module
from emergentintegrations.llm.chat import LlmChat, UserMessage


def get_openai_client(async_client=False):
    """
    Get an OpenAI SDK client configured to use Ollama (or OpenAI if no Ollama).
    Used by modules that directly import the openai SDK (inspection_photos, weather, etc).

    Returns an openai.OpenAI or openai.AsyncOpenAI instance pointed at the best provider.
    """
    try:
        import openai
    except ImportError:
        raise ImportError("openai package not installed. Run: pip install openai")

    # Priority: Ollama (free) > OpenAI
    ollama_key = os.environ.get("OLLAMA_API_KEY", "")
    ollama_url = os.environ.get("OLLAMA_BASE_URL", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")

    if ollama_key and ollama_url:
        api_key = ollama_key
        base_url = ollama_url
        logger.debug("Using Ollama endpoint for OpenAI-compatible calls")
    elif openai_key:
        api_key = openai_key
        base_url = None  # use default openai URL
        logger.debug("Using OpenAI endpoint")
    else:
        # Try Ollama without key (local setups)
        api_key = "ollama"
        base_url = ollama_url or "http://localhost:11434/v1"
        logger.debug("Using local Ollama endpoint (no API key)")

    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url

    if async_client:
        return openai.AsyncOpenAI(**kwargs)
    else:
        return openai.OpenAI(**kwargs)


def get_default_model():
    """Get the default model name for the active provider."""
    if os.environ.get("OLLAMA_API_KEY") or os.environ.get("OLLAMA_BASE_URL"):
        return os.environ.get("OLLAMA_MODEL", "llama3.1")
    return os.environ.get("OPENAI_MODEL", "gpt-4o")


def get_vision_model():
    """Get the model for vision tasks. Falls back to default if no vision-specific model."""
    if os.environ.get("OLLAMA_API_KEY") or os.environ.get("OLLAMA_BASE_URL"):
        return os.environ.get("OLLAMA_VISION_MODEL", os.environ.get("OLLAMA_MODEL", "llama3.1"))
    return os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini")


class OpenAISpeechToText:
    """Speech-to-text using OpenAI Whisper API (requires OpenAI API key)."""
    def __init__(self, *args, **kwargs):
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not openai_key:
            raise NotImplementedError(
                "Speech-to-text requires OPENAI_API_KEY. Ollama does not support Whisper."
            )

    async def transcribe(self, *args, **kwargs):
        raise NotImplementedError("Use openai.Audio.transcribe directly")
