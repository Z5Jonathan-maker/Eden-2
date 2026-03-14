"""
EvidenceScorer Agent -- Scores evidence completeness for a claim.

Evaluates what documentation exists across four categories (property, damage,
communication, financial) and produces a weighted overall score with gap analysis.
Read-only; does not require approval.
"""

from __future__ import annotations

import logging
from typing import Any

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent

logger = logging.getLogger(__name__)

EVIDENCE_CATEGORIES: dict[str, dict[str, Any]] = {
    "property_documentation": {
        "weight": 0.25,
        "items": [
            "policy_document",
            "property_deed",
            "property_photos",
            "aerial_imagery",
        ],
    },
    "damage_documentation": {
        "weight": 0.35,
        "items": [
            "damage_photos",
            "expert_reports",
            "contractor_estimates",
            "inspection_report",
        ],
    },
    "communication_records": {
        "weight": 0.20,
        "items": [
            "carrier_correspondence",
            "adjuster_notes",
            "call_transcripts",
            "email_records",
        ],
    },
    "financial_records": {
        "weight": 0.20,
        "items": [
            "receipts",
            "invoices",
            "prior_claims",
            "loss_inventory",
        ],
    },
}

# Priority order for gap items (higher = more important to gather first)
_GAP_PRIORITY: dict[str, str] = {
    "damage_photos": "high",
    "inspection_report": "high",
    "policy_document": "high",
    "carrier_correspondence": "high",
    "contractor_estimates": "high",
    "expert_reports": "medium",
    "property_photos": "medium",
    "adjuster_notes": "medium",
    "email_records": "medium",
    "receipts": "medium",
    "invoices": "medium",
    "property_deed": "low",
    "aerial_imagery": "low",
    "call_transcripts": "low",
    "prior_claims": "low",
    "loss_inventory": "low",
}

# Readiness thresholds
_READY_THRESHOLD = 80.0
_NEEDS_WORK_THRESHOLD = 50.0


def _extract_present_items(context: AgentContext) -> set[str]:
    """Scan all context fields and return the set of evidence item keys present."""
    present: set[str] = set()

    # --- Photos ---
    if context.photos:
        for photo in context.photos:
            tags = photo.get("tags", [])
            category = photo.get("category", "")
            label = photo.get("label", "")
            combined = " ".join([category, label, *tags]).lower()

            if any(kw in combined for kw in ("damage", "loss", "broken", "destroyed")):
                present.add("damage_photos")
            if any(kw in combined for kw in ("property", "exterior", "interior", "overview")):
                present.add("property_photos")

        # If we have photos but couldn't classify, default to property_photos
        if not (present & {"damage_photos", "property_photos"}):
            present.add("property_photos")

    # --- Evidence documents ---
    if context.evidence:
        for doc in context.evidence:
            doc_type = doc.get("type", "").lower()
            doc_tags = [t.lower() for t in doc.get("tags", [])]
            doc_name = doc.get("name", "").lower()
            combined = " ".join([doc_type, doc_name, *doc_tags])

            _EVIDENCE_MAP: dict[str, list[str]] = {
                "policy_document": ["policy", "declaration", "dec page"],
                "property_deed": ["deed", "title"],
                "aerial_imagery": ["aerial", "satellite", "drone"],
                "expert_reports": ["expert", "engineer", "specialist"],
                "contractor_estimates": ["contractor", "estimate", "bid", "quote"],
                "inspection_report": ["inspection", "report"],
                "receipts": ["receipt"],
                "invoices": ["invoice"],
                "prior_claims": ["prior claim", "previous claim", "history"],
                "loss_inventory": ["inventory", "contents", "loss list"],
                "call_transcripts": ["transcript", "call log", "recording"],
            }

            for item_key, keywords in _EVIDENCE_MAP.items():
                if any(kw in combined for kw in keywords):
                    present.add(item_key)

    # --- Notes ---
    if context.notes:
        present.add("adjuster_notes")

    # --- Carrier comms ---
    if context.carrier_comms:
        for comm in context.carrier_comms:
            channel = comm.get("channel", "").lower()
            if channel == "email":
                present.add("email_records")
            present.add("carrier_correspondence")

    return present


class EvidenceScorerAgent(BaseAgent):
    """Scores evidence completeness and identifies documentation gaps."""

    agent_name: str = "evidence_scorer"
    requires_approval: bool = False
    llm_provider: str = "gemini_flash"

    def __init__(self, db: Any) -> None:
        super().__init__(db)

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        claim_id = context.claim.get("id", "unknown")
        present_items = _extract_present_items(context)

        # Score each category
        categories_result: dict[str, dict[str, Any]] = {}
        weighted_total = 0.0

        for cat_name, cat_config in EVIDENCE_CATEGORIES.items():
            cat_score = self._score_category(cat_name, cat_config, present_items)
            categories_result[cat_name] = cat_score
            weighted_total += cat_score["score"] * cat_config["weight"]

        overall_score = round(weighted_total, 1)
        readiness = self._determine_readiness(overall_score)

        # Build gaps list (missing items with priority)
        gaps = self._identify_gaps(categories_result)

        # Category scores for summary
        prop_score = categories_result["property_documentation"]["score"]
        dmg_score = categories_result["damage_documentation"]["score"]
        comm_score = categories_result["communication_records"]["score"]
        fin_score = categories_result["financial_records"]["score"]

        summary = (
            f"Evidence completeness: {overall_score}% "
            f"(property {prop_score}%, damage {dmg_score}%, "
            f"comms {comm_score}%, financial {fin_score}%)"
        )

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="evidence_scoring",
            summary=summary,
            details={
                "overall_score": overall_score,
                "categories": categories_result,
                "gaps": gaps,
                "readiness": readiness,
            },
            confidence=0.9,
            requires_approval=self.requires_approval,
        )

    # ------------------------------------------------------------------
    # Category scoring
    # ------------------------------------------------------------------

    def _score_category(
        self,
        category_name: str,
        category_config: dict[str, Any],
        present_items: set[str],
    ) -> dict[str, Any]:
        """Check which items from a category are present and compute score."""
        required = category_config["items"]
        found = [item for item in required if item in present_items]
        missing = [item for item in required if item not in present_items]
        score = round((len(found) / len(required)) * 100, 1) if required else 0.0

        return {
            "score": score,
            "present": found,
            "missing": missing,
        }

    # ------------------------------------------------------------------
    # Readiness determination
    # ------------------------------------------------------------------

    @staticmethod
    def _determine_readiness(overall_score: float) -> str:
        """Map overall score to readiness label."""
        if overall_score >= _READY_THRESHOLD:
            return "ready"
        if overall_score >= _NEEDS_WORK_THRESHOLD:
            return "needs_work"
        return "insufficient"

    # ------------------------------------------------------------------
    # Gap identification
    # ------------------------------------------------------------------

    @staticmethod
    def _identify_gaps(
        categories_result: dict[str, dict[str, Any]],
    ) -> list[dict[str, str]]:
        """Build a prioritized list of missing evidence items."""
        gaps: list[dict[str, str]] = []
        for cat_name, cat_data in categories_result.items():
            for item in cat_data["missing"]:
                gaps.append({
                    "item": item,
                    "category": cat_name,
                    "priority": _GAP_PRIORITY.get(item, "low"),
                })
        # Sort: high > medium > low
        priority_order = {"high": 0, "medium": 1, "low": 2}
        gaps.sort(key=lambda g: priority_order.get(g["priority"], 3))
        return gaps

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_output(self, result: AgentResult) -> bool:
        return result.confidence >= 0.5 and "overall_score" in result.details
