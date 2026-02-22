# Backend Live? Next: Frontend!

If your Render service is now **Live (Green)**, the hardest part is done! 🎉

## Next Step: Deploy Frontend to Vercel

1.  Go to **[Vercel Dashboard](https://vercel.com/dashboard)**.
2.  Click **Add New...** -> **Project**.
3.  Import your **Eden-2** repository.
4.  **Important Settings**:
    *   **Root Directory**: Click "Edit" and select `frontend`.
    *   **Environment Variables**:
        *   Name: `REACT_APP_BACKEND_URL`
        *   Value: (Paste your Render URL here, e.g., `https://eden-backend.onrender.com`)
        *   *Note: No trailing slash at the end!*
5.  Click **Deploy**.

**Tell me "Done" when Vercel finishes deploying!**
