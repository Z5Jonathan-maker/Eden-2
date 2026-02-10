# Eden — Continuous Quality & Integrity Layer (CQIL)

## Purpose

Ensure Eden has zero dead ends:
- No broken buttons
- No dead links
- No screens with no valid next action
- No formatting regressions
- No text appearing outside permitted fields
- No inconsistent states across modules
- No "silent failures" (tap does nothing)
- No unrecoverable flows in the field

This layer exists to maintain permanent operational reliability while Eden evolves.

---

## Non-Negotiable Rules

### Rule 1 — Zero Dead Ends

Every screen must always provide at least one:
- valid next action, or
- explicit completion state, or
- safe exit back to a known hub

### Rule 2 — Zero Dead Interactions

Every interactive element must be continuously verified:
- taps register
- actions resolve
- success/error states are visible
- retries exist where relevant

### Rule 3 — No Unauthorized Text

No text renders outside:
- defined fields
- defined containers
- defined typography rules

No overflow, clipping, invisible text, or truncation without a deliberate UI treatment.

### Rule 4 — No Dead Links

Every link must:
- resolve
- load successfully
- return a valid view
- provide a fallback if external

### Rule 5 — No Field Regressions

Field-mode must never regress:
- one-thumb usability
- low signal behavior
- sub-second interactions where possible
- minimal typing
- minimal modals

---

## Always-On "Integrity Bar" (Admin-Facing)

### Concept

A persistent system indicator visible to **admin users only** that signals app integrity in real time.

### Behavior

Runs lightweight health checks continuously in the background.

Displays one of three states:

**GREEN (Operational)**
- no critical failures detected

**YELLOW (Degraded)**
- non-critical issues detected (e.g., slower response, partial integration outage)
- app remains safe to use

**RED (Blocked / Critical)**
- critical failure detected (broken workflow, dead end, data integrity risk)
- system routes user to safe fallback path, logs incident, and displays recovery instructions

### What it checks (minimum)

- button/action handlers wired and responding
- route/navigation validity
- API availability + latency thresholds
- permissions enforcement consistency
- document signing status sync validity
- offline queue integrity
- formatting/layout integrity (core breakpoints)
- link resolution for internal routes and key external dependencies

### Field mode enforcement

When field mode is active, the Integrity Bar prioritizes:
- maps responsiveness
- pin creation speed
- photo capture stability
- offline queue + upload retry behavior

---

## Continuous Quality Systems (Non-User Facing)

### 1) The Centurion — Button/Link/Route Verifier (24/7)

**Goal:** detect dead taps, dead routes, dead links, missing handlers.

**Checks:**
- Crawl all navigable routes (authenticated by role)
- Trigger every button/action in a safe test environment
- Verify expected outcome is produced:
  - navigation occurs, OR
  - state changes, OR
  - output generated, OR
  - error state is displayed with a recovery path

**Outputs:**
"Break Report" with:
- module
- screen/route
- element ID
- repro steps
- expected vs actual
- severity
- suggested fix class (wiring/permissions/data/UI)

---

### 2) The Typographer — Layout & Formatting Guardian

**Goal:** ensure no UI text escapes its intended container and formatting never breaks.

**Checks:**
- typography rules and spacing rules
- long-string stress tests (names, addresses, emails, carrier IDs)
- small-screen breakpoints
- accessibility constraints (tap targets, readable hierarchy)

**Enforcements:**
- No overflow without explicit truncation rules
- No clipped CTA buttons
- No text overlay collisions
- No hidden critical info

---

### 3) The Pathwarden — Dead-End & Workflow Completeness Auditor

**Goal:** ensure every workflow is complete and recoverable.

**Checks:**
Every workflow must have:
- start state
- progress state(s)
- completion state
- fallback state
- safe exit

No screen is allowed to exist without a defined purpose inside a workflow.

**Dead-end definition:**
A screen is a dead end if:
- it contains no valid next action
- back navigation breaks state
- it requires data the user cannot provide
- it exposes a feature the user lacks permissions to use with no explanation or reroute

---

### 4) The Regression Judge — Competitive Parity Validator

**Goal:** ensure Eden does not regress below the required standards.

**Checks:**
- speed benchmarks for:
  - map load
  - pin drop
  - status selection
  - camera open → capture
  - upload queue behavior
- clarity benchmarks for:
  - status readability
  - next-action certainty
  - error messaging and recovery

**Output:**
- parity scorecards by module with pass/fail gates

---

### 5) The Data Steward — Integrity & Consistency Validator

**Goal:** prevent inconsistent claim states and bad data merges.

**Checks:**
- claims, pins, documents, and weather packets remain consistently attached
- immutable artifacts (e.g., weather verification) remain immutable after claim attach
- permissions are enforced consistently across all modules

---

## Severity Levels (Hard Gates)

### P0 — Must stop release / must stop user flow
- dead end in a primary workflow (Harvest, photo capture, contract signing, claim creation)
- tap does nothing on critical action
- broken document send/sign flow
- data corruption risk (wrong claim attachments)

### P1 — Must fix within same sprint
- broken non-critical link
- formatting break that hides content
- degraded but recoverable workflows

### P2 — Scheduled fix
- cosmetic inconsistency
- minor spacing/typography issues not affecting use

---

## Remediation Loop (Closed-Loop Improvement)

**Required cycle:**
1. Detect issue (Sentinel/Typographer/Pathwarden)
2. Auto-generate bug ticket with full repro steps
3. Assign to correct module owner
4. Validate fix in test environment
5. Re-run targeted checks
6. Block release until P0/P1 cleared
7. Archive proof of fix with before/after evidence

No issue is "closed" without an automated re-check proving it no longer exists.

---

## Constraints

- These agents do not change production autonomously.
- They detect, report, and enforce gates.
- Fixes require human-approved merge, but cannot ship if gates fail.

---

## Minimum Acceptance Criteria

Eden is compliant only if:
- every route has a valid purpose and escape path
- every button has a verified handler and a visible result
- every link resolves or provides fallback
- no critical text escapes layout constraints
- field mode actions remain fast and reliable under poor signal
- automated checks run continuously and block regressions

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Integrity Bar | 🔴 Not Started | Admin-only header component |
| The Centurion | 🔴 Not Started | Route/button verifier |
| The Typographer | 🔴 Not Started | Layout guardian |
| The Pathwarden | 🔴 Not Started | Dead-end auditor |
| The Regression Judge | 🔴 Not Started | Performance validator |
| The Data Steward | 🔴 Not Started | Data integrity checker |
| Adam Dashboard | 🟡 Partial | Existing stub, needs CQIL integration |
