/**
 * useInspectionPhotos - Hook for managing inspection photos
 * 
 * Handles:
 * - Photo listing by claim/session
 * - Photo upload to backend
 * - Photo deletion
 * - Gallery organization
 * - Optimistic updates
 */

import { useState, useCallback, useEffect } from 'react';
import { api, apiPost, apiUpload, apiDelete, API_URL, getAuthToken, clearCache } from '../../../lib/api';

/**
 * useInspectionPhotos Hook
 */
export function useInspectionPhotos(options = {}) {
  const {
    claimId = null,
    sessionId = null,
    autoFetch = true,
    onUploadComplete = null,
    onUploadError = null,
  } = options;
  
  // State
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [galleryData, setGalleryData] = useState(null);
  
  /**
   * Format photo URL with API_URL prefix and add token for img tag auth
   */
  const formatPhotoUrl = useCallback((photo) => {
    if (!photo) return photo;
    
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    
    return {
      ...photo,
      url: photo.url?.startsWith('http') 
        ? photo.url 
        : `${API_URL}${photo.url}${tokenParam}`,
      thumbnail_url: photo.thumbnail_url?.startsWith('http') 
        ? photo.thumbnail_url 
        : `${API_URL}${photo.thumbnail_url || photo.url}${tokenParam}`
    };
  }, []);
  
  /**
   * Fetch photos for a claim
   */
  const fetchPhotos = useCallback(async (claimIdOverride = null) => {
    const targetClaimId = claimIdOverride || claimId;
    if (!targetClaimId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { ok, data, error: apiError } = await api(
        `/api/inspections/claim/${targetClaimId}/photos`,
        { cache: false }
      );
      
      if (ok && data) {
        // Format URLs for all photos
        const formattedPhotos = (data.photos || []).map(formatPhotoUrl);
        
        // Format photos in by_room structure
        const formattedByRoom = {};
        if (data.by_room) {
          Object.keys(data.by_room).forEach(room => {
            formattedByRoom[room] = data.by_room[room].map(formatPhotoUrl);
          });
        }
        
        // Format before/after pairs
        const formattedPairs = (data.before_after_pairs || []).map(pair => ({
          before: formatPhotoUrl(pair.before),
          after: formatPhotoUrl(pair.after)
        }));
        
        setPhotos(formattedPhotos);
        setGalleryData({
          ...data,
          photos: formattedPhotos,
          by_room: formattedByRoom,
          before_after_pairs: formattedPairs
        });
      } else {
        setError(apiError || 'Failed to fetch photos');
      }
    } catch (err) {
      console.error('[useInspectionPhotos] Fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [claimId, formatPhotoUrl]);
  
  /**
   * Upload a single photo
   */
  const uploadPhoto = useCallback(async (photo, metadata = {}) => {
    if (!photo?.blob) {
      console.error('[useInspectionPhotos] No photo blob provided');
      return null;
    }
    
    const targetClaimId = metadata.claim_id || claimId;
    const targetSessionId = metadata.session_id || sessionId;
    
    if (!targetClaimId) {
      setError('No claim ID provided');
      return null;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', photo.blob, `inspection_${Date.now()}.jpg`);
      formData.append('claim_id', targetClaimId);
      
      if (targetSessionId) {
        formData.append('session_id', targetSessionId);
      }
      if (photo.latitude) {
        formData.append('latitude', photo.latitude.toString());
      }
      if (photo.longitude) {
        formData.append('longitude', photo.longitude.toString());
      }
      if (metadata.room) {
        formData.append('room', metadata.room);
      }
      if (metadata.category) {
        formData.append('category', metadata.category);
      }
      if (metadata.notes || photo.annotation) {
        formData.append('notes', metadata.notes || photo.annotation);
      }
      if (photo.timestamp) {
        formData.append('captured_at', photo.timestamp);
      }
      if (metadata.is_before) {
        formData.append('is_before', 'true');
      }
      if (metadata.is_after) {
        formData.append('is_after', 'true');
      }
      
      const { ok, data, error: apiError } = await apiUpload(
        '/api/inspections/photos',
        formData
      );
      
      if (ok && data) {
        // Add to local state with formatted URL (optimistic update already shows local)
        const uploadedPhoto = formatPhotoUrl({
          ...data,
          ...photo,
          id: data.id,
          uploaded: true
        });
        
        // Update local photos array
        setPhotos(prev => {
          // Replace optimistic entry or add new
          const existingIndex = prev.findIndex(p => p.id === photo.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = uploadedPhoto;
            return updated;
          }
          return [uploadedPhoto, ...prev];
        });
        
        // Clear cache to ensure fresh data on next fetch
        clearCache('/api/inspections');
        
        onUploadComplete?.(uploadedPhoto);
        return uploadedPhoto;
      } else {
        const errorMsg = apiError || 'Upload failed';
        setError(errorMsg);
        onUploadError?.(errorMsg, photo);
        return null;
      }
    } catch (err) {
      console.error('[useInspectionPhotos] Upload error:', err);
      const errorMsg = err.message || 'Upload failed';
      setError(errorMsg);
      onUploadError?.(errorMsg, photo);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [claimId, sessionId, formatPhotoUrl, onUploadComplete, onUploadError]);
  
  /**
   * Upload multiple photos with progress tracking
   */
  const uploadPhotos = useCallback(async (photosToUpload, metadata = {}) => {
    if (!photosToUpload?.length) return [];
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const results = [];
    
    for (let i = 0; i < photosToUpload.length; i++) {
      const photo = photosToUpload[i];
      const result = await uploadPhoto(photo, metadata);
      
      if (result) {
        results.push(result);
      }
      
      setUploadProgress(((i + 1) / photosToUpload.length) * 100);
    }
    
    setIsUploading(false);
    setUploadProgress(0);
    
    return results;
  }, [uploadPhoto]);
  
  /**
   * Add photo optimistically (before upload completes)
   */
  const addPhotoOptimistic = useCallback((photo) => {
    const formattedPhoto = {
      ...photo,
      uploading: true,
      uploaded: false
    };
    
    setPhotos(prev => [formattedPhoto, ...prev]);
    
    return formattedPhoto;
  }, []);
  
  /**
   * Delete a photo
   */
  const deletePhoto = useCallback(async (photoId) => {
    if (!photoId) return false;
    
    // Optimistic removal
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    
    try {
      const { ok, error: apiError } = await apiDelete(
        `/api/inspections/photos/${photoId}`
      );
      
      if (!ok) {
        // Revert on failure
        await fetchPhotos();
        setError(apiError || 'Delete failed');
        return false;
      }
      
      clearCache('/api/inspections');
      return true;
    } catch (err) {
      console.error('[useInspectionPhotos] Delete error:', err);
      await fetchPhotos();
      setError(err.message);
      return false;
    }
  }, [fetchPhotos]);
  
  /**
   * Update photo annotation
   */
  const updateAnnotation = useCallback((photoId, annotation) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, annotation } : p
    ));
  }, []);
  
  /**
   * Get photos grouped by room
   */
  const getPhotosByRoom = useCallback(() => {
    const byRoom = {};
    photos.forEach(photo => {
      const room = photo.room || 'Uncategorized';
      if (!byRoom[room]) {
        byRoom[room] = [];
      }
      byRoom[room].push(photo);
    });
    return byRoom;
  }, [photos]);
  
  /**
   * Get rooms list
   */
  const getRooms = useCallback(() => {
    const rooms = new Set(photos.map(p => p.room || 'Uncategorized'));
    return Array.from(rooms);
  }, [photos]);
  
  /**
   * Bulk photo action (delete, recategorize, move_room)
   */
  const bulkAction = useCallback(async (action, photoIds, opts = {}) => {
    if (!photoIds?.length) return null;
    try {
      const { ok, data, error: apiError } = await apiPost('/api/inspections/photos/bulk', {
        action,
        photo_ids: photoIds,
        room: opts.room || null,
        category: opts.category || null,
      });
      if (ok) {
        // Refresh photos after bulk action
        await fetchPhotos();
        clearCache('/api/inspections');
        return data;
      }
      setError(apiError || 'Bulk action failed');
      return null;
    } catch (err) {
      console.error('[useInspectionPhotos] Bulk action error:', err);
      setError(err.message);
      return null;
    }
  }, [fetchPhotos]);

  /**
   * Get PDF export URL for a claim
   */
  const getExportPdfUrl = useCallback((claimIdOverride = null) => {
    const cid = claimIdOverride || claimId;
    if (!cid) return null;
    const token = getAuthToken();
    return `${API_URL}/api/inspections/claim/${cid}/export-pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }, [claimId]);

  // Auto-fetch on mount if claimId is provided
  useEffect(() => {
    if (autoFetch && claimId) {
      fetchPhotos();
    }
  }, [autoFetch, claimId, fetchPhotos]);

  return {
    // State
    photos,
    isLoading,
    isUploading,
    uploadProgress,
    error,
    galleryData,
    
    // Actions
    fetchPhotos,
    uploadPhoto,
    uploadPhotos,
    addPhotoOptimistic,
    deletePhoto,
    updateAnnotation,
    
    // Utilities
    getPhotosByRoom,
    getRooms,
    formatPhotoUrl,
    bulkAction,
    getExportPdfUrl,

    // Computed
    photoCount: photos.length,
    hasPhotos: photos.length > 0
  };
}

export default useInspectionPhotos;
