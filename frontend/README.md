# Eden Claims Management System

A full-stack application for insurance claims management, field operations, and AI-assisted workflows.

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6.0+

### Backend Setup
1. Navigate to backend: `cd backend`
2. Create virtual env: `python -m venv venv`
3. Activate env:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Configure env: `cp .env.example .env` (edit values as needed)
6. Run server: `uvicorn server:app --reload`

### Frontend Setup
1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install` (or `yarn`)
3. Configure env: `cp .env.example .env`
4. Run dev server: `npm start`

### Key Features
- **Claims Management**: Full CRUD for insurance claims.
- **Harvest**: Gamified field operations and canvassing.
- **Eve AI**: Integrated LLM assistant.
- **Offline Mode**: Automatic queuing of requests when offline.
- **Structured Logging**: JSON-based logging for observability.

## Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Production Deploy (Frontend)

Use one command only:

```powershell
npm --prefix frontend run deploy:prod
```

This is pinned to Vercel project `eden2` and verifies `https://eden2-five.vercel.app` after deploy.
