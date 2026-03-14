/**
 * Tests for AuthContext — Authentication provider
 * Covers: login, register, logout, checkAuth, auth-expired event, useAuth guard
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('../lib/sentry', () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../lib/core', () => ({
  clearAllEdenStorage: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const { apiGet, apiPost, setAuthToken, clearAuthToken, clearCache } = await import('../lib/api');
const { setSentryUser, clearSentryUser } = await import('../lib/sentry');
const { clearAllEdenStorage } = await import('../lib/core');
const { AuthProvider, useAuth } = await import('./AuthContext');

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: checkAuth returns not authenticated
  apiGet.mockResolvedValue({ ok: false });
});

describe('AuthProvider', () => {
  it('starts with loading true and user null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('checks auth on mount and sets user if authenticated', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { id: 'u1', email: 'test@test.com' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual({ id: 'u1', email: 'test@test.com' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(setSentryUser).toHaveBeenCalledWith({ id: 'u1', email: 'test@test.com' });
  });

  it('handles checkAuth failure gracefully', async () => {
    apiGet.mockRejectedValue(new Error('Network error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();

    errorSpy.mockRestore();
  });
});

describe('login', () => {
  it('returns success and sets user on valid credentials', async () => {
    apiGet.mockResolvedValue({ ok: false }); // checkAuth
    apiPost.mockResolvedValue({
      ok: true,
      data: {
        user: { id: 'u1', email: 'test@test.com' },
        access_token: 'tok123',
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'password');
    });

    expect(loginResult).toEqual({ success: true });
    expect(result.current.user).toEqual({ id: 'u1', email: 'test@test.com' });
    expect(setAuthToken).toHaveBeenCalledWith('tok123');
    expect(setSentryUser).toHaveBeenCalledWith({ id: 'u1', email: 'test@test.com' });
  });

  it('returns error on failed login', async () => {
    apiGet.mockResolvedValue({ ok: false });
    apiPost.mockResolvedValue({
      ok: false,
      error: { detail: 'Invalid credentials' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'wrong');
    });

    expect(loginResult).toEqual({ success: false, error: 'Invalid credentials' });
    errorSpy.mockRestore();
  });

  it('returns error when response has no user object', async () => {
    apiGet.mockResolvedValue({ ok: false });
    apiPost.mockResolvedValue({
      ok: true,
      data: { access_token: 'tok' }, // missing user
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'pass');
    });

    expect(loginResult).toEqual({ success: false, error: 'Server returned invalid user format' });
    errorSpy.mockRestore();
  });

  it('does not set auth token when none provided', async () => {
    apiGet.mockResolvedValue({ ok: false });
    apiPost.mockResolvedValue({
      ok: true,
      data: { user: { id: 'u1' } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('test@test.com', 'pass');
    });

    expect(setAuthToken).not.toHaveBeenCalled();
  });
});

describe('register', () => {
  it('registers and then logs in', async () => {
    apiGet.mockResolvedValue({ ok: false });
    apiPost
      .mockResolvedValueOnce({ ok: true, data: { registered: true } }) // register
      .mockResolvedValueOnce({
        ok: true,
        data: { user: { id: 'u1' }, access_token: 'tok' },
      }); // login

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let registerResult;
    await act(async () => {
      registerResult = await result.current.register('a@b.com', 'pass', 'Alice');
    });

    expect(registerResult).toEqual({ success: true });
    expect(apiPost).toHaveBeenCalledWith('/api/auth/register', {
      email: 'a@b.com',
      password: 'pass',
      full_name: 'Alice',
      role: 'adjuster',
    });
  });

  it('returns error on registration failure', async () => {
    apiGet.mockResolvedValue({ ok: false });
    apiPost.mockResolvedValue({ ok: false, error: 'Email exists' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let registerResult;
    await act(async () => {
      registerResult = await result.current.register('a@b.com', 'pass', 'Alice');
    });

    expect(registerResult).toEqual({ success: false, error: 'Email exists' });
    errorSpy.mockRestore();
  });
});

describe('logout', () => {
  it('clears user state and tokens', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { id: 'u1' },
    });
    apiPost.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(clearAuthToken).toHaveBeenCalled();
    expect(clearCache).toHaveBeenCalled();
    expect(clearAllEdenStorage).toHaveBeenCalled();
    expect(clearSentryUser).toHaveBeenCalled();
  });

  it('still clears local state when backend logout fails', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { id: 'u1' } });
    apiPost.mockRejectedValue(new Error('Network error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(clearAuthToken).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('useAuth guard', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
