import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('initial');
  });

  it('should initialize with stored value when localStorage has data', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('stored');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      const [, setValue] = result.current;
      setValue('updated');
    });

    const [value] = result.current;
    expect(value).toBe('updated');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('should handle different data types', () => {
    // Number
    const { result: numResult } = renderHook(() => useLocalStorage('num-key', 42));
    act(() => {
      const [, setValue] = numResult.current;
      setValue(100);
    });
    expect(numResult.current[0]).toBe(100);
    expect(JSON.parse(localStorage.getItem('num-key')!)).toBe(100);

    // Boolean
    const { result: boolResult } = renderHook(() => useLocalStorage('bool-key', true));
    act(() => {
      const [, setValue] = boolResult.current;
      setValue(false);
    });
    expect(boolResult.current[0]).toBe(false);

    // Object
    const { result: objResult } = renderHook(() =>
      useLocalStorage('obj-key', { name: 'John', age: 30 })
    );
    act(() => {
      const [, setValue] = objResult.current;
      setValue({ name: 'Jane', age: 25 });
    });
    expect(objResult.current[0]).toEqual({ name: 'Jane', age: 25 });

    // Array
    const { result: arrResult } = renderHook(() => useLocalStorage('arr-key', [1, 2, 3]));
    act(() => {
      const [, setValue] = arrResult.current;
      setValue([4, 5, 6]);
    });
    expect(arrResult.current[0]).toEqual([4, 5, 6]);
  });

  it('should support functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 10));

    act(() => {
      const [, setValue] = result.current;
      setValue((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(JSON.parse(localStorage.getItem('test-key')!)).toBe(15);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    // Set invalid JSON
    localStorage.setItem('test-key', 'invalid-json{{{');

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
    const [value] = result.current;

    expect(value).toBe('fallback');
  });

  it('should handle localStorage setItem errors gracefully', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock localStorage.setItem to throw an error (e.g., quota exceeded)
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Should not crash when trying to set value
    expect(() => {
      act(() => {
        const [, setValue] = result.current;
        setValue('updated');
      });
    }).not.toThrow();

    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore original
    window.localStorage.setItem = originalSetItem;
    consoleErrorSpy.mockRestore();
  });

  it('should read from localStorage on subsequent hook instances', () => {
    // First hook sets a value
    const { result: result1 } = renderHook(() => useLocalStorage('shared-key', 'initial'));

    act(() => {
      const [, setValue] = result1.current;
      setValue('stored-value');
    });

    expect(result1.current[0]).toBe('stored-value');

    // Second hook with same key should read from localStorage
    const { result: result2 } = renderHook(() => useLocalStorage('shared-key', 'fallback'));

    // Should have the stored value, not the fallback
    expect(result2.current[0]).toBe('stored-value');
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', null));
    const [value] = result.current;
    expect(value).toBe(null);

    act(() => {
      const [, setValue] = result.current;
      setValue('some-value' as any);
    });

    expect(result.current[0]).toBe('some-value');
  });

  it('should use different keys for different hook instances', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'));
    const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'));

    // Each hook should have its own initial value
    expect(result1.current[0]).toBe('value1');
    expect(result2.current[0]).toBe('value2');

    // Update one shouldn't affect the other
    act(() => {
      const [, setValue] = result1.current;
      setValue('updated1');
    });

    expect(result1.current[0]).toBe('updated1');
    expect(result2.current[0]).toBe('value2'); // Unchanged
  });
});
