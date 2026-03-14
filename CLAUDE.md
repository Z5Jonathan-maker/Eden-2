# Eden-2 — Claude Code Context

## Project Description
Eden is a full-stack insurance claims management and field operations platform. Key features include Claims Management, Harvest (gamified canvassing/field ops), Eve AI (LLM assistant), University (agent training LMS), Adam (QA/health monitoring), and Offline Mode with request queuing.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, Motor (async MongoDB driver), Pydantic v2, APScheduler, LiteLLM/OpenAI, Uvicorn
- **Frontend**: React 18, Vite (build), React Router v6, Tailwind CSS, Shadcn/UI (Radix), React Leaflet, Axios
- **Database**: MongoDB (MongoDB Atlas in production)
- **Auth**: JWT (PyJWT + python-jose)
- **Deployment**: Frontend → Vercel (`eden2-five.vercel.app`), Backend → Render

## Directory Structure (true roots)
```
frontend/frontend/          ← actual monorepo root
  backend/                  ← FastAPI backend
    server.py               ← entry point
    routes/                 ← domain route modules (claims, auth, harvest_*, etc.)
    services/               ← business logic
    models.py               ← Pydantic models
    workers/                ← background tasks
    utils/
  frontend/                 ← React SPA
    src/
      App.jsx               ← app root
      components/           ← UI (Adam/, Harvest/, University/ subfolders)
      features/             ← feature-specific logic (inspections)
      context/              ← AuthContext, ThemeContext
      lib/                  ← api.js (Axios client), shared utils
      pages/
  src/                      ← legacy CRA src (may coexist)
```

## Key Entry Points
- **Backend**: `frontend/frontend/backend/server.py` — `uvicorn server:app --reload`
- **Frontend**: `frontend/frontend/frontend/src/App.jsx` — `npm run dev` (Vite)
- **API client**: `frontend/frontend/frontend/src/lib/api.js`

## Database
- **MongoDB Atlas** (cloud-hosted, already configured)
- Connection via `MONGO_URL` env var in `backend/.env`

## Common Commands
```bash
# Backend (from frontend/frontend/backend/)
pip install -r requirements.txt
uvicorn server:app --reload

# Frontend (from frontend/frontend/)
npm install
npm run dev          # Vite dev server
npm run build        # production build
npm test             # vitest
npm run lint

# Deploy frontend to production (from repo root)
npm --prefix frontend run deploy:prod
```

## Environment Setup
- Backend: `frontend/frontend/backend/.env` (copy from `.env.example`)
- Frontend: `frontend/frontend/.env` (copy from `.env.example`)
