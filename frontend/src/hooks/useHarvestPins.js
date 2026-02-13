/**
 * useHarvestPins - CRUD + Derived Fields for Harvest pins
 * Phone-first UX for canvassing
 */
import { useEffect, useState, useCallback } from 'react';
import { recordKnockMetric } from '../lib/harvestMetrics';
import { harvestService } from '../services/harvestService';

// Default status codes (Spotio-style) - used as fallback
export const DEFAULT_PIN_STATUSES = {
  NH: { label: 'Not Home', color: '#F59E0B', bgColor: 'bg-amber-500', icon: '', points: 1 },
  NI: { label: 'Not Interested', color: '#EF4444', bgColor: 'bg-red-500', icon: '', points: 0 },
  CB: { label: 'Callback', color: '#8B5CF6', bgColor: 'bg-purple-500', icon: '', points: 3 },
  AP: { label: 'Appointment', color: '#3B82F6', bgColor: 'bg-blue-500', icon: '', points: 5 },
  SG: { label: 'Signed', color: '#10B981', bgColor: 'bg-green-500', icon: '', points: 10 },
  DNK: { label: 'Do Not Knock', color: '#1F2937', bgColor: 'bg-gray-800', icon: '', points: 0 },
};

export const PIN_STATUSES = DEFAULT_PIN_STATUSES;

const dispositionToStatus = {
  not_home: 'NH',
  not_interested: 'NI',
  callback: 'CB',
  appointment: 'AP',
  signed: 'SG',
  do_not_knock: 'DNK',
  unmarked: null,
};

const statusToDisposition = {
  NH: 'not_home',
  NI: 'not_interested',
  CB: 'callback',
  AP: 'appointment',
  SG: 'signed',
  DNK: 'do_not_knock',
};

const normalizePin = (pin) => ({
  ...pin,
  id: pin?.id || pin?._id || pin?.pin_id || pin?.idempotency_key || `${pin?.latitude}:${pin?.longitude}:${pin?.created_at || ''}`,
  status: dispositionToStatus[pin.disposition] || null,
  lat: pin.latitude,
  lng: pin.longitude,
  visit_count: pin.visit_count || 0,
});

export const useHarvestPins = (options = {}) => {
  const { territoryId, autoFetch = true } = options;

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dispositions, setDispositions] = useState(DEFAULT_PIN_STATUSES);
  const [dispositionsLoaded, setDispositionsLoaded] = useState(false);

  const fetchDispositions = useCallback(async () => {
    try {
      const data = await harvestService.getDispositions();
      const dispList = data.dispositions || [];

      const dispMap = {};
      dispList.forEach((d) => {
        dispMap[d.code] = {
          label: d.label,
          color: d.color,
          bgColor: `bg-[${d.color}]`,
          icon: d.icon || '',
          points: d.points || 0,
        };
      });

      setDispositions({ ...DEFAULT_PIN_STATUSES, ...dispMap });
      setDispositionsLoaded(true);
      return dispMap;
    } catch (err) {
      console.warn('Failed to fetch dispositions, using defaults:', err);
      return DEFAULT_PIN_STATUSES;
    }
  }, []);

  const fetchPins = useCallback(
    async (bounds = null) => {
      setLoading(true);
      setError(null);

      try {
        const data = await harvestService.getPins({ territoryId, bounds });
        const list = Array.isArray(data) ? data : data?.pins || [];
        const normalizedPins = list.map(normalizePin);

        setPins(normalizedPins);
        setLoading(false);
        return normalizedPins;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return [];
      }
    },
    [territoryId]
  );

  const createPin = useCallback(
    async (input) => {
      try {
        const payload = {
          latitude: input.lat,
          longitude: input.lng,
          address: input.address || null,
          disposition: 'unmarked',
          notes: input.notes || null,
          territory_id: input.territory_id || territoryId || null,
        };

        const created = await harvestService.createPin(payload);

        const newPin = normalizePin({
          ...created,
          latitude: created.latitude ?? input.lat,
          longitude: created.longitude ?? input.lng,
          address: created.address ?? input.address ?? null,
          disposition: created.disposition ?? 'unmarked',
          last_visit_at: created.last_visit_at || null,
        });

        setPins((prev) => [...prev, newPin]);
        return newPin;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [territoryId]
  );

  const logVisit = useCallback(async (pinId, status, lat, lng, notes = null) => {
    const startedAt = performance.now();
    try {
      const payload = {
        pin_id: pinId,
        status,
        lat,
        lng,
        notes,
      };

      const result = await harvestService.logVisit(payload);

      recordKnockMetric({
        type: 'visit_log',
        durationMs: performance.now() - startedAt,
        status,
        success: true,
      });

      setPins((prev) =>
        prev.map((pin) => {
          if (pin.id !== pinId) return pin;
          return {
            ...pin,
            status,
            disposition: result.status_info?.disposition || pin.disposition,
            visit_count: result.visit_count || (pin.visit_count || 0) + 1,
            last_visit_at: new Date().toISOString(),
          };
        })
      );

      return result;
    } catch (err) {
      recordKnockMetric({
        type: 'visit_log',
        durationMs: performance.now() - startedAt,
        status,
        success: false,
        error: err.message,
      });
      setError(err.message);
      throw err;
    }
  }, []);

  const updatePinStatus = useCallback(async (pinId, status) => {
    try {
      const disposition = statusToDisposition[status];
      if (!disposition) {
        throw new Error('Invalid status code');
      }

      const updated = await harvestService.updatePin(pinId, { disposition });

      setPins((prev) =>
        prev.map((pin) =>
          pin.id === pinId
            ? {
                ...pin,
                status,
                disposition,
              }
            : pin
        )
      );

      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getPinVisits = useCallback(async (pinId) => {
    try {
      return await harvestService.getPinVisits(pinId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deletePin = useCallback(async (pinId) => {
    try {
      await harvestService.deletePin(pinId);
      setPins((prev) => prev.filter((pin) => pin.id !== pinId));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
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
