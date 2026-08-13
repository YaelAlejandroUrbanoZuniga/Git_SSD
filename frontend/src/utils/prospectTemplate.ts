// Prospect Excel template — single source of truth for the prospect import format.
//
// SSD receives, from the event organizer, a list of companies expected to attend a
// scouting event (filtered by GSM to Direct suppliers only). These companies are
// PROSPECTS, not suppliers — they never touch T_Supplier until they fill the
// external form on event day. `PROSPECT_COLUMNS` is read by both the template
// generator below and the parser in `parseProspectWorkbook.ts`, so the two can
// never drift apart.
//
// The template itself is generated in memory with SheetJS and never committed as a
// binary .xlsx — a checked-in file would silently drift from PROSPECT_COLUMNS.

import * as XLSX from 'xlsx';

export interface ProspectColumn {
  key: 'companyName' | 'productType' | 'website';
  header: string;
  required: boolean;
  maxLength: number;
  aliases: readonly string[];
}

export const PROSPECT_COLUMNS: readonly ProspectColumn[] = [
  {
    key: 'companyName',
    header: 'COMPANY NAME',
    required: true,
    maxLength: 200,
    aliases: ['COMPANY', 'COMPANY NAME', 'NOMBRE', 'EMPRESA', 'NOMBRE DE LA EMPRESA'],
  },
  {
    key: 'productType',
    header: 'TYPE OF PRODUCT',
    required: false,
    maxLength: 200,
    aliases: ['TYPE OF PRODUCT', 'PRODUCT', 'PRODUCT TYPE', 'PRODUCTO', 'TIPO DE PRODUCTO'],
  },
  {
    key: 'website',
    header: 'WEBSITE',
    required: false,
    maxLength: 100,
    aliases: ['WEBSITE', 'WEB', 'SITIO WEB', 'PAGINA WEB', 'URL'],
  },
] as const;

export const TEMPLATE_MARKER = 'SSD_PROSPECT_TEMPLATE_V1';
export const MAX_PROSPECT_ROWS = 500;

const EXAMPLE_ROWS: [string, string, string][] = [
  ['Acme Manufacturing Corp', 'Stamped metal components', 'https://acme-mfg.example.com'],
  ['Bosch Precision Parts', 'Injection molded plastics', 'https://bosch-precision.example.com'],
  ['Global Wire Solutions', '', ''],
  ['Nexteer Tooling Partners', 'CNC machining', ''],
];

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildProspectsSheet(): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([PROSPECT_COLUMNS.map(c => c.header)]);
  ws['!cols'] = [{ wch: 45 }, { wch: 40 }, { wch: 35 }];
  return ws;
}

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    [TEMPLATE_MARKER],
    [],
    ['Instructions'],
    ['Fill the "Prospects" sheet only.'],
    ['One company per row, starting at row 2 (row 1 is the header).'],
    ['COMPANY NAME is mandatory. TYPE OF PRODUCT and WEBSITE may be left empty.'],
    ['Direct suppliers only.'],
    ['Do not merge cells, add totals, or insert extra header rows.'],
    [`Maximum ${MAX_PROSPECT_ROWS} companies per file.`],
    [],
    ['Field reference'],
    ['Column', 'Required', 'Max length'],
    ...PROSPECT_COLUMNS.map(c => [c.header, c.required ? 'Yes' : 'No', String(c.maxLength)]),
    [],
    ['Examples'],
    [...PROSPECT_COLUMNS.map(c => c.header)],
    ...EXAMPLE_ROWS,
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

/**
 * Builds the prospect import workbook in memory and triggers a browser download.
 * `eventName`, when given, names the file after the event; otherwise a generic name.
 */
export function downloadProspectTemplate(eventName?: string): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildProspectsSheet(), 'Prospects');
  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions');

  const fileName = eventName && eventName.trim()
    ? `SSD_Prospects_${slugify(eventName)}.xlsx`
    : 'SSD_Prospects_Template.xlsx';

  XLSX.writeFile(wb, fileName);
}
