/**
 * Tests for ThemeContext — Light-mode-only theme provider
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  // Clean up DOM state
  document.documentElement.classList.remove('dark', 'theme-dark');
  document.body.classList.remove('dark', 'theme-dark');
  document.documentElement.style.colorScheme = '';
  localStorage.clear();
});

describe('ThemeProvider', () => {
  it('provides theme as light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(result.current.isLight).toBe(true);
  });

  it('removes dark classes from document on mount', () => {
    document.documentElement.classList.add('dark', 'theme-dark');
    document.body.classList.add('dark', 'theme-dark');

    renderHook(() => useTheme(), { wrapper });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('sets colorScheme to light', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('clears stored theme preferences', () => {
    localStorage.setItem('eden_theme', 'dark');
    localStorage.setItem('theme', 'dark');

    renderHook(() => useTheme(), { wrapper });

    expect(localStorage.getItem('eden_theme')).toBeNull();
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('toggleTheme is a no-op', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    warnSpy.mockRestore();
  });

  it('setLightTheme is a no-op that does not throw', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(() => result.current.setLightTheme()).not.toThrow();
  });

  it('setDarkTheme logs a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setDarkTheme();
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('useTheme outside provider', () => {
  it('throws when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');
  });
});
