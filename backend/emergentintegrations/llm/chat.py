"""
LLM Chat abstraction layer.
Routes to Ollama Cloud (free, default), OpenAI, or Anthropic.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

# Provider configs loaded from env
PROVIDER_CONFIGS = {
    "ollama": {
        "base_url": os.environ.get("OLLAMA_BASE_URL", "https://ollama.com"),
        "api_key": os.environ.get("OLLAMA_API_KEY", ""),
        "default_model": os.environ.get("OLLAMA_MODEL", "gemma3:12b"),
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key": os.environ.get("OPENAI_API_KEY", ""),
        "default_model": os.environ.get("OPENAI_MODEL", "gpt-4o"),
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
        "default_model": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
    },
}


class UserMessage:
    """Simple message wrapper"""
    def __init__(self, content: str = "", text: str = "", **kwargs):
        self.content = content or text
        self.text = content or text


class LlmChat:
    """
    Multi-provider LLM client.
    Supports Ollama Cloud, OpenAI, and Anthropic.

    Usage (routes/ai.py style):
        chat = LlmChat(api_key=key, session_id="abc", system_message="You are Eve.")
        chat = chat.with_model("ollama", "gemma3:12b")
        response = await chat.send_message(UserMessage(text="Hello"))

    Usage (ai_service.py style):
        client = LlmChat(api_key=key, model="gemma3:12b")
        response = await client.chat(messages=[{"role": "user", "content": "Hello"}])
    """

    def __init__(self, api_key=None, model=None, session_id=None, system_message=None, **kwargs):
        self._api_key = api_key
        self._model = model
        self._session_id = session_id
        self._system_message = system_message
        self._provider = None
        self._base_url = None
        self._messages = []

    def with_model(self, provider: str, model: str):
        """Set provider and model. Returns self for chaining."""
        self._provider = provider.lower().strip()
        self._model = model

        cfg = PROVIDER_CONFIGS.get(self._provider, {})
        self._base_url = cfg.get("base_url")

        # Use provider-specific API key if available
        if cfg.get("api_key"):
            self._api_key = cfg["api_key"]

        return self

    async def send_message(self, message) -> str:
        """Send a single message with optional system_message context. Returns response text."""
        text = getattr(message, 'text', None) or getattr(message, 'content', str(message))

        messages = []
        if self._system_message:
            messages.append({"role": "system", "content": self._system_message})
        messages.append({"role": "user", "content": text})

        return await self._call_completion(messages)

    async def chat(self, messages: list) -> dict:
        """Send a list of messages (OpenAI format). Returns dict with 'content'."""
        response_text = await self._call_completion(messages)
        return {"content": response_text}

    async def _call_completion(self, messages: list) -> str:
        """Route to the correct provider API."""
        provider = self._provider or self._resolve_default_provider()
        cfg = PROVIDER_CONFIGS.get(provider, PROVIDER_CONFIGS.get("ollama", {}))
        base_url = self._base_url or cfg.get("base_url", "")
        api_key = self._api_key or cfg.get("api_key", "")
        model = self._model or cfg.get("default_model", "gemma3:12b")

        if provider == "ollama":
            return await self._call_ollama(base_url, api_key, model, messages)
        elif provider == "anthropic":
            return await self._call_anthropic(base_url, api_key, model, messages)
        else:
            return await self._call_openai(base_url, api_key, model, messages)

    async def _call_ollama(self, base_url: str, api_key: str, model: str, messages: list) -> str:
        """Call Ollama Cloud API (native format: /api/chat)."""
        url = f"{base_url.rstrip('/')}/api/chat"

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)

                if resp.status_code != 200:
                    error_detail = resp.text[:500]
                    logger.error(f"Ollama API error ({resp.status_code}): {error_detail}")
                    raise Exception(f"Ollama API returned {resp.status_code}: {error_detail}")

                data = resp.json()
                # Ollama response: {"message": {"role": "assistant", "content": "..."}}
                return data["message"]["content"]

        except httpx.TimeoutException:
            logger.error(f"Ollama API timeout ({model}@{base_url})")
            raise Exception("Ollama request timed out. Try again.")
        except KeyError as e:
            logger.error(f"Unexpected Ollama response format: {e}")
            raise Exception(f"Unexpected response from Ollama: {e}")

    async def _call_openai(self, base_url: str, api_key: str, model: str, messages: list) -> str:
        """Call OpenAI API (/v1/chat/completions)."""
        url = f"{base_url.rstrip('/')}/chat/completions"

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4096,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)

                if resp.status_code != 200:
                    error_detail = resp.text[:500]
                    logger.error(f"OpenAI API error ({resp.status_code}): {error_detail}")
                    raise Exception(f"OpenAI API returned {resp.status_code}: {error_detail}")

                data = resp.json()
                return data["choices"][0]["message"]["content"]

        except httpx.TimeoutException:
            logger.error(f"OpenAI API timeout ({model}@{base_url})")
            raise Exception("OpenAI request timed out. Try again.")
        except KeyError as e:
            logger.error(f"Unexpected OpenAI response format: {e}")
            raise Exception(f"Unexpected response from OpenAI: {e}")

    async def _call_anthropic(self, base_url: str, api_key: str, model: str, messages: list) -> str:
        """Call Anthropic API (/v1/messages)."""
        url = f"{base_url.rstrip('/')}/messages"

        # Extract system message
        system_text = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                chat_messages.append({"role": msg["role"], "content": msg["content"]})

        if not chat_messages or chat_messages[0]["role"] != "user":
            chat_messages.insert(0, {"role": "user", "content": "Hello"})

        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": model,
            "max_tokens": 4096,
            "messages": chat_messages,
        }
        if system_text.strip():
            payload["system"] = system_text.strip()

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)

                if resp.status_code != 200:
                    error_detail = resp.text[:500]
                    logger.error(f"Anthropic API error ({resp.status_code}): {error_detail}")
                    raise Exception(f"Anthropic API returned {resp.status_code}: {error_detail}")

                data = resp.json()
                return data["content"][0]["text"]

        except httpx.TimeoutException:
            logger.error(f"Anthropic API timeout ({model})")
            raise Exception("Anthropic request timed out. Try again.")

    def _resolve_default_provider(self) -> str:
        """Pick the best available provider based on configured API keys."""
        for provider in ["ollama", "openai", "anthropic"]:
            cfg = PROVIDER_CONFIGS.get(provider, {})
            if cfg.get("api_key"):
                self._provider = provider
                self._base_url = cfg["base_url"]
                if not self._model:
                    self._model = cfg["default_model"]
                return provider

        # Fallback to ollama
        self._provider = "ollama"
        self._base_url = PROVIDER_CONFIGS["ollama"]["base_url"]
        if not self._model:
            self._model = PROVIDER_CONFIGS["ollama"]["default_model"]
        return "ollama"
