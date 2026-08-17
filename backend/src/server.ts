import 'dotenv/config';
import { createApp } from './app';
import { authSafetyWarnings, loadEnv, printAuthSafetyWarnings } from './config/env';
import { prisma } from './config/prisma';
import { verifyDatabaseSchema, verifyDefaultRole } from './config/startupCheck';
import { HttpLdapAuthClient, MockLdapAuthClient } from './auth/ldapClient';

const env = loadEnv();

const ldap =
  env.authMode === 'ldap'
    ? new HttpLdapAuthClient(env.ldapApiUrl)
    : new MockLdapAuthClient();

const app = createApp({ prisma, env, ldap });

async function start() {
  try {
    await verifyDatabaseSchema(prisma);
    await verifyDefaultRole(prisma, env.defaultRole);
  } catch {
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`[server] SSD Tracker backend listening on http://localhost:${env.port}/api`);
    console.log(`[server] NODE_ENV=${env.nodeEnv} AUTH_MODE=${env.authMode} AUTH_OPTIONAL=${env.authOptional}`);

    // One banner for both insecure-by-default auth settings — including the case
    // where the variable is simply ABSENT and falls into the dangerous default.
    printAuthSafetyWarnings(authSafetyWarnings());
  });
}

start();
