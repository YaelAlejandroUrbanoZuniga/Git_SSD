// Visuals "Export report" and single-card downloads → branded landscape PDF,
// via `jspdf` + `jspdf-autotable`. Both are loaded with `await import()` inside
// the export functions, so Rollup gives them their own chunks, fetched only
// when someone actually exports.
//
// Each chart is the live Chart.js canvas re-rendered at export resolution (see
// `captureChart` in `pages/Dashboard.tsx`), followed by its data table, so the
// numbers stay readable however long the list is: the tables paginate (header
// repeated on each page) and a bar list taller than a page is split between
// two bars, never through one. Every section states, under its title, the
// Period and card filters that produced it (`SectionScope.summary`).

import type { jsPDF as JsPDF } from 'jspdf';
import type { CellHookData, RowInput, UserOptions } from 'jspdf-autotable';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import { NEED_BAND_COLORS } from './strategy-helpers';
import {
  REPORT_SECTIONS, REPORT_TITLE, downloadBlob, formatGeneratedAt, fractionOf, reportFilename, sectionFilename, strategyStatus,
  type ChartSnapshot, type ReportChartImages, type ReportSectionKey, type ReportStrategyRow, type SectionScope, type VisualsReport,
} from './visualsReport';

type AutoTable = (doc: JsPDF, options: UserOptions) => void;

// Layout, in PDF points (A4 landscape: 841.89 × 595.28).
const MARGIN = 36;
const BAND_H = 44;
const CONTENT_TOP = BAND_H + 22;
const FOOTER_H = 30;
const SECTION_GAP = 18;
/** Upper bound on chart magnification: 1 CSS px → 0.9 pt keeps on-screen proportions. */
const MAX_PT_PER_PX = 0.9;
/** Never start a chart slice or a table with less room than this left on the page. */
const MIN_BLOCK_PT = 72;

const FONT = 'helvetica';
const TEXT = '#000000';
const MUTED = BRAND_COLORS.sidebar;
const INCLUDED_GREEN = '#6ABF4B';

/**
 * Any CSS colour → '#rrggbb'. jsPDF only takes hex/RGB, but the commodity
 * palette is `hsl()`; a 2D context normalises whatever it is given.
 */
let colorCtx: CanvasRenderingContext2D | null | undefined;
function toHex(css: string): string {
  colorCtx ??= document.createElement('canvas').getContext('2d');
  if (!colorCtx) return css;
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = css;
  return String(colorCtx.fillStyle);
}

// jsPDF's built-in Helvetica only encodes WinAnsi (Latin-1 plus these), and
// Inter is loaded from a CDN with no local TTF to embed. Any other character
// would come out as garbage ('Česko' → 'e s k o'), so it falls back to its
// base letter ('Cesko') or '?'. Chart images are unaffected: the canvas
// renders the real text.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const isWinAnsi = (ch: string) => ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch);
function pdfSafe(text: string): string {
  return Array.from(text, ch => {
    if (isWinAnsi(ch)) return ch;
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return base && Array.from(base).every(isWinAnsi) ? base : '?';
  }).join('');
}

const num = (n: number) => n.toLocaleString('en-US');
const pct = (value: number, total: number) => `${Math.round(fractionOf(value, total) * 100)}%`;

class PdfWriter {
  readonly pageW: number;
  readonly pageH: number;
  readonly contentW: number;
  readonly contentBottom: number;
  y = CONTENT_TOP;

  /**
   * @param prominentScope true for a single-card PDF, where the filter
   *   sentence is the point of the file and gets a tinted panel.
   */
  constructor(readonly doc: JsPDF, readonly autoTable: AutoTable, readonly prominentScope = false) {
    this.pageW = doc.internal.pageSize.getWidth();
    this.pageH = doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - MARGIN * 2;
    this.contentBottom = this.pageH - FOOTER_H - 6;
  }

  newPage() {
    this.doc.addPage();
    this.y = CONTENT_TOP;
  }

  /** Moves to a new page unless `height` pt still fit below the cursor. */
  ensureSpace(height: number) {
    if (this.y + height > this.contentBottom) this.newPage();
  }

  text(value: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right' } = {}) {
    this.doc.setFont(FONT, opts.bold ? 'bold' : 'normal');
    this.doc.setFontSize(opts.size ?? 10);
    this.doc.setTextColor(opts.color ?? TEXT);
    this.doc.text(pdfSafe(value), x, y, { align: opts.align ?? 'left', baseline: 'alphabetic' });
  }

  /** Section heading: short brand-red accent bar + bold title. */
  sectionTitle(title: string, subtitle?: string) {
    this.ensureSpace(MIN_BLOCK_PT);
    this.doc.setFillColor(BRAND_COLORS.accentRed);
    this.doc.rect(MARGIN, this.y, 3, 14, 'F');
    this.text(title, MARGIN + 10, this.y + 11, { size: 13, bold: true });
    if (subtitle) this.text(subtitle, this.pageW - MARGIN, this.y + 11, { size: 8, color: MUTED, align: 'right' });
    this.y += 26;
  }

  /**
   * The section's "Period: … · Filter: value" sentence (plus its caveat, if
   * any), wrapped to the content width. Plain text in the full report; a
   * tinted, accent-barred panel in larger bold type in a single-card PDF.
   */
  scope(scope: SectionScope) {
    const big = this.prominentScope;
    const pad = big ? 10 : 0;
    const indent = big ? 7 : 0;
    const width = this.contentW - pad * 2 - indent;
    const size = big ? 11 : 9;
    const noteSize = big ? 9 : 8;
    const wrap = (text: string, fontSize: number, bold: boolean): string[] => {
      this.doc.setFont(FONT, bold ? 'bold' : 'normal');
      this.doc.setFontSize(fontSize);
      return this.doc.splitTextToSize(pdfSafe(text), width) as string[];
    };
    const lines = wrap(scope.summary, size, big);
    const noteLines = scope.note ? wrap(scope.note, noteSize, false) : [];
    const lineH = size * 1.35;
    const noteH = noteSize * 1.35;
    const height = pad * 2 + lines.length * lineH + noteLines.length * noteH;

    this.ensureSpace(height + MIN_BLOCK_PT);
    if (big) {
      this.doc.setFillColor(NEUTRAL_COLORS.panelBg);
      this.doc.rect(MARGIN, this.y, this.contentW, height, 'F');
      this.doc.setFillColor(BRAND_COLORS.accentRed);
      this.doc.rect(MARGIN, this.y, 3, height, 'F');
    }
    const x = MARGIN + pad + indent;
    let baseline = this.y + pad + size * 0.9;
    lines.forEach(line => {
      this.text(line, x, baseline, { size, bold: big, color: NEUTRAL_COLORS.textDark });
      baseline += lineH;
    });
    baseline += noteSize * 0.9 - size * 0.9;
    noteLines.forEach(line => {
      this.text(line, x, baseline, { size: noteSize, color: MUTED });
      baseline += noteH;
    });
    this.y += height + (big ? 16 : 10);
  }

  /** Title row + filter sentence: the head of every section, in either kind of PDF. */
  sectionHeader(title: string, scope: SectionScope, subtitle?: string) {
    this.sectionTitle(title, subtitle);
    this.scope(scope);
  }

  /** "No data" in place of a section's chart/table — worded for the card's filters, as on screen. */
  emptyNote(scope: SectionScope, message = 'No data for this period') {
    const text = scope.filters.length > 0 ? 'No data matches these filters' : message;
    this.text(text, MARGIN, this.y + 10, { size: 10, color: MUTED });
    this.y += 24;
  }

  /** A horizontal legend (swatch + label), for series whose legend is HTML on screen. */
  legend(items: { label: string; color: string }[]) {
    let x = MARGIN;
    items.forEach(item => {
      this.doc.setFillColor(toHex(item.color));
      this.doc.roundedRect(x, this.y, 8, 8, 1.5, 1.5, 'F');
      this.text(item.label, x + 12, this.y + 7, { size: 9, color: NEUTRAL_COLORS.textDark });
      x += 24 + this.doc.getTextWidth(item.label);
    });
    this.y += 16;
  }

  /**
   * Draws a chart snapshot `width` pt wide at most (never magnified past
   * `MAX_PT_PER_PX`, and optionally capped at `maxHeight`). A chart that does
   * not fit the rest of the page is split at `snapshot.cuts`, continuing on
   * the next page, so a long bar list is paginated rather than shrunk.
   */
  chart(snapshot: ChartSnapshot, x: number, width: number, maxHeight?: number) {
    let k = Math.min(MAX_PT_PER_PX, width / snapshot.cssWidth);
    if (maxHeight) k = Math.min(k, maxHeight / snapshot.cssHeight);
    const fullHeight = snapshot.cssHeight * k;
    const pageRoom = this.contentBottom - CONTENT_TOP;

    if (snapshot.cuts.length === 0 || fullHeight <= this.contentBottom - this.y || fullHeight <= pageRoom) {
      this.ensureSpace(fullHeight);
      const top = this.y;
      this.doc.addImage(snapshot.canvas.toDataURL('image/png'), 'PNG', x, top, snapshot.cssWidth * k, fullHeight, undefined, 'FAST');
      const label = snapshot.centerLabel;
      if (label) {
        this.text(label.value, x + label.x * k, top + label.y * k + 2, { size: 16, bold: true, align: 'center' });
        this.text(label.caption, x + label.x * k, top + label.y * k + 12, { size: 7, color: MUTED, align: 'center' });
      }
      this.y += fullHeight;
      return;
    }

    let start = 0;
    while (start < snapshot.cssHeight) {
      if (this.contentBottom - this.y < MIN_BLOCK_PT) this.newPage();
      const limit = start + (this.contentBottom - this.y) / k;
      let end = snapshot.cssHeight;
      if (limit < snapshot.cssHeight) {
        const fitting = snapshot.cuts.filter(c => c > start && c <= limit);
        end = fitting.length > 0 ? fitting[fitting.length - 1] : limit;
      }
      const h = (end - start) * k;
      this.doc.addImage(sliceCanvas(snapshot, start, end), 'PNG', x, this.y, snapshot.cssWidth * k, h, undefined, 'FAST');
      this.y += h;
      start = end;
      if (start < snapshot.cssHeight) this.newPage();
    }
  }

  /**
   * A branded data table. `swatches[i]`, when given, is drawn as a colour chip
   * in an extra leading column for body row `i` — the PDF's stand-in for the
   * on-screen HTML legends.
   */
  table(opts: {
    head: string[];
    body: RowInput[];
    foot?: RowInput;
    swatches?: string[];
    x?: number;
    width?: number;
    numericFrom?: number;
  }) {
    const swatches = opts.swatches?.map(toHex);
    const lead = swatches ? 1 : 0;
    const x = opts.x ?? MARGIN;
    const width = Math.min(opts.width ?? this.contentW, this.pageW - MARGIN - x);
    const numericFrom = (opts.numericFrom ?? 1) + lead;
    const columnStyles: UserOptions['columnStyles'] = {};
    for (let i = numericFrom; i < opts.head.length + lead; i++) columnStyles[i] = { halign: 'right', cellWidth: 72 };
    if (swatches) columnStyles[0] = { cellWidth: 18 };

    this.ensureSpace(MIN_BLOCK_PT);
    this.autoTable(this.doc, {
      startY: this.y,
      margin: { top: CONTENT_TOP, bottom: this.pageH - this.contentBottom, left: x, right: this.pageW - x - width },
      tableWidth: width,
      head: [[...(swatches ? [''] : []), ...opts.head]],
      body: swatches ? opts.body.map(row => ['', ...(row as unknown[])] as RowInput) : opts.body,
      foot: opts.foot ? [[...(swatches ? [''] : []), ...(opts.foot as unknown[])] as RowInput] : undefined,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      theme: 'plain',
      styles: {
        font: FONT, fontSize: 9, textColor: TEXT, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        lineColor: NEUTRAL_COLORS.borderLight, lineWidth: { bottom: 0.5 }, overflow: 'linebreak', valign: 'middle',
      },
      headStyles: { fillColor: BRAND_COLORS.header, textColor: BRAND_COLORS.cards, fontStyle: 'bold', lineWidth: 0 },
      footStyles: { fillColor: BRAND_COLORS.background, fontStyle: 'bold', lineWidth: { top: 0.75 }, lineColor: MUTED },
      alternateRowStyles: { fillColor: NEUTRAL_COLORS.panelBg },
      columnStyles,
      didParseCell: (data: CellHookData) => {
        data.cell.text = data.cell.text.map(pdfSafe);
        // Header labels of numeric columns align with their values.
        if (data.section !== 'body' && data.column.index >= numericFrom) data.cell.styles.halign = 'right';
      },
      didDrawCell: (data: CellHookData) => {
        if (!swatches || data.section !== 'body' || data.column.index !== 0) return;
        this.doc.setFillColor(swatches[data.row.index] ?? MUTED);
        this.doc.roundedRect(data.cell.x + 6, data.cell.y + data.cell.height / 2 - 3.5, 7, 7, 1.5, 1.5, 'F');
      },
    });
    const finalY = (this.doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    this.y = (finalY ?? this.y) + SECTION_GAP;
  }
}

/** PNG data URL of rows `start`–`end` (CSS px) of a snapshot, full width. */
function sliceCanvas(snapshot: ChartSnapshot, start: number, end: number): string {
  const top = Math.round(start * snapshot.scale);
  const height = Math.max(1, Math.round(end * snapshot.scale) - top);
  const slice = document.createElement('canvas');
  slice.width = snapshot.canvas.width;
  slice.height = height;
  slice.getContext('2d')?.drawImage(snapshot.canvas, 0, top, slice.width, height, 0, 0, slice.width, height);
  return slice.toDataURL('image/png');
}

/** Header band, footer and page numbers — drawn last, once the page count is known. */
function drawChrome(w: PdfWriter, report: VisualsReport) {
  const { doc } = w;
  const pages = doc.getNumberOfPages();
  const generated = formatGeneratedAt(report.generatedAt);
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFillColor(BRAND_COLORS.header);
    doc.rect(0, 0, w.pageW, BAND_H, 'F');
    doc.setFillColor(BRAND_COLORS.accentRed);
    doc.rect(0, BAND_H, w.pageW, 3, 'F');
    w.text(REPORT_TITLE, MARGIN, 28, { size: 15, bold: true, color: BRAND_COLORS.cards });
    w.text(`${report.periodLabel} · ${report.range.display}`, w.pageW - MARGIN, 28, { size: 10, color: BRAND_COLORS.cards, align: 'right' });

    const footY = w.pageH - FOOTER_H + 12;
    doc.setDrawColor(NEUTRAL_COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footY - 10, w.pageW - MARGIN, footY - 10);
    w.text(`Generated ${generated}`, MARGIN, footY, { size: 8, color: MUTED });
    w.text('Business Intelligence · SSD Tracker', w.pageW / 2, footY, { size: 8, color: MUTED, align: 'center' });
    w.text(`Page ${page} of ${pages}`, w.pageW - MARGIN, footY, { size: 8, color: MUTED, align: 'right' });
  }
}

/** Page 1 of the full report: title, period line and the two KPI cards. */
function drawCover(w: PdfWriter, report: VisualsReport) {
  w.text('Visuals', MARGIN, w.y + 18, { size: 22, bold: true });
  w.text('Business Intelligence · SSD Tracker', MARGIN, w.y + 34, { size: 10, color: MUTED });
  w.y += 46;
  w.text(`Period: ${report.periodLabel} (${report.range.display})   ·   Generated: ${formatGeneratedAt(report.generatedAt)}`,
    MARGIN, w.y + 8, { size: 9, color: NEUTRAL_COLORS.textDark });
  w.y += 14;
  if (report.excludedNote) {
    w.text(report.excludedNote, MARGIN, w.y + 8, { size: 8, color: MUTED });
    w.y += 12;
  }
  w.y += 10;

  // KPI cards — same accents as the on-screen KpiCards.
  const kpis = [
    { label: 'Total Suppliers', value: report.kpis.totalSuppliers, sub: 'onboarded in the period', color: '#02B3E1' },
    { label: 'Active Tracker', value: report.kpis.activeTracker, sub: 'in active process', color: ACCENT_COLORS.purple },
  ];
  const gap = 16;
  const cardW = (w.contentW - gap) / 2;
  const cardH = 58;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardW + gap);
    w.doc.setDrawColor(NEUTRAL_COLORS.border);
    w.doc.setLineWidth(0.75);
    w.doc.setFillColor(BRAND_COLORS.cards);
    w.doc.roundedRect(x, w.y, cardW, cardH, 4, 4, 'FD');
    w.doc.setFillColor(kpi.color);
    w.doc.rect(x, w.y, 4, cardH, 'F');
    w.text(kpi.label, x + 16, w.y + 18, { size: 9, color: MUTED });
    w.text(num(kpi.value), x + 16, w.y + 42, { size: 22, bold: true });
    w.text(kpi.sub, x + 16 + w.doc.getTextWidth(num(kpi.value)) + 10, w.y + 42, { size: 8, color: MUTED });
  });
  w.y += cardH + 22;
}

/**
 * One section's content from the current cursor: header (title + filter
 * sentence), chart when it was captured, then its full table. None of them
 * starts a page — the caller decides (`exportVisualsPdf` / `exportVisualsSectionPdf`).
 */
type SectionDrawer = (w: PdfWriter, report: VisualsReport, chart: ChartSnapshot | null) => void;

function drawStages(w: PdfWriter, report: VisualsReport, chart: ChartSnapshot | null) {
  const scope = report.scopes.stages;
  w.sectionHeader(REPORT_SECTIONS.stages.title, scope);
  const stageTotal = report.stages.reduce((a, s) => a + s.count, 0);
  if (stageTotal === 0) { w.emptyNote(scope); return; }
  // Chart and table side by side: 7 fixed rows, so both fit under the KPIs.
  const top = w.y;
  const chartW = w.contentW * 0.58;
  if (chart) w.chart(chart, MARGIN, chartW, w.contentBottom - top);
  const chartBottom = w.y;
  w.y = top;
  const tableX = chart ? MARGIN + chartW + 24 : MARGIN;
  w.table({
    head: ['Stage', 'Suppliers', '% of total'],
    body: report.stages.map(s => [s.name, num(s.count), pct(s.count, stageTotal)]),
    foot: ['Total', num(stageTotal), '100%'],
    swatches: report.stages.map(s => s.color),
    x: tableX,
    width: chart ? w.pageW - MARGIN - tableX : 420,
  });
  w.y = Math.max(w.y, chartBottom + SECTION_GAP);
}

function shareDrawer(
  section: 'commodities' | 'countries', label: string,
  pick: (report: VisualsReport) => { name: string; count: number; color?: string }[],
): SectionDrawer {
  return (w, report, chart) => {
    const rows = pick(report);
    const scope = report.scopes[section];
    w.sectionHeader(REPORT_SECTIONS[section].title, scope, `${num(rows.length)} ${rows.length === 1 ? 'category' : 'categories'}`);
    if (rows.length === 0) { w.emptyNote(scope); return; }
    if (chart) {
      // A doughnut stays at a legible, modest size; a bar list uses the full width.
      const isDonut = chart.cuts.length === 0 && !!chart.centerLabel;
      w.chart(chart, MARGIN, isDonut ? 420 : w.contentW, isDonut ? 200 : undefined);
      w.y += SECTION_GAP;
    }
    // % of the section's own total, as on screen — Total Suppliers unless that
    // card has filters of its own set.
    const total = rows.reduce((a, r) => a + r.count, 0);
    w.table({
      head: [label, 'Suppliers', '% of total'],
      body: rows.map(r => [r.name, num(r.count), pct(r.count, total)]),
      foot: ['Total', num(total), pct(total, total)],
      swatches: rows.every(r => r.color) ? rows.map(r => r.color as string) : undefined,
      width: 520,
    });
  };
}

function drawStrategy(w: PdfWriter, report: VisualsReport, chart: ChartSnapshot | null) {
  const rows = report.strategy;
  const scope = report.scopes.strategy;
  // The Pending-GSM bucket is a row but not a commodity, so it is named apart.
  const commodities = rows.filter(r => r.kind !== 'pending').length;
  const pending = rows.length > commodities ? ' + Pending GSM' : '';
  w.sectionHeader(REPORT_SECTIONS.strategy.title, scope, `${num(commodities)} ${commodities === 1 ? 'commodity' : 'commodities'}${pending}`);
  if (rows.length === 0) { w.emptyNote(scope); return; }
  if (chart) {
    // The on-screen legend is HTML, so the colour bands are redrawn here.
    w.legend([
      { label: 'Under 70% of need', color: NEED_BAND_COLORS.behind },
      { label: '70–99%', color: NEED_BAND_COLORS.close },
      { label: '100%+ (met)', color: NEED_BAND_COLORS.met },
      { label: 'No target (count only)', color: MUTED },
    ]);
    w.chart(chart, MARGIN, w.contentW);
    w.y += SECTION_GAP;
  }
  // Blank = not applicable: no need set, no 2027 need yet, nothing remaining.
  const count = (n: number | null) => (n === null ? '' : num(n));
  const sum = (pick: (r: ReportStrategyRow) => number) => num(rows.reduce((a, r) => a + pick(r), 0));
  w.table({
    // Status (text) leads the numeric columns, which `table` right-aligns at a fixed width.
    head: ['Commodity', 'Status', 'Need 2026', 'Need 2027', 'Suppliers', 'Achieved', '% of need', 'Remaining'],
    numericFrom: 2,
    body: rows.map(r => [
      r.commodity,
      strategyStatus(r),
      r.kind === 'target' ? num(r.need) : '',
      count(r.need2027),
      num(r.total),
      num(r.achieved),
      r.kind === 'target' ? pct(r.achieved, r.need) : '',
      count(r.remaining),
    ]),
    foot: ['Total', '', sum(r => r.need), '', sum(r => r.total), sum(r => r.achieved), '', sum(r => r.remaining ?? 0)],
    swatches: rows.map(r => r.color),
  });
}

function drawEventStatus(w: PdfWriter, report: VisualsReport, chart: ChartSnapshot | null) {
  const scope = report.scopes.eventStatus;
  w.sectionHeader(REPORT_SECTIONS.eventStatus.title, scope);
  const total = report.eventStatus.reduce((a, e) => a + e.value, 0);
  if (total === 0) { w.emptyNote(scope); return; }
  const top = w.y;
  if (chart) w.chart(chart, MARGIN, 300, 190);
  const chartBottom = w.y;
  w.y = top;
  const tableX = chart ? MARGIN + 320 : MARGIN;
  w.table({
    head: ['Status', 'Events', '% of total'],
    body: report.eventStatus.map(e => [e.name, num(e.value), pct(e.value, total)]),
    foot: ['Total', num(total), '100%'],
    swatches: report.eventStatus.map(e => e.color),
    x: tableX,
    width: 360,
  });
  w.y = Math.max(w.y, chartBottom + SECTION_GAP);
}

function drawConversion(w: PdfWriter, report: VisualsReport, chart: ChartSnapshot | null) {
  const scope = report.scopes.conversion;
  w.sectionHeader(REPORT_SECTIONS.conversion.title, scope,
    `${num(report.conversion.length)} ${report.conversion.length === 1 ? 'event' : 'events'}`);
  if (report.conversion.length === 0) { w.emptyNote(scope); return; }
  if (chart) {
    w.legend([{ label: 'Evaluated', color: BRAND_COLORS.sidebar }, { label: 'Included', color: INCLUDED_GREEN }]);
    w.chart(chart, MARGIN, w.contentW);
    w.y += SECTION_GAP;
  }
  const evaluated = report.conversion.reduce((a, c) => a + c.evaluated, 0);
  const included = report.conversion.reduce((a, c) => a + c.included, 0);
  w.table({
    head: ['Event', 'Evaluated', 'Included', 'Conversion %'],
    body: report.conversion.map(c => [c.name, num(c.evaluated), num(c.included), `${c.pct}%`]),
    foot: ['Total', num(evaluated), num(included), pct(included, evaluated)],
  });
}

function drawBuyerSummary(w: PdfWriter, report: VisualsReport) {
  const scope = report.scopes.buyerGroups;
  const grand = report.buyerGroups.reduce((a, g) => a + g.total, 0);
  w.sectionHeader(REPORT_SECTIONS.buyerGroups.title, scope,
    `${num(grand)} ${grand === 1 ? 'supplier' : 'suppliers'} across ${report.buyerGroups.length} stages`);
  if (grand === 0) { w.emptyNote(scope, 'No suppliers onboarded in this period'); return; }
  report.buyerGroups.forEach(group => {
    // Keep a stage's heading with at least its first rows.
    w.ensureSpace(group.total > 0 ? MIN_BLOCK_PT + 20 : 24);
    w.doc.setFillColor(toHex(group.color));
    w.doc.circle(MARGIN + 5, w.y + 6, 4, 'F');
    w.text(group.stage, MARGIN + 16, w.y + 10, { size: 11, bold: true });
    w.text(`${num(group.total)} ${group.total === 1 ? 'supplier' : 'suppliers'}`,
      MARGIN + 24 + w.doc.getTextWidth(group.stage), w.y + 10, { size: 9, color: MUTED });
    w.y += 18;
    if (group.total === 0) { w.y += 4; return; }
    w.table({
      head: ['Buyer', 'Suppliers'],
      body: group.rows.map(r => [r.buyer, num(r.count)]),
      foot: ['Total', num(group.total)],
      width: 420,
    });
  });
}

const SECTION_DRAWERS: Record<ReportSectionKey, SectionDrawer> = {
  stages: drawStages,
  commodities: shareDrawer('commodities', 'Commodity', r => r.commodities.map(c => ({ name: c.name, count: c.value, color: c.color }))),
  countries: shareDrawer('countries', 'Country', r => r.countries),
  strategy: drawStrategy,
  eventStatus: drawEventStatus,
  conversion: drawConversion,
  buyerGroups: drawBuyerSummary,
};

async function newWriter(title: string, prominentScope: boolean): Promise<PdfWriter> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title, subject: 'Business Intelligence · SSD Tracker', creator: 'SSD Tracker' });
  return new PdfWriter(doc, autoTable, prominentScope);
}

/** Builds the full-report PDF and downloads it; resolves to the filename used. */
export async function exportVisualsPdf(report: VisualsReport, charts: ReportChartImages): Promise<string> {
  const w = await newWriter(`${REPORT_TITLE} — ${report.periodLabel} (${report.range.display})`, false);
  drawCover(w, report);
  drawStages(w, report, charts.stages);
  // Every later section starts a page, except Conversion, which follows
  // Events by Status when there is room.
  w.newPage();
  SECTION_DRAWERS.commodities(w, report, charts.commodities);
  w.newPage();
  SECTION_DRAWERS.countries(w, report, charts.countries);
  w.newPage();
  drawStrategy(w, report, charts.strategy);
  w.newPage();
  drawEventStatus(w, report, charts.eventStatus);
  w.ensureSpace(MIN_BLOCK_PT * 2);
  if (w.y > CONTENT_TOP) w.y += 6;
  drawConversion(w, report, charts.conversion);
  w.newPage();
  drawBuyerSummary(w, report);
  drawChrome(w, report);

  const filename = reportFilename(report, 'pdf');
  downloadBlob(w.doc.output('blob'), filename);
  return filename;
}

/**
 * One card's download: the same branded header/footer, then that card's
 * section alone — title, its filter sentence in a highlighted panel, chart
 * (when `chart` was captured) and table. Resolves to the filename used.
 */
export async function exportVisualsSectionPdf(
  report: VisualsReport, section: ReportSectionKey, chart: ChartSnapshot | null,
): Promise<string> {
  const w = await newWriter(`${REPORT_SECTIONS[section].title} — ${report.scopes[section].summary}`, true);
  SECTION_DRAWERS[section](w, report, chart);
  drawChrome(w, report);

  const filename = sectionFilename(report, section, 'pdf');
  downloadBlob(w.doc.output('blob'), filename);
  return filename;
}
