# EDEN System Architecture Report
**Generated:** February 5, 2026  
**Version:** V1.0  
**Prepared for:** Principal Engineer Review  

---

## 0) Executive Overview

### What EDEN Is For
EDEN is a **full-stack claims management platform** built for **Care Claims**, a public adjusting firm in Florida. It replaces multiple disconnected tools (spreadsheets, email, separate CRMs) with a unified system for:

1. **Claims Lifecycle Management** - FNOL intake through settlement
2. **Field Sales Canvassing** ("Harvest") - Door-to-door lead generation with gamification
3. **Inspections** - Photo documentation with AI-powered damage detection
4. **Contracts** - E-signature via SignNow integration
5. **Communications** - SMS (Twilio), Email, AI-powered voice receptionist
6. **Training** - University module with courses and Florida statute reference
7. **Incentives Engine** - Gamification system with competitions, badges, rewards

### Key User Roles
| Role | Level | Primary Capabilities |
|------|-------|---------------------|
| **Admin** | 100 | Full system access, user management, settings, data import/export |
| **Manager** | 75 | All claims, assign adjusters, approve settlements, view reports |
| **Adjuster** | 50 | Create/update claims, inspections, view own reports |
| **Client** | 10 | View own claims only, access education hub |

### Core Workflows (End-to-End)

**1. Claim Intake → Settlement:**  
Client submits FNOL → Auto-SMS confirmation → Adjuster assigned → Inspection scheduled → Photos captured (RapidCapture) → Damage estimated (Scales) → Carrier negotiation → Contract sent (SignNow) → Settlement issued → Client notified.

**2. Harvest Canvassing:**  
Rep receives territory → GPS-tracked door knocking → Status recorded (NH/NI/CB/AP/SG) → Points awarded → Leaderboard updated → Badges earned → Rewards redeemed → End-of-day summary.

**3. AI Voice Receptionist:**  
Inbound call → TwiML greeting → Caller intent captured → Recording transcribed (Whisper) → Call matched to claim → AI summary generated → Follow-up assigned.

### Current Known Risks

| Risk Category | Severity | Details |
|--------------|----------|---------|
| **Security - IDOR** | HIGH | Some endpoints don't verify resource ownership beyond role check |
| **Data Integrity** | MEDIUM | No database transactions - partial failures possible |
| **Scale** | MEDIUM | No pagination on several list endpoints; 1000+ records will slow |
| **Cost** | LOW | AI calls (GPT-4o) not metered per user; potential runaway costs |
| **Single Point of Failure** | MEDIUM | All services in one container; no horizontal scaling |

---

## 1) System Architecture (Deep)

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KUBERNETES CLUSTER                            │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        EDEN POD                                    │ │
│  │                                                                    │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │ │
│  │  │  Frontend   │    │   Backend   │    │  Workers    │           │ │
│  │  │  React:3000 │───▶│ FastAPI:8001│◀───│ APScheduler │           │ │
│  │  │  (Nginx)    │    │             │    │             │           │ │
│  │  └─────────────┘    └──────┬──────┘    └─────────────┘           │ │
│  │                            │                                      │ │
│  │                     ┌──────▼──────┐                               │ │
│  │                     │   MongoDB   │                               │ │
│  │                     │ (Persistent)│                               │ │
│  │                     └─────────────┘                               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL SERVICES                             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Twilio  │ │SignNow  │ │Emergent │ │ Regrid  │ │ Google  │   │   │
│  │  │ SMS/    │ │ E-Sign  │ │LLM (AI) │ │Property │ │OAuth/   │   │   │
│  │  │ Voice   │ │         │ │GPT-4o   │ │  Data   │ │Calendar │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Frontend Framework + Routing Strategy
- **Framework:** React 18 + React Router v6
- **UI Library:** Shadcn/UI (Radix primitives) + TailwindCSS
- **State:** React Context (AuthContext, ThemeContext) + local state
- **Entry Point:** `/app/frontend/src/App.js`
- **Component Count:** 52 JSX files in `/app/frontend/src/components/`

**Routing Strategy:**
```javascript
// Public routes (no auth)
/               → LandingPage
/login          → Login
/register       → Register
/status/:id     → ClaimStatusPortal (client self-service)

// Client routes (role: client)
/client         → ClientPortal
/client/claims/:id → ClientClaimDetails
/client/learn   → ClientEducationHub

// Staff routes (role: admin|manager|adjuster) - wrapped in <Layout>
/dashboard      → Dashboard
/claims         → ClaimsList
/claims/:id     → ClaimDetails
/inspections    → InspectionsEnhanced
/canvassing     → HarvestPage (gamified)
/incentives-admin → IncentivesAdminConsole
... (30+ routes)
```

### Backend Framework + Structure
- **Framework:** FastAPI (Python 3.11)
- **ASGI Server:** Uvicorn (managed by Supervisor)
- **Entry Point:** `/app/backend/server.py`
- **Route Files:** 42 files in `/app/backend/routes/`
- **Total Backend LoC:** ~25,500 lines

**File Structure:**
```
/app/backend/
├── server.py           # FastAPI app, route registration, lifespan
├── models.py           # Pydantic models, role definitions
├── auth.py             # JWT creation/validation, password hashing
├── dependencies.py     # get_current_user, require_role, db connection
├── routes/             # 42 route files (claims, auth, harvest, etc.)
├── services/           # ai_service, sms_twilio, signnow, email
├── workers/            # scheduler, harvest_coach, claims_ops_bot, comms_bot
├── incentives_engine/  # evaluator.py, models.py (gamification core)
└── harvest_models/     # harvest_rewards.py (campaign models)
```

### Database Choice + Schema Approach
- **Database:** MongoDB (via Motor async driver)
- **Connection:** Single `AsyncIOMotorClient` in `dependencies.py`
- **Schema:** Schema-less documents with Pydantic validation at API boundary
- **Collections:** 50+ collections identified (see Section 4)
- **Indexes:** UNKNOWN - need to inspect MongoDB directly

**Key Design Decisions:**
- No ODM (Beanie/MongoEngine) - raw Motor queries
- IDs are UUIDs stored as strings (not ObjectId)
- `_id` excluded in most projections (`{"_id": 0}`)
- Soft delete via `is_archived: true` flag on claims

### File Storage Approach
- **Local Storage:** `/app/uploads/` directory
- **Claim Documents:** `/app/uploads/claims/{claim_id}/`
- **Inspection Photos:** `/app/uploads/inspections/{session_id}/`
- **No CDN/S3:** Files served directly; not production-ready

### Real-Time / Chat Approach
- **No WebSockets:** All data fetched via polling
- **Eve AI Chat:** REST endpoints with conversation history in DB
- **SMS 2-Way:** Twilio webhooks, not real-time

### Background Jobs Approach
- **Scheduler:** APScheduler (AsyncIOScheduler)
- **Location:** `/app/backend/workers/scheduler.py`

| Job | Schedule | Function |
|-----|----------|----------|
| Harvest Coach Hourly | :30 every hour | Nudge inactive reps |
| Harvest Coach Nightly | 22:00 UTC | Daily summary |
| Claims Ops Hourly | :45 every hour | Check stuck claims |
| Claims Ops Nightly | 21:00 UTC | Focus list |
| Comms Bot | Every 2 hours | Check missed events |

### Logging/Monitoring Approach
- **Logging:** Python `logging` module
- **Log Location:** `/var/log/supervisor/backend.*.log`
- **Structured Logs:** Partial (claims have `log_claim_event()`)
- **No APM:** No Datadog/NewRelic/Sentry integration

### Error Handling Patterns
```python
# Typical pattern in routes
try:
    # business logic
except HTTPException:
    raise
except Exception as e:
    logger.error(f"Operation error: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```
- **No global exception handler** in FastAPI
- **Stack traces exposed** in 500 responses (security risk)

### State Management Approach
- **Frontend:** React Context for auth, local useState for forms
- **No Redux/Zustand:** State is component-local or context
- **Token Storage:** `localStorage.getItem('eden_token')`

### Where Business Logic Lives
| Domain | Location | Notes |
|--------|----------|-------|
| Claims | `/routes/claims.py` | CRUD + notifications |
| Incentives | `/incentives_engine/evaluator.py` | Rule evaluation |
| Harvest | `/routes/harvest_v2.py`, `/routes/harvest_scoring_engine.py` | Visit tracking |
| AI | `/services/ai_service.py` | Centralized with guardrails |
| SMS | `/services/sms_twilio.py` + `/routes/messaging_sms.py` | Send + receive |

---

## 2) Full Feature Inventory

### Feature 1: Claims Management

**User Stories:**
- As an adjuster, I can create claims with client info, property, and loss details
- As a manager, I can assign claims to adjusters
- As a client, I can view my claim status via portal

**UI Entry Points:**
- `/claims` - ClaimsList.jsx
- `/claims/new` - NewClaim.jsx
- `/claims/:id` - ClaimDetails.jsx
- `/status/:id` - ClaimStatusPortal.jsx (public)

**Main Components:**
- `/app/frontend/src/components/ClaimsList.jsx` (list with filters)
- `/app/frontend/src/components/ClaimDetails.jsx` (930 lines, detail view)
- `/app/frontend/src/components/NewClaim.jsx` (intake form)

**Backend Endpoints:**
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/claims/` | Yes | Create claim |
| GET | `/api/claims/` | Yes | List claims (role-filtered) |
| GET | `/api/claims/{id}` | Yes | Get claim detail |
| PUT | `/api/claims/{id}` | Yes | Update claim |
| DELETE | `/api/claims/{id}` | Admin | Soft/hard delete |
| POST | `/api/claims/{id}/restore` | Admin | Restore archived |
| POST | `/api/claims/{id}/notes` | Yes | Add note |
| GET | `/api/claims/{id}/notes` | Yes | Get notes |
| POST | `/api/claims/{id}/documents` | Yes | Upload document |
| GET | `/api/claims/{id}/documents` | Yes | Get documents |

**DB Collections:**
- `claims` - Main claim records
- `notes` - Claim notes
- `documents` - Document metadata

**Permissions:**
- Create: admin, manager, adjuster
- Read: admin, manager, adjuster (all), client (own only)
- Update: admin, manager, adjuster
- Delete: admin only

**Edge Cases:**
- Client can only see claims where `client_email == user.email`
- Archived claims excluded from list by default (`is_archived != true`)

**Test Coverage:** Integration tests via testing agent; no unit tests

---

### Feature 2: Harvest (Door-to-Door Canvassing)

**User Stories:**
- As a sales rep, I can mark doors with status (NH, NI, CB, AP, SG)
- As a rep, I earn points and climb leaderboards
- As a manager, I can view team performance

**UI Entry Points:**
- `/canvassing` - HarvestPage.jsx (5-tab gamified view)
- `/canvassing/classic` - Harvest.jsx (original map view)
- `/harvest-admin` - HarvestAdminConsole.jsx

**Main Components:**
- `/app/frontend/src/components/HarvestPage.jsx` (tab container)
- `/app/frontend/src/components/HarvestTodayTab.jsx` (564 lines)
- `/app/frontend/src/components/HarvestChallengesTab.jsx`
- `/app/frontend/src/components/HarvestProfileTab.jsx`
- `/app/frontend/src/components/HarvestMap.jsx`

**Backend Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/canvassing/map` | Get pins for map |
| POST | `/api/canvassing/map/pin` | Create/update pin |
| GET | `/api/harvest/v2/today` | Today's stats |
| POST | `/api/harvest/v2/visit` | Record visit |
| GET | `/api/harvest/streak` | User's streak |
| GET | `/api/harvest/challenges` | Active challenges |

**DB Collections:**
- `canvassing_pins` - Map pins with status
- `harvest_user_stats` - User aggregates
- `harvest_stats_daily` - Daily snapshots
- `harvest_score_events` - Point events

**Validation:**
- Pin status must be: NH, NI, CB, AP, SG
- Points calculation based on status and multiplier

---

### Feature 3: Incentives Engine (Gamification)

**User Stories:**
- As admin, I create competitions from templates
- As rep, I see my rank on leaderboards
- As rep, I earn badges and redeem rewards

**UI Entry Points:**
- `/incentives-admin` - IncentivesAdminConsole.jsx (2743 lines)

**6 Admin Tabs:**
1. Competitions - Active/scheduled competitions
2. Templates - Reusable competition blueprints
3. Seasons - Quarterly groupings
4. Badges - Achievement definitions
5. Rewards - Prize catalog
6. Metrics - KPIs (doors, appointments, contracts)

**Backend Core:**
- `/app/backend/incentives_engine/evaluator.py` - Rule evaluation
- `/app/backend/incentives_engine/models.py` - Pydantic models
- `/app/backend/routes/incentives_engine.py` (2501 lines)

**Key Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/incentives/competitions` | List competitions |
| POST | `/api/incentives/competitions/from-template` | Create from template |
| GET | `/api/incentives/leaderboard/{id}` | Get leaderboard |
| POST | `/api/incentives/events/harvest` | Record metric event |
| GET | `/api/incentives/me/dashboard` | User dashboard |
| GET | `/api/incentives/badges/definitions` | Badge catalog |
| GET | `/api/incentives/rewards` | Rewards catalog |

**DB Collections:**
- `incentive_competitions` - Active competitions
- `incentive_templates` - Competition blueprints
- `incentive_seasons` - Seasonal campaigns
- `incentive_participants` - User progress
- `incentive_rules` - Rule configurations
- `incentive_metrics` - Tracked metrics
- `incentive_badges` - Badge definitions
- `incentive_rewards` - Reward catalog
- `user_badges` - Earned badges

**Rule Types Supported:**
1. **Threshold** - Hit X to qualify
2. **Top N** - Top performers win
3. **Milestone** - Bronze/Silver/Gold tiers
4. **Improvement** - Beat your baseline
5. **Lottery** - Random draw from qualifiers

---

### Feature 4: Inspections & Photo Documentation

**User Stories:**
- As adjuster, I conduct inspections with GPS-tagged photos
- As adjuster, I annotate damage on photos
- As AI, I analyze photos for damage detection

**UI Entry Points:**
- `/inspections` - InspectionsEnhanced.jsx (993 lines)

**Main Components:**
- `/app/frontend/src/components/InspectionsEnhanced.jsx`
- `/app/frontend/src/components/PhotoAnnotator.jsx` (517 lines)
- `/app/frontend/src/components/RapidCapture.jsx` (1144 lines)
- `/app/frontend/src/components/InspectionReportPanel.jsx`

**Backend:**
- `/app/backend/routes/inspection_photos.py` (1298 lines)

**Key Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/inspection-photos/sessions` | Start session |
| POST | `/api/inspection-photos/upload` | Upload photo |
| GET | `/api/inspection-photos/sessions/{id}` | Get session |
| POST | `/api/inspection-photos/analyze` | AI damage analysis |

**DB Collections:**
- `inspection_sessions` - Session metadata
- `inspection_photos` - Photo records with annotations

---

### Feature 5: Contracts & E-Signatures

**User Stories:**
- As adjuster, I send contracts for e-signature
- As client, I sign contracts via SignNow link
- As system, I track signature status

**UI Entry Points:**
- `/contracts` - Contracts.jsx (834 lines)

**Backend:**
- `/app/backend/routes/contracts.py` (746 lines)
- `/app/backend/services/signnow_service.py`

**Key Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/contracts/` | Create contract |
| POST | `/api/contracts/{id}/send` | Send for signature |
| GET | `/api/contracts/{id}/status` | Check signature status |
| GET | `/api/contracts/{id}/download` | Download signed PDF |

**DB Collections:**
- `contracts` - Contract records with SignNow IDs

---

### Feature 6: SMS Communications (Twilio)

**User Stories:**
- As system, I send FNOL confirmation SMS
- As client, I reply to SMS
- As adjuster, I see conversation threads
- As AI, I draft reply suggestions

**Backend:**
- `/app/backend/services/sms_twilio.py` - Low-level send
- `/app/backend/routes/messaging_sms.py` (549 lines) - Webhooks, threads

**Key Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sms/send` | Send SMS |
| GET | `/api/sms/threads/{claim_id}` | Get thread |
| POST | `/api/sms/webhook/inbound` | Twilio webhook |
| POST | `/api/sms/draft-reply` | AI draft reply |

**DB Collections:**
- `messages` - SMS message records

**Templates:**
- `fnol_created` - Claim opened notification
- `appointment_scheduled` - Inspection scheduled
- `photos_requested` - RapidCapture link
- `payment_issued` - Settlement notification

---

### Feature 7: AI Voice Receptionist

**User Stories:**
- As caller, I reach AI receptionist when office closed
- As system, I record call and transcribe
- As adjuster, I review call summaries

**UI Entry Points:**
- `/voice-assistant` - VoiceAssistantConsole.jsx (618 lines)

**Backend:**
- `/app/backend/routes/twilio_voice.py` (635 lines) - TwiML generation
- `/app/backend/routes/voice_assistant_console.py` - Config/logs

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/twilio/voice/inbound` | Handle incoming call |
| GET | `/api/voice-assistant/config` | Get/set config |
| GET | `/api/voice-assistant/calls` | Call logs |
| PUT | `/api/voice-assistant/scripts` | Update scripts |

**DB Collections:**
- `voice_call_logs` - Call records
- `voice_assistant_config` - Settings
- `voice_script_sets` - Editable scripts

---

### Feature 8: Eve AI Assistant

**User Stories:**
- As adjuster, I ask Eve about claims, statutes, best practices
- As system, I apply guardrails to AI responses

**UI Entry Points:**
- `/eve` - EveAI.jsx

**Backend:**
- `/app/backend/services/ai_service.py` (412 lines) - Centralized AI
- `/app/backend/routes/ai.py`

**Guardrails Applied:**
- Strip legal promises (guarantee, promise, will receive)
- Flag sensitive keywords (lawsuit, attorney, fraud)
- Add disclaimer if confidence < 0.7
- Audit all AI interactions in `ai_audit` collection

---

### Feature 9: University (Training Module)

**User Stories:**
- As adjuster, I take courses to improve skills
- As admin, I create courses and articles
- As user, I track progress

**UI Entry Points:**
- `/university` - University.jsx
- `/university/course/:id` - CourseDetail.jsx
- `/university/article/:id` - ArticleDetail.jsx

**Backend:**
- `/app/backend/routes/university.py` (1753 lines)

**DB Collections:**
- `courses` - Course definitions
- `articles` - Knowledge base articles
- `user_progress` - Completion tracking

---

### Feature 10: Florida Statutes Reference

**User Stories:**
- As adjuster, I search Florida insurance statutes
- As Eve AI, I cite relevant statutes

**UI Entry Points:**
- `/florida-laws` - FloridaLaws.jsx (599 lines)

**Backend:**
- `/app/backend/routes/florida_statutes.py`

**DB Collections:**
- `florida_statutes` - Statute text and references

---

## 3) User Roles, Permissions, and Security

### Roles List
| Role | Level | Description |
|------|-------|-------------|
| admin | 100 | Full system access |
| manager | 75 | Team oversight, approvals |
| adjuster | 50 | Day-to-day claim work |
| client | 10 | View own claims only |

### Permission Matrix

| Permission | Admin | Manager | Adjuster | Client |
|------------|:-----:|:-------:|:--------:|:------:|
| users.create | ✓ | | | |
| users.read | ✓ | ✓ | | |
| users.update | ✓ | | | |
| users.delete | ✓ | | | |
| claims.create | ✓ | ✓ | ✓ | |
| claims.read | ✓ | ✓ | ✓ | |
| claims.read_all | ✓ | ✓ | | |
| claims.read_own | | | | ✓ |
| claims.update | ✓ | ✓ | ✓ | |
| claims.delete | ✓ | | | |
| claims.assign | ✓ | ✓ | | |
| settlements.approve | ✓ | ✓ | | |
| reports.view | ✓ | ✓ | ✓ | |
| reports.export | ✓ | ✓ | | |
| settings.manage | ✓ | | | |
| integrations.manage | ✓ | | | |
| data.import | ✓ | | | |
| data.export | ✓ | ✓ | | |
| qa.run | ✓ | ✓ | | |
| university.access | ✓ | ✓ | ✓ | ✓ |

### Auth Implementation Details
- **Method:** JWT Bearer tokens
- **Algorithm:** HS256 (symmetric)
- **Expiration:** 7 days (10080 minutes)
- **Storage:** `localStorage` (frontend)
- **Password Hashing:** bcrypt via passlib

**Code Location:** `/app/backend/auth.py`

```python
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")  # Required
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
```

### Authorization Enforcement

**In Code:**
```python
# dependencies.py
async def get_current_user(credentials: HTTPAuthorizationCredentials):
    # Decode JWT, fetch user from DB
    
def require_role(required_roles: list):
    async def role_checker(current_user = Depends(get_current_active_user)):
        if current_user.get("role") not in required_roles:
            raise HTTPException(403, "Not enough permissions")
```

**Usage in Routes:**
```python
@router.delete("/{claim_id}")
async def delete_claim(
    claim_id: str,
    current_user: dict = Depends(require_role(["admin"]))
):
```

### Security Vulnerabilities Checklist

| Vulnerability | Status | Evidence | Remediation |
|--------------|--------|----------|-------------|
| **IDOR** | ⚠️ PARTIAL | `/claims/{id}` checks role but some endpoints don't verify ownership | Add ownership check in all resource endpoints |
| **Broken Access Control** | ✓ PROTECTED | Role checks via `require_role()` | - |
| **Injection** | ✓ PROTECTED | Pydantic validation on all inputs | - |
| **File Upload Security** | ⚠️ RISK | No file type validation, stored in `/app/uploads` | Add MIME checking, use S3 |
| **Secrets Exposure** | ⚠️ RISK | Stack traces in 500 responses | Add global exception handler |
| **Rate Limiting** | ❌ MISSING | No rate limiting on any endpoint | Add `slowapi` |
| **CSRF** | N/A | SPA with Bearer tokens | - |
| **CORS** | ✓ WIDE OPEN | `allow_origins=["*"]` in FastAPI | Restrict in production |
| **XSS** | ✓ PROTECTED | React escapes by default | - |

### Concrete Remediation Tasks

**1. Add Rate Limiting:**
```python
# server.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# routes/auth.py
@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin):
```

**2. Add Global Exception Handler:**
```python
# server.py
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

**3. File Upload Security:**
```python
# routes/uploads.py
ALLOWED_MIMETYPES = {"image/jpeg", "image/png", "application/pdf"}

async def upload_file(file: UploadFile):
    if file.content_type not in ALLOWED_MIMETYPES:
        raise HTTPException(400, "Invalid file type")
```

---

## 4) Data Model & Database

### Collections Overview

| Collection | Purpose | Est. Records |
|------------|---------|--------------|
| `users` | User accounts | 100s |
| `claims` | Insurance claims | 1000s |
| `notes` | Claim notes | 10,000s |
| `documents` | Document metadata | 10,000s |
| `inspection_sessions` | Inspection records | 1000s |
| `inspection_photos` | Photo metadata | 10,000s |
| `contracts` | E-signature contracts | 1000s |
| `messages` | SMS messages | 10,000s |
| `canvassing_pins` | Map pins | 100,000s |
| `harvest_user_stats` | User aggregates | 100s |
| `incentive_competitions` | Competitions | 100s |
| `incentive_participants` | Competition progress | 10,000s |
| `incentive_templates` | Competition blueprints | 10s |
| `incentive_seasons` | Seasonal campaigns | 10s |
| `incentive_badges` | Badge definitions | 100s |
| `incentive_rewards` | Reward catalog | 100s |
| `user_badges` | Earned badges | 10,000s |
| `notifications` | User notifications | 100,000s |
| `voice_call_logs` | Voice call records | 10,000s |
| `ai_audit` | AI interaction logs | 100,000s |
| `florida_statutes` | Statute reference | 1000s |
| `courses` | Training courses | 100s |
| `articles` | Knowledge base | 100s |
| `user_progress` | Course progress | 10,000s |
| `company_settings` | App configuration | 1 |
| `oauth_tokens` | OAuth credentials | 10s |

### Key Relationships

```
users (1) ──────┬─────── (*) claims
               │
               ├─────── (*) harvest_user_stats
               │
               ├─────── (*) incentive_participants
               │
               └─────── (*) user_badges

claims (1) ────┬─────── (*) notes
               │
               ├─────── (*) documents
               │
               ├─────── (*) inspection_sessions
               │
               └─────── (*) messages

incentive_competitions (1) ──── (*) incentive_participants
                              │
                              └── (1) incentive_templates

incentive_seasons (1) ──── (*) incentive_competitions
```

### Indexes
**UNKNOWN** - Need to run:
```bash
mongosh eden_claims --eval "db.getCollectionNames().forEach(c => { print(c + ':'); printjson(db[c].getIndexes()); })"
```

**Recommended Indexes:**
```javascript
// High-priority indexes
db.claims.createIndex({ "client_email": 1 })
db.claims.createIndex({ "status": 1, "created_at": -1 })
db.canvassing_pins.createIndex({ "created_by": 1, "created_at": -1 })
db.incentive_participants.createIndex({ "competition_id": 1, "user_id": 1 }, { unique: true })
db.messages.createIndex({ "claim_id": 1, "created_at": -1 })
```

### Migration Strategy
- **No migrations:** Schema changes applied at runtime via Pydantic
- **Risk:** Old documents may lack new fields
- **Mitigation:** Use `.get()` with defaults in code

### Soft Delete vs Hard Delete
- **Claims:** Soft delete (`is_archived: true`)
- **Other collections:** Hard delete (data lost)

**Recommendation:** Add soft delete to:
- `contracts`
- `inspection_sessions`
- `canvassing_pins`

### Audit Trails
- **AI Audit:** `ai_audit` collection tracks all AI calls
- **Claim Events:** `log_claim_event()` logs to Python logger (not DB)

**Recommendation:** Add `audit_logs` collection for all mutations.

### Data Retention
- **No TTL indexes** - data retained indefinitely
- **Risk:** Storage growth, GDPR compliance

### Backup/Restore
**UNKNOWN** - Depends on MongoDB deployment (Atlas/self-hosted)

---

## 5) API Spec (Internal + External)

### Full Endpoint Catalog (Key Routes)

#### Authentication (`/api/auth`)
| Method | Path | Auth | Purpose | Request Body | Response |
|--------|------|:----:|---------|--------------|----------|
| POST | `/register` | No | Create account | `{email, full_name, password, role}` | `User` |
| POST | `/login` | No | Get token | `{email, password}` | `{access_token, token_type, user}` |
| GET | `/me` | Yes | Current user | - | `User` |
| POST | `/logout` | Yes | Logout | - | `{message}` |

#### Claims (`/api/claims`)
| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| POST | `/` | Yes | Create claim |
| GET | `/` | Yes | List claims |
| GET | `/{id}` | Yes | Get claim |
| PUT | `/{id}` | Yes | Update claim |
| DELETE | `/{id}` | Admin | Delete claim |
| POST | `/{id}/restore` | Admin | Restore archived |
| POST | `/{id}/notes` | Yes | Add note |
| GET | `/{id}/notes` | Yes | Get notes |
| POST | `/{id}/documents` | Yes | Upload document |
| GET | `/{id}/documents` | Yes | Get documents |

#### Incentives Engine (`/api/incentives`)
| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/metrics` | Yes | List metrics |
| GET | `/templates` | Yes | List templates |
| POST | `/templates` | Admin | Create template |
| PUT | `/templates/{id}` | Admin | Update template |
| DELETE | `/templates/{id}` | Admin | Delete template |
| GET | `/seasons` | Yes | List seasons |
| POST | `/seasons` | Admin | Create season |
| PUT | `/seasons/{id}` | Admin | Update season |
| DELETE | `/seasons/{id}` | Admin | Delete season |
| GET | `/competitions` | Yes | List competitions |
| POST | `/competitions/from-template` | Admin | Create from template |
| GET | `/leaderboard/{id}` | Yes | Get leaderboard |
| POST | `/events/harvest` | Yes | Record metric event |
| GET | `/me/dashboard` | Yes | User dashboard |
| GET | `/badges/definitions` | Yes | Badge catalog |
| POST | `/badges` | Admin | Create badge |
| PUT | `/badges/{id}` | Admin | Update badge |
| DELETE | `/badges/{id}` | Admin | Delete badge |
| GET | `/badges/earned` | Yes | User's badges |
| GET | `/rewards` | Yes | Rewards catalog |
| POST | `/rewards` | Admin | Create reward |
| PUT | `/rewards/{id}` | Admin | Update reward |
| DELETE | `/rewards/{id}` | Admin | Delete reward |

### Webhooks

**Inbound (Twilio):**
| Endpoint | Purpose | Validation |
|----------|---------|------------|
| `POST /api/sms/webhook/inbound` | SMS received | Twilio signature |
| `POST /api/twilio/voice/inbound` | Voice call | Twilio signature |

### Versioning Strategy
- **None** - All endpoints at `/api/`
- **Recommendation:** Add `/api/v1/` prefix for future versioning

### Rate Limiting
- **None implemented** - All endpoints unlimited

### Pagination
- **Partial:** `limit` param on some endpoints (max 1000)
- **Missing:** No cursor-based pagination

---

## 6) Integrations & Automation (Deep)

### Integration 1: Twilio (SMS + Voice)

**Purpose:** SMS notifications, 2-way messaging, AI voice receptionist

**Keys/Secrets:**
| Variable | Location | Required |
|----------|----------|:--------:|
| `TWILIO_ACCOUNT_SID` | `/app/backend/.env` | Yes |
| `TWILIO_AUTH_TOKEN` | `/app/backend/.env` | Yes |
| `TWILIO_MESSAGING_SERVICE_SID` | `/app/backend/.env` | Yes |
| `TWILIO_FROM_NUMBER` | `/app/backend/.env` | Optional |

**Data Flow:**
- **Outbound SMS:** EDEN → Twilio API → Client phone
- **Inbound SMS:** Client → Twilio → Webhook → EDEN
- **Voice:** Caller → Twilio → TwiML from EDEN → Recording → Transcription

**Failure Handling:**
- SMS send failures logged, not retried
- Voice calls fall back to voicemail TwiML

**Cost Drivers:**
- SMS: $0.0079/segment
- Voice: $0.0085/minute + recording storage

**Replacement:** Switch to MessageBird, Vonage, or Plivo

---

### Integration 2: SignNow (E-Signatures)

**Purpose:** Send contracts for electronic signature

**Keys/Secrets:**
| Variable | Location | Required |
|----------|----------|:--------:|
| `SIGNNOW_ACCESS_TOKEN` | `/app/backend/.env` | Yes |
| `SIGNNOW_API_BASE` | `/app/backend/.env` | Yes |

**Data Flow:**
- EDEN generates PDF → Upload to SignNow → Send invite → Webhook on completion → Download signed

**Service File:** `/app/backend/services/signnow_service.py`

**Replacement:** DocuSign, HelloSign, PandaDoc

---

### Integration 3: Emergent LLM (AI)

**Purpose:** Eve assistant, SMS drafts, call summaries, damage analysis

**Keys/Secrets:**
| Variable | Location | Required |
|----------|----------|:--------:|
| `EMERGENT_LLM_KEY` | `/app/backend/.env` | Yes |

**Data Flow:**
- User prompt → `ai_service.py` → Emergent API (GPT-4o) → Response with guardrails

**Service File:** `/app/backend/services/ai_service.py`

**Cost Drivers:** Token usage (input + output)

---

### Integration 4: Google OAuth (Gmail, Drive, Calendar)

**Purpose:** Email sending, file storage, calendar sync

**Keys/Secrets:**
| Variable | Location |
|----------|----------|
| `GOOGLE_CLIENT_ID` | `/app/backend/.env` |
| `GOOGLE_CLIENT_SECRET` | `/app/backend/.env` |
| `GOOGLE_REDIRECT_URI` | `/app/backend/.env` |

**OAuth Flow:** `/app/backend/routes/oauth.py`

---

### Integration 5: Regrid (Property Data)

**Purpose:** Property intelligence for canvassing

**Keys/Secrets:**
| Variable | Location |
|----------|----------|
| `REGRID_API_KEY` | `/app/backend/.env` |

**Route:** `/app/backend/routes/regrid.py` (625 lines)

---

### Background Automations

| Job | Schedule | Function | File |
|-----|----------|----------|------|
| Harvest Coach Hourly | :30 | Nudge inactive reps | `workers/harvest_coach.py` |
| Harvest Coach Nightly | 22:00 UTC | Daily summary | `workers/harvest_coach.py` |
| Claims Ops Hourly | :45 | Check stuck claims | `workers/claims_ops_bot.py` |
| Claims Ops Nightly | 21:00 UTC | Focus list | `workers/claims_ops_bot.py` |
| Comms Bot | Every 2h | Check missed events | `workers/comms_bot.py` |

---

## 7) Frontend UX Map

### All Screens/Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | LandingPage | Marketing page |
| `/login` | Login | Auth |
| `/register` | Register | Auth |
| `/status/:id` | ClaimStatusPortal | Public claim lookup |
| `/client` | ClientPortal | Client dashboard |
| `/client/claims/:id` | ClientClaimDetails | Client claim view |
| `/client/learn` | ClientEducationHub | Client training |
| `/dashboard` | Dashboard | Staff home |
| `/claims` | ClaimsList | Claims list |
| `/claims/new` | NewClaim | Create claim |
| `/claims/:id` | ClaimDetails | Claim detail |
| `/claims/:id/supplements` | SupplementTracker | Supplement tracking |
| `/inspections` | InspectionsEnhanced | Inspection module |
| `/documents` | Documents | File storage |
| `/eve` | EveAI | AI assistant |
| `/contracts` | Contracts | E-signatures |
| `/university` | University | Training |
| `/users` | UserManagement | Admin users |
| `/scales` | Scales | Damage estimation |
| `/canvassing` | HarvestPage | Door-to-door |
| `/sales` | SalesEnablement | Sales tools |
| `/property` | PropertyHub | Property intel |
| `/vision` | InteractiveVisionBoard | Goal tracking |
| `/settings` | Settings | App settings |
| `/voice-assistant` | VoiceAssistantConsole | Voice config |
| `/harvest-admin` | HarvestAdminConsole | Harvest config |
| `/incentives-admin` | IncentivesAdminConsole | Gamification |
| `/florida-laws` | FloridaLaws | Statute reference |

### Navigation Structure

**Staff Layout** (`Layout.jsx`):
```
┌─────────────────────────────────────────────┐
│  EDEN Logo    [Navigation Tabs]   [Profile] │
├─────────────────────────────────────────────┤
│                                             │
│            [Page Content]                   │
│                                             │
└─────────────────────────────────────────────┘
```

### Forms and Validation
- **Client-side:** React state, manual validation
- **No form library:** Could benefit from React Hook Form
- **Error display:** Toast notifications (Sonner)

### Upload Flows
- **Inspection Photos:** `/inspections` → Photo Annotator → Upload
- **Documents:** `/claims/:id` → Document tab → File picker
- **RapidCapture:** Mobile-friendly photo capture

### Performance Bottlenecks
1. **Large lists:** No virtualization (claims, pins)
2. **Map component:** Many markers may slow rendering
3. **IncentivesAdminConsole:** 2743 lines, should be split

### Mobile Responsiveness
- **Tailwind responsive classes** used throughout
- **HarvestPage:** Optimized for mobile use in field
- **Desktop-first:** Some screens need mobile work

### Accessibility Status
**UNKNOWN** - Need audit. Likely issues:
- Missing ARIA labels
- Color contrast
- Keyboard navigation

---

## 8) Observability & Debugging

### How to Run Locally

**Backend:**
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend:**
```bash
cd /app/frontend
yarn install
yarn start
```

### Required Environment Variables

**Backend (`/app/backend/.env`):**
```env
# Required
MONGO_URL=mongodb://localhost:27017
DB_NAME=eden_claims
JWT_SECRET_KEY=your-secret-key-min-32-chars

# Integrations (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
EMERGENT_LLM_KEY=
SIGNNOW_ACCESS_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Frontend (`/app/frontend/.env`):**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
DISABLE_VISUAL_EDITS=true
```

### How to Run Tests
```bash
# Backend (pytest)
cd /app/backend
pytest tests/ -v

# Frontend (no tests currently)
cd /app/frontend
yarn test  # May not have tests
```

### Logging Locations
- **Backend stdout:** `/var/log/supervisor/backend.out.log`
- **Backend stderr:** `/var/log/supervisor/backend.err.log`
- **Frontend:** Browser console

### Trace Request End-to-End
1. Browser DevTools → Network tab → Copy request as cURL
2. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
3. Add `logger.info()` statements as needed
4. Check MongoDB: `mongosh eden_claims --eval "db.claims.find().limit(5)"`

---

## 9) Deployment & DevOps

### Environments
| Environment | URL | Database |
|-------------|-----|----------|
| Preview | `https://mycard-military.preview.emergentagent.com` | Shared MongoDB |
| Production | **UNKNOWN** | **UNKNOWN** |

### CI/CD Pipeline
- **Platform:** Emergent Agent (auto-deploys on commit)
- **No GitHub Actions** detected

### Hosting Provider
- **Container:** Kubernetes (Emergent managed)
- **Database:** MongoDB (Emergent managed)

### Build Commands
```bash
# Backend - no build step (Python)
pip install -r requirements.txt

# Frontend
cd /app/frontend
yarn install
yarn build
```

### Secrets Management
- **Location:** `/app/backend/.env`, `/app/frontend/.env`
- **Not in git:** .env files gitignored
- **No vault:** Plain text files

### Rollback Strategy
- **Emergent Platform:** "Rollback" feature in UI
- **Database:** No automatic rollback

### Risk Points
1. **Single pod:** No horizontal scaling
2. **Local file storage:** Lost on container restart
3. **No health checks:** Container may run unhealthy

---

## 10) Code Quality & Maintainability Review

### Repo Structure Critique

**Good:**
- Clear separation of frontend/backend
- Routes organized by domain
- Consistent use of Pydantic models

**Issues:**
- No `tests/` directory with meaningful tests
- Workers mixed with routes logic
- Some "god files" over 1000 lines

### Coupling Hotspots
1. `IncentivesAdminConsole.jsx` (2743 lines) - Split into sub-components
2. `incentives_engine.py` (2501 lines) - Extract to services
3. `ClaimDetails.jsx` (930 lines) - Extract panels

### God Files to Refactor

| File | Lines | Recommendation |
|------|-------|----------------|
| `IncentivesAdminConsole.jsx` | 2743 | Extract tab components |
| `incentives_engine.py` | 2501 | Extract CRUD to services |
| `university.py` | 1753 | Split courses/articles |
| `inspection_photos.py` | 1298 | Extract AI analysis |
| `RapidCapture.jsx` | 1144 | Extract camera logic |
| `Scales.jsx` | 1086 | Extract estimate logic |

### Type Safety Status
- **Backend:** Pydantic models (good)
- **Frontend:** No TypeScript (risk)

### Linting/Formatting
- **Backend:** Ruff configured
- **Frontend:** ESLint configured

### Suggested Module Boundaries

```
/app/backend/
├── api/              # Route handlers only
├── services/         # Business logic
├── repositories/     # Database operations
├── models/           # Pydantic models
├── workers/          # Background jobs
└── integrations/     # Third-party clients

/app/frontend/
├── components/
│   ├── common/       # Shared UI components
│   ├── claims/       # Claims feature
│   ├── harvest/      # Harvest feature
│   ├── incentives/   # Incentives feature
│   └── ...
├── hooks/            # Custom hooks
├── contexts/         # React contexts
├── services/         # API calls
└── utils/            # Helpers
```

---

## 11) Roadmap Recommendations

### Tier 1: Must Fix Now (Security/Data Integrity)

| Issue | Risk | Fix |
|-------|------|-----|
| No rate limiting | Brute force attacks | Add `slowapi` |
| Stack traces in 500s | Info disclosure | Global exception handler |
| File upload no validation | Malicious files | MIME type checking |
| CORS allow all | Security bypass | Restrict origins |
| No audit trail | Compliance | Add audit collection |

### Tier 2: Stability & Scale

| Issue | Impact | Fix |
|-------|--------|-----|
| No pagination | Slow on large data | Cursor pagination |
| God files | Maintainability | Split components |
| No TypeScript | Runtime errors | Migrate frontend |
| Local file storage | Data loss | Move to S3 |
| No health checks | Silent failures | Add `/health` endpoint |
| No APM | Blind to issues | Add Sentry/Datadog |

### Tier 3: Product Polish

| Issue | Impact | Fix |
|-------|--------|-----|
| No real-time updates | Stale UI | Add WebSockets |
| Limited mobile UX | Field usage | Mobile-first redesign |
| No offline mode | Field connectivity | Service worker |
| Missing accessibility | Compliance | ARIA audit |

---

## 12) Actionable Change Map

### Priority 1: Security Hardening

**1.1 Add Rate Limiting**
- Files: `/app/backend/server.py`, `/app/backend/routes/auth.py`
- Install: `pip install slowapi`
- Code:
```python
# server.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# auth.py
@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
```
- Test: `for i in {1..10}; do curl -X POST .../login; done`
- Rollback: Remove decorator and limiter

**1.2 Global Exception Handler**
- Files: `/app/backend/server.py`
- Code:
```python
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_handler(request, exc):
    logger.error(f"Error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal error"})
```
- Test: Trigger error, verify no stack trace in response
- Rollback: Remove handler

**1.3 File Upload Security**
- Files: `/app/backend/routes/uploads.py`, all upload endpoints
- Code:
```python
import magic

ALLOWED = {"image/jpeg", "image/png", "application/pdf"}

def validate_file(content: bytes, filename: str):
    mime = magic.from_buffer(content, mime=True)
    if mime not in ALLOWED:
        raise HTTPException(400, f"Invalid file type: {mime}")
```
- Test: Upload `.exe` renamed to `.pdf`
- Rollback: Remove validation

### Priority 2: Split God Files

**2.1 Split IncentivesAdminConsole.jsx**
- Current: 2743 lines in one file
- Target structure:
```
/app/frontend/src/components/incentives/
├── IncentivesAdminConsole.jsx  # Main container (200 lines)
├── CompetitionsTab.jsx         # ~400 lines
├── TemplatesTab.jsx            # ~500 lines
├── SeasonsTab.jsx              # ~400 lines
├── BadgesTab.jsx               # ~300 lines
├── RewardsTab.jsx              # ~300 lines
└── MetricsTab.jsx              # ~200 lines
```
- Migration: Extract tab by tab, test after each
- Rollback: Git revert

### Priority 3: Add Pagination

**3.1 Cursor-Based Pagination**
- Files: `/app/backend/routes/claims.py` (then all list endpoints)
- Schema:
```python
class PaginatedResponse(BaseModel):
    items: List[Any]
    next_cursor: Optional[str]
    has_more: bool

@router.get("/", response_model=PaginatedResponse)
async def get_claims(
    cursor: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    query = {}
    if cursor:
        query["_id"] = {"$gt": ObjectId(cursor)}
    
    items = await db.claims.find(query).limit(limit + 1).to_list(limit + 1)
    has_more = len(items) > limit
    items = items[:limit]
    
    return PaginatedResponse(
        items=items,
        next_cursor=str(items[-1]["_id"]) if items else None,
        has_more=has_more
    )
```
- Test: Verify pagination with large dataset
- Rollback: Remove pagination params

### Safe Refactor Sequence

1. **Week 1:** Security hardening (rate limit, exception handler, file validation)
2. **Week 2:** Add health check endpoint, basic monitoring
3. **Week 3:** Split `IncentivesAdminConsole.jsx` into tabs
4. **Week 4:** Add pagination to claims endpoint
5. **Week 5:** Migrate file storage to S3
6. **Week 6:** Add comprehensive audit logging

---

## QUESTIONS FOR OWNER

1. **Production Environment:**
   - What is the production URL?
   - Is there a separate production database?
   - Who manages the production deployment?

2. **MongoDB:**
   - Is this MongoDB Atlas or self-hosted?
   - Are there existing indexes?
   - What is the backup strategy?

3. **Compliance:**
   - Are there HIPAA requirements (health data)?
   - GDPR requirements (EU clients)?
   - SOC 2 audit planned?

4. **Scale Requirements:**
   - Expected number of concurrent users?
   - Expected claims/month volume?
   - Expected canvassing pins/day?

5. **Budget:**
   - What's the budget for monitoring tools (Sentry, Datadog)?
   - Budget for file storage (S3)?
   - Budget for additional integrations?

6. **Team:**
   - Who else maintains this codebase?
   - Is there a code review process?
   - Are there staging/QA environments?

7. **Third-Party Contracts:**
   - What tier is the Twilio account?
   - SignNow API limits?
   - Emergent LLM key quota?

---

**Report Complete**  
*Generated by Emergent Agent E1*
