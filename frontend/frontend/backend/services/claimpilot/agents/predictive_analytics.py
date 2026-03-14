"""
PredictiveAnalytics Agent -- Predicts settlement ranges, litigation risk,
and timeline for insurance claims.

Uses LLM-based prediction with heuristic fallback. Read-only; does not
require approval.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Heuristic lookup tables keyed by claim type
# ---------------------------------------------------------------------------

_CLAIM_TYPE_HEURISTICS: dict[str, dict[str, Any]] = {
    "wind": {
        "settlement_range": {"p10": 8_000.0, "p50": 25_000.0, "p90": 60_000.0},
        "litigation_probability": 25.0,
        "timeline_months": 4,
    },
    "hurricane": {
        "settlement_range": {"p10": 8_000.0, "p50": 25_000.0, "p90": 60_000.0},
        "litigation_probability": 25.0,
        "timeline_months": 4,
    },
    "water": {
        "settlement_range": {"p10": 5_000.0, "p50": 15_000.0, "p90": 40_000.0},
        "litigation_probability": 20.0,
        "timeline_months": 3,
    },
    "fire": {
        "settlement_range": {"p10": 20_000.0, "p50": 50_000.0, "p90": 120_000.0},
        "litigation_probability": 30.0,
        "timeline_months": 6,
    },
    "hail": {
        "settlement_range": {"p10": 3_000.0, "p50": 10_000.0, "p90": 25_000.0},
        "litigation_probability": 15.0,
        "timeline_months": 3,
    },
}

_DEFAULT_HEURISTIC: dict[str, Any] = {
    "settlement_range": {"p10": 5_000.0, "p50": 20_000.0, "p90": 50_000.0},
    "litigation_probability": 20.0,
    "timeline_months": 4,
}

_SYSTEM_PROMPT = (
    "You are a data analyst for a public adjusting firm in Florida. "
    "Based on the claim profile, predict likely outcomes. "
    "Respond ONLY with valid JSON — no markdown, no explanation."
)

_USER_PROMPT_TEMPLATE = (
    "Claim profile:\n"
    "- Type: {claim_type}\n"
    "- Carrier: {carrier}\n"
    "- Damage severity: {damage_severity}\n"
    "- Region: {region}\n"
    "- Claim age (days): {age_days}\n\n"
    "Predict the following as JSON:\n"
    '{{"settlement_range": {{"p10": <float>, "p50": <float>, "p90": <float>}}, '
    '"litigation_probability": <float 0-100>, '
    '"timeline_months": <int>, '
    '"carrier_behavior": "<fast_settler|normal|aggressive_denier|litigious>", '
    '"recommended_strategy": "<string>"}}'
)

_PREDICTION_CONFIDENCE = 0.6


class PredictiveAnalyticsAgent(BaseAgent):
    """Predicts settlement ranges, litigation risk, and timelines."""

    agent_name: str = "predictive_analytics"
    requires_approval: bool = False
    llm_provider: str = "groq"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        claim = context.claim
        claim_id = claim.get("id", "unknown")

        profile = self._extract_profile(claim, context)

        try:
            prediction = await self._predict_with_llm(claim, profile)
        except Exception as exc:
            logger.warning(
                "LLM prediction failed for claim=%s: %s — using heuristic",
                claim_id,
                exc,
            )
            prediction = self._heuristic_prediction(claim)

        sr = prediction["settlement_range"]
        lit = prediction["litigation_probability"]
        timeline = prediction["timeline_months"]

        summary = (
            f"Settlement range: ${sr['p10']:,.0f}-${sr['p90']:,.0f}. "
            f"Litigation risk: {lit:.0f}%. "
            f"Est. timeline: {timeline} months."
        )

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="prediction",
            summary=summary,
            details=prediction,
            confidence=_PREDICTION_CONFIDENCE,
            requires_approval=self.requires_approval,
        )

    # ------------------------------------------------------------------
    # Profile extraction
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_profile(claim: dict, context: AgentContext) -> dict[str, Any]:
        """Pull claim type, carrier, severity, region, and age from context."""
        claim_type = claim.get("claim_type", claim.get("type", "unknown"))
        carrier = claim.get("carrier", claim.get("insurance_company", "unknown"))
        region = claim.get("region", claim.get("state", "FL"))

        # Damage severity from vision insights if available
        damage_severity = "unknown"
        for photo in context.photos:
            sev = photo.get("severity") or photo.get("damage_severity")
            if sev:
                damage_severity = sev
                break

        # Claim age in days
        age_days = 0
        created = claim.get("created_at") or claim.get("date_of_loss")
        if isinstance(created, str):
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                from datetime import timezone

                age_days = (datetime.now(timezone.utc) - dt).days
            except (ValueError, TypeError):
                pass
        elif isinstance(created, datetime):
            from datetime import timezone

            age_days = (datetime.now(timezone.utc) - created).days

        return {
            "claim_type": claim_type,
            "carrier": carrier,
            "damage_severity": damage_severity,
            "region": region,
            "age_days": age_days,
        }

    # ------------------------------------------------------------------
    # LLM-based prediction
    # ------------------------------------------------------------------

    async def _predict_with_llm(
        self, claim: dict, profile: dict[str, Any]
    ) -> dict[str, Any]:
        """Ask the LLM for a structured prediction; fall back to heuristic on failure."""
        user_prompt = _USER_PROMPT_TEMPLATE.format(**profile)

        raw = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=_SYSTEM_PROMPT,
            provider_override=self.llm_provider,
        )

        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        parsed = json.loads(cleaned)

        # Validate required keys
        required_keys = {
            "settlement_range",
            "litigation_probability",
            "timeline_months",
            "carrier_behavior",
            "recommended_strategy",
        }
        if not required_keys.issubset(parsed.keys()):
            missing = required_keys - set(parsed.keys())
            raise ValueError(f"LLM response missing keys: {missing}")

        sr = parsed["settlement_range"]
        if not all(k in sr for k in ("p10", "p50", "p90")):
            raise ValueError("settlement_range missing percentile keys")

        # Coerce types
        return {
            "settlement_range": {
                "p10": float(sr["p10"]),
                "p50": float(sr["p50"]),
                "p90": float(sr["p90"]),
            },
            "litigation_probability": float(parsed["litigation_probability"]),
            "timeline_months": int(parsed["timeline_months"]),
            "carrier_behavior": str(parsed["carrier_behavior"]),
            "recommended_strategy": str(parsed["recommended_strategy"]),
        }

    # ------------------------------------------------------------------
    # Heuristic fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _heuristic_prediction(claim: dict) -> dict[str, Any]:
        """Rule-based prediction when no LLM is available."""
        raw_type = claim.get("claim_type", claim.get("type", "")).lower().strip()
        heuristic = _CLAIM_TYPE_HEURISTICS.get(raw_type, _DEFAULT_HEURISTIC)

        return {
            "settlement_range": dict(heuristic["settlement_range"]),
            "litigation_probability": heuristic["litigation_probability"],
            "timeline_months": heuristic["timeline_months"],
            "carrier_behavior": "normal",
            "recommended_strategy": (
                "Gather complete documentation and submit a well-supported demand."
            ),
        }

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.3 and "settlement_range" in result.details
