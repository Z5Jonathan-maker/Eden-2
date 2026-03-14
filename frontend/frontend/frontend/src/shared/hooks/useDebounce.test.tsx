import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100));
    expect(result.current).toBe('hello');
  });

  it('should debounce value updates', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });
    expect(result.current).toBe('initial'); // Still old value

    // Advance past debounce delay
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('updated');

    vi.useRealTimers();
  });

  it('should cancel previous timeout on rapid changes', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'first' } }
    );

    // First rapid update
    rerender({ value: 'second' });
    // Advance 50ms — debounce not yet settled
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('first');

    // Second update before debounce fires — should cancel 'second' timer
    rerender({ value: 'third' });
    // Advance past the debounce delay for 'third'
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current).toBe('third');

    vi.useRealTimers();
  });

  it('should use custom delay', () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Should not update after 100ms
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('initial');

    // But should update after 200ms
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('updated');

    vi.useRealTimers();
  });

  it('should handle numbers', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: 42 } }
    );
    rerender({ value: 100 });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(100);
    vi.useRealTimers();
  });

  it('should handle booleans', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: true } }
    );
    rerender({ value: false });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });

  it('should handle objects', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: { name: 'John' } } }
    );
    const newObj = { name: 'Jane' };
    rerender({ value: newObj });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(newObj);
    vi.useRealTimers();
  });

  it('should return latest value after timeout', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: 'test' } }
    );
    rerender({ value: 'updated' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('updated');
    vi.useRealTimers();
  });
});
