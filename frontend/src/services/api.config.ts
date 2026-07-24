// Single source for the API base URL and the HTTP plumbing every service uses.

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const defaultHeaders = {
  'Content-Type': 'application/json',
};

// ── Module-level token store ─────────────────────────────────────────────
// Kept outside React so plain services (suppliersService, etc.) read it without
// importing React. AuthContext feeds it via setToken/setRefreshToken on login,
// logout and initial hydration; the refresh flow below keeps it current.
const TOKEN_KEY = 'ssd_token';
const REFRESH_KEY = 'ssd_refresh_token';
const USER_KEY = 'ssd_user';

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;

export function setToken(t: string | null) { accessToken = t; }
export function setRefreshToken(t: string | null) { refreshTokenValue = t; }

/**
 * A failed API call. `message` is the backend's user-readable `{ error }`
 * sentence; `status === 0` means the request never reached the server.
 * Services throw it; callers pick toast.systemError vs toast.validationError.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /**
     * Backend correlation id. Sent on 500s only (see the backend errorHandler);
     * the same code appears on the server's `[req]`/`[unhandled]` log lines and
     * in T_Audit_Log, so a user who reports it pins down the exact request.
     */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the backend refused the payload rather than failing internally. */
  get isUserFixable(): boolean {
    return this.status === 400 || this.status === 409 || this.status === 422;
  }
}

// ── Automatic refresh on 401 ─────────────────────────────────────────────
// A single in-flight refresh is shared across concurrent 401s (so a burst of
// failing requests triggers only one POST /auth/refresh).
let refreshPromise: Promise<boolean> | null = null;

/** Auth endpoints that legitimately answer 401 and must NOT trigger a refresh. */
function isAuthEndpoint(path: string): boolean {
  return path === '/auth/login' || path === '/auth/refresh' || path === '/auth/logout';
}

/** Direct fetch (not apiFetch) so refreshing never recurses through this logic. */
async function doRefresh(): Promise<boolean> {
  if (!refreshTokenValue) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { ...defaultHeaders },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('token' in body) || !('refreshToken' in body)) {
      return false;
    }
    const token = String((body as { token: unknown }).token);
    const refresh = String((body as { refreshToken: unknown }).refreshToken);
    accessToken = token;
    refreshTokenValue = refresh;
    // Persist so a reload survives on the rotated tokens.
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_KEY, refresh);
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/** Clears the stored token pair; AuthContext clears the user via the event below. */
function clearStoredTokens() {
  accessToken = null;
  refreshTokenValue = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * `fetch` with JSON in/out and errors normalised to `ApiError`. Injects the
 * Bearer token when present, and on a 401 (only) tries a single token refresh +
 * one retry before giving up. The Bearer header lives here and nowhere else.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return runFetch<T>(path, init, false);
}

async function runFetch<T>(path: string, init: RequestInit | undefined, retried: boolean): Promise<T> {
  const authHeader: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...defaultHeaders, ...authHeader, ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Could not reach the server at ${API_BASE_URL}. Check that the backend is running.`,
      0,
    );
  }

  // A 401 (and ONLY a 401 — a 403 is legitimate RBAC and is never retried) gets
  // one refresh attempt. Auth endpoints answer 401 on their own terms.
  if (res.status === 401 && !retried && refreshTokenValue && !isAuthEndpoint(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return runFetch<T>(path, init, true);
    }
    // Refresh failed → the session is dead. Clear tokens and let the app react.
    clearStoredTokens();
    window.dispatchEvent(new Event('ssd:session-expired'));
    // Fall through so the original 401 ApiError still propagates (not silenced).
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
    const requestId = body && typeof body === 'object' && 'requestId' in body
      ? String((body as { requestId: unknown }).requestId)
      : undefined;
    // On a 500 the backend's own sentence is just "Internal server error", which
    // tells the user nothing. Folding the reference into the message is what makes
    // it visible in every `toast.systemError(err.message)` call site (all 50+ of
    // them) without touching any of them — the GSM tester reads the code straight
    // off the toast and sends it over, and it matches the server logs verbatim.
    const finalMessage = res.status === 500 && requestId
      ? `${message.replace(/\.$/, '')}. Reference: ${requestId}`
      : message;
    throw new ApiError(finalMessage, res.status, code, requestId);
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
