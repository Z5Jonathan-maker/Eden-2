"""Static prompts, knowledge-base context, and model configuration constants."""

import os
import re
from typing import Optional, List

from services.ollama_config import (
    DEFAULT_OLLAMA_MODEL,
    get_ollama_api_key,
    get_ollama_model,
    normalize_ollama_base_url,
    ollama_endpoint,
)

# ---------------------------------------------------------------------------
# LLM API key — prefer Ollama (free), fall back to legacy key or OpenAI
# ---------------------------------------------------------------------------
EMERGENT_LLM_KEY = (
    get_ollama_api_key()
    or os.environ.get("EMERGENT_LLM_KEY")
    or os.environ.get("OPENAI_API_KEY")
    or os.environ.get("ANTHROPIC_API_KEY")
)

# ---------------------------------------------------------------------------
# FIRM CONTEXT — Static knowledge base (Gamma DISABLED)
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Eve's system prompt — expert in property claims
# ---------------------------------------------------------------------------
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
   - Include the citation: "\u00a7[section], [year] Fla. Stat."

GUARDRAILS:
- If a statute is NOT in your provided context, say: "I don't have \u00a7[X] in my verified database."
- NEVER fabricate or guess statute language
- When unsure about a claim detail, ask the user to clarify

Be concise but comprehensive. Use markdown formatting for readability."""


# ---------------------------------------------------------------------------
# Provider / model constants
# ---------------------------------------------------------------------------
SUPPORTED_PROVIDERS = {"ollama", "openai", "anthropic"}

OLLAMA_CLOUD_MODELS = [
    {"id": "deepseek-v3.2", "name": "DeepSeek V3.2", "size": "671B", "description": "Powerful reasoning model with chain-of-thought", "recommended": True},
    {"id": "gemma3:27b", "name": "Gemma 3 27B", "size": "27B", "description": "Google's balanced model \u2014 good quality, fast"},
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
