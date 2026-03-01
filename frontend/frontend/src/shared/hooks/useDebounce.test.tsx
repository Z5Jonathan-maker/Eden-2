import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100));
    expect(result.current).toBe('hello');
  });

  it('should debounce value updates', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });
    expect(result.current).toBe('initial'); // Still old value

    // Wait for debounce
    await waitFor(
      () => {
        expect(result.current).toBe('updated');
      },
      { timeout: 200 }
    );
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

  it('should use custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Should not update after 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current).toBe('initial');

    // But should update after 200ms
    await waitFor(
      () => {
        expect(result.current).toBe('updated');
      },
      { timeout: 300 }
    );
  });

  it('should handle numbers', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: 42 } }
    );
    rerender({ value: 100 });
    await waitFor(() => expect(result.current).toBe(100), { timeout: 200 });
  });

  it('should handle booleans', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: true } }
    );
    rerender({ value: false });
    await waitFor(() => expect(result.current).toBe(false), { timeout: 200 });
  });

  it('should handle objects', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: { name: 'John' } } }
    );
    const newObj = { name: 'Jane' };
    rerender({ value: newObj });
    await waitFor(() => expect(result.current).toBe(newObj), { timeout: 200 });
  });

  it('should return latest value after timeout', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 50),
      { initialProps: { value: 'test' } }
    );

    rerender({ value: 'updated' });

    await waitFor(() => expect(result.current).toBe('updated'), { timeout: 200 });
  });
});
