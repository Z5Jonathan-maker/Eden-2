/**
 * Centralized API client for Eden
 * - Dual auth: httpOnly cookies (primary) + Bearer token fallback
 * - Consistent error handling
 * - Simple in-memory caching
 * - Base URL from env
 */

// Empty string "" = same-origin proxy (Vercel rewrites /api/* to backend).
// Full URL = direct cross-origin requests (needs CORS).
// ?? preserves "" as a valid value; only null/undefined triggers next check.
const FALLBACK_BACKEND = 'https://eden-gsot.onrender.com';

const API_URL =
  import.meta.env.REACT_APP_BACKEND_URL ??
  import.meta.env.REACT_APP_API_URL ??
  (typeof window !== 'undefined' ? window.__EDEN_CONFIG__?.BACKEND_URL : undefined) ??
  FALLBACK_BACKEND;

export const assertApiUrl = () => {
  return (
    API_URL ??
    (typeof window !== 'undefined' ? window.__EDEN_CONFIG__?.BACKEND_URL : undefined) ??
    FALLBACK_BACKEND
  );
};

// ── Bearer token storage (localStorage) ──────────────────────────
// Backend accepts both cookies AND Authorization: Bearer headers.
// Storing the token explicitly makes cross-origin auth bulletproof
// regardless of browser cookie policies.
const TOKEN_KEY = 'eden_token';

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

// Build headers with auth token when available
const buildHeaders = (isFormData) => {
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 30000;

const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Make an authenticated API request
 */
export async function api(endpoint, options = {}) {
  const baseUrl = assertApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const method = options.method || 'GET';
  const cacheOption = options.cache;
  const { cache: _cache, ...restOptions } = options;

  if (method === 'GET' && cacheOption !== false) {
    const cached = getCached(url);
    if (cached) return { ok: true, data: cached, cached: true };
  }

  const config = {
    method,
    headers: buildHeaders(options.formData),
    credentials: 'include',
    ...restOptions,
  };

  if (cacheOption === false) {
    config.cache = 'no-store';
  } else if (typeof cacheOption === 'string') {
    config.cache = cacheOption;
  }

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const res = await fetch(url, { ...config, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { ok: false, error: errorData.detail || `Error ${res.status}`, status: res.status };
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (method === 'GET' && cacheOption !== false) {
      setCache(url, data);
    }

    return { ok: true, data };
  } catch (err) {
    console.error('API error:', err);
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timeout - backend server may be starting up (Render cold start). Please wait 30-60 seconds and try again.' };
    }
    return { ok: false, error: err.message || 'Network error' };
  }
}

// Convenience methods
export const apiGet = (endpoint, options) => api(endpoint, { method: 'GET', ...options });
export const apiPost = (endpoint, body) => api(endpoint, { method: 'POST', body });
export const apiPut = (endpoint, body) => api(endpoint, { method: 'PUT', body });
export const apiPatch = (endpoint, body) => api(endpoint, { method: 'PATCH', body });
export const apiDelete = (endpoint) => api(endpoint, { method: 'DELETE' });

export const apiUpload = (endpoint, formData) => api(endpoint, {
  method: 'POST',
  body: formData,
  formData: true
});

export const clearCache = (pattern) => {
  if (!pattern) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key);
    }
  }
};

export { API_URL };
