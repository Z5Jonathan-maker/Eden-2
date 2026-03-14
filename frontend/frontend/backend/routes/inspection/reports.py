"""
Inspection Reports - AI report generation, markdown rendering, report CRUD
"""
import os
import re
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from dependencies import db, get_current_active_user
from .models import InspectionReport
from .helpers import logger

router = APIRouter()


# ========== AI INSPECTION REPORTS ==========

# Enhanced JSON Schema for Eve's output
INSPECTION_REPORT_SCHEMA = {
    "header": {
        "firm_name": "string",
        "firm_address": "string",
        "firm_phone": "string",
        "firm_email": "string",
        "claim_number": "string",
        "insured_name": "string",
        "property_address": "string",
        "report_date": "string"
    },
    "overview": {
        "summary": "string",
        "inspection_date": "string",
        "inspector_name": "string",
        "loss_cause": "string",
        "policy_info": "string"
    },
    "exterior_roof": {
        "summary": "string",
        "details": "string",
        "notable_conditions": ["string"]
    },
    "interior": [
        {
            "room": "Kitchen",
            "summary": "string",
            "damage_description": "string",
            "possible_cause": "string",
            "voice_notes_used": "string"
        }
    ],
    "systems": {
        "hvac": "string",
        "electrical": "string",
        "plumbing": "string",
        "other": "string"
    },
    "key_findings": ["string"],
    "risks_concerns": ["string"],
    "recommended_next_steps": ["string"],
    "carrier_strategy_notes": "string",
    "signature_block": {
        "adjuster_name": "string",
        "license_number": "string",
        "firm_name": "string",
        "title": "string"
    }
}

INSPECTION_REPORT_SYSTEM_PROMPT = """
You are Eve, an expert public adjuster and property inspector in Florida.

You create carrier-ready inspection reports based on:
- Claim metadata
- Inspection session metadata
- Photos (rooms, categories, optional AI captions)
- Voice transcript snippets attached to photos
- The full session transcript

Your output must ALWAYS be valid JSON, matching the exact schema provided in the instructions.
Do not include any extra keys. Do not include explanations. Just return JSON.
"""

INSPECTION_REPORT_USER_PROMPT_TEMPLATE = """
Use the following data to build a structured inspection report JSON.

SCHEMA (do NOT change keys; fill them with appropriate text/list values):
{schema}

CLAIM:
{claim_json}

INSPECTION_SESSION:
{session_json}

PHOTOS_WITH_NOTES:
{photos_json}

FULL_TRANSCRIPT:
{transcript_text}

Instructions:
1. Read the claim and session to understand the property, loss, and context.
2. Use photos_json and voice snippets to build room-by-room details.
3. Use the full transcript to catch any extra observations or concerns.
4. Fill every field in the JSON schema with concise, professional text.
5. "carrier_strategy_notes" should mention any angles or concerns relevant for negotiation.
6. Keep language clear, organized, and neutral -- suitable to share with a carrier.

Return ONLY valid JSON in the schema above.
"""


def build_inspection_report_prompt(claim: dict, session: dict, photos: list, transcript: str) -> str:
    """Build the user prompt for Eve's report generation"""
    schema = json.dumps(INSPECTION_REPORT_SCHEMA, indent=2)
    claim_json = json.dumps(claim, default=str, indent=2)
    session_json = json.dumps(session, default=str, indent=2)
    photos_json = json.dumps(photos, default=str, indent=2)

    return INSPECTION_REPORT_USER_PROMPT_TEMPLATE.format(
        schema=schema,
        claim_json=claim_json,
        session_json=session_json,
        photos_json=photos_json,
        transcript_text=transcript or "No voice recording for this session."
    )


def render_report_markdown(report: dict) -> str:
    """Convert structured report JSON to markdown for display/copy"""
    h = report.get("header", {})
    o = report.get("overview", {})
    er = report.get("exterior_roof", {})
    sys = report.get("systems", {})
    sig = report.get("signature_block", {})

    lines = []

    # Header
    lines.append(f"# {h.get('firm_name', 'Eden Claims Services')}")
    lines.append(h.get("firm_address", ""))
    if h.get("firm_phone") or h.get("firm_email"):
        lines.append(f"Phone: {h.get('firm_phone', '')} | Email: {h.get('firm_email', '')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"**Claim:** {h.get('claim_number', 'N/A')} -- {h.get('insured_name', 'N/A')}")
    lines.append(f"**Property:** {h.get('property_address', 'N/A')}")
    lines.append(f"**Date of Report:** {h.get('report_date', 'N/A')}")
    lines.append("")

    # Overview
    lines.append("## Overview")
    lines.append("")
    if isinstance(o, dict):
        lines.append(o.get("summary", "No overview provided."))
        lines.append("")
        if o.get("inspection_date"):
            lines.append(f"**Inspection Date:** {o.get('inspection_date')}")
        if o.get("inspector_name"):
            lines.append(f"**Inspector:** {o.get('inspector_name')}")
        if o.get("loss_cause"):
            lines.append(f"**Loss Cause:** {o.get('loss_cause')}")
        if o.get("policy_info"):
            lines.append(f"**Policy Info:** {o.get('policy_info')}")
    else:
        lines.append(str(o) if o else "No overview provided.")
    lines.append("")

    # Exterior & Roof
    lines.append("## Exterior & Roof")
    lines.append("")
    if isinstance(er, dict):
        lines.append(er.get("summary", "No exterior/roof findings documented."))
        if er.get("details"):
            lines.append("")
            lines.append(er.get("details"))
        if er.get("notable_conditions"):
            lines.append("")
            lines.append("**Notable Conditions:**")
            for cond in er.get("notable_conditions", []):
                lines.append(f"- {cond}")
    else:
        lines.append(str(er) if er else "No exterior/roof findings documented.")
    lines.append("")

    # Interior
    lines.append("## Interior")
    lines.append("")
    interior = report.get("interior", [])
    if interior and isinstance(interior, list):
        for room in interior:
            if isinstance(room, dict):
                lines.append(f"### {room.get('room', 'Unknown Room')}")
                lines.append("")
                if room.get("summary"):
                    lines.append(room.get("summary"))
                    lines.append("")
                if room.get("damage_description"):
                    lines.append(f"**Damage:** {room.get('damage_description')}")
                if room.get("possible_cause"):
                    lines.append(f"**Possible Cause:** {room.get('possible_cause')}")
                if room.get("voice_notes_used"):
                    lines.append(f"**Voice Notes:** {room.get('voice_notes_used')}")
                lines.append("")
    else:
        lines.append("No interior rooms documented.")
    lines.append("")

    # Systems
    lines.append("## Systems (HVAC, Electrical, Plumbing)")
    lines.append("")
    if isinstance(sys, dict):
        if sys.get("hvac"):
            lines.append(f"**HVAC:** {sys.get('hvac')}")
        if sys.get("electrical"):
            lines.append(f"**Electrical:** {sys.get('electrical')}")
        if sys.get("plumbing"):
            lines.append(f"**Plumbing:** {sys.get('plumbing')}")
        if sys.get("other"):
            lines.append(f"**Other:** {sys.get('other')}")
        if not any([sys.get("hvac"), sys.get("electrical"), sys.get("plumbing"), sys.get("other")]):
            lines.append("Not inspected or no issues noted.")
    else:
        lines.append(str(sys) if sys else "Not inspected or no issues noted.")
    lines.append("")

    # Key Findings
    lines.append("## Key Findings & Concerns")
    lines.append("")
    findings = report.get("key_findings", [])
    if findings:
        for f in findings:
            lines.append(f"- {f}")
    else:
        lines.append("No key findings documented.")
    lines.append("")

    # Risks & Concerns
    risks = report.get("risks_concerns", [])
    if risks:
        lines.append("### Risks & Concerns")
        lines.append("")
        for r in risks:
            lines.append(f"- {r}")
        lines.append("")

    # Recommended Next Steps
    lines.append("## Recommended Next Steps")
    lines.append("")
    steps = report.get("recommended_next_steps", [])
    if steps:
        for i, s in enumerate(steps, 1):
            lines.append(f"{i}. {s}")
    else:
        lines.append("No recommendations at this time.")
    lines.append("")

    # Carrier Strategy Notes
    if report.get("carrier_strategy_notes"):
        lines.append("## Carrier Strategy Notes")
        lines.append("")
        lines.append(report.get("carrier_strategy_notes"))
        lines.append("")

    # Signature Block
    lines.append("---")
    lines.append("")
    lines.append("**Sincerely,**")
    lines.append("")
    lines.append(sig.get("adjuster_name", "Licensed Public Adjuster"))
    if sig.get("title"):
        lines.append(sig.get("title"))
    if sig.get("license_number"):
        lines.append(f"License: {sig.get('license_number')}")
    lines.append(sig.get("firm_name", "Eden Claims Services"))

    return "\n".join(lines)


@router.post("/sessions/{session_id}/report")
async def generate_inspection_report(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Generate an AI inspection report from session data.
    Returns both structured JSON and rendered markdown.
    """
    from dotenv import load_dotenv
    load_dotenv()

    # Get session
    session = await db.inspection_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get claim
    claim = await db.claims.find_one({"id": session["claim_id"]}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Get photos with voice snippets
    photos = await db.inspection_photos.find(
        {"session_id": session_id},
        {"_id": 0, "filename": 0, "annotations": 0}
    ).to_list(500)

    # Get transcript
    transcript = session.get("voice_transcript", "")

    # Build prompt using the template
    user_prompt = build_inspection_report_prompt(claim, session, photos, transcript)

    # Generate report with Eve (GPT-4o via OpenAI API)
    try:
        from emergentintegrations.llm.openai import LlmChat, UserMessage

        api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="No AI API key configured (EMERGENT_LLM_KEY or OPENAI_API_KEY)")

        llm_session_id = f"report_{session_id}_{datetime.now().timestamp()}"

        llm = LlmChat(
            api_key=api_key,
            session_id=llm_session_id,
            system_message=INSPECTION_REPORT_SYSTEM_PROMPT
        )
        llm = llm.with_model(provider="openai", model="gpt-4o")

        response = await llm.send_message(UserMessage(text=user_prompt))

        # Parse JSON from response
        report_json = None
        response_text = response.strip()

        # Try to extract JSON from response
        if response_text.startswith("{"):
            try:
                report_json = json.loads(response_text)
            except json.JSONDecodeError:
                pass

        if not report_json:
            # Try to find JSON block in response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    report_json = json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

        if not report_json:
            # Fallback: create basic structure matching the enhanced schema
            report_json = {
                "header": {
                    "firm_name": "Eden Claims Services",
                    "firm_address": "Miami, FL",
                    "firm_phone": "",
                    "firm_email": "",
                    "claim_number": claim.get("claim_number", ""),
                    "insured_name": claim.get("client_name") or claim.get("insured_name", ""),
                    "property_address": claim.get("property_address") or claim.get("loss_location", ""),
                    "report_date": datetime.now().strftime("%Y-%m-%d")
                },
                "overview": {
                    "summary": response_text[:1000] if response_text else "No overview available.",
                    "inspection_date": session.get("started_at", "")[:10] if session.get("started_at") else "",
                    "inspector_name": session.get("created_by", ""),
                    "loss_cause": claim.get("loss_type", ""),
                    "policy_info": claim.get("policy_number", "")
                },
                "exterior_roof": {
                    "summary": "",
                    "details": "",
                    "notable_conditions": []
                },
                "interior": [],
                "systems": {
                    "hvac": "Not inspected",
                    "electrical": "Not inspected",
                    "plumbing": "Not inspected",
                    "other": ""
                },
                "key_findings": [],
                "risks_concerns": [],
                "recommended_next_steps": [],
                "carrier_strategy_notes": "",
                "signature_block": {
                    "adjuster_name": session.get("created_by", "Licensed Public Adjuster"),
                    "license_number": "",
                    "firm_name": "Eden Claims Services",
                    "title": "Public Adjuster"
                }
            }

        # Generate markdown from JSON
        report_markdown = render_report_markdown(report_json)

        # Save report
        report = InspectionReport(
            session_id=session_id,
            claim_id=session["claim_id"],
            report_json=report_json,
            report_markdown=report_markdown,
            generated_by=current_user.get("email", "")
        )

        # Check for existing reports and increment version
        existing = await db.inspection_reports.find(
            {"session_id": session_id}
        ).sort("version", -1).limit(1).to_list(1)

        if existing:
            report.version = existing[0].get("version", 0) + 1

        await db.inspection_reports.insert_one(report.model_dump())

        return {
            "id": report.id,
            "session_id": session_id,
            "claim_id": session["claim_id"],
            "report_json": report_json,
            "report_markdown": report_markdown,
            "version": report.version,
            "generated_at": report.generated_at
        }

    except Exception as e:
        logger.error("Report generation error: %s", e)
        raise HTTPException(status_code=500, detail="Report generation failed")


@router.get("/sessions/{session_id}/reports")
async def get_session_reports(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all reports for a session (version history)"""
    reports = await db.inspection_reports.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("version", -1).to_list(50)

    return {
        "session_id": session_id,
        "reports": reports,
        "count": len(reports)
    }


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific report by ID"""
    report = await db.inspection_reports.find_one(
        {"id": report_id},
        {"_id": 0}
    )

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a specific inspection report."""
    report = await db.inspection_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.inspection_reports.delete_one({"id": report_id})
    return {"message": "Report deleted", "id": report_id}


@router.delete("/sessions/{session_id}/reports")
async def delete_session_reports(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete ALL reports for a session (clear report history)."""
    result = await db.inspection_reports.delete_many({"session_id": session_id})
    return {
        "message": "Session reports deleted",
        "session_id": session_id,
        "deleted_count": result.deleted_count
    }
