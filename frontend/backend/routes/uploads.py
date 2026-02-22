"""
File Upload API for Doctrine Content
Handles PDFs, images, and video uploads for custom training materials
"""
import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# Configuration - repo-relative upload directory
BACKEND_DIR = Path(__file__).parent.parent
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(BACKEND_DIR / "uploads"))
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    "document": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".epub"],
    "video": [".mp4", ".webm", ".mov", ".avi"],
    "audio": [".mp3", ".wav", ".ogg", ".m4a"]
}

# Ensure upload directory exists - create safely at startup
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception as e:
    raise RuntimeError(f"Failed to create upload directory '{UPLOAD_DIR}': {e}")


class FileMetadata(BaseModel):
    id: str
    filename: str
    original_name: str
    file_type: str  # image, document, video, audio
    mime_type: str
    size: int
    uploaded_by: str
    uploaded_at: str
    content_id: Optional[str] = None  # Associated document/article/course ID
    content_type: Optional[str] = None  # document, article, course


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
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".txt": "text/plain",
        ".md": "text/markdown",
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
    """Upload a file for Doctrine content"""
    
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
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create metadata
    metadata = {
        "id": file_id,
        "filename": safe_filename,
        "original_name": file.filename,
        "file_type": file_type,
        "mime_type": get_mime_type(ext),
        "size": len(content),
        "uploaded_by": current_user.get("email", "unknown"),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "content_id": content_id,
        "content_type": content_type
    }
    
    # Store in database
    await db.uploaded_files.insert_one(metadata)
    
    # Return without _id
    return {
        "id": file_id,
        "filename": safe_filename,
        "original_name": file.filename,
        "file_type": file_type,
        "size": len(content),
        "url": f"/api/uploads/file/{file_id}"
    }


@router.get("/file/{file_id}")
async def get_file(file_id: str, current_user: dict = Depends(get_current_active_user)):
    """Download/view a file"""
    
    # Find file metadata
    file_meta = await db.uploaded_files.find_one({"id": file_id})
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = os.path.join(UPLOAD_DIR, file_meta["filename"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        file_path, 
        filename=file_meta["original_name"],
        media_type=file_meta.get("mime_type", "application/octet-stream")
    )


@router.delete("/file/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_active_user)):
    """Delete a file"""
    
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can delete files")
    
    # Find file metadata
    file_meta = await db.uploaded_files.find_one({"id": file_id})
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete from disk
    file_path = os.path.join(UPLOAD_DIR, file_meta["filename"])
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
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
