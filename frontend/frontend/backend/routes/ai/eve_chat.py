"""Eve chat/conversation endpoints, session management, claim context, and document upload."""

from __future__ import annotations

import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File as FastAPIFile

from dependencies import db, get_current_active_user

from routes.ai.prompts import (
    EMERGENT_LLM_KEY,
    EVE_SYSTEM_PROMPT,
    FIRM_CONTEXT,
)
from routes.ai.shared import (
    ChatRequest,
    ChatResponse,
    _claim_visibility_filter,
    _merge_claim_filters,
    extract_claim_reference,
    fetch_claim_context,
    format_claim_context_for_prompt,
    get_relevant_expert_insights,
    get_florida_statute_context,
    _send_via_ai_gateway,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# POST /chat — main Eve conversation endpoint
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat_with_eve(
    request: ChatRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Send a message to Eve AI and get a response"""
    from security import check_rate_limit
    user_id_for_rl = current_user.get("id", "unknown")
    check_rate_limit(f"ai:{user_id_for_rl}", "ai")

    if not EMERGENT_LLM_KEY:
        raise HTTPException(
            status_code=500,
            detail="No AI provider configured. Set OLLAMA_API_KEY (free \u2014 get one at https://ollama.com/settings/keys) or ANTHROPIC_API_KEY in your environment variables.",
        )

    user_id = current_user.get("id")
    session_id = request.session_id or str(uuid.uuid4())
    detected_claim_context = None

    try:
        # Get or create chat session
        session = await db.ai_sessions.find_one({
            "session_id": session_id,
            "user_id": user_id,
        })

        # Build context from previous messages if session exists
        history_context = ""
        if session and session.get("messages"):
            recent_messages = session["messages"][-10:]
            for msg in recent_messages:
                role = "User" if msg["role"] == "user" else "Eve"
                history_context += f"{role}: {msg['content']}\n\n"

        # === ENHANCED CLAIM CONTEXT DETECTION ===
        claim_context_str = ""

        # Priority 1: Direct claim_id provided
        if request.claim_id:
            detected_claim_context = await fetch_claim_context(request.claim_id, current_user)
            if detected_claim_context:
                claim_context_str = format_claim_context_for_prompt(detected_claim_context)

        # Priority 2: Claim context dict provided by frontend
        elif request.claim_context:
            claim_context_str = format_claim_context_for_prompt(request.claim_context)
            detected_claim_context = request.claim_context

        # Priority 3: Auto-detect claim reference from message
        else:
            claim_ref = await extract_claim_reference(request.message)
            if claim_ref:
                detected_claim_context = await fetch_claim_context(claim_ref, current_user)
                if detected_claim_context:
                    claim_context_str = format_claim_context_for_prompt(detected_claim_context)
                    logger.info("Eve auto-detected claim reference: %s", claim_ref)

        # Priority 4: Check session for previously referenced claim
        if not claim_context_str and session and session.get("active_claim_id"):
            detected_claim_context = await fetch_claim_context(session["active_claim_id"], current_user)
            if detected_claim_context:
                claim_context_str = format_claim_context_for_prompt(detected_claim_context)

        # Use static FIRM_CONTEXT (Gamma DISABLED)
        firm_context = f"\n\n--- FIRM KNOWLEDGE BASE ---\n{FIRM_CONTEXT}\n--- END KNOWLEDGE BASE ---\n\n"

        # Get relevant expert insights from knowledge base
        expert_context = get_relevant_expert_insights(request.message)

        # Get relevant Florida statute context from database (async)
        florida_law_context = await get_florida_statute_context(request.message)

        # Build the full prompt with history
        full_prompt = ""
        if history_context:
            full_prompt = f"Previous conversation:\n{history_context}\n"
        full_prompt += firm_context
        if expert_context:
            full_prompt += expert_context
        if florida_law_context:
            full_prompt += florida_law_context
        if claim_context_str:
            full_prompt += claim_context_str
        full_prompt += f"User's current question: {request.message}"

        response_text, _, _ = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"eve-{user_id}-{session_id}",
            system_message=EVE_SYSTEM_PROMPT,
            prompt_text=full_prompt,
            task_type=request.task_type or "chat",
            preferred_provider=request.provider,
            preferred_model=request.model,
        )

        # Store the conversation in the database
        now = datetime.now(timezone.utc).isoformat()

        new_messages = [
            {"role": "user", "content": request.message, "timestamp": now},
            {"role": "assistant", "content": response_text, "timestamp": now},
        ]

        update_data = {
            "$push": {"messages": {"$each": new_messages}},
            "$set": {"updated_at": now},
        }

        if detected_claim_context and detected_claim_context.get("claim_id"):
            update_data["$set"]["active_claim_id"] = detected_claim_context["claim_id"]

        if session:
            await db.ai_sessions.update_one(
                {"session_id": session_id, "user_id": user_id},
                update_data,
            )
        else:
            new_session = {
                "session_id": session_id,
                "user_id": user_id,
                "messages": new_messages,
                "created_at": now,
                "updated_at": now,
            }
            if detected_claim_context and detected_claim_context.get("claim_id"):
                new_session["active_claim_id"] = detected_claim_context["claim_id"]
            await db.ai_sessions.insert_one(new_session)

        return ChatResponse(
            response=response_text,
            session_id=session_id,
            claim_context=detected_claim_context,
        )

    except Exception as e:
        err_str = str(e)
        logger.error("Eve AI error: %s", err_str)
        if "OLLAMA_API_KEY" in err_str or "No AI provider" in err_str:
            detail = "AI is not configured yet. An admin needs to set the OLLAMA_API_KEY in the server environment. Get a free key at https://ollama.com/settings/keys"
        elif "invalid x-api-key" in err_str or "authentication_error" in err_str:
            detail = "AI provider authentication failed. The API key may be invalid or expired. Please contact your administrator."
        elif "timed out" in err_str.lower() or "timeout" in err_str.lower():
            detail = "AI service timed out. Please try again in a moment."
        else:
            detail = "AI service encountered an unexpected error. Please try again or contact support."
        raise HTTPException(status_code=500, detail=detail)


# ---------------------------------------------------------------------------
# Session management endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_active_user),
):
    """Get all chat sessions for the current user"""
    user_id = current_user.get("id")

    sessions = await db.ai_sessions.find(
        {"user_id": user_id},
        {"_id": 0, "session_id": 1, "created_at": 1, "updated_at": 1},
    ).sort("updated_at", -1).to_list(50)

    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a specific chat session with all messages"""
    user_id = current_user.get("id")

    session = await db.ai_sessions.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0},
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a chat session"""
    user_id = current_user.get("id")

    result = await db.ai_sessions.delete_one({
        "session_id": session_id,
        "user_id": user_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Session deleted"}


@router.post("/sessions/new")
async def create_new_session(
    current_user: dict = Depends(get_current_active_user),
):
    """Create a new chat session"""
    session_id = str(uuid.uuid4())
    return {"session_id": session_id}


# ---------------------------------------------------------------------------
# Claim context endpoints
# ---------------------------------------------------------------------------

@router.get("/claims-for-context")
async def get_claims_for_context(
    current_user: dict = Depends(get_current_active_user),
    search: Optional[str] = None,
    limit: int = 20,
):
    """
    Get a list of claims that can be linked to Eve conversations.
    Used by frontend to show claim selector.
    """
    try:
        visibility_query = _claim_visibility_filter(current_user)
        search_query = {}
        safe_limit = max(1, min(limit, 100))

        if search:
            search_query = {
                "$or": [
                    {"claim_number": {"$regex": search, "$options": "i"}},
                    {"client_name": {"$regex": search, "$options": "i"}},
                    {"property_address": {"$regex": search, "$options": "i"}},
                ]
            }

        query = _merge_claim_filters(visibility_query, search_query)

        claims = await db.claims.find(
            query,
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "carrier": 1, "property_address": 1},
        ).sort("updated_at", -1).limit(safe_limit).to_list(safe_limit)

        return {"claims": claims}

    except Exception as e:
        logger.error("Error fetching claims for context: %s", e)
        return {"claims": []}


@router.get("/claim-context/{claim_id}")
async def get_claim_context_for_eve(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get full claim context for Eve.
    Returns claim details, notes, documents summary.
    """
    context = await fetch_claim_context(claim_id, current_user)

    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")

    return context


# ---------------------------------------------------------------------------
# Document upload for Eve AI analysis
# ---------------------------------------------------------------------------

@router.post("/upload-document")
async def upload_document_for_eve(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Upload a document for Eve to analyze.
    Supports: PDF, images (JPG, PNG, WEBP), Word docs, and text files.
    Returns document ID and extracted text if possible.
    """
    from security import check_rate_limit
    user_id = current_user.get("id")
    check_rate_limit(f"upload:{user_id}", "upload")

    allowed_types = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/webp',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    content_type = file.content_type
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    file_content = await file.read()

    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    document_id = str(uuid.uuid4())

    extracted_text = None
    try:
        if content_type == 'text/plain':
            extracted_text = file_content.decode('utf-8')
        elif content_type == 'application/pdf':
            extracted_text = f"[PDF document uploaded: {file.filename}]"
        elif content_type.startswith('image/'):
            extracted_text = f"[Image uploaded: {file.filename}]"
        else:
            extracted_text = f"[Document uploaded: {file.filename}]"
    except Exception as e:
        logger.error("Error extracting text: %s", e)
        extracted_text = f"[Document uploaded: {file.filename}]"

    doc_record = {
        "id": document_id,
        "user_id": user_id,
        "filename": file.filename,
        "content_type": content_type,
        "size": len(file_content),
        "extracted_text": extracted_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.eve_documents.insert_one(doc_record)

    return {
        "document_id": document_id,
        "filename": file.filename,
        "extracted_text": extracted_text,
        "message": f"Document '{file.filename}' uploaded successfully. Agent Eve is ready to analyze it.",
    }
