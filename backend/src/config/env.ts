export interface AppEnv {
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
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const authMode: 'mock' | 'ldap' = source.AUTH_MODE === 'ldap' ? 'ldap' : 'mock';

  // No hardcoded default: a real service URL must come from the environment. We
  // only enforce its presence in ldap mode (mock mode never calls the service).
  const ldapApiUrl = source.LDAP_API_URL ?? '';
  if (authMode === 'ldap' && !ldapApiUrl.trim()) {
    throw new Error('LDAP_API_URL is required when AUTH_MODE=ldap');
  }

  return {
    port: Number(source.PORT ?? 3000),
    corsOrigin: (source.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
    jwtSecret: source.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
    jwtExpiresInSeconds: Number(source.JWT_EXPIRES_IN ?? 900),
    refreshExpiresDays: Number(source.REFRESH_EXPIRES_DAYS ?? 7),
    authMode,
    authOptional: (source.AUTH_OPTIONAL ?? 'true').toLowerCase() !== 'false',
    ldapApiUrl,
    ldapApiKey: source.LDAP_API_KEY ?? '',
    defaultRole: source.DEFAULT_APP_ROLE ?? 'Default',
  };
}
