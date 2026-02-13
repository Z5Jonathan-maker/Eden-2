"""
AI Module - Chat Routes

Eve AI chat interface, session management, and conversation history.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import logging
import uuid
import re
import json

logger = logging.getLogger(__name__)

# Import the Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)

# Get the Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


from .models import ChatMessage, ChatRequest, ChatResponse
from .prompts import EVE_SYSTEM_PROMPT, FIRM_CONTEXT, build_eve_context_with_florida_laws, get_claim_data_for_eve

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_eve(
    request: ChatRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Send a message to Eve AI and get a response"""
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(
            status_code=500,
            detail="AI service not configured. Please contact administrator."
        )
    
    user_id = current_user.get("id")
    session_id = request.session_id or str(uuid.uuid4())
    detected_claim_context = None
    
    try:
        # Get or create chat session
        session = await db.ai_sessions.find_one({
            "session_id": session_id,
            "user_id": user_id
        })
        
        # Build context from previous messages if session exists
        history_context = ""
        if session and session.get("messages"):
            # Get last 10 messages for context
            recent_messages = session["messages"][-10:]
            for msg in recent_messages:
                role = "User" if msg["role"] == "user" else "Eve"
                history_context += f"{role}: {msg['content']}\n\n"
        
        # === ENHANCED CLAIM CONTEXT DETECTION ===
        claim_context_str = ""
        
        # Priority 1: Direct claim_id provided
        if request.claim_id:
            detected_claim_context = await fetch_claim_context(request.claim_id, user_id)
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
                detected_claim_context = await fetch_claim_context(claim_ref, user_id)
                if detected_claim_context:
                    claim_context_str = format_claim_context_for_prompt(detected_claim_context)
                    logger.info(f"Eve auto-detected claim reference: {claim_ref}")
        
        # Priority 4: Check session for previously referenced claim
        if not claim_context_str and session and session.get("active_claim_id"):
            detected_claim_context = await fetch_claim_context(session["active_claim_id"], user_id)
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
            preferred_model=request.model
        )
        
        # Store the conversation in the database
        now = datetime.now(timezone.utc).isoformat()
        
        new_messages = [
            {"role": "user", "content": request.message, "timestamp": now},
            {"role": "assistant", "content": response_text, "timestamp": now}
        ]
        
        # Build update data
        update_data = {
            "$push": {"messages": {"$each": new_messages}},
            "$set": {"updated_at": now}
        }
        
        # Store active claim ID in session if detected
        if detected_claim_context and detected_claim_context.get("claim_id"):
            update_data["$set"]["active_claim_id"] = detected_claim_context["claim_id"]
        
        if session:
            # Update existing session
            await db.ai_sessions.update_one(
                {"session_id": session_id, "user_id": user_id},
                update_data
            )
        else:
            # Create new session
            new_session = {
                "session_id": session_id,
                "user_id": user_id,
                "messages": new_messages,
                "created_at": now,
                "updated_at": now
            }
            if detected_claim_context and detected_claim_context.get("claim_id"):
                new_session["active_claim_id"] = detected_claim_context["claim_id"]
            await db.ai_sessions.insert_one(new_session)
        
        return ChatResponse(
            response=response_text, 
            session_id=session_id,
            claim_context=detected_claim_context
        )
        
    except Exception as e:
        logger.error(f"Eve AI error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}"
        )


