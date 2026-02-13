/**
 * Sentry Error Tracking Configuration
 *
 * Production-grade error monitoring and performance tracking
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Only initialize Sentry in production
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const ENVIRONMENT = process.env.REACT_APP_ENVIRONMENT || process.env.NODE_ENV;

export function initSentry() {
  // Skip initialization if no DSN or in development
  if (!SENTRY_DSN || ENVIRONMENT === 'development') {
    console.log('[Sentry] Skipped initialization (dev mode or no DSN)');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in staging

    // Session Replay (for debugging)
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when errors occur

    // Release tracking
    release: process.env.REACT_APP_VERSION || 'unknown',

    // Ignore common non-critical errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'AbortError',
    ],

    // User context (do not send PII)
    beforeSend(event, hint) {
      // Remove sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      // Add custom tags
      if (event.tags) {
        event.tags.userAgent = navigator.userAgent;
        event.tags.viewport = `${window.innerWidth}x${window.innerHeight}`;
      }

      return event;
    },
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Set user context (call after login)
 * @param {object} user - User object with id, email, role
 */
export function setSentryUser(user) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    email: user.email, // Sentry sanitizes emails by default
    role: user.role,
  });
}

/**
 * Clear user context (call on logout)
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Manually capture an error
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export function captureError(error, context = {}) {
  if (!SENTRY_DSN) {
    console.error('[Sentry fallback]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a breadcrumb (for debugging)
 * @param {string} message - Breadcrumb message
 * @param {object} data - Additional data
 */
export function captureBreadcrumb(message, data = {}) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  });
}

/**
 * Wrap an async function with error tracking
 * @param {Function} fn - Async function to wrap
 * @param {string} operationName - Name for tracking
 */
export function withErrorTracking(fn, operationName) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, {
        operation: operationName,
        args: JSON.stringify(args).substring(0, 200), // Limit size
      });
      throw error;
    }
  };
}

export default Sentry;
