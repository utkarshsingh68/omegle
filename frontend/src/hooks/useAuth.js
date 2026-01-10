/**
 * Auth Hook - Handles authentication state and API calls
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get stored session token
  const getToken = () => localStorage.getItem('sessionToken');
  const setToken = (token) => {
    if (token) {
      localStorage.setItem('sessionToken', token);
    } else {
      localStorage.removeItem('sessionToken');
    }
  };

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/session`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
        } else {
          setToken(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Register
  const register = useCallback(async (username, email, password, displayName) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, displayName })
      });
      const data = await response.json();

      if (data.success) {
        setToken(data.sessionToken);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Registration failed. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login
  const login = useCallback(async (usernameOrEmail, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password })
      });
      const data = await response.json();

      if (data.success) {
        setToken(data.sessionToken);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Login failed. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guest login
  const guestLogin = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        setToken(data.sessionToken);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Guest login failed. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    const token = getToken();
    
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    setToken(null);
    setUser(null);
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not logged in' };

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Update failed' };
    }
  }, []);

  // Convert guest to registered user
  const convertToUser = useCallback(async (username, email, password) => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not logged in' };

    try {
      const response = await fetch(`${API_URL}/api/auth/convert`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Conversion failed' };
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isGuest: user?.isGuest ?? false,
    sessionToken: getToken(),
    register,
    login,
    guestLogin,
    logout,
    updateProfile,
    convertToUser,
    clearError: () => setError(null)
  };
}
