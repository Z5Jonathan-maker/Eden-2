# Hardening Phase: Strategy & Implementation

I'm fully aligned with the direction. We're officially shifting from feature expansion to production hardening.

I've documented the strategy in **HARDENING_PHASE.md** in the repo, outlining how we execute on the four pillars you set.

## 1. Safety Nets (Implemented ✅)
First concrete step is already live:
*   **CI/CD pipeline added** via `.github/workflows/main.yml`
*   Every push now runs:
    *   **Linting (flake8)** — catches syntax errors early
    *   **Testing (pytest)** — prevents silent regressions
*   *Tests still need to be populated, but the enforcement infrastructure is now in place.*

## 2. Enforcement Over Expansion (Audit Complete)
I audited `routes/claims.py`, and it's a clear candidate for this phase.
*   **Current state**: Route contains heavy business logic, direct DB calls, notifications and emails triggered inline.
*   **Target state**:
    *   Routes handle HTTP only.
    *   Business logic moves to `services/claims_service.py`.
    *   Clear separation: **Route → Service → DB / Events / Notifications**.

## 3. Next Immediate Steps (Pilot Plan)
We’ll use **Claims** as the pilot module since it touches lifecycle state, permissions, notifications, payments, and AI—making it the highest-leverage place to establish patterns.

### Phase 1: Claims Service Refactor
1.  **Create** `services/claims_service.py`.
2.  **Move logic** out of `routes/claims.py`:
    *   `create_claim` (DB insert + event emission + notifications)
    *   `update_claim` (state transition enforcement)
    *   `delete_claim` (soft delete)
3.  **Update routes** to inject and call the service only.

### Phase 2: Testing the Core
1.  **Add** `tests/services/test_claims_service.py`.
2.  **Cover**:
    *   Claim creation triggers notifications.
    *   Authorization boundaries (client isolation).
    *   Archived claims excluded by default.

If you’re good with it, I recommend we proceed with Phase 1 and treat this as the reference pattern for other domains.
