# Harvest Phase 0 Audit (Architecture + Leverage)

Date: 2026-02-12
Scope: Harvest only (`/canvassing` + Harvest backend routes)
Status: Analysis complete. No core rewrites in this phase.

## 1) Current Harvest Architecture (What Exists Today)

### Frontend surfaces
- Primary route: `frontend/src/App.js` -> `/canvassing` renders `frontend/src/components/Harvest.jsx`.
- Secondary route: `/canvassing/leaderboard` renders `frontend/src/components/HarvestPage.jsx`.
- Active Harvest tab stack in `Harvest.jsx` now maps to:
  - `Map`
  - `Today` (`frontend/src/components/HarvestTodayTab.jsx`)
  - `Ranks` (`frontend/src/components/harvest/LeaderboardTab.jsx`)
  - `Challenges` (`frontend/src/components/HarvestChallengesTab.jsx`)
  - `Profile` (`frontend/src/components/HarvestProfileTab.jsx`)

### Frontend data hooks/services
- Pins + status mapping: `frontend/src/hooks/useHarvestPins.js`
  - Reads from `/api/canvassing-map/pins`
  - Writes visits to `/api/canvassing-map/visits`
  - Reads configurable statuses from `/api/harvest/v2/dispositions`
- Offline sync utility in Harvest: `frontend/src/components/harvest/useOfflineSync.js`
- Global request queue utility (feature-flagged): `frontend/src/lib/requestQueue.js`

### Backend route modules currently serving Harvest
- `backend/routes/canvassing_map.py` (core map/pin/visit endpoints)
- `backend/routes/harvest_v2.py` (v2 stats, profile, leaderboard, config, visits)
- `backend/routes/harvest_scoring_engine.py` (unified scoring, streak, badges, leaderboard)
- `backend/routes/harvest_rewards_campaigns.py` (rewards, campaigns, redemptions, challenges)
- `backend/routes/harvest_territories.py` (territory CRUD + assignment)

### Current data collections (observed from route usage)
- `canvassing_pins`
- `harvest_visits`
- `harvest_score_events`
- `harvest_stats_daily`
- `harvest_user_stats`
- `harvest_badges`
- `harvest_user_badges`
- `harvest_competitions`
- `harvest_rewards`
- `harvest_redemptions`
- `harvest_campaigns`
- `harvest_campaign_progress`
- `harvest_challenges`
- `harvest_territories`
- `canvassing_territories`
- `canvassing_locations`
- `company_settings` (for dispositions + daily goals)

## 2) Key Findings (Stability + Risk)

### Strengths (salvageable)
1. Core canvassing loop already exists and is functional:
   - drop pin -> log visit/status -> persist history -> update scoring.
2. Scoring/gamification has strong backend concentration in `harvest_scoring_engine.py`.
3. Territory + assignment APIs already exist.
4. Coach worker exists (`backend/workers/harvest_coach.py`) and can be reused for event-driven nudges.
5. Frontend already has modular tab components we can iterate on quickly.

### Risks / technical debt
1. API surface duplication:
   - Similar concepts appear in both `/api/canvassing-map/*` and `/api/harvest/v2/*`.
   - Increases drift risk and front-end confusion.
2. Territory model duplication:
   - `canvassing_territories` and `harvest_territories` both exist.
3. Legacy disposition/status translation across modules creates mismatch risk.
4. `backend/server.py` defines two `startup_event` functions with same name (Python overrides first function object). Behavior works because decorator registers function objects at definition time, but this is maintainability risk.
5. Harvest has two route entrypoints (`Harvest.jsx` and `HarvestPage.jsx`) with overlapping concerns.

## 3) Distilled Canvassing Core Model (Shared Backbone)

Canonical entities to stabilize around:

1. `User`
- id, role, org/team, permissions, profile

2. `Lead` (Household/Prospect)
- id, geo point, address, owner/contact, lead source, territory_id, status

3. `Territory`
- id, polygon(s), assignees, active window, hierarchy, metadata

4. `Interaction`
- id, lead_id, user_id, outcome/status, timestamp, notes, media refs, location proof

5. `ActivityLog`
- append-only event stream for actions (`lead_created`, `visit_logged`, `status_changed`, `claim_reward`)

6. `Status`
- configurable outcome definitions (`code`, `label`, `color`, `points`, `sort`, `is_terminal`)

7. `Assignment`
- lead->user, territory->user, campaign->user/team assignment snapshots

8. `GoalMetric`
- daily/weekly targets + progress rollups (doors, appointments, contracts, points)

Rule: Keep these CRM/canvassing primitives independent from gamification primitives.

## 4) Comparative Pattern Extraction (ENZY + SPOTIO)

### ENZY patterns observed
- Leaderboards with configurable KPI/date filtering.
- Competitions/incentives admin-configurable by role.
- Profiles + badges + messaging integrated with performance context.
- Canvassing + appointment scheduling connected to leaderboard/competition modules.
- Assistant/coach style nudges from real-time signals.

### SPOTIO patterns observed
- Mobile-first, map-centric “system of action” for field reps.
- Territory management + hierarchy + assignment controls.
- Route planning and stop execution in the field.
- GPS trails/location evidence for accountability.
- Fast activity logging from map/list route context.
- Pipeline + lead lifecycle tracking tied to map context.

### Shared principles worth adopting
1. Keep logging fast (minimal taps, low cognitive load).
2. Make map + territory + lead status first-class.
3. Make manager visibility real-time and operational.
4. Keep incentives configurable, not hard-coded.
5. Separate operational CRM loop from motivation layer.

## 5) Open-Source Leverage Options (Do not blindly fork)

### Option A: Twenty CRM (`twentyhq/twenty`)
- Strength: modern CRM object model, strong community momentum.
- Risk: very broad platform; high integration effort with existing FastAPI + Mongo stack.
- License: GPL-family (check exact repo license before embedding code).
- Recommendation: Extract UX/data-model ideas only, do not fork into Harvest core.

### Option B: EspoCRM / SuiteCRM
- Strength: mature lead/opportunity patterns and workflow concepts.
- Risk: AGPL license and PHP stack mismatch; heavy migration overhead.
- Recommendation: Use as reference architecture for entities/workflows only.

### Option C: OCA Field Service (`OCA/field-service`)
- Strength: territory + route + FSM module decomposition is excellent reference.
- Risk: AGPL + Odoo ecosystem mismatch.
- Recommendation: Borrow module boundaries and route/territory concepts, not code.

### Option D: Map + routing infrastructure components
- `GraphHopper` + `jsprit` (Apache-2.0): route optimization engine patterns.
- `MapLibre` docs: clustering/large-geojson performance strategies.
- Recommendation: adopt performance patterns and optional routing service abstraction; avoid unnecessary infra now.

### Option E: Offline-first field data collection references
- ODK/Kobo patterns validate queue + retry + conflict-safe sync behavior.
- Recommendation: emulate sync semantics and device queue guarantees in existing stack.

## 6) Proposed Refactor/Integration Strategy (No rewrites yet)

### Guiding rule
Stabilize one canonical canvassing API path and one canonical territory model before adding net-new gamification complexity.

### Phase A (P0): Contract consolidation
1. Create a Harvest API compatibility matrix (frontend calls -> backend endpoints).
2. Mark canonical endpoints for each capability:
   - Lead/pin CRUD
   - Visit logging
   - Daily stats
   - Leaderboard
   - Territory
3. Add adapter layer in frontend services so components stop calling mixed legacy paths directly.

### Phase B (P0): Data model normalization
1. Define canonical `Lead`/`Interaction` schema contract.
2. Create migration aliases between legacy fields (`disposition` vs status code).
3. Choose one territory collection as source of truth; add read-through compatibility for the other until migrated.

### Phase C (P1): Mobile execution speed
1. Enforce <5-second knock flow:
   - map tap -> outcome tap -> optional note.
2. Add “quick outcomes” component with large thumb targets.
3. Ensure operation queue persists through refresh/restart.

### Phase D (P1): Offline + sync hardening
1. Single queue implementation for harvest writes.
2. Retry policy + idempotency keys for visit submissions.
3. Conflict policy: latest timestamp wins for status, append-only for interactions.

### Phase E (P2): Territory and routing enhancements
1. Polygon loading and pin clustering optimization.
2. Optional route optimization abstraction (do not bind to vendor yet).
3. Add manager-facing heatmaps and coverage summaries.

### Phase F (P2): Gamification overlay
1. Keep scoring engine API isolated.
2. Trigger coach messages from event bus only.
3. Ensure gamification read models never block core logging UX.

## 7) Immediate Guardrails for Phase 1 work

1. Harvest-only file scope unless approved.
2. No scoring math changes in initial stabilization.
3. No schema-breaking response changes without explicit approval.
4. Every change includes rollback notes and endpoint impact.

## 8) Approval Gate

Recommended next step after approval:
- Start Phase 1 implementation with a small P0 PR:
  - introduce Harvest service adapter in frontend,
  - route all tab data calls through it,
  - instrument knock-flow timing metrics,
  - no backend schema changes in first pass.

## 9) External Sources Used

Notes:
- Public, detailed ENZY technical docs were not reliably discoverable from web search during this phase.
- ENZY comparisons in this document are therefore constrained to internal project context and behavior patterns, while SPOTIO/open-source references below are externally sourced.

References:
- SPOTIO website (field sales software positioning and capability pages): https://spotio.com/
- Twenty CRM repository: https://github.com/twentyhq/twenty
- EspoCRM repository: https://github.com/espocrm/espocrm
- OCA Field Service repository: https://github.com/OCA/field-service
- GraphHopper repository: https://github.com/graphhopper/graphhopper
- MapLibre GL JS repository: https://github.com/maplibre/maplibre-gl-js
