"""
Tests for EstimateEngineAgent.

Covers: wind claims, water claims, vision-data-adjusted estimates,
disclaimer presence, and mock LLM structured output.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.estimate_engine import (
    DISCLAIMER,
    EstimateEngineAgent,
)


def _make_context(
    *,
    claim_type: str = "wind",
    photos: list | None = None,
    rooms: list[str] | None = None,
    claim_id: str = "claim-est-001",
    property_address: str = "456 Palm Ave, Miami, FL 33101",
) -> AgentContext:
    """Build a minimal AgentContext for estimate engine tests."""
    if photos is None and rooms is not None:
        photos = [{"room": r, "category": "damage"} for r in rooms]
    return AgentContext(
        claim={
            "id": claim_id,
            "claim_number": "CLM-2025-200",
            "claim_type": claim_type,
            "property_address": property_address,
            "status": "In Progress",
        },
        photos=photos or [],
        evidence=[],
        notes=[],
        carrier_comms=[],
        tasks=[],
    )


class TestEstimateWindClaim:
    """Wind claim with 3 rooms should produce a range estimate."""

    @pytest.mark.asyncio
    async def test_estimate_wind_claim(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        ctx = _make_context(
            claim_type="wind",
            rooms=["kitchen", "living room", "roof"],
        )

        result = await agent.execute(ctx)

        assert result.insight_type == "estimate"
        assert result.agent_name == "estimate_engine"
        assert result.requires_approval is True

        est = result.details["estimate_range"]
        assert est["low"] > 0
        assert est["mid"] > est["low"]
        assert est["high"] > est["mid"]

        # Wind: 2 non-roof rooms @ $3K-$8K + roof @ $10K-$25K
        assert est["low"] >= 10000
        assert est["high"] <= 50000

        assert len(result.details["line_items"]) == 3
        assert result.details["methodology"] == "heuristic"
        assert "Preliminary estimate range" in result.summary


class TestEstimateWaterClaim:
    """Water claim should use water-specific cost ranges."""

    @pytest.mark.asyncio
    async def test_estimate_water_claim(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        ctx = _make_context(
            claim_type="water",
            rooms=["bathroom", "hallway"],
        )

        result = await agent.execute(ctx)

        est = result.details["estimate_range"]
        assert est["low"] > 0
        assert est["high"] > 0

        # Water: 2 rooms @ $2K-$6K
        assert est["low"] >= 3000
        assert est["high"] <= 15000

        line_items = result.details["line_items"]
        assert len(line_items) == 2
        for item in line_items:
            assert "water" in item["description"]


class TestEstimateWithVisionData:
    """Claim with existing vision insights should adjust confidence."""

    @pytest.mark.asyncio
    async def test_estimate_with_vision_data(self, mock_db):
        agent = EstimateEngineAgent(mock_db)

        # Pre-populate vision insight in mock DB
        await mock_db.claimpilot_insights.insert_one({
            "claim_id": "claim-est-vision",
            "insight_type": "vision_analysis",
            "details": {
                "damage_classifications": [
                    {"room": "roof", "damage_type": "wind", "severity": 8},
                    {"room": "kitchen", "damage_type": "water", "severity": 6},
                ],
                "avg_severity": 7.0,
            },
        })

        ctx = _make_context(
            claim_type="hurricane",
            rooms=["roof", "kitchen"],
            claim_id="claim-est-vision",
        )

        result = await agent.execute(ctx)

        est = result.details["estimate_range"]
        assert est["low"] > 0
        assert est["high"] > est["low"]

        # Vision data should boost confidence
        assert result.confidence >= 0.5


class TestEstimateDisclaimerPresent:
    """Verify disclaimer appears in every estimate output."""

    @pytest.mark.asyncio
    async def test_estimate_disclaimer_present(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        ctx = _make_context(claim_type="fire", rooms=["bedroom"])

        result = await agent.execute(ctx)

        assert result.details["disclaimer"] == DISCLAIMER
        assert "NOT a formal estimate" in result.details["disclaimer"]
        assert "should not be shared" in result.details["disclaimer"]

    @pytest.mark.asyncio
    async def test_validation_rejects_missing_disclaimer(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        result = AgentResult(
            agent_name="estimate_engine",
            claim_id="c1",
            insight_type="estimate",
            summary="test",
            details={"estimate_range": {"low": 1000, "high": 5000}},
            confidence=0.5,
        )
        assert await agent.validate_output(result) is False


class TestEstimateWithMockLLM:
    """Mock the LLM to verify structured output parsing."""

    @pytest.mark.asyncio
    async def test_estimate_with_mock_llm(self, mock_db):
        agent = EstimateEngineAgent(mock_db)

        mock_llm_response = json.dumps({
            "estimate_range": {"low": 12500.0, "mid": 18750.0, "high": 25000.0},
            "line_items": [
                {"area": "roof", "description": "wind damage - shingles", "low": 8000, "high": 15000},
                {"area": "kitchen", "description": "water intrusion", "low": 4500, "high": 10000},
            ],
            "comparable_claims_used": 5,
            "methodology": "llm_analysis",
        })

        with patch.object(
            agent._llm, "generate", new_callable=AsyncMock, return_value=mock_llm_response
        ):
            ctx = _make_context(
                claim_type="hurricane",
                rooms=["roof", "kitchen"],
            )
            result = await agent.execute(ctx)

        assert result.insight_type == "estimate"
        est = result.details["estimate_range"]
        assert est["low"] == 12500.0
        assert est["mid"] == 18750.0
        assert est["high"] == 25000.0

        assert len(result.details["line_items"]) == 2
        assert result.details["comparable_claims_used"] == 5
        assert result.details["methodology"] == "llm_analysis"
        assert result.details["disclaimer"] == DISCLAIMER

        # LLM methodology should give higher confidence
        assert result.confidence >= 0.5

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_heuristic(self, mock_db):
        agent = EstimateEngineAgent(mock_db)

        with patch.object(
            agent._llm, "generate", new_callable=AsyncMock, side_effect=RuntimeError("API down")
        ):
            ctx = _make_context(claim_type="hail", rooms=["roof"])
            result = await agent.execute(ctx)

        assert result.details["methodology"] == "heuristic"
        assert result.details["estimate_range"]["low"] > 0


class TestHeuristicEdgeCases:
    """Edge cases for heuristic estimation."""

    @pytest.mark.asyncio
    async def test_no_photos_uses_general_area(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        ctx = _make_context(claim_type="water", rooms=[])

        result = await agent.execute(ctx)

        assert result.details["estimate_range"]["low"] > 0
        assert len(result.details["line_items"]) >= 1

    @pytest.mark.asyncio
    async def test_many_photos_scales_estimate_up(self, mock_db):
        agent = EstimateEngineAgent(mock_db)

        few_photos = [{"room": "kitchen"} for _ in range(2)]
        many_photos = [{"room": "kitchen"} for _ in range(25)]

        ctx_few = _make_context(claim_type="water")
        ctx_many = _make_context(claim_type="water")

        # Replace photos via new context objects
        ctx_few = AgentContext(
            claim=ctx_few.claim,
            photos=few_photos,
        )
        ctx_many = AgentContext(
            claim=ctx_many.claim,
            photos=many_photos,
        )

        result_few = await agent.execute(ctx_few)
        result_many = await agent.execute(ctx_many)

        assert (
            result_many.details["estimate_range"]["high"]
            > result_few.details["estimate_range"]["high"]
        )

    @pytest.mark.asyncio
    async def test_suggested_actions_present(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        ctx = _make_context(claim_type="wind", rooms=["roof"])

        result = await agent.execute(ctx)

        assert "Review and adjust estimate range" in result.suggested_actions
        assert "Order formal Xactimate estimate" in result.suggested_actions


class TestValidation:
    """Validate output checks."""

    @pytest.mark.asyncio
    async def test_valid_result_passes(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        result = AgentResult(
            agent_name="estimate_engine",
            claim_id="c1",
            insight_type="estimate",
            summary="Preliminary estimate range: $5,000 - $10,000",
            details={
                "estimate_range": {"low": 5000, "mid": 7500, "high": 10000},
                "disclaimer": DISCLAIMER,
            },
            confidence=0.5,
        )
        assert await agent.validate_output(result) is True

    @pytest.mark.asyncio
    async def test_low_confidence_fails(self, mock_db):
        agent = EstimateEngineAgent(mock_db)
        result = AgentResult(
            agent_name="estimate_engine",
            claim_id="c1",
            insight_type="estimate",
            summary="test",
            details={
                "estimate_range": {"low": 1000, "high": 5000},
                "disclaimer": DISCLAIMER,
            },
            confidence=0.1,
        )
        assert await agent.validate_output(result) is False
