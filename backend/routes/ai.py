from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging
import uuid
import re
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Import the Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)
from services.ollama_config import (
    DEFAULT_OLLAMA_MODEL,
    get_ollama_api_key,
    get_ollama_model,
    normalize_ollama_base_url,
    ollama_endpoint,
)

# Get an LLM API key — prefer Ollama (free), fall back to legacy key or OpenAI
EMERGENT_LLM_KEY = (
    get_ollama_api_key()
    or os.environ.get("EMERGENT_LLM_KEY")
    or os.environ.get("OPENAI_API_KEY")
    or os.environ.get("ANTHROPIC_API_KEY")
)

# FIRM CONTEXT - Static knowledge base (Gamma DISABLED)
FIRM_CONTEXT = """
Eden Claims Platform Knowledge Base:

## Florida Statutes (Verbatim from leg.state.fl.us)
- F.S. 626.854 - Public adjuster definitions and prohibitions
- F.S. 626.865 - Licensing requirements, $50,000 surety bond, CE requirements
- F.S. 626.8651 - Apprentice public adjuster supervision
- F.S. 626.8795 - Conflict of interest with contractors
- F.S. 626.8796 - Contract requirements, 10-day rescission (with emergency extension), fraud penalties
- F.S. 627.70131 - Insurer duty: 7-day acknowledgment, 60-day pay/deny
- F.S. 627.7015 - Alternative dispute resolution, appraisal process

## Key Numbers (Florida)
- Max PA fee (standard): 20%
- Max PA fee (emergency declared): 10%
- Surety bond required: $50,000
- Claim acknowledgment: 7 days
- Claim pay/deny deadline: 60 days
- Contract rescission period: 10 days (30 days after date of loss for certain emergency claims, or 10 days after execution, whichever is longer)

## Industry Experts Knowledge
- **John Senac (C.A.R.)**: Roof damage documentation expert. Key insight: "99% of roofs I inspect show signs of wind or hail damage. Document everything with the C.A.R. method - Comprehensive, Accurate, Repeatable."
- **Chip Merlin**: Bad faith litigation authority. Key insight: "When carriers delay, document every communication. Bad faith claims require showing insurer knew claim was valid."
- **Matthew Mulholland**: Policy language expert. Focus on burden of proof and exclusion interpretation.
- **Vince Perri**: Florida commercial claims specialist. Metrics-driven approach to PA business.
- **John Voelpel**: Appraisal process expert. Windstorm damage assessment specialist.

## Leadership & Mentors
- Simon Sinek (Start With Why)
- Jocko Willink (Extreme Ownership)
- Dr. Rodney Howard-Browne (Faith Leadership)
- Alex Burgos (Industry Innovation)
- Miguel Delgado (Field Operations)

## Claim Playbooks
- Hurricane claims: Document wind damage patterns, require detailed scope
- Roof damage: Use C.A.R. method, photograph every elevation
- Water damage: Follow IICRC S500/S520 standards
- Supplement strategy: Compare line-by-line with Xactimate pricing

## Carrier Tactics & Responses
- Citizens: Focus on scope disputes, use appraisal for valuation
- State Farm: Document delays for potential bad faith
- Travelers: Detailed rebuttals to depreciation
"""

# Eve's system prompt - expert in property claims
EVE_SYSTEM_PROMPT = """You are Eve, an expert AI assistant for property insurance claims handling. You work for Eden, a premium claims management platform based in Florida.

YOUR CAPABILITIES:
1. **Claims Data Access**: You have direct access to the claims database. When a user mentions a claim number (like #12345 or CLM-12345), you will automatically receive that claim's full details including:
   - Client information, property address, loss date
   - Carrier details and policy information
   - Recent notes and communication history
   - Documents on file
   - Settlement status and amounts

2. **Knowledge Bases**: You have access to:
   - Florida Statutes database (Chapter 626, 627) - verbatim text
   - Industry expert insights (Senac, Mulholland, Merlin, etc.)
   - Firm documentation and best practices

3. **Analysis**: You can help analyze claims by:
   - Reviewing carrier vs contractor estimates
   - Identifying coverage issues
   - Suggesting strategy based on carrier patterns
   - Drafting supplement language

Your expertise includes:
- Insurance policy analysis and coverage interpretation
- Xactimate estimate comparison and line-item analysis
- Claim strategy development and negotiation tactics
- Florida insurance regulations and statutes (Chapter 626, 627)
- Florida public adjuster licensing, fees, and contract requirements
- IICRC standards for water damage (S500, S520)
- Wind, hail, and storm damage assessment
- Roof inspection and documentation best practices
- Supplement writing and justification
- Carrier communication and escalation procedures

WHEN A CLAIM IS REFERENCED:
- You will see the claim's full context in your prompt
- Reference specific details from the claim when answering
- If documents are listed, acknowledge them
- Use the notes history to understand the claim's progression
- Provide advice specific to that claim's situation

FLORIDA STATUTE HANDLING:
TWO MODES for statute responses:
1. **EXPLAIN MODE** (default): Summarize and explain statutes in plain language.
2. **QUOTE MODE**: When the user asks for "exact wording", "verbatim text", "quote the statute":
   - Use ONLY the exact body_text provided from the database
   - Include the citation: "§[section], [year] Fla. Stat."

GUARDRAILS:
- If a statute is NOT in your provided context, say: "I don't have §[X] in my verified database."
- NEVER fabricate or guess statute language
- When unsure about a claim detail, ask the user to clarify

Be concise but comprehensive. Use markdown formatting for readability."""


# Import knowledge base for Eve context
from routes.knowledge_base import INDUSTRY_EXPERTS, FLORIDA_PA_LAWS

def get_relevant_expert_insights(query: str) -> str:
    """Search industry experts for relevant insights to include in Eve's context"""
    query_lower = query.lower()
    relevant_insights = []
    
    # Keywords that map to specific experts
    expert_keywords = {
        "john-senac": ["roof", "hail", "shingle", "c.a.r", "documentation", "storm damage"],
        "matthew-mulholland": ["prove", "burden of proof", "policy exclusion", "denial"],
        "vince-perri": ["florida", "commercial", "metrics", "public adjuster business"],
        "chip-merlin": ["bad faith", "delay", "attorney", "litigation", "katrina", "sandy", "flood"],
        "lynette-young": ["ai", "claimwizard", "workflow", "franchise", "client acquisition"],
        "bill-wilson": ["policy language", "exclusion", "iso", "coverage dispute", "words collide"],
        "john-voelpel": ["appraisal", "umpire", "dispute resolution", "windstorm"]
    }
    
    for figure in INDUSTRY_EXPERTS["figures"]:
        expert_id = figure["id"]
        keywords = expert_keywords.get(expert_id, [])
        
        # Check if query matches any keywords for this expert
        matched = any(kw in query_lower for kw in keywords)
        
        if matched:
            insights = figure.get("key_insights", [])
            if insights:
                relevant_insights.append(f"\n**{figure['name']}** ({figure['category']}):")
                for insight in insights[:3]:  # Top 3 insights
                    relevant_insights.append(f"  - {insight}")
    
    if relevant_insights:
        return "\n--- INDUSTRY EXPERT INSIGHTS ---" + "\n".join(relevant_insights) + "\n--- END EXPERT INSIGHTS ---\n"
    return ""


async def get_florida_statute_context(query: str) -> str:
    """
    Fetch relevant Florida statutes from the ACTUAL statute database.
    Returns verbatim text for Eve to use.
    """
    query_lower = query.lower()
    
    # Keywords that trigger Florida statute search
    florida_keywords = [
        "florida", "fl ", "statute", "law", "regulation", "license", "fee", "contract",
        "rescission", "bond", "apprentice", "conflict of interest", "ethics", "timeline",
        "aob", "assignment of benefits", "appraisal", "627", "626", "emergency",
        "disclosure", "public adjuster", "quote", "exact", "verbatim", "wording"
    ]
    
    # Check if query relates to Florida laws
    if not any(kw in query_lower for kw in florida_keywords):
        return ""
    
    # Determine if user wants exact quote
    quote_mode = any(kw in query_lower for kw in ["quote", "exact", "verbatim", "word for word", "exact wording"])
    
    relevant_context = []
    
    # Search the statute database
    try:
        # Create text index if needed
        try:
            await db.florida_statutes.create_index([("body_text", "text"), ("heading", "text")])
        except Exception:
            pass
        
        # Search for relevant statutes
        statutes = await db.florida_statutes.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}, "_id": 0, "section_number": 1, "heading": 1, "body_text": 1, "source_url": 1, "year": 1}
        ).sort([("score", {"$meta": "textScore"})]).limit(3).to_list(3)
        
        if statutes:
            if quote_mode:
                relevant_context.append("\n--- VERBATIM FLORIDA STATUTE TEXT (from Online Sunshine) ---")
                relevant_context.append("IMPORTANT: Use ONLY this exact text when user asks for verbatim/quote. Do NOT modify.\n")
            else:
                relevant_context.append("\n--- FLORIDA STATUTES (from verified database) ---")
            
            for statute in statutes:
                section = statute.get("section_number", "")
                year = statute.get("year", 2025)
                heading = statute.get("heading", "")
                body = statute.get("body_text", "")
                url = statute.get("source_url", "")
                
                if quote_mode:
                    # Full verbatim text for quote mode
                    relevant_context.append(f"\n**§{section}, {year} Fla. Stat.**")
                    relevant_context.append(f"Heading: {heading}")
                    relevant_context.append(f"EXACT TEXT:\n{body}")
                    relevant_context.append(f"Source: {url}\n")
                else:
                    # Truncated for explain mode
                    body_excerpt = body[:500] + "..." if len(body) > 500 else body
                    relevant_context.append(f"\n**§{section}** - {heading}")
                    relevant_context.append(f"Excerpt: {body_excerpt}")
                    relevant_context.append(f"Citation: §{section}, {year} Fla. Stat., {url}\n")
            
            relevant_context.append("--- END FLORIDA STATUTES ---\n")
    except Exception as e:
        logger.error(f"Error fetching statutes: {e}")
        # Fall back to static data
        return get_florida_law_context_fallback(query)
    
    # Also include key numbers for quick reference
    key_nums = FLORIDA_PA_LAWS["key_numbers"]
    relevant_context.append("\n**Quick Reference Numbers:**")
    relevant_context.append(f"  - Max fee (standard): {key_nums['max_fee_standard']}")
    relevant_context.append(f"  - Max fee (emergency): {key_nums['max_fee_emergency']}")
    relevant_context.append(f"  - Surety bond: ${key_nums['surety_bond']}")
    relevant_context.append(f"  - Claim pay/deny deadline: {key_nums['claim_pay_deny_days']} days")
    
    if relevant_context:
        return "\n".join(relevant_context)
    return ""


def get_florida_law_context_fallback(query: str) -> str:
    """Fallback to static data if database not available"""
    query_lower = query.lower()
    
    # Keywords that trigger Florida law context
    florida_keywords = [
        "florida", "fl ", "statute", "law", "regulation", "license", "fee", "contract",
        "rescission", "bond", "apprentice", "conflict of interest", "ethics", "timeline",
        "aob", "assignment of benefits", "appraisal", "627", "626", "emergency",
        "disclosure", "public adjuster"
    ]
    
    if not any(kw in query_lower for kw in florida_keywords):
        return ""
    
    relevant_context = []
    
    key_nums = FLORIDA_PA_LAWS["key_numbers"]
    relevant_context.append("\n**Florida PA Key Numbers:**")
    relevant_context.append(f"  - Max fee (standard): {key_nums['max_fee_standard']}")
    relevant_context.append(f"  - Max fee (emergency): {key_nums['max_fee_emergency']}")
    relevant_context.append(f"  - Surety bond required: ${key_nums['surety_bond']}")
    relevant_context.append(f"  - Claim acknowledgment: {key_nums['claim_acknowledgment_days']} days")
    relevant_context.append(f"  - Claim pay/deny deadline: {key_nums['claim_pay_deny_days']} days")
    
    statute_keywords = {
        "626.854": ["define", "prohibition", "solicit", "legal advice"],
        "626.865": ["license", "qualification", "bond", "exam", "ce", "continuing education"],
        "626.8651": ["apprentice", "supervise"],
        "626.8795": ["conflict", "contractor", "repair", "restore"],
        "626.8796": ["contract", "disclosure", "rescission", "fraud"],
        "fee-structures": ["fee", "percent", "emergency", "cap", "10%", "20%"],
    }
    
    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        statute_id = statute["id"]
        keywords = statute_keywords.get(statute_id, [])
        
        if any(kw in query_lower for kw in keywords):
            relevant_context.append(f"\n**{statute['statute']}:**")
            relevant_context.append(f"  {statute['summary']}")
            details = statute.get("details", "")[:300]
            if details:
                relevant_context.append(f"  {details}...")
    
    if relevant_context:
        return "\n--- FLORIDA PUBLIC ADJUSTING LAWS (fallback) ---" + "\n".join(relevant_context) + "\n--- END ---\n"
    return ""


# ============================================
# CLAIMS DATA ACCESS FOR EVE
# ============================================

async def extract_claim_reference(message: str) -> Optional[str]:
    """
    Extract claim number or ID from user message.
    Supports formats like: #12345, #CLM-12345, claim 12345, claim id xyz123, TEST-12345
    """
    patterns = [
        r'#([\w-]+)',                         # #12345 or #CLM-12345 or #TEST-12345
        r'claim\s*(?:#|number|id)?\s*[:\s]?\s*([\w-]+)',  # claim #123, claim number 123
        r'CLM[-_]?([\w-]+)',                   # CLM-12345 or CLM12345
        r'TEST[-_]?([\w-]+)',                  # TEST-12345 (common test format)
        r'(?:file|case)\s*(?:#|number)?\s*[:\s]?\s*([\w-]+)',  # file #123, case number 123
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            ref = match.group(1).strip()
            # If the pattern doesn't include prefix, add back common prefixes
            if pattern.startswith(r'#'):
                # Keep the full match as it may include prefix
                ref = match.group(1)
            return ref
    
    return None


def _user_can_access_claim(current_user: dict, claim: dict) -> bool:
    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return True
    if role == "client":
        user_email = (current_user.get("email") or "").strip().lower()
        claim_email = (claim.get("client_email") or "").strip().lower()
        return bool(user_email) and user_email == claim_email
    assigned_to = claim.get("assigned_to")
    assigned_to_id = claim.get("assigned_to_id")
    full_name = current_user.get("full_name")
    return (
        claim.get("created_by") == user_id
        or assigned_to_id == user_id
        or (full_name and assigned_to == full_name)
    )


def _claim_visibility_filter(current_user: dict) -> dict:
    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return {}
    if role == "client":
        user_email = (current_user.get("email") or "").strip()
        if not user_email:
            return {"client_email": "__no_match__"}
        return {"client_email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}}
    claim_filters = [{"created_by": user_id}, {"assigned_to_id": user_id}]
    full_name = current_user.get("full_name")
    if full_name:
        claim_filters.append({"assigned_to": full_name})
    return {"$or": claim_filters}


def _merge_claim_filters(*filters: dict) -> dict:
    valid = [flt for flt in filters if flt]
    if not valid:
        return {}
    if len(valid) == 1:
        return valid[0]
    return {"$and": valid}


async def fetch_claim_context(claim_ref: str, current_user: dict) -> Optional[dict]:
    """
    Fetch comprehensive claim data for Eve's context.
    Returns claim details, notes, documents summary, and recent activity.
    """
    try:
        # First try exact match on claim_number
        claim = await db.claims.find_one(
            {"claim_number": claim_ref},
            {"_id": 0}
        )
        
        # If not found, try case-insensitive search
        if not claim:
            claim = await db.claims.find_one(
                {"claim_number": {"$regex": f"^{re.escape(claim_ref)}$", "$options": "i"}},
                {"_id": 0}
            )
        
        # If still not found, try by id
        if not claim:
            claim = await db.claims.find_one(
                {"id": claim_ref},
                {"_id": 0}
            )
        
        # If still not found, try partial match as last resort
        if not claim:
            claim = await db.claims.find_one(
                {"claim_number": {"$regex": claim_ref, "$options": "i"}},
                {"_id": 0}
            )
        
        if not claim or not _user_can_access_claim(current_user, claim):
            return None
        
        claim_id = claim.get("id")
        
        # Fetch related notes
        notes = await db.notes.find(
            {"claim_id": claim_id},
            {"_id": 0, "content": 1, "created_at": 1, "created_by_name": 1, "category": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Fetch documents summary
        documents = await db.documents.find(
            {"claim_id": claim_id},
            {"_id": 0, "filename": 1, "doc_type": 1, "created_at": 1, "description": 1}
        ).sort("created_at", -1).limit(20).to_list(20)
        
        # Fetch recent communications
        comms = await db.communications.find(
            {"claim_id": claim_id},
            {"_id": 0, "type": 1, "direction": 1, "content": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Build context dictionary
        context = {
            "claim_id": claim_id,
            "claim_number": claim.get("claim_number", ""),
            "status": claim.get("status", ""),
            "type": claim.get("claim_type", ""),
            "client_name": claim.get("client_name", ""),
            "client_email": claim.get("client_email", ""),
            "client_phone": claim.get("client_phone", ""),
            "property_address": claim.get("property_address", ""),
            "loss_date": claim.get("loss_date", ""),
            "date_of_loss": claim.get("date_of_loss", ""),
            "carrier": claim.get("carrier", ""),
            "policy_number": claim.get("policy_number", ""),
            "adjuster_name": claim.get("adjuster_name", ""),
            "adjuster_phone": claim.get("adjuster_phone", ""),
            "adjuster_email": claim.get("adjuster_email", ""),
            "estimated_loss": claim.get("estimated_loss", ""),
            "settlement_amount": claim.get("settlement_amount", ""),
            "description": claim.get("description", ""),
            "notes_count": len(notes),
            "documents_count": len(documents),
            "recent_notes": notes[:5],
            "documents_summary": [
                {"filename": d.get("filename"), "type": d.get("doc_type")} 
                for d in documents[:10]
            ],
            "recent_communications": [
                {"type": c.get("type"), "direction": c.get("direction"), "preview": c.get("content", "")[:100]}
                for c in comms[:5]
            ]
        }
        
        return context
        
    except Exception as e:
        logger.error(f"Error fetching claim context: {e}")
        return None


async def get_user_claims_summary(user_id: str, limit: int = 10) -> List[dict]:
    """
    Get a summary of user's recent claims for context.
    """
    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "email": 1, "full_name": 1})
        if not user:
            return []

        user["id"] = user_id
        query = _claim_visibility_filter(user)

        claims = await db.claims.find(
            query,
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "carrier": 1}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return claims
    except Exception as e:
        logger.error(f"Error fetching claims summary: {e}")
        return []


def format_claim_context_for_prompt(context: dict) -> str:
    """
    Format claim context into a structured prompt section.
    """
    if not context:
        return ""
    
    lines = [
        "\n--- ACTIVE CLAIM CONTEXT ---",
        f"**Claim #{context.get('claim_number', 'N/A')}** - {context.get('status', 'Unknown Status')}",
        f"Client: {context.get('client_name', 'N/A')}",
        f"Property: {context.get('property_address', 'N/A')}",
        f"Loss Date: {context.get('loss_date') or context.get('date_of_loss', 'N/A')}",
        f"Carrier: {context.get('carrier', 'N/A')}",
        f"Policy #: {context.get('policy_number', 'N/A')}",
        f"Claim Type: {context.get('type', 'N/A')}",
    ]
    
    if context.get('adjuster_name'):
        lines.append(f"Carrier Adjuster: {context.get('adjuster_name')} | {context.get('adjuster_phone', '')} | {context.get('adjuster_email', '')}")
    
    if context.get('estimated_loss'):
        lines.append(f"Estimated Loss: ${context.get('estimated_loss')}")
    
    if context.get('settlement_amount'):
        lines.append(f"Settlement Amount: ${context.get('settlement_amount')}")
    
    if context.get('description'):
        lines.append(f"\nClaim Description: {context.get('description')[:500]}")
    
    # Add notes summary
    if context.get('recent_notes'):
        lines.append("\n**Recent Notes:**")
        for note in context['recent_notes'][:3]:
            content = note.get('content', '')[:200]
            by = note.get('created_by_name', 'Unknown')
            lines.append(f"  - [{by}]: {content}...")
    
    # Add documents summary
    if context.get('documents_summary'):
        doc_types = {}
        for doc in context['documents_summary']:
            dtype = doc.get('type', 'other')
            doc_types[dtype] = doc_types.get(dtype, 0) + 1
        lines.append(f"\n**Documents on File ({context.get('documents_count', 0)} total):**")
        for dtype, count in doc_types.items():
            lines.append(f"  - {dtype}: {count} files")
    
    # Add communications summary
    if context.get('recent_communications'):
        lines.append("\n**Recent Communications:**")
        for comm in context['recent_communications'][:3]:
            direction = "→" if comm.get('direction') == 'outbound' else "←"
            lines.append(f"  {direction} [{comm.get('type', 'message')}]: {comm.get('preview', '')[:80]}...")
    
    lines.append("--- END CLAIM CONTEXT ---\n")
    
    return "\n".join(lines)


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    claim_context: Optional[dict] = None  # Optional claim data for context
    claim_id: Optional[str] = None  # Direct claim ID reference
    provider: Optional[str] = None
    model: Optional[str] = None
    task_type: Optional[str] = "chat"


class ChatResponse(BaseModel):
    response: str
    session_id: str
    claim_context: Optional[dict] = None  # Return detected claim context


class ClaimCopilotAction(BaseModel):
    title: str
    rationale: str
    priority: str
    owner: str
    eta_hours: int


class ClaimEvidenceGap(BaseModel):
    code: str
    title: str
    severity: str
    rationale: str
    recommended_action: str
    cta: str


class ClaimCopilotResponse(BaseModel):
    claim_id: str
    claim_number: str
    provider: str
    model: str
    actions: List[ClaimCopilotAction]
    evidence_gaps: List[ClaimEvidenceGap] = []
    confidence: str


class CommsCopilotRequest(BaseModel):
    intent: Optional[str] = "status update"
    tone: Optional[str] = "professional"
    channel: Optional[str] = "sms"
    messages: Optional[List[dict]] = None


class CommsCopilotResponse(BaseModel):
    claim_id: str
    claim_number: str
    provider: str
    model: str
    summary: str
    next_action: str
    suggested_reply: str
    reply_options: List[str] = []
    thread_intent: str = "status_update"
    risk_level: str = "medium"
    risk_flags: List[str] = []
    confidence: str


class TeamCommsCopilotRequest(BaseModel):
    channel_id: str
    channel_name: Optional[str] = None
    channel_type: Optional[str] = "internal_public"
    mode: Optional[str] = "message"  # message | announcement
    intent: Optional[str] = "status update"
    tone: Optional[str] = "professional"
    recent_messages: Optional[List[dict]] = None


class TeamCommsCopilotResponse(BaseModel):
    provider: str
    model: str
    summary: str
    next_action: str
    suggested_body: str
    suggested_title: Optional[str] = None
    confidence: str


SUPPORTED_PROVIDERS = {"ollama", "openai", "anthropic"}

# Curated Ollama Cloud models — fast, capable, and free
OLLAMA_CLOUD_MODELS = [
    {"id": "deepseek-v3.2", "name": "DeepSeek V3.2", "size": "671B", "description": "Powerful reasoning model with chain-of-thought", "recommended": True},
    {"id": "gemma3:27b", "name": "Gemma 3 27B", "size": "27B", "description": "Google's balanced model — good quality, fast"},
    {"id": "gemma3:12b", "name": "Gemma 3 12B", "size": "12B", "description": "Fastest general-purpose model"},
    {"id": "qwen3.5:397b", "name": "Qwen 3.5", "size": "397B", "description": "Alibaba's latest large model"},
    {"id": "mistral-large-3:675b", "name": "Mistral Large 3", "size": "675B", "description": "Mistral's flagship model"},
    {"id": "deepseek-v3.1:671b", "name": "DeepSeek V3.1", "size": "671B", "description": "Previous DeepSeek version"},
    {"id": "gemma3:4b", "name": "Gemma 3 4B", "size": "4B", "description": "Ultra-fast lightweight model"},
    {"id": "ministral-3:8b", "name": "Ministral 3 8B", "size": "8B", "description": "Mistral's small efficient model"},
]

OLLAMA_MODEL_DEFAULT = get_ollama_model()
OPENAI_MODEL_DEFAULT = os.environ.get("OPENAI_MODEL", "gpt-4o")
ANTHROPIC_MODEL_DEFAULT = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
AI_DAILY_BUDGET_USD = float(os.environ.get("AI_DAILY_BUDGET_USD", "25"))
AI_COST_PER_1K_TOKENS = {
    "ollama": 0.0,  # Free
    "openai": float(os.environ.get("OPENAI_COST_PER_1K_TOKENS", "0.01")),
    "anthropic": float(os.environ.get("ANTHROPIC_COST_PER_1K_TOKENS", "0.012")),
}


def _task_budget_env_key(task_type: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", (task_type or "generic")).upper().strip("_")
    return f"AI_TASK_DAILY_BUDGET_USD_{normalized}"


def _get_task_daily_budget_usd(task_type: str) -> Optional[float]:
    raw = os.environ.get(_task_budget_env_key(task_type))
    if raw is None or str(raw).strip() == "":
        return None
    try:
        parsed = float(raw)
    except Exception:
        return None
    return parsed if parsed >= 0 else None


def _default_model_for_provider(provider: str, preferred_model: Optional[str] = None) -> str:
    if preferred_model:
        model = str(preferred_model).strip()
        return model or DEFAULT_OLLAMA_MODEL
    return {
        "ollama": OLLAMA_MODEL_DEFAULT,
        "openai": OPENAI_MODEL_DEFAULT,
        "anthropic": ANTHROPIC_MODEL_DEFAULT,
    }.get(provider, OLLAMA_MODEL_DEFAULT)


def _select_provider_and_model(
    task_type: str,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None,
    provider_order: Optional[List[str]] = None,
):
    # LOCKED TO OLLAMA — free tier only until OpenAI/Anthropic are paid for.
    # Once paid, remove this override and restore the provider selection logic below.
    return "ollama", OLLAMA_MODEL_DEFAULT

    # --- Original provider selection (disabled until paid tiers enabled) ---
    # provider = (preferred_provider or "").strip().lower()
    # if provider in SUPPORTED_PROVIDERS:
    #     return provider, _default_model_for_provider(provider, preferred_model)
    #
    # ordered_supported = [p for p in (provider_order or []) if p in SUPPORTED_PROVIDERS]
    # if ordered_supported:
    #     provider = ordered_supported[0]
    #     return provider, _default_model_for_provider(provider, preferred_model)
    #
    # return "ollama", OLLAMA_MODEL_DEFAULT


def _redact_prompt_text(text: str) -> str:
    if not text:
        return text
    redacted = text
    redacted = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', "[REDACTED_EMAIL]", redacted)
    redacted = re.sub(r'\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b', "[REDACTED_PHONE]", redacted)
    redacted = re.sub(r'\b[A-Z0-9]{6,}\b', lambda m: "[REDACTED_ID]" if any(ch.isdigit() for ch in m.group(0)) else m.group(0), redacted)
    return redacted


def _estimate_cost_usd(provider: str, prompt_text: str, response_text: str = "") -> float:
    approx_tokens = max(1, (len(prompt_text) + len(response_text)) // 4)
    cost_per_1k = AI_COST_PER_1K_TOKENS.get(provider, AI_COST_PER_1K_TOKENS["openai"])
    return round((approx_tokens / 1000.0) * cost_per_1k, 6)


async def _enforce_daily_budget(user_id: str, projected_cost_usd: float):
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.ai_usage_logs.find(
        {"user_id": user_id, "created_at": {"$gte": start_of_day}},
        {"_id": 0, "estimated_cost_usd": 1}
    )
    entries = await cursor.to_list(10000)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > AI_DAILY_BUDGET_USD:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI budget exceeded (${AI_DAILY_BUDGET_USD:.2f}). Try again tomorrow or reduce request size."
        )


async def _enforce_task_daily_budget(user_id: str, task_type: str, projected_cost_usd: float):
    task_limit = _get_task_daily_budget_usd(task_type)
    if task_limit is None:
        return
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.ai_usage_logs.find(
        {"user_id": user_id, "task_type": task_type, "created_at": {"$gte": start_of_day}},
        {"_id": 0, "estimated_cost_usd": 1}
    )
    entries = await cursor.to_list(10000)
    spent = sum(float(item.get("estimated_cost_usd", 0)) for item in entries)
    if spent + projected_cost_usd > task_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Task budget exceeded for '{task_type}' "
                f"(${task_limit:.2f}/day). Try again later or reduce request size."
            ),
        )


async def _log_ai_usage(user_id: str, task_type: str, provider: str, model: str, prompt_text: str, response_text: str, status: str = "success", error: Optional[str] = None):
    await db.ai_usage_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "task_type": task_type,
        "provider": provider,
        "model": model,
        "prompt_chars": len(prompt_text),
        "response_chars": len(response_text or ""),
        "estimated_cost_usd": _estimate_cost_usd(provider, prompt_text, response_text),
        "status": status,
        "error": error,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def _send_via_ai_gateway(*, user_id: str, session_key: str, system_message: str, prompt_text: str, task_type: str, preferred_provider: Optional[str] = None, preferred_model: Optional[str] = None):
    safe_prompt = _redact_prompt_text(prompt_text)
    runtime_cfg = await load_policy_runtime_routing_config(db)
    configured_order = runtime_cfg.get("task_provider_order", {}).get(task_type)
    resolved_order = sanitize_policy_provider_order(
        configured_order or resolve_policy_provider_order_for_task(task_type),
        default_order=resolve_policy_provider_order_for_task(task_type),
    )
    provider_order = [p for p in resolved_order if p in SUPPORTED_PROVIDERS]
    provider, model = _select_provider_and_model(
        task_type,
        preferred_provider,
        preferred_model,
        provider_order=provider_order,
    )
    fallback_enabled = bool(runtime_cfg.get("fallback_enabled", True))
    estimated_cost = _estimate_cost_usd(provider, safe_prompt, "")
    await _enforce_daily_budget(user_id, estimated_cost)
    await _enforce_task_daily_budget(user_id, task_type, estimated_cost)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_key,
            system_message=system_message
        ).with_model(provider, model)
        response_text = await chat.send_message(UserMessage(text=safe_prompt))
        await _log_ai_usage(
            user_id=user_id,
            task_type=task_type,
            provider=provider,
            model=model,
            prompt_text=safe_prompt,
            response_text=response_text
        )
        return response_text, provider, model
    except Exception as first_err:
        if not fallback_enabled or len(provider_order) < 2:
            await _log_ai_usage(
                user_id=user_id,
                task_type=task_type,
                provider=provider,
                model=model,
                prompt_text=safe_prompt,
                response_text="",
                status="error",
                error=str(first_err)
            )
            raise

        fallback_provider = provider_order[1]
        fallback_model = _default_model_for_provider(fallback_provider)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{session_key}-fallback",
            system_message=system_message
        ).with_model(fallback_provider, fallback_model)
        response_text = await chat.send_message(UserMessage(text=safe_prompt))
        await _log_ai_usage(
            user_id=user_id,
            task_type=task_type,
            provider=fallback_provider,
            model=fallback_model,
            prompt_text=safe_prompt,
            response_text=response_text,
            status="fallback",
            error=str(first_err)
        )
        return response_text, fallback_provider, fallback_model


def _build_copilot_fallback_actions(context: dict) -> List[dict]:
    actions = []
    documents_count = int(context.get("documents_count", 0) or 0)
    notes_count = int(context.get("notes_count", 0) or 0)
    status = str(context.get("status", "")).lower()

    if documents_count == 0:
        actions.append({
            "title": "Upload core claim documents",
            "rationale": "No claim documents are currently on file; demand and negotiation workflows will stall.",
            "priority": "critical",
            "owner": "adjuster",
            "eta_hours": 2
        })
    if notes_count < 2:
        actions.append({
            "title": "Add claim timeline notes",
            "rationale": "Limited notes reduce handoff quality and weaken carrier escalation records.",
            "priority": "high",
            "owner": "adjuster",
            "eta_hours": 1
        })
    if status in {"new", "intake", "under review"}:
        actions.append({
            "title": "Run client + carrier follow-up",
            "rationale": "Early communication compresses cycle time and reduces stale-claim risk.",
            "priority": "high",
            "owner": "comms",
            "eta_hours": 4
        })
    if not actions:
        actions.append({
            "title": "Prepare demand-ready packet",
            "rationale": "Claim appears healthy; package evidence and narrative for a stronger payout position.",
            "priority": "medium",
            "owner": "adjuster",
            "eta_hours": 6
        })
    return actions[:4]


def _derive_claim_evidence_gaps(context: dict) -> List[dict]:
    gaps: List[dict] = []
    documents_count = int(context.get("documents_count", 0) or 0)
    notes_count = int(context.get("notes_count", 0) or 0)

    policy_number = str(context.get("policy_number", "") or "").strip()
    loss_date = str(context.get("loss_date", "") or context.get("date_of_loss", "") or "").strip()
    property_address = str(context.get("property_address", "") or "").strip()
    carrier = str(context.get("carrier", "") or "").strip()
    client_email = str(context.get("client_email", "") or "").strip()
    client_phone = str(context.get("client_phone", "") or "").strip()

    if not policy_number:
        gaps.append({
            "code": "missing_policy_number",
            "title": "Policy number missing",
            "severity": "high",
            "rationale": "Coverage validation and carrier escalation quality drop without policy reference.",
            "recommended_action": "Update claim intake with policy number before next carrier touchpoint.",
            "cta": "edit_claim",
        })

    if not loss_date:
        gaps.append({
            "code": "missing_loss_date",
            "title": "Date of loss missing",
            "severity": "high",
            "rationale": "Timeline-sensitive deadlines and weather correlation checks depend on loss date.",
            "recommended_action": "Capture and save exact date of loss from insured or first notice.",
            "cta": "edit_claim",
        })

    if not property_address:
        gaps.append({
            "code": "missing_property_address",
            "title": "Property address missing",
            "severity": "medium",
            "rationale": "Weather verification, inspections, and legal notices require exact property address.",
            "recommended_action": "Populate property address in claim profile to unlock downstream workflows.",
            "cta": "edit_claim",
        })

    if not carrier:
        gaps.append({
            "code": "missing_carrier",
            "title": "Carrier information missing",
            "severity": "medium",
            "rationale": "Carrier-specific playbooks and communication templates cannot be applied reliably.",
            "recommended_action": "Set carrier on the claim before generating demand or escalation drafts.",
            "cta": "edit_claim",
        })

    if not client_email and not client_phone:
        gaps.append({
            "code": "missing_client_contact",
            "title": "Client contact details missing",
            "severity": "high",
            "rationale": "Client updates and document requests cannot be executed without contact channels.",
            "recommended_action": "Add at least one reachable contact channel (email or phone).",
            "cta": "edit_claim",
        })

    if documents_count <= 0:
        gaps.append({
            "code": "missing_documents",
            "title": "No supporting documents uploaded",
            "severity": "critical",
            "rationale": "Demand packages and supplement justifications require evidence artifacts.",
            "recommended_action": "Upload policy, estimate, and damage evidence documents.",
            "cta": "upload_documents",
        })

    if notes_count < 2:
        gaps.append({
            "code": "thin_claim_timeline",
            "title": "Timeline notes are thin",
            "severity": "medium",
            "rationale": "Weak timeline records increase handoff friction and reduce dispute defensibility.",
            "recommended_action": "Log recent milestones and next commitments in claim notes.",
            "cta": "add_note",
        })

    if documents_count > 0:
        doc_tokens = []
        for item in context.get("documents_summary", [])[:20]:
            token = f"{item.get('type', '')} {item.get('filename', '')}".strip().lower()
            if token:
                doc_tokens.append(token)
        doc_footprint = " ".join(doc_tokens)
        missing_doc_types = []
        if "policy" not in doc_footprint:
            missing_doc_types.append("policy")
        if "estimate" not in doc_footprint:
            missing_doc_types.append("estimate")
        if "photo" not in doc_footprint and "image" not in doc_footprint:
            missing_doc_types.append("photos")
        if missing_doc_types:
            gaps.append({
                "code": "document_mix_gaps",
                "title": "Evidence mix has gaps",
                "severity": "medium",
                "rationale": "Current uploads may be incomplete for negotiation-ready packaging.",
                "recommended_action": f"Add likely missing evidence types: {', '.join(missing_doc_types)}.",
                "cta": "upload_documents",
            })

    return gaps[:6]


def _derive_thread_intent(request: CommsCopilotRequest, recent_messages: List[dict]) -> str:
    explicit = str(request.intent or "").strip().lower()
    if explicit:
        return explicit.replace(" ", "_")
    corpus = " ".join([str(m.get("body", "")).lower() for m in recent_messages[-20:]])
    if any(token in corpus for token in ["docs", "document", "upload", "policy"]):
        return "document_collection"
    if any(token in corpus for token in ["payment", "money", "settlement", "offer"]):
        return "settlement_update"
    if any(token in corpus for token in ["call", "schedule", "appointment", "tomorrow"]):
        return "scheduling"
    return "status_update"


def _derive_comms_risk(context: dict, recent_messages: List[dict]) -> dict:
    flags: List[str] = []
    if not context.get("policy_number"):
        flags.append("Missing policy number in claim profile")
    if not context.get("loss_date") and not context.get("date_of_loss"):
        flags.append("Missing date of loss in claim profile")
    if int(context.get("documents_count", 0) or 0) <= 0:
        flags.append("No supporting documents uploaded")

    corpus = " ".join([str(m.get("body", "")).lower() for m in recent_messages[-20:]])
    legal_tokens = ["attorney", "lawsuit", "bad faith", "department of financial services", "complaint", "civil remedy"]
    urgency_tokens = ["urgent", "asap", "today", "immediately", "now"]
    if any(token in corpus for token in legal_tokens):
        flags.append("Possible legal escalation language in thread")
    if any(token in corpus for token in urgency_tokens):
        flags.append("High urgency language detected in recent messages")

    if any("legal escalation" in flag.lower() for flag in flags):
        risk_level = "high"
    elif len(flags) >= 3:
        risk_level = "high"
    elif len(flags) == 2:
        risk_level = "medium"
    elif len(flags) == 1:
        risk_level = "low"
    else:
        risk_level = "low"
    return {"risk_level": risk_level, "risk_flags": flags[:5]}


def _build_comms_copilot_fallback(context: dict, request: CommsCopilotRequest, recent_messages: List[dict]) -> dict:
    client_name = context.get("client_name") or "there"
    missing = []
    if not context.get("policy_number"):
        missing.append("policy number")
    if not context.get("loss_date") and not context.get("date_of_loss"):
        missing.append("date of loss")
    if int(context.get("documents_count", 0) or 0) <= 0:
        missing.append("supporting documents")

    summary = f"Claim {context.get('claim_number', '')} thread needs a concise progress update and next milestone confirmation."
    if missing:
        next_action = f"Request missing items ({', '.join(missing)}) and confirm expected delivery time."
        suggested_reply = (
            f"Hi {client_name}, quick update from Eden. To keep your claim moving, we still need: "
            f"{', '.join(missing)}. Please send these and we will advance to the next step today."
        )
        reply_options = [
            suggested_reply,
            f"Hi {client_name}, we are ready to advance your claim once we receive: {', '.join(missing)}. Please send what you have today.",
            f"Quick claim update: missing items are {', '.join(missing)}. Reply with availability and we will guide next steps."
        ]
    else:
        next_action = "Confirm claim timeline and next milestone in one short, confident message."
        suggested_reply = (
            f"Hi {client_name}, quick status update from Eden: your claim is actively progressing. "
            "Our next milestone is in motion, and we will send another update as soon as it posts."
        )
        reply_options = [
            suggested_reply,
            f"Hi {client_name}, your claim is moving forward. We are finalizing the next milestone and will update you again shortly.",
            f"Status update from Eden: file is active and on track. Please reply if you need anything reviewed before our next checkpoint."
        ]
    return {
        "summary": summary,
        "next_action": next_action,
        "suggested_reply": suggested_reply,
        "reply_options": reply_options,
        "thread_intent": _derive_thread_intent(request, recent_messages),
        **_derive_comms_risk(context, recent_messages),
        "confidence": "medium",
    }


def _build_team_comms_fallback(request: TeamCommsCopilotRequest) -> dict:
    base_summary = "Recent team channel activity indicates a need for clear ownership and next deadline."
    if request.mode == "announcement":
        return {
            "summary": base_summary,
            "next_action": "Post one concise announcement with owner and due time.",
            "suggested_title": "Ops Update",
            "suggested_body": "Team update: next milestone is in motion. Owner is assigned, and we expect completion by end of day. Reply in thread with blockers only.",
            "confidence": "medium",
        }
    return {
        "summary": base_summary,
        "next_action": "Send a short alignment message and request explicit acknowledgements.",
        "suggested_title": None,
        "suggested_body": "Quick sync: we are on track for the next milestone. Please confirm your assigned piece and flag blockers within the next 30 minutes.",
        "confidence": "medium",
    }


@router.get("/health")
async def ai_health_check(
    current_user: dict = Depends(get_current_active_user)
):
    """
    Diagnostic endpoint — tests AI provider connectivity and reports config status.
    Call this to troubleshoot 'AI not working' issues.
    """
    import httpx
    from services.ollama_config import validate_ollama_config

    ollama_cfg = validate_ollama_config()
    ollama_key = get_ollama_api_key()
    ollama_url = normalize_ollama_base_url(os.environ.get("OLLAMA_BASE_URL"))

    # Test Ollama Cloud connectivity
    ollama_status = {"configured": bool(ollama_key), **ollama_cfg}
    if ollama_key:
        try:
            headers = {"Authorization": f"Bearer {ollama_key}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(ollama_endpoint(ollama_url, "/api/tags"), headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    model_names = [m.get("name") for m in data.get("models", [])]
                    ollama_status["reachable"] = True
                    ollama_status["available_models"] = model_names[:20]
                    configured_model = get_ollama_model()
                    ollama_status["configured_model_available"] = configured_model in model_names
                else:
                    ollama_status["reachable"] = False
                    ollama_status["error"] = f"HTTP {resp.status_code}"
        except Exception as e:
            ollama_status["reachable"] = False
            ollama_status["error"] = str(e)[:200]
    else:
        ollama_status["reachable"] = False
        ollama_status["error"] = "OLLAMA_API_KEY not set. Get one at https://ollama.com/settings/keys"

    # Check Anthropic fallback
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_status = {
        "configured": bool(anthropic_key),
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
    }

    # Check OpenAI fallback
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    openai_status = {
        "configured": bool(openai_key),
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o"),
    }

    any_provider = bool(ollama_key or anthropic_key or openai_key)

    return {
        "service_ready": any_provider,
        "active_key_source": (
            "OLLAMA_API_KEY" if ollama_key
            else "ANTHROPIC_API_KEY" if anthropic_key
            else "OPENAI_API_KEY" if openai_key
            else "NONE — set OLLAMA_API_KEY (free) at https://ollama.com/settings/keys"
        ),
        "ollama": ollama_status,
        "anthropic": anthropic_status,
        "openai": openai_status,
        "instructions": (
            "All providers configured." if (ollama_key and anthropic_key) else
            "To enable AI: 1) Sign up at https://ollama.com  2) Create API key at https://ollama.com/settings/keys  3) Set OLLAMA_API_KEY env var on Render"
        ),
    }


@router.get("/models")
async def get_available_models(
    current_user: dict = Depends(get_current_active_user)
):
    """Get available AI models for Eve chat"""
    import httpx

    ollama_key = get_ollama_api_key()
    ollama_url = normalize_ollama_base_url(os.environ.get("OLLAMA_BASE_URL"))

    # Try to fetch live model list from Ollama Cloud
    live_models = []
    try:
        headers = {}
        if ollama_key:
            headers["Authorization"] = f"Bearer {ollama_key}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(ollama_endpoint(ollama_url, "/api/tags"), headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                live_ids = {m["name"] for m in data.get("models", [])}
                # Filter curated list to only models actually available
                live_models = [m for m in OLLAMA_CLOUD_MODELS if m["id"] in live_ids]
    except Exception:
        pass

    models = live_models or OLLAMA_CLOUD_MODELS
    return {
        "default_model": OLLAMA_MODEL_DEFAULT,
        "provider": "ollama",
        "models": models,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat_with_eve(
    request: ChatRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Send a message to Eve AI and get a response"""
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(
            status_code=500,
            detail="No AI provider configured. Set OLLAMA_API_KEY (free — get one at https://ollama.com/settings/keys) or ANTHROPIC_API_KEY in your environment variables."
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
                    logger.info(f"Eve auto-detected claim reference: {claim_ref}")
        
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


@router.post("/claims/{claim_id}/copilot-next-actions", response_model=ClaimCopilotResponse)
async def claim_copilot_next_actions(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate prioritized claim next actions from claim context."""
    user_id = current_user.get("id")
    context = await fetch_claim_context(claim_id, current_user)
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")

    prompt = (
        "You are a claims operations copilot for Florida public adjusters.\n"
        "Return ONLY valid JSON with this shape:\n"
        "{\"confidence\":\"high|medium|low\",\"actions\":[{\"title\":\"...\",\"rationale\":\"...\",\"priority\":\"critical|high|medium|low\",\"owner\":\"adjuster|comms|ops\",\"eta_hours\":number}],\"evidence_gaps\":[{\"code\":\"...\",\"title\":\"...\",\"severity\":\"critical|high|medium|low\",\"rationale\":\"...\",\"recommended_action\":\"...\",\"cta\":\"edit_claim|upload_documents|add_note|request_client_docs\"}]}\n"
        "Rules: max 4 actions, concrete and execution-focused, no markdown.\n\n"
        f"Claim context:\n{json.dumps(context, default=str)}"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"claims-copilot-{user_id}-{claim_id}",
            system_message="You produce concise operations plans for active insurance claims.",
            prompt_text=prompt,
            task_type="claims_copilot"
        )
        parsed = json.loads(ai_text)
        actions = parsed.get("actions") or []
        evidence_gaps = parsed.get("evidence_gaps") or []
        normalized = []
        for action in actions[:4]:
            normalized.append(ClaimCopilotAction(
                title=str(action.get("title", "Untitled action")),
                rationale=str(action.get("rationale", "")),
                priority=str(action.get("priority", "medium")).lower(),
                owner=str(action.get("owner", "adjuster")).lower(),
                eta_hours=max(1, int(action.get("eta_hours", 4)))
            ))
        normalized_gaps = []
        for gap in evidence_gaps[:6]:
            normalized_gaps.append(ClaimEvidenceGap(
                code=str(gap.get("code", "unspecified_gap")).strip() or "unspecified_gap",
                title=str(gap.get("title", "Unspecified evidence gap")),
                severity=str(gap.get("severity", "medium")).lower(),
                rationale=str(gap.get("rationale", "")),
                recommended_action=str(gap.get("recommended_action", "")),
                cta=str(gap.get("cta", "edit_claim")).lower(),
            ))
        if not normalized:
            raise ValueError("No actions returned by model")
        if not normalized_gaps:
            normalized_gaps = [ClaimEvidenceGap(**item) for item in _derive_claim_evidence_gaps(context)]
        confidence = str(parsed.get("confidence", "medium")).lower()
        return ClaimCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider=provider,
            model=model,
            actions=normalized,
            evidence_gaps=normalized_gaps,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium"
        )
    except Exception as err:
        logger.warning(f"Claim copilot fallback for {claim_id}: {err}")
        fallback_actions = [ClaimCopilotAction(**item) for item in _build_copilot_fallback_actions(context)]
        fallback_gaps = [ClaimEvidenceGap(**item) for item in _derive_claim_evidence_gaps(context)]
        return ClaimCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider="fallback",
            model="heuristic",
            actions=fallback_actions,
            evidence_gaps=fallback_gaps,
            confidence="medium"
        )


@router.post("/claims/{claim_id}/comms-copilot", response_model=CommsCopilotResponse)
async def claim_comms_copilot(
    claim_id: str,
    request: CommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate communications summary + next-best action + suggested reply for claim thread."""
    user_id = current_user.get("id")
    context = await fetch_claim_context(claim_id, current_user)
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")

    recent_messages = request.messages or context.get("recent_communications") or []
    prompt = (
        "You are a claim communications copilot for a Florida public adjusting team.\n"
        "Return ONLY valid JSON with keys: summary, next_action, suggested_reply, reply_options, thread_intent, risk_level, risk_flags, confidence.\n"
        "Constraints:\n"
        "- summary: <= 2 sentences\n"
        "- next_action: one concrete operator step\n"
        "- suggested_reply: one SMS-style message <= 320 chars\n"
        "- reply_options: array of exactly 3 distinct SMS-style options <= 320 chars each\n"
        "- thread_intent: snake_case string like status_update, document_collection, scheduling, settlement_update\n"
        "- risk_level: low|medium|high\n"
        "- risk_flags: array of short operator-facing warnings\n"
        "- confidence: high|medium|low\n"
        "- no markdown\n\n"
        f"Intent: {request.intent or 'status update'}\n"
        f"Tone: {request.tone or 'professional'}\n"
        f"Channel: {request.channel or 'sms'}\n"
        f"Claim context: {json.dumps(context, default=str)}\n"
        f"Recent messages: {json.dumps(recent_messages[-20:], default=str)}\n"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"comms-copilot-{user_id}-{claim_id}",
            system_message="You produce concise, compliant claim communications guidance.",
            prompt_text=prompt,
            task_type="comms_copilot"
        )
        parsed = json.loads(ai_text)
        summary = str(parsed.get("summary", "")).strip()
        next_action = str(parsed.get("next_action", "")).strip()
        suggested_reply = str(parsed.get("suggested_reply", "")).strip()
        reply_options_raw = parsed.get("reply_options") or []
        normalized_options: List[str] = []
        if isinstance(reply_options_raw, list):
            for item in reply_options_raw:
                text = str(item or "").strip()
                if text and text not in normalized_options:
                    normalized_options.append(text[:320])
        if suggested_reply and suggested_reply not in normalized_options:
            normalized_options.insert(0, suggested_reply[:320])
        normalized_options = normalized_options[:3]
        thread_intent = str(parsed.get("thread_intent", "")).strip().lower().replace(" ", "_")
        risk_level = str(parsed.get("risk_level", "")).strip().lower()
        raw_flags = parsed.get("risk_flags") or []
        risk_flags: List[str] = []
        if isinstance(raw_flags, list):
            for item in raw_flags:
                text = str(item or "").strip()
                if text and text not in risk_flags:
                    risk_flags.append(text[:160])
        if not thread_intent:
            thread_intent = _derive_thread_intent(request, recent_messages)
        if risk_level not in {"low", "medium", "high"}:
            risk_level = _derive_comms_risk(context, recent_messages)["risk_level"]
        if not risk_flags:
            risk_flags = _derive_comms_risk(context, recent_messages)["risk_flags"]
        confidence = str(parsed.get("confidence", "medium")).lower().strip()

        if not summary or not next_action or not suggested_reply:
            raise ValueError("Incomplete comms copilot response")
        if not normalized_options:
            raise ValueError("Comms copilot reply options missing")

        return CommsCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider=provider,
            model=model,
            summary=summary,
            next_action=next_action,
            suggested_reply=suggested_reply,
            reply_options=normalized_options,
            thread_intent=thread_intent,
            risk_level=risk_level,
            risk_flags=risk_flags,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium",
        )
    except Exception as err:
        logger.warning(f"Comms copilot fallback for {claim_id}: {err}")
        fallback = _build_comms_copilot_fallback(context, request, recent_messages)
        return CommsCopilotResponse(
            claim_id=context.get("claim_id", claim_id),
            claim_number=context.get("claim_number", claim_id),
            provider="fallback",
            model="heuristic",
            summary=fallback["summary"],
            next_action=fallback["next_action"],
            suggested_reply=fallback["suggested_reply"],
            reply_options=fallback.get("reply_options", []),
            thread_intent=fallback.get("thread_intent", "status_update"),
            risk_level=fallback.get("risk_level", "medium"),
            risk_flags=fallback.get("risk_flags", []),
            confidence=fallback["confidence"],
        )


@router.post("/comms/team-copilot", response_model=TeamCommsCopilotResponse)
async def team_comms_copilot(
    request: TeamCommsCopilotRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate team-channel comms summary + action + draft for message/announcement mode."""
    user_id = current_user.get("id")
    role = current_user.get("role", "")
    if role not in {"admin", "manager", "adjuster"}:
        raise HTTPException(status_code=403, detail="Insufficient role for team comms copilot")

    recent = (request.recent_messages or [])[-30:]
    prompt = (
        "You are a concise operations communications copilot for an insurance claims team.\n"
        "Return ONLY valid JSON with keys: summary, next_action, suggested_body, suggested_title, confidence.\n"
        "Rules:\n"
        "- summary <= 2 sentences\n"
        "- next_action is one concrete operator step\n"
        "- suggested_body <= 500 chars\n"
        "- suggested_title required only for announcement mode, otherwise empty\n"
        "- confidence: high|medium|low\n"
        "- no markdown\n\n"
        f"Channel name: {request.channel_name or 'Unknown'}\n"
        f"Channel type: {request.channel_type or 'internal_public'}\n"
        f"Mode: {request.mode or 'message'}\n"
        f"Intent: {request.intent or 'status update'}\n"
        f"Tone: {request.tone or 'professional'}\n"
        f"Recent messages: {json.dumps(recent, default=str)}\n"
    )

    try:
        ai_text, provider, model = await _send_via_ai_gateway(
            user_id=user_id,
            session_key=f"team-comms-copilot-{user_id}-{request.channel_id}",
            system_message="You draft high-signal internal team communications.",
            prompt_text=prompt,
            task_type="team_comms_copilot"
        )
        parsed = json.loads(ai_text)
        summary = str(parsed.get("summary", "")).strip()
        next_action = str(parsed.get("next_action", "")).strip()
        suggested_body = str(parsed.get("suggested_body", "")).strip()
        suggested_title = parsed.get("suggested_title")
        suggested_title = str(suggested_title).strip() if suggested_title is not None else None
        confidence = str(parsed.get("confidence", "medium")).lower().strip()
        if not summary or not next_action or not suggested_body:
            raise ValueError("Incomplete team comms copilot response")
        return TeamCommsCopilotResponse(
            provider=provider,
            model=model,
            summary=summary,
            next_action=next_action,
            suggested_body=suggested_body,
            suggested_title=suggested_title if request.mode == "announcement" else None,
            confidence=confidence if confidence in {"high", "medium", "low"} else "medium",
        )
    except Exception as err:
        logger.warning(f"Team comms copilot fallback for {request.channel_id}: {err}")
        fallback = _build_team_comms_fallback(request)
        return TeamCommsCopilotResponse(
            provider="fallback",
            model="heuristic",
            summary=fallback["summary"],
            next_action=fallback["next_action"],
            suggested_body=fallback["suggested_body"],
            suggested_title=fallback["suggested_title"] if request.mode == "announcement" else None,
            confidence=fallback["confidence"],
        )


@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all chat sessions for the current user"""
    user_id = current_user.get("id")
    
    sessions = await db.ai_sessions.find(
        {"user_id": user_id},
        {"_id": 0, "session_id": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)
    
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific chat session with all messages"""
    user_id = current_user.get("id")
    
    session = await db.ai_sessions.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a chat session"""
    user_id = current_user.get("id")
    
    result = await db.ai_sessions.delete_one({
        "session_id": session_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}


@router.post("/sessions/new")
async def create_new_session(
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new chat session"""
    session_id = str(uuid.uuid4())
    
    return {"session_id": session_id}



@router.get("/claims-for-context")
async def get_claims_for_context(
    current_user: dict = Depends(get_current_active_user),
    search: Optional[str] = None,
    limit: int = 20
):
    """
    Get a list of claims that can be linked to Eve conversations.
    Used by frontend to show claim selector.
    """
    try:
        visibility_query = _claim_visibility_filter(current_user)
        search_query = {}
        safe_limit = max(1, min(limit, 100))
        
        # If search provided, filter by claim number or client name
        if search:
            search_query = {
                "$or": [
                    {"claim_number": {"$regex": search, "$options": "i"}},
                    {"client_name": {"$regex": search, "$options": "i"}},
                    {"property_address": {"$regex": search, "$options": "i"}}
                ]
            }

        query = _merge_claim_filters(visibility_query, search_query)
        
        claims = await db.claims.find(
            query,
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "carrier": 1, "property_address": 1}
        ).sort("updated_at", -1).limit(safe_limit).to_list(safe_limit)
        
        return {"claims": claims}
        
    except Exception as e:
        logger.error(f"Error fetching claims for context: {e}")
        return {"claims": []}


@router.get("/claim-context/{claim_id}")
async def get_claim_context_for_eve(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get full claim context for Eve.
    Returns claim details, notes, documents summary.
    """
    context = await fetch_claim_context(claim_id, current_user)
    
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    return context


# Document upload for Eve AI analysis
from fastapi import UploadFile, File as FastAPIFile
import io

@router.post("/upload-document")
async def upload_document_for_eve(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Upload a document for Eve to analyze.
    Supports: PDF, images (JPG, PNG, WEBP), Word docs, and text files.
    Returns document ID and extracted text if possible.
    """
    user_id = current_user.get("id")
    
    # Validate file type
    allowed_types = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/webp',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    content_type = file.content_type
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    
    # Read file content
    file_content = await file.read()
    
    # Check file size (max 10MB)
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    
    # Generate document ID
    document_id = str(uuid.uuid4())
    
    # Extract text based on file type (basic implementation)
    extracted_text = None
    try:
        if content_type == 'text/plain':
            extracted_text = file_content.decode('utf-8')
        elif content_type == 'application/pdf':
            # For PDFs, we'll store a note that it was uploaded
            # Full PDF parsing would require additional libraries
            extracted_text = f"[PDF document uploaded: {file.filename}]"
        elif content_type.startswith('image/'):
            extracted_text = f"[Image uploaded: {file.filename}]"
        else:
            extracted_text = f"[Document uploaded: {file.filename}]"
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        extracted_text = f"[Document uploaded: {file.filename}]"
    
    # Store document metadata in database
    doc_record = {
        "id": document_id,
        "user_id": user_id,
        "filename": file.filename,
        "content_type": content_type,
        "size": len(file_content),
        "extracted_text": extracted_text,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.eve_documents.insert_one(doc_record)
    
    return {
        "document_id": document_id,
        "filename": file.filename,
        "extracted_text": extracted_text,
        "message": f"Document '{file.filename}' uploaded successfully. Agent Eve is ready to analyze it."
    }
