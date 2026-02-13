# Eden Proven Patterns Playbook

Purpose: ensure all stabilization and feature upgrades are grounded in proven open-source or battle-tested product patterns, then adapted to Eden (not random rewrites).

## Rule Set

1. Reuse patterns, not wholesale code dumps.
2. Respect licenses before copying implementation details.
3. Keep upgrades additive and scoped to target module.
4. Add regression tests for every crash class we fix.
5. Ship in small, deployable slices to `https://eden2-five.vercel.app`.

## Source Benchmarks (Primary References)

### Canvassing / Field Ops

- Map + offline-first interaction patterns:
  - Organic Maps / CoMaps style map/offline UX patterns (OpenStreetMap ecosystem)
  - StreetComplete quest-style low-friction map actions
  - Competitive product behavior references:
    - CompanyCam
    - Dodat / Drodat
    - ENZY
    - Spotio
    - LEVLR
- What to borrow:
  - strict coordinate normalization
  - defensive polygon rendering
  - cached map actions with background sync
  - tap-minimal field workflows

### Chat / Comms

- Twilio reference apps:
  - `twilio/twilio-webchat-react-app` (MIT)
  - `twilio/twilio-video-app-react` (Apache-2.0)
- Self-hosted comms references:
  - `chatwoot/chatwoot` (open-source support desk)
  - Matrix stack (`element-hq/synapse`, `element-hq/dendrite`) for architecture patterns
- What to borrow:
  - message state model: queued/sent/delivered/read/failed
  - attachment and reconnect/resume behavior
  - deterministic audit trail for outbound client messaging

### CRM / Workflow

- EspoCRM (`espocrm/espocrm`, AGPL-3.0)
- ERPNext (`frappe/erpnext`, GPL-3.0)
- Claims workflow product behavior references:
  - Xactimate/Xact-style workflow patterns (where applicable)
  - XBuild
  - Claim Titan
  - Claim Wizard
- What to borrow:
  - normalized entity lifecycle transitions
  - activity feed/audit object per state change
  - role-based action gating and clear permission surfaces

### Weather Verification

- Open-Meteo (`open-meteo/open-meteo`, AGPL-3.0 + open data model)
- Industry behavior references:
  - HailTrace
- What to borrow:
  - multi-source forecast normalization
  - confidence/attribution model
  - structured weather evidence packet output

### University / Learning Hub

- Moodle (`moodle/moodle`, GPL-3.0)
- What to borrow:
  - module progress tracking
  - completion checkpoints
  - robust content metadata and indexing

## Eden Module Mapping

- Harvest / Canvassing:
  - `frontend/src/components/Harvest.jsx`
  - `frontend/src/components/harvest/*`
  - `frontend/src/hooks/useHarvestPins.js`
  - `backend/routes/canvassing_map.py`
  - `backend/routes/harvest_territories.py`
- Chat / Comms:
  - `frontend/src/components/CommCenterChat.jsx`
  - `frontend/src/components/CommCenterThread.jsx`
  - `backend/routes/comm_conversations.py`
  - `backend/routes/messaging_sms.py`
  - `backend/routes/twilio_voice.py`
- Weather:
  - `frontend/src/components/WeatherVerification.jsx`
  - `backend/routes/weather.py`
- Contracts/Documents:
  - `frontend/src/components/Contracts.jsx`
  - `frontend/src/components/Documents.jsx`
  - `backend/routes/*contracts*`, `backend/routes/uploads.py`
- Learning Hub:
  - `frontend/src/components/University.jsx`
  - `backend/routes/university.py`

## Claims Mastery Doctrine (Decision Framework)

These references guide claim logic, negotiation framing, and escalation strategy in-product.

- Chip Merlin:
  - policy-language precision
  - policyholder-first accountability logic
- Bill Wilson:
  - exact wording interpretation and coverage dispute rigor
- John A. Voelpel III:
  - appraisal as structured strategic lever
- John Senac:
  - carrier behavior and goalpost-shift detection
- Vince Perri:
  - field-practical adjusting judgment
- Matthew Mollohan:
  - scalable PA operating systems
- Parrot Key:
  - carrier-side intelligence pattern awareness

Implementation impact:
- Build deterministic claim timelines and leverage checkpoints.
- Add policy-citation fields and dispute reason taxonomies.
- Enforce evidence lineage and negotiation audit trails.

## Operating System Principles (Execution)

Business and scaling:
- Alex Hormozi:
  - value/offer clarity, measurable outcomes
- Dan Martell:
  - focus leverage, delegation, operational cadence

Leadership:
- Simon Sinek:
  - purpose-aligned product decisions
- Jocko Willink + Leif Babin:
  - extreme ownership in incident response and QA

Foundational alignment:
- Oral Roberts, Kenneth Hagin, Pastor Rodney Howard-Browne, Pastor Miguel, Pastor Alex Burgos:
  - conviction, discipline, responsibility, long-range mission alignment

Execution impact:
- No ambiguous ownership for bugs/features.
- Clear acceptance criteria per release slice.
- Fast rollback paths and documented decisions.

## Competitor-Inspired UX Modes

- Tactical productivity mode:
  - D2D speed from ENZY/Spotio style workflows.
- Evidence-first mode:
  - CompanyCam/HailTrace style media + weather confidence pack.
- Claim command mode:
  - Claim Titan/Claim Wizard style structured claim progression.
- High-clarity engagement mode:
  - game-feel polish inspiration references (for energy only, never at cost of usability).

## Upgrade Workflow (Every Pass)

1. Pick one module and one failure class.
2. Collect 2-3 reference patterns from the benchmark list.
3. Implement minimal patch in Eden module only.
4. Add guardrails/tests for same failure class.
5. Build + deploy + verify on production alias.
6. Log results and residual risk.

## Current Priority Queue

1. Harvest map reliability and admin turf assignment UX.
2. Comms reliability (attachments, delivery states, reconnect behavior).
3. Weather evidence consistency (source confidence and packet quality).
4. Contracts/documents form and action reliability.
5. University completion/progress stability.

## License Safety Notes

- MIT/Apache sources: safe to adapt with attribution.
- AGPL/GPL sources: use architecture and UX patterns; avoid direct code copy unless we isolate obligations and confirm distribution strategy.
- When in doubt: re-implement pattern in Eden-native code.
- Proprietary SaaS references (CompanyCam, ENZY, Spotio, HailTrace, LEVLR, XBuild, Claim Titan, Claim Wizard):
  - use behavior benchmarking only
  - do not copy private code/assets
  - re-implement original Eden-native UX and flows
