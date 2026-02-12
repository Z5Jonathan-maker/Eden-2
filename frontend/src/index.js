import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// ============ API CONFIG VALIDATION ============
// Accept either build-time env vars or runtime eden-config.js.
const hasBuildTimeApiUrl = !!(process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL);
const hasRuntimeApiConfig =
  typeof window !== "undefined" &&
  window.__EDEN_CONFIG__ &&
  Object.prototype.hasOwnProperty.call(window.__EDEN_CONFIG__, "BACKEND_URL");

if (!hasBuildTimeApiUrl && !hasRuntimeApiConfig) {
  console.warn(
    "No API URL configured. Set REACT_APP_BACKEND_URL/REACT_APP_API_URL or define BACKEND_URL in public/eden-config.js."
  );
}

// Force light mode - single source of truth
// Remove any dark mode artifacts before React loads
document.documentElement.classList.remove("dark", "theme-dark");
document.body.classList.remove("dark", "theme-dark");
document.documentElement.style.colorScheme = "light";
localStorage.removeItem("eden_theme");
localStorage.removeItem("theme");

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

