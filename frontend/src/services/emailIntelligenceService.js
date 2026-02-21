/**
 * Email Intelligence Service — Writing DNA & Templates API
 */
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const unwrap = (result, fallbackMessage) => {
  if (!result?.ok) throw new Error(result?.error || fallbackMessage);
  return result.data;
};

export const emailIntelligenceService = {
  /** Check scan status: not_started | scanning | ready */
  async getStatus() {
    return unwrap(
      await apiGet('/api/email-intelligence/status', { cache: false }),
      'Failed to get scan status'
    );
  },

  /** Start email scan + DNA analysis + template extraction */
  async scan() {
    return unwrap(
      await apiPost('/api/email-intelligence/scan'),
      'Failed to start email scan'
    );
  },

  /** Re-scan and regenerate everything */
  async refresh() {
    return unwrap(
      await apiPost('/api/email-intelligence/refresh'),
      'Failed to refresh email scan'
    );
  },

  /** Get user's writing DNA profile */
  async getProfile() {
    return unwrap(
      await apiGet('/api/email-intelligence/profile', { cache: false }),
      'Failed to get writing profile'
    );
  },

  /** Get extracted email templates */
  async getTemplates(category = null) {
    const params = category ? `?category=${category}` : '';
    return unwrap(
      await apiGet(`/api/email-intelligence/templates${params}`, { cache: false }),
      'Failed to get templates'
    );
  },

  /** Update a template */
  async updateTemplate(templateId, data) {
    return unwrap(
      await apiPut(`/api/email-intelligence/templates/${templateId}`, data),
      'Failed to update template'
    );
  },

  /** Delete a template */
  async deleteTemplate(templateId) {
    return unwrap(
      await apiDelete(`/api/email-intelligence/templates/${templateId}`),
      'Failed to delete template'
    );
  },
};

export default emailIntelligenceService;
