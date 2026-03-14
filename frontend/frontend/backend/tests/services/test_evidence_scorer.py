"""
Tests for EvidenceScorerAgent.

Covers: empty claims, photo-only claims, full evidence, readiness thresholds,
and gap identification.
"""

import pytest

from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.evidence_scorer import (
    EVIDENCE_CATEGORIES,
    EvidenceScorerAgent,
)


def _make_context(
    *,
    photos=None,
    evidence=None,
    notes=None,
    carrier_comms=None,
    tasks=None,
    claim_id: str = "claim-ev-001",
) -> AgentContext:
    """Build a minimal AgentContext for evidence scoring tests."""
    return AgentContext(
        claim={"id": claim_id, "status": "In Progress", "claim_number": "CLM-2025-100"},
        photos=photos or [],
        evidence=evidence or [],
        notes=notes or [],
        carrier_comms=carrier_comms or [],
        tasks=tasks or [],
    )


class TestEvidenceScorerEmptyClaim:
    """No evidence, photos, or notes -- expect low score and many gaps."""

    @pytest.mark.asyncio
    async def test_empty_claim_returns_low_score(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        assert result.insight_type == "evidence_scoring"
        assert result.details["overall_score"] == 0.0
        assert result.details["readiness"] == "insufficient"
        assert result.confidence == 0.9

    @pytest.mark.asyncio
    async def test_empty_claim_has_all_items_as_gaps(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        total_items = sum(len(c["items"]) for c in EVIDENCE_CATEGORIES.values())
        assert len(result.details["gaps"]) == total_items

    @pytest.mark.asyncio
    async def test_empty_claim_all_category_scores_zero(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        for cat_data in result.details["categories"].values():
            assert cat_data["score"] == 0.0
            assert cat_data["present"] == []


class TestEvidenceScorerWithPhotos:
    """Claim with photos -- damage_documentation and property_documentation partially scored."""

    @pytest.mark.asyncio
    async def test_damage_photos_scored(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        photos = [
            {"category": "damage", "label": "roof damage", "tags": ["loss"]},
            {"category": "damage", "label": "water damage", "tags": ["interior"]},
            {"category": "property", "label": "front exterior", "tags": ["overview"]},
        ]
        ctx = _make_context(photos=photos)

        result = await agent.execute(ctx)

        dmg_cat = result.details["categories"]["damage_documentation"]
        assert "damage_photos" in dmg_cat["present"]

        prop_cat = result.details["categories"]["property_documentation"]
        assert "property_photos" in prop_cat["present"]

    @pytest.mark.asyncio
    async def test_photos_increase_overall_score(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        photos = [
            {"category": "damage", "label": "roof", "tags": ["damage"]},
            {"category": "property", "label": "exterior", "tags": ["property"]},
        ]
        ctx = _make_context(photos=photos)

        result = await agent.execute(ctx)

        # damage_photos: 1/4 = 25% * 0.35 = 8.75
        # property_photos: 1/4 = 25% * 0.25 = 6.25
        # total ~15.0%
        assert result.details["overall_score"] > 0.0
        assert result.details["readiness"] == "insufficient"


class TestEvidenceScorerFullEvidence:
    """Claim with photos, notes, carrier comms, and evidence docs -- high score."""

    @pytest.mark.asyncio
    async def test_full_evidence_returns_high_score(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)

        photos = [
            {"category": "damage", "label": "roof damage", "tags": ["loss"]},
            {"category": "property", "label": "exterior", "tags": ["overview"]},
        ]
        evidence = [
            {"type": "policy", "name": "Policy Document", "tags": []},
            {"type": "deed", "name": "Property Deed", "tags": []},
            {"type": "report", "name": "Inspection Report", "tags": ["inspection"]},
            {"type": "estimate", "name": "Contractor Estimate", "tags": ["contractor"]},
            {"type": "expert", "name": "Engineering Report", "tags": ["expert"]},
            {"type": "aerial", "name": "Drone Images", "tags": ["aerial"]},
            {"type": "receipt", "name": "Repair Receipt", "tags": []},
            {"type": "invoice", "name": "Materials Invoice", "tags": []},
            {"type": "history", "name": "Prior Claims Report", "tags": ["prior claim"]},
            {"type": "inventory", "name": "Contents List", "tags": ["loss list"]},
            {"type": "transcript", "name": "Call Log", "tags": ["call log"]},
        ]
        notes = [{"content": "Met with homeowner", "author": "adjuster-1"}]
        carrier_comms = [
            {"channel": "carrier", "body": "Acknowledging claim"},
            {"channel": "email", "body": "Follow-up email"},
        ]
        ctx = _make_context(
            photos=photos,
            evidence=evidence,
            notes=notes,
            carrier_comms=carrier_comms,
        )

        result = await agent.execute(ctx)

        assert result.details["overall_score"] >= 80.0
        assert result.details["readiness"] == "ready"
        assert len(result.details["gaps"]) == 0

    @pytest.mark.asyncio
    async def test_full_evidence_summary_format(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        photos = [{"category": "damage", "label": "roof", "tags": ["damage"]}]
        notes = [{"content": "Note"}]
        ctx = _make_context(photos=photos, notes=notes)

        result = await agent.execute(ctx)

        assert "Evidence completeness:" in result.summary
        assert "property" in result.summary
        assert "damage" in result.summary


class TestReadinessLevels:
    """Verify ready/needs_work/insufficient thresholds."""

    def test_ready_at_80(self):
        assert EvidenceScorerAgent._determine_readiness(80.0) == "ready"

    def test_ready_above_80(self):
        assert EvidenceScorerAgent._determine_readiness(95.0) == "ready"

    def test_needs_work_at_50(self):
        assert EvidenceScorerAgent._determine_readiness(50.0) == "needs_work"

    def test_needs_work_at_79(self):
        assert EvidenceScorerAgent._determine_readiness(79.9) == "needs_work"

    def test_insufficient_below_50(self):
        assert EvidenceScorerAgent._determine_readiness(49.9) == "insufficient"

    def test_insufficient_at_zero(self):
        assert EvidenceScorerAgent._determine_readiness(0.0) == "insufficient"


class TestGapIdentification:
    """Verify missing items are listed and prioritized."""

    @pytest.mark.asyncio
    async def test_gaps_list_missing_items(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        gap_items = [g["item"] for g in result.details["gaps"]]
        # All items should be gaps when nothing is provided
        for cat_config in EVIDENCE_CATEGORIES.values():
            for item in cat_config["items"]:
                assert item in gap_items

    @pytest.mark.asyncio
    async def test_gaps_sorted_by_priority(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        priorities = [g["priority"] for g in result.details["gaps"]]
        priority_order = {"high": 0, "medium": 1, "low": 2}
        numeric = [priority_order[p] for p in priorities]
        assert numeric == sorted(numeric)

    @pytest.mark.asyncio
    async def test_gaps_include_category(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        ctx = _make_context()

        result = await agent.execute(ctx)

        for gap in result.details["gaps"]:
            assert "category" in gap
            assert gap["category"] in EVIDENCE_CATEGORIES

    @pytest.mark.asyncio
    async def test_present_items_excluded_from_gaps(self, mock_db):
        agent = EvidenceScorerAgent(mock_db)
        notes = [{"content": "Some notes"}]
        ctx = _make_context(notes=notes)

        result = await agent.execute(ctx)

        gap_items = [g["item"] for g in result.details["gaps"]]
        assert "adjuster_notes" not in gap_items


class TestValidation:
    """Validate output checks."""

    @pytest.mark.asyncio
    async def test_valid_result_passes(self, mock_db):
        from models import AgentResult

        agent = EvidenceScorerAgent(mock_db)
        result = AgentResult(
            agent_name="evidence_scorer",
            claim_id="c1",
            insight_type="evidence_scoring",
            summary="test",
            details={"overall_score": 50.0},
            confidence=0.9,
        )
        assert await agent.validate_output(result) is True

    @pytest.mark.asyncio
    async def test_low_confidence_fails(self, mock_db):
        from models import AgentResult

        agent = EvidenceScorerAgent(mock_db)
        result = AgentResult(
            agent_name="evidence_scorer",
            claim_id="c1",
            insight_type="evidence_scoring",
            summary="test",
            details={"overall_score": 50.0},
            confidence=0.3,
        )
        assert await agent.validate_output(result) is False

    @pytest.mark.asyncio
    async def test_missing_overall_score_fails(self, mock_db):
        from models import AgentResult

        agent = EvidenceScorerAgent(mock_db)
        result = AgentResult(
            agent_name="evidence_scorer",
            claim_id="c1",
            insight_type="evidence_scoring",
            summary="test",
            details={},
            confidence=0.9,
        )
        assert await agent.validate_output(result) is False
