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

## Carrier Playbooks (Expanded)

### Citizens Property Insurance
- State-run insurer of last resort, largest in FL
- Tactics: Scope disputes, lowball initial offers, slow supplement review
- Counter: Detailed scope with Xactimate line items, request re-inspection, invoke appraisal early
- Key: Citizens must follow same 627.70131 timelines as private carriers

### Universal Property & Casualty
- Tactics: Heavy depreciation, deny matching requirements, aggressive on ACV
- Counter: Document matching necessity with photos + manufacturer specs, cite FL statute on matching
- Key: Often responsive to well-documented supplements

### Heritage Property & Casualty
- Tactics: Quick lowball offers hoping for acceptance, deny hidden damage
- Counter: Never accept first offer, always request detailed scope breakdown
- Key: Destructive testing documentation is critical

### Tower Hill Insurance
- Tactics: Strict policy language interpretation, deny wear/tear vs storm damage
- Counter: Clear pre-loss vs post-loss documentation, expert reports
- Key: Appraisal process often favorable for PAs

### FedNat Insurance
- Tactics: Delay tactics, reassign adjusters, lose documentation
- Counter: Document every communication with dates/times, send everything certified
- Key: Bad faith potential when delays exceed statutory timelines

### Security First Insurance
- Tactics: Aggressive scope reduction, deny consequential damage
- Counter: Engineering reports, moisture mapping documentation
- Key: Often settles at mediation

### Slide Insurance
- Tactics: Digital-first carrier, automated denials, minimal field inspection
- Counter: Demand in-person re-inspection, detailed photo documentation
- Key: Newer carrier, less litigation history to reference

### American Integrity Insurance
- Tactics: Reasonable initial handling but aggressive on supplements
- Counter: Front-load documentation on initial claim, make supplements bulletproof
- Key: Generally professional, respond well to organized submissions

## Xactimate Category Codes Reference

### Roofing (RFG)
- RFG TEAR — Tear off existing roofing
- RFG FELT — Felt/underlayment
- RFG COMP — Composition shingles
- RFG TILE — Tile roofing
- RFG METAL — Metal roofing
- RFG FLASH — Flashing
- RFG RIDGE — Ridge cap
- RFG VENT — Roof ventilation
- RFG DECK — Roof decking/sheathing

### Drywall/Plaster (DRY)
- DRY HANG — Hang drywall
- DRY FINISH — Tape/float/texture
- DRY DEMO — Demolition of drywall

### Painting (PNT)
- PNT SEAL — Seal/prime
- PNT 2CT — Two coat repaint
- PNT MATCH — Color match (critical for supplements)

### Plumbing (PLM)
- PLM LEAK — Leak detection
- PLM PIPE — Pipe repair/replacement

### Flooring (FLR)
- FLR DEMO — Remove flooring
- FLR TILE — Tile installation
- FLR HARDWD — Hardwood
- FLR CARPET — Carpet installation
- FLR LAMIN — Laminate

### Water Mitigation (WTR)
- WTR EXTRACT — Water extraction
- WTR DRY — Structural drying
- WTR DEMO — Wet material demolition
- WTR ANTIMICRO — Antimicrobial treatment

### General (GEN)
- GEN DEMO — General demolition
- GEN HAUL — Debris haul-off
- GEN CLEAN — Cleaning
- GEN PERMIT — Building permits
- O&P — Overhead & Profit (typically 20% total: 10% overhead + 10% profit)

## Common Supplement Justifications

### Matching (Florida)
- FL has implied warranty of workmanship — repairs must match existing
- If carrier denies matching, cite: "Repair must restore property to pre-loss condition"
- Document: manufacturer discontinuation, color variation, weathering differences
- Take comparison photos showing why partial replacement won't match

### Overhead & Profit (O&P)
- Justified when: job requires coordination of 3+ trades
- Standard: 10% overhead + 10% profit = 20% total
- Carrier often excludes O&P on initial estimate — always supplement for it
- Document: number of trades involved, project complexity, coordination required

### Code Upgrades
- Florida Building Code changes trigger upgrade requirements
- Common: hurricane straps, impact-resistant roofing, electrical panel upgrades
- Always check: local municipality requirements, permit requirements
- Carrier must pay for code-required upgrades per policy terms

### Hidden Damage
- Discovered during repairs, not visible during initial inspection
- Process: Stop work → document → notify carrier → request re-inspection
- Key: Never repair hidden damage without carrier acknowledgment
- Photo everything BEFORE and AFTER opening walls/ceilings

## IICRC Standards (Expanded)

### S500 — Water Damage Restoration
- Category 1 (Clean): Supply line, rainwater
- Category 2 (Gray): Dishwasher, washing machine, toilet overflow (no feces)
- Category 3 (Black): Sewage, flooding, prolonged standing water
- Class 1-4 based on evaporation rate and material porosity
- Drying standards: dehumidifiers + air movers, monitor daily with moisture meters
- Document: moisture readings, equipment placement, daily logs

### S520 — Mold Remediation
- Condition 1 (Normal): Background levels, no remediation needed
- Condition 2 (Settled Spores): Elevated settled spores, cleaning required
- Condition 3 (Active Growth): Active mold growth, full remediation required
- Protocol: containment → HEPA filtration → removal → treatment → clearance testing
- Key: Always get pre-remediation AND post-remediation air samples

### S540 — Fire/Smoke Damage
- Protein fires (kitchen): invisible residue, worst odor
- Complex fires: synthetic materials, toxic residue
- Document: char depth, smoke patterns, affected materials
- Thermal fogging vs hydroxyl generators for odor

## Negotiation Tactics

### Appraisal Process (F.S. 627.7015)
- Each party selects appraiser, appraisers select umpire
- Binding on amount, not coverage
- Cost: split umpire fees 50/50
- When to invoke: valuation dispute > $5K, carrier won't budge on scope
- Timeline: no statutory deadline, but carriers often delay — push for 30-day resolution

### Mediation
- Pre-suit requirement in many FL policies
- Cost: typically $500-1,500 per session
- When to use: coverage disputes, bad faith potential
- Prepare: demand package with all documentation, comparable settlements

### Bad Faith Indicators (Document These)
- Failure to acknowledge claim within 7 days
- Failure to pay/deny within 60 days
- Unreasonable delay in investigation
- Lowball offer without reasonable basis
- Failure to explain denial reasons
- Ignoring submitted documentation
- Repeated reassignment of adjusters

## CRITICAL UPDATES — Post-SB 2A Landscape (2023-2026)

### SB 2A (December 2022) — What Changed
- ELIMINATED one-way attorney fees for property insurance claims (policies written Jan 1, 2023+)
- PROHIBITED assignment of benefits (AOB) for residential/commercial property policies
- Impact: FL insurance lawsuits dropped 24% between Q3 2023 and 2024
- Impact: Average requested rate hikes dropped from 21% (2023) to 0.2% (2025)
- PA Strategy Shift: Without attorney fee leverage, documentation quality is now THE differentiator
- CRITICAL: PAs must now build cases so strong that carriers settle without litigation

### HB 837 (March 2023) — Extended Reforms
- Extended elimination of one-way attorney fees beyond property insurance
- Reduced statute of limitations for negligence claims from 4 years to 2 years
- Modified comparative fault system
- Impact on PAs: Tighter timelines, must act faster on claims

### Current Fee Structure (F.S. 626.854(11)(b) — 2025)
- Non-emergency claims: 20% maximum of claim payments/settlements
- Emergency-declared claims: 10% maximum (for 1 year after Governor's declaration)
- Supplemental/reopened claims: 20% maximum of supplemental payment
- NO sliding scale — simple two-tier structure

### Contract Requirements (F.S. 626.8796 — 2025)
- Percentage of compensation must be in MINIMUM 18-POINT BOLD TYPE before signature line
- Must state claim type: emergency, non-emergency, or supplemental
- Named insured must initial EVERY page without their signature
- Must include: PA full name, business address, license number, phone, email, firm name
- Must include: insured's full name, street address, phone, email
- Rescission: Insured may rescind if PA hasn't submitted written estimate within 60 days
- NEW (July 1, 2026): Vulnerable adults/those lacking capacity may rescind at ANY time

### Insurer Obligations (F.S. 627.70131 — 2025)
- 7 calendar days: Acknowledge receipt of claim communication
- 7 days after proof-of-loss: Begin investigation
- 60 days after notice: Pay or deny — after this, interest accrues per F.S. 55.03
- Interest runs from date insurer RECEIVED notice (not date of loss)
- Acknowledgment must be "responsive" and include claim forms + instructions + phone number

### Pending 2026 Legislation
- SB 202: REQUIRES human review of all claim denials — prohibits AI-only denials (effective 7/1/2026)
- SB 266: Vulnerable adult protection — rescission of PA contracts at any time
- SB 30 (proposed): Would cap annual rate increases at 10-15%
- Anti-PA endorsements: 6+ carriers trying to discourage PA use via policy endorsements — FAPIA/NAPIA suing

## Anti-Public Adjuster Tactics (2025 — WATCH FOR THESE)
- Velocity Risk and others adding endorsements that threaten to NOT investigate until PA is dismissed
- FAPIA and NAPIA have filed suit challenging these endorsements
- If a client shows you an anti-PA endorsement: document it, contact FAPIA, it may be unenforceable

## Deep Dive: Industry Mentors & Methods

### John Senac — CAR Method (Compatibility, Availability, Repairability)
- President of NTS Identification Services (Name That Shingle)
- CAR stands for: Compatibility, Availability, Repairability
- Philosophy: "Show ALL concerns on the roof, not just the damage"
- Key technique: Strong initial inspection that pre-empts carrier defenses
- Specializes in: discontinued shingles/materials identification
- Teaching: Present findings methodically to project confidence
- When carrier says "we can repair": Use CAR to prove why repair isn't possible
- Discontinued materials = full replacement, not repair (carrier can't match what doesn't exist)

### Chip Merlin — Bad Faith & Litigation Authority
- Founded Merlin Law Group (1985) — largest policyholder-side insurance firm
- Key insight: "Document every communication. Bad faith requires showing insurer KNEW claim was valid"
- Blog: propertyinsurancecoveragelaw.com — essential reading for current case law
- Focus areas: First-party bad faith, coverage disputes, delayed claims
- Post-SB 2A strategy: Build such overwhelming documentation that carriers settle before litigation
- 2025 fight: Challenging anti-PA policy endorsements in court

### Winning PA Methods (Research-Verified 2024-2025)

#### Documentation That Wins
- Geo-tagged site surveys (proves you were there, when)
- Drone footage (aerial perspective carriers can't dispute)
- City weather service data from day of storm (proves weather event occurred)
- Hyper-local comparable estimates (same zip code — carriers can't argue market rates)
- Pre-loss vs post-loss comparison photos (Google Street View for pre-loss)

#### The 747% Difference
- Citizens Property Insurance study: Claims WITH PA averaged $17,187 payment
- Claims WITHOUT PA averaged $2,029 payment
- That's a 747% increase — use this stat in marketing and client conversations

#### Post-SB 2A Strategy Shift
- Without one-way attorney fees, PAs must build cases SO strong carriers settle voluntarily
- Focus on: exhaustive documentation, carrier-specific tactics, appraisal expertise
- Collaboration with attorneys still valuable but economics changed
- Appraisal process (627.7015) is now the PRIMARY dispute resolution tool
- Mediation before litigation for coverage disputes

## Florida Insurance Market (2025-2026)

### Top Carriers by Policy Count
1. State Farm Florida (~646,000 policies)
2. Universal Property & Casualty (~561,000 policies)
3. Citizens Property Insurance (~385,000 policies, down 73% from Oct 2023 peak of 1.42M)
4. Heritage Property & Casualty (resumed writing new policies Aug 2024)
5. Tower Hill Insurance
6. American Integrity Insurance
7. Florida Peninsula Insurance
8. Security First Insurance
9. Slide Insurance (digital-first, newer carrier)
10. FedNat Insurance

### Market Trends
- 17 new carriers entered FL market since SB 2A reforms
- Citizens depopulating rapidly — policies moving to private market
- Average rate increases stabilizing (0.2% in 2025 vs 21% in 2023)
- Surplus lines carriers increasingly used — less regulated, watch for anti-PA endorsements
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
