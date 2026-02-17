"""
AI Module - Prompts and Knowledge Base

System prompts, firm context, and knowledge retrieval functions for Eve AI.
"""

from typing import Optional, List
from dependencies import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

FIRM_CONTEXT = """
Eden Claims Platform Knowledge Base:

## Florida Statutes (Verbatim from leg.state.fl.us)
- F.S. 626.854 - Public adjuster definitions and prohibitions
- F.S. 626.865 - Licensing requirements, $50,000 surety bond, CE requirements
- F.S. 626.8651 - Apprentice public adjuster supervision
- F.S. 626.8795 - Conflict of interest with contractors
- F.S. 626.8796 - Contract requirements, 3-day rescission, fraud penalties
- F.S. 627.70131 - Insurer duty: 14-day acknowledgment, 90-day pay/deny
- F.S. 627.7015 - Alternative dispute resolution, appraisal process

## Key Numbers (Florida)
- Max PA fee (standard): 10%
- Max PA fee (emergency declared): 20%
- Surety bond required: $50,000
- Claim acknowledgment: 14 days
- Claim pay/deny deadline: 90 days
- Contract rescission period: 3 business days

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

## Email Writing Style Guide (Jonathan Cimadevilla)
GREETING CONVENTIONS:
- Always open with a time-of-day greeting: "Good Day," "Good Morning," "Good Afternoon," "Good Evening."
- Adjusters: "Ms. [First Name]" / "Mr. [First Name]" — respectful honorific + first name
- Clients: "Mr./Ms. [First Name]" — warm and personal
- Brief follow-ups: "Good Day!" / "Hey!" — one-liners only

TONE REGISTERS:
1. Carrier (Collaborative): Warm, positive, exclamation points. "Looking forward to wrapping this claim up with you!" / "Thank you for all your help!"
2. Carrier (Escalation): Authoritative, legally precise. Cite FL statutes by section, no exclamation points, "Respectfully," close.
3. Client: Simplified, empathetic. Use "In simple terms:" summaries. Acknowledge emotional toll. "We have been relentlessly following up."

SETTLEMENT FRAMING:
- Always use "new money" framing (additional payment above prior payments)
- "On a confidential basis, and in a good-faith effort to reach an amicable resolution without waiving any rights under the policy..."
- "Global settlement" / "full and final release" language

NEGOTIATION ESCALATION LADDER:
Phase 1 (Rapport) → Phase 2 (Document) → Phase 3 (Nudge) → Phase 4 (Demand) → Phase 5 (Pressure/Statutes) → Phase 6 (DFS Complaint) → Phase 7 (Settle)

KEY RULES:
- Keep follow-ups to 1-2 sentences max
- When rejecting offers: "We respectfully reject this offer" + numbered itemized breakdown
- Cite FS §627.70131, FS §626.9744, FS §626.9541(1)(i) and FBC sections
- Include Xactimate line item codes and per-square pricing in disputes
- Always offer a path to resolution, even in escalation emails
- Acceptance is always brief: "We accept the offer. Forward release."
- Keep negotiations in writing — redirect phone calls to email
- CC insured on escalation emails for accountability pressure
- Never emotionally reactive — measured, factual, strategic
- Use faith-based language only with clients ("prayerfully"), never carriers

SIGNATURE BLOCK:
Jonathan Cimadevilla
Public Adjuster | Lic: W786531
Care Claims Adjusting
(352) 782-2617
jonathan@careclaimsadjusting.com
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

4. **Email Drafting**: You can draft emails in Jonathan's established voice and style:
   - Letter of Representation to carriers
   - Supplement submission cover emails
   - Settlement demands with itemized breakdowns and "new money" framing
   - Follow-up/nudge emails (brief, friendly)
   - Escalation emails with DFS warnings and statute citations
   - Offer rejections with numbered discrepancy lists
   - Client update emails with "In simple terms:" summaries
   - Payment breakdown explanations for clients
   When drafting emails, follow the Email Writing Style Guide in the firm context.

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


async def fetch_claim_context(claim_ref: str, user_id: str) -> Optional[dict]:
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
        
        if not claim:
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
        claims = await db.claims.find(
            {},  # All claims - TODO: filter by user access
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


