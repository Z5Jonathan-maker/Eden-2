/**
 * Eden Platform Core - Shared Utilities
 * 
 * This module provides shared functionality across all features:
 * - Error handling
 * - Date/number formatting
 * - Constants and enums
 * - Validation helpers
 * - Storage utilities
 */

// ============================================
// STATUS ENUMS (Standardized across app)
// ============================================

export const CLAIM_STATUS = {
  NEW: 'new',
  IN_REVIEW: 'in_review',
  SUBMITTED: 'submitted',
  NEGOTIATING: 'negotiating',
  SETTLED: 'settled',
  CLOSED: 'closed',
  ARCHIVED: 'archived'
};

export const CLAIM_STATUS_LABELS = {
  [CLAIM_STATUS.NEW]: 'New',
  [CLAIM_STATUS.IN_REVIEW]: 'In Review',
  [CLAIM_STATUS.SUBMITTED]: 'Submitted',
  [CLAIM_STATUS.NEGOTIATING]: 'Negotiating',
  [CLAIM_STATUS.SETTLED]: 'Settled',
  [CLAIM_STATUS.CLOSED]: 'Closed',
  [CLAIM_STATUS.ARCHIVED]: 'Archived'
};

export const CLAIM_STATUS_COLORS = {
  [CLAIM_STATUS.NEW]: 'bg-blue-100 text-blue-800',
  [CLAIM_STATUS.IN_REVIEW]: 'bg-yellow-100 text-yellow-800',
  [CLAIM_STATUS.SUBMITTED]: 'bg-purple-100 text-purple-800',
  [CLAIM_STATUS.NEGOTIATING]: 'bg-orange-100 text-orange-800',
  [CLAIM_STATUS.SETTLED]: 'bg-green-100 text-green-800',
  [CLAIM_STATUS.CLOSED]: 'bg-gray-100 text-gray-800',
  [CLAIM_STATUS.ARCHIVED]: 'bg-gray-200 text-gray-600'
};

export const INSPECTION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

export const INSPECTION_STATUS_LABELS = {
  [INSPECTION_STATUS.IN_PROGRESS]: 'In Progress',
  [INSPECTION_STATUS.COMPLETED]: 'Completed',
  [INSPECTION_STATUS.ARCHIVED]: 'Archived'
};

export const PIN_STATUS = {
  NOT_HOME: 'NH',
  NOT_INTERESTED: 'NI',
  CALLBACK: 'CB',
  APPOINTMENT: 'AP',
  SIGNED: 'SG',
  DO_NOT_KNOCK: 'DNK'
};

export const PIN_STATUS_LABELS = {
  [PIN_STATUS.NOT_HOME]: 'Not Home',
  [PIN_STATUS.NOT_INTERESTED]: 'Not Interested',
  [PIN_STATUS.CALLBACK]: 'Callback',
  [PIN_STATUS.APPOINTMENT]: 'Appointment',
  [PIN_STATUS.SIGNED]: 'Signed',
  [PIN_STATUS.DO_NOT_KNOCK]: 'Do Not Knock'
};

export const PIN_STATUS_COLORS = {
  [PIN_STATUS.NOT_HOME]: '#9CA3AF',      // gray
  [PIN_STATUS.NOT_INTERESTED]: '#EF4444', // red
  [PIN_STATUS.CALLBACK]: '#F59E0B',       // amber
  [PIN_STATUS.APPOINTMENT]: '#3B82F6',    // blue
  [PIN_STATUS.SIGNED]: '#10B981',         // green
  [PIN_STATUS.DO_NOT_KNOCK]: '#1F2937'    // dark gray
};

export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SIGNED: 'signed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

export const CONTRACT_STATUS_LABELS = {
  [CONTRACT_STATUS.DRAFT]: 'Draft',
  [CONTRACT_STATUS.PENDING]: 'Pending Signature',
  [CONTRACT_STATUS.SIGNED]: 'Signed',
  [CONTRACT_STATUS.CANCELLED]: 'Cancelled',
  [CONTRACT_STATUS.EXPIRED]: 'Expired'
};

export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  ADJUSTER: 'adjuster',
  CLIENT: 'client'
};

export const LOSS_TYPES = {
  WIND: 'wind',
  WATER: 'water',
  FIRE: 'fire',
  HAIL: 'hail',
  FLOOD: 'flood',
  THEFT: 'theft',
  OTHER: 'other'
};

export const LOSS_TYPE_LABELS = {
  [LOSS_TYPES.WIND]: 'Wind',
  [LOSS_TYPES.WATER]: 'Water',
  [LOSS_TYPES.FIRE]: 'Fire',
  [LOSS_TYPES.HAIL]: 'Hail',
  [LOSS_TYPES.FLOOD]: 'Flood',
  [LOSS_TYPES.THEFT]: 'Theft',
  [LOSS_TYPES.OTHER]: 'Other'
};

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format a date string or Date object
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return dateObj.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format a date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(dateObj);
}

/**
 * Format time duration in mm:ss or hh:mm:ss
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format a number as currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number') return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(num, decimals = 0) {
  if (typeof num !== 'number') return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Format a percentage
 * @param {number} value - Value to format (0-100 or 0-1)
 * @param {boolean} isDecimal - If true, value is 0-1; if false, 0-100
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, isDecimal = false) {
  if (typeof value !== 'number') return '0%';
  
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format
 * @param {string} phone - Phone to validate
 * @returns {boolean} True if valid
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Validate required fields in an object
 * @param {object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
export function validateRequired(obj, requiredFields) {
  const missing = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}

// ============================================
// STRING HELPERS
// ============================================

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Generate a slug from a string
 * @param {string} str - String to slugify
 * @returns {string} Slug
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_PREFIX = 'eden_';

/**
 * Get item from localStorage with prefix
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Stored value or default
 */
export function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with prefix
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export function setStorageItem(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
export function removeStorageItem(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    console.warn('Failed to remove from localStorage:', e);
  }
}

// ============================================
// ERROR HANDLING
// ============================================

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Create a standardized error object
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable message
 * @param {object} details - Additional error details
 * @returns {object} Standardized error object
 */
export function createError(code, message, details = {}) {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parse API error response into standardized format
 * @param {object} response - API response object
 * @returns {object} Standardized error object
 */
export function parseApiError(response) {
  if (!response) {
    return createError(ERROR_CODES.UNKNOWN_ERROR, 'Unknown error occurred');
  }
  
  const { status, error, detail } = response;
  const message = error || detail || 'An error occurred';
  
  if (status === 400) {
    return createError(ERROR_CODES.VALIDATION_ERROR, message);
  }
  if (status === 401) {
    return createError(ERROR_CODES.UNAUTHORIZED, message);
  }
  if (status === 403) {
    return createError(ERROR_CODES.PERMISSION_DENIED, message);
  }
  if (status === 404) {
    return createError(ERROR_CODES.NOT_FOUND, message);
  }
  if (status >= 500) {
    return createError(ERROR_CODES.SERVER_ERROR, message);
  }
  
  return createError(ERROR_CODES.UNKNOWN_ERROR, message);
}

/**
 * Check if error is a user error (4xx) vs server error (5xx)
 * @param {object} error - Error object
 * @returns {boolean} True if user error
 */
export function isUserError(error) {
  const userErrorCodes = [
    ERROR_CODES.VALIDATION_ERROR,
    ERROR_CODES.NOT_FOUND,
    ERROR_CODES.PERMISSION_DENIED,
    ERROR_CODES.UNAUTHORIZED
  ];
  return userErrorCodes.includes(error?.code);
}

// ============================================
// MISC UTILITIES
// ============================================

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/**
 * Debounce a function
 * @param {function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Check if running on mobile device
 * @returns {boolean} True if mobile
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if running in iframe
 * @returns {boolean} True if in iframe
 */
export function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default {
  // Enums
  CLAIM_STATUS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  INSPECTION_STATUS,
  INSPECTION_STATUS_LABELS,
  PIN_STATUS,
  PIN_STATUS_LABELS,
  PIN_STATUS_COLORS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  USER_ROLES,
  LOSS_TYPES,
  LOSS_TYPE_LABELS,
  ERROR_CODES,
  
  // Date formatting
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  
  // Number formatting
  formatCurrency,
  formatNumber,
  formatPercent,
  formatFileSize,
  
  // Validation
  isValidEmail,
  isValidPhone,
  validateRequired,
  
  // String helpers
  truncate,
  capitalize,
  slugify,
  
  // Storage
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  
  // Error handling
  createError,
  parseApiError,
  isUserError,
  
  // Utilities
  generateId,
  deepClone,
  debounce,
  copyToClipboard,
  isMobile,
  isInIframe
};
