/**
 * Sentry Error Tracking - Lazy-loaded
 *
 * @sentry/react (~70KB gzip) is loaded via dynamic import() so it stays OUT
 * of the critical rendering path.  The exported functions are thin wrappers
 * that queue calls until the SDK finishes loading.
 *
 * Consumers can continue to `import { captureError } from '../lib/sentry'`
 * without any changes — the static import only pulls this small shim into
 * the main bundle, not the actual Sentry SDK.
 */

const SENTRY_DSN = typeof import.meta !== 'undefined'
  ? import.meta.env?.REACT_APP_SENTRY_DSN
  : undefined;

const ENVIRONMENT = typeof import.meta !== 'undefined'
  ? (import.meta.env?.REACT_APP_ENVIRONMENT || import.meta.env?.NODE_ENV)
  : 'development';

// Resolved once the SDK is loaded (or null if skipped)
let _sentry = null;
let _loaded = false;

/**
 * Lazily load the Sentry SDK. Returns the Sentry namespace or null.
 */
function loadSentry() {
  if (_loaded) return Promise.resolve(_sentry);
  if (!SENTRY_DSN || ENVIRONMENT === 'development') {
    _loaded = true;
    return Promise.resolve(null);
  }

  return import('@sentry/react').then((mod) => {
    _sentry = mod;
    _loaded = true;
    return mod;
  }).catch((err) => {
    console.warn('[Sentry] Failed to load SDK', err);
    _loaded = true;
    return null;
  });
}

/**
 * Initialize Sentry. Call once at app startup.
 */
export function initSentry() {
  if (!SENTRY_DSN || ENVIRONMENT === 'development') {
    console.log('[Sentry] Skipped initialization (dev mode or no DSN)');
    return;
  }

  loadSentry().then((Sentry) => {
    if (!Sentry) return;

    const { browserTracingIntegration, replayIntegration } = Sentry;

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      integrations: [
        browserTracingIntegration(),
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      release: import.meta.env?.REACT_APP_VERSION || 'unknown',
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'AbortError',
      ],
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        if (event.tags) {
          event.tags.userAgent = navigator.userAgent;
          event.tags.viewport = `${window.innerWidth}x${window.innerHeight}`;
        }
        return event;
      },
    });

    console.log('[Sentry] Initialized successfully');
  });
}

/**
 * Set user context (call after login)
 */
export function setSentryUser(user) {
  if (!SENTRY_DSN) return;
  loadSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  });
}

/**
 * Clear user context (call on logout)
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  loadSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.setUser(null);
  });
}

/**
 * Manually capture an error
 */
export function captureError(error, context = {}) {
  if (!SENTRY_DSN) {
    console.error('[Sentry fallback]', error, context);
    return;
  }
  loadSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.captureException(error, { extra: context });
  });
}

/**
 * Capture a breadcrumb (for debugging)
 */
export function captureBreadcrumb(message, data = {}) {
  if (!SENTRY_DSN) return;
  loadSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.addBreadcrumb({ message, data, level: 'info' });
  });
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking(fn, operationName) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, {
        operation: operationName,
        args: JSON.stringify(args).substring(0, 200),
      });
      throw error;
    }
  };
}

// Default export: a proxy-like object for backward compat
// Code that did `import Sentry from './sentry'` and called Sentry.xyz
// should migrate to the named exports above.
export default { captureError, captureException: captureError, setSentryUser, clearSentryUser };
