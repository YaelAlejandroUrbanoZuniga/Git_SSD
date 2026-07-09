// Controlled vocabularies. Prisma on SQL Server has no enum support, so
// these are enforced at the service layer.

export const PIPELINE_STAGES = [
  'Scouting Event',
  'Parking Lot',
  'Preliminary Evaluation',
  'Supplier Evaluation',
  'Intelex Handoff',
  'Blacklisted',
  'Completed',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** The 5 working stages shown as pipeline columns (Blacklisted/Completed are terminal). */
export const WORKING_STAGES = PIPELINE_STAGES.slice(0, 5) as PipelineStage[];

export const SUPPLIER_STATUS = ['ACTIVE', 'BLACKLISTED', 'COMPLETED'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUS)[number];

export const SUB_STATUSES = ['Go', 'No Go', 'Under Evaluation', 'On Hold'] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];

export const APP_ROLES = ['SSD', 'PM', 'Buyer', 'SQD'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ENTRY_SOURCES = ['Scouting Event', 'Recommendation'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

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

// Catálogo oficial de 36 commodities de Nexteer; Controllers y E-Mechanical
// Components se desglosan en subdivisiones individuales por decisión de
// negocio. No modificar sin instrucción explícita.
export const COMMODITIES = [
  'Controllers -- CCA',
  'Controllers -- MSB',
  'Controllers -- PHA',
  'E-Mechanical Components -- Headers',
  'E-Mechanical Components -- Connectors',
  'E-Mechanical Components -- Leadframe',
  'E-Mechanical Components -- PCB',
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
export type Commodity = (typeof COMMODITIES)[number];

export const PIPELINE_STAGE_CONFIG = [
  { name: 'Scouting Event', color: '#02B3E1', icon: 'fa-binoculars' },
  { name: 'Parking Lot', color: '#D4A017', icon: 'fa-circle-pause' },
  { name: 'Preliminary Evaluation', color: '#E3650B', icon: 'fa-clipboard-check' },
  { name: 'Supplier Evaluation', color: '#C026D3', icon: 'fa-file-contract' },
  { name: 'Intelex Handoff', color: '#0084C0', icon: 'fa-handshake' },
] as const;

/** Stage order index for transition validation (Blacklisted = 5, Completed = 6). */
export function stageIndex(stage: string): number {
  return PIPELINE_STAGES.indexOf(stage as PipelineStage);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
