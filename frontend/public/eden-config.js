/**
 * Eden runtime config (served as a plain static file).
 *
 * This file is intentionally NOT bundled by React build tooling.
 * You can edit/replace it at deploy-time without rebuilding the frontend.
 *
 * Examples:
 * - Same-origin API (recommended — works behind Vercel proxy or reverse proxy):
 *     window.__EDEN_CONFIG__ = { BACKEND_URL: "" }
 * - Separate API domain (only if NOT behind a proxy):
 *     window.__EDEN_CONFIG__ = { BACKEND_URL: "https://api.yourdomain.com" }
 */
(function () {
  window.__EDEN_CONFIG__ = window.__EDEN_CONFIG__ || {};
  // Empty = same-origin (Vercel proxy). Set full URL only if no proxy.
  window.__EDEN_CONFIG__.BACKEND_URL = window.__EDEN_CONFIG__.BACKEND_URL || "";
})();

