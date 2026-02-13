import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL;

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

  useEffect(() => {
    // Check if user is already logged in by calling /api/auth/me
    // The httpOnly cookie will be sent automatically
    const checkAuth = async () => {
      try {
        if (!API_URL) {
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include', // Include httpOnly cookies
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
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
      if (!API_URL) throw new Error(missingApiUrlMessage);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include httpOnly cookies in request/response
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

      // Validate user data (token is now in httpOnly cookie, not in response)
      if (!data.user) {
        console.error('[Auth] Missing user in response:', data);
        throw new Error('Server returned invalid user format');
      }

      // Store user data in state (no token storage needed - it's in httpOnly cookie)
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
        credentials: 'include', // Include httpOnly cookies
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
        // Call backend to clear httpOnly cookie
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include', // Include cookies to identify session
        });
      }
    } catch (error) {
      console.error('[Auth] Logout request failed:', error);
      // Continue with local logout even if backend call fails
    } finally {
      // Clear local state
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
