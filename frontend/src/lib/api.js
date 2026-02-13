/**
 * Centralized API client for Eden
 * - Uses httpOnly cookies for authentication (secure against XSS)
 * - Consistent error handling
 * - Simple in-memory caching
 * - Base URL from env
 */

const API_URL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_API_URL;

// Fail-fast helper (used by login + critical calls)
export const assertApiUrl = () => {
  if (!API_URL) {
    throw new Error(
      "Missing API base URL. Set REACT_APP_BACKEND_URL (preferred) or REACT_APP_API_URL to your backend, then rebuild/redeploy."
    );
  }
  return API_URL;
};

const defaultHeaders = () => ({
  'Content-Type': 'application/json',
});

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

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
 * @param {string} endpoint - API endpoint (e.g., '/api/claims/')
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
export async function api(endpoint, options = {}) {
  const baseUrl = assertApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const method = options.method || 'GET';
  const cacheOption = options.cache;
  const { cache: _cache, ...restOptions } = options;
  
  // Check cache for GET requests
  if (method === 'GET' && cacheOption !== false) {
    const cached = getCached(url);
    if (cached) return { ok: true, data: cached, cached: true };
  }
  
  const config = {
    method,
    headers: options.formData ? {} : defaultHeaders(),
    credentials: 'include', // Always include httpOnly cookies
    ...restOptions,
  };

  // Normalize legacy `cache: false` usage to valid Fetch semantics.
  if (cacheOption === false) {
    config.cache = 'no-store';
  } else if (typeof cacheOption === 'string') {
    config.cache = cacheOption;
  }

  // Don't stringify FormData
  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    // Add 30-second timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, { ...config, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { ok: false, error: errorData.detail || `Error ${res.status}`, status: res.status };
    }

    // Handle empty responses
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    // Cache successful GET responses
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

// Form data upload
export const apiUpload = (endpoint, formData) => api(endpoint, { 
  method: 'POST', 
  body: formData,
  formData: true 
});

// Cache invalidation
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
