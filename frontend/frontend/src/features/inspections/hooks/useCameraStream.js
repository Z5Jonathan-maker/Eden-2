/**
 * useCameraStream - Hook for managing camera media stream
 * 
 * Handles:
 * - Camera initialization with iOS Safari compatibility
 * - Stream lifecycle management
 * - Camera switching (front/back)
 * - Error handling with user-friendly messages
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { isInIframe, isMobile } from '../../../lib/core';

// Camera error types
export const CAMERA_ERRORS = {
  NOT_FOUND: 'No camera found. Please ensure your device has a camera.',
  NOT_ALLOWED: 'Camera permission denied. Please enable camera access in your browser settings.',
  NOT_READABLE: 'Camera is busy. Please close other apps using the camera and try again.',
  OVERCONSTRAINED: 'Camera configuration not supported on this device.',
  ABORTED: 'Camera access was interrupted. Please try again.',
  SECURITY: 'Camera access blocked. This site must use HTTPS.',
  TIMEOUT: 'Camera took too long to start. Please try again.',
  IFRAME_BLOCKED: 'Camera is blocked in preview mode. Open in a new browser tab.',
  UNKNOWN: 'Camera error. Please try again.'
};

/**
 * Parse camera error to user-friendly message
 */
function parseCameraError(err) {
  if (!err) return CAMERA_ERRORS.UNKNOWN;
  
  const name = err.name || '';
  const message = err.message || '';
  
  if (name === 'NotFoundError' || message.includes('not found')) {
    return CAMERA_ERRORS.NOT_FOUND;
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return CAMERA_ERRORS.NOT_ALLOWED;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return CAMERA_ERRORS.NOT_READABLE;
  }
  if (name === 'OverconstrainedError') {
    return CAMERA_ERRORS.OVERCONSTRAINED;
  }
  if (name === 'AbortError') {
    return CAMERA_ERRORS.ABORTED;
  }
  if (name === 'SecurityError') {
    return CAMERA_ERRORS.SECURITY;
  }
  if (message.includes('timeout')) {
    return CAMERA_ERRORS.TIMEOUT;
  }
  
  return `Camera error: ${message || name || 'Unknown error'}`;
}

/**
 * useCameraStream Hook
 */
export function useCameraStream(options = {}) {
  const {
    initialFacingMode = 'environment',
    enableAudio = true,
    onStreamReady = null,
    onError = null,
  } = options;
  
  // State
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState(initialFacingMode);
  
  // Refs
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  
  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);
  
  /**
   * Initialize camera stream
   */
  const startStream = useCallback(async (videoElement) => {
    // Check for iframe (preview mode)
    if (isInIframe()) {
      const iframeError = CAMERA_ERRORS.IFRAME_BLOCKED;
      setError(iframeError);
      onError?.(iframeError);
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Stop any existing stream
      stopStream();
      
      // Store video element reference
      if (videoElement) {
        videoRef.current = videoElement;
      }
      
      if (!videoRef.current) {
        throw new Error('No video element provided');
      }
      
      // Request camera access
      // iOS Safari works better with simpler constraints first
      let stream;
      
      try {
        // Try with facing mode (better for mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: enableAudio
        });
      } catch (firstErr) {
        console.log('[useCameraStream] First attempt failed, trying basic constraints');
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: enableAudio
        });
      }
      
      streamRef.current = stream;
      
      // Configure video element for iOS Safari
      const video = videoRef.current;
      
      // Clear existing srcObject
      video.srcObject = null;
      
      // Set attributes BEFORE srcObject (critical for iOS)
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('webkit-playsinline', '');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      // Set stream
      video.srcObject = stream;
      
      // iOS Safari needs explicit load()
      video.load();
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        let resolved = false;
        
        const onCanPlay = () => {
          if (resolved) return;
          resolved = true;
          video.play()
            .then(resolve)
            .catch(reject);
        };
        
        video.oncanplay = onCanPlay;
        video.onloadedmetadata = () => {
          if (!resolved) {
            video.play().catch(() => {});
          }
        };
        video.onerror = (e) => reject(new Error('Video element error'));
        
        // Fallback: try play after delay (iOS workaround)
        setTimeout(() => {
          if (!resolved && video) {
            video.play()
              .then(() => {
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              })
              .catch(() => {});
          }
        }, 500);
        
        // Timeout
        setTimeout(() => {
          if (!resolved) reject(new Error('timeout'));
        }, 8000);
      });
      
      setIsReady(true);
      setIsLoading(false);
      onStreamReady?.(stream);
      
      return true;
      
    } catch (err) {
      console.error('[useCameraStream] Error:', err);
      const errorMessage = parseCameraError(err);
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
      return false;
    }
  }, [facingMode, enableAudio, stopStream, onStreamReady, onError]);
  
  /**
   * Switch between front and back camera
   */
  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    
    if (isReady && videoRef.current) {
      // Restart stream with new facing mode
      return startStream(videoRef.current);
    }
    
    return true;
  }, [facingMode, isReady, startStream]);
  
  /**
   * Get current video dimensions
   */
  const getVideoDimensions = useCallback(() => {
    if (!videoRef.current) return { width: 0, height: 0 };
    return {
      width: videoRef.current.videoWidth,
      height: videoRef.current.videoHeight
    };
  }, []);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);
  
  return {
    // State
    isReady,
    isLoading,
    error,
    facingMode,
    
    // Refs
    streamRef,
    videoRef,
    
    // Actions
    startStream,
    stopStream,
    switchCamera,
    
    // Utilities
    getVideoDimensions,
    isMobile: isMobile(),
    isInIframe: isInIframe()
  };
}

export default useCameraStream;
