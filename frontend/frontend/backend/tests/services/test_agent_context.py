"""Tests for AgentContextBuilder."""

import pytest
from datetime import datetime, timezone

from services.claimpilot.agent_context import AgentContext, AgentContextBuilder


@pytest.mark.asyncio
async def test_build_context_for_claim(mock_db):
    """Build context with claim + activity and verify all fields."""
    claim = {
        "id": "claim-001",
        "claim_number": "CLM-2025-0001",
        "status": "Open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim)

    activity_doc = {
        "claim_id": "claim-001",
        "action": "photo_uploaded",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claim_activity.insert_one(activity_doc)

    evidence_doc = {
        "claim_id": "claim-001",
        "type": "document",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.evidence.insert_one(evidence_doc)

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-001")

    assert isinstance(ctx, AgentContext)
    assert ctx.claim["id"] == "claim-001"
    assert ctx.is_frozen is False
    assert len(ctx.recent_activity) == 1
    assert ctx.recent_activity[0]["action"] == "photo_uploaded"
    assert len(ctx.evidence) == 1
    assert ctx.evidence[0]["type"] == "document"
    assert isinstance(ctx.notes, list)
    assert isinstance(ctx.tasks, list)
    assert isinstance(ctx.photos, list)
    assert isinstance(ctx.carrier_comms, list)


@pytest.mark.asyncio
async def test_context_marks_litigation_as_frozen(mock_db):
    """Claim with is_in_litigation=True produces is_frozen=True."""
    claim = {
        "id": "claim-lit",
        "claim_number": "CLM-2025-0099",
        "status": "Open",
        "is_in_litigation": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim)

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-lit")

    assert ctx.is_frozen is True


@pytest.mark.asyncio
async def test_context_marks_archived_as_frozen(mock_db):
    """Claim with status=Archived produces is_frozen=True."""
    claim = {
        "id": "claim-arch",
        "claim_number": "CLM-2025-0100",
        "status": "Archived",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim)

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-arch")

    assert ctx.is_frozen is True


@pytest.mark.asyncio
async def test_context_raises_for_missing_claim(mock_db):
    """ValueError raised when claim does not exist."""
    builder = AgentContextBuilder(mock_db)

    with pytest.raises(ValueError, match="Claim not found"):
        await builder.build("nonexistent-claim")


@pytest.mark.asyncio
async def test_context_is_immutable(mock_db):
    """AgentContext is frozen — attribute assignment raises."""
    claim = {
        "id": "claim-freeze",
        "status": "Open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim)

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-freeze")

    with pytest.raises(AttributeError):
        ctx.is_frozen = True


@pytest.mark.asyncio
async def test_context_fetches_carrier_comms(mock_db):
    """Only carrier/email channel messages are included."""
    claim = {
        "id": "claim-comms",
        "status": "Open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim)

    await mock_db.comm_messages.insert_one({
        "claim_id": "claim-comms",
        "channel": "carrier",
        "body": "Carrier msg",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await mock_db.comm_messages.insert_one({
        "claim_id": "claim-comms",
        "channel": "sms",
        "body": "SMS msg",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-comms")

    assert len(ctx.carrier_comms) == 1
    assert ctx.carrier_comms[0]["channel"] == "carrier"
