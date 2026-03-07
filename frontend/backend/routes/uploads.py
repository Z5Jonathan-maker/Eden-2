"""
File Upload API for Doctrine Content
Handles PDFs, images, and video uploads for custom training materials

Storage: MongoDB GridFS (persistent across Render deploys)
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from dependencies import db, get_current_active_user
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
import io

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# GridFS bucket for file storage
fs = AsyncIOMotorGridFSBucket(db)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".epub"],
    "video": [".mp4", ".webm", ".mov", ".avi"],
    "audio": [".mp3", ".wav", ".ogg", ".m4a"]
}


def get_file_type(extension: str) -> Optional[str]:
    """Determine file type category from extension"""
    ext_lower = extension.lower()
    for file_type, extensions in ALLOWED_EXTENSIONS.items():
        if ext_lower in extensions:
            return file_type
    return None


def get_mime_type(extension: str) -> str:
    """Get MIME type from extension"""
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".epub": "application/epub+zip",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4"
    }
    return mime_map.get(extension.lower(), "application/octet-stream")


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    content_id: Optional[str] = Form(None),
    content_type: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a file — stored in MongoDB GridFS for persistence"""

    # Check user permissions
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can upload files")

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Get file extension
    _, ext = os.path.splitext(file.filename)
    if not ext:
        raise HTTPException(status_code=400, detail="File must have an extension")

    # Check file type
    file_type = get_file_type(ext)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join([e for exts in ALLOWED_EXTENSIONS.values() for e in exts])}"
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    # Generate unique ID
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{ext}"
    mime_type = get_mime_type(ext)

    # Store file in GridFS
    grid_id = await fs.upload_from_stream(
        safe_filename,
        io.BytesIO(content),
        metadata={
            "file_id": file_id,
            "original_name": file.filename,
            "mime_type": mime_type,
            "file_type": file_type,
        }
    )

    # Create metadata record
    metadata = {
        "id": file_id,
        "filename": safe_filename,
        "original_name": file.filename,
        "file_type": file_type,
        "mime_type": mime_type,
        "size": len(content),
        "uploaded_by": current_user.get("email", "unknown"),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "content_id": content_id,
        "content_type": content_type,
        "grid_id": str(grid_id),
        "storage": "gridfs",
    }

    # Store metadata in database
    await db.uploaded_files.insert_one(metadata)

    # Fire-and-forget: mirror to Google Drive (non-blocking)
    if content_id:
        import asyncio
        asyncio.ensure_future(_mirror_to_drive(
            user_id=current_user.get("id", ""),
            claim_id=content_id,
            file_name=file.filename,
            file_bytes=content,
            mime_type=mime_type,
            category=content_type or "general",
        ))

    return {
        "id": file_id,
        "filename": safe_filename,
        "original_name": file.filename,
        "file_type": file_type,
        "size": len(content),
        "url": f"/api/uploads/file/{file_id}"
    }


async def _mirror_to_drive(
    user_id: str,
    claim_id: str,
    file_name: str,
    file_bytes: bytes,
    mime_type: str,
    category: str,
):
    """Non-blocking Drive mirror. Errors are logged, never raised."""
    try:
        from services.drive_mirror import get_drive_mirror
        mirror = get_drive_mirror()
        await mirror.mirror_claim_file(
            user_id=user_id,
            claim_id=claim_id,
            file_name=file_name,
            file_bytes=file_bytes,
            mime_type=mime_type,
            category=category,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).debug(f"Drive mirror skipped: {e}")


@router.get("/file/{file_id}")
async def get_file(file_id: str, current_user: dict = Depends(get_current_active_user)):
    """Download/view a file from GridFS"""

    # Find file metadata
    file_meta = await db.uploaded_files.find_one({"id": file_id})
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    # Access control: admin/manager can access all; others only their own uploads
    role = current_user.get("role", "client")
    if role not in ("admin", "manager"):
        # uploaded_by stores email, so compare against email (not id)
        if file_meta.get("uploaded_by") != current_user.get("email"):
            raise HTTPException(status_code=403, detail="Access denied")

    mime_type = file_meta.get("mime_type", "application/octet-stream")
    original_name = file_meta.get("original_name", file_meta.get("filename", "file"))

    # Try GridFS first (new storage)
    try:
        grid_stream = await fs.open_download_stream_by_name(file_meta["filename"])
        file_bytes = await grid_stream.read()
        # Sanitize filename for Content-Disposition header
        safe_name = original_name.replace('"', '_').replace('\n', '_').replace('\r', '_')
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=mime_type,
            headers={"Content-Disposition": f'inline; filename="{safe_name}"'}
        )
    except Exception as e:
        logger.warning(f"GridFS retrieval failed for {file_id}, falling back to filesystem: {e}")

    # Fallback: try legacy filesystem storage
    from pathlib import Path
    BACKEND_DIR = Path(__file__).parent.parent
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(BACKEND_DIR / "uploads"))
    file_path = os.path.join(UPLOAD_DIR, file_meta["filename"])
    if os.path.exists(file_path):
        from fastapi.responses import FileResponse
        return FileResponse(
            file_path,
            filename=original_name,
            media_type=mime_type
        )

    raise HTTPException(status_code=404, detail="File not found in storage")


@router.delete("/file/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_active_user)):
    """Delete a file from GridFS and metadata"""

    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can delete files")

    # Find file metadata
    file_meta = await db.uploaded_files.find_one({"id": file_id})
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete from GridFS
    if file_meta.get("grid_id"):
        try:
            from bson import ObjectId
            await fs.delete(ObjectId(file_meta["grid_id"]))
        except Exception:
            pass

    # Also clean up legacy filesystem if exists
    from pathlib import Path
    BACKEND_DIR = Path(__file__).parent.parent
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(BACKEND_DIR / "uploads"))
    file_path = os.path.join(UPLOAD_DIR, file_meta["filename"])
    if os.path.exists(file_path):
        os.remove(file_path)

    # Delete metadata
    await db.uploaded_files.delete_one({"id": file_id})

    return {"message": "File deleted successfully"}


@router.get("/content/{content_type}/{content_id}")
async def get_content_files(
    content_type: str,
    content_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all files attached to a specific content item"""

    files = await db.uploaded_files.find(
        {"content_id": content_id, "content_type": content_type},
        {"_id": 0}
    ).to_list(100)

    # Add URLs
    for f in files:
        f["url"] = f"/api/uploads/file/{f['id']}"

    return {"files": files}


@router.put("/file/{file_id}/attach")
async def attach_file_to_content(
    file_id: str,
    content_id: str = Form(...),
    content_type: str = Form(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Attach an existing file to content"""

    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can manage files")

    result = await db.uploaded_files.update_one(
        {"id": file_id},
        {"$set": {"content_id": content_id, "content_type": content_type}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File not found")

    return {"message": "File attached successfully"}


@router.get("/my-files")
async def get_my_files(current_user: dict = Depends(get_current_active_user)):
    """Get all files uploaded by current user"""

    files = await db.uploaded_files.find(
        {"uploaded_by": current_user.get("email")},
        {"_id": 0}
    ).sort("uploaded_at", -1).to_list(100)

    for f in files:
        f["url"] = f"/api/uploads/file/{f['id']}"

    return {"files": files}


# ============ DRIVE MIRROR ADMIN ============

@router.get("/drive-mirror/status")
async def drive_mirror_status(current_user: dict = Depends(get_current_active_user)):
    """Get Drive mirror status: enabled, mapping count, dead letters, last run."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    from services.drive_mirror import MIRROR_ENABLED

    mirrored_count = await db.drive_mirror_map.count_documents({})
    dead_letters = await db.drive_mirror_dead_letter.count_documents({"retried": False})
    last_run = await db.drive_mirror_runs.find_one(
        {}, sort=[("completed_at", -1)], projection={"_id": 0}
    )

    return {
        "enabled": MIRROR_ENABLED,
        "mirrored_files": mirrored_count,
        "pending_dead_letters": dead_letters,
        "last_run": last_run,
    }


@router.post("/drive-mirror/reconcile")
async def drive_mirror_reconcile(current_user: dict = Depends(get_current_active_user)):
    """Manually trigger Drive mirror reconciliation (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    from services.drive_mirror import get_drive_mirror, MIRROR_ENABLED
    if not MIRROR_ENABLED:
        raise HTTPException(status_code=400, detail="Drive mirror is not enabled. Set DRIVE_MIRROR_ENABLED=true in .env")

    mirror = get_drive_mirror()
    stats = await mirror.reconcile()
    return {"message": "Reconciliation complete", "stats": stats}
