// Shared shape of the Visuals "Export report" download. `pages/Dashboard.tsx`
// assembles one `VisualsReport` from the same period-filtered arrays that feed
// its charts, and the two writers (`visualsReportExcel.ts`, `visualsReportPdf.ts`)
// only format it — neither recomputes a figure, so both files always match the
// screen. This module is deliberately library-free: it is imported statically,
// while `exceljs` / `jspdf` are loaded on demand inside the writers.

export interface ReportStage { name: string; count: number; color: string }
export interface ReportCommodity { name: string; value: number; color: string }
export interface ReportCountry { name: string; count: number }
export interface ReportEventStatus { name: string; value: number; color: string }
export interface ReportConversion { name: string; evaluated: number; included: number; pct: number }
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
  eventStatus: ReportEventStatus[];
  conversion: ReportConversion[];
  buyerGroups: ReportBuyerGroup[];
  suppliers: ReportSupplier[];
}

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

/** One snapshot per chart position; null when that chart isn't mounted (empty, or Table mode). */
export interface ReportChartImages {
  stage: ChartSnapshot | null;
  commodity: ChartSnapshot | null;
  country: ChartSnapshot | null;
  eventStatus: ChartSnapshot | null;
  conversion: ChartSnapshot | null;
}

export const REPORT_TITLE = 'SSD Visuals Report';

/** 'Last 30 days' → 'last-30-days'; a custom range names its own dates instead. */
export function periodSlug(report: VisualsReport): string {
  if (report.periodLabel === 'Custom range') return `custom-${report.range.from}-to-${report.range.to}`;
  return report.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** 'YYYY-MM-DD', local time. */
export function dateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ssd-visuals-report-<period-slug>-<YYYY-MM-DD>.<ext> */
export function reportFilename(report: VisualsReport, ext: 'xlsx' | 'pdf'): string {
  return `ssd-visuals-report-${periodSlug(report)}-${dateStamp(report.generatedAt)}.${ext}`;
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
