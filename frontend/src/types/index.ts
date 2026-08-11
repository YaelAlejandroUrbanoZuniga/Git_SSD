// Centralized TypeScript types for the application.

import type {
  COMMODITIES, SUB_STATUSES, ENTRY_SOURCES, CONFIDENCE_LEVELS, IMMEX_STATUSES,
} from '../constants/catalogs';

// Catalog-backed types. The values live in src/constants/catalogs.ts so the same
// list feeds both the type checker and the dropdowns.
export type Commodity = (typeof COMMODITIES)[number];

/**
 * WHAT the notification is about, as sent by the backend. Separate from `type`,
 * which is only the severity: the panel picks its icon and colour from the
 * category and falls back to the severity when it is missing.
 */
export type NotificationCategory =
  | 'supplier_created'
  | 'stage_advanced'
  | 'blacklisted'
  | 'event_created'
  | 'event_updated';

export interface Notification {
  id: string;
  message: string;
  time: string;
  type: 'error' | 'warning' | 'info';
  /** Absent on notifications created before the category column existed. */
  category?: NotificationCategory | null;
  read: boolean;
  link: string | null;
  /** ISO instant — the panel's "All" tab filters on it (last 7 days). */
  createdAt?: string;
}

// ── pipeline-demo.ts ───────────────────────────────────────────────────
export type TrackerStage =
  | 'Scouting Event'
  | 'Parking Lot'
  | 'Preliminary Evaluation'
  | 'Supplier Evaluation'
  | 'Intelex Handoff'
  | 'Completed';

export type ScoutingPhase = 'Identified' | 'B2B';
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export type SubStatus = (typeof SUB_STATUSES)[number];
export type SLAStatus = 'green' | 'yellow' | 'red';
export type Priority = 1 | 2 | 3;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type ImmexStatus = (typeof IMMEX_STATUSES)[number];

export interface MRLRequirement {
  id: string;
  buyerName: string;
  commodity: Commodity;
  nexteerProductLine: string;
  volumeByYear: {
    '2026': number | null;
    '2027': number | null;
    '2028': number | null;
    '2029': number | null;
    '2030': number | null;
    '2031': number | null;
  };
  partNumber: string;
  partDescription: string;
  mainMaterialsSpecTech: string;
  peakVolume: number | null;
  program: string;
  eop: string;
  targetPrice: number | null;
  priority: 1 | 2 | 3;
  primaryDriver: string;
  keyManufacturingCapabilities: string;
  safetyCriticalPart: boolean;
  supplierExperienceInSafetyRequired: boolean;
  certifications: string;
  knowsCQIs: boolean;
}

export interface TrackerDocument {
  name: string;
  status: 'Firmado' | 'Pendiente' | 'No aplica';
  date?: string;
  link?: string;
}

export interface HistoryEntry {
  date: string;
  action: string;
  user: string;
  role: string;
  note?: string;
}

export interface SupplierNote {
  id: string;
  text: string;
  author: string;
  role: string;
  date: string;
  stage: TrackerStage;
}

export interface PartEvaluation {
  partNumber: string;
  partDescription: string;
  pl: string;
  peakVolume: number;
  program: string;
  eop: string;
  targetPrice: number;
  rfqPrice: number;
  confidence: ConfidenceLevel;
}

/**
 * Explicit sub-status inside the Intelex Handoff stage. Advances as each level's
 * "Real" date is captured (Investigate → L0 → … → L4 → Completed). Derived and
 * persisted by the backend — read-only on the wire.
 */
export type IntelexLevel = 'Investigate' | 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'Completed';

export interface TrackerSupplier {
  id: string;
  folio: string;
  name: string;
  stage: TrackerStage;
  scoutingPhase: ScoutingPhase | null;
  entrySource: EntrySource;
  commodity: Commodity;
  productCategory: 'Direct' | 'Indirect';
  productType: string;
  country: string;
  manufacturingAddress: string;
  buyer: string;
  scoutingInput: string;
  daysInStage: number;
  daysSinceParkingLot: number | null;
  docsPercent: number;
  sla: SLAStatus;
  globalSla: SLAStatus | null;
  subStatus: SubStatus | null;

  // Company info
  fullName: string;
  dunsNumber: string;
  taxIdNumber: string | null;
  recommendedBy: string | null;
  recommenderDept: string | null;
  companyType: string;
  foundedYear: number;
  headquarters: string;
  website: string;
  phone: string;
  contactEmail: string;
  contactName: string;

  // Technical
  technology: string;
  machineryType: string;
  processMethod: string;
  pressCapacity: string;
  materials: string;
  complementaryOperations: string | null;
  safetyCritical: boolean;
  safetyExperience: boolean;
  certifications: string;
  knowsCQIs: boolean;

  // Commercial
  annualRevenue: string;
  productionVolume: string;
  employees: number;
  facilities: number;
  topCustomers: string;
  hasIMMEX: boolean;
  planIMMEX: boolean;
  exportCapability: boolean;

  // Evaluation
  strengths: string;
  weaknesses: string;
  observations: string;
  recommendations: string;
  priority: Priority;
  primaryDriver: string;
  confidenceLevel: ConfidenceLevel;

  // Documents
  documents: TrackerDocument[];

  // Evaluation data
  preEvalStartDate: string | null;
  parts: PartEvaluation[];
  initialQuoteSubmitted: boolean;
  qadPrice: string | null;
  savingExpected: string | null;
  tooling: string | null;
  selectedForDevelopment: boolean;
  investigateRecordNumber: string | null;
  intelexDate: string | null;

  // History
  history: HistoryEntry[];

  // Notes (unified supplier notes)
  notes: SupplierNote[];

  // Scouting tab progress
  scoutingTabsCompleted: {
    scoutingEvent: boolean;
    supplierInfo: boolean;
    attendees: boolean;
    agenda: boolean;
    nextStep: boolean;
  };

  // Attendees tab
  b2bStatus: 'Yes' | 'No' | null;
  b2bWhoAttends: string | null;
  b2bManager: string | null;
  b2bBuyer: string | null;
  b2bComments: string | null;

  // Agenda tab
  agendaStatus: string | null;
  agendaTeamsLink: string | null;
  agendaScheduledDate: string | null;
  agendaTimezone: string | null;
  agendaStand: string | null;
  agendaStartTime: string | null;
  agendaEndTime: string | null;
  agendaDuration: string | null;

  // Next Step tab
  selectedForParking: boolean | null;
  selectionReason: string | null;

  // Parking Lot tab fields
  parkingOnboardingDate: string | null;
  parkingTimeless: boolean;
  parkingDateToMovePreliminary: string | null;
  parkingDaysElapsed: number | null;
  parkingScoutingInput: string | null;
  parkingSubStatus: 'Go' | 'No Go' | 'Under Evaluation' | 'On Hold' | null;
  parkingIsRecommendation: boolean;
  parkingBuyer: string | null;
  parkingCompanyName: string | null;
  parkingB2BMeeting: 'Yes' | 'No' | null;
  parkingName1: string | null;
  parkingWebsite: string | null;
  parkingEmail1: string | null;
  parkingPhone: string | null;
  parkingCommodity: string | null;
  parkingProductType: string | null;
  parkingManufacturingCountry: string | null;
  parkingManufacturingAddress: string | null;
  parkingAdditionalComments: string | null;

  // Parking tab completion tracking
  parkingTabsCompleted: {
    overview: boolean;
    contact: boolean;
    details: boolean;
  } | null;

  // Preliminary Evaluation tab completion tracking
  preliminaryTabsCompleted: {
    overview: boolean;
    capabilities: boolean;
  } | null;

  // Supplier Evaluation tab completion tracking. `visit` is the Visit tab, which
  // GSM moved here from Preliminary Evaluation; only its completion flag moved —
  // its data still lives under the prelim_visit*/strengths/… fields below.
  supplierEvalTabsCompleted: {
    competitiveness: boolean;
    fundamentals: boolean;
    visit: boolean;
  } | null;

  // Intelex Handoff tab completion tracking
  intelexTabsCompleted: {
    record: boolean;
    timeline: boolean;
    efficiency: boolean;
  } | null;
  intelexSaved: boolean;
  // Current level within Intelex Handoff (server-derived, read-only).
  intelex_currentLevel: IntelexLevel;

  // Intelex Handoff - Record tab
  intelex_recordCreationDate: string | null;
  intelex_investigateRecordNumber: string | null;

  // Intelex Handoff - Timeline tab (Expected / Real per level)
  intelex_investigateExpected: string | null;
  intelex_investigateReal: string | null;
  intelex_l0Expected: string | null;
  intelex_l0Real: string | null;
  intelex_l1Expected: string | null;
  intelex_l1Real: string | null;
  intelex_l2Expected: string | null;
  intelex_l2Real: string | null;
  intelex_l3Expected: string | null;
  intelex_l3Real: string | null;
  intelex_l4Expected: string | null;
  intelex_l4Real: string | null;

  // Intelex Handoff - Efficiency tab (decimals 0-1, server-derived and read-only:
  // each level scored on its own Expected-vs-Real delay, Global = their average)
  intelex_efficiencyL0: number | null;
  intelex_efficiencyL1: number | null;
  intelex_efficiencyL2: number | null;
  intelex_efficiencyL3: number | null;
  intelex_efficiencyL4: number | null;
  intelex_efficiencyGlobal: number | null;

  // Preliminary Evaluation - Overview tab
  prelim_startDate: string | null;
  prelim_priority: 1 | 2 | 3 | null;
  prelim_scoutingInput: string | null;
  prelim_buyer: string | null;
  prelim_commodity: Commodity | null;
  prelim_primaryDriver: string | null;
  prelim_companyName: string | null;
  prelim_dunsNumber: string | null;
  prelim_hqAddress: string | null;
  prelim_hqCity: string | null;
  prelim_hqCountry: string | null;
  prelim_manufacturingAddress: string | null;
  prelim_manufacturingCity: string | null;
  prelim_manufacturingCountry: string | null;
  prelim_companyType: string | null;
  prelim_foundedYear: number | null;
  prelim_footprint: string | null;
  prelim_yearsInMexico: number | null;
  prelim_facilities: number | null;
  prelim_employees: number | null;
  prelim_annualRevenue: string | null;
  prelim_productionVolume: string | null;
  prelim_mainTechnology: string | null;
  prelim_pressCapacity: string | null;
  prelim_generalManager: string | null;
  prelim_market: string | null;
  prelim_topCustomers: string | null;
  prelim_exportCapability: string | null;
  prelim_certifications: string | null;
  prelim_hasIMMEX: ImmexStatus | null;
  prelim_planToGetIMMEX: 'Y' | 'N' | null;

  // Preliminary Evaluation - Capabilities tab
  prelim_machineryType: string | null;
  prelim_processingMethod: string | null;
  prelim_complementaryOps: string | null;
  prelim_toolingDesign: string | null;
  prelim_materials: string | null;
  prelim_rawMaterialIndex: string | null;
  prelim_applications: string | null;

  // Supplier Evaluation - Visit tab (kept under the prelim_ prefix: the columns
  // never moved out of PreliminaryData, only the tab did)
  prelim_visitDatePlanned: string | null;
  prelim_visitDateCompleted: string | null;
  prelim_visitParticipants: string | null;
  prelim_strengths: string | null;
  prelim_weaknesses: string | null;
  prelim_observations: string | null;
  prelim_recommendations: string | null;

  // Preliminary Evaluation - Competitiveness tab
  prelim_parts: {
    partNumber: string;
    partDescription: string;
    pl: string;
    annualPeakVolume: number | null;
    program: string;
    eop: string;
    initialQuote: number | null;
    qadPrice: number | null;
    delta: number | null;
    tooling: number | null;
    savingExpected: number | null;
    confidence: 'H' | 'M' | 'L' | null;
  }[];

  // Supplier Evaluation - Fundamentals tab
  prelim_rfqReceived: 'Y' | 'N' | null;
  prelim_ndaSigned: 'Y' | 'N' | null;
  prelim_tcsSigned: 'Y' | 'N' | null;
  prelim_ttcsSigned: 'Y' | 'N' | null;
  prelim_nsrSigned: 'Y' | 'N' | null;
  prelim_sdaSigned: 'Y' | 'N' | null;
  prelim_costModel: 'Y' | 'N' | null;

  // Onboarding
  onboardingDate: string;
  // Real instant the supplier entered its current stage (set by the backend on
  // create/move/blacklist). Always present on the wire; optional here so the
  // legacy in-memory demo objects (src/data/*.ts) don't have to carry it.
  stageEnteredAt?: string | null;
  // Backend-computed (domain/externalFormGate.ts) — false when DUNS number,
  // manufacturing country, or manufacturing address is still missing. Same
  // rule the Preliminary Evaluation move is gated on; drives the Parking Lot
  // board's "missing form data" indicator. Optional so legacy demo objects
  // don't have to carry it (mirrors stageEnteredAt above).
  hasExternalFormData?: boolean;
}

export interface BlacklistedSupplier extends TrackerSupplier {
  rejectedBy: string;
  rejectionDate: string;
  rejectionReason: string;
}

export interface CompletedSupplier extends TrackerSupplier {
  completedDate: string;   // ISO date string
  completedBy: string;     // user name
}

// ── events-demo.ts ─────────────────────────────────────────────────────
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Canceled';
export type EventType = 'Direct' | 'Indirect';
export type B2BStatus = 'Accepted' | 'Rejected' | 'Cancelled';
export type SupplierResult = 'Included' | 'Not Included';

export interface B2BMeeting {
  time: string;
  stand: string;
  companyName: string;
  supplierId: string;
  commodity: Commodity;
  attendeeManager: string;
  attendeeBuyer: string;
  duration: string;
  status: B2BStatus;
}

export interface EventSupplierEntry {
  supplierId: string;
  b2bMeeting: boolean;
  status: B2BStatus;
  result: SupplierResult;
}

export interface EventNote {
  id: string;
  text: string;
  author: string;
  role: string;
  date: string;
}

export interface ScoutingEvent {
  id: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  organizer: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: EventStatus;
  description: string;
  type: EventType;
  suppliersRegistered: number;
  supplierEntries: EventSupplierEntry[];
  b2bMeetings: B2BMeeting[];
  objective: string;
  topCountry: string;
  notes: EventNote[];
}

export type AppRole = 'SSD' | 'PM' | 'Buyer' | 'SQD' | 'Guest';

export const APP_ROLES: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD', 'Guest'];

// ── Strategy module ────────────────────────────────────────────────────
export interface StrategyEntry {
  id: string;
  commodity: Commodity;
  strategyNeeds: {
    '2026': number;
    '2027': number | null;
    '2028': number | null;
    '2029': number | null;
    '2030': number | null;
    '2031': number | null;
  };
  createdBy: string;
  updatedAt: string;
}

export interface CommodityStageSnapshot {
  stageName: string;
  count: number;
  avgDaysInStage: number;
}

export interface CommodityStrategyRow {
  commodity: Commodity;
  strategyNeeds2026: number;
  strategyNeeds2027: number;
  totalInTracker: number;
  reserved: number;
  inProgress: number;
  achieved: number;
  remaining: number;
  stages: CommodityStageSnapshot[];
}
