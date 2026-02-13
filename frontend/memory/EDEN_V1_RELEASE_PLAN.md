# Eden Master Refactor, Hardening, and Release-Readiness Plan
## Care Claims Platform — 4-8 Week Implementation Plan
**Generated: February 5, 2026**

---

## 0. Very Short Overview

**What is Eden right now?**
Eden is Care Claims' integrated claims management platform that consolidates CRM, field operations (Harvest D2D canvassing), AI assistance (Eve), document capture (Rapid Capture), e-signatures (SignNow), and client communication into a single web application. The platform has strong bones—React + FastAPI + MongoDB architecture, working gamification, live bots, and a complete SMS infrastructure ready to activate.

**The 3 biggest things holding Eden back from a confident v1 release:**
1. **SMS still in dry-run mode** — The entire Twilio integration is built but not live; clients don't receive automated updates
2. **No client self-service portal** — Every status inquiry requires adjuster intervention, creating bottleneck and poor client experience
3. **Field reliability uncertainty** — Harvest and Rapid Capture work in preview environments but haven't been hardened for production HTTPS domain, offline scenarios, and real-world network conditions

---

## 1. Codebase Cleanup & Legacy Removal

### Why Cleanup Matters Now
Eden has accumulated preview-era workarounds, experimental features, and inconsistent patterns during rapid development. Before pushing to production, we need to reduce surface area—fewer code paths mean fewer bugs, easier onboarding for future engineers, and more confidence during the v1 launch. This is not refactoring for its own sake; it's removing technical debt that could cause production incidents.

### Task List

| # | Area | Concrete Action | Expected Outcome |
|---|------|-----------------|------------------|
| 1 | `frontend` | Remove `DISABLE_VISUAL_EDITS=true` workaround from `.env` and delete any code that checks this flag | Cleaner env file, one less conditional path |
| 2 | `frontend` | Delete old Harvest v1 components if any exist (`HarvestPageOld.jsx`, `CanvassingMap.jsx` legacy) | Smaller bundle, no confusion about which component is active |
| 3 | `frontend` | Remove iframe detection logic remnants from `RapidCapture.jsx` (already partially done) | Camera works consistently across all contexts |
| 4 | `frontend` | Audit `src/components/` for unused components; delete any not imported anywhere | Reduced code surface |
| 5 | `frontend` | Consolidate duplicate API fetch patterns into a single `useApi` hook or utils file | Consistent error handling, easier to add auth refresh |
| 6 | `backend` | Remove commented-out code blocks in routes (search for `# TODO`, `# DEPRECATED`, `# OLD`) | Cleaner codebase, less confusion |
| 7 | `backend` | Consolidate datetime parsing into a single utility (already started with `_parse_datetime` in claims_ops_bot) | No more `'str' object cannot be interpreted as integer` errors |
| 8 | `backend` | Move Gamma integration stub from `routes/gamma.py` into `integrations/gamma_client.py` or delete if not planned for v1 | Clear separation, honest about what's live |
| 9 | `backend` | Audit `routes/` for endpoints that are never called from frontend; mark or delete | Smaller API surface |
| 10 | `backend` | Standardize all route prefixes (ensure every router uses `/api/` consistently) | No routing surprises in production |
| 11 | `infra` | Remove any hardcoded localhost URLs in code (use `REACT_APP_BACKEND_URL` everywhere) | Works correctly when deployed to any domain |
| 12 | `infra` | Audit `.env` files for unused variables; remove or document each | Cleaner configuration |
| 13 | `infra` | Add `IS_PREVIEW_ENV` environment variable; gate any remaining preview-specific behavior behind it | Explicit control over preview vs production behavior |
| 14 | `backend` | Standardize MongoDB query patterns: always use `{"_id": 0}` projection, always use `length=` parameter in `.to_list()` | No more ObjectId serialization errors |

---

## 2. Unified Communication & Notification Model

### Current State
Eden has three separate but related systems:
- **SMS (messages collection)**: Per-claim SMS with Twilio, 6 templates, webhooks
- **Notifications (notifications collection)**: Bell UI with types `harvest_coach`, `claims_ops`, `comms_bot`, `claim_assigned`, `claim_created`
- **Planned AI Receptionist**: Will add voice call logs

These need to be unified so every client interaction—SMS, call, email, in-app notification—follows the same model and appears in a single timeline.

### Model Explanation

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
    "provider_id": "twilio_sid",
    "template_key": "fnol_created",
    "call_duration_seconds": 120,
    "ai_draft": true,
    "human_approved": true
  },
  "created_by": "user_id | system | bot_name",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

**Notification Type Enum:**
- `harvest_coach` — Harvest performance nudges and recaps
- `claims_ops` — Stale claims, high-value alerts, daily focus lists
- `comms_bot` — Inbound message alerts, suggested replies
- `system` — Claim assigned, claim created, status changes

**Bell UI Mapping:**
- Desktop: Dropdown popover showing last 10 notifications grouped by type
- Mobile: Full-screen modal with infinite scroll, filter by type
- All types share the same `title`, `body`, `cta_label`, `cta_route` structure

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

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create unified `communication_events` collection schema | Add indexes on `claim_id + created_at`, `user_id + channel`, `metadata.provider_id` |
| 2 | Migrate `messages` collection to `communication_events` | Write migration script; keep `messages` as alias for 2 weeks |
| 3 | Update `messaging_sms.py` to write to `communication_events` | Change insert/update queries, maintain backward-compatible API responses |
| 4 | Update `ClaimCommsPanel.jsx` to read from unified endpoint | API stays same, but backend uses new collection |
| 5 | Add `channel` filter to GET `/api/claims/{id}/messages` | Allow `?channel=sms&channel=call` to filter |
| 6 | Update notification helpers to use standardized `notification_type` enum | Enforce allowed values in `create_notification()` |
| 7 | Add "View All" page at `/notifications` with type filters | Frontend: new page component with filter buttons |
| 8 | Prepare `call` channel schema for AI Receptionist | Add fields for `call_duration_seconds`, `recording_url`, `transcript` |
| 9 | Add audit logging for AI-drafted vs human-sent messages | Store `metadata.ai_draft` and `metadata.human_approved` |

---

## 3. Field Experience Hardening (Harvest + Rapid Capture)

### Why Field Reliability Matters
Eden's differentiation is that adjusters can do everything from their phone in the field—drop pins while canvassing, capture annotated photos during inspections, sign contracts on the spot. If any of these fail due to camera permissions, GPS errors, or network issues, adjusters lose trust and fall back to disconnected tools. Field reliability is the make-or-break for Care Claims adoption.

### Domain & Environment Guards

Production Eden should run on a stable HTTPS domain (e.g., `app.careclaims.com`). Camera and GPS permissions behave differently on staging/preview URLs, so we need explicit guards.

**Tasks:**
| # | Task | Details |
|---|------|---------|
| 1 | Add `PRODUCTION_DOMAIN` env variable | Set to `app.careclaims.com` in production |
| 2 | Create `useEnvironmentGuard` hook | Log warning if `window.location.hostname` doesn't match expected domain; show non-blocking banner in dev |
| 3 | Gate camera/GPS features with domain check | If not on production domain, show "Preview Mode" indicator; don't silently fail |

### Playwright E2E Tests

Expand the existing E2E suite with these specific flows:

**Rapid Capture Flow:**
1. Login → Navigate to claim → Click "Rapid Capture" button
2. Start new session → Grant camera permission (mock in test)
3. Take photo → Verify photo appears in session grid
4. Add voice annotation → Verify transcription appears (mock Whisper response)
5. Complete session → Verify photos appear in claim's Documents tab

**Harvest Flow:**
1. Login → Navigate to `/canvassing`
2. Map tab: Verify map loads with user's GPS dot (mock geolocation)
3. Drop pin: Tap map → Fill disposition form → Submit
4. Today tab: Verify door count incremented
5. Profile tab: Verify points updated, streak displayed

**Tasks:**
| # | Task | Details |
|---|------|---------|
| 1 | Create `e2e/rapid-capture.spec.js` | Test session start, photo capture (mocked), annotation, completion |
| 2 | Create `e2e/harvest-full-flow.spec.js` | Test pin drop → stats update → profile reflection |
| 3 | Add geolocation mock helper to `e2e/helpers.js` | Consistent GPS mocking across tests |
| 4 | Add camera permission mock helper | Playwright can mock `getUserMedia` |
| 5 | Test on iPhone SE viewport | Ensure all flows work on smallest supported screen |
| 6 | Test offline banner appearance | Mock `navigator.onLine = false`, verify UI shows offline state |

### Network Failure & Retry Handling

**Pattern:** Use a simple retry queue for critical operations (photo uploads, SMS sends, pin drops).

```javascript
// Conceptual pattern
const retryQueue = {
  add: (operation, maxRetries = 3) => { /* queue with exponential backoff */ },
  process: () => { /* attempt queued operations when online */ },
  persist: () => { /* save to localStorage for app restart */ }
};
```

**Tasks:**
| # | Task | Details |
|---|------|---------|
| 1 | Create `useRetryQueue` hook in frontend | Manage failed operations with localStorage persistence |
| 2 | Wrap photo upload in retry queue | On upload failure, queue for retry; show "Pending upload" indicator |
| 3 | Wrap SMS send in retry queue | On Twilio failure (not validation error), queue for retry |
| 4 | Add offline banner component | Show when `navigator.onLine` is false; hide when back online |
| 5 | Test retry behavior in E2E | Mock network failure → verify queue → restore network → verify retry succeeds |

---

## 4. Centralized AI Surfaces & Guardrails

### Philosophy
AI in Eden is an **assistant, not an autonomous agent**. It drafts, suggests, and analyzes—but never sends messages, makes commitments, or provides legal advice without human approval. Every AI-generated output must be clearly labeled and require explicit user confirmation before becoming a real action. This protects Care Claims legally and maintains client trust.

### Shared AI Layer Spec

Instead of Eve, Comms Bot, and AI Receptionist each having their own prompt logic, create a single `AIService` module:

**Inputs:**
```python
class AIRequest:
    prompt_type: str  # "eve_conversation", "draft_sms_reply", "call_summary"
    claim_context: dict | None  # claim_id, status, client_name, history
    user_message: str | None  # for conversation types
    channel: str  # "chat", "sms", "voice"
    user_id: str  # for audit
```

**Outputs:**
```python
class AIResponse:
    draft_text: str
    confidence: float  # 0.0-1.0
    warnings: list[str]  # e.g., ["Contains potential legal advice", "High uncertainty"]
    requires_human_approval: bool
    audit_id: str  # for logging
```

**Guardrails:**
- Strip any text that looks like legal promises ("We guarantee...", "You will receive...")
- Add disclaimer if confidence < 0.7
- Flag for human review if sensitive keywords detected (lawsuit, attorney, fraud)
- Never auto-send; always return draft for approval

### Audit & Logging

Every AI interaction should be logged:
```python
{
    "audit_id": "uuid",
    "prompt_type": "draft_sms_reply",
    "input_hash": "sha256 of input",
    "output_text": "draft text",
    "confidence": 0.85,
    "warnings": [],
    "user_id": "adjuster_id",
    "claim_id": "claim_id",
    "human_approved": true,  # set when user sends
    "sent_at": "ISO datetime | null",
    "created_at": "ISO datetime"
}
```

This ties into the communication event model—when a draft is approved and sent, link `audit_id` in `metadata`.

### Implementation Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `services/ai_service.py` with `AIRequest`/`AIResponse` models | Central module for all AI calls |
| 2 | Implement guardrail functions: `strip_legal_promises()`, `flag_sensitive_content()` | Reusable safety checks |
| 3 | Create `ai_audit` MongoDB collection | Store all AI interactions |
| 4 | Migrate Eve AI to use shared AI layer | Replace direct Emergent calls with `AIService.generate()` |
| 5 | Migrate Comms Bot to use shared AI layer | Standardize draft generation |
| 6 | Add "AI Draft" indicator in ClaimCommsPanel | Show badge when message came from AI suggestion |
| 7 | Add "Approve & Send" flow for AI drafts | User must click to send; no auto-send |
| 8 | Prepare AI Receptionist to use same layer | Define `prompt_type="call_summary"` and `prompt_type="call_response"` |
| 9 | Add confidence threshold config | `AI_CONFIDENCE_THRESHOLD=0.7` in env |
| 10 | Create AI audit dashboard endpoint | `GET /api/admin/ai-audit` for reviewing AI interactions |

---

## 5. Release-Critical Outcomes (Next 4-8 Weeks)

### Flagship Outcomes

**Outcome 1: Clients receive proactive, automated SMS updates at key claim milestones without adjuster effort.**
- Tasks:
  1. Obtain Twilio production credentials and set `SMS_DRY_RUN=false`
  2. Wire appointment scheduling events to auto-SMS (`appointment_scheduled` template)
  3. Wire payment issuance events to auto-SMS (`payment_issued` template)
  4. Test full SMS flow end-to-end with real phone number
  5. Monitor delivery rates via Twilio dashboard

**Outcome 2: Every client can self-check claim status via a branded portal, reducing "where is my claim?" calls.**
- Tasks:
  1. Create `/status/{claim_id}` public page component
  2. Build timeline view showing major milestones (created, in progress, approved, paid)
  3. Add Care Claims branding (logo, colors, contact info)
  4. Generate unique status link per claim; include in FNOL SMS
  5. Add "Check Status" CTA in all SMS templates

**Outcome 3: Field adjusters can rely on Harvest and Rapid Capture to work consistently in the wild on a stable, production HTTPS domain.**
- Tasks:
  1. Deploy to `app.careclaims.com` with SSL
  2. Implement domain guards and preview mode indicators
  3. Add retry queue for photo uploads and pin drops
  4. Run full E2E test suite on production domain
  5. Test on 3+ real devices (iPhone, Android, tablet)

**Outcome 4: All AI suggestions (Eve, Comms Bot, future voice) run through a single guardrailed layer and are always human-approved before sending.**
- Tasks:
  1. Implement shared AI service with guardrails
  2. Migrate Eve and Comms Bot to use shared layer
  3. Add AI audit logging
  4. Add "Approve & Send" flow in UI
  5. Review first 50 AI drafts manually for quality

**Outcome 5: Adjusters have a single, unified view of all client communications (SMS, future calls) on each claim.**
- Tasks:
  1. Implement unified communication_events schema
  2. Migrate messages collection
  3. Update ClaimCommsPanel to show all channels
  4. Add channel filter pills (All / SMS / Calls)

### "Not Now" List (De-prioritized for v1)

- **Gamma presentation integration** — Nice-to-have but not blocking v1
- **iMessage Business Chat** — Requires Apple approval process; SMS is sufficient for v1
- **White-label/multi-tenant** — Care Claims is only customer for now
- **Advanced analytics dashboard** — Basic stats exist; deep analytics can wait
- **Native iOS/Android apps** — PWA is sufficient for v1; App Store can come later
- **AI Receptionist (voice calls)** — Infrastructure prepped but not blocking v1
- **Document OCR** — Manual document review is fine for v1 volume
- **Carrier portal integration** — Manual submission to carriers continues

---

## 6. Final 4-8 Week Execution Checklist

| # | Title | Area | Description | Dependencies |
|---|-------|------|-------------|--------------|
| 1 | **Obtain Twilio production keys** | `infra` | Get Account SID, Auth Token, Messaging Service SID from Twilio console | None |
| 2 | **Set SMS_DRY_RUN=false** | `infra` | Flip env variable to enable real SMS sending | After #1 |
| 3 | **Test SMS end-to-end with real phone** | `product` | Send test message, verify delivery, test inbound reply | After #2 |
| 4 | **Deploy to app.careclaims.com** | `infra` | Configure DNS, SSL, deploy frontend + backend | None |
| 5 | **Add domain guards for preview mode** | `frontend` | Create `useEnvironmentGuard` hook, show banner if not on production domain | After #4 |
| 6 | **Wire appointment events to auto-SMS** | `backend` | Connect appointment scheduling to `send_appointment_sms()` | After #2 |
| 7 | **Wire payment events to auto-SMS** | `backend` | Connect payment issuance to `send_payment_sms()` | After #2 |
| 8 | **Create client status portal page** | `frontend` | Build `/status/{claim_id}` with timeline, branding, no auth required | None |
| 9 | **Add status link to FNOL SMS template** | `backend` | Update template to include `{status_link}` | After #8 |
| 10 | **Implement retry queue for uploads** | `frontend` | Create `useRetryQueue` hook, wrap photo uploads | None |
| 11 | **Add offline banner component** | `frontend` | Show when `navigator.onLine` is false | None |
| 12 | **Create Rapid Capture E2E test** | `frontend` | Test full session flow with mocked camera/Whisper | None |
| 13 | **Create Harvest full-flow E2E test** | `frontend` | Test pin drop → stats → profile with mocked GPS | None |
| 14 | **Run E2E suite on production domain** | `infra` | Execute all Playwright tests against `app.careclaims.com` | After #4 |
| 15 | **Test on 3+ real devices** | `product` | iPhone SE, iPhone 14, Android phone, iPad | After #4 |
| 16 | **Create unified communication_events schema** | `backend` | Add collection, indexes, migration script | None |
| 17 | **Migrate messages to communication_events** | `backend` | Run migration, update queries in messaging_sms.py | After #16 |
| 18 | **Update ClaimCommsPanel for unified model** | `frontend` | Read from new collection, add channel filter | After #17 |
| 19 | **Create shared AI service** | `backend` | Implement `services/ai_service.py` with guardrails | None |
| 20 | **Migrate Eve AI to shared layer** | `backend` | Replace direct Emergent calls | After #19 |
| 21 | **Migrate Comms Bot to shared layer** | `backend` | Standardize draft generation | After #19 |
| 22 | **Add AI audit logging** | `backend` | Create `ai_audit` collection, log all AI interactions | After #19 |
| 23 | **Add "Approve & Send" UI for AI drafts** | `frontend` | Show AI badge, require click to send | After #21 |
| 24 | **Cleanup: Remove legacy code** | `both` | Execute cleanup tasks from Section 1 | None |
| 25 | **Cleanup: Standardize datetime parsing** | `backend` | Use `_parse_datetime` utility everywhere | None |
| 26 | **Cleanup: Remove unused env variables** | `infra` | Audit and clean `.env` files | None |
| 27 | **Update notification type enum** | `backend` | Enforce allowed values in `create_notification()` | None |
| 28 | **Add "View All" notifications page** | `frontend` | Create `/notifications` with type filters | None |
| 29 | **Manual QA pass on all flows** | `product` | Walk through every major user journey, document issues | After #14 |
| 30 | **v1 Launch readiness review** | `product` | Final checklist: SMS live, portal works, field flows tested, AI guardrailed | After all above |

---

## Execution Notes

- **Parallelization**: Tasks 1-3 (Twilio), 4-5 (domain), 8-9 (portal), 10-11 (offline), 16-18 (unified model), 19-23 (AI layer), 24-26 (cleanup) can proceed in parallel tracks
- **Critical path**: Twilio production keys → SMS testing → appointment/payment wiring → FNOL with status link
- **Risk mitigation**: Test on real devices early (week 2); don't wait until end
- **Team size**: Achievable by 1 strong full-stack developer in 6-8 weeks, or 2 developers in 4 weeks

---

*This plan is designed to push Eden from ~7.5/10 internal beta to 9/10 production v1 readiness without changing the core architecture or inventing new product areas. Focus is on trimming, hardening, and shipping what already exists.*
