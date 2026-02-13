/**
 * useOfflineSync Hook
 * Manages offline/online state and background sync for Harvest
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  initOfflineStorage,
  savePinsOffline,
  getPinsOffline,
  updatePinOffline,
  addPinOffline,
  getSyncQueue,
  clearSyncItem,
  markPinSynced,
  getUnsyncedCount,
  isOfflineStorageAvailable,
} from './offlineStorage';
import { harvestService } from '../../services/harvestService';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async (fn, retries = 2, baseDelayMs = 300) => {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await delay(baseDelayMs * (i + 1));
      }
    }
  }
  throw lastError;
};

const buildPinId = (pin = {}, pinData = {}) => {
  return (
    pin?.id ||
    pin?._id ||
    pin?.pin_id ||
    pin?.idempotency_key ||
    pinData?.id ||
    pinData?.idempotency_key ||
    `pin_${pin?.latitude ?? pin?.lat ?? pinData?.latitude ?? pinData?.lat}_${pin?.longitude ?? pin?.lng ?? pinData?.longitude ?? pinData?.lng}_${Date.now()}`
  );
};

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [offlineReady, setOfflineReady] = useState(false);
  const syncIntervalRef = useRef(null);

  const syncToServer = useCallback(async () => {
    if (!isOnline || !offlineReady || isSyncing) return;

    setIsSyncing(true);
    const queue = await getSyncQueue();

    if (queue.length === 0) {
      setIsSyncing(false);
      return;
    }

    let syncedCount = 0;

    for (const item of queue) {
      try {
        if (item.action === 'create' && item.pin) {
          const idempotencyKey = item.pin.idempotency_key || item.pin.id || null;
          const serverPin = await withRetries(
            () =>
              harvestService.createPin({
                latitude: item.pin.latitude,
                longitude: item.pin.longitude,
                address: item.pin.address,
                disposition: item.pin.disposition,
                territory_id: item.pin.territory_id || null,
                idempotency_key: idempotencyKey,
              }),
            2,
            400
          );

          await markPinSynced(item.pin.id, serverPin.id);
          await clearSyncItem(item.id);
          syncedCount += 1;
        } else if (item.action === 'update' && item.pin_id) {
          await withRetries(
            () => harvestService.updatePin(item.pin_id, item.updates || {}),
            2,
            400
          );

          await markPinSynced(item.pin_id);
          await clearSyncItem(item.id);
          syncedCount += 1;
        }
      } catch (err) {
        console.error('Sync item failed:', item, err);
      }
    }

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} changes`, { duration: 2000 });
    }

    const newCount = await getUnsyncedCount();
    setUnsyncedCount(newCount);
    setIsSyncing(false);
  }, [isOnline, offlineReady, isSyncing]);

  // Initialize offline storage
  useEffect(() => {
    if (isOfflineStorageAvailable()) {
      initOfflineStorage()
        .then(() => setOfflineReady(true))
        .catch((err) => console.error('Offline storage init failed:', err));
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing...', { duration: 2000 });
      syncToServer();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will sync when connected.', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncToServer]);

  // Periodic sync check when online
  useEffect(() => {
    if (isOnline && offlineReady) {
      syncIntervalRef.current = setInterval(async () => {
        const count = await getUnsyncedCount();
        setUnsyncedCount(count);
        if (count > 0) {
          syncToServer();
        }
      }, 30000);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, offlineReady, syncToServer]);

  // Update unsynced count
  useEffect(() => {
    if (offlineReady) {
      getUnsyncedCount().then(setUnsyncedCount);
    }
  }, [offlineReady]);

  /**
   * Fetch pins - from server if online, from cache if offline
   */
  const fetchPins = useCallback(async () => {
    if (isOnline) {
      try {
        const data = await harvestService.getPins();
        const pins = Array.isArray(data) ? data : data?.pins || [];
        if (offlineReady) {
          await savePinsOffline(pins);
        }
        return { pins, source: 'server' };
      } catch (err) {
        console.error('Server fetch failed, using offline cache:', err);
      }
    }

    if (offlineReady) {
      const cachedPins = await getPinsOffline();
      return { pins: cachedPins, source: 'cache' };
    }

    return { pins: [], source: 'none' };
  }, [isOnline, offlineReady]);

  /**
   * Create pin - online or queued for sync
   */
  const createPin = useCallback(
    async (pinData) => {
      if (isOnline) {
        try {
          const serverPin = await harvestService.createPin(pinData);
          const pin = {
            ...serverPin,
            id: buildPinId(serverPin, pinData),
            latitude:
              serverPin?.latitude ?? serverPin?.lat ?? pinData.latitude ?? pinData.lat ?? null,
            longitude:
              serverPin?.longitude ?? serverPin?.lng ?? pinData.longitude ?? pinData.lng ?? null,
            lat: serverPin?.lat ?? serverPin?.latitude ?? pinData.lat ?? pinData.latitude ?? null,
            lng: serverPin?.lng ?? serverPin?.longitude ?? pinData.lng ?? pinData.longitude ?? null,
            disposition: serverPin?.disposition ?? pinData.disposition ?? 'unmarked',
            territory_id: serverPin?.territory_id ?? pinData.territory_id ?? null,
            visit_count: Number(serverPin?.visit_count || 0),
          };
          if (offlineReady) {
            await savePinsOffline([pin]);
          }
          return { success: true, pin, synced: true };
        } catch (err) {
          console.error('Online create failed:', err);
        }
      }

      if (offlineReady) {
        const offlinePin = await addPinOffline(pinData);
        setUnsyncedCount((prev) => prev + 1);
        return { success: true, pin: offlinePin, synced: false };
      }

      return { success: false, error: 'No storage available' };
    },
    [isOnline, offlineReady]
  );

  /**
   * Update pin - online or queued for sync
   */
  const updatePin = useCallback(
    async (pinId, updates) => {
      if (isOnline) {
        try {
          const result = await harvestService.updatePin(pinId, updates);
          return { success: true, result, synced: true };
        } catch (err) {
          console.error('Online update failed:', err);
        }
      }

      if (offlineReady) {
        const updatedPin = await updatePinOffline(pinId, updates);
        setUnsyncedCount((prev) => prev + 1);
        return { success: true, result: updatedPin, synced: false };
      }

      return { success: false, error: 'No storage available' };
    },
    [isOnline, offlineReady]
  );

  return {
    isOnline,
    isSyncing,
    unsyncedCount,
    offlineReady,
    fetchPins,
    createPin,
    updatePin,
    syncToServer,
  };
};

export default useOfflineSync;
