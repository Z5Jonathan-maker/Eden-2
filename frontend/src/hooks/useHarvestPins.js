/**
 * useHarvestPins - CRUD + Derived Fields for Harvest pins
 * Phone-first UX for canvassing
 */
import { useEffect, useState, useCallback } from 'react';
import { recordKnockMetric } from '../lib/harvestMetrics';
import { harvestService } from '../services/harvestService';

// DoorMamba-class 6-pin system
export const DEFAULT_PIN_STATUSES = {
  NA: { label: 'No Answer', color: '#FBBF24', bgColor: 'bg-amber-400', icon: '🚪', points: 1 },
  NI: { label: 'Not Interested', color: '#EF4444', bgColor: 'bg-red-500', icon: '❌', points: 3 },
  RN: { label: 'Renter', color: '#F97316', bgColor: 'bg-orange-500', icon: '🏠', points: 2 },
  FU: { label: 'Follow Up', color: '#8B5CF6', bgColor: 'bg-purple-500', icon: '📋', points: 5 },
  AP: { label: 'Appointment', color: '#3B82F6', bgColor: 'bg-blue-500', icon: '📅', points: 10 },
  DL: { label: 'Deal', color: '#10B981', bgColor: 'bg-green-500', icon: '💰', points: 50 },
};

export const PIN_STATUSES = DEFAULT_PIN_STATUSES;

// Legacy code normalization
const LEGACY_STATUS_MAP = {
  NH: 'NA',
  CB: 'FU',
  SG: 'DL',
  DNK: 'NI',
};

const normalizeStatusCode = (code) => LEGACY_STATUS_MAP[code] || code;

const dispositionToStatus = {
  no_answer: 'NA',
  not_interested: 'NI',
  renter: 'RN',
  follow_up: 'FU',
  appointment: 'AP',
  deal: 'DL',
  // Legacy dispositions
  not_home: 'NA',
  do_not_knock: 'NI',
  callback: 'FU',
  signed: 'DL',
  unmarked: null,
};

const statusToDisposition = {
  NA: 'no_answer',
  NI: 'not_interested',
  RN: 'renter',
  FU: 'follow_up',
  AP: 'appointment',
  DL: 'deal',
};

const normalizePin = (pin) => {
  const rawStatus = dispositionToStatus[pin.disposition] || pin.last_status || null;
  return {
    ...pin,
    id: pin?.id || pin?._id || pin?.pin_id || pin?.idempotency_key || `${pin?.latitude}:${pin?.longitude}:${pin?.created_at || ''}`,
    status: rawStatus ? normalizeStatusCode(rawStatus) : null,
    lat: pin.latitude ?? pin.lat,
    lng: pin.longitude ?? pin.lng,
    visit_count: pin.visit_count || 0,
  };
};

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
