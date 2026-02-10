# Deployment Notes

This file provides minimal guidance for running the Eden backend and frontend locally and for preparing environment variables for deployment.

1) Pull branch: `cursor/app-functionality-issues-e802`
2) Copy backend `.env.example` to `.env` and fill values
3) Copy frontend `.env.example` to `.env` and fill values
4) Configure Twilio/webhooks as required by your deployment
5) Deploy backend + frontend to your chosen platforms

## Local verification
- Start backend: `py -m uvicorn server:app --reload --port 8000`
- Start frontend: `npm install && npm run build && npm start`

## Notes
- Secrets must be stored in your deployment platform's secret management (do not commit secrets to git).
- Beacon endpoints (public):
  - `GET /api/ops/manifest` (full manifest)
  - `POST /api/ops/beacon` (version ping)
