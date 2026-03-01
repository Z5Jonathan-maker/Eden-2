/**
 * Tests for queryClient.ts — React Query client configuration
 */
import { describe, it, expect } from 'vitest';
import { queryClient } from './queryClient';

describe('queryClient', () => {
  it('is a QueryClient instance', () => {
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getDefaultOptions).toBe('function');
  });

  it('has staleTime of 5 minutes', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(1000 * 60 * 5);
  });

  it('has gcTime of 10 minutes', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.gcTime).toBe(1000 * 60 * 10);
  });

  it('has refetchOnWindowFocus disabled', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('has retry set to 1', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.retry).toBe(1);
  });
});
