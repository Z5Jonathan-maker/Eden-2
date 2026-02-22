"""
Inspection Photos API - Enhanced photo documentation for claims
Competitive with CompanyCam features
"""
import os
import uuid
import json
import re
import base64
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, StreamingResponse, Response
import zipfile
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user, get_user_from_token_param

# Pillow for GPS watermark and EXIF extraction
try:
    from PIL import Image as PILImage, ImageDraw, ImageFont
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
from auth import decode_access_token
from .models import (
    PhotoMetadata, PhotoAnnotation, PhotoUploadResponse,
    CreateInspectionSession, InspectionSession, InspectionReport
)

router = APIRouter()
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


# Models imported from .models


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

    # Extract GPS from EXIF if not provided in form data
    if not latitude or not longitude:
        try:
            if HAS_PILLOW:
                img = PILImage.open(file_path)
                exif_data = img._getexif()
                if exif_data:
                    gps_info = {}
                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag == "GPSInfo":
                            for gps_tag_id in value:
                                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                                gps_info[gps_tag] = value[gps_tag_id]

                    if gps_info:
                        # Convert GPS coordinates
                        def convert_to_degrees(value):
                            d, m, s = value
                            return float(d) + float(m) / 60 + float(s) / 3600

                        if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                            lat = convert_to_degrees(gps_info["GPSLatitude"])
                            lng = convert_to_degrees(gps_info["GPSLongitude"])
                            if gps_info.get("GPSLatitudeRef") == "S":
                                lat = -lat
                            if gps_info.get("GPSLongitudeRef") == "W":
                                lng = -lng
                            latitude = lat
                            longitude = lng
                img.close()
        except Exception as e:
            print(f"[EXIF] Could not extract GPS: {e}")

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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Get photo thumbnail (for now, returns full image - can add resize later). Requires Bearer token."""
    return await get_photo_image(photo_id, token=None, credentials=credentials)


@router.get("/photos/{photo_id}/watermarked")
async def get_photo_watermarked(
    photo_id: str,
    include_gps: bool = Query(True, description="Overlay GPS coordinates"),
    include_timestamp: bool = Query(True, description="Overlay capture timestamp"),
    include_caption: bool = Query(False, description="Overlay AI caption"),
    token: Optional[str] = Query(None, description="Auth token for backward-compat img src access"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Return the photo with a GPS / timestamp / caption watermark bar burned in.

    Accepts Bearer token via Authorization header or ?token= query param.
    The watermarked image is generated on the fly and never saved to disk.
    """

    if not HAS_PILLOW:
        raise HTTPException(status_code=500, detail="Pillow not installed - watermark unavailable")

    # ---- authenticate (same pattern as /image endpoint) ----
    user = None

    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            if payload:
                user_id = payload.get("sub")
                if user_id:
                    user = await db.users.find_one({"id": user_id})
        except Exception:
            pass

    if not user and token:
        user = await get_user_from_token_param(token)

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized - valid token required")

    # ---- fetch photo metadata ----
    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # ---- resolve file on disk ----
    if photo.get("claim_id"):
        file_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
    else:
        file_path = os.path.join(PHOTO_DIR, photo["filename"])

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found on disk")

    # ---- open image with Pillow ----
    img = PILImage.open(file_path).convert("RGBA")
    img_width, img_height = img.size

    # ---- build the watermark bar ----
    bar_height = 60
    overlay = PILImage.new("RGBA", (img_width, bar_height), (0, 0, 0, 160))
    draw = ImageDraw.Draw(overlay)

    # Try to load a readable font; fall back to Pillow default
    font = None
    font_size = 18
    try:
        # Try common system paths for DejaVuSans
        for candidate in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]:
            if os.path.exists(candidate):
                font = ImageFont.truetype(candidate, font_size)
                break
    except Exception:
        pass
    if font is None:
        try:
            font = ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()

    text_color = (255, 255, 255, 255)
    padding = 12

    # Collect text segments: (text, alignment)
    # alignment: "left", "center", "right"
    segments: list[tuple[str, str]] = []

    # GPS
    lat = photo.get("latitude")
    lng = photo.get("longitude")
    if include_gps and lat is not None and lng is not None:
        segments.append((f"GPS: {lat:.4f}, {lng:.4f}", "left"))

    # Timestamp
    if include_timestamp:
        raw_ts = photo.get("captured_at") or photo.get("created_at") or ""
        display_ts = raw_ts
        try:
            from dateutil.parser import parse as _parse_dt
            dt = _parse_dt(raw_ts)
            display_ts = dt.strftime("%Y-%m-%d %-I:%M %p")
        except Exception:
            try:
                from dateutil.parser import parse as _parse_dt2
                dt = _parse_dt2(raw_ts)
                display_ts = dt.strftime("%Y-%m-%d %I:%M %p").lstrip("0")
            except Exception:
                pass
        if display_ts:
            segments.append((display_ts, "center"))

    # AI Caption
    if include_caption:
        caption = photo.get("ai_caption") or ""
        if caption:
            segments.append((caption[:50], "right"))

    # ---- draw segments onto the bar ----
    # If only one segment, center it regardless of its declared alignment
    if len(segments) == 1:
        text = segments[0][0]
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        x = (img_width - tw) // 2
        y = (bar_height - (bbox[3] - bbox[1])) // 2
        draw.text((x, y), text, fill=text_color, font=font)
    else:
        for text, align in segments:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            y = (bar_height - th) // 2
            if align == "left":
                x = padding
            elif align == "right":
                x = img_width - tw - padding
            else:  # center
                x = (img_width - tw) // 2
            draw.text((x, y), text, fill=text_color, font=font)

    # ---- composite bar onto the bottom of the image ----
    img.paste(overlay, (0, img_height - bar_height), overlay)

    # ---- convert back to RGB (JPEG can't hold alpha) and stream out ----
    output_img = img.convert("RGB")
    buf = io.BytesIO()
    output_img.save(buf, format="JPEG", quality=92)
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/jpeg")


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

import os
AUDIO_DIR = os.environ.get("AUDIO_DIR", "/tmp/audio")
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
    from dotenv import load_dotenv
    load_dotenv()
    
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
    
    # Transcribe with Whisper
    transcript_text = None
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        stt = OpenAISpeechToText(api_key=api_key)
        
        with open(file_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="verbose_json",
                language="en",
                prompt="This is an insurance property inspection. The speaker is describing damage, rooms, and conditions they observe.",
                timestamp_granularities=["segment"]
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


# ========== AI DAMAGE DETECTION ==========

DAMAGE_ANALYSIS_PROMPT = """Analyze this property inspection photo for insurance claim purposes. Provide:
1. DAMAGE_TYPE: What type of damage is visible (water, wind, hail, fire, mold, structural, none)
2. SEVERITY: Rate 1-10 (1=cosmetic, 5=moderate, 10=catastrophic)
3. AFFECTED_AREA: What part of the property is affected
4. DESCRIPTION: 2-3 sentence professional description of the damage
5. REPAIR_URGENCY: low/medium/high/critical
6. ESTIMATED_SCOPE: minor_repair/moderate_repair/major_repair/full_replacement

Return ONLY valid JSON with these exact keys: damage_type, severity, affected_area, description, repair_urgency, estimated_scope"""


@router.post("/photos/{photo_id}/assess-damage")
async def assess_photo_damage(
    photo_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Use AI vision to analyse a single inspection photo for damage type,
    severity, affected area, repair urgency, and estimated scope.
    The result is persisted on the photo document as ai_damage_assessment.
    """
    # 1. Fetch photo metadata
    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # 2. Read the photo file from disk
    if photo.get("claim_id"):
        file_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
    else:
        file_path = os.path.join(PHOTO_DIR, photo["filename"])

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found on disk")

    with open(file_path, "rb") as f:
        photo_bytes = f.read()

    # 3. Encode to base64
    image_b64 = base64.b64encode(photo_bytes).decode("utf-8")

    # 4. Send to GPT-4o vision model for damage assessment
    try:
        import httpx

        api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="No AI API key configured (EMERGENT_LLM_KEY or OPENAI_API_KEY)",
            )

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a property damage assessment AI. You analyse inspection photos and return structured JSON assessments.",
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_b64}",
                                        "detail": "high",
                                    },
                                },
                                {"type": "text", "text": DAMAGE_ANALYSIS_PROMPT},
                            ],
                        },
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.2,
                },
            )

        if resp.status_code != 200:
            error_detail = resp.text[:300]
            print(f"[DamageAI] OpenAI API error {resp.status_code}: {error_detail}")
            raise HTTPException(status_code=502, detail=f"AI vision API error: {resp.status_code}")

        response = resp.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DamageAI] LLM call failed for photo {photo_id}: {e}")
        raise HTTPException(status_code=502, detail=f"AI damage assessment failed: {str(e)}")

    # 5. Parse the JSON response
    assessment = None
    response_text = response.strip()

    if response_text.startswith("{"):
        try:
            assessment = json.loads(response_text)
        except json.JSONDecodeError:
            pass

    if not assessment:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                assessment = json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

    if not assessment:
        # Fallback: build a basic assessment from the raw response text
        assessment = {
            "damage_type": "unknown",
            "severity": 5,
            "affected_area": "unknown",
            "description": response_text[:500],
            "repair_urgency": "medium",
            "estimated_scope": "moderate_repair",
            "_raw": True
        }

    # Ensure severity is an int clamped to 1-10
    try:
        assessment["severity"] = max(1, min(10, int(assessment.get("severity", 5))))
    except (ValueError, TypeError):
        assessment["severity"] = 5

    assessment["assessed_at"] = datetime.now(timezone.utc).isoformat()
    assessment["assessed_by"] = current_user.get("email", "")

    # 6. Store on the photo document (as a dict, not string)
    await db.inspection_photos.update_one(
        {"id": photo_id},
        {"$set": {"ai_damage_assessment": assessment}}
    )

    # 7. Return the assessment
    return {
        "photo_id": photo_id,
        "assessment": assessment
    }


@router.post("/claim/{claim_id}/assess-all")
async def assess_all_claim_photos(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Batch endpoint: run AI damage assessment on every photo for a claim
    that does not already have an ai_damage_assessment.
    Capped at 20 photos per call to avoid timeouts.
    """
    photos_cursor = db.inspection_photos.find(
        {
            "claim_id": claim_id,
            "ai_damage_assessment": {"$exists": False}
        },
        {"_id": 0, "id": 1, "filename": 1, "claim_id": 1}
    )
    photos = await photos_cursor.to_list(length=100)

    already_assessed = await db.inspection_photos.count_documents(
        {"claim_id": claim_id, "ai_damage_assessment": {"$exists": True}}
    )

    BATCH_LIMIT = 20
    to_process = photos[:BATCH_LIMIT]
    skipped = len(photos) - len(to_process)

    results = []
    errors = []

    for photo in to_process:
        try:
            result = await assess_photo_damage(photo["id"], current_user)
            results.append(result)
        except HTTPException as exc:
            errors.append({"photo_id": photo["id"], "error": exc.detail})
        except Exception as exc:
            errors.append({"photo_id": photo["id"], "error": str(exc)})

    return {
        "claim_id": claim_id,
        "assessed": len(results),
        "skipped": skipped,
        "previously_assessed": already_assessed,
        "errors": errors,
        "results": results
    }


@router.get("/claim/{claim_id}/damage-summary")
async def get_claim_damage_summary(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Aggregate all AI damage assessments for a claim into a single summary:
    overall severity (avg), damage types found, rooms affected,
    repair urgency breakdown, and total photos assessed.
    """
    photos_cursor = db.inspection_photos.find(
        {
            "claim_id": claim_id,
            "ai_damage_assessment": {"$exists": True}
        },
        {"_id": 0, "id": 1, "room": 1, "ai_damage_assessment": 1}
    )
    photos = await photos_cursor.to_list(length=500)

    if not photos:
        return {
            "claim_id": claim_id,
            "total_assessed": 0,
            "overall_severity": None,
            "damage_types": [],
            "rooms_affected": [],
            "repair_urgency_breakdown": {},
            "estimated_scope_breakdown": {},
            "photos": []
        }

    severities = []
    damage_types: dict[str, int] = {}
    rooms_affected: set[str] = set()
    urgency_breakdown: dict[str, int] = {}
    scope_breakdown: dict[str, int] = {}
    photo_summaries = []

    for photo in photos:
        a = photo.get("ai_damage_assessment", {})
        if not a:
            continue

        # Severity
        sev = a.get("severity")
        if sev is not None:
            try:
                severities.append(int(sev))
            except (ValueError, TypeError):
                pass

        # Damage types
        dt = a.get("damage_type", "unknown")
        damage_types[dt] = damage_types.get(dt, 0) + 1

        # Rooms
        room = photo.get("room") or a.get("affected_area") or "unknown"
        rooms_affected.add(room)

        # Urgency
        urg = a.get("repair_urgency", "unknown")
        urgency_breakdown[urg] = urgency_breakdown.get(urg, 0) + 1

        # Scope
        scope = a.get("estimated_scope", "unknown")
        scope_breakdown[scope] = scope_breakdown.get(scope, 0) + 1

        photo_summaries.append({
            "photo_id": photo["id"],
            "damage_type": dt,
            "severity": a.get("severity"),
            "repair_urgency": urg,
            "affected_area": a.get("affected_area"),
        })

    overall_severity = round(sum(severities) / len(severities), 1) if severities else None

    return {
        "claim_id": claim_id,
        "total_assessed": len(photos),
        "overall_severity": overall_severity,
        "damage_types": [{"type": k, "count": v} for k, v in sorted(damage_types.items(), key=lambda x: -x[1])],
        "rooms_affected": sorted(rooms_affected),
        "repair_urgency_breakdown": urgency_breakdown,
        "estimated_scope_breakdown": scope_breakdown,
        "photos": photo_summaries
    }


# ========== AI INSPECTION REPORTS ==========

# InspectionReport model imported from .models


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
    from dotenv import load_dotenv
    load_dotenv()
    
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
    
    # Generate report with Eve (GPT-4o via OpenAI API)
    try:
        from emergentintegrations.llm.openai import LlmChat, UserMessage

        api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="No AI API key configured (EMERGENT_LLM_KEY or OPENAI_API_KEY)")

        llm_session_id = f"report_{session_id}_{datetime.now().timestamp()}"

        llm = LlmChat(
            api_key=api_key,
            session_id=llm_session_id,
            system_message=INSPECTION_REPORT_SYSTEM_PROMPT
        )
        llm = llm.with_model(provider="openai", model="gpt-4o")

        response = await llm.send_message(UserMessage(text=user_prompt))
        
        # Parse JSON from response
        report_json = None
        response_text = response.strip()
        
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


# ========== PHOTO EXPORT (ZIP) ==========

@router.get("/claim/{claim_id}/export-zip/status")
async def export_zip_status(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Pre-check: return photo count and estimated ZIP size for a claim"""

    photos = await db.inspection_photos.find(
        {"claim_id": claim_id},
        {"_id": 0, "file_size": 1}
    ).to_list(None)

    total_size = sum(p.get("file_size", 0) for p in photos)

    return {
        "claim_id": claim_id,
        "photo_count": len(photos),
        "estimated_size_bytes": total_size,
        "estimated_size_mb": round(total_size / (1024 * 1024), 2) if total_size else 0
    }


@router.get("/claim/{claim_id}/export-zip")
async def export_zip(
    claim_id: str,
    rooms: Optional[str] = Query(None, description="Comma-separated room filter"),
    include_annotations: bool = Query(True, description="Include annotation data in manifest"),
    current_user: dict = Depends(get_current_active_user)
):
    """Export all inspection photos for a claim as a ZIP archive organised by room"""

    # Build query
    query = {"claim_id": claim_id}

    # Apply optional room filter
    room_filter_list = None
    if rooms:
        room_filter_list = [r.strip() for r in rooms.split(",") if r.strip()]
        if room_filter_list:
            query["room"] = {"$in": room_filter_list}

    photos = await db.inspection_photos.find(query, {"_id": 0}).to_list(None)

    if not photos:
        raise HTTPException(status_code=404, detail="No photos found for this claim")

    # Build in-memory ZIP
    zip_buffer = io.BytesIO()
    manifest_photos = []
    rooms_seen = set()
    files_added = 0

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for photo in photos:
            room_name = photo.get("room") or "Uncategorized"
            rooms_seen.add(room_name)

            original_name = photo.get("original_name") or photo.get("filename", "photo.jpg")
            arc_path = f"{room_name}/{original_name}"

            # Read file from disk
            file_path = os.path.join(PHOTO_DIR, claim_id, photo.get("filename", ""))
            if not os.path.exists(file_path):
                # Skip missing files gracefully
                print(f"[export-zip] WARNING: file not found, skipping: {file_path}")
                continue

            try:
                with open(file_path, "rb") as f:
                    zf.writestr(arc_path, f.read())
                files_added += 1
            except Exception as e:
                print(f"[export-zip] WARNING: failed to read {file_path}: {e}")
                continue

            # Collect metadata for manifest
            entry = {
                "id": photo.get("id"),
                "room": room_name,
                "category": photo.get("category"),
                "ai_caption": photo.get("ai_caption"),
                "ai_damage_assessment": photo.get("ai_damage_assessment"),
                "captured_at": photo.get("captured_at"),
                "tags": photo.get("tags", [])
            }

            if include_annotations:
                entry["annotations"] = photo.get("annotations", [])

            manifest_photos.append(entry)

        # Write manifest.json at the root of the ZIP
        manifest = {
            "claim_id": claim_id,
            "photo_count": files_added,
            "rooms": sorted(rooms_seen),
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "photos": manifest_photos
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))

    if files_added == 0:
        raise HTTPException(status_code=404, detail="No photo files found on disk for this claim")

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="claim_{claim_id}_photos.zip"'
        }
    )


# ========== PDF PHOTO REPORT ==========

def _build_pdf_styles():
    """Build custom paragraph styles for the photo report PDF."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Heading2"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#4a4a6a"),
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "CoverMeta",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#333333"),
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        "RoomHeader",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.white,
        backColor=colors.HexColor("#1a1a2e"),
        borderPadding=(8, 12, 8, 12),
        spaceBefore=16,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "PhotoCaption",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#222222"),
    ))
    styles.add(ParagraphStyle(
        "DamageBadge",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#b91c1c"),
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "GpsText",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#6b7280"),
    ))
    styles.add(ParagraphStyle(
        "VoiceNote",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#4338ca"),
        fontName="Helvetica-Oblique",
    ))
    styles.add(ParagraphStyle(
        "SummaryHeading",
        parent=styles["Heading2"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#1a1a2e"),
        spaceBefore=12,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "TOCEntry",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#1a1a2e"),
    ))
    styles.add(ParagraphStyle(
        "FooterText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#9ca3af"),
        alignment=1,  # center
    ))

    return styles


def _severity_color(severity: str) -> colors.Color:
    """Return a colour matching a severity label."""
    mapping = {
        "critical": colors.HexColor("#991b1b"),
        "high": colors.HexColor("#dc2626"),
        "severe": colors.HexColor("#dc2626"),
        "medium": colors.HexColor("#d97706"),
        "moderate": colors.HexColor("#d97706"),
        "low": colors.HexColor("#16a34a"),
        "minor": colors.HexColor("#16a34a"),
        "none": colors.HexColor("#6b7280"),
    }
    return mapping.get((severity or "").lower(), colors.HexColor("#6b7280"))


@router.get("/claim/{claim_id}/photo-report-pdf")
async def generate_photo_report_pdf(
    claim_id: str,
    token: str = Query(..., description="Auth token for img src / direct download access"),
    include_ai: bool = Query(True, description="Include AI captions and damage assessments"),
    include_gps: bool = Query(True, description="Include GPS coordinates"),
    rooms: Optional[str] = Query(None, description="Comma-separated room filter"),
):
    """
    Generate a professional PDF photo report for a claim.

    The PDF contains a cover page, table of contents, per-room photo pages
    with captions / AI assessments / GPS / voice notes, before-after pairs
    shown side-by-side, and a summary page with an AI damage table and
    overall statistics.

    Auth is via the ``token`` query-param (same pattern as the photo-image
    endpoint) so that the URL can be used directly in ``<a href>`` links.
    """

    # -- auth ----------------------------------------------------------------
    user = await get_user_from_token_param(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized - valid token required")

    # -- data ----------------------------------------------------------------
    photo_query: dict = {"claim_id": claim_id}
    room_filter_list: list | None = None
    if rooms:
        room_filter_list = [r.strip() for r in rooms.split(",") if r.strip()]
        if room_filter_list:
            photo_query["room"] = {"$in": room_filter_list}

    all_photos = await db.inspection_photos.find(
        photo_query, {"_id": 0}
    ).sort("captured_at", 1).to_list(None)

    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if not all_photos:
        raise HTTPException(status_code=404, detail="No photos found for this claim")

    # -- organise photos by room ---------------------------------------------
    by_room: dict[str, list] = {}
    paired_ids: set[str] = set()
    for photo in all_photos:
        room_name = photo.get("room") or "Uncategorized"
        by_room.setdefault(room_name, []).append(photo)
        if photo.get("is_before") and photo.get("paired_photo_id"):
            paired_ids.add(photo["id"])
            paired_ids.add(photo["paired_photo_id"])

    # -- build PDF -----------------------------------------------------------
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = _build_pdf_styles()
    story: list = []

    page_width = letter[0] - 1.5 * inch  # usable width

    # ---- cover page --------------------------------------------------------
    story.append(Spacer(1, 1.2 * inch))

    # Company branding bar
    cover_bar_data = [[""]]
    cover_bar = Table(cover_bar_data, colWidths=[page_width], rowHeights=[4])
    cover_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
    ]))
    story.append(cover_bar)
    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph("EDEN CLAIMS", styles["CoverTitle"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("Property Inspection Photo Report", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.5 * inch))

    # Claim metadata table on cover
    claim_number = claim.get("claim_number") or claim.get("id", "N/A")
    insured_name = claim.get("client_name") or claim.get("insured_name") or "N/A"
    property_address = claim.get("property_address") or claim.get("loss_location") or "N/A"
    inspector_name = user.get("name") or user.get("email") or "N/A"
    report_date = datetime.now().strftime("%B %d, %Y")

    meta_data = [
        ["Claim #:", str(claim_number)],
        ["Insured Name:", str(insured_name)],
        ["Property Address:", str(property_address)],
        ["Report Date:", report_date],
        ["Inspector:", str(inspector_name)],
        ["Total Photos:", str(len(all_photos))],
    ]
    meta_table = Table(meta_data, colWidths=[1.6 * inch, 4.4 * inch])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#333333")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ---- table of contents -------------------------------------------------
    story.append(Paragraph("Table of Contents", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.25 * inch))

    toc_rows = [["Room", "Photos"]]
    for room_name in sorted(by_room.keys()):
        toc_rows.append([room_name, str(len(by_room[room_name]))])

    toc_table = Table(toc_rows, colWidths=[4.5 * inch, 1.5 * inch])
    toc_table.setStyle(TableStyle([
        # header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        # body
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ---- per-room photo pages ----------------------------------------------
    max_img_width = 6 * inch
    max_img_height = 4 * inch
    pair_img_width = 2.9 * inch
    pair_img_height = 2.2 * inch

    for room_name in sorted(by_room.keys()):
        room_photos = by_room[room_name]

        # Room header bar
        room_header_data = [[f"  {room_name}   ({len(room_photos)} photo{'s' if len(room_photos) != 1 else ''})"]]
        room_header_table = Table(room_header_data, colWidths=[page_width], rowHeights=[32])
        room_header_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 13),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(room_header_table)
        story.append(Spacer(1, 0.15 * inch))

        # Track which photos we have already rendered (for pairs)
        rendered_ids: set = set()

        for photo in room_photos:
            pid = photo.get("id", "")
            if pid in rendered_ids:
                continue

            # Check if this photo is part of a before/after pair
            is_pair = False
            paired_photo = None
            if photo.get("is_before") and photo.get("paired_photo_id"):
                paired_photo = next(
                    (p for p in all_photos if p.get("id") == photo["paired_photo_id"]),
                    None,
                )
                if paired_photo:
                    is_pair = True

            if is_pair and paired_photo:
                # ---- side-by-side before / after ---------------------------
                rendered_ids.add(pid)
                rendered_ids.add(paired_photo.get("id", ""))

                before_path = os.path.join(PHOTO_DIR, claim_id, photo.get("filename", ""))
                after_path = os.path.join(PHOTO_DIR, claim_id, paired_photo.get("filename", ""))

                pair_cells = []
                for label, p_path, p_data in [("BEFORE", before_path, photo), ("AFTER", after_path, paired_photo)]:
                    cell_items = []
                    # label
                    lbl_color = "#d97706" if label == "BEFORE" else "#16a34a"
                    cell_items.append(Paragraph(
                        f'<font color="{lbl_color}"><b>{label}</b></font>',
                        styles["PhotoCaption"],
                    ))
                    cell_items.append(Spacer(1, 4))
                    if os.path.exists(p_path):
                        try:
                            img = RLImage(p_path, width=pair_img_width, height=pair_img_height, kind="proportional")
                            cell_items.append(img)
                        except Exception:
                            cell_items.append(Paragraph("<i>[image unavailable]</i>", styles["PhotoCaption"]))
                    else:
                        cell_items.append(Paragraph("<i>[file not found]</i>", styles["PhotoCaption"]))
                    cell_items.append(Spacer(1, 4))
                    # timestamp
                    ts = p_data.get("captured_at", "")[:19].replace("T", " ") if p_data.get("captured_at") else ""
                    if ts:
                        cell_items.append(Paragraph(f"Taken: {ts}", styles["GpsText"]))
                    pair_cells.append(cell_items)

                pair_table = Table(
                    [[pair_cells[0], pair_cells[1]]],
                    colWidths=[page_width / 2, page_width / 2],
                )
                pair_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ]))
                story.append(pair_table)
                story.append(Spacer(1, 0.2 * inch))

            else:
                # ---- standalone photo --------------------------------------
                rendered_ids.add(pid)

                file_path = os.path.join(PHOTO_DIR, claim_id, photo.get("filename", ""))
                if os.path.exists(file_path):
                    try:
                        img = RLImage(file_path, width=max_img_width, height=max_img_height, kind="proportional")
                        story.append(img)
                    except Exception:
                        story.append(Paragraph("<i>[image could not be rendered]</i>", styles["PhotoCaption"]))
                else:
                    story.append(Paragraph("<i>[photo file not found on disk]</i>", styles["PhotoCaption"]))

                story.append(Spacer(1, 4))

                # Caption bar
                caption_rows: list[list] = []

                # AI caption
                if include_ai and photo.get("ai_caption"):
                    caption_rows.append([
                        Paragraph("<b>AI Caption:</b>", styles["PhotoCaption"]),
                        Paragraph(str(photo["ai_caption"])[:300], styles["PhotoCaption"]),
                    ])

                # AI damage assessment
                if include_ai and photo.get("ai_damage_assessment"):
                    assessment = photo["ai_damage_assessment"]
                    if isinstance(assessment, dict):
                        severity = assessment.get("severity", "N/A")
                        damage_type = assessment.get("damage_type") or assessment.get("type", "N/A")
                        sev_color = _severity_color(severity)
                        badge_text = (
                            f'<font color="{sev_color.hexval()}">[{severity.upper()}]</font> {damage_type}'
                        )
                        caption_rows.append([
                            Paragraph("<b>Damage:</b>", styles["PhotoCaption"]),
                            Paragraph(badge_text, styles["DamageBadge"]),
                        ])
                    elif isinstance(assessment, str):
                        caption_rows.append([
                            Paragraph("<b>Damage:</b>", styles["PhotoCaption"]),
                            Paragraph(str(assessment)[:300], styles["DamageBadge"]),
                        ])

                # GPS coordinates
                if include_gps and photo.get("latitude") and photo.get("longitude"):
                    caption_rows.append([
                        Paragraph("<b>GPS:</b>", styles["GpsText"]),
                        Paragraph(
                            f'{photo["latitude"]:.6f}, {photo["longitude"]:.6f}',
                            styles["GpsText"],
                        ),
                    ])

                # Timestamp
                ts = photo.get("captured_at", "")[:19].replace("T", " ") if photo.get("captured_at") else ""
                if ts:
                    caption_rows.append([
                        Paragraph("<b>Taken:</b>", styles["PhotoCaption"]),
                        Paragraph(ts, styles["PhotoCaption"]),
                    ])

                # Voice notes snippet
                if photo.get("voice_snippet"):
                    snippet = str(photo["voice_snippet"])[:200]
                    if len(str(photo["voice_snippet"])) > 200:
                        snippet += "..."
                    caption_rows.append([
                        Paragraph("<b>Voice:</b>", styles["VoiceNote"]),
                        Paragraph(f'"{snippet}"', styles["VoiceNote"]),
                    ])

                if caption_rows:
                    cap_table = Table(caption_rows, colWidths=[1.0 * inch, page_width - 1.0 * inch])
                    cap_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]))
                    story.append(cap_table)

                story.append(Spacer(1, 0.25 * inch))

        # Page break after each room section
        story.append(PageBreak())

    # ---- summary page (last page) ------------------------------------------
    story.append(Paragraph("Summary", styles["SummaryHeading"]))
    story.append(Spacer(1, 0.15 * inch))

    # Collect AI damage assessments across all photos for the summary table
    damage_rows = [["Room", "Damage Type", "Severity", "Description", "Urgency"]]
    severity_values: list[float] = []
    severity_map = {"critical": 5, "high": 4, "severe": 4, "medium": 3, "moderate": 3, "low": 2, "minor": 1, "none": 0}

    for photo in all_photos:
        assessment = photo.get("ai_damage_assessment")
        if not assessment or not isinstance(assessment, dict):
            continue
        r_name = photo.get("room") or "Uncategorized"
        severity = assessment.get("severity", "N/A")
        damage_type = assessment.get("damage_type") or assessment.get("type", "N/A")
        description = assessment.get("description", "")[:80]
        urgency = assessment.get("urgency", "N/A")
        damage_rows.append([r_name, str(damage_type), str(severity), str(description), str(urgency)])
        sev_num = severity_map.get((severity or "").lower())
        if sev_num is not None:
            severity_values.append(sev_num)

    if len(damage_rows) > 1:
        story.append(Paragraph("AI Damage Summary", styles["CoverSubtitle"]))
        story.append(Spacer(1, 0.1 * inch))

        dmg_table = Table(
            damage_rows,
            colWidths=[1.2 * inch, 1.2 * inch, 0.9 * inch, 2.2 * inch, 0.9 * inch],
            repeatRows=1,
        )
        dmg_table.setStyle(TableStyle([
            # header
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            # body
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(dmg_table)
        story.append(Spacer(1, 0.3 * inch))

    # Overall statistics
    story.append(Paragraph("Overall Statistics", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.1 * inch))

    avg_severity = round(sum(severity_values) / len(severity_values), 2) if severity_values else "N/A"
    avg_label = ""
    if isinstance(avg_severity, (int, float)):
        if avg_severity >= 4:
            avg_label = " (High / Severe)"
        elif avg_severity >= 3:
            avg_label = " (Moderate)"
        elif avg_severity >= 2:
            avg_label = " (Low)"
        else:
            avg_label = " (Minor)"

    stats_data = [
        ["Total Photos", str(len(all_photos))],
        ["Rooms Documented", str(len(by_room))],
        ["Average Severity Score", f"{avg_severity}{avg_label}"],
        ["Report Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")],
    ]
    stats_table = Table(stats_data, colWidths=[2.5 * inch, 3.5 * inch])
    stats_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 0.5 * inch))

    # Footer note
    story.append(Paragraph(
        f"Generated by Eden Claims on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} "
        f"| Claim {claim_number} | {len(all_photos)} photos",
        styles["FooterText"],
    ))

    # ---- render PDF to buffer ----------------------------------------------
    doc.build(story)
    pdf_buffer.seek(0)

    safe_claim = re.sub(r"[^a-zA-Z0-9_-]", "_", str(claim_number))
    filename = f"photo_report_{safe_claim}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
