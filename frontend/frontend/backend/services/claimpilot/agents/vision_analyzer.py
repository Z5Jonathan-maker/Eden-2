"""
VisionAnalyzer Agent — Analyzes inspection photo metadata to classify damage,
estimate severity, and flag potential fraud indicators.

Primary path: batch text-based LLM analysis of photo metadata (avoids vision
API rate limits). Per-photo vision analysis is a Phase 2b enhancement.
Heuristic fallback when LLM is unavailable.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an expert property damage assessor for Care Claims, a public "
    "adjusting firm in Florida.\n"
    "Analyze the following inspection photo metadata and provide a damage "
    "assessment.\n\n"
    "For each room/area, assess:\n"
    "1. Likely damage type (water, wind, hail, fire, mold, structural, cosmetic)\n"
    "2. Estimated severity (1-10, where 10 is catastrophic)\n"
    "3. Any patterns suggesting fraud or staged damage\n"
    "4. Recommended additional photos or evidence needed\n\n"
    'Respond in JSON: {"damage_classifications": [{"room": "...", '
    '"damage_type": "...", "severity": N, "notes": "..."}], '
    '"overall_severity": N, "fraud_indicators": [], "quality_issues": [], '
    '"recommendations": []}'
)

# Room-based severity heuristics (non-LLM fallback)
_ROOM_HEURISTICS: dict[str, dict[str, Any]] = {
    "roof": {"severity": 7, "damage_type": "wind/hail"},
    "interior": {"severity": 5, "damage_type": "water"},
    "exterior": {"severity": 6, "damage_type": "wind"},
}
_DEFAULT_HEURISTIC: dict[str, Any] = {"severity": 5, "damage_type": "unknown"}

# Metadata fields that indicate higher photo quality
_QUALITY_FIELDS = ("gps", "timestamp", "geolocation", "lat", "lng", "date_taken")


class VisionAnalyzerAgent(BaseAgent):
    """Analyzes inspection photos for damage classification and severity."""

    agent_name: str = "vision_analyzer"
    requires_approval: bool = False
    llm_provider: str = "gemini_flash"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        """Analyze all photos in the claim context."""
        claim_id = context.claim.get("id", "unknown")
        photos = context.photos

        if not photos:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=claim_id,
                insight_type="vision_analysis",
                summary="No photos to analyze",
                confidence=0.5,
                requires_approval=self.requires_approval,
            )

        # Primary path: batch metadata analysis via text LLM
        batch_result = await self._analyze_batch_with_llm(photos, context)

        # If batch LLM failed, fall back to per-photo heuristics
        if batch_result is None:
            per_photo_results = [
                self._heuristic_photo_analysis(p) for p in photos
            ]
            batch_result = self._aggregate_heuristic_results(per_photo_results, photos)

        damage_classifications = batch_result.get("damage_classifications", [])
        fraud_indicators = batch_result.get("fraud_indicators", [])
        quality_issues = batch_result.get("quality_issues", [])
        overall_severity = batch_result.get("overall_severity", 0)

        damage_types = {
            c.get("damage_type", "unknown") for c in damage_classifications
        }

        avg_severity = overall_severity or (
            sum(c.get("severity", 5) for c in damage_classifications)
            / max(len(damage_classifications), 1)
        )

        # Confidence based on photo count and metadata quality
        avg_quality = self._avg_photo_quality(photos)
        confidence = min(0.3 + avg_quality * 0.5 + min(len(photos) / 20, 0.2), 0.95)

        summary = (
            f"Analyzed {len(photos)} photos: "
            f"{len(damage_types)} damage types found, "
            f"avg severity {avg_severity:.1f}/10"
        )

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="vision_analysis",
            summary=summary,
            details={
                "photos_analyzed": len(photos),
                "damage_classifications": damage_classifications,
                "avg_severity": round(avg_severity, 1),
                "fraud_indicators": fraud_indicators,
                "quality_issues": quality_issues,
            },
            confidence=round(confidence, 2),
            suggested_actions=batch_result.get("recommendations", []),
            requires_approval=self.requires_approval,
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        """Lower threshold since vision analysis is experimental."""
        return result.confidence >= 0.3 and bool(result.summary)

    # ------------------------------------------------------------------
    # Batch LLM analysis (primary path)
    # ------------------------------------------------------------------

    async def _analyze_batch_with_llm(
        self, photos: list[dict], context: AgentContext
    ) -> dict[str, Any] | None:
        """Analyze photo metadata in batch via text LLM.

        Returns parsed JSON dict or None on failure.
        """
        # Build metadata summary for the prompt
        room_counts: dict[str, int] = {}
        photo_summaries: list[str] = []

        for i, photo in enumerate(photos, 1):
            room = photo.get("room", "unknown")
            room_counts[room] = room_counts.get(room, 0) + 1

            meta_parts = [f"Photo {i}: room={room}"]
            if photo.get("metadata"):
                meta = photo["metadata"]
                if meta.get("timestamp"):
                    meta_parts.append(f"timestamp={meta['timestamp']}")
                if meta.get("gps") or meta.get("geolocation"):
                    meta_parts.append("has_gps=true")
                if meta.get("tags"):
                    meta_parts.append(f"tags={meta['tags']}")
            photo_summaries.append(", ".join(meta_parts))

        claim = context.claim
        prompt = (
            f"Claim #{claim.get('claim_number', 'N/A')} — "
            f"{claim.get('property_address', 'Unknown address')}\n"
            f"Total photos: {len(photos)}\n"
            f"Room breakdown: {json.dumps(room_counts)}\n\n"
            "Photo details:\n" + "\n".join(photo_summaries)
        )

        try:
            raw = await self._llm.generate(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                provider_override=self.llm_provider,
            )
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as exc:
            logger.warning(
                "Batch LLM analysis failed for claim %s: %s — using heuristic fallback",
                context.claim.get("id", "unknown"),
                exc,
            )
            return None

    # ------------------------------------------------------------------
    # Per-photo vision analysis (Phase 2b — used as secondary path)
    # ------------------------------------------------------------------

    async def _analyze_photo(self, photo_doc: dict) -> dict[str, Any]:
        """Analyze a single photo via vision API or heuristic fallback."""
        image_bytes = photo_doc.get("image_bytes")

        if image_bytes:
            try:
                prompt = (
                    "Analyze this property damage photo. Return JSON: "
                    '{"damage_type": "...", "severity": N, "quality_score": 0.0-1.0, '
                    '"fraud_indicators": [], "recommendations": []}'
                )
                raw = await self._llm.generate_vision(
                    prompt=prompt,
                    image_bytes=image_bytes,
                    mime_type=photo_doc.get("mime_type", "image/jpeg"),
                )
                result = json.loads(raw)
                return {
                    "damage_type": result.get("damage_type", "unknown"),
                    "severity": result.get("severity", 5),
                    "quality_score": result.get("quality_score", 0.5),
                    "fraud_indicators": result.get("fraud_indicators", []),
                    "recommendations": result.get("recommendations", []),
                }
            except Exception as exc:
                logger.warning(
                    "Vision API failed for photo %s: %s — using heuristic",
                    photo_doc.get("id", "unknown"),
                    exc,
                )

        return self._heuristic_photo_analysis(photo_doc)

    # ------------------------------------------------------------------
    # Heuristic fallback (no LLM)
    # ------------------------------------------------------------------

    def _heuristic_photo_analysis(self, photo_doc: dict) -> dict[str, Any]:
        """Analyze photo metadata only — no image bytes needed."""
        room = (photo_doc.get("room") or "").lower()
        heuristic = _ROOM_HEURISTICS.get(room, _DEFAULT_HEURISTIC)

        # Quality score based on metadata completeness
        metadata = photo_doc.get("metadata") or {}
        quality_hits = sum(
            1 for field in _QUALITY_FIELDS
            if metadata.get(field) or photo_doc.get(field)
        )
        quality_score = min(0.3 + quality_hits * 0.15, 1.0)

        return {
            "damage_type": heuristic["damage_type"],
            "severity": heuristic["severity"],
            "quality_score": round(quality_score, 2),
            "fraud_indicators": [],
            "recommendations": [],
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _aggregate_heuristic_results(
        self, results: list[dict], photos: list[dict]
    ) -> dict[str, Any]:
        """Combine per-photo heuristic results into batch format."""
        classifications = []
        for photo, result in zip(photos, results):
            classifications.append({
                "room": photo.get("room", "unknown"),
                "damage_type": result["damage_type"],
                "severity": result["severity"],
                "notes": "heuristic analysis",
            })

        severities = [r["severity"] for r in results]
        avg_sev = sum(severities) / max(len(severities), 1)

        return {
            "damage_classifications": classifications,
            "overall_severity": round(avg_sev, 1),
            "fraud_indicators": [],
            "quality_issues": [],
            "recommendations": [],
        }

    def _avg_photo_quality(self, photos: list[dict]) -> float:
        """Compute average quality score across photos from metadata."""
        if not photos:
            return 0.0
        scores = [
            self._heuristic_photo_analysis(p)["quality_score"] for p in photos
        ]
        return sum(scores) / len(scores)
