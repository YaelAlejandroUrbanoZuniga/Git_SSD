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

/** Q7 — "¿Desde dónde nos contactas?" (Nexteer plant/region the supplier is contacting).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  The doc proposes no options: the exact plant/region list is the one GSM must supply. */
export const NEXTEER_CONTACT_LOCATIONS = [
  'Nexteer Querétaro (MX)',
  'Nexteer Saltillo (MX)',
  'Nexteer Juárez (MX)',
  'Nexteer Saginaw (US)',
  'Nexteer Europe',
  'Nexteer Asia Pacific',
  'Other',
] as const;

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

/** Q25 — "Número de empleados" (ranges).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Ranges as proposed in the doc; the doc itself flags "confirmar si los rangos son los correctos".
 *  NOTE: `T_Supplier_CommercialInfo.Employees` is an Int, so only `approxCount`
 *  (the lower bound) can be persisted today — the range label itself has no column. */
export const EMPLOYEE_RANGES = [
  { label: '< 50', approxCount: 1 },
  { label: '50 - 200', approxCount: 50 },
  { label: '200 - 500', approxCount: 200 },
  { label: '500+', approxCount: 500 },
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

/** Q29 — "Capacidad de prensa" (ranges).
 *  PLACEHOLDER — pendiente de confirmar con GSM, ver Propuesta_Formularios_Proveedores_v2.pdf
 *  Ranges as proposed in the doc; the doc itself flags "confirmar rangos con GSM". */
export const PRESS_CAPACITY_RANGES = [
  '< 300T',
  '300 - 600T',
  '600 - 1000T',
  '> 1000T',
  'Not applicable',
  'Other',
] as const;

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
