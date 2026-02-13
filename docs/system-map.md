# System Map

## Intel Hub (Property)
- Frontend entry: `frontend/src/components/PropertyHub.jsx`
- Route: `/property` from `frontend/src/components/Layout.jsx`
- Icon asset: `frontend/src/assets/badges.js` (`intel_hub`)

## Harvest Gamification (Existing)
- Frontend Today tab: `frontend/src/components/HarvestTodayTab.jsx`
- Today data: `GET /api/harvest/v2/today` from `backend/routes/harvest_v2.py`
- Streak: `GET /api/harvest/streak` from `backend/routes/harvest_rewards_campaigns.py`
- Challenges: `GET /api/harvest/challenges` from `backend/routes/harvest_rewards_campaigns.py`
- Campaigns: `GET /api/harvest/campaigns` from `backend/routes/harvest_rewards_campaigns.py`
- Rewards progress: `GET /api/harvest/progress/rewards` from `backend/routes/harvest_rewards_campaigns.py`
- Incentives competitions (legacy): `GET /api/incentives/me/dashboard` from `backend/routes/incentives_engine.py`

## Incentives Engine (Existing)
- Routes: `backend/routes/incentives_engine.py`
- Models: `backend/incentives_engine/models.py`
- Collections: `incentive_seasons`, `incentive_competitions`, `incentive_rules`, `incentive_rewards`, `incentive_participants`

## Incentives Releases (New)
- Routes: `backend/routes/harvest_incentives.py`
- Models: `backend/incentives_releases/models.py`
- Evaluator: `backend/incentives_releases/evaluator.py`
- Collections:
  - `harvest_incentive_seasons`
  - `harvest_incentive_drops`

## Incentives Releases Data Flow
- Frontend Today tab panel: `frontend/src/components/HarvestTodayTab.jsx`
- Active season: `GET /api/harvest/incentives/active`
- Drops + progress: `GET /api/harvest/incentives/progress`
- Drops catalog: `GET /api/harvest/incentives/drops` (optional)

## Key Env Vars
- `MONGO_URL` (required, backend DB connection)
- `DB_NAME` (optional, defaults to `eden_claims`)
- `JWT_SECRET_KEY` (required auth)
- `JWT_ALGORITHM` (default `HS256`)
- `CORS_ORIGINS`, `FRONTEND_URL` (CORS + frontend allowlist)

No new environment variables are required for Incentives Releases.

## MyCard System (Current)
- Frontend entry: `frontend/src/components/MyCard.jsx`
- Frontend modules: `frontend/src/components/mycard/`
  - `TemplateSelector.tsx`
  - `LivePreviewPanel.tsx`
  - `HeadshotUploader.tsx`
  - `ShareModal.tsx`
  - `FeedbackModule.tsx`
  - `EngagementPanel.tsx`
  - `PerformanceSummary.tsx`
  - `ReviewsPanel.tsx`
  - `AnalyticsHooks.ts`
- Frontend route: `/mycard` in `frontend/src/App.js`
- Backend router: `backend/routes/mycard.py`
- Backend endpoints:
  - `GET /api/mycard/me`
  - `POST /api/mycard/create`
  - `PUT /api/mycard/update`
  - `POST /api/mycard/share-link`
  - `GET /api/mycard/google-reviews`
  - `POST /api/mycard/upload-headshot`
  - `GET /api/mycard/headshot/{file_id}`
- Storage behavior:
  - cloud-first upload if `CLOUDINARY_*` env vars are configured
  - local fallback: `backend/uploads/mycard_headshots`

## History Check: Intel Hub + Harvest
- Git history in this repo shows only `1ebe083 base env fix` for these paths; no explicit Intel Hub or Harvest commits are visible.
- Current working tree includes Intel Hub and Harvest modules; treat as present but history for earlier changes is not verifiable from this repo snapshot.
