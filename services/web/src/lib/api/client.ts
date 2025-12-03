import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (Zustand persist)
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch {
        // Ignore parse errors
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      // Clear auth storage
      localStorage.removeItem('auth-storage');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Log when using mocks
if (USE_MOCKS) {
  console.info('[API] Using mock API handlers');
}

export default api;
