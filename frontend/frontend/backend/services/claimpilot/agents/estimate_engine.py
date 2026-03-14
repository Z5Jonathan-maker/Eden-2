"""
EstimateEngine Agent -- Generates preliminary damage range estimates
for internal planning based on claim type, vision data, and property details.

Primary path: LLM-based estimation via Groq.
Fallback: heuristic estimation based on claim type and room counts.

DISCLAIMER: All estimates are preliminary AI-generated ranges for internal
planning only. They are NOT formal estimates and must not be shared with
carriers or clients.
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

DISCLAIMER = (
    "This is a preliminary AI-generated range estimate for internal planning "
    "only. It is NOT a formal estimate and should not be shared with carriers "
    "or clients."
)

SYSTEM_PROMPT = (
    "You are an expert property damage estimator specializing in Florida "
    "residential and commercial claims. You work for Care Claims, a public "
    "adjusting firm.\n\n"
    "Given claim details and damage descriptions, produce a preliminary "
    "range estimate with line items.\n\n"
    "Respond ONLY with valid JSON in this format:\n"
    "{\n"
    '  "estimate_range": {"low": float, "mid": float, "high": float},\n'
    '  "line_items": [\n'
    '    {"area": "...", "description": "...", "low": float, "high": float}\n'
    "  ],\n"
    '  "comparable_claims_used": int,\n'
    '  "methodology": "llm_analysis"\n'
    "}\n\n"
    "Base ranges on typical Florida repair costs. Be conservative — "
    "underestimating is safer than overestimating for preliminary planning."
)

# Per-room cost ranges by claim type (low, high)
_ROOM_COST_RANGES: dict[str, tuple[float, float]] = {
    "wind": (3000.0, 8000.0),
    "hurricane": (3000.0, 8000.0),
    "water": (2000.0, 6000.0),
    "fire": (5000.0, 15000.0),
    "hail": (2000.0, 5000.0),
}

# Roof-specific ranges by claim type
_ROOF_COST_RANGES: dict[str, tuple[float, float]] = {
    "wind": (10000.0, 25000.0),
    "hurricane": (10000.0, 25000.0),
    "hail": (5000.0, 15000.0),
    "fire": (10000.0, 25000.0),
    "water": (3000.0, 8000.0),
}

_DEFAULT_ROOM_RANGE: tuple[float, float] = (2000.0, 8000.0)
_DEFAULT_ROOF_RANGE: tuple[float, float] = (5000.0, 15000.0)

# Photo count scaling: more photos = more documented damage
_PHOTO_SCALE_THRESHOLDS = (
    (20, 1.3),   # 20+ photos: 30% uplift
    (10, 1.15),  # 10+ photos: 15% uplift
    (5, 1.0),    # 5+ photos: baseline
    (0, 0.85),   # few photos: 15% discount
)


class EstimateEngineAgent(BaseAgent):
    """Generates preliminary damage range estimates for internal planning."""

    agent_name: str = "estimate_engine"
    requires_approval: bool = True
    llm_provider: str = "groq"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        """Generate a preliminary estimate range from claim data."""
        claim = context.claim
        claim_id = claim.get("id", "unknown")

        # Gather vision insights from stored claimpilot_insights
        vision_data = await self._gather_vision_data(claim_id)

        # Attempt LLM-based estimation first
        estimate = await self._estimate_with_llm(claim, vision_data, context)

        # Fallback to heuristic if LLM failed
        if estimate is None:
            estimate = self._heuristic_estimate(claim, context.photos, vision_data)

        estimate_range = estimate.get("estimate_range", {})
        low = estimate_range.get("low", 0.0)
        high = estimate_range.get("high", 0.0)
        line_items = estimate.get("line_items", [])

        damage_area_count = len(line_items) if line_items else 1

        summary = (
            f"Preliminary estimate range: "
            f"${low:,.0f} - ${high:,.0f} "
            f"(based on {damage_area_count} damage area"
            f"{'s' if damage_area_count != 1 else ''})"
        )

        # Confidence based on data quality
        confidence = self._compute_confidence(
            context.photos, vision_data, estimate.get("methodology", "")
        )

        details = {
            "estimate_range": estimate_range,
            "line_items": line_items,
            "comparable_claims_used": estimate.get("comparable_claims_used", 0),
            "methodology": estimate.get("methodology", "unknown"),
            "disclaimer": DISCLAIMER,
        }

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="estimate",
            summary=summary,
            details=details,
            confidence=round(confidence, 2),
            suggested_actions=[
                "Review and adjust estimate range",
                "Order formal Xactimate estimate",
            ],
            requires_approval=True,
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        """Estimate must have a range and disclaimer."""
        if result.confidence < 0.2:
            return False
        if not result.summary:
            return False
        estimate_range = result.details.get("estimate_range", {})
        if not estimate_range.get("low") and not estimate_range.get("high"):
            return False
        if result.details.get("disclaimer") != DISCLAIMER:
            return False
        return True

    # ------------------------------------------------------------------
    # LLM-based estimation (primary path)
    # ------------------------------------------------------------------

    async def _estimate_with_llm(
        self,
        claim: dict,
        vision_data: list[dict],
        context: AgentContext,
    ) -> dict[str, Any] | None:
        """Generate estimate via LLM. Returns parsed dict or None on failure."""
        claim_type = claim.get("claim_type", claim.get("loss_type", "unknown"))
        property_address = claim.get("property_address", "Unknown")

        # Build damage descriptions from vision data
        damage_descriptions = []
        for insight in vision_data:
            details = insight.get("details", {})
            classifications = details.get("damage_classifications", [])
            for cls in classifications:
                room = cls.get("room", "unknown")
                dmg_type = cls.get("damage_type", "unknown")
                severity = cls.get("severity", 5)
                damage_descriptions.append(
                    f"- {room}: {dmg_type} damage, severity {severity}/10"
                )

        # Count rooms from photos
        room_set: set[str] = set()
        for photo in context.photos:
            room = photo.get("room", "")
            if room:
                room_set.add(room)

        prompt = (
            f"Claim type: {claim_type}\n"
            f"Property: {property_address}\n"
            f"Photos documented: {len(context.photos)}\n"
            f"Rooms with photos: {', '.join(room_set) if room_set else 'unknown'}\n\n"
        )

        if damage_descriptions:
            prompt += "Damage assessment from vision analysis:\n"
            prompt += "\n".join(damage_descriptions) + "\n\n"
        else:
            prompt += "No prior damage assessment available.\n\n"

        prompt += (
            "Provide a preliminary range estimate for this claim. "
            "Include line items for each affected area."
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
                "LLM estimate failed for claim %s: %s -- using heuristic fallback",
                claim.get("id", "unknown"),
                exc,
            )
            return None

    # ------------------------------------------------------------------
    # Heuristic fallback (no LLM)
    # ------------------------------------------------------------------

    def _heuristic_estimate(
        self,
        claim: dict,
        photos: list[dict],
        vision_data: list[dict],
    ) -> dict[str, Any]:
        """Rule-based estimate from claim type, room counts, and photo count."""
        claim_type = (
            claim.get("claim_type", claim.get("loss_type", "unknown"))
        ).lower()

        # Identify affected rooms from photos and vision data
        rooms: set[str] = set()
        for photo in photos:
            room = (photo.get("room") or "").lower()
            if room:
                rooms.add(room)

        for insight in vision_data:
            classifications = insight.get("details", {}).get(
                "damage_classifications", []
            )
            for cls in classifications:
                room = (cls.get("room") or "").lower()
                if room:
                    rooms.add(room)

        # Ensure at least one area
        if not rooms:
            rooms = {"general"}

        # Separate roof from other rooms
        has_roof = "roof" in rooms
        non_roof_rooms = rooms - {"roof"}

        # Calculate per-room costs
        room_range = _ROOM_COST_RANGES.get(claim_type, _DEFAULT_ROOM_RANGE)
        roof_range = _ROOF_COST_RANGES.get(claim_type, _DEFAULT_ROOF_RANGE)

        line_items: list[dict[str, Any]] = []
        total_low = 0.0
        total_high = 0.0

        if has_roof:
            line_items.append({
                "area": "roof",
                "description": f"{claim_type} damage - roof",
                "low": roof_range[0],
                "high": roof_range[1],
            })
            total_low += roof_range[0]
            total_high += roof_range[1]

        for room in sorted(non_roof_rooms):
            line_items.append({
                "area": room,
                "description": f"{claim_type} damage - {room}",
                "low": room_range[0],
                "high": room_range[1],
            })
            total_low += room_range[0]
            total_high += room_range[1]

        # Photo count scaling
        photo_scale = self._photo_scale_factor(len(photos))
        total_low *= photo_scale
        total_high *= photo_scale

        total_mid = (total_low + total_high) / 2.0

        return {
            "estimate_range": {
                "low": round(total_low, 2),
                "mid": round(total_mid, 2),
                "high": round(total_high, 2),
            },
            "line_items": line_items,
            "comparable_claims_used": 0,
            "methodology": "heuristic",
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _gather_vision_data(self, claim_id: str) -> list[dict]:
        """Fetch vision analysis insights from claimpilot_insights."""
        cursor = self._db.claimpilot_insights.find(
            {"claim_id": claim_id, "insight_type": "vision_analysis"},
            {"_id": 0},
        )
        return await cursor.to_list(length=10)

    @staticmethod
    def _photo_scale_factor(photo_count: int) -> float:
        """More photos = more documented damage = higher estimate."""
        for threshold, scale in _PHOTO_SCALE_THRESHOLDS:
            if photo_count >= threshold:
                return scale
        return 0.85

    @staticmethod
    def _compute_confidence(
        photos: list[dict],
        vision_data: list[dict],
        methodology: str,
    ) -> float:
        """Confidence score based on available data quality."""
        base = 0.3

        # Vision data adds confidence
        if vision_data:
            base += 0.2

        # Photos add confidence (up to 0.2)
        photo_boost = min(len(photos) / 20.0, 0.2)
        base += photo_boost

        # LLM methodology is slightly more confident than heuristic
        if methodology == "llm_analysis":
            base += 0.1

        return min(base, 0.85)
