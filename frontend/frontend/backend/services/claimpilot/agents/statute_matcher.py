"""
StatuteMatcher Agent -- Matches FL insurance statutes to claims.

Calculates statutory deadlines, identifies approaching/overdue dates,
and flags potential carrier violations. Read-only; does not require approval.

DISCLAIMER: This is automated statute matching for reference only.
Not legal advice. Consult an attorney for legal questions.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

LEGAL_DISCLAIMER = (
    "This is automated statute matching for reference only. "
    "Not legal advice. Consult an attorney for legal questions."
)

# Days-remaining thresholds for status classification
_APPROACHING_THRESHOLD_DAYS = 14

FL_STATUTE_REFERENCES: dict[str, dict[str, Any]] = {
    "627.70131": {
        "title": "Notice of Claim",
        "summary": "Carrier must acknowledge receipt within 14 days",
        "deadline_days": 14,
        "trigger": "claim_filed",
    },
    "627.70131(5)": {
        "title": "Claim Investigation",
        "summary": "Carrier must begin investigation within 10 days",
        "deadline_days": 10,
        "trigger": "claim_filed",
    },
    "627.70131(7)": {
        "title": "Payment or Denial",
        "summary": "Carrier must pay or deny within 90 days of proof of loss",
        "deadline_days": 90,
        "trigger": "proof_of_loss",
    },
    "626.9541(1)(i)": {
        "title": "Unfair Claim Settlement Practices",
        "summary": "Carrier cannot fail to promptly settle claims when liability is clear",
        "deadline_days": None,
        "trigger": "liability_clear",
    },
    "627.428": {
        "title": "Attorney Fees",
        "summary": "Prevailing insured entitled to attorney fees",
        "deadline_days": None,
        "trigger": "litigation",
    },
}


def _parse_date(value: Any) -> Optional[date]:
    """Extract a date from a string or datetime, returning None on failure."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
                     "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
            try:
                return datetime.strptime(value.replace("Z", "+00:00"), fmt).date()
            except ValueError:
                continue
    return None


def _classify_status(days_remaining: int) -> str:
    """Classify deadline status based on days remaining."""
    if days_remaining <= 0:
        return "overdue"
    if days_remaining <= _APPROACHING_THRESHOLD_DAYS:
        return "approaching"
    return "compliant"


class StatuteMatcherAgent(BaseAgent):
    """Matches FL insurance statutes to a claim and tracks deadlines."""

    agent_name: str = "statute_matcher"
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

        deadlines = self._calculate_deadlines(claim)

        # Attempt LLM-enhanced analysis, fall back to heuristic
        try:
            analysis = await self._match_with_llm(claim, deadlines, context)
        except Exception:
            logger.warning(
                "agent=%s claim=%s LLM match failed, using heuristic",
                self.agent_name,
                claim_id,
            )
            analysis = self._heuristic_match(claim, deadlines)

        matched_statutes = analysis.get("matched_statutes", [])
        violations = analysis.get("violations", [])
        compliance_actions = analysis.get("compliance_actions", [])

        approaching_count = sum(
            1 for d in deadlines if d["status"] == "approaching"
        )
        overdue_count = sum(
            1 for d in deadlines if d["status"] == "overdue"
        )

        summary = (
            f"{len(matched_statutes)} statutes applicable. "
            f"{approaching_count} deadlines approaching. "
            f"{overdue_count} potential violations. "
            f"{LEGAL_DISCLAIMER}"
        )

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="statute_matching",
            summary=summary,
            details={
                "matched_statutes": matched_statutes,
                "deadlines": deadlines,
                "violations": violations,
                "compliance_actions": compliance_actions,
                "disclaimer": LEGAL_DISCLAIMER,
            },
            confidence=0.85,
            requires_approval=self.requires_approval,
        )

    # ------------------------------------------------------------------
    # Deadline calculation
    # ------------------------------------------------------------------

    def _calculate_deadlines(self, claim: dict) -> list[dict[str, Any]]:
        """Calculate deadline status for every statute with a deadline_days."""
        today = date.today()

        loss_date = _parse_date(claim.get("loss_date") or claim.get("date_of_loss"))
        claim_filed_date = _parse_date(
            claim.get("claim_filed_date")
            or claim.get("created_at")
            or claim.get("filed_date")
        )
        proof_of_loss_date = _parse_date(
            claim.get("proof_of_loss_date") or claim.get("pol_date")
        )

        trigger_dates: dict[str, Optional[date]] = {
            "claim_filed": claim_filed_date or loss_date,
            "proof_of_loss": proof_of_loss_date or claim_filed_date or loss_date,
            "liability_clear": None,
            "litigation": None,
        }

        deadlines: list[dict[str, Any]] = []
        for statute_id, statute in FL_STATUTE_REFERENCES.items():
            deadline_days = statute["deadline_days"]
            if deadline_days is None:
                continue

            trigger_date = trigger_dates.get(statute["trigger"])
            if trigger_date is None:
                continue

            deadline_date = trigger_date + timedelta(days=deadline_days)
            days_remaining = (deadline_date - today).days
            status = _classify_status(days_remaining)

            deadlines.append({
                "statute_id": statute_id,
                "title": statute["title"],
                "trigger": statute["trigger"],
                "trigger_date": trigger_date.isoformat(),
                "deadline_date": deadline_date.isoformat(),
                "deadline_days": deadline_days,
                "days_remaining": days_remaining,
                "status": status,
            })

        return deadlines

    # ------------------------------------------------------------------
    # LLM-enhanced matching
    # ------------------------------------------------------------------

    async def _match_with_llm(
        self,
        claim: dict,
        deadlines: list[dict[str, Any]],
        context: AgentContext,
    ) -> dict[str, Any]:
        """Ask LLM for deeper statute analysis with carrier violation detection."""
        claim_summary = (
            f"Claim ID: {claim.get('id', 'unknown')}\n"
            f"Status: {claim.get('status', 'unknown')}\n"
            f"Loss Date: {claim.get('loss_date', claim.get('date_of_loss', 'N/A'))}\n"
            f"Claim Type: {claim.get('claim_type', claim.get('type', 'property'))}\n"
            f"Carrier: {claim.get('carrier', claim.get('insurance_company', 'N/A'))}\n"
        )

        deadline_summary = "\n".join(
            f"- {d['statute_id']} ({d['title']}): {d['status']} "
            f"({d['days_remaining']} days remaining)"
            for d in deadlines
        )

        carrier_comms_summary = ""
        if context.carrier_comms:
            recent = context.carrier_comms[:5]
            carrier_comms_summary = "\nRecent carrier communications:\n" + "\n".join(
                f"- {c.get('date', 'N/A')}: {c.get('summary', c.get('subject', 'N/A'))}"
                for c in recent
            )

        prompt = (
            f"Analyze this FL insurance claim for statute compliance.\n\n"
            f"Claim:\n{claim_summary}\n"
            f"Calculated Deadlines:\n{deadline_summary}\n"
            f"{carrier_comms_summary}\n\n"
            f"Based on FL statutes (627.70131, 626.9541, 627.428), identify:\n"
            f"1. Any additional applicable statutes beyond what's calculated\n"
            f"2. Potential carrier violations based on timeline and communications\n"
            f"3. Recommended compliance actions for the adjuster\n\n"
            f"Respond in this exact format:\n"
            f"VIOLATIONS: <comma-separated list or 'none'>\n"
            f"ACTIONS: <comma-separated list>\n"
        )

        system_prompt = (
            "You are a FL insurance claims statute analyst. "
            "Provide concise, actionable analysis. "
            "Focus on carrier compliance with FL statutes."
        )

        response = await self._llm.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            provider_override=self.llm_provider,
            temperature=0.2,
            max_tokens=1000,
        )

        return self._parse_llm_response(response, claim, deadlines)

    def _parse_llm_response(
        self,
        response: str,
        claim: dict,
        deadlines: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Parse LLM response into structured analysis, falling back to heuristic."""
        violations: list[str] = []
        compliance_actions: list[str] = []

        for line in response.strip().split("\n"):
            line_upper = line.strip().upper()
            if line_upper.startswith("VIOLATIONS:"):
                raw = line.split(":", 1)[1].strip()
                if raw.lower() != "none":
                    violations = [v.strip() for v in raw.split(",") if v.strip()]
            elif line_upper.startswith("ACTIONS:"):
                raw = line.split(":", 1)[1].strip()
                compliance_actions = [a.strip() for a in raw.split(",") if a.strip()]

        # Add overdue deadlines as violations
        for d in deadlines:
            if d["status"] == "overdue":
                violation = (
                    f"Potential violation of FL {d['statute_id']}: "
                    f"{d['title']} — {abs(d['days_remaining'])} days overdue"
                )
                if violation not in violations:
                    violations.append(violation)

        matched_statutes = self._build_matched_statutes(claim, deadlines)

        return {
            "matched_statutes": matched_statutes,
            "violations": violations,
            "compliance_actions": compliance_actions,
        }

    # ------------------------------------------------------------------
    # Heuristic fallback
    # ------------------------------------------------------------------

    def _heuristic_match(
        self,
        claim: dict,
        deadlines: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Return basic statute matches using deadline calculations only."""
        matched_statutes = self._build_matched_statutes(claim, deadlines)

        violations: list[str] = []
        compliance_actions: list[str] = []

        for d in deadlines:
            if d["status"] == "overdue":
                violations.append(
                    f"Potential violation of FL {d['statute_id']}: "
                    f"{d['title']} — {abs(d['days_remaining'])} days overdue"
                )
                compliance_actions.append(
                    f"Document carrier non-compliance with FL {d['statute_id']}"
                )
            elif d["status"] == "approaching":
                compliance_actions.append(
                    f"Monitor FL {d['statute_id']} deadline — "
                    f"{d['days_remaining']} days remaining"
                )

        return {
            "matched_statutes": matched_statutes,
            "violations": violations,
            "compliance_actions": compliance_actions,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_matched_statutes(
        self,
        claim: dict,
        deadlines: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Build the list of matched statutes from reference data + deadlines."""
        deadline_map = {d["statute_id"]: d for d in deadlines}
        matched: list[dict[str, Any]] = []

        is_in_litigation = claim.get("is_in_litigation", False)
        claim_status = (claim.get("status") or "").lower()

        for statute_id, statute in FL_STATUTE_REFERENCES.items():
            entry: dict[str, Any] = {
                "statute_id": statute_id,
                "title": statute["title"],
                "summary": statute["summary"],
                "trigger": statute["trigger"],
                "applicable": False,
            }

            # Determine applicability
            if statute["trigger"] in ("claim_filed", "proof_of_loss"):
                entry["applicable"] = True
            elif statute["trigger"] == "liability_clear":
                entry["applicable"] = claim_status not in ("closed", "archived")
            elif statute["trigger"] == "litigation":
                entry["applicable"] = is_in_litigation is True

            # Attach deadline info if present
            if statute_id in deadline_map:
                entry["deadline"] = deadline_map[statute_id]

            matched.append(entry)

        return matched

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.5 and bool(result.summary)
