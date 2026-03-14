"""
LLM Router — Selects and calls the best LLM provider per task type with
automatic fallback.

Provider map:
    vision              → gemini_flash
    text_generation     → gemini_flash
    structured_extraction → gemini_flash
    private_data        → ollama

Fallback chains:
    gemini_flash → groq → ollama
    groq         → gemini_flash → ollama
    ollama       → (no fallback — local only)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider routing tables
# ---------------------------------------------------------------------------

TASK_PROVIDER_MAP: dict[str, str] = {
    "vision": "gemini_flash",
    "text_generation": "gemini_flash",
    "structured_extraction": "gemini_flash",
    "private_data": "ollama",
}

FALLBACK_CHAINS: dict[str, list[str]] = {
    "gemini_flash": ["groq", "ollama"],
    "groq": ["gemini_flash", "ollama"],
    "ollama": [],
}

DEFAULT_TEMPERATURE = 0.3
DEFAULT_MAX_TOKENS = 2000
GEMINI_MODEL = "gemini-2.5-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"
LLM_CALL_TIMEOUT_SECONDS = 30


class LLMRouter:
    """Routes LLM calls to the best provider and handles fallback."""

    def __init__(self) -> None:
        self._gemini_configured = False
        self._groq_client = None

    # ------------------------------------------------------------------
    # Provider selection
    # ------------------------------------------------------------------

    def select_provider(self, task_type: str) -> str:
        """Return the preferred provider name for *task_type*."""
        provider = TASK_PROVIDER_MAP.get(task_type)
        if provider is None:
            logger.warning(
                "Unknown task_type '%s', defaulting to gemini_flash", task_type
            )
            return "gemini_flash"
        return provider

    # ------------------------------------------------------------------
    # Public generation API
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        task_type: str = "text_generation",
        provider_override: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        """Generate text with automatic fallback on failure."""
        provider = provider_override or self.select_provider(task_type)
        chain = [provider] + FALLBACK_CHAINS.get(provider, [])

        last_error: Optional[Exception] = None
        for candidate in chain:
            try:
                return await asyncio.wait_for(
                    self._dispatch(
                        candidate, prompt, system_prompt, temperature, max_tokens
                    ),
                    timeout=LLM_CALL_TIMEOUT_SECONDS,
                )
            except Exception as exc:
                logger.warning(
                    "Provider '%s' failed: %s — trying next", candidate, exc
                )
                last_error = exc

        raise RuntimeError(
            f"All providers exhausted. Last error: {last_error}"
        )

    async def generate_vision(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> str:
        """Analyse an image via Gemini vision."""
        return await asyncio.wait_for(
            self._call_gemini_vision(prompt, image_bytes, mime_type),
            timeout=LLM_CALL_TIMEOUT_SECONDS,
        )

    # ------------------------------------------------------------------
    # Internal dispatch
    # ------------------------------------------------------------------

    async def _dispatch(
        self,
        provider: str,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        dispatch_map = {
            "gemini_flash": self._call_gemini,
            "groq": self._call_groq,
            "ollama": self._call_ollama,
        }
        handler = dispatch_map.get(provider)
        if handler is None:
            raise ValueError(f"Unknown provider: {provider}")
        return await handler(prompt, system_prompt, temperature, max_tokens)

    # ------------------------------------------------------------------
    # Client initialization helpers
    # ------------------------------------------------------------------

    def _ensure_gemini_configured(self) -> None:
        """Configure the Gemini SDK exactly once."""
        if self._gemini_configured:
            return

        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get(
            "GOOGLE_AI_API_KEY"
        )
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY / GOOGLE_AI_API_KEY not set")

        genai.configure(api_key=api_key)
        self._gemini_configured = True

    def _get_groq_client(self):
        """Return a cached AsyncGroq client."""
        if self._groq_client is None:
            from groq import AsyncGroq

            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError("GROQ_API_KEY not set")

            self._groq_client = AsyncGroq(api_key=api_key)
        return self._groq_client

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _call_gemini(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call Gemini 2.0 Flash via google.generativeai SDK (async)."""
        import google.generativeai as genai

        self._ensure_gemini_configured()
        model = genai.GenerativeModel(
            GEMINI_MODEL,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        response = await model.generate_content_async(prompt)
        return response.text

    async def _call_groq(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call Groq (llama-3.3-70b-versatile) via cached groq.AsyncGroq."""
        client = self._get_groq_client()
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _call_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call local Ollama via the existing ai_service helper."""
        from services.ai_service import get_llm_client

        client = get_llm_client()
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat(messages=messages)
        if isinstance(response, dict):
            return response.get("content", "")
        return str(response)

    async def _call_gemini_vision(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> str:
        """Gemini multimodal (vision) call (async)."""
        import google.generativeai as genai

        self._ensure_gemini_configured()
        model = genai.GenerativeModel(GEMINI_MODEL)

        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = await model.generate_content_async([prompt, image_part])
        return response.text
