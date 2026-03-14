/**
 * Tests for useClientStatus — Client status and Eve-generated updates hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

const { apiGet, apiPost, apiPatch } = await import('@/lib/api');
const { useClientStatus, CLAIM_STAGES } = await import('./useClientStatus');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CLAIM_STAGES', () => {
  it('has 5 stages in correct order', () => {
    expect(CLAIM_STAGES).toHaveLength(5);
    expect(CLAIM_STAGES.map(s => s.id)).toEqual([
      'intake', 'inspection', 'negotiation', 'settlement', 'closed',
    ]);
    CLAIM_STAGES.forEach((stage, i) => {
      expect(stage.order).toBe(i + 1);
    });
  });
});

describe('useClientStatus', () => {
  it('initializes with null/false state', () => {
    const { result } = renderHook(() => useClientStatus('claim-1'));
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.generatingUpdate).toBe(false);
    expect(result.current.generatedUpdate).toBeNull();
    expect(result.current.stages).toEqual(CLAIM_STAGES);
  });

  describe('fetchStatus', () => {
    it('fetches and sets status on success', async () => {
      apiGet.mockResolvedValue({
        ok: true,
        data: { stage: 'inspection', summary: 'In progress' },
      });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let data;
      await act(async () => {
        data = await result.current.fetchStatus();
      });

      expect(data).toEqual({ stage: 'inspection', summary: 'In progress' });
      expect(result.current.status).toEqual({ stage: 'inspection', summary: 'In progress' });
      expect(result.current.loading).toBe(false);
      expect(apiGet).toHaveBeenCalledWith('/api/client-status/claim/claim-1');
    });

    it('returns null and does nothing when no claimId', async () => {
      const { result } = renderHook(() => useClientStatus(null));

      let data;
      await act(async () => {
        data = await result.current.fetchStatus();
      });

      expect(data).toBeNull();
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('throws and sets error on failure', async () => {
      apiGet.mockResolvedValue({
        ok: false,
        error: { detail: 'Not found' },
      });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let thrownError;
      await act(async () => {
        try {
          await result.current.fetchStatus();
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('Not found');
      expect(result.current.error).toBe('Not found');
      expect(result.current.loading).toBe(false);
    });

    it('uses fallback error message when error is a string', async () => {
      apiGet.mockResolvedValue({ ok: false, error: 'Server error' });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let thrownError;
      await act(async () => {
        try {
          await result.current.fetchStatus();
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('Server error');
    });
  });

  describe('generateUpdate', () => {
    it('generates update with default tone', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { message: 'Your claim is progressing well!' },
      });
      apiGet.mockResolvedValue({ ok: true, data: { stage: 'negotiation' } });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let data;
      await act(async () => {
        data = await result.current.generateUpdate();
      });

      expect(data).toEqual({ message: 'Your claim is progressing well!' });
      expect(result.current.generatedUpdate).toEqual({ message: 'Your claim is progressing well!' });
      expect(apiPost).toHaveBeenCalledWith('/api/client-status/claim/claim-1/update', { tone: 'encouraging' });
    });

    it('generates update with custom tone', async () => {
      apiPost.mockResolvedValue({ ok: true, data: { message: 'Update' } });
      apiGet.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      await act(async () => {
        await result.current.generateUpdate('professional');
      });

      expect(apiPost).toHaveBeenCalledWith('/api/client-status/claim/claim-1/update', { tone: 'professional' });
    });

    it('returns null when no claimId', async () => {
      const { result } = renderHook(() => useClientStatus(null));

      let data;
      await act(async () => {
        data = await result.current.generateUpdate();
      });

      expect(data).toBeNull();
      expect(apiPost).not.toHaveBeenCalled();
    });

    it('throws and sets error on failure', async () => {
      apiPost.mockResolvedValue({ ok: false, error: 'AI unavailable' });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let thrownError;
      await act(async () => {
        try {
          await result.current.generateUpdate();
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('AI unavailable');
      expect(result.current.error).toBe('AI unavailable');
      expect(result.current.generatingUpdate).toBe(false);
    });
  });

  describe('createClientDeck', () => {
    it('creates a Gamma deck', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { url: 'https://gamma.app/deck/123' },
      });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let data;
      await act(async () => {
        data = await result.current.createClientDeck();
      });

      expect(data).toEqual({ url: 'https://gamma.app/deck/123' });
      expect(apiPost).toHaveBeenCalledWith('/api/gamma/client-update-deck/claim-1', {});
    });

    it('returns null when no claimId', async () => {
      const { result } = renderHook(() => useClientStatus(null));

      let data;
      await act(async () => {
        data = await result.current.createClientDeck();
      });

      expect(data).toBeNull();
    });

    it('throws and sets error on failure', async () => {
      apiPost.mockResolvedValue({ ok: false, error: 'Gamma error' });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let thrownError;
      await act(async () => {
        try {
          await result.current.createClientDeck();
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError.message).toBe('Gamma error');
      expect(result.current.error).toBe('Gamma error');
    });
  });

  describe('updateStage', () => {
    it('updates stage and refreshes status', async () => {
      apiPatch.mockResolvedValue({ ok: true, data: { stage: 'settlement' } });
      apiGet.mockResolvedValue({ ok: true, data: { stage: 'settlement' } });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      let data;
      await act(async () => {
        data = await result.current.updateStage('settlement');
      });

      expect(data).toEqual({ stage: 'settlement' });
      expect(apiPatch).toHaveBeenCalledWith(
        '/api/client-status/claim/claim-1/stage?stage=settlement',
        {}
      );
      // Should also call fetchStatus to refresh
      expect(apiGet).toHaveBeenCalledWith('/api/client-status/claim/claim-1');
    });

    it('returns null when no claimId', async () => {
      const { result } = renderHook(() => useClientStatus(null));

      let data;
      await act(async () => {
        data = await result.current.updateStage('closed');
      });

      expect(data).toBeNull();
    });
  });

  describe('clearGeneratedUpdate', () => {
    it('clears the generated update', async () => {
      apiPost.mockResolvedValue({ ok: true, data: { message: 'Hi' } });
      apiGet.mockResolvedValue({ ok: true, data: {} });

      const { result } = renderHook(() => useClientStatus('claim-1'));

      await act(async () => {
        await result.current.generateUpdate();
      });

      expect(result.current.generatedUpdate).not.toBeNull();

      act(() => {
        result.current.clearGeneratedUpdate();
      });

      expect(result.current.generatedUpdate).toBeNull();
    });
  });
});
