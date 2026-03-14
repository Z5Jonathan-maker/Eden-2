# Eden-2 Deployment Checklist

> Generated: 2026-03-07
> Backend: Render (eden-2.onrender.com / eden-gsot.onrender.com)
> Frontend: Vercel (eden2.vercel.app)

---

## CRITICAL: Secrets Requiring Immediate Rotation

The following secrets were found exposed in git history and MUST be rotated before production use.

### 1. Google Maps API Key #1 (EXPOSED IN GIT HISTORY + WORKING TREE)

- **Exposed value:** `AIzaSyDHv5v1vXY8A7fjqrZcDIg6z0lD-A4BfaY`
- **Found in:** `frontend/.env.production` (was live until this audit), git history across multiple commits
- **Action:**
  1. Go to https://console.cloud.google.com/apis/credentials
  2. Find the key starting with `AIzaSyDHv5...`
  3. Either delete it or regenerate it
  4. Create a new restricted key (restrict to Maps Embed API, Maps JavaScript API)
  5. Add HTTP referrer restrictions (your Vercel domain only)
  6. Set the new key in Vercel env vars as `VITE_GOOGLE_MAPS_API_KEY` and `REACT_APP_GOOGLE_MAPS_API_KEY`

### 2. Google Maps API Key #2 (HARDCODED IN SOURCE, NOW REMOVED)

- **Exposed value:** `AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`
- **Found in:** Hardcoded in HarvestPage JSX (removed in refactor), still in `frontend/build/` artifacts
- **Action:**
  1. Go to https://console.cloud.google.com/apis/credentials
  2. Find the key starting with `AIzaSyBFw0...`
  3. Delete or regenerate it
  4. Delete `frontend/build/` directory (contains baked-in key in JS bundle)

### 3. Vercel OIDC JWT Token (COMMITTED TO REPO)

- **Exposed value:** Full JWT in `.vercel/.env.production` and `frontend/.vercel/.env.production`
- **Contains:** Team ID (`team_sgUnwrDyrMp8pPKOIZN0qUlz`), Project ID (`prj_5AdS2e72IZYReRNHPcfGCEgvAyfM`), User ID
- **Action:**
  1. Add `.vercel/` to `.gitignore` (already done per audit)
  2. The OIDC token is short-lived (expires ~12h) so it is likely already expired
  3. Run `vercel env pull` to regenerate local env files — do NOT commit them
  4. Verify `.vercel/` is in `.gitignore`

---

## Render Backend Environment Variables

Set these in Render Dashboard > eden-2 (or eden-gsot) > Environment.

### REQUIRED - App will not start without these

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Runtime mode | `production` |
| `PORT` | Server port (Render sets automatically) | `8000` |
| `BASE_URL` | Public backend URL | `https://eden-2.onrender.com` |
| `FRONTEND_URL` | Public frontend URL (for CORS, redirects) | `https://eden2.vercel.app` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `https://eden2.vercel.app` |
| `MONGO_URL` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `DB_NAME` | MongoDB database name | `eden_claims` |
| `JWT_SECRET_KEY` | JWT signing secret (min 32 chars, random) | Generate: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ENCRYPTION_KEY` | Fernet key for OAuth token encryption | See generated key below |
| `REGISTRATION_SECRET` | Invite code for new user registration | Any strong random string |
| `ADMIN_INITIAL_PASSWORD` | Initial admin password (first boot only) | Strong password |
| `BEHIND_PROXY` | Set true when on Render | `true` |

### REQUIRED for AI Features

| Variable | Description |
|----------|-------------|
| `OLLAMA_API_KEY` | Ollama Cloud API key (primary LLM) |
| `OLLAMA_BASE_URL` | `https://ollama.com` |
| `OLLAMA_MODEL` | `gemma3:12b` |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback LLM) |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` |
| `OPENAI_API_KEY` | OpenAI API key (fallback/vision) |
| `AI_PROVIDER_ORDER_DEFAULT` | `ollama,openai,anthropic` |

### OPTIONAL - Third-Party Integrations

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Gmail app-specific password |
| `DRIVE_MIRROR_ENABLED` | Enable Google Drive backup (`true`/`false`) |
| `SIGNNOW_CLIENT_ID` | SignNow e-signature client ID |
| `SIGNNOW_CLIENT_SECRET` | SignNow e-signature client secret |
| `SIGNNOW_API_URL` | `https://api.signnow.com` |
| `GAMMA_API_KEY` | Gamma presentation API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_API_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `REGRID_API_TOKEN` | Regrid property data API token |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio messaging service SID |
| `TWILIO_FROM_NUMBER` | Twilio sender phone number |
| `SMS_WEBHOOK_SECRET` | SMS webhook verification secret |

---

## Vercel Frontend Environment Variables

Set these in Vercel Dashboard > eden2 > Settings > Environment Variables.

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API base URL | `https://eden-2.onrender.com` |
| `REACT_APP_ASSET_BASE_URL` | Contract/PDF asset path | `/assets/contracts` |
| `REACT_APP_IMAGE_BASE_URL` | Image asset path | `/images` |
| `REACT_APP_CONFIG_VERSION` | Config version tag | `2026-PROD` |
| `REACT_APP_ENABLE_OFFLINE_QUEUE` | Enable offline queue | `true` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (for Vite builds) | New key from GCP |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Google Maps API key (for CRA builds) | Same new key |
| `REACT_APP_SENTRY_DSN` | Sentry error tracking DSN (optional) | `https://...@sentry.io/...` |
| `REACT_APP_ENVIRONMENT` | Environment label | `production` |
| `REACT_APP_VERSION` | App version | `0.1.0` |

---

## Generated ENCRYPTION_KEY

**EXAMPLE ONLY -- Generate a fresh key for production:**

```
iYuM7QKk-xSUcS26yXo_sG9pK9l2OTrtcdktzetOMnw=
```

Generate your own with:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Pre-Deploy Steps

### Database (MongoDB Atlas)

1. **Create indexes** -- Run the backend's index creation script or verify these indexes exist:
   - `claims`: compound index on `status`, `assigned_to`, `created_at`
   - `users`: unique index on `email`
   - `evidence`: index on `claim_id`
   - `communications`: index on `claim_id`, `created_at`

2. **Create admin user** -- On first deploy, the backend auto-creates an admin user using `ADMIN_INITIAL_PASSWORD`. Verify by hitting `/api/auth/login` with admin credentials after deploy.

3. **Verify connection** -- Ensure `MONGO_URL` includes the correct cluster, credentials, and `?retryWrites=true&w=majority` options.

### Build Verification

1. Run `cd frontend && npm run build` locally to verify no build errors
2. Run `cd frontend/backend && python -m pytest` to verify tests pass
3. Ensure `.gitignore` includes: `.env`, `.vercel/`, `__pycache__/`, `node_modules/`, `build/`, `uploads/`

---

## Post-Deploy Verification

### Backend (Render)

1. **Health check:** `curl https://eden-2.onrender.com/health` -- should return 200
2. **Auth test:** `curl -X POST https://eden-2.onrender.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@eden.com","password":"..."}'`
3. **CORS test:** Verify frontend can reach backend (no CORS errors in browser console)
4. **Check logs:** Render Dashboard > Logs -- look for startup errors, missing env vars

### Frontend (Vercel)

1. **Load test:** Visit the Vercel URL, verify page loads without blank screen
2. **API proxy:** Verify `/api/*` rewrites to Render backend (check Network tab)
3. **Maps:** Verify Google Maps loads on Harvest page (if Maps key is set)
4. **Console:** Check for JS errors, missing env var warnings

### Integration

1. **Login flow:** Register a test user (requires REGISTRATION_SECRET), log in, verify JWT works
2. **File upload:** Upload a test document, verify it saves
3. **AI features:** Test a claim summary or AI workspace action (requires LLM keys)
4. **SMS:** Send a test SMS (if Twilio is configured)

---

## Render Deployment Config

No `render.yaml` was found in the project root. Current deployment is configured via Render Dashboard.

**Recommended Render service settings:**

| Setting | Value |
|---------|-------|
| Name | `eden-2` or `eden-gsot` |
| Region | Oregon (US West) |
| Branch | `master` |
| Root Directory | `frontend/backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Plan | Starter or Standard |

**NOTE:** There are TWO Render services (`eden-2` and `eden-gsot`). Consolidate to one. The `vercel.json` rewrites point to `eden-2.onrender.com`, but `.vercel/.env.production` points to `eden-gsot.onrender.com`. Pick one and update all references.

---

## Backend URL Inconsistency (ACTION REQUIRED)

| File | Points to |
|------|-----------|
| `frontend/vercel.json` (rewrites) | `eden-2.onrender.com` |
| `.vercel/.env.production` | `eden-gsot.onrender.com` |
| `frontend/.vercel/.env.production` | `eden-gsot.onrender.com` |
| `frontend/frontend/.env.production` | `eden-2.onrender.com` |

**Fix:** Decide which Render service is canonical, update all references to match, and delete the stale service.
