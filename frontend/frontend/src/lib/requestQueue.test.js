/**
 * Tests for requestQueue.js — offline request queue with dedup
 *
 * We test the actual exported singleton by resetting its state between tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub env BEFORE the module is imported so the constructor reads it
vi.stubEnv('REACT_APP_ENABLE_OFFLINE_QUEUE', 'true');

// The module self-registers event listeners and sets up intervals on import.
// We import it fresh to get the real singleton.
const { requestQueue } = await import('./requestQueue.js');

beforeEach(() => {
  localStorage.clear();
  // Reset the queue's internal state for test isolation
  requestQueue.queue = [];
  requestQueue.isProcessing = false;
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── loadQueue ────────────────────────────────────────────────────────

describe('RequestQueue.loadQueue', () => {
  it('returns empty array when nothing in localStorage', () => {
    const result = requestQueue.loadQueue();
    expect(result).toEqual([]);
  });

  it('loads existing queue from localStorage', () => {
    const items = [{ id: '1', fingerprint: 'abc', timestamp: Date.now(), request: {}, retryCount: 0 }];
    localStorage.setItem('eden_offline_queue', JSON.stringify(items));
    const result = requestQueue.loadQueue();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when localStorage has invalid JSON', () => {
    localStorage.setItem('eden_offline_queue', '{broken json');
    const result = requestQueue.loadQueue();
    expect(result).toEqual([]);
  });
});

// ── saveQueue ────────────────────────────────────────────────────────

describe('RequestQueue.saveQueue', () => {
  it('saves queue to localStorage', () => {
    requestQueue.queue = [{ id: 'test', fingerprint: 'fp', timestamp: 1, request: {}, retryCount: 0 }];
    requestQueue.saveQueue();
    const stored = JSON.parse(localStorage.getItem('eden_offline_queue'));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('test');
  });

  it('dispatches offline-queue-changed event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    requestQueue.queue = [{ id: 'x' }];
    requestQueue.saveQueue();

    const offlineEvents = dispatchSpy.mock.calls.filter(
      (call) => call[0]?.type === 'offline-queue-changed'
    );
    expect(offlineEvents).toHaveLength(1);
    dispatchSpy.mockRestore();
  });
});

// ── _fingerprint ─────────────────────────────────────────────────────

describe('RequestQueue._fingerprint', () => {
  it('produces consistent fingerprints for same input', () => {
    const fp1 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{"a":1}' });
    const fp2 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{"a":1}' });
    expect(fp1).toBe(fp2);
  });

  it('produces different fingerprints for different URLs', () => {
    const fp1 = requestQueue._fingerprint('/api/test1', { method: 'POST', body: '{}' });
    const fp2 = requestQueue._fingerprint('/api/test2', { method: 'POST', body: '{}' });
    expect(fp1).not.toBe(fp2);
  });

  it('produces different fingerprints for different methods', () => {
    const fp1 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{}' });
    const fp2 = requestQueue._fingerprint('/api/test', { method: 'PUT', body: '{}' });
    expect(fp1).not.toBe(fp2);
  });

  it('produces different fingerprints for different bodies', () => {
    const fp1 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{"a":1}' });
    const fp2 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{"a":2}' });
    expect(fp1).not.toBe(fp2);
  });

  it('handles missing body', () => {
    const fp = requestQueue._fingerprint('/api/test', { method: 'POST' });
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });

  it('handles object body by stringifying', () => {
    const fp1 = requestQueue._fingerprint('/api/test', { method: 'POST', body: { a: 1 } });
    const fp2 = requestQueue._fingerprint('/api/test', { method: 'POST', body: '{"a":1}' });
    expect(fp1).toBe(fp2);
  });
});

// ── add ──────────────────────────────────────────────────────────────

describe('RequestQueue.add', () => {
  it('adds a POST request to the queue', () => {
    const id = requestQueue.add('/api/claims', { method: 'POST', body: '{"name":"test"}' });
    expect(id).toBeDefined();
    expect(requestQueue.queue).toHaveLength(1);
    expect(requestQueue.queue[0].request.url).toBe('/api/claims');
  });

  it('ignores GET requests', () => {
    const id = requestQueue.add('/api/claims', { method: 'GET' });
    expect(id).toBeUndefined();
    expect(requestQueue.queue).toHaveLength(0);
  });

  it('ignores requests with no method', () => {
    const id = requestQueue.add('/api/claims', {});
    expect(id).toBeUndefined();
    expect(requestQueue.queue).toHaveLength(0);
  });

  it('ignores FormData requests', () => {
    const id = requestQueue.add('/api/upload', { method: 'POST', body: new FormData() });
    expect(id).toBeUndefined();
    expect(requestQueue.queue).toHaveLength(0);
  });

  it('rejects duplicate requests within 5 seconds', () => {
    requestQueue.add('/api/claims', { method: 'POST', body: '{"x":1}' });
    const id2 = requestQueue.add('/api/claims', { method: 'POST', body: '{"x":1}' });
    expect(id2).toBeUndefined();
    expect(requestQueue.queue).toHaveLength(1);
  });

  it('allows same request after 5 seconds', () => {
    requestQueue.add('/api/claims', { method: 'POST', body: '{"x":1}' });
    vi.advanceTimersByTime(5001);
    const id2 = requestQueue.add('/api/claims', { method: 'POST', body: '{"x":1}' });
    expect(id2).toBeDefined();
    expect(requestQueue.queue).toHaveLength(2);
  });

  it('allows different requests immediately', () => {
    requestQueue.add('/api/claims', { method: 'POST', body: '{"x":1}' });
    const id2 = requestQueue.add('/api/claims', { method: 'POST', body: '{"x":2}' });
    expect(id2).toBeDefined();
    expect(requestQueue.queue).toHaveLength(2);
  });

  it('persists to localStorage after add', () => {
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    const stored = JSON.parse(localStorage.getItem('eden_offline_queue'));
    expect(stored).toHaveLength(1);
  });

  it('adds PUT requests', () => {
    const id = requestQueue.add('/api/test', { method: 'PUT', body: '{}' });
    expect(id).toBeDefined();
  });

  it('adds DELETE requests', () => {
    const id = requestQueue.add('/api/test', { method: 'DELETE', body: '' });
    expect(id).toBeDefined();
  });

  it('adds PATCH requests', () => {
    const id = requestQueue.add('/api/test', { method: 'PATCH', body: '{"field":"val"}' });
    expect(id).toBeDefined();
  });
});

// ── processQueue ─────────────────────────────────────────────────────

describe('RequestQueue.processQueue', () => {
  it('does nothing when queue is empty', async () => {
    await requestQueue.processQueue();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when already processing', async () => {
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    requestQueue.isProcessing = true;
    await requestQueue.processQueue();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('removes item from queue on successful fetch', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    expect(requestQueue.queue).toHaveLength(1);

    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('discards item on 4xx client error (not 429)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 400 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(0);
  });

  it('keeps item in queue on 429 (rate limit)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(1);
    expect(requestQueue.queue[0].retryCount).toBe(1);
  });

  it('keeps item in queue on 5xx error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 500 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(1);
    expect(requestQueue.queue[0].retryCount).toBe(1);
  });

  it('discards item after max retries (10)', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    requestQueue.queue[0].retryCount = 10;
    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(0);
  });

  it('keeps item in queue on network error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network error'));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(1);
  });

  it('processes next item after successful first item', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    // Manually push 2 items to avoid dedup
    requestQueue.queue.push({
      id: '1', fingerprint: 'a', timestamp: Date.now() - 10000,
      request: { url: '/api/first', config: { method: 'POST' } }, retryCount: 0,
    });
    requestQueue.queue.push({
      id: '2', fingerprint: 'b', timestamp: Date.now() - 10000,
      request: { url: '/api/second', config: { method: 'POST' } }, retryCount: 0,
    });

    await requestQueue.processQueue();
    expect(requestQueue.queue).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('resets isProcessing flag after completion', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.isProcessing).toBe(false);
  });

  it('resets isProcessing flag on network error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('offline'));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.isProcessing).toBe(false);
  });

  it('resets isProcessing flag on server error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 }));
    requestQueue.add('/api/test', { method: 'POST', body: '{}' });
    await requestQueue.processQueue();
    expect(requestQueue.isProcessing).toBe(false);
  });
});

// ── getQueue ─────────────────────────────────────────────────────────

describe('RequestQueue.getQueue', () => {
  it('returns the current queue array', () => {
    requestQueue.add('/api/a', { method: 'POST', body: '{}' });
    expect(requestQueue.getQueue()).toBe(requestQueue.queue);
    expect(requestQueue.getQueue()).toHaveLength(1);
  });

  it('returns empty array when no items', () => {
    expect(requestQueue.getQueue()).toEqual([]);
  });
});
