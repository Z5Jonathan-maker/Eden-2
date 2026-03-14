"""
Tests for ClaimMonitorAgent — stall detection, active claim filtering,
archived claim exclusion, and full execution with mocked LLM.
"""

import sys
import os

# conftest.py lives at tests/ level — make sure it's importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
from services.claimpilot.agent_context import AgentContext
from conftest import MockDB


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _make_claim(
    *,
    claim_id: str = "claim-001",
    claim_number: str = "CLM-2025-0100",
    status: str = "In Progress",
    days_ago: int = 0,
) -> dict:
    """Build a minimal claim dict with updated_at set to N days ago."""
    return {
        "id": claim_id,
        "claim_number": claim_number,
        "status": status,
        "client_name": "Test Client",
        "property_address": "456 Oak Ave, Tampa, FL",
        "claim_type": "Wind Damage",
        "updated_at": (_utc_now() - timedelta(days=days_ago)).isoformat(),
        "created_at": (_utc_now() - timedelta(days=days_ago + 5)).isoformat(),
    }


def _make_context(claim: dict, *, is_frozen: bool = False) -> AgentContext:
    return AgentContext(claim=claim, is_frozen=is_frozen)


# ------------------------------------------------------------------
# detect_stalled_claims
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_monitor_detects_stalled_claim():
    """Claim idle 7+ days in 'In Progress' (threshold=5) should be stalled."""
    db = MockDB()
    stalled_claim = _make_claim(
        claim_id="stalled-1", status="In Progress", days_ago=7
    )
    await db.claims.insert_one(stalled_claim)

    agent = ClaimMonitorAgent(db)
    results = await agent.detect_stalled_claims()

    assert len(results) == 1
    assert results[0]["claim_id"] == "stalled-1"
    assert results[0]["days_idle"] >= 7
    assert results[0]["status"] == "In Progress"


@pytest.mark.asyncio
async def test_monitor_ignores_active_claims():
    """Claim updated 1 day ago in 'In Progress' (threshold=5) is NOT stalled."""
    db = MockDB()
    active_claim = _make_claim(
        claim_id="active-1", status="In Progress", days_ago=1
    )
    await db.claims.insert_one(active_claim)

    agent = ClaimMonitorAgent(db)
    results = await agent.detect_stalled_claims()

    stalled_ids = {r["claim_id"] for r in results}
    assert "active-1" not in stalled_ids


@pytest.mark.asyncio
async def test_monitor_ignores_archived_claims():
    """Claim with 'Archived' status should never appear in stalled list."""
    db = MockDB()
    archived_claim = _make_claim(
        claim_id="archived-1", status="Archived", days_ago=30
    )
    await db.claims.insert_one(archived_claim)

    agent = ClaimMonitorAgent(db)
    results = await agent.detect_stalled_claims()

    stalled_ids = {r["claim_id"] for r in results}
    assert "archived-1" not in stalled_ids


# ------------------------------------------------------------------
# Full execution via run() with mocked LLM + guardrails
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_monitor_full_execution_with_mock_llm():
    """run() on a stalled claim should produce stall_detection result."""
    db = MockDB()
    stalled_claim = _make_claim(
        claim_id="exec-1",
        claim_number="CLM-2025-0200",
        status="In Progress",
        days_ago=8,
    )

    mock_analysis = {
        "summary": "Claim CLM-2025-0200 stalled — no adjuster activity for 8 days.",
        "suggested_actions": [
            "Contact assigned adjuster for update",
            "Escalate to manager if no response in 24h",
        ],
        "risk_level": "high",
    }

    agent = ClaimMonitorAgent(db)
    context = _make_context(stalled_claim)

    with patch.object(
        agent, "_analyze_with_llm", new_callable=AsyncMock, return_value=mock_analysis
    ), patch(
        "services.claimpilot.base_agent.strip_legal_promises",
        side_effect=lambda text: (text, []),
    ), patch(
        "services.claimpilot.base_agent.flag_sensitive_content",
        return_value=[],
    ):
        result = await agent.run(context)

    assert result is not None
    assert result.insight_type == "stall_detection"
    assert result.agent_name == "claim_monitor"
    assert len(result.suggested_actions) == 2
    assert result.confidence >= 0.5
    assert "CLM-2025-0200" in result.summary


@pytest.mark.asyncio
async def test_monitor_active_claim_returns_monitoring():
    """run() on a recently-updated claim should return monitoring insight."""
    db = MockDB()
    active_claim = _make_claim(
        claim_id="active-exec",
        claim_number="CLM-2025-0300",
        status="New",
        days_ago=0,
    )

    agent = ClaimMonitorAgent(db)
    context = _make_context(active_claim)

    with patch(
        "services.claimpilot.base_agent.strip_legal_promises",
        side_effect=lambda text: (text, []),
    ), patch(
        "services.claimpilot.base_agent.flag_sensitive_content",
        return_value=[],
    ):
        result = await agent.run(context)

    assert result is not None
    assert result.insight_type == "monitoring"
    assert result.confidence == 0.95


@pytest.mark.asyncio
async def test_monitor_frozen_claim_skipped():
    """run() on a frozen claim should return None."""
    db = MockDB()
    claim = _make_claim(claim_id="frozen-1", status="In Progress", days_ago=10)

    agent = ClaimMonitorAgent(db)
    context = _make_context(claim, is_frozen=True)

    result = await agent.run(context)
    assert result is None
