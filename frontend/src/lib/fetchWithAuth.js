/**
 * Helper for components that haven't migrated to api.js yet
 * This ensures all fetch calls include httpOnly cookies
 *
 * @deprecated Use api.js or ApiService.js instead for new code
 */

const API_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://eden-gsot.onrender.com';

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
