"""
Inspection Module - Shared Helpers & Configuration

Constants, auth helpers, and access checks used across all inspection sub-modules.
"""
import os
import logging
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from dependencies import db, get_current_active_user, get_user_from_token_param
from auth import decode_access_token

logger = logging.getLogger(__name__)

# Pillow for GPS watermark and EXIF extraction
try:
    from PIL import Image as PILImage, ImageDraw, ImageFont
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

security = HTTPBearer(auto_error=False)  # Don't auto-fail, we'll handle it

# Configuration - repo-relative photo directory
BACKEND_DIR = Path(__file__).parent.parent.parent
PHOTO_DIR = os.environ.get("PHOTO_DIR", str(BACKEND_DIR / "uploads" / "inspections"))
try:
    os.makedirs(PHOTO_DIR, exist_ok=True)
except Exception as e:
    raise RuntimeError(f"Failed to create photo directory '{PHOTO_DIR}': {e}")

MAX_PHOTO_SIZE = 20 * 1024 * 1024  # 20MB per photo
MAX_BULK_PHOTO_IDS = 200  # Max photos in a single bulk operation

AUDIO_DIR = os.environ.get("AUDIO_DIR", "/tmp/audio")
os.makedirs(AUDIO_DIR, exist_ok=True)


async def _check_photo_access(photo: dict, user: dict) -> None:
    """
    Verify the user has access to a photo's parent claim.
    Admin/manager can access all; adjusters can access assigned claims.
    Raises HTTPException 403 on denial.
    """
    role = user.get("role", "client")
    if role in ("admin", "manager"):
        return  # full access

    claim_id = photo.get("claim_id")
    if not claim_id:
        return  # orphaned photos are accessible

    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "assigned_to_id": 1, "created_by": 1, "user_id": 1})
    if not claim:
        return  # claim deleted — allow photo cleanup

    user_id = user.get("id")
    if claim.get("assigned_to_id") == user_id or claim.get("created_by") == user_id or claim.get("user_id") == user_id:
        return

    raise HTTPException(status_code=403, detail="You do not have access to this claim's photos")


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
                return await db.users.find_one({"id": user_id}, {"_id": 0})
    except Exception:
        pass
    return None


# Room & category presets
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
