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
const FALLBACK_BACKEND = 'https://eden-2.onrender.com';

const normalizeBackendBase = (value) => {
  if (value == null) return value;
  const trimmed = String(value).trim();

  // Explicit same-origin mode.
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  // Support relative backend paths if needed.
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }

  // Common production misconfig: host without scheme.
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) {
    return `https://${trimmed}`.replace(/\/+$/, '');
  }

  return trimmed.replace(/\/+$/, '');
};

const API_URL = normalizeBackendBase(
  import.meta.env.REACT_APP_BACKEND_URL ??
    import.meta.env.REACT_APP_API_URL ??
    (typeof window !== 'undefined' ? window.__EDEN_CONFIG__?.BACKEND_URL : undefined) ??
    FALLBACK_BACKEND
);

export const assertApiUrl = () => {
  return normalizeBackendBase(
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

  // CSRF protection: this header cannot be set by cross-origin form submissions.
  headers['X-Requested-With'] = 'XMLHttpRequest';

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// In-flight mutation tracking to prevent duplicate requests (double-click protection)
const inFlightMutations = new Map();

// Fast body fingerprint for dedup keys (not cryptographic, just collision-resistant)
const bodyFingerprint = (body) => {
  if (body == null) return '';
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
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
  const method = options.method || 'GET';

  // Dedup: prevent duplicate non-GET requests to the same endpoint
  if (method !== 'GET') {
    const dedupKey = `${method}:${endpoint}:${bodyFingerprint(options.body)}`;
    if (inFlightMutations.has(dedupKey)) {
      return inFlightMutations.get(dedupKey);
    }
    const promise = _apiFetch(endpoint, options);
    inFlightMutations.set(dedupKey, promise);
    try {
      return await promise;
    } finally {
      inFlightMutations.delete(dedupKey);
    }
  }

  return _apiFetch(endpoint, options);
}

// Token refresh lock — prevent multiple simultaneous refresh attempts
let _refreshPromise = null;

async function _tryRefreshToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const baseUrl = assertApiUrl();
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          setAuthToken(data.access_token);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

async function _apiFetch(endpoint, options = {}) {
  const baseUrl = assertApiUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
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

      // On 401, try refreshing the token before giving up
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/me');
      const isGoogleIntegration = endpoint.startsWith('/api/integrations/google/') || endpoint.startsWith('/api/oauth/google/');
      if (res.status === 401 && !isAuthEndpoint && !options._retried) {
        if (isGoogleIntegration) {
          // Google OAuth 401 — Eden session is fine, skip JWT refresh
          // Return the error directly so callers (GmailTab, DriveTab) can handle reconnect UI
        } else {
          const refreshed = await _tryRefreshToken();
          if (refreshed) {
            return _apiFetch(endpoint, { ...options, _retried: true });
          }
          window.dispatchEvent(new CustomEvent('eden:auth-expired'));
        }
      }

      return { ok: false, error: errorData.detail || `Error ${res.status}`, status: res.status };
    }

    const contentType = res.headers.get('content-type') || '';
    const isJsonResponse = contentType.includes('application/json');

    // For non-JSON content types (file downloads, XML, plain text), return raw text
    const text = await res.text();
    let data = null;
    if (text) {
      if (isJsonResponse) {
        try {
          data = JSON.parse(text);
        } catch (_parseErr) {
          // Server declared JSON but sent malformed body — log but treat as success
          // with raw text so callers can still inspect what arrived.
          console.warn('API: response Content-Type is JSON but body failed to parse', endpoint);
          data = text;
        }
      } else {
        // Non-JSON 200 (e.g. plain text, HTML, XML) — return raw text as data
        data = text;
      }
    }

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
