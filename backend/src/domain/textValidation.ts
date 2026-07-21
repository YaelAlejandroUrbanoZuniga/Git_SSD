import { ValidationError } from './errors';

// Validación compartida de "texto con contenido real" — usada por notas
// (notesService) y razones de rechazo (blacklistSupplier) y notas de cambio de
// etapa (moveSupplierToStage). Una sola regla, un solo lugar.
//
// Valores PROVISIONALES — GSM todavía no confirma el rango exacto ni la lista de
// basura completa (ver transcripción de junta del 20-jul). Cambiar aquí, un solo
// lugar, cuando lo confirmen.
const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
const JUNK_VALUES = new Set(['na', 'n/a', 'ok', 'okay', 'ninguna', 'ninguno', 'n/d', '-', '.', '...', 'x']);

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
