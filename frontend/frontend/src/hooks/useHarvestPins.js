/**
 * useHarvestPins - CRUD + Derived Fields for Harvest pins
 * Phone-first UX for canvassing
 * 
 * Now supports dynamic dispositions from /api/harvest/v2/dispositions
 */
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default status codes (Spotio-style) - used as fallback
export const DEFAULT_PIN_STATUSES = {
  NH: { label: 'Not Home', color: '#F59E0B', bgColor: 'bg-amber-500', icon: '🏠', points: 1 },
  NI: { label: 'Not Interested', color: '#EF4444', bgColor: 'bg-red-500', icon: '❌', points: 0 },
  CB: { label: 'Callback', color: '#8B5CF6', bgColor: 'bg-purple-500', icon: '📞', points: 3 },
  AP: { label: 'Appointment', color: '#3B82F6', bgColor: 'bg-blue-500', icon: '📅', points: 5 },
  SG: { label: 'Signed', color: '#10B981', bgColor: 'bg-green-500', icon: '✅', points: 10 },
  DNK: { label: 'Do Not Knock', color: '#1F2937', bgColor: 'bg-gray-800', icon: '🚫', points: 0 },
};

// Export for backwards compatibility
export const PIN_STATUSES = DEFAULT_PIN_STATUSES;

// Map disposition to status code
const dispositionToStatus = {
  'not_home': 'NH',
  'not_interested': 'NI',
  'callback': 'CB',
  'appointment': 'AP',
  'signed': 'SG',
  'do_not_knock': 'DNK',
  'unmarked': null,
};

export const useHarvestPins = (options = {}) => {
  const { territoryId, autoFetch = true } = options;
  
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dispositions, setDispositions] = useState(DEFAULT_PIN_STATUSES);
  const [dispositionsLoaded, setDispositionsLoaded] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('eden_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  // Fetch dynamic dispositions from API
  const fetchDispositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/harvest/v2/dispositions`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        const dispList = data.dispositions || [];
        
        // Convert array to object keyed by code
        const dispMap = {};
        dispList.forEach(d => {
          dispMap[d.code] = {
            label: d.label,
            color: d.color,
            bgColor: `bg-[${d.color}]`,
            icon: d.icon || '',
            points: d.points || 0,
          };
        });
        
        // Merge with defaults to ensure all codes exist
        setDispositions({ ...DEFAULT_PIN_STATUSES, ...dispMap });
        setDispositionsLoaded(true);
        return dispMap;
      }
    } catch (err) {
      console.warn('Failed to fetch dispositions, using defaults:', err);
    }
    return DEFAULT_PIN_STATUSES;
  }, []);

  // Fetch all pins
  const fetchPins = useCallback(async (bounds = null) => {
    setLoading(true);
    setError(null);

    try {
      let url = `${API_URL}/api/canvassing-map/pins`;
      const params = new URLSearchParams();
      
      if (territoryId) params.append('territory_id', territoryId);
      if (bounds) params.append('bounds', bounds);
      
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        throw new Error('Failed to fetch pins');
      }

      const data = await res.json();
      
      // Normalize pins with status code
      const normalizedPins = data.map(pin => ({
        ...pin,
        status: dispositionToStatus[pin.disposition] || null,
        lat: pin.latitude,
        lng: pin.longitude,
        visit_count: pin.visit_count || 0,
      }));
      
      setPins(normalizedPins);
      setLoading(false);
      return normalizedPins;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [territoryId]);

  // Create a new pin
  const createPin = useCallback(async (input) => {
    try {
      const payload = {
        latitude: input.lat,
        longitude: input.lng,
        address: input.address || null,
        disposition: 'unmarked',
        notes: input.notes || null,
        territory_id: input.territory_id || territoryId || null,
      };

      const res = await fetch(`${API_URL}/api/canvassing-map/pins`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to create pin');
      }

      const created = await res.json();
      
      // Add to local state
      const newPin = {
        id: created.id,
        lat: input.lat,
        lng: input.lng,
        latitude: input.lat,
        longitude: input.lng,
        address: input.address || null,
        disposition: 'unmarked',
        status: null,
        visit_count: 0,
        last_visit_at: null,
      };
      
      setPins(prev => [...prev, newPin]);
      return newPin;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [territoryId]);

  // Log a visit (creates visit record + updates pin)
  const logVisit = useCallback(async (pinId, status, lat, lng, notes = null) => {
    try {
      const payload = {
        pin_id: pinId,
        status: status,
        lat: lat,
        lng: lng,
        notes: notes,
      };

      const res = await fetch(`${API_URL}/api/canvassing-map/visits`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to log visit');
      }

      const result = await res.json();
      
      // Update pin in local state
      setPins(prev => prev.map(pin => {
        if (pin.id === pinId) {
          return {
            ...pin,
            status: status,
            disposition: result.status_info?.disposition || pin.disposition,
            visit_count: result.visit_count || (pin.visit_count || 0) + 1,
            last_visit_at: new Date().toISOString(),
          };
        }
        return pin;
      }));

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Update pin status directly (legacy method)
  const updatePinStatus = useCallback(async (pinId, status) => {
    try {
      // Map status code to disposition
      const statusInfo = PIN_STATUSES[status];
      if (!statusInfo) throw new Error('Invalid status code');
      
      const dispositionMap = {
        'NH': 'not_home',
        'NI': 'not_interested',
        'CB': 'callback',
        'AP': 'appointment',
        'SG': 'signed',
        'DNK': 'do_not_knock',
      };
      
      const disposition = dispositionMap[status];

      const res = await fetch(`${API_URL}/api/canvassing-map/pins/${pinId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ disposition }),
      });

      if (!res.ok) {
        throw new Error('Failed to update pin');
      }

      const updated = await res.json();
      
      // Update in local state
      setPins(prev => prev.map(pin => {
        if (pin.id === pinId) {
          return {
            ...pin,
            status: status,
            disposition: disposition,
          };
        }
        return pin;
      }));

      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Get visits for a pin
  const getPinVisits = useCallback(async (pinId) => {
    try {
      const res = await fetch(`${API_URL}/api/canvassing-map/pins/${pinId}/visits`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch visits');
      }

      return res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Delete a pin
  const deletePin = useCallback(async (pinId) => {
    try {
      const res = await fetch(`${API_URL}/api/canvassing-map/pins/${pinId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error('Failed to delete pin');
      }

      setPins(prev => prev.filter(pin => pin.id !== pinId));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    // First fetch dispositions, then pins
    const init = async () => {
      await fetchDispositions();
      if (autoFetch) {
        fetchPins();
      }
    };
    init();
  }, [autoFetch, fetchPins, fetchDispositions]);

  return {
    pins,
    loading,
    error,
    fetchPins,
    createPin,
    logVisit,
    updatePinStatus,
    getPinVisits,
    deletePin,
    statuses: dispositions,
    dispositions,
    dispositionsLoaded,
    fetchDispositions,
  };
};

export default useHarvestPins;
