import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { LdapAuthClient } from '../auth/ldapClient';

/** Dependency container injected into controllers/routes (and tests). */
export interface Deps {
  prisma: PrismaClient;
  env: AppEnv;
  ldap: LdapAuthClient;
}
