import { EMPLOYEE_RANGES } from '../../../constants/catalogs-pending-gsm';
import type { CreateSupplierInput } from '../../../services/suppliersService';

/**
 * Turns the two registration forms into what the API actually accepts.
 *
 * Three buckets, because the write surface is not uniform:
 *
 *  • `core`     → `POST /api/suppliers`. A fixed 17-field zod schema; anything
 *                 else is dropped silently, so nothing extra may be sent here.
 *  • `profile`  → `PATCH /api/suppliers/:id`. Routes flat fields to the
 *                 CompanyInfo / TechnicalInfo / CommercialInfo satellites. It
 *                 *rejects* unknown keys with a 400 listing them, so every key
 *                 below is one the backend explicitly accepts.
 *  • `unmapped` → questions the spec asks but the schema has nowhere to store.
 *                 Rather than discard a supplier's answers, they are written as
 *                 a supplier note (see `unmappedNote`). Adding columns for them
 *                 is a schema decision that is out of scope here — the full list
 *                 is in backend/README.md §"Formularios A/B — campos sin columna".
 */

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
