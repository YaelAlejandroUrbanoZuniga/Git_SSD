import type { PrismaClient } from '@prisma/client';
import { resolveSla } from '../domain/sla';
import type { SupplierWithRelations } from '../mappers/supplierMapper';

/**
 * Reconciles the persisted SLA (FK_Sla / FK_GlobalSla) and the two day counters
 * (DaysInStage / DaysSinceParkingLot) of supplier rows that have just been read,
 * and returns those rows with the fresh values applied.
 *
 * DaysInStage is reconciled for **all 5 active stages**, not only the two with an
 * SLA threshold: it is the number the board and the detail page display, and as a
 * write-once column it froze at whatever the seed/import/last stage move left
 * behind. It is derived from the stage's anchor date exactly like the colour is.
 *
 * This is the single recalculation point: every read path calls it right before
 * mapping to the DTO, and every write path returns through a read path, so a
 * write can never leave a stale colour behind either.
 *
 * The colour is derived from stage anchor dates (see domain/sla.ts), which means
 * it advances with the calendar. Persisting it here — rather than in a nightly
 * job the project does not have — is what keeps FK_Sla usable as the source of
 * truth for clients that read the column directly.
 *
 * Writes only happen for rows whose stored value actually disagrees with the
 * derived one, so a board that is already correct costs zero extra queries.
 * Terminal suppliers (blacklisted / completed) are skipped: their clock stopped
 * when they left the tracker, and the colour at exit is part of the record.
 */
export async function syncSuppliersSla(
  prisma: PrismaClient,
  rows: SupplierWithRelations[],
  now: Date = new Date(),
): Promise<SupplierWithRelations[]> {
  const pending = rows.flatMap(row => {
    if (row.status.name !== 'ACTIVE') return [];

    const resolved = resolveSla(
      {
        stage: row.stage.name,
        parkingOnboardingDate: row.parkingData?.onboardingDate,
        preliminaryStartDate: row.preliminaryData?.startDate,
        stageEnteredAt: row.stageEnteredAt ? row.stageEnteredAt.toISOString() : null,
        intelexRecordCreationDate: row.intelexData?.recordCreationDate ?? null,
        onboardingDate: row.onboardingDate,
        daysInStage: row.daysInStage,
        daysSinceParkingLot: row.daysSinceParkingLot,
      },
      now,
    );
    // A null resolution means "no confirmed threshold" — keep what's there.
    const sla = resolved.sla ?? row.sla.name;
    const globalSla = resolved.globalSla ?? row.globalSla?.name ?? null;

    const changed =
      sla !== row.sla.name ||
      globalSla !== (row.globalSla?.name ?? null) ||
      resolved.daysInStage !== row.daysInStage ||
      resolved.daysSinceParkingLot !== row.daysSinceParkingLot;

    return changed
      ? [{
          row,
          sla,
          globalSla,
          daysInStage: resolved.daysInStage,
          daysSinceParkingLot: resolved.daysSinceParkingLot,
        }]
      : [];
  });

  if (pending.length === 0) return rows;

  const catalog = new Map((await prisma.sla.findMany()).map(s => [s.name, s]));
  const writes = [];

  for (const { row, sla, globalSla, daysInStage, daysSinceParkingLot } of pending) {
    const slaRef = catalog.get(sla);
    const globalRef = globalSla === null ? null : catalog.get(globalSla);
    // Catalog miss (C_Sla unseeded) — skip rather than write a dangling FK.
    if (!slaRef || (globalSla !== null && !globalRef)) continue;

    writes.push(
      prisma.supplier.update({
        where: { id: row.id },
        data: { slaId: slaRef.id, globalSlaId: globalRef?.id ?? null, daysInStage, daysSinceParkingLot },
      }),
    );
    // Apply to the loaded row so the mapper emits the new values without a re-read.
    row.slaId = slaRef.id;
    row.sla = slaRef;
    row.globalSlaId = globalRef?.id ?? null;
    row.globalSla = globalRef ?? null;
    row.daysInStage = daysInStage;
    row.daysSinceParkingLot = daysSinceParkingLot;
  }

  if (writes.length > 0) await prisma.$transaction(writes);
  return rows;
}

/** Convenience wrapper for the single-row read paths. */
export async function syncSupplierSla(
  prisma: PrismaClient,
  row: SupplierWithRelations,
  now: Date = new Date(),
): Promise<SupplierWithRelations> {
  const [synced] = await syncSuppliersSla(prisma, [row], now);
  return synced;
}
