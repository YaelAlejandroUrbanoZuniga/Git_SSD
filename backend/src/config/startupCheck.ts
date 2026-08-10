import { Prisma, PrismaClient } from '@prisma/client';
import { supplierInclude } from '../mappers/supplierMapper';

// Models with a real history of schema.prisma / database drift (P2022 in
// production because a column existed in the model but not yet in the
// connected database — see backend/sql/README.md). Not an exhaustive schema
// check across all 36 tables, just the ones that have already broken once.
const checks: Array<{ model: string; run: (prisma: PrismaClient) => Promise<unknown> }> = [
  {
    model: 'Supplier',
    run: (prisma) => prisma.supplier.findFirst({ include: supplierInclude }),
  },
  {
    model: 'Notification',
    run: (prisma) => prisma.notification.findFirst({ select: { id: true, category: true } }),
  },
  {
    model: 'SupplierEvalData',
    run: (prisma) =>
      prisma.supplierEvalData.findFirst({ select: { supplierId: true, costModel: true, tabVisit: true } }),
  },
];

/**
 * Runs a minimal read against every model known to have drifted between
 * schema.prisma and a real database before, so a missing-column error surfaces
 * at startup with a clear message instead of the first time a user opens the
 * affected screen.
 */
export async function verifyDatabaseSchema(prisma: PrismaClient): Promise<void> {
  for (const check of checks) {
    try {
      await check.run(prisma);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2022') {
        console.error(
          `[startup] Database schema mismatch on model "${check.model}": ${err.message}\n` +
            `[startup] The connected database does not match schema.prisma — review the pending scripts in backend/sql/ (see backend/sql/README.md).`,
        );
      } else {
        console.error(`[startup] Database schema check failed on model "${check.model}":`, err);
      }
      throw err;
    }
  }
}
