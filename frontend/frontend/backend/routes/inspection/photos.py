"""
Inspection Photos - Upload, retrieval, delete, metadata, watermark, gallery, bulk ops
"""
import os
import io
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPAuthorizationCredentials

from dependencies import db, get_current_active_user, get_user_from_token_param
from auth import decode_access_token
from .models import PhotoMetadata, PhotoAnnotation, BulkPhotoAction
from .helpers import (
    logger, security, PHOTO_DIR, MAX_PHOTO_SIZE, MAX_BULK_PHOTO_IDS,
    HAS_PILLOW, _check_photo_access,
    ROOM_PRESETS, CATEGORY_PRESETS,
)

# Conditional Pillow imports
if HAS_PILLOW:
    from PIL import Image as PILImage, ImageDraw, ImageFont
    from PIL.ExifTags import TAGS, GPSTAGS

router = APIRouter()


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
            logger.debug("Could not extract EXIF GPS: %s", e)

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
                    user = await db.users.find_one({"id": user_id}, {"_id": 0})
        except Exception:
            pass

    # Fall back to query param token
    if not user and token:
        user = await get_user_from_token_param(token)

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized - valid token required")

    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Claim access check
    await _check_photo_access(photo, user)

    # Build file path
    if photo.get("claim_id"):
        file_path = os.path.join(PHOTO_DIR, photo["claim_id"], photo["filename"])
    else:
        file_path = os.path.join(PHOTO_DIR, photo["filename"])

    # Path traversal protection
    real_photo_dir = os.path.realpath(PHOTO_DIR)
    real_file_path = os.path.realpath(file_path)
    if not real_file_path.startswith(real_photo_dir):
        raise HTTPException(status_code=403, detail="Access denied")

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
                    user = await db.users.find_one({"id": user_id}, {"_id": 0})
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

    # Path traversal protection
    real_photo_dir = os.path.realpath(PHOTO_DIR)
    real_file_path = os.path.realpath(file_path)
    if not real_file_path.startswith(real_photo_dir):
        raise HTTPException(status_code=403, detail="Access denied")

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

    await _check_photo_access(photo, current_user)

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

    await _check_photo_access(photo, current_user)

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


# ========== BULK PHOTO ACTIONS ==========

@router.post("/photos/bulk")
async def bulk_photo_action(
    data: BulkPhotoAction,
    current_user: dict = Depends(get_current_active_user)
):
    """Bulk operations on photos: delete, re-categorize, or move to room."""
    if not data.photo_ids:
        raise HTTPException(status_code=400, detail="No photo IDs provided")
    if len(data.photo_ids) > MAX_BULK_PHOTO_IDS:
        raise HTTPException(status_code=400, detail=f"Cannot process more than {MAX_BULK_PHOTO_IDS} photos at once")

    # Verify access to all photos' claims before proceeding
    for pid in data.photo_ids:
        p = await db.inspection_photos.find_one({"id": pid}, {"claim_id": 1})
        if p:
            await _check_photo_access(p, current_user)

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
