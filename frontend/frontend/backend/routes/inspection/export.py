"""
Inspection Export - ZIP archive and PDF photo report generation
"""
import os
import io
import json
import zipfile
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse

from dependencies import db, get_current_active_user, get_user_from_token_param
from .helpers import logger, PHOTO_DIR

router = APIRouter()


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
                logger.warning("export-zip: file not found, skipping: %s", file_path)
                continue

            try:
                with open(file_path, "rb") as f:
                    zf.writestr(arc_path, f.read())
                files_added += 1
            except Exception as e:
                logger.warning("export-zip: failed to read %s: %s", file_path, e)
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
    include_gps: bool = Query(True, description="Include GPS coordinates and timestamps"),
    rooms: Optional[str] = Query(None, description="Comma-separated room filter"),
):
    """
    Generate a professional PDF photo report for a claim.

    Supports two modes:
      - email_safe: compressed images, target <=15 MB, auto-splits to ZIP if needed
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
        raise HTTPException(status_code=404, detail="Resource not found")

    return StreamingResponse(
        buf,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
