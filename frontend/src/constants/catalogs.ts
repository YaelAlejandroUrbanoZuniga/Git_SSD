// Runtime catalogs (C_* tables of the SSD data model).
//
// The values here were already declared in the app as TypeScript union types,
// which cannot be enumerated at runtime to populate a <select>. This module is
// the runtime source of truth; `src/types/index.ts` derives its types from it,
// so a value can never drift between the type and the dropdown.
//
// Keep in sync with backend/src/domain/constants.ts.

/** C_Commodity — official Nexteer catalog (36 values). Do not modify without instruction.
 *  The 7 subdivided values use "Subcategory -- Category" order (GSM, 2026-07-17).
 *
 *  Note: the backend catalog has a 37th value, `PENDING_GSM_COMMODITY` below. It is
 *  a backend-validated value but intentionally kept OUT of this dropdown list — it is
 *  auto-assigned when GSM has not defined a commodity yet, never picked by hand. A
 *  supplier that already carries it still renders (CatalogSelect keeps an unknown
 *  stored value as an extra option). */
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
] as const;

/** C_Commodity placeholder (backend value 37). Assigned automatically when GSM has
 *  not defined the commodity yet — e.g. a supplier still in Scouting Event, or one
 *  imported from an Excel that carried an aggregated commodity value. Replaced with a
 *  real commodity when the supplier reaches Parking Lot (GSM defines it there).
 *  Kept out of COMMODITIES so it is never offered as a pickable option. Typed as a
 *  plain `string` on purpose: it sits outside the strict `Commodity` union, so code
 *  can compare a `Commodity`-typed value against it (a supplier can carry it at
 *  runtime even though the union doesn't list it). */
export const PENDING_GSM_COMMODITY: string = 'TBD -- Pending GSM';

/** C_SubStatus — Go/No-Go decision state of a supplier within a stage. */
export const SUB_STATUSES = ['Go', 'No Go', 'Under Evaluation', 'On Hold'] as const;

/** C_EntrySource */
export const ENTRY_SOURCES = ['Scouting Event', 'Recommendation'] as const;

/** C_ConfidenceLevel — full labels, used on the supplier assessment. */
export const CONFIDENCE_LEVELS = ['High', 'Medium', 'Low'] as const;

/** C_ConfidenceLevel — short codes, used per part on the competitiveness table. */
export const PART_CONFIDENCE_LEVELS = [
  { code: 'H', label: 'High' },
  { code: 'M', label: 'Medium' },
  { code: 'L', label: 'Low' },
] as const;

/** Per-part cost classification on the competitiveness table — two fixed
 * values, not backed by a catalog table. */
export const PART_COST_TYPES = [
  { code: 'Saving', label: 'Saving' },
  { code: 'Impact', label: 'Impact' },
] as const;

/** C_ImmexStatus */
export const IMMEX_STATUSES = ['Yes', 'No', 'In Plan', 'TBC'] as const;

/** C_Priority — 1 (highest) to 3 (lowest). */
export const PRIORITIES = [
  { value: 1, label: '1 — High' },
  { value: 2, label: '2 — Medium' },
  { value: 3, label: '3 — Low' },
] as const;

/** C_PrimaryDriver — business reason a supplier is being pursued. */
export const PRIMARY_DRIVERS = [
  'Dual Source',
  'Supplier Back Up',
  'Savings',
  'Quality',
  'Capacity',
  'New Technology',
  'Full Resiliency GM',
  'USMCA',
  'MCIP',
  'Leadtime / Delivery',
  'Strategy Consolidation',
  'Technical Knowledge',
  'Sub Supplier',
] as const;

/** Yes/No answers stored as single characters (fundamentals, IMMEX plan). */
export const YES_NO_CODES = [
  { code: 'Y', label: 'Yes' },
  { code: 'N', label: 'No' },
] as const;

/** Yes/No answers stored as full words (B2B meeting). */
export const YES_NO_WORDS = ['Yes', 'No'] as const;

// ── Supplier registration forms (A / B) ─────────────────────────────────
//
// Option lists for the questions marked "Definido" in
// Propuesta_Formularios_Proveedores_v2.pdf — i.e. the ones whose options are
// already agreed, as opposed to the ones still pending GSM confirmation, which
// live in `catalogs-pending-gsm.ts`. These are form vocabularies rather than
// C_* lookup tables, so they are not FK-validated by the backend.

/** Form A Q4 / Q20 / Q21, Form B Q8 — country selects. */
export const COUNTRIES = [
  'Mexico', 'United States', 'Canada', 'Brazil', 'Argentina',
  'Germany', 'France', 'Spain', 'Italy', 'Poland', 'Czech Republic',
  'Romania', 'United Kingdom', 'Turkey', 'Morocco',
  'China', 'Japan', 'South Korea', 'India', 'Thailand', 'Vietnam',
  'Other',
] as const;

/** Form A Q14 — "Sector de negocio". */
export const BUSINESS_SECTORS = [
  '100% Automotive',
  'Automotive + other industries',
  'Other',
] as const;

/** Form A Q18 — "Tipo de empresa". */
export const COMPANY_TYPES = ['Family', 'Public', 'Private'] as const;

/** Form A Q22 — "Presencia en" (multi-select checklist). */
export const PRESENCE_REGIONS = [
  'Mexico', 'United States', 'Europe', 'China', 'India', 'Other',
] as const;

/** Form A Q30 — "Enfoque de mercado". */
export const MARKET_FOCUS = [
  '100% Automotive',
  'Mixed',
  'Other',
] as const;

/**
 * Form A Q34 — "Certificación IMMEX". Sent verbatim as `immexAnswer`; the
 * backend maps each label to a C_ImmexStatus value (see catalogMapping.ts), so
 * these strings must stay identical to the backend's own `IMMEX_ANSWERS`.
 */
export const IMMEX_ANSWERS = ['Yes', 'No, with a plan', 'No, without a plan'] as const;

/** Form A Q38 — "Capacidad de diseño de herramental". */
export const TOOLING_DESIGN_CAPABILITY = [
  'In-house', 'Outsourced', 'Both', 'None',
] as const;

/** Form A Q7 — "How did you hear about Nexteer?" (confirmed by GSM, 2026-07-17). */
export const CONTACT_CHANNELS = [
  'Event', 'Social Media', 'Email', 'Other',
] as const;

/** Form A Q25 — "Number of employees" ranges (confirmed by GSM, 2026-07-17).
 *  `Employees` is an Int column, so only `approxCount` (lower bound) is persisted;
 *  "Large" uses 251 as a floor since it has no upper bound. */
export const EMPLOYEE_RANGES = [
  { label: 'Micro (1–10)', approxCount: 1 },
  { label: 'Small (11–50)', approxCount: 11 },
  { label: 'Medium (51–250)', approxCount: 51 },
  { label: 'Large (250+)', approxCount: 251 },
] as const;
