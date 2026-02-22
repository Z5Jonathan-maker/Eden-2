"""
Email Intelligence Routes — Writing DNA & Template Management

Endpoints for scanning emails, viewing DNA profiles, and managing templates.
"""

from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from services.email_intelligence import (
    scan_sent_emails,
    analyze_writing_dna,
    extract_templates,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email-intelligence", tags=["email-intelligence"])


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    description: Optional[str] = None


@router.get("/status")
async def get_scan_status(
    current_user: dict = Depends(get_current_active_user),
):
    """Check if the user has a DNA profile and its status."""
    user_id = current_user.get("id")

    profile = await db.writing_dna_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0, "last_scanned": 1, "scanned_count": 1},
    )

    job = await db.email_scan_jobs.find_one(
        {"user_id": user_id},
        {"_id": 0},
    )

    if job and job.get("status") == "scanning":
        return {"status": "scanning", "started_at": job.get("started_at")}

    if profile:
        return {
            "status": "ready",
            "last_scanned": profile.get("last_scanned"),
            "scanned_count": profile.get("scanned_count", 0),
        }

    return {"status": "not_started"}


@router.post("/scan")
async def start_email_scan(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Kick off email scan + DNA analysis + template extraction.
    Runs synchronously (takes 30-60s depending on email count and LLM speed).
    """
    user_id = current_user.get("id")

    # Check for existing scan in progress
    existing_job = await db.email_scan_jobs.find_one(
        {"user_id": user_id, "status": "scanning"},
    )
    if existing_job:
        return {"status": "already_scanning", "started_at": existing_job.get("started_at")}

    # Create scan job
    now = datetime.now(timezone.utc).isoformat()
    job = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "status": "scanning",
        "emails_scanned": 0,
        "started_at": now,
        "completed_at": None,
        "error": None,
    }
    await db.email_scan_jobs.update_one(
        {"user_id": user_id},
        {"$set": job},
        upsert=True,
    )

    try:
        # Step 1: Scan sent emails
        emails = await scan_sent_emails(user_id, max_emails=50)

        await db.email_scan_jobs.update_one(
            {"user_id": user_id},
            {"$set": {"emails_scanned": len(emails)}},
        )

        if not emails:
            await db.email_scan_jobs.update_one(
                {"user_id": user_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error": "No sent emails found",
                }},
            )
            return {
                "status": "completed",
                "emails_scanned": 0,
                "message": "No sent emails found. Send some emails first!",
            }

        # Step 2: Analyze writing DNA
        profile = await analyze_writing_dna(user_id, emails)

        # Step 3: Extract templates
        templates = await extract_templates(user_id, emails)

        # Mark job complete
        await db.email_scan_jobs.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "emails_scanned": len(emails),
            }},
        )

        return {
            "status": "completed",
            "emails_scanned": len(emails),
            "profile_generated": bool(profile),
            "templates_extracted": len(templates),
            "message": f"Analyzed {len(emails)} emails. Writing DNA profile created with {len(templates)} templates extracted.",
        }

    except ValueError as e:
        # Google auth errors
        await db.email_scan_jobs.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": "error",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            }},
        )
        raise HTTPException(status_code=401, detail=str(e))

    except Exception as e:
        logger.error(f"Email scan failed for {user_id}: {e}")
        await db.email_scan_jobs.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": "error",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e)[:500],
            }},
        )
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)[:200]}")


@router.post("/refresh")
async def refresh_email_scan(
    current_user: dict = Depends(get_current_active_user),
):
    """Re-scan emails and regenerate DNA profile + templates."""
    # Delegate to scan — it handles upsert
    return await start_email_scan(current_user=current_user)


@router.get("/profile")
async def get_writing_profile(
    current_user: dict = Depends(get_current_active_user),
):
    """Get the user's writing DNA profile."""
    user_id = current_user.get("id")

    profile = await db.writing_dna_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0},
    )

    if not profile:
        raise HTTPException(status_code=404, detail="No writing profile found. Run a scan first.")

    return profile


@router.get("/templates")
async def get_templates(
    current_user: dict = Depends(get_current_active_user),
    category: Optional[str] = None,
):
    """Get extracted email templates, optionally filtered by category."""
    user_id = current_user.get("id")

    query = {"user_id": user_id}
    if category:
        query["category"] = category

    templates = await db.email_templates.find(
        query,
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    return {"templates": templates, "count": len(templates)}


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    update: TemplateUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Edit a template."""
    user_id = current_user.get("id")

    # Build update dict from non-None fields
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.email_templates.update_one(
        {"id": template_id, "user_id": user_id},
        {"$set": update_dict},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"message": "Template updated"}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a template."""
    user_id = current_user.get("id")

    result = await db.email_templates.delete_one(
        {"id": template_id, "user_id": user_id},
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"message": "Template deleted"}
