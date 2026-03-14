"""
Tests for the StatuteMatcherAgent.

Covers deadline calculation (compliant, approaching, overdue),
statute matching, legal disclaimer inclusion, and LLM-enhanced analysis.
"""

import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.statute_matcher import (
    FL_STATUTE_REFERENCES,
    LEGAL_DISCLAIMER,
    StatuteMatcherAgent,
)


def _make_context(
    *,
    claim_id: str = "claim-100",
    loss_date: str | None = None,
    claim_filed_date: str | None = None,
    proof_of_loss_date: str | None = None,
    status: str = "Open",
    is_in_litigation: bool = False,
    carrier_comms: list | None = None,
) -> AgentContext:
    """Build a minimal AgentContext for statute matcher tests."""
    today = date.today()
    claim: dict = {
        "id": claim_id,
        "status": status,
        "is_in_litigation": is_in_litigation,
    }
    if loss_date is not None:
        claim["loss_date"] = loss_date
    elif claim_filed_date is None:
        # Default: loss 30 days ago
        claim["loss_date"] = (today - timedelta(days=30)).isoformat()

    if claim_filed_date is not None:
        claim["claim_filed_date"] = claim_filed_date

    if proof_of_loss_date is not None:
        claim["proof_of_loss_date"] = proof_of_loss_date

    return AgentContext(
        claim=claim,
        carrier_comms=carrier_comms or [],
        is_frozen=False,
    )


class TestStatuteMatcherBasicClaim:
    """test_statute_matcher_basic_claim — claim with loss_date matches 627.70131 statutes."""

    @pytest.mark.asyncio
    async def test_matches_627_statutes(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        loss_date = (today - timedelta(days=30)).isoformat()
        ctx = _make_context(loss_date=loss_date)

        # Force heuristic path (no LLM call)
        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        assert result.insight_type == "statute_matching"
        assert result.confidence == 0.85

        matched_ids = [
            s["statute_id"] for s in result.details["matched_statutes"]
        ]
        assert "627.70131" in matched_ids
        assert "627.70131(5)" in matched_ids
        assert "627.70131(7)" in matched_ids

        # Deadlines should include the timed statutes
        deadline_ids = [d["statute_id"] for d in result.details["deadlines"]]
        assert "627.70131" in deadline_ids
        assert "627.70131(5)" in deadline_ids

    @pytest.mark.asyncio
    async def test_all_five_statutes_present(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        ctx = _make_context()

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        matched_ids = {s["statute_id"] for s in result.details["matched_statutes"]}
        for statute_id in FL_STATUTE_REFERENCES:
            assert statute_id in matched_ids


class TestStatuteMatcherDeadlineApproaching:
    """test_statute_matcher_deadline_approaching — 627.70131(7) shows 'approaching' at 80 days."""

    @pytest.mark.asyncio
    async def test_90_day_deadline_approaching_at_80_days(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        # Filed 80 days ago -> 90-day deadline has 10 days remaining -> "approaching"
        filed_date = (today - timedelta(days=80)).isoformat()
        ctx = _make_context(
            claim_filed_date=filed_date,
            proof_of_loss_date=filed_date,
        )

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        deadline_707 = next(
            (d for d in result.details["deadlines"] if d["statute_id"] == "627.70131(7)"),
            None,
        )
        assert deadline_707 is not None
        assert deadline_707["status"] == "approaching"
        assert deadline_707["days_remaining"] == 10

    @pytest.mark.asyncio
    async def test_summary_reports_approaching_count(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        filed_date = (today - timedelta(days=80)).isoformat()
        ctx = _make_context(
            claim_filed_date=filed_date,
            proof_of_loss_date=filed_date,
        )

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        assert "deadlines approaching" in result.summary


class TestStatuteMatcherDeadlineOverdue:
    """test_statute_matcher_deadline_overdue — claim filed 100 days ago shows 'overdue'."""

    @pytest.mark.asyncio
    async def test_90_day_deadline_overdue_at_100_days(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        filed_date = (today - timedelta(days=100)).isoformat()
        ctx = _make_context(
            claim_filed_date=filed_date,
            proof_of_loss_date=filed_date,
        )

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        deadline_707 = next(
            (d for d in result.details["deadlines"] if d["statute_id"] == "627.70131(7)"),
            None,
        )
        assert deadline_707 is not None
        assert deadline_707["status"] == "overdue"
        assert deadline_707["days_remaining"] < 0

    @pytest.mark.asyncio
    async def test_overdue_generates_violations(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        filed_date = (today - timedelta(days=100)).isoformat()
        ctx = _make_context(
            claim_filed_date=filed_date,
            proof_of_loss_date=filed_date,
        )

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        assert len(result.details["violations"]) > 0
        assert any("627.70131" in v for v in result.details["violations"])


class TestStatuteMatcherDisclaimer:
    """test_statute_matcher_includes_disclaimer — verify 'not legal advice' in output."""

    @pytest.mark.asyncio
    async def test_disclaimer_in_summary(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        ctx = _make_context()

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        assert "not legal advice" in result.summary.lower()

    @pytest.mark.asyncio
    async def test_disclaimer_in_details(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        ctx = _make_context()

        with patch.object(agent, "_match_with_llm", side_effect=RuntimeError("no LLM")):
            result = await agent.execute(ctx)

        assert result.details["disclaimer"] == LEGAL_DISCLAIMER


class TestStatuteMatcherWithMockLLM:
    """test_statute_matcher_with_mock_llm — mock LLM, verify enhanced analysis."""

    @pytest.mark.asyncio
    async def test_llm_enhanced_analysis(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        today = date.today()
        filed_date = (today - timedelta(days=50)).isoformat()
        ctx = _make_context(
            claim_filed_date=filed_date,
            proof_of_loss_date=filed_date,
        )

        mock_llm_response = (
            "VIOLATIONS: Carrier failed to acknowledge within 14 days per FL 627.70131\n"
            "ACTIONS: Send demand letter citing FL 627.70131, "
            "Document all carrier delays for bad faith claim"
        )

        with patch.object(agent._llm, "generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_llm_response
            result = await agent.execute(ctx)

        assert result.insight_type == "statute_matching"
        assert len(result.details["violations"]) > 0
        assert len(result.details["compliance_actions"]) > 0
        assert any("demand letter" in a.lower() for a in result.details["compliance_actions"])

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_heuristic(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        ctx = _make_context()

        with patch.object(agent._llm, "generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = RuntimeError("API timeout")
            result = await agent.execute(ctx)

        # Should still produce a valid result via heuristic
        assert result is not None
        assert result.insight_type == "statute_matching"
        assert len(result.details["matched_statutes"]) > 0


class TestStatuteMatcherValidation:
    """Validate output method checks."""

    @pytest.mark.asyncio
    async def test_valid_result_passes(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        result = AgentResult(
            agent_name="statute_matcher",
            claim_id="c1",
            insight_type="statute_matching",
            summary="3 statutes applicable.",
            confidence=0.85,
        )
        assert await agent.validate_output(result) is True

    @pytest.mark.asyncio
    async def test_low_confidence_fails(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        result = AgentResult(
            agent_name="statute_matcher",
            claim_id="c1",
            insight_type="statute_matching",
            summary="Some result",
            confidence=0.3,
        )
        assert await agent.validate_output(result) is False

    @pytest.mark.asyncio
    async def test_empty_summary_fails(self, mock_db):
        agent = StatuteMatcherAgent(mock_db)
        result = AgentResult(
            agent_name="statute_matcher",
            claim_id="c1",
            insight_type="statute_matching",
            summary="",
            confidence=0.85,
        )
        assert await agent.validate_output(result) is False
