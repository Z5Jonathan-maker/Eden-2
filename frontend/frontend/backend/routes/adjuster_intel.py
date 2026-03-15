"""
Per-Adjuster Intelligence — Behavioral pattern analysis for carrier desk adjusters.

Tracks response times, tactics, settlement rates, and generates counter-strategies
using Gemini AI. Stores profiles in `db.adjuster_profiles` collection.

Endpoints:
    GET  /api/adjuster-intel/profiles              — All adjuster profiles
    GET  /api/adjuster-intel/profiles/{name}        — Single adjuster profile
    GET  /api/adjuster-intel/carrier/{carrier}      — All adjusters for a carrier
    POST /api/adjuster-intel/generate               — Analyze claims and build profiles
    GET  /api/adjuster-intel/recommendations/{id}   — Strategy for a specific claim
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies import db, get_current_active_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/adjuster-intel", tags=["adjuster-intel"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_MODEL = "gemini-2.5-flash"

BEHAVIOR_SCORE_THRESHOLDS = {
    "A": {"max_response_days": 5, "min_settlement_rate": 0.7, "max_denial_rate": 0.1},
    "B": {"max_response_days": 10, "min_settlement_rate": 0.5, "max_denial_rate": 0.2},
    "C": {"max_response_days": 20, "min_settlement_rate": 0.3, "max_denial_rate": 0.4},
    "D": {"max_response_days": 40, "min_settlement_rate": 0.1, "max_denial_rate": 0.6},
}

SYSTEM_PROMPT_TACTICS = (
    "You are a senior public adjusting strategist analyzing carrier desk adjuster "
    "behavior for a Florida PA firm. You have deep expertise in insurance claim "
    "negotiation tactics, Florida statutes (626/627), and carrier delay patterns.\n\n"
    "Given claim notes and interactions with a specific adjuster, identify:\n"
    "1. Their primary negotiation tactics (e.g., lowball_initial, slow_supplement_review, "
    "ghost_after_lor, scope_dispute, depreciation_padding, delay_past_90)\n"
    "2. The single best counter-strategy sentence for this adjuster\n"
    "3. A behavior score A-F where:\n"
    "   A = Fast, fair, professional\n"
    "   B = Reasonable but occasionally slow\n"
    "   C = Slow, lowballs, needs pressure\n"
    "   D = Ghosts, exceeds statutory deadlines, requires CRN/mediation\n"
    "   F = Bad faith pattern, statutory violations\n\n"
    "Return ONLY valid JSON: {\"tactics\": [...], \"best_counter\": \"...\", \"behavior_score\": \"X\"}\n"
    "No markdown, no explanation, just JSON."
)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class AdjusterProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    carrier: str = ""
    email: str = ""
    phone: str = ""
    license: str = ""
    claims_handled: int = 0
    avg_response_days: Optional[float] = None
    avg_decision_days: Optional[float] = None
    settlement_rate: float = 0.0
    denial_rate: float = 0.0
    avg_settlement_pct_of_rcv: Optional[float] = None
    tactics: List[str] = Field(default_factory=list)
    best_counter: str = ""
    behavior_score: str = "C"
    claims: List[str] = Field(default_factory=list)
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class GenerateResponse(BaseModel):
    profiles_created: int = 0
    profiles_updated: int = 0
    errors: List[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    claim_id: str
    claim_number: str = ""
    adjuster_name: str = ""
    carrier: str = ""
    behavior_score: str = ""
    predicted_tactics: List[str] = Field(default_factory=list)
    recommended_strategy: str = ""
    ghosting_alert: Optional[str] = None
    settlement_expectation: Optional[str] = None
    profile_found: bool = False


# ---------------------------------------------------------------------------
# Gemini Integration
# ---------------------------------------------------------------------------

async def _call_gemini_for_tactics(
    adjuster_name: str,
    carrier: str,
    notes_text: str,
) -> dict:
    """Call Gemini to extract tactics, counter-strategy, and behavior score."""
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        logger.warning("No Gemini API key — skipping AI analysis for %s", adjuster_name)
        return {"tactics": [], "best_counter": "", "behavior_score": "C"}

    genai.configure(api_key=api_key)

    prompt = (
        f"Analyze these claim interactions with adjuster {adjuster_name} at {carrier}:\n\n"
        f"{notes_text[:8000]}\n\n"
        "Identify: 1) Their primary tactics 2) Best counter-strategy 3) Behavior score (A-F)\n"
        "Return JSON: {\"tactics\": [...], \"best_counter\": \"...\", \"behavior_score\": \"X\"}"
    )

    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT_TACTICS,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=500,
            ),
        )
        response = await asyncio.wait_for(
            model.generate_content_async(prompt),
            timeout=30,
        )
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        parsed = json.loads(raw_text)
        return {
            "tactics": parsed.get("tactics", [])[:10],
            "best_counter": str(parsed.get("best_counter", ""))[:500],
            "behavior_score": str(parsed.get("behavior_score", "C"))[:1],
        }
    except Exception as exc:
        logger.error("Gemini tactics analysis failed for %s: %s", adjuster_name, exc)
        return {"tactics": [], "best_counter": "", "behavior_score": "C"}


# ---------------------------------------------------------------------------
# Metric Calculations
# ---------------------------------------------------------------------------

def _calculate_settlement_rate(claims: list[dict]) -> float:
    """Fraction of claims with settlement_amount > 0."""
    if not claims:
        return 0.0
    settled = sum(
        1 for c in claims
        if (c.get("settlement_amount") or 0) > 0
    )
    return round(settled / len(claims), 3)


def _calculate_denial_rate(claims: list[dict]) -> float:
    """Fraction of claims with 'denied' or 'denial' in description/status."""
    if not claims:
        return 0.0
    denied = 0
    for c in claims:
        text = f"{c.get('description', '')} {c.get('status', '')}".lower()
        if "denied" in text or "denial" in text:
            denied += 1
    return round(denied / len(claims), 3)


def _calculate_avg_settlement_pct(claims: list[dict]) -> Optional[float]:
    """Average settlement_amount / estimated_value * 100 across settled claims."""
    percentages = []
    for c in claims:
        settlement = c.get("settlement_amount") or 0
        rcv = c.get("estimated_value") or c.get("replacement_cost_value") or 0
        if settlement > 0 and rcv > 0:
            percentages.append((settlement / rcv) * 100)
    if not percentages:
        return None
    return round(sum(percentages) / len(percentages), 1)


def _parse_response_days_from_notes(notes: list[dict]) -> Optional[float]:
    """Extract average response days from notes containing [Metrics] tags or timeline data."""
    response_days_values = []

    for note in notes:
        content = note.get("content", "")
        # Look for explicit metrics tags
        metrics_match = re.search(
            r"\[Metrics?\].*?response.*?(\d+(?:\.\d+)?)\s*(?:day|business day)",
            content,
            re.IGNORECASE | re.DOTALL,
        )
        if metrics_match:
            response_days_values.append(float(metrics_match.group(1)))
            continue

        # Look for LOR-to-acknowledgment patterns
        lor_match = re.search(
            r"(?:LOR|letter of rep).*?(?:ack|acknowledg|respond).*?(\d+)\s*(?:day|business day)",
            content,
            re.IGNORECASE,
        )
        if lor_match:
            response_days_values.append(float(lor_match.group(1)))
            continue

        # Look for "responded in X days"
        resp_match = re.search(
            r"respond(?:ed)?\s+(?:in|within)\s+(\d+)\s*(?:day|business day)",
            content,
            re.IGNORECASE,
        )
        if resp_match:
            response_days_values.append(float(resp_match.group(1)))

    if not response_days_values:
        return None
    return round(sum(response_days_values) / len(response_days_values), 1)


def _parse_decision_days_from_notes(notes: list[dict]) -> Optional[float]:
    """Extract average decision days from notes (acknowledgment to decision/payment)."""
    decision_days_values = []

    for note in notes:
        content = note.get("content", "")
        # Look for explicit decision timeline
        decision_match = re.search(
            r"(?:decision|determination|coverage|payout).*?(\d+)\s*(?:day|calendar day)",
            content,
            re.IGNORECASE,
        )
        if decision_match:
            val = float(decision_match.group(1))
            if val < 365:  # sanity check
                decision_days_values.append(val)
                continue

        # Look for "took X days" patterns
        took_match = re.search(
            r"took\s+(\d+)\s*(?:day|calendar day).*?(?:decide|settle|pay|close)",
            content,
            re.IGNORECASE,
        )
        if took_match:
            val = float(took_match.group(1))
            if val < 365:
                decision_days_values.append(val)

    if not decision_days_values:
        return None
    return round(sum(decision_days_values) / len(decision_days_values), 0)


def _calculate_behavior_score(
    avg_response_days: Optional[float],
    settlement_rate: float,
    denial_rate: float,
) -> str:
    """Deterministic behavior score based on thresholds — used as fallback when Gemini unavailable."""
    resp_days = avg_response_days or 15  # default to C-range if unknown

    for grade, thresholds in BEHAVIOR_SCORE_THRESHOLDS.items():
        if (
            resp_days <= thresholds["max_response_days"]
            and settlement_rate >= thresholds["min_settlement_rate"]
            and denial_rate <= thresholds["max_denial_rate"]
        ):
            return grade
    return "F"


def _normalize_adjuster_name(name: str) -> str:
    """Normalize adjuster name for grouping (strip whitespace, title case)."""
    return " ".join(name.strip().split()).title()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/profiles")
async def get_adjuster_profiles(
    current_user: dict = Depends(get_current_active_user),
):
    """Return all known adjuster profiles with stats."""
    profiles = await db.adjuster_profiles.find(
        {}, {"_id": 0}
    ).sort("claims_handled", -1).to_list(500)

    if not profiles:
        return []
    return profiles


@router.get("/profiles/{adjuster_name}")
async def get_adjuster_profile(
    adjuster_name: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Detailed profile for one adjuster with full claim history."""
    normalized = _normalize_adjuster_name(adjuster_name)

    profile = await db.adjuster_profiles.find_one(
        {"name": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}},
        {"_id": 0},
    )
    if not profile:
        raise HTTPException(status_code=404, detail=f"No profile found for adjuster: {adjuster_name}")

    # Enrich with full claim details
    claim_numbers = profile.get("claims", [])
    if claim_numbers:
        claims_detail = await db.claims.find(
            {"claim_number": {"$in": claim_numbers}},
            {
                "_id": 0, "id": 1, "claim_number": 1, "client_name": 1,
                "status": 1, "carrier_name": 1, "estimated_value": 1,
                "settlement_amount": 1, "date_of_loss": 1, "stage": 1,
            },
        ).to_list(100)
        profile["claims_detail"] = claims_detail

    return profile


@router.get("/carrier/{carrier_name}")
async def get_carrier_adjusters(
    carrier_name: str,
    current_user: dict = Depends(get_current_active_user),
):
    """All adjusters for a carrier with aggregate stats."""
    profiles = await db.adjuster_profiles.find(
        {"carrier": {"$regex": re.escape(carrier_name), "$options": "i"}},
        {"_id": 0},
    ).sort("claims_handled", -1).to_list(100)

    if not profiles:
        raise HTTPException(
            status_code=404,
            detail=f"No adjuster profiles found for carrier: {carrier_name}",
        )

    # Compute aggregate carrier stats
    total_claims = sum(p.get("claims_handled", 0) for p in profiles)
    avg_settlement = None
    settlement_pcts = [
        p["avg_settlement_pct_of_rcv"]
        for p in profiles
        if p.get("avg_settlement_pct_of_rcv") is not None
    ]
    if settlement_pcts:
        avg_settlement = round(sum(settlement_pcts) / len(settlement_pcts), 1)

    avg_response = None
    response_vals = [
        p["avg_response_days"]
        for p in profiles
        if p.get("avg_response_days") is not None
    ]
    if response_vals:
        avg_response = round(sum(response_vals) / len(response_vals), 1)

    score_counts = defaultdict(int)
    for p in profiles:
        score_counts[p.get("behavior_score", "C")] += 1

    return {
        "carrier": carrier_name,
        "adjuster_count": len(profiles),
        "total_claims": total_claims,
        "avg_settlement_pct_of_rcv": avg_settlement,
        "avg_response_days": avg_response,
        "behavior_score_distribution": dict(score_counts),
        "adjusters": profiles,
    }


@router.post("/generate", response_model=GenerateResponse)
async def generate_adjuster_profiles(
    current_user: dict = Depends(require_role(["admin", "manager"])),
):
    """
    Analyze all claims and generate/update adjuster profiles.

    Groups claims by carrier_adjuster_name, calculates metrics from claim data
    and notes, uses Gemini to extract behavior patterns, and stores results
    in db.adjuster_profiles.
    """
    # Fetch all claims that have a carrier adjuster name set
    claims_cursor = db.claims.find(
        {
            "carrier_adjuster_name": {"$exists": True, "$nin": ["", None]},
        },
        {"_id": 0},
    )
    all_claims = await claims_cursor.to_list(5000)

    if not all_claims:
        return GenerateResponse(profiles_created=0, profiles_updated=0, errors=["No claims with carrier_adjuster_name found"])

    # Group claims by normalized adjuster name
    adjuster_claims: dict[str, list[dict]] = defaultdict(list)
    for claim in all_claims:
        raw_name = (claim.get("carrier_adjuster_name") or "").strip()
        if not raw_name:
            continue
        normalized = _normalize_adjuster_name(raw_name)
        adjuster_claims[normalized].append(claim)

    created = 0
    updated = 0
    errors: list[str] = []

    for adjuster_name, claims in adjuster_claims.items():
        try:
            profile = await _build_adjuster_profile(adjuster_name, claims)

            # Upsert into MongoDB
            existing = await db.adjuster_profiles.find_one(
                {"name": {"$regex": f"^{re.escape(adjuster_name)}$", "$options": "i"}},
            )
            profile_dict = profile.model_dump()

            if existing:
                await db.adjuster_profiles.update_one(
                    {"_id": existing["_id"]},
                    {"$set": profile_dict},
                )
                updated += 1
            else:
                await db.adjuster_profiles.insert_one(profile_dict)
                created += 1

            logger.info(
                "Adjuster profile %s: %s (%d claims, score=%s)",
                "updated" if existing else "created",
                adjuster_name,
                len(claims),
                profile.behavior_score,
            )
        except Exception as exc:
            error_msg = f"Failed to build profile for {adjuster_name}: {exc}"
            logger.error(error_msg)
            errors.append(error_msg)

    return GenerateResponse(
        profiles_created=created,
        profiles_updated=updated,
        errors=errors,
    )


async def _build_adjuster_profile(
    adjuster_name: str,
    claims: list[dict],
) -> AdjusterProfile:
    """Build a complete adjuster profile from claim data and notes."""
    # Extract adjuster contact info from the most recent claim
    latest_claim = max(claims, key=lambda c: c.get("created_at", ""))
    carrier = latest_claim.get("carrier_name", "")
    email = latest_claim.get("carrier_adjuster_email", "")
    phone = latest_claim.get("carrier_adjuster_phone", "")

    # Extract license number from notes if present
    license_num = ""
    claim_numbers = [c.get("claim_number", "") for c in claims if c.get("claim_number")]

    # Fetch all notes for these claims
    claim_ids = [c.get("id") for c in claims if c.get("id")]
    all_notes: list[dict] = []
    if claim_ids:
        notes_cursor = db.notes.find(
            {"claim_id": {"$in": claim_ids}},
            {"_id": 0, "content": 1, "created_at": 1, "claim_id": 1, "tags": 1},
        ).sort("created_at", -1)
        all_notes = await notes_cursor.to_list(500)

    # Extract license from notes
    for note in all_notes:
        content = note.get("content", "")
        lic_match = re.search(
            r"(?:license|lic\.?|DFS)\s*#?\s*:?\s*([A-Z]?\d{5,10})",
            content,
            re.IGNORECASE,
        )
        if lic_match:
            license_num = lic_match.group(1)
            break

    # Calculate metrics
    settlement_rate = _calculate_settlement_rate(claims)
    denial_rate = _calculate_denial_rate(claims)
    avg_settlement_pct = _calculate_avg_settlement_pct(claims)
    avg_response_days = _parse_response_days_from_notes(all_notes)
    avg_decision_days = _parse_decision_days_from_notes(all_notes)

    # Build notes text for Gemini analysis
    notes_text_parts = []
    for note in all_notes[:50]:  # cap to avoid token overflow
        content = note.get("content", "")
        tags = note.get("tags", [])
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        notes_text_parts.append(f"{tag_str} {content}")
    notes_text = "\n---\n".join(notes_text_parts)

    # Get AI-powered tactics analysis
    ai_result = await _call_gemini_for_tactics(adjuster_name, carrier, notes_text)

    # Use AI behavior score if available, otherwise calculate deterministically
    behavior_score = ai_result.get("behavior_score", "")
    if behavior_score not in ("A", "B", "C", "D", "F"):
        behavior_score = _calculate_behavior_score(
            avg_response_days, settlement_rate, denial_rate,
        )

    return AdjusterProfile(
        name=adjuster_name,
        carrier=carrier,
        email=email,
        phone=phone,
        license=license_num,
        claims_handled=len(claims),
        avg_response_days=avg_response_days,
        avg_decision_days=avg_decision_days,
        settlement_rate=settlement_rate,
        denial_rate=denial_rate,
        avg_settlement_pct_of_rcv=avg_settlement_pct,
        tactics=ai_result.get("tactics", []),
        best_counter=ai_result.get("best_counter", ""),
        behavior_score=behavior_score,
        claims=claim_numbers,
    )


@router.get("/recommendations/{claim_id}")
async def get_claim_recommendations(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Given a claim, look up the adjuster's profile and recommend strategy.

    Returns ghosting alerts if the adjuster's avg response time is exceeded,
    settlement expectations, and the best counter-strategy.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    adjuster_name_raw = (claim.get("carrier_adjuster_name") or "").strip()
    carrier = claim.get("carrier_name", "")
    claim_number = claim.get("claim_number", "")

    if not adjuster_name_raw:
        return RecommendationResponse(
            claim_id=claim_id,
            claim_number=claim_number,
            carrier=carrier,
            recommended_strategy="No carrier adjuster assigned to this claim. Set carrier_adjuster_name first.",
            profile_found=False,
        )

    normalized = _normalize_adjuster_name(adjuster_name_raw)
    profile = await db.adjuster_profiles.find_one(
        {"name": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}},
        {"_id": 0},
    )

    if not profile:
        return RecommendationResponse(
            claim_id=claim_id,
            claim_number=claim_number,
            adjuster_name=adjuster_name_raw,
            carrier=carrier,
            recommended_strategy=(
                f"No intel profile exists for {adjuster_name_raw}. "
                "Run POST /api/adjuster-intel/generate to build profiles from claim data."
            ),
            profile_found=False,
        )

    # Build ghosting alert
    ghosting_alert = None
    avg_response = profile.get("avg_response_days")
    if avg_response is not None:
        # Check last note date vs now
        latest_note = await db.notes.find_one(
            {"claim_id": claim_id},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", -1)],
        )
        if latest_note:
            last_note_at = latest_note.get("created_at")
            if isinstance(last_note_at, str):
                try:
                    last_note_at = datetime.fromisoformat(
                        last_note_at.replace("Z", "+00:00")
                    )
                except Exception:
                    last_note_at = None

            if last_note_at:
                if not last_note_at.tzinfo:
                    last_note_at = last_note_at.replace(tzinfo=timezone.utc)
                days_since = (datetime.now(timezone.utc) - last_note_at).days
                if days_since > avg_response * 1.5:
                    ghosting_alert = (
                        f"GHOSTING WARNING: {days_since} days since last activity. "
                        f"This adjuster's average response is {avg_response} days. "
                        f"Consider escalation or CRN filing."
                    )
                elif days_since > avg_response:
                    ghosting_alert = (
                        f"ATTENTION: {days_since} days since last activity — "
                        f"exceeding this adjuster's {avg_response}-day average. Follow up immediately."
                    )

    # Build settlement expectation
    settlement_expectation = None
    rcv = claim.get("estimated_value") or claim.get("replacement_cost_value") or 0
    avg_pct = profile.get("avg_settlement_pct_of_rcv")
    if rcv > 0 and avg_pct is not None:
        expected_settlement = round(rcv * (avg_pct / 100), 2)
        settlement_expectation = (
            f"Based on {profile.get('claims_handled', 0)} prior claims, "
            f"this adjuster settles at ~{avg_pct}% of RCV. "
            f"Expected settlement: ${expected_settlement:,.2f} on ${rcv:,.2f} RCV."
        )

    return RecommendationResponse(
        claim_id=claim_id,
        claim_number=claim_number,
        adjuster_name=profile.get("name", adjuster_name_raw),
        carrier=profile.get("carrier", carrier),
        behavior_score=profile.get("behavior_score", ""),
        predicted_tactics=profile.get("tactics", []),
        recommended_strategy=profile.get("best_counter", ""),
        ghosting_alert=ghosting_alert,
        settlement_expectation=settlement_expectation,
        profile_found=True,
    )
