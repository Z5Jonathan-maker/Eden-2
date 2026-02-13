/**
 * useInspectionSession - Hook for managing inspection sessions
 * 
 * Handles:
 * - Session creation and completion
 * - Session state management
 * - Claim binding validation
 */

import { useState, useCallback } from 'react';
import { api, apiPost, apiPut, clearCache } from '../../../lib/api';
import { INSPECTION_STATUS } from '../../../lib/core';

/**
 * useInspectionSession Hook
 */
export function useInspectionSession(options = {}) {
  const {
    onSessionCreated = null,
    onSessionCompleted = null,
    onError = null,
  } = options;
  
  // State
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Create a new inspection session
   */
  const createSession = useCallback(async (claimId, sessionName = null) => {
    if (!claimId) {
      const errorMsg = 'Claim ID is required to create an inspection session';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const name = sessionName || `Inspection ${new Date().toLocaleString()}`;
      
      const { ok, data, error: apiError } = await apiPost('/api/inspections/sessions', {
        claim_id: claimId,
        name,
        notes: 'Created via Rapid Capture'
      });
      
      if (ok && data) {
        const newSession = {
          id: data.id,
          claim_id: claimId,
          name,
          status: INSPECTION_STATUS.IN_PROGRESS,
          photo_count: 0,
          created_at: new Date().toISOString()
        };
        
        setSession(newSession);
        onSessionCreated?.(newSession);
        return newSession;
      } else {
        const errorMsg = apiError || 'Failed to create session';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }
    } catch (err) {
      console.error('[useInspectionSession] Create error:', err);
      const errorMsg = err.message || 'Failed to create session';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onSessionCreated, onError]);
  
  /**
   * Complete the current session
   */
  const completeSession = useCallback(async (sessionId = null) => {
    const targetId = sessionId || session?.id;
    
    if (!targetId) {
      const errorMsg = 'No session to complete';
      setError(errorMsg);
      return false;
    }
    
    setIsLoading(true);
    
    try {
      const { ok, error: apiError } = await api(
        `/api/inspections/sessions/${targetId}/complete`,
        { method: 'PUT' }
      );
      
      if (ok) {
        const completedSession = {
          ...session,
          status: INSPECTION_STATUS.COMPLETED,
          completed_at: new Date().toISOString()
        };
        
        setSession(completedSession);
        clearCache('/api/inspections');
        onSessionCompleted?.(completedSession);
        return true;
      } else {
        setError(apiError || 'Failed to complete session');
        return false;
      }
    } catch (err) {
      console.error('[useInspectionSession] Complete error:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session, onSessionCompleted]);
  
  /**
   * Load an existing session
   */
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { ok, data, error: apiError } = await api(
        `/api/inspections/sessions/${sessionId}`
      );
      
      if (ok && data) {
        setSession(data);
        return data;
      } else {
        setError(apiError || 'Session not found');
        return null;
      }
    } catch (err) {
      console.error('[useInspectionSession] Load error:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * List sessions for a claim
   */
  const listSessions = useCallback(async (claimId) => {
    if (!claimId) return [];
    
    try {
      const { ok, data } = await api(
        `/api/inspections/sessions?claim_id=${claimId}`
      );
      
      if (ok && data) {
        return data.sessions || [];
      }
      return [];
    } catch (err) {
      console.error('[useInspectionSession] List error:', err);
      return [];
    }
  }, []);
  
  /**
   * Update photo count locally
   */
  const incrementPhotoCount = useCallback(() => {
    setSession(prev => prev ? {
      ...prev,
      photo_count: (prev.photo_count || 0) + 1
    } : null);
  }, []);
  
  /**
   * Clear session state
   */
  const clearSession = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);
  
  return {
    // State
    session,
    isLoading,
    error,
    
    // Computed
    sessionId: session?.id,
    isActive: session?.status === INSPECTION_STATUS.IN_PROGRESS,
    isCompleted: session?.status === INSPECTION_STATUS.COMPLETED,
    hasSession: !!session,
    
    // Actions
    createSession,
    completeSession,
    loadSession,
    listSessions,
    incrementPhotoCount,
    clearSession
  };
}

export default useInspectionSession;
