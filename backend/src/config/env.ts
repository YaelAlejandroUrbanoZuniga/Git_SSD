export interface AppEnv {
  /** 'development' | 'production' | 'test' — free-form, defaults to 'development'. */
  nodeEnv: string;
  port: number;
  corsOrigin: string[];
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  refreshExpiresDays: number;
  authMode: 'mock' | 'ldap';
  authOptional: boolean;
  ldapApiUrl: string;
  ldapApiKey: string;
  /** Role assigned to a brand-new user on first login (least privilege). */
  defaultRole: string;
  /**
   * Shared secret Power Automate sends as `x-form-intake-key` on
   * POST /api/public/form-intake — the ONLY credential that route has, since it
   * is mounted before `authenticate()` and never sees a JWT. Empty string when
   * the variable is absent or blank, which the route reads as "the integration
   * is not configured" and answers 503 to. There is deliberately no fallback to
   * "no auth": that would turn a forgotten variable into a public,
   * unauthenticated write endpoint.
   */
  formIntakeSecret: string;
}

/**
 * The literal placeholder shipped in `.env.example`. A JWT signing key anyone
 * with repo access can read is not a secret: with it, a forged token can claim
 * the SSD (master) role. Startup is refused outright rather than warned about.
 */
const PLACEHOLDER_JWT_SECRET = 'change-me-in-production';

/**
 * The literal placeholder shown (commented out) in `.env.example`. Same reasoning
 * as PLACEHOLDER_JWT_SECRET: a value published in the repository is not a secret,
 * and this one would let anyone POST supplier registrations into the tracker.
 */
const PLACEHOLDER_FORM_INTAKE_SECRET = 'change-me-form-intake-secret';

/**
 * `Number()` turns anything unparseable into NaN and every consumer then fails
 * somewhere far away and confusingly: `app.listen(NaN)` binds a random port,
 * a NaN `JWT_EXPIRES_IN` throws inside `jwt.sign` on every login, and a NaN
 * `REFRESH_EXPIRES_DAYS` writes an Invalid Date to the database. Fail here,
 * naming the offending variable, instead.
 */
function numberFromEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number — got "${raw}". Fix it in the environment before starting the server.`);
  }
  return value;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const authMode: 'mock' | 'ldap' = source.AUTH_MODE === 'ldap' ? 'ldap' : 'mock';

  // No hardcoded default: a real service URL must come from the environment. We
  // only enforce its presence in ldap mode (mock mode never calls the service).
  const ldapApiUrl = source.LDAP_API_URL ?? '';
  if (authMode === 'ldap' && !ldapApiUrl.trim()) {
    throw new Error('LDAP_API_URL is required when AUTH_MODE=ldap');
  }

  const jwtSecret = source.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod';
  // Unconditional: no environment flag can make the public placeholder acceptable.
  if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
    throw new Error(
      `JWT_SECRET is still the placeholder "${PLACEHOLDER_JWT_SECRET}" copied from .env.example. `
      + 'That value is public in the repository, so anyone could sign a token claiming the SSD role. '
      + 'Generate a real secret (e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`) and set JWT_SECRET before starting the server.',
    );
  }

  // Absent/blank is a supported state (the form-intake route then answers 503 to
  // everything), but a value copied verbatim out of .env.example is not.
  const formIntakeSecret = (source.FORM_INTAKE_SECRET ?? '').trim();
  if (formIntakeSecret === PLACEHOLDER_FORM_INTAKE_SECRET) {
    throw new Error(
      `FORM_INTAKE_SECRET is still the placeholder "${PLACEHOLDER_FORM_INTAKE_SECRET}" copied from .env.example. `
      + 'That value is public in the repository, so anyone could POST supplier registrations to '
      + '/api/public/form-intake. Generate a real one (same recipe as JWT_SECRET above) and set '
      + 'FORM_INTAKE_SECRET, or remove the variable entirely to leave the endpoint disabled (503).',
    );
  }

  const nodeEnv = source.NODE_ENV ?? 'development';
  const authOptional = (source.AUTH_OPTIONAL ?? 'true').toLowerCase() !== 'false';

  // Unconditional in production: the mock LDAP client and the demo-user
  // fallback are the two settings whose *default* is the dangerous value (see
  // authSafetyWarnings below), so a shared/production deployment must not be
  // allowed to boot with either one — a warning banner is not enough there.
  if (nodeEnv === 'production' && authMode !== 'ldap') {
    throw new Error(
      `AUTH_MODE="${source.AUTH_MODE ?? ''}" is not the required value "ldap". `
      + 'In production, credentials MUST be checked against Active Directory — the mock client '
      + '(four hardcoded users sharing the password "password") is not acceptable. Set AUTH_MODE=ldap before starting the server.',
    );
  }
  if (nodeEnv === 'production' && authOptional !== false) {
    throw new Error(
      `AUTH_OPTIONAL="${source.AUTH_OPTIONAL ?? ''}" does not resolve to the required value "false". `
      + 'In production, every request without a token would otherwise be attributed to the demo user, '
      + 'who holds the SSD (master) role. Set AUTH_OPTIONAL=false before starting the server.',
    );
  }

  return {
    nodeEnv,
    port: numberFromEnv('PORT', source.PORT, 3000),
    corsOrigin: (source.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
    jwtSecret,
    jwtExpiresInSeconds: numberFromEnv('JWT_EXPIRES_IN', source.JWT_EXPIRES_IN, 900),
    refreshExpiresDays: numberFromEnv('REFRESH_EXPIRES_DAYS', source.REFRESH_EXPIRES_DAYS, 7),
    authMode,
    authOptional,
    ldapApiUrl,
    ldapApiKey: source.LDAP_API_KEY ?? '',
    defaultRole: source.DEFAULT_APP_ROLE ?? 'Guest',
    formIntakeSecret,
  };
}

/**
 * The two settings whose *default* is the dangerous value: an absent AUTH_MODE
 * silently selects the mock LDAP client (four fixed users, shared password
 * "password") and an absent AUTH_OPTIONAL attributes every tokenless request to
 * the demo user with the SSD master role. Reported from the raw source — not
 * from the parsed AppEnv — precisely so an ABSENT variable is as loud as an
 * explicitly dangerous one, which is the case §2.6.1 and §2.7.2 are about.
 *
 * Kept out of `loadEnv` so building an env in tests stays silent; `server.ts`
 * calls it once at startup.
 */
export function authSafetyWarnings(source: NodeJS.ProcessEnv = process.env): string[] {
  const warnings: string[] = [];

  if (source.AUTH_MODE === undefined) {
    warnings.push(
      'AUTH_MODE is not set — falling back to "mock". Credentials are NOT checked against '
      + 'Active Directory: four hardcoded users share the password "password". Production MUST set AUTH_MODE=ldap.',
    );
  } else if (source.AUTH_MODE !== 'ldap' && source.AUTH_MODE !== 'mock') {
    warnings.push(
      `AUTH_MODE="${source.AUTH_MODE}" is not a recognised value. Anything other than the exact string `
      + '"ldap" selects the MOCK client, so this silently disables Active Directory. Production MUST set AUTH_MODE=ldap.',
    );
  }

  if (source.AUTH_OPTIONAL === undefined) {
    warnings.push(
      'AUTH_OPTIONAL is not set — falling back to "true". Every request WITHOUT a token is attributed '
      + 'to the demo user, who holds the SSD (master) role. Production MUST set AUTH_OPTIONAL=false.',
    );
  } else if (source.AUTH_OPTIONAL.toLowerCase() !== 'false') {
    warnings.push(
      `AUTH_OPTIONAL="${source.AUTH_OPTIONAL}" resolves to TRUE (only the exact string "false" disables it). `
      + 'Every request without a token is attributed to the demo user, who holds the SSD (master) role. '
      + 'Production MUST set AUTH_OPTIONAL=false.',
    );
  }

  return warnings;
}

/** Prints `authSafetyWarnings` as one unmissable block; a no-op when there are none. */
export function printAuthSafetyWarnings(warnings: string[]): void {
  if (warnings.length === 0) return;
  const banner = '!'.repeat(78);
  console.warn(banner);
  console.warn('! INSECURE AUTH CONFIGURATION — do NOT use in a shared or production environment.');
  for (const warning of warnings) {
    console.warn(`! ${warning}`);
  }
  console.warn(banner);
}
