import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_API_URL;

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

  /**
   * Fetch current user from /api/auth/me using the httpOnly cookie.
   * This is the only way to determine auth state — no localStorage tokens.
   */
  const fetchCurrentUser = useCallback(async () => {
    if (!API_URL) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch current user:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clean up any legacy localStorage tokens (security: XSS-vulnerable)
    localStorage.removeItem('eden_token');
    localStorage.removeItem('eden_user');

    // Determine auth state from httpOnly cookie via /api/auth/me
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    try {
      if (!API_URL) throw new Error(missingApiUrlMessage);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // Read response body
      let data;
      let responseText = '';
      try {
        responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[Auth] Response parse error:', parseError, 'Text:', responseText);
        data = { detail: `Invalid response format: ${responseText.substring(0, 100)}` };
      }

      if (!response.ok) {
        const errorMessage = data.detail || data.message || 'Login failed';
        throw new Error(errorMessage);
      }

      if (!data.user) {
        console.error('[Auth] Missing user in response:', data);
        throw new Error('Server returned invalid user format');
      }

      // Token is set as httpOnly cookie by the server — just store user in state
      setUser(data.user);

      return { success: true };
    } catch (error) {
      console.error('[Auth] Login failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, fullName, role = 'adjuster') => {
    try {
      if (!API_URL) throw new Error(missingApiUrlMessage);

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
        }),
      });

      // Read response body
      let data;
      let responseText = '';
      try {
        responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[Auth] Register response parse error:', parseError, 'Text:', responseText);
        data = { detail: `Invalid response format: ${responseText.substring(0, 100)}` };
      }

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Registration failed');
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
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
      }
    } catch (error) {
      console.error('[Auth] Logout request failed:', error.message);
    }
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    fetchCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
