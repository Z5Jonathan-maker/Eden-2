/**
 * Tests for useInspectionReport — Inspection report generation hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  apiPost: vi.fn(),
  API_URL: 'http://localhost:8000',
}));

const { api, apiPost } = await import('../lib/api');
const { useInspectionReport } = await import('./useInspectionReport');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useInspectionReport', () => {
  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useInspectionReport());
    expect(result.current.generating).toBe(false);
    expect(result.current.report).toBeNull();
    expect(result.current.reportHistory).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  describe('generateReport', () => {
    it('generates report on success', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { report_markdown: '# Report', version: 1, session_id: 's1' },
      });

      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.generateReport('s1');
      });

      expect(data).toEqual({ report_markdown: '# Report', version: 1, session_id: 's1' });
      expect(result.current.report).toEqual(data);
      expect(result.current.generating).toBe(false);
      expect(apiPost).toHaveBeenCalledWith('/api/inspections/sessions/s1/report', {});
    });

    it('returns null and sets error when no sessionId', async () => {
      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.generateReport(null);
      });

      expect(data).toBeNull();
      expect(result.current.error).toBe('No session ID provided');
    });

    it('returns null and sets error on API failure', async () => {
      apiPost.mockResolvedValue({ ok: false, error: 'Generation failed' });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.generateReport('s1');
      });

      expect(data).toBeNull();
      expect(result.current.error).toBe('Generation failed');
      expect(result.current.generating).toBe(false);
      errorSpy.mockRestore();
    });

    it('handles exception from API call', async () => {
      apiPost.mockRejectedValue(new Error('Network error'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.generateReport('s1');
      });

      expect(data).toBeNull();
      expect(result.current.error).toBe('Network error');
      errorSpy.mockRestore();
    });
  });

  describe('fetchReportHistory', () => {
    it('fetches history and sets state', async () => {
      api.mockResolvedValue({
        ok: true,
        data: { reports: [{ id: 'r1', version: 1 }, { id: 'r2', version: 2 }] },
      });

      const { result } = renderHook(() => useInspectionReport());

      let history;
      await act(async () => {
        history = await result.current.fetchReportHistory('s1');
      });

      expect(history).toHaveLength(2);
      expect(result.current.reportHistory).toHaveLength(2);
    });

    it('returns empty array when no sessionId', async () => {
      const { result } = renderHook(() => useInspectionReport());

      let history;
      await act(async () => {
        history = await result.current.fetchReportHistory(null);
      });

      expect(history).toEqual([]);
    });

    it('returns empty array on API failure', async () => {
      api.mockResolvedValue({ ok: false });
      const { result } = renderHook(() => useInspectionReport());

      let history;
      await act(async () => {
        history = await result.current.fetchReportHistory('s1');
      });

      expect(history).toEqual([]);
    });

    it('handles exception gracefully', async () => {
      api.mockRejectedValue(new Error('Network error'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useInspectionReport());

      let history;
      await act(async () => {
        history = await result.current.fetchReportHistory('s1');
      });

      expect(history).toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('fetchReport', () => {
    it('fetches a specific report', async () => {
      api.mockResolvedValue({
        ok: true,
        data: { id: 'r1', report_markdown: '# Hello', version: 1 },
      });

      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.fetchReport('r1');
      });

      expect(data).toEqual({ id: 'r1', report_markdown: '# Hello', version: 1 });
      expect(result.current.report).toEqual(data);
    });

    it('returns null when no reportId', async () => {
      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.fetchReport(null);
      });

      expect(data).toBeNull();
    });

    it('returns null on failure', async () => {
      api.mockResolvedValue({ ok: false });
      const { result } = renderHook(() => useInspectionReport());

      let data;
      await act(async () => {
        data = await result.current.fetchReport('r1');
      });

      expect(data).toBeNull();
    });
  });

  describe('copyReportToClipboard', () => {
    it('copies markdown to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      apiPost.mockResolvedValue({
        ok: true,
        data: { report_markdown: '# Report Content', version: 1 },
      });

      const { result } = renderHook(() => useInspectionReport());

      // First generate a report
      await act(async () => {
        await result.current.generateReport('s1');
      });

      let success;
      await act(async () => {
        success = await result.current.copyReportToClipboard();
      });

      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('# Report Content');
    });

    it('returns false when no report', async () => {
      const { result } = renderHook(() => useInspectionReport());

      let success;
      await act(async () => {
        success = await result.current.copyReportToClipboard();
      });

      expect(success).toBe(false);
    });

    it('returns false on clipboard error', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      apiPost.mockResolvedValue({
        ok: true,
        data: { report_markdown: '# Content', version: 1 },
      });

      const { result } = renderHook(() => useInspectionReport());

      await act(async () => {
        await result.current.generateReport('s1');
      });

      let success;
      await act(async () => {
        success = await result.current.copyReportToClipboard();
      });

      expect(success).toBe(false);
      errorSpy.mockRestore();
    });
  });

  describe('downloadReport', () => {
    it('does nothing when no report', () => {
      const { result } = renderHook(() => useInspectionReport());
      // Should not throw when there's no report to download
      expect(() => {
        result.current.downloadReport();
      }).not.toThrow();
    });

    it('creates download link for report', async () => {
      // Set up URL mocks before any DOM operations
      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      apiPost.mockResolvedValue({
        ok: true,
        data: { report_markdown: '# Content', version: 2, session_id: 's1' },
      });

      const { result } = renderHook(() => useInspectionReport());

      await act(async () => {
        await result.current.generateReport('s1');
      });

      // Spy on createElement after the render to not break renderHook
      const clickMock = vi.fn();
      const mockAnchor = { href: '', download: '', click: clickMock, style: {} };
      const origCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') return mockAnchor;
        return origCreateElement(tag);
      });
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      act(() => {
        result.current.downloadReport();
      });

      expect(clickMock).toHaveBeenCalled();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
      expect(mockAnchor.download).toContain('inspection-report');

      // Restore all mocks
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
    });
  });

  describe('clearReport', () => {
    it('clears report and error state', async () => {
      apiPost.mockResolvedValue({
        ok: true,
        data: { report_markdown: '# Content', version: 1 },
      });

      const { result } = renderHook(() => useInspectionReport());

      await act(async () => {
        await result.current.generateReport('s1');
      });

      expect(result.current.report).not.toBeNull();

      act(() => {
        result.current.clearReport();
      });

      expect(result.current.report).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});
