"""
Communications Center - Twilio Conversations Endpoints
Implements initWebchat-style flow and token refresh.
"""
import uuid
import os
from datetime import datetime, timezone
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
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


ChannelType = Literal[
    "internal_public",
    "internal_private",
    "announcement_only",
    "claim_client",
    "claim_internal",
]
ChannelRole = Literal["owner", "admin", "member", "viewer", "client_proxy"]


class CreateChannelRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    type: ChannelType
    description: Optional[str] = Field(default="", max_length=250)
    claim_id: Optional[str] = None
    member_user_ids: list[str] = Field(default_factory=list)
    posting_policy: Literal["all_members", "admins_only"] = "all_members"


class AddChannelMemberRequest(BaseModel):
    user_id: str
    role: ChannelRole = "member"


class SendChannelMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    reply_to_message_id: Optional[str] = None


class PostAnnouncementRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=4000)


class SendGifMessageRequest(BaseModel):
    gif_url: str = Field(min_length=5, max_length=2000)
    caption: str = Field(default="", max_length=300)
    reply_to_message_id: Optional[str] = None


class UpdateChannelMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _channel_identity(user: dict) -> str:
    return user.get("id") or user.get("email")


def _can_manage_channels(user: dict) -> bool:
    return user.get("role") in {"admin", "manager"}


async def _get_channel_or_404(channel_id: str) -> dict:
    channel = await db.comms_channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


async def _get_membership(channel_id: str, user_id: str) -> Optional[dict]:
    return await db.comms_channel_memberships.find_one(
        {"channel_id": channel_id, "user_id": user_id},
        {"_id": 0},
    )


async def _ensure_channel_access(channel_id: str, user: dict) -> tuple[dict, dict]:
    channel = await _get_channel_or_404(channel_id)
    membership = await _get_membership(channel_id, user.get("id"))
    if not membership and not _can_manage_channels(user):
        raise HTTPException(status_code=403, detail="Access denied")
    return channel, membership or {}


def _comms_upload_base_dir() -> str:
    root = os.getenv("UPLOAD_DIR", "/tmp/eden_uploads")
    path = os.path.join(root, "comms")
    os.makedirs(path, exist_ok=True)
    return path


def _can_post_in_channel(user: dict, channel: dict, membership: dict) -> bool:
    if _can_manage_channels(user):
        return True

    if channel.get("type") == "announcement_only":
        return membership.get("role") in {"owner", "admin"}

    if channel.get("posting_policy") == "admins_only":
        return membership.get("role") in {"owner", "admin"}

    return bool(membership)


def _can_manage_message(user: dict, message: dict, membership: dict) -> bool:
    if _can_manage_channels(user):
        return True
    if message.get("sender_user_id") == user.get("id"):
        return True
    return membership.get("role") in {"owner", "admin"}


async def _log_message_event(
    channel_id: str,
    message_id: str,
    event_type: str,
    actor: dict,
    metadata: Optional[dict] = None,
):
    await db.comms_message_events.insert_one(
        {
            "id": str(uuid.uuid4()),
            "channel_id": channel_id,
            "message_id": message_id,
            "event_type": event_type,
            "actor_user_id": actor.get("id"),
            "actor_name": actor.get("full_name") or actor.get("email"),
            "metadata": metadata or {},
            "created_at": _utc_now(),
        }
    )


async def _maybe_create_twilio_channel_conversation(
    channel_id: str,
    friendly_name: str,
    attributes: dict,
) -> Optional[str]:
    if not is_conversations_configured():
        return None
    unique_name = f"eden-comms-{channel_id}"
    return create_conversation(
        unique_name=unique_name,
        friendly_name=friendly_name,
        attributes=attributes,
    )


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


@router.get("/inbox")
async def get_inbox(current_user: dict = Depends(get_current_active_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User identity not available")

    memberships = await db.comms_channel_memberships.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0},
    ).to_list(500)
    channel_ids = [m.get("channel_id") for m in memberships if m.get("channel_id")]

    channels = []
    if channel_ids:
        channels = await db.comms_channels.find(
            {"id": {"$in": channel_ids}, "is_archived": {"$ne": True}},
            {"_id": 0},
        ).to_list(500)

    membership_map = {m["channel_id"]: m for m in memberships if m.get("channel_id")}
    channel_map = {c["id"]: c for c in channels if c.get("id")}

    read_states = await db.comms_read_state.find(
        {"user_id": user_id, "channel_id": {"$in": list(channel_map.keys())}},
        {"_id": 0},
    ).to_list(500)
    read_state_map = {s["channel_id"]: s for s in read_states if s.get("channel_id")}

    items = []
    for channel_id, channel in channel_map.items():
        last_message = await db.comms_messages.find_one(
            {"channel_id": channel_id},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        last_read_at = (read_state_map.get(channel_id) or {}).get("last_read_at")
        unread_count = 0
        if last_read_at:
            unread_count = await db.comms_messages.count_documents(
                {"channel_id": channel_id, "created_at": {"$gt": last_read_at}}
            )
        else:
            unread_count = await db.comms_messages.count_documents({"channel_id": channel_id})

        if last_message and last_message.get("sender_user_id") == user_id and unread_count > 0:
            unread_count = max(unread_count - 1, 0)

        items.append(
            {
                "channel": channel,
                "membership": membership_map.get(channel_id),
                "last_message": last_message,
                "unread_count": unread_count,
            }
        )

    items.sort(
        key=lambda item: (
            (item.get("last_message") or {}).get("created_at")
            or (item.get("channel") or {}).get("updated_at")
            or ""
        ),
        reverse=True,
    )
    return {"items": items}


@router.get("/channels")
async def list_channels(current_user: dict = Depends(get_current_active_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User identity not available")

    if _can_manage_channels(current_user):
        channels = await db.comms_channels.find(
            {"is_archived": {"$ne": True}},
            {"_id": 0},
        ).sort("updated_at", -1).to_list(1000)
        return {"channels": channels}

    memberships = await db.comms_channel_memberships.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0, "channel_id": 1},
    ).to_list(1000)
    channel_ids = [m.get("channel_id") for m in memberships if m.get("channel_id")]

    channels = []
    if channel_ids:
        channels = await db.comms_channels.find(
            {"id": {"$in": channel_ids}, "is_archived": {"$ne": True}},
            {"_id": 0},
        ).sort("updated_at", -1).to_list(1000)

    return {"channels": channels}


@router.post("/channels")
async def create_channel(
    payload: CreateChannelRequest,
    current_user: dict = Depends(get_current_active_user),
):
    if not _can_manage_channels(current_user):
        raise HTTPException(status_code=403, detail="Only admin/manager can create channels")

    if payload.type in {"claim_client", "claim_internal"} and not payload.claim_id:
        raise HTTPException(status_code=422, detail="claim_id is required for claim channels")

    channel_id = str(uuid.uuid4())
    now = _utc_now()
    posting_policy = "admins_only" if payload.type == "announcement_only" else payload.posting_policy
    twilio_conversation_sid = await _maybe_create_twilio_channel_conversation(
        channel_id=channel_id,
        friendly_name=payload.name,
        attributes={"type": payload.type, "claim_id": payload.claim_id or ""},
    )

    channel_doc = {
        "id": channel_id,
        "name": payload.name,
        "type": payload.type,
        "description": payload.description or "",
        "claim_id": payload.claim_id,
        "posting_policy": posting_policy,
        "created_by_user_id": current_user.get("id"),
        "created_by_name": current_user.get("full_name") or current_user.get("email"),
        "created_at": now,
        "updated_at": now,
        "is_archived": False,
        "twilio_conversation_sid": twilio_conversation_sid,
    }
    await db.comms_channels.insert_one(channel_doc)

    member_ids = {current_user.get("id")}
    member_ids.update([uid for uid in payload.member_user_ids if uid])
    membership_docs = []
    for member_id in member_ids:
        role = "owner" if member_id == current_user.get("id") else "member"
        membership_docs.append(
            {
                "id": str(uuid.uuid4()),
                "channel_id": channel_id,
                "user_id": member_id,
                "role": role,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "added_by_user_id": current_user.get("id"),
            }
        )
    if membership_docs:
        await db.comms_channel_memberships.insert_many(membership_docs)

    return {"channel": channel_doc}


@router.post("/channels/{channel_id}/members")
async def add_channel_member(
    channel_id: str,
    payload: AddChannelMemberRequest,
    current_user: dict = Depends(get_current_active_user),
):
    channel, membership = await _ensure_channel_access(channel_id, current_user)
    if not (_can_manage_channels(current_user) or membership.get("role") in {"owner", "admin"}):
        raise HTTPException(status_code=403, detail="Only channel owner/admin can add members")

    now = _utc_now()
    await db.comms_channel_memberships.update_one(
        {"channel_id": channel_id, "user_id": payload.user_id},
        {
            "$set": {
                "role": payload.role,
                "is_active": True,
                "updated_at": now,
                "added_by_user_id": current_user.get("id"),
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now,
            },
        },
        upsert=True,
    )

    if channel.get("twilio_conversation_sid") and is_conversations_configured():
        add_participant(channel["twilio_conversation_sid"], payload.user_id)

    return {"message": "Member added"}


@router.get("/channels/{channel_id}/members")
async def list_channel_members(
    channel_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _ensure_channel_access(channel_id, current_user)
    memberships = await db.comms_channel_memberships.find(
        {"channel_id": channel_id, "is_active": True},
        {"_id": 0},
    ).to_list(500)
    user_ids = [m.get("user_id") for m in memberships if m.get("user_id")]
    users = []
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1},
        ).to_list(500)
    users_map = {u.get("id"): u for u in users}
    enriched = []
    for m in memberships:
        member_user = users_map.get(m.get("user_id"), {})
        enriched.append(
            {
                **m,
                "user": member_user,
            }
        )
    return {"members": enriched}


@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    await _ensure_channel_access(channel_id, current_user)
    safe_limit = max(1, min(limit, 200))
    messages = await db.comms_messages.find(
        {"channel_id": channel_id},
        {"_id": 0},
    ).sort("created_at", -1).limit(safe_limit).to_list(safe_limit)
    messages.reverse()

    current_user_id = current_user.get("id")
    for msg in messages:
        if msg.get("reply_to_message_id"):
            replied = await db.comms_messages.find_one(
                {"id": msg.get("reply_to_message_id"), "channel_id": channel_id},
                {"_id": 0, "id": 1, "sender_name": 1, "body": 1, "type": 1, "is_deleted": 1},
            )
            if replied:
                msg["reply_to_message"] = {
                    "id": replied.get("id"),
                    "sender_name": replied.get("sender_name") or "Unknown",
                    "body": "[Deleted message]" if replied.get("is_deleted") else (replied.get("body") or ""),
                    "type": replied.get("type") or "message",
                }

        if msg.get("type") != "announcement":
            continue
        message_id = msg.get("id")
        ack_query = {"channel_id": channel_id, "message_id": message_id}
        ack_count = await db.comms_announcement_acks.count_documents(ack_query)
        user_acked = await db.comms_announcement_acks.find_one(
            {**ack_query, "user_id": current_user_id},
            {"_id": 0, "id": 1},
        )
        msg["ack_count"] = ack_count
        msg["acked_by_me"] = bool(user_acked)

    return {"messages": messages}


@router.post("/channels/{channel_id}/messages")
async def send_channel_message(
    channel_id: str,
    payload: SendChannelMessageRequest,
    current_user: dict = Depends(get_current_active_user),
):
    channel, membership = await _ensure_channel_access(channel_id, current_user)
    if not _can_post_in_channel(current_user, channel, membership):
        raise HTTPException(status_code=403, detail="Posting not allowed in this channel")

    now = _utc_now()
    message_doc = {
        "id": str(uuid.uuid4()),
        "channel_id": channel_id,
        "sender_user_id": current_user.get("id"),
        "sender_name": current_user.get("full_name") or current_user.get("email"),
        "body": payload.body.strip(),
        "type": "message",
        "reply_to_message_id": payload.reply_to_message_id,
        "is_deleted": False,
        "is_edited": False,
        "created_at": now,
    }
    await db.comms_messages.insert_one(message_doc)
    await db.comms_channels.update_one(
        {"id": channel_id},
        {"$set": {"updated_at": now}},
    )

    if channel.get("twilio_conversation_sid") and is_conversations_configured():
        send_system_message(
            channel["twilio_conversation_sid"],
            payload.body.strip(),
            author=str(current_user.get("id")),
        )

    await _log_message_event(
        channel_id=channel_id,
        message_id=message_doc["id"],
        event_type="created",
        actor=current_user,
        metadata={"type": "message"},
    )

    return {"message": message_doc}


@router.post("/channels/{channel_id}/messages/gif")
async def send_channel_gif_message(
    channel_id: str,
    payload: SendGifMessageRequest,
    current_user: dict = Depends(get_current_active_user),
):
    channel, membership = await _ensure_channel_access(channel_id, current_user)
    if not _can_post_in_channel(current_user, channel, membership):
        raise HTTPException(status_code=403, detail="Posting not allowed in this channel")

    now = _utc_now()
    message_doc = {
        "id": str(uuid.uuid4()),
        "channel_id": channel_id,
        "sender_user_id": current_user.get("id"),
        "sender_name": current_user.get("full_name") or current_user.get("email"),
        "body": payload.caption.strip(),
        "type": "gif",
        "gif_url": payload.gif_url.strip(),
        "reply_to_message_id": payload.reply_to_message_id,
        "is_deleted": False,
        "is_edited": False,
        "created_at": now,
    }
    await db.comms_messages.insert_one(message_doc)
    await db.comms_channels.update_one({"id": channel_id}, {"$set": {"updated_at": now}})
    await _log_message_event(
        channel_id=channel_id,
        message_id=message_doc["id"],
        event_type="created",
        actor=current_user,
        metadata={"type": "gif"},
    )
    return {"message": message_doc}


@router.post("/channels/{channel_id}/attachments")
async def upload_channel_attachment(
    channel_id: str,
    upload: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user),
):
    channel, membership = await _ensure_channel_access(channel_id, current_user)
    if not _can_post_in_channel(current_user, channel, membership):
        raise HTTPException(status_code=403, detail="Posting not allowed in this channel")

    attachment_id = str(uuid.uuid4())
    safe_name = upload.filename or "file.bin"
    ext = os.path.splitext(safe_name)[1]
    file_name = f"{attachment_id}{ext}"
    file_path = os.path.join(_comms_upload_base_dir(), file_name)

    file_bytes = await upload.read()
    max_bytes = 15 * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="File exceeds 15MB limit")

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    now = _utc_now()
    attachment_doc = {
        "id": attachment_id,
        "channel_id": channel_id,
        "uploader_user_id": current_user.get("id"),
        "uploader_name": current_user.get("full_name") or current_user.get("email"),
        "original_name": safe_name,
        "mime_type": upload.content_type or "application/octet-stream",
        "size_bytes": len(file_bytes),
        "file_name": file_name,
        "file_path": file_path,
        "created_at": now,
    }
    await db.comms_attachments.insert_one(attachment_doc)

    message_doc = {
        "id": str(uuid.uuid4()),
        "channel_id": channel_id,
        "sender_user_id": current_user.get("id"),
        "sender_name": current_user.get("full_name") or current_user.get("email"),
        "body": safe_name,
        "type": "attachment",
        "attachment_id": attachment_id,
        "attachment_name": safe_name,
        "attachment_mime_type": attachment_doc["mime_type"],
        "is_deleted": False,
        "is_edited": False,
        "created_at": now,
    }
    await db.comms_messages.insert_one(message_doc)
    await db.comms_channels.update_one({"id": channel_id}, {"$set": {"updated_at": now}})
    await _log_message_event(
        channel_id=channel_id,
        message_id=message_doc["id"],
        event_type="created",
        actor=current_user,
        metadata={"type": "attachment", "attachment_id": attachment_id},
    )
    return {
        "attachment": {
            "id": attachment_id,
            "name": safe_name,
            "mime_type": attachment_doc["mime_type"],
            "size_bytes": attachment_doc["size_bytes"],
            "url": f"/api/comm/uploads/{attachment_id}",
        },
        "message": message_doc,
    }


@router.get("/uploads/{attachment_id}")
async def get_channel_attachment(
    attachment_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    attachment = await db.comms_attachments.find_one({"id": attachment_id}, {"_id": 0})
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await _ensure_channel_access(attachment.get("channel_id"), current_user)

    file_path = attachment.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Attachment file missing")

    return FileResponse(
        path=file_path,
        media_type=attachment.get("mime_type") or "application/octet-stream",
        filename=attachment.get("original_name") or attachment.get("file_name") or "file",
    )


@router.patch("/channels/{channel_id}/messages/{message_id}")
async def update_channel_message(
    channel_id: str,
    message_id: str,
    payload: UpdateChannelMessageRequest,
    current_user: dict = Depends(get_current_active_user),
):
    _, membership = await _ensure_channel_access(channel_id, current_user)
    message = await db.comms_messages.find_one(
        {"id": message_id, "channel_id": channel_id},
        {"_id": 0},
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.get("type") not in {"message", "gif"}:
        raise HTTPException(status_code=400, detail="Only text or gif captions can be edited")
    if message.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit deleted message")
    if not _can_manage_message(current_user, message, membership):
        raise HTTPException(status_code=403, detail="Not allowed to edit this message")

    now = _utc_now()
    update_fields = {
        "body": payload.body.strip(),
        "is_edited": True,
        "edited_at": now,
    }
    await db.comms_messages.update_one(
        {"id": message_id, "channel_id": channel_id},
        {"$set": update_fields},
    )
    await _log_message_event(
        channel_id=channel_id,
        message_id=message_id,
        event_type="edited",
        actor=current_user,
        metadata={"new_body_preview": payload.body.strip()[:120]},
    )
    updated = await db.comms_messages.find_one(
        {"id": message_id, "channel_id": channel_id},
        {"_id": 0},
    )
    return {"message": updated}


@router.delete("/channels/{channel_id}/messages/{message_id}")
async def delete_channel_message(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    _, membership = await _ensure_channel_access(channel_id, current_user)
    message = await db.comms_messages.find_one(
        {"id": message_id, "channel_id": channel_id},
        {"_id": 0},
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.get("is_deleted"):
        return {"message": "Already deleted"}
    if message.get("type") == "announcement" and not _can_manage_channels(current_user):
        raise HTTPException(status_code=403, detail="Only admin/manager can delete announcements")
    if not _can_manage_message(current_user, message, membership):
        raise HTTPException(status_code=403, detail="Not allowed to delete this message")

    now = _utc_now()
    await db.comms_messages.update_one(
        {"id": message_id, "channel_id": channel_id},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": now,
                "deleted_by_user_id": current_user.get("id"),
                "body": "[Message deleted]",
            }
        },
    )
    await _log_message_event(
        channel_id=channel_id,
        message_id=message_id,
        event_type="deleted",
        actor=current_user,
        metadata={"original_type": message.get("type")},
    )
    return {"message": "Deleted"}


@router.post("/channels/{channel_id}/announcement")
async def post_channel_announcement(
    channel_id: str,
    payload: PostAnnouncementRequest,
    current_user: dict = Depends(get_current_active_user),
):
    channel, membership = await _ensure_channel_access(channel_id, current_user)
    if channel.get("type") != "announcement_only":
        raise HTTPException(status_code=400, detail="Channel is not announcement-only")
    if not (_can_manage_channels(current_user) or membership.get("role") in {"owner", "admin"}):
        raise HTTPException(status_code=403, detail="Only admins can post announcements")

    now = _utc_now()
    message_doc = {
        "id": str(uuid.uuid4()),
        "channel_id": channel_id,
        "sender_user_id": current_user.get("id"),
        "sender_name": current_user.get("full_name") or current_user.get("email"),
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "type": "announcement",
        "created_at": now,
    }
    await db.comms_messages.insert_one(message_doc)
    await db.comms_channels.update_one(
        {"id": channel_id},
        {"$set": {"updated_at": now}},
    )

    if channel.get("twilio_conversation_sid") and is_conversations_configured():
        send_system_message(
            channel["twilio_conversation_sid"],
            f"[ANNOUNCEMENT] {payload.title.strip()}\n{payload.body.strip()}",
            author=str(current_user.get("id")),
        )

    return {"message": message_doc}


@router.post("/channels/{channel_id}/mark-read")
async def mark_channel_read(
    channel_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _ensure_channel_access(channel_id, current_user)
    now = _utc_now()
    await db.comms_read_state.update_one(
        {"channel_id": channel_id, "user_id": current_user.get("id")},
        {
            "$set": {
                "last_read_at": now,
                "updated_at": now,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"message": "Read state updated"}


@router.post("/channels/{channel_id}/announcement/{message_id}/ack")
async def acknowledge_announcement(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    channel, _ = await _ensure_channel_access(channel_id, current_user)
    if channel.get("type") != "announcement_only":
        raise HTTPException(status_code=400, detail="Acknowledgement is only for announcement channels")

    msg = await db.comms_messages.find_one(
        {"id": message_id, "channel_id": channel_id, "type": "announcement"},
        {"_id": 0, "id": 1},
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Announcement not found")

    now = _utc_now()
    await db.comms_announcement_acks.update_one(
        {
            "channel_id": channel_id,
            "message_id": message_id,
            "user_id": current_user.get("id"),
        },
        {
            "$set": {
                "updated_at": now,
                "acknowledged_at": now,
                "user_name": current_user.get("full_name") or current_user.get("email"),
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"message": "Acknowledged"}
