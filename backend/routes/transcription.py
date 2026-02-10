"""
Audio Transcription Routes - Whisper Integration for Rapid Capture
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Header
from typing import Optional
import os
import tempfile
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/transcription", tags=["transcription"])

# Auth helper - avoid circular import
async def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    from auth import decode_access_token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = "en",
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Transcribe audio file using OpenAI Whisper.
    Returns text with timestamps for matching to photos.
    """
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Transcription service not configured")
        
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Initialize Whisper
            stt = OpenAISpeechToText(api_key=api_key)
            
            # Transcribe with timestamps
            with open(tmp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    language=language,
                    prompt="Property inspection notes describing damage to roof, siding, gutters, windows, and other areas.",
                    timestamp_granularities=["segment"]
                )
            
            # Parse segments with timestamps
            segments = []
            if hasattr(response, 'segments') and response.segments:
                for seg in response.segments:
                    segments.append({
                        "start": seg.start,
                        "end": seg.end,
                        "text": seg.text.strip()
                    })
            
            return {
                "success": True,
                "text": response.text,
                "segments": segments,
                "transcribed_at": datetime.utcnow().isoformat()
            }
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except ImportError:
        raise HTTPException(status_code=500, detail="Transcription library not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/match-photos")
async def match_transcription_to_photos(
    data: dict,
    current_user: dict = Depends(get_current_user_from_token)
):
    """
    Match transcription segments to photos based on timestamps.
    """
    try:
        segments = data.get("segments", [])
        photos = data.get("photos", [])
        
        matched = []
        
        for photo in photos:
            photo_offset = photo.get("captured_at_offset", 0)
            photo_id = photo.get("id")
            
            # Find segments spoken around photo capture time (+/- 3 sec window)
            matching_text = []
            for seg in segments:
                seg_start = seg.get("start", 0)
                seg_end = seg.get("end", 0)
                
                if (seg_start - 3) <= photo_offset <= (seg_end + 5):
                    matching_text.append(seg.get("text", ""))
            
            matched.append({
                "photo_id": photo_id,
                "annotation": " ".join(matching_text) if matching_text else None,
                "offset": photo_offset
            })
        
        return {"success": True, "matched_photos": matched}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")
