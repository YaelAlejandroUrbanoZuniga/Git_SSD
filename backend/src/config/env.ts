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
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    port: Number(source.PORT ?? 3000),
    corsOrigin: (source.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()),
    jwtSecret: source.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
    jwtExpiresInSeconds: Number(source.JWT_EXPIRES_IN ?? 900),
    refreshExpiresDays: Number(source.REFRESH_EXPIRES_DAYS ?? 7),
    authMode: source.AUTH_MODE === 'ldap' ? 'ldap' : 'mock',
    authOptional: (source.AUTH_OPTIONAL ?? 'true').toLowerCase() !== 'false',
    ldapApiUrl: source.LDAP_API_URL ?? 'http://localhost:8000',
    ldapApiKey: source.LDAP_API_KEY ?? '',
  };
}
