// Where a supplier came from. `T_Supplier` has no `Origin` column, so the folio
// prefix is the ONLY source of truth on that question: rows created in the app
// (external registration form, internal recommendation, event intake) get the
// native `SSD-<year>-NNNN` sequence, while the Excel migration allocates its own
// `XL-SSD-<year>-NNNN` range (backend/data-import/import-suppliers.ts, whose
// nextFolio() deliberately excludes `XL-` so the two never interleave).
//
// The rule lives isolated in this file precisely because it is a string
// convention standing in for a missing column: when `Origin` does land on
// `T_Supplier`, this is the one place that has to change, and every caller
// (externalFormGate, supplierMapper) keeps reading the same predicate.

export const EXCEL_FOLIO_PREFIX = 'XL-';

/** True when this folio belongs to the Excel-migrated range (case-insensitive). */
export function isExcelMigrated(folio: string | null | undefined): boolean {
  if (!folio) return false;
  return folio.trim().toUpperCase().startsWith(EXCEL_FOLIO_PREFIX);
}
