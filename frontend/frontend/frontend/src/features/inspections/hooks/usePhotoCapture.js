/**
 * usePhotoCapture - Hook for capturing photos from video stream
 * 
 * Handles:
 * - Frame capture from video element
 * - Canvas-based image generation
 * - GPS location capture
 * - Photo blob/dataURL creation
 * - Flash effect
 */

import { useState, useRef, useCallback } from 'react';
import { generateId } from '../../../lib/core';

/**
 * usePhotoCapture Hook
 */
export function usePhotoCapture(options = {}) {
  const {
    quality = 0.85,
    format = 'image/jpeg',
    includeGps = true,
    gpsTimeout = 3000,
    onCapture = null,
  } = options;
  
  // State
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState(null);
  
  // Refs
  const canvasRef = useRef(null);
  
  /**
   * Get current GPS location
   */
  const getGpsLocation = useCallback(async () => {
    if (!includeGps || !navigator.geolocation) {
      return { latitude: null, longitude: null };
    }
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: gpsTimeout,
          enableHighAccuracy: true
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    } catch (err) {
      console.log('[usePhotoCapture] GPS unavailable:', err.message);
      return { latitude: null, longitude: null };
    }
  }, [includeGps, gpsTimeout]);
  
  /**
   * Trigger flash effect
   */
  const triggerFlash = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 80);
    
    // Vibrate on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);
  
  /**
   * Capture a photo from a video element
   */
  const capturePhoto = useCallback(async (videoElement, metadata = {}) => {
    if (!videoElement) {
      console.error('[usePhotoCapture] No video element provided');
      return null;
    }
    
    setIsCapturing(true);
    
    try {
      // Create or reuse canvas
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }
      
      // Set canvas dimensions to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0);
      
      // Create blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, format, quality);
      });
      
      // Create data URL for preview
      const dataUrl = canvas.toDataURL(format, quality);
      
      // Get GPS location
      const gps = await getGpsLocation();
      
      // Create photo object
      const photo = {
        id: generateId('photo'),
        blob,
        url: dataUrl,
        width: canvas.width,
        height: canvas.height,
        latitude: gps.latitude,
        longitude: gps.longitude,
        gpsAccuracy: gps.accuracy,
        timestamp: new Date().toISOString(),
        format,
        size: blob.size,
        ...metadata
      };
      
      // Trigger flash effect
      triggerFlash();
      
      setLastCapturedPhoto(photo);
      setIsCapturing(false);
      
      onCapture?.(photo);
      
      return photo;
      
    } catch (err) {
      console.error('[usePhotoCapture] Capture error:', err);
      setIsCapturing(false);
      return null;
    }
  }, [format, quality, getGpsLocation, triggerFlash, onCapture]);
  
  /**
   * Capture multiple photos in sequence
   */
  const captureMultiple = useCallback(async (videoElement, count = 3, delay = 500) => {
    const photos = [];
    
    for (let i = 0; i < count; i++) {
      const photo = await capturePhoto(videoElement, { sequenceIndex: i });
      if (photo) {
        photos.push(photo);
      }
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return photos;
  }, [capturePhoto]);
  
  /**
   * Create a photo from a File/Blob (for file uploads)
   */
  const createPhotoFromFile = useCallback(async (file, metadata = {}) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        
        // Get image dimensions
        const img = new Image();
        img.onload = async () => {
          const gps = await getGpsLocation();
          
          const photo = {
            id: generateId('photo'),
            blob: file,
            url: dataUrl,
            width: img.width,
            height: img.height,
            latitude: gps.latitude,
            longitude: gps.longitude,
            timestamp: new Date().toISOString(),
            originalName: file.name,
            format: file.type,
            size: file.size,
            ...metadata
          };
          
          resolve(photo);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, [getGpsLocation]);
  
  /**
   * Clear the canvas
   */
  const clearCanvas = useCallback(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);
  
  return {
    // State
    isCapturing,
    showFlash,
    lastCapturedPhoto,
    
    // Refs
    canvasRef,
    
    // Actions
    capturePhoto,
    captureMultiple,
    createPhotoFromFile,
    clearCanvas,
    triggerFlash,
    
    // Utilities
    getGpsLocation
  };
}

export default usePhotoCapture;
