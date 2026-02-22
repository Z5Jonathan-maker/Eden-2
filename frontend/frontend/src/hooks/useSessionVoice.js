/**
 * useSessionVoice - Hook for managing session voice recordings
 * 
 * Handles:
 * - Audio recording during inspection
 * - Voice upload to backend
 * - Whisper transcription
 */

import { useState, useCallback, useRef } from 'react';
import { API_URL } from '../lib/api';

export function useSessionVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  /**
   * Start recording voice notes
   * @param {MediaStream} existingStream - Optional existing media stream (from camera)
   */
  const startRecording = useCallback(async (existingStream = null) => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Use existing stream or request new audio-only stream
      let stream = existingStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }

      // Check for audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available');
      }

      // Create audio-only stream for recording
      const audioStream = new MediaStream(audioTracks);

      const mediaRecorder = new MediaRecorder(audioStream, { 
        mimeType: 'audio/webm' 
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('[useSessionVoice] Recording error:', e);
        setError('Recording error occurred');
        stopRecording();
      };

      mediaRecorder.start(500); // Collect data every 500ms
      mediaRecorderRef.current = mediaRecorder;

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('[useSessionVoice] Start recording error:', err);
      setError(err.message || 'Failed to start recording');
      return false;
    }
  }, []);

  /**
   * Stop recording and return the audio blob
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setIsRecording(false);
          resolve(audioBlob);
        };
        mediaRecorderRef.current.stop();
      } else {
        setIsRecording(false);
        resolve(null);
      }

      // Clean up stream if we created it
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    });
  }, []);

  /**
   * Upload voice recording to backend for transcription
   * @param {string} sessionId - Inspection session ID
   * @param {Blob} audioBlob - Audio blob to upload (optional, uses recorded audio if not provided)
   */
  const uploadVoice = useCallback(async (sessionId, audioBlob = null) => {
    const blob = audioBlob || new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    if (!blob || blob.size === 0) {
      setError('No audio to upload');
      return null;
    }

    if (!sessionId) {
      setError('No session ID provided');
      return null;
    }

    setUploading(true);
    setTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', blob, `session-${sessionId}.webm`);
      formData.append('session_id', sessionId);

      const res = await fetch(`${API_URL}/api/inspections/sessions/voice`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to upload voice');
      }

      const data = await res.json();
      setTranscript(data.transcript);
      return data;
    } catch (err) {
      console.error('[useSessionVoice] Upload error:', err);
      setError(err.message || 'Failed to upload voice recording');
      return null;
    } finally {
      setUploading(false);
      setTranscribing(false);
    }
  }, []);

  /**
   * Fetch existing transcript for a session
   */
  const fetchTranscript = useCallback(async (sessionId) => {
    if (!sessionId) return null;

    try {
      const res = await fetch(`${API_URL}/api/inspections/sessions/${sessionId}/transcript`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
        return data;
      }
    } catch (err) {
      console.error('[useSessionVoice] Fetch transcript error:', err);
    }
    return null;
  }, []);

  /**
   * Check if there's recorded audio available
   */
  const hasRecordedAudio = useCallback(() => {
    return audioChunksRef.current.length > 0;
  }, []);

  /**
   * Get the recorded audio blob
   */
  const getAudioBlob = useCallback(() => {
    if (audioChunksRef.current.length === 0) return null;
    return new Blob(audioChunksRef.current, { type: 'audio/webm' });
  }, []);

  /**
   * Clear all state
   */
  const reset = useCallback(() => {
    audioChunksRef.current = [];
    setRecordingTime(0);
    setTranscript(null);
    setError(null);
    setIsRecording(false);
    setUploading(false);
    setTranscribing(false);
  }, []);

  return {
    // State
    isRecording,
    recordingTime,
    uploading,
    transcribing,
    transcript,
    error,

    // Actions
    startRecording,
    stopRecording,
    uploadVoice,
    fetchTranscript,
    hasRecordedAudio,
    getAudioBlob,
    reset
  };
}

export default useSessionVoice;
