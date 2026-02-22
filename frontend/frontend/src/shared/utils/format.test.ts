import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency, formatNumber, toFiniteNumber } from './format';

describe('formatDate', () => {
  it('should format a date string correctly', () => {
    const result = formatDate('2024-01-15T12:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
  });

  it('should format a Date object correctly', () => {
    const date = new Date(2024, 11, 25); // Month is 0-indexed
    const result = formatDate(date);
    expect(result).toBe('Dec 25, 2024');
  });

  it('should handle ISO date strings', () => {
    const result = formatDate('2024-03-20T00:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('Mar');
  });
});

describe('formatCurrency', () => {
  it('should format positive amounts', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should format negative amounts', () => {
    expect(formatCurrency(-500.25)).toBe('-$500.25');
  });

  it('should format large amounts with commas', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(123.456)).toBe('$123.46');
  });

  it('should handle whole numbers', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });
});

describe('formatNumber', () => {
  it('should format numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-12345)).toBe('-12,345');
  });

  it('should preserve decimal places', () => {
    expect(formatNumber(123.45)).toBe('123.45');
  });

  it('should handle large numbers', () => {
    expect(formatNumber(1000000000)).toBe('1,000,000,000');
  });
});

describe('toFiniteNumber', () => {
  describe('valid numbers', () => {
    it('should return valid number as-is', () => {
      expect(toFiniteNumber(42)).toBe(42);
      expect(toFiniteNumber(0)).toBe(0);
      expect(toFiniteNumber(-10)).toBe(-10);
      expect(toFiniteNumber(3.14)).toBe(3.14);
    });

    it('should parse numeric strings', () => {
      expect(toFiniteNumber('42')).toBe(42);
      expect(toFiniteNumber('3.14')).toBe(3.14);
      expect(toFiniteNumber('-10')).toBe(-10);
    });
  });

  describe('invalid values', () => {
    it('should return fallback for NaN', () => {
      expect(toFiniteNumber(NaN)).toBe(0);
      expect(toFiniteNumber(NaN, 99)).toBe(99);
    });

    it('should return fallback for Infinity', () => {
      expect(toFiniteNumber(Infinity)).toBe(0);
      expect(toFiniteNumber(-Infinity)).toBe(0);
      expect(toFiniteNumber(Infinity, 100)).toBe(100);
    });

    it('should return fallback for non-numeric strings', () => {
      expect(toFiniteNumber('abc')).toBe(0);
      expect(toFiniteNumber('abc', 50)).toBe(50);
    });

    it('should handle null and undefined', () => {
      // Number(null) = 0, which is finite, so no fallback
      expect(toFiniteNumber(null)).toBe(0);
      expect(toFiniteNumber(null, 25)).toBe(0); // Still 0, not 25!
      // Number(undefined) = NaN, which triggers fallback
      expect(toFiniteNumber(undefined)).toBe(0);
      expect(toFiniteNumber(undefined, 25)).toBe(25);
    });

    it('should return fallback for objects', () => {
      expect(toFiniteNumber({})).toBe(0);
      expect(toFiniteNumber([])). toBe(0);
      expect(toFiniteNumber({ value: 42 }, 10)).toBe(10);
    });
  });

  describe('default fallback', () => {
    it('should use 0 as default fallback', () => {
      expect(toFiniteNumber('invalid')).toBe(0);
      expect(toFiniteNumber(NaN)).toBe(0);
    });
  });

  describe('custom fallback', () => {
    it('should use custom fallback when provided', () => {
      expect(toFiniteNumber('invalid', 100)).toBe(100);
      expect(toFiniteNumber(NaN, -1)).toBe(-1);
      expect(toFiniteNumber(Infinity, 999)).toBe(999);
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      expect(toFiniteNumber(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very small numbers', () => {
      expect(toFiniteNumber(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('should handle scientific notation strings', () => {
      expect(toFiniteNumber('1e3')).toBe(1000);
      expect(toFiniteNumber('1e-3')).toBe(0.001);
    });
  });
});
