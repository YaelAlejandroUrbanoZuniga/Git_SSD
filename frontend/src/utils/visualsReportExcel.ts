// Visuals "Export report" → formatted .xlsx workbook, via `exceljs` (SheetJS
// community edition, already used for the prospect import, cannot style cells).
// `exceljs` is loaded with `await import()` inside `exportVisualsExcel`, so
// Rollup gives it its own chunk, fetched only when someone actually exports.

import type { Cell, CellValue, Workbook, Worksheet } from 'exceljs';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import {
  REPORT_TITLE, downloadBlob, formatGeneratedAt, fractionOf, reportFilename, type VisualsReport,
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
 * One styled data sheet: brand-red header row, frozen and auto-filtered, body
 * rows with light borders and per-column number formats, widths sized to the
 * content. Returns the sheet and its last data row so a caller can append a
 * totals row below the filter range (sorting must never move the totals).
 */
function addTableSheet(wb: Workbook, name: string, columns: Column[], rows: Record<string, CellValue>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.min(60, Math.max(12,
      c.header.length + 4,
      ...rows.map(r => displayLength(r[c.key], c.numFmt) + 3),
    )),
    style: { font: { name: FONT }, ...(c.numFmt ? { numFmt: c.numFmt } : {}) },
  }));

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell(styleHeaderCell);

  if (rows.length === 0) {
    const cell = ws.getCell(2, 1);
    cell.value = 'No data for this period';
    cell.font = { name: FONT, italic: true, color: { argb: argb(BRAND_COLORS.sidebar) } };
  } else {
    ws.addRows(rows);
    for (let r = 2; r <= rows.length + 1; r++) {
      ws.getRow(r).eachCell({ includeEmpty: true }, cell => {
        cell.border = { bottom: thin(NEUTRAL_COLORS.borderLight) };
      });
    }
  }

  const lastRow = Math.max(1, rows.length + 1);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: columns.length } };
  return { ws, lastRow, hasRows: rows.length > 0 };
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

/** `SUM(<col>2:<col>last)`, carrying its computed result so it shows without recalculation. */
function sum(ws: Worksheet, key: string, lastRow: number, result: number): CellValue {
  const col = ws.getColumn(key).letter;
  return { formula: `SUM(${col}2:${col}${lastRow})`, result };
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

function buildWorkbook(ExcelJS: Awaited<ReturnType<typeof loadExcelJS>>, report: VisualsReport): Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SSD Tracker';
  wb.created = report.generatedAt;
  wb.title = `${REPORT_TITLE} — ${report.periodLabel} (${report.range.display})`;

  addSummarySheet(wb, report);

  {
    const { ws, lastRow, hasRows } = addTableSheet(wb, 'Suppliers by Stage',
      [{ header: 'Stage', key: 'stage' }, { header: 'Suppliers', key: 'count', numFmt: FMT_INT }],
      report.stages.map(s => ({ stage: s.name, count: s.count })));
    if (hasRows) addTotalsRow(ws, { stage: 'Total', count: sum(ws, 'count', lastRow, report.stages.reduce((a, s) => a + s.count, 0)) });
  }

  // Commodity and country share one shape: name, count, % of the section's own
  // total (the same denominator the screen's percentages use — it equals Total
  // Suppliers unless that card has filters of its own set).
  const shareSheet = (name: string, label: string, rows: { name: string; count: number }[]) => {
    const total = rows.reduce((a, r) => a + r.count, 0);
    const { ws, lastRow, hasRows } = addTableSheet(wb, name,
      [
        { header: label, key: 'name' },
        { header: 'Suppliers', key: 'count', numFmt: FMT_INT },
        { header: '% of total', key: 'pct', numFmt: FMT_PCT },
      ],
      rows.map(r => ({ name: r.name, count: r.count, pct: fractionOf(r.count, total) })));
    if (hasRows) {
      addTotalsRow(ws, {
        name: 'Total',
        count: sum(ws, 'count', lastRow, total),
        pct: sum(ws, 'pct', lastRow, fractionOf(total, total)),
      });
    }
  };
  shareSheet('Distribution by Commodity', 'Commodity', report.commodities.map(c => ({ name: c.name, count: c.value })));
  shareSheet('Geographic Distribution', 'Country', report.countries);

  {
    const { ws, lastRow, hasRows } = addTableSheet(wb, 'Events by Status',
      [{ header: 'Status', key: 'status' }, { header: 'Events', key: 'count', numFmt: FMT_INT }],
      report.eventStatus.map(e => ({ status: e.name, count: e.value })));
    if (hasRows) addTotalsRow(ws, { status: 'Total', count: sum(ws, 'count', lastRow, report.eventStatus.reduce((a, e) => a + e.value, 0)) });
  }

  {
    const { ws, lastRow, hasRows } = addTableSheet(wb, 'Conversion per Event',
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
        evaluated: sum(ws, 'evaluated', lastRow, evaluated),
        included: sum(ws, 'included', lastRow, included),
      });
      // Overall rate = total included / total evaluated — not the mean of the per-event rates.
      const b = ws.getColumn('evaluated').letter;
      const c = ws.getColumn('included').letter;
      totals.getCell('conversion').value = {
        formula: `IF(${b}${totals.number}=0,0,${c}${totals.number}/${b}${totals.number})`,
        result: fractionOf(included, evaluated),
      };
    }
  }

  {
    const rows = report.buyerGroups.flatMap(g => g.rows.map(r => ({ stage: g.stage, buyer: r.buyer, count: r.count })));
    const { ws, lastRow, hasRows } = addTableSheet(wb, 'Buyer by Stage',
      [{ header: 'Stage', key: 'stage' }, { header: 'Buyer', key: 'buyer' }, { header: 'Suppliers', key: 'count', numFmt: FMT_INT }],
      rows);
    if (hasRows) addTotalsRow(ws, { stage: 'Total', count: sum(ws, 'count', lastRow, rows.reduce((a, r) => a + r.count, 0)) });
  }

  addTableSheet(wb, 'Suppliers',
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

/** Builds the workbook and downloads it; resolves to the filename used. */
export async function exportVisualsExcel(report: VisualsReport): Promise<string> {
  const ExcelJS = await loadExcelJS();
  const wb = buildWorkbook(ExcelJS, report);
  const buffer = await wb.xlsx.writeBuffer();
  const filename = reportFilename(report, 'xlsx');
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
  return filename;
}
