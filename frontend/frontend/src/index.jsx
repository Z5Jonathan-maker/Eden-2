import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initSentry } from './lib/sentry';

// ============ SENTRY INITIALIZATION ============
// Initialize error tracking before React loads
initSentry();

// ============ ENVIRONMENT VALIDATION ============
// Empty string is valid — means same-origin (behind Vercel proxy or reverse proxy).
// Only fail if the var is truly undefined (never set at all).
if (import.meta.env.REACT_APP_BACKEND_URL == null && typeof window.__EDEN_CONFIG__?.BACKEND_URL === 'undefined') {
  console.warn('[Eden] REACT_APP_BACKEND_URL not set. Defaulting to same-origin (/api). Set it in .env if you need a different backend.');
}

// Force light mode - single source of truth
// Remove any dark mode artifacts before React loads
document.documentElement.classList.remove('dark', 'theme-dark');
document.body.classList.remove('dark', 'theme-dark');
document.documentElement.style.colorScheme = 'light';
localStorage.removeItem('eden_theme');
localStorage.removeItem('theme');

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
