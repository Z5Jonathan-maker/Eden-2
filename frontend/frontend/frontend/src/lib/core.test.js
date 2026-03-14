import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CLAIM_STATUS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  CLAIM_TYPES,
  INSPECTION_STATUS,
  PIN_STATUS,
  PIN_STATUS_LABELS,
  CONTRACT_STATUS,
  USER_ROLES,
  LOSS_TYPES,
  LOSS_TYPE_LABELS,
  ERROR_CODES,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatFileSize,
  isValidEmail,
  isValidPhone,
  validateRequired,
  truncate,
  capitalize,
  slugify,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearAllEdenStorage,
  createError,
  parseApiError,
  isUserError,
  generateId,
  deepClone,
  debounce,
} from './core';

// ── Enums ───────────────────────────────────────────────────────────

describe('CLAIM_STATUS', () => {
  it('has all expected statuses', () => {
    expect(CLAIM_STATUS.NEW).toBe('new');
    expect(CLAIM_STATUS.CLOSED).toBe('closed');
    expect(CLAIM_STATUS.ARCHIVED).toBe('archived');
  });

  it('has labels for every status', () => {
    for (const key of Object.values(CLAIM_STATUS)) {
      expect(CLAIM_STATUS_LABELS[key]).toBeDefined();
    }
  });

  it('has colors for every status', () => {
    for (const key of Object.values(CLAIM_STATUS)) {
      expect(CLAIM_STATUS_COLORS[key]).toBeDefined();
    }
  });
});

describe('CLAIM_TYPES', () => {
  it('is a non-empty array', () => {
    expect(CLAIM_TYPES.length).toBeGreaterThan(0);
  });

  it('includes common damage types', () => {
    expect(CLAIM_TYPES).toContain('Water Damage');
    expect(CLAIM_TYPES).toContain('Wind Damage');
    expect(CLAIM_TYPES).toContain('Fire Damage');
  });
});

describe('other enums', () => {
  it('INSPECTION_STATUS has expected keys', () => {
    expect(INSPECTION_STATUS.IN_PROGRESS).toBe('in_progress');
    expect(INSPECTION_STATUS.COMPLETED).toBe('completed');
  });

  it('PIN_STATUS has expected keys', () => {
    expect(PIN_STATUS.NOT_HOME).toBe('NH');
    expect(PIN_STATUS.SIGNED).toBe('SG');
    expect(PIN_STATUS_LABELS[PIN_STATUS.NOT_HOME]).toBe('Not Home');
  });

  it('CONTRACT_STATUS has expected keys', () => {
    expect(CONTRACT_STATUS.DRAFT).toBe('draft');
    expect(CONTRACT_STATUS.SIGNED).toBe('signed');
  });

  it('USER_ROLES has expected keys', () => {
    expect(USER_ROLES.ADMIN).toBe('admin');
    expect(USER_ROLES.CLIENT).toBe('client');
  });

  it('LOSS_TYPES has labels', () => {
    expect(LOSS_TYPE_LABELS[LOSS_TYPES.WIND]).toBe('Wind');
    expect(LOSS_TYPE_LABELS[LOSS_TYPES.WATER]).toBe('Water');
  });
});

// ── Date formatting ─────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2026-01-15');
    expect(result).toContain('2026');
    expect(result).toContain('Jan');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2026, 0, 15));
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('accepts custom options', () => {
    const result = formatDate('2026-01-15', { month: 'long' });
    expect(result).toContain('January');
  });
});

describe('formatDateTime', () => {
  it('includes time in output', () => {
    const result = formatDateTime('2026-01-15T14:30:00Z');
    expect(result).toContain('2026');
    // Should contain some time component
    expect(result.length).toBeGreaterThan(10);
  });

  it('handles null/undefined', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('')).toBe('');
  });

  it('handles invalid date', () => {
    expect(formatDateTime('invalid')).toBe('');
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent dates', () => {
    const result = formatRelativeTime(new Date());
    expect(result).toBe('Just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('falls back to formatted date for >7 days', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
    const result = formatRelativeTime(twoWeeksAgo);
    // Should be a formatted date, not "Xd ago"
    expect(result).not.toContain('d ago');
  });

  it('handles null/undefined', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime('')).toBe('');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles negative/invalid', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration('abc')).toBe('0:00');
  });
});

// ── Number formatting ───────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles non-number input', () => {
    expect(formatCurrency('abc')).toBe('$0.00');
    expect(formatCurrency(null)).toBe('$0.00');
  });
});

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats with decimals', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('handles non-number', () => {
    expect(formatNumber('abc')).toBe('0');
  });
});

describe('formatPercent', () => {
  it('formats whole percentage', () => {
    expect(formatPercent(75)).toBe('75.0%');
  });

  it('formats decimal as percentage', () => {
    expect(formatPercent(0.75, true)).toBe('75.0%');
  });

  it('handles non-number', () => {
    expect(formatPercent(null)).toBe('0%');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1500)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1500000)).toBe('1.4 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1500000000)).toBe('1.4 GB');
  });

  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('handles negative/invalid', () => {
    expect(formatFileSize(-1)).toBe('0 B');
    expect(formatFileSize('abc')).toBe('0 B');
  });
});

// ── Validation ──────────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('validates correct phone numbers', () => {
    expect(isValidPhone('1234567890')).toBe(true);
    expect(isValidPhone('(123) 456-7890')).toBe(true);
    expect(isValidPhone('+1-234-567-8901')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});

describe('validateRequired', () => {
  it('passes when all fields present', () => {
    const result = validateRequired({ name: 'John', email: 'j@e.com' }, ['name', 'email']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('fails when fields missing', () => {
    const result = validateRequired({ name: 'John' }, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  it('treats empty string as missing', () => {
    const result = validateRequired({ name: '' }, ['name']);
    expect(result.valid).toBe(false);
  });

  it('treats null as missing', () => {
    const result = validateRequired({ name: null }, ['name']);
    expect(result.valid).toBe(false);
  });
});

// ── String helpers ──────────────────────────────────────────────────

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('uses custom suffix', () => {
    expect(truncate('hello world', 8, '…')).toBe('hello w…');
  });

  it('handles null/undefined', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
  });
});

describe('capitalize', () => {
  it('capitalizes each word', () => {
    expect(capitalize('hello world')).toBe('Hello World');
  });

  it('handles single word', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles empty/null', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
  });
});

describe('slugify', () => {
  it('creates a slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses multiple separators', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('handles empty/null', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });
});

// ── Storage helpers ─────────────────────────────────────────────────

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setStorageItem + getStorageItem round-trips', () => {
    setStorageItem('test', { foo: 'bar' });
    expect(getStorageItem('test')).toEqual({ foo: 'bar' });
  });

  it('getStorageItem returns default for missing key', () => {
    expect(getStorageItem('missing', 42)).toBe(42);
  });

  it('getStorageItem returns null default when not specified', () => {
    expect(getStorageItem('missing')).toBeNull();
  });

  it('removeStorageItem removes the item', () => {
    setStorageItem('test', 'value');
    removeStorageItem('test');
    expect(getStorageItem('test')).toBeNull();
  });

  it('clearAllEdenStorage removes eden-prefixed keys', () => {
    // Use a fresh storage object to avoid jsdom iteration quirks
    const store = {};
    const mockStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      key: (i) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
    vi.stubGlobal('localStorage', mockStorage);

    localStorage.setItem('eden_foo', 'bar');
    localStorage.setItem('eden-bar', 'baz');
    localStorage.setItem('other_key', 'keep');
    clearAllEdenStorage();
    expect(localStorage.getItem('eden_foo')).toBeNull();
    expect(localStorage.getItem('eden-bar')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('keep');

    vi.unstubAllGlobals();
  });
});

// ── Error handling ──────────────────────────────────────────────────

describe('createError', () => {
  it('creates a standardized error object', () => {
    const err = createError(ERROR_CODES.NOT_FOUND, 'Item not found', { id: '123' });
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Item not found');
    expect(err.details).toEqual({ id: '123' });
    expect(err.timestamp).toBeDefined();
  });
});

describe('parseApiError', () => {
  it('maps 400 to VALIDATION_ERROR', () => {
    const err = parseApiError({ status: 400, error: 'Bad input' });
    expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('maps 401 to UNAUTHORIZED', () => {
    const err = parseApiError({ status: 401 });
    expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('maps 403 to PERMISSION_DENIED', () => {
    const err = parseApiError({ status: 403 });
    expect(err.code).toBe(ERROR_CODES.PERMISSION_DENIED);
  });

  it('maps 404 to NOT_FOUND', () => {
    const err = parseApiError({ status: 404 });
    expect(err.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('maps 500 to SERVER_ERROR', () => {
    const err = parseApiError({ status: 500 });
    expect(err.code).toBe(ERROR_CODES.SERVER_ERROR);
  });

  it('maps null response to UNKNOWN_ERROR', () => {
    const err = parseApiError(null);
    expect(err.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
  });
});

describe('isUserError', () => {
  it('returns true for user errors', () => {
    expect(isUserError({ code: ERROR_CODES.VALIDATION_ERROR })).toBe(true);
    expect(isUserError({ code: ERROR_CODES.NOT_FOUND })).toBe(true);
  });

  it('returns false for server errors', () => {
    expect(isUserError({ code: ERROR_CODES.SERVER_ERROR })).toBe(false);
    expect(isUserError({ code: ERROR_CODES.NETWORK_ERROR })).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isUserError(null)).toBe(false);
    expect(isUserError(undefined)).toBe(false);
  });
});

// ── Utilities ───────────────────────────────────────────────────────

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('uses prefix when provided', () => {
    const id = generateId('claim');
    expect(id.startsWith('claim_')).toBe(true);
  });

  it('returns string without prefix', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(5);
  });
});

describe('deepClone', () => {
  it('clones nested objects', () => {
    const original = { a: { b: { c: 1 } } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.a).not.toBe(original.a);
  });

  it('clones arrays', () => {
    const original = [1, [2, 3]];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('handles primitives', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(null)).toBe(null);
  });
});

describe('debounce', () => {
  it('delays function execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('resets timer on subsequent calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('passes arguments through', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced('a', 'b');
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('a', 'b');

    vi.useRealTimers();
  });
});
