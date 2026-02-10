# Eden 2 - Hardening Phase Roadmap 🛡️

**Goal**: Lock in a 10/10 production-level foundation. Scale cleanly, safely, and predictably.

## 1. Enforcement over Expansion
*   **Objective**: Thin routes, domain ownership, lifecycle-driven rules.
*   **Action Items**:
    *   [ ] **Refactor Claims**: Move business logic from `routes/claims.py` to `services/claims_service.py` (or `domain/claims/`).
    *   [ ] **Strict Schemas**: Ensure all Pydantic models in `models.py` have strict type validation.
    *   [ ] **Dependency Injection**: Use FastAPI `Depends` for all service injection to improve testability.

## 2. Safety Nets (Testing & CI/CD)
*   **Objective**: Catch issues before runtime.
*   **Action Items**:
    *   [ ] **CI Pipeline**: Create `.github/workflows/main.yml` for automated linting (flake8) and testing (pytest).
    *   [ ] **Unit Tests**: Add dedicated unit tests for critical paths (e.g., `services/incentives_engine.py`, `services/payments.py`).
    *   [ ] **Integration Tests**: Ensure `tests/` folder is runnable and covers the main API flows.

## 3. System Clarity
*   **Objective**: Explicit state transitions and observability.
*   **Action Items**:
    *   [ ] **State Machines**: Define explicit valid transitions for Claims (e.g., `FNOL` -> `Under Review` -> `Approved`).
    *   [ ] **Structured Logging**: Ensure all critical events (payment, status change) emit structured logs with trace IDs.

## 4. Stage-Aware AI & Gamification
*   **Objective**: Context-aware behavior.
*   **Action Items**:
    *   [ ] **Adam Context**: Update `ai_service.py` to inject current claim stage into the prompt context.
    *   [ ] **Smart Incentives**: Review `incentives_engine` to weight quality/speed over raw volume.

---

## Immediate Next Steps (Session 1)
1.  **CI/CD**: Set up GitHub Actions to enforce quality on every push.
2.  **Testing**: Verify existing tests run and fix any breakages.
3.  **Refactor**: Begin the "Thin Routes" refactor on the **Claims** module as the pilot.
