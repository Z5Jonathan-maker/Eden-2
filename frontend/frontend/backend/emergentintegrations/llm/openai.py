"""
OpenAI SDK client helpers.
For features that need the OpenAI SDK directly (vision, audio).
Main AI features use LlmChat from chat.py instead.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Re-export from chat module
from emergentintegrations.llm.chat import LlmChat, UserMessage


def get_openai_client(async_client=False):
    """
    Get an OpenAI SDK client. Only works when OPENAI_API_KEY is set.
    Used by vision/audio features that need the OpenAI SDK directly.
    Returns None if OpenAI is not configured (Ollama doesn't support SDK format).
    """
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_key:
        logger.warning("OpenAI API key not set — vision/audio features unavailable. Main AI uses Ollama.")
        return None

    try:
        import openai
    except ImportError:
        logger.error("openai package not installed")
        return None

    if async_client:
        return openai.AsyncOpenAI(api_key=openai_key)
    else:
        return openai.OpenAI(api_key=openai_key)


def get_default_model():
    """Get the default model for OpenAI SDK calls."""
    return os.environ.get("OPENAI_MODEL", "gpt-4o")


def get_vision_model():
    """Get the model for vision tasks."""
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
