"""
Client Status API Routes - Client-facing claim status and Eve-generated updates
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/client-status", tags=["Client Status"])
logger = logging.getLogger(__name__)


def mask_name(name: str) -> str:
    """Partially mask client name for privacy (show first name + last initial)"""
    if not name:
        return "Client"
    parts = name.strip().split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}." if parts[-1] else parts[0]


def mask_address(address: str) -> str:
    """Partially mask address for privacy (show city/state only)"""
    if not address:
        return "Florida"
    parts = address.split(',')
    if len(parts) >= 2:
        return ', '.join(parts[-2:]).strip()
    return address


@router.get("/claim/{claim_id}/public")
async def get_public_claim_status(claim_id: str):
    """
    Public endpoint for clients to check claim status via status link.
    NO AUTHENTICATION REQUIRED - accessed via unique claim ID in SMS/email.
    Returns limited, client-safe information only.
    """
    try:
        claim = await db.claims.find_one(
            {"id": claim_id},
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, 
             "property_address": 1, "claim_type": 1, "status": 1, "stage": 1,
             "next_actions_client": 1, "next_actions_firm": 1, 
             "last_client_update_at": 1, "created_at": 1}
        )
        
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        
        # Map status to stage
        stage = claim.get("stage") or derive_stage_from_status(claim.get("status", "New"))
        
        return {
            "claim_number": claim.get("claim_number"),
            "client_name": mask_name(claim.get("client_name", "")),
            "property_address": mask_address(claim.get("property_address", "")),
            "claim_type": claim.get("claim_type"),
            "stage": stage,
            "next_actions_client": claim.get("next_actions_client"),
            "next_actions_firm": claim.get("next_actions_firm"),
            "last_client_update_at": claim.get("last_client_update_at") or claim.get("created_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Public status lookup error: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve claim status")

# Stage definitions with display info
CLAIM_STAGES = {
    "intake": {
        "order": 1,
        "label": "Intake",
        "description": "We're gathering information about your claim.",
        "status_text": "We've received your claim and are gathering initial information."
    },
    "inspection": {
        "order": 2,
        "label": "Inspection",
        "description": "We're documenting and assessing the damage.",
        "status_text": "We've completed or scheduled your inspection and are documenting the damage."
    },
    "negotiation": {
        "order": 3,
        "label": "Negotiation",
        "description": "We're working with your insurance carrier on your settlement.",
        "status_text": "We're actively negotiating with your insurance carrier for the best possible settlement."
    },
    "settlement": {
        "order": 4,
        "label": "Settlement",
        "description": "Your claim is being finalized.",
        "status_text": "Great news! We're finalizing your settlement and processing the paperwork."
    },
    "closed": {
        "order": 5,
        "label": "Closed",
        "description": "Your claim has been resolved.",
        "status_text": "Your claim has been successfully resolved. Thank you for trusting us with your claim."
    }
}


class ClientStatusResponse(BaseModel):
    claim_id: str
    claim_number: str
    client_name: str
    stage: str
    stage_label: str
    stage_order: int
    total_stages: int = 5
    status_text: str
    next_actions_firm: Optional[str] = None
    next_actions_client: Optional[str] = None
    last_client_update_at: Optional[str] = None
    property_address: str
    date_of_loss: str
    claim_type: str


class ClientUpdateRequest(BaseModel):
    tone: str = "encouraging"  # encouraging, professional, urgent


class ClientUpdateResponse(BaseModel):
    message: str
    suggested_subject: str
    stage: str
    stage_label: str
    updated_next_actions_firm: Optional[str] = None
    updated_next_actions_client: Optional[str] = None
    claim_number: str


def derive_stage_from_status(status: str) -> str:
    """Derive claim stage from status for backwards compatibility"""
    status_lower = status.lower() if status else "new"
    
    if status_lower in ["new", "pending"]:
        return "intake"
    elif status_lower in ["in progress", "inspection scheduled", "inspecting"]:
        return "inspection"
    elif status_lower in ["under review", "negotiating", "supplement"]:
        return "negotiation"
    elif status_lower in ["approved", "settling"]:
        return "settlement"
    elif status_lower in ["completed", "closed", "paid"]:
        return "closed"
    else:
        return "intake"


@router.get("/claim/{claim_id}", response_model=ClientStatusResponse)
async def get_client_status(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get client-friendly status for a claim"""
    
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Check access for client role
    user_role = current_user.get("role", "client")
    if user_role == "client":
        # Clients can only see their own claims (by email match)
        if claim.get("client_email") != current_user.get("email"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get stage (use explicit stage or derive from status)
    stage = claim.get("stage") or derive_stage_from_status(claim.get("status", "New"))
    stage_info = CLAIM_STAGES.get(stage, CLAIM_STAGES["intake"])
    
    # Build status text
    status_text = stage_info["status_text"]
    
    # Add custom next actions if available
    next_firm = claim.get("next_actions_firm")
    next_client = claim.get("next_actions_client")
    
    # Format last update date
    last_update = claim.get("last_client_update_at")
    last_update_str = None
    if last_update:
        if isinstance(last_update, str):
            last_update_str = last_update
        else:
            last_update_str = last_update.isoformat()
    
    return ClientStatusResponse(
        claim_id=claim_id,
        claim_number=claim.get("claim_number", "N/A"),
        client_name=claim.get("client_name", "Client"),
        stage=stage,
        stage_label=stage_info["label"],
        stage_order=stage_info["order"],
        status_text=status_text,
        next_actions_firm=next_firm,
        next_actions_client=next_client,
        last_client_update_at=last_update_str,
        property_address=claim.get("property_address", ""),
        date_of_loss=claim.get("date_of_loss", ""),
        claim_type=claim.get("claim_type", "")
    )


@router.post("/claim/{claim_id}/update", response_model=ClientUpdateResponse)
async def generate_client_update(
    claim_id: str,
    request: ClientUpdateRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate an Eve-written client update message"""
    
    # Only adjusters, managers, admins can generate updates
    user_role = current_user.get("role", "client")
    if user_role == "client":
        raise HTTPException(status_code=403, detail="Clients cannot generate updates")
    
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get stage
    stage = claim.get("stage") or derive_stage_from_status(claim.get("status", "New"))
    stage_info = CLAIM_STAGES.get(stage, CLAIM_STAGES["intake"])
    
    # Get recent notes for context
    notes = await db.claim_notes.find(
        {"claim_id": claim_id},
        {"_id": 0, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    notes_context = ""
    if notes:
        notes_context = "\n".join([f"- {n.get('content', '')[:200]}" for n in notes])
    
    # Build prompt for Eve
    tone_instruction = {
        "encouraging": "Be warm, reassuring, and faith-forward. Emphasize progress and our commitment to the client.",
        "professional": "Be clear, professional, and factual. Focus on the process and next steps.",
        "urgent": "Be direct and action-oriented. Emphasize what needs to happen now."
    }.get(request.tone, "Be warm, reassuring, and professional.")
    
    prompt = f"""Write a 2-3 paragraph plain-language update for a homeowner about their insurance claim.

CLAIM DETAILS:
- Client Name: {claim.get('client_name', 'Client')}
- Claim Number: {claim.get('claim_number', 'N/A')}
- Property: {claim.get('property_address', 'N/A')}
- Loss Date: {claim.get('date_of_loss', 'N/A')}
- Claim Type: {claim.get('claim_type', 'Property Damage')}
- Current Stage: {stage_info['label']} - {stage_info['description']}
- Status: {claim.get('status', 'In Progress')}
- Estimated Value: ${claim.get('estimated_value', 0):,.2f}

RECENT ACTIVITY:
{notes_context if notes_context else "- Initial claim review in progress"}

INSTRUCTIONS:
{tone_instruction}

Include in your response:
1. A greeting with the client's first name
2. Where their claim currently stands (in plain language)
3. What we are actively doing for them
4. What happens next
5. What we need from them (if anything)
6. A reassuring closing

Do NOT include:
- Legal jargon or insurance terminology
- Specific dollar amounts unless relevant
- Internal process details
- Anything that might worry the client unnecessarily

Format the response as a friendly message that could be sent via email or text."""

    # Call Eve AI
    try:
        import os
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
        
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=503, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"client-update-{claim_id}",
            system_message="You are Eve, a friendly and professional claims assistant helping public adjusters communicate with their clients. You write clear, encouraging updates that keep homeowners informed without overwhelming them with technical details."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=prompt)
        eve_response = await chat.send_message(user_message)
        
    except Exception as e:
        logger.error(f"Eve AI error: {e}")
        # Fallback to template-based message
        eve_response = f"""Hi {claim.get('client_name', 'there').split()[0]},

I wanted to give you a quick update on your claim (#{claim.get('claim_number', 'N/A')}).

Your claim is currently in the {stage_info['label'].lower()} stage. {stage_info['status_text']}

We're working hard to ensure you receive the full settlement you deserve. Our team is reviewing all documentation and advocating on your behalf.

If you have any questions, please don't hesitate to reach out. We're here for you every step of the way.

Best regards,
Your Claims Team"""
    
    # Generate next actions based on stage
    next_actions_firm = {
        "intake": "Complete initial documentation review and schedule inspection.",
        "inspection": "Finalize damage assessment and prepare estimate for carrier submission.",
        "negotiation": "Continue negotiating with carrier for full settlement value.",
        "settlement": "Process settlement paperwork and coordinate payment.",
        "closed": "File archived. Available for any follow-up questions."
    }.get(stage, "Continue processing claim.")
    
    next_actions_client = {
        "intake": "Please send any photos, receipts, or contractor bids you have.",
        "inspection": "No action needed. We'll contact you after completing our assessment.",
        "negotiation": "Please let us know if you receive any communication from your carrier.",
        "settlement": "Please review and sign the settlement documents when received.",
        "closed": "No action needed. Thank you for trusting us with your claim!"
    }.get(stage, "No immediate action needed.")
    
    # Update claim with new next actions and timestamp
    now = datetime.now(timezone.utc).isoformat()
    await db.claims.update_one(
        {"id": claim_id},
        {
            "$set": {
                "next_actions_firm": next_actions_firm,
                "next_actions_client": next_actions_client,
                "last_client_update_at": now,
                "stage": stage,
                "updated_at": now
            }
        }
    )
    
    # Generate suggested email subject
    subject = f"Update on Your Insurance Claim #{claim.get('claim_number', 'N/A')}"
    
    return ClientUpdateResponse(
        message=eve_response,
        suggested_subject=subject,
        stage=stage,
        stage_label=stage_info["label"],
        updated_next_actions_firm=next_actions_firm,
        updated_next_actions_client=next_actions_client,
        claim_number=claim.get("claim_number", "N/A")
    )


@router.get("/stages")
async def get_claim_stages():
    """Get all claim stage definitions"""
    return {
        "stages": [
            {
                "id": stage_id,
                "order": info["order"],
                "label": info["label"],
                "description": info["description"]
            }
            for stage_id, info in sorted(CLAIM_STAGES.items(), key=lambda x: x[1]["order"])
        ]
    }


@router.patch("/claim/{claim_id}/stage")
async def update_claim_stage(
    claim_id: str,
    stage: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Update claim stage (admin/manager/adjuster only)"""
    
    user_role = current_user.get("role", "client")
    if user_role == "client":
        raise HTTPException(status_code=403, detail="Clients cannot update claim stage")
    
    if stage not in CLAIM_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Valid stages: {', '.join(CLAIM_STAGES.keys())}")
    
    result = await db.claims.update_one(
        {"id": claim_id},
        {
            "$set": {
                "stage": stage,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    return {
        "message": "Stage updated successfully",
        "stage": stage,
        "stage_label": CLAIM_STAGES[stage]["label"]
    }
