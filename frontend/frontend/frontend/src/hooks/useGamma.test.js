/**
 * Tests for useGamma — Gamma presentation integration hook
 * Covers: createDeckForAudience, createDeck, createClaimDeck, checkStatus, GAMMA_AUDIENCES
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const { apiGet, apiPost } = await import('@/lib/api');
const { useGamma, GAMMA_AUDIENCES } = await import('./useGamma');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GAMMA_AUDIENCES', () => {
  it('has 5 audience types', () => {
    expect(Object.keys(GAMMA_AUDIENCES)).toHaveLength(5);
  });

  it('each audience has required fields', () => {
    Object.values(GAMMA_AUDIENCES).forEach(audience => {
      expect(audience).toHaveProperty('id');
      expect(audience).toHaveProperty('name');
      expect(audience).toHaveProperty('description');
      expect(audience).toHaveProperty('slides');
    });
  });

  it('contains expected audience types', () => {
    expect(GAMMA_AUDIENCES).toHaveProperty('client_update');
    expect(GAMMA_AUDIENCES).toHaveProperty('client_approval');
    expect(GAMMA_AUDIENCES).toHaveProperty('settlement');
    expect(GAMMA_AUDIENCES).toHaveProperty('rep_performance');
    expect(GAMMA_AUDIENCES).toHaveProperty('pastor_report');
  });
});

describe('useGamma', () => {
  it('initializes with correct state', () => {
    const { result } = renderHook(() => useGamma());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.audiences).toBe(GAMMA_AUDIENCES);
  });

  describe('createDeckForAudience', () => {
    it('creates a deck with default audience', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { share_url: 'https://gamma.app/share/123' },
      });

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.createDeckForAudience('claim-1');
      });

      expect(data.url).toBe('https://gamma.app/share/123');
      expect(result.current.loading).toBe(false);
      expect(apiPost).toHaveBeenCalledWith(
        '/api/gamma/presentation/client_update?claim_id=claim-1',
        {}
      );
    });

    it('creates a deck with custom audience', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { edit_url: 'https://gamma.app/edit/456' },
      });

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.createDeckForAudience('claim-1', 'settlement');
      });

      expect(data.url).toBe('https://gamma.app/edit/456');
      expect(apiPost).toHaveBeenCalledWith(
        '/api/gamma/presentation/settlement?claim_id=claim-1',
        {}
      );
    });

    it('preserves existing url field if present', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { url: 'https://custom.url', share_url: 'https://share.url' },
      });

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.createDeckForAudience('claim-1');
      });

      expect(data.url).toBe('https://custom.url');
    });

    it('throws and sets error on failure', async () => {
      apiPost.mockResolvedValue({ ok: false, error: 'Rate limited' });

      const { result } = renderHook(() => useGamma());

      let thrownError;
      await act(async () => {
        try {
          await result.current.createDeckForAudience('claim-1');
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('Rate limited');
      expect(result.current.error).toBe('Rate limited');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('createDeck', () => {
    it('creates a deck with manual content', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { share_url: 'https://gamma.app/share/789' },
      });

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.createDeck({
          title: 'Test Deck',
          content: 'Some content',
          audience: 'settlement',
        });
      });

      expect(data.url).toBe('https://gamma.app/share/789');
      expect(apiPost).toHaveBeenCalledWith('/api/gamma/presentation', {
        title: 'Test Deck',
        content: 'Some content',
        audience: 'settlement',
        template: 'presentation',
      });
    });

    it('uses default audience', async () => {
      apiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGamma());

      await act(async () => {
        await result.current.createDeck({ title: 'T', content: 'C' });
      });

      expect(apiPost.mock.calls[0][1].audience).toBe('client_update');
    });

    it('throws on failure', async () => {
      apiPost.mockResolvedValue({ ok: false, error: { detail: 'Quota exceeded' } });

      const { result } = renderHook(() => useGamma());

      let thrownError;
      await act(async () => {
        try {
          await result.current.createDeck({ title: 'T', content: 'C' });
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('Quota exceeded');
    });
  });

  describe('createClaimDeck', () => {
    it('constructs content from claim object', async () => {
      apiPost.mockResolvedValue({ ok: true, data: { share_url: 'url' } });

      const { result } = renderHook(() => useGamma());

      const claim = {
        claim_number: 'CLM-001',
        client_name: 'John Doe',
        property_address: '123 Main St',
        loss_date: '2024-01-15',
        loss_type: 'Wind Damage',
        status: 'Active',
        insurance_company: 'Acme',
        photo_count: 12,
        estimated_value: 25000,
      };

      await act(async () => {
        await result.current.createClaimDeck(claim, 'client_update');
      });

      const postedPayload = apiPost.mock.calls[0][1];
      expect(postedPayload.title).toContain('CLM-001');
      expect(postedPayload.title).toContain('Client Update');
      expect(postedPayload.content).toContain('John Doe');
      expect(postedPayload.content).toContain('123 Main St');
      expect(postedPayload.content).toContain('Acme');
      expect(postedPayload.content).toContain('25,000');
    });

    it('uses fallback values for missing claim fields', async () => {
      apiPost.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useGamma());

      const claim = { id: 'c1' };

      await act(async () => {
        await result.current.createClaimDeck(claim);
      });

      const payload = apiPost.mock.calls[0][1];
      expect(payload.content).toContain('c1');
      expect(payload.content).toContain('Client');
    });
  });

  describe('checkStatus', () => {
    it('returns status data on success', async () => {
      apiGet.mockResolvedValue({
        ok: true,
        data: { enabled: true, quota_remaining: 5 },
      });

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.checkStatus();
      });

      expect(data).toEqual({ enabled: true, quota_remaining: 5 });
    });

    it('returns disabled status on error', async () => {
      apiGet.mockRejectedValue(new Error('Connection refused'));

      const { result } = renderHook(() => useGamma());

      let data;
      await act(async () => {
        data = await result.current.checkStatus();
      });

      expect(data).toEqual({ enabled: false, error: 'Connection refused' });
    });
  });
});
