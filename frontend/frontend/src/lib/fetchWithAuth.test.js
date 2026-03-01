/**
 * Tests for fetchWithAuth.js — legacy fetch wrapper with cookies
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('REACT_APP_BACKEND_URL', 'http://localhost:8000');

const { fetchWithAuth, API_URL } = await import('./fetchWithAuth.js');

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
});

describe('API_URL', () => {
  it('is a string', () => {
    expect(typeof API_URL).toBe('string');
  });

  it('does not have trailing slash', () => {
    expect(API_URL.endsWith('/')).toBe(false);
  });
});

describe('fetchWithAuth', () => {
  it('prepends API_URL to relative endpoints', async () => {
    await fetchWithAuth('/api/claims');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toBe(`${API_URL}/api/claims`);
  });

  it('uses absolute URL directly when provided', async () => {
    await fetchWithAuth('https://other-api.com/data');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toBe('https://other-api.com/data');
  });

  it('always includes credentials: include', async () => {
    await fetchWithAuth('/api/test');

    const callConfig = global.fetch.mock.calls[0][1];
    expect(callConfig.credentials).toBe('include');
  });

  it('sets Content-Type to application/json by default', async () => {
    await fetchWithAuth('/api/test');

    const callConfig = global.fetch.mock.calls[0][1];
    expect(callConfig.headers['Content-Type']).toBe('application/json');
  });

  it('allows custom headers to override defaults', async () => {
    await fetchWithAuth('/api/test', {
      headers: { 'Content-Type': 'text/plain', 'X-Custom': 'val' },
    });

    const callConfig = global.fetch.mock.calls[0][1];
    expect(callConfig.headers['Content-Type']).toBe('text/plain');
    expect(callConfig.headers['X-Custom']).toBe('val');
  });

  it('passes through other options (method, body)', async () => {
    await fetchWithAuth('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });

    const callConfig = global.fetch.mock.calls[0][1];
    expect(callConfig.method).toBe('POST');
    expect(callConfig.body).toBe('{"name":"test"}');
  });

  it('returns the fetch response directly', async () => {
    const mockResponse = new Response('{"ok":true}', { status: 200 });
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    const result = await fetchWithAuth('/api/test');

    expect(result).toBe(mockResponse);
  });

  it('propagates fetch errors', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network error'));

    await expect(fetchWithAuth('/api/test')).rejects.toThrow('Network error');
  });
});
