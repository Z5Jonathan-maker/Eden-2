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
const requiredEnvVars = {
  'REACT_APP_BACKEND_URL': 'Backend API URL (e.g., http://localhost:8000)'
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key]) => !process.env[key])
  .map(([key, description]) => `${key}: ${description}`);

if (missingVars.length > 0) {
  const errorMessage = `\n=== ENVIRONMENT CONFIGURATION ERROR ===\n\nMissing required environment variables:\n${missingVars.join('\n')}\n\nPlease create a .env file in the frontend root directory with these variables.\nSee .env.example for a template.\n\n========================================\n`;
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
