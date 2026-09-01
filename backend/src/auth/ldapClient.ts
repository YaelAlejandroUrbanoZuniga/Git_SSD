// Abstraction over the external FastAPI/LDAP3 credential-validation service.
// Two security issues in that service (unencrypted LDAP on port 389, and its
// hardcoded API_KEY) are neither fixable from here nor pending work on this
// file — they are registered as entry 4 in backend/DEBT.md.

export interface LdapUserInfo {
  username: string;
  displayName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  supervisorName: string | null;
  employeeNumber: string | null;
  /**
   * Active Directory objectGUID. The deployed FastAPI/LDAP service does NOT
   * return it (its /auth/login response has no such field), so this is always
   * null today. Kept in the shape for when a future service revision provides it.
   */
  adObjectId: string | null;
}

interface LdapAuthResult {
  ok: boolean;
  user?: LdapUserInfo;
  error?: string;
}

export interface LdapAuthClient {
  /** Validates credentials. Callers MUST discard the password immediately after. */
  validate(username: string, password: string): Promise<LdapAuthResult>;
}

/** Shape of the deployed service's POST /auth/login response body. */
interface LoginResponseBody {
  success?: boolean;
  message?: string;
  user?: {
    employee_number?: string | null;
    name?: string | null;
    email?: string | null;
    department?: string | null;
    job_title?: string | null;
    supervisor_name?: string | null;
    netid?: string | null;
  } | null;
}

const REQUEST_TIMEOUT_MS = 10_000;

/** netid fallback: local part of the typed username, lowercased, no @nexteer.com. */
function fallbackNetid(typedUsername: string): string {
  return typedUsername.trim().toLowerCase().replace(/@nexteer\.com$/i, '');
}

/** Calls the real FastAPI/LDAP service. React never talks to it directly. */
export class HttpLdapAuthClient implements LdapAuthClient {
  constructor(private baseUrl: string) {}

  async validate(username: string, password: string): Promise<LdapAuthResult> {
    // The service always answers 200 OK — even on auth failure — so success is
    // discriminated by the body's `success` flag, never by res.ok/status.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let body: LoginResponseBody;
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NEVER log this body — it carries the plaintext password.
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      body = (await res.json()) as LoginResponseBody;
    } catch {
      // Timeout (AbortError) or any network/parse error — never leak a raw throw.
      return { ok: false, error: 'LDAP service unreachable' };
    } finally {
      clearTimeout(timeout);
    }

    if (!body.success || !body.user) {
      // body.message carries the detail but is not surfaced to the client.
      return { ok: false, error: 'Invalid credentials' };
    }

    const u = body.user;
    // An empty-string netid must fall back too (?? only guards null/undefined).
    const rawNetid = u.netid?.trim();
    const netid = rawNetid ? rawNetid : fallbackNetid(username);
    return {
      ok: true,
      user: {
        username: netid,
        displayName: u.name ?? netid,
        email: u.email ?? null,
        department: u.department ?? null,
        jobTitle: u.job_title ?? null,
        supervisorName: u.supervisor_name ?? null,
        employeeNumber: u.employee_number ?? null,
        adObjectId: null, // service does not provide objectGUID
      },
    };
  }
}

/** Mock LDAP client (AUTH_MODE=mock): fixed users, shared password "password". */
export class MockLdapAuthClient implements LdapAuthClient {
  static readonly PASSWORD = 'password';

  private users: Record<string, LdapUserInfo> = {
    'yael.urbano': {
      username: 'yael.urbano',
      displayName: 'Yael Urbano',
      email: 'y.urbano@nexteer.com',
      department: 'Strategic Sourcing Development',
      jobTitle: 'SSD Engineer',
      supervisorName: 'Vianey Perea',
      employeeNumber: '100001',
      adObjectId: null,
    },
    'carlos.mendoza': {
      username: 'carlos.mendoza',
      displayName: 'Carlos Mendoza',
      email: 'c.mendoza@nexteer.com',
      department: 'Program Management',
      jobTitle: 'Program Manager',
      supervisorName: 'Vianey Perea',
      employeeNumber: '100002',
      adObjectId: null,
    },
    'ana.garcia': {
      username: 'ana.garcia',
      displayName: 'Ana García',
      email: 'a.garcia@nexteer.com',
      department: 'Purchasing',
      jobTitle: 'Buyer',
      supervisorName: 'Itzel Campos',
      employeeNumber: '100003',
      adObjectId: null,
    },
    'roberto.sanchez': {
      username: 'roberto.sanchez',
      displayName: 'Roberto Sánchez',
      email: 'r.sanchez@nexteer.com',
      department: 'Supplier Quality',
      // AD job title, not the app role — kept independent of the `SDE` app role name.
      jobTitle: 'SDE Engineer',
      supervisorName: 'Lorena Luna',
      employeeNumber: '100004',
      adObjectId: null,
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
