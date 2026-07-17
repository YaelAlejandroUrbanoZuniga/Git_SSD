// ⚠ PLACEHOLDER CATALOGS — NOT CONFIRMED BY GSM.
//
// Every catalog in this file backs one of the questions marked "Falta" (pending)
// in Propuesta_Formularios_Proveedores_v2.pdf: the exact list of options has NOT
// been agreed with GSM yet, so the values below are plausible stand-ins chosen
// only so the supplier forms can be built and demoed end to end.
//
// Rules for this file:
//   • Do NOT treat any value here as authoritative.
//   • Do NOT merge these into `catalogs.ts` — that file holds the real,
//     confirmed catalogs (COMMODITIES, C_* tables). This one is temporary.
//   • Once GSM confirms a list, move it to `catalogs.ts` and delete it here.
//
// Where the doc already proposed example options, those are reproduced verbatim
// (translated to English to match the UI); where it proposed none, the values
// are invented placeholders. Every list ends in "Other" so a supplier is never
// blocked by a missing option.

// NOTE: Q7 "How did you hear about Nexteer?" and Q25 "Number of employees" were
// confirmed by GSM (2026-07-17) and moved to catalogs.ts (CONTACT_CHANNELS,
// EMPLOYEE_RANGES). Q29 "Press capacity" is now a numeric input (no range catalog).

/** Q13 — "Proceso de manufactura principal".
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc ("Ej: Stamping, Machining, Casting, Forging, Molding, Electronics"). */
export const MANUFACTURING_PROCESSES = [
  'Stamping',
  'Machining',
  'Casting',
  'Forging',
  'Molding',
  'Electronics',
  'Other',
] as const;

/** Q28 — "Tecnología principal".
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  The doc proposes no options ("Catálogo de tecnologías + Otro (falta el catálogo exacto)"). */
export const TECHNOLOGIES = [
  'Cold Forming',
  'Hot Forming',
  'CNC Machining',
  'Injection Molding',
  'Surface Mount Technology (SMT)',
  'Heat Treatment',
  'Other',
] as const;

/** Q29 — Press capacity unit (the value itself is a numeric input now).
 *  PLACEHOLDER — pendiente de confirmar con GSM. The proposal used tonnes ("300T"). */
export const PRESS_CAPACITY_UNITS = ['T', 'kN'] as const;

/** Q26 — Currency for "Annual revenue by region".
 *  PLACEHOLDER — pendiente de confirmar con GSM; no currency catalog existed in the project. */
export const CURRENCIES = ['USD', 'MXN', 'EUR', 'CNY', 'Other'] as const;

/** Q33 — "Certificaciones" (multi-select).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc; it flags "confirmar lista con GSM/Calidad". */
export const CERTIFICATIONS = [
  'IATF 16949',
  'ISO 9001',
  'ISO 14001',
  'VDA 6.3',
  'Other',
] as const;

/** Q37 — "Operaciones complementarias" (multi-select).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc; it flags "no existe campo hoy, falta validar la lista". */
export const COMPLEMENTARY_OPERATIONS = [
  'Grinding',
  'Deburring',
  'Welding',
  'Coating',
  'Tempering',
  'Riveting',
  'Assembly',
  'Other',
] as const;

/** Q39 — "Materiales que maneja" (multi-select).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc; it flags "confirmar lista con GSM". */
export const MATERIALS = [
  'Hot roll',
  'Cold roll',
  'European steel',
  'Plastics',
  'Aluminum',
  'Other',
] as const;

/** Q40 — "Índice de referencia de materia prima".
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc.
 *  NOTE: no column exists for this today — see the unmapped-fields list in backend/README.md. */
export const RAW_MATERIAL_INDICES = [
  'AMM',
  'LME',
  'Asian Metal',
  'Shanghai Metal Market',
  'CRU',
  'None',
  'Other',
] as const;

/** Q41 — "Aplicaciones típicas".
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  The doc says this should ultimately vary per commodity ("depende del catálogo de
 *  commodity, falta definir por commodity") — this flat list is a stand-in for that.
 *  NOTE: no column exists for this today. */
export const TYPICAL_APPLICATIONS = [
  'Safety components',
  'Steering components',
  'Driveline components',
  'Electronics / controllers',
  'Structural components',
  'Other',
] as const;

/** Form B, Q3 — "¿De qué departamento?" (department of the internal recommender).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Values as proposed in the doc; it flags "confirmar lista de departamentos con GSM". */
export const RECOMMENDER_DEPARTMENTS = [
  'GSM / Purchasing',
  'Quality',
  'Engineering',
  'Program Management',
  'Other',
] as const;
