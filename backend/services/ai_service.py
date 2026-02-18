"""
Shared AI Service - Centralized AI Layer with Guardrails
All AI surfaces (Eve, Comms Bot, AI Receptionist) must use this layer.
"""

import os
import re
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from dependencies import db
from services.ollama_config import get_ollama_api_key, get_ollama_model

logger = logging.getLogger(__name__)

# Emergent LLM client - lazy loaded
_llm_client = None

def get_llm_client():
    """Get or create LLM client — defaults to Ollama (free), falls back to OpenAI"""
    global _llm_client
    if _llm_client is None:
        try:
            from emergentintegrations.llm.chat import LlmChat
            _llm_client = LlmChat(
                api_key=get_ollama_api_key() or os.environ.get("EMERGENT_LLM_KEY"),
                model=get_ollama_model()
            )
            # Auto-select best available provider
            _llm_client._resolve_default_provider()
        except Exception as e:
            logger.error(f"Failed to initialize LLM client: {e}")
            raise
    return _llm_client


class AIRequest(BaseModel):
    """Input schema for AI requests"""
    prompt_type: str  # "eve_conversation", "draft_sms_reply", "call_summary", "claim_strategy"
    claim_context: Optional[dict] = None  # claim_id, status, client_name, history
    user_message: Optional[str] = None  # for conversation types
    channel: str = "chat"  # "chat", "sms", "voice"
    user_id: str  # for audit
    additional_context: Optional[dict] = None  # extra data like inbound SMS body
    conversation_history: Optional[List[dict]] = None  # previous messages


class AIResponse(BaseModel):
    """Output schema for AI responses"""
    draft_text: str
    confidence: float = 0.85  # 0.0-1.0
    warnings: List[str] = []
    suggested_actions: Optional[List[str]] = None
    requires_human_approval: bool = True
    audit_id: str


# Guardrail patterns
LEGAL_PROMISE_PATTERNS = [
    r'\bguarantee[sd]?\b',
    r'\bpromise[sd]?\b',
    r'\bwill receive\b',
    r'\byou will get\b',
    r'\blegally binding\b',
    r'\blegal advice\b',
    r'\bthis is legal\b',
    r'\bwe ensure\b',
    r'\babsolutely\s+will\b',
]

SENSITIVE_KEYWORDS = [
    'lawsuit', 'attorney', 'lawyer', 'fraud', 'bad faith', 
    'sue', 'suing', 'litigation', 'court', 'deposition',
    'subpoena', 'malpractice', 'negligence'
]


def strip_legal_promises(text: str) -> tuple[str, List[str]]:
    """
    Remove text that sounds like legal promises.
    Returns (cleaned_text, warnings)
    """
    warnings = []
    cleaned = text
    
    for pattern in LEGAL_PROMISE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            warnings.append(f"Removed potential legal promise: matched '{pattern}'")
            cleaned = re.sub(pattern, '[REMOVED]', cleaned, flags=re.IGNORECASE)
    
    # Clean up multiple [REMOVED] markers
    cleaned = re.sub(r'\[REMOVED\](\s*\[REMOVED\])+', '[REMOVED]', cleaned)
    
    return cleaned, warnings


def flag_sensitive_content(text: str) -> List[str]:
    """
    Detect sensitive keywords that may need human review.
    Returns list of warnings.
    """
    warnings = []
    text_lower = text.lower()
    
    for keyword in SENSITIVE_KEYWORDS:
        if keyword in text_lower:
            warnings.append(f"Contains sensitive keyword: '{keyword}' - requires human review")
    
    return warnings


def add_disclaimer(text: str, confidence: float) -> str:
    """Add disclaimer if confidence is low"""
    if confidence < 0.7:
        disclaimer = "\n\n[Note: This is an AI-generated draft. Please review carefully before sending.]"
        if disclaimer not in text:
            text += disclaimer
    return text


def truncate_for_sms(text: str, max_length: int = 1500) -> str:
    """Truncate text for SMS while keeping it coherent"""
    if len(text) <= max_length:
        return text
    
    # Try to cut at sentence boundary
    truncated = text[:max_length]
    last_period = truncated.rfind('.')
    if last_period > max_length * 0.7:
        return truncated[:last_period + 1]
    return truncated[:max_length-3] + '...'


def hash_input(request: AIRequest) -> str:
    """Create hash of input for deduplication"""
    content = f"{request.prompt_type}:{request.user_message}:{request.claim_context}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


# System prompts by type
SYSTEM_PROMPTS = {
    "eve_conversation": """You are Eve, an AI assistant for Care Claims, a public adjusting firm in Florida. 
You help adjusters with claims questions, Florida insurance statutes, and best practices.

Guidelines:
- Be helpful, professional, and concise
- Reference Florida Statutes when relevant (F.S. 627, F.S. 626)
- Never provide legal advice - suggest consulting an attorney for legal questions
- Focus on practical, actionable guidance
- If unsure, say so and suggest who to ask""",

    "draft_sms_reply": """You are drafting an SMS reply for a Care Claims adjuster to send to a client.

Guidelines:
- Keep it brief (under 300 characters ideal)
- Be warm, professional, and reassuring
- Use simple language
- Never make promises about outcomes
- Include a call to action when appropriate
- Sign off as "Care Claims Team"

Context about the inbound message and claim will be provided.""",

    "call_summary": """You are summarizing a phone call for Care Claims records.

Guidelines:
- Extract key points: who called, purpose, decisions made, next steps
- Use bullet points for clarity
- Note any commitments or promises made (flag if concerning)
- Include caller's emotional state if relevant
- Keep it factual and concise""",

    "claim_strategy": """You are helping develop a claim strategy for Care Claims adjusters.

Guidelines:
- Analyze the claim details provided
- Suggest 3-5 actionable next steps
- Consider Florida insurance regulations
- Identify potential challenges
- Never guarantee outcomes
- Flag if carrier response seems unusual"""
}


async def generate(request: AIRequest) -> AIResponse:
    """
    Main entry point for AI generation.
    All AI surfaces should use this function.
    """
    import uuid
    
    audit_id = str(uuid.uuid4())
    warnings = []
    confidence = 0.85
    
    try:
        # Build prompt
        system_prompt = SYSTEM_PROMPTS.get(request.prompt_type, SYSTEM_PROMPTS["eve_conversation"])
        
        # Add claim context if provided
        context_str = ""
        if request.claim_context:
            context_str = f"\n\nClaim Context:\n"
            for k, v in request.claim_context.items():
                if v:
                    context_str += f"- {k}: {v}\n"
            
            # --- GUARDRAIL: Stage-Awareness ---
            status = request.claim_context.get("status", "New")
            if status == "Closed":
                context_str += "\nWARNING: This claim is CLOSED. Do not suggest actions that require reopening unless explicitly asked.\n"
            elif status == "Archived":
                context_str += "\nWARNING: This claim is ARCHIVED. It is read-only.\n"
            elif status == "Litigation":
                context_str += "\nCRITICAL: This claim is in LITIGATION. Do NOT provide strategy advice. Direct the user to legal counsel immediately.\n"
        
        # Add additional context
        if request.additional_context:
            context_str += f"\nAdditional Info:\n"
            for k, v in request.additional_context.items():
                if v:
                    context_str += f"- {k}: {v}\n"
        
        full_system = system_prompt + context_str
        
        # Build messages
        messages = [{"role": "system", "content": full_system}]
        
        # Add conversation history if provided
        if request.conversation_history:
            for msg in request.conversation_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current message
        if request.user_message:
            messages.append({"role": "user", "content": request.user_message})
        
        # Call LLM
        client = get_llm_client()
        response = await client.chat(messages=messages)
        
        draft_text = response.get("content", "") if isinstance(response, dict) else str(response)
        
        # Apply guardrails
        draft_text, legal_warnings = strip_legal_promises(draft_text)
        warnings.extend(legal_warnings)
        
        sensitive_warnings = flag_sensitive_content(draft_text)
        warnings.extend(sensitive_warnings)
        
        # Lower confidence if warnings
        if warnings:
            confidence = max(0.5, confidence - 0.1 * len(warnings))
        
        # Add disclaimer if low confidence
        if confidence < 0.7:
            draft_text = add_disclaimer(draft_text, confidence)
        
        # Truncate for SMS if needed
        if request.channel == "sms":
            draft_text = truncate_for_sms(draft_text)
        
        # Determine suggested actions
        suggested_actions = None
        if request.prompt_type == "claim_strategy":
            # Extract action items from response
            action_lines = [l.strip() for l in draft_text.split('\n') if l.strip().startswith(('-', '•', '1', '2', '3', '4', '5'))]
            if action_lines:
                suggested_actions = action_lines[:5]
        
        # Log to audit collection
        await log_ai_interaction(
            audit_id=audit_id,
            request=request,
            output_text=draft_text[:1000],  # Truncate for storage
            confidence=confidence,
            warnings=warnings
        )
        
        return AIResponse(
            draft_text=draft_text,
            confidence=confidence,
            warnings=warnings,
            suggested_actions=suggested_actions,
            requires_human_approval=True,  # Always require human approval
            audit_id=audit_id
        )
        
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        
        # Log failed attempt
        await log_ai_interaction(
            audit_id=audit_id,
            request=request,
            output_text=f"ERROR: {str(e)}",
            confidence=0.0,
            warnings=[f"Generation failed: {str(e)}"]
        )
        
        return AIResponse(
            draft_text="I apologize, but I'm unable to generate a response right now. Please try again or contact support.",
            confidence=0.0,
            warnings=[f"Generation failed: {str(e)}"],
            requires_human_approval=True,
            audit_id=audit_id
        )


async def log_ai_interaction(
    audit_id: str,
    request: AIRequest,
    output_text: str,
    confidence: float,
    warnings: List[str]
):
    """Log AI interaction to audit collection"""
    try:
        audit_record = {
            "audit_id": audit_id,
            "prompt_type": request.prompt_type,
            "input_hash": hash_input(request),
            "output_text": output_text,
            "confidence": confidence,
            "warnings": warnings,
            "user_id": request.user_id,
            "claim_id": request.claim_context.get("claim_id") if request.claim_context else None,
            "channel": request.channel,
            "human_approved": None,  # Set later when user sends
            "sent_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.ai_audit.insert_one(audit_record)
        logger.info(f"AI audit logged: {audit_id}")
        
    except Exception as e:
        logger.error(f"Failed to log AI audit: {e}")


async def mark_approved(audit_id: str, sent: bool = True):
    """Mark an AI draft as approved/sent by human"""
    try:
        update = {
            "human_approved": True,
            "sent_at": datetime.now(timezone.utc).isoformat() if sent else None
        }
        await db.ai_audit.update_one(
            {"audit_id": audit_id},
            {"$set": update}
        )
    except Exception as e:
        logger.error(f"Failed to mark AI audit approved: {e}")


async def mark_rejected(audit_id: str, reason: str = None):
    """Mark an AI draft as rejected by human"""
    try:
        update = {
            "human_approved": False,
            "rejection_reason": reason
        }
        await db.ai_audit.update_one(
            {"audit_id": audit_id},
            {"$set": update}
        )
    except Exception as e:
        logger.error(f"Failed to mark AI audit rejected: {e}")


# Convenience functions for specific use cases
async def draft_sms_reply(
    claim_id: str,
    claim_context: dict,
    inbound_message: str,
    user_id: str
) -> AIResponse:
    """Convenience function for drafting SMS replies"""
    return await generate(AIRequest(
        prompt_type="draft_sms_reply",
        claim_context=claim_context,
        user_message=f"Draft a reply to this client message: {inbound_message}",
        channel="sms",
        user_id=user_id,
        additional_context={"inbound_message": inbound_message}
    ))


async def get_eve_response(
    user_message: str,
    user_id: str,
    claim_context: dict = None,
    conversation_history: List[dict] = None
) -> AIResponse:
    """Convenience function for Eve conversations"""
    return await generate(AIRequest(
        prompt_type="eve_conversation",
        claim_context=claim_context,
        user_message=user_message,
        channel="chat",
        user_id=user_id,
        conversation_history=conversation_history
    ))


async def summarize_call(
    transcript: str,
    claim_context: dict,
    user_id: str
) -> AIResponse:
    """Convenience function for call summaries"""
    return await generate(AIRequest(
        prompt_type="call_summary",
        claim_context=claim_context,
        user_message=f"Summarize this call:\n\n{transcript}",
        channel="voice",
        user_id=user_id
    ))
