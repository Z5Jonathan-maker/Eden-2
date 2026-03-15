"""
Gamma Client — Handles Gamma API v1.0 for presentation generation

Primary job: Generate presentations from claim/inspection data.
Includes client status report generation with FL statute compliance.

Uses API key from GAMMA_API_KEY environment variable.
API docs: https://developers.gamma.app
Base URL: https://public-api.gamma.app/v1.0
Auth: X-API-KEY header
"""

from typing import Optional, List
import os
import logging
import asyncio
from datetime import datetime, timedelta
import httpx

logger = logging.getLogger(__name__)

# Gamma API v1.0
GAMMA_API_URL = "https://public-api.gamma.app/v1.0"
GAMMA_POLL_INTERVAL = 10   # seconds
GAMMA_POLL_MAX_WAIT = 180  # seconds


class GammaClient:
    """
    Gamma integration client for presentation generation.
    All Gamma API calls go through this class.
    """

    def __init__(self):
        self.api_key = os.environ.get("GAMMA_API_KEY") or os.environ.get("GAMMA_API_TOKEN")
        self._headers = {
            "X-API-KEY": self.api_key or "",
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _poll_generation(self, generation_id: str) -> dict:
        """Poll until generation completes or times out."""
        elapsed = 0
        async with httpx.AsyncClient(timeout=30) as client:
            while elapsed < GAMMA_POLL_MAX_WAIT:
                await asyncio.sleep(GAMMA_POLL_INTERVAL)
                elapsed += GAMMA_POLL_INTERVAL
                try:
                    resp = await client.get(
                        f"{GAMMA_API_URL}/generations/{generation_id}",
                        headers=self._headers,
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    if data.get("status") == "completed":
                        return data
                    elif data.get("status") in ("failed", "error"):
                        return {"error": True, "message": data.get("message", "Generation failed")}
                except httpx.RequestError:
                    continue

        return {"error": True, "message": f"Generation timed out after {GAMMA_POLL_MAX_WAIT}s"}

    async def create_presentation(
        self,
        title: str,
        content: str,
        template: str = "professional",
        audience: str = "carrier",
        num_cards: int = 8,
    ) -> dict:
        """
        Create a presentation via Gamma API v1.0.

        1. POST /generations with inputText
        2. Poll GET /generations/{id} until completed
        3. Return gammaUrl
        """
        if not self.is_configured:
            return {
                "error": True,
                "message": "Gamma API key not configured. Set GAMMA_API_KEY in environment.",
            }

        input_text = f"Title: {title}\n\n{content}"

        payload = {
            "inputText": input_text,
            "textMode": "generate",
            "format": "presentation",
            "numCards": num_cards,
            "textOptions": {
                "tone": "professional",
                "audience": audience,
            },
            "imageOptions": {
                "source": "stock",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    f"{GAMMA_API_URL}/generations",
                    headers=self._headers,
                    json=payload,
                )

                if response.status_code != 200:
                    return {
                        "error": True,
                        "status_code": response.status_code,
                        "message": response.text[:500],
                    }

                data = response.json()

            generation_id = data.get("generationId")
            if not generation_id:
                return {"error": True, "message": "No generationId in response"}

            # Poll for completion
            completed = await self._poll_generation(generation_id)
            if completed.get("error"):
                return completed

            gamma_url = completed.get("gammaUrl", "")
            return {
                "gamma_id": generation_id,
                "url": gamma_url,
                "edit_url": gamma_url,
                "share_url": gamma_url,
                "status": "completed",
                "credits": completed.get("credits"),
            }
        except Exception as e:
            logger.error(f"Gamma API error: {e}")
            return {"error": True, "message": str(e)}

    async def create_inspection_deck(
        self,
        report_json: dict,
        claim_info: dict,
        session_info: dict,
    ) -> dict:
        """Create an inspection presentation from report data."""
        header = report_json.get("header", {})
        overview = report_json.get("overview", {})

        content_parts = [
            f"Inspection Report for Claim {header.get('claim_number', 'N/A')}",
            f"Property: {header.get('property_address', 'N/A')}",
            f"Insured: {header.get('insured_name', 'N/A')}",
            f"Date: {header.get('report_date', 'N/A')}",
            "",
            "Overview:",
            overview.get("summary", "") if isinstance(overview, dict) else str(overview),
            "",
        ]

        # Exterior/Roof
        ext = report_json.get("exterior_roof", {})
        if isinstance(ext, dict):
            content_parts.append("Exterior & Roof:")
            content_parts.append(ext.get("summary", ""))
            for cond in ext.get("notable_conditions", []):
                content_parts.append(f"- {cond}")
        elif ext:
            content_parts.append(f"Exterior & Roof: {ext}")
        content_parts.append("")

        # Interior rooms
        for room in report_json.get("interior", []):
            if isinstance(room, dict):
                content_parts.append(f"Room: {room.get('room', 'Interior')}")
                content_parts.append(room.get("summary", ""))
                content_parts.append(f"Damage: {room.get('damage_description', 'N/A')}")
                content_parts.append(f"Cause: {room.get('possible_cause', 'N/A')}")
                content_parts.append("")

        # Key findings
        findings = report_json.get("key_findings", [])
        if findings:
            content_parts.append("Key Findings:")
            for f in findings:
                content_parts.append(f"- {f}")
            content_parts.append("")

        # Next steps
        steps = report_json.get("recommended_next_steps", [])
        if steps:
            content_parts.append("Recommended Next Steps:")
            for i, s in enumerate(steps, 1):
                content_parts.append(f"{i}. {s}")

        content = "\n".join(content_parts)
        title = f"Inspection Report - {header.get('claim_number', 'Claim')}"

        return await self.create_presentation(
            title=title,
            content=content,
            audience="carrier",
        )

    async def create_client_update_deck(
        self,
        claim_info: dict,
        updates: list,
        next_actions: list,
    ) -> dict:
        """Create a client update presentation."""
        content_parts = [
            f"Claim Update for {claim_info.get('claim_number', '')}",
            f"Property: {claim_info.get('property_address', '')}",
            f"Status: {claim_info.get('status', '')}",
            "",
            "Recent Progress:",
        ]
        for u in (updates or ["No recent updates"]):
            content_parts.append(f"- {u}")
        content_parts.append("")
        content_parts.append("Next Steps:")
        for a in (next_actions or ["Awaiting carrier response"]):
            content_parts.append(f"- {a}")

        content = "\n".join(content_parts)
        title = f"Client Update - {claim_info.get('claim_number', 'Claim')}"

        return await self.create_presentation(
            title=title,
            content=content,
            audience="client",
        )

    async def create_client_status_report(
        self,
        claim: dict,
        timeline_events: Optional[List[dict]] = None,
        next_actions_firm: Optional[List[str]] = None,
        next_actions_client: Optional[List[str]] = None,
        fee_percentage: int = 20,
    ) -> dict:
        """
        Generate a professional client-facing claim status report.

        Uses Eden-2 claim data model fields:
        - claim_number, client_name, carrier_name, property_address
        - date_of_loss, claim_type, policy_number, stage
        - Financial: estimated_value, actual_cash_value, replacement_cost_value,
          deductible, depreciation, net_claim_value, settlement_amount
        - carrier_claim_number, carrier_adjuster_name, mortgage_company

        FL PA compliance:
        - Fee is 20% standard or 10% post-catastrophe (per contract)
        - All statute citations are real FL statutes
        - No CRN filing references
        - Appraisal = third-party appraiser, not attorney

        Args:
            claim: Dict matching Eden-2 Claim model fields.
            timeline_events: List of {"date": str, "description": str} dicts.
            next_actions_firm: Actions Care Claims is taking.
            next_actions_client: Actions the client should take.
            fee_percentage: 10 or 20 per the signed contract.
        """
        content = _build_status_report_content(
            claim=claim,
            timeline_events=timeline_events or [],
            next_actions_firm=next_actions_firm or _default_firm_actions(claim),
            next_actions_client=next_actions_client or _default_client_actions(),
            fee_percentage=fee_percentage,
        )

        title = (
            f"Client Status Report — {claim.get('claim_number', 'Claim')} "
            f"— {claim.get('client_name', 'Client')}"
        )

        return await self.create_presentation(
            title=title,
            content=content,
            audience="insurance policyholders and homeowners",
            num_cards=10,
        )


# ---------------------------------------------------------------------------
# Content builder helpers (pure functions, no side effects)
# ---------------------------------------------------------------------------

FL_STATUTES = {
    "pa_authority": (
        "FL Statute §626.854 — You have the right to retain a licensed "
        "Public Adjuster to represent your interests. Care Claims operates "
        "under this authority."
    ),
    "claim_deadlines": (
        "FL Statute §627.70131 — Your carrier must acknowledge your claim "
        "within 14 days, begin investigation within 10 days, and pay or deny "
        "within 90 days of filing."
    ),
    "appraisal": (
        "FL Statute §627.7015 — If the carrier's offer is disputed, you have "
        "the right to invoke the appraisal process, where an independent "
        "third-party appraiser determines the loss amount."
    ),
    "bad_faith": (
        "FL Statute §624.155 — If the carrier acts in bad faith (unreasonable "
        "delay, lowball offers without justification, failure to investigate), "
        "you may have grounds for a civil remedy notice after following the "
        "statutory process."
    ),
}

STAGE_LABELS = {
    "intake": "Intake & Documentation",
    "inspection": "Property Inspection",
    "negotiation": "Carrier Negotiation",
    "settlement": "Settlement Processing",
    "closed": "Claim Closed",
}


def _fmt_currency(value: Optional[float]) -> str:
    """Format a float as USD currency, or 'N/A' if None."""
    if value is None:
        return "N/A"
    return f"${value:,.2f}"


def _compute_compliance_deadlines(date_of_loss_str: str) -> List[dict]:
    """Compute FL statutory deadlines from date of loss string."""
    deadlines = []
    try:
        dol = datetime.strptime(date_of_loss_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        try:
            dol = datetime.strptime(date_of_loss_str, "%B %d, %Y")
        except (ValueError, TypeError):
            return [{"deadline": "Date of loss format unrecognized", "date": "—", "status": "—"}]

    today = datetime.now()

    ack_deadline = dol + timedelta(days=14)
    inv_deadline = dol + timedelta(days=10)
    pay_deadline = dol + timedelta(days=90)
    sol_deadline = dol + timedelta(days=5 * 365)

    def _status(dt: datetime) -> str:
        return "Pending" if dt > today else "Due"

    deadlines.append({
        "deadline": "Carrier Acknowledgment (14 days)",
        "date": ack_deadline.strftime("%B %d, %Y"),
        "status": _status(ack_deadline),
    })
    deadlines.append({
        "deadline": "Carrier Investigation Start (10 days)",
        "date": inv_deadline.strftime("%B %d, %Y"),
        "status": _status(inv_deadline),
    })
    deadlines.append({
        "deadline": "Carrier Payment/Denial (90 days)",
        "date": pay_deadline.strftime("%B %d, %Y"),
        "status": _status(pay_deadline),
    })
    deadlines.append({
        "deadline": "Statute of Limitations (5 years)",
        "date": sol_deadline.strftime("%B %d, %Y"),
        "status": "Active",
    })
    return deadlines


def _default_firm_actions(claim: dict) -> List[str]:
    """Default firm next actions based on claim stage."""
    stage = claim.get("stage", "intake")
    actions = {
        "intake": [
            "Completing property documentation and photo inventory",
            "Preparing detailed scope of loss estimate",
            "Filing claim with carrier on your behalf",
        ],
        "inspection": [
            "Conducting full property inspection with photo documentation",
            "Preparing repair estimate and scope of loss",
            "Coordinating with carrier for their inspection",
        ],
        "negotiation": [
            "Monitoring carrier response to submitted documentation",
            "Preparing supplemental evidence if carrier disputes scope",
            "Evaluating whether appraisal invocation is strategically appropriate",
        ],
        "settlement": [
            "Processing settlement documentation",
            "Coordinating mortgage endorsement if applicable",
            "Ensuring all recoverable amounts are captured",
        ],
        "closed": [
            "Claim resolved — no further actions required",
        ],
    }
    return actions.get(stage, actions["intake"])


def _default_client_actions() -> List[str]:
    """Standard client action items for any active claim."""
    return [
        "Keep all receipts for temporary repairs or additional living expenses (ALE) — these are reimbursable",
        "Do not begin permanent repairs until carrier inspection and negotiation are complete",
        "Do not sign anything from the carrier without consulting Care Claims first",
        "Document any new damage discovered (photo + date) and notify us immediately",
    ]


def _build_status_report_content(
    claim: dict,
    timeline_events: List[dict],
    next_actions_firm: List[str],
    next_actions_client: List[str],
    fee_percentage: int,
) -> str:
    """Build the full markdown content for a client status report presentation."""
    claim_number = claim.get("claim_number", "N/A")
    client_name = claim.get("client_name", "Valued Client")
    carrier = claim.get("carrier_name", "Your Insurance Carrier")
    property_addr = claim.get("property_address", "N/A")
    dol = claim.get("date_of_loss", "N/A")
    claim_type = claim.get("claim_type", "Property Damage")
    policy_num = claim.get("policy_number", "N/A")
    stage = claim.get("stage", "intake")
    stage_label = STAGE_LABELS.get(stage, stage.title())
    carrier_claim_num = claim.get("carrier_claim_number", "N/A")
    carrier_adjuster = claim.get("carrier_adjuster_name", "Not yet assigned")
    mortgage_co = claim.get("mortgage_company", "")

    rcv = claim.get("replacement_cost_value")
    acv = claim.get("actual_cash_value")
    deductible = claim.get("deductible")
    depreciation = claim.get("depreciation")
    net_claim = claim.get("net_claim_value")
    settlement = claim.get("settlement_amount")
    estimated = claim.get("estimated_value", 0)

    today_str = datetime.now().strftime("%B %d, %Y")

    sections = []

    # --- Title slide content ---
    sections.append(
        f"# Client Claim Status Report\n"
        f"## Care Claims — Your Claim at a Glance\n\n"
        f"**Prepared for:** {client_name}\n"
        f"**Claim Number:** {claim_number}\n"
        f"**Date Prepared:** {today_str}\n"
        f"**Public Adjuster:** Care Claims, Licensed Florida Public Adjusters\n"
    )

    # --- Claim Summary ---
    sections.append(
        f"## Claim Summary\n\n"
        f"| Field | Details |\n|-------|--------|\n"
        f"| Claim Number | {claim_number} |\n"
        f"| Policy Number | {policy_num} |\n"
        f"| Carrier | {carrier} |\n"
        f"| Carrier Claim # | {carrier_claim_num} |\n"
        f"| Property Address | {property_addr} |\n"
        f"| Date of Loss | {dol} |\n"
        f"| Type of Loss | {claim_type} |\n"
        f"| Current Stage | {stage_label} |\n"
        f"| Carrier Adjuster | {carrier_adjuster} |\n"
    )

    # --- Timeline ---
    if timeline_events:
        timeline_lines = ["## Timeline of Events\n"]
        for i, evt in enumerate(timeline_events, 1):
            date = evt.get("date", "")
            desc = evt.get("description", "")
            timeline_lines.append(f"{i}. **{date}** — {desc}")
        sections.append("\n".join(timeline_lines))

    # --- Financial Summary ---
    display_rcv = _fmt_currency(rcv) if rcv else _fmt_currency(estimated)
    mortgage_note = ""
    if mortgage_co:
        mortgage_note = (
            f"\n\n**Note:** Any settlement check may be co-payable to "
            f"{mortgage_co} as mortgagee. We will guide you through the "
            f"endorsement process."
        )

    settlement_display = _fmt_currency(settlement) if settlement else "$0.00 — In Negotiation"

    sections.append(
        f"## Financial Summary\n\n"
        f"| Category | Amount |\n|----------|--------|\n"
        f"| Replacement Cost Value (RCV) | {display_rcv} |\n"
        f"| Actual Cash Value (ACV) | {_fmt_currency(acv)} |\n"
        f"| Depreciation | {_fmt_currency(depreciation)} |\n"
        f"| Deductible | {_fmt_currency(deductible)} |\n"
        f"| Net Claim Value (Our Position) | {_fmt_currency(net_claim)} |\n"
        f"| Settlement Amount to Date | {settlement_display} |\n"
        f"{mortgage_note}"
    )

    # --- FL Law Protections ---
    fee_note = (
        f"Care Claims operates under this authority with a {fee_percentage}% "
        f"contingency fee, meaning you pay nothing unless we recover for you."
    )
    sections.append(
        f"## Your Rights Under Florida Law\n\n"
        f"As a Florida policyholder, you are protected by specific statutes:\n\n"
        f"- **{FL_STATUTES['pa_authority']}** {fee_note}\n\n"
        f"- **{FL_STATUTES['claim_deadlines']}**\n\n"
        f"- **{FL_STATUTES['appraisal']}**\n\n"
        f"- **{FL_STATUTES['bad_faith']}**\n\n"
        f"**Important:** Care Claims handles all carrier communications, "
        f"documentation, and negotiation on your behalf. You do not need to "
        f"speak with the carrier's adjuster directly."
    )

    # --- Firm Next Steps ---
    firm_lines = ["## What We're Doing Now (Care Claims Next Steps)\n"]
    for i, action in enumerate(next_actions_firm, 1):
        firm_lines.append(f"{i}. {action}")
    sections.append("\n".join(firm_lines))

    # --- Client Action Items ---
    client_lines = ["## What You Can Do (Client Action Items)\n"]
    for i, action in enumerate(next_actions_client, 1):
        client_lines.append(f"{i}. {action}")
    sections.append("\n".join(client_lines))

    # --- Compliance Deadlines ---
    deadlines = _compute_compliance_deadlines(dol)
    if deadlines:
        dl_lines = [
            "## Compliance Deadlines\n",
            "| Deadline | Date | Status |",
            "|----------|------|--------|",
        ]
        for dl in deadlines:
            dl_lines.append(
                f"| {dl['deadline']} | {dl['date']} | {dl['status']} |"
            )
        sections.append("\n".join(dl_lines))

    # --- Contact / Disclaimer ---
    sections.append(
        f"## Contact Information\n\n"
        f"**Care Claims**\n"
        f"Licensed Florida Public Adjusters\n\n"
        f"For emergencies or new damage, contact us immediately.\n\n"
        f"---\n\n"
        f"*This report is prepared by Care Claims for the exclusive use of "
        f"{client_name} regarding Claim {claim_number}. All information is "
        f"based on documentation obtained as of {today_str}. This document "
        f"does not constitute legal advice.*"
    )

    return "\n\n---\n\n".join(sections)


# Singleton instance
_gamma_client = None


def get_gamma_client() -> GammaClient:
    """Get the Gamma client singleton"""
    global _gamma_client
    if _gamma_client is None:
        _gamma_client = GammaClient()
    return _gamma_client
