import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { prisma } from './config/prisma';
import { HttpLdapAuthClient, MockLdapAuthClient } from './auth/ldapClient';

const env = loadEnv();

const ldap =
  env.authMode === 'ldap'
    ? new HttpLdapAuthClient(env.ldapApiUrl, env.ldapApiKey)
    : new MockLdapAuthClient();

const app = createApp({ prisma, env, ldap });

app.listen(env.port, () => {
  console.log(`[server] SSD Pipeline backend listening on http://localhost:${env.port}/api`);
  console.log(`[server] AUTH_MODE=${env.authMode} AUTH_OPTIONAL=${env.authOptional}`);

  // Loud, unmissable warning: with AUTH_OPTIONAL=true every unauthenticated
  // request is silently attributed to the demo user (see middleware/auth.ts).
  // This is a local-development convenience only — never appropriate for a
  // shared or production environment.
  if (env.authOptional) {
    const banner = '!'.repeat(70);
    console.warn(banner);
    console.warn('! AUTH_OPTIONAL=true — running WITHOUT mandatory authentication.');
    console.warn('! All unauthenticated requests are attributed to the demo user.');
    console.warn('! DO NOT use this mode in any shared or production environment.');
    console.warn(banner);
  }
});
