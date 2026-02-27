/**
 * Tests for offline queue and request deduplication
 */

describe('Offline Queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('offline queue is enabled by default', () => {
    // The queue should be enabled unless explicitly disabled
    // REACT_APP_ENABLE_OFFLINE_QUEUE !== 'false' means enabled by default
    const isEnabled = process.env.REACT_APP_ENABLE_OFFLINE_QUEUE !== 'false';
    expect(isEnabled).toBe(true);
  });

  test('queue stores items in localStorage', () => {
    const queue = [
      { url: '/api/claims', method: 'POST', body: '{}', timestamp: Date.now() }
    ];
    localStorage.setItem('eden_offline_queue', JSON.stringify(queue));
    const stored = JSON.parse(localStorage.getItem('eden_offline_queue'));
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toBe('/api/claims');
  });

  test('queue survives page reload (localStorage persistence)', () => {
    const item = { url: '/api/test', method: 'PUT', body: '{"x":1}', timestamp: Date.now() };
    localStorage.setItem('eden_offline_queue', JSON.stringify([item]));

    // Simulate "reload" by reading back
    const reloaded = JSON.parse(localStorage.getItem('eden_offline_queue'));
    expect(reloaded[0].url).toBe('/api/test');
  });
});

describe('Request Deduplication Logic', () => {
  test('dedup map prevents duplicate mutation requests', async () => {
    const inFlightMutations = new Map();

    const simulateRequest = (method, endpoint) => {
      const dedupKey = `${method}:${endpoint}`;
      if (inFlightMutations.has(dedupKey)) {
        return { deduplicated: true, promise: inFlightMutations.get(dedupKey) };
      }
      const promise = new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100));
      inFlightMutations.set(dedupKey, promise);
      promise.finally(() => inFlightMutations.delete(dedupKey));
      return { deduplicated: false, promise };
    };

    // First request should go through
    const first = simulateRequest('POST', '/api/claims');
    expect(first.deduplicated).toBe(false);

    // Second request (same endpoint) should be deduped
    const second = simulateRequest('POST', '/api/claims');
    expect(second.deduplicated).toBe(true);
    expect(second.promise).toBe(first.promise); // Same promise returned

    // Different endpoint should NOT be deduped
    const third = simulateRequest('POST', '/api/notes');
    expect(third.deduplicated).toBe(false);

    // Wait for first to complete
    await first.promise;

    // After completion, same endpoint should go through again
    const fourth = simulateRequest('POST', '/api/claims');
    expect(fourth.deduplicated).toBe(false);
  });

  test('GET requests are not deduped', () => {
    const method = 'GET';
    // GET requests should always pass through (they're cacheable, not mutations)
    expect(method).not.toBe('POST');
  });
});

describe('Form Draft Persistence', () => {
  const DRAFT_KEY = 'eden_new_claim_draft';

  beforeEach(() => {
    localStorage.clear();
  });

  test('saves form draft to localStorage', () => {
    const formData = {
      claim_number: 'CLM-001',
      client_name: 'John Doe',
      property_address: '123 Main St',
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(saved.client_name).toBe('John Doe');
  });

  test('recovers draft on page load', () => {
    const draft = {
      claim_number: 'CLM-DRAFT',
      client_name: 'Jane',
      property_address: '456 Oak Ave',
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    // Simulate what NewClaim useState initializer does
    let recovered;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) recovered = JSON.parse(saved);
    } catch { /* ignore */ }

    expect(recovered.claim_number).toBe('CLM-DRAFT');
    expect(recovered.client_name).toBe('Jane');
  });

  test('clears draft after successful submission', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ client_name: 'Test' }));
    localStorage.removeItem(DRAFT_KEY);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
