import base64
import io
import logging
from datetime import datetime
from typing import Any, Dict

import httpx
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Shared field positions for PA Agreement PDF overlay
# All fill-in fields: 12pt Regular (Helvetica)
# Fee disclosure percentage: 18pt Bold (Helvetica-Bold) — FL DFS non-negotiable
PA_AGREEMENT_FIELD_POSITIONS = {
    "policyholder_name": {"page": 0, "x": 160, "y": 148, "fontsize": 12},
    "policyholder_email": {"page": 0, "x": 160, "y": 163, "fontsize": 12},
    "policyholder_address": {"page": 0, "x": 160, "y": 178, "fontsize": 12},
    "policyholder_city": {"page": 0, "x": 160, "y": 193, "fontsize": 12},
    "policyholder_state": {"page": 0, "x": 320, "y": 193, "fontsize": 12},
    "policyholder_zip": {"page": 0, "x": 380, "y": 193, "fontsize": 12},
    "policyholder_phone": {"page": 0, "x": 160, "y": 208, "fontsize": 12},
    "policyholder_mobile": {"page": 0, "x": 320, "y": 208, "fontsize": 12},
    "insurance_company": {"page": 0, "x": 160, "y": 258, "fontsize": 12},
    "policy_number": {"page": 0, "x": 400, "y": 258, "fontsize": 12},
    "claim_number": {"page": 0, "x": 160, "y": 273, "fontsize": 12},
    "insurance_address": {"page": 0, "x": 160, "y": 288, "fontsize": 12},
    "field_adjuster": {"page": 0, "x": 160, "y": 303, "fontsize": 12},
    "field_adjuster_phone": {"page": 0, "x": 400, "y": 303, "fontsize": 12},
    "desk_adjuster": {"page": 0, "x": 160, "y": 318, "fontsize": 12},
    "desk_adjuster_phone": {"page": 0, "x": 400, "y": 318, "fontsize": 12},
    "loss_address": {"page": 0, "x": 160, "y": 368, "fontsize": 12},
    "loss_city": {"page": 0, "x": 160, "y": 383, "fontsize": 12},
    "loss_state_zip": {"page": 0, "x": 320, "y": 383, "fontsize": 12},
    "date_of_loss": {"page": 0, "x": 160, "y": 398, "fontsize": 12},
    "description_of_loss": {"page": 0, "x": 160, "y": 413, "fontsize": 12, "width": 400},
    "claim_type": {"page": 0, "x": 160, "y": 443, "fontsize": 12},
    "fee_percentage": {"page": 0, "x": 400, "y": 478, "fontsize": 18, "bold": True},
}


async def build_contract_pdf_bytes(contract: Dict[str, Any], template_pdf_url: str) -> bytes:
    """Generate a filled PDF for a contract and return as bytes."""
    if not template_pdf_url:
        raise ValueError("Template PDF URL is required to build contract PDF")

    raw_field_values = contract.get("field_values", {})
    signature_data = contract.get("signature_data")

    # Map frontend ContractMergeFields keys → PA template field IDs
    _MERGE_TO_PA_MAP = {
        "client_name": "policyholder_name",
        "email": "policyholder_email",
        "client_address": "policyholder_address",
        "phone": "policyholder_phone",
        "carrier": "insurance_company",
        "property_address": "loss_address",
        "loss_date": "date_of_loss",
    }
    field_values = dict(raw_field_values)
    for merge_key, pa_key in _MERGE_TO_PA_MAP.items():
        if merge_key in field_values and pa_key not in field_values:
            field_values[pa_key] = field_values[merge_key]

    async with httpx.AsyncClient() as client:
        pdf_response = await client.get(template_pdf_url, timeout=30.0)
        if pdf_response.status_code != 200:
            raise RuntimeError("Failed to download template PDF")
        pdf_bytes = pdf_response.content

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    field_positions = PA_AGREEMENT_FIELD_POSITIONS

    for field_id, pos in field_positions.items():
        value = field_values.get(field_id, "")
        if value:
            page = doc[pos["page"]]
            fontsize = pos.get("fontsize", 12)
            fontname = "helvetica-bold" if pos.get("bold") else "helv"

            if field_id == "description_of_loss" and len(str(value)) > 50:
                value = str(value)[:200] + "..." if len(str(value)) > 200 else value

            display_value = f"{value}%" if field_id == "fee_percentage" else str(value)
            page.insert_text(
                fitz.Point(pos["x"], pos["y"]),
                display_value,
                fontsize=fontsize,
                fontname=fontname,
                color=(0, 0, 0)
            )

    if signature_data and signature_data.startswith("data:image"):
        try:
            _, encoded = signature_data.split(",", 1)
            signature_bytes = base64.b64decode(encoded)

            sig_page_idx = len(doc) - 1  # Always use last page for signature
            sig_page = doc[sig_page_idx]
            sig_rect = fitz.Rect(100, 650, 300, 720)

            sig_page.insert_image(sig_rect, stream=signature_bytes)

            signed_at = contract.get("signed_at", "")
            if signed_at:
                try:
                    signed_date = datetime.fromisoformat(signed_at.replace("Z", "+00:00"))
                    date_str = signed_date.strftime("%m/%d/%Y")
                except Exception:
                    date_str = signed_at[:10]

                sig_page.insert_text(
                    fitz.Point(320, 700),
                    f"Date: {date_str}",
                    fontsize=10,
                    fontname="helv",
                    color=(0, 0, 0)
                )

            signer_name = contract.get("signer_name") or contract.get("client_name", "")
            if signer_name:
                sig_page.insert_text(
                    fitz.Point(100, 735),
                    f"Signed by: {signer_name}",
                    fontsize=9,
                    fontname="helv",
                    color=(0.3, 0.3, 0.3)
                )

        except Exception as exc:
            logger.warning("Failed to add signature to PDF: %s", exc)

    pdf_output = io.BytesIO()
    doc.save(pdf_output)
    doc.close()
    pdf_output.seek(0)

    if contract.get("status") == "signed":
        doc = fitz.open(stream=pdf_output.getvalue(), filetype="pdf")
        for page in doc:
            page.insert_text(
                fitz.Point(450, 30),
                "SIGNED",
                fontsize=12,
                fontname="helv",
                color=(0, 0.5, 0)
            )

        pdf_output = io.BytesIO()
        doc.save(pdf_output)
        doc.close()
        pdf_output.seek(0)

    return pdf_output.getvalue()
