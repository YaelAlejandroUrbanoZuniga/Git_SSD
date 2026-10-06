import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppRole } from '../types';
import {
  ApiError, apiGet, apiPost, setRefreshToken, setToken,
  TOKEN_KEY, REFRESH_KEY, USER_KEY,
} from '../services/api.config';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: AppRole;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Throws on failure so Login.tsx can surface a message. */
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

/** GET /api/auth/me — note it does NOT return `email`. */
interface MeResponse {
  user: Omit<AuthUser, 'email'>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  /** Local-only teardown: clears storage + token store + state. No backend call. */
  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Initial hydration: adopt a stored session optimistically, then confirm with /me.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    // Feed the token store so apiFetch can authenticate the /me call.
    setToken(token);
    setRefreshToken(refresh);

    let hadOptimisticUser = false;
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
        setStatus('authenticated'); // optimistic — confirmed by /me below
        hadOptimisticUser = true;
      } catch {
        // corrupt cache — /me will decide
      }
    }

    let cancelled = false;
    apiGet<MeResponse>('/auth/me')
      .then(res => {
        if (cancelled) return;
        // /me refreshes id/username/displayName/role; email is kept from the
        // login/refresh cache since /me doesn't return it.
        setUser(prev => {
          const merged: AuthUser = {
            id: res.user.id,
            username: res.user.username,
            displayName: res.user.displayName,
            role: res.user.role,
            email: prev?.email ?? null,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(merged));
          return merged;
        });
        setStatus('authenticated');
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Token is dead and refresh (attempted inside apiFetch) also failed.
          clearLocalSession();
        } else {
          // Network/other error: keep an optimistic session if we had one,
          // otherwise we can't confirm — treat as signed out.
          setStatus(hadOptimisticUser ? 'authenticated' : 'unauthenticated');
        }
      });

    return () => { cancelled = true; };
  }, [clearLocalSession]);

  // apiFetch fires this when a refresh fails mid-session; mirror logout() locally.
  useEffect(() => {
    function onSessionExpired() {
      clearLocalSession();
    }
    window.addEventListener('ssd:session-expired', onSessionExpired);
    return () => window.removeEventListener('ssd:session-expired', onSessionExpired);
  }, [clearLocalSession]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiPost<LoginResponse>('/auth/login', { username, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.token);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    try {
      if (refresh) await apiPost('/auth/logout', { refreshToken: refresh });
    } catch {
      // Best-effort: logout must never be blocked by a failed request.
    }
    clearLocalSession();
  }, [clearLocalSession]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
