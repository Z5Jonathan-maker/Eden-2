"""
Tests for VisionAnalyzerAgent.

All LLM calls are mocked — no external API calls.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.agents.vision_analyzer import VisionAnalyzerAgent


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _make_context(
    *,
    photos: list | None = None,
    claim_id: str = "claim-vision-001",
    is_frozen: bool = False,
) -> AgentContext:
    """Build a minimal AgentContext with optional photos."""
    return AgentContext(
        claim={
            "id": claim_id,
            "claim_number": "CLM-2025-V001",
            "property_address": "456 Palm Ave, Miami, FL 33101",
            "status": "In Progress",
        },
        photos=photos or [],
        is_frozen=is_frozen,
    )


def _make_photo(
    room: str = "unknown",
    photo_id: str = "photo-001",
    metadata: dict | None = None,
) -> dict:
    """Build a minimal photo document dict."""
    return {
        "id": photo_id,
        "claim_id": "claim-vision-001",
        "file_path": f"/photos/{photo_id}.jpg",
        "room": room,
        "sha256_hash": "abc123",
        "metadata": metadata or {},
    }


# ------------------------------------------------------------------
# Test: No photos
# ------------------------------------------------------------------

class TestVisionAnalyzerNoPhotos:
    @pytest.mark.asyncio
    async def test_vision_analyzer_no_photos(self, mock_db):
        agent = VisionAnalyzerAgent(mock_db)
        ctx = _make_context(photos=[])

        result = await agent.execute(ctx)

        assert result is not None
        assert "No photos" in result.summary
        assert result.insight_type == "vision_analysis"
        assert result.confidence == 0.5


# ------------------------------------------------------------------
# Test: Heuristic analysis — roof
# ------------------------------------------------------------------

class TestVisionAnalyzerHeuristicRoof:
    @pytest.mark.asyncio
    async def test_vision_analyzer_heuristic_roof(self, mock_db):
        agent = VisionAnalyzerAgent(mock_db)
        photo = _make_photo(room="roof")

        result = agent._heuristic_photo_analysis(photo)

        assert result["severity"] == 7
        assert "wind" in result["damage_type"] or "hail" in result["damage_type"]
        assert result["quality_score"] >= 0.0
        assert isinstance(result["fraud_indicators"], list)


# ------------------------------------------------------------------
# Test: Heuristic analysis — interior
# ------------------------------------------------------------------

class TestVisionAnalyzerHeuristicInterior:
    @pytest.mark.asyncio
    async def test_vision_analyzer_heuristic_interior(self, mock_db):
        agent = VisionAnalyzerAgent(mock_db)
        photo = _make_photo(room="interior")

        result = agent._heuristic_photo_analysis(photo)

        assert result["severity"] == 5
        assert result["damage_type"] == "water"


# ------------------------------------------------------------------
# Test: Batch LLM analysis with mock
# ------------------------------------------------------------------

class TestVisionAnalyzerBatchLLM:
    @pytest.mark.asyncio
    async def test_vision_analyzer_batch_with_mock_llm(self, mock_db):
        agent = VisionAnalyzerAgent(mock_db)

        photos = [
            _make_photo(room="roof", photo_id="p1"),
            _make_photo(room="roof", photo_id="p2"),
            _make_photo(room="interior", photo_id="p3"),
            _make_photo(room="exterior", photo_id="p4"),
            _make_photo(room="garage", photo_id="p5"),
        ]
        ctx = _make_context(photos=photos)

        mock_llm_response = json.dumps({
            "damage_classifications": [
                {"room": "roof", "damage_type": "wind/hail", "severity": 8, "notes": "Missing shingles"},
                {"room": "interior", "damage_type": "water", "severity": 6, "notes": "Ceiling stains"},
                {"room": "exterior", "damage_type": "wind", "severity": 5, "notes": "Fence damage"},
                {"room": "garage", "damage_type": "structural", "severity": 4, "notes": "Minor cracks"},
            ],
            "overall_severity": 6,
            "fraud_indicators": [],
            "quality_issues": ["Some photos lack GPS data"],
            "recommendations": ["Take close-up photos of roof damage"],
        })

        with patch.object(
            agent._llm, "generate", new_callable=AsyncMock, return_value=mock_llm_response
        ):
            result = await agent.execute(ctx)

        assert result is not None
        assert result.insight_type == "vision_analysis"
        assert "5 photos" in result.summary
        assert result.details["photos_analyzed"] == 5
        assert len(result.details["damage_classifications"]) == 4
        assert result.details["avg_severity"] == 6.0
        assert result.confidence >= 0.3
        assert isinstance(result.details["fraud_indicators"], list)
        assert isinstance(result.details["quality_issues"], list)


# ------------------------------------------------------------------
# Test: Full execution via run() with mocked batch LLM
# ------------------------------------------------------------------

class TestVisionAnalyzerFullExecution:
    @pytest.mark.asyncio
    async def test_vision_analyzer_full_execution(self, mock_db):
        agent = VisionAnalyzerAgent(mock_db)

        photos = [
            _make_photo(room="roof", photo_id="p1", metadata={"gps": "26.1,-80.1", "timestamp": "2025-01-15T10:00:00Z"}),
            _make_photo(room="interior", photo_id="p2", metadata={"timestamp": "2025-01-15T10:05:00Z"}),
            _make_photo(room="exterior", photo_id="p3"),
        ]
        ctx = _make_context(photos=photos)

        mock_batch_result = {
            "damage_classifications": [
                {"room": "roof", "damage_type": "wind/hail", "severity": 7, "notes": "Shingle damage"},
                {"room": "interior", "damage_type": "water", "severity": 5, "notes": "Water stains"},
                {"room": "exterior", "damage_type": "wind", "severity": 6, "notes": "Siding damage"},
            ],
            "overall_severity": 6,
            "fraud_indicators": [],
            "quality_issues": [],
            "recommendations": ["Get closer shots of roof"],
        }

        with patch.object(
            agent,
            "_analyze_batch_with_llm",
            new_callable=AsyncMock,
            return_value=mock_batch_result,
        ):
            result = await agent.run(ctx)

        assert result is not None
        assert result.agent_name == "vision_analyzer"
        assert result.insight_type == "vision_analysis"
        assert "3 photos" in result.summary
        assert result.details["photos_analyzed"] == 3
        assert result.confidence >= 0.3

        # Verify audit log was written
        audit_doc = await mock_db.claimpilot_audit.find_one(
            {"agent_name": "vision_analyzer"}
        )
        assert audit_doc is not None
        assert audit_doc["status"] == "success"

        # Verify insight was stored
        insight_doc = await mock_db.claimpilot_insights.find_one(
            {"agent_name": "vision_analyzer"}
        )
        assert insight_doc is not None
        assert insight_doc["claim_id"] == "claim-vision-001"
