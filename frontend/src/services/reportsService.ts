import { apiGet } from './api.config';

// Wire shapes — mirror backend/src/services/reportsService.ts exactly.

export interface StageSnapshotRow {
  commodityId: number;
  commodityName: string;
  stageId: number;
  stageName: string;
  count: number;
}

export interface ReportMovement {
  supplierId: string;
  supplierName: string;
  commodityId: number;
  commodityName: string;
  /** null for a supplier's birth entry (nothing preceded the initial stage). */
  fromStage: string | null;
  toStage: string;
  date: string;
  note: string | null;
  user: string;
  role: string;
}

export interface ReportNote {
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
  /** ISO instant the note was written — day + hour. */
  createdAt: string;
}

export interface WeeklyReport {
  from: string;
  to: string;
  snapshotFrom: StageSnapshotRow[];
  snapshotTo: StageSnapshotRow[];
  movements: ReportMovement[];
  notes: ReportNote[];
}

export interface ReportCommodity {
  id: number;
  name: string;
}

function withCommodity(base: string, commodityId?: number): string {
  const params = new URLSearchParams();
  const [path, existing] = base.split('?');
  if (existing) for (const [k, v] of new URLSearchParams(existing)) params.set(k, v);
  if (commodityId != null) params.set('commodityId', String(commodityId));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Week-over-week diff for an explicit date range. */
export function getWeeklyReport(from: string, to: string, commodityId?: number): Promise<WeeklyReport> {
  const params = new URLSearchParams({ from, to });
  if (commodityId != null) params.set('commodityId', String(commodityId));
  return apiGet(`/reports/weekly?${params.toString()}`);
}

/** Convenience: the last 7 days ending today (backend computes the range). */
export function getLatestWeeklyReport(commodityId?: number): Promise<WeeklyReport> {
  return apiGet(withCommodity('/reports/weekly/latest', commodityId));
}

/** Commodity catalog (id + name) for the optional filter. */
export function getReportCommodities(): Promise<ReportCommodity[]> {
  return apiGet('/reports/commodities');
}
