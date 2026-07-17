import type { Prisma, PrismaClient } from '@prisma/client';
import { COMMODITIES, todayISO } from '../domain/constants';
import { NotFoundError, ValidationError } from '../domain/errors';

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

export interface StrategyNeedsPatch {
  '2026'?: number;
  '2027'?: number | null;
  '2028'?: number | null;
  '2029'?: number | null;
  '2030'?: number | null;
  '2031'?: number | null;
}

/** Inline edit of strategy needs for one entry. */
export async function updateStrategyEntry(
  prisma: PrismaClient,
  id: string,
  needs: StrategyNeedsPatch,
  actorName: string,
) {
  const existing = await prisma.strategyEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Strategy entry ${id} not found`);

  for (const [year, value] of Object.entries(needs)) {
    if (value != null && (!Number.isInteger(value) || (value as number) < 0)) {
      throw new ValidationError(`Strategy need for ${year} must be a non-negative integer`);
    }
  }

  const row = await prisma.strategyEntry.update({
    where: { id },
    data: {
      ...(needs['2026'] !== undefined ? { needs2026: needs['2026'] } : {}),
      ...(needs['2027'] !== undefined ? { needs2027: needs['2027'] } : {}),
      ...(needs['2028'] !== undefined ? { needs2028: needs['2028'] } : {}),
      ...(needs['2029'] !== undefined ? { needs2029: needs['2029'] } : {}),
      ...(needs['2030'] !== undefined ? { needs2030: needs['2030'] } : {}),
      ...(needs['2031'] !== undefined ? { needs2031: needs['2031'] } : {}),
      createdBy: actorName,
      updatedAt: todayISO(),
    },
    include: { commodity: true },
  });
  return toStrategyEntryDTO(row);
}

/** Commodity overview (CommodityStrategyRow[]); mirrors the StrategyPage.tsx algorithm. */
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
  const { supplierInclude, toSupplierDTO } = await import('../mappers/supplierMapper');
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
