"""
Inspection Annotations & AI Damage Detection

Photo annotations, AI tagging, and AI-powered damage assessment.
"""
import os
import re
import json
import base64
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from dependencies import db, get_current_active_user
from .models import PhotoAnnotation
from .helpers import logger, PHOTO_DIR, _check_photo_access

router = APIRouter()


# ========== ANNOTATIONS ==========

@router.put("/photos/{photo_id}/annotations")
async def save_photo_annotations(
    photo_id: str,
    annotations: List[PhotoAnnotation],
    current_user: dict = Depends(get_current_active_user)
):
    """Save annotations for a photo"""

    photo = await db.inspection_photos.find_one({"id": photo_id}, {"claim_id": 1})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    await _check_photo_access(photo, current_user)

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


# ========== AI SINGLE-PHOTO TAGGING ==========

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
    from security import check_rate_limit
    check_rate_limit(f"ai:{current_user.get('id', 'unknown')}", "ai")

    photo = await db.inspection_photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    await _check_photo_access(photo, current_user)

    # 2. Read the photo file from disk
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
            logger.error("DamageAI OpenAI API error %s: %s", resp.status_code, error_detail)
            raise HTTPException(status_code=502, detail=f"AI vision API error: {resp.status_code}")

        response = resp.json()["choices"][0]["message"]["content"].strip()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("DamageAI LLM call failed for photo %s: %s", photo_id, e)
        raise HTTPException(status_code=502, detail="AI damage assessment failed")

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
