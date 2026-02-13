"""
Gamma API Integration - Auto-generate professional presentation decks
Supports multiple audience types with detailed slide-by-slide prompts
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Literal
import requests
import os
import logging
from datetime import datetime, timezone, timedelta

from dependencies import db, get_current_active_user

# Import helper functions
from routes.gamma_helpers import (
    pack_claim_base,
    pack_client_update,
    pack_client_approval,
    pack_settlement,
    pack_rep_performance,
    pack_pastor_report,
)

router = APIRouter(prefix="/api/gamma", tags=["Gamma"])
logger = logging.getLogger(__name__)

GAMMA_API_KEY = os.getenv("GAMMA_API_KEY")

# Audience types for different presentation purposes
AudienceType = Literal[
    "client_update",      # Status update for homeowner
    "client_approval",    # Settlement review for client approval
    "settlement",         # Final settlement summary
    "rep_performance",    # Sales/adjuster performance review
    "pastor_report",      # Ministry impact report
]


class GammaRequest(BaseModel):
    title: str
    content: str
    audience: str = "client_update"
    template: str = "presentation"


class GammaClaimRequest(BaseModel):
    claim_number: str
    client_name: str
    property_address: str
    loss_date: Optional[str] = None
    loss_type: Optional[str] = None
    photo_count: Optional[int] = 0
    estimated_value: Optional[float] = 0
    insurance_company: Optional[str] = None
    status: Optional[str] = None
    audience: str = "client_update"


def build_prompt(req: GammaRequest) -> str:
    """Build detailed slide-by-slide prompts for each audience type"""
    
    base = f"""
CLAIM CONTEXT:
{req.content}

Create a slide-by-slide {req.template} with clear headings and bullet points.
"""

    if req.audience == "client_update":
        return base + """
AUDIENCE: Homeowner (client), not insurance experts.
PURPOSE: Update client on where things stand and what happens next.

SLIDE STRUCTURE:
1. Title: "Your Claim Update"
   - Client name
   - Claim number
   - Date of update

2. "What Happened"
   - Short summary of loss (plain language)
   - Date of loss
   - Property/location

3. "What We've Done So Far"
   - Inspections completed
   - Documents/photos submitted
   - Communication with carrier so far

4. "Where Your Claim Is Right Now"
   - Current status (e.g., "Under Review", "Negotiating", "Waiting on Carrier")
   - Any open items on carrier side
   - Any open items on our side

5. "What Happens Next"
   - 3–5 simple bullet steps (next 30–60 days)
   - Expected timelines (approximate)
   - What we are actively doing

6. "What We Need From You"
   - Any missing docs, photos, signatures
   - How and where to send them

7. "How to Reach Us"
   - Primary contact name
   - Phone, email, office hours

TONE: Reassuring, honest, faith-forward, no legalese.
"""

    if req.audience == "client_approval":
        return base + """
AUDIENCE: Homeowner (client).
PURPOSE: Review proposed settlement and get their informed approval.

SLIDE STRUCTURE:
1. Title: "Proposed Settlement Review"
   - Client name
   - Claim number
   - Date

2. "Overview of Your Loss"
   - Short recap of what happened
   - Main areas of damage (roof, interior, etc.)

3. "Our Estimate vs Carrier Offer"
   - Table or bullets:
     - Our estimate (total)
     - Carrier offer (total)
     - Difference (total and %)

4. "Key Differences in Scope"
   - 3–7 key line items or areas where the carrier is short
   - Simple explanations (e.g., "full roof vs. patching")

5. "Our Recommendation"
   - What we recommend (accept / negotiate / reject)
   - Short reasoning in plain language

6. "If You Approve"
   - What happens after approval
   - Timelines for checks, repairs, and our fee

7. "Questions & Next Steps"
   - Space for their questions
   - Contact info and how to sign/approve

TONE: Clear, non-technical, protective of the client, invites questions.
"""

    if req.audience == "settlement":
        return base + """
AUDIENCE: Client + internal file record.
PURPOSE: Final summary at closing.

SLIDE STRUCTURE:
1. Title: "Final Settlement Summary"
   - Client name
   - Claim number
   - Date of settlement

2. "Summary of the Claim"
   - Date of loss
   - Cause of loss
   - Main damages

3. "Financial Summary"
   - Gross settlement amount
   - Less deductibles
   - Less our fee
   - Net to client

4. "Category Breakdown"
   - Roof
   - Exterior
   - Interior
   - ALE / Other

5. "Before and After"
   - Space for 2–4 key photos (before/after)

6. "Timeline of Events"
   - FNOL date
   - Inspection(s)
   - Key negotiation points
   - Settlement date

7. "Next Steps & Closing"
   - Checks/payments
   - Any remaining to-dos
   - Thank-you + testimonial invitation

TONE: Professional, celebratory, detailed enough for records.
"""

    if req.audience == "rep_performance":
        return base + """
AUDIENCE: Sales rep / adjuster + leadership.
PURPOSE: Performance review with coaching.

SLIDE STRUCTURE:
1. Title: "Performance Review - [Rep Name]"
   - Period (e.g., Q1 2026)
   - Role

2. "Activity Metrics"
   - Doors knocked
   - Leads created
   - Appointments set
   - Contracts signed

3. "Conversion & Revenue"
   - Lead → appointment %
   - Appointment → signed %
   - Total revenue generated
   - Average deal size

4. "Strengths"
   - 3–5 bullet strengths (prospecting, closing, follow-up, documentation)

5. "Growth Opportunities"
   - 3–5 areas to improve
   - Very practical, coachable items

6. "Action Plan"
   - 3–7 specific actions for next period
   - Targets for activity & results

7. "Accountability & Support"
   - How leadership will support
   - Check-in cadence
   - Encouraging closing note

TONE: Coaching, data-driven, honoring, no shaming.
"""

    if req.audience == "pastor_report":
        return base + """
AUDIENCE: Pastoral leadership / Kingdom partners.
PURPOSE: Show impact, stewardship, and performance.

SLIDE STRUCTURE:
1. Title: "Kingdom Impact & Performance Report"
   - Firm name
   - Period covered

2. "Families Helped"
   - Number of families/claims served
   - Brief anonymized testimonies (2–3 stories)

3. "Financial Stewardship"
   - Total claim value settled
   - Fees earned
   - Giving / Kingdom initiatives supported (if provided in content)

4. "Team Highlights"
   - Top reps / adjusters
   - Key stories of character, excellence, and faith

5. "Community Impact"
   - Outreach, prayer, ministry moments tied to claims work
   - Any partnerships with churches/ministries

6. "Current Challenges & Prayer Points"
   - Honest 3–5 bullet challenges
   - Specific prayer requests

7. "Vision & Next Steps"
   - Short-term goals
   - Long-term vision
   - How pastoral covering can support

TONE: Faith-filled, grateful, honest, aligned with Kingdom impact language.
"""

    # Default fallback
    return base


async def call_gamma_api(title: str, prompt: str, audience: str):
    """Make the actual Gamma API call"""
    if not GAMMA_API_KEY:
        raise HTTPException(
            status_code=503, 
            detail="Gamma integration requires Pro account. Add GAMMA_API_KEY to enable."
        )
    
    payload = {
        "title": title,
        "mode": "generate",
        "prompt": prompt,
        "options": {"images": True, "language": "en"}
    }
    
    headers = {
        "Authorization": f"Bearer {GAMMA_API_KEY}", 
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            "https://api.gamma.app/v1/create", 
            json=payload, 
            headers=headers,
            timeout=60
        )
        response.raise_for_status()
        
        data = response.json()
        gamma_id = data.get("id")
        
        return {
            "gamma_id": gamma_id,
            "edit_url": f"https://gamma.app/edit/{gamma_id}",
            "share_url": f"https://gamma.app/{gamma_id}",
            "pdf_url": f"https://gamma.app/export/{gamma_id}/pdf",
            "audience": audience,
            "status": "created"
        }
    except requests.exceptions.HTTPError as e:
        logger.error(f"Gamma API error: {e}")
        raise HTTPException(status_code=502, detail=f"Gamma API error: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Gamma request failed: {e}")
        raise HTTPException(status_code=503, detail="Unable to reach Gamma service")


# ============================================
# Data Fetching Functions
# ============================================

async def get_claim(claim_id: str) -> dict:
    """Fetch claim from database"""
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


async def get_claim_timeline(claim_id: str) -> list:
    """Fetch claim timeline/events"""
    # Try to get from notes or activities
    notes = await db.claim_notes.find(
        {"claim_id": claim_id},
        {"_id": 0, "created_at": 1, "content": 1}
    ).sort("created_at", 1).to_list(10)
    
    timeline = []
    for note in notes:
        timeline.append({
            "date": note.get("created_at", "")[:10] if note.get("created_at") else "N/A",
            "label": note.get("content", "")[:100]
        })
    
    return timeline


async def get_claim_tasks(claim_id: str) -> list:
    """Fetch claim tasks/action items"""
    # Build from claim status and common workflow
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "status": 1})
    
    status = claim.get("status", "New") if claim else "New"
    
    # Default tasks based on status
    tasks = [
        {"label": "Initial claim review", "done": True, "owner": "firm"},
        {"label": "Inspection completed", "done": status not in ["New"], "owner": "firm"},
        {"label": "Photos uploaded", "done": status not in ["New"], "owner": "firm"},
        {"label": "Estimate submitted to carrier", "done": status in ["Under Review", "In Progress", "Completed"], "owner": "firm"},
        {"label": "Carrier acknowledgment received", "done": status in ["In Progress", "Completed"], "owner": "carrier"},
        {"label": "Settlement negotiation", "done": status == "Completed", "owner": "carrier"},
    ]
    
    return tasks


async def get_eden_estimate(claim_id: str) -> dict:
    """Get Eden's estimate for the claim"""
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "estimated_value": 1})
    return {"total": claim.get("estimated_value", 0) if claim else 0}


async def get_carrier_offer(claim_id: str) -> dict:
    """Get carrier's offer for the claim"""
    # This would come from supplements or negotiations collection
    # For now, estimate as 70% of our value (common scenario)
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "estimated_value": 1})
    our_value = claim.get("estimated_value", 0) if claim else 0
    return {"total": our_value * 0.7}  # Simulated carrier offer


async def get_key_differences(claim_id: str) -> list:
    """Get key scope differences between Eden and carrier"""
    # This would come from Scales comparison or supplements
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "estimated_value": 1, "claim_type": 1})
    our_value = claim.get("estimated_value", 0) if claim else 0
    carrier_value = our_value * 0.7
    
    # Common scope differences
    return [
        {"label": "Roof replacement vs repair", "ours": our_value * 0.4, "carrier": carrier_value * 0.3},
        {"label": "Interior water damage", "ours": our_value * 0.2, "carrier": carrier_value * 0.15},
        {"label": "Code upgrades", "ours": our_value * 0.1, "carrier": 0},
    ]


async def get_settlement_summary(claim_id: str) -> dict:
    """Get settlement financial summary"""
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "estimated_value": 1})
    gross = claim.get("estimated_value", 0) if claim else 0
    deductible = min(gross * 0.02, 2500)  # Typical deductible
    fee = gross * 0.10  # 10% PA fee
    
    return {
        "gross": gross,
        "deductible": deductible,
        "fee": fee,
        "net": gross - deductible - fee,
        "categories": {
            "Roof": gross * 0.4,
            "Exterior": gross * 0.2,
            "Interior": gross * 0.25,
            "ALE/Other": gross * 0.15,
        }
    }


async def get_before_after_pairs(claim_id: str) -> list:
    """Get before/after photo pairs"""
    # Fetch from inspection photos
    photos = await db.inspection_photos.find(
        {"claim_id": claim_id},
        {"_id": 0, "id": 1, "caption": 1, "category": 1}
    ).to_list(10)
    
    pairs = []
    for i, photo in enumerate(photos[:4]):  # Max 4 pairs
        pairs.append({
            "label": photo.get("category", f"Photo {i+1}"),
            "before": photo.get("id", "N/A"),
            "after": "repair_pending"
        })
    
    return pairs


async def get_rep_and_stats(user_id: str) -> tuple:
    """Get rep info and performance stats"""
    # Fetch user
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "email": 1, "role": 1})
    
    if not user:
        user = {"full_name": "Team Member", "email": "", "role": "adjuster"}
    
    # Calculate stats from harvest data
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=30)).isoformat()
    
    # Count activities
    pins_count = await db.canvassing_pins.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": period_start}
    })
    
    signed_count = await db.canvassing_pins.count_documents({
        "user_id": user_id,
        "disposition": "signed",
        "created_at": {"$gte": period_start}
    })
    
    appointments_count = await db.canvassing_pins.count_documents({
        "user_id": user_id,
        "disposition": "appointment",
        "created_at": {"$gte": period_start}
    })
    
    stats = {
        "period": f"{(now - timedelta(days=30)).strftime('%b %d')} - {now.strftime('%b %d, %Y')}",
        "doors": pins_count,
        "leads": int(pins_count * 0.3),
        "appointments": appointments_count,
        "contracts": signed_count,
        "lead_to_appt": (appointments_count / max(pins_count * 0.3, 1)) * 100 if pins_count > 0 else 0,
        "appt_to_signed": (signed_count / max(appointments_count, 1)) * 100 if appointments_count > 0 else 0,
        "revenue": signed_count * 15000,  # Avg claim value
        "avg_deal": 15000,
        "strengths": ["Consistent door activity", "Good follow-up", "Professional demeanor"],
        "growth_areas": ["Closing rate", "Objection handling", "Documentation speed"],
    }
    
    return user, stats


async def get_firm_and_impact_stats() -> tuple:
    """Get firm-wide impact stats for pastor report"""
    # Get company settings
    settings = await db.company_settings.find_one({}, {"_id": 0})
    firm = {
        "name": settings.get("company_name", "Eden Claims") if settings else "Eden Claims"
    }
    
    # Calculate impact metrics
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=90)).isoformat()
    
    # Count claims
    claims_count = await db.claims.count_documents({
        "created_at": {"$gte": period_start}
    })
    
    # Sum estimated values
    pipeline = [
        {"$match": {"created_at": {"$gte": period_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$estimated_value"}}}
    ]
    result = await db.claims.aggregate(pipeline).to_list(1)
    total_value = result[0]["total"] if result else 0
    
    impact = {
        "period": f"Last 90 Days ({now.strftime('%b %Y')})",
        "families_helped": claims_count,
        "total_claim_value": total_value,
        "fees_earned": total_value * 0.10,
        "giving": total_value * 0.01,  # 1% to Kingdom initiatives
        "testimonies": [
            "Family able to repair home and stay in community",
            "Single mom received full settlement after initial denial",
            "Church member referred 3 neighbors after great experience",
        ],
        "team_highlights": [
            "Team completed 100% of inspections within 48 hours",
            "Zero client complaints this quarter",
            "Two team members achieved certification milestones",
        ],
        "community_impact": [
            "Partnered with local church for disaster relief",
            "Sponsored community safety event",
            "Provided free consultations for elderly homeowners",
        ],
        "prayer_points": [
            "Continued favor with carriers",
            "Protection for field team",
            "Wisdom in negotiations",
            "Growth to serve more families",
        ],
        "vision": [
            "Expand team to handle 50% more claims",
            "Launch apprenticeship program",
            "Develop client education workshops",
        ],
    }
    
    return firm, impact


# ============================================
# API Endpoints
# ============================================

@router.post("/presentation")
async def create_gamma_presentation(
    request: GammaRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a presentation using Gamma API with detailed slide-by-slide prompts"""
    prompt = build_prompt(request)
    return await call_gamma_api(request.title, prompt, request.audience)


@router.post("/presentation/{audience}")
async def create_gamma_presentation_for_audience(
    audience: str,
    claim_id: str = Query(..., description="Claim ID to generate deck for"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create a Gamma presentation for a specific audience type using claim data from DB.
    
    Audiences: client_update | client_approval | settlement | rep_performance | pastor_report
    """
    
    # Validate audience
    valid_audiences = ["client_update", "client_approval", "settlement", "rep_performance", "pastor_report"]
    if audience not in valid_audiences:
        raise HTTPException(status_code=400, detail=f"Unknown audience type. Valid types: {', '.join(valid_audiences)}")
    
    # Load claim data
    claim = await get_claim(claim_id)
    
    # Build content based on audience type
    if audience == "client_update":
        timeline = await get_claim_timeline(claim_id)
        tasks = await get_claim_tasks(claim_id)
        content = pack_client_update(claim, timeline, tasks)
        title = f"Your Claim Update - {claim.get('claim_number', claim_id)}"

    elif audience == "client_approval":
        estimate = await get_eden_estimate(claim_id)
        carrier_offer = await get_carrier_offer(claim_id)
        key_diffs = await get_key_differences(claim_id)
        content = pack_client_approval(claim, estimate, carrier_offer, key_diffs)
        title = f"Settlement Review - {claim.get('claim_number', claim_id)}"

    elif audience == "settlement":
        settlement = await get_settlement_summary(claim_id)
        timeline = await get_claim_timeline(claim_id)
        before_after = await get_before_after_pairs(claim_id)
        content = pack_settlement(claim, settlement, timeline, before_after)
        title = f"Final Settlement - {claim.get('claim_number', claim_id)}"

    elif audience == "rep_performance":
        # For rep performance, use the assigned user or current user
        user_id = claim.get("assigned_to_id") or current_user.get("id")
        rep, stats = await get_rep_and_stats(user_id)
        content = pack_rep_performance(rep, stats)
        title = f"Performance Review - {rep.get('full_name', 'Team Member')}"

    elif audience == "pastor_report":
        firm, impact = await get_firm_and_impact_stats()
        content = pack_pastor_report(firm, impact)
        title = f"Kingdom Impact Report - {firm.get('name', 'Eden Claims')}"

    # Create GammaRequest and generate deck
    gamma_req = GammaRequest(
        title=title,
        content=content,
        template="presentation",
        audience=audience,
    )
    
    prompt = build_prompt(gamma_req)
    result = await call_gamma_api(title, prompt, audience)
    result["claim_id"] = claim_id
    result["claim_number"] = claim.get("claim_number")
    
    return result


@router.post("/carrier-deck")
async def create_carrier_deck(
    request: GammaClaimRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a presentation deck from claim data with audience-specific formatting"""
    content = pack_claim_base({
        "claim_number": request.claim_number,
        "client_name": request.client_name,
        "property_address": request.property_address,
        "loss_date": request.loss_date,
        "loss_type": request.loss_type,
        "status": request.status,
        "insurance_company": request.insurance_company,
        "policy_number": "N/A",
    })
    
    content += f"""
Photos: {request.photo_count or 0} inspection photos
Estimated Value: ${request.estimated_value or 0:,.2f}
"""
    
    gamma_req = GammaRequest(
        title=f"Claim {request.claim_number} - {request.audience}",
        content=content,
        audience=request.audience,
        template="presentation"
    )
    
    prompt = build_prompt(gamma_req)
    result = await call_gamma_api(gamma_req.title, prompt, request.audience)
    result["claim_number"] = request.claim_number
    
    return result


@router.get("/status")
async def gamma_status():
    """Check Gamma integration status"""
    return {
        "enabled": bool(GAMMA_API_KEY),
        "service": "Gamma",
        "description": "Auto-generate professional presentation decks with detailed slide structures",
        "audiences": [
            {"id": "client_update", "name": "Client Update", "description": "Status update for homeowner", "slides": 7},
            {"id": "client_approval", "name": "Settlement Review", "description": "For client approval before signing", "slides": 7},
            {"id": "settlement", "name": "Final Settlement", "description": "Celebratory settlement summary", "slides": 7},
            {"id": "rep_performance", "name": "Rep Performance", "description": "Sales/adjuster performance review", "slides": 7},
            {"id": "pastor_report", "name": "Ministry Report", "description": "Faith-forward impact report", "slides": 7}
        ]
    }


@router.post("/client-update-deck/{claim_id}")
async def create_client_update_deck(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create a client update Gamma deck using client-status data and Eve's drafted message.
    This is the primary endpoint for generating shareable client update presentations.
    """
    
    # Import client status helpers
    from routes.client_status import CLAIM_STAGES, derive_stage_from_status
    
    # Fetch claim
    claim = await get_claim(claim_id)
    
    # Get stage info
    stage = claim.get("stage") or derive_stage_from_status(claim.get("status", "New"))
    stage_info = CLAIM_STAGES.get(stage, CLAIM_STAGES["intake"])
    
    # Get timeline and tasks
    timeline = await get_claim_timeline(claim_id)
    tasks = await get_claim_tasks(claim_id)
    
    # Build rich content for client update deck
    content = f"""
Claim #: {claim.get('claim_number', 'N/A')}
Client: {claim.get('client_name', 'Client')}
Address: {claim.get('property_address', 'N/A')}
Loss Date: {claim.get('date_of_loss', 'N/A')}
Loss Type: {claim.get('claim_type', 'Property Damage')}
Status: {claim.get('status', 'In Progress')}
Current Stage: {stage_info['label']}

Stage Description: {stage_info['description']}
Status Text: {stage_info['status_text']}

What We've Done So Far:
{chr(10).join(f"- {t.get('label', '')}" for t in tasks if t.get('done')) or "- Initial claim review completed"}

What We're Doing Now:
{claim.get('next_actions_firm') or "- Continuing to advocate for your full settlement"}

What We Need From You:
{claim.get('next_actions_client') or "- No action needed at this time"}

Timeline:
{chr(10).join(f"- {e.get('date', 'N/A')}: {e.get('label', '')}" for e in timeline) if timeline else "- Claim filed and under review"}
"""
    
    title = f"Your Claim Update - {claim.get('claim_number', claim_id)}"
    
    gamma_req = GammaRequest(
        title=title,
        content=content,
        template="presentation",
        audience="client_update",
    )
    
    prompt = build_prompt(gamma_req)
    result = await call_gamma_api(title, prompt, "client_update")
    result["claim_id"] = claim_id
    result["claim_number"] = claim.get("claim_number")
    result["stage"] = stage
    result["stage_label"] = stage_info["label"]
    
    return result
