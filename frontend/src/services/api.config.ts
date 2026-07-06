export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const defaultHeaders = {
  'Content-Type': 'application/json',
};

// This file is the ONLY place where the API base URL lives.
// All service files will import from here when real API calls are implemented.
