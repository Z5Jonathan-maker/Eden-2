/**
 * Eden runtime config (served as a plain static file).
 *
 * This file is intentionally NOT bundled by React build tooling.
 * You can edit/replace it at deploy-time without rebuilding the frontend.
 *
 * Examples:
 * - Same-origin API (recommended behind reverse proxy):
 *     window.__EDEN_CONFIG__ = { BACKEND_URL: "" }
 * - Separate API domain:
 *     window.__EDEN_CONFIG__ = { BACKEND_URL: "https://api.yourdomain.com" }
 */
(function () {
  window.__EDEN_CONFIG__ = window.__EDEN_CONFIG__ || {};
  // Do not force BACKEND_URL to empty by default.
  // If unset, frontend falls back to build-time env vars (REACT_APP_BACKEND_URL/REACT_APP_API_URL).
  // Set window.__EDEN_CONFIG__.BACKEND_URL explicitly only when you want a runtime override.
})();
