export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const defaultHeaders = {
  'Content-Type': 'application/json',
};

// Single source for the API base URL.
