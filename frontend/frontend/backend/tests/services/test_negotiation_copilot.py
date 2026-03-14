"""
Tests for NegotiationCopilotAgent.

Covers: no comms, heuristic with offer, heuristic with denial,
mock LLM structured output, and requires_approval flag.
All LLM calls are mocked.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.negotiation_copilot import (
    NegotiationCopilotAgent,
)


def _make_context(
    *,
    carrier_comms=None,
    evidence=None,
    claim_id: str = "claim-neg-001",
    status: str = "In Progress",
) -> AgentContext:
    """Build a minimal AgentContext for negotiation tests."""
    return AgentContext(
        claim={
            "id": claim_id,
            "status": status,
            "claim_number": "CLM-2025-200",
            "property_address": "456 Palm Ave, Tampa, FL 33601",
        },
        carrier_comms=carrier_comms or [],
        evidence=evidence or [],
    )


class TestNegotiationNoComms:
    """No carrier comms -- agent should short-circuit."""

    @pytest.mark.asyncio
    async def test_negotiation_no_comms(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        assert result.insight_type == "negotiation_analysis"
        assert "No carrier communications" in result.summary
        assert result.confidence == 1.0
        assert result.requires_approval is False


class TestNegotiationHeuristicWithOffer:
    """Carrier comm containing a dollar amount -- counter strategy."""

    @pytest.mark.asyncio
    async def test_negotiation_heuristic_with_offer(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        comms = [
            {
                "body": "We have reviewed your claim and offer $5000 for repairs.",
                "channel": "email",
                "direction": "inbound",
            },
        ]
        ctx = _make_context(carrier_comms=comms)

        # Force heuristic by making LLM raise
        with patch.object(
            agent._llm, "generate", side_effect=RuntimeError("no LLM")
        ):
            result = await agent.execute(ctx)

        assert result.insight_type == "negotiation_analysis"
        assert "$5,000.00" in result.details["carrier_position"]
        assert result.details["settlement_range"]["low"] == 5000.0
        assert result.details["settlement_range"]["mid"] == 7500.0
        assert result.details["settlement_range"]["high"] == 10000.0
        assert len(result.details["counter_arguments"]) > 0
        assert result.requires_approval is True


class TestNegotiationHeuristicWithDenial:
    """Carrier comm with denial keyword -- escalation strategy."""

    @pytest.mark.asyncio
    async def test_negotiation_heuristic_with_denial(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        comms = [
            {
                "body": "Your claim has been denied due to policy exclusion.",
                "channel": "carrier",
                "direction": "inbound",
            },
        ]
        ctx = _make_context(carrier_comms=comms)

        with patch.object(
            agent._llm, "generate", side_effect=RuntimeError("no LLM")
        ):
            result = await agent.execute(ctx)

        assert "denied" in result.details["carrier_position"].lower()
        assert any(
            "bad faith" in arg.lower()
            for arg in result.details["counter_arguments"]
        )
        assert result.details["risk_assessment"].startswith("High risk")
        assert result.requires_approval is True


class TestNegotiationWithMockLLM:
    """Mock LLM returns structured JSON -- verify parsing."""

    @pytest.mark.asyncio
    async def test_negotiation_with_mock_llm(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        comms = [
            {
                "body": "We are reviewing your claim for water damage.",
                "channel": "email",
                "direction": "inbound",
            },
        ]
        ctx = _make_context(carrier_comms=comms)

        llm_response = json.dumps({
            "carrier_position": "Carrier is in review phase",
            "leverage_points": ["Strong documentation", "Expert report"],
            "settlement_range": {"low": 8000, "mid": 12000, "high": 18000},
            "risk_assessment": "Moderate -- carrier may dispute scope",
            "counter_arguments": [
                "Independent moisture report supports full remediation",
                "Florida statute requires timely response",
            ],
            "recommended_response": "Submit demand with expert report attached",
            "strategy": "demand-package",
        })

        with patch.object(
            agent._llm, "generate", new_callable=AsyncMock, return_value=llm_response
        ):
            result = await agent.execute(ctx)

        assert result.insight_type == "negotiation_analysis"
        assert "review phase" in result.summary.lower()
        assert result.details["settlement_range"]["low"] == 8000
        assert result.details["settlement_range"]["mid"] == 12000
        assert result.details["settlement_range"]["high"] == 18000
        assert len(result.details["leverage_points"]) == 2
        assert len(result.details["counter_arguments"]) == 2
        assert result.confidence == 0.85
        assert len(result.suggested_actions) > 0


class TestNegotiationRequiresApproval:
    """Verify requires_approval is True when comms exist."""

    @pytest.mark.asyncio
    async def test_negotiation_requires_approval(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)

        assert agent.requires_approval is True

        comms = [
            {
                "body": "Claim acknowledged. Under review.",
                "channel": "carrier",
                "direction": "inbound",
            },
        ]
        ctx = _make_context(carrier_comms=comms)

        with patch.object(
            agent._llm, "generate", side_effect=RuntimeError("no LLM")
        ):
            result = await agent.execute(ctx)

        assert result.requires_approval is True


class TestValidation:
    """Validate output checks."""

    @pytest.mark.asyncio
    async def test_valid_result_passes(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        result = AgentResult(
            agent_name="negotiation_copilot",
            claim_id="c1",
            insight_type="negotiation_analysis",
            summary="Carrier position analyzed",
            details={},
            confidence=0.7,
        )
        assert await agent.validate_output(result) is True

    @pytest.mark.asyncio
    async def test_low_confidence_fails(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        result = AgentResult(
            agent_name="negotiation_copilot",
            claim_id="c1",
            insight_type="negotiation_analysis",
            summary="test",
            details={},
            confidence=0.3,
        )
        assert await agent.validate_output(result) is False

    @pytest.mark.asyncio
    async def test_empty_summary_fails(self, mock_db):
        agent = NegotiationCopilotAgent(mock_db)
        result = AgentResult(
            agent_name="negotiation_copilot",
            claim_id="c1",
            insight_type="negotiation_analysis",
            summary="",
            details={},
            confidence=0.9,
        )
        assert await agent.validate_output(result) is False
