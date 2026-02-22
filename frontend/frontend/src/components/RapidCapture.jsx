/**
 * RapidCapture - Field-critical inspection photo capture
 * 
 * iOS-OPTIMIZED VERSION with Drodat-style behavior:
 * - Session-based, claim-aware photo capture
 * - Voice recording with Whisper transcription
 * - iOS Safari camera compatibility
 * - Preview/iframe detection with clear messaging
 * 
 * RULES:
 * - Camera CANNOT start without a selected claim
 * - All photos bound to an inspection session
 * - No orphan photos, no global pool
 * - Camera starts ONLY on user tap (iOS requirement)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Progress } from '../shared/ui/progress';
import { Textarea } from '../shared/ui/textarea';
import { toast } from 'sonner';
import {
  Mic, MicOff, Camera, X, Check, 
  Image as ImageIcon, Loader2, MapPin, 
  Trash2, ArrowLeft, Wand2, FlipHorizontal, Send,
  Edit2, ChevronLeft, ChevronRight, Save, RotateCcw,
  AlertCircle, FileText, Home
} from 'lucide-react';

// Import our modular hooks
import { 
  useInspectionSession,
  useInspectionPhotos,
  CAMERA_ERRORS 
} from '../features/inspections/hooks';
import { api, apiPost, API_URL } from '../lib/api';
import { formatDuration, isMobile } from '../lib/core';
import { OfflineService } from '../lib/offline';

// Helper to add token to photo URLs for img tag authentication
const addTokenToPhotoUrl = (url, token) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${url}${tokenParam}`;
};

// ============================================
// ENVIRONMENT DETECTION
// ============================================

/**
 * Check if camera is available in the current environment
 * Returns: { available: boolean, reason?: string }
 * 
 * NOTE: We no longer block camera in iframes/preview mode.
 * Let the browser handle permissions naturally - if getUserMedia
 * fails, we'll show a proper error message.
 */
function checkCameraAvailability() {
  // Check for mediaDevices API
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      available: false,
      reason: 'NO_MEDIA_DEVICES',
      message: 'Camera API not available. Please use Safari or Chrome on iOS.'
    };
  }
  
  return { available: true };
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * ClaimContextBar - Shows current claim info during capture
 */
const ClaimContextBar = ({ claimData, claimId, photoCount, isRecording }) => {
  if (!claimData && !claimId) return null;
  
  const clientName = claimData?.client_name || claimData?.insured_name || 'Unknown Client';
  const propertyAddress = claimData?.property_address || claimData?.loss_location || 'Unknown Address';
  
  return (
    <div className="bg-orange-600 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          Capturing for: {clientName} – {propertyAddress}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge className="bg-white/20 text-white border-0">
          <ImageIcon className="w-3 h-3 mr-1" /> {photoCount}
        </Badge>
        {isRecording && (
          <Badge className="bg-red-500 text-white border-0 animate-pulse">
            <Mic className="w-3 h-3 mr-1" /> REC
          </Badge>
        )}
      </div>
    </div>
  );
};

/**
 * PreCaptureGate - Shows before camera starts
 * Simplified: No more iframe detection blocking, just request camera directly
 */
const PreCaptureGate = ({ 
  claimData, 
  isClaimValid, 
  cameraError,
  environmentCheck, 
  onStartCamera, 
  onClose,
  isLoading 
}) => {
  // Check if camera API is missing entirely
  const isEnvironmentBlocked = environmentCheck && !environmentCheck.available;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" data-testid="rapid-capture-gate">
      {/* Header */}
      <div className="bg-black p-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </Button>
        <span className="text-white font-bold">Rapid Capture</span>
        <div className="w-10" />
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {isClaimValid ? (
          <div className="w-full max-w-md space-y-6">
            
            {/* Camera Error Display */}
            {(cameraError || isEnvironmentBlocked) && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-700 font-medium">Camera Error</h4>
                    <p className="text-red-600 text-sm mt-1">
                      {cameraError || environmentCheck?.message || 'Unable to access camera'}
                    </p>
                    <p className="text-red-500 text-xs mt-2">
                      Ensure camera permissions are enabled in your browser settings.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Claim Info Card */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-gray-900 font-bold">Claim Selected</h3>
                  <p className="text-gray-600 text-sm">Ready to capture</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Home className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-gray-900 font-medium">
                      {claimData?.client_name || claimData?.insured_name || 'Client'}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {claimData?.property_address || claimData?.loss_location || 'Property Address'}
                    </p>
                  </div>
                </div>
                
                {claimData?.claim_number && (
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="text-gray-500 text-sm">Claim #{claimData.claim_number}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Start Camera Button */}
            <Button 
              onClick={onStartCamera}
              disabled={isLoading}
              className="w-full h-16 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold"
              data-testid="start-capture-btn"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
              ) : (
                <Camera className="w-6 h-6 mr-3" />
              )}
              {cameraError ? 'Retry Camera' : 'Start Rapid Capture'}
            </Button>
            
            <p className="text-gray-400 text-center text-sm">
              {cameraError 
                ? 'Ensure camera permissions are enabled in your browser settings'
                : 'Camera will activate when you tap start'}
            </p>
          </div>
        ) : (
          /* No Claim Selected */
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            
            <div>
              <h2 className="text-white text-xl font-bold mb-2">No Claim Selected</h2>
              <p className="text-gray-400">
                You must select a claim before capturing inspection photos.
              </p>
            </div>
            
            <Button 
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back & Select Claim
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const RapidCapture = ({ claimId, claimInfo, onClose, onComplete }) => {
  // ========== HOOKS ==========
  const inspectionSession = useInspectionSession({
    onSessionCreated: (session) => {
      // console.log('[RapidCapture] Session created:', session.id);
    },
    onError: (err) => toast.error(err)
  });
  
  const inspectionPhotos = useInspectionPhotos({
    claimId,
    autoFetch: false
  });
  
  // ========== LOCAL STATE ==========
  const [step, setStep] = useState('pre-capture');
  const [claimData, setClaimData] = useState(claimInfo || null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  // Camera state (managed locally for iOS compatibility)
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(() => {
    // Check environment on initial render
    const check = checkCameraAvailability();
    return check.available ? null : check.reason;
  });
  const [facingMode, setFacingMode] = useState('environment');
  const [showFlash, setShowFlash] = useState(false);
  
  // Environment check (computed once on mount)
  const environmentCheck = checkCameraAvailability();
  
  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordingStartRef = useRef(null);
  const analyserRef = useRef(null);
  
  const isClaimValid = Boolean(claimId);
  
  // ========== LOAD OFFLINE PHOTOS ==========
  useEffect(() => {
    const loadOfflinePhotos = async () => {
      if (!claimId) return;
      try {
        const savedPhotos = await OfflineService.getPhotos(claimId);
        if (savedPhotos && savedPhotos.length > 0) {
          // Re-create object URLs for blobs
          const photosWithUrls = savedPhotos.map(p => ({
            ...p,
            url: URL.createObjectURL(p.blob)
          }));
          setPhotos(photosWithUrls);
          toast.info(`Restored ${photosWithUrls.length} offline photos`);
        }
      } catch (err) {
        console.error('Failed to load offline photos:', err);
      }
    };
    loadOfflinePhotos();
  }, [claimId]);

  // ========== FETCH CLAIM DATA ==========
  useEffect(() => {
    const fetchDetails = async () => {
      if (claimId && !claimInfo) {
        const { ok, data } = await api(`/api/claims/${claimId}`);
        if (ok) setClaimData(data);
      }
    };
    fetchDetails();
  }, [claimId, claimInfo]);
  
  // ========== STOP CAMERA ==========
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stream]);
  
  // ========== CLEANUP ==========
  useEffect(() => {
    return () => {
      // Stop camera stream directly in cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      clearInterval(timerRef.current);
      if (analyserRef.current?.ctx) {
        analyserRef.current.ctx.close();
      }
    };
  }, [stream]);
  
  // ========== START CAMERA (iOS-Optimized) ==========
  const startCamera = useCallback(async () => {
    // Re-check environment
    const envCheck = checkCameraAvailability();
    if (!envCheck.available) {
      setCameraError(envCheck.reason);
      return false;
    }
    
    setCameraLoading(true);
    setCameraError(null);
    
    try {
      // Stop any existing stream
      stopCamera();
      
      // Request camera access with iOS-friendly constraints
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: true
        });
      } catch (firstErr) {
        // console.log('[RapidCapture] First camera attempt failed, trying basic constraints');
        // Fallback to basic constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }
      
      setStream(mediaStream);
      return true;
      
    } catch (err) {
      console.error('[RapidCapture] Camera error:', err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Enable camera access in settings.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setCameraError(errorMsg);
      setCameraLoading(false);
      return false;
    }
  }, [facingMode, stopCamera]);
  
  // ========== ATTACH STREAM TO VIDEO ELEMENT ==========
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    if (videoRef.current.srcObject === stream) return;
    
    const video = videoRef.current;
    
    // Set srcObject
    video.srcObject = stream;
    
    // iOS Safari needs explicit play() after srcObject is set
    const handleCanPlay = () => {
      video.play()
        .then(() => {
          setCameraReady(true);
          setCameraLoading(false);
          toast.success('Camera ready');
        })
        .catch(err => {
          // console.warn('[RapidCapture] Video play failed:', err);
          // Try again after a short delay (iOS workaround)
          setTimeout(() => {
            video.play().catch(() => {});
            setCameraReady(true);
            setCameraLoading(false);
          }, 200);
        });
    };
    
    video.addEventListener('canplay', handleCanPlay, { once: true });
    
    // Fallback timeout
    const fallbackTimer = setTimeout(() => {
      if (!cameraReady) {
        video.play().catch(() => {});
        setCameraReady(true);
        setCameraLoading(false);
      }
    }, 1500);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      clearTimeout(fallbackTimer);
    };
  }, [stream, cameraReady]);
  
  // ========== AUDIO METER ==========
  const setupAudioMeter = useCallback((mediaStream) => {
    if (!mediaStream) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(mediaStream).connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = { ctx, analyser };
      
      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (analyserRef.current && step === 'capture') {
          analyserRef.current.analyser.getByteFrequencyData(data);
          setAudioLevel(Math.min(100, (data.reduce((a,b) => a+b) / data.length / 128) * 100));
          requestAnimationFrame(update);
        }
      };
      update();
    } catch (err) {
      console.error('Audio meter setup failed:', err);
    }
  }, [step]);
  
  // Setup audio meter when stream is ready
  useEffect(() => {
    if (stream && step === 'capture') {
      setupAudioMeter(stream);
    }
  }, [stream, step, setupAudioMeter]);
  
  // ========== START CAMERA HANDLER ==========
  const handleStartCamera = async () => {
    if (!isClaimValid) {
      toast.error('Please select a claim first');
      return;
    }
    
    // Create session first
    const session = await inspectionSession.createSession(claimId);
    if (!session) return;
    
    // Transition to capture step (this renders the video element)
    setStep('capture');
    
    // Start camera after a small delay to ensure video element is mounted
    setTimeout(async () => {
      const success = await startCamera();
      if (!success) {
        // If camera fails, stay on capture step but show error
        console.error('[RapidCapture] Camera start failed');
      }
    }, 100);
  };
  
  // ========== SWITCH CAMERA ==========
  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    
    if (cameraReady) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  }, [facingMode, cameraReady, stopCamera, startCamera]);
  
  // ========== CAPTURE PHOTO (Canvas-based) ==========
  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      // console.warn('[RapidCapture] Video not ready for capture');
      toast.error('Camera not ready');
      return;
    }
    
    if (!inspectionSession.sessionId) {
      toast.error('No active session');
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Show flash + haptic feedback (critical for field use — adjusters can't hear toasts on roofs)
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
    if (navigator.vibrate) navigator.vibrate(30);

    // Start GPS in parallel — NEVER block the shutter. Use cached position if available.
    const geoPromise = navigator.geolocation
      ? new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 1000, maximumAge: 300000 }
          );
        })
      : Promise.resolve(null);

    // Convert canvas to blob (fires immediately — GPS resolves in parallel)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to capture photo');
        return;
      }
      
      // Resolve GPS (should be cached/instant, max 1s wait)
      const geo = await geoPromise;
      const latitude = geo?.lat || null;
      const longitude = geo?.lng || null;

      const offset = recordingStartRef.current
        ? (Date.now() - recordingStartRef.current) / 1000
        : photos.length;

      const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create local preview URL
      const localUrl = URL.createObjectURL(blob);

      // Add to local state immediately (optimistic)
      const newPhoto = {
        id: photoId,
        url: localUrl,
        blob: blob,
        latitude,
        longitude,
        offset,
        captured_at: new Date().toISOString(),
        annotation: '',
        aiAnnotation: null,
        uploaded: false
      };
      
      // Save offline
      OfflineService.savePhoto(claimId, newPhoto).catch(err => console.error('Offline save failed:', err));

      setPhotos(prev => [...prev, newPhoto]);
      inspectionSession.incrementPhotoCount();
      
      // console.log(`[RapidCapture] Photo captured: ${photoId}, GPS: ${latitude}, ${longitude}`);
      
    }, 'image/jpeg', 0.9);
  };
  
  // ========== AUDIO RECORDING ==========
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      if (!stream) {
        toast.error('Camera stream not available');
        return;
      }
      
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mr.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
      mr.start(500);
      mediaRecorderRef.current = mr;
      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      setIsRecording(true);
      setHasAudio(true);
    }
  };
  
  // ========== TRANSCRIBE & MATCH ==========
  const transcribeAndMatch = async () => {
    // Voice will be uploaded AFTER photos in handleUploadPhotos
    // Just go to review step
    if (hasAudio && audioChunksRef.current.length > 0) {
      toast.info('Voice notes recorded. Will be linked to photos on upload.');
    }
    setStep('review');
  };
  
  // ========== UPLOAD PHOTOS ==========
  const handleUploadPhotos = async () => {
    if (photos.length === 0) return toast.error('No photos');
    if (!inspectionSession.sessionId) return toast.error('No session');
    
    setStep('processing');
    
    let uploadedCount = 0;
    let failedCount = 0;
    const results = [];
    
    // Step 1: Upload all photos first
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        if (!photo.blob) {
          console.error(`[RapidCapture] Photo ${i} has no blob data`);
          failedCount++;
          continue;
        }
        
        const formData = new FormData();
        formData.append('file', photo.blob, `photo-${Date.now()}-${i}.jpg`);
        formData.append('claim_id', claimId);
        formData.append('session_id', inspectionSession.sessionId);
        formData.append('captured_at', photo.captured_at || new Date().toISOString());
        
        if (photo.latitude) formData.append('latitude', photo.latitude.toString());
        if (photo.longitude) formData.append('longitude', photo.longitude.toString());
        if (photo.annotation) formData.append('notes', photo.annotation);

        const res = await apiPost('/api/inspections/photos', formData);

        if (res.ok) {
          results.push(res.data);
          uploadedCount++;
          // Remove from offline storage
          await OfflineService.deletePhoto(claimId, photo.id);
        } else {
          const errDetail = res.error || 'Upload failed';
          console.error(`[RapidCapture] Upload failed for photo ${i}:`, errDetail);
          failedCount++;
        }
      } catch (err) {
        console.error(`[RapidCapture] Upload error for photo ${i}:`, err);
        failedCount++;
      }
    }
    
    // Step 2: Upload voice AFTER photos (so matching can find them)
    if (hasAudio && audioChunksRef.current.length > 0) {
      try {
        const detectedMime = audioChunksRef.current[0]?.type || 'audio/webm';
        const audioExt = detectedMime.includes('mp4') ? 'm4a' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: detectedMime });
        const form = new FormData();
        form.append('file', audioBlob, `session-${inspectionSession.sessionId}.${audioExt}`);
        form.append('session_id', inspectionSession.sessionId);

        const voiceRes = await apiPost('/api/inspections/sessions/voice', form);

        if (voiceRes.ok) {
          if (voiceRes.data.transcript) {
            toast.success('Voice notes transcribed & linked to photos!');
          } else {
            toast.info('Voice uploaded (transcription pending)');
          }
        } else {
          // console.warn('[RapidCapture] Voice upload failed:', voiceRes.status);
        }
      } catch (e) {
        console.error('[RapidCapture] Voice upload error:', e);
      }
    }
    
    // Step 3: Complete session
    await inspectionSession.completeSession();
    
    // Clean up blob URLs
    photos.forEach(p => {
      if (p.url && p.url.startsWith('blob:')) {
        URL.revokeObjectURL(p.url);
      }
    });
    
    if (failedCount > 0) {
      toast.warning(`${uploadedCount} uploaded, ${failedCount} failed`);
    } else {
      toast.success(`${uploadedCount} photos uploaded to claim!`);
    }
    onComplete?.(results);
  };
  
  // ========== PHOTO MANAGEMENT ==========
  const updateAnnotation = (photoId, newAnnotation) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId) {
        const updated = { ...p, annotation: newAnnotation };
        OfflineService.savePhoto(claimId, updated).catch(console.error);
        return updated;
      }
      return p;
    }));
  };
  
  const deletePhoto = (photoId) => {
    OfflineService.deletePhoto(claimId, photoId).catch(console.error);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    if (selectedPhotoIndex >= photos.length - 1) {
      setSelectedPhotoIndex(Math.max(0, photos.length - 2));
    }
  };
  
  const restoreAiAnnotation = (photoId) => {
    const photo = photos.find(p => p.id === photoId);
    if (photo?.aiAnnotation) {
      updateAnnotation(photoId, photo.aiAnnotation);
    }
  };
  
  // ========== RENDER: PRE-CAPTURE ==========
  if (step === 'pre-capture') {
    return (
      <PreCaptureGate
        claimData={claimData}
        isClaimValid={isClaimValid}
        cameraError={cameraError}
        environmentCheck={environmentCheck}
        onStartCamera={handleStartCamera}
        onClose={onClose}
        isLoading={cameraLoading || inspectionSession.isLoading}
      />
    );
  }
  
  // ========== RENDER: PROCESSING ==========
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" data-testid="rapid-capture-processing">
        <ClaimContextBar 
          claimData={claimData} 
          claimId={claimId} 
          photoCount={photos.length} 
          isRecording={false} 
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Uploading to Claim</h2>
          <p className="text-gray-400 text-sm mb-6">Uploading {photos.length} photos...</p>
          <div className="w-64">
            <Progress value={inspectionPhotos.uploadProgress} className="h-2" />
          </div>
          <p className="text-gray-500 text-xs mt-2">{Math.round(inspectionPhotos.uploadProgress)}%</p>
        </div>
      </div>
    );
  }
  
  // ========== RENDER: TRANSCRIBING ==========
  if (transcribing) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" data-testid="rapid-capture-transcribing">
        <ClaimContextBar 
          claimData={claimData} 
          claimId={claimId} 
          photoCount={photos.length} 
          isRecording={false} 
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Processing Voice Notes</h2>
          <p className="text-gray-400 text-sm">Transcribing and matching to photos...</p>
        </div>
      </div>
    );
  }
  
  // ========== RENDER: EDIT SINGLE PHOTO ==========
  if (step === 'edit') {
    const currentPhoto = photos[selectedPhotoIndex];
    if (!currentPhoto) {
      setStep('review');
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" data-testid="rapid-capture-edit">
        <ClaimContextBar 
          claimData={claimData} 
          claimId={claimId} 
          photoCount={photos.length} 
          isRecording={false} 
        />
        
        {/* Header */}
        <div className="bg-black/80 p-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep('review')} className="text-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <span className="text-white font-medium">Edit Photo {selectedPhotoIndex + 1}/{photos.length}</span>
          <Button size="sm" onClick={() => setStep('review')} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-1" /> Done
          </Button>
        </div>

        {/* Photo Preview */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <img src={addTokenToPhotoUrl(currentPhoto.url)} alt="" className="max-w-full max-h-full object-contain" />
          
          {currentPhoto.latitude && (
            <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3 text-green-400" />
              <span className="text-white text-xs">GPS</span>
            </div>
          )}
          
          {/* Navigation */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedPhotoIndex(i => Math.max(0, i - 1))}
              disabled={selectedPhotoIndex === 0}
              className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-white text-sm bg-black/60 px-3 py-1 rounded-full">
              {selectedPhotoIndex + 1} / {photos.length}
            </span>
            <button
              onClick={() => setSelectedPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
              disabled={selectedPhotoIndex === photos.length - 1}
              className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Annotation Editor */}
        <div className="bg-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-white font-medium text-sm">Annotation</label>
            <div className="flex gap-2">
              {currentPhoto.aiAnnotation && currentPhoto.annotation !== currentPhoto.aiAnnotation && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => restoreAiAnnotation(currentPhoto.id)}
                  className="text-orange-400 text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Restore AI
                </Button>
              )}
            </div>
          </div>
          
          <Textarea
            value={currentPhoto.annotation}
            onChange={(e) => updateAnnotation(currentPhoto.id, e.target.value)}
            placeholder="Describe what this photo shows..."
            className="bg-white border-gray-300 text-gray-900 min-h-[100px]"
          />
          
          {currentPhoto.aiAnnotation && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
              <p className="text-orange-300 text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> AI Transcription:
              </p>
              <p className="text-gray-300 text-sm mt-1">{currentPhoto.aiAnnotation}</p>
            </div>
          )}
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deletePhoto(currentPhoto.id);
              if (photos.length <= 1) setStep('review');
            }}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete Photo
          </Button>
        </div>
      </div>
    );
  }
  
  // ========== RENDER: REVIEW ==========
  if (step === 'review') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col" data-testid="rapid-capture-review">
        <ClaimContextBar 
          claimData={claimData} 
          claimId={claimId} 
          photoCount={photos.length} 
          isRecording={false} 
        />
        
        <div className="bg-black/80 p-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep('capture')} className="text-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <span className="text-white font-medium">{photos.length} Photos</span>
          <Button 
            size="sm" 
            onClick={handleUploadPhotos} 
            className="bg-orange-600 hover:bg-orange-700"
            disabled={photos.length === 0}
          >
            <Send className="w-4 h-4 mr-1" /> Upload All
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {photos.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400">No photos captured yet</p>
              <Button 
                onClick={() => setStep('capture')} 
                className="mt-4 bg-orange-600 hover:bg-orange-700"
              >
                <Camera className="w-4 h-4 mr-2" /> Start Capturing
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-gray-800 rounded-lg p-3 mb-4 text-center">
                <p className="text-gray-300 text-sm">
                  Tap any photo to <strong className="text-orange-400">review and edit</strong>
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p, i) => (
                  <div 
                    key={p.id} 
                    onClick={() => { setSelectedPhotoIndex(i); setStep('edit'); }}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 cursor-pointer group hover:ring-2 hover:ring-orange-500 transition-all"
                  >
                    <img src={addTokenToPhotoUrl(p.url)} alt="" className="w-full h-full object-cover" />
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePhoto(p.id); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-bold">{i + 1}</span>
                        <div className="flex items-center gap-1">
                          {p.latitude && <MapPin className="w-3 h-3 text-green-400" />}
                          {p.annotation && <Check className="w-3 h-3 text-orange-400" />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        {hasAudio && (
          <div className="bg-orange-600/20 border-t border-orange-600/30 p-3 flex items-center gap-3">
            <Mic className="w-5 h-5 text-orange-400" />
            <span className="text-orange-300 text-sm">
              {photos.some(p => p.aiAnnotation) 
                ? 'Voice notes matched! Tap photos to review.'
                : 'Voice notes recorded.'}
            </span>
          </div>
        )}
      </div>
    );
  }
  
  // ========== RENDER: CAPTURE ==========
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="rapid-capture">
      <ClaimContextBar 
        claimData={claimData} 
        claimId={claimId} 
        photoCount={photos.length} 
        isRecording={isRecording} 
      />
      
      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        {/* Video element with iOS-safe properties */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          onCanPlay={() => {
            try {
              videoRef.current?.play();
            } catch (e) {
              // console.warn('[RapidCapture] Video play blocked', e);
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            backgroundColor: '#000'
          }}
        />
        
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Flash effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white/40 pointer-events-none" />
        )}
        
        {/* Camera Error */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center p-6">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Camera Error</p>
              <p className="text-gray-400 text-sm mb-4">{cameraError}</p>
              <Button onClick={startCamera} className="bg-orange-600 hover:bg-orange-700">
                Retry
              </Button>
            </div>
          </div>
        )}
        
        {/* Loading indicator */}
        {cameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-2" />
              <p className="text-white text-sm">Starting camera...</p>
            </div>
          </div>
        )}
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
            <X className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge className="bg-red-600 animate-pulse">
                <Mic className="w-3 h-3 mr-1" /> {formatDuration(recordingTime)}
              </Badge>
            )}
            <Badge variant="outline" className="text-white border-white/40">
              <ImageIcon className="w-3 h-3 mr-1" /> {photos.length}
            </Badge>
          </div>
          
          <Button variant="ghost" size="icon" onClick={switchCamera} className="text-white">
            <FlipHorizontal className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Photo Strip */}
        {photos.length > 0 && (
          <div className="absolute bottom-36 left-0 right-0 px-4">
            <div className="flex gap-1.5 overflow-x-auto">
              {photos.slice(-6).map(p => (
                <img key={p.id} src={addTokenToPhotoUrl(p.url)} className="w-12 h-12 rounded object-cover border border-white/30" />
              ))}
              {photos.length > 6 && (
                <div className="w-12 h-12 bg-black/50 rounded flex items-center justify-center text-white text-xs font-bold">
                  +{photos.length - 6}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black p-6">
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${audioLevel}%` }} />
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-around">
          {/* Voice toggle */}
          <button
            onClick={toggleRecording}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-600 ring-4 ring-red-600/30' : 'bg-gray-800'
            }`}
            data-testid="voice-toggle-btn"
          >
            {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-gray-400" />}
          </button>
          
          {/* Capture */}
          <button
            onClick={handleCapture}
            disabled={!cameraReady}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-95 disabled:opacity-50"
            data-testid="capture-btn"
          >
            <div className="w-16 h-16 rounded-full border-4 border-gray-900" />
          </button>
          
          {/* Done */}
          <button
            onClick={transcribeAndMatch}
            disabled={photos.length === 0}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              photos.length > 0 ? 'bg-orange-600' : 'bg-gray-800'
            }`}
            data-testid="done-btn"
          >
            <Check className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <p className="text-center text-gray-500 text-xs mt-4">
          {photos.length === 0 
            ? 'Tap to capture • Voice notes optional' 
            : `${photos.length} captured • Tap ✓ to review & edit`}
        </p>
      </div>
    </div>
  );
};

export default RapidCapture;
