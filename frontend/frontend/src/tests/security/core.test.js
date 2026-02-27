/**
 * Tests for core utilities: storage, logout cleanup, constants
 */
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearAllEdenStorage,
  CLAIM_TYPES,
} from '../../lib/core';

describe('Storage Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('setStorageItem + getStorageItem round-trips objects', () => {
    const data = { name: 'Test', value: 42 };
    setStorageItem('test_key', data);
    expect(getStorageItem('test_key')).toEqual(data);
  });

  test('getStorageItem returns default when key missing', () => {
    expect(getStorageItem('nonexistent', 'fallback')).toBe('fallback');
  });

  test('getStorageItem returns default for invalid JSON', () => {
    localStorage.setItem('eden_bad', 'not-json{');
    expect(getStorageItem('bad', 'default')).toBe('default');
  });

  test('removeStorageItem removes the key', () => {
    setStorageItem('removable', { x: 1 });
    removeStorageItem('removable');
    expect(getStorageItem('removable', null)).toBeNull();
  });
});

describe('clearAllEdenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('removes all eden_ prefixed keys', () => {
    localStorage.setItem('eden_token', 'secret');
    localStorage.setItem('eden_user', '{"name":"Test"}');
    localStorage.setItem('eden_settings_notifications', 'true');
    localStorage.setItem('eden_rep_name', 'John');
    localStorage.setItem('unrelated_key', 'keep-me');

    clearAllEdenStorage();

    expect(localStorage.getItem('eden_token')).toBeNull();
    expect(localStorage.getItem('eden_user')).toBeNull();
    expect(localStorage.getItem('eden_settings_notifications')).toBeNull();
    expect(localStorage.getItem('eden_rep_name')).toBeNull();
    // Non-eden keys should remain
    expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
  });

  test('removes eden- prefixed keys (hyphen variant)', () => {
    localStorage.setItem('eden-theme', 'dark');
    clearAllEdenStorage();
    expect(localStorage.getItem('eden-theme')).toBeNull();
  });

  test('removes eden_offline_queue', () => {
    localStorage.setItem('eden_offline_queue', '[]');
    clearAllEdenStorage();
    expect(localStorage.getItem('eden_offline_queue')).toBeNull();
  });

  test('does not throw on empty localStorage', () => {
    expect(() => clearAllEdenStorage()).not.toThrow();
  });
});

describe('CLAIM_TYPES constant', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(CLAIM_TYPES)).toBe(true);
    expect(CLAIM_TYPES.length).toBeGreaterThan(0);
  });

  test('includes common claim types', () => {
    const types = CLAIM_TYPES.map(t => t.toLowerCase());
    expect(types).toContain('water damage');
    expect(types).toContain('fire damage');
  });
});
