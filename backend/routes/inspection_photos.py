"""
Inspection Photos API - Enhanced photo documentation for claims
Competitive with CompanyCam features
"""
import os
import uuid
import json
import asyncio
import base64
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user, get_user_from_token_param
from auth import decode_access_token

router = APIRouter(prefix="/api/inspections", tags=["inspections"])
security = HTTPBearer(auto_error=False)  # Don't auto-fail, we'll handle it

# Configuration - repo-relative photo directory
BACKEND_DIR = Path(__file__).parent.parent
PHOTO_DIR = os.environ.get("PHOTO_DIR", str(BACKEND_DIR / "uploads" / "inspections"))
try:
    os.makedirs(PHOTO_DIR, exist_ok=True)
except Exception as e:
    raise RuntimeError(f"Failed to create photo directory '{PHOTO_DIR}': {e}")

MAX_PHOTO_SIZE = 20 * 1024 * 1024  # 20MB per photo

# Helper to get user from Bearer token
async def get_user_from_bearer_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Extract user from Bearer token in Authorization header"""
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                return await db.users.find_one({"id": user_id})
    except:
        pass
    return None


class PhotoMetadata(BaseModel):
    """Rich metadata for inspection photos"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: Optional[str] = None
    session_id: Optional[str] = None  # Link to inspection session
    filename: str = ""
    original_name: str = ""
    
    # Location data
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    
    # Timestamps
    captured_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    uploaded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # Organization
    room: Optional[str] = None  # e.g., "Kitchen", "Master Bedroom", "Roof"
    category: Optional[str] = None  # e.g., "damage", "before", "after", "overview"
    tags: List[str] = []
    
    # Annotations
    annotations: Optional[str] = None  # JSON string of annotation data
    
    # AI-generated
    ai_caption: Optional[str] = None
    ai_damage_assessment: Optional[str] = None
    
    # Voice notes (matched from session transcript)
    voice_snippet: Optional[str] = None  # Transcript segment matched by timestamp
    
    # User info
    uploaded_by: str = ""
    uploaded_by_name: str = ""
    
    # File info
    file_size: int = 0
    mime_type: str = "image/jpeg"
    
    # Comparison
    is_before: bool = False
    is_after: bool = False
    paired_photo_id: Optional[str] = None  # Link before/after pairs


class PhotoAnnotation(BaseModel):
    """Annotation data for a photo"""
    type: str  # "arrow", "circle", "rectangle", "text", "freehand"
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[List[dict]] = None  # For freehand drawing
    color: str = "#FF0000"
    text: Optional[str] = None
    fontSize: Optional[int] = 16


class PhotoUploadResponse(BaseModel):
    id: str
    url: str
    thumbnail_url: str
    metadata: dict


class CreateInspectionSession(BaseModel):
    claim_id: str
    name: Optional[str] = None
    notes: Optional[str] = None
    type: str = "initial"  # initial | reinspection | closing


class InspectionSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    name: str = ""
    notes: Optional[str] = None
    type: str = "initial"  # initial | reinspection | closing
    status: str = "in_progress"  # in_progress | completed | archived
    photo_count: int = 0
    created_by: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    rooms_documented: List[str] = []
    
    # Voice recording fields
    voice_recording_id: Optional[str] = None
    voice_recording_filename: Optional[str] = None
    voice_transcript: Optional[str] = None
    voice_transcribed_at: Optional[str] = None


# ========== INSPECTION SESSIONS ==========

@router.post("/sessions")
async def create_inspection_session(
    data: CreateInspectionSession,
    current_user: dict = Depends(get_current_active_user)
):
    """Start a new inspection session for a claim"""
    
    session = InspectionSession(
        claim_id=data.claim_id,
        name=data.name or f"Inspection {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        notes=data.notes,
        type=data.type,
        created_by=current_user.get("email", "")
    )
    
    session_dict = session.model_dump()
    await db.inspection_sessions.insert_one(session_dict)
    
    # Remove _id before returning
    session_dict.pop("_id", None)
    
    return {"id": session.id, "message": "Inspection session started", "session": session_dict}


@router.get("/sessions")
async def get_inspection_sessions(
    claim_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all inspection sessions, optionally filtered by claim"""
    
    query = {}
    if claim_id:
        query["claim_id"] = claim_id
    
    sessions = await db.inspection_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_inspection_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get details of a specific inspection session"""
    
    session = await db.inspection_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get photos for this session
    photos = await db.inspection_photos.find(
        {"session_id": session_id}, 
        {"_id": 0, "annotations": 0}
    ).sort("captured_at", 1).to_list(500)
    
    session["photos"] = photos
    return session


@router.put("/sessions/{session_id}/complete")
async def complete_inspection_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark an inspection session as complete"""
    
    result = await db.inspection_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Inspection completed"}


# ========== AI CAPTION (background) ==========

async def _generate_ai_caption(photo_id: str, file_path: str):
    """Background task: generate AI caption for a photo using vision model."""
    try:
        from emergentintegrations.llm.openai import get_openai_client, get_vision_model

        client = get_openai_client()
        if not client:
            return  # Vision features require OpenAI API key

        with open(file_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=get_vision_model(),
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "You are an insurance property inspector. Describe this photo in 1-2 sentences "
                            "for a claims report. Focus on: what room/area is shown, any visible damage or "
                            "conditions, and damage type if applicable. Be concise and professional."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}", "detail": "low"}},
                ],
            }],
            max_tokens=150,
        )

        caption = response.choices[0].message.content.strip()
        await db.inspection_photos.update_one(
            {"id": photo_id},
            {"$set": {"ai_caption": caption}},
        )
        print(f"[AI Caption] {photo_id[:8]}… → {caption[:80]}")
    except Exception as e:
        print(f"[AI Caption] Error for {photo_id[:8]}…: {e}")


# ========== PHOTO UPLOAD & MANAGEMENT ==========

@router.post("/photos")
async def upload_inspection_photo(
    file: UploadFile = File(...),
    claim_id: str = Form(...),  # REQUIRED - no orphan photos
    session_id: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    room: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
    is_before: Optional[bool] = Form(False),
    is_after: Optional[bool] = Form(False),
    captured_at: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload an inspection photo with rich metadata
    
    ENFORCED CONSTRAINTS:
    - claim_id is REQUIRED (no orphan photos)
    - session_id recommended for tracking
    - uploaded_by automatically set from current user
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate claim exists
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=400, detail="Invalid claim_id - claim not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only images are allowed (JPEG, PNG, WebP, HEIC)")
    
    # Read file
    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail=f"Photo too large. Max size is {MAX_PHOTO_SIZE // (1024*1024)}MB")
    
    # Generate unique filename
    photo_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{photo_id}{ext}"
    
    # Create claim-specific directory
    if claim_id:
        photo_dir = os.path.join(PHOTO_DIR, claim_id)
        os.makedirs(photo_dir, exist_ok=True)
        file_path = os.path.join(photo_dir, filename)
    else:
        file_path = os.path.join(PHOTO_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Parse tags
    tag_list = []
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    
    # Create metadata
    metadata = PhotoMetadata(
        id=photo_id,
        claim_id=claim_id,
        filename=filename,
        original_name=file.filename,
        latitude=latitude,
        longitude=longitude,
        address=address,
        room=room,
        category=category,
        tags=tag_list,
        is_before=is_before or False,
        is_after=is_after or False,
        captured_at=captured_at or datetime.now(timezone.utc).isoformat(),
        uploaded_by=current_user.get("email", ""),
        uploaded_by_name=current_user.get("name", current_user.get("email", "")),
        file_size=len(content),
        mime_type=file.content_type or "image/jpeg"
    )
    
    metadata_dict = metadata.model_dump()
    if session_id:
        metadata_dict["session_id"] = session_id
        
        # Update session photo count and rooms
        update_ops = {"$inc": {"photo_count": 1}}
        if room:
            update_ops["$addToSet"] = {"rooms_documented": room}
        await db.inspection_sessions.update_one({"id": session_id}, update_ops)
    
    await db.inspection_photos.insert_one(metadata_dict)

    # Fire-and-forget: generate AI caption in background
    asyncio.ensure_future(_generate_ai_caption(photo_id, file_path))

    # Build full image URL
    base_url = os.environ.get("BASE_URL", "")
    image_url = f"{base_url}/api/inspections/photos/{photo_id}/image"

    return {
        "id": photo_id,
        "url": f"/api/inspections/photos/{photo_id}/image",
        "image_url": image_url,
        "thumbnail_url": f"/api/inspections/photos/{photo_id}/thumbnail",
        "metadata": {
            "claim_id": claim_id,
            "room": room,
            "category": category,
            "captured_at": metadata.captured_at,
            "location": {"lat": latitude, "lng": longitude} if latitude and longitude else None
        }
    }


@router.get("/photos/{photo_id}/image")
async def get_photo_image(
    photo_id: str,
    token: Optional[str] = Query(None, description="Auth token for backward-compat img src access"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Get the actual photo image. Accepts Bearer token via Authorization header or ?token= query param."""
    
    user = None
    
    # Try Bearer token first
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            if payload:
                user_id = payload.get("sub")
                if user_id:
                    user = await db.users.find_one({"id": user_id})
        except:
            pass
    
    # Fall back to query param token
    if not user and token:
        user = await get_user_from_token_param(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized - valid token required")
    
    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Build file path
    if photo.get("claim_id"):
        file_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
    else:
        file_path = os.path.join(PHOTO_DIR, photo["filename"])
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found on disk")
    
    return FileResponse(file_path, media_type=photo.get("mime_type", "image/jpeg"))


@router.get("/photos/{photo_id}/thumbnail")
async def get_photo_thumbnail(
    photo_id: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Get photo thumbnail (300px max dimension, generated on-demand with Pillow)."""
    user = None
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            if payload:
                user_id = payload.get("sub")
                if user_id:
                    user = await db.users.find_one({"id": user_id})
        except:
            pass
    if not user and token:
        user = await get_user_from_token_param(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Build file paths
    if photo.get("claim_id"):
        original_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
        thumb_dir = os.path.join(PHOTO_DIR, photo["claim_id"], "thumbnails")
    else:
        original_path = os.path.join(PHOTO_DIR, photo["filename"])
        thumb_dir = os.path.join(PHOTO_DIR, "thumbnails")

    thumb_path = os.path.join(thumb_dir, photo["filename"])

    # Generate thumbnail on-demand if missing
    if not os.path.exists(thumb_path):
        if not os.path.exists(original_path):
            raise HTTPException(status_code=404, detail="Photo file not found")
        try:
            from PIL import Image as PILImage
            os.makedirs(thumb_dir, exist_ok=True)
            img = PILImage.open(original_path)
            img.thumbnail((300, 300), PILImage.LANCZOS)
            # Preserve format; default to JPEG
            fmt = "JPEG"
            if photo.get("mime_type") == "image/png":
                fmt = "PNG"
            img.save(thumb_path, format=fmt, quality=85)
        except Exception as e:
            print(f"[Thumbnail] Generation failed for {photo_id}: {e}")
            # Fallback: serve full image
            return FileResponse(original_path, media_type=photo.get("mime_type", "image/jpeg"))

    return FileResponse(thumb_path, media_type=photo.get("mime_type", "image/jpeg"))


@router.get("/photos/{photo_id}")
async def get_photo_metadata(
    photo_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get photo metadata"""
    
    photo = await db.inspection_photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo["url"] = f"/api/inspections/photos/{photo_id}/image"
    return photo


@router.delete("/photos/{photo_id}")
async def delete_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete an inspection photo"""
    
    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Delete file
    if photo.get("claim_id"):
        file_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
    else:
        file_path = os.path.join(PHOTO_DIR, photo["filename"])
    
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Update session count if applicable
    if photo.get("session_id"):
        await db.inspection_sessions.update_one(
            {"id": photo["session_id"]},
            {"$inc": {"photo_count": -1}}
        )
    
    await db.inspection_photos.delete_one({"id": photo_id})
    
    return {"message": "Photo deleted"}


# ========== ANNOTATIONS ==========

@router.put("/photos/{photo_id}/annotations")
async def save_photo_annotations(
    photo_id: str,
    annotations: List[PhotoAnnotation],
    current_user: dict = Depends(get_current_active_user)
):
    """Save annotations for a photo"""
    
    annotations_json = json.dumps([a.model_dump() for a in annotations])
    
    result = await db.inspection_photos.update_one(
        {"id": photo_id},
        {
            "$set": {
                "annotations": annotations_json,
                "annotated_at": datetime.now(timezone.utc).isoformat(),
                "annotated_by": current_user.get("email", "")
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return {"message": "Annotations saved"}


@router.get("/photos/{photo_id}/annotations")
async def get_photo_annotations(
    photo_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get annotations for a photo"""
    
    photo = await db.inspection_photos.find_one({"id": photo_id}, {"annotations": 1})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    annotations = []
    if photo.get("annotations"):
        try:
            annotations = json.loads(photo["annotations"])
        except json.JSONDecodeError:
            pass
    
    return {"annotations": annotations}


# ========== BEFORE/AFTER PAIRS ==========

@router.post("/photos/{photo_id}/pair")
async def pair_before_after_photos(
    photo_id: str,
    paired_photo_id: str = Form(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Pair two photos as before/after"""
    
    # Get both photos
    photo1 = await db.inspection_photos.find_one({"id": photo_id})
    photo2 = await db.inspection_photos.find_one({"id": paired_photo_id})
    
    if not photo1 or not photo2:
        raise HTTPException(status_code=404, detail="One or both photos not found")
    
    # Update both photos with pairing info
    await db.inspection_photos.update_one(
        {"id": photo_id},
        {"$set": {"paired_photo_id": paired_photo_id, "is_before": True, "is_after": False}}
    )
    await db.inspection_photos.update_one(
        {"id": paired_photo_id},
        {"$set": {"paired_photo_id": photo_id, "is_before": False, "is_after": True}}
    )
    
    return {"message": "Photos paired as before/after"}


# ========== GALLERY & ORGANIZATION ==========

@router.get("/claim/{claim_id}/photos")
async def get_claim_photos(
    claim_id: str,
    room: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all photos for a claim, organized by room"""
    
    query = {"claim_id": claim_id}
    if room:
        query["room"] = room
    if category:
        query["category"] = category
    
    photos = await db.inspection_photos.find(query, {"_id": 0, "annotations": 0}).sort("captured_at", -1).to_list(500)
    
    # Add URLs
    for photo in photos:
        photo["url"] = f"/api/inspections/photos/{photo['id']}/image"
        photo["thumbnail_url"] = f"/api/inspections/photos/{photo['id']}/thumbnail"
    
    # Group by room
    by_room = {}
    for photo in photos:
        room_name = photo.get("room") or "Uncategorized"
        if room_name not in by_room:
            by_room[room_name] = []
        by_room[room_name].append(photo)
    
    # Get before/after pairs
    pairs = []
    for photo in photos:
        if photo.get("is_before") and photo.get("paired_photo_id"):
            after_photo = next((p for p in photos if p["id"] == photo["paired_photo_id"]), None)
            if after_photo:
                pairs.append({
                    "before": photo,
                    "after": after_photo
                })
    
    return {
        "total": len(photos),
        "photos": photos,
        "by_room": by_room,
        "before_after_pairs": pairs,
        "rooms": list(by_room.keys())
    }


@router.get("/claim/{claim_id}/timeline")
async def get_claim_photo_timeline(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get photos organized as a timeline"""
    
    photos = await db.inspection_photos.find(
        {"claim_id": claim_id},
        {"_id": 0, "annotations": 0}
    ).sort("captured_at", 1).to_list(500)
    
    # Group by date
    by_date = {}
    for photo in photos:
        photo["url"] = f"/api/inspections/photos/{photo['id']}/image"
        date = photo.get("captured_at", "")[:10]  # YYYY-MM-DD
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(photo)
    
    timeline = [
        {"date": date, "photos": photos}
        for date, photos in sorted(by_date.items())
    ]
    
    return {"timeline": timeline, "total": len(photos)}


# ========== BULK PHOTO ACTIONS ==========

class BulkPhotoAction(BaseModel):
    action: str  # "delete" | "recategorize" | "move_room"
    photo_ids: List[str]
    room: Optional[str] = None
    category: Optional[str] = None


@router.post("/photos/bulk")
async def bulk_photo_action(
    data: BulkPhotoAction,
    current_user: dict = Depends(get_current_active_user)
):
    """Bulk operations on photos: delete, re-categorize, or move to room."""
    if not data.photo_ids:
        raise HTTPException(status_code=400, detail="No photo IDs provided")

    affected = 0

    if data.action == "delete":
        for pid in data.photo_ids:
            photo = await db.inspection_photos.find_one({"id": pid})
            if not photo:
                continue
            # Delete file
            if photo.get("claim_id"):
                fp = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
            else:
                fp = os.path.join(PHOTO_DIR, photo["filename"])
            if os.path.exists(fp):
                os.remove(fp)
            # Delete thumbnail too
            thumb_dir = os.path.join(PHOTO_DIR, photo.get("claim_id", ""), "thumbnails") if photo.get("claim_id") else os.path.join(PHOTO_DIR, "thumbnails")
            thumb_fp = os.path.join(thumb_dir, photo["filename"])
            if os.path.exists(thumb_fp):
                os.remove(thumb_fp)
            # Update session count
            if photo.get("session_id"):
                await db.inspection_sessions.update_one(
                    {"id": photo["session_id"]}, {"$inc": {"photo_count": -1}}
                )
            await db.inspection_photos.delete_one({"id": pid})
            affected += 1
        return {"message": f"{affected} photos deleted", "affected": affected}

    elif data.action == "recategorize":
        if not data.category:
            raise HTTPException(status_code=400, detail="category required for recategorize")
        result = await db.inspection_photos.update_many(
            {"id": {"$in": data.photo_ids}},
            {"$set": {"category": data.category}},
        )
        return {"message": f"{result.modified_count} photos re-categorized", "affected": result.modified_count}

    elif data.action == "move_room":
        if not data.room:
            raise HTTPException(status_code=400, detail="room required for move_room")
        result = await db.inspection_photos.update_many(
            {"id": {"$in": data.photo_ids}},
            {"$set": {"room": data.room}},
        )
        return {"message": f"{result.modified_count} photos moved", "affected": result.modified_count}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {data.action}")


# ========== PHOTO PDF EXPORT ==========

@router.get("/claim/{claim_id}/export-pdf")
async def export_claim_photos_pdf(
    claim_id: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Export all claim photos as a PDF report grouped by room with captions.
    Accepts Bearer token or ?token= query param (for browser GET in new tab)."""
    user = None
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            if payload:
                uid = payload.get("sub")
                if uid:
                    user = await db.users.find_one({"id": uid})
        except:
            pass
    if not user and token:
        user = await get_user_from_token_param(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    import io

    # Get claim info
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Get photos grouped by room
    photos = await db.inspection_photos.find(
        {"claim_id": claim_id}, {"_id": 0, "annotations": 0}
    ).sort("captured_at", 1).to_list(500)

    if not photos:
        raise HTTPException(status_code=404, detail="No photos found for this claim")

    by_room = {}
    for p in photos:
        room_name = p.get("room") or "Uncategorized"
        by_room.setdefault(room_name, []).append(p)

    # Build PDF in memory
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, spaceAfter=6)
    subtitle_style = ParagraphStyle("Subtitle2", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
    room_style = ParagraphStyle("RoomHeader", parent=styles["Heading2"], fontSize=14, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#EA580C"))
    caption_style = ParagraphStyle("Caption", parent=styles["Normal"], fontSize=9, textColor=colors.grey, spaceAfter=4)

    elements = []

    # Cover page
    client_name = claim.get("client_name") or claim.get("insured_name") or "Unknown"
    address = claim.get("property_address") or claim.get("loss_location") or "Unknown"
    elements.append(Paragraph(f"Inspection Photo Report", title_style))
    elements.append(Paragraph(f"{client_name} — {address}", subtitle_style))
    elements.append(Paragraph(f"Claim #{claim.get('claim_number', 'N/A')} | {len(photos)} photos | {len(by_room)} rooms", subtitle_style))
    elements.append(Spacer(1, 0.3 * inch))

    for room_name, room_photos in by_room.items():
        elements.append(Paragraph(f"{room_name} ({len(room_photos)} photos)", room_style))

        for photo in room_photos:
            # Try to add photo image
            if photo.get("claim_id"):
                fp = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
            else:
                fp = os.path.join(PHOTO_DIR, photo["filename"])

            if os.path.exists(fp):
                try:
                    img = RLImage(fp, width=4.5 * inch, height=3 * inch, kind="proportional")
                    elements.append(img)
                except Exception:
                    elements.append(Paragraph("[Image could not be loaded]", caption_style))
            else:
                elements.append(Paragraph("[Image file missing]", caption_style))

            # Caption line
            parts = []
            if photo.get("ai_caption"):
                parts.append(photo["ai_caption"])
            if photo.get("category"):
                parts.append(f"Category: {photo['category']}")
            if photo.get("voice_snippet"):
                parts.append(f'Voice: "{photo["voice_snippet"][:120]}"')
            cap_text = " | ".join(parts) if parts else photo.get("original_name", "")
            elements.append(Paragraph(cap_text, caption_style))
            elements.append(Spacer(1, 0.15 * inch))

        elements.append(Spacer(1, 0.1 * inch))

    doc.build(elements)
    buf.seek(0)

    from fastapi.responses import StreamingResponse
    filename = f"inspection_{claim_id[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ========== ROOM PRESETS ==========

ROOM_PRESETS = [
    {"id": "exterior_front", "name": "Exterior - Front", "icon": "home"},
    {"id": "exterior_back", "name": "Exterior - Back", "icon": "home"},
    {"id": "exterior_left", "name": "Exterior - Left Side", "icon": "home"},
    {"id": "exterior_right", "name": "Exterior - Right Side", "icon": "home"},
    {"id": "roof", "name": "Roof", "icon": "roof"},
    {"id": "living_room", "name": "Living Room", "icon": "sofa"},
    {"id": "kitchen", "name": "Kitchen", "icon": "utensils"},
    {"id": "master_bedroom", "name": "Master Bedroom", "icon": "bed"},
    {"id": "bedroom_2", "name": "Bedroom 2", "icon": "bed"},
    {"id": "bedroom_3", "name": "Bedroom 3", "icon": "bed"},
    {"id": "bathroom_master", "name": "Master Bathroom", "icon": "bath"},
    {"id": "bathroom_2", "name": "Bathroom 2", "icon": "bath"},
    {"id": "garage", "name": "Garage", "icon": "car"},
    {"id": "attic", "name": "Attic", "icon": "archive"},
    {"id": "basement", "name": "Basement", "icon": "layers"},
    {"id": "laundry", "name": "Laundry Room", "icon": "droplet"},
    {"id": "hvac", "name": "HVAC System", "icon": "wind"},
    {"id": "electrical", "name": "Electrical Panel", "icon": "zap"},
    {"id": "plumbing", "name": "Plumbing", "icon": "droplet"},
    {"id": "pool", "name": "Pool/Spa", "icon": "droplet"},
    {"id": "fence", "name": "Fence", "icon": "grid"},
    {"id": "landscaping", "name": "Landscaping", "icon": "tree"},
    {"id": "other", "name": "Other", "icon": "folder"}
]

CATEGORY_PRESETS = [
    {"id": "overview", "name": "Overview", "color": "#3B82F6"},
    {"id": "damage", "name": "Damage", "color": "#EF4444"},
    {"id": "before", "name": "Before", "color": "#F59E0B"},
    {"id": "after", "name": "After", "color": "#10B981"},
    {"id": "measurement", "name": "Measurement", "color": "#8B5CF6"},
    {"id": "detail", "name": "Detail/Close-up", "color": "#EC4899"},
    {"id": "documentation", "name": "Documentation", "color": "#6B7280"}
]


@router.get("/presets/rooms")
async def get_room_presets():
    """Get room presets for organizing photos"""
    return {"rooms": ROOM_PRESETS}


@router.get("/presets/categories")
async def get_category_presets():
    """Get category presets for tagging photos"""
    return {"categories": CATEGORY_PRESETS}


# ========== STATS ==========

@router.get("/stats")
async def get_inspection_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get inspection statistics"""
    
    total_photos = await db.inspection_photos.count_documents({})
    total_sessions = await db.inspection_sessions.count_documents({})
    completed_sessions = await db.inspection_sessions.count_documents({"status": "completed"})
    
    # Photos by category
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_category = await db.inspection_photos.aggregate(pipeline).to_list(20)
    
    return {
        "total_photos": total_photos,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "photos_by_category": {item["_id"] or "uncategorized": item["count"] for item in by_category}
    }


# ========== VOICE RECORDING & TRANSCRIPTION ==========

AUDIO_DIR = os.environ.get("AUDIO_DIR", str(BACKEND_DIR / "uploads" / "audio"))
os.makedirs(AUDIO_DIR, exist_ok=True)


@router.post("/sessions/voice")
async def upload_session_voice(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Upload voice recording for an inspection session and transcribe with Whisper.
    Audio is matched to photos by timestamp after transcription.
    """
    # Validate session exists
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate file type
    allowed_types = ["audio/webm", "audio/mp3", "audio/mp4", "audio/mpeg", "audio/wav", "audio/m4a"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid audio type. Allowed: {', '.join(allowed_types)}")
    
    # Save audio file
    voice_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "webm"
    filename = f"{voice_id}.{ext}"
    file_path = os.path.join(AUDIO_DIR, filename)
    
    content = await file.read()
    file_size = len(content)
    
    # Check file size (25MB limit for Whisper)
    if file_size > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large. Maximum 25MB.")
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update session with voice recording info
    await db.inspection_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "voice_recording_id": voice_id,
            "voice_recording_filename": filename
        }}
    )
    
    # Transcribe with Whisper (direct OpenAI API)
    transcript_text = None
    try:
        from openai import OpenAI

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

        client = OpenAI(api_key=api_key)

        with open(file_path, "rb") as audio_file:
            response = await asyncio.to_thread(
                client.audio.transcriptions.create,
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language="en",
                prompt="This is an insurance property inspection. The speaker is describing damage, rooms, and conditions they observe.",
                timestamp_granularities=["segment"],
            )

        transcript_text = response.text

        # Store transcript
        await db.inspection_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "voice_transcript": transcript_text,
                "voice_transcribed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        # Attach voice snippets to photos
        await attach_voice_snippets_to_photos(session_id, response)

    except Exception as e:
        print(f"[Whisper] Transcription error: {e}")
        # Don't fail the upload if transcription fails
        transcript_text = f"Transcription pending (error: {str(e)[:100]})"
    
    return {
        "voice_recording_id": voice_id,
        "filename": filename,
        "file_size": file_size,
        "transcript": transcript_text,
        "message": "Voice recording uploaded and transcription started"
    }


async def attach_voice_snippets_to_photos(session_id: str, whisper_response):
    """
    Match transcript segments to photos based on capture time offset.
    Uses Whisper's segment timestamps to find relevant narration for each photo.
    """
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session or not session.get("started_at"):
        return
    
    # Get all photos for this session
    photos = await db.inspection_photos.find({"session_id": session_id}).to_list(500)
    if not photos:
        return
    
    # Parse session start time
    from dateutil.parser import parse as parse_datetime
    session_start = parse_datetime(session["started_at"])
    
    # Get segments from Whisper response
    segments = []
    if hasattr(whisper_response, 'segments') and whisper_response.segments:
        for seg in whisper_response.segments:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip()
            })
    else:
        # Fallback: split transcript by sentences if no segments
        transcript = session.get("voice_transcript", "")
        if transcript:
            sentences = transcript.replace(".", ".|").replace("?", "?|").replace("!", "!|").split("|")
            sentences = [s.strip() for s in sentences if s.strip()]
            # Estimate 3 seconds per sentence
            for i, sentence in enumerate(sentences):
                segments.append({
                    "start": i * 3,
                    "end": (i + 1) * 3,
                    "text": sentence
                })
    
    # Match photos to segments
    for photo in photos:
        try:
            photo_time = parse_datetime(photo.get("captured_at", ""))
            offset_seconds = (photo_time - session_start).total_seconds()
            
            if offset_seconds < 0:
                offset_seconds = 0
            
            # Find segments within a window around the photo capture time
            # Look 5 seconds before and 10 seconds after
            relevant_snippets = []
            for seg in segments:
                if seg["start"] <= offset_seconds + 10 and seg["end"] >= offset_seconds - 5:
                    relevant_snippets.append(seg["text"])
            
            if relevant_snippets:
                voice_snippet = " ".join(relevant_snippets)
                await db.inspection_photos.update_one(
                    {"id": photo["id"]},
                    {"$set": {"voice_snippet": voice_snippet}}
                )
        except Exception as e:
            print(f"[VoiceMatch] Error matching photo {photo.get('id')}: {e}")
            continue
    
    # After attaching snippets, extract AI tags
    await extract_ai_tags_for_session(session_id)


async def extract_ai_tags_for_session(session_id: str):
    """
    Use LLM to extract room names, damage types, and categories from voice snippets.
    Updates each photo with AI-generated tags.
    """
    photos = await db.inspection_photos.find(
        {"session_id": session_id, "voice_snippet": {"$ne": None}}
    ).to_list(500)
    
    if not photos:
        return
    
    # Define common room/damage categories for tagging
    ROOM_KEYWORDS = {
        "kitchen": ["kitchen", "stove", "refrigerator", "fridge", "sink", "cabinets", "countertop"],
        "bathroom": ["bathroom", "bath", "toilet", "shower", "tub", "vanity"],
        "living room": ["living room", "living", "family room", "den", "fireplace", "tv room"],
        "bedroom": ["bedroom", "bed", "master", "guest room", "closet"],
        "garage": ["garage", "car", "parking", "tools"],
        "roof": ["roof", "roofing", "shingles", "attic", "gutter", "fascia", "soffit"],
        "exterior": ["exterior", "outside", "siding", "fence", "yard", "landscaping", "driveway"],
        "hallway": ["hallway", "corridor", "stairs", "stairway", "landing"],
        "basement": ["basement", "cellar", "foundation"],
        "laundry": ["laundry", "washer", "dryer", "utility room"],
    }
    
    DAMAGE_KEYWORDS = {
        "water damage": ["water", "leak", "flood", "moisture", "wet", "stain", "mold", "mildew"],
        "wind damage": ["wind", "blown", "torn", "missing", "lifted"],
        "fire damage": ["fire", "burn", "smoke", "soot", "charred"],
        "hail damage": ["hail", "dent", "impact", "pitting"],
        "structural": ["crack", "structural", "foundation", "settling", "buckling"],
        "roof damage": ["shingle", "roofing", "leak", "missing", "exposed"],
        "electrical": ["electrical", "outlet", "wire", "circuit"],
        "plumbing": ["pipe", "plumbing", "drain", "faucet", "water heater"],
    }
    
    for photo in photos:
        snippet = (photo.get("voice_snippet") or "").lower()
        if not snippet:
            continue
        
        # Extract room from voice snippet
        detected_room = None
        for room, keywords in ROOM_KEYWORDS.items():
            if any(kw in snippet for kw in keywords):
                detected_room = room.title()
                break
        
        # Extract damage type
        detected_damage = []
        for damage, keywords in DAMAGE_KEYWORDS.items():
            if any(kw in snippet for kw in keywords):
                detected_damage.append(damage)
        
        # Build AI tags list
        ai_tags = []
        if detected_room:
            ai_tags.append(detected_room)
        ai_tags.extend(detected_damage[:3])  # Limit to top 3 damage types
        
        # Update photo with detected room and tags
        update_data = {}
        if detected_room and not photo.get("room"):
            update_data["room"] = detected_room
        if ai_tags:
            update_data["ai_tags"] = ai_tags
        if detected_damage:
            update_data["category"] = detected_damage[0].title()  # Primary damage type
        
        if update_data:
            await db.inspection_photos.update_one(
                {"id": photo["id"]},
                {"$set": update_data}
            )
            print(f"[AITag] Photo {photo['id'][:8]}... tagged: room={detected_room}, tags={ai_tags}")


@router.post("/photos/{photo_id}/ai-tag")
async def ai_tag_single_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Manually trigger AI tagging for a single photo based on its voice snippet.
    """
    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    snippet = photo.get("voice_snippet") or ""
    if not snippet:
        return {"message": "No voice snippet to analyze", "ai_tags": []}
    
    # Run tagging logic for single photo
    snippet_lower = snippet.lower()
    
    ROOM_KEYWORDS = {
        "kitchen": ["kitchen", "stove", "refrigerator", "sink", "cabinets"],
        "bathroom": ["bathroom", "toilet", "shower", "tub"],
        "living room": ["living room", "living", "family room", "fireplace"],
        "bedroom": ["bedroom", "bed", "master", "closet"],
        "garage": ["garage", "car", "parking"],
        "roof": ["roof", "shingles", "attic", "gutter"],
        "exterior": ["exterior", "outside", "siding", "fence", "yard"],
    }
    
    DAMAGE_KEYWORDS = {
        "water damage": ["water", "leak", "flood", "moisture", "wet", "mold"],
        "wind damage": ["wind", "blown", "torn", "missing"],
        "fire damage": ["fire", "burn", "smoke", "soot"],
        "hail damage": ["hail", "dent", "impact"],
        "structural": ["crack", "structural", "foundation"],
    }
    
    detected_room = None
    for room, keywords in ROOM_KEYWORDS.items():
        if any(kw in snippet_lower for kw in keywords):
            detected_room = room.title()
            break
    
    detected_damage = []
    for damage, keywords in DAMAGE_KEYWORDS.items():
        if any(kw in snippet_lower for kw in keywords):
            detected_damage.append(damage)
    
    ai_tags = []
    if detected_room:
        ai_tags.append(detected_room)
    ai_tags.extend(detected_damage[:3])
    
    # Update photo
    update_data = {"ai_tags": ai_tags}
    if detected_room:
        update_data["room"] = detected_room
    if detected_damage:
        update_data["category"] = detected_damage[0].title()
    
    await db.inspection_photos.update_one(
        {"id": photo_id},
        {"$set": update_data}
    )
    
    return {
        "photo_id": photo_id,
        "detected_room": detected_room,
        "ai_tags": ai_tags,
        "voice_snippet": snippet[:200]
    }


@router.get("/sessions/{session_id}/transcript")
async def get_session_transcript(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get the voice transcript for a session"""
    session = await db.inspection_sessions.find_one(
        {"id": session_id},
        {"_id": 0, "voice_transcript": 1, "voice_transcribed_at": 1, "voice_recording_id": 1}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "transcript": session.get("voice_transcript"),
        "transcribed_at": session.get("voice_transcribed_at"),
        "has_recording": bool(session.get("voice_recording_id"))
    }


# ========== AI INSPECTION REPORTS ==========

class InspectionReport(BaseModel):
    """Generated inspection report structure"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    claim_id: str
    report_json: dict  # Structured report sections
    report_markdown: str  # Rendered markdown
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    generated_by: str = ""
    version: int = 1


# Enhanced JSON Schema for Eve's output
INSPECTION_REPORT_SCHEMA = {
    "header": {
        "firm_name": "string",
        "firm_address": "string",
        "firm_phone": "string",
        "firm_email": "string",
        "claim_number": "string",
        "insured_name": "string",
        "property_address": "string",
        "report_date": "string"
    },
    "overview": {
        "summary": "string",
        "inspection_date": "string",
        "inspector_name": "string",
        "loss_cause": "string",
        "policy_info": "string"
    },
    "exterior_roof": {
        "summary": "string",
        "details": "string",
        "notable_conditions": ["string"]
    },
    "interior": [
        {
            "room": "Kitchen",
            "summary": "string",
            "damage_description": "string",
            "possible_cause": "string",
            "voice_notes_used": "string"
        }
    ],
    "systems": {
        "hvac": "string",
        "electrical": "string",
        "plumbing": "string",
        "other": "string"
    },
    "key_findings": ["string"],
    "risks_concerns": ["string"],
    "recommended_next_steps": ["string"],
    "carrier_strategy_notes": "string",
    "signature_block": {
        "adjuster_name": "string",
        "license_number": "string",
        "firm_name": "string",
        "title": "string"
    }
}

INSPECTION_REPORT_SYSTEM_PROMPT = """
You are Eve, an expert public adjuster and property inspector in Florida.

You create carrier-ready inspection reports based on:
- Claim metadata
- Inspection session metadata
- Photos (rooms, categories, optional AI captions)
- Voice transcript snippets attached to photos
- The full session transcript

Your output must ALWAYS be valid JSON, matching the exact schema provided in the instructions.
Do not include any extra keys. Do not include explanations. Just return JSON.
"""

INSPECTION_REPORT_USER_PROMPT_TEMPLATE = """
Use the following data to build a structured inspection report JSON.

SCHEMA (do NOT change keys; fill them with appropriate text/list values):
{schema}

CLAIM:
{claim_json}

INSPECTION_SESSION:
{session_json}

PHOTOS_WITH_NOTES:
{photos_json}

FULL_TRANSCRIPT:
{transcript_text}

Instructions:
1. Read the claim and session to understand the property, loss, and context.
2. Use photos_json and voice snippets to build room-by-room details.
3. Use the full transcript to catch any extra observations or concerns.
4. Fill every field in the JSON schema with concise, professional text.
5. "carrier_strategy_notes" should mention any angles or concerns relevant for negotiation.
6. Keep language clear, organized, and neutral – suitable to share with a carrier.

Return ONLY valid JSON in the schema above.
"""


def build_inspection_report_prompt(claim: dict, session: dict, photos: list, transcript: str) -> str:
    """Build the user prompt for Eve's report generation"""
    schema = json.dumps(INSPECTION_REPORT_SCHEMA, indent=2)
    claim_json = json.dumps(claim, default=str, indent=2)
    session_json = json.dumps(session, default=str, indent=2)
    photos_json = json.dumps(photos, default=str, indent=2)
    
    return INSPECTION_REPORT_USER_PROMPT_TEMPLATE.format(
        schema=schema,
        claim_json=claim_json,
        session_json=session_json,
        photos_json=photos_json,
        transcript_text=transcript or "No voice recording for this session."
    )


def render_report_markdown(report: dict) -> str:
    """Convert structured report JSON to markdown for display/copy"""
    h = report.get("header", {})
    o = report.get("overview", {})
    er = report.get("exterior_roof", {})
    sys = report.get("systems", {})
    sig = report.get("signature_block", {})
    
    lines = []
    
    # Header
    lines.append(f"# {h.get('firm_name', 'Eden Claims Services')}")
    lines.append(h.get("firm_address", ""))
    if h.get("firm_phone") or h.get("firm_email"):
        lines.append(f"Phone: {h.get('firm_phone', '')} | Email: {h.get('firm_email', '')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"**Claim:** {h.get('claim_number', 'N/A')} – {h.get('insured_name', 'N/A')}")
    lines.append(f"**Property:** {h.get('property_address', 'N/A')}")
    lines.append(f"**Date of Report:** {h.get('report_date', 'N/A')}")
    lines.append("")
    
    # Overview
    lines.append("## Overview")
    lines.append("")
    if isinstance(o, dict):
        lines.append(o.get("summary", "No overview provided."))
        lines.append("")
        if o.get("inspection_date"):
            lines.append(f"**Inspection Date:** {o.get('inspection_date')}")
        if o.get("inspector_name"):
            lines.append(f"**Inspector:** {o.get('inspector_name')}")
        if o.get("loss_cause"):
            lines.append(f"**Loss Cause:** {o.get('loss_cause')}")
        if o.get("policy_info"):
            lines.append(f"**Policy Info:** {o.get('policy_info')}")
    else:
        lines.append(str(o) if o else "No overview provided.")
    lines.append("")
    
    # Exterior & Roof
    lines.append("## Exterior & Roof")
    lines.append("")
    if isinstance(er, dict):
        lines.append(er.get("summary", "No exterior/roof findings documented."))
        if er.get("details"):
            lines.append("")
            lines.append(er.get("details"))
        if er.get("notable_conditions"):
            lines.append("")
            lines.append("**Notable Conditions:**")
            for cond in er.get("notable_conditions", []):
                lines.append(f"- {cond}")
    else:
        lines.append(str(er) if er else "No exterior/roof findings documented.")
    lines.append("")
    
    # Interior
    lines.append("## Interior")
    lines.append("")
    interior = report.get("interior", [])
    if interior and isinstance(interior, list):
        for room in interior:
            if isinstance(room, dict):
                lines.append(f"### {room.get('room', 'Unknown Room')}")
                lines.append("")
                if room.get("summary"):
                    lines.append(room.get("summary"))
                    lines.append("")
                if room.get("damage_description"):
                    lines.append(f"**Damage:** {room.get('damage_description')}")
                if room.get("possible_cause"):
                    lines.append(f"**Possible Cause:** {room.get('possible_cause')}")
                if room.get("voice_notes_used"):
                    lines.append(f"**Voice Notes:** {room.get('voice_notes_used')}")
                lines.append("")
    else:
        lines.append("No interior rooms documented.")
    lines.append("")
    
    # Systems
    lines.append("## Systems (HVAC, Electrical, Plumbing)")
    lines.append("")
    if isinstance(sys, dict):
        if sys.get("hvac"):
            lines.append(f"**HVAC:** {sys.get('hvac')}")
        if sys.get("electrical"):
            lines.append(f"**Electrical:** {sys.get('electrical')}")
        if sys.get("plumbing"):
            lines.append(f"**Plumbing:** {sys.get('plumbing')}")
        if sys.get("other"):
            lines.append(f"**Other:** {sys.get('other')}")
        if not any([sys.get("hvac"), sys.get("electrical"), sys.get("plumbing"), sys.get("other")]):
            lines.append("Not inspected or no issues noted.")
    else:
        lines.append(str(sys) if sys else "Not inspected or no issues noted.")
    lines.append("")
    
    # Key Findings
    lines.append("## Key Findings & Concerns")
    lines.append("")
    findings = report.get("key_findings", [])
    if findings:
        for f in findings:
            lines.append(f"- {f}")
    else:
        lines.append("No key findings documented.")
    lines.append("")
    
    # Risks & Concerns
    risks = report.get("risks_concerns", [])
    if risks:
        lines.append("### Risks & Concerns")
        lines.append("")
        for r in risks:
            lines.append(f"- {r}")
        lines.append("")
    
    # Recommended Next Steps
    lines.append("## Recommended Next Steps")
    lines.append("")
    steps = report.get("recommended_next_steps", [])
    if steps:
        for i, s in enumerate(steps, 1):
            lines.append(f"{i}. {s}")
    else:
        lines.append("No recommendations at this time.")
    lines.append("")
    
    # Carrier Strategy Notes
    if report.get("carrier_strategy_notes"):
        lines.append("## Carrier Strategy Notes")
        lines.append("")
        lines.append(report.get("carrier_strategy_notes"))
        lines.append("")
    
    # Signature Block
    lines.append("---")
    lines.append("")
    lines.append("**Sincerely,**")
    lines.append("")
    lines.append(sig.get("adjuster_name", "Licensed Public Adjuster"))
    if sig.get("title"):
        lines.append(sig.get("title"))
    if sig.get("license_number"):
        lines.append(f"License: {sig.get('license_number')}")
    lines.append(sig.get("firm_name", "Eden Claims Services"))
    
    return "\n".join(lines)


@router.post("/sessions/{session_id}/report")
async def generate_inspection_report(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Generate an AI inspection report from session data.
    Returns both structured JSON and rendered markdown.
    """
    # Get session
    session = await db.inspection_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get claim
    claim = await db.claims.find_one({"id": session["claim_id"]}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get photos with voice snippets
    photos = await db.inspection_photos.find(
        {"session_id": session_id},
        {"_id": 0, "filename": 0, "annotations": 0}
    ).to_list(500)
    
    # Get transcript
    transcript = session.get("voice_transcript", "")
    
    # Build prompt using the template
    user_prompt = build_inspection_report_prompt(claim, session, photos, transcript)
    
    # Generate report with LLM (Ollama/OpenAI/Anthropic)
    try:
        from emergentintegrations.llm.chat import LlmChat

        chat = LlmChat(system_message=INSPECTION_REPORT_SYSTEM_PROMPT)
        chat._resolve_default_provider()
        response_text_raw = await chat.send_message(type('Msg', (), {'text': user_prompt, 'content': user_prompt})())

        # Parse JSON from response
        report_json = None
        response_text = response_text_raw.strip()
        
        # Try to extract JSON from response
        if response_text.startswith("{"):
            try:
                report_json = json.loads(response_text)
            except json.JSONDecodeError:
                pass
        
        if not report_json:
            # Try to find JSON block in response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    report_json = json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
        
        if not report_json:
            # Fallback: create basic structure matching the enhanced schema
            report_json = {
                "header": {
                    "firm_name": "Eden Claims Services",
                    "firm_address": "Miami, FL",
                    "firm_phone": "",
                    "firm_email": "",
                    "claim_number": claim.get("claim_number", ""),
                    "insured_name": claim.get("client_name") or claim.get("insured_name", ""),
                    "property_address": claim.get("property_address") or claim.get("loss_location", ""),
                    "report_date": datetime.now().strftime("%Y-%m-%d")
                },
                "overview": {
                    "summary": response_text[:1000] if response_text else "No overview available.",
                    "inspection_date": session.get("started_at", "")[:10] if session.get("started_at") else "",
                    "inspector_name": session.get("created_by", ""),
                    "loss_cause": claim.get("loss_type", ""),
                    "policy_info": claim.get("policy_number", "")
                },
                "exterior_roof": {
                    "summary": "",
                    "details": "",
                    "notable_conditions": []
                },
                "interior": [],
                "systems": {
                    "hvac": "Not inspected",
                    "electrical": "Not inspected",
                    "plumbing": "Not inspected",
                    "other": ""
                },
                "key_findings": [],
                "risks_concerns": [],
                "recommended_next_steps": [],
                "carrier_strategy_notes": "",
                "signature_block": {
                    "adjuster_name": session.get("created_by", "Licensed Public Adjuster"),
                    "license_number": "",
                    "firm_name": "Eden Claims Services",
                    "title": "Public Adjuster"
                }
            }
        
        # Generate markdown from JSON
        report_markdown = render_report_markdown(report_json)
        
        # Save report
        report = InspectionReport(
            session_id=session_id,
            claim_id=session["claim_id"],
            report_json=report_json,
            report_markdown=report_markdown,
            generated_by=current_user.get("email", "")
        )
        
        # Check for existing reports and increment version
        existing = await db.inspection_reports.find(
            {"session_id": session_id}
        ).sort("version", -1).limit(1).to_list(1)
        
        if existing:
            report.version = existing[0].get("version", 0) + 1
        
        await db.inspection_reports.insert_one(report.model_dump())
        
        return {
            "id": report.id,
            "session_id": session_id,
            "claim_id": session["claim_id"],
            "report_json": report_json,
            "report_markdown": report_markdown,
            "version": report.version,
            "generated_at": report.generated_at
        }
        
    except Exception as e:
        print(f"[Report] Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/sessions/{session_id}/reports")
async def get_session_reports(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all reports for a session (version history)"""
    reports = await db.inspection_reports.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("version", -1).to_list(50)
    
    return {
        "session_id": session_id,
        "reports": reports,
        "count": len(reports)
    }


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific report by ID"""
    report = await db.inspection_reports.find_one(
        {"id": report_id},
        {"_id": 0}
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report
