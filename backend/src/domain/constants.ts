// Controlled vocabularies enforced at the service layer (no SQL enums).

export const TRACKER_STAGES = [
  'Scouting Event',
  'Parking Lot',
  'Preliminary Evaluation',
  'Supplier Evaluation',
  'Intelex Handoff',
  'Blacklisted',
  'Completed',
] as const;
export type TrackerStage = (typeof TRACKER_STAGES)[number];

export const SUPPLIER_STATUS = ['ACTIVE', 'BLACKLISTED', 'COMPLETED'] as const;

export const SUB_STATUSES = ['Go', 'No Go', 'Under Evaluation', 'On Hold'] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];

// 'Guest' is the least-privilege role granted on first login (see authService).
// SSD is the master role (user administration). PM/Buyer/SDE are operational,
// but SDE is read-only (blocked from write routes — see app.ts / routes/*).
export const APP_ROLES = ['SSD', 'PM', 'Buyer', 'SDE', 'Guest'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const SLA_VALUES = ['green', 'yellow', 'red'] as const;
export type SlaValue = (typeof SLA_VALUES)[number];

export const PRODUCT_CATEGORIES = ['Direct', 'Indirect'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CONFIDENCE_LEVELS = [
  { code: 'H', label: 'High', sortOrder: 0 },
  { code: 'M', label: 'Medium', sortOrder: 1 },
  { code: 'L', label: 'Low', sortOrder: 2 },
  { code: 'TBD', label: 'To Be Defined', sortOrder: 3 },
] as const;

export const IMMEX_STATUSES = ['Yes', 'No', 'In Plan', 'TBC'] as const;
export type ImmexStatus = (typeof IMMEX_STATUSES)[number];

/**
 * Form A Q34 ("Certificación IMMEX") asks ONE question, and this is how its
 * answer travels: one of three strings, never a pair of booleans. Every client —
 * the in-app External Registration form and, later, Power Automate — sends
 * exactly one of these, which is why the labels are the vendor-facing wording
 * rather than the catalog's.
 *
 * `services/catalogMapping.ts` is the only place that turns one of these into an
 * `IMMEX_STATUSES` name, and the mapping is deliberately not the identity: the
 * two "No…" answers differ only in whether a plan exists, which the catalog
 * models as 'No' vs 'In Plan'.
 *
 * 'TBC' is intentionally absent: it is a catalog value for records whose IMMEX
 * status was never established, not an answer this question can produce.
 */
export const IMMEX_ANSWERS = ['Yes', 'No, with a plan', 'No, without a plan'] as const;
export type ImmexAnswer = (typeof IMMEX_ANSWERS)[number];

/**
 * Placeholder commodity (valor 37 del catálogo) para proveedores cuyo commodity
 * GSM todavía no ha definido. Nombrado y exportado porque ahora tiene más de un
 * productor — el intake del formulario externo se lo asigna cuando el proveedor
 * no elige commodity (domain/formIntakeMapper.ts) — y la cadena exacta debe
 * vivir UNA sola vez en el backend. Espejo de PENDING_GSM_COMMODITY en
 * frontend/src/constants/catalogs.ts.
 */
export const PENDING_GSM_COMMODITY = 'TBD -- Pending GSM';

// Catálogo oficial Nexteer (36 commodities) + 1 placeholder temporal
// 'TBD -- Pending GSM' (ver nota al final del array). No modificar los 36 sin
// instrucción. Las 7 subdivididas usan orden "Subcategoría -- Categoría" (GSM,
// 2026-07-17).
export const COMMODITIES = [
  'CCA -- Controllers',
  'MSB -- Controllers',
  'PHA -- Controllers',
  'Headers -- E-Mechanical Components',
  'Connectors -- E-Mechanical Components',
  'Leadframe -- E-Mechanical Components',
  'PCB -- E-Mechanical Components',
  'Castings',
  'Motors',
  'Machining',
  'Driveline',
  'Assembly',
  'Bearing',
  'Tubing',
  'Forgings',
  'Stampings',
  'Steel',
  'Rubber',
  'Plastic',
  'Allied',
  'Fasteners',
  'Extrusions',
  'Powder Metal',
  'Grease',
  'Explosives',
  'O/S Process',
  'Chemicals',
  'Magnets',
  'Springs',
  'Directed Buy',
  'Harnesses',
  'Resins',
  'Service',
  'Controller',
  'Labels',
  'Electronics MSB',
  // Placeholder (value 37) for suppliers whose commodity GSM has not defined yet:
  // those still in Scouting Event (where the commodity is not determined) and
  // those whose source Excel carried an aggregated value like
  // "E-MECHANICAL COMPONENTS -- HEADERS, CONNECTORS, LEADFRAME, PCB". Temporary —
  // replaced with an UPDATE once GSM confirms the definitive values.
  PENDING_GSM_COMMODITY,
] as const;
export type Commodity = (typeof COMMODITIES)[number];

export const TRACKER_STAGE_CONFIG = [
  { name: 'Scouting Event', color: '#02B3E1', icon: 'fa-binoculars' },
  { name: 'Parking Lot', color: '#D4A017', icon: 'fa-circle-pause' },
  { name: 'Preliminary Evaluation', color: '#E3650B', icon: 'fa-clipboard-check' },
  { name: 'Supplier Evaluation', color: '#C026D3', icon: 'fa-file-contract' },
  { name: 'Intelex Handoff', color: '#0084C0', icon: 'fa-handshake' },
] as const;

/** Stage order index for transition validation. */
export function stageIndex(stage: string): number {
  return TRACKER_STAGES.indexOf(stage as TrackerStage);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Day-precision 'YYYY-MM-DD' → a real timestamp at NOON UTC.
 *
 * Noon, not midnight: midnight UTC falls on the PREVIOUS calendar day in the
 * local UTC-6 timezone, which shifts every day-precision date back by one.
 */
export function atNoonUTC(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00.000Z`);
}

/**
 * Tolerant form of `atNoonUTC` for values that may not be dates at all: applies
 * the noon rule to a day-precision string, parses anything else as-is, and
 * returns null when the result is not a real date ('TBC', '', free text).
 */
export function toNoonUTCOrNull(raw: string): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? atNoonUTC(raw) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
