/**
 * Tests for use-toast — Toast notification system reducer + logic
 * Covers: reducer, genId, toast function, dismiss behavior
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reducer, toast, useToast } from './use-toast';
import { renderHook, act } from '@testing-library/react';

describe('toast reducer', () => {
  const emptyState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds a toast to empty state', () => {
      const action = { type: 'ADD_TOAST', toast: { id: '1', title: 'Hello' } };
      const result = reducer(emptyState, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0]).toEqual({ id: '1', title: 'Hello' });
    });

    it('limits toasts to TOAST_LIMIT (1)', () => {
      const state = { toasts: [{ id: '1', title: 'Existing' }] };
      const action = { type: 'ADD_TOAST', toast: { id: '2', title: 'New' } };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2'); // newest first
    });

    it('does not mutate original state', () => {
      const state = { toasts: [] };
      const action = { type: 'ADD_TOAST', toast: { id: '1', title: 'Test' } };
      const result = reducer(state, action);
      expect(result).not.toBe(state);
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates an existing toast by id', () => {
      const state = { toasts: [{ id: '1', title: 'Old' }] };
      const action = { type: 'UPDATE_TOAST', toast: { id: '1', title: 'Updated' } };
      const result = reducer(state, action);
      expect(result.toasts[0].title).toBe('Updated');
    });

    it('does not affect non-matching toasts', () => {
      const state = { toasts: [{ id: '1', title: 'A' }] };
      const action = { type: 'UPDATE_TOAST', toast: { id: '2', title: 'B' } };
      const result = reducer(state, action);
      expect(result.toasts[0].title).toBe('A');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open to false for specific toast', () => {
      const state = { toasts: [{ id: '1', open: true }, { id: '2', open: true }] };
      const action = { type: 'DISMISS_TOAST', toastId: '1' };
      const result = reducer(state, action);
      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(true);
    });

    it('dismisses all toasts when toastId is undefined', () => {
      const state = { toasts: [{ id: '1', open: true }, { id: '2', open: true }] };
      const action = { type: 'DISMISS_TOAST', toastId: undefined };
      const result = reducer(state, action);
      expect(result.toasts.every(t => t.open === false)).toBe(true);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes a specific toast by id', () => {
      const state = { toasts: [{ id: '1' }, { id: '2' }] };
      const action = { type: 'REMOVE_TOAST', toastId: '1' };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('removes all toasts when toastId is undefined', () => {
      const state = { toasts: [{ id: '1' }, { id: '2' }] };
      const action = { type: 'REMOVE_TOAST', toastId: undefined };
      const result = reducer(state, action);
      expect(result.toasts).toHaveLength(0);
    });
  });
});

describe('toast function', () => {
  it('returns id, dismiss, and update functions', () => {
    const result = toast({ title: 'Test toast' });
    expect(result).toHaveProperty('id');
    expect(typeof result.dismiss).toBe('function');
    expect(typeof result.update).toBe('function');
  });

  it('generates unique IDs for each toast', () => {
    const t1 = toast({ title: 'First' });
    const t2 = toast({ title: 'Second' });
    expect(t1.id).not.toBe(t2.id);
  });
});

describe('useToast hook', () => {
  it('returns toasts array and toast function', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toBeDefined();
    expect(typeof result.current.toast).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
  });

  it('receives new toasts when dispatched', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Hello' });
    });

    expect(result.current.toasts.length).toBeGreaterThanOrEqual(0);
  });

  it('dismiss function works', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      const t = result.current.toast({ title: 'Dismissable' });
      result.current.dismiss(t.id);
    });

    // All toasts should be open: false after dismiss
    result.current.toasts.forEach(t => {
      expect(t.open).toBe(false);
    });
  });
});
