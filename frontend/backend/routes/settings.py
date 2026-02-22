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


class SmsAuditThresholds(BaseModel):
    min_events: int = Field(10, ge=0, le=10000)
    high_risk_rate_pct: int = Field(20, ge=0, le=100)
    ack_missing_rate_pct: int = Field(15, ge=0, le=100)


class SmsAuditThresholdsUpdate(BaseModel):
    min_events: Optional[int] = Field(None, ge=0, le=10000)
    high_risk_rate_pct: Optional[int] = Field(None, ge=0, le=100)
    ack_missing_rate_pct: Optional[int] = Field(None, ge=0, le=100)


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


@router.get("/ai-comms-risk-thresholds")
async def get_ai_comms_risk_thresholds(
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """Get org-level AI comms risk audit thresholds."""
    record = await db.company_settings.find_one(
        {"key": "ai_comms_risk_thresholds"},
        {"_id": 0, "min_events": 1, "high_risk_rate_pct": 1, "ack_missing_rate_pct": 1, "updated_at": 1, "updated_by": 1},
    )
    if not record:
        return {
            "min_events": 10,
            "high_risk_rate_pct": 20,
            "ack_missing_rate_pct": 15,
            "updated_at": None,
            "updated_by": None,
        }
    return {
        "min_events": int(record.get("min_events", 10)),
        "high_risk_rate_pct": int(record.get("high_risk_rate_pct", 20)),
        "ack_missing_rate_pct": int(record.get("ack_missing_rate_pct", 15)),
        "updated_at": record.get("updated_at"),
        "updated_by": record.get("updated_by"),
    }


@router.put("/ai-comms-risk-thresholds")
async def update_ai_comms_risk_thresholds(
    updates: SmsAuditThresholdsUpdate,
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """Update org-level AI comms risk audit thresholds."""
    existing = await db.company_settings.find_one({"key": "ai_comms_risk_thresholds"}, {"_id": 0})
    baseline = {
        "min_events": int(existing.get("min_events", 10)) if existing else 10,
        "high_risk_rate_pct": int(existing.get("high_risk_rate_pct", 20)) if existing else 20,
        "ack_missing_rate_pct": int(existing.get("ack_missing_rate_pct", 15)) if existing else 15,
    }
    if updates.min_events is not None:
        baseline["min_events"] = int(updates.min_events)
    if updates.high_risk_rate_pct is not None:
        baseline["high_risk_rate_pct"] = int(updates.high_risk_rate_pct)
    if updates.ack_missing_rate_pct is not None:
        baseline["ack_missing_rate_pct"] = int(updates.ack_missing_rate_pct)

    payload = SmsAuditThresholds(**baseline).model_dump()
    payload["key"] = "ai_comms_risk_thresholds"
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    payload["updated_by"] = current_user.get("email", "unknown")
    if not existing:
        payload["created_at"] = datetime.now(timezone.utc).isoformat()
        payload["created_by"] = current_user.get("email", "unknown")

    await db.company_settings.update_one(
        {"key": "ai_comms_risk_thresholds"},
        {"$set": payload},
        upsert=True,
    )

    return {
        "min_events": payload["min_events"],
        "high_risk_rate_pct": payload["high_risk_rate_pct"],
        "ack_missing_rate_pct": payload["ack_missing_rate_pct"],
        "updated_at": payload["updated_at"],
        "updated_by": payload["updated_by"],
    }
