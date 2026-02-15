/**
 * useGamma Hook - Gamma presentation integration for Eden
 * Supports multiple audience types with database-driven content
 */
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

// Audience types for different presentations
export const GAMMA_AUDIENCES = {
  client_update: {
    id: 'client_update',
    name: 'Client Update',
    description: 'Status update for homeowner',
    icon: '📋',
    slides: 7
  },
  client_approval: {
    id: 'client_approval',
    name: 'Settlement Review',
    description: 'For client approval before signing',
    icon: '✅',
    slides: 7
  },
  settlement: {
    id: 'settlement',
    name: 'Final Settlement',
    description: 'Celebratory settlement summary',
    icon: '🎉',
    slides: 7
  },
  rep_performance: {
    id: 'rep_performance',
    name: 'Rep Performance',
    description: 'Sales/adjuster performance review',
    icon: '📊',
    slides: 7
  },
  pastor_report: {
    id: 'pastor_report',
    name: 'Ministry Report',
    description: 'Faith-forward impact report',
    icon: '✝️',
    slides: 7
  }
};

export const useGamma = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Create a deck for a specific audience using claim ID
   * Backend fetches all data from database
   * @param {string} claimId - The claim ID
   * @param {string} audience - The audience type
   */
  const createDeckForAudience = async (claimId, audience = 'client_update') => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiPost(`/api/integrations/gamma/generate-presentation`, { title: `Claim ${claimId}`, content: `Claim ID: ${claimId}\nAudience: ${audience}` });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to create presentation');
      }

      setLoading(false);
      return res.data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Create a presentation deck with manual content
   * @param {Object} params - { title, content, audience }
   */
  const createDeck = async ({ title, content, audience = 'client_update' }) => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        title,
        content,
        audience,
        template: 'presentation'
      };

      const res = await apiPost('/api/integrations/gamma/generate-presentation', payload);

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to create presentation');
      }

      setLoading(false);
      return res.data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Create a deck from claim object (convenience method - uses manual content)
   */
  const createClaimDeck = async (claim, audience = 'client_update') => {
    const content = `
Claim #: ${claim.claim_number || claim.id}
Client: ${claim.client_name || claim.clientName || 'Client'}
Address: ${claim.property_address || claim.propertyAddress || claim.address || ''}
Loss Date: ${claim.loss_date || claim.lossDate || claim.date_of_loss || ''}
Loss Type: ${claim.loss_type || claim.lossType || claim.type || 'Property Damage'}
Status: ${claim.status || 'Active'}
Carrier: ${claim.insurance_company || claim.carrier || claim.insuranceCompany || ''}
Photos: ${claim.photo_count || claim.photoCount || claim.photos?.length || 0}
Estimated Value: $${(claim.estimated_value || claim.estimatedValue || claim.amount || 0).toLocaleString()}
`;

    return createDeck({
      title: `Claim ${claim.claim_number || claim.id} - ${GAMMA_AUDIENCES[audience]?.name || audience}`,
      content,
      audience
    });
  };

  /**
   * Check Gamma integration status
   */
  const checkStatus = async () => {
    try {
      const res = await apiGet('/api/gamma/status');
      return res.data;
    } catch (err) {
      return { enabled: false, error: err.message };
    }
  };

  return {
    createDeckForAudience,  // NEW: Uses claim_id, backend fetches data
    createDeck,             // Manual content
    createClaimDeck,        // Convenience method
    checkStatus,
    loading,
    error,
    audiences: GAMMA_AUDIENCES
  };
};

export default useGamma;
