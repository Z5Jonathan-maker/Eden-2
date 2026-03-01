/**
 * Tests for sentry.js — lazy-loaded error tracking configuration
 *
 * Since sentry.js uses dynamic import() internally, all Sentry SDK calls
 * happen asynchronously via .then(). We flush microtasks before asserting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentry/react before importing the module
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  browserTracingIntegration: vi.fn(() => 'browser-tracing-mock'),
  replayIntegration: vi.fn(() => 'replay-mock'),
}));

// Stub env — use a DSN so all code paths are exercised
vi.stubEnv('REACT_APP_SENTRY_DSN', 'https://fake@sentry.io/123');
vi.stubEnv('REACT_APP_ENVIRONMENT', 'production');
vi.stubEnv('REACT_APP_VERSION', '1.0.0-test');

const {
  initSentry,
  setSentryUser,
  clearSentryUser,
  captureError,
  captureBreadcrumb,
  withErrorTracking,
} = await import('./sentry.js');

const Sentry = await import('@sentry/react');

/** Flush microtask queue so .then() callbacks in sentry.js execute */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── initSentry ───────────────────────────────────────────────────────

describe('initSentry', () => {
  it('initializes Sentry when DSN is configured and environment is production', async () => {
    initSentry();
    await flush();
    expect(Sentry.init).toHaveBeenCalledOnce();
    const config = Sentry.init.mock.calls[0][0];
    expect(config.dsn).toBe('https://fake@sentry.io/123');
    expect(config.environment).toBe('production');
  });

  it('configures performance monitoring with 10% sample rate in production', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    expect(config.tracesSampleRate).toBe(0.1);
  });

  it('configures replay integrations', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    expect(config.replaysSessionSampleRate).toBe(0.1);
    expect(config.replaysOnErrorSampleRate).toBe(1.0);
  });

  it('sets release version', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    expect(config.release).toBe('1.0.0-test');
  });

  it('includes ignoreErrors list', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    expect(config.ignoreErrors).toContain('Failed to fetch');
    expect(config.ignoreErrors).toContain('AbortError');
  });

  it('beforeSend strips cookies and headers from request', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    const event = {
      request: { cookies: 'secret', headers: { auth: 'token' } },
      tags: {},
    };
    const processed = config.beforeSend(event, {});
    expect(processed.request.cookies).toBeUndefined();
    expect(processed.request.headers).toBeUndefined();
  });

  it('beforeSend adds viewport and userAgent tags', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    const event = { tags: {} };
    const processed = config.beforeSend(event, {});
    expect(processed.tags.userAgent).toBeDefined();
    expect(processed.tags.viewport).toBeDefined();
  });

  it('beforeSend handles event without request gracefully', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    const event = { tags: {} };
    expect(() => config.beforeSend(event, {})).not.toThrow();
  });

  it('beforeSend handles event without tags gracefully', async () => {
    initSentry();
    await flush();
    const config = Sentry.init.mock.calls[0][0];
    const event = { request: { cookies: 'x' } };
    expect(() => config.beforeSend(event, {})).not.toThrow();
  });
});

// ── setSentryUser ────────────────────────────────────────────────────

describe('setSentryUser', () => {
  it('calls Sentry.setUser with user data when DSN is configured', async () => {
    setSentryUser({ id: '1', email: 'test@test.com', role: 'admin' });
    await flush();
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: '1',
      email: 'test@test.com',
      role: 'admin',
    });
  });
});

// ── clearSentryUser ──────────────────────────────────────────────────

describe('clearSentryUser', () => {
  it('calls Sentry.setUser with null when DSN is configured', async () => {
    clearSentryUser();
    await flush();
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});

// ── captureError ─────────────────────────────────────────────────────

describe('captureError', () => {
  it('calls Sentry.captureException when DSN is configured', async () => {
    const error = new Error('test error');
    captureError(error, { context: 'test' });
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { context: 'test' },
    });
  });

  it('accepts empty context', async () => {
    const error = new Error('test');
    captureError(error);
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {},
    });
  });
});

// ── captureBreadcrumb ────────────────────────────────────────────────

describe('captureBreadcrumb', () => {
  it('calls Sentry.addBreadcrumb when DSN is configured', async () => {
    captureBreadcrumb('navigation', { page: '/home' });
    await flush();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'navigation',
      data: { page: '/home' },
      level: 'info',
    });
  });

  it('uses empty object for data when not provided', async () => {
    captureBreadcrumb('test message');
    await flush();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'test message',
      data: {},
      level: 'info',
    });
  });
});

// ── withErrorTracking ────────────────────────────────────────────────

describe('withErrorTracking', () => {
  it('returns an async function wrapper', () => {
    const fn = async () => 'result';
    const wrapped = withErrorTracking(fn, 'testOp');
    expect(typeof wrapped).toBe('function');
  });

  it('passes through the return value on success', async () => {
    const fn = async (x) => x * 2;
    const wrapped = withErrorTracking(fn, 'multiply');

    const result = await wrapped(5);
    expect(result).toBe(10);
  });

  it('re-throws errors after capturing them', async () => {
    const fn = async () => {
      throw new Error('boom');
    };
    const wrapped = withErrorTracking(fn, 'failing');

    await expect(wrapped()).rejects.toThrow('boom');
  });

  it('calls Sentry.captureException on failure with context', async () => {
    const error = new Error('tracked error');
    const fn = async () => {
      throw error;
    };
    const wrapped = withErrorTracking(fn, 'trackedOp');

    await expect(wrapped('arg1')).rejects.toThrow('tracked error');
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {
        operation: 'trackedOp',
        args: '["arg1"]',
      },
    });
  });

  it('passes arguments through to the wrapped function', async () => {
    const fn = vi.fn(async (a, b) => a + b);
    const wrapped = withErrorTracking(fn, 'add');

    await wrapped(3, 7);
    expect(fn).toHaveBeenCalledWith(3, 7);
  });
});
