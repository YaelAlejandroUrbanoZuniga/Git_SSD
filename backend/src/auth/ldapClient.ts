// Abstraction over the external FastAPI/LDAP3 credential-validation service.
//
// The real service is owned by another team member and currently has three
// UNRESOLVED security issues (documented, intentionally NOT fixed here):
//   TODO(security): 1. LDAP traffic runs on port 389 without encryption (no
//                      LDAPS / StartTLS between FastAPI and the DC).
//   TODO(security): 2. The FastAPI service has its API_KEY hardcoded in
//                      config.py instead of reading it from the environment.
//   TODO(security): 3. Its requirements.txt is empty — no pinned dependencies,
//                      builds are not reproducible.
// See backend/README.md → "Pending TODOs".

export interface LdapUserInfo {
  username: string;
  displayName: string;
  email: string | null;
  /** Active Directory objectGUID */
  adObjectId: string | null;
}

export interface LdapAuthResult {
  ok: boolean;
  user?: LdapUserInfo;
  error?: string;
}

export interface LdapAuthClient {
  /** Validates credentials. Callers MUST discard the password immediately after. */
  validate(username: string, password: string): Promise<LdapAuthResult>;
}

/** Calls the real FastAPI/LDAP service. React never talks to it directly. */
export class HttpLdapAuthClient implements LdapAuthClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async validate(username: string, password: string): Promise<LdapAuthResult> {
    const res = await fetch(`${this.baseUrl}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ username, password }),
    });

    if (res.status === 401) return { ok: false, error: 'Invalid credentials' };
    if (!res.ok) return { ok: false, error: `LDAP service error (${res.status})` };

    const body = (await res.json()) as {
      username?: string;
      display_name?: string;
      email?: string | null;
      object_id?: string | null;
    };
    return {
      ok: true,
      user: {
        username: body.username ?? username,
        displayName: body.display_name ?? username,
        email: body.email ?? null,
        adObjectId: body.object_id ?? null,
      },
    };
  }
}

/**
 * Mock implementation (AUTH_MODE=mock): simulates a valid LDAP response for a
 * small set of known users with the shared password "password".
 * Lets the whole auth flow (upsert + JWT + refresh) run without the real service.
 */
export class MockLdapAuthClient implements LdapAuthClient {
  static readonly PASSWORD = 'password';

  private users: Record<string, LdapUserInfo> = {
    'yael.urbano': {
      username: 'yael.urbano',
      displayName: 'Yael Urbano',
      email: 'y.urbano@nexteer.com',
      adObjectId: 'ad-guid-yael-urbano',
    },
    'carlos.mendoza': {
      username: 'carlos.mendoza',
      displayName: 'Carlos Mendoza',
      email: 'c.mendoza@nexteer.com',
      adObjectId: 'ad-guid-carlos-mendoza',
    },
    'ana.garcia': {
      username: 'ana.garcia',
      displayName: 'Ana García',
      email: 'a.garcia@nexteer.com',
      adObjectId: 'ad-guid-ana-garcia',
    },
    'roberto.sanchez': {
      username: 'roberto.sanchez',
      displayName: 'Roberto Sánchez',
      email: 'r.sanchez@nexteer.com',
      adObjectId: 'ad-guid-roberto-sanchez',
    },
  };

  async validate(username: string, password: string): Promise<LdapAuthResult> {
    const user = this.users[username.toLowerCase()];
    if (!user || password !== MockLdapAuthClient.PASSWORD) {
      return { ok: false, error: 'Invalid credentials' };
    }
    return { ok: true, user };
  }
}
