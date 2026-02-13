# 🚨 The Fix: Rename Variable in Render

I found the issue! The error log says:
`RuntimeError: JWT_SECRET_KEY environment variable is required`

But I previously told you to set `JWT_SECRET`. **My apologies, the code specifically asks for `JWT_SECRET_KEY` (with `_KEY` at the end).**

## Immediate Fix Steps:

1.  Go to **Render Dashboard** -> **Eden** -> **Environment**.
2.  Find the variable named `JWT_SECRET`.
3.  **Rename** it to `JWT_SECRET_KEY`.
    *   (Or delete it and create a new one called `JWT_SECRET_KEY` with the same value).
4.  **Save Changes**.

Render will automatically redeploy. **This should fix the crash instantly.**
