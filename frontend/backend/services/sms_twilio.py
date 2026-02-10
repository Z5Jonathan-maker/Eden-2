"""
Twilio SMS Service
Handles sending and receiving SMS messages via Twilio Programmable Messaging.

Features:
- Send SMS via Messaging Service SID or From Number
- Dry-run mode for testing without sending real messages
- Webhook signature validation
- Error handling and logging
"""
import os
import logging
from typing import Optional, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Environment configuration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_MESSAGING_SERVICE_SID = os.environ.get("TWILIO_MESSAGING_SERVICE_SID")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
SMS_WEBHOOK_SECRET = os.environ.get("SMS_WEBHOOK_SECRET")

# Dry-run mode: if True, don't actually send SMS (for testing)
SMS_DRY_RUN = os.environ.get("SMS_DRY_RUN", "false").lower() == "true"

# Lazy-loaded Twilio client
_twilio_client = None


def get_twilio_client():
    """
    Get or create Twilio client (lazy initialization).
    Returns None if credentials not configured.
    """
    global _twilio_client
    
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured")
        return None
    
    if _twilio_client is None:
        try:
            from twilio.rest import Client
            _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            logger.info("Twilio client initialized")
        except ImportError:
            logger.error("Twilio package not installed. Run: pip install twilio")
            return None
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {e}")
            return None
    
    return _twilio_client


def is_configured() -> bool:
    """Check if Twilio is properly configured"""
    has_creds = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)
    has_sender = bool(TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER)
    return has_creds and has_sender


def get_config_status() -> dict:
    """Get current Twilio configuration status"""
    return {
        "configured": is_configured(),
        "has_account_sid": bool(TWILIO_ACCOUNT_SID),
        "has_auth_token": bool(TWILIO_AUTH_TOKEN),
        "has_messaging_service": bool(TWILIO_MESSAGING_SERVICE_SID),
        "has_from_number": bool(TWILIO_FROM_NUMBER),
        "dry_run_mode": SMS_DRY_RUN,
        "sender": TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER or "NOT CONFIGURED"
    }


async def send_sms(
    to: str,
    body: str,
    media_url: Optional[str] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Send an SMS message via Twilio.
    
    Args:
        to: Recipient phone number (E.164 format, e.g., +1XXXXXXXXXX)
        body: Message text (max 1600 chars for SMS, longer = multiple segments)
        media_url: Optional URL for MMS media attachment
    
    Returns:
        Tuple of (success: bool, message_sid_or_error: str, status: str|None)
        - On success: (True, twilio_message_sid, "sent")
        - On dry-run: (True, "dry-run-{timestamp}", "sent")
        - On error: (False, error_message, None)
    """
    # Validate phone number format
    if not to or not to.startswith("+"):
        return (False, "Invalid phone number format. Use E.164 format (+1XXXXXXXXXX)", None)
    
    # Validate message body
    if not body or len(body.strip()) == 0:
        return (False, "Message body cannot be empty", None)
    
    # Dry-run mode - don't actually send
    if SMS_DRY_RUN:
        dry_run_sid = f"dry-run-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        logger.info(f"[DRY-RUN] Would send SMS to {to}: {body[:50]}...")
        return (True, dry_run_sid, "sent")
    
    # Check configuration
    if not is_configured():
        return (False, "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER", None)
    
    # Get client
    client = get_twilio_client()
    if not client:
        return (False, "Failed to initialize Twilio client", None)
    
    try:
        # Build message kwargs
        kwargs = {
            "to": to,
            "body": body
        }
        
        # Add sender (prefer Messaging Service SID)
        if TWILIO_MESSAGING_SERVICE_SID:
            kwargs["messaging_service_sid"] = TWILIO_MESSAGING_SERVICE_SID
        else:
            kwargs["from_"] = TWILIO_FROM_NUMBER
        
        # Add media URL for MMS if provided
        if media_url:
            kwargs["media_url"] = [media_url]
        
        # Send the message
        message = client.messages.create(**kwargs)
        
        logger.info(f"SMS sent successfully to {to}, SID: {message.sid}")
        return (True, message.sid, message.status)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send SMS to {to}: {error_msg}")
        return (False, error_msg, None)


def validate_twilio_signature(url: str, params: dict, signature: str) -> bool:
    """
    Validate Twilio webhook signature to ensure request authenticity.
    
    Args:
        url: Full webhook URL
        params: Request form parameters
        signature: X-Twilio-Signature header value
    
    Returns:
        True if signature is valid, False otherwise
    """
    if not TWILIO_AUTH_TOKEN:
        logger.warning("Cannot validate Twilio signature - auth token not configured")
        return False
    
    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(TWILIO_AUTH_TOKEN)
        return validator.validate(url, params, signature)
    except ImportError:
        logger.error("Twilio package not installed")
        return False
    except Exception as e:
        logger.error(f"Signature validation error: {e}")
        return False


def format_phone_number(phone: str) -> str:
    """
    Attempt to format a phone number to E.164 format.
    This is a basic implementation - for production, consider using phonenumbers library.
    
    Args:
        phone: Input phone number in various formats
    
    Returns:
        Phone number in E.164 format (+1XXXXXXXXXX) or original if can't format
    """
    if not phone:
        return phone
    
    # Already in E.164 format
    if phone.startswith("+"):
        return phone
    
    # Remove common characters
    cleaned = "".join(c for c in phone if c.isdigit())
    
    # US number without country code (10 digits)
    if len(cleaned) == 10:
        return f"+1{cleaned}"
    
    # US number with country code (11 digits starting with 1)
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"
    
    # Can't determine format, return with + prefix
    return f"+{cleaned}" if cleaned else phone


# SMS Templates for common messages (Care Claims branding)
SMS_TEMPLATES = {
    "fnol_created": {
        "name": "FNOL Created",
        "template": "Hi {first_name}, this is Care Claims. We've opened your claim {claim_number}. You can check status here: {status_link}"
    },
    "appointment_scheduled": {
        "name": "Appointment Scheduled",
        "template": "Hi {first_name}, this is Care Claims. Your inspection for claim {claim_number} is scheduled for {date_time} at {address}. Reply 1 to confirm or 2 to request changes."
    },
    "appointment_reminder": {
        "name": "Appointment Reminder",
        "template": "Hi {first_name}, this is Care Claims. Reminder: Your inspection for claim {claim_number} is tomorrow at {time}. See you at {address}!"
    },
    "photos_requested": {
        "name": "Photos Requested",
        "template": "Hi {first_name}, this is Care Claims. We need a few photos to move your claim {claim_number} forward. Tap here to upload: {rapid_capture_link}"
    },
    "payment_issued": {
        "name": "Payment Issued",
        "template": "Hi {first_name}, great news from Care Claims! A payment has been issued on your claim {claim_number}. Details: {payment_link}"
    },
    "status_update": {
        "name": "Status Update",
        "template": "Hi {first_name}, Care Claims update on claim {claim_number}: {status_message}"
    }
}


def render_template(template_key: str, **kwargs) -> Optional[str]:
    """
    Render an SMS template with provided values.
    
    Args:
        template_key: Key from SMS_TEMPLATES
        **kwargs: Values to substitute in template
    
    Returns:
        Rendered message or None if template not found
    """
    template = SMS_TEMPLATES.get(template_key)
    if not template:
        logger.warning(f"SMS template not found: {template_key}")
        return None
    
    try:
        return template["template"].format(**kwargs)
    except KeyError as e:
        logger.error(f"Missing template variable: {e}")
        return None
