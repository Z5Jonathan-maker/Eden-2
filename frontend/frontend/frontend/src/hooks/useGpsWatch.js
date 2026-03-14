/**
 * useGpsWatch - Single source of truth for GPS location
 * Used by all Harvest components for consistent location tracking
 *
 * Starts with high-accuracy GPS. If that fails with a timeout or
 * position-unavailable error, automatically falls back to low-accuracy
 * (cell/WiFi) so the rep can keep working. Exposes `highAccuracy`
 * boolean so the UI can show an indicator.
 */
import { useEffect, useState, useCallback, useRef } from 'react';

const GPS_ERROR_MESSAGES = {
  1: 'Location permission denied. Please enable location access in your browser settings.',
  2: 'Unable to determine your position. Check GPS signal.',
  3: 'Location request timed out. Please try again.',
};

export const useGpsWatch = () => {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const watchIdRef = useRef(null);
  const fallbackAttempted = useRef(false);

  const startWatch = useCallback((useHighAccuracy) => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported on this device');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setHighAccuracy(useHighAccuracy);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setAccuracy(pos.coords.accuracy);
        setError(null);
      },
      (err) => {
        console.error('GPS Error:', err.code, err.message);

        // Permission denied (code 1) — no point retrying with low accuracy
        if (err.code === 1) {
          setError(GPS_ERROR_MESSAGES[1]);
          return;
        }

        // Timeout or position unavailable — fall back to low accuracy
        if (useHighAccuracy && !fallbackAttempted.current) {
          fallbackAttempted.current = true;
          console.warn('High-accuracy GPS failed, falling back to low accuracy');
          startWatch(false);
          return;
        }

        setError(GPS_ERROR_MESSAGES[err.code] || err.message || 'Unable to get location');
      },
      {
        enableHighAccuracy: useHighAccuracy,
        maximumAge: 5000,
        timeout: useHighAccuracy ? 15000 : 30000,
      }
    );
  }, []);

  useEffect(() => {
    startWatch(true);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatch]);

  // Manual refresh — forces fresh fix, resets to high accuracy
  const refreshPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported');
      return;
    }

    fallbackAttempted.current = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setAccuracy(pos.coords.accuracy);
        setHighAccuracy(true);
        setError(null);
      },
      (err) => {
        // Try low accuracy on failure
        if (err.code !== 1) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setPosition({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
              setAccuracy(pos.coords.accuracy);
              setHighAccuracy(false);
              setError(null);
            },
            (err2) => {
              setError(GPS_ERROR_MESSAGES[err2.code] || err2.message || 'Unable to get location');
            },
            { enableHighAccuracy: false, maximumAge: 0, timeout: 30000 }
          );
        } else {
          setError(GPS_ERROR_MESSAGES[err.code] || err.message || 'Unable to get location');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  }, []);

  return {
    position,
    accuracy,
    error,
    refreshPosition,
    hasLocation: !!position,
    highAccuracy,
  };
};

export default useGpsWatch;
