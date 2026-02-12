import React, { createContext, useContext, useState, useEffect } from 'react';
import { buildApiUrl, resolveBackendUrl } from '../lib/config';

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
  const [token, setToken] = useState(localStorage.getItem('eden_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem('eden_token');
    const storedUser = localStorage.getItem('eden_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
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
      
      // Validate required fields
      if (!data.access_token) {
        console.error('[Auth] Missing access_token in response:', data);
        throw new Error('Server returned invalid token format');
      }
      
      if (!data.user) {
        console.error('[Auth] Missing user in response:', data);
        throw new Error('Server returned invalid user format');
      }
      
      localStorage.setItem('eden_token', data.access_token);
      localStorage.setItem('eden_user', JSON.stringify(data.user));
      
      setToken(data.access_token);
      setUser(data.user);
      
      return { success: true };
    } catch (error) {
      if (error instanceof TypeError && /failed to fetch|networkerror/i.test(error.message || '')) {
        const target = resolveBackendUrl() || window.location.origin;
        return {
          success: false,
          error: `Cannot reach backend at ${target}. Check backend URL, CORS, and that the API server is running.`,
        };
      }
      console.error('[Auth] Login failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, fullName, role = 'adjuster') => {
    try {
      const response = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
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
      if (error instanceof TypeError && /failed to fetch|networkerror/i.test(error.message || '')) {
        const target = resolveBackendUrl() || window.location.origin;
        return {
          success: false,
          error: `Cannot reach backend at ${target}. Check backend URL, CORS, and that the API server is running.`,
        };
      }
      console.error('[Auth] Registration failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('eden_token');
    localStorage.removeItem('eden_user');
    setToken(null);
    setUser(null);
  };

  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    getAuthHeaders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
