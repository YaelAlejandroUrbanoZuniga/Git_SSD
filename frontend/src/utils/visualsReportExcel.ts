// Visuals "Export report" and single-card downloads → formatted .xlsx workbook,
// via `exceljs` (SheetJS community edition, already used for the prospect
// import, cannot style cells). `exceljs` is loaded with `await import()` inside
// the export functions, so Rollup gives it its own chunk, fetched only when
// someone actually exports.

import type { Cell, CellValue, Workbook, Worksheet } from 'exceljs';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import {
  REPORT_SECTIONS, REPORT_TITLE, downloadBlob, formatGeneratedAt, fractionOf, reportFilename, sectionFilename, strategyStatus,
  type ReportSectionKey, type SectionScope, type VisualsReport,
} from './visualsReport';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FONT = 'Inter';

/** '#AA0202' → 'FFAA0202' (exceljs colours are opaque ARGB). */
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const solid = (hex: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(hex) } });
const thin = (hex: string) => ({ style: 'thin' as const, color: { argb: argb(hex) } });

const FMT_INT = '#,##0';
const FMT_PCT = '0%';
const FMT_DATE = 'd mmm yyyy';

/** 'YYYY-MM-DD' → a UTC-midnight Date, which exceljs writes as that exact serial day. */
function excelDate(key: string): Date | string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : key;
}

/**
 * The exceljs browser build is UMD, so depending on the bundler's CommonJS
 * interop its API arrives either as the namespace itself or under `default`.
 */
async function loadExcelJS() {
  const mod = await import('exceljs');
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

interface Column {
  header: string;
  key: string;
  numFmt?: string;
  /** Fixed width; otherwise sized from the longest value (clamped). */
  width?: number;
}

/** A line of text above a sheet's table: the card title, its filter sentence, notes. */
interface IntroLine { text: string; kind: 'title' | 'scope' | 'note' | 'meta' }

const INTRO_FONTS: Record<IntroLine['kind'], Partial<Cell['font']>> = {
  title: { size: 14, bold: true, color: { argb: argb(BRAND_COLORS.header) } },
  scope: { bold: true, color: { argb: argb(NEUTRAL_COLORS.textDark) } },
  note: { italic: true, color: { argb: argb(BRAND_COLORS.sidebar) } },
  meta: { color: { argb: argb(BRAND_COLORS.sidebar) } },
};

/** The filter sentence (and its caveat, if any) printed above a section's table. */
function scopeLines(scope: SectionScope): IntroLine[] {
  return [{ text: scope.summary, kind: 'scope' }, ...(scope.note ? [{ text: scope.note, kind: 'note' as const }] : [])];
}

function styleHeaderCell(cell: Cell) {
  cell.font = { name: FONT, bold: true, color: { argb: argb(BRAND_COLORS.cards) } };
  cell.fill = solid(BRAND_COLORS.header);
  cell.alignment = { vertical: 'middle' };
  cell.border = { bottom: thin(BRAND_COLORS.header) };
}

function displayLength(value: unknown, numFmt?: string): number {
  if (value instanceof Date) return 11;
  if (typeof value === 'number') return numFmt === FMT_PCT ? 5 : value.toLocaleString('en-US').length;
  return String(value ?? '').length;
}

/**
 * One styled data sheet: `intro` lines on top (unwrapped, so each overflows
 * across the empty cells to its right), a blank row, then the table — a
 * brand-red header row, frozen and auto-filtered, body rows with light borders
 * and per-column number formats, widths sized to the content. `total(key,
 * result)` is the `SUM` over the body for a totals row, which `addTotalsRow`
 * appends below the filter range (sorting must never move it).
 */
function addTableSheet(wb: Workbook, name: string, intro: IntroLine[], columns: Column[], rows: Record<string, CellValue>[]) {
  const headerRow = intro.length + 2;
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: headerRow }] });
  ws.columns = columns.map(c => ({
    key: c.key,
    width: c.width ?? Math.min(60, Math.max(12,
      c.header.length + 4,
      ...rows.map(r => displayLength(r[c.key], c.numFmt) + 3),
    )),
    style: { font: { name: FONT }, ...(c.numFmt ? { numFmt: c.numFmt } : {}) },
  }));

  intro.forEach((line, i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = line.text;
    cell.font = { name: FONT, ...INTRO_FONTS[line.kind] };
    if (line.kind === 'title') ws.getRow(i + 1).height = 24;
  });

  const header = ws.getRow(headerRow);
  columns.forEach((c, i) => { header.getCell(i + 1).value = c.header; });
  header.height = 22;
  header.eachCell(styleHeaderCell);

  const firstRow = headerRow + 1;
  if (rows.length === 0) {
    const cell = ws.getCell(firstRow, 1);
    cell.value = 'No data for this period';
    cell.font = { name: FONT, italic: true, color: { argb: argb(BRAND_COLORS.sidebar) } };
  } else {
    ws.addRows(rows);
    for (let r = firstRow; r < firstRow + rows.length; r++) {
      ws.getRow(r).eachCell({ includeEmpty: true }, cell => {
        cell.border = { bottom: thin(NEUTRAL_COLORS.borderLight) };
      });
    }
  }

  const lastRow = headerRow + rows.length;
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: columns.length } };
  /** `SUM(<col>first:<col>last)`, carrying its computed result so it shows without recalculation. */
  const total = (key: string, result: number): CellValue => {
    const col = ws.getColumn(key).letter;
    return { formula: `SUM(${col}${firstRow}:${col}${lastRow})`, result };
  };
  return { ws, total, hasRows: rows.length > 0 };
}

/** Bold totals row on a grey band, directly under the data (and outside the filter). */
function addTotalsRow(ws: Worksheet, values: Record<string, CellValue>) {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { name: FONT, bold: true };
    cell.fill = solid(BRAND_COLORS.background);
    cell.border = { top: thin(BRAND_COLORS.sidebar) };
  });
  return row;
}

function addSummarySheet(wb: Workbook, report: VisualsReport) {
  const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: argb(BRAND_COLORS.accentRed) } } });
  ws.columns = [{ width: 24 }, { width: 30 }, { width: 30 }];
  const labelFont = { name: FONT, bold: true, color: { argb: argb(NEUTRAL_COLORS.textDark) } };

  ws.mergeCells('A1:C1');
  const title = ws.getCell('A1');
  title.value = REPORT_TITLE;
  title.font = { name: FONT, size: 18, bold: true, color: { argb: argb(BRAND_COLORS.header) } };
  ws.getRow(1).height = 30;
  ws.mergeCells('A2:C2');
  ws.getCell('A2').value = 'Business Intelligence · SSD Tracker';
  ws.getCell('A2').font = { name: FONT, color: { argb: argb(BRAND_COLORS.sidebar) } };

  const meta: [string, CellValue, string?][] = [
    ['Generated', formatGeneratedAt(report.generatedAt)],
    ['Period', report.periodLabel],
    ['From', excelDate(report.range.from), FMT_DATE],
    ['To', excelDate(report.range.to), FMT_DATE],
  ];
  if (report.excludedNote) meta.push(['Note', report.excludedNote]);
  meta.forEach(([label, value, numFmt], i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = label;
    row.getCell(1).font = labelFont;
    const cell = row.getCell(2);
    cell.value = value;
    cell.font = { name: FONT };
    cell.alignment = { horizontal: 'left', wrapText: label === 'Note' };
    if (numFmt) cell.numFmt = numFmt;
    if (label === 'Note') ws.mergeCells(4 + i, 2, 4 + i, 3);
  });

  const kpiTop = 4 + meta.length + 1;
  const headerRow = ws.getRow(kpiTop);
  ['KPI', 'Value', 'Scope'].forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  headerRow.height = 22;
  headerRow.eachCell(styleHeaderCell);
  const kpis: [string, number, string][] = [
    ['Total Suppliers', report.kpis.totalSuppliers, 'onboarded in the period'],
    ['Active Tracker', report.kpis.activeTracker, 'in active process'],
  ];
  kpis.forEach(([label, value, scope], i) => {
    const row = ws.getRow(kpiTop + 1 + i);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(2).numFmt = FMT_INT;
    row.getCell(2).alignment = { horizontal: 'left' };
    row.getCell(3).value = scope;
    row.getCell(1).font = { name: FONT };
    row.getCell(2).font = { name: FONT, bold: true };
    row.getCell(3).font = { name: FONT, color: { argb: argb(BRAND_COLORS.sidebar) } };
    row.eachCell(cell => { cell.border = { bottom: thin(NEUTRAL_COLORS.borderLight) }; });
  });
}

type SheetWriter = (wb: Workbook, report: VisualsReport, intro: IntroLine[]) => void;

/**
 * Commodity and country share one shape: name, count, % of the section's own
 * total (the same denominator the screen's percentages use — it equals Total
 * Suppliers unless that card has filters of its own set).
 */
function shareSheet(label: string, pick: (report: VisualsReport) => { name: string; count: number }[], section: ReportSectionKey): SheetWriter {
  return (wb, report, intro) => {
    const rows = pick(report);
    const total = rows.reduce((a, r) => a + r.count, 0);
    const { ws, total: sum, hasRows } = addTableSheet(wb, REPORT_SECTIONS[section].sheet, intro,
      [
        { header: label, key: 'name' },
        { header: 'Suppliers', key: 'count', numFmt: FMT_INT },
        { header: '% of total', key: 'pct', numFmt: FMT_PCT },
      ],
      rows.map(r => ({ name: r.name, count: r.count, pct: fractionOf(r.count, total) })));
    if (hasRows) {
      addTotalsRow(ws, { name: 'Total', count: sum('count', total), pct: sum('pct', fractionOf(total, total)) });
    }
  };
}

/** One sheet per card, shared by the full report and a single-card download. */
const SHEET_WRITERS: Record<ReportSectionKey, SheetWriter> = {
  stages: (wb, report, intro) => {
    const { ws, total, hasRows } = addTableSheet(wb, REPORT_SECTIONS.stages.sheet, intro,
      [{ header: 'Stage', key: 'stage' }, { header: 'Suppliers', key: 'count', numFmt: FMT_INT }],
      report.stages.map(s => ({ stage: s.name, count: s.count })));
    if (hasRows) addTotalsRow(ws, { stage: 'Total', count: total('count', report.stages.reduce((a, s) => a + s.count, 0)) });
  },

  commodities: shareSheet('Commodity', r => r.commodities.map(c => ({ name: c.name, count: c.value })), 'commodities'),
  countries: shareSheet('Country', r => r.countries, 'countries'),

  // The on-screen bar becomes "% of 2026 need" (the real, uncapped share — the
  // bar itself stops at 100%) plus a Status column naming its colour band.
  // Blank cells mean "not applicable": no need set, no 2027 need yet, or
  // nothing remaining once the need is met.
  strategy: (wb, report, intro) => {
    const rows = report.strategy;
    const { ws, total, hasRows } = addTableSheet(wb, REPORT_SECTIONS.strategy.sheet, intro,
      [
        { header: 'Commodity', key: 'commodity' },
        { header: 'Need 2026', key: 'need', numFmt: FMT_INT },
        { header: 'Need 2027', key: 'need2027', numFmt: FMT_INT },
        { header: 'Suppliers in pipeline', key: 'total', numFmt: FMT_INT },
        { header: '% of 2026 need', key: 'progress', numFmt: FMT_PCT },
        { header: 'Remaining 2026', key: 'remaining', numFmt: FMT_INT },
        { header: 'Fully closed (Completed / Intelex L2)', key: 'achieved', numFmt: FMT_INT },
        { header: 'Status', key: 'status' },
      ],
      rows.map(r => ({
        commodity: r.commodity,
        need: r.kind === 'target' ? r.need : null,
        need2027: r.need2027,
        total: r.total,
        progress: r.kind === 'target' ? fractionOf(r.total, r.need) : null,
        remaining: r.remaining,
        achieved: r.achieved,
        status: strategyStatus(r),
      })));
    if (hasRows) {
      const add = (key: 'need' | 'total' | 'achieved') => total(key, rows.reduce((a, r) => a + r[key], 0));
      addTotalsRow(ws, {
        commodity: 'Total', need: add('need'), total: add('total'),
        remaining: total('remaining', rows.reduce((a, r) => a + (r.remaining ?? 0), 0)),
        achieved: add('achieved'),
      });
    }
  },

  eventStatus: (wb, report, intro) => {
    const { ws, total, hasRows } = addTableSheet(wb, REPORT_SECTIONS.eventStatus.sheet, intro,
      [{ header: 'Status', key: 'status' }, { header: 'Events', key: 'count', numFmt: FMT_INT }],
      report.eventStatus.map(e => ({ status: e.name, count: e.value })));
    if (hasRows) addTotalsRow(ws, { status: 'Total', count: total('count', report.eventStatus.reduce((a, e) => a + e.value, 0)) });
  },

  conversion: (wb, report, intro) => {
    const { ws, total, hasRows } = addTableSheet(wb, REPORT_SECTIONS.conversion.sheet, intro,
      [
        { header: 'Event', key: 'event' },
        { header: 'Evaluated', key: 'evaluated', numFmt: FMT_INT },
        { header: 'Included', key: 'included', numFmt: FMT_INT },
        { header: 'Conversion %', key: 'conversion', numFmt: FMT_PCT },
      ],
      report.conversion.map(c => ({
        event: c.name, evaluated: c.evaluated, included: c.included, conversion: fractionOf(c.included, c.evaluated),
      })));
    if (hasRows) {
      const evaluated = report.conversion.reduce((a, c) => a + c.evaluated, 0);
      const included = report.conversion.reduce((a, c) => a + c.included, 0);
      const totals = addTotalsRow(ws, {
        event: 'Total',
        evaluated: total('evaluated', evaluated),
        included: total('included', included),
      });
      // Overall rate = total included / total evaluated — not the mean of the per-event rates.
      const b = ws.getColumn('evaluated').letter;
      const c = ws.getColumn('included').letter;
      totals.getCell('conversion').value = {
        formula: `IF(${b}${totals.number}=0,0,${c}${totals.number}/${b}${totals.number})`,
        result: fractionOf(included, evaluated),
      };
    }
  },

  buyerGroups: (wb, report, intro) => {
    const rows = report.buyerGroups.flatMap(g => g.rows.map(r => ({ stage: g.stage, buyer: r.buyer, count: r.count })));
    const { ws, total, hasRows } = addTableSheet(wb, REPORT_SECTIONS.buyerGroups.sheet, intro,
      [{ header: 'Stage', key: 'stage' }, { header: 'Buyer', key: 'buyer' }, { header: 'Suppliers', key: 'count', numFmt: FMT_INT }],
      rows);
    if (hasRows) addTotalsRow(ws, { stage: 'Total', count: total('count', rows.reduce((a, r) => a + r.count, 0)) });
  },
};

function newWorkbook(ExcelJS: Awaited<ReturnType<typeof loadExcelJS>>, report: VisualsReport, title: string): Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SSD Tracker';
  wb.created = report.generatedAt;
  wb.title = title;
  return wb;
}

function buildWorkbook(ExcelJS: Awaited<ReturnType<typeof loadExcelJS>>, report: VisualsReport): Workbook {
  const wb = newWorkbook(ExcelJS, report, `${REPORT_TITLE} — ${report.periodLabel} (${report.range.display})`);
  addSummarySheet(wb, report);
  // Each sheet opens with its own filter sentence, so a report whose cards
  // carry different filters is unambiguous sheet by sheet.
  (Object.keys(SHEET_WRITERS) as ReportSectionKey[]).forEach(key => {
    SHEET_WRITERS[key](wb, report, scopeLines(report.scopes[key]));
  });

  addTableSheet(wb, 'Suppliers', scopeLines(report.scopes.suppliers),
    [
      { header: 'Folio', key: 'folio' },
      { header: 'Name', key: 'name' },
      { header: 'Stage', key: 'stage' },
      { header: 'Commodity', key: 'commodity' },
      { header: 'Country', key: 'country' },
      { header: 'Buyer', key: 'buyer' },
      { header: 'Onboarding date', key: 'onboardingDate', numFmt: FMT_DATE, width: 18 },
    ],
    report.suppliers.map(s => ({ ...s, onboardingDate: excelDate(s.onboardingDate) })));

  return wb;
}

async function download(wb: Workbook, filename: string): Promise<string> {
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
  return filename;
}

/** Builds the full-report workbook and downloads it; resolves to the filename used. */
export async function exportVisualsExcel(report: VisualsReport): Promise<string> {
  const ExcelJS = await loadExcelJS();
  return download(buildWorkbook(ExcelJS, report), reportFilename(report, 'xlsx'));
}

/**
 * One card's download: a single sheet with the card title, its filter
 * sentence and the generated stamp above the same table the full report has
 * for that card. Resolves to the filename used.
 */
export async function exportVisualsSectionExcel(report: VisualsReport, section: ReportSectionKey): Promise<string> {
  const ExcelJS = await loadExcelJS();
  const { title } = REPORT_SECTIONS[section];
  const scope = report.scopes[section];
  const wb = newWorkbook(ExcelJS, report, `${title} — ${scope.summary}`);
  SHEET_WRITERS[section](wb, report, [
    { text: title, kind: 'title' },
    ...scopeLines(scope),
    { text: `Generated: ${formatGeneratedAt(report.generatedAt)}`, kind: 'meta' },
  ]);
  return download(wb, sectionFilename(report, section, 'xlsx'));
}
