/**
 * useImageryArtifacts — Hook for managing imagery measurement artifacts
 *
 * Handles CRUD operations for distance, area, roof facet, and annotation artifacts.
 * Integrates with /api/imagery backend routes.
 */
import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { serializeArtifact } from '@/lib/geoUtils';

export function useImageryArtifacts(sessionId = null, claimId = null) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load artifacts ────────────────────────────────────────────

  const loadArtifacts = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.claimId || claimId) params.set('claim_id', opts.claimId || claimId);
      if (opts.sessionId || sessionId) params.set('session_id', opts.sessionId || sessionId);
      if (opts.type) params.set('type', opts.type);
      const res = await apiGet(`/api/imagery/artifacts?${params}`);
      if (res.ok) {
        setArtifacts(res.data.artifacts || []);
        return res.data.artifacts;
      }
      return [];
    } catch (err) {
      console.error('[useImageryArtifacts] load failed:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [sessionId, claimId]);

  // ── Save a new artifact ───────────────────────────────────────

  const saveArtifact = useCallback(async (artifactData) => {
    setSaving(true);
    try {
      // Serialize using geoUtils for computed values
      const serialized = serializeArtifact(artifactData);

      const payload = {
        type: serialized.type,
        label: serialized.label,
        points: serialized.meta.bbox
          ? artifactData.points.map(([lat, lng]) => ({ lat, lng }))
          : [],
        computed: serialized.computed,
        meta: serialized.meta,
        claimId: artifactData.claimId || claimId,
        sessionId: artifactData.sessionId || sessionId,
        snapshotDataUrl: artifactData.snapshotDataUrl || null,
      };

      const res = await apiPost('/api/imagery/artifacts', payload);
      if (res.ok) {
        setArtifacts(prev => [res.data, ...prev]);
        return res.data;
      }
      throw new Error(res.error || 'Failed to save artifact');
    } catch (err) {
      console.error('[useImageryArtifacts] save failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [sessionId, claimId]);

  // ── Update an artifact ────────────────────────────────────────

  const updateArtifact = useCallback(async (artifactId, updates) => {
    setSaving(true);
    try {
      const payload = {};
      if (updates.label !== undefined) payload.label = updates.label;
      if (updates.points) payload.points = updates.points.map(([lat, lng]) => ({ lat, lng }));
      if (updates.computed) payload.computed = updates.computed;

      const res = await apiPut(`/api/imagery/artifacts/${artifactId}`, payload);
      if (res.ok) {
        setArtifacts(prev => prev.map(a => a.id === artifactId ? res.data : a));
        return res.data;
      }
      throw new Error(res.error || 'Failed to update artifact');
    } catch (err) {
      console.error('[useImageryArtifacts] update failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Delete an artifact ────────────────────────────────────────

  const deleteArtifact = useCallback(async (artifactId) => {
    try {
      const res = await apiDelete(`/api/imagery/artifacts/${artifactId}`);
      if (res.ok) {
        setArtifacts(prev => prev.filter(a => a.id !== artifactId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useImageryArtifacts] delete failed:', err);
      return false;
    }
  }, []);

  // ── Create a session ──────────────────────────────────────────

  const createSession = useCallback(async ({ address, lat, lng, claimId: cId, timelineEntries }) => {
    try {
      const res = await apiPost('/api/imagery/sessions', {
        address,
        lat,
        lng,
        claimId: cId || claimId,
        providers: ['esri_wayback'],
        zoom: 19,
        timelineEntries,
      });
      if (res.ok) return res.data;
      return null;
    } catch (err) {
      console.error('[useImageryArtifacts] createSession failed:', err);
      return null;
    }
  }, [claimId]);

  // ── Claim summary ─────────────────────────────────────────────

  const getClaimSummary = useCallback(async (cId) => {
    try {
      const res = await apiGet(`/api/imagery/claims/${cId || claimId}/summary`);
      if (res.ok) return res.data;
      return null;
    } catch (err) {
      console.error('[useImageryArtifacts] getClaimSummary failed:', err);
      return null;
    }
  }, [claimId]);

  return {
    artifacts,
    loading,
    saving,
    loadArtifacts,
    saveArtifact,
    updateArtifact,
    deleteArtifact,
    createSession,
    getClaimSummary,
  };
}

export default useImageryArtifacts;
