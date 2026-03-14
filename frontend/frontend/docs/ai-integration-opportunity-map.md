# Eden AI Integration Opportunity Map (Build-On, Non-Destructive)

## Scope and constraints
- Objective: add Anthropic/OpenAI capabilities without removing existing features.
- Existing AI foundation already present: `/api/ai/chat`, `/api/ai/task`, claim-context helpers, AI task telemetry (`/api/ai/task/metrics`).
- Strategy: keep current product flows intact and add AI as optional assistive layers.

## Current app surface scanned
Frontend modules observed:
- Claims, Claim Details, Claim Comms, Supplements, Documents, Contracts, Harvest/Canvassing, Battle Pass, Vision, University, Settings/Integrations, Voice Assistant Console, Property Intelligence, Scales, Notifications, MyCard, Client Portal.

Backend routes observed:
- `auth`, `claims`, `documents/uploads`, `contracts`, `supplements`, `harvest_v2`, `harvest_territories`, `battle_pass`, `mycard`, `vision_board`, `knowledge_base`, `weather`, `regrid`, `voice_assistant`, `twilio_voice`, `messaging_sms`, `oauth/integrations`, plus AI routes (`/api/ai/*`, `/api/ai/task*`).

## Cohesive AI opportunities by module

### 1) Claims + Claim Details (highest ROI)
- AI claim triage summary (severity, blockers, missing evidence, next best action).
- Coverage-risk detector from policy text + claim facts.
- Timeline normalizer from notes/messages/documents into "single source of truth" chronology.
- Intake quality checker with confidence score and required-field recommendations.

Why it fits:
- Claim context and notes already centralized.
- You already added claim brief endpoints and UI hooks.

Suggested providers:
- Anthropic for long-context reasoning and synthesis.
- OpenAI for fast UI assistant responses and structured extraction tasks.

### 2) Claim Communications (client/carrier)
- Draft generator with intent/tone presets, including legal-safe variants.
- Response improver: shorten, de-escalate, assertive, evidence-cited modes.
- Outbound quality gate: checks for missing claim number/date/policy references.
- Follow-up scheduler suggestions based on message history and stage.

Why it fits:
- `ClaimCommsPanel` exists; SMS and voice routes exist.

### 3) Documents + OCR + extraction hub
- Multi-document extraction packs (policy declarations, estimate totals, deductible, endorsements).
- Contradiction detector across adjuster estimate vs contractor estimate vs supplement.
- Auto-tagging + canonical naming recommendations for uploads.
- "Missing evidence" checklist generated after each upload batch.

Why it fits:
- Documents flow and upload routes already exist.
- AI extraction endpoint already present and can be expanded.

### 4) Supplements + Scales
- Line-item dispute reasoning generator with carrier-language variants.
- Pricing gap explanation mapped by category and urgency.
- Suggested supporting evidence to attach for each disputed item.
- Negotiation playbook snippets (short rebuttals + fallback arguments).

Why it fits:
- Supplement tracker and scales comparisons already in product.
- Structured inputs make this reliable for tool output.

### 5) Contracts (SignNow workflow)
- Clause explainer in plain language for reps/clients before signing.
- Autofill validation assistant (flags suspicious or missing merge fields).
- Pre-send compliance checks by jurisdiction template rules.
- Post-sign summary and obligations checklist extraction.

Why it fits:
- Contract creation/detail views are mature; AI can reduce errors without changing legal templates.

### 6) Harvest / Canvassing
- Route planning assistant based on recent disposition outcomes and territory density.
- "Next best action" recommendations after each pin outcome.
- Territory balancing suggestions for admins (load fairness + travel efficiency).
- Rep coaching snippets using streak/performance patterns.

Why it fits:
- Harvest endpoints include visits, territories, leaderboard, assistant hooks.
- Existing error-prone workflows benefit from guardrails and assistant recommendations.

### 7) Battle Pass / Incentives
- Personalized challenge generation from behavior patterns.
- Reward recommendations by rep segment (new rep, recovering streak, top performer).
- Burnout/risk signals and retention nudges for managers.

Why it fits:
- Existing battle pass and incentives engine routes are in place.

### 8) Vision module
- Journal synthesis: mood trend insights + weekly reflection summaries.
- Action planner from beliefs/wins/gratitude to daily commitments.
- Team-safe post rewriting (tone and privacy guardrails before share).

Why it fits:
- Vision already has journaling, team feed, and stats endpoints.

### 9) University / Knowledge Base
- Personalized learning path by role and current performance gaps.
- Auto-quiz generation from courses/articles.
- Contextual retrieval assistant grounded in internal content only.

Why it fits:
- University and KB APIs already have structured content and search routes.

### 10) Voice + SMS assistant
- Call summary + disposition extraction from transcripts.
- Suggested next message based on call outcome and claim stage.
- QA scoring for script adherence and compliance.

Why it fits:
- Twilio voice + voice assistant console + SMS APIs already exist.

### 11) MyCard
- Profile copy optimizer (headline, tagline, CTA) by audience segment.
- Review response drafting assistant (professional, concise, high-trust tone).
- Engagement analytics narratives (what changed this week and why).

Why it fits:
- MyCard has analytics, reviews, share tracking, and public profile routes.

### 12) Settings / Integrations / Admin ops
- Integration health copilot: diagnose token failures and suggest fix steps.
- Admin policy assistant for role/permission change impact preview.
- Automated incident summaries from CQIL/system health data.

Why it fits:
- Rich ops data already present (CQIL, integrations, voice console, settings).

## Cross-cutting architecture to keep both providers cohesive

### Provider routing policy (single gateway)
- Keep one gateway endpoint (`/api/ai/task`) and add task-level provider selection:
  - Anthropic default for deep reasoning/synthesis.
  - OpenAI default for extraction/structured output/low-latency chat.
- Add fallback chain + timeout budgets per task.

### Prompt + schema discipline
- For each AI task, enforce:
  - strict JSON schema output
  - explicit refusal/fallback behavior
  - deterministic post-validation (server-side)
- Store prompt versions per task for auditability.

### Safety and governance
- PII policy layer before model calls (redact where not required).
- Role-based permissions for high-impact AI actions.
- Human-in-the-loop on legal/financial outbound outputs.

### Observability and cost control
- Continue using `ai_task_logs`; expand with:
  - retries, timeout_count, cache_hit, token_budget_bucket
- Add monthly budget caps per provider + per task.
- Add quality score capture from user feedback (thumbs up/down + correction).

## Prioritized rollout (build-on)

### Phase A (1-2 weeks, fastest visible value)
1. Claims triage panel enhancements (existing brief endpoint).
2. Comms draft quality gate + rewrite modes.
3. Document missing-evidence checklist.

### Phase B (2-4 weeks, operations value)
4. Supplement dispute co-pilot with evidence suggestions.
5. Harvest territory/load balancing recommendations (admin only).
6. Voice transcript action extraction + next-step drafts.

### Phase C (4-6 weeks, strategic differentiation)
7. Personalized learning paths in University.
8. Incentives personalization and churn-risk nudges.
9. Vision weekly coaching summaries.

## Recommended Anthropic/OpenAI split
- Anthropic:
  - claim synthesis
  - long-form reasoning
  - complex supplement argument construction
  - strategic coaching outputs
- OpenAI:
  - structured extraction
  - low-latency draft generation
  - classification/tagging
  - short assistant interactions

## Immediate next implementation candidates
1. Upgrade `/api/ai/task` to support task-level provider policy + explicit JSON schema contracts.
2. Add frontend "AI confidence + source basis" block in Claims/Comms/Supplements outputs.
3. Add feedback capture (`accepted`, `edited`, `rejected`) to close the quality loop in telemetry.
