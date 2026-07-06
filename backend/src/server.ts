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
});
