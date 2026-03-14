/**
 * Tests for emailIntelligenceService — Email DNA & Templates API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const { apiGet, apiPost, apiPut, apiDelete } = await import('../lib/api');
const { emailIntelligenceService } = await import('./emailIntelligenceService');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('emailIntelligenceService', () => {
  describe('getStatus', () => {
    it('returns scan status on success', async () => {
      apiGet.mockResolvedValue({ ok: true, data: { status: 'ready' } });
      const result = await emailIntelligenceService.getStatus();
      expect(result).toEqual({ status: 'ready' });
      expect(apiGet).toHaveBeenCalledWith('/api/email-intelligence/status', { cache: false });
    });

    it('throws on failure', async () => {
      apiGet.mockResolvedValue({ ok: false, error: 'Unauthorized' });
      await expect(emailIntelligenceService.getStatus()).rejects.toThrow('Unauthorized');
    });

    it('uses fallback message on failure without error', async () => {
      apiGet.mockResolvedValue({ ok: false });
      await expect(emailIntelligenceService.getStatus()).rejects.toThrow('Failed to get scan status');
    });
  });

  describe('scan', () => {
    it('starts email scan', async () => {
      apiPost.mockResolvedValue({ ok: true, data: { scan_id: 's1' } });
      const result = await emailIntelligenceService.scan();
      expect(result).toEqual({ scan_id: 's1' });
      expect(apiPost).toHaveBeenCalledWith('/api/email-intelligence/scan');
    });

    it('throws on failure', async () => {
      apiPost.mockResolvedValue({ ok: false });
      await expect(emailIntelligenceService.scan()).rejects.toThrow('Failed to start email scan');
    });
  });

  describe('refresh', () => {
    it('refreshes email scan', async () => {
      apiPost.mockResolvedValue({ ok: true, data: { refreshed: true } });
      const result = await emailIntelligenceService.refresh();
      expect(result).toEqual({ refreshed: true });
    });
  });

  describe('getProfile', () => {
    it('returns writing DNA profile', async () => {
      apiGet.mockResolvedValue({ ok: true, data: { tone: 'friendly', style: 'concise' } });
      const result = await emailIntelligenceService.getProfile();
      expect(result).toEqual({ tone: 'friendly', style: 'concise' });
    });
  });

  describe('getTemplates', () => {
    it('fetches templates without category', async () => {
      apiGet.mockResolvedValue({ ok: true, data: [{ id: 't1' }] });
      await emailIntelligenceService.getTemplates();
      expect(apiGet).toHaveBeenCalledWith('/api/email-intelligence/templates', { cache: false });
    });

    it('fetches templates with category filter', async () => {
      apiGet.mockResolvedValue({ ok: true, data: [{ id: 't1' }] });
      await emailIntelligenceService.getTemplates('follow_up');
      expect(apiGet).toHaveBeenCalledWith('/api/email-intelligence/templates?category=follow_up', { cache: false });
    });
  });

  describe('updateTemplate', () => {
    it('updates a template', async () => {
      apiPut.mockResolvedValue({ ok: true, data: { updated: true } });
      const result = await emailIntelligenceService.updateTemplate('t1', { subject: 'New' });
      expect(result).toEqual({ updated: true });
      expect(apiPut).toHaveBeenCalledWith('/api/email-intelligence/templates/t1', { subject: 'New' });
    });
  });

  describe('deleteTemplate', () => {
    it('deletes a template', async () => {
      apiDelete.mockResolvedValue({ ok: true, data: { deleted: true } });
      const result = await emailIntelligenceService.deleteTemplate('t1');
      expect(result).toEqual({ deleted: true });
      expect(apiDelete).toHaveBeenCalledWith('/api/email-intelligence/templates/t1');
    });

    it('throws on failure', async () => {
      apiDelete.mockResolvedValue({ ok: false });
      await expect(emailIntelligenceService.deleteTemplate('t1')).rejects.toThrow('Failed to delete template');
    });
  });
});
