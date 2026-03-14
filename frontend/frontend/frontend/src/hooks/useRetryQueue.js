/**
 * useRetryQueue - Hook for managing retry queue of failed operations
 * Provides offline resilience for critical operations like photo uploads and SMS sends
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'eden_retry_queue';
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

/**
 * @typedef {Object} QueuedOperation
 * @property {string} id - Unique identifier
 * @property {string} type - Operation type (e.g., 'photo_upload', 'sms_send')
 * @property {Object} payload - Data needed to retry the operation
 * @property {number} retryCount - Number of retries attempted
 * @property {number} nextRetryAt - Timestamp for next retry
 * @property {string} createdAt - When the operation was queued
 * @property {string} [error] - Last error message
 */

export const useRetryQueue = () => {
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const processTimeoutRef = useRef(null);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setQueue(parsed);
      }
    } catch (e) {
      console.error('Failed to load retry queue:', e);
    }
  }, []);

  // Save queue to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save retry queue:', e);
    }
  }, [queue]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process queue when coming back online
      processQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Add an operation to the retry queue
   * @param {string} type - Operation type
   * @param {Object} payload - Operation data
   * @returns {string} - Operation ID
   */
  const add = useCallback((type, payload) => {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation = {
      id,
      type,
      payload,
      retryCount: 0,
      nextRetryAt: Date.now() + INITIAL_DELAY,
      createdAt: new Date().toISOString()
    };

    setQueue(prev => [...prev, operation]);
    
    // Schedule processing
    scheduleProcess(INITIAL_DELAY);
    
    return id;
  }, []);

  /**
   * Remove an operation from the queue
   * @param {string} id - Operation ID
   */
  const remove = useCallback((id) => {
    setQueue(prev => prev.filter(op => op.id !== id));
  }, []);

  /**
   * Update an operation in the queue
   * @param {string} id - Operation ID
   * @param {Partial<QueuedOperation>} updates - Fields to update
   */
  const update = useCallback((id, updates) => {
    setQueue(prev => prev.map(op => 
      op.id === id ? { ...op, ...updates } : op
    ));
  }, []);

  /**
   * Get pending count by type
   * @param {string} [type] - Optional filter by type
   * @returns {number}
   */
  const getPendingCount = useCallback((type) => {
    if (type) {
      return queue.filter(op => op.type === type).length;
    }
    return queue.length;
  }, [queue]);

  /**
   * Schedule queue processing with delay
   */
  const scheduleProcess = useCallback((delay) => {
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(() => {
      processQueue();
    }, delay);
  }, []);

  /**
   * Process the queue - attempt to execute pending operations
   * This should be called with operation handlers registered
   */
  const processQueue = useCallback(async () => {
    if (isProcessing || !isOnline || queue.length === 0) {
      return;
    }

    setIsProcessing(true);

    const now = Date.now();
    const readyOps = queue.filter(op => op.nextRetryAt <= now);

    for (const operation of readyOps) {
      // Check if we have a handler for this operation type
      const handler = operationHandlers[operation.type];
      
      if (!handler) {
        console.warn(`No handler registered for operation type: ${operation.type}`);
        continue;
      }

      try {
        // Attempt the operation
        await handler(operation.payload);
        
        // Success - remove from queue
        remove(operation.id);
        
        console.log(`Retry succeeded for ${operation.type}:`, operation.id);
        
      } catch (error) {
        const newRetryCount = operation.retryCount + 1;
        
        if (newRetryCount >= MAX_RETRIES) {
          // Max retries exceeded - mark as failed and remove
          console.error(`Max retries exceeded for ${operation.type}:`, operation.id, error);
          remove(operation.id);
          
          // Emit failure event
          window.dispatchEvent(new CustomEvent('retryQueueFailed', {
            detail: { operation, error: error.message }
          }));
        } else {
          // Schedule next retry with exponential backoff
          const nextDelay = INITIAL_DELAY * Math.pow(2, newRetryCount);
          update(operation.id, {
            retryCount: newRetryCount,
            nextRetryAt: Date.now() + nextDelay,
            error: error.message
          });
          
          scheduleProcess(nextDelay);
        }
      }
    }

    setIsProcessing(false);
  }, [queue, isOnline, isProcessing, remove, update, scheduleProcess]);

  /**
   * Clear all operations from queue
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    queue,
    add,
    remove,
    processQueue,
    clearQueue,
    getPendingCount,
    isOnline,
    isProcessing
  };
};

// Registry of operation handlers - populated by app initialization
const operationHandlers = {};

/**
 * Register a handler for a specific operation type
 * @param {string} type - Operation type
 * @param {Function} handler - Async function to handle the operation
 */
export const registerRetryHandler = (type, handler) => {
  operationHandlers[type] = handler;
};

/**
 * Unregister a handler
 * @param {string} type - Operation type
 */
export const unregisterRetryHandler = (type) => {
  delete operationHandlers[type];
};

export default useRetryQueue;
