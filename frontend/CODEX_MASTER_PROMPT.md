# EDEN 2 — Master Codex Prompt

## PROJECT OVERVIEW

Eden is a full-stack SaaS platform for insurance claims adjusting firms. It's built with:
- **Backend:** Python 3.11 / FastAPI / MongoDB Atlas (async via Motor)
- **Frontend:** React 18 / Vite / Tailwind CSS / Shadcn UI
- **AI:** OpenAI GPT-4o (vision + chat), Ollama Cloud (gemma3:12b), Anthropic Claude
- **Deployment:** Backend on Render (https://eden-2.onrender.com), Frontend on Vercel
- **Database:** MongoDB Atlas, database name `eden_claims`

The project lives at: `C:\Users\HP\Documents\trae_projects\eden 2\frontend\`
Git root is at `frontend/`. Inside that:
- `backend/` — FastAPI server (server.py is entry point)
- `frontend/` — React app (nested: `frontend/frontend/src/`)
- `src/` — duplicate/root-level copy of some frontend files (less used)

---

## ARCHITECTURE

### Backend (56+ route files, 49+ mounted routers)

**Entry point:** `backend/server.py`
- Startup event calls `seed_university_data()` at line ~475
- Mounts all routers under `/api` prefix
- MongoDB connection via `MONGO_URL` env var, database `eden_claims`
- CORS, rate limiting, structured logging middleware
- WebSocket at `/ws/notifications`

**Key route files:**
- `routes/auth.py` — JWT auth (login, register, token refresh)
- `routes/claims.py` — Core claims CRUD
- `routes/inspection/routes.py` — Property inspections, damage assessment AI, report generation
- `routes/inspection_photos.py` — Photo capture, annotation, AI analysis
- `routes/university.py` — OLD monolithic university (3,330 lines) — SHOULD BE DEPRECATED
- `routes/university/` — NEW modular package:
  - `__init__.py` — imports router + seed_university_data
  - `routes.py` — API endpoints
  - `seed_data.py` — 29 courses, 3 articles (4,370 lines)
  - `models.py` — Pydantic models
- `routes/workbooks.py` — Workbook CRUD + `seed_workbooks()` function (creates 1 workbook)
- `routes/ai.py` — Eve AI assistant, chat, vision endpoints
- `routes/harvest/routes.py` — Sales harvest/canvassing
- `routes/harvest_gamification.py` — Points, badges, leaderboard
- `routes/harvest_v2.py` — Harvest v2 refactor
- `routes/contracts.py` — Contract management
- `routes/evidence.py` — Evidence management
- `routes/uploads.py` — File uploads (GridFS/local)
- `routes/payments.py` — Stripe payments
- `routes/messaging_sms.py` — Twilio SMS
- `routes/twilio_voice.py` — Twilio voice calls
- `routes/email.py` — Email sending
- `routes/email_intelligence.py` — AI email analysis
- `routes/gamma.py` — Gamma/Notion integration
- `routes/battle_pass.py` — Gamification battle pass
- `routes/incentives/` — Competitions, metrics, seasons
- `routes/canvassing_map.py` — Map-based door-to-door
- `routes/mycard.py` — Digital business cards
- `routes/settings.py` — User/company settings
- `routes/oauth.py` — Google, SignNow OAuth

**AI Integration Pattern (CORRECT — use this):**
```python
from emergentintegrations.llm.openai import LlmChat, UserMessage

api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
llm = LlmChat(api_key=api_key, session_id="unique-id", system_message="...")
llm = llm.with_model(provider="openai", model="gpt-4o")
response = await llm.send_message(UserMessage(text="..."))
```

**DO NOT USE:** `emergentintegrations.llm.chat` — it's a stub that raises `NotImplementedError`

**Vision API Pattern (CORRECT — for image analysis):**
```python
import httpx
api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
async with httpx.AsyncClient(timeout=60.0) as client:
    resp = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{full_base64_string}", "detail": "high"}},
                    {"type": "text", "text": "Your prompt here"}
                ]
            }],
            "max_tokens": 1000, "temperature": 0.2,
        },
    )
response_text = resp.json()["choices"][0]["message"]["content"]
```

### Frontend (React 18 + Vite + Tailwind)

**Entry:** `frontend/frontend/src/App.jsx`
**Build:** `vite build` (NOT react-scripts, NOT craco)
**Config:** `frontend/frontend/vite.config.js`
**Tailwind:** `frontend/frontend/tailwind.config.js` (plugins: tailwindcss-animate, @tailwindcss/typography)
**API base:** Uses `REACT_APP_BACKEND_URL` or `/api` proxy

**Key frontend directories:**
```
frontend/frontend/src/
├── components/
│   ├── university/         # Courses, articles tabs
│   │   └── workbook/       # WorkbookViewer, component renderers
│   ├── harvest/            # Sales dashboard
│   ├── adam/               # AI assistant
│   ├── chat/               # Messaging
│   ├── intel/              # Intelligence
│   ├── mycard_modules/     # Digital business card
│   ├── performance/        # Rep performance
│   ├── settings/           # Settings panels
│   ├── workspace/          # Workspace components
│   ├── ui/                 # Shadcn components (button, badge, card, etc.)
│   ├── InspectionReportPanel.jsx   # AI report display (uses ReactMarkdown)
│   ├── InspectionsNew.jsx          # Inspection session manager
│   ├── RapidCapture.jsx            # Camera capture for inspections
│   ├── PhotoGallery.jsx            # Photo grid with lightbox
│   ├── University.jsx              # University main page
│   └── SalesEnablement.jsx         # Sales pitch hub
├── features/
│   ├── claims/             # Claims management
│   ├── contracts/          # Contract management
│   ├── harvest/            # Harvest v2
│   ├── incentives/         # Gamification
│   ├── inspections/        # Inspection hooks
│   └── weather/            # Weather integration
├── hooks/                  # Custom hooks (useInspectionReport, useAuth, etc.)
├── lib/                    # Utilities (api.js, utils.js)
├── services/               # API service layer
├── shared/ui/              # Shared UI components
└── context/                # React Context providers
```

---

## CRITICAL BUGS TO FIX (Priority Order)

### BUG 1: Workbooks Section is EMPTY — seed_workbooks() Never Called
**Root Cause:** The NEW `routes/university/seed_data.py` (which runs at startup) does NOT call `seed_workbooks()`. The call only exists in the OLD `routes/university.py` at lines 2615-2619.

**What needs to happen:**
- In `backend/routes/university/seed_data.py`, at the END of `seed_university_data()`, add:
```python
# Seed companion workbooks
try:
    from routes.workbooks import seed_workbooks
    await seed_workbooks()
    logger.info("Workbooks seeded successfully")
except Exception as e:
    logger.error(f"Failed to seed workbooks: {e}")
```
- `seed_workbooks()` lives in `backend/routes/workbooks.py` line 191
- It creates 1 workbook: "Extreme Ownership — Care Claims Field Application" with 8 sections, flashcards, scenario drills, quizzes
- It does `db.workbooks.delete_many({})` then `db.workbooks.insert_one(workbook)` with `is_published: True`

**Files to modify:**
- `backend/routes/university/seed_data.py` — add seed_workbooks() call at end of seed_university_data()

### BUG 2: D2D Course Missing from Seed Data
**Root Cause:** The Door-to-Door course was defined in OLD `routes/university.py` (line ~810) but was NEVER migrated to the NEW `routes/university/seed_data.py`.

**What needs to happen:**
- Copy the D2D course definition from `backend/routes/university.py` (search for "Door-to-Door: Authority-Led Field Canvassing")
- Add it to `backend/routes/university/seed_data.py` in the appropriate courses list
- The course should have:
  - title: "Door-to-Door: Authority-Led Field Canvassing"
  - category: "training"
  - description: "The complete field manual for Care Claims door-to-door canvassing. Learn the mindset, scripts, objection handling, and daily rhythm required to knock 75-100 doors per day and sign 3+ claims per week."
  - All its lessons (scripts, objection handling, daily rhythm, etc.)
  - Quiz questions
  - is_published: True

**Files to modify:**
- `backend/routes/university/seed_data.py` — add D2D course to the courses list

### BUG 3: OLD vs NEW University Module Conflict
**Problem:** Both exist simultaneously:
- `backend/routes/university.py` (OLD monolithic file, 3,330 lines)
- `backend/routes/university/` (NEW package with __init__.py, routes.py, seed_data.py, models.py)

Python's import resolution should prefer the package (directory) over the single file, but this is fragile and confusing.

**What needs to happen:**
- Verify the NEW package is what's being imported (check `__init__.py` exports)
- Move any unique content from OLD `university.py` to the NEW package (D2D course, library routes, etc.)
- Delete or rename the OLD `university.py` to `university_legacy.py` to prevent import conflicts
- Make sure ALL routes from the OLD file exist in the NEW `routes.py`

**Files to check:**
- `backend/routes/university.py` — OLD (audit for unique routes not in NEW)
- `backend/routes/university/__init__.py` — verify exports
- `backend/routes/university/routes.py` — verify all endpoints exist
- `backend/routes/university/seed_data.py` — verify all content migrated
- `backend/server.py` — verify import path

### BUG 4: Library/Books Has No Seed Data
**Problem:** The Library tab for PDF/EPUB reading has CRUD routes but no default books. Users see an empty library.

**What needs to happen:**
- Either add sample books to the seed data, OR
- Add clear UI messaging that says "Upload your first book to get started" with an upload button
- The upload flow exists: POST `/api/uploads/file` then POST `/api/university/library/books`
- Library routes are in the OLD `routes/university.py` (lines ~3191-3296) — need to verify they're in NEW module

### BUG 5: .env.production Has Empty Backend URL
**File:** `frontend/frontend/.env.production`
**Issue:** `REACT_APP_BACKEND_URL=` is blank
**Fix:** Set it to `https://eden-2.onrender.com`

---

## MEDIUM PRIORITY ISSUES

### ISSUE 6: Ollama Config Points to Marketing Website
- **File:** `backend/services/ollama_config.py` line 8
- `DEFAULT_OLLAMA_BASE_URL = "https://ollama.com"` — this is NOT an API endpoint
- Any feature relying on Ollama as fallback will fail
- The actual Ollama API key env var is `OLLAMA_API_KEY` and base URL should be from env `OLLAMA_BASE_URL`
- Routes in `routes/ai.py` reference "https://ollama.com/settings/keys" which doesn't exist

### ISSUE 7: Speech-to-Text is Stubbed
- **File:** `backend/emergentintegrations/llm/openai.py` lines 54, 59
- `OpenAISpeechToText` class raises `NotImplementedError`
- Voice transcription features will crash
- Fix: Implement using OpenAI Whisper API or remove the feature

### ISSUE 8: Gamma/Notion Service is All Stubs
- **File:** `backend/services/gamma_service.py` lines 54-67
- `create_claim_page()` returns hardcoded `"stub-page-id"`
- `update_claim_page()`, `append_content()` do nothing
- `query_database()` returns `[]`
- Fix: Implement real Gamma API calls or disable the feature

### ISSUE 9: Gamification TODOs
- `routes/harvest_rewards_campaigns.py` line 997-998: Winner notifications not implemented
- `routes/harvest_scoring.py` line 215: Competition multiplier not added
- `routes/battle_pass.py` line 341: XP boost rewards not checked

---

## ENVIRONMENT VARIABLES (Production)

**Required for backend (Render):**
```
MONGO_URL=mongodb+srv://...
DB_NAME=eden_claims
JWT_SECRET_KEY=<secret>
ENVIRONMENT=production
PORT=10000
BASE_URL=https://eden-2.onrender.com
FRONTEND_URL=https://eden-care-claims.vercel.app
CORS_ORIGINS=https://eden-care-claims.vercel.app,https://eden-2.onrender.com
OPENAI_API_KEY=sk-...
EMERGENT_LLM_KEY=sk-...  (same as OPENAI_API_KEY, used by emergentintegrations)
OLLAMA_API_KEY=<if using ollama cloud>
OLLAMA_BASE_URL=<actual ollama api endpoint, NOT https://ollama.com>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
SIGNNOW_CLIENT_ID=...
SIGNNOW_CLIENT_SECRET=...
GAMMA_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

**Required for frontend (Vercel):**
```
REACT_APP_BACKEND_URL=https://eden-2.onrender.com
```

---

## DEPLOYMENT

**Backend (Render):**
- Service: Web Service
- Build: `pip install -r requirements.txt`
- Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Root directory: `backend/`
- Live at: https://eden-2.onrender.com

**Frontend (Vercel):**
- Framework: Vite
- Build: `cd frontend && npm install && npm run build`
- Output: `frontend/dist/`
- Rewrites: `/api/*` → `https://eden-2.onrender.com/api/*`
- Live at: https://eden-care-claims.vercel.app (or custom domain)

---

## WHAT I NEED YOU TO DO

1. **Fix workbook seeding** — wire `seed_workbooks()` into the NEW `seed_data.py` so workbooks appear at startup
2. **Add D2D course** — migrate the full Door-to-Door course from OLD `university.py` to NEW `seed_data.py`
3. **Resolve OLD vs NEW university module** — consolidate into the NEW package, ensure no routes are lost, delete or rename OLD file
4. **Fix .env.production** — set `REACT_APP_BACKEND_URL=https://eden-2.onrender.com`
5. **Verify library routes** exist in NEW university package (book CRUD, reading progress)
6. **Add more workbooks** — the system only seeds 1 workbook. Add 2-3 more companion workbooks for other courses (supplement process, carrier tactics, etc.)
7. **Add more D2D content** — the D2D course should be comprehensive with scripts, objection handling, territory management lessons
8. **Test everything** — run the backend, verify all 30+ courses appear, workbook appears, D2D course loads, library tab works

---

## RECENT COMMITS (for context)

```
ffc69b3 fix(ai): send full image to GPT-4o vision + render markdown reports
ac26853 fix(recon): haptic shutter feedback + non-blocking GPS capture
1ba94d8 fix(university+gallery): workbooks visible, lightbox nav, search/filter, DB indexes
2721236 fix(sales-ops): pitch structure, personalization, dark mode
6ddd654 fix(recon+backend): P1 crash fixes and inspection router
```

## SERVER STARTUP LOG (confirms 29 courses seeded but 0 workbooks)

```
University seed: 29/29 courses inserted
Care Claims University data seeded successfully
```

Note: No "workbooks seeded" message appears — confirming seed_workbooks() is NOT being called.
