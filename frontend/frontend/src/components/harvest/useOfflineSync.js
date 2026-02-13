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
  isOfflineStorageAvailable
} from './offlineStorage';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getToken = () => localStorage.getItem('eden_token');

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [offlineReady, setOfflineReady] = useState(false);
  const syncIntervalRef = useRef(null);

  // Initialize offline storage
  useEffect(() => {
    if (isOfflineStorageAvailable()) {
      initOfflineStorage()
        .then(() => setOfflineReady(true))
        .catch(err => console.error('Offline storage init failed:', err));
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
  }, []);

  // Periodic sync check when online
  useEffect(() => {
    if (isOnline && offlineReady) {
      syncIntervalRef.current = setInterval(async () => {
        const count = await getUnsyncedCount();
        setUnsyncedCount(count);
        if (count > 0) {
          syncToServer();
        }
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, offlineReady]);

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
    const headers = { Authorization: `Bearer ${getToken()}` };
    
    if (isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/canvassing-map/pins`, { headers });
        if (res.ok) {
          const pins = await res.json();
          // Cache for offline use
          if (offlineReady) {
            await savePinsOffline(pins);
          }
          return { pins, source: 'server' };
        }
      } catch (err) {
        console.error('Server fetch failed, using offline cache:', err);
      }
    }
    
    // Fall back to offline cache
    if (offlineReady) {
      const cachedPins = await getPinsOffline();
      return { pins: cachedPins, source: 'cache' };
    }
    
    return { pins: [], source: 'none' };
  }, [isOnline, offlineReady]);

  /**
   * Create pin - online or queued for sync
   */
  const createPin = useCallback(async (pinData) => {
    if (isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/canvassing-map/pins`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pinData)
        });
        
        if (res.ok) {
          const pin = await res.json();
          if (offlineReady) {
            await savePinsOffline([pin]);
          }
          return { success: true, pin, synced: true };
        }
      } catch (err) {
        console.error('Online create failed:', err);
      }
    }
    
    // Create offline
    if (offlineReady) {
      const offlinePin = await addPinOffline(pinData);
      setUnsyncedCount(prev => prev + 1);
      return { success: true, pin: offlinePin, synced: false };
    }
    
    return { success: false, error: 'No storage available' };
  }, [isOnline, offlineReady]);

  /**
   * Update pin - online or queued for sync
   */
  const updatePin = useCallback(async (pinId, updates) => {
    if (isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/canvassing-map/pins/${pinId}`, {
          method: 'PATCH',
          headers: { 
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        });
        
        if (res.ok) {
          const result = await res.json();
          return { success: true, result, synced: true };
        }
      } catch (err) {
        console.error('Online update failed:', err);
      }
    }
    
    // Update offline
    if (offlineReady) {
      const updatedPin = await updatePinOffline(pinId, updates);
      setUnsyncedCount(prev => prev + 1);
      return { success: true, result: updatedPin, synced: false };
    }
    
    return { success: false, error: 'No storage available' };
  }, [isOnline, offlineReady]);

  /**
   * Sync queued changes to server
   */
  const syncToServer = useCallback(async () => {
    if (!isOnline || !offlineReady || isSyncing) return;
    
    setIsSyncing(true);
    const queue = await getSyncQueue();
    
    if (queue.length === 0) {
      setIsSyncing(false);
      return;
    }

    let syncedCount = 0;
    const headers = { 
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    };

    for (const item of queue) {
      try {
        if (item.action === 'create' && item.pin) {
          const res = await fetch(`${API_URL}/api/canvassing-map/pins`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              latitude: item.pin.latitude,
              longitude: item.pin.longitude,
              address: item.pin.address,
              disposition: item.pin.disposition
            })
          });
          
          if (res.ok) {
            const serverPin = await res.json();
            await markPinSynced(item.pin.id, serverPin.id);
            await clearSyncItem(item.id);
            syncedCount++;
          }
        } else if (item.action === 'update' && item.pin_id) {
          const res = await fetch(`${API_URL}/api/canvassing-map/pins/${item.pin_id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(item.updates)
          });
          
          if (res.ok) {
            await markPinSynced(item.pin_id);
            await clearSyncItem(item.id);
            syncedCount++;
          }
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

  return {
    isOnline,
    isSyncing,
    unsyncedCount,
    offlineReady,
    fetchPins,
    createPin,
    updatePin,
    syncToServer
  };
};

export default useOfflineSync;
