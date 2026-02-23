"""
Inspection Photos API - Enhanced photo documentation for claims
Competitive with CompanyCam features
"""
import os
import uuid
import json
import re
import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, StreamingResponse, Response
import zipfile
import io
# reportlab imports moved to services/inspection_pdf_service.py
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
    CreateInspectionSession, InspectionSession, InspectionReport,
    BulkPhotoAction
)

router = APIRouter(prefix="/api/inspections", tags=["inspections"])
security = HTTPBearer(auto_error=False)  # Don't auto-fail, we'll handle it

# Configuration - repo-relative photo directory
BACKEND_DIR = Path(__file__).parent.parent.parent
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
    sha256_hash: Optional[str] = Form(None),
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

    # Compute SHA-256 hash for dedup
    content_hash = hashlib.sha256(content).hexdigest()

    # Dedup check: same hash + same claim = duplicate
    existing = await db.inspection_photos.find_one(
        {"claim_id": claim_id, "sha256_hash": content_hash}
    )
    if existing:
        existing.pop("_id", None)
        base_url = os.environ.get("BASE_URL", "")
        return {
            "id": existing["id"],
            "url": f"/api/inspections/photos/{existing['id']}/image",
            "image_url": f"{base_url}/api/inspections/photos/{existing['id']}/image",
            "thumbnail_url": f"/api/inspections/photos/{existing['id']}/thumbnail",
            "metadata": {
                "claim_id": claim_id,
                "room": existing.get("room"),
                "category": existing.get("category"),
                "captured_at": existing.get("captured_at"),
            },
            "duplicate": True
        }

    # Generate hash-based photo ID (stable, deterministic)
    photo_id = content_hash[:12]
    # Handle rare hash prefix collision
    if await db.inspection_photos.find_one({"id": photo_id}):
        photo_id = content_hash[:16]
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
        mime_type=file.content_type or "image/jpeg",
        sha256_hash=content_hash
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
        },
        "duplicate": False
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


# ========== BULK PHOTO ACTIONS ==========

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
        return {"message": f"{affected} photos deleted", "affected": affected, "action": "delete"}

    elif data.action == "recategorize":
        if not data.category:
            raise HTTPException(status_code=400, detail="category required for recategorize")
        result = await db.inspection_photos.update_many(
            {"id": {"$in": data.photo_ids}},
            {"$set": {"category": data.category}},
        )
        return {"message": f"{result.modified_count} photos re-categorized", "affected": result.modified_count, "action": "recategorize"}

    elif data.action == "move_room":
        if not data.room:
            raise HTTPException(status_code=400, detail="room required for move_room")
        result = await db.inspection_photos.update_many(
            {"id": {"$in": data.photo_ids}},
            {"$set": {"room": data.room}},
        )
        return {"message": f"{result.modified_count} photos moved", "affected": result.modified_count, "action": "move_room"}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {data.action}")


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
# PDF generation logic extracted to services/inspection_pdf_service.py
# This endpoint is a thin wrapper that delegates to the service.

from services.inspection_pdf_service import generate_photo_report


@router.get("/claim/{claim_id}/photo-report-pdf")
@router.get("/claim/{claim_id}/export-pdf")
async def export_photo_report_pdf(
    claim_id: str,
    token: str = Query(..., description="Auth token for img src / direct download access"),
    mode: str = Query("email_safe", description="email_safe or full_fidelity"),
    include_ai: bool = Query(True, description="Include AI captions and damage assessments"),
    include_gps: bool = Query(False, description="Include GPS coordinates (off by default for carrier reports)"),
    rooms: Optional[str] = Query(None, description="Comma-separated room filter"),
):
    """
    Generate a professional PDF photo report for a claim.

    Supports two modes:
      - email_safe: compressed images, target ≤15 MB, auto-splits to ZIP if needed
      - full_fidelity: archive quality, original resolution

    Auth is via the ``token`` query-param so the URL works in ``<a href>`` links.
    """
    user = await get_user_from_token_param(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized - valid token required")

    try:
        buf, content_type, filename = await generate_photo_report(
            claim_id=claim_id,
            mode=mode,
            user=user,
            db=db,
            photo_dir=PHOTO_DIR,
            include_ai=include_ai,
            include_gps=include_gps,
            rooms=rooms,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        buf,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


# ========== ADMIN: DELETE / CLEANUP ==========

@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a specific inspection report."""
    report = await db.inspection_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.inspection_reports.delete_one({"id": report_id})
    return {"message": "Report deleted", "id": report_id}


@router.delete("/sessions/{session_id}/reports")
async def delete_session_reports(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete ALL reports for a session (clear report history)."""
    result = await db.inspection_reports.delete_many({"session_id": session_id})
    return {
        "message": "Session reports deleted",
        "session_id": session_id,
        "deleted_count": result.deleted_count
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    delete_photos: bool = Query(False, description="Also delete all photos from this session"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Delete an inspection session.
    Optionally delete all associated photos and reports.
    """
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    deleted_photos = 0
    deleted_reports = 0

    # Delete associated reports
    report_result = await db.inspection_reports.delete_many({"session_id": session_id})
    deleted_reports = report_result.deleted_count

    # Optionally delete photos
    if delete_photos:
        photos = await db.inspection_photos.find(
            {"session_id": session_id}, {"_id": 0, "id": 1, "filename": 1, "claim_id": 1}
        ).to_list(None)

        for photo in photos:
            # Delete file from disk
            claim_id = photo.get("claim_id", "")
            filename = photo.get("filename", "")
            if claim_id and filename:
                file_path = os.path.join(PHOTO_DIR, claim_id, filename)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass

        photo_result = await db.inspection_photos.delete_many({"session_id": session_id})
        deleted_photos = photo_result.deleted_count

    # Delete the session itself
    await db.inspection_sessions.delete_one({"id": session_id})

    return {
        "message": "Session deleted",
        "session_id": session_id,
        "deleted_photos": deleted_photos,
        "deleted_reports": deleted_reports,
    }


@router.delete("/claim/{claim_id}/all")
async def delete_claim_inspections(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Admin: Delete ALL inspection data for a claim — sessions, photos, reports, files.
    This is a full cleanup operation.
    """
    # Delete all photo files from disk
    photos = await db.inspection_photos.find(
        {"claim_id": claim_id}, {"_id": 0, "id": 1, "filename": 1}
    ).to_list(None)

    for photo in photos:
        filename = photo.get("filename", "")
        if filename:
            file_path = os.path.join(PHOTO_DIR, claim_id, filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass

    # Try to remove the claim photo directory
    claim_dir = os.path.join(PHOTO_DIR, claim_id)
    if os.path.exists(claim_dir):
        try:
            os.rmdir(claim_dir)  # Only removes if empty
        except OSError:
            pass

    # Delete all DB records
    photos_result = await db.inspection_photos.delete_many({"claim_id": claim_id})
    sessions_result = await db.inspection_sessions.delete_many({"claim_id": claim_id})
    reports_result = await db.inspection_reports.delete_many({"claim_id": claim_id})

    return {
        "message": f"All inspection data deleted for claim {claim_id}",
        "claim_id": claim_id,
        "deleted_photos": photos_result.deleted_count,
        "deleted_sessions": sessions_result.deleted_count,
        "deleted_reports": reports_result.deleted_count,
    }
