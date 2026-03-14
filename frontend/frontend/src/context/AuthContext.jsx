import React, { createContext, useContext, useState, useEffect } from 'react';

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
      if (!API_URL) throw new Error(missingApiUrlMessage);

      const response = await fetch(`${API_URL}/api/auth/login`, {
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
      console.error('[Auth] Login failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, fullName, role = 'adjuster') => {
    try {
      if (!API_URL) throw new Error(missingApiUrlMessage);

      const response = await fetch(`${API_URL}/api/auth/register`, {
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
