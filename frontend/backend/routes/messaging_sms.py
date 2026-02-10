"""
SMS Messaging API Routes
Handles sending and receiving SMS messages per claim via Twilio.

Endpoints:
- POST /api/claims/{claim_id}/messages/sms/send - Send SMS to client
- GET /api/claims/{claim_id}/messages - Get message history for claim
- POST /api/sms/twilio/webhook - Receive inbound SMS and status updates
- GET /api/sms/status - Check Twilio configuration status
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Request, Query, Form
from pydantic import BaseModel

from dependencies import db, get_current_active_user
from services.sms_twilio import (
    send_sms, 
    is_configured, 
    get_config_status,
    validate_twilio_signature,
    format_phone_number,
    render_template,
    SMS_TEMPLATES,
    SMS_WEBHOOK_SECRET
)
from routes.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SMS Messaging"])

# Rate limiting: max messages per claim per hour
MAX_SMS_PER_CLAIM_PER_HOUR = 10


# ============================================
# MODELS
# ============================================

class SendSMSRequest(BaseModel):
    """Request body for sending an SMS"""
    to: str  # E.164 format phone number
    body: str  # Message content
    template_key: Optional[str] = None  # Optional template to use
    template_vars: Optional[dict] = None  # Variables for template


class SendSMSResponse(BaseModel):
    """Response after sending SMS"""
    id: str
    claim_id: str
    status: str
    provider_message_id: Optional[str]
    to: str
    body: str
    created_at: str


class MessageResponse(BaseModel):
    """Individual message in response"""
    id: str
    claim_id: str
    channel: str
    direction: str
    to: str
    from_: Optional[str]
    body: str
    status: str
    provider_message_id: Optional[str]
    created_by_user_id: Optional[str]
    created_by_name: Optional[str]
    created_at: str


# ============================================
# SMS SEND ENDPOINT
# ============================================

@router.post("/api/claims/{claim_id}/messages/sms/send")
async def send_claim_sms(
    claim_id: str,
    request: SendSMSRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Send an SMS message to a client for a specific claim.
    
    - Validates claim access
    - Checks rate limits
    - Logs message to database
    - Sends via Twilio (or dry-run)
    """
    user_id = current_user.get("id")
    user_name = current_user.get("full_name", "Unknown")
    
    # 1. Verify claim exists and user has access
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # 2. Check rate limiting
    one_hour_ago = (datetime.now(timezone.utc) - __import__('datetime').timedelta(hours=1)).isoformat()
    recent_count = await db.messages.count_documents({
        "claim_id": claim_id,
        "direction": "outbound",
        "created_at": {"$gte": one_hour_ago}
    })
    
    if recent_count >= MAX_SMS_PER_CLAIM_PER_HOUR:
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Max {MAX_SMS_PER_CLAIM_PER_HOUR} SMS per claim per hour."
        )
    
    # 3. Format phone number
    to_number = format_phone_number(request.to)
    
    # 4. Determine message body
    if request.template_key and request.template_key in SMS_TEMPLATES:
        # Use template with provided variables
        template_vars = request.template_vars or {}
        # Add claim info to template vars
        template_vars.setdefault("claim_number", claim.get("claim_number", "N/A"))
        template_vars.setdefault("first_name", claim.get("client_name", "").split()[0] if claim.get("client_name") else "Client")
        
        body = render_template(request.template_key, **template_vars)
        if not body:
            raise HTTPException(status_code=400, detail=f"Failed to render template: {request.template_key}")
    else:
        body = request.body
    
    # Validate body
    if not body or len(body.strip()) == 0:
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    
    # 5. Create message record (queued)
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    message_doc = {
        "id": message_id,
        "claim_id": claim_id,
        "channel": "sms",
        "direction": "outbound",
        "to": to_number,
        "from": None,  # Will be set by Twilio
        "body": body,
        "status": "queued",
        "provider_message_id": None,
        "created_by_user_id": user_id,
        "created_by_name": user_name,
        "created_at": now,
        "updated_at": now,
        "template_key": request.template_key
    }
    
    await db.messages.insert_one(message_doc)
    
    # 6. Send via Twilio
    success, result, status = await send_sms(to_number, body)
    
    if success:
        # Update message with success status
        await db.messages.update_one(
            {"id": message_id},
            {
                "$set": {
                    "status": status or "sent",
                    "provider_message_id": result,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"SMS sent for claim {claim_id} by user {user_name}: {result}")
        
        return {
            "id": message_id,
            "claim_id": claim_id,
            "status": status or "sent",
            "provider_message_id": result,
            "to": to_number,
            "body": body,
            "created_at": now
        }
    else:
        # Update message with failure status
        await db.messages.update_one(
            {"id": message_id},
            {
                "$set": {
                    "status": "failed",
                    "error": result,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.error(f"SMS failed for claim {claim_id}: {result}")
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {result}")


# ============================================
# GET MESSAGES ENDPOINT
# ============================================

@router.get("/api/claims/{claim_id}/messages")
async def get_claim_messages(
    claim_id: str,
    channel: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get message history for a claim.
    Returns messages ordered by created_at ascending (chronological).
    """
    # Verify claim exists
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "id": 1})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Build query
    query = {"claim_id": claim_id}
    if channel:
        query["channel"] = channel
    
    # Get total count
    total = await db.messages.count_documents(query)
    
    # Get messages (chronological order for chat display)
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "messages": messages,
        "total": total,
        "limit": limit,
        "skip": skip,
        "claim_id": claim_id
    }


# ============================================
# TWILIO WEBHOOK ENDPOINT
# ============================================

@router.post("/api/sms/twilio/webhook")
async def twilio_webhook(
    request: Request,
    # Twilio sends form data
    From: str = Form(None),
    To: str = Form(None),
    Body: str = Form(None),
    MessageSid: str = Form(None),
    MessageStatus: str = Form(None),
    SmsStatus: str = Form(None),
    AccountSid: str = Form(None),
    # Optional secret for basic validation
    secret: Optional[str] = Query(None)
):
    """
    Twilio webhook for receiving inbound SMS and status updates.
    
    Configure in Twilio console:
    - Messaging webhook URL: {BASE_URL}/api/sms/twilio/webhook
    - Status callback URL: {BASE_URL}/api/sms/twilio/webhook
    
    For security:
    - Set SMS_WEBHOOK_SECRET env var
    - Pass ?secret={SMS_WEBHOOK_SECRET} in webhook URL
    - Or implement full Twilio signature validation
    """
    # Basic secret validation (if configured)
    if SMS_WEBHOOK_SECRET and secret != SMS_WEBHOOK_SECRET:
        logger.warning(f"Twilio webhook called with invalid secret")
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
    
    # Optional: Full Twilio signature validation
    # signature = request.headers.get("X-Twilio-Signature", "")
    # form_data = await request.form()
    # url = str(request.url)
    # if not validate_twilio_signature(url, dict(form_data), signature):
    #     raise HTTPException(status_code=403, detail="Invalid signature")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Handle status update (delivered, failed, etc.)
    status = MessageStatus or SmsStatus
    if status and MessageSid:
        # Find and update existing message
        result = await db.messages.update_one(
            {"provider_message_id": MessageSid},
            {
                "$set": {
                    "status": status.lower(),
                    "updated_at": now
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated message {MessageSid} status to {status}")
        else:
            logger.debug(f"No message found for SID {MessageSid}")
        
        return {"status": "ok", "action": "status_update"}
    
    # Handle inbound SMS
    if From and Body:
        logger.info(f"Inbound SMS from {From}: {Body[:50]}...")
        
        # Try to find claim by client phone number
        # First, try to find in recent outbound messages
        recent_outbound = await db.messages.find_one(
            {
                "to": From,
                "direction": "outbound"
            },
            {"_id": 0, "claim_id": 1},
            sort=[("created_at", -1)]
        )
        
        claim_id = None
        claim = None
        
        if recent_outbound:
            claim_id = recent_outbound.get("claim_id")
            claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
        
        # If not found, try to match by client phone in claims
        if not claim_id:
            # Search for claims with matching phone
            claim = await db.claims.find_one(
                {
                    "$or": [
                        {"client_phone": From},
                        {"client_phone": From.replace("+1", "")},
                        {"client_phone": From[2:]}  # Remove +1 prefix
                    ]
                },
                {"_id": 0}
            )
            if claim:
                claim_id = claim.get("id")
        
        # Create inbound message record
        message_id = str(uuid.uuid4())
        message_doc = {
            "id": message_id,
            "claim_id": claim_id,  # May be None if no matching claim
            "channel": "sms",
            "direction": "inbound",
            "to": To,
            "from": From,
            "body": Body,
            "status": "received",
            "provider_message_id": MessageSid,
            "created_by_user_id": None,  # Inbound from client
            "created_at": now,
            "updated_at": now
        }
        
        await db.messages.insert_one(message_doc)
        
        # Trigger Communication Assistant Bot for smart analysis
        try:
            from workers.comms_bot import on_inbound_sms
            await on_inbound_sms(message_doc)
        except Exception as comms_err:
            logger.warning(f"Comms Bot analysis failed (non-blocking): {comms_err}")
        
        logger.info(f"Stored inbound SMS {message_id} from {From}, claim: {claim_id or 'unmatched'}")
        
        return {"status": "ok", "action": "inbound_received", "claim_id": claim_id}
    
    logger.debug("Webhook called with no actionable data")
    return {"status": "ok", "action": "none"}


# ============================================
# STATUS & TEMPLATES ENDPOINTS
# ============================================

@router.get("/api/sms/status")
async def get_sms_status(current_user: dict = Depends(get_current_active_user)):
    """
    Get Twilio SMS configuration status.
    Only accessible to authenticated users.
    """
    return get_config_status()


@router.get("/api/sms/templates")
async def get_sms_templates(current_user: dict = Depends(get_current_active_user)):
    """
    Get available SMS templates.
    """
    templates = []
    for key, template in SMS_TEMPLATES.items():
        templates.append({
            "key": key,
            "name": template["name"],
            "template": template["template"],
            "variables": _extract_template_variables(template["template"])
        })
    
    return {"templates": templates}


def _extract_template_variables(template: str) -> List[str]:
    """Extract variable names from template string"""
    import re
    return re.findall(r'\{(\w+)\}', template)


# ============================================
# SEND SMS FROM DOMAIN EVENTS
# ============================================

async def send_fnol_sms(claim_id: str, to_phone: str, status_link: str):
    """
    Send FNOL created SMS notification.
    Called when a new claim is created.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        logger.error(f"Claim not found for FNOL SMS: {claim_id}")
        return
    
    first_name = claim.get("client_name", "").split()[0] if claim.get("client_name") else "Client"
    claim_number = claim.get("claim_number", "N/A")
    
    body = render_template(
        "fnol_created",
        first_name=first_name,
        claim_number=claim_number,
        status_link=status_link
    )
    
    if body:
        success, result, _ = await send_sms(to_phone, body)
        if success:
            # Log the message
            await _log_system_sms(claim_id, to_phone, body, result, "fnol_created")


async def send_appointment_sms(claim_id: str, to_phone: str, date_time: str, address: str):
    """
    Send appointment scheduled SMS.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        return
    
    first_name = claim.get("client_name", "").split()[0] if claim.get("client_name") else "Client"
    
    body = render_template(
        "appointment_scheduled",
        first_name=first_name,
        claim_number=claim.get("claim_number", "N/A"),
        date_time=date_time,
        address=address
    )
    
    if body:
        success, result, _ = await send_sms(to_phone, body)
        if success:
            await _log_system_sms(claim_id, to_phone, body, result, "appointment_scheduled")


async def send_photos_request_sms(claim_id: str, to_phone: str, rapid_capture_link: str):
    """
    Send photos requested SMS.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        return
    
    first_name = claim.get("client_name", "").split()[0] if claim.get("client_name") else "Client"
    
    body = render_template(
        "photos_requested",
        first_name=first_name,
        claim_number=claim.get("claim_number", "N/A"),
        rapid_capture_link=rapid_capture_link
    )
    
    if body:
        success, result, _ = await send_sms(to_phone, body)
        if success:
            await _log_system_sms(claim_id, to_phone, body, result, "photos_requested")


async def send_payment_sms(claim_id: str, to_phone: str, payment_link: str):
    """
    Send payment issued SMS.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        return
    
    first_name = claim.get("client_name", "").split()[0] if claim.get("client_name") else "Client"
    
    body = render_template(
        "payment_issued",
        first_name=first_name,
        claim_number=claim.get("claim_number", "N/A"),
        payment_link=payment_link
    )
    
    if body:
        success, result, _ = await send_sms(to_phone, body)
        if success:
            await _log_system_sms(claim_id, to_phone, body, result, "payment_issued")


async def _log_system_sms(
    claim_id: str,
    to_phone: str,
    body: str,
    provider_sid: str,
    template_key: str
):
    """Log a system-initiated SMS to the messages collection"""
    message_doc = {
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "channel": "sms",
        "direction": "outbound",
        "to": to_phone,
        "from": None,
        "body": body,
        "status": "sent",
        "provider_message_id": provider_sid,
        "created_by_user_id": "system",
        "created_by_name": "Eden System",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "template_key": template_key
    }
    
    await db.messages.insert_one(message_doc)
