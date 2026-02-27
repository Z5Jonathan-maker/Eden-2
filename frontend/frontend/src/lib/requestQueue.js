/**
 * Offline Request Queue
 * Stores failed mutation requests and retries them when online.
 * Gated by REACT_APP_ENABLE_OFFLINE_QUEUE.
 */

const QUEUE_KEY = 'eden_offline_queue';

class RequestQueue {
  constructor() {
    this.isEnabled = import.meta.env.REACT_APP_ENABLE_OFFLINE_QUEUE !== 'false';
    // Only access localStorage if enabled to avoid side effects
    this.queue = this.isEnabled ? this.loadQueue() : [];
    this.isProcessing = false;

    if (this.isEnabled) {
      // Listen for online status
      window.addEventListener('online', () => this.processQueue());
      
      // Also try periodically in case event missed
      setInterval(() => {
        if (navigator.onLine && this.queue.length > 0) this.processQueue();
      }, 30000);
      
      // Try processing on load
      if (navigator.onLine) {
        this.processQueue();
      }
    }
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load offline queue', e);
      return [];
    }
  }

  saveQueue() {
    if (!this.isEnabled) return;
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
      // Dispatch event for UI updates
      window.dispatchEvent(new Event('offline-queue-changed'));
    } catch (e) {
      console.error('Failed to save offline queue', e);
    }
  }

  /**
   * Build a fingerprint from method + url + body for dedup.
   */
  _fingerprint(url, config) {
    const body = config.body || '';
    const str = `${config.method}:${url}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  /**
   * Add a request to the queue
   * @param {string} url - Full URL
   * @param {object} config - Fetch config object
   */
  add(url, config) {
    if (!this.isEnabled) return;

    // Don't queue GET requests
    if (config.method === 'GET' || !config.method) return;

    // Don't queue uploads (FormData) - too complex for simple JSON storage
    if (config.body instanceof FormData) {
      console.warn('[OfflineQueue] Cannot queue FormData uploads yet');
      return;
    }

    // Idempotency: reject duplicate requests queued within 5 seconds
    const fp = this._fingerprint(url, config);
    const now = Date.now();
    const isDuplicate = this.queue.some(
      (item) => item.fingerprint === fp && now - item.timestamp < 5000
    );
    if (isDuplicate) {
      console.log('[OfflineQueue] Duplicate request suppressed:', url);
      return;
    }

    const item = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      fingerprint: fp,
      timestamp: Date.now(),
      request: { url, config },
      retryCount: 0
    };

    this.queue.push(item);
    this.saveQueue();
    console.log('[OfflineQueue] Request queued:', item);
    return item.id;
  }

  async processQueue() {
    if (this.isProcessing || !navigator.onLine || this.queue.length === 0 || !this.isEnabled) {
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Processing ${this.queue.length} items...`);

    // Process one by one (FIFO)
    const currentItem = this.queue[0];

    try {
      const { url, config } = currentItem.request;
      
      // Re-fetch with original config
      const response = await fetch(url, config);
      
      if (response.ok) {
        // Success
        console.log('[OfflineQueue] Item processed successfully:', currentItem.id);
        this.queue.shift(); // Remove first item
        this.saveQueue();
        
        // Continue immediately
        this.isProcessing = false;
        if (this.queue.length > 0) {
          this.processQueue();
        }
      } else {
        // Server responded with error (4xx/5xx)
        // If 4xx (client error), retrying usually won't help unless it's 429
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.error('[OfflineQueue] Client error, discarding:', response.status);
          this.queue.shift();
          this.saveQueue();
        } else {
          // 5xx or 429 - keep in queue but backoff
          currentItem.retryCount++;
          if (currentItem.retryCount > 10) {
            console.error('[OfflineQueue] Max retries reached, discarding:', currentItem.id);
            this.queue.shift();
            this.saveQueue();
          }
        }
        this.isProcessing = false;
      }
    } catch (error) {
      // Network error - keep in queue
      console.log('[OfflineQueue] Processing failed (network), will retry later');
      this.isProcessing = false;
    }
  }
  
  getQueue() {
    return this.queue;
  }
}

export const requestQueue = new RequestQueue();
