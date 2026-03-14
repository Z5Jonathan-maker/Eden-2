"""Photo analysis endpoints — Gemini Vision for property damage inspection photos."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException

from dependencies import db, get_current_active_user
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/photos", tags=["photo-analysis"])

ALLOWED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_BATCH_SIZE = 10

SINGLE_ANALYSIS_PROMPT = """Analyze this property damage photo for an insurance claim. Provide:
1. Damage type (water, wind, hail, fire, mold, structural, cosmetic)
2. Severity (1-10, where 10 is catastrophic)
3. Affected area description
4. Estimated repair scope
5. Additional photos recommended (yes/no + what)
6. Quality assessment of this photo (good/fair/poor + why)

Be specific and professional. This is for a Florida public adjuster."""

BATCH_ANALYSIS_PROMPT = (
    "Analyze this property damage photo. Identify: damage type, severity (1-10), "
    "affected area, repair scope. Be concise."
)


@router.post("/analyze")
async def analyze_photo(
    file: UploadFile = File(...),
    claim_id: str = None,
    current_user: dict = Depends(get_current_active_user),
):
    """Analyze a property damage photo using Gemini Vision."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported: {file.content_type}. Use JPEG, PNG, or WebP.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 15MB)")

    llm = LLMRouter()

    try:
        analysis = await llm.generate_vision(
            prompt=SINGLE_ANALYSIS_PROMPT,
            image_bytes=image_bytes,
            mime_type=file.content_type,
        )

        await db.photo_analyses.insert_one({
            "claim_id": claim_id,
            "user_id": current_user.get("id"),
            "filename": file.filename,
            "analysis": analysis,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "analysis": analysis,
            "filename": file.filename,
            "claim_id": claim_id,
        }
    except Exception as e:
        logger.error("Photo analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/analyze-batch")
async def analyze_photos_batch(
    files: list[UploadFile] = File(...),
    claim_id: str = None,
    current_user: dict = Depends(get_current_active_user),
):
    """Analyze multiple photos in batch (max 10)."""
    results = []
    for file in files[:MAX_BATCH_SIZE]:
        try:
            image_bytes = await file.read()
            llm = LLMRouter()
            analysis = await llm.generate_vision(
                prompt=BATCH_ANALYSIS_PROMPT,
                image_bytes=image_bytes,
                mime_type=file.content_type or "image/jpeg",
            )
            results.append({
                "filename": file.filename,
                "analysis": analysis,
                "status": "success",
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "analysis": None,
                "status": "error",
                "error": str(e),
            })

    return {"results": results, "total": len(results), "claim_id": claim_id}
