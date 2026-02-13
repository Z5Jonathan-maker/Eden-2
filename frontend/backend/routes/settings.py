"""
Company Settings API - Manages firm-specific configuration
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from dependencies import db, get_current_active_user, require_role

router = APIRouter(prefix="/api/settings", tags=["settings"])


class CompanySettings(BaseModel):
    company_name: Optional[str] = Field(None, description="Company/firm name")
    university_name: Optional[str] = Field(None, description="Custom university display name")
    logo_url: Optional[str] = Field(None, description="Company logo URL")
    primary_color: Optional[str] = Field(None, description="Brand primary color")
    tagline: Optional[str] = Field(None, description="Company tagline")


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    university_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    tagline: Optional[str] = None


@router.get("/company")
async def get_company_settings(current_user: dict = Depends(get_current_active_user)):
    """Get company settings for the current user's organization"""
    
    # Get settings from database (or use defaults)
    settings = await db.company_settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Return defaults
        return {
            "company_name": "Your Firm",
            "university_name": "Your Firm University",
            "logo_url": None,
            "primary_color": "#ea580c",  # Orange
            "tagline": "Excellence in Claims"
        }
    
    # If university_name not set, derive from company_name
    if not settings.get("university_name") and settings.get("company_name"):
        settings["university_name"] = settings["company_name"] + " University"
    
    return settings


@router.put("/company")
async def update_company_settings(
    updates: CompanySettingsUpdate,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """Update company settings (admin/manager only)"""
    
    # Get existing settings
    existing = await db.company_settings.find_one({})
    
    # Build update dict (only non-None values)
    update_data = {}
    if updates.company_name is not None:
        update_data["company_name"] = updates.company_name
    if updates.university_name is not None:
        update_data["university_name"] = updates.university_name
    if updates.logo_url is not None:
        update_data["logo_url"] = updates.logo_url
    if updates.primary_color is not None:
        update_data["primary_color"] = updates.primary_color
    if updates.tagline is not None:
        update_data["tagline"] = updates.tagline
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    if existing:
        # Update existing
        await db.company_settings.update_one({}, {"$set": update_data})
    else:
        # Create new
        update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.company_settings.insert_one(update_data)
    
    # Return updated settings
    settings = await db.company_settings.find_one({}, {"_id": 0})
    return settings


@router.post("/company/initialize")
async def initialize_company_settings(
    settings: CompanySettings,
    current_user: dict = Depends(require_role(["admin"]))
):
    """Initialize company settings (admin only, first-time setup)"""
    
    existing = await db.company_settings.find_one({})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Company settings already exist. Use PUT to update."
        )
    
    settings_dict = settings.model_dump()
    settings_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    settings_dict["created_by"] = current_user.get("email", "unknown")
    
    # Default university name from company name
    if settings_dict.get("company_name") and not settings_dict.get("university_name"):
        settings_dict["university_name"] = settings_dict["company_name"] + " University"
    
    await db.company_settings.insert_one(settings_dict)
    
    # Return without _id
    result = await db.company_settings.find_one({}, {"_id": 0})
    return result
