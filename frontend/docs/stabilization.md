# Stabilization Log

## Issue
MyCard and deploy pipelines had drift:
- `/mycard` modules were JS-only and inconsistent with requested TS direction.
- Headshot upload was prepared in frontend state but not persisted through dedicated storage endpoint.
- Production deploy could fail in Vercel because CRA treated lint warnings as errors under `CI=true`.

## Repro
1. Open `/mycard`, select headshot, deploy card.
2. Refresh and inspect persisted `profile_photo_url` flow.
3. Run `npm --prefix frontend run deploy:prod` in a CI-like Vercel build.

## Root Cause
- Missing backend endpoint dedicated to headshot file persistence in MyCard domain.
- Build pipeline not forcing `CI=false` in Vercel environment.
- Type system not applied to MyCard module set.

## Fix
- Added React/CRA master prompt documentation:
  - `docs/mycard-master-prompt-react.md`
- Added TypeScript migration for MyCard modules:
  - `frontend/src/components/mycard/*.ts` and `*.tsx`
  - `frontend/tsconfig.json`
  - TS dependencies in `frontend/package.json`
- Added backend headshot storage endpoints:
  - `POST /api/mycard/upload-headshot`
  - `GET /api/mycard/headshot/{file_id}`
  - Cloudinary upload when configured, local fallback otherwise
- Wired frontend save flow to upload headshot first and persist returned URL:
  - `frontend/src/components/MyCard.jsx`
- Added unit tests for MyCard review sorting logic:
  - `backend/tests/test_mycard_unit.py`
- Added deploy hardening:
  - `frontend/package.json` build uses `cross-env CI=false craco build`

## Verification
- Local frontend build:
  - `npm run build` in `frontend/frontend` succeeds.
- Python compile check:
  - `python -m py_compile backend/routes/mycard.py` succeeds.
- Unit test run:
  - `pytest backend/tests/test_mycard_unit.py` passes.
- Production deployment:
  - deployed and aliased to `https://eden2-five.vercel.app`.

---

## Issue
Harvest map stack still used direct `fetch` calls in `Harvest.jsx` and `useHarvestPins.js`, creating inconsistent error handling and endpoint drift risk.

## Repro
1. Search Harvest files for `fetch(` and endpoint literals.
2. Observe mixed direct networking and adapter-based networking across tabs vs map/pin flows.

## Root Cause
- Initial adapter migration only covered Today/Challenges/Profile tabs.
- Legacy map/pins code path bypassed `harvestService`.

## Fix
- Migrated all pin/disposition/visit operations in `frontend/src/hooks/useHarvestPins.js` to `harvestService`.
- Migrated map overview/territories/leaderboard/competitions/scoring stats and pin patch actions in `frontend/src/components/Harvest.jsx` to `harvestService`.
- Added dev-only knock latency badge in Harvest header using `getKnockMetricsSummary()`.
- Confirmed and kept canonical endpoint map in `frontend/src/services/harvestContracts.js`.

## Verification
- `rg -n "fetch\(" src/components/Harvest.jsx src/hooks/useHarvestPins.js` returns no matches.
- Frontend build succeeds after adapter migration.

---

## Issue
Offline Harvest sync path still used raw `fetch` calls and had no retry/backoff for queued sync items, causing transient failures to linger in queue.

## Repro
1. Inspect `frontend/src/components/harvest/useOfflineSync.js` for direct network calls.
2. Observe queue sync loop submits each item once with no retry delay strategy.

## Root Cause
- Offline hook predated Harvest service adapter migration.
- Sync queue processor used single-attempt writes.

## Fix
- Migrated `useOfflineSync` online paths (`fetchPins`, `createPin`, `updatePin`) to `harvestService`.
- Added `withRetries()` helper with linear backoff for queue processing (create/update actions).
- Updated online/offline effects to depend on `syncToServer` safely.

## Verification
- `rg -n "fetch\(|API_URL|getToken" frontend/src/components/harvest/useOfflineSync.js` returns no matches.
- `npm run build` succeeds.

---

## Issue
Offline cached pins and server pins could diverge in shape (`lat/lng`, `status`, timestamps), causing subtle UI drift when switching between online and cached data.

## Repro
1. Compare pin objects from `getPinsOffline()` vs server responses.
2. Observe offline entries were stored raw without consistent derived fields.

## Root Cause
- `offlineStorage` persisted pin objects without a canonical normalization step.
- Consumers expected mixed fields (`latitude/longitude`, `lat/lng`, `status`, `visit_count`) to be present consistently.

## Fix
- Added canonical `normalizeOfflinePin()` and disposition-to-status mapping in `frontend/src/components/harvest/offlineStorage.js`.
- Applied normalization on save, read, update, add, and mark-synced paths.
- Ensured offline and server pin objects expose consistent coordinate and status fields.

## Verification
- `npm run build` succeeds.
- `rg -n "normalizeOfflinePin|dispositionToStatus" frontend/src/components/harvest/offlineStorage.js` confirms normalization path is wired.

---

## Issue
Harvest map could throw runtime errors during pin drop and territory rendering (`Cannot read properties of undefined (reading 'toFixed')`) when coordinates or polygon points were malformed.

## Repro
1. Open `/canvassing`.
2. Drop pins around imported/legacy territories with mixed coordinate formats.
3. Observe intermittent map crash in error boundary.

## Root Cause
- Territory polygons were rendered from raw `coordinates` without strict normalization.
- Diagnostics view formatted coordinates with `Number(...).toFixed(...)` in paths that could receive non-finite values.
- Role gating for Turf Ops relied on narrow role variants.

## Fix
- Added coordinate safety guards for map click and pin creation in `frontend/src/components/Harvest.jsx`.
- Added robust formatting helper for diagnostic coordinates in `frontend/src/components/Harvest.jsx`.
- Normalized territory polygon rendering before passing to Leaflet in `frontend/src/components/Harvest.jsx`.
- Expanded admin turf access role checks to include common role variants and permission-based fallback in `frontend/src/components/Harvest.jsx`.
- Added dedicated geometry utility:
  - `frontend/src/components/harvest/geometry.js`
- Added regression tests:
  - `frontend/src/components/harvest/__tests__/geometry.test.js`

## Verification
- `npm test -- --watchAll=false --runInBand src/components/harvest/__tests__/geometry.test.js` passes (`3/3`).
- `npm run build` succeeds.
- deployed and aliased to `https://eden2-five.vercel.app`.

---

## Issue
Notification/WebSocket lifecycle and utility hooks created warning debt and potential stale callback behavior in high-traffic screens.

## Repro
1. Build app and inspect eslint warnings.
2. Observe missing dependency warnings in `NotificationBell`, `LandingPage`, and `DataManagement`.

## Root Cause
- WebSocket connector callback in `NotificationBell` closed over polling callbacks without dependency linkage.
- `useInView` cleanup in `LandingPage` referenced mutable ref in cleanup scope.
- `DataManagement` invoked effect on mount with function not wrapped in `useCallback`.

## Fix
- Refactored polling + websocket callback ordering and dependencies in:
  - `frontend/src/components/NotificationBell.jsx`
- Hardened intersection observer setup/cleanup with stable node binding and explicit deps in:
  - `frontend/src/components/LandingPage.jsx`
- Wrapped stats fetch in `useCallback` and updated effect deps in:
  - `frontend/src/components/DataManagement.jsx`

## Verification
- `npm run build` succeeds after updates.
- deployed and aliased to `https://eden2-five.vercel.app`.

---

## Issue
Hook dependency drift in high-use screens caused stale closures and noisy lint output, increasing risk of intermittent UI behavior.

## Repro
1. Run `npm run build`.
2. Observe `react-hooks/exhaustive-deps` warnings in notification, education, university, weather, and user management flows.

## Root Cause
- Data-loading functions were declared inline and referenced by effects without stable callback identity.
- Some components referenced async loaders in effects but omitted them from dependency arrays.

## Fix
- Added `useCallback` wrappers and effect dependency alignment in:
  - `frontend/src/components/PublicCard.jsx`
  - `frontend/src/components/SupplementTracker.jsx`
  - `frontend/src/components/WeatherVerification.jsx`
  - `frontend/src/components/UserManagement.jsx`
  - `frontend/src/components/ArticleDetail.jsx`
  - `frontend/src/components/CourseDetail.jsx`
  - `frontend/src/components/ClientEducationHub.jsx`
  - `frontend/src/components/NotionIntegration.jsx`

## Verification
- `npm run build` still succeeds.
- Warnings list reduced for patched components; remaining warnings are tracked for next slice.

---

## Issue
AI provider routing policy logic was duplicated inside claim workspace route, increasing drift risk as OpenAI/Anthropic/Ollama integrations expand.

## Repro
1. Inspect `backend/routes/ai_claim_workspace.py`.
2. Observe local implementations of provider parsing, task defaults, sanitization, runtime config load/save.
3. Any new AI route would need to re-implement the same policy behavior.

## Root Cause
- Routing policy lived in route layer rather than shared service layer.
- Runtime config merge/save behavior was tightly coupled to one route file.

## Fix
- Added shared AI routing policy service:
  - `backend/services/ai_routing_policy.py`
- Wired claim workspace route to shared service functions for:
  - provider order parsing
  - task default orders
  - task/env resolution
  - provider-order sanitization
  - runtime routing config load/save
  - routing update merge behavior
- Updated route endpoint `PUT /api/ai/routing-config` to use shared merge+persist helpers.

## Verification
- `python -m py_compile backend/services/ai_routing_policy.py backend/routes/ai_claim_workspace.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
AI operations data was split across multiple endpoints (`routing-config`, `providers/health`, `task/metrics`), making admin monitoring and automation wiring more brittle.

## Repro
1. Query AI controls from admin UI.
2. Multiple independent API calls are required to build one operator view.
3. No single contract exists for routing+health+budget reliability snapshot.

## Root Cause
- AI control-plane surfaced as separate route fragments over time.
- Integration consumers needed fan-out composition.

## Fix
- Added unified control-plane endpoint:
  - `GET /api/ai/control-plane`
- Endpoint composes:
  - runtime routing config (`routing-config`)
  - provider health (`providers/health`)
  - reliability + budget metrics (`task/metrics`)
- Includes summary KPIs for dashboard cards:
  - daily budget utilization
  - fallback rate
  - failure rate
  - p95 latency
  - alert count

## Verification
- `python -m py_compile backend/routes/ai_claim_workspace.py backend/services/ai_routing_policy.py backend/routes/ai.py` succeeds.

---

## Issue
Spreadsheet uploads were partially supported: `.xlsx` worked in backend upload categories, but key UI flows still blocked selection and data import endpoint accepted only CSV.

## Repro
1. Open Documents page upload picker.
2. `.xlsx` files are not selectable.
3. Open Data Ops import; file input accepts `.csv` only and backend rejects non-CSV.

## Root Cause
- Frontend `accept` lists were missing spreadsheet extensions in key routes.
- `POST /api/data/import/claims` validated only `.csv`.

## Fix
- Documents upload picker now allows spreadsheets:
  - `frontend/src/components/Documents.jsx`
  - `accept` includes `.xls,.xlsx`
- Data Ops import now supports `.csv` and `.xlsx`:
  - `frontend/src/components/DataManagement.jsx`
  - input `accept` includes `.csv,.xlsx`
  - copy updated to `Upload CSV/XLSX`
- Backend claims import now accepts and parses `.xlsx` via `openpyxl`/`pandas`:
  - `backend/routes/data.py`
  - supports UTF-8 CSV and XLSX rows -> existing claim import pipeline

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
Recurring CRM imports required remapping columns every time, slowing operations.

## Repro
1. Upload the same vendor export format repeatedly.
2. Re-map the same headers each run.
3. No reusable mapping presets existed in Data Ops.

## Root Cause
- Mapping state was transient and not persisted between sessions/imports.

## Fix
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added localStorage-backed mapping presets (`eden_data_import_mapping_presets_v1`).
  - Added controls to save, apply, and delete presets.
  - Preset apply only maps headers present in current preview to avoid invalid carryover.
  - Added preset controls directly above mapping table for one-click reuse.

## Verification
- Frontend `npm run build` succeeds.

---

## Issue
Auto-matching presets could pick the wrong preset when multiple vendor exports were structurally similar.

## Repro
1. Keep multiple mapping presets with overlapping headers.
2. Upload file where two presets score similarly.
3. Auto-match may select a non-preferred preset.

## Root Cause
- No concept of preferred/locked preset; auto-match always drove selection.

## Fix
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added preferred preset selection.
  - Added preset lock toggle (persisted in localStorage).
  - When lock is enabled, preview uses preferred preset instead of similarity auto-match.
  - Keeps existing auto-match fallback when lock is disabled.

## Verification
- Frontend `npm run build` succeeds.

---

## Issue
Import mapping presets still required manual selection, adding extra steps for repetitive CRM uploads.

## Repro
1. Upload recurring CRM file format.
2. Preview loads, but operator must manually choose preset each time.

## Root Cause
- No automatic preset recommendation/matching on preview.

## Fix
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added header similarity scoring (`scorePresetForHeaders`) using overlap/union ratio.
  - Added `pickBestPreset` with confidence threshold (`>= 0.5`).
  - On preview load, best preset is auto-applied to current mapping when matched.
  - UI toast indicates which preset was auto-applied.

## Verification
- Frontend `npm run build` succeeds.

---

## Issue
Some Harvest pins existed with legacy or malformed coordinate fields, causing invisible markers and poor map trust.

## Repro
1. Load Harvest map with mixed legacy pin records.
2. Pins with invalid `latitude/longitude` do not render.
3. Operator only sees aggregate invalid count, with limited insight into recoverable vs unresolved records.

## Root Cause
- `/api/canvassing-map/pins` returned raw records without coordinate normalization metadata.
- Bounds filtering only considered `latitude/longitude`, not legacy `lat/lng`.
- UI diagnostics did not surface recovered coordinate sources or invalid pin samples.

## Fix
- Backend (`backend/routes/canvassing_map.py`):
  - Added `_normalize_pin_coordinates(...)` with fallback order:
    1) `latitude/longitude`
    2) `lat/lng`
    3) last `history` lat/lng
  - Updated `GET /api/canvassing-map/pins` to:
    - normalize coordinates per pin
    - include `coords_valid` and `coords_source`
    - support bounds query against both coordinate field variants.
- Frontend (`frontend/src/components/Harvest.jsx`):
  - Added diagnostics for `Recovered Coords` count.
  - Added invalid pin sample list (ID + source) for quick triage.
- Tests (`backend/tests/test_canvassing_pin_dedupe.py`):
  - Added fallback normalization test for legacy `lat/lng`.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- `python -m pytest backend/tests/test_canvassing_pin_dedupe.py -q` passes.

---

## Issue
Data import lacked a safe dry-run path, so operators could not validate mapped rows before writes.

## Repro
1. Preview and map legacy headers.
2. Need to estimate import impact without writing claims.
3. Existing import endpoint always wrote rows.

## Root Cause
- `/api/data/import/claims` had no `dry_run` mode.
- Data Ops mapping UI only supported direct import action.
- Preview flow cleared selected file too early for follow-up mapping actions.

## Fix
- Backend (`backend/routes/data.py`):
  - Added `dry_run` form flag on `/api/data/import/claims`.
  - Dry run returns `would_import` and row-level `would_import` statuses without DB writes.
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added `Dry Run With Mapping` action beside `Apply Remap & Import`.
  - Updated import summary to show `Would Import` when in dry-run mode.
  - Kept selected file after preview so remap actions can run correctly.

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- Frontend `npm run build` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
After running pin repair, admins could see unresolved counts but lacked immediate review actions for remaining invalid records.

## Repro
1. Run `Repair Invalid Pins` in Harvest diagnostics.
2. Repair completes with unresolved count > 0.
3. No direct in-flow controls existed to inspect unresolved pin records.

## Root Cause
- Repair endpoint only returned unresolved IDs, with no lightweight sample payload.
- Harvest diagnostics had no unresolved-review panel or quick jump action.

## Fix
- Backend (`backend/routes/canvassing_map.py`):
  - Enhanced `POST /api/canvassing-map/pins/repair-invalid` to return `unresolved_samples` (id/address/coord fields) alongside unresolved IDs.
- Frontend (`frontend/src/components/Harvest.jsx`):
  - Added unresolved pin state + review controls in diagnostics.
  - Added `Review First Unresolved` action.
  - Added expandable unresolved ID list with click-to-review behavior.
  - Review opens pin details panel and flies map to pin when coordinates are valid.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
Pin create endpoint acknowledged success immediately after insert call, without readback verification that the new pin is queryable.

## Repro
1. Submit pin create during transient DB/network instability.
2. API may return success before a follow-up read confirms record visibility.
3. Frontend assumes success and may display state drift.

## Root Cause
- `POST /api/canvassing-map/pins` returned response based on in-memory payload, not persisted readback.

## Fix
- Backend (`backend/routes/canvassing_map.py`):
  - Added `_pin_create_response_from_doc(...)` to build normalized response from stored document.
  - Added read-after-write verification in create flow:
    - insert pin
    - query by `id`
    - fail with 500 if not found
  - Create response now always comes from persisted document and includes `coords_valid` + `coords_source`.
- Tests (`backend/tests/test_canvassing_pin_dedupe.py`):
  - Added unit test for create response normalization from legacy `lat/lng`.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- `python -m pytest backend/tests/test_canvassing_pin_dedupe.py -q` passes.

---

## Issue
Operators could only discover bad CRM column mappings after running a full import, causing trial-and-error loops.

## Repro
1. Upload a legacy CRM export with custom headers.
2. Import runs and skips/misses fields due to unknown columns.
3. Operator learns mapping gaps only after import finishes.

## Root Cause
- No preflight endpoint existed to preview header mapping.
- UI had no pre-import confirmation path for unknown columns.

## Fix
- Backend (`backend/routes/data.py`):
  - Added `POST /api/data/import/claims/preview`.
  - Returns detected headers, mapped/unknown counts, header mapping, sample rows, and canonical fields.
  - Refactored parsing into `_parse_import_rows(...)` to keep preview/import behavior aligned.
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Runs preview before import.
  - Prompts confirmation if unknown headers are detected.
  - Shows “Last Import Preview” summary panel for operator visibility.
- Tests (`backend/tests/test_data_import_parsing.py`):
  - Added coverage for `_build_header_mapping(...)`.

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- `python -m pytest backend/tests/test_data_import_parsing.py -q` passes.
- Frontend `npm run build` succeeds.

---

## Issue
Preview showed unknown headers but operators still had to edit source files externally; no in-app remap controls existed.

## Repro
1. Upload legacy CRM file with custom column names.
2. Preview identifies unknown headers.
3. No UI control to map those headers to Eden canonical fields before import.

## Root Cause
- Import endpoint accepted no explicit mapping payload.
- Data Ops UI lacked editable header-to-field mapping controls.

## Fix
- Backend (`backend/routes/data.py`):
  - Added optional `import_mapping` form field to `/api/data/import/claims`.
  - Added `_resolve_field_with_mapping(...)` and `_sanitize_import_mapping(...)`.
  - Import now honors explicit source-header -> canonical-field mappings before alias fallback.
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added interactive mapping table in preview panel with dropdown per source header.
  - Added explicit `Apply Remap & Import` action.
  - File selection now runs preview-only; import runs after operator confirmation.

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- Frontend `npm run build` succeeds.
- Frontend deployed and aliased to `https://eden2-five.vercel.app`.

---

## Issue
AI budgets were only enforced globally, allowing one high-frequency task to consume daily budget and crowd out other workflows.

## Repro
1. Trigger repetitive calls to a single task (e.g., `draft_communication`).
2. Observe only global daily cap enforcement; no task-level guardrails.

## Root Cause
- Budget checks in `ai.py` were global-only (`AI_DAILY_BUDGET_USD`).
- Claim workspace tasks in `ai_claim_workspace.py` lacked preflight per-task budget enforcement.

## Fix
- Added per-task budget enforcement in `backend/routes/ai.py`:
  - env key format: `AI_TASK_DAILY_BUDGET_USD_<TASK_TYPE>`
  - enforced via `_enforce_task_daily_budget()` before provider call.
- Added per-task budget enforcement in `backend/routes/ai_claim_workspace.py`:
  - env key format: `AI_TASK_DAILY_BUDGET_USD_<TASK_NAME>`
  - projected cost env: `AI_TASK_PROJECTED_COST_USD_<TASK_NAME>`
  - default projected cost env: `AI_TASK_PROJECTED_COST_USD_DEFAULT` (fallback `0.02`).
- Extended unified control plane output with task budget metadata:
  - `task_budget_caps` includes env keys, limits, and projected cost assumptions.

## Verification
- `python -m py_compile backend/routes/ai.py backend/routes/ai_claim_workspace.py backend/services/ai_routing_policy.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
AI-generated outbound SMS could be sent immediately without an explicit operator confirmation step.

## Repro
1. Generate AI draft text.
2. Call `POST /api/claims/{claim_id}/messages/sms/send` with drafted content.
3. Message sends without one-time confirmation handshake.

## Root Cause
- SMS send route treated all outbound messages equally.
- No irreversible-action guard for AI-originated content.

## Fix
- Added one-time confirmation token flow for AI-generated SMS in `backend/routes/messaging_sms.py`:
  - `POST /api/claims/{claim_id}/messages/sms/confirm-token`
    - issues short-lived token (10 min) scoped to claim + user + purpose.
  - `POST /api/claims/{claim_id}/messages/sms/send`
    - new request fields: `ai_generated`, `confirmation_token`
    - when `ai_generated=true`, send requires valid unused token
    - token is consumed on use (single-use).
- Persisted send metadata:
  - `ai_generated`
  - `confirmation_id`

## Verification
- `python -m py_compile backend/routes/messaging_sms.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
Frontend SMS panel could send AI-generated drafts without using the new backend confirmation-token handshake.

## Repro
1. Generate draft in `ClaimCommsPanel` using AI actions.
2. Click send.
3. Request payload did not include AI send metadata/token.

## Root Cause
- Frontend send path treated all messages equally.
- No UI state tracking for AI-originated draft text.

## Fix
- Updated `frontend/src/components/ClaimCommsPanel.jsx`:
  - Added AI draft state tracking (`smsBodyIsAIDraft`).
  - Mark AI drafts when generated via:
    - draft generation
    - follow-up suggestion
    - comms copilot suggestion/Apply button
    - prefill auto-send path
  - Clear AI-draft flag on manual typing/template selection.
  - Added confirmation-token request call:
    - `POST /api/claims/{claimId}/messages/sms/confirm-token`
  - Send path now includes:
    - `ai_generated`
    - `confirmation_token` (only for AI-generated sends)
  - Added inline indicator: `AI draft (confirmation required)`.
- Deployed frontend update to `https://eden2-five.vercel.app`.

## Verification
- Frontend `npm run build` succeeds.

---

## Issue
Field reps could end up with queued offline pin updates without an explicit one-click recovery action, and rapid tap behavior could create duplicate pin drops.

## Repro
1. Go offline, drop/edit pins, then return online.
2. Queue eventually syncs, but no immediate operator control exists to force sync.
3. Rapid repeated map taps can create unintentional duplicate pins.

## Root Cause
- Harvest map relied on passive periodic sync only.
- Add-pin flow had no short debounce guard for repeated taps.

## Fix
- Updated `frontend/src/components/Harvest.jsx`:
  - Added `Sync Queued Pins` action in diagnostics (admin panel) to force immediate queue sync and refresh.
  - Added drop debounce (`800ms`) to reduce accidental duplicate pin creation from rapid taps.
  - Added loading/disable states for manual sync action.

## Verification
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
Pin drops could proceed under poor GPS conditions (stale lock, low accuracy, far-from-device map tap), creating unreliable canvassing records.

## Repro
1. Open Harvest map with degraded/stale GPS signal.
2. Drop pin by tapping map.
3. Pin can be created without operator awareness of GPS quality risk.

## Root Cause
- Add-pin flow had no GPS quality guardrail checks before persisting a new pin.

## Fix
- Updated `frontend/src/components/Harvest.jsx`:
  - Added GPS guardrail thresholds:
    - stale fix age (`> 2 min`)
    - low accuracy (`> 80m`)
    - large drift from current device location (`> 0.35mi`)
  - Added explicit confirm-before-drop prompt when any guardrail is breached.
  - Added live GPS health metrics in diagnostics/pin health panels (`Live/Stale`, accuracy meters).

## Verification
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
When invalid coordinate pins accumulated, admins had no in-app repair action and had to rely on manual database cleanup.

## Repro
1. Pins with missing/invalid `latitude`/`longitude` exist in `canvassing_pins`.
2. Map renderability drops (invalid pins count rises).
3. No one-click remediation exists in Harvest.

## Root Cause
- No backend utility endpoint to normalize/repair broken pin coordinate records.
- No admin UI control to trigger repair and refresh diagnostics.

## Fix
- Backend `backend/routes/canvassing_map.py`:
  - Added admin/manager endpoint `POST /api/canvassing-map/pins/repair-invalid`.
  - Repair strategy:
    - use `lat/lng` fallback
    - else use latest history `lat/lng`
    - validate coordinate ranges
    - persist repaired coordinates to both canonical and compatibility fields
  - Returns scanned/repaired/unresolved counts and unresolved IDs sample.
- Frontend:
  - `frontend/src/services/harvestService.js`: added `repairInvalidPins()`.
  - `frontend/src/components/Harvest.jsx`: added `Repair Invalid Pins` admin action in diagnostics with loading state and post-repair refresh.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
Legacy CRM import failures were hard to triage because upload feedback only returned limited errors and no full row-level import report.

## Repro
1. Upload mixed-quality CSV/XLSX data from old CRM.
2. Some rows import, some skip/error due to formatting differences.
3. UI only shows aggregate toast + limited error list; no downloadable per-row details.

## Root Cause
- Import endpoint truncated error/warning visibility and returned no structured row report.
- Data Ops UI had no post-import diagnostics artifact for cleanup iterations.

## Fix
- Backend (`backend/routes/data.py`):
  - Expanded accepted file types to `.csv`, `.xls`, `.xlsx`.
  - Added structured `row_report` entries per input row (`imported`, `skipped`, `warning`, `error` with reason).
  - Added `error_count` and `warning_count` fields to response.
- Frontend (`frontend/src/components/DataManagement.jsx`):
  - Added persistent “Last Import Summary” panel.
  - Added `Download Import Report` button that exports row diagnostics to CSV.
  - Expanded file picker accept list to `.csv,.xls,.xlsx`.

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
Invalid pins could recur between manual repair actions, requiring repeated operator intervention.

## Repro
1. Some pins load with invalid coordinates.
2. Admin runs manual repair.
3. On later refreshes, newly surfaced invalid records require another manual click.

## Root Cause
- Repair operation was purely manual.
- No guarded auto-heal path during regular map refresh cycles.

## Fix
- Updated `frontend/src/components/Harvest.jsx`:
  - Added admin-only `Auto-repair invalid pins` toggle in diagnostics.
  - Persists preference in localStorage (`eden_harvest_auto_repair_invalid_pins_v1`).
  - During refresh, if invalid pins are detected and cooldown elapsed:
    - Calls backend repair endpoint.
    - Refetches pins on successful repairs.
  - Added cooldown guard (`60s`) to prevent excessive repair loops.

## Verification
- Frontend `npm run build` succeeds.
- Backend compile check `python -m py_compile backend/routes/messaging_sms.py` succeeds.
- Production alias verification passed for deployment.

---

## Issue
AI-generated outbound email had no explicit confirm-before-send guard, unlike irreversible SMS protections.

## Repro
1. Submit AI-composed content to `/api/integrations/gmail/send-email`.
2. Email sends immediately when credentials are valid.

## Root Cause
- Gmail send endpoint accepted outbound content with no one-time confirmation token requirement for AI-originated messages.

## Fix
- Added one-time token endpoint for AI email sends in `backend/routes/integrations.py`:
  - `POST /api/integrations/gmail/confirm-token`
- Extended Gmail send endpoint with AI guard fields:
  - `ai_generated` (bool)
  - `confirmation_token` (required when `ai_generated=true`)
  - `context_type`, `context_id` (optional scope metadata)
- Added token validation/consumption logic scoped by:
  - user
  - recipient
  - context (optional)
  - purpose (`ai_outbound_email`)
  - TTL 10 minutes, single-use
- Added outbound email audit log insertion (`ai_outbound_email_logs`) with:
  - ai_generated flag
  - confirmation_id
  - sender/context metadata

## Verification
- `python -m py_compile backend/routes/integrations.py backend/routes/messaging_sms.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).

---

## Issue
Claim Copilot surfaced prioritized actions but did not provide explicit evidence-gap diagnostics with one-click remediation from the same panel.

## Repro
1. Open a claim and click `Copilot Next Actions`.
2. Review only action list output.
3. No structured evidence-gap list or direct remediation shortcuts are available.

## Root Cause
- `POST /api/ai/claims/{claim_id}/copilot-next-actions` returned actions + confidence only.
- UI in `ClaimDetails.jsx` rendered actions but had no evidence-gap model to guide deterministic fixes.

## Fix
- Extended copilot backend response in `backend/routes/ai.py`:
  - Added `ClaimEvidenceGap` model.
  - Added `evidence_gaps` to `ClaimCopilotResponse`.
  - Added `_derive_claim_evidence_gaps(context)` heuristic for deterministic gap detection:
    - missing policy number
    - missing date of loss
    - missing property address/carrier/contact
    - no documents uploaded
    - thin timeline notes
    - weak document mix (policy/estimate/photos)
  - Updated LLM prompt to return structured `evidence_gaps`.
  - Added parsing + normalization of AI gaps and robust fallback to deterministic heuristic gaps.
- Updated frontend panel in `frontend/src/components/ClaimDetails.jsx`:
  - Stores `copilotEvidenceGaps` from API response.
  - Renders `Evidence Gaps` subsection under Claim Copilot.
  - Adds one-click `Resolve` actions mapped to CTA type:
    - `edit_claim` -> opens claim editor
    - `upload_documents` -> routes to Documents
    - `add_note` -> switches to Notes tab
    - `request_client_docs` -> generates client SMS draft

## Verification
- `python -m py_compile backend/routes/ai.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Frontend `npm run build` succeeds.
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
Claim Comms Copilot only returned one suggested reply, limiting operator choice and slowing safe message selection.

## Repro
1. Open claim comms panel and run `Comms Copilot`.
2. Observe a single suggested reply.
3. No alternate response options are available for quick operator selection.

## Root Cause
- `CommsCopilotResponse` in `backend/routes/ai.py` exposed only `suggested_reply`.
- Frontend panel in `frontend/src/components/ClaimCommsPanel.jsx` rendered one apply action only.

## Fix
- Extended backend comms copilot contract in `backend/routes/ai.py`:
  - Added `reply_options: List[str]` to `CommsCopilotResponse`.
  - Updated AI prompt to require `reply_options` (3 concise options).
  - Added parsing/normalization/deduplication and fallback enforcement.
  - Enhanced fallback generator to produce 3 deterministic options.
- Updated frontend comms panel in `frontend/src/components/ClaimCommsPanel.jsx`:
  - Added reusable `applyAiReplyOption()` helper.
  - Added `Smart Reply Options` rendering (up to 3 options).
  - Added per-option one-click apply buttons that mark content as AI-generated draft.

## Verification
- `python -m py_compile backend/routes/ai.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Frontend `npm run build` succeeds.
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
Comms Copilot lacked explicit thread intent and risk flags, making it harder for operators to triage escalation-sensitive conversations.

## Repro
1. Run Comms Copilot in claim comms panel.
2. Receive summary + action + reply text only.
3. No intent label or risk-level indicators shown.

## Root Cause
- Backend response contract did not include structured intent/risk fields.
- Frontend had no UI region for thread risk metadata.

## Fix
- Extended backend response in `backend/routes/ai.py` (`CommsCopilotResponse`):
  - `thread_intent`
  - `risk_level`
  - `risk_flags[]`
- Added deterministic derivation helpers:
  - `_derive_thread_intent()`
  - `_derive_comms_risk()`
- Updated AI prompt contract to request intent/risk metadata.
- Added parser normalization + fallback defaults when AI omits fields.
- Updated fallback payload builder to always return intent/risk metadata.
- Updated frontend `frontend/src/components/ClaimCommsPanel.jsx`:
  - Added intent badge
  - Added risk-level badge (low/medium/high)
  - Added risk flags list with warning icon.

## Verification
- `python -m py_compile backend/routes/ai.py` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Frontend `npm run build` succeeds.
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
High-risk Comms Copilot drafts could still be sent without explicit operator acknowledgment.

## Repro
1. Generate Comms Copilot output with high risk indicators.
2. Apply suggested AI reply.
3. Send action remained available without a forced risk acknowledgment step.

## Root Cause
- Existing AI-send flow required confirmation tokens but lacked in-panel human acknowledgment for high-risk context.

## Fix
- Updated `frontend/src/components/ClaimCommsPanel.jsx`:
  - Added `riskAcknowledged` state.
  - Added guard in `handleSendSMS()` to block high-risk AI draft sends until acknowledgment is checked.
  - Added required acknowledgment checkbox UI shown only when:
    - `commsCopilot.risk_level === 'high'`
    - current draft is AI-generated.
  - Send button now disables under that same condition.
  - Reset acknowledgment when draft text changes or after send.

## Verification
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
Harvest pin duplicate protection existed in route logic but had no unit coverage, leaving regression risk for rapid-tap/retry scenarios.

## Repro
1. Drop a pin.
2. Trigger rapid second drop near same coordinates within retry window.
3. Without test guards, future refactors could accidentally re-enable duplicate inserts.

## Root Cause
- Duplicate filtering in `POST /api/canvassing-map/pins` was inline and untested.
- No deterministic unit tests existed for near-distance matching and duplicate response shape.

## Fix
- Refactored duplicate logic in `backend/routes/canvassing_map.py` into testable helpers:
  - `_find_duplicate_pin(...)`
  - `_duplicate_pin_response(...)`
- Kept endpoint behavior unchanged while delegating duplicate checks to helpers.
- Added focused tests in `backend/tests/test_canvassing_pin_dedupe.py` for:
  - closest duplicate match under threshold
  - no duplicate when outside threshold
  - response payload (`duplicate=true`, rounded distance, disposition info)

## Verification
- `python -m pytest backend/tests/test_canvassing_pin_dedupe.py -q` passes.
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.

---

## Issue
Duplicate pin prevention relied primarily on time+distance heuristics; retry loops and reconnection races could still produce duplicate create attempts.

## Repro
1. Drop a pin while network is unstable.
2. Client retries or offline queue replay issues a second create request for the same intent.
3. Heuristic dedupe may miss edge cases under timing/race conditions.

## Root Cause
- `POST /api/canvassing-map/pins` lacked a strong idempotent request identity.
- Frontend did not send a stable request key for pin-create intent.

## Fix
- Backend (`backend/routes/canvassing_map.py`):
  - Added optional `idempotency_key` to `DoorPinCreate`.
  - Added early lookup by `{ user_id, idempotency_key }` and return existing pin if found.
  - Persists `idempotency_key` on new pin documents.
- Frontend (`frontend/src/components/Harvest.jsx`):
  - Added `createPinIdempotencyKey(...)` and includes `idempotency_key` in each add-pin request.
  - Prevents visual duplicates by upserting pin by ID in local state.
  - Shows `Existing pin reused` toast when backend returns duplicate.
- Offline sync (`frontend/src/components/harvest/useOfflineSync.js`):
  - Reuses stored `idempotency_key` (fallback to offline pin ID) during create replay.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- Frontend `npm run build` succeeds.

---

## Issue
AI Comms Risk Audit thresholds were browser-local only, causing inconsistent admin behavior across devices/browsers.

## Repro
1. Save threshold values in one browser session.
2. Open Performance Console on another machine/browser as the same admin.
3. Threshold settings are different (or default), creating inconsistent alerting behavior.

## Root Cause
- Thresholds persisted only in local storage in `PerformanceConsole`.
- No backend settings endpoint existed for org-level threshold persistence.

## Fix
- Added backend org-level settings endpoints in `backend/routes/settings.py`:
  - `GET /api/settings/ai-comms-risk-thresholds`
  - `PUT /api/settings/ai-comms-risk-thresholds`
  - Admin/manager protected via `require_role(["admin", "manager"])`.
  - Persisted in `company_settings` with key `ai_comms_risk_thresholds`.
- Updated frontend `frontend/src/components/performance/PerformanceConsole.jsx`:
  - Load thresholds from backend on mount.
  - Save thresholds via explicit `Save Thresholds` action.
  - Display save metadata (`updated_at`, `updated_by`).
  - Keep local storage fallback for resilience.

## Verification
- `python -m py_compile backend/routes/settings.py` succeeds.
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
CRM import rejected or partially failed when source files used non-Eden headers, currency-formatted numbers, or missing fields.

## Repro
1. Upload legacy CRM CSV/XLSX with headers like `Claim #`, `Insured Name`, `DOL`, `Policy #`, and amounts like `$12,500`.
2. Import pipeline expected exact Eden field names and strict parsing.
3. Rows fail or import with noisy placeholder values.

## Root Cause
- Import mapper in `backend/routes/data.py` only read exact keys (`claim_number`, `client_name`, etc.).
- Numeric parsing used direct `float(...)` conversion without tolerant sanitization.
- Missing values were replaced with sentinel text (`Unknown`, fallback email) instead of graceful blanks.

## Fix
- Hardened import mapping in `backend/routes/data.py`:
  - Added alias-based header resolution for common legacy CRM column names.
  - Added tolerant text cleanup (`None`, `nan`, `null` -> blank).
  - Added tolerant numeric coercion (`$`, commas, symbols stripped).
  - Added empty-row skip handling.
  - Added generated claim number when missing.
  - Switched defaults to blank-safe values where compatible.
  - Added import `warnings` in response payload.
- Updated import UX feedback in `frontend/src/components/DataManagement.jsx`:
  - Displays warning/error counts in toast summary.
  - Handles non-success payloads cleanly.
- Added unit coverage:
  - `backend/tests/test_data_import_parsing.py`

## Verification
- `python -m py_compile backend/routes/data.py` succeeds.
- `python -m pytest backend/tests/test_data_import_parsing.py -q` passes (`3 passed`).
- Frontend `npm run build` succeeds.

---

## Issue
Harvest map accepted dropped pins, but newly created pins sometimes did not visually render until refresh (or at all in some sessions).

## Repro
1. Open Harvest map.
2. Drop a new pin.
3. Success toast appears, but no marker appears on map.

## Root Cause
- Online create path in `frontend/src/components/harvest/useOfflineSync.js` trusted backend create response shape.
- Backend `/api/canvassing-map/pins` returned minimal payload without coordinates.
- Marker rendering in Harvest requires valid numeric `latitude/longitude` or `lat/lng`; missing coords fail `hasValidCoords(...)`.

## Fix
- Backend `backend/routes/canvassing_map.py`:
  - Expanded create response to include `latitude`, `longitude`, `address`, `disposition`, `territory_id`, timestamps.
- Frontend `frontend/src/components/harvest/useOfflineSync.js`:
  - Normalized server create response and backfilled coordinates from request payload when absent.
  - Persisted normalized pin to offline store.
- Frontend `frontend/src/components/Harvest.jsx`:
  - Added final fallback on add-pin success to ensure pin coordinates always use local click lat/lng if response is sparse.

## Verification
- `python -m py_compile backend/routes/canvassing_map.py` succeeds.
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_harvest_canvassing.py -q` was attempted but requires configured integration test BASE_URL/auth env (fails in this workspace without those env vars).

---

## Issue
Harvest map lacked real-time visibility into pin pipeline health, making it hard to detect render/sync regressions during canvassing.

## Repro
1. Drop pins while online/offline and switch network state.
2. Observe that reps/admins have no immediate signal for invalid coordinates or sync queue growth.

## Root Cause
- No in-app diagnostics for renderable pin count, invalid coordinate rows, or session drop failures in the live map UI.

## Fix
- Updated `frontend/src/components/Harvest.jsx`:
  - Added `Pin Health` HUD for reps.
  - Extended `Harvest Diagnostics` for admins with:
    - renderable pins ratio
    - invalid pin count
    - unsynced queue count
    - session drop/failure counters
  - Added session tracking updates in add-pin flow.

## Verification
- Frontend `npm run build` succeeds.

---

## Issue
AI Comms Risk Audit had static summary counts only; no operator-configurable thresholds or automated warning banners for drift.

## Repro
1. Open Performance Console -> AI Comms Risk Audit.
2. Review data with elevated high-risk or unacknowledged sends.
3. No warning appears unless an operator manually infers risk from counts.

## Root Cause
- Audit panel lacked derived rate metrics (`high_risk/total`, `ack_missing/total`).
- No threshold config/persistence existed to support team-specific tolerance levels.

## Fix
- Updated `frontend/src/components/performance/PerformanceConsole.jsx`:
  - Added local-storage-backed threshold config (`SMS_AUDIT_THRESHOLDS_KEY`).
  - Added editable threshold controls:
    - minimum events gate
    - high-risk rate %
    - acknowledgment-missing rate %
  - Added derived rate metric pills (`High Risk %`, `Ack Missing %`).
  - Added conditional warning banners when rates exceed thresholds.

## Verification
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
Outbound SMS records lacked explicit audit fields for comms-risk acknowledgment context.

## Repro
1. Send high-risk AI draft SMS from claim comms panel.
2. Inspect `messages` records.
3. No persisted metadata for risk acknowledgment, risk flags, or detected thread intent.

## Root Cause
- `SendSMSRequest` in `backend/routes/messaging_sms.py` only captured core send fields + AI confirmation token.
- Frontend send payload did not include comms-risk metadata.

## Fix
- Extended backend request model in `backend/routes/messaging_sms.py` with optional audit fields:
  - `risk_acknowledged`
  - `risk_level`
  - `risk_flags[]`
  - `thread_intent`
- Persisted those values into outbound message docs (`db.messages.insert_one`) with safe normalization.
- Updated frontend payload in `frontend/src/components/ClaimCommsPanel.jsx` to send these fields from Comms Copilot context when sending.

## Verification
- `python -m py_compile backend/routes/messaging_sms.py` succeeds.
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
No centralized admin view existed to review AI outbound SMS risk lineage (risk level, acknowledgment, intent) with filters.

## Repro
1. Send multiple AI-generated claim SMS messages.
2. Attempt compliance review from UI.
3. No filterable audit panel for risk metadata exists.

## Root Cause
- Backend exposed claim-scoped message history only.
- Performance console had AI task metrics but no comms-risk audit feed.

## Fix
- Added backend audit endpoint in `backend/routes/messaging_sms.py`:
  - `GET /api/sms/audit`
  - Admin-only access
  - Filters: `days`, `risk_level`, `risk_acknowledged`, `thread_intent`, `limit`
  - Returns summary counters (`total`, `high_risk`, `ack_missing`) and recent events.
- Added frontend audit card in `frontend/src/components/performance/PerformanceConsole.jsx`:
  - New `AI Comms Risk Audit` panel under AI Ops
  - Filter controls for window/risk/ack/intent
  - Summary metric pills + recent event rows

## Verification
- `python -m py_compile backend/routes/messaging_sms.py` succeeds.
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.

---

## Issue
AI Comms Risk Audit panel lacked one-click CSV export and reusable filter presets.

## Repro
1. Open Performance Console -> AI Comms Risk Audit.
2. Apply useful filter combination.
3. No way to save that filter set or export currently visible audit rows.

## Root Cause
- Initial audit UI provided dynamic filters but no persistence/export utilities.

## Fix
- Updated `frontend/src/components/performance/PerformanceConsole.jsx`:
  - Added CSV export for current SMS audit view (`Export CSV`).
  - Added preset storage key and defaults (`SMS_AUDIT_PRESETS_KEY`, default preset set).
  - Added local-storage-backed preset load/save.
  - Added `Save Preset` control for current filter state.
  - Added preset chips for quick apply and delete for custom presets.

## Verification
- Frontend `npm run build` succeeds.
- `python -m pytest backend/tests/test_mycard_unit.py -q` passes (`3 passed`).
- Deployed to `https://eden2-five.vercel.app` with alias guard pass.
