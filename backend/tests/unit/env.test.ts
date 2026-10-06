import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const BASE_SOURCE: NodeJS.ProcessEnv = {
  JWT_SECRET: 'a-real-secret',
  LDAP_API_URL: 'https://ldap.example.com',
};

describe('loadEnv — production auth safety', () => {
  it('throws naming AUTH_MODE when NODE_ENV=production and AUTH_MODE is not "ldap"', () => {
    expect(() =>
      loadEnv({ ...BASE_SOURCE, NODE_ENV: 'production', AUTH_OPTIONAL: 'false' }),
    ).toThrow(/AUTH_MODE/);
  });

  it('throws naming AUTH_OPTIONAL when NODE_ENV=production and AUTH_OPTIONAL is not "false"', () => {
    expect(() =>
      loadEnv({ ...BASE_SOURCE, NODE_ENV: 'production', AUTH_MODE: 'ldap' }),
    ).toThrow(/AUTH_OPTIONAL/);
  });

  it('starts normally when NODE_ENV=production, AUTH_MODE=ldap, AUTH_OPTIONAL=false', () => {
    const env = loadEnv({
      ...BASE_SOURCE,
      NODE_ENV: 'production',
      AUTH_MODE: 'ldap',
      AUTH_OPTIONAL: 'false',
    });
    expect(env.authMode).toBe('ldap');
    expect(env.authOptional).toBe(false);
  });

  it('does not throw for unsafe AUTH_MODE/AUTH_OPTIONAL outside production', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(() => loadEnv({ ...BASE_SOURCE, NODE_ENV: nodeEnv })).not.toThrow();
      const env = loadEnv({ ...BASE_SOURCE, NODE_ENV: nodeEnv });
      expect(env.authMode).toBe('mock');
      expect(env.authOptional).toBe(true);
    }
  });
});
