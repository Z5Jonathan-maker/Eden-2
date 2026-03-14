import { describe, it, expect, beforeEach } from 'vitest';
import { recordKnockMetric, getKnockMetricsSummary } from './harvestMetrics';

const STORAGE_KEY = 'harvest_knock_metrics';

describe('harvestMetrics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('recordKnockMetric', () => {
    it('records a metric and returns entry', () => {
      const entry = recordKnockMetric({
        type: 'knock',
        durationMs: 150,
        status: 'NH',
        success: true,
      });

      expect(entry).toBeDefined();
      expect(entry.type).toBe('knock');
      expect(entry.durationMs).toBe(150);
      expect(entry.status).toBe('NH');
      expect(entry.success).toBe(true);
      expect(entry.id).toBeDefined();
      expect(entry.createdAt).toBeDefined();
    });

    it('stores metric in localStorage', () => {
      recordKnockMetric({ type: 'knock', durationMs: 100, success: true });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored).toHaveLength(1);
    });

    it('rounds durationMs', () => {
      const entry = recordKnockMetric({ type: 'knock', durationMs: 150.7, success: true });
      expect(entry.durationMs).toBe(151);
    });

    it('handles missing optional fields', () => {
      const entry = recordKnockMetric({ type: 'knock', durationMs: 100, success: false });
      expect(entry.status).toBeNull();
      expect(entry.error).toBeNull();
    });

    it('records error field', () => {
      const entry = recordKnockMetric({
        type: 'knock',
        durationMs: 50,
        success: false,
        error: 'timeout',
      });
      expect(entry.error).toBe('timeout');
    });

    it('dispatches custom event', () => {
      const handler = vi.fn();
      window.addEventListener('harvest:knock-metric', handler);

      recordKnockMetric({ type: 'knock', durationMs: 100, success: true });

      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener('harvest:knock-metric', handler);
    });

    it('caps storage at 200 entries', () => {
      // Fill with 200 entries
      for (let i = 0; i < 205; i++) {
        recordKnockMetric({ type: 'knock', durationMs: i, success: true });
      }
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getKnockMetricsSummary', () => {
    it('returns zeros when empty', () => {
      const summary = getKnockMetricsSummary();
      expect(summary.count).toBe(0);
      expect(summary.avgMs).toBe(0);
      expect(summary.p95Ms).toBe(0);
      expect(summary.successRate).toBe(0);
    });

    it('computes count correctly', () => {
      recordKnockMetric({ type: 'knock', durationMs: 100, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 200, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 300, success: false });

      const summary = getKnockMetricsSummary();
      expect(summary.count).toBe(3);
    });

    it('computes average correctly', () => {
      recordKnockMetric({ type: 'knock', durationMs: 100, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 200, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 300, success: true });

      const summary = getKnockMetricsSummary();
      expect(summary.avgMs).toBe(200);
    });

    it('computes success rate correctly', () => {
      recordKnockMetric({ type: 'knock', durationMs: 100, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 200, success: true });
      recordKnockMetric({ type: 'knock', durationMs: 300, success: false });

      const summary = getKnockMetricsSummary();
      expect(summary.successRate).toBe(67);
    });

    it('computes p95 correctly', () => {
      // Add 20 entries with durations 10..200
      for (let i = 1; i <= 20; i++) {
        recordKnockMetric({ type: 'knock', durationMs: i * 10, success: true });
      }

      const summary = getKnockMetricsSummary();
      expect(summary.p95Ms).toBeGreaterThanOrEqual(190);
    });
  });
});
