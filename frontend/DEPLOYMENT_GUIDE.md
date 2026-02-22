# Deployment Guide

This project is set up to be deployed as two separate services:
1.  **Frontend**: Deployed to **Vercel** (Free).
2.  **Backend**: Deployed to **Render** (Free tier available).
3.  **Database**: **MongoDB Atlas** (Already set up!).

---

## Canonical Frontend Deploy (Required)

Always deploy frontend with:

```powershell
cd C:\Users\HP\Documents\trae_projects\eden 2\frontend
npm --prefix frontend run deploy:prod
```

This command is guarded by `scripts/deploy-eden2.ps1` and will:
- verify/re-link `.vercel/project.json` to project `eden2`
- deploy only from `frontend/`
- verify production alias `https://eden2-five.vercel.app`

Optional token-file flow:

```powershell
$env:VERCEL_TOKEN_PATH='C:\path\to\vercel.token'
npm --prefix frontend run deploy:prod
```

Do not run ad-hoc `vercel` commands from other directories.

---

## 1. Deploy Backend (Render)

1.  Push your code to **GitHub**.
2.  Create an account on [Render.com](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings**:
    *   **Root Directory**: `backend`
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6.  **Environment Variables** (Add these in the "Environment" tab):
    *   `MONGO_URL`: `mongodb+srv://z5jonathan_db_user:password123@cluster0.h3qhd0n.mongodb.net/?appName=Cluster0`
    *   `DB_NAME`: `eden_claims`
    *   `JWT_SECRET`: (Generate a random string)
    *   `JWT_ALGORITHM`: `HS256`
    *   `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`
    *   `CORS_ORIGINS`: `https://your-frontend-url.vercel.app,http://localhost:3000`
7.  Click **Deploy**.
8.  **Copy the Backend URL** (e.g., `https://eden-backend.onrender.com`).

---

## 2. Deploy Frontend (Vercel)

1.  Create an account on [Vercel.com](https://vercel.com).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Settings**:
    *   **Framework Preset**: Create frontend`React App
    *   **Root Directory**: ` (Click "Edit" next to Root Directory)
5.  **Environment Variables**:
    *   `REACT_APP_BACKEND_URL`: (Preferred) Paste your Render Backend URL here, e.g., `https://eden-backend.onrender.com`
    *   `REACT_APP_API_URL`: (Legacy fallback) Also supported if you already use it (Paste your Render Backend URL here, e.g., `https://eden-backend.onrender.com`)
6.  Click **Deploy**.

---

## 3. Final Connection

1.  Once the Frontend is deployed, copy its URL (e.g., `https://eden-frontend.vercel.app`).
2.  Go back to **Render** -> **Environment**.
3.  Update `CORS_ORIGINS` to include your new Vercel URL.
    *   Example: `https://eden-frontend.vercel.app,http://localhost:3000`
4.  **Redeploy** the backend (Manual Deploy -> Clear Cache & Deploy if needed).

## 4. Troubleshooting

*   **MongoDB Error?**
    *   Go to MongoDB Atlas -> Network Access.
    *   Ensure `0.0.0.0/0` (Allow Anywhere) is active.
*   **CORS Error?**
    *   Check that the Frontend URL is exactly correct in the Backend `CORS_ORIGINS`.
    *   Ensure no trailing slashes (e.g., `...app` not `...app/`).
