/**
 * Tests for api.js — centralized API client
 * Covers: auth tokens, headers, caching, dedup, token refresh, convenience methods
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock import.meta.env before importing the module
vi.stubEnv('REACT_APP_BACKEND_URL', 'http://localhost:8000');

// Must import AFTER env stub
const {
  api,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  apiUpload,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  assertApiUrl,
  clearCache,
  API_URL,
} = await import('./api.js');

// ── Helpers ──────────────────────────────────────────────────────────

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (detail, status) =>
  new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ── Setup / Teardown ─────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  clearCache();
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Auth Token Storage ───────────────────────────────────────────────

describe('setAuthToken / getAuthToken / clearAuthToken', () => {
  it('stores a token in localStorage', () => {
    setAuthToken('abc123');
    expect(getAuthToken()).toBe('abc123');
  });

  it('removes token when called with falsy value', () => {
    setAuthToken('abc123');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });

  it('setAuthToken with empty string removes token', () => {
    setAuthToken('abc123');
    setAuthToken('');
    expect(getAuthToken()).toBeNull();
  });

  it('clearAuthToken removes the stored token', () => {
    setAuthToken('abc123');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});

// ── assertApiUrl ─────────────────────────────────────────────────────

describe('assertApiUrl', () => {
  it('returns a non-null URL', () => {
    const url = assertApiUrl();
    expect(url).toBeTruthy();
    expect(typeof url).toBe('string');
  });
});

// ── API_URL ──────────────────────────────────────────────────────────

describe('API_URL', () => {
  it('is a string', () => {
    expect(typeof API_URL).toBe('string');
  });
});

// ── api() GET requests ───────────────────────────────────────────────

describe('api() GET requests', () => {
  it('makes a GET request and returns parsed JSON', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));

    const result = await api('/api/claims');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ items: [1, 2] });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('includes credentials: include', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test');

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.credentials).toBe('include');
  });

  it('includes X-Requested-With header for CSRF', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test');

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('includes Authorization header when token is set', async () => {
    setAuthToken('mytoken');
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test');

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['Authorization']).toBe('Bearer mytoken');
  });

  it('does not include Authorization header when no token', async () => {
    clearAuthToken();
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test');

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['Authorization']).toBeUndefined();
  });

  it('returns cached data on second call within TTL', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ val: 1 }));

    const first = await api('/api/cacheable');
    const second = await api('/api/cacheable');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual({ val: 1 });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('bypasses cache when cache: false', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ val: 1 }))
      .mockResolvedValueOnce(jsonResponse({ val: 2 }));

    await api('/api/nocache');
    const second = await api('/api/nocache', { cache: false });

    expect(second.data).toEqual({ val: 2 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('passes custom cache string to fetch config', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test', { cache: 'no-cache' });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.cache).toBe('no-cache');
  });

  it('handles absolute URLs without prepending base', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api('https://external.api.com/data');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://external.api.com/data');
  });
});

// ── api() POST / mutation deduplication ──────────────────────────────

describe('api() mutation deduplication', () => {
  it('deduplicates concurrent POST requests to the same endpoint with same body', async () => {
    let resolveFirst;
    const fetchPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    global.fetch = vi.fn().mockReturnValueOnce(fetchPromise);

    const p1 = api('/api/claims', { method: 'POST', body: { name: 'test' } });
    const p2 = api('/api/claims', { method: 'POST', body: { name: 'test' } });

    // Both should reference the same promise
    resolveFirst(jsonResponse({ id: 1 }));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('allows sequential POST requests after first completes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 1 }))
      .mockResolvedValueOnce(jsonResponse({ id: 2 }));

    const r1 = await api('/api/claims', { method: 'POST', body: { name: 'a' } });
    const r2 = await api('/api/claims', { method: 'POST', body: { name: 'a' } });

    expect(r1.data.id).toBe(1);
    expect(r2.data.id).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not deduplicate GET requests', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ a: 1 }))
      .mockResolvedValueOnce(jsonResponse({ a: 2 }));

    // Clear cache between calls
    const r1 = await api('/api/data1');
    clearCache();
    const r2 = await api('/api/data2');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses different dedup keys for different methods', async () => {
    let postResolve;
    let putResolve;
    global.fetch = vi.fn()
      .mockReturnValueOnce(new Promise(r => { postResolve = r; }))
      .mockReturnValueOnce(new Promise(r => { putResolve = r; }));

    const p1 = api('/api/claims', { method: 'POST', body: { x: 1 } });
    const p2 = api('/api/claims', { method: 'PUT', body: { x: 1 } });

    // Both should fire separate requests
    expect(global.fetch).toHaveBeenCalledTimes(2);

    postResolve(jsonResponse({}));
    putResolve(jsonResponse({}));
    await Promise.all([p1, p2]);
  });
});

// ── api() body serialization ─────────────────────────────────────────

describe('api() body handling', () => {
  it('JSON-stringifies body for POST', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/test', { method: 'POST', body: { name: 'hello' } });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.body).toBe('{"name":"hello"}');
  });

  it('does not stringify FormData body', async () => {
    const formData = new FormData();
    formData.append('file', 'test');
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/upload', { method: 'POST', body: formData, formData: true });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.body).toBeInstanceOf(FormData);
  });

  it('does not set Content-Type for FormData (browser sets it)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await api('/api/upload', { method: 'POST', body: new FormData(), formData: true });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBeUndefined();
  });
});

// ── api() error handling ─────────────────────────────────────────────

describe('api() error handling', () => {
  it('returns ok:false with error detail on 400', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(errorResponse('Bad input', 400));

    const result = await api('/api/test', { method: 'POST', body: {} });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Bad input');
    expect(result.status).toBe(400);
  });

  it('returns generic error message when response body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const result = await api('/api/test');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Error 500');
    expect(result.status).toBe(500);
  });

  it('returns network error on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await api('/api/test');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to fetch');
  });

  it('returns timeout error when AbortController fires', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    const result = await api('/api/slow');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('handles empty response body (204-like)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response('', { status: 200 })
    );

    const result = await api('/api/empty');

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ── 401 Token Refresh ────────────────────────────────────────────────

describe('api() 401 token refresh', () => {
  it('retries the request after successful token refresh', async () => {
    global.fetch = vi.fn()
      // First call: 401
      .mockResolvedValueOnce(errorResponse('Unauthorized', 401))
      // Refresh call: success
      .mockResolvedValueOnce(jsonResponse({ access_token: 'newtoken' }))
      // Retry call: success
      .mockResolvedValueOnce(jsonResponse({ data: 'success' }));

    const result = await api('/api/protected');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ data: 'success' });
    expect(getAuthToken()).toBe('newtoken');
    // 3 calls: original, refresh, retry
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('dispatches eden:auth-expired when refresh fails', async () => {
    const listener = vi.fn();
    window.addEventListener('eden:auth-expired', listener);

    global.fetch = vi.fn()
      // First call: 401
      .mockResolvedValueOnce(errorResponse('Unauthorized', 401))
      // Refresh call: fails
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));

    const result = await api('/api/protected');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener('eden:auth-expired', listener);
  });

  it('does not attempt refresh on auth endpoints (login)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse('Bad creds', 401));

    const result = await api('/api/auth/login', { method: 'POST', body: {} });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    // Only 1 call — no refresh attempt
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('does not attempt refresh on register endpoint', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse('Exists', 401));

    const result = await api('/api/auth/register', { method: 'POST', body: {} });

    expect(result.ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('does not retry more than once (_retried flag)', async () => {
    global.fetch = vi.fn()
      // First call: 401
      .mockResolvedValueOnce(errorResponse('Unauthorized', 401))
      // Refresh: success
      .mockResolvedValueOnce(jsonResponse({ access_token: 'new' }))
      // Retry: still 401 — since _retried is true, no second refresh attempt
      .mockResolvedValueOnce(errorResponse('Still unauthorized', 401));

    const result = await api('/api/protected');

    // The second 401 should NOT trigger another refresh because _retried=true
    // It should return the error result
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    // 3 calls total: original, refresh, retry (no second refresh)
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

// ── Convenience methods ──────────────────────────────────────────────

describe('convenience methods', () => {
  it('apiGet makes GET request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ x: 1 }));

    const result = await apiGet('/api/test');

    expect(result.ok).toBe(true);
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('GET');
  });

  it('apiPost makes POST request with body', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ id: 1 }));

    const result = await apiPost('/api/test', { name: 'test' });

    expect(result.ok).toBe(true);
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('POST');
    expect(callArgs.body).toBe('{"name":"test"}');
  });

  it('apiPut makes PUT request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await apiPut('/api/test', { name: 'updated' });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('PUT');
  });

  it('apiPatch makes PATCH request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await apiPatch('/api/test', { field: 'value' });

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('PATCH');
  });

  it('apiDelete makes DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}));

    await apiDelete('/api/test');

    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('DELETE');
  });

  it('apiUpload sends FormData with formData flag', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ uploaded: true }));
    const fd = new FormData();
    fd.append('file', 'data');

    const result = await apiUpload('/api/upload', fd);

    expect(result.ok).toBe(true);
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.method).toBe('POST');
    expect(callArgs.body).toBeInstanceOf(FormData);
  });
});

// ── clearCache ───────────────────────────────────────────────────────

describe('clearCache', () => {
  it('clears all cache when called without pattern', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ a: 1 }))
      .mockResolvedValueOnce(jsonResponse({ a: 2 }));

    await api('/api/cached');
    clearCache();
    const r2 = await api('/api/cached');

    expect(r2.cached).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('clears only matching cache entries with pattern', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ a: 1 }))
      .mockResolvedValueOnce(jsonResponse({ b: 2 }))
      .mockResolvedValueOnce(jsonResponse({ a: 3 }));

    await api('/api/claims');
    await api('/api/notes');

    clearCache('claims');

    // claims should re-fetch
    const r3 = await api('/api/claims');
    expect(r3.cached).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // notes should still be cached
    const r4 = await api('/api/notes');
    expect(r4.cached).toBe(true);
  });
});
