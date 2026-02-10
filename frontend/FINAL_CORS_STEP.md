# Final Connection Step: CORS

Now that your Frontend is live, we need to tell the Backend that it's okay to accept requests from it.

## 1. Get your Vercel URL
It should look like: `https://eden-2-frontend.vercel.app` (or similar).
*   Copy it from your browser address bar when viewing your live site.

## 2. Update Render
1.  Go back to **[Render Dashboard](https://dashboard.render.com)** -> **Eden**.
2.  Go to **Environment**.
3.  Find `CORS_ORIGINS`.
4.  **Edit** it to include your Vercel URL.
    *   Format: `https://your-vercel-url.app,http://localhost:3000`
    *   *(Separate them with a comma, no spaces)*.
5.  **Save Changes**.

## 3. Redeploy
Render usually redeploys automatically on env var changes. If not, click **Manual Deploy** -> **Redeploy**.

**Once that finishes, your app is 100% LIVE!** 🚀
