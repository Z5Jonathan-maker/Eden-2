"""
IntakeParser Agent — Extracts missing intake fields from claim context
(notes, activity, evidence) using LLM with regex heuristic fallback.

Fields tracked: client_name, client_email, client_phone, property_address,
loss_date, claim_type, carrier, policy_number.
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

INTAKE_FIELDS: tuple[str, ...] = (
    "client_name",
    "client_email",
    "client_phone",
    "property_address",
    "loss_date",
    "claim_type",
    "carrier",
    "policy_number",
)

SYSTEM_PROMPT = (
    "You are an insurance claims data extraction assistant for Care Claims "
    "in Florida. Given unstructured text from claim notes, activity logs, "
    "and evidence summaries, extract the requested fields.\n\n"
    "Respond ONLY with valid JSON in this exact format:\n"
    '{"extracted_fields": {"field_name": {"value": "...", '
    '"confidence": 0.0, "source": "..."}}}\n\n'
    "Rules:\n"
    "- Only include fields you can confidently extract\n"
    "- Confidence: 0.0-1.0 (1.0 = exact match, 0.7+ = high confidence)\n"
    "- Source: brief description of where you found the value\n"
    "- Do NOT fabricate values — only extract what exists in the text"
)

# Heuristic regex patterns
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
)
_FL_ADDRESS_RE = re.compile(
    r"\d+\s+[\w\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Ct|Way|Pl|Cir)"
    r"[.,]?\s+[\w\s]+,?\s+FL\s+\d{5}",
    re.IGNORECASE,
)
_DATE_RE = re.compile(
    r"(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
    r"|(?:\d{4}[/-]\d{1,2}[/-]\d{1,2})"
    r"|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"[a-z]*\.?\s+\d{1,2},?\s+\d{4})",
    re.IGNORECASE,
)


class IntakeParserAgent(BaseAgent):
    """Extracts missing intake fields from claim context."""

    agent_name: str = "intake_parser"
    requires_approval: bool = True
    llm_provider: str = "gemini_flash"

    def __init__(self, db: Any) -> None:
        super().__init__(db)
        self._llm = LLMRouter()

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        claim = context.claim
        claim_id = claim.get("id", "unknown")

        # Identify missing/empty fields
        missing_fields = [
            f for f in INTAKE_FIELDS
            if not claim.get(f)
        ]

        # All populated — nothing to do
        if not missing_fields:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=claim_id,
                insight_type="intake_parsing",
                summary="All intake fields populated",
                confidence=1.0,
                requires_approval=False,
            )

        # Gather text sources
        text_sources = self._gather_text_sources(context)

        # Extract via LLM (falls back to heuristic)
        extracted = await self._parse_with_llm(
            claim, text_sources, missing_fields
        )

        found_count = len(extracted.get("extracted_fields", {}))
        total_missing = len(missing_fields)

        # Fields still missing after extraction
        still_missing = [
            f for f in missing_fields
            if f not in extracted.get("extracted_fields", {})
        ]

        # Suggested actions for fields we found
        suggested_actions = [
            f"Update {field} to \"{info['value']}\""
            for field, info in extracted.get("extracted_fields", {}).items()
        ]

        # Confidence = average of extracted field confidences, or 0.3 if none
        confidences = [
            info.get("confidence", 0.5)
            for info in extracted.get("extracted_fields", {}).values()
        ]
        avg_confidence = (
            sum(confidences) / len(confidences) if confidences else 0.3
        )

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="intake_parsing",
            summary=f"Found {found_count} of {total_missing} missing fields from claim context",
            details={
                "extracted_fields": extracted.get("extracted_fields", {}),
                "missing_fields": still_missing,
                "source_count": len(text_sources),
            },
            confidence=round(avg_confidence, 2),
            suggested_actions=suggested_actions,
            requires_approval=True,
        )

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.4 and bool(result.summary)

    # ------------------------------------------------------------------
    # Text source gathering
    # ------------------------------------------------------------------

    @staticmethod
    def _gather_text_sources(context: AgentContext) -> list[str]:
        """Collect all available text from notes, activity, evidence."""
        sources: list[str] = []

        for note in context.notes:
            text = note.get("content") or note.get("text") or ""
            if text.strip():
                sources.append(text.strip())

        for activity in context.recent_activity:
            desc = activity.get("description") or ""
            if desc.strip():
                sources.append(desc.strip())

        for item in context.evidence:
            summary = item.get("summary") or item.get("description") or ""
            if summary.strip():
                sources.append(summary.strip())

        return sources

    # ------------------------------------------------------------------
    # LLM-based extraction
    # ------------------------------------------------------------------

    async def _parse_with_llm(
        self,
        claim: dict,
        text_sources: list[str],
        missing_fields: list[str],
    ) -> dict[str, Any]:
        """Ask LLM to extract missing fields; fall back to heuristic."""
        combined_text = "\n---\n".join(text_sources)

        prompt = (
            f"Claim #{claim.get('claim_number', 'N/A')}\n"
            f"Current data: {json.dumps({f: claim.get(f, '') for f in INTAKE_FIELDS})}\n\n"
            f"Missing fields to extract: {', '.join(missing_fields)}\n\n"
            f"Text sources:\n{combined_text}\n\n"
            f"Extract the missing fields from the text above."
        )

        try:
            raw = await self._llm.generate(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                provider_override=self.llm_provider,
                task_type="structured_extraction",
            )
            parsed = json.loads(raw)
            # Validate structure
            if "extracted_fields" not in parsed:
                raise ValueError("Missing 'extracted_fields' key in response")
            return parsed
        except Exception as exc:
            logger.warning(
                "LLM parsing failed for claim %s: %s — using heuristic fallback",
                claim.get("id", "unknown"),
                exc,
            )
            return self._heuristic_parse(claim, text_sources, missing_fields)

    # ------------------------------------------------------------------
    # Heuristic fallback (regex-based)
    # ------------------------------------------------------------------

    @staticmethod
    def _heuristic_parse(
        claim: dict,
        text_sources: list[str],
        missing_fields: list[str],
    ) -> dict[str, Any]:
        """Extract fields using regex patterns — lower confidence."""
        combined = " ".join(text_sources)
        extracted: dict[str, dict[str, Any]] = {}

        field_extractors: dict[str, tuple[re.Pattern, float]] = {
            "client_email": (_EMAIL_RE, 0.6),
            "client_phone": (_PHONE_RE, 0.5),
            "property_address": (_FL_ADDRESS_RE, 0.4),
            "loss_date": (_DATE_RE, 0.4),
        }

        for field in missing_fields:
            extractor = field_extractors.get(field)
            if extractor is None:
                continue

            pattern, confidence = extractor
            match = pattern.search(combined)
            if match:
                extracted[field] = {
                    "value": match.group(0).strip(),
                    "confidence": confidence,
                    "source": "heuristic_regex",
                }

        return {"extracted_fields": extracted}
