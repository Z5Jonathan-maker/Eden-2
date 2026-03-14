"""Tests for the ClaimPilot LLM Router — all LLM calls are mocked."""

import pytest
from unittest.mock import AsyncMock, patch

from services.claimpilot.llm_router import LLMRouter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def router():
    return LLMRouter()


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------

def test_llm_router_selects_gemini_for_vision(router: LLMRouter):
    assert router.select_provider("vision") == "gemini_flash"


def test_llm_router_selects_gemini_for_text(router: LLMRouter):
    assert router.select_provider("text_generation") == "gemini_flash"


def test_llm_router_selects_ollama_for_private(router: LLMRouter):
    assert router.select_provider("private_data") == "ollama"


def test_llm_router_selects_gemini_for_structured_extraction(router: LLMRouter):
    assert router.select_provider("structured_extraction") == "gemini_flash"


def test_llm_router_defaults_to_gemini_for_unknown(router: LLMRouter):
    assert router.select_provider("nonexistent_task") == "gemini_flash"


# ---------------------------------------------------------------------------
# Generation (happy path)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_router_generate_with_mock(router: LLMRouter):
    """Mock _call_gemini and verify it is called for text_generation."""
    with patch.object(
        router, "_call_gemini", new_callable=AsyncMock, return_value="mocked response"
    ) as mock_gemini:
        result = await router.generate(
            prompt="Summarize this claim.",
            system_prompt="You are a claims assistant.",
            task_type="text_generation",
        )

    assert result == "mocked response"
    mock_gemini.assert_awaited_once_with(
        "Summarize this claim.", "You are a claims assistant.", 0.3, 2000
    )


# ---------------------------------------------------------------------------
# Fallback behaviour
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_router_fallback_on_failure(router: LLMRouter):
    """When gemini fails, the router should try groq next."""
    with patch.object(
        router,
        "_call_gemini",
        new_callable=AsyncMock,
        side_effect=RuntimeError("Gemini down"),
    ) as mock_gemini, patch.object(
        router,
        "_call_groq",
        new_callable=AsyncMock,
        return_value="groq response",
    ) as mock_groq:
        result = await router.generate(
            prompt="Hello",
            task_type="text_generation",
        )

    assert result == "groq response"
    mock_gemini.assert_awaited_once()
    mock_groq.assert_awaited_once()


@pytest.mark.asyncio
async def test_llm_router_full_fallback_chain(router: LLMRouter):
    """gemini fails → groq fails → ollama succeeds."""
    with patch.object(
        router, "_call_gemini", new_callable=AsyncMock, side_effect=RuntimeError("down")
    ), patch.object(
        router, "_call_groq", new_callable=AsyncMock, side_effect=RuntimeError("down")
    ), patch.object(
        router, "_call_ollama", new_callable=AsyncMock, return_value="ollama ok"
    ) as mock_ollama:
        result = await router.generate(prompt="test", task_type="text_generation")

    assert result == "ollama ok"
    mock_ollama.assert_awaited_once()


@pytest.mark.asyncio
async def test_llm_router_all_providers_fail(router: LLMRouter):
    """All providers fail → RuntimeError raised."""
    with patch.object(
        router, "_call_gemini", new_callable=AsyncMock, side_effect=RuntimeError("1")
    ), patch.object(
        router, "_call_groq", new_callable=AsyncMock, side_effect=RuntimeError("2")
    ), patch.object(
        router, "_call_ollama", new_callable=AsyncMock, side_effect=RuntimeError("3")
    ):
        with pytest.raises(RuntimeError, match="All providers exhausted"):
            await router.generate(prompt="test", task_type="text_generation")


@pytest.mark.asyncio
async def test_llm_router_ollama_no_fallback(router: LLMRouter):
    """Ollama has no fallback — failure raises immediately."""
    with patch.object(
        router, "_call_ollama", new_callable=AsyncMock, side_effect=RuntimeError("local down")
    ):
        with pytest.raises(RuntimeError, match="All providers exhausted"):
            await router.generate(prompt="secret", task_type="private_data")


# ---------------------------------------------------------------------------
# Provider override
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_router_provider_override(router: LLMRouter):
    """provider_override skips the task→provider map."""
    with patch.object(
        router, "_call_groq", new_callable=AsyncMock, return_value="groq override"
    ) as mock_groq:
        result = await router.generate(
            prompt="test", task_type="vision", provider_override="groq"
        )

    assert result == "groq override"
    mock_groq.assert_awaited_once()


# ---------------------------------------------------------------------------
# Vision
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_router_generate_vision(router: LLMRouter):
    with patch.object(
        router,
        "_call_gemini_vision",
        new_callable=AsyncMock,
        return_value="damage detected",
    ) as mock_vision:
        result = await router.generate_vision(
            prompt="Describe damage",
            image_bytes=b"\x89PNG",
            mime_type="image/png",
        )

    assert result == "damage detected"
    mock_vision.assert_awaited_once_with("Describe damage", b"\x89PNG", "image/png")
