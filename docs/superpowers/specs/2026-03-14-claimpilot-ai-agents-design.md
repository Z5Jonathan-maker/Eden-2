# ClaimPilot AI Agents — Design Specification

**Date:** 2026-03-14
**Author:** Claude + Jonathan
**Status:** Approved
**Project:** Eden-2 (Care Claims)

---

## 1. Overview

ClaimPilot is an AI agent mesh integrated into Eden-2 that transforms it from a claims management tool into an AI-powered claims intelligence platform. Eight specialized agents handle distinct aspects of the claims lifecycle, coordinated by a central orchestrator with human-approval gates.

**Cost target:** $0/month (Gemini Flash free tier + Groq free tier + Ollama fallback)

**Core principle:** Agents analyze and recommend autonomously. Any action that changes data or sends communication requires human approval. Read-only outputs (scores, predictions, matches) flow automatically.

---

## 2. Architecture

### 2.1 Agent Mesh Pattern

All agents live within Eden-2's existing FastAPI backend. No new services or infrastructure. Agents are Python modules under `services/claimpilot/agents/` that inherit from `BaseAgent` and are registered with the `AgentOrchestrator`.

Communication happens through MongoDB domain events (extending the existing pattern in `claims_service.py`). When a claim event fires (created, updated, photo uploaded, evidence ingested), the orchestrator routes it to the relevant agent(s).

### 2.2 Directory Structure

```
backend/services/claimpilot/
├── __init__.py
├── orchestrator.py          # Event routing + agent lifecycle
├── base_agent.py            # Abstract base, guardrails, audit
├── agent_context.py         # Immutable claim snapshot builder
├── llm_router.py            # Gemini/Groq/Ollama dispatch
├── approval_gate.py         # Pending queue + approve/reject
├── audit_logger.py          # claimpilot_audit collection
├── legal_feed.py            # Live FL statute sync engine
├── agents/
│   ├── __init__.py
│   ├── intake_parser.py
│   ├── vision_analyzer.py
│   ├── estimate_engine.py
│   ├── negotiation_copilot.py
│   ├── claim_monitor.py
│   ├── evidence_scorer.py
│   ├── statute_matcher.py
│   └── predictive_analytics.py
```

### 2.3 New API Routes (`routes/claimpilot.py`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/claims/{id}/claimpilot/insights` | All agent outputs for a claim | adjuster+ |
| POST | `/api/claims/{id}/claimpilot/run/{agent_name}` | Manually trigger an agent | adjuster+ |
| GET | `/api/claimpilot/pending` | Approval queue | manager+ |
| POST | `/api/claimpilot/pending/{id}/approve` | Approve pending action | manager+ |
| POST | `/api/claimpilot/pending/{id}/reject` | Reject with reason | manager+ |
| GET | `/api/claimpilot/analytics` | Agent performance dashboard | admin |
| GET | `/api/claimpilot/legal/status` | Legal feed sync status | admin |
| POST | `/api/claimpilot/legal/sync` | Force legal data refresh | admin |

### 2.4 New MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `claimpilot_insights` | Agent outputs tied to claims (scores, predictions, recommendations) |
| `claimpilot_pending` | Actions awaiting human approval |
| `claimpilot_audit` | Full audit trail of every agent execution |
| `claimpilot_legal_feed` | Cached legal data with source URLs, fetch timestamps, version tracking |
| `claimpilot_carrier_patterns` | Learned carrier behavior patterns from historical negotiations |

---

## 3. Shared Infrastructure

### 3.1 BaseAgent

```python
class BaseAgent(ABC):
    agent_name: str
    requires_approval: bool
    llm_provider: str  # "gemini_flash" | "groq" | "ollama"
    max_retries: int = 2
    timeout_seconds: int = 30

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult: ...

    @abstractmethod
    async def validate_output(self, result: AgentResult) -> bool: ...

    # Inherited from base:
    # - Input sanitization (prompt injection protection from ai_service.py)
    # - Legal promise detection (regex patterns from ai_service.py)
    # - Sensitive keyword flagging
    # - Stage-aware warnings (Litigation/Archived blocks)
    # - Confidence scoring (0.0-1.0)
    # - Automatic audit logging
    # - Rate limiting per agent
    # - Retry with exponential backoff
    # - Fallback chain: primary LLM → Ollama → heuristic
```

### 3.2 AgentContext (Immutable)

Built fresh for each agent execution. Contains:
- Claim record (full MongoDB document)
- Recent activity log (last 20 domain events)
- Related evidence, photos, notes, tasks
- Carrier communication history
- Applicable FL statutes (from live legal feed)
- Similar historical claims (for pattern matching)
- Current user role and permissions

### 3.3 LLM Router

| Task Type | Primary | Fallback | Cost |
|-----------|---------|----------|------|
| Vision (photos) | Gemini 2.0 Flash | Ollama (if local model supports) | $0 |
| Text generation (drafts, analysis) | Gemini 2.0 Flash | Groq llama-3.3-70b | $0 |
| Structured extraction (parsing) | Gemini 2.0 Flash | Groq | $0 |
| Local/private data | Ollama gemma3:27b | — | $0 |

Router selects based on: task type, payload size, privacy sensitivity, rate limit headroom.

### 3.4 Approval Gate

States: `pending` → `approved` | `rejected` | `expired` (24h TTL)

Pending items include:
- Agent name and confidence score
- Proposed action (update claim fields, send message, create task)
- Evidence/reasoning the agent used
- One-click approve or reject with optional reason
- Bulk approve for high-confidence items (>0.9)

### 3.5 Guardrails (Extended from ai_service.py)

All existing guardrails carry over, plus:
- **No autonomous external communication** — all outbound (SMS, email) requires approval
- **No financial field modifications** without approval — settlement amounts, estimates
- **Litigation-stage lockout** — agents cannot modify claims in litigation without admin override
- **Confidence threshold** — results below 0.5 confidence are flagged, not surfaced as recommendations
- **Hallucination check** — agent outputs cross-referenced against claim data; unsupported claims flagged

---

## 4. Agent Specifications

### 4.1 IntakeParser

**Trigger:** `ClaimCreated` event, or email received matching claim pattern
**LLM:** Gemini Flash
**Requires approval:** Yes (for field updates)

**Input:** Raw intake text (call transcript, email body, web form)
**Output:**
- Extracted fields: client name, phone, email, property address, loss date, damage type, carrier, policy number
- Confidence per field (0.0-1.0)
- Fields it couldn't extract (flagged for human entry)

**Integration:** Extends existing `ClaimCreate` flow. Agent runs post-creation to fill gaps. Updates stored as pending items — adjuster reviews and approves field fills.

### 4.2 VisionAnalyzer

**Trigger:** Photo uploaded to inspection
**LLM:** Gemini 2.0 Flash Vision
**Requires approval:** No (read-only scoring)

**Input:** Inspection photo + room metadata
**Output per photo:**
- Damage classification (water, wind, hail, fire, mold, structural, cosmetic)
- Severity score (1-10)
- Photo quality score (blur, lighting, angle, coverage)
- Fraud indicators (inconsistent damage patterns, staged appearance, metadata anomalies)
- Recommended additional angles/evidence

**Integration:** Scores stored in `claimpilot_insights` linked to photo ID. VisionOverlay component renders annotations on PhotoViewerModal. Fraud flags escalate to manager via notification.

### 4.3 EstimateEngine

**Trigger:** Manual trigger or inspection marked complete
**LLM:** Groq llama-3.3-70b
**Requires approval:** Yes (financial data)

**Input:** Vision scores, damage classifications, property data (Regrid), historical similar claims
**Output:**
- Preliminary estimate range (low/mid/high)
- Line items by damage type and room
- Comparable claims used for estimation
- Confidence score

**Integration:** Feeds into existing claim financial fields. Estimate stored as pending — adjuster reviews, adjusts, approves. Historical data accumulates for improving future estimates.

### 4.4 NegotiationCopilot

**Trigger:** Carrier response received (email/call transcript)
**LLM:** Gemini Flash
**Requires approval:** Yes (communication drafts)

**Input:** Full carrier communication history, claim details, estimate vs. carrier offer, FL statutes
**Output:**
- Analysis of carrier's position (what they're conceding, where they're firm)
- Counter-argument drafts with statute citations
- Suggested settlement range based on similar claims
- Leverage points (regulatory deadlines, statute violations, evidence strength)
- Risk assessment of proceeding vs. settling

**Integration:** Extends existing comms-copilot. Outputs appear in NegotiationPlaybook UI. Draft responses queued for approval before sending.

### 4.5 ClaimMonitor

**Trigger:** Scheduled every 2 hours + claim stage transitions
**LLM:** Groq
**Requires approval:** No (notifications only) / Yes (auto-created tasks)

**Output per claim:**
- Stall detection (no activity > threshold per stage)
- Deadline risk (FL compliance deadlines approaching)
- Missing documentation alerts
- Suggested next actions with priority
- Auto-created follow-up tasks (pending approval)

**Integration:** New background worker in APScheduler. Notifications pushed via existing notification system. Tasks created in pending queue.

### 4.6 EvidenceScorer

**Trigger:** Evidence ingested (email, document, photo batch)
**LLM:** Gemini Flash
**Requires approval:** No (read-only scoring)

**Output:**
- Completeness score (0-100%) across categories:
  - Property documentation (deed, policy, photos)
  - Damage documentation (photos, expert reports, contractor estimates)
  - Communication records (carrier correspondence, adjuster notes)
  - Financial records (receipts, invoices, prior claims)
- Gap analysis: specific items needed with priority
- Evidence strength rating for negotiation readiness

**Integration:** EvidenceGapAlert component shows red/yellow/green per category. Gap items become suggested tasks.

### 4.7 StatuteMatcher — LIVE LEGAL INTELLIGENCE

**Trigger:** Claim facts updated, new evidence, stage transitions
**LLM:** Groq
**Requires approval:** No (read-only matching)

**CRITICAL: Laws change rapidly. This agent uses live legal data, not static storage.**

#### Legal Feed System (`legal_feed.py`)

**Data sources (scraped/fetched on schedule):**
1. **Florida Legislature** (flsenate.gov) — Title XXXVII (Insurance), esp. Chapter 627
2. **FL DFS bulletins** — Department of Financial Services regulatory updates
3. **FL OIR orders** — Office of Insurance Regulation enforcement actions
4. **Case law updates** — Recent FL appellate decisions affecting claims
5. **Industry bulletins** — NAIC model laws, carrier policy changes

**Sync schedule:**
- Full re-scrape: Weekly (Sunday 02:00 UTC)
- Differential check: Daily (02:00 UTC)
- Emergency manual trigger: Admin API endpoint
- Each fetch stores: source URL, fetch timestamp, content hash, diff from previous

**Version tracking:**
- Every statute/regulation stored with effective date, repeal date, amendment history
- Agent always uses the version effective on the claim's loss date
- Alerts when a statute relevant to an active claim gets amended

**Output per claim:**
- Matched statutes with relevance score
- Compliance deadlines (e.g., 90-day acknowledgment, prompt payment requirements)
- Required notices and their deadlines
- Carrier obligations being violated (if any)
- Recommended compliance actions

**Integration:** StatuteMatches tab in claim detail. Deadlines feed into ClaimMonitor for tracking. Compliance gaps flagged as high-priority notifications.

### 4.8 PredictiveAnalytics

**Trigger:** Claim stage transitions, major data updates
**LLM:** Groq
**Requires approval:** No (read-only predictions)

**Input:** Claim profile, carrier, damage type, region, historical outcomes
**Output:**
- Settlement range prediction (10th/50th/90th percentile)
- Litigation probability (0-100%)
- Expected timeline to resolution
- Carrier behavior pattern (fast settler, aggressive denier, etc.)
- Recommended strategy based on predicted carrier behavior

**Integration:** PredictionCard in claim header. Data improves over time as more claims resolve.

---

## 5. Frontend Components

### 5.1 ClaimPilotPanel (right sidebar on ClaimDetails)

Scrollable timeline of all agent outputs for the current claim. Each insight card shows:
- Agent icon + name
- Timestamp
- Summary (1-2 lines)
- Confidence badge
- Expand for full details
- Action buttons (approve/dismiss for pending items)

### 5.2 ApprovalQueue (new top-level page)

- Table of pending items across all claims
- Filters: agent type, confidence level, claim, age
- Bulk approve for high-confidence items
- Badge count in main navigation

### 5.3 VisionOverlay (inside PhotoViewerModal)

- Toggle button to show/hide AI annotations
- Bounding boxes around detected damage
- Severity color coding (green/yellow/orange/red)
- Damage type labels
- Photo quality indicator

### 5.4 PredictionCard (ClaimDetails header)

- Settlement range bar (horizontal, shows 10th-90th percentile)
- Litigation risk gauge (circular, color-coded)
- Timeline estimate
- Carrier behavior tag

### 5.5 EvidenceGapAlert (Evidence section)

- Four category bars (property, damage, comms, financial)
- Green/yellow/red per category
- Expandable: specific items needed
- "Create task" shortcut per gap item

### 5.6 StatuteMatches (new tab in claim detail)

- Matched statutes with effective dates and source links
- Compliance deadline timeline
- Status badges (compliant, at-risk, overdue)
- "Last updated" timestamp from legal feed

### 5.7 NegotiationPlaybook (Comms section)

- Carrier position analysis
- Suggested talking points
- Comparable claim outcomes
- Draft counter-response (editable before sending)

### 5.8 ClaimPilotDashboard (admin page)

- Agent execution counts, success rates, avg confidence
- Approval rates per agent
- Time saved estimates
- Legal feed sync status and history

---

## 6. Build Phases

| Phase | Scope | Ships |
|-------|-------|-------|
| **1** | Shared infra (orchestrator, base agent, LLM router, approval gate, audit logger) + ClaimMonitor agent + ApprovalQueue UI | Foundation + immediate stall detection |
| **2** | VisionAnalyzer + VisionOverlay UI | Highest impact visual feature |
| **3** | IntakeParser + EvidenceScorer + EvidenceGapAlert UI | Speeds up claim start |
| **4** | StatuteMatcher + legal_feed.py + StatuteMatches UI | Compliance protection |
| **5** | NegotiationCopilot + NegotiationPlaybook UI | Extends comms-copilot |
| **6** | EstimateEngine + PredictiveAnalytics + PredictionCard UI | Requires data from earlier phases |
| **7** | ClaimPilotDashboard + ClaimPilotPanel sidebar + polish | Meta-monitoring layer |

Each phase is an independent PR. Each ships standalone value. No phase depends on a later phase.

---

## 7. Security & Compliance

- All agent outputs logged to `claimpilot_audit` with full input/output, user, timestamp
- No PII sent to external LLMs beyond what's necessary (Gemini/Groq privacy policies reviewed)
- Ollama fallback available for fully local processing of sensitive data
- All existing guardrails (legal promise detection, sensitive keyword flagging, prompt injection protection) inherited by every agent
- Role-based access: adjusters see own claims' insights, managers see all, admins see analytics
- Legal feed stores source URLs for every statute — full audit trail of which version was used
- IMPORTANT: Statute matching includes effective-date awareness. A statute amended after the loss date does not retroactively apply.

---

## 8. Testing Strategy

- Unit tests per agent (mock LLM responses, verify output schema)
- Integration tests for orchestrator → agent → approval gate flow
- E2E tests for critical paths (photo upload → vision score → display)
- Legal feed tests with mock scrape responses
- Guardrail tests (prompt injection, legal promise detection, confidence thresholds)
- Target: 80%+ coverage per phase

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Claim intake time | <3 minutes (from 15-30) |
| Stalled claims detected | 100% within 4 hours |
| Evidence completeness at negotiation | >85% (from ~60%) |
| Compliance deadline misses | Zero |
| Agent accuracy (human approval rate) | >80% within 30 days |
| Monthly LLM cost | $0 (free tier) |
