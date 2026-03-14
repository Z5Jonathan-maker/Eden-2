"""
Inspection Sessions - CRUD, voice recording, AI tagging, transcript management
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query

from dependencies import db, get_current_active_user
from .models import CreateInspectionSession, InspectionSession
from .helpers import logger, PHOTO_DIR, AUDIO_DIR

router = APIRouter()


# ========== INSPECTION SESSIONS ==========

@router.post("/sessions")
async def create_inspection_session(
    data: CreateInspectionSession,
    current_user: dict = Depends(get_current_active_user)
):
    """Start a new inspection session for a claim"""

    session = InspectionSession(
        claim_id=data.claim_id,
        name=data.name or f"Inspection {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        notes=data.notes,
        type=data.type,
        created_by=current_user.get("email", "")
    )

    session_dict = session.model_dump()
    await db.inspection_sessions.insert_one(session_dict)

    # Remove _id before returning
    session_dict.pop("_id", None)

    return {"id": session.id, "message": "Inspection session started", "session": session_dict}


@router.get("/sessions")
async def get_inspection_sessions(
    claim_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all inspection sessions, optionally filtered by claim"""

    query = {}
    if claim_id:
        query["claim_id"] = claim_id

    sessions = await db.inspection_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_inspection_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get details of a specific inspection session"""

    session = await db.inspection_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get photos for this session
    photos = await db.inspection_photos.find(
        {"session_id": session_id},
        {"_id": 0, "annotations": 0}
    ).sort("captured_at", 1).to_list(500)

    session["photos"] = photos
    return session


@router.put("/sessions/{session_id}/complete")
async def complete_inspection_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark an inspection session as complete"""

    result = await db.inspection_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Inspection completed"}


# ========== VOICE RECORDING & TRANSCRIPTION ==========

@router.post("/sessions/voice")
async def upload_session_voice(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Upload voice recording for an inspection session and transcribe with Whisper.
    Audio is matched to photos by timestamp after transcription.
    """
    from dotenv import load_dotenv
    load_dotenv()

    # Validate session exists
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    allowed_types = ["audio/webm", "audio/mp3", "audio/mp4", "audio/mpeg", "audio/wav", "audio/m4a"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid audio type. Allowed: {', '.join(allowed_types)}")

    # Save audio file
    voice_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "webm"
    filename = f"{voice_id}.{ext}"
    file_path = os.path.join(AUDIO_DIR, filename)

    content = await file.read()
    file_size = len(content)

    # Check file size (25MB limit for Whisper)
    if file_size > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large. Maximum 25MB.")

    with open(file_path, "wb") as f:
        f.write(content)

    # Update session with voice recording info
    await db.inspection_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "voice_recording_id": voice_id,
            "voice_recording_filename": filename
        }}
    )

    # Transcribe with Whisper
    transcript_text = None
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

        stt = OpenAISpeechToText(api_key=api_key)

        with open(file_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="verbose_json",
                language="en",
                prompt="This is an insurance property inspection. The speaker is describing damage, rooms, and conditions they observe.",
                timestamp_granularities=["segment"]
            )

        transcript_text = response.text

        # Store transcript
        await db.inspection_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "voice_transcript": transcript_text,
                "voice_transcribed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        # Attach voice snippets to photos
        await attach_voice_snippets_to_photos(session_id, response)

    except Exception as e:
        logger.error("Whisper transcription error for session %s: %s", session_id, e)
        # Don't fail the upload if transcription fails
        transcript_text = "Transcription pending"

    return {
        "voice_recording_id": voice_id,
        "filename": filename,
        "file_size": file_size,
        "transcript": transcript_text,
        "message": "Voice recording uploaded and transcription started"
    }


async def attach_voice_snippets_to_photos(session_id: str, whisper_response):
    """
    Match transcript segments to photos based on capture time offset.
    Uses Whisper's segment timestamps to find relevant narration for each photo.
    """
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session or not session.get("started_at"):
        return

    # Get all photos for this session
    photos = await db.inspection_photos.find({"session_id": session_id}).to_list(500)
    if not photos:
        return

    # Parse session start time
    from dateutil.parser import parse as parse_datetime
    session_start = parse_datetime(session["started_at"])

    # Get segments from Whisper response
    segments = []
    if hasattr(whisper_response, 'segments') and whisper_response.segments:
        for seg in whisper_response.segments:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip()
            })
    else:
        # Fallback: split transcript by sentences if no segments
        transcript = session.get("voice_transcript", "")
        if transcript:
            sentences = transcript.replace(".", ".|").replace("?", "?|").replace("!", "!|").split("|")
            sentences = [s.strip() for s in sentences if s.strip()]
            # Estimate 3 seconds per sentence
            for i, sentence in enumerate(sentences):
                segments.append({
                    "start": i * 3,
                    "end": (i + 1) * 3,
                    "text": sentence
                })

    # Match photos to segments
    for photo in photos:
        try:
            photo_time = parse_datetime(photo.get("captured_at", ""))
            offset_seconds = (photo_time - session_start).total_seconds()

            if offset_seconds < 0:
                offset_seconds = 0

            # Find segments within a window around the photo capture time
            # Look 5 seconds before and 10 seconds after
            relevant_snippets = []
            for seg in segments:
                if seg["start"] <= offset_seconds + 10 and seg["end"] >= offset_seconds - 5:
                    relevant_snippets.append(seg["text"])

            if relevant_snippets:
                voice_snippet = " ".join(relevant_snippets)
                await db.inspection_photos.update_one(
                    {"id": photo["id"]},
                    {"$set": {"voice_snippet": voice_snippet}}
                )
        except Exception as e:
            logger.warning("VoiceMatch error for photo %s: %s", photo.get("id"), e)
            continue

    # After attaching snippets, extract AI tags
    await extract_ai_tags_for_session(session_id)


async def extract_ai_tags_for_session(session_id: str):
    """
    Use LLM to extract room names, damage types, and categories from voice snippets.
    Updates each photo with AI-generated tags.
    """
    photos = await db.inspection_photos.find(
        {"session_id": session_id, "voice_snippet": {"$ne": None}}
    ).to_list(500)

    if not photos:
        return

    # Define common room/damage categories for tagging
    ROOM_KEYWORDS = {
        "kitchen": ["kitchen", "stove", "refrigerator", "fridge", "sink", "cabinets", "countertop"],
        "bathroom": ["bathroom", "bath", "toilet", "shower", "tub", "vanity"],
        "living room": ["living room", "living", "family room", "den", "fireplace", "tv room"],
        "bedroom": ["bedroom", "bed", "master", "guest room", "closet"],
        "garage": ["garage", "car", "parking", "tools"],
        "roof": ["roof", "roofing", "shingles", "attic", "gutter", "fascia", "soffit"],
        "exterior": ["exterior", "outside", "siding", "fence", "yard", "landscaping", "driveway"],
        "hallway": ["hallway", "corridor", "stairs", "stairway", "landing"],
        "basement": ["basement", "cellar", "foundation"],
        "laundry": ["laundry", "washer", "dryer", "utility room"],
    }

    DAMAGE_KEYWORDS = {
        "water damage": ["water", "leak", "flood", "moisture", "wet", "stain", "mold", "mildew"],
        "wind damage": ["wind", "blown", "torn", "missing", "lifted"],
        "fire damage": ["fire", "burn", "smoke", "soot", "charred"],
        "hail damage": ["hail", "dent", "impact", "pitting"],
        "structural": ["crack", "structural", "foundation", "settling", "buckling"],
        "roof damage": ["shingle", "roofing", "leak", "missing", "exposed"],
        "electrical": ["electrical", "outlet", "wire", "circuit"],
        "plumbing": ["pipe", "plumbing", "drain", "faucet", "water heater"],
    }

    for photo in photos:
        snippet = (photo.get("voice_snippet") or "").lower()
        if not snippet:
            continue

        # Extract room from voice snippet
        detected_room = None
        for room, keywords in ROOM_KEYWORDS.items():
            if any(kw in snippet for kw in keywords):
                detected_room = room.title()
                break

        # Extract damage type
        detected_damage = []
        for damage, keywords in DAMAGE_KEYWORDS.items():
            if any(kw in snippet for kw in keywords):
                detected_damage.append(damage)

        # Build AI tags list
        ai_tags = []
        if detected_room:
            ai_tags.append(detected_room)
        ai_tags.extend(detected_damage[:3])  # Limit to top 3 damage types

        # Update photo with detected room and tags
        update_data = {}
        if detected_room and not photo.get("room"):
            update_data["room"] = detected_room
        if ai_tags:
            update_data["ai_tags"] = ai_tags
        if detected_damage:
            update_data["category"] = detected_damage[0].title()  # Primary damage type

        if update_data:
            await db.inspection_photos.update_one(
                {"id": photo["id"]},
                {"$set": update_data}
            )
            logger.info("AITag photo %s: room=%s tags=%s", photo["id"][:8], detected_room, ai_tags)


@router.get("/sessions/{session_id}/transcript")
async def get_session_transcript(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get the voice transcript for a session"""
    session = await db.inspection_sessions.find_one(
        {"id": session_id},
        {"_id": 0, "voice_transcript": 1, "voice_transcribed_at": 1, "voice_recording_id": 1}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "transcript": session.get("voice_transcript"),
        "transcribed_at": session.get("voice_transcribed_at"),
        "has_recording": bool(session.get("voice_recording_id"))
    }


# ========== SESSION & CLAIM CLEANUP ==========

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    delete_photos: bool = Query(False, description="Also delete all photos from this session"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Delete an inspection session.
    Optionally delete all associated photos and reports.
    """
    session = await db.inspection_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    deleted_photos = 0
    deleted_reports = 0

    # Delete associated reports
    report_result = await db.inspection_reports.delete_many({"session_id": session_id})
    deleted_reports = report_result.deleted_count

    # Optionally delete photos
    if delete_photos:
        photos = await db.inspection_photos.find(
            {"session_id": session_id}, {"_id": 0, "id": 1, "filename": 1, "claim_id": 1}
        ).to_list(None)

        for photo in photos:
            # Delete file from disk
            claim_id = photo.get("claim_id", "")
            filename = photo.get("filename", "")
            if claim_id and filename:
                file_path = os.path.join(PHOTO_DIR, claim_id, filename)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass

        photo_result = await db.inspection_photos.delete_many({"session_id": session_id})
        deleted_photos = photo_result.deleted_count

    # Delete the session itself
    await db.inspection_sessions.delete_one({"id": session_id})

    return {
        "message": "Session deleted",
        "session_id": session_id,
        "deleted_photos": deleted_photos,
        "deleted_reports": deleted_reports,
    }


@router.delete("/claim/{claim_id}/all")
async def delete_claim_inspections(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Admin: Delete ALL inspection data for a claim -- sessions, photos, reports, files.
    This is a full cleanup operation.
    """
    # Delete all photo files from disk
    photos = await db.inspection_photos.find(
        {"claim_id": claim_id}, {"_id": 0, "id": 1, "filename": 1}
    ).to_list(None)

    for photo in photos:
        filename = photo.get("filename", "")
        if filename:
            file_path = os.path.join(PHOTO_DIR, claim_id, filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass

    # Try to remove the claim photo directory
    claim_dir = os.path.join(PHOTO_DIR, claim_id)
    if os.path.exists(claim_dir):
        try:
            os.rmdir(claim_dir)  # Only removes if empty
        except OSError:
            pass

    # Delete all DB records
    photos_result = await db.inspection_photos.delete_many({"claim_id": claim_id})
    sessions_result = await db.inspection_sessions.delete_many({"claim_id": claim_id})
    reports_result = await db.inspection_reports.delete_many({"claim_id": claim_id})

    return {
        "message": f"All inspection data deleted for claim {claim_id}",
        "claim_id": claim_id,
        "deleted_photos": photos_result.deleted_count,
        "deleted_sessions": sessions_result.deleted_count,
        "deleted_reports": reports_result.deleted_count,
    }
