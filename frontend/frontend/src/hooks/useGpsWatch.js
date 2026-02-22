/**
 * useGpsWatch - Single source of truth for GPS location
 * Used by all Harvest components for consistent location tracking
 */
import { useEffect, useState, useCallback } from 'react';

const GPS_ERROR_MESSAGES = {
  1: 'Location permission denied. Please enable location access in your browser settings.',
  2: 'Unable to determine your position. Check GPS signal.',
  3: 'Location request timed out. Please try again.',
};

export const useGpsWatch = () => {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported on this device');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
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
        setError(GPS_ERROR_MESSAGES[err.code] || err.message || 'Unable to get location');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Manual refresh — always forces fresh fix
  const refreshPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setAccuracy(pos.coords.accuracy);
        setError(null);
      },
      (err) => {
        setError(GPS_ERROR_MESSAGES[err.code] || err.message || 'Unable to get location');
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
  };
};

export default useGpsWatch;
