/**
 * Helper for components that haven't migrated to api.js yet
 * This ensures all fetch calls include httpOnly cookies
 *
 * @deprecated Use api.js or ApiService.js instead for new code
 */

const normalizeBackendBase = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }
  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) {
    return `https://${trimmed}`.replace(/\/+$/, '');
  }
  return trimmed.replace(/\/+$/, '');
};

const API_URL = normalizeBackendBase(import.meta.env.REACT_APP_BACKEND_URL ?? 'https://eden-gsot.onrender.com');

export const fetchWithAuth = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    credentials: 'include', // Always include httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};

export { API_URL };
