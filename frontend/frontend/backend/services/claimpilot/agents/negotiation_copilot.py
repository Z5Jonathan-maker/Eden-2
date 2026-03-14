"""
NegotiationCopilot Agent -- Analyzes carrier communications and recommends
negotiation strategies for insurance claim settlements.

Requires human approval since it drafts communication responses.
Uses LLM for strategy analysis with heuristic fallback.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior public adjuster with 20 years experience negotiating "
    "with insurance carriers in Florida. Analyze the carrier's position and "
    "recommend a negotiation strategy."
)

DEFAULT_COUNTER_MULTIPLIER = 1.5
HEURISTIC_CONFIDENCE = 0.65
LLM_CONFIDENCE = 0.85


def _extract_dollar_amounts(text: str) -> list[float]:
    """Find all dollar amounts in text, returning as floats."""
    pattern = r"\$\s*([\d,]+(?:\.\d{2})?)"
    matches = re.findall(pattern, text)
    return [float(m.replace(",", "")) for m in matches]


def _detect_denial_keywords(text: str) -> bool:
    """Return True if the text contains denial-related keywords."""
    denial_terms = frozenset({
        "denied", "denial", "reject", "rejected", "not covered",
        "exclusion", "decline", "declined",
    })
    lower = text.lower()
    return any(term in lower for term in denial_terms)


class NegotiationCopilotAgent(BaseAgent):
    """Analyzes carrier comms and recommends negotiation strategy."""

    agent_name: str = "negotiation_copilot"
    requires_approval: bool = True
    llm_provider: str = "gemini_flash"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        claim_id = context.claim.get("id", "unknown")
        carrier_comms = context.carrier_comms

        if not carrier_comms:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=claim_id,
                insight_type="negotiation_analysis",
                summary="No carrier communications to analyze",
                details={},
                confidence=1.0,
                requires_approval=False,
            )

        analysis = await self._analyze_with_llm(
            context.claim, carrier_comms, context
        )

        summary = (
            f"Carrier position: {analysis['carrier_position']}. "
            f"Strategy: {analysis.get('strategy', 'counter-offer')}."
        )

        suggested_actions = []
        if analysis.get("recommended_response"):
            suggested_actions.append(analysis["recommended_response"])
        for arg in analysis.get("counter_arguments", []):
            suggested_actions.append(f"Counter: {arg}")

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="negotiation_analysis",
            summary=summary,
            details={
                "carrier_position": analysis["carrier_position"],
                "leverage_points": analysis.get("leverage_points", []),
                "settlement_range": analysis.get("settlement_range", {}),
                "risk_assessment": analysis.get("risk_assessment", ""),
                "counter_arguments": analysis.get("counter_arguments", []),
            },
            confidence=analysis.get("_confidence", LLM_CONFIDENCE),
            suggested_actions=suggested_actions,
            requires_approval=True,
        )

    # ------------------------------------------------------------------
    # LLM-powered analysis
    # ------------------------------------------------------------------

    async def _analyze_with_llm(
        self,
        claim: dict,
        carrier_comms: list[dict],
        context: AgentContext,
    ) -> dict[str, Any]:
        """Use LLM to produce structured negotiation analysis."""
        comms_text = "\n".join(
            f"[{c.get('direction', 'unknown')}] {c.get('body', '')}"
            for c in carrier_comms
        )

        estimates_info = ""
        if context.evidence:
            estimate_docs = [
                e for e in context.evidence
                if "estimate" in e.get("type", "").lower()
                or "estimate" in e.get("name", "").lower()
            ]
            if estimate_docs:
                estimates_info = (
                    f"\nEstimate documents on file: {len(estimate_docs)}"
                )

        prompt = (
            f"Claim details:\n"
            f"  ID: {claim.get('id', 'unknown')}\n"
            f"  Status: {claim.get('status', 'unknown')}\n"
            f"  Property: {claim.get('property_address', 'N/A')}\n"
            f"{estimates_info}\n\n"
            f"Carrier communication history:\n{comms_text}\n\n"
            f"Analyze and respond with JSON only:\n"
            f'{{"carrier_position": "...", "leverage_points": [...], '
            f'"settlement_range": {{"low": N, "mid": N, "high": N}}, '
            f'"risk_assessment": "...", "counter_arguments": [...], '
            f'"recommended_response": "...", "strategy": "..."}}'
        )

        try:
            raw = await self._llm.generate(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                task_type="text_generation",
                provider_override=self.llm_provider,
            )
            parsed = self._parse_llm_response(raw)
            parsed["_confidence"] = LLM_CONFIDENCE
            return parsed
        except Exception:
            logger.warning(
                "LLM analysis failed for claim=%s, falling back to heuristics",
                claim.get("id", "unknown"),
                exc_info=True,
            )
            return self._heuristic_analysis(claim, carrier_comms)

    @staticmethod
    def _parse_llm_response(raw: str) -> dict[str, Any]:
        """Extract JSON from LLM response text."""
        # Try to find JSON block in response
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            return json.loads(json_match.group())
        raise ValueError("No JSON found in LLM response")

    # ------------------------------------------------------------------
    # Heuristic fallback (no LLM)
    # ------------------------------------------------------------------

    def _heuristic_analysis(
        self, claim: dict, carrier_comms: list[dict]
    ) -> dict[str, Any]:
        """Rule-based analysis when LLM is unavailable."""
        all_bodies = " ".join(c.get("body", "") for c in carrier_comms)
        msg_count = len(carrier_comms)
        amounts = _extract_dollar_amounts(all_bodies)
        has_denial = _detect_denial_keywords(all_bodies)

        # Determine carrier position
        if has_denial:
            carrier_position = "Carrier has denied or rejected the claim"
            strategy = "escalation"
            risk_assessment = (
                "High risk -- denial requires formal appeal or appraisal"
            )
            leverage_points = [
                "Policy language supporting coverage",
                "Documented evidence of covered loss",
                "Florida bad faith statutes",
            ]
            counter_arguments = [
                "Request formal written denial with specific policy references",
                "Cite Florida Statute 624.155 (bad faith)",
                "Demand re-inspection with independent adjuster",
            ]
            recommended_response = (
                "Send formal dispute letter citing policy coverage provisions "
                "and request written explanation of denial basis"
            )
            if amounts:
                offer = max(amounts)
                settlement_range = {
                    "low": offer,
                    "mid": offer * DEFAULT_COUNTER_MULTIPLIER,
                    "high": offer * 2.0,
                }
            else:
                settlement_range = {"low": 0.0, "mid": 0.0, "high": 0.0}
        elif amounts:
            offer = max(amounts)
            carrier_position = f"Carrier has offered ${offer:,.2f}"
            strategy = "counter-offer"
            risk_assessment = (
                "Moderate risk -- carrier engaged, counter-offer likely"
            )
            counter_value = offer * DEFAULT_COUNTER_MULTIPLIER
            leverage_points = [
                "Carrier has acknowledged liability by making an offer",
                f"Current offer of ${offer:,.2f} likely undervalues claim",
                "Independent estimates can support higher valuation",
            ]
            counter_arguments = [
                f"Counter at ${counter_value:,.2f} based on independent assessment",
                "Request line-item comparison of carrier estimate vs actual costs",
                "Provide supplemental documentation for disputed items",
            ]
            recommended_response = (
                f"Submit counter-offer at ${counter_value:,.2f} with "
                f"supporting documentation and line-item justification"
            )
            settlement_range = {
                "low": offer,
                "mid": counter_value,
                "high": offer * 2.0,
            }
        else:
            carrier_position = (
                f"Carrier is engaged ({msg_count} messages) but no offer yet"
            )
            strategy = "information-gathering"
            risk_assessment = "Low risk -- still in initial communication phase"
            leverage_points = [
                "Early stage allows for strong evidence preparation",
                "Document all communications for potential bad faith claim",
            ]
            counter_arguments = [
                "Request carrier's timeline for claim resolution",
                "Proactively submit all supporting documentation",
            ]
            recommended_response = (
                "Send comprehensive demand package with all evidence and "
                "estimated damages to advance the negotiation"
            )
            settlement_range = {"low": 0.0, "mid": 0.0, "high": 0.0}

        return {
            "carrier_position": carrier_position,
            "leverage_points": leverage_points,
            "settlement_range": settlement_range,
            "risk_assessment": risk_assessment,
            "counter_arguments": counter_arguments,
            "recommended_response": recommended_response,
            "strategy": strategy,
            "_confidence": HEURISTIC_CONFIDENCE,
        }

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.5 and bool(result.summary)
