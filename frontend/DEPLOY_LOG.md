# Troubleshooting Deployment 🛠️

It seems the app is failing to start on Render. Since I cannot see your Render dashboard, we need to find the specific error message to fix it.

## Step 1: Check Render Logs (Critical)

1.  Go to your **Render Dashboard**.
2.  Click on the **Eden** (Backend) service.
3.  Click on **Logs** in the left sidebar.
4.  Look for **Red text** or lines that say `Error`, `Traceback`, or `ModuleNotFoundError`.

### Common Errors & Fixes:

| Error Message | Meaning | Fix |
| :--- | :--- | :--- |
| `ModuleNotFoundError: No module named 'services'` | Python path issue | Ensure `backend` is the Root Directory in Render settings. |
| `RuntimeError: MONGO_URL environment variable is required` | Missing Config | Go to **Environment** tab and add `MONGO_URL` (copy from `RENDER_ENV_VARS.txt`). |
| `ImportError: cannot import name '...'` | Circular Dependency | Check the traceback to see which file is causing the loop. |
| `OSError: ... pdf2image ... poppler` | Missing System Dep | We might need to switch to Docker deployment if PDF parsing requires system libraries. |

## Step 2: Verify Environment Variables

Go to the **Environment** tab in Render and ensure these exact keys exist:

*   `MONGO_URL`
*   `DB_NAME`
*   `JWT_SECRET`
*   `JWT_ALGORITHM`
*   `ACCESS_TOKEN_EXPIRE_MINUTES`
*   `CORS_ORIGINS`

## Step 3: Share the Error

If you see an error log, **copy and paste it here**.
*   Example: `File "server.py", line 10, in <module> ... ImportError: ...`

Once you paste the log, I can fix it instantly!
