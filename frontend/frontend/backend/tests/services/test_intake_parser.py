"""
Tests for IntakeParserAgent — field detection, heuristic extraction,
and full execution with mocked LLM.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from services.claimpilot.agents.intake_parser import IntakeParserAgent
from services.claimpilot.agent_context import AgentContext
from conftest import MockDB


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _make_claim(
    *,
    claim_id: str = "claim-intake-001",
    claim_number: str = "CLM-2025-0500",
    client_name: str = "Jane Smith",
    client_email: str = "jane@example.com",
    client_phone: str = "(555) 999-0000",
    property_address: str = "100 Palm Dr, Miami, FL 33101",
    loss_date: str = "2025-01-15",
    claim_type: str = "Water Damage",
    carrier: str = "Citizens Insurance",
    policy_number: str = "POL-2025-1234",
) -> dict:
    """Build a claim dict. Pass empty string to simulate missing field."""
    return {
        "id": claim_id,
        "claim_number": claim_number,
        "status": "New",
        "client_name": client_name,
        "client_email": client_email,
        "client_phone": client_phone,
        "property_address": property_address,
        "loss_date": loss_date,
        "claim_type": claim_type,
        "carrier": carrier,
        "policy_number": policy_number,
        "created_at": _utc_now().isoformat(),
    }


def _make_context(
    claim: dict,
    *,
    notes: list | None = None,
    recent_activity: list | None = None,
    evidence: list | None = None,
) -> AgentContext:
    return AgentContext(
        claim=claim,
        notes=notes or [],
        recent_activity=recent_activity or [],
        evidence=evidence or [],
    )


# ------------------------------------------------------------------
# All fields present
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intake_parser_all_fields_present():
    """Claim with every intake field populated returns 'All intake fields populated'."""
    db = MockDB()
    claim = _make_claim()
    context = _make_context(claim)

    agent = IntakeParserAgent(db)
    result = await agent.execute(context)

    assert result.insight_type == "intake_parsing"
    assert result.summary == "All intake fields populated"
    assert result.confidence == 1.0


# ------------------------------------------------------------------
# Detects missing fields
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intake_parser_detects_missing_fields():
    """Claim with empty client_email and client_phone identifies them as missing."""
    db = MockDB()
    claim = _make_claim(client_email="", client_phone="")
    context = _make_context(claim)

    agent = IntakeParserAgent(db)

    # Mock LLM to return no extractions (so we can inspect missing detection)
    with patch.object(
        agent,
        "_parse_with_llm",
        new_callable=AsyncMock,
        return_value={"extracted_fields": {}},
    ):
        result = await agent.execute(context)

    assert result.insight_type == "intake_parsing"
    assert "0 of 2" in result.summary
    assert "client_email" in result.details["missing_fields"]
    assert "client_phone" in result.details["missing_fields"]


# ------------------------------------------------------------------
# Heuristic: email extraction
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intake_parser_heuristic_extracts_email():
    """Heuristic parser extracts email from text source."""
    db = MockDB()
    claim = _make_claim(client_email="")

    agent = IntakeParserAgent(db)
    text_sources = ["Client reached out via john@example.com about the claim."]

    result = agent._heuristic_parse(claim, text_sources, ["client_email"])

    assert "client_email" in result["extracted_fields"]
    assert result["extracted_fields"]["client_email"]["value"] == "john@example.com"
    assert result["extracted_fields"]["client_email"]["confidence"] == 0.6


# ------------------------------------------------------------------
# Heuristic: phone extraction
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intake_parser_heuristic_extracts_phone():
    """Heuristic parser extracts US phone number from text source."""
    db = MockDB()
    claim = _make_claim(client_phone="")

    agent = IntakeParserAgent(db)
    text_sources = ["Please call the client at (555) 123-4567 for updates."]

    result = agent._heuristic_parse(claim, text_sources, ["client_phone"])

    assert "client_phone" in result["extracted_fields"]
    assert result["extracted_fields"]["client_phone"]["value"] == "(555) 123-4567"
    assert result["extracted_fields"]["client_phone"]["confidence"] == 0.5


# ------------------------------------------------------------------
# Full execution with mock LLM
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_intake_parser_with_mock_llm():
    """Full execute() with mocked LLM returns extracted fields and actions."""
    db = MockDB()
    claim = _make_claim(client_email="", client_phone="", carrier="")
    notes = [{"content": "Client email is bob@claims.com, phone (305) 555-1234"}]
    context = _make_context(claim, notes=notes)

    mock_llm_response = {
        "extracted_fields": {
            "client_email": {
                "value": "bob@claims.com",
                "confidence": 0.9,
                "source": "note text",
            },
            "client_phone": {
                "value": "(305) 555-1234",
                "confidence": 0.85,
                "source": "note text",
            },
        }
    }

    agent = IntakeParserAgent(db)

    with patch.object(
        agent,
        "_parse_with_llm",
        new_callable=AsyncMock,
        return_value=mock_llm_response,
    ):
        result = await agent.execute(context)

    assert result.insight_type == "intake_parsing"
    assert "2 of 3" in result.summary
    assert len(result.suggested_actions) == 2
    assert result.requires_approval is True

    extracted = result.details["extracted_fields"]
    assert "client_email" in extracted
    assert extracted["client_email"]["value"] == "bob@claims.com"
    assert "client_phone" in extracted
    assert "carrier" in result.details["missing_fields"]
