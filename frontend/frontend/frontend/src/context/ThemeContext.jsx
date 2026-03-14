/**
 * Theme Context - Single Source of Truth for Theme Management
 * 
 * CURRENT STATE: Light mode only (dark mode disabled)
 * 
 * To re-enable dark mode later:
 * 1. Set darkMode: 'class' in tailwind.config.js
 * 2. Uncomment the state management below
 * 3. The toggle will work automatically
 */

import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Enforce light mode on every render (safety check)
  useEffect(() => {
    // Remove any dark mode classes that might have been set
    document.documentElement.classList.remove('dark', 'theme-dark');
    document.body.classList.remove('dark', 'theme-dark');
    
    // Set light color scheme
    document.documentElement.style.colorScheme = 'light';
    
    // Clear any stored theme preference
    localStorage.removeItem('eden_theme');
    localStorage.removeItem('theme');
  }, []);

  // Provide context values (locked to light mode)
  const contextValue = {
    theme: 'light',
    isDark: false,
    isLight: true,
    // Dummy functions that do nothing (for backward compatibility)
    toggleTheme: () => {
      console.warn('Theme toggle is disabled. Dark mode is currently not enabled.');
    },
    setLightTheme: () => {},
    setDarkTheme: () => {
      console.warn('Dark mode is currently disabled.');
    },
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
