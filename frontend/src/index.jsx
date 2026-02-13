import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initSentry } from './lib/sentry';

// ============ SENTRY INITIALIZATION ============
// Initialize error tracking before React loads
initSentry();

// ============ ENVIRONMENT VALIDATION ============
// Fail fast if critical environment variables are missing
// Note: Vite only replaces direct references like import.meta.env.VITE_X or process.env.REACT_APP_X
// Dynamic property access like process.env[key] won't work after build
if (!import.meta.env.REACT_APP_BACKEND_URL && !process.env.REACT_APP_BACKEND_URL) {
  const errorMessage = `\n=== ENVIRONMENT CONFIGURATION ERROR ===\n\nMissing required environment variables:\nREACT_APP_BACKEND_URL: Backend API URL (e.g., http://localhost:8000)\n\nPlease create a .env file in the frontend root directory with these variables.\nSee .env.example for a template.\n\n========================================\n`;
  console.error(errorMessage);
  document.body.innerHTML = `
    <div style="font-family: monospace; background: #1a1a1a; color: #ff6b6b; padding: 20px; margin: 20px;">
      <h2>❌ Configuration Error</h2>
      <pre>${errorMessage}</pre>
    </div>
  `;
  throw new Error(errorMessage);
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
