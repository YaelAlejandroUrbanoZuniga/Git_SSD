// Browser-native CSV export — no libraries. Builds a CSV string in memory and
// triggers a download via a Blob + temporary <a download> link.

function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /["\n,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCsvValue(row[h])).join(',')),
  ];
  return lines.join('\n');
}

function triggerDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Downloads `rows` as a CSV file. Returns false (no download) when `rows` is empty. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  triggerDownload(filename, toCsv(rows));
  return true;
}

export interface CsvSection {
  title: string;
  rows: Record<string, unknown>[];
}

/**
 * Downloads several labeled datasets as a single CSV file, one section per
 * block (a '# Title' marker line, its own header row, then its data rows).
 * Sections with no rows are skipped. Returns false when every section is empty.
 */
export function downloadMultiSectionCsv(filename: string, sections: CsvSection[]): boolean {
  const nonEmpty = sections.filter(s => s.rows.length > 0);
  if (nonEmpty.length === 0) return false;
  const blocks = nonEmpty.map(({ title, rows }) => `# ${title}\n${toCsv(rows)}`);
  triggerDownload(filename, blocks.join('\n\n'));
  return true;
}

/** 'YYYY-MM-DD' for today, local time — used to date exported filenames. */
export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
