/**
 * useGpsWatch - Single source of truth for GPS location
 * Used by all Harvest components for consistent location tracking
 */
import { useEffect, useState, useCallback } from 'react';

export const useGpsWatch = () => {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported on this device');
      return;
    }

    setWatching(true);

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
        console.error('GPS Error:', err.message);
        setError(err.message || 'Unable to get location');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setWatching(false);
    };
  }, []);

  // Manual refresh
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
        setError(err.message || 'Unable to get location');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  return {
    position,
    accuracy,
    error,
    watching,
    refreshPosition,
    hasLocation: !!position,
  };
};

export default useGpsWatch;
