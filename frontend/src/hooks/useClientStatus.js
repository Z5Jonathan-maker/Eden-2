/**
 * useClientStatus Hook - Client status and Eve-generated updates
 */
import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// Stage definitions for progress bar
export const CLAIM_STAGES = [
  { id: 'intake', label: 'Intake', order: 1 },
  { id: 'inspection', label: 'Inspection', order: 2 },
  { id: 'negotiation', label: 'Negotiation', order: 3 },
  { id: 'settlement', label: 'Settlement', order: 4 },
  { id: 'closed', label: 'Closed', order: 5 }
];

export const useClientStatus = (claimId) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatingUpdate, setGeneratingUpdate] = useState(false);
  const [generatedUpdate, setGeneratedUpdate] = useState(null);

  /**
   * Fetch client-friendly status for a claim
   */
  const fetchStatus = useCallback(async () => {
    if (!claimId) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await apiGet(`/api/client-status/claim/${claimId}`);

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to fetch status');
      }

      setStatus(res.data);
      setLoading(false);
      return res.data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [claimId]);

  /**
   * Generate an Eve-written client update
   */
  const generateUpdate = useCallback(async (tone = 'encouraging') => {
    if (!claimId) return null;

    setGeneratingUpdate(true);
    setError(null);

    try {
      const res = await apiPost(`/api/client-status/claim/${claimId}/update`, { tone });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to generate update');
      }

      setGeneratedUpdate(res.data);
      setGeneratingUpdate(false);

      // Refresh status after generating update
      await fetchStatus();

      return res.data;
    } catch (err) {
      setError(err.message);
      setGeneratingUpdate(false);
      throw err;
    }
  }, [claimId, fetchStatus]);

  /**
   * Create a Gamma client update deck
   */
  const createClientDeck = useCallback(async () => {
    if (!claimId) return null;

    try {
      const res = await apiPost(`/api/gamma/client-update-deck/${claimId}`, {});

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to create deck');
      }

      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [claimId]);

  /**
   * Update claim stage
   */
  const updateStage = useCallback(async (newStage) => {
    if (!claimId) return null;

    try {
      const res = await apiPatch(`/api/client-status/claim/${claimId}/stage?stage=${newStage}`, {});

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to update stage');
      }

      // Refresh status after stage update
      await fetchStatus();

      return res.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [claimId, fetchStatus]);

  /**
   * Clear generated update
   */
  const clearGeneratedUpdate = useCallback(() => {
    setGeneratedUpdate(null);
  }, []);

  return {
    // State
    status,
    loading,
    error,
    generatingUpdate,
    generatedUpdate,
    
    // Actions
    fetchStatus,
    generateUpdate,
    createClientDeck,
    updateStage,
    clearGeneratedUpdate,
    
    // Helpers
    stages: CLAIM_STAGES
  };
};

export default useClientStatus;
