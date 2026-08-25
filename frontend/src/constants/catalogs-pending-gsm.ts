/** Q13 — "Proceso de manufactura principal" */
export const MANUFACTURING_PROCESSES = [
  'Stamping',
  'Machining',
  'Casting',
  'Forging',
  'Molding',
  'Electronics',
  'Other',
] as const;

/** Q28 — "Tecnología principal" */
export const TECHNOLOGIES = [
  'Cold Forming',
  'Hot Forming',
  'CNC Machining',
  'Injection Molding',
  'Surface Mount Technology (SMT)',
  'Heat Treatment',
  'Other',
] as const;

/** Q29 — Press capacity unit (the value itself is a numeric input now) */
export const PRESS_CAPACITY_UNITS = ['T', 'kN'] as const;

/** Q26 — Currency for "Annual revenue by region" */
export const CURRENCIES = ['USD', 'MXN', 'EUR', 'CNY', 'Other'] as const;

/** Q33 — "Certificaciones" (multi-select) */
export const CERTIFICATIONS = [
  'IATF 16949',
  'ISO 9001',
  'ISO 14001',
  'VDA 6.3',
  'Other',
] as const;

/** Q37 — "Operaciones complementarias" (multi-select) */
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

/** Q39 — "Materiales que maneja" (multi-select) */
export const MATERIALS = [
  'Hot roll',
  'Cold roll',
  'European steel',
  'Plastics',
  'Aluminum',
  'Other',
] as const;

/** Q40 — "Índice de referencia de materia prima" */
export const RAW_MATERIAL_INDICES = [
  'AMM',
  'LME',
  'Asian Metal',
  'Shanghai Metal Market',
  'CRU',
  'None',
  'Other',
] as const;

/** Q41 — "Aplicaciones típicas" */
export const TYPICAL_APPLICATIONS = [
  'Safety components',
  'Steering components',
  'Driveline components',
  'Electronics / controllers',
  'Structural components',
  'Other',
] as const;

/** Form B, Q3 — "¿De qué departamento?" (department of the internal recommender) */
export const RECOMMENDER_DEPARTMENTS = [
  'GSM / Purchasing',
  'Quality',
  'Engineering',
  'Program Management',
  'Other',
] as const;
