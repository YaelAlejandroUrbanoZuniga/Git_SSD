// Shared shape of the Visuals downloads — the header "Export report" and each
// card's own download. `pages/Dashboard.tsx` assembles one `VisualsReport` from
// the same period- and card-filtered arrays that feed its charts, and the two
// writers (`visualsReportExcel.ts`, `visualsReportPdf.ts`) only format it —
// neither recomputes a figure, so both files always match the screen. A
// single-card export is the same report with one `ReportSectionKey` picked out.
// This module is deliberately library-free: it is imported statically, while
// `exceljs` / `jspdf` are loaded on demand inside the writers.

import { needBand } from './strategy-helpers';

/** The page-wide Period as the user sees it: option label + rendered range. */
export interface ReportPeriod { label: string; display: string }

/** One active card filter, e.g. `{ label: 'Buyer', value: 'Itzel Campos' }`. */
export interface ReportFilter { label: string; value: string }

/**
 * What produced one section's numbers: the card's active filters as data, and
 * the sentence every export prints above that section's chart/table.
 */
export interface SectionScope {
  filters: ReportFilter[];
  /** 'Period: This year (1 Jan – 25 Sep 2026) · Commodity: Stampings · Buyer: Itzel Campos'. */
  summary: string;
  /** Extra caveat printed under the summary (Strategy: "Need" ignores the period). */
  note?: string;
}

/** Builds a `SectionScope`; with no card filters the sentence ends in 'No filters applied'. */
export function describeScope(period: ReportPeriod, filters: ReportFilter[], note?: string): SectionScope {
  const parts = filters.length > 0 ? filters.map(f => `${f.label}: ${f.value}`) : ['No filters applied'];
  return { filters, summary: [`Period: ${period.label} (${period.display})`, ...parts].join(' · '), ...(note ? { note } : {}) };
}

export interface ReportStage { name: string; count: number; color: string }
export interface ReportCommodity { name: string; value: number; color: string }
export interface ReportCountry { name: string; count: number }
export interface ReportEventStatus { name: string; value: number; color: string }
export interface ReportConversion { name: string; evaluated: number; included: number; pct: number }
/**
 * One row of "Strategy: Need vs. Achieved by Commodity". `kind` says how the
 * row reads: `target` is a real commodity with a 2026 need (a progress bar),
 * `noTarget` one with suppliers but no 2026 need (a plain count), and
 * `pending` the "TBD -- Pending GSM" bucket — suppliers awaiting a commodity,
 * never a strategy target.
 */
export interface ReportStrategyRow {
  commodity: string;
  kind: 'target' | 'noTarget' | 'pending';
  /** 2026 need; 0 for `noTarget` and `pending`. */
  need: number;
  /** 2027 need, or null while that year is undefined (always null for `pending`). */
  need2027: number | null;
  /** In-period suppliers counted as achieved (`isAchievedSupplier`). */
  achieved: number;
  /** In-period suppliers carrying this commodity, tracker + completed (blacklisted excluded). */
  total: number;
  /** Suppliers still missing for the 2026 need; null once met, or when there is no need. */
  remaining: number | null;
  /** `needBand` colour for `target` rows, the neutral grey otherwise. */
  color: string;
}

/** Plain-text reading of a strategy row, for the exports where the bar colour is lost. */
export function strategyStatus(row: ReportStrategyRow): string {
  if (row.kind === 'pending') return 'Awaiting commodity assignment (not a strategy target)';
  if (row.kind === 'noTarget') return 'No 2026 need set';
  switch (needBand(row.need, row.achieved)) {
    case 'met': return row.achieved > row.need ? `Met (+${row.achieved - row.need} over)` : 'Met';
    case 'close': return 'Close (70–99%)';
    default: return 'Behind (under 70%)';
  }
}
export interface ReportBuyerGroup {
  stage: string;
  color: string;
  total: number;
  rows: { buyer: string; count: number }[];
}
export interface ReportSupplier {
  folio: string;
  name: string;
  stage: string;
  commodity: string;
  country: string;
  buyer: string;
  /** 'YYYY-MM-DD' — always a valid date: undated suppliers never enter a period. */
  onboardingDate: string;
}

export interface VisualsReport {
  /** Period option label, e.g. 'This year' or 'Custom range'. */
  periodLabel: string;
  /** Inclusive range as 'YYYY-MM-DD' keys, plus its on-screen rendering. */
  range: { from: string; to: string; display: string };
  generatedAt: Date;
  kpis: { totalSuppliers: number; activeTracker: number };
  /** The on-screen "N suppliers … without a valid date are not counted" sentence, or null when hidden. */
  excludedNote: string | null;
  stages: ReportStage[];
  commodities: ReportCommodity[];
  countries: ReportCountry[];
  strategy: ReportStrategyRow[];
  eventStatus: ReportEventStatus[];
  conversion: ReportConversion[];
  buyerGroups: ReportBuyerGroup[];
  suppliers: ReportSupplier[];
  /** Each section's filters + summary sentence ('suppliers' is Period-only, like the KPIs). */
  scopes: Record<ReportSectionKey | 'suppliers', SectionScope>;
}

/** The report sections that are also a card on Visuals, i.e. can be downloaded on their own. */
export type ReportSectionKey =
  'stages' | 'commodities' | 'countries' | 'strategy' | 'eventStatus' | 'conversion' | 'buyerGroups';

/**
 * Per-section naming, in on-screen order: `title` is the card title (also the
 * PDF heading), `sheet` the Excel sheet name (≤ 31 chars, no ':'), `slug` the
 * single-card filename part.
 */
export const REPORT_SECTIONS: Record<ReportSectionKey, { title: string; sheet: string; slug: string }> = {
  stages: { title: 'Suppliers by Stage', sheet: 'Suppliers by Stage', slug: 'suppliers-by-stage' },
  commodities: { title: 'Distribution by Commodity', sheet: 'Distribution by Commodity', slug: 'distribution-by-commodity' },
  countries: { title: 'Geographic Distribution', sheet: 'Geographic Distribution', slug: 'geographic-distribution' },
  strategy: { title: 'Strategy: Need vs. Achieved by Commodity', sheet: 'Strategy Need vs Achieved', slug: 'strategy-need-vs-achieved' },
  eventStatus: { title: 'Events by Status', sheet: 'Events by Status', slug: 'events-by-status' },
  conversion: { title: 'Conversion rate per event', sheet: 'Conversion per Event', slug: 'conversion-rate-per-event' },
  buyerGroups: { title: 'Summary by Buyer', sheet: 'Buyer by Stage', slug: 'summary-by-buyer' },
};

/**
 * One chart captured from its live Chart.js instance at export resolution.
 * `canvas` is an opaque (white-backed) copy at `scale` device pixels per CSS
 * pixel; every other measurement is in CSS pixels of the on-screen chart.
 */
export interface ChartSnapshot {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  scale: number;
  /**
   * CSS-pixel y positions *between* two categories of a horizontal bar list,
   * where the image may be split across PDF pages without cutting a bar.
   * Empty for charts that are never taller than a page (doughnuts).
   */
  cuts: number[];
  /**
   * The doughnut's centre total, which is an HTML overlay on screen and so is
   * not part of the canvas; the PDF redraws it at `x`, `y` (CSS px).
   */
  centerLabel?: { x: number; y: number; value: string; caption: string };
}

/** The sections drawn as a chart (Summary by Buyer is a table on screen). */
export type ChartSectionKey = Exclude<ReportSectionKey, 'buyerGroups'>;

/** One snapshot per chart position; null when that chart isn't mounted (empty, or Table mode). */
export type ReportChartImages = Record<ChartSectionKey, ChartSnapshot | null>;

export const REPORT_TITLE = 'SSD Visuals Report';

/** 'Parking Lot' → 'parking-lot'; accents are dropped ('Nuñez' → 'nunez'). */
function slugify(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** 'Last 30 days' → 'last-30-days'; a custom range names its own dates instead. */
export function periodSlug(report: VisualsReport): string {
  if (report.periodLabel === 'Custom range') return `custom-${report.range.from}-to-${report.range.to}`;
  return slugify(report.periodLabel);
}

/** Longest filters slug kept in a filename; cut back to a whole word. */
const MAX_FILTERS_SLUG = 80;

/** 'stage-parking-lot-buyer-itzel-campos', or 'no-filters' when the card has none. */
export function filtersSlug(scope: SectionScope): string {
  if (scope.filters.length === 0) return 'no-filters';
  const slug = slugify(scope.filters.map(f => `${f.label} ${f.value}`).join(' '));
  if (slug.length <= MAX_FILTERS_SLUG) return slug;
  const cut = slug.slice(0, MAX_FILTERS_SLUG);
  return cut.slice(0, cut.lastIndexOf('-') > 0 ? cut.lastIndexOf('-') : MAX_FILTERS_SLUG);
}

/** 'YYYY-MM-DD', local time. */
export function dateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ssd-visuals-report-<period-slug>-<YYYY-MM-DD>.<ext> */
export function reportFilename(report: VisualsReport, ext: 'xlsx' | 'pdf'): string {
  return `ssd-visuals-report-${periodSlug(report)}-${dateStamp(report.generatedAt)}.${ext}`;
}

/** ssd-visuals-<section-slug>-<period-slug>-<filters-slug>-<YYYY-MM-DD>.<ext> */
export function sectionFilename(report: VisualsReport, section: ReportSectionKey, ext: 'xlsx' | 'pdf'): string {
  const parts = [REPORT_SECTIONS[section].slug, periodSlug(report), filtersSlug(report.scopes[section]), dateStamp(report.generatedAt)];
  return `ssd-visuals-${parts.join('-')}.${ext}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * '25 Sep 2026, 14:05' — the "Generated" stamp printed inside both files.
 * Built by hand to match the page's own date style ('en-GB' would print 'Sept').
 */
export function formatGeneratedAt(d: Date): string {
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Share of `total`, as a 0–1 fraction (Excel percent cells) — 0 when total is 0. */
export function fractionOf(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

/** Triggers a browser download of `blob` via a temporary `<a download>` link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
