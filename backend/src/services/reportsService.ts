import type { PrismaClient } from '@prisma/client';
import { todayISO } from '../domain/constants';

// ─────────────────────────────────────────────────────────────────────────
// Weekly report — reconstructed ON DEMAND from the structured supplier history
// (no cron, no snapshot table). Every supplier is born with one history entry
// carrying its initial stage (see suppliersService.createSupplier), and every
// stage transition writes a history entry with fromStageId/toStageId, so the
// stage of any supplier on any date is "the toStageId of its latest history
// entry with date <= that date".
//
// DATE HANDLING — the `date` columns on SupplierHistoryEntry/SupplierNote are
// 'YYYY-MM-DD' strings; lexicographic comparison of that format is chronological,
// so it is used directly in the `date` where-clauses (business day the event
// belongs to). `createdAt` is a real DateTime and is used only for the notes
// window (the exact instant a note was written) — the two are never mixed.
// ─────────────────────────────────────────────────────────────────────────

interface StageSnapshotRow {
  commodityId: number;
  commodityName: string;
  stageId: number;
  stageName: string;
  count: number;
}

interface ReportMovement {
  supplierId: string;
  supplierName: string;
  commodityId: number;
  commodityName: string;
  /** null for the birth entry (nothing preceded the initial stage). */
  fromStage: string | null;
  toStage: string;
  date: string;
  note: string | null;
  user: string;
  role: string;
}

interface ReportNote {
  id: string;
  supplierId: string;
  supplierName: string;
  commodityId: number;
  commodityName: string;
  stage: string;
  text: string;
  author: string;
  role: string;
  date: string;
  /** ISO instant the note was written (from createdAt) — day + hour. */
  createdAt: string;
}

interface WeeklyDiff {
  from: string;
  to: string;
  snapshotFrom: StageSnapshotRow[];
  snapshotTo: StageSnapshotRow[];
  movements: ReportMovement[];
  notes: ReportNote[];
}

/**
 * Count of ACTIVE suppliers per (commodity, stage) as they stood on `asOfDateISO`.
 * A supplier's stage on that date is the toStageId of its latest history entry
 * with date <= asOf; a supplier whose earliest history entry is later than asOf
 * did not exist yet and is excluded. Terminal (BLACKLISTED/COMPLETED) suppliers
 * are excluded — this mirrors the rest of the system: the count is about the
 * currently-active pipeline.
 */
export async function getStageSnapshot(
  prisma: PrismaClient,
  asOfDateISO: string,
  commodityId?: number,
): Promise<StageSnapshotRow[]> {
  const suppliers = await prisma.supplier.findMany({
    where: {
      status: { is: { name: 'ACTIVE' } },
      ...(commodityId ? { commodityId } : {}),
    },
    select: { id: true, commodityId: true, commodity: { select: { name: true } } },
  });
  if (suppliers.length === 0) return [];

  // Only stage-defining entries carry toStageId; the latest one (by date, then
  // createdAt, then id as deterministic tie-breakers) is the stage on that date.
  const entries = await prisma.supplierHistoryEntry.findMany({
    where: {
      supplierId: { in: suppliers.map(s => s.id) },
      date: { lte: asOfDateISO },
      toStageId: { not: null },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { supplierId: true, toStageId: true, toStage: { select: { name: true } } },
  });

  const latestBySupplier = new Map<string, { stageId: number; stageName: string }>();
  for (const e of entries) {
    if (e.toStageId != null && e.toStage && !latestBySupplier.has(e.supplierId)) {
      latestBySupplier.set(e.supplierId, { stageId: e.toStageId, stageName: e.toStage.name });
    }
  }

  const groups = new Map<string, StageSnapshotRow>();
  for (const s of suppliers) {
    const latest = latestBySupplier.get(s.id);
    if (!latest) continue; // no history on/before asOf ⇒ didn't exist yet
    const key = `${s.commodityId}::${latest.stageId}`;
    const row = groups.get(key);
    if (row) {
      row.count += 1;
    } else {
      groups.set(key, {
        commodityId: s.commodityId,
        commodityName: s.commodity.name,
        stageId: latest.stageId,
        stageName: latest.stageName,
        count: 1,
      });
    }
  }
  return [...groups.values()];
}

/** Start-of-day (UTC) for a 'YYYY-MM-DD' string. */
function startOfDayUTC(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

/**
 * Week-over-week diff: the two stage snapshots, the stage transitions that
 * happened in (fromISO, toISO], and the notes written in that same window.
 */
export async function getWeeklyDiff(
  prisma: PrismaClient,
  fromISO: string,
  toISO: string,
  commodityId?: number,
): Promise<WeeklyDiff> {
  const [snapshotFrom, snapshotTo] = await Promise.all([
    getStageSnapshot(prisma, fromISO, commodityId),
    getStageSnapshot(prisma, toISO, commodityId),
  ]);

  // Movements: stage-defining history entries in the window. `toStageId not null`
  // automatically excludes the three non-transition history sources (patch
  // update, promote-to-B2B, sub-status change) — none of them set toStageId.
  const movementRows = await prisma.supplierHistoryEntry.findMany({
    where: {
      date: { gt: fromISO, lte: toISO },
      toStageId: { not: null },
      ...(commodityId ? { supplier: { is: { commodityId } } } : {}),
    },
    include: {
      supplier: { select: { name: true, commodityId: true, commodity: { select: { name: true } } } },
      fromStage: { select: { name: true } },
      toStage: { select: { name: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  const movements: ReportMovement[] = movementRows.map(m => ({
    supplierId: m.supplierId,
    supplierName: m.supplier.name,
    commodityId: m.supplier.commodityId,
    commodityName: m.supplier.commodity.name,
    fromStage: m.fromStage?.name ?? null,
    toStage: m.toStage?.name ?? '',
    date: m.date,
    note: m.note,
    user: m.user,
    role: m.role,
  }));

  // Notes: written between the start of `fromISO` and the end of `toISO`, by the
  // real instant they were saved (createdAt), inclusive of the whole `toISO` day.
  const notesStart = startOfDayUTC(fromISO);
  const notesEnd = startOfDayUTC(toISO);
  notesEnd.setUTCDate(notesEnd.getUTCDate() + 1); // exclusive upper bound = day after toISO

  const noteRows = await prisma.supplierNote.findMany({
    where: {
      createdAt: { gte: notesStart, lt: notesEnd },
      ...(commodityId ? { supplier: { is: { commodityId } } } : {}),
    },
    include: {
      supplier: { select: { name: true, commodityId: true, commodity: { select: { name: true } } } },
      stage: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const notes: ReportNote[] = noteRows.map(n => ({
    id: n.id,
    supplierId: n.supplierId,
    supplierName: n.supplier.name,
    commodityId: n.supplier.commodityId,
    commodityName: n.supplier.commodity.name,
    stage: n.stage.name,
    text: n.text,
    author: n.author,
    role: n.role,
    date: n.date,
    createdAt: n.createdAt.toISOString(),
  }));

  return { from: fromISO, to: toISO, snapshotFrom, snapshotTo, movements, notes };
}

/** Convenience: the last 7 days ending today. */
export async function getLatestWeeklyDiff(
  prisma: PrismaClient,
  commodityId?: number,
): Promise<WeeklyDiff> {
  const to = todayISO();
  const fromDate = startOfDayUTC(to);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  return getWeeklyDiff(prisma, from, to, commodityId);
}

/** Commodity catalog (id + name) for the report's optional commodity filter. */
export async function listReportCommodities(prisma: PrismaClient) {
  return prisma.commodity.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
