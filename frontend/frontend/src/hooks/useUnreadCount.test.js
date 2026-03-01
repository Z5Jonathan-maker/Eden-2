/**
 * Tests for useUnreadCount — Unread count polling hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

const { apiGet } = await import('@/lib/api');

// Must import after mock
const { default: useUnreadCount } = await import('./useUnreadCount');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUnreadCount', () => {
  it('returns 0 initially', () => {
    apiGet.mockResolvedValue({ ok: true, data: { items: [] } });
    const { result } = renderHook(() => useUnreadCount());
    expect(result.current).toBe(0);
  });

  it('sums unread_count from inbox items', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { unread_count: 3 },
          { unread_count: 5 },
          { unread_count: 2 },
        ],
      },
    });

    const { result } = renderHook(() => useUnreadCount());

    // Flush the initial useEffect + refresh() promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(10);
  });

  it('handles items without unread_count', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { unread_count: 3 },
          {},
          { unread_count: 7 },
        ],
      },
    });

    const { result } = renderHook(() => useUnreadCount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(10);
  });

  it('stays 0 when API returns not ok', async () => {
    apiGet.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useUnreadCount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(0);
  });

  it('stays 0 on API error', async () => {
    apiGet.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useUnreadCount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(0);
  });

  it('polls every 30 seconds', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { items: [] } });

    renderHook(() => useUnreadCount());

    // Initial call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiGet).toHaveBeenCalledTimes(1);

    // After 30 seconds - should poll again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(apiGet).toHaveBeenCalledTimes(2);

    // After another 30 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(apiGet).toHaveBeenCalledTimes(3);
  });

  it('calls correct API endpoint', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { items: [] } });

    renderHook(() => useUnreadCount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(apiGet).toHaveBeenCalledWith('/api/comm/inbox', { cache: false });
  });

  it('handles missing items in data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: {} });

    const { result } = renderHook(() => useUnreadCount());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(0);
  });
});
