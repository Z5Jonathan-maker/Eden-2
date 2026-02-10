/**
 * useClientStatus Hook - Client status and Eve-generated updates
 */
import { useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('eden_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  /**
   * Fetch client-friendly status for a claim
   */
  const fetchStatus = useCallback(async () => {
    if (!claimId) return null;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/client-status/claim/${claimId}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch status');
      }

      const data = await res.json();
      setStatus(data);
      setLoading(false);
      return data;
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
      const res = await fetch(`${API_URL}/api/client-status/claim/${claimId}/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tone })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to generate update');
      }

      const data = await res.json();
      setGeneratedUpdate(data);
      setGeneratingUpdate(false);
      
      // Refresh status after generating update
      await fetchStatus();
      
      return data;
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
      const res = await fetch(`${API_URL}/api/gamma/client-update-deck/${claimId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to create deck');
      }

      return res.json();
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
      const res = await fetch(`${API_URL}/api/client-status/claim/${claimId}/stage?stage=${newStage}`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update stage');
      }

      const data = await res.json();
      
      // Refresh status after stage update
      await fetchStatus();
      
      return data;
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
