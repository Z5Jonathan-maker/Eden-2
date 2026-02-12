const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const normalizeBaseUrl = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

export const resolveBackendUrl = () => {
  if (typeof window !== "undefined" && window.__EDEN_CONFIG__ && hasOwn(window.__EDEN_CONFIG__, "BACKEND_URL")) {
    // Runtime config takes precedence, including explicit empty string for same-origin.
    return normalizeBaseUrl(window.__EDEN_CONFIG__.BACKEND_URL);
  }

  return normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "");
};

export const buildApiUrl = (path) => {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveBackendUrl()}${safePath}`;
};

