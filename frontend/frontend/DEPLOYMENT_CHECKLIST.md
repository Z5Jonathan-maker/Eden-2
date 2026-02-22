# Final Deployment Checklist 📋

You are almost there! Here is the final checklist to ensure everything works in production.

## 1. Backend (Render)
- [ ] **Deployment Status**: Check Render Dashboard. It should say "Live" (green).
- [ ] **Environment Variables**: Ensure these are set in Render:
    - `MONGO_URL` (from your .env)
    - `DB_NAME` (`eden_claims`)
    - `JWT_SECRET` (random string)
    - `JWT_ALGORITHM` (`HS256`)
    - `ACCESS_TOKEN_EXPIRE_MINUTES` (`1440`)
    - `CORS_ORIGINS` (Add your Vercel URL here once you have it, e.g., `https://eden-frontend.vercel.app`)

## 2. Frontend (Vercel)
- [ ] **Create Project**: Import `frontend` folder in Vercel.
- [ ] **Environment Variables**: **CRITICAL!** You must add this in Vercel:
    - `REACT_APP_BACKEND_URL`: Your Render URL (e.g., `https://eden-backend.onrender.com`)
    - *Note: Do not add a trailing slash `/` at the end.*
- [ ] **Build**: Vercel should automatically detect `npm run build` (or `craco build`).

## 3. Post-Deployment
- [ ] **CORS Check**: Once Frontend is live, go back to Render -> Environment Variables and update `CORS_ORIGINS` to include the **exact** Vercel URL.
- [ ] **Redeploy Backend**: After updating CORS, redeploy the backend manually to apply changes.
- [ ] **Test Login**: Open your Vercel app and try to log in.

**Good luck! You have built something amazing.** 🚀
