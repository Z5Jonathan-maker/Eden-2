"""
Tests for PredictiveAnalyticsAgent.

Covers: wind/water/fire heuristic predictions, mocked LLM path,
and output format validation.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.predictive_analytics import (
    PredictiveAnalyticsAgent,
    _CLAIM_TYPE_HEURISTICS,
    _DEFAULT_HEURISTIC,
)


def _make_context(
    *,
    claim_type: str = "Wind",
    carrier: str = "Citizens",
    claim_id: str = "claim-pred-001",
    photos: list | None = None,
) -> AgentContext:
    """Build a minimal AgentContext for prediction tests."""
    return AgentContext(
        claim={
            "id": claim_id,
            "status": "In Progress",
            "claim_number": "CLM-2025-200",
            "claim_type": claim_type,
            "carrier": carrier,
            "region": "FL",
        },
        photos=photos or [],
    )


# -----------------------------------------------------------------------
# Heuristic prediction tests
# -----------------------------------------------------------------------


class TestPredictiveWindClaim:
    """Wind claim should use the wind/hurricane heuristic."""

    @pytest.mark.asyncio
    async def test_wind_settlement_range(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Wind")

        result = await agent.execute(ctx)

        sr = result.details["settlement_range"]
        assert sr["p10"] == 8_000.0
        assert sr["p50"] == 25_000.0
        assert sr["p90"] == 60_000.0

    @pytest.mark.asyncio
    async def test_wind_litigation_probability(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Wind")

        result = await agent.execute(ctx)

        assert result.details["litigation_probability"] == 25.0

    @pytest.mark.asyncio
    async def test_wind_timeline(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Wind")

        result = await agent.execute(ctx)

        assert result.details["timeline_months"] == 4

    @pytest.mark.asyncio
    async def test_wind_insight_type(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Wind")

        result = await agent.execute(ctx)

        assert result.insight_type == "prediction"


class TestPredictiveWaterClaim:
    """Water claim should produce different ranges than wind."""

    @pytest.mark.asyncio
    async def test_water_settlement_range(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Water")

        result = await agent.execute(ctx)

        sr = result.details["settlement_range"]
        assert sr["p10"] == 5_000.0
        assert sr["p50"] == 15_000.0
        assert sr["p90"] == 40_000.0

    @pytest.mark.asyncio
    async def test_water_litigation_and_timeline(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Water")

        result = await agent.execute(ctx)

        assert result.details["litigation_probability"] == 20.0
        assert result.details["timeline_months"] == 3


class TestPredictiveFireClaim:
    """Fire claim should have higher settlement range."""

    @pytest.mark.asyncio
    async def test_fire_settlement_range(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Fire")

        result = await agent.execute(ctx)

        sr = result.details["settlement_range"]
        assert sr["p10"] == 20_000.0
        assert sr["p50"] == 50_000.0
        assert sr["p90"] == 120_000.0

    @pytest.mark.asyncio
    async def test_fire_higher_than_water(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)

        fire_result = await agent.execute(_make_context(claim_type="Fire"))
        water_result = await agent.execute(_make_context(claim_type="Water"))

        assert (
            fire_result.details["settlement_range"]["p50"]
            > water_result.details["settlement_range"]["p50"]
        )

    @pytest.mark.asyncio
    async def test_fire_litigation_and_timeline(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context(claim_type="Fire")

        result = await agent.execute(ctx)

        assert result.details["litigation_probability"] == 30.0
        assert result.details["timeline_months"] == 6


# -----------------------------------------------------------------------
# LLM-based prediction (mocked)
# -----------------------------------------------------------------------


class TestPredictiveWithMockLLM:
    """Verify the LLM path returns structured predictions."""

    @pytest.mark.asyncio
    async def test_llm_prediction_parsed(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)

        llm_response = json.dumps({
            "settlement_range": {"p10": 12000, "p50": 35000, "p90": 75000},
            "litigation_probability": 40,
            "timeline_months": 5,
            "carrier_behavior": "aggressive_denier",
            "recommended_strategy": "File an immediate demand letter.",
        })

        with patch.object(
            agent._llm, "generate", new_callable=AsyncMock, return_value=llm_response
        ):
            ctx = _make_context(claim_type="Wind")
            result = await agent.execute(ctx)

        assert result.details["settlement_range"]["p50"] == 35_000.0
        assert result.details["litigation_probability"] == 40.0
        assert result.details["carrier_behavior"] == "aggressive_denier"
        assert result.details["recommended_strategy"] == "File an immediate demand letter."

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_heuristic(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)

        with patch.object(
            agent._llm,
            "generate",
            new_callable=AsyncMock,
            side_effect=RuntimeError("API down"),
        ):
            ctx = _make_context(claim_type="Hail")
            result = await agent.execute(ctx)

        # Should fall back to hail heuristic
        assert result.details["settlement_range"]["p10"] == 3_000.0
        assert result.details["carrier_behavior"] == "normal"


# -----------------------------------------------------------------------
# Output format validation
# -----------------------------------------------------------------------


class TestPredictiveOutputFormat:
    """Verify all required fields exist in details."""

    REQUIRED_DETAIL_KEYS = {
        "settlement_range",
        "litigation_probability",
        "timeline_months",
        "carrier_behavior",
        "recommended_strategy",
    }

    REQUIRED_RANGE_KEYS = {"p10", "p50", "p90"}

    @pytest.mark.asyncio
    async def test_all_detail_keys_present(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        for key in self.REQUIRED_DETAIL_KEYS:
            assert key in result.details, f"Missing key: {key}"

    @pytest.mark.asyncio
    async def test_settlement_range_has_percentiles(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        sr = result.details["settlement_range"]
        for key in self.REQUIRED_RANGE_KEYS:
            assert key in sr, f"Missing percentile: {key}"
            assert isinstance(sr[key], float)

    @pytest.mark.asyncio
    async def test_confidence_is_06(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        assert result.confidence == 0.6

    @pytest.mark.asyncio
    async def test_summary_contains_range_and_risk(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        assert "Settlement range:" in result.summary
        assert "Litigation risk:" in result.summary
        assert "Est. timeline:" in result.summary

    @pytest.mark.asyncio
    async def test_validate_output_passes(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        result = AgentResult(
            agent_name="predictive_analytics",
            claim_id="c1",
            insight_type="prediction",
            summary="test",
            details={"settlement_range": {"p10": 1.0, "p50": 2.0, "p90": 3.0}},
            confidence=0.6,
        )
        assert await agent.validate_output(result) is True

    @pytest.mark.asyncio
    async def test_validate_output_low_confidence_fails(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        result = AgentResult(
            agent_name="predictive_analytics",
            claim_id="c1",
            insight_type="prediction",
            summary="test",
            details={"settlement_range": {"p10": 1.0}},
            confidence=0.2,
        )
        assert await agent.validate_output(result) is False

    @pytest.mark.asyncio
    async def test_validate_output_missing_range_fails(self, mock_db):
        agent = PredictiveAnalyticsAgent(mock_db)
        result = AgentResult(
            agent_name="predictive_analytics",
            claim_id="c1",
            insight_type="prediction",
            summary="test",
            details={"litigation_probability": 20.0},
            confidence=0.6,
        )
        assert await agent.validate_output(result) is False
