/**
 * Harvest Offline Storage
 * IndexedDB-based offline storage for canvassing pins
 * Enables field work without network connectivity
 */

const DB_NAME = 'eden_harvest';
const DB_VERSION = 1;
const PINS_STORE = 'pins';
const QUEUE_STORE = 'sync_queue';

let db = null;

/**
 * Initialize IndexedDB
 */
export const initOfflineStorage = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Pins store with indexes
      if (!database.objectStoreNames.contains(PINS_STORE)) {
        const pinsStore = database.createObjectStore(PINS_STORE, { keyPath: 'id' });
        pinsStore.createIndex('disposition', 'disposition', { unique: false });
        pinsStore.createIndex('synced', 'synced', { unique: false });
        pinsStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
      
      // Sync queue for offline changes
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = database.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('action', 'action', { unique: false });
        queueStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
};

/**
 * Save pins to offline storage
 */
export const savePinsOffline = async (pins) => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PINS_STORE, 'readwrite');
    const store = tx.objectStore(PINS_STORE);
    
    pins.forEach(pin => {
      store.put({ ...pin, synced: 'yes', cached_at: Date.now() });
    });
    
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Get all pins from offline storage
 */
export const getPinsOffline = async () => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PINS_STORE, 'readonly');
    const store = tx.objectStore(PINS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Update a single pin offline
 */
export const updatePinOffline = async (pinId, updates) => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PINS_STORE, QUEUE_STORE], 'readwrite');
    const pinsStore = tx.objectStore(PINS_STORE);
    const queueStore = tx.objectStore(QUEUE_STORE);
    
    const getRequest = pinsStore.get(pinId);
    
    getRequest.onsuccess = () => {
      const pin = getRequest.result;
      if (pin) {
        const updatedPin = { 
          ...pin, 
          ...updates, 
          synced: 'no', 
          updated_at: new Date().toISOString() 
        };
        pinsStore.put(updatedPin);
        
        // Add to sync queue
        queueStore.add({
          action: 'update',
          pin_id: pinId,
          updates,
          created_at: Date.now()
        });
        
        resolve(updatedPin);
      } else {
        reject(new Error('Pin not found'));
      }
    };
    
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Add a new pin offline
 */
export const addPinOffline = async (pin) => {
  await initOfflineStorage();
  
  const offlinePin = {
    ...pin,
    id: pin.id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    synced: 'no',
    offline_created: true,
    created_at: new Date().toISOString()
  };
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PINS_STORE, QUEUE_STORE], 'readwrite');
    const pinsStore = tx.objectStore(PINS_STORE);
    const queueStore = tx.objectStore(QUEUE_STORE);
    
    pinsStore.put(offlinePin);
    queueStore.add({
      action: 'create',
      pin: offlinePin,
      created_at: Date.now()
    });
    
    tx.oncomplete = () => resolve(offlinePin);
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Get pending sync items
 */
export const getSyncQueue = async () => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear a sync queue item after successful sync
 */
export const clearSyncItem = async (id) => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    store.delete(id);
    
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Mark pin as synced
 */
export const markPinSynced = async (pinId, serverId = null) => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PINS_STORE, 'readwrite');
    const store = tx.objectStore(PINS_STORE);
    const getRequest = store.get(pinId);
    
    getRequest.onsuccess = () => {
      const pin = getRequest.result;
      if (pin) {
        const updatedPin = { 
          ...pin, 
          synced: 'yes',
          id: serverId || pin.id, // Update ID if server assigned new one
          offline_created: false
        };
        
        // If ID changed, delete old and add new
        if (serverId && serverId !== pinId) {
          store.delete(pinId);
        }
        store.put(updatedPin);
        resolve(updatedPin);
      }
    };
    
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Get count of unsynced items
 */
export const getUnsyncedCount = async () => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PINS_STORE, 'readonly');
    const store = tx.objectStore(PINS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const pins = request.result || [];
      const unsyncedCount = pins.filter(p => p.synced === 'no').length;
      resolve(unsyncedCount);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Check if offline storage is available
 */
export const isOfflineStorageAvailable = () => {
  return 'indexedDB' in window;
};

/**
 * Clear all offline data
 */
export const clearOfflineData = async () => {
  await initOfflineStorage();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PINS_STORE, QUEUE_STORE], 'readwrite');
    tx.objectStore(PINS_STORE).clear();
    tx.objectStore(QUEUE_STORE).clear();
    
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};
