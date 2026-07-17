import { EMPLOYEE_RANGES } from '../../../constants/catalogs';
import type { CreateSupplierInput } from '../../../services/suppliersService';

const OTHER = 'Other';

// Splits a registration form into: `core` (POST /suppliers, fixed 17-field schema),
// `profile` (PATCH /suppliers/:id → satellite tables), and `unmapped` (no column →
// saved as a note). Full unmapped list: backend/README.md §"Formularios A/B".

export interface FormPayload {
  core: CreateSupplierInput;
  profile: Record<string, unknown>;
  /** Question label → answer, for questions with no column. */
  unmapped: Record<string, string>;
}

/** Drops empty/blank entries so a PATCH never overwrites a column with "". */
export function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) =>
      v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)),
  );
}

/** Multi-selects are stored as one delimited string (the columns are NVarChar). */
export function joinList(values: string[]): string {
  return values.join(', ');
}

/**
 * Resolves a single-select whose value may be "Other": when it is and the user
 * typed a specification, returns `Other: <text>`; otherwise the plain value.
 */
export function resolveOther(value: string, otherText: string): string {
  return value === OTHER && otherText.trim() ? `${OTHER}: ${otherText.trim()}` : value;
}

/** Same for a multi-select: joins the picks, expanding "Other" to `Other: <text>`. */
export function joinListWithOther(values: string[], otherText: string): string {
  return values.map(v => (v === OTHER ? resolveOther(v, otherText) : v)).join(', ');
}

/**
 * `T_Supplier_CommercialInfo.Employees` is an Int, but the spec asks for a
 * range. Only the lower bound survives — the range label itself has no column.
 */
export function employeesFromRange(rangeLabel: string): number | undefined {
  return EMPLOYEE_RANGES.find(r => r.label === rangeLabel)?.approxCount;
}

/** Renders the unanswerable-by-schema questions as a readable note body. */
export function unmappedNote(formName: string, unmapped: Record<string, string>): string | null {
  const filled = Object.entries(unmapped).filter(([, v]) => v.trim().length > 0);
  if (filled.length === 0) return null;
  return [
    `${formName} — answers with no field in the system yet:`,
    ...filled.map(([q, a]) => `• ${q}: ${a}`),
  ].join('\n');
}

/** 9 digits, per the spec ("Validado 9 dígitos"). Empty is allowed. */
export function isValidDuns(duns: string): boolean {
  return duns.trim() === '' || /^\d{9}$/.test(duns.trim());
}

export function isValidEmail(email: string): boolean {
  return email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Accepts a bare domain or a full URL — suppliers type both. */
export function isValidUrl(url: string): boolean {
  const v = url.trim();
  if (v === '') return true;
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v);
}
