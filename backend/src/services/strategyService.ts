import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { COMMODITIES, todayISO } from '../domain/constants';
import { NotFoundError, ValidationError } from '../domain/errors';
import { supplierInclude, toSupplierDTO } from '../mappers/supplierMapper';
import { notifyTeam, summarizeChangedFields } from './notificationsService';
import type { AuthUser } from '../middleware/auth';

function toStrategyEntryDTO(e: Prisma.StrategyEntryGetPayload<{ include: { commodity: true } }>) {
  return {
    id: e.id,
    commodity: e.commodity.name,
    strategyNeeds: {
      '2026': e.needs2026,
      '2027': e.needs2027,
      '2028': e.needs2028,
      '2029': e.needs2029,
      '2030': e.needs2030,
      '2031': e.needs2031,
    },
    createdBy: e.createdBy,
    updatedAt: e.updatedAt,
  };
}

export async function getStrategyEntries(prisma: PrismaClient) {
  const rows = await prisma.strategyEntry.findMany({
    include: { commodity: true },
    orderBy: { id: 'asc' },
  });
  return rows.map(toStrategyEntryDTO);
}

interface StrategyNeedsPatch {
  '2026'?: number;
  '2027'?: number | null;
  '2028'?: number | null;
  '2029'?: number | null;
  '2030'?: number | null;
  '2031'?: number | null;
}

const NEED_YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'] as const;

/**
 * Rejects a need that is present but not a non-negative integer. The controller's
 * zod schema already covers the HTTP path; this keeps the rule enforced for any
 * other caller of these two functions.
 */
function assertValidNeeds(needs: StrategyNeedsPatch): void {
  for (const [year, value] of Object.entries(needs)) {
    if (value != null && (!Number.isInteger(value) || (value as number) < 0)) {
      throw new ValidationError(`Strategy need for ${year} must be a non-negative integer`);
    }
  }
}

/**
 * The six needs columns for the years this patch carries. `undefined` means "not
 * in this patch" and must NOT be written, which is why each year is spread
 * conditionally rather than assigned.
 */
function needsUpdateData(needs: StrategyNeedsPatch): Record<string, number | null> {
  const data: Record<string, number | null> = {};
  for (const year of NEED_YEARS) {
    const value = needs[year];
    if (value !== undefined) data[`needs${year}`] = value;
  }
  return data;
}

/**
 * `['necesidad 2026 → 15', 'necesidad 2027 → 8']` — one entry per year the save
 * actually writes (a year absent from the patch is untouched, not zeroed), so
 * the notification names exactly what moved.
 */
function describeNeeds(needs: StrategyNeedsPatch): string[] {
  return NEED_YEARS
    .filter(year => needs[year] !== undefined)
    .map(year => `necesidad ${year} → ${needs[year] ?? '—'}`);
}

/** One notification per strategy save, never one per year. */
async function notifyStrategySaved(
  prisma: PrismaClient,
  commodityName: string,
  changes: string[],
  actor: AuthUser,
  context: string,
) {
  if (changes.length === 0) return;
  try {
    await notifyTeam(prisma, {
      message: `${actor.displayName} actualizó la estrategia de ${commodityName}: `
        + summarizeChangedFields(changes),
      type: 'info',
      category: 'strategy_updated',
      link: '/strategy',
      excludeUserId: actor.id,
    });
  } catch (err) {
    console.error(`[notify] ${context} notification failed:`, err);
  }
}

/** Inline edit of strategy needs for one entry. */
export async function updateStrategyEntry(
  prisma: PrismaClient,
  id: string,
  needs: StrategyNeedsPatch,
  actor: AuthUser,
) {
  const existing = await prisma.strategyEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Strategy entry ${id} not found`);

  assertValidNeeds(needs);

  const row = await prisma.strategyEntry.update({
    where: { id },
    data: {
      ...needsUpdateData(needs),
      createdBy: actor.displayName,
      updatedAt: todayISO(),
    },
    include: { commodity: true },
  });

  await notifyStrategySaved(
    prisma, row.commodity.name, describeNeeds(needs), actor, 'updateStrategyEntry',
  );

  return toStrategyEntryDTO(row);
}

/**
 * Upsert strategy needs by commodity name. Unlike `updateStrategyEntry`, this can
 * create the entry for a commodity that has never had a need defined — the frontend
 * drilldown editor addresses entries by commodity, not by a (possibly absent) id.
 */
export async function upsertStrategyEntryByCommodity(
  prisma: PrismaClient,
  commodityName: string,
  needs: StrategyNeedsPatch,
  actor: AuthUser,
) {
  if (!COMMODITIES.includes(commodityName as (typeof COMMODITIES)[number])) {
    throw new NotFoundError(`Unknown commodity: ${commodityName}`);
  }
  const commodity = await prisma.commodity.findUnique({ where: { name: commodityName } });
  if (!commodity) throw new NotFoundError(`Commodity not in catalog: ${commodityName}`);

  assertValidNeeds(needs);

  const row = await prisma.strategyEntry.upsert({
    where: { commodityId: commodity.id },
    update: {
      ...needsUpdateData(needs),
      createdBy: actor.displayName,
      updatedAt: todayISO(),
    },
    create: {
      id: `strat-${randomUUID()}`,
      commodityId: commodity.id,
      needs2026: needs['2026'] ?? 0,
      needs2027: needs['2027'] ?? null,
      needs2028: needs['2028'] ?? null,
      needs2029: needs['2029'] ?? null,
      needs2030: needs['2030'] ?? null,
      needs2031: needs['2031'] ?? null,
      createdBy: actor.displayName,
      updatedAt: todayISO(),
    },
    include: { commodity: true },
  });

  await notifyStrategySaved(
    prisma, row.commodity.name, describeNeeds(needs), actor, 'upsertStrategyEntryByCommodity',
  );

  return toStrategyEntryDTO(row);
}

/**
 * Commodity overview (CommodityStrategyRow[]); mirrors the StrategyPage.tsx algorithm.
 *
 * FASE-3B: auditoría §2.5.7 — carga todos los proveedores ACTIVE/COMPLETED con sus
 * relaciones sin paginación, y `getCommodityDrilldown` vuelve a llamar aquí y luego
 * consulta otra vez. Igual que homeService: optimización pendiente de medición, no
 * se toca en Fase 3.A.
 */
export async function getStrategyOverview(prisma: PrismaClient) {
  const [entries, suppliers] = await Promise.all([
    prisma.strategyEntry.findMany({ include: { commodity: true } }),
    prisma.supplier.findMany({
      where: { status: { is: { name: { in: ['ACTIVE', 'COMPLETED'] } } } },
      include: { commodity: true, stage: true, intelexData: true },
    }),
  ]);

  return COMMODITIES.map(commodity => {
    const entry = entries.find(e => e.commodity.name === commodity);
    const inCommodity = suppliers.filter(s => s.commodity.name === commodity);

    const stageGroups = new Map<string, number[]>();
    for (const s of inCommodity) {
      const arr = stageGroups.get(s.stage.name) ?? [];
      arr.push(s.daysInStage);
      stageGroups.set(s.stage.name, arr);
    }
    const stages = [...stageGroups.entries()].map(([stageName, days]) => ({
      stageName,
      count: days.length,
      avgDaysInStage: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    }));

    const reserved = inCommodity.filter(s => s.stage.name === 'Parking Lot').length;
    const achieved = inCommodity.filter(
      s => s.stage.name === 'Completed' ||
        (s.stage.name === 'Intelex Handoff' && s.intelexData?.l2Real != null),
    ).length;
    const total = inCommodity.length;
    const inProgress = total - reserved - achieved;
    const need = entry?.needs2026 ?? 0;

    return {
      commodity,
      strategyNeeds2026: need,
      strategyNeeds2027: entry?.needs2027 ?? 0,
      totalInTracker: total,
      reserved,
      inProgress,
      achieved,
      remaining: need > 0 ? Math.max(0, need - achieved) : 0,
      stages,
      entryId: entry?.id ?? null,
      updatedAt: entry?.updatedAt ?? null,
    };
  });
}

/** Drilldown: overview row + the suppliers behind it. */
export async function getCommodityDrilldown(prisma: PrismaClient, commodity: string) {
  if (!COMMODITIES.includes(commodity as (typeof COMMODITIES)[number])) {
    throw new NotFoundError(`Unknown commodity: ${commodity}`);
  }
  const overview = await getStrategyOverview(prisma);
  const row = overview.find(r => r.commodity === commodity);
  const suppliers = await prisma.supplier.findMany({
    where: {
      status: { is: { name: { in: ['ACTIVE', 'COMPLETED'] } } },
      commodity: { is: { name: commodity } },
    },
    include: supplierInclude,
    orderBy: { folio: 'asc' },
  });
  return { ...row, suppliers: suppliers.map(toSupplierDTO) };
}
