// Tolerant client-side parser for prospect Excel lists.
//
// `PROSPECT_COLUMNS` (prospectTemplate.ts) is the contract, but the template it
// generates is a convenience, not a requirement: a file built from scratch by
// the event organizer must still import. `mapProspectRows` is the pure core (no
// `xlsx` import, takes a plain 2-D array) so it is testable without a File or
// SheetJS; `parseProspectWorkbook` is a thin wrapper that reads a File into that
// same shape.

import { MAX_PROSPECT_ROWS, PROSPECT_COLUMNS, type ProspectColumn } from './prospectTemplate';

export interface ProspectRow {
  companyName: string;
  productType: string | null;
  website: string | null;
  sourceRow: number;
}

export interface ProspectRowError {
  sourceRow: number;
  reason: string;
}

export interface ProspectDuplicate {
  sourceRow: number;
  companyName: string;
}

export interface ParseResult {
  rows: ProspectRow[];
  errors: ProspectRowError[];
  duplicates: ProspectDuplicate[];
  /** 1-based, as the user sees it in Excel. */
  detectedHeaderRow: number;
}

const HEADER_SCAN_LIMIT = 10;

const [COMPANY_COLUMN, PRODUCT_COLUMN, WEBSITE_COLUMN] = PROSPECT_COLUMNS;

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Trimmed plain string for any cell value — never "[object Object]", never a raw serial number for dates. */
function coerceCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // SheetJS's `cellDates: true` hands back UTC-anchored Date objects — read the
    // UTC fields, not local ones, or the day shifts by one near a UTC-negative timezone.
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return normalizeSpace(String(value));
}

/** Uppercase, accent/punctuation-free header text, for alias matching. */
function normalizeHeaderText(raw: unknown): string {
  const upper = stripAccents(coerceCell(raw)).toUpperCase();
  return normalizeSpace(upper.replace(/[^A-Z0-9 ]+/g, ' '));
}

const ALIAS_MAP: Map<string, ProspectColumn['key']> = new Map(
  PROSPECT_COLUMNS.flatMap(col => col.aliases.map(alias => [normalizeHeaderText(alias), col.key] as const)),
);

function firstIndexForKey(columnMap: Map<number, ProspectColumn['key']>, key: ProspectColumn['key']): number | undefined {
  for (const [idx, k] of columnMap) if (k === key) return idx;
  return undefined;
}

/**
 * Scans the first HEADER_SCAN_LIMIT rows for the one matching the most known
 * aliases while including a COMPANY NAME alias — tolerates a logo/title row
 * above the table and columns in any order.
 */
function findHeaderRow(cells: unknown[][]): { index: number; columnMap: Map<number, ProspectColumn['key']> } {
  let best: { index: number; columnMap: Map<number, ProspectColumn['key']> } | null = null;
  let bestScore = 0;
  const limit = Math.min(cells.length, HEADER_SCAN_LIMIT);

  for (let i = 0; i < limit; i++) {
    const row = cells[i] ?? [];
    const columnMap = new Map<number, ProspectColumn['key']>();
    for (let c = 0; c < row.length; c++) {
      const key = ALIAS_MAP.get(normalizeHeaderText(row[c]));
      if (key !== undefined) columnMap.set(c, key);
    }
    const hasCompanyName = [...columnMap.values()].includes('companyName');
    if (hasCompanyName && columnMap.size > bestScore) {
      best = { index: i, columnMap };
      bestScore = columnMap.size;
    }
  }

  if (!best) {
    const expected = PROSPECT_COLUMNS.map(c => c.header).join(', ');
    throw new Error(`Could not find a header row with the expected columns (${expected}) in the first ${HEADER_SCAN_LIMIT} rows.`);
  }
  return best;
}

/**
 * Pure mapping from a raw 2-D cell grid (as SheetJS or any spreadsheet reader would
 * hand back) to validated prospect rows. Matches columns by normalized header text,
 * never by position, so reordered or inserted columns don't break the import.
 */
export function mapProspectRows(cells: unknown[][]): ParseResult {
  const { index: headerIndex, columnMap } = findHeaderRow(cells);
  const companyCol = firstIndexForKey(columnMap, 'companyName');
  const productCol = firstIndexForKey(columnMap, 'productType');
  const websiteCol = firstIndexForKey(columnMap, 'website');

  const rows: ProspectRow[] = [];
  const errors: ProspectRowError[] = [];
  const duplicates: ProspectDuplicate[] = [];
  const seen = new Set<string>();
  let dataRowCount = 0;

  for (let i = headerIndex + 1; i < cells.length; i++) {
    const row = cells[i] ?? [];
    const sourceRow = i + 1;

    if (row.every(v => coerceCell(v) === '')) continue; // fully blank row — not an error

    dataRowCount++;
    if (dataRowCount > MAX_PROSPECT_ROWS) {
      throw new Error(`This file has more than ${MAX_PROSPECT_ROWS} companies, which is the maximum allowed per import.`);
    }

    const companyName = companyCol !== undefined ? coerceCell(row[companyCol]) : '';
    const productType = productCol !== undefined ? coerceCell(row[productCol]) : '';
    const website = websiteCol !== undefined ? coerceCell(row[websiteCol]) : '';

    if (!companyName) {
      errors.push({ sourceRow, reason: `${COMPANY_COLUMN.header} is required.` });
      continue;
    }
    if (companyName.length > COMPANY_COLUMN.maxLength) {
      errors.push({ sourceRow, reason: `${COMPANY_COLUMN.header} exceeds ${COMPANY_COLUMN.maxLength} characters.` });
      continue;
    }
    if (productType.length > PRODUCT_COLUMN.maxLength) {
      errors.push({ sourceRow, reason: `${PRODUCT_COLUMN.header} exceeds ${PRODUCT_COLUMN.maxLength} characters.` });
      continue;
    }
    if (website.length > WEBSITE_COLUMN.maxLength) {
      errors.push({ sourceRow, reason: `${WEBSITE_COLUMN.header} exceeds ${WEBSITE_COLUMN.maxLength} characters.` });
      continue;
    }

    const dedupeKey = companyName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(dedupeKey)) {
      duplicates.push({ sourceRow, companyName });
      continue;
    }
    seen.add(dedupeKey);

    rows.push({ companyName, productType: productType || null, website: website || null, sourceRow });
  }

  return { rows, errors, duplicates, detectedHeaderRow: headerIndex + 1 };
}

/** Reads the first sheet of `file` (whatever its name) and maps it via `mapProspectRows`. */
export async function parseProspectWorkbook(file: File): Promise<ParseResult> {
  const [XLSX, buffer] = await Promise.all([import('xlsx'), file.arrayBuffer()]);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The workbook has no sheets.');
  const cells = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: true,
    defval: null,
  });
  return mapProspectRows(cells);
}
