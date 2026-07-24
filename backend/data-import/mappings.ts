// Lookup tables for the Excel → JSON import. Pure data, no logic (that lives in
// normalize.ts). Everything here was verified against the 5 real GSM spreadsheets.

import { COMMODITIES } from '../src/domain/constants';

export const PENDING_GSM = 'TBD -- Pending GSM';

/** The canonical catalog (37 values incl. the placeholder), reused from the backend. */
export const CATALOG_COMMODITIES: readonly string[] = COMMODITIES;

/**
 * Direct commodity equivalences (GSM-confirmed). Keys are lowercased so the match is
 * case-insensitive; normalize.ts also does a case/space fold against the catalog for
 * everything else. Values MUST be exact catalog entries.
 */
export const COMMODITY_ALIASES: Record<string, string> = {
  plastics: 'Plastic',
  stamping: 'Stampings',
  casting: 'Castings',
  extrusion: 'Extrusions',
  'powder metal': 'Powder Metal',
};

/**
 * Aggregated commodity values that GSM will reclassify later → the pending placeholder.
 * Compared case-insensitively after whitespace collapse.
 */
export const AGGREGATED_TO_PENDING: string[] = [
  'E-MECHANICAL COMPONENTS -- HEADERS, CONNECTORS, LEADFRAME, PCB',
  'CONTROLLERS -- CCA, MSB, PHA',
];

/**
 * Societal/legal suffixes stripped ONLY for name comparison (the original name is
 * always kept). Applied after lowercasing, accent-stripping and dot-removal, so the
 * dotted forms ("s.a. de c.v.") collapse to these spaced forms. Longest first.
 */
export const SOCIETAL_SUFFIXES: string[] = [
  's de rl de cv',
  'sapi de cv',
  'sa de cv',
  'de rl de cv',
  's de rl',
  'de cv',
  'sapi',
  'srl',
  'sa',
  'sab',
  'inc',
  'llc',
  'ltd',
  'ltda',
  'corp',
  'corporation',
  'company',
  'co',
  'group',
  'grupo',
];

/** Leading company markers also dropped for comparison (e.g. "Grupo X" → "x"). */
export const SOCIETAL_PREFIXES: string[] = ['grupo', 'group', 'company'];

/**
 * Buyer name normalization → the official seeded-user display names.
 * Keys matched case-insensitively after whitespace collapse.
 */
export const BUYER_ALIASES: Record<string, string> = {
  'oscar sanchez': 'Oscar Alejandro Sanchez',
  'miguel molina': 'Miguel Angel Molina',
  'mguel molina': 'Miguel Angel Molina',
  'miguel guzman': 'Miguel Angel Guzman',
  'arturo armendariz': 'Christian Arturo Armendariz',
  'luis maxiliano chong': 'Luis Maximiliano Chong',
};

/**
 * The 21 seeded GSM-team users (display names) — kept in sync with
 * backend/prisma/seed.ts REAL_USERS. Used only to flag buyers/recommenders that are
 * NOT among them (reported, never invented as users).
 */
export const SEEDED_USERS: string[] = [
  'Miguel Angel Camacho', 'Lucia Morales', 'Christian Arturo Armendariz', 'Ivan Aguila',
  'Jaime Cabrera', 'Fernando Ramos', 'Miguel Angel Molina', 'Antonio Toscano',
  'Kenia Hernandez', 'Oscar Alejandro Sanchez', 'Diego Campos', 'Agustin Antonio Carvalho',
  'Fernanda Merlo', 'Ivan Mendoza', 'Miguel Angel Guzman', 'Ramon Gutierrez',
  'Vianey Perea', 'Itzel Campos', 'Lorena Luna', 'Marissa Hernandez', 'Yael Urbano',
];

/**
 * Event-name normalization → the canonical names from the "Scouting Events Agenda"
 * sheet. Only the values that differ from canonical need an entry.
 */
export const EVENT_NAME_ALIASES: Record<string, string> = {
  'capim 2026': 'CAPIM',
  'automotive meeting queretaro': 'Automotive Meetings Querétaro',
};

/** The 7 canonical event names (Scouting Events Agenda). */
export const CANONICAL_EVENTS: string[] = [
  'Automotive Meetings Querétaro',
  "Mexico's Supply Chain Nearshoring Summit 2026",
  'CAPIM',
  "Mexico's Nearshoring & Logistics Auto Industry Summit 2026",
  '4to Mexico Supply Chain 2026 (CAPIM)',
  'Encuentro industrial Queretaro 2026 - Industry and Supply Chain',
  'Manufacturing and Supply Chain Nearshoring Summit 2026',
];

/**
 * Scouting-input values that mean "not from an event" → entrySource 'Recommendation'.
 * Any input that matches a canonical event name is 'Scouting Event'; everything else
 * (incl. these and any unknown non-event text) falls back to 'Recommendation'.
 */
export const RECOMMENDATION_INPUTS: string[] = [
  'Known from previous experience',
  'Development Need (Last File)',
];

/** IMMEX free text → catalog value (Yes | No | In Plan | TBC). */
export const IMMEX_MAP: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  'in plan': 'In Plan',
  tbc: 'TBC',
  tbd: 'TBC',
};

/**
 * Tracker stages in precedence order (least → most advanced). 'Blacklisted' is not
 * here: it is an exit that always wins, handled separately in resolveStage().
 */
export const STAGE_ORDER: string[] = [
  'Scouting Event',
  'Parking Lot',
  'Preliminary Evaluation',
  'Supplier Evaluation',
  'Intelex Handoff',
];

/**
 * Real NVARCHAR column limits (schema.prisma) keyed by the TrackerSupplier / event /
 * MRL field name. truncate() uses these so no text field overflows its column. The
 * 5-char controlled fields (b2bStatus, prelim_planToGetIMMEX, prelim_*Signed) are
 * normalized to Y/N-style tokens, never truncated.
 */
export const FIELD_LIMITS: Record<string, number> = {
  // Supplier core
  name: 200, productType: 200, country: 100, manufacturingAddress: 300, buyer: 100,
  scoutingInput: 200, entrySource: 30, scoutingPhase: 20, onboardingDate: 30,
  qadPrice: 50, savingExpected: 50, tooling: 50, investigateRecordNumber: 100,
  intelexDate: 30, preEvalStartDate: 30, stageBeforeExit: 50,
  // CompanyInfo
  fullName: 300, dunsNumber: 50, taxIdNumber: 50, recommendedBy: 100, recommenderDept: 100,
  companyType: 50, headquarters: 300, website: 300, phone: 50, contactEmail: 200, contactName: 100,
  // TechnicalInfo
  technology: 200, machineryType: 200, processMethod: 200, pressCapacity: 100, materials: 300,
  complementaryOperations: 300, certifications: 300,
  // CommercialInfo
  annualRevenue: 50, productionVolume: 100, topCustomers: 300, exportCapability: 300,
  strengths: 1000, weaknesses: 1000, observations: 1000, recommendations: 1000, primaryDriver: 100,
  // ScoutingData
  b2bWhoAttends: 300, b2bManager: 100, b2bBuyer: 100, b2bComments: 1000, agendaStatus: 50,
  agendaTeamsLink: 500, agendaScheduledDate: 30, agendaTimezone: 20, agendaStand: 50,
  agendaStartTime: 20, agendaEndTime: 20, agendaDuration: 20, selectionReason: 1000,
  // ParkingData
  parkingOnboardingDate: 30, parkingDateToMovePreliminary: 30, parkingScoutingInput: 200,
  parkingBuyer: 100, parkingCompanyName: 200, parkingName1: 100, parkingWebsite: 300,
  parkingEmail1: 200, parkingPhone: 50, parkingCommodity: 100, parkingProductType: 200,
  parkingManufacturingCountry: 100, parkingManufacturingAddress: 300, parkingAdditionalComments: 2000,
  // PreliminaryData
  prelim_startDate: 30, prelim_scoutingInput: 200, prelim_buyer: 100, prelim_commodity: 100,
  prelim_primaryDriver: 100, prelim_companyName: 300, prelim_dunsNumber: 50, prelim_hqAddress: 300,
  prelim_hqCity: 100, prelim_hqCountry: 100, prelim_manufacturingAddress: 300,
  prelim_manufacturingCity: 100, prelim_manufacturingCountry: 100, prelim_companyType: 50,
  prelim_footprint: 100, prelim_annualRevenue: 50, prelim_productionVolume: 100,
  prelim_mainTechnology: 200, prelim_pressCapacity: 100, prelim_generalManager: 100,
  prelim_market: 100, prelim_topCustomers: 300, prelim_exportCapability: 300,
  prelim_certifications: 300, prelim_machineryType: 200, prelim_processingMethod: 200,
  prelim_complementaryOps: 300, prelim_toolingDesign: 100, prelim_materials: 300,
  prelim_rawMaterialIndex: 200, prelim_applications: 300, prelim_visitDatePlanned: 30,
  prelim_visitDateCompleted: 30, prelim_visitParticipants: 300, prelim_strengths: 1000,
  prelim_weaknesses: 1000, prelim_observations: 1000, prelim_recommendations: 1000,
  // IntelexData
  intelex_recordCreationDate: 30, intelex_investigateRecordNumber: 100,
  // Blacklist
  rejectedBy: 100, rejectionDate: 30, rejectionReason: 2000,
  // Event
  eventName: 300, location: 200, organizer: 100, description: 2000, objective: 2000, topCountry: 100,
  // MRL
  buyerName: 100, nexteerProductLine: 50, partNumber: 100, partDescription: 300,
  mainMaterialsSpecTech: 500, program: 100, eop: 20, keyManufacturingCapabilities: 500,
};
