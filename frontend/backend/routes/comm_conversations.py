"""
Communications Center - Twilio Conversations Endpoints
Implements initWebchat-style flow and token refresh.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import db, get_current_active_user
from services.twilio_conversations import (
    is_conversations_configured,
    create_access_token,
    create_conversation,
    fetch_conversation,
    add_participant,
    send_system_message
)

router = APIRouter(prefix="/api/comm", tags=["communications"])


class InitConversationRequest(BaseModel):
    unique_name: str
    friendly_name: Optional[str] = None
    initial_message: Optional[str] = None
    attributes: Optional[dict] = None


class TokenResponse(BaseModel):
    token: str
    identity: str


@router.post("/conversations/init")
async def init_conversation(
    payload: InitConversationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    if not is_conversations_configured():
        raise HTTPException(status_code=500, detail="Twilio Conversations not configured")

    identity = current_user.get("id") or current_user.get("email")
    if not identity:
        raise HTTPException(status_code=400, detail="User identity not available")

    existing = await db.conversations.find_one(
        {"unique_name": payload.unique_name},
        {"_id": 0}
    )

    conversation_sid = existing.get("conversation_sid") if existing else None
    created = False

    if conversation_sid:
        if not fetch_conversation(conversation_sid):
            conversation_sid = None

    if not conversation_sid:
        conversation_sid = create_conversation(
            unique_name=payload.unique_name,
            friendly_name=payload.friendly_name,
            attributes=payload.attributes
        )
        if not conversation_sid:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        created = True

    add_participant(conversation_sid, identity)

    if payload.initial_message and created:
        send_system_message(conversation_sid, payload.initial_message)

    if created:
        await db.conversations.insert_one({
            "id": str(uuid.uuid4()),
            "unique_name": payload.unique_name,
            "conversation_sid": conversation_sid,
            "friendly_name": payload.friendly_name or payload.unique_name,
            "attributes": payload.attributes or {},
            "created_by_user_id": current_user.get("id"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    token = create_access_token(identity)
    if not token:
        raise HTTPException(status_code=500, detail="Failed to create access token")

    return {
        "token": token,
        "identity": identity,
        "conversation_sid": conversation_sid,
        "unique_name": payload.unique_name
    }


@router.get("/conversations/token", response_model=TokenResponse)
async def get_conversations_token(current_user: dict = Depends(get_current_active_user)):
    if not is_conversations_configured():
        raise HTTPException(status_code=500, detail="Twilio Conversations not configured")

    identity = current_user.get("id") or current_user.get("email")
    if not identity:
        raise HTTPException(status_code=400, detail="User identity not available")

    token = create_access_token(identity)
    if not token:
        raise HTTPException(status_code=500, detail="Failed to create access token")

    return {"token": token, "identity": identity}
