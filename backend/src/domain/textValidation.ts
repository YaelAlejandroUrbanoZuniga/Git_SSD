import { ValidationError } from './errors';

// Validación compartida de "texto con contenido real" — usada por notas
// (notesService) y razones de rechazo (blacklistSupplier) y notas de cambio de
// etapa (moveSupplierToStage). Una sola regla, un solo lugar.
//
// Valores PROVISIONALES — GSM todavía no confirma el rango exacto ni la lista de
// basura completa (ver transcripción de junta del 20-jul). Cambiar aquí, un solo
// lugar, cuando lo confirmen.
export const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
/**
 * Filler values that are technically text but say nothing. Exported because
 * data-import/import-rest.ts applies the SAME list in a non-throwing form
 * (`meaningful()`), and the two copies had to be kept in step by hand.
 */
export const JUNK_VALUES = new Set([
  'na', 'n/a', 'ok', 'okay', 'ninguna', 'ninguno', 'n/d', '-', '.', '...', 'x',
]);

/**
 * Ensures `text` is a real, specific string. Trims it and rejects empty,
 * too-short, too-long, and known filler values. Returns the trimmed text.
 */
export function assertMeaningfulText(text: unknown, fieldLabel: string): string {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new ValidationError(`${fieldLabel} is required`);
  if (trimmed.length < MIN_LENGTH) throw new ValidationError(`${fieldLabel} must be at least ${MIN_LENGTH} characters`);
  if (trimmed.length > MAX_LENGTH) throw new ValidationError(`${fieldLabel} must be under ${MAX_LENGTH} characters`);
  if (JUNK_VALUES.has(trimmed.toLowerCase())) {
    throw new ValidationError(`${fieldLabel} must describe the reason — "${trimmed}" isn't specific enough`);
  }
  return trimmed;
}

/**
 * The project's single email-shape rule. Lives here rather than in one service
 * so the four endpoints that accept an address apply the SAME check:
 * usersService.createUser, POST /api/suppliers, POST /api/events and
 * POST /api/events/:id/suppliers.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Predicate for an OPTIONAL email field on the wire. An empty string means "not
 * captured" — the mapper sends `''` for an address that was never filled in, and
 * the frontend posts that value straight back, so rejecting it would break forms
 * that simply never had a contact email. Any NON-empty value must look like one.
 */
export function isOptionalEmail(value: string): boolean {
  return value === '' || EMAIL_RE.test(value);
}
