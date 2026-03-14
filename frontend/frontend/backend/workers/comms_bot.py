"""
Communication Assistant Bot Worker
Event-driven worker that helps with client communications.

Triggers:
- When inbound SMS received: Draft response notification
- When claim status changes: Suggest client update
- When documents received: Acknowledge and suggest next steps

Uses the shared AI service for intelligent response drafting.
Uses the shared notifications system to deliver message drafts.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Store database reference
_db: Optional[AsyncIOMotorDatabase] = None


def init_comms_bot(db: AsyncIOMotorDatabase):
    """Initialize the worker with database connection"""
    global _db
    _db = db
    logger.info("Communication Assistant Bot initialized")


def _is_db_initialized() -> bool:
    """Check if database is initialized"""
    return _db is not None


async def _draft_ai_response(claim_context: dict, inbound_message: str, user_id: str) -> Optional[dict]:
    """
    Use the shared AI service to draft a response.
    Returns dict with draft_text and audit_id, or None if AI unavailable.
    """
    try:
        from services.ai_service import draft_sms_reply
        result = await draft_sms_reply(
            claim_id=claim_context.get("claim_id", ""),
            claim_context=claim_context,
            inbound_message=inbound_message,
            user_id=user_id
        )
        return {
            "draft_text": result.draft_text,
            "audit_id": result.audit_id,
            "confidence": result.confidence,
            "warnings": result.warnings,
            "is_ai_draft": True
        }
    except Exception as e:
        logger.warning(f"AI draft failed, using template: {e}")
        return None


def _is_db_initialized() -> bool:
    """Check if database is initialized"""
    return _db is not None


# ============================================
# NOTIFICATION HELPER
# ============================================

async def _create_comms_notification(
    user_id: str,
    title: str,
    body: str,
    cta_label: str,
    cta_route: str,
    data: dict = None
):
    """Create a comms_bot notification using the shared system"""
    from routes.notifications import create_notification
    
    return await create_notification(
        user_id=user_id,
        type="comms_bot",
        title=title,
        body=body,
        cta_label=cta_label,
        cta_route=cta_route,
        data=data or {}
    )


# ============================================
# RESPONSE TEMPLATES
# ============================================

RESPONSE_TEMPLATES = {
    "confirm_appointment": "Great! Your appointment is confirmed. We'll see you on {date_time} at {address}. Reply HELP if you need anything.",
    "reschedule_request": "No problem! Let me find you a new time. What days work best for you this week?",
    "general_question": "Thanks for your message! I'm looking into this and will get back to you within 24 hours. Is there anything else you need right now?",
    "documents_received": "We received your documents for claim {claim_number}. Our team is reviewing them now. We'll update you within 2-3 business days.",
    "status_inquiry": "Your claim {claim_number} is currently {status}. {status_detail}",
    "payment_question": "I'll check on the payment status for claim {claim_number} and get back to you shortly.",
}


# ============================================
# SMART MESSAGE ANALYSIS
# ============================================

def analyze_inbound_message(message_body: str) -> Dict:
    """
    Analyze an inbound message to determine intent and suggest response.
    Simple keyword-based analysis (can be enhanced with AI later).
    """
    body_lower = message_body.lower().strip()
    
    # Check for appointment confirmation (Reply 1)
    if body_lower in ["1", "yes", "confirm", "confirmed", "ok"]:
        return {
            "intent": "confirm_appointment",
            "confidence": "high",
            "suggested_action": "confirm_appointment",
            "draft_template": "confirm_appointment"
        }
    
    # Check for reschedule request (Reply 2)
    if body_lower in ["2", "reschedule", "change", "different time", "can't make it"]:
        return {
            "intent": "reschedule_request",
            "confidence": "high",
            "suggested_action": "reschedule",
            "draft_template": "reschedule_request"
        }
    
    # Check for status inquiry
    status_keywords = ["status", "update", "where", "progress", "what's happening", "any news"]
    if any(kw in body_lower for kw in status_keywords):
        return {
            "intent": "status_inquiry",
            "confidence": "medium",
            "suggested_action": "provide_status",
            "draft_template": "status_inquiry"
        }
    
    # Check for payment-related
    payment_keywords = ["payment", "money", "check", "paid", "pay"]
    if any(kw in body_lower for kw in payment_keywords):
        return {
            "intent": "payment_question",
            "confidence": "medium",
            "suggested_action": "check_payment",
            "draft_template": "payment_question"
        }
    
    # Check for thank you / positive
    positive_keywords = ["thank", "thanks", "great", "perfect", "awesome", "appreciate"]
    if any(kw in body_lower for kw in positive_keywords):
        return {
            "intent": "positive_acknowledgment",
            "confidence": "high",
            "suggested_action": "no_response_needed",
            "draft_template": None
        }
    
    # Default: general question
    return {
        "intent": "general_question",
        "confidence": "low",
        "suggested_action": "review_and_respond",
        "draft_template": "general_question"
    }


# ============================================
# EVENT HANDLERS
# ============================================

async def on_inbound_sms(message_doc: dict):
    """
    Called when an inbound SMS is received.
    Analyzes the message and creates a notification with a suggested response.
    """
    if not _is_db_initialized():
        logger.error("Comms Bot: Database not initialized")
        return
    
    try:
        claim_id = message_doc.get("claim_id")
        message_body = message_doc.get("body", "")
        from_number = message_doc.get("from", "Unknown")
        
        if not claim_id:
            logger.debug("Comms Bot: Inbound SMS has no claim_id, skipping")
            return
        
        # Get claim details
        claim = await _db.claims.find_one({"id": claim_id}, {"_id": 0})
        if not claim:
            logger.warning(f"Comms Bot: Claim {claim_id} not found")
            return
        
        client_name = claim.get("client_name", "Client")
        claim_number = claim.get("claim_number", "N/A")
        adjuster_id = claim.get("assigned_to_id") or claim.get("created_by")
        
        if not adjuster_id:
            logger.warning(f"Comms Bot: No adjuster assigned to claim {claim_id}")
            return
        
        # Analyze the message
        analysis = analyze_inbound_message(message_body)
        
        # If no response needed, skip
        if analysis["suggested_action"] == "no_response_needed":
            logger.debug(f"Comms Bot: No response needed for message: {message_body[:50]}")
            return
        
        # Build draft response - try AI first, fall back to template
        draft_response = None
        ai_draft_info = None
        
        # Try AI-powered draft for medium/low confidence intents
        if analysis["confidence"] in ["medium", "low"]:
            claim_context = {
                "claim_id": claim_id,
                "claim_number": claim_number,
                "client_name": client_name,
                "status": claim.get("status", "In Progress"),
                "property_address": claim.get("property_address", ""),
                "claim_type": claim.get("claim_type", "")
            }
            ai_draft_info = await _draft_ai_response(claim_context, message_body, adjuster_id)
            if ai_draft_info:
                draft_response = ai_draft_info["draft_text"]
        
        # Fall back to template if no AI draft
        if not draft_response:
            draft_template = analysis.get("draft_template")
            if draft_template and draft_template in RESPONSE_TEMPLATES:
                template = RESPONSE_TEMPLATES[draft_template]
                draft_response = template.format(
                    claim_number=claim_number,
                    status=claim.get("status", "In Progress"),
                    status_detail=f"Next step: {_get_next_step_for_status(claim.get('status'))}",
                    date_time=claim.get("appointment_date", "[Date/Time]"),
                    address=claim.get("property_address", "[Address]")
                )
        
        # Create notification for adjuster
        title = f"Reply suggested for {client_name}"
        
        if analysis["confidence"] == "high":
            body = f'Client replied: "{message_body[:60]}..." Intent: {analysis["intent"].replace("_", " ").title()}'
        else:
            body = f'New message from {client_name}: "{message_body[:60]}..."'
        
        notification_data = {
            "claim_id": claim_id,
            "message_id": message_doc.get("id"),
            "from_number": from_number,
            "intent": analysis["intent"],
            "confidence": analysis["confidence"],
            "suggested_action": analysis["suggested_action"]
        }
        
        if draft_response:
            notification_data["draft_response"] = draft_response
        
        # Add AI draft metadata if available
        if ai_draft_info:
            notification_data["is_ai_draft"] = True
            notification_data["ai_audit_id"] = ai_draft_info.get("audit_id")
            notification_data["ai_confidence"] = ai_draft_info.get("confidence")
            if ai_draft_info.get("warnings"):
                notification_data["ai_warnings"] = ai_draft_info["warnings"]
        
        await _create_comms_notification(
            user_id=adjuster_id,
            title=title,
            body=body,
            cta_label="View & Reply",
            cta_route=f"/claims/{claim_id}?tab=messages",
            data=notification_data
        )
        
        logger.info(f"Comms Bot: Created reply suggestion for claim {claim_number}, intent: {analysis['intent']}")
        
    except Exception as e:
        logger.error(f"Comms Bot on_inbound_sms error: {e}")


async def on_status_change(claim_id: str, old_status: str, new_status: str, changer_name: str):
    """
    Called when a claim status changes.
    Suggests sending a client update.
    """
    if not _is_db_initialized():
        logger.error("Comms Bot: Database not initialized")
        return
    
    try:
        # Get claim details
        claim = await _db.claims.find_one({"id": claim_id}, {"_id": 0})
        if not claim:
            return
        
        client_name = claim.get("client_name", "Client")
        claim_number = claim.get("claim_number", "N/A")
        adjuster_id = claim.get("assigned_to_id") or claim.get("created_by")
        
        if not adjuster_id:
            return
        
        # Build suggested client message
        status_messages = {
            "In Progress": f"We've started working on your claim {claim_number}. We'll keep you updated on progress.",
            "Under Review": f"Your claim {claim_number} is now under review. We expect to have an update within 3-5 business days.",
            "Pending Documents": f"We need some additional documents for claim {claim_number}. Please check your email for details.",
            "Approved": f"Great news! Your claim {claim_number} has been approved. Payment details coming soon.",
            "Completed": f"Your claim {claim_number} is now complete. Thank you for choosing Care Claims!"
        }
        
        suggested_message = status_messages.get(new_status)
        
        if not suggested_message:
            return  # No notification for this status
        
        await _create_comms_notification(
            user_id=adjuster_id,
            title=f"Update {client_name}?",
            body=f"Claim moved to '{new_status}'. Consider sending an SMS update.",
            cta_label="Send Update",
            cta_route=f"/claims/{claim_id}?tab=messages",
            data={
                "claim_id": claim_id,
                "old_status": old_status,
                "new_status": new_status,
                "draft_response": suggested_message
            }
        )
        
        logger.info(f"Comms Bot: Suggested status update for claim {claim_number}")
        
    except Exception as e:
        logger.error(f"Comms Bot on_status_change error: {e}")


async def on_documents_received(claim_id: str, document_count: int, document_types: list = None):
    """
    Called when documents are uploaded to a claim.
    Suggests acknowledging receipt to the client.
    """
    if not _is_db_initialized():
        logger.error("Comms Bot: Database not initialized")
        return
    
    try:
        claim = await _db.claims.find_one({"id": claim_id}, {"_id": 0})
        if not claim:
            return
        
        client_name = claim.get("client_name", "Client")
        claim_number = claim.get("claim_number", "N/A")
        adjuster_id = claim.get("assigned_to_id") or claim.get("created_by")
        
        if not adjuster_id:
            return
        
        doc_desc = f"{document_count} document{'s' if document_count > 1 else ''}"
        if document_types:
            doc_desc = ", ".join(document_types[:3])
        
        suggested_message = RESPONSE_TEMPLATES["documents_received"].format(claim_number=claim_number)
        
        await _create_comms_notification(
            user_id=adjuster_id,
            title=f"Documents received from {client_name}",
            body=f"Received: {doc_desc}. Consider acknowledging receipt.",
            cta_label="View & Acknowledge",
            cta_route=f"/claims/{claim_id}?tab=documents",
            data={
                "claim_id": claim_id,
                "document_count": document_count,
                "document_types": document_types,
                "draft_response": suggested_message
            }
        )
        
        logger.info(f"Comms Bot: Suggested document acknowledgment for claim {claim_number}")
        
    except Exception as e:
        logger.error(f"Comms Bot on_documents_received error: {e}")


# ============================================
# HELPER FUNCTIONS
# ============================================

def _get_next_step_for_status(status: str) -> str:
    """Get the typical next step for a claim status"""
    next_steps = {
        "New": "Initial review and document gathering",
        "In Progress": "Field inspection and damage assessment",
        "Under Review": "Final review and decision",
        "Pending Documents": "Waiting for required documents",
        "Approved": "Payment processing",
        "Completed": "Claim closed - no further action needed"
    }
    return next_steps.get(status, "Continued processing")


# ============================================
# PERIODIC CHECK (for missed events)
# ============================================

async def run_periodic_check():
    """
    Periodic check for unresponded inbound messages.
    Runs every 2 hours to catch any missed event triggers.
    """
    if not _is_db_initialized():
        logger.error("Comms Bot: Database not initialized")
        return
    
    try:
        logger.info("Comms Bot: Running periodic check for unresponded messages")
        
        # Find inbound messages in last 24h without a follow-up outbound
        one_day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        
        # Get inbound messages
        inbound_messages = await _db.messages.find({
            "direction": "inbound",
            "created_at": {"$gte": one_day_ago},
            "claim_id": {"$ne": None}
        }, {"_id": 0}).to_list(100)
        
        for msg in inbound_messages:
            claim_id = msg.get("claim_id")
            msg_time = msg.get("created_at")
            
            # Check if there's an outbound response after this
            response = await _db.messages.find_one({
                "claim_id": claim_id,
                "direction": "outbound",
                "created_at": {"$gt": msg_time}
            })
            
            if not response:
                # No response yet - check if we already sent a notification
                existing_notif = await _db.notifications.find_one({
                    "type": "comms_bot",
                    "data.message_id": msg.get("id")
                })
                
                if not existing_notif:
                    # Create reminder notification
                    await on_inbound_sms(msg)
        
        logger.info("Comms Bot: Periodic check complete")
        
    except Exception as e:
        logger.error(f"Comms Bot periodic check error: {e}")
