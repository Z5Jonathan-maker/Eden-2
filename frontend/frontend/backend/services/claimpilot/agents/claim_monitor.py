"""
ClaimMonitor Agent — Detects stalled claims, deadline risks, and suggests
follow-up actions.

Runs per-claim via execute() or as a batch scan via detect_stalled_claims().
Uses Groq LLM for analysis with heuristic fallback on failure.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

# Days of inactivity before a claim is considered stalled, keyed by status.
STALL_THRESHOLDS: dict[str, int] = {
    "New": 2,
    "In Progress": 5,
    "Under Review": 7,
    "Approved": 3,
    "Denied": 5,
    "Completed": 10,
}

ACTIVE_STATUSES: set[str] = {
    "New",
    "In Progress",
    "Under Review",
    "Approved",
    "Denied",
    "Completed",
}

SYSTEM_PROMPT = (
    "You are a senior public adjuster analyzing insurance claims for "
    "Care Claims in Florida. Identify why a claim may be stalled and "
    "recommend concrete next steps. Respond ONLY with valid JSON: "
    '{"summary": "...", "suggested_actions": ["...", "..."], "risk_level": "..."}'
)


def _parse_updated_at(value: Any) -> datetime:
    """Parse updated_at from ISO string or datetime, always timezone-aware."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _heuristic_fallback(
    claim: dict, days_idle: int, status: str
) -> dict[str, Any]:
    """Non-LLM fallback when the LLM is unavailable or returns bad JSON."""
    actions: list[str] = []
    risk = "medium"

    if status == "New" and days_idle > 3:
        actions.append("Assign claim to an adjuster immediately")
        risk = "high"
    elif status == "In Progress":
        actions.append("Contact adjuster for status update")
        actions.append("Check for missing documentation")
    elif status == "Under Review":
        actions.append("Follow up with carrier on review status")
    elif status == "Approved":
        actions.append("Initiate settlement paperwork")
        risk = "high"
    elif status == "Denied":
        actions.append("Review denial reason and consider appeal")
        actions.append("Notify client of denial and options")
    else:
        actions.append("Review claim and update status")

    return {
        "summary": (
            f"Claim {claim.get('claim_number', 'unknown')} has been idle "
            f"for {days_idle} days in '{status}' status."
        ),
        "suggested_actions": actions,
        "risk_level": risk,
    }


class ClaimMonitorAgent(BaseAgent):
    """Detects stalled claims and recommends follow-up actions."""

    agent_name: str = "claim_monitor"
    requires_approval: bool = True
    llm_provider: str = "groq"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution (called by BaseAgent.run)
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        claim = context.claim
        claim_id = claim.get("id", "unknown")
        status = claim.get("status", "")
        updated_at = _parse_updated_at(claim.get("updated_at", datetime.now(timezone.utc)))

        now = datetime.now(timezone.utc)
        days_idle = (now - updated_at).days
        threshold = STALL_THRESHOLDS.get(status)

        # Not a tracked status or not stalled yet
        if threshold is None or days_idle < threshold:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=claim_id,
                insight_type="monitoring",
                summary=f"Claim {claim.get('claim_number', claim_id)} is active — {days_idle}d since last update.",
                confidence=0.95,
                requires_approval=self.requires_approval,
            )

        # Stalled — get LLM analysis (or heuristic fallback)
        analysis = await self._analyze_with_llm(claim, days_idle, context)

        # Confidence scales with how far past the threshold
        overage_ratio = min(days_idle / max(threshold, 1), 3.0)
        confidence = min(0.6 + (overage_ratio - 1.0) * 0.15, 0.99)

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="stall_detection",
            summary=analysis.get("summary", ""),
            details={"risk_level": analysis.get("risk_level", "medium"), "days_idle": days_idle},
            confidence=round(confidence, 2),
            suggested_actions=analysis.get("suggested_actions", []),
            requires_approval=self.requires_approval,
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.5 and bool(result.summary)

    # ------------------------------------------------------------------
    # Batch scan (used by scheduled worker)
    # ------------------------------------------------------------------

    async def detect_stalled_claims(self) -> list[dict]:
        """Scan all active claims and return those that are stalled."""
        now = datetime.now(timezone.utc)
        stalled: list[dict] = []

        for status in ACTIVE_STATUSES:
            threshold = STALL_THRESHOLDS[status]
            cutoff = now - timedelta(days=threshold)

            cursor = self._db.claims.find({"status": status})
            claims = await cursor.to_list(length=1000)

            for claim in claims:
                updated_at = _parse_updated_at(
                    claim.get("updated_at", claim.get("created_at", now))
                )
                if updated_at < cutoff:
                    days_idle = (now - updated_at).days
                    stalled.append({
                        "claim_id": claim.get("id", "unknown"),
                        "claim_number": claim.get("claim_number", ""),
                        "status": status,
                        "days_idle": days_idle,
                        "threshold": threshold,
                        "updated_at": updated_at.isoformat(),
                    })

        return stalled

    # ------------------------------------------------------------------
    # LLM analysis with fallback
    # ------------------------------------------------------------------

    async def _analyze_with_llm(
        self, claim: dict, days_idle: int, context: AgentContext
    ) -> dict[str, Any]:
        """Ask the LLM for analysis; fall back to heuristics on failure."""
        status = claim.get("status", "unknown")
        prompt = (
            f"Claim #{claim.get('claim_number', 'N/A')} is in '{status}' "
            f"status and has been idle for {days_idle} days "
            f"(threshold: {STALL_THRESHOLDS.get(status, '?')} days).\n"
            f"Property: {claim.get('property_address', 'N/A')}\n"
            f"Type: {claim.get('claim_type', 'N/A')}\n"
            f"Analyze the stall and provide actionable recommendations."
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
                "LLM analysis failed for claim %s: %s — using heuristic fallback",
                claim.get("id", "unknown"),
                exc,
            )
            return _heuristic_fallback(claim, days_idle, status)
