import type { PrismaClient } from '@prisma/client';
import { TRACKER_STAGE_CONFIG } from '../domain/constants';

/**
 * Aggregated, ANONYMOUS home summary — the only supplier-derived endpoint the
 * 'Guest' role can reach. It MUST NOT leak any individual supplier identity
 * (name, folio, company, id); its aggregate shape IS the security boundary.
 */
export async function getHomeSummary(prisma: PrismaClient) {
  const [suppliers, events] = await Promise.all([
    prisma.supplier.findMany({
      include: { status: true, stage: true, commodity: true, productCategory: true },
    }),
    prisma.event.findMany({
      where: { status: { in: ['Upcoming', 'Ongoing'] } },
      orderBy: { dateStart: 'asc' },
    }),
  ]);

  // Stage counts: ACTIVE + Direct only, per working stage (same business filter
  // as trackerService.listByStage, minus the terminal statuses).
  const stageCounts = TRACKER_STAGE_CONFIG.map(cfg => ({
    stage: cfg.name,
    color: cfg.color,
    count: suppliers.filter(
      s =>
        s.status.name === 'ACTIVE' &&
        s.productCategory.name === 'Direct' &&
        s.stage.name === cfg.name,
    ).length,
  }));

  // Top commodities over ALL suppliers (tracker + blacklisted + completed),
  // mirroring buildHomeData in the frontend Inicio.tsx.
  const commodityCounts = new Map<string, number>();
  for (const s of suppliers) {
    commodityCounts.set(s.commodity.name, (commodityCounts.get(s.commodity.name) ?? 0) + 1);
  }
  const topCommodities = [...commodityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([commodity, count]) => ({ commodity, count }));

  const totalActive = suppliers.filter(s => s.status.name === 'ACTIVE').length;
  const totalCompleted = suppliers.filter(s => s.status.name === 'COMPLETED').length;
  const totalBlacklisted = suppliers.filter(s => s.status.name === 'BLACKLISTED').length;

  const upcomingEvents = events.slice(0, 3).map(e => ({
    id: e.id,
    name: e.name,
    dateStart: e.dateStart,
    location: e.location,
  }));

  return {
    stageCounts,
    topCommodities,
    totalActive,
    totalCompleted,
    totalBlacklisted,
    upcomingEvents,
  };
}
