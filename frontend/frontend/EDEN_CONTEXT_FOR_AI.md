# Eden 2 - System Context & Architecture Brief

**For:** Expert AI Assistants (Grok, Perplexity, Claude, GPT-4+, etc.)  
**Purpose:** Rapid context loading for architectural review, debugging, and feature generation.  
**Version:** 2.0 (Hardening Phase)  
**Date:** Feb 2026

---

## 1. Project Overview
**Eden 2** is a high-performance, full-stack platform for insurance claims management, field inspections, and public adjusting operations. It combines a robust data management backend with a reactive, offline-capable frontend for field agents.

### Key Capabilities
- **Claims Management**: Lifecycle tracking (New -> Settled), document storage, and status automation.
- **Field Inspections**: "Rapid Capture" module for photo/voice documentation on iOS/Android.
- **AI Integration**: "EveAI" and "Adam" assistants for claim analysis, strategy generation, and automated reporting.
- **Role-Based Access**: Granular permissions for Admins, Managers, Adjusters, and Clients.

---

## 2. Technology Stack

### Backend (API & Logic)
- **Language**: Python 3.10+ (Async-first)
- **Framework**: **FastAPI** (High performance, Pydantic-based validation)
- **Database**: **MongoDB** (Atlas) via `motor` (Async driver)
- **Auth**: JWT (Stateless) with custom RBAC middleware (`backend/models.py`)
- **AI/ML**: OpenAI API integration, custom prompt engineering (`backend/emergentintegrations`)
- **Testing**: `pytest`, `pytest-asyncio`

### Frontend (UI & Client)
- **Framework**: **React 18** (CRA + Craco override)
- **Styling**: **Tailwind CSS** + **Radix UI** primitives (Accessibility-first)
- **State/Routing**: React Context API, React Router v6
- **HTTP Client**: Custom `api.js` wrapper around `fetch` (handles Auth headers/interception)
- **Testing**: Playwright (`frontend/e2e`)

### Infrastructure
- **Hosting**: Vercel (Frontend), Render (Backend)
- **CI/CD**: GitHub Actions (Dependency checks, Build verification)

---

## 3. Architecture Patterns

### Backend Structure (`/backend`)
- **Modular Monolith**: Logic is separated into domain-specific modules but runs as a single service.
- **`server.py`**: Application entry point. Configures Middleware (CORS, RateLimit) and mounts routers.
- **`routes/`**: Controller layer. Handles HTTP requests and delegates to services (e.g., `claims.py`, `auth.py`).
- **`services/`**: Business logic layer. Pure Python classes handling complex operations (e.g., `claims_service.py`, `ai_service.py`).
- **`models.py`**: Single source of truth for Pydantic schemas (Request/Response models) and DB mapping.
- **Pattern**: "Manual ODM" — We map Pydantic models to MongoDB dicts manually (e.g., `user.dict()`) rather than using a heavy ODM like Beanie.

### Frontend Structure (`/frontend`)
- **Component-Based**: Heavy use of composition.
- **`lib/api.js`**: Centralized API client. **CRITICAL**: Must exist for build to succeed.
- **`components/`**: Feature-grouped folders (e.g., `rapid-capture/`, `claims/`).
- **`context/`**: Global state (Auth, Theme) to avoid prop-drilling.
- **Lazy Loading**: Route-based code splitting using `React.lazy` in `App.js`.

---

## 4. Key Data Models (Pydantic)

- **User**: `id`, `email`, `role` (admin/manager/adjuster), `permissions`.
- **Claim**: `claim_number`, `status` (Enum), `policy_holder`, `loss_details`, `photos` (List[Photo]).
- **Inspection**: `id`, `claim_id`, `agent_id`, `photos`, `voice_notes`, `status`.

---

## 5. Critical Files & Entry Points

| File Path | Description |
| :--- | :--- |
| `backend/server.py` | **Backend Entry**. App config, middleware, router aggregation. |
| `backend/models.py` | **Data Contract**. All Pydantic schemas and Enums. |
| `backend/requirements.txt` | **Deps**. Pinned versions (Note: `pytest<9` required). |
| `frontend/src/App.js` | **Frontend Entry**. Routing and layout logic. |
| `frontend/src/lib/api.js` | **Network Layer**. Auth-aware fetch wrapper. |
| `frontend/src/lib/core.js` | **Utils**. Formatting, validation, shared constants. |

---

## 6. Recent "Hardening" Context (Feb 2026)
- **Dependency Fixes**: Resolved `pytest` vs `pytest-asyncio` conflict by pinning versions.
- **Build Fixes**: Restored missing `frontend/src/lib/api.js` that was previously git-ignored.
- **Focus**: Stability, Deployment Reliability, and "Rapid Capture" field performance.

---

## 7. Instructions for Expert Analysis
When reviewing this codebase:
1. **Respect the Monolith**: Do not suggest splitting into microservices unless strictly necessary for scaling.
2. **Preserve Pydantic Patterns**: We rely on Pydantic for type safety. Do not introduce raw dict manipulation where a model exists.
3. **Frontend Performance**: Watch for "waterfall" rendering in `useEffect`. Prefer parallel fetching or React Query (future roadmap).
4. **Security**: Ensure RBAC checks are present on all sensitive routes.
