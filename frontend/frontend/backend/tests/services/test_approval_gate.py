"""Tests for ClaimPilot ApprovalGate."""

import sys
import os
import pytest

# Ensure backend root is on sys.path so `from models import …` works.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from models import PendingAction
from services.claimpilot.approval_gate import ApprovalGate


@pytest.fixture
def gate(mock_db):
    return ApprovalGate(mock_db)


def _make_action(**overrides) -> PendingAction:
    defaults = {
        "agent_name": "damage_detector",
        "claim_id": "claim-001",
        "action_type": "update_estimate",
        "action_data": {"amount": 5000},
        "confidence": 0.85,
        "reasoning": "Detected roof damage in photos",
    }
    defaults.update(overrides)
    return PendingAction(**defaults)


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_pending_action(gate, mock_db):
    action = _make_action()
    returned_id = await gate.submit(action)

    assert returned_id == action.id

    doc = await mock_db.claimpilot_pending.find_one({"id": action.id})
    assert doc is not None
    assert doc["status"] == "pending"
    assert doc["agent_name"] == "damage_detector"
    assert doc["expires_at"] is not None


@pytest.mark.asyncio
async def test_approve_pending_action(gate, mock_db):
    action = _make_action()
    await gate.submit(action)

    result = await gate.approve(action.id, reviewed_by="user-jane")
    assert result is True

    doc = await mock_db.claimpilot_pending.find_one({"id": action.id})
    assert doc["status"] == "approved"
    assert doc["reviewed_by"] == "user-jane"
    assert doc["reviewed_at"] is not None


@pytest.mark.asyncio
async def test_approve_nonexistent_returns_false(gate):
    result = await gate.approve("no-such-id", reviewed_by="user-jane")
    assert result is False


@pytest.mark.asyncio
async def test_reject_pending_action(gate, mock_db):
    action = _make_action()
    await gate.submit(action)

    result = await gate.reject(action.id, reviewed_by="user-bob", reason="Estimate too high")
    assert result is True

    doc = await mock_db.claimpilot_pending.find_one({"id": action.id})
    assert doc["status"] == "rejected"
    assert doc["reviewed_by"] == "user-bob"
    assert doc["reject_reason"] == "Estimate too high"


@pytest.mark.asyncio
async def test_reject_nonexistent_returns_false(gate):
    result = await gate.reject("no-such-id", reviewed_by="user-bob", reason="nope")
    assert result is False


@pytest.mark.asyncio
async def test_get_pending_actions(gate):
    for i in range(3):
        await gate.submit(_make_action(claim_id=f"claim-{i}"))

    pending = await gate.get_pending()
    assert len(pending) == 3
    assert all(p["status"] == "pending" for p in pending)


@pytest.mark.asyncio
async def test_get_pending_filtered_by_claim(gate):
    await gate.submit(_make_action(claim_id="claim-A"))
    await gate.submit(_make_action(claim_id="claim-B"))
    await gate.submit(_make_action(claim_id="claim-A"))

    results = await gate.get_pending(claim_id="claim-A")
    assert len(results) == 2
    assert all(r["claim_id"] == "claim-A" for r in results)


@pytest.mark.asyncio
async def test_get_action(gate):
    action = _make_action()
    await gate.submit(action)

    doc = await gate.get_action(action.id)
    assert doc is not None
    assert doc["id"] == action.id
    assert doc["action_type"] == "update_estimate"


@pytest.mark.asyncio
async def test_get_action_not_found(gate):
    doc = await gate.get_action("nonexistent")
    assert doc is None
