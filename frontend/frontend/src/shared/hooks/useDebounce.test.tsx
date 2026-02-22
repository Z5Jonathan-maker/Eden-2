import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'first' } }
    );

    // Rapid updates
    rerender({ value: 'second' });
    setTimeout(() => rerender({ value: 'third' }), 50);

    // Should eventually settle on 'third', not 'second'
    await waitFor(
      () => {
        expect(result.current).toBe('third');
      },
      { timeout: 250 }
    );
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
