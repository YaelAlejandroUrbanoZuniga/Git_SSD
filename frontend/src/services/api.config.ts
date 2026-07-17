// Single source for the API base URL and the HTTP plumbing every service uses.

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const defaultHeaders = {
  'Content-Type': 'application/json',
};

/**
 * A failed API call, carrying whatever the backend explained.
 *
 * The backend's error handler always answers `{ error, code }` (see
 * backend/src/middleware/errorHandler.ts), so `message` is a sentence meant to
 * be readable by a user — business-rule violations ("Blacklist requires a
 * reason"), validation errors, 404s. `status === 0` means the request never
 * reached the server (backend down, CORS, offline).
 *
 * Services throw this; callers decide how to surface it. The convention in this
 * app is `toast.systemError()` for anything unexpected, and
 * `toast.validationError()` when the backend rejected what the user just typed.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the backend refused the payload rather than failing internally. */
  get isUserFixable(): boolean {
    return this.status === 400 || this.status === 409 || this.status === 422;
  }
}

/**
 * `fetch` against the API with JSON in/out and errors normalised to `ApiError`.
 *
 * Auth: the backend currently runs with AUTH_OPTIONAL=true, so requests without
 * a token are attributed to the demo user and none is attached here. When the
 * frontend gains a real login, the Bearer header belongs in this function and
 * nowhere else.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...defaultHeaders, ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Could not reach the server at ${API_BASE_URL}. Check that the backend is running.`,
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : `Request failed (HTTP ${res.status}).`;
    const code = body && typeof body === 'object' && 'code' in body
      ? String((body as { code: unknown }).code)
      : undefined;
    throw new ApiError(message, res.status, code);
  }

  return body as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiFetch<T>(path);

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });

export const apiDelete = <T>(path: string): Promise<T> =>
  apiFetch<T>(path, { method: 'DELETE' });
