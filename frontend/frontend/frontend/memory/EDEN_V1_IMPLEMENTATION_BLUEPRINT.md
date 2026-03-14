# Eden V1 Release — Master Implementation Blueprint
## Care Claims Platform — Final 4-8 Week Execution Plan
**Generated: February 2026**

---

## 0. Short Overview

### What Eden Is Right Now

Eden is Care Claims' fully integrated claims management platform that consolidates CRM, field operations (Harvest D2D canvassing with gamification), AI assistance (Eve with GPT-4o and Florida statute knowledge), document capture (Rapid Capture with voice annotation), e-signatures (SignNow), and client communication into a single React + FastAPI + MongoDB web application. The platform has strong bones: a complete SMS infrastructure with Twilio ready to activate, three running bot workers (Harvest Coach, Claims Ops, Communication Assistant), a comprehensive gamification engine with badges and competitions, and solid test coverage. Current external-readiness is approximately 6.5/10.

### The 3 Biggest Blockers Preventing a Confident v1

1. **SMS Still in Dry-Run Mode** — The entire Twilio integration is built (6 templates, webhooks, rate limiting, chat UI) but `SMS_DRY_RUN=true`. Clients receive zero automated updates. This single flag flip, combined with real credentials, unlocks immediate value.

2. **Limited Client Self-Service** — Every "where's my claim?" inquiry requires adjuster intervention. The `/status/{claim_id}` endpoint exists but there's no public-facing, branded portal page. This creates bottleneck and poor client experience.

3. **Field Reliability/HTTPS Domain Uncertainty** — Harvest and Rapid Capture work in the preview environment but haven't been battle-tested on a production HTTPS domain (`app.careclaims.com`). Camera/GPS permissions behave differently on staging URLs, and there's no offline retry queue for poor network conditions.

---

## 1. Codebase Cleanup & Legacy Removal

### Why Cleanup Is Essential Now

Eden accumulated preview-era workarounds, experimental features, and inconsistent patterns during rapid development. Before pushing to production, we need to reduce surface area—fewer code paths mean fewer bugs, easier onboarding for future engineers, and more confidence during v1 launch. This isn't refactoring for its own sake; it's removing technical debt that could cause production incidents or confuse the team post-launch.

### Task List

| # | Area | Concrete Action | Expected Outcome |
|---|------|-----------------|------------------|
| 1 | `frontend` | Remove `DISABLE_VISUAL_EDITS=true` workaround from `/app/frontend/.env` and delete any code that checks this flag | Cleaner env file, one less conditional path, resolve recurring dev server crashes |
| 2 | `frontend` | Audit `/app/frontend/src/components/` for unused components not imported anywhere; delete stale files like any remaining `*Old.jsx` variants | Smaller bundle, no confusion about which component is active |
| 3 | `frontend` | Remove any remaining iframe detection logic remnants from `RapidCapture.jsx` (v2 fix already applied but confirm cleanup complete) | Camera works consistently across all contexts |
| 4 | `frontend` | Consolidate duplicate API fetch patterns into the existing `/app/frontend/src/lib/api.js` module; ensure all components use it | Consistent error handling, single place to add auth refresh |
| 5 | `frontend` | Remove hardcoded `localhost` URLs—search for `localhost:8001` or `localhost:3000` and replace with `REACT_APP_BACKEND_URL` | Works correctly when deployed to any domain |
| 6 | `backend` | Remove commented-out code blocks in routes (search for `# TODO`, `# DEPRECATED`, `# OLD`, `# HACK`) | Cleaner codebase, less confusion |
| 7 | `backend` | Consolidate datetime parsing into the `_parse_datetime` utility (already in `claims_ops_bot.py`); use it everywhere MongoDB dates are handled | No more `'str' object cannot be interpreted as integer` errors |
| 8 | `backend` | Move Gamma integration stub from `/app/backend/routes/gamma.py` into `/app/backend/integrations/gamma_client.py` or delete if not planned for v1 | Clear separation of concerns, honest about what's live |
| 9 | `backend` | Audit `/app/backend/routes/` for endpoints never called from frontend; mark deprecated or delete | Smaller API surface, less maintenance burden |
| 10 | `backend` | Standardize all route prefixes—ensure every router uses `/api/` consistently (audit `server.py` includes) | No routing surprises in production |
| 11 | `backend` | Standardize MongoDB query patterns: always use `{"_id": 0}` projection for API responses, always use `length=` parameter in `.to_list()` | No more ObjectId serialization errors |
| 12 | `infra` | Audit `/app/backend/.env` and `/app/frontend/.env` for unused variables; remove or document each | Cleaner configuration |
| 13 | `infra` | Add `IS_PREVIEW_ENV` environment variable; gate any remaining preview-specific behavior behind it | Explicit control over preview vs production behavior |
| 14 | `backend` | Review `/app/backend/services/` for unused service files (e.g., `gamma_service.py` if Gamma deferred); consolidate or delete | Smaller codebase, clearer what's active |

---

## 2. Unified Communication & Notification Model

### Model Explanation

Eden currently has three separate but related systems:
- **SMS (`messages` collection)**: Per-claim SMS with Twilio, 6 templates, webhooks, rate limiting
- **Notifications (`notifications` collection)**: Bell UI with types `harvest_coach`, `claims_ops`, `comms_bot`, `claim_assigned`, `claim_created`
- **Planned AI Receptionist**: Will add voice call logs

These need to be unified so every client interaction—SMS, call, email, in-app notification—follows the same model and appears in a single claim timeline.

**Communication Event Schema:**
```javascript
{
  "id": "uuid",
  "claim_id": "uuid | null",           // null for non-claim communications
  "user_id": "uuid",                    // internal user this relates to
  "channel": "sms | call | email | in_app",
  "direction": "inbound | outbound | system",
  "from": "string | null",              // phone/email for external
  "to": "string | null",                // phone/email for external
  "body": "string",                     // message content or transcript
  "status": "queued | sent | delivered | failed | received",
  "metadata": {
    "provider_id": "twilio_sid",        // e.g., "SMxxxxxx" for Twilio
    "template_key": "fnol_created",     // which template was used
    "call_duration_seconds": 120,       // for voice calls
    "ai_draft": true,                   // was this AI-generated?
    "human_approved": true,             // was it approved before send?
    "audit_id": "uuid"                  // link to ai_audit collection
  },
  "created_by": "user_id | system | bot_name",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

**Notification Type Enum (Constrained):**
- `harvest_coach` — Harvest performance nudges and recaps
- `claims_ops` — Stale claims, high-value alerts, daily focus lists
- `comms_bot` — Inbound message alerts, suggested replies
- `system` — Claim assigned, claim created, status changes, appointments

**Bell UI Mapping:**
- **Desktop:** Dropdown popover showing last 10 notifications, grouped by type with icons
- **Mobile:** Full-screen modal with infinite scroll, filter by type tabs
- **All types:** Share the same `title`, `body`, `cta_label`, `cta_route` structure for consistency

### Feature Mapping to Unified Model

| Current Feature | Channel | Direction | Notification Type | Notes |
|-----------------|---------|-----------|-------------------|-------|
| SMS send (user-initiated) | `sms` | `outbound` | — | User sends from ClaimCommsPanel |
| SMS send (auto-trigger) | `sms` | `outbound` | — | FNOL, appointment, payment templates |
| SMS inbound (webhook) | `sms` | `inbound` | `comms_bot` | Creates notification for adjuster |
| Harvest Coach nudge | `in_app` | `system` | `harvest_coach` | Streak warnings, competition alerts |
| Harvest Coach recap | `in_app` | `system` | `harvest_coach` | Nightly summary |
| Claims Ops alert | `in_app` | `system` | `claims_ops` | Stale claims, high-value |
| Claims Ops focus list | `in_app` | `system` | `claims_ops` | Daily prioritized list |
| Comms Bot suggestion | `in_app` | `system` | `comms_bot` | Draft reply notification |
| AI Receptionist call | `call` | `inbound` | `comms_bot` | Future: transcribed call log |
| Claim created | `in_app` | `system` | `system` | Existing notification |
| Claim assigned | `in_app` | `system` | `system` | Existing notification |
| Appointment scheduled | `in_app` | `system` | `system` | New: calendar event notification |

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create unified `communication_events` collection schema | Add indexes on `claim_id + created_at`, `user_id + channel`, `metadata.provider_id` for fast queries |
| 2 | Write migration script for `messages` → `communication_events` | Transform existing records; keep `messages` as read-only alias for 2 weeks |
| 3 | Update `/app/backend/routes/messaging_sms.py` to write to `communication_events` | Change insert/update queries; maintain backward-compatible API responses |
| 4 | Update `ClaimCommsPanel.jsx` to read from unified endpoint | API stays same URL, but backend uses new collection |
| 5 | Add `channel` filter to `GET /api/claims/{id}/messages` | Allow `?channel=sms&channel=call` query params to filter |
| 6 | Update notification helpers to enforce `notification_type` enum | Modify `create_notification()` in routes to validate allowed values |
| 7 | Create "View All" notifications page at `/notifications` | Frontend: new page component with type filter buttons, infinite scroll |
| 8 | Prepare `call` channel schema fields for AI Receptionist | Add `call_duration_seconds`, `recording_url`, `transcript` to metadata spec |
| 9 | Add audit logging for AI-drafted vs human-sent messages | Store `metadata.ai_draft` and `metadata.human_approved` flags; link `audit_id` |

---

## 3. Field Experience Hardening (Harvest + Rapid Capture)

### Why Production HTTPS Domain, Camera/GPS Reliability, and Offline Tolerance Are Crucial

Eden's differentiation is that adjusters can do everything from their phone in the field—drop pins while canvassing, capture annotated photos during inspections, sign contracts on the spot, text clients. If any of these fail due to camera permissions, GPS errors, or network dropouts, adjusters lose trust and fall back to disconnected tools (pen and paper, personal phone texting, desktop-only uploads). Field reliability is make-or-break for Care Claims adoption. The preview URL's permission quirks and the lack of retry logic for spotty cellular coverage are real risks.

### Domain & Environment Guards

Production Eden should run on a stable HTTPS domain (e.g., `app.careclaims.com`). Camera and GPS permissions behave differently on staging/preview URLs, and Safari is especially strict.

**Tasks:**

| # | Task | Details |
|---|------|---------|
| 1 | Add `PRODUCTION_DOMAIN` env variable | Set to `app.careclaims.com` (or client's chosen domain) in production `.env` |
| 2 | Create `useEnvironmentGuard` React hook | Log warning to console if `window.location.hostname` doesn't match expected domain; show non-blocking "Preview Mode" banner in dev/staging |
| 3 | Gate camera/GPS features with domain check | If not on production domain, show "Preview Mode" indicator on Rapid Capture and Harvest; don't silently fail—explain limitations |

### Playwright E2E Tests for Key Flows

Expand the existing E2E suite with these specific flows to catch regressions:

**Rapid Capture Flow:**
1. Login → Navigate to claim details → Click "Rapid Capture" button
2. Select room/category → Grant camera permission (mock in test)
3. Take photo → Verify photo appears in session grid with thumbnail
4. Add voice annotation → Verify transcription appears (mock Whisper response)
5. Complete session → Verify photos appear in claim's Documents tab

**Harvest Flow:**
1. Login → Navigate to `/canvassing`
2. Map tab: Verify map loads with user's GPS dot (mock geolocation)
3. Drop pin: Tap map → Fill disposition form (NH/NI/CB/AP/SG/DNK) → Submit
4. Today tab: Verify door count incremented, points awarded
5. Profile tab: Verify points updated, streak displayed, badge progress

**Tasks:**

| # | Task | Details |
|---|------|---------|
| 1 | Create `/app/frontend/e2e/rapid-capture-full.spec.js` | Test session start, photo capture (mocked getUserMedia), voice annotation (mocked Whisper), session completion |
| 2 | Create `/app/frontend/e2e/harvest-full-flow.spec.js` | Test pin drop → stats update → profile reflection → streak calculation |
| 3 | Add geolocation mock helper to `/app/frontend/e2e/helpers.js` | Consistent GPS mocking: `context.grantPermissions(['geolocation']); await page.evaluate(() => { ... })` |
| 4 | Add camera permission mock helper | Playwright can mock `navigator.mediaDevices.getUserMedia` to return test video stream |
| 5 | Test on iPhone SE viewport (375x667) | Ensure all flows work on smallest supported screen; catch overflow/tap target issues |
| 6 | Test offline banner appearance | Mock `navigator.onLine = false`, verify UI shows offline state, queue indicator |

### Network Failure & Retry Handling

**Pattern:** Use a simple retry queue for critical operations (photo uploads, SMS sends, pin drops). Queue persists to `localStorage` so it survives app restart.

```javascript
// Conceptual pattern
const retryQueue = {
  add: (operation, maxRetries = 3) => { /* queue with exponential backoff */ },
  process: () => { /* attempt queued operations when online */ },
  persist: () => { /* save to localStorage for app restart */ },
  getCount: () => { /* return number of pending items */ }
};
```

**Tasks:**

| # | Task | Details |
|---|------|---------|
| 1 | Create `useRetryQueue` hook in `/app/frontend/src/hooks/` | Manage failed operations with localStorage persistence; expose `add`, `process`, `pending` |
| 2 | Wrap photo upload in retry queue | On upload failure (network error, not validation), queue for retry; show "Pending upload (X)" indicator in Rapid Capture |
| 3 | Wrap SMS send in retry queue | On Twilio failure (network, not validation), queue for retry; show "Message queued" in ClaimCommsPanel |
| 4 | Create offline banner component | Show red banner when `navigator.onLine` is false; hide when back online; trigger queue processing on reconnect |
| 5 | Test retry behavior in E2E | Mock network failure → verify queue persists → restore network → verify retry succeeds |

---

## 4. Centralized AI Surfaces & Guardrails

### Philosophy

AI in Eden is an **assistant, not an autonomous agent**. It drafts, suggests, and analyzes—but never sends messages, makes commitments, or provides legal advice without human approval. Every AI-generated output must be clearly labeled and require explicit user confirmation before becoming a real action. This protects Care Claims legally and maintains client trust. No AI output should ever claim to be "guaranteed" or "legally binding" advice.

### Shared AI Service/Module Spec

Instead of Eve, Comms Bot, and AI Receptionist each having their own prompt logic scattered across files, create a single `AIService` module that all AI surfaces call:

**Inputs:**
```python
class AIRequest(BaseModel):
    prompt_type: str  # "eve_conversation", "draft_sms_reply", "call_summary", "claim_strategy"
    claim_context: dict | None  # claim_id, status, client_name, history, loss_type
    user_message: str | None  # for conversation types
    channel: str  # "chat", "sms", "voice"
    user_id: str  # for audit
    additional_context: dict | None  # any extra data (e.g., inbound SMS body)
```

**Outputs:**
```python
class AIResponse(BaseModel):
    draft_text: str
    confidence: float  # 0.0-1.0, based on context clarity
    warnings: list[str]  # e.g., ["Contains potential legal advice", "High uncertainty"]
    suggested_actions: list[str] | None  # e.g., ["Schedule follow-up", "Request photos"]
    requires_human_approval: bool  # always True for outbound communications
    audit_id: str  # for logging/retrieval
```

**Guardrails (implemented in shared layer):**
- `strip_legal_promises()` — Remove text like "We guarantee...", "You will receive...", "This is legal advice..."
- `flag_sensitive_content()` — Detect keywords: lawsuit, attorney, fraud, bad faith, sue
- Add disclaimer if confidence < 0.7
- Never auto-send anything; always return draft for human approval
- Truncate responses exceeding reasonable length (500 chars for SMS drafts)
- Timeout fallback if LLM takes >10 seconds

**Why Eve, Comms Bot, and AI Receptionist Must Use This Layer:**
Centralizing prompt construction and response processing ensures consistent behavior, makes it trivial to update guardrails globally, and simplifies auditing. When regulations change or new edge cases emerge, one file fixes all AI surfaces.

### Audit & Logging Pattern

Every AI interaction should be logged to `ai_audit` collection:
```python
{
    "audit_id": "uuid",
    "prompt_type": "draft_sms_reply",
    "input_hash": "sha256 of input for deduplication",
    "output_text": "draft text (truncated if >1000 chars)",
    "confidence": 0.85,
    "warnings": [],
    "user_id": "adjuster_id",
    "claim_id": "claim_id or null",
    "human_approved": True | False | None,  # set when user sends or dismisses
    "sent_at": "ISO datetime | null",  # when actually sent
    "created_at": "ISO datetime"
}
```

This ties into the unified communication model—when a draft is approved and sent, link `audit_id` in `communication_events.metadata`.

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `/app/backend/services/ai_service.py` with `AIRequest`/`AIResponse` models | Central module for all AI calls; import Emergent LLM client here |
| 2 | Implement guardrail functions: `strip_legal_promises()`, `flag_sensitive_content()` | Reusable safety checks; return modified text + warnings list |
| 3 | Create `ai_audit` MongoDB collection with TTL index | Store all AI interactions; 90-day retention; index on `user_id`, `claim_id`, `created_at` |
| 4 | Migrate Eve AI (`/app/backend/routes/ai.py`) to use shared AI layer | Replace direct Emergent calls with `AIService.generate()`; preserve conversation history logic |
| 5 | Migrate Comms Bot (`/app/backend/workers/comms_bot.py`) to use shared AI layer | Standardize draft generation; use same guardrails |
| 6 | Add "AI Draft" indicator in `ClaimCommsPanel.jsx` | Show badge/label when message came from AI suggestion |
| 7 | Add "Approve & Send" flow for AI drafts | User must click to send; no auto-send; show draft in editable textarea |
| 8 | Prepare AI Receptionist interface in shared layer | Define `prompt_type="call_summary"` and `prompt_type="call_response"` templates |
| 9 | Add confidence threshold config | `AI_CONFIDENCE_THRESHOLD=0.7` in `.env`; add to frontend display |
| 10 | Create AI audit dashboard endpoint | `GET /api/admin/ai-audit` for reviewing AI interactions; filterable by date, user, claim |

---

## 5. Twilio Production Activation (SMS Live)

### Production Activation Plan & Safety Considerations

Eden already has Twilio SMS integrated in dry-run mode with 6 branded templates, inbound webhooks, and rate limiting (10 SMS/claim/hour). The goal is to **wire real production credentials and go live safely**.

**Safety Considerations:**
- **Logging:** Every SMS send (success/failure) logged with Twilio SID
- **Monitoring:** Track delivery rates via Twilio dashboard; alert on >5% failure rate
- **Rate Limits:** Keep existing 10 SMS/claim/hour to prevent spam complaints
- **Opt-Out:** Respect STOP/UNSUBSCRIBE replies (Twilio handles automatically)
- **Rollout:** Start with internal test numbers, then pilot clients, then all

**Important: Do not hard-code any secrets.** Use these environment variables (already defined in `.env`):

```env
TWILIO_ACCOUNT_SID=         # Live Account SID from Twilio Console
TWILIO_AUTH_TOKEN=          # Live Auth Token from Twilio Console
TWILIO_MESSAGING_SERVICE_SID=  # Messaging Service SID (preferred, handles opt-out)
TWILIO_FROM_NUMBER=         # Fallback: Eden's SMS-enabled Twilio phone number
SMS_DRY_RUN=false           # Flip to false to enable real sends
SMS_WEBHOOK_SECRET=         # Secret for validating Twilio webhook signatures
```

### Schema/Config Updates

| # | Task | Details |
|---|------|---------|
| 1 | Ensure all Twilio clients read from env variables | Audit `/app/backend/services/sms_twilio.py`; no hardcoded SIDs |
| 2 | Centralize Twilio config in one place | Create `get_twilio_config()` helper; no scattered `os.environ.get()` |
| 3 | Add validation on startup | If `SMS_DRY_RUN=false` but credentials missing, log error and refuse to start SMS sends |

### Dry-Run → Live Switch Pattern

**Behavior of `SMS_DRY_RUN`:**
- **When `true` (current):** Log message details, store in `messages` collection with `provider_message_id: "dry-run-{timestamp}"`, show in UI, but do NOT call Twilio's send API
- **When `false` (production):** Call Twilio API, store actual `provider_message_id` (Twilio SID), track delivery status via webhook

**Safe Rollout Procedure:**
1. **Week 1:** Set `SMS_DRY_RUN=false` in staging; send to team members' personal phones only
2. **Week 2:** Send to 10 pilot clients (select claims manually)
3. **Week 3:** Enable for all new claims (FNOL auto-trigger)
4. **Week 4:** Enable for existing claims (appointment, payment triggers)

### Monitoring & Error Handling

| # | Task | Details |
|---|------|---------|
| 1 | Add basic metrics logging | Log send volume, failures, delivery status per hour; output to backend logs |
| 2 | Add per-claim rate limit enforcement | Already exists (10/hour); verify it blocks and returns error message |
| 3 | Handle Twilio errors gracefully | On failure, mark message `status: "failed"`, store `error_code`, show in UI |
| 4 | Add webhook URL validation | Ensure `/api/sms/twilio/webhook` is accessible from internet; test with Twilio debugger |

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Obtain Twilio production credentials | User provides Account SID, Auth Token, phone number or Messaging Service SID |
| 2 | Wire environment variables into backend | Update `/app/backend/.env` with real values |
| 3 | Update SMS service to respect `SMS_DRY_RUN` flag | Already implemented; verify behavior |
| 4 | Confirm webhook URL for inbound + status | Set in Twilio Console: `https://{production_domain}/api/sms/twilio/webhook` |
| 5 | Add/update unit tests for SMS service | Mock Twilio client; test send, webhook, rate limit |
| 6 | Create integration test script | Manual: send real SMS to test phone, verify delivery, reply, check webhook |
| 7 | Document Twilio setup in README | Steps for future devs to configure Twilio |

---

## 6. Release-Critical Outcomes (Next 4-8 Weeks)

### Flagship Outcomes

**Outcome 1: Clients receive proactive, automated SMS updates at key claim milestones without adjuster effort.**

Supporting Tasks:
1. Obtain Twilio production credentials and set `SMS_DRY_RUN=false`
2. Wire appointment scheduling events to auto-SMS (`appointment_scheduled` template)
3. Wire payment issuance events to auto-SMS (`payment_issued` template)
4. Add 24-hour appointment reminder trigger (cron job or scheduler task)
5. Test full SMS flow end-to-end with real phone number
6. Monitor delivery rates via Twilio dashboard for first 2 weeks

---

**Outcome 2: Every client can self-check claim status via a branded portal, reducing "where is my claim?" calls.**

Supporting Tasks:
1. Create `/status/{claim_id}` public page component (no auth required)
2. Build timeline view showing major milestones (created → inspection → negotiation → settlement → closed)
3. Add Care Claims branding (logo, colors, contact info, disclaimer)
4. Generate unique status link per claim; include in FNOL SMS template
5. Add "Check Your Claim Status" CTA button in all SMS templates

---

**Outcome 3: Field adjusters can rely on Harvest and Rapid Capture to work consistently on a stable production HTTPS domain.**

Supporting Tasks:
1. Deploy to `app.careclaims.com` (or chosen domain) with SSL certificate
2. Implement domain guards and "Preview Mode" indicators
3. Add retry queue for photo uploads and pin drops (network resilience)
4. Run full E2E test suite on production domain
5. Test on 3+ real devices (iPhone SE, iPhone 14, Android phone)
6. Document known limitations for field team

---

**Outcome 4: All AI suggestions (Eve, Comms Bot, future voice) run through a single guardrailed layer and are always human-approved before sending.**

Supporting Tasks:
1. Implement shared AI service with guardrails in `/app/backend/services/ai_service.py`
2. Migrate Eve AI to use shared layer
3. Migrate Comms Bot to use shared layer
4. Add AI audit logging to `ai_audit` collection
5. Add "Approve & Send" flow in UI for all AI drafts
6. Review first 50 AI drafts manually for quality and safety

---

**Outcome 5: Adjusters have a single, unified view of all client communications (SMS, future calls) on each claim.**

Supporting Tasks:
1. Implement unified `communication_events` schema
2. Write migration script for existing `messages` collection
3. Update `ClaimCommsPanel.jsx` to show all channels
4. Add channel filter pills (All / SMS / Calls / Email)

---

### "Not Now" List (De-prioritized for v1)

These features are valuable but not blocking a confident v1 release:

- **Gamma presentation integration** — Nice-to-have but clients don't need auto-generated decks for v1
- **iMessage Business Chat** — Requires Apple approval process (weeks); SMS is sufficient for v1
- **White-label/multi-tenant** — Care Claims is the only customer for now
- **Advanced analytics dashboard** — Basic stats exist in claims list; deep analytics can wait
- **Native iOS/Android apps** — PWA is sufficient for v1; App Store distribution can come later
- **AI Receptionist (voice calls)** — Infrastructure prepped but not blocking v1
- **Document OCR/AI categorization** — Manual document review is fine for v1 volume
- **Carrier portal integration** — Manual submission to carriers continues
- **Weather overlay on Harvest map** — Nice visualization but not essential

---

## 7. Final 4-8 Week Execution Checklist

| # | Title | Area | Description | Dependencies |
|---|-------|------|-------------|--------------|
| 1 | **Obtain Twilio production keys** | `infra` | Get Account SID, Auth Token, phone number or Messaging Service SID from Twilio console | None |
| 2 | **Set SMS_DRY_RUN=false** | `infra` | Flip env variable in `/app/backend/.env` to enable real SMS sending | After #1 |
| 3 | **Test SMS end-to-end with real phone** | `product` | Send test message, verify delivery, test inbound reply via webhook | After #2 |
| 4 | **Deploy to app.careclaims.com** | `infra` | Configure DNS, SSL certificate, deploy frontend + backend | None |
| 5 | **Add domain guards for preview mode** | `frontend` | Create `useEnvironmentGuard` hook, show banner if not on production domain | After #4 |
| 6 | **Wire appointment events to auto-SMS** | `backend` | Connect appointment scheduling to `send_appointment_sms()` in claims/calendar routes | After #2 |
| 7 | **Wire payment events to auto-SMS** | `backend` | Connect payment issuance to `send_payment_sms()` (needs payment webhook/event) | After #2 |
| 8 | **Create client status portal page** | `frontend` | Build `/status/{claim_id}` component with timeline, Care Claims branding, no auth required | None |
| 9 | **Add status link to FNOL SMS template** | `backend` | Update template to include `{status_link}` variable pointing to portal | After #8 |
| 10 | **Implement retry queue for uploads** | `frontend` | Create `useRetryQueue` hook, wrap photo uploads in Rapid Capture | None |
| 11 | **Add offline banner component** | `frontend` | Show when `navigator.onLine` is false; trigger queue processing on reconnect | None |
| 12 | **Create Rapid Capture E2E test** | `frontend` | Test full session flow with mocked camera and Whisper | None |
| 13 | **Create Harvest full-flow E2E test** | `frontend` | Test pin drop → stats → profile with mocked GPS | None |
| 14 | **Run E2E suite on production domain** | `infra` | Execute all Playwright tests against `app.careclaims.com` | After #4 |
| 15 | **Test on 3+ real devices** | `product` | iPhone SE, iPhone 14, Android phone, iPad—document any issues | After #4 |
| 16 | **Create unified communication_events schema** | `backend` | Add collection with indexes, define TypedDict/Pydantic model | None |
| 17 | **Migrate messages to communication_events** | `backend` | Write and run migration script; keep `messages` as alias temporarily | After #16 |
| 18 | **Update ClaimCommsPanel for unified model** | `frontend` | Read from new endpoint (same URL), add channel filter pills | After #17 |
| 19 | **Create shared AI service** | `backend` | Implement `/app/backend/services/ai_service.py` with guardrails | None |
| 20 | **Migrate Eve AI to shared layer** | `backend` | Replace direct Emergent calls in `/app/backend/routes/ai.py` | After #19 |
| 21 | **Migrate Comms Bot to shared layer** | `backend` | Update `/app/backend/workers/comms_bot.py` to use `AIService` | After #19 |
| 22 | **Add AI audit logging** | `backend` | Create `ai_audit` collection, log all AI interactions | After #19 |
| 23 | **Add "Approve & Send" UI for AI drafts** | `frontend` | Show AI badge in ClaimCommsPanel, require click to send | After #21 |
| 24 | **Cleanup: Remove legacy code** | `both` | Execute cleanup tasks from Section 1 (delete unused files, consolidate patterns) | None |
| 25 | **Cleanup: Standardize datetime parsing** | `backend` | Use `_parse_datetime` utility everywhere MongoDB dates are handled | None |
| 26 | **Cleanup: Remove unused env variables** | `infra` | Audit and clean `/app/backend/.env` and `/app/frontend/.env` | None |
| 27 | **Update notification type enum** | `backend` | Enforce allowed values in `create_notification()` helper | None |
| 28 | **Add "View All" notifications page** | `frontend` | Create `/notifications` route with type filters, infinite scroll | None |
| 29 | **Manual QA pass on all flows** | `product` | Walk through every major user journey on production, document issues | After #14 |
| 30 | **v1 Launch readiness review** | `product` | Final checklist: SMS live, portal works, field flows tested, AI guardrailed | After all above |

---

## Execution Notes

### Parallelization Tracks

These task groups can proceed in parallel:

- **Track A (SMS/Twilio):** Tasks 1-3, 6-7, 9
- **Track B (Domain/Deploy):** Tasks 4-5, 14-15
- **Track C (Client Portal):** Task 8
- **Track D (Offline/Retry):** Tasks 10-11
- **Track E (E2E Tests):** Tasks 12-13
- **Track F (Unified Model):** Tasks 16-18
- **Track G (AI Layer):** Tasks 19-23
- **Track H (Cleanup):** Tasks 24-28

### Critical Path

The longest chain is:
`Obtain Twilio keys (1)` → `Set dry-run=false (2)` → `Test SMS (3)` → `Wire appointment/payment (6-7)` → `Add status link to FNOL (9)`

This unlocks the highest-value outcome (automated client updates) and should start immediately once credentials are available.

### Risk Mitigation

- **Test on real devices early (week 2)** — Don't wait until the end to discover mobile issues
- **Internal SMS testing first** — Send to team phones before any client numbers
- **Backup plan for Twilio issues** — Keep `SMS_DRY_RUN=true` ready to flip back

### Team Size Estimate

- **1 strong full-stack developer:** 6-8 weeks
- **2 developers (1 frontend, 1 backend):** 4 weeks
- **With QA support:** Subtract 1 week from testing time

---

## Summary

This blueprint takes Eden from ~6.5/10 external-readiness to a confident ~9/10 v1 release by:

1. **Activating SMS** — Clients get proactive updates immediately
2. **Building client portal** — Self-service reduces support burden
3. **Hardening field flows** — Adjusters trust the app in the wild
4. **Centralizing AI** — Safe, auditable, consistent AI assistance
5. **Cleaning up codebase** — Maintainable foundation for year 2

No major architecture changes. No new product areas invented. Just trimming, hardening, and shipping what already exists.

---

*Care Claims, Inc. — Stewardship and Excellence in Claims Handling*
