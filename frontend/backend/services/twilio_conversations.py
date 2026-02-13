"""
Twilio Conversations Service Helpers
Handles conversation creation and access tokens.
"""
import json
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_CONVERSATIONS_SERVICE_SID = os.environ.get("TWILIO_CONVERSATIONS_SERVICE_SID")
TWILIO_API_KEY = os.environ.get("TWILIO_API_KEY")
TWILIO_API_SECRET = os.environ.get("TWILIO_API_SECRET")

_twilio_client = None


def _get_twilio_client():
    global _twilio_client

    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured for Conversations")
        return None

    if _twilio_client is None:
        try:
            from twilio.rest import Client
            _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        except Exception as exc:
            logger.error(f"Failed to initialize Twilio client: {exc}")
            return None

    return _twilio_client


def is_conversations_configured() -> bool:
    return bool(
        TWILIO_ACCOUNT_SID
        and TWILIO_AUTH_TOKEN
        and TWILIO_CONVERSATIONS_SERVICE_SID
        and TWILIO_API_KEY
        and TWILIO_API_SECRET
    )


def create_access_token(identity: str) -> Optional[str]:
    if not is_conversations_configured():
        return None

    try:
        from twilio.jwt.access_token import AccessToken
        from twilio.jwt.access_token.grants import ConversationsGrant

        token = AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY,
            TWILIO_API_SECRET,
            identity=identity
        )
        token.add_grant(ConversationsGrant(service_sid=TWILIO_CONVERSATIONS_SERVICE_SID))
        jwt_token = token.to_jwt()
        return jwt_token.decode("utf-8") if isinstance(jwt_token, bytes) else jwt_token
    except Exception as exc:
        logger.error(f"Failed to create Conversations token: {exc}")
        return None


def create_conversation(
    unique_name: str,
    friendly_name: Optional[str] = None,
    attributes: Optional[dict] = None
) -> Optional[str]:
    client = _get_twilio_client()
    if not client or not TWILIO_CONVERSATIONS_SERVICE_SID:
        return None

    payload = {"unique_name": unique_name}
    if friendly_name:
        payload["friendly_name"] = friendly_name
    if attributes is not None:
        payload["attributes"] = json.dumps(attributes)

    try:
        conversation = client.conversations.v1.services(
            TWILIO_CONVERSATIONS_SERVICE_SID
        ).conversations.create(**payload)
        return conversation.sid
    except Exception as exc:
        logger.error(f"Failed to create conversation: {exc}")
        return None


def fetch_conversation(conversation_sid: str) -> bool:
    client = _get_twilio_client()
    if not client or not TWILIO_CONVERSATIONS_SERVICE_SID:
        return False

    try:
        client.conversations.v1.services(
            TWILIO_CONVERSATIONS_SERVICE_SID
        ).conversations(conversation_sid).fetch()
        return True
    except Exception:
        return False


def add_participant(conversation_sid: str, identity: str) -> bool:
    client = _get_twilio_client()
    if not client or not TWILIO_CONVERSATIONS_SERVICE_SID:
        return False

    try:
        client.conversations.v1.services(
            TWILIO_CONVERSATIONS_SERVICE_SID
        ).conversations(conversation_sid).participants.create(identity=identity)
        return True
    except Exception as exc:
        if "Participant already exists" in str(exc):
            return True
        logger.warning(f"Failed to add participant: {exc}")
        return False


def send_system_message(conversation_sid: str, body: str, author: str = "system") -> bool:
    client = _get_twilio_client()
    if not client or not TWILIO_CONVERSATIONS_SERVICE_SID:
        return False

    try:
        client.conversations.v1.services(
            TWILIO_CONVERSATIONS_SERVICE_SID
        ).conversations(conversation_sid).messages.create(author=author, body=body)
        return True
    except Exception as exc:
        logger.warning(f"Failed to send system message: {exc}")
        return False
