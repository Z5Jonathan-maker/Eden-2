"""
Google Client - Real Google API integration for Gmail, Calendar, and Drive

Uses OAuth tokens from routes/oauth.py (stored in oauth_tokens collection).
Token refresh handled by get_valid_token() / refresh_google_token().
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import httpx
import base64
import json
import io
import email.mime.text
import email.mime.multipart
import email.mime.base
import logging

from routes.auth import get_current_active_user
from routes.oauth import get_valid_token, refresh_google_token
from dependencies import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations/google", tags=["Google Integration"])

# Google API base URLs
GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"


# ============================================
# MODELS
# ============================================

class CalendarEvent(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: str  # ISO datetime
    end_time: str    # ISO datetime
    location: Optional[str] = ""
    attendees: Optional[List[str]] = []
    reminder_minutes: Optional[int] = 30

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None

class EmailSend(BaseModel):
    to: str
    subject: str
    body: str
    cc: Optional[str] = None
    bcc: Optional[str] = None
    reply_to_message_id: Optional[str] = None


# ============================================
# HELPER: Authenticated Google API call
# ============================================

async def _google_request(user_id: str, method: str, url: str, **kwargs):
    """Make an authenticated Google API request with auto-refresh."""
    token = await get_valid_token(user_id, "google")
    if not token:
        raise HTTPException(status_code=401, detail="Google not connected. Connect via Settings.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method, url,
            headers={"Authorization": f"Bearer {token}", **kwargs.pop("headers", {})},
            **kwargs
        )

        if resp.status_code == 401:
            token = await refresh_google_token(user_id)
            if not token:
                raise HTTPException(status_code=401, detail="Google token expired. Please reconnect.")
            resp = await client.request(
                method, url,
                headers={"Authorization": f"Bearer {token}", **kwargs.pop("headers", {})},
                **kwargs
            )

        return resp


def _google_error_detail(resp: httpx.Response, fallback: str) -> str:
    """Extract a useful Google API error message for UI surfaces."""
    message = ""
    try:
        payload = resp.json()
        error_obj = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error_obj, dict):
            message = str(error_obj.get("message") or "").strip()
        elif error_obj:
            message = str(error_obj).strip()
    except Exception:
        message = ""

    text = message or fallback
    if resp.status_code == 403 and "insufficient" in text.lower():
        return "Google Drive permission missing. Reconnect Google and approve Drive access."
    return text


def _get_user_id(current_user: dict) -> str:
    return current_user.get("id") or str(current_user.get("_id", ""))


# ============================================
# GMAIL API
# ============================================

def _parse_gmail_headers(headers: list) -> dict:
    """Extract common headers from Gmail message payload."""
    result = {}
    for h in headers:
        name = h.get("name", "").lower()
        if name in ("from", "to", "cc", "bcc", "subject", "date", "message-id"):
            result[name] = h.get("value", "")
    return result


def _extract_body(payload: dict) -> dict:
    """Extract text and HTML body from Gmail message payload."""
    body_text = ""
    body_html = ""

    def _walk(part):
        nonlocal body_text, body_html
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")

        if data:
            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            if mime == "text/plain" and not body_text:
                body_text = decoded
            elif mime == "text/html" and not body_html:
                body_html = decoded

        for sub in part.get("parts", []):
            _walk(sub)

    _walk(payload)
    return {"body_text": body_text, "body_html": body_html}


@router.get("/gmail/messages")
async def list_gmail_messages(
    max_results: int = 20,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """List recent Gmail messages."""
    user_id = _get_user_id(current_user)

    params = {"maxResults": min(max_results, 50)}
    if q:
        params["q"] = q

    resp = await _google_request(user_id, "GET", f"{GMAIL_API}/messages", params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to list Gmail messages")

    data = resp.json()
    message_ids = [m["id"] for m in data.get("messages", [])]

    if not message_ids:
        return {"messages": [], "count": 0}

    # Fetch metadata for each message
    messages = []
    for mid in message_ids[:max_results]:
        detail = await _google_request(
            user_id, "GET",
            f"{GMAIL_API}/messages/{mid}",
            params={"format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Date"]}
        )
        if detail.status_code == 200:
            msg = detail.json()
            headers = _parse_gmail_headers(msg.get("payload", {}).get("headers", []))
            messages.append({
                "id": msg["id"],
                "threadId": msg.get("threadId"),
                "snippet": msg.get("snippet", ""),
                "subject": headers.get("subject", "(no subject)"),
                "from": headers.get("from", ""),
                "to": headers.get("to", ""),
                "date": headers.get("date", ""),
                "labelIds": msg.get("labelIds", []),
                "isUnread": "UNREAD" in msg.get("labelIds", []),
            })

    return {"messages": messages, "count": len(messages)}


@router.get("/gmail/messages/{message_id}")
async def get_gmail_message(
    message_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a full Gmail message by ID."""
    user_id = _get_user_id(current_user)

    resp = await _google_request(
        user_id, "GET",
        f"{GMAIL_API}/messages/{message_id}",
        params={"format": "full"}
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to get message")

    msg = resp.json()
    payload = msg.get("payload", {})
    headers = _parse_gmail_headers(payload.get("headers", []))
    body = _extract_body(payload)

    # Extract attachments info
    attachments = []
    def _find_attachments(part):
        if part.get("filename"):
            attachments.append({
                "filename": part["filename"],
                "mimeType": part.get("mimeType", ""),
                "size": part.get("body", {}).get("size", 0),
                "attachmentId": part.get("body", {}).get("attachmentId", ""),
            })
        for sub in part.get("parts", []):
            _find_attachments(sub)
    _find_attachments(payload)

    return {
        "id": msg["id"],
        "threadId": msg.get("threadId"),
        "subject": headers.get("subject", "(no subject)"),
        "from": headers.get("from", ""),
        "to": headers.get("to", ""),
        "cc": headers.get("cc", ""),
        "date": headers.get("date", ""),
        "snippet": msg.get("snippet", ""),
        "body_html": body["body_html"],
        "body_text": body["body_text"],
        "labelIds": msg.get("labelIds", []),
        "attachments": attachments,
    }


@router.post("/gmail/send")
async def send_gmail_message(
    email_data: EmailSend,
    current_user: dict = Depends(get_current_active_user)
):
    """Send an email via Gmail API."""
    user_id = _get_user_id(current_user)

    msg = email.mime.multipart.MIMEMultipart()
    msg["To"] = email_data.to
    msg["Subject"] = email_data.subject
    if email_data.cc:
        msg["Cc"] = email_data.cc
    if email_data.bcc:
        msg["Bcc"] = email_data.bcc

    msg.attach(email.mime.text.MIMEText(email_data.body, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    body = {"raw": raw}
    if email_data.reply_to_message_id:
        body["threadId"] = email_data.reply_to_message_id

    resp = await _google_request(
        user_id, "POST",
        f"{GMAIL_API}/messages/send",
        json=body
    )

    if resp.status_code not in (200, 201):
        logger.error(f"Gmail send failed: {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail="Failed to send email")

    result = resp.json()
    return {"id": result.get("id"), "threadId": result.get("threadId"), "status": "sent"}


# ============================================
# CALENDAR API
# ============================================

@router.get("/calendar/events")
async def list_calendar_events(
    max_results: int = 50,
    time_min: Optional[str] = None,
    time_max: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """List events from Google Calendar."""
    user_id = _get_user_id(current_user)

    params = {
        "maxResults": min(max_results, 100),
        "singleEvents": "true",
        "orderBy": "startTime",
    }
    if time_min:
        params["timeMin"] = time_min
    else:
        params["timeMin"] = datetime.now(timezone.utc).isoformat()
    if time_max:
        params["timeMax"] = time_max

    resp = await _google_request(
        user_id, "GET",
        f"{CALENDAR_API}/calendars/primary/events",
        params=params
    )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to list calendar events")

    data = resp.json()
    events = []
    for item in data.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})
        events.append({
            "id": item["id"],
            "title": item.get("summary", "(no title)"),
            "description": item.get("description", ""),
            "start": start.get("dateTime") or start.get("date", ""),
            "end": end.get("dateTime") or end.get("date", ""),
            "location": item.get("location", ""),
            "attendees": [a.get("email", "") for a in item.get("attendees", [])],
            "htmlLink": item.get("htmlLink", ""),
            "status": item.get("status", ""),
        })

    return {"events": events, "count": len(events)}


@router.post("/calendar/events")
async def create_calendar_event(
    event: CalendarEvent,
    current_user: dict = Depends(get_current_active_user)
):
    """Create an event in Google Calendar."""
    user_id = _get_user_id(current_user)

    body = {
        "summary": event.title,
        "description": event.description or "",
        "start": {"dateTime": event.start_time, "timeZone": "America/New_York"},
        "end": {"dateTime": event.end_time, "timeZone": "America/New_York"},
    }
    if event.location:
        body["location"] = event.location
    if event.attendees:
        body["attendees"] = [{"email": e} for e in event.attendees]
    if event.reminder_minutes:
        body["reminders"] = {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": event.reminder_minutes}]
        }

    resp = await _google_request(
        user_id, "POST",
        f"{CALENDAR_API}/calendars/primary/events",
        json=body
    )

    if resp.status_code not in (200, 201):
        logger.error(f"Calendar create failed: {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail="Failed to create calendar event")

    result = resp.json()
    return {
        "id": result.get("id"),
        "htmlLink": result.get("htmlLink", ""),
        "status": result.get("status", "confirmed"),
    }


@router.put("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: str,
    event: CalendarEventUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an existing Google Calendar event."""
    user_id = _get_user_id(current_user)

    body = {}
    if event.title is not None:
        body["summary"] = event.title
    if event.description is not None:
        body["description"] = event.description
    if event.start_time is not None:
        body["start"] = {"dateTime": event.start_time, "timeZone": "America/New_York"}
    if event.end_time is not None:
        body["end"] = {"dateTime": event.end_time, "timeZone": "America/New_York"}
    if event.location is not None:
        body["location"] = event.location

    resp = await _google_request(
        user_id, "PATCH",
        f"{CALENDAR_API}/calendars/primary/events/{event_id}",
        json=body
    )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to update event")

    result = resp.json()
    start = result.get("start", {})
    end = result.get("end", {})
    return {
        "id": result["id"],
        "title": result.get("summary", ""),
        "start": start.get("dateTime") or start.get("date", ""),
        "end": end.get("dateTime") or end.get("date", ""),
        "htmlLink": result.get("htmlLink", ""),
    }


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a Google Calendar event."""
    user_id = _get_user_id(current_user)

    resp = await _google_request(
        user_id, "DELETE",
        f"{CALENDAR_API}/calendars/primary/events/{event_id}"
    )

    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=resp.status_code, detail="Failed to delete event")

    return {"message": "Event deleted", "id": event_id}


# ============================================
# DRIVE API
# ============================================

EDEN_FOLDER_NAME = "Eden Documents"


async def _get_or_create_eden_folder(user_id: str) -> str:
    """Get or create the Eden folder in Google Drive."""
    # Check if we have the folder ID cached
    cached = await db.google_drive_folders.find_one({"user_id": user_id})
    if cached:
        return cached["folder_id"]

    # Search for existing folder
    resp = await _google_request(
        user_id, "GET",
        f"{DRIVE_API}/files",
        params={
            "q": f"name='{EDEN_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            "fields": "files(id,name)",
        }
    )

    if resp.status_code == 200:
        files = resp.json().get("files", [])
        if files:
            folder_id = files[0]["id"]
            await db.google_drive_folders.update_one(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "folder_id": folder_id}},
                upsert=True
            )
            return folder_id

    # Create folder
    resp = await _google_request(
        user_id, "POST",
        f"{DRIVE_API}/files",
        json={
            "name": EDEN_FOLDER_NAME,
            "mimeType": "application/vnd.google-apps.folder",
        }
    )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to create Eden folder in Drive")

    folder_id = resp.json()["id"]
    await db.google_drive_folders.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "folder_id": folder_id}},
        upsert=True
    )
    return folder_id


@router.get("/drive/files")
async def list_drive_files(
    q: Optional[str] = None,
    max_results: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """List files in Google Drive (app-scoped via drive.file)."""
    user_id = _get_user_id(current_user)

    query_parts = ["trashed=false"]
    if q:
        query_parts.append(f"name contains '{q}'")

    params = {
        "q": " and ".join(query_parts),
        "pageSize": min(max_results, 100),
        "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink)",
        "orderBy": "modifiedTime desc",
    }

    resp = await _google_request(user_id, "GET", f"{DRIVE_API}/files", params=params)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=_google_error_detail(resp, "Failed to list Drive files")
        )

    data = resp.json()
    files = []
    for f in data.get("files", []):
        files.append({
            "id": f["id"],
            "name": f.get("name", ""),
            "mimeType": f.get("mimeType", ""),
            "size": f.get("size", "0"),
            "modifiedTime": f.get("modifiedTime", ""),
            "webViewLink": f.get("webViewLink", ""),
            "iconLink": f.get("iconLink", ""),
            "thumbnailLink": f.get("thumbnailLink", ""),
        })

    return {"files": files, "count": len(files)}


@router.post("/drive/upload")
async def upload_drive_file(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a file to Google Drive (into Eden folder)."""
    user_id = _get_user_id(current_user)

    folder_id = await _get_or_create_eden_folder(user_id)

    file_content = await file.read()
    if len(file_content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    metadata = {
        "name": file.filename,
        "parents": [folder_id],
    }

    # Multipart upload
    boundary = "eden_upload_boundary"
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {file.content_type or 'application/octet-stream'}\r\n\r\n"
    ).encode("utf-8") + file_content + f"\r\n--{boundary}--".encode("utf-8")

    token = await get_valid_token(user_id, "google")
    if not token:
        raise HTTPException(status_code=401, detail="Google not connected")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{DRIVE_UPLOAD_API}/files?uploadType=multipart",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": f"multipart/related; boundary={boundary}",
            },
            content=body,
        )

    if resp.status_code not in (200, 201):
        logger.error(f"Drive upload failed: {resp.text}")
        raise HTTPException(
            status_code=resp.status_code,
            detail=_google_error_detail(resp, "Failed to upload file")
        )

    result = resp.json()

    # Get the webViewLink
    detail_resp = await _google_request(
        user_id, "GET",
        f"{DRIVE_API}/files/{result['id']}",
        params={"fields": "id,name,webViewLink,mimeType,size"}
    )
    detail = detail_resp.json() if detail_resp.status_code == 200 else result

    return {
        "id": detail.get("id", result["id"]),
        "name": detail.get("name", file.filename),
        "webViewLink": detail.get("webViewLink", ""),
        "mimeType": detail.get("mimeType", ""),
        "size": detail.get("size", "0"),
    }


@router.get("/drive/files/{file_id}/download")
async def download_drive_file(
    file_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Download a file from Google Drive."""
    user_id = _get_user_id(current_user)

    # Get file metadata first for filename
    meta_resp = await _google_request(
        user_id, "GET",
        f"{DRIVE_API}/files/{file_id}",
        params={"fields": "name,mimeType"}
    )
    if meta_resp.status_code != 200:
        raise HTTPException(status_code=404, detail="File not found")
    meta = meta_resp.json()

    # Download content
    resp = await _google_request(
        user_id, "GET",
        f"{DRIVE_API}/files/{file_id}",
        params={"alt": "media"}
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to download file")

    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type=meta.get("mimeType", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{meta.get("name", "download")}"'}
    )


@router.delete("/drive/files/{file_id}")
async def delete_drive_file(
    file_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a file from Google Drive."""
    user_id = _get_user_id(current_user)

    resp = await _google_request(
        user_id, "DELETE",
        f"{DRIVE_API}/files/{file_id}"
    )

    if resp.status_code not in (200, 204):
        raise HTTPException(
            status_code=resp.status_code,
            detail=_google_error_detail(resp, "Failed to delete file")
        )

    return {"message": "File deleted", "id": file_id}
