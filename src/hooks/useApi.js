import { useState, useCallback } from 'react';
import { authApi, ridesApi, bookingsApi, studentsApi, userApi } from '../utils/api';

/**
 * Custom hook for API calls with loading and error states
 */
export const useApi = (apiFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  return { data, loading, error, execute };
};

/**
 * Hook for authentication
 */
export const useAuth = () => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.login({ email, password });
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.register(userData);
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout };
};

/**
 * Hook for rides
 */
export const useRides = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchRides = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ridesApi.getAll(params);
      setRides(result.rides || []);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRide = useCallback(async (rideData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ridesApi.create(rideData);
      setRides(prev => [...prev, result.ride]);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRide = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await ridesApi.delete(id);
      setRides(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { rides, loading, error, searchRides, createRide, deleteRide };
};

/**
 * Hook for nearby students (ride matching)
 */
export const useNearbyStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const findNearby = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentsApi.getNearby(params);
      setStudents(result.students || []);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { students, loading, error, findNearby };
};

export default useApi;