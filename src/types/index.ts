// Centralized TypeScript types for the application.
// All domain interfaces and types live here so the data layer can be
// swapped for a real backend without touching component imports.

// ── demo.ts ────────────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  category: string;
  stage: string;
  status: 'active' | 'pending' | 'blacklisted';
  daysInStage: number;
  docsPercent: number;
  sla: 'green' | 'yellow' | 'red';
  contact?: string;
}

export interface Event {
  id: string;
  name: string;
  location: string;
  date: string;
  month: string;
  day: string;
  supplierCount: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  organizer: string;
}

export interface Notification {
  id: string;
  message: string;
  time: string;
  type: 'error' | 'warning' | 'info';
  read: boolean;
  link: string | null;
}

// ── pipeline-demo.ts ───────────────────────────────────────────────────
export type PipelineStage =
  | 'Scouting Event'
  | 'Parking Lot'
  | 'Preliminary Evaluation'
  | 'Supplier Evaluation'
  | 'Intelex Handoff'
  | 'Completed';

export type ScoutingPhase = 'Identified' | 'B2B';
export type EntrySource = 'Scouting Event' | 'Recommendation';

export type SubStatus = 'Go' | 'No Go' | 'Under Evaluation' | 'On Hold';
export type SLAStatus = 'green' | 'amber' | 'red';
export type Priority = 1 | 2 | 3;
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface MRLRequirement {
  id: string;
  buyerName: string;
  commodity: string;
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

export interface PipelineDocument {
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
  stage: PipelineStage;
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

export interface PipelineSupplier {
  id: string;
  folio: string;
  name: string;
  stage: PipelineStage;
  scoutingPhase: ScoutingPhase | null;
  entrySource: EntrySource;
  commodity: string;
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
  documents: PipelineDocument[];

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
    visit: boolean;
  } | null;

  // Supplier Evaluation tab completion tracking
  supplierEvalTabsCompleted: {
    competitiveness: boolean;
    fundamentals: boolean;
  } | null;

  // Intelex Handoff tab completion tracking
  intelexTabsCompleted: {
    record: boolean;
    timeline: boolean;
    efficiency: boolean;
  } | null;
  intelexSaved: boolean;

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

  // Intelex Handoff - Efficiency tab (decimals 0-1)
  intelex_efficiencyL0: number | null;
  intelex_efficiencyL1: number | null;
  intelex_efficiencyL2: number | null;
  intelex_efficiencyL3: number | null;
  intelex_efficiencyL4: number | null;

  // Preliminary Evaluation - Overview tab
  prelim_startDate: string | null;
  prelim_priority: 1 | 2 | 3 | null;
  prelim_scoutingInput: string | null;
  prelim_buyer: string | null;
  prelim_commodity: string | null;
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
  prelim_hasIMMEX: 'Yes' | 'No' | 'In Plan' | 'TBC' | null;
  prelim_planToGetIMMEX: 'Y' | 'N' | null;

  // Preliminary Evaluation - Capabilities tab
  prelim_machineryType: string | null;
  prelim_processingMethod: string | null;
  prelim_complementaryOps: string | null;
  prelim_toolingDesign: string | null;
  prelim_materials: string | null;
  prelim_rawMaterialIndex: string | null;
  prelim_applications: string | null;

  // Preliminary Evaluation - Visit tab
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

  // Preliminary Evaluation - Fundamentals tab
  prelim_rfqReceived: 'Y' | 'N' | null;
  prelim_ndaSigned: 'Y' | 'N' | null;
  prelim_tcsSigned: 'Y' | 'N' | null;
  prelim_ttcsSigned: 'Y' | 'N' | null;
  prelim_nsrSigned: 'Y' | 'N' | null;
  prelim_sdaSigned: 'Y' | 'N' | null;

  // Onboarding
  onboardingDate: string;
}

export interface BlacklistedSupplier extends PipelineSupplier {
  rejectedBy: string;
  rejectionDate: string;
  rejectionReason: string;
}

export interface CompletedSupplier extends PipelineSupplier {
  completedDate: string;   // ISO date string
  completedBy: string;     // user name
}

// ── events-demo.ts ─────────────────────────────────────────────────────
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed';
export type EventType = 'Direct' | 'Indirect';
export type B2BStatus = 'Accepted' | 'Rejected' | 'Cancelled';
export type SupplierResult = 'Included' | 'Not Included';

export interface B2BMeeting {
  time: string;
  stand: string;
  companyName: string;
  supplierId: string;
  commodity: string;
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
  topCommodity: string;
  topCountry: string;
  notes: EventNote[];
}

export type AppRole = 'SSD' | 'PM' | 'Buyer' | 'SQD';

// ── Strategy module ────────────────────────────────────────────────────
export interface StrategyEntry {
  id: string;
  commodity: string;
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
  commodity: string;
  strategyNeeds2026: number;
  strategyNeeds2027: number;
  totalInPipeline: number;
  reserved: number;
  inProgress: number;
  achieved: number;
  remaining: number;
  stages: CommodityStageSnapshot[];
}
