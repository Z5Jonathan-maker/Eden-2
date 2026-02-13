"""
Eve AI Retrieval Layer

Provides unified knowledge retrieval for the Eve AI assistant:
- Florida Statutes
- Industry Experts
- Firm Documentation (Notion)

Usage:
    context = await get_eve_context(query, user)
    # context includes relevant statutes, expert insights, and docs
"""

from typing import Optional, List, Dict, Any
from dependencies import db
import re
import logging

logger = logging.getLogger(__name__)

# ============================================
# RETRIEVAL FUNCTIONS
# ============================================

async def search_statutes(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Search Florida statutes for relevant sections.
    Returns verbatim text when available.
    """
    statutes = []
    
    try:
        # Extract any section numbers from query (e.g., "626.854")
        section_pattern = r'\b(62[67]\.\d+)\b'
        section_matches = re.findall(section_pattern, query)
        
        # Direct lookup if section number mentioned
        if section_matches:
            for section in section_matches[:limit]:
                statute = await db.statutes.find_one(
                    {"section_number": section},
                    {"_id": 0}
                )
                if statute:
                    statutes.append(statute)
        
        # If no direct matches, do text search
        if not statutes:
            # Search by keywords
            keywords = query.lower().split()
            relevant_keywords = [
                w for w in keywords 
                if len(w) > 3 and w not in ['what', 'does', 'the', 'about', 'tell']
            ]
            
            if relevant_keywords:
                # Search in heading and body
                search_query = {
                    "$or": [
                        {"heading": {"$regex": "|".join(relevant_keywords), "$options": "i"}},
                        {"body_text": {"$regex": "|".join(relevant_keywords[:3]), "$options": "i"}}
                    ]
                }
                cursor = db.statutes.find(search_query, {"_id": 0}).limit(limit)
                statutes = await cursor.to_list(limit)
    
    except Exception as e:
        logger.error(f"Statute search error: {e}")
    
    return statutes


async def get_expert_insights(topic: str, limit: int = 2) -> List[Dict[str, Any]]:
    """
    Get relevant expert insights for a topic.
    """
    experts = []
    
    try:
        # Map topics to experts
        topic_lower = topic.lower()
        
        expert_mapping = {
            "roof": ["john-senac"],
            "roofing": ["john-senac"],
            "shingle": ["john-senac"],
            "claim strategy": ["matthew-mulholland"],
            "prove it": ["matthew-mulholland"],
            "bad faith": ["chip-merlin"],
            "policy": ["bill-wilson"],
            "coverage": ["bill-wilson"],
            "appraisal": ["john-voelpel"],
            "florida": ["vince-perri"],
            "leadership": ["simon-sinek", "jocko-willink"],
            "ai": ["lynette-young"],
            "technology": ["lynette-young"]
        }
        
        # Find matching experts
        matched_expert_ids = set()
        for keyword, expert_ids in expert_mapping.items():
            if keyword in topic_lower:
                matched_expert_ids.update(expert_ids)
        
        # Fetch expert data
        if matched_expert_ids:
            cursor = db.experts.find(
                {"id": {"$in": list(matched_expert_ids)}},
                {"_id": 0}
            ).limit(limit)
            experts = await cursor.to_list(limit)
        
        # If no matches, return top 2 general experts
        if not experts:
            cursor = db.experts.find({}, {"_id": 0}).limit(limit)
            experts = await cursor.to_list(limit)
    
    except Exception as e:
        logger.error(f"Expert search error: {e}")
    
    return experts


async def get_notion_context(query: str, user: dict) -> Optional[str]:
    """
    Get relevant context from connected Notion workspace.
    Returns None if Notion not connected.
    """
    try:
        # Check if user has Notion connected
        user_id = user.get("id")
        settings = await db.oauth_connections.find_one({
            "user_id": user_id,
            "provider": "notion"
        })
        
        if not settings or not settings.get("is_connected"):
            return None
        
        # TODO: Implement actual Notion search
        # For now, return placeholder
        return None
    
    except Exception as e:
        logger.error(f"Notion context error: {e}")
        return None


# ============================================
# MAIN RETRIEVAL FUNCTION
# ============================================

async def get_eve_context(
    query: str,
    user: Optional[dict] = None,
    include_statutes: bool = True,
    include_experts: bool = True,
    include_notion: bool = True,
    max_statutes: int = 3,
    max_experts: int = 2
) -> Dict[str, Any]:
    """
    Get all relevant context for an Eve query.
    
    Returns:
        {
            "statutes": [...],
            "experts": [...],
            "notion_context": "...",
            "mode": "quote" | "explain",
            "summary": "..."
        }
    """
    context = {
        "statutes": [],
        "experts": [],
        "notion_context": None,
        "mode": "explain",
        "summary": ""
    }
    
    # Determine if user wants exact quotes
    quote_indicators = ["verbatim", "exact", "quote", "word for word", "says exactly"]
    if any(ind in query.lower() for ind in quote_indicators):
        context["mode"] = "quote"
    
    # Gather context in parallel
    if include_statutes:
        context["statutes"] = await search_statutes(query, max_statutes)
    
    if include_experts:
        context["experts"] = await get_expert_insights(query, max_experts)
    
    if include_notion and user:
        context["notion_context"] = await get_notion_context(query, user)
    
    # Build summary
    parts = []
    if context["statutes"]:
        statute_sections = [s.get("section_number", "?") for s in context["statutes"]]
        parts.append(f"Found {len(context['statutes'])} relevant statutes: {', '.join(statute_sections)}")
    
    if context["experts"]:
        expert_names = [e.get("name", "?") for e in context["experts"]]
        parts.append(f"Insights from: {', '.join(expert_names)}")
    
    if context["notion_context"]:
        parts.append("Firm documentation available")
    
    context["summary"] = "; ".join(parts) if parts else "No specific knowledge base matches"
    
    return context


def format_statute_for_prompt(statute: Dict[str, Any], mode: str = "explain") -> str:
    """
    Format a statute for inclusion in Eve's prompt.
    """
    section = statute.get("section_number", "Unknown")
    heading = statute.get("heading", "")
    body = statute.get("body_text", "")
    source = statute.get("source_url", "")
    
    if mode == "quote":
        # Return verbatim text
        return f"""
**Florida Statute {section}: {heading}**
Source: {source}

VERBATIM TEXT:
{body}
"""
    else:
        # Return summarizable text
        # Truncate if too long
        max_body = 1500
        if len(body) > max_body:
            body = body[:max_body] + "... [truncated]"
        
        return f"""
**Florida Statute {section}: {heading}**
{body}
"""


def format_expert_for_prompt(expert: Dict[str, Any]) -> str:
    """
    Format an expert profile for inclusion in Eve's prompt.
    """
    name = expert.get("name", "Unknown")
    specialty = expert.get("specialty", "")
    insights = expert.get("key_insights", [])
    
    insights_text = "\n".join([f"- {i}" for i in insights[:5]])
    
    return f"""
**{name}** - {specialty}
Key Insights:
{insights_text}
"""


def build_eve_system_context(context: Dict[str, Any]) -> str:
    """
    Build the knowledge context section for Eve's system prompt.
    """
    parts = []
    
    # Add statute context
    if context.get("statutes"):
        parts.append("## RELEVANT FLORIDA STATUTES\n")
        for statute in context["statutes"]:
            parts.append(format_statute_for_prompt(statute, context.get("mode", "explain")))
    
    # Add expert context
    if context.get("experts"):
        parts.append("\n## EXPERT INSIGHTS\n")
        for expert in context["experts"]:
            parts.append(format_expert_for_prompt(expert))
    
    # Add Notion context
    if context.get("notion_context"):
        parts.append("\n## FIRM DOCUMENTATION\n")
        parts.append(context["notion_context"])
    
    # Add mode instruction
    if context.get("mode") == "quote":
        parts.append("\n**IMPORTANT**: The user requested verbatim/exact text. Quote statutes exactly as written.")
    
    return "\n".join(parts)


# ============================================
# INTERACTION LOGGING
# ============================================

async def log_eve_interaction(
    user_id: str,
    session_id: str,
    query: str,
    context_summary: str,
    response: str,
    feedback: Optional[str] = None
) -> str:
    """
    Log an Eve interaction for quality tracking.
    """
    from datetime import datetime, timezone
    import uuid
    
    log_id = str(uuid.uuid4())
    
    log_entry = {
        "id": log_id,
        "user_id": user_id,
        "session_id": session_id,
        "query": query[:500],  # Truncate for storage
        "context_summary": context_summary,
        "response_length": len(response),
        "feedback": feedback,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        await db.eve_logs.insert_one(log_entry)
    except Exception as e:
        logger.error(f"Failed to log Eve interaction: {e}")
    
    return log_id


async def submit_eve_feedback(
    log_id: str,
    feedback: str  # "positive" or "negative"
) -> bool:
    """
    Submit feedback for an Eve interaction.
    """
    try:
        result = await db.eve_logs.update_one(
            {"id": log_id},
            {"$set": {"feedback": feedback}}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Failed to save Eve feedback: {e}")
        return False


# ============================================
# EXPORT
# ============================================

__all__ = [
    'search_statutes',
    'get_expert_insights',
    'get_notion_context',
    'get_eve_context',
    'format_statute_for_prompt',
    'format_expert_for_prompt',
    'build_eve_system_context',
    'log_eve_interaction',
    'submit_eve_feedback'
]
