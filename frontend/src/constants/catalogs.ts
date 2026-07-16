// Runtime catalogs (C_* tables of the SSD data model).
//
// The values here were already declared in the app as TypeScript union types,
// which cannot be enumerated at runtime to populate a <select>. This module is
// the runtime source of truth; `src/types/index.ts` derives its types from it,
// so a value can never drift between the type and the dropdown.
//
// Keep in sync with backend/src/domain/constants.ts.

/** C_Commodity — official Nexteer catalog (36 values). Do not modify without instruction. */
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

/** C_SubStatus — Go/No-Go decision state of a supplier within a stage. */
export const SUB_STATUSES = ['Go', 'No Go', 'Under Evaluation', 'On Hold'] as const;

/** C_ProductCategory */
export const PRODUCT_CATEGORIES = ['Direct', 'Indirect'] as const;

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
