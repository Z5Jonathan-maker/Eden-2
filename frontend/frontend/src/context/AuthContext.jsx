import React, { createContext, useContext, useState, useEffect } from 'react';
import { setSentryUser, clearSentryUser } from '../lib/sentry';
import { apiGet, apiPost, setAuthToken, clearAuthToken, clearCache } from '../lib/api';
import { clearAllEdenStorage } from '../lib/core';
import { toast } from 'sonner';

// Empty string = same-origin (behind Vercel/nginx proxy). Use ?? so "" isn't skipped.
const API_URL = import.meta.env.REACT_APP_BACKEND_URL ?? import.meta.env.REACT_APP_API_URL ?? '';

const missingApiUrlMessage = "Missing API base URL. Set REACT_APP_BACKEND_URL (preferred) or REACT_APP_API_URL to your backend, then rebuild/redeploy.";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global listener: any 401 from api.js triggers logout + redirect (debounced)
  useEffect(() => {
    let handled = false;
    const handleAuthExpired = () => {
      if (handled) return;
      handled = true;
      clearAuthToken();
      clearCache();
      clearAllEdenStorage();
      clearSentryUser();
      setUser(null);
      toast.error('Session expired — please log in again.', { duration: 4000 });
      // Redirect to login. Uses window.location so it works regardless of
      // which component tree we're in (no dependency on useNavigate).
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.replace('/login');
      }
      // Reset flag after short delay so future expirations (re-login then expire) still work
      setTimeout(() => { handled = false; }, 2000);
    };
    window.addEventListener('eden:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('eden:auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    // Check if user is already logged in by calling /api/auth/me
    // The httpOnly cookie will be sent automatically
    const checkAuth = async () => {
      try {
        if (API_URL == null) {
          setLoading(false);
          return;
        }

        const response = await apiGet('/api/auth/me');

        if (response.ok) {
          setUser(response.data);
          setSentryUser(response.data); // Track user in Sentry
        } else {
          // Not authenticated or session expired
          setUser(null);
        }
      } catch (error) {
        console.error('[Auth] Failed to check authentication:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      if (API_URL == null) throw new Error(missingApiUrlMessage);

      const response = await apiPost('/api/auth/login', { email, password });

      if (!response.ok) {
        const errorMessage = response.error?.detail || response.error || 'Login failed';
        throw new Error(errorMessage);
      }

      if (!response.data.user) {
        console.error('[Auth] Missing user in response:', response.data);
        throw new Error('Server returned invalid user format');
      }

      // Store Bearer token for cross-origin auth (cookie is primary, this is fallback)
      if (response.data.access_token) {
        setAuthToken(response.data.access_token);
      }

      setUser(response.data.user);
      setSentryUser(response.data.user); // Track user in Sentry

      return { success: true };
    } catch (error) {
      console.error('[Auth] Login failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, fullName, role = 'adjuster') => {
    try {
      if (API_URL == null) throw new Error(missingApiUrlMessage);

      const response = await apiPost('/api/auth/register', {
        email,
        password,
        full_name: fullName,
        role,
      });

      if (!response.ok) {
        throw new Error(response.error?.detail || response.error || 'Registration failed');
      }

      // Auto login after registration
      return await login(email, password);
    } catch (error) {
      console.error('[Auth] Registration failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      if (API_URL) {
        // Call backend to clear httpOnly cookie
        await apiPost('/api/auth/logout', {});
      }
    } catch (error) {
      console.error('[Auth] Logout request failed:', error);
      // Continue with local logout even if backend call fails
    } finally {
      clearAuthToken();
      clearCache();
      clearAllEdenStorage();
      clearSentryUser();
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
