// Visuals "Export report" → branded landscape PDF, via `jspdf` + `jspdf-autotable`.
// Both are loaded with `await import()` inside `exportVisualsPdf`, so Rollup
// gives them their own chunks, fetched only when someone actually exports.
//
// Each chart is the live Chart.js canvas re-rendered at export resolution (see
// `captureChart` in `pages/Dashboard.tsx`), followed by its data table, so the
// numbers stay readable however long the list is: the tables paginate (header
// repeated on each page) and a bar list taller than a page is split between
// two bars, never through one.

import type { jsPDF as JsPDF } from 'jspdf';
import type { CellHookData, RowInput, UserOptions } from 'jspdf-autotable';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import {
  REPORT_TITLE, downloadBlob, formatGeneratedAt, fractionOf, reportFilename,
  type ChartSnapshot, type ReportChartImages, type VisualsReport,
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

  constructor(readonly doc: JsPDF, readonly autoTable: AutoTable) {
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

  emptyNote(message = 'No data for this period') {
    this.text(message, MARGIN, this.y + 10, { size: 10, color: MUTED });
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

function drawCoverAndStages(w: PdfWriter, report: VisualsReport, charts: ReportChartImages) {
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

  w.sectionTitle('Suppliers by Stage');
  const stageTotal = report.stages.reduce((a, s) => a + s.count, 0);
  if (stageTotal === 0) { w.emptyNote(); return; }
  // Chart and table side by side: 7 fixed rows, so both fit under the KPIs.
  const top = w.y;
  const chartW = w.contentW * 0.58;
  if (charts.stage) w.chart(charts.stage, MARGIN, chartW, w.contentBottom - top);
  const chartBottom = w.y;
  w.y = top;
  const tableX = charts.stage ? MARGIN + chartW + 24 : MARGIN;
  w.table({
    head: ['Stage', 'Suppliers', '% of total'],
    body: report.stages.map(s => [s.name, num(s.count), pct(s.count, stageTotal)]),
    foot: ['Total', num(stageTotal), '100%'],
    swatches: report.stages.map(s => s.color),
    x: tableX,
    width: charts.stage ? w.pageW - MARGIN - tableX : 420,
  });
  w.y = Math.max(w.y, chartBottom + SECTION_GAP);
}

function drawShareSection(
  w: PdfWriter, title: string, label: string, chart: ChartSnapshot | null,
  rows: { name: string; count: number; color?: string }[], total: number,
) {
  w.newPage();
  w.sectionTitle(title, `${num(rows.length)} ${rows.length === 1 ? 'category' : 'categories'}`);
  if (rows.length === 0) { w.emptyNote(); return; }
  if (chart) {
    // A doughnut stays at a legible, modest size; a bar list uses the full width.
    const isDonut = chart.cuts.length === 0 && !!chart.centerLabel;
    w.chart(chart, MARGIN, isDonut ? 420 : w.contentW, isDonut ? 200 : undefined);
    w.y += SECTION_GAP;
  }
  const count = rows.reduce((a, r) => a + r.count, 0);
  w.table({
    head: [label, 'Suppliers', '% of total'],
    body: rows.map(r => [r.name, num(r.count), pct(r.count, total)]),
    foot: ['Total', num(count), pct(count, total)],
    swatches: rows.every(r => r.color) ? rows.map(r => r.color as string) : undefined,
    width: 520,
  });
}

function drawEvents(w: PdfWriter, report: VisualsReport, charts: ReportChartImages) {
  w.newPage();
  w.sectionTitle('Events by Status');
  const total = report.eventStatus.reduce((a, e) => a + e.value, 0);
  if (total === 0) {
    w.emptyNote();
  } else {
    const top = w.y;
    if (charts.eventStatus) w.chart(charts.eventStatus, MARGIN, 300, 190);
    const chartBottom = w.y;
    w.y = top;
    const tableX = charts.eventStatus ? MARGIN + 320 : MARGIN;
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

  w.ensureSpace(MIN_BLOCK_PT * 2);
  if (w.y > CONTENT_TOP) w.y += 6;
  w.sectionTitle('Conversion rate per event', `${num(report.conversion.length)} ${report.conversion.length === 1 ? 'event' : 'events'}`);
  if (report.conversion.length === 0) { w.emptyNote(); return; }
  if (charts.conversion) {
    w.legend([{ label: 'Evaluated', color: BRAND_COLORS.sidebar }, { label: 'Included', color: INCLUDED_GREEN }]);
    w.chart(charts.conversion, MARGIN, w.contentW);
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
  w.newPage();
  const grand = report.buyerGroups.reduce((a, g) => a + g.total, 0);
  w.sectionTitle('Summary by Buyer', `${num(grand)} ${grand === 1 ? 'supplier' : 'suppliers'} across ${report.buyerGroups.length} stages`);
  if (grand === 0) { w.emptyNote('No suppliers onboarded in this period'); return; }
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

/** Builds the PDF and downloads it; resolves to the filename used. */
export async function exportVisualsPdf(report: VisualsReport, charts: ReportChartImages): Promise<string> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({
    title: `${REPORT_TITLE} — ${report.periodLabel} (${report.range.display})`,
    subject: 'Business Intelligence · SSD Tracker',
    creator: 'SSD Tracker',
  });

  const w = new PdfWriter(doc, autoTable);
  drawCoverAndStages(w, report, charts);
  drawShareSection(w, 'Distribution by Commodity', 'Commodity', charts.commodity,
    report.commodities.map(c => ({ name: c.name, count: c.value, color: c.color })), report.kpis.totalSuppliers);
  drawShareSection(w, 'Geographic Distribution', 'Country', charts.country, report.countries, report.kpis.totalSuppliers);
  drawEvents(w, report, charts);
  drawBuyerSummary(w, report);
  drawChrome(w, report);

  const filename = reportFilename(report, 'pdf');
  downloadBlob(doc.output('blob'), filename);
  return filename;
}
