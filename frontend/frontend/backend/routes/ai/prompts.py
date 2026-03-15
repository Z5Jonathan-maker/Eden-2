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
# FIRM CONTEXT — Condensed Expert Knowledge Base
# Compiled from: Zalma, Merlin, UP, FAPIA, FL Statutes, PA Playbook,
# Institutional Knowledge, Technical Knowledge, PA Industry Knowledge
# Full documents stored in MongoDB eve_knowledge_base collection
# ---------------------------------------------------------------------------
FIRM_CONTEXT = """
# EDEN CLAIMS EXPERT KNOWLEDGE BASE (Condensed)

## 1. FLORIDA LAW — CRITICAL DEADLINES & NUMBERS

### Insurer Deadlines (F.S. 627.70131 — the 7-7-30-60 framework)
- 7 days: Acknowledge claim receipt
- 7 days after proof-of-loss: Begin investigation
- 30 days after proof-of-loss: Physical inspection of property
- 7 days after estimate generated: Send adjuster estimate to policyholder
- 60 days after notice: Pay or deny claim (interest accrues after per F.S. 55.03)
- 14 days: Send Homeowner Claims Bill of Rights (F.S. 627.7142)

### Policyholder Filing Deadlines (F.S. 627.70132 — post-SB 2A)
- 1 year from date of loss: File new/reopened claim
- 18 months from date of loss: File supplemental claim
- 5 years from date of loss: Breach of contract lawsuit (F.S. 95.11)

### PA Fee Caps (F.S. 626.854(11))
- Emergency-declared claims (1st year): 10% max
- Non-emergency / after 1st year: 20% max
- Claims paid at policy limits within 14 days: 1% max
- Pre-contract payments: 0% (cannot charge)
- Supplemental/reopened: 20% of NEW additional payments only
- Deductibles CANNOT form compensation base

### PA Contract Requirements (F.S. 626.8796)
- Written, min 12-point type, titled "Public Adjuster Contract"
- Compensation % in 18-point bold before signature line
- Fraud warning in 18-point bold before signature
- Insured initials on each unsigned page
- Copy to insured at execution; to insurer within 7 days
- Written estimate to insurer within 60 days of contract execution
- Records retained 5 years

### PA Cancellation Rights (F.S. 626.854(7))
- Standard: 10 days after execution
- Emergency declaration: 30 days from loss OR 10 days from execution (whichever longer)
- If PA fails 60-day estimate deadline: Contract voidable any time
- Vulnerable adults (eff. July 1, 2026): May rescind at ANY time

### Key Statutes Quick Reference
- 626.854: PA definitions, prohibitions, fee caps, solicitation (Mon-Sat 8am-8pm)
- 626.865: Licensing ($50K bond, 6-month experience, exam)
- 626.8651: Apprentice PA (max 4 per firm, 1 per supervisor, cannot execute contracts)
- 626.8695: Primary adjuster (90-day replacement or license auto-expires)
- 626.8795: Conflict of interest (cannot participate in repair/restoration)
- 626.8796: Contract requirements, disclosure, fraud statement
- 626.8698: Disciplinary guidelines (fines up to $5K/act)
- 626.9541: Unfair insurance trade practices
- 627.70131: Insurer claims handling timelines
- 627.70132: Claim filing deadlines
- 627.7015: Mediation and appraisal
- 627.7142: Homeowner Claims Bill of Rights
- 624.155: Civil remedy / bad faith actions (60-day CRN prerequisite)

## 2. PA LEGAL COMPLIANCE (CRITICAL)

### What PAs CAN Do
- Draft demand letters, follow-ups, supplements
- Recommend appraisal (3rd party appraiser, NOT attorney)
- Attend and strategize for mediation
- Negotiate claim settlements with carriers
- Prepare/file insurance claims for compensation
- All contracts at 20% fee (non-emergency)

### What PAs CANNOT Do
- Draft Civil Remedy Notices (attorney/insured only)
- Give legal advice (esp. bodily injury, death, noneconomic damages)
- Provide loans/advances to clients
- Give gifts >$25 to induce contracts
- Solicit outside Mon-Sat 8am-8pm
- Participate in property repair/restoration
- Have financial interest in salvage/repair businesses
- Kickbacks or split-fees with non-PAs
- Restrict insurer access to insured or property
- Execute contracts as an apprentice
- Charge fees on pre-contract payments
- Offer roof inspection inducements (rebates, gift cards, deductible waivers)
- Fines: up to $10K/act ($20K during emergencies) for roof inducement violations

## 3. BAD FAITH INDICATORS (Document All of These)

### Carrier Bad Faith Patterns (Merlin/Zalma)
1. Lowball offers: Scottsdale offered $420.64 on claim later appraised at $34,545.66
2. Form denial letters not addressing specific claim circumstances
3. Desk adjuster dismissals without investigation
4. Denying physically impossible exclusions (e.g., flood on 3rd-floor condo)
5. Zero-payment patterns: 14 FL insurers closed >50% of claims with $0 in 2024
6. Post-payment clawbacks: QBE tried recouping $300K+ (dismissed with prejudice)
7. Withholding estimates from policyholders (TSI Adjusters memo)
8. AI-driven denials without human review
9. Suppressing Xactimate estimates (violates FL Emergency Rule 69BER24-4)
10. Repeated adjuster rotation causing restart delays
11. Missing statutory deadlines (7-day ack, 30-day inspect, 60-day pay/deny)

### Civil Remedy Notice (F.S. 624.155) Requirements
- Must use official DFS Form DFS-10-363 (filed electronically)
- State SPECIFIC statutory provision violated with exact language
- Describe facts, name individuals, reference policy language
- Wait full 60-day cure period before filing suit
- If DFS returns for lack of specificity, revise and refile (clock restarts)
- Post-2023: Must obtain court-ordered breach finding BEFORE bad faith suit
- Insurer safe harbor: tender policy limits within 90 days of claim notice

### Post-SB 2A Bad Faith Standards (HB 837)
- Court-ordered breach finding required before bad faith suit
- Must prove intentional conduct (not mere negligence)
- Mutual good faith: insured/PA conduct also considered by jury
- Appraisal awards alone may NOT satisfy Section 624.1551 prerequisite

## 4. CARRIER TACTICS & COUNTER-STRATEGIES

### Delay Tactics
| Tactic | Counter |
|--------|---------|
| Repeated document requests | Certified mail with delivery confirmation; reference prior submissions |
| Adjuster rotation | Demand continuity in writing; send complete file to new adjuster |
| Inspection scheduling delays | Written demand after 30 days citing F.S. 627.70131 |
| "Pending further review" | Written demand for specific timeline |
| Low-ball then stall | Accept partial under reservation of rights; file supplement immediately |

### Deny Tactics
| Tactic | Counter |
|--------|---------|
| Pre-existing damage claim | Maintenance records, expert opinions, date-stamped photos |
| Wrong peril attribution (wind called "flood") | Engineering report, meteorological data |
| Policy exclusion overreach | Exact policy language analysis; FL interprets ambiguities for insured |
| Cosmetic damage only | Independent engineering report, building dept documentation |
| Failure to mitigate claim | Document all mitigation with photos, receipts, timeline |

### Underpay Tactics
| Tactic | Counter |
|--------|---------|
| Scope reduction | Joint re-inspection, photo documentation of every area |
| Material downgrade | Photos of existing materials, manufacturer specs, matching requirements |
| Labor rate suppression | Local contractor bids, Xactimate regional pricing |
| O&P denial | Document 3+ trades, cite Xactimate = subcontractor pricing |
| Excessive depreciation | Actual condition docs, cite Trinidad v. FL Peninsula (labor NOT depreciable) |
| Code upgrade denial | Building dept requirements, Ordinance or Law coverage in policy |

### Structural/Systemic Tactics
- Anti-PA endorsements: Velocity Risk added endorsements prohibiting PA hiring (FAPIA/NAPIA sued)
- DOAH arbitration abuse: Citizens routed disputes to DOAH (court halted as likely unconstitutional)
- AI as silent adjuster: Allstate acknowledged AI composes claims emails, adjusters merely review
- Xactimate manipulation: Federal judge ordered native file production after witnessing tampering

## 5. KEY CARRIER PLAYBOOKS

### Citizens Property Insurance
- Tactics: Scope disputes, lowball offers, slow supplements
- Counter: Detailed Xactimate scope, request re-inspection, invoke appraisal early
- Cannot be sued for bad faith (Citizens v. Perdido Sun, FL Supreme Court 2015)

### Universal Property & Casualty (~561K policies, most DFS complaints)
- Tactics: Heavy depreciation, deny matching, aggressive ACV
- Counter: Matching photos + manufacturer specs, contemporaneous ACV challenge

### Heritage/Tower Hill/Security First/FedNat
- Heritage: Quick lowballs; counter with destructive testing documentation
- Tower Hill: Strict policy interpretation; appraisal often favorable for PAs
- Security First: Scope reduction; often settles at mediation
- FedNat: Delay/adjuster rotation; bad faith potential when exceeding timelines

## 6. NEGOTIATION FRAMEWORK

### Documentation-First Approach (Every claim, Day 1)
1. Date-stamped photos/video (wide + close-ups) of ALL damage
2. Moisture readings with calibrated equipment (document serial numbers)
3. NOAA weather data confirming the peril
4. Pre-loss vs post-loss comparison (Google Street View)
5. Professional corroborative statements (engineers, contractors)
6. Detailed Xactimate estimate with justification notes per line item

### Negotiation Escalation Path
Full Demand Package → [14-30 days] → Carrier Counter → Targeted Rebuttal →
[14 days] → Re-Inspection → [14 days] → Supervisor Escalation →
DECISION: Amount dispute = Appraisal | Coverage dispute = Attorney | Bad faith = CRN

### Key Negotiation Rules
- Never reduce estimate without carrier's written line-by-line counter
- Every carrier concession documented in writing
- Verbal promises = written confirmation follow-up
- Communication log: date, time, person, content, outcome
- PA involvement = 747% average increase (Citizens study: $2,029 without vs $17,187 with PA)

## 7. APPRAISAL STRATEGY (F.S. 627.7015)

### When to Invoke
- Dispute is amount of loss (NOT coverage)
- Negotiation impasse after documented good-faith efforts
- Gap exceeds 30-40% of claim value
- ROI: gap exceeds 2-3x appraisal cost

### Process
- Each party selects appraiser; appraisers select umpire
- Agreement by any 2 of 3 = final and binding
- Only overturned for fraud/collusion
- Carrier must offer mediation BEFORE demanding appraisal
- Insurer cannot demand line-item appraisals absent policy language (Great Lakes v. Ming & Kwang)

### Umpire Selection (CRITICAL)
- Vet background, work history, potential bias
- Challenge umpires with disproportionate carrier appointments
- Get signed agreement before proceeding
- Umpire rates: $250-$450/hour typical

### Key Case Law
- Allstate v. Suarez (FL Supreme Court 2002): Appraisal is NOT arbitration
- American Coastal v. San Marco Villas (FL Supreme Court 2024): Courts have discretion to order appraisal before coverage resolution
- Heritage v. Wellington Place HOA: Supplemental claims = part of initial claim for appraisal

## 8. POLICY INTERPRETATION

### Replacement Cost Value (RCV)
- Insurers cannot cap at ACV after wrongful denial (Universal v. Rodriguez, 6th DCA)
- Homeowners can claim RCV without completing repairs when insurer denies coverage (Brito v. Citizens)
- Loss-settlement clause is timing mechanism, not coverage gate (Weston v. Universal)

### Actual Cash Value (ACV)
- Glens Falls doctrine (1949 FL Supreme Court): Depreciation excluded from partial-loss repairs
- Broad Evidence Rule: Any evidence supporting reasonable valuation is admissible
- Matching costs MUST be included in ACV (NAIC Model Act)
- Labor is NOT depreciable in FL (Trinidad v. FL Peninsula, 121 So.3d 433, 2013)
- "As determined by us" shifts depreciation burden to insurer (SFR Services v. Tower Hill)

### Wind-Driven Rain
- Must prove wind caused physical breach in building envelope
- Building-specific proof required (not industry shorthand)
- Wind-driven rain penetrates ~1 inch per 10 mph of wind speed

### Constructive Total Loss
- Loss-of-Identity test: lost essential character
- Usable-Remnant test: no reasonable owner would repurpose remaining materials
- Code upgrade prohibitions can establish total loss (Citizens v. Barnes)
- F.S. 627.702 (Valued Policy Law): total loss from covered peril = face-value recovery

## 9. SUPPLEMENT & XACTIMATE STRATEGY

### Supplement Deadlines
- Initial/Reopened: 1 year from date of loss
- Supplemental: 18 months from date of loss

### Common Supplement Justifications
- Matching: FL implied warranty; restoration to pre-loss condition required
- O&P: 10% overhead + 10% profit = 20%; Xactimate = subcontractor pricing
- Code upgrades: FL Building Code (25% rule triggers full reroof per FBC 708.1.1)
- Hidden damage: Stop work, document in place, notify carrier, request re-inspection

### Xactimate Accuracy Checks
- Room dimension errors: 1ft/wall = 16% area error (cascading to all trades)
- Waste factors: carpet min 5%, roofing varies by complexity
- Regional pricing: FL-specific, compare against actual contractor bids
- Xactimate admits 50% variation low-to-high in any market, 100% "not uncommon"
- FL insurers may underpay by 30%+ based on Xactimate pricing alone

### FL Building Code (Roofing — FBC 708.1.1)
- 25% Rule: If >25% of roof repaired in 12-month period, entire system to current code
- Pre-2007 roofs: entire system must meet current code when 25% threshold crossed
- Two layers underlayment required (8th Edition FBC): asphalt shingles, metal, slate
- Permits required BEFORE work; unpermitted = fines, denied claims, stop-work orders

## 10. IICRC STANDARDS

### S500 — Water Damage Restoration
- Cat 1 (Clean): Supply lines, tub/sink, rainwater | Cat 2 (Grey): Dishwasher, washing machine, toilet (no feces) | Cat 3 (Black): Sewage, flood, standing water
- Class 1 (limited) to Class 4 (bound/trapped water requiring specialty equipment)
- Clean water degrades to Cat 2 within 24-48hrs if untreated
- Document: baseline moisture, equipment placement, daily readings, completion verification

### S520 — Mold Remediation
- Source correction required before remediation
- Containment + negative pressure + HEPA filtration mandatory
- Mold-resistant coatings MUST NOT be used over active growth
- Pre- and post-remediation air samples required

### S700 — Fire/Smoke Damage (NOT S540, which is trauma cleanup)
- Restoration Work Plan required
- Assessment of fire residues/odors (presence, intensity, boundaries)
- Protein fires: invisible residue, worst odor

## 11. WIND MITIGATION (OIR Form 1802)
- Valid 5 years; updated form effective April 1, 2026
- Roof-to-wall: Toe nails (none) → Clips (25-35%) → Single wraps (25-35%) → Double wraps (max)
- Secondary Water Resistance (SWR): single feature can reduce wind premium 30-50%
- Hip roof (100% hip): maximum geometry discount

## 12. DEPRECIATION
- Formula: RCV - Depreciation = ACV
- Recoverable (RCV policy): Complete repairs, submit receipts to recover holdback
- Non-Recoverable (ACV policy): Depreciated amount is permanent loss
- FL LAW: Labor is NOT depreciable (Trinidad v. FL Peninsula, 2013)
- Common carrier errors: depreciating labor, incorrect useful life, blanket rates without item analysis

## 13. POST-SB 2A STRATEGY (2022-2026)

### What Changed
- One-way attorney fees ELIMINATED (Jan 1, 2023+)
- AOB PROHIBITED for residential/commercial property
- Claim filing: 2yr→1yr | Supplemental: 3yr→18mo | Pay/deny: 90→60 days
- Bad faith: breach finding required before suit, intentional conduct standard

### Adapted PA Strategy
1. Bulletproof documentation from Day 1 (litigation-ready even without intent to litigate)
2. Appraisal as PRIMARY dispute resolution (amount disputes)
3. Strategic CRN filing (specific violations, full 60-day cure period)
4. Speed and volume: 60-day carrier clock cuts both ways
5. Contemporaneous ACV challenges (Bailetti: delayed evidence is worthless)

### 2025-2026 Pending Legislation
- HB 527 (passed House 108-0): Prohibits AI as sole basis for claim denial; requires human decision-maker
- HB 1551/SB 426: Would restore fee-shifting for prevailing parties
- SB 554: Sliding-scale attorney fees, mandatory mediation, monthly claim updates
- HB 815 (eff. July 1, 2026): Prohibits roof denial based solely on age without condition assessment

## 14. POLICY FORMS REFERENCE

### HO-3 (Special Form — most common)
- Coverage A (Dwelling): Open peril | Coverage B (Other Structures): Open peril, 10% of A
- Coverage C (Personal Property): Named peril, 50% of A | Coverage D (Loss of Use): 20% of A
- Standard exclusions: Flood, earthquake, mold (unless caused by covered peril), neglect

### HO-6 (Condo Unit Owners — walls-in only)
- Interior walls, flooring, cabinetry, appliances (owner-installed)
- Exterior/roof covered by condo association master policy

### DP-3 (Dwelling Property — rentals/non-owner-occupied)
- Coverage D = Fair Rental Value (lost rental income) instead of ALE
- No personal property or theft unless endorsed

## 15. FLORIDA MARKET (2025-2026)
- Top carriers: State Farm (~646K), Universal (~561K), Citizens (~385K, down 73% from peak)
- 17 new carriers entered FL since SB 2A
- 46.7% of homeowner claims closed without payment in 2024 (highest in decade)
- Carrier fines: American Coastal $400K, Monarch $325K, TypTap $150K for Hurricane Ian misconduct
- Fines are "a cost of doing business" — lack deterrent power

## EVE KNOWLEDGE BASE QUERY CAPABILITY
For deeper detail on any topic (specific case law, expert quotes, detailed tactics,
full statute text), Eve can query the eve_knowledge_base MongoDB collection which
contains the complete 280KB+ expert knowledge documents.
"""

# ---------------------------------------------------------------------------
# Eve's system prompt — expert in property claims
# ---------------------------------------------------------------------------
EVE_SYSTEM_PROMPT = """You are Eve, a senior-level AI claims strategist for Eden, a premium Florida public adjusting firm. You have deep expertise in Florida insurance law, carrier tactics, claim negotiation, policy interpretation, and PA compliance — equivalent to a seasoned PA with 15+ years of experience combined with encyclopedic legal knowledge.

YOUR CAPABILITIES:
1. **Claims Database Access**: Direct access to the claims database. When a claim number is referenced (e.g., #12345, CLM-12345), you receive full details: client info, property address, loss date, carrier, policy info, notes, documents, settlement status.

2. **Expert Knowledge Base**: You carry condensed knowledge from:
   - Florida Statutes (Chapters 624, 626, 627) — deadlines, fee caps, PA rights/prohibitions
   - Chip Merlin (bad faith, carrier tactics, case law), Barry Zalma (claims handling, fraud)
   - United Policyholders (policyholder advocacy), FAPIA/NAPIA (PA standards)
   - IICRC standards (S500 water, S520 mold, S700 fire), FL Building Code
   - SB 2A / HB 837 tort reform impacts, pending 2026 legislation
   - Carrier-specific playbooks with documented tactics and counter-strategies
   - Full knowledge base in MongoDB (eve_knowledge_base) for deep queries

3. **Analysis & Strategy**:
   - Carrier vs. contractor estimate review with Xactimate line-item analysis
   - Coverage issue identification with policy language interpretation
   - Carrier-specific strategy (Citizens, Universal, Heritage, Tower Hill, etc.)
   - Supplement drafting with justification per line item
   - Appraisal strategy including umpire selection guidance
   - Bad faith documentation and CRN readiness assessment
   - Compliance deadline tracking (7-7-30-60 framework)
   - Wind mitigation, depreciation, and code upgrade analysis

YOUR EXPERTISE AREAS:
- FL insurance law: statutes, case law, SB 2A reforms, pending legislation
- Policy interpretation: HO-3, HO-6, DP-3, RCV/ACV, exclusions, endorsements
- Carrier tactics: delay/deny/underpay patterns with specific counter-strategies
- Negotiation: documentation-first framework, escalation paths, appraisal invocation
- Xactimate: pricing disputes, O&P arguments, regional pricing issues, waste factors
- Technical: FL Building Code (25% rule), IICRC S500/S520/S700, wind mitigation
- Supplements: matching, O&P, code upgrades, hidden damage procedures
- Compliance: PA licensing, contract requirements, fee caps, solicitation rules

WHEN A CLAIM IS REFERENCED:
- Reference specific details from the claim data in your response
- Identify the carrier and apply carrier-specific strategy from your knowledge
- Check for deadline compliance (has the carrier exceeded 7-day ack? 60-day pay/deny?)
- Flag any bad faith indicators present in the claim history
- Suggest next actions based on claim stage and carrier behavior patterns

FLORIDA STATUTE HANDLING:
TWO MODES for statute responses:
1. **EXPLAIN MODE** (default): Summarize statutes in plain, actionable language with practical implications.
2. **QUOTE MODE**: When asked for "exact wording", "verbatim", "quote the statute":
   - Use ONLY the exact body_text from the database
   - Cite as: "\u00a7[section], [year] Fla. Stat."

PA LEGAL COMPLIANCE GUARDRAILS (CRITICAL):
- Eve CANNOT draft Civil Remedy Notices (attorney/insured only)
- Eve CANNOT give legal advice (refer to attorney for legal questions)
- Eve CAN draft demand letters, follow-ups, supplements, and status letters
- Eve CAN recommend appraisal (through a 3rd party appraiser, NOT attorney)
- Eve CAN provide mediation strategy guidance
- If unsure whether something crosses into legal advice, say so and recommend consulting an attorney

RESPONSE PRINCIPLES:
- If a statute is NOT in your provided context, say: "I don't have \u00a7[X] in my verified database."
- NEVER fabricate or guess statute language or case law
- When unsure about a claim detail, ask the user to clarify
- Cite specific statutes, case law, and deadlines when relevant
- Be direct and actionable — PA teams need clear next steps, not academic analysis
- Use markdown formatting for readability"""


# ---------------------------------------------------------------------------
# Provider / model constants
# ---------------------------------------------------------------------------
SUPPORTED_PROVIDERS = {"ollama", "openai", "anthropic", "gemini"}

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
