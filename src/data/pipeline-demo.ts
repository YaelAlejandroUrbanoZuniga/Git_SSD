export type PipelineStage =
  | 'Scouting Event'
  | 'B2B'
  | 'Parking Lot'
  | 'Preliminary Evaluation'
  | 'RFQ'
  | 'Investigation Record';

export type SubStatus = 'Go' | 'No Go' | 'Under Evaluation' | 'On Hold';
export type SLAStatus = 'green' | 'amber' | 'red';
export type Priority = 1 | 2 | 3;
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

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

  // Onboarding
  onboardingDate: string;
}

export interface BlacklistedSupplier extends PipelineSupplier {
  rejectedBy: string;
  rejectionDate: string;
  rejectionReason: string;
}

export const pipelineStageConfig: { name: PipelineStage; color: string }[] = [
  { name: 'Scouting Event',        color: '#02B3E1' },
  { name: 'B2B',                   color: '#6366F1' },
  { name: 'Parking Lot',           color: '#D4A017' },
  { name: 'Preliminary Evaluation', color: '#E3650B' },
  { name: 'RFQ',                   color: '#6ABF4B' },
  { name: 'Investigation Record',  color: '#0084C0' },
];

function makeDocs(signed: number): PipelineDocument[] {
  const all: { name: string; required: boolean }[] = [
    { name: 'NDA', required: true },
    { name: 'TC&Cs', required: true },
    { name: 'TTC&Cs', required: true },
    { name: 'NSR', required: true },
    { name: 'SDA', required: true },
    { name: 'RFQ received', required: true },
  ];
  return all.map((d, i) => ({
    name: d.name,
    status: i < signed ? 'Firmado' : (i === all.length - 1 && signed < 5 ? 'Pendiente' : 'Pendiente'),
    date: i < signed ? '2026-0' + (i + 1) + '-15' : undefined,
  }));
}

function calcSla(days: number, amberThreshold: number, redThreshold: number): SLAStatus {
  if (days >= redThreshold) return 'red';
  if (days >= amberThreshold) return 'amber';
  return 'green';
}

export const pipelineSuppliers: PipelineSupplier[] = [
  // === SCOUTING EVENT ===
  {
    id: 'ps1', folio: 'SSD-2026-001', name: 'AMPHENOL', stage: 'Scouting Event',
    commodity: 'Connectors', productType: 'Electrical Connectors', country: 'USA',
    manufacturingAddress: 'Sidney, NY', buyer: 'Ana García',
    scoutingInput: 'Automotive Supplier Summit 2026', daysInStage: 5,
    daysSinceParkingLot: null, docsPercent: 17, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Amphenol Corporation', dunsNumber: '00-123-4567', companyType: 'Public',
    foundedYear: 1932, headquarters: 'Wallingford, CT, USA', website: 'https://amphenol.com',
    phone: '+1 203 265 8900', contactEmail: 'sales@amphenol.com', contactName: 'Robert Miller',
    technology: 'Stamping & Injection Molding', machineryType: 'Progressive Die',
    processMethod: 'High-speed stamping', pressCapacity: '200T', materials: 'Copper, Brass, PBT',
    safetyCritical: false, safetyExperience: true, certifications: 'IATF 16949, ISO 14001',
    knowsCQIs: true,
    annualRevenue: '$12.6B', productionVolume: '5M units/month', employees: 90000,
    facilities: 130, topCustomers: 'Tesla, GM, Stellantis', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Global footprint, strong EPS connector portfolio', weaknesses: 'High pricing vs. Asian suppliers',
    observations: 'Excellent quality track record', recommendations: 'Proceed to B2B for pricing discussion',
    priority: 2, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(1), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-05-24', action: 'Supplier registered from Scouting Event', user: 'Ana García', role: 'Buyer' },
    ],
    onboardingDate: '2026-05-24',
  },
  {
    id: 'ps2', folio: 'SSD-2026-002', name: 'ARBOMEX', stage: 'Scouting Event',
    commodity: 'Machined Parts', productType: 'Aluminum Housings', country: 'Mexico',
    manufacturingAddress: 'Celaya, GTO', buyer: 'Carlos Mendoza',
    scoutingInput: 'EV Components Fair 2026', daysInStage: 3,
    daysSinceParkingLot: null, docsPercent: 0, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Arbomex S.A. de C.V.', dunsNumber: '80-456-7890', companyType: 'Private',
    foundedYear: 1974, headquarters: 'Celaya, GTO, Mexico', website: 'https://arbomex.com',
    phone: '+52 461 611 6000', contactEmail: 'ventas@arbomex.com', contactName: 'Jorge Ramírez',
    technology: 'CNC Machining', machineryType: 'CNC 5-axis',
    processMethod: 'Precision machining', pressCapacity: 'N/A', materials: 'Aluminum 6061, 7075',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, OHSAS 18001',
    knowsCQIs: true,
    annualRevenue: '$180M', productionVolume: '800K units/month', employees: 3200,
    facilities: 4, topCustomers: 'Nexteer, BorgWarner, Continental', hasIMMEX: true, planIMMEX: true,
    exportCapability: true,
    strengths: 'Near-shore advantage, IATF certified, safety experience', weaknesses: 'Limited press capacity',
    observations: 'Strong candidate for USMCA compliance', recommendations: 'Fast-track to B2B',
    priority: 1, primaryDriver: 'USMCA', confidenceLevel: 'High',
    documents: makeDocs(0), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-05-26', action: 'Supplier registered from Scouting Event', user: 'Carlos Mendoza', role: 'SSD Lead' },
    ],
    onboardingDate: '2026-05-26',
  },
  {
    id: 'ps3', folio: 'SSD-2026-003', name: 'TLT ELECTRONICS', stage: 'Scouting Event',
    commodity: 'Electronics', productType: 'PCB Assemblies', country: 'Mexico',
    manufacturingAddress: 'Juárez, CHIH', buyer: 'Roberto Sánchez',
    scoutingInput: 'Scouting B2B Sessions Q2', daysInStage: 8,
    daysSinceParkingLot: null, docsPercent: 17, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'TLT Electronics S. de R.L. de C.V.', dunsNumber: '80-789-0123', companyType: 'Private',
    foundedYear: 2001, headquarters: 'Juárez, CHIH, Mexico', website: 'https://tltelectronics.com',
    phone: '+52 656 617 0000', contactEmail: 'info@tltelectronics.com', contactName: 'Laura Vega',
    technology: 'SMT Assembly', machineryType: 'SMT Line, Selective Soldering',
    processMethod: 'PCB assembly & testing', pressCapacity: 'N/A', materials: 'FR4, Components',
    safetyCritical: false, safetyExperience: false, certifications: 'ISO 9001, UL certified',
    knowsCQIs: false,
    annualRevenue: '$45M', productionVolume: '200K boards/month', employees: 850,
    facilities: 2, topCustomers: 'Honeywell, TE Connectivity', hasIMMEX: true, planIMMEX: true,
    exportCapability: true,
    strengths: 'Competitive pricing, proximity to US border', weaknesses: 'No IATF cert, no safety experience',
    observations: 'Needs capability assessment', recommendations: 'Request IATF certification timeline',
    priority: 3, primaryDriver: 'Savings', confidenceLevel: 'Low',
    documents: makeDocs(1), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-05-21', action: 'Supplier registered from Scouting Event', user: 'Roberto Sánchez', role: 'SQD' },
    ],
    onboardingDate: '2026-05-21',
  },

  // === B2B ===
  {
    id: 'ps4', folio: 'SSD-2026-004', name: 'BOSCH', stage: 'B2B',
    commodity: 'Sensors', productType: 'Torque Sensors', country: 'Germany',
    manufacturingAddress: 'Stuttgart, Germany', buyer: 'Ana García',
    scoutingInput: 'Automotive Supplier Summit 2026', daysInStage: 12,
    daysSinceParkingLot: null, docsPercent: 50, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Robert Bosch GmbH', dunsNumber: '31-564-8901', companyType: 'Private (Foundation)',
    foundedYear: 1886, headquarters: 'Gerlingen, Germany', website: 'https://bosch.com',
    phone: '+49 711 811 0', contactEmail: 'automotive@bosch.com', contactName: 'Hans Weber',
    technology: 'MEMS Sensor Fabrication', machineryType: 'Cleanroom MEMS lines',
    processMethod: 'Wafer processing + packaging', pressCapacity: 'N/A', materials: 'Silicon, Ceramics',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, ISO 26262',
    knowsCQIs: true,
    annualRevenue: '$91.6B', productionVolume: '10M sensors/month', employees: 421000,
    facilities: 440, topCustomers: 'VW, Toyota, BMW, Stellantis', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'World-class quality, ISO 26262 expertise, massive capacity', weaknesses: 'Premium pricing, long lead times',
    observations: 'Strategic partner potential for EPS sensors', recommendations: 'Negotiate volume pricing',
    priority: 1, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(3), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-04-20', action: 'Supplier registered from Scouting Event', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-01', action: 'Moved from Scouting Event to B2B', user: 'Ana García', role: 'Buyer', note: 'Strong candidate, proceed with NDA' },
      { date: '2026-05-10', action: 'Document signed: NDA', user: 'Ana García', role: 'Buyer' },
    ],
    onboardingDate: '2026-04-20',
  },
  {
    id: 'ps5', folio: 'SSD-2026-005', name: 'MANDO', stage: 'B2B',
    commodity: 'Brakes', productType: 'Electronic Brake Systems', country: 'South Korea',
    manufacturingAddress: 'Pyeongtaek, South Korea', buyer: 'Carlos Mendoza',
    scoutingInput: 'Registro directo', daysInStage: 7,
    daysSinceParkingLot: null, docsPercent: 33, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Mando Corporation', dunsNumber: '56-890-1234', companyType: 'Public',
    foundedYear: 1962, headquarters: 'Pyeongtaek, South Korea', website: 'https://mando.com',
    phone: '+82 31 680 2114', contactEmail: 'global.sales@mando.com', contactName: 'Kim Sung-Ho',
    technology: 'Hydraulic & Electronic Braking', machineryType: 'Assembly & Test Lines',
    processMethod: 'Precision assembly + EOL testing', pressCapacity: '500T', materials: 'Steel, Aluminum, Electronics',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 26262 ASIL-D',
    knowsCQIs: true,
    annualRevenue: '$6.2B', productionVolume: '2M units/month', employees: 11000,
    facilities: 18, topCustomers: 'Hyundai, GM, Ford', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'ASIL-D certified, high volume capacity', weaknesses: 'Long shipping lead times from Korea',
    observations: 'Exploring Mexico plant setup', recommendations: 'Continue engagement',
    priority: 2, primaryDriver: 'Bad Performance', confidenceLevel: 'Medium',
    documents: makeDocs(2), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-05-10', action: 'Supplier registered directly', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-05-22', action: 'Moved from Scouting Event to B2B', user: 'Carlos Mendoza', role: 'SSD Lead' },
    ],
    onboardingDate: '2026-05-10',
  },

  // === PARKING LOT ===
  {
    id: 'ps6', folio: 'SSD-2026-006', name: 'KERN LIEBERS', stage: 'Parking Lot',
    commodity: 'Springs', productType: 'Precision Springs', country: 'Germany',
    manufacturingAddress: 'Schramberg, Germany', buyer: 'Ana García',
    scoutingInput: 'Scouting B2B Sessions Q2', daysInStage: 28,
    daysSinceParkingLot: 28, docsPercent: 67, sla: 'amber', globalSla: 'green', subStatus: 'Under Evaluation',
    fullName: 'Kern-Liebers GmbH', dunsNumber: '31-234-5678', companyType: 'Family-owned',
    foundedYear: 1888, headquarters: 'Schramberg, Germany', website: 'https://kern-liebers.com',
    phone: '+49 7422 512 0', contactEmail: 'auto@kern-liebers.com', contactName: 'Thomas Schmidt',
    technology: 'Spring Forming', machineryType: 'CNC Spring Coilers',
    processMethod: 'Cold forming, heat treatment', pressCapacity: '50T', materials: 'Spring Steel, Stainless',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001',
    knowsCQIs: true,
    annualRevenue: '$800M', productionVolume: '15M units/month', employees: 4500,
    facilities: 12, topCustomers: 'Bosch, Continental, ZF', hasIMMEX: false, planIMMEX: true,
    exportCapability: true,
    strengths: 'Unmatched precision spring expertise, IATF certified', weaknesses: 'No Mexico presence yet',
    observations: 'Discussing Mexico plant for 2027', recommendations: 'Hold for IMMEX timeline clarity',
    priority: 2, primaryDriver: 'Dual Source', confidenceLevel: 'Medium',
    documents: makeDocs(4), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-03-15', action: 'Supplier registered from Scouting Event', user: 'Ana García', role: 'Buyer' },
      { date: '2026-04-01', action: 'Moved from Scouting Event to B2B', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-01', action: 'Moved from B2B to Parking Lot', user: 'Ana García', role: 'Buyer', note: 'NDA signed, pending Go/No Go' },
      { date: '2026-05-15', action: 'Sub-status changed to: Under Evaluation', user: 'Carlos Mendoza', role: 'SSD Lead' },
    ],
    onboardingDate: '2026-03-15',
  },
  {
    id: 'ps7', folio: 'SSD-2026-007', name: 'SCHAEFFLER', stage: 'Parking Lot',
    commodity: 'Bearings', productType: 'Needle Bearings', country: 'Germany',
    manufacturingAddress: 'Herzogenaurach, Germany', buyer: 'Roberto Sánchez',
    scoutingInput: 'Registro directo', daysInStage: 12,
    daysSinceParkingLot: 12, docsPercent: 83, sla: 'green', globalSla: 'green', subStatus: 'Go',
    fullName: 'Schaeffler AG', dunsNumber: '31-678-9012', companyType: 'Public',
    foundedYear: 1946, headquarters: 'Herzogenaurach, Germany', website: 'https://schaeffler.com',
    phone: '+49 9132 82 0', contactEmail: 'automotive@schaeffler.com', contactName: 'Martin Fischer',
    technology: 'Precision Bearing Manufacturing', machineryType: 'Grinding & Superfinishing Lines',
    processMethod: 'Forging, turning, grinding', pressCapacity: '2000T', materials: 'Bearing Steel 100Cr6',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, ISO 50001',
    knowsCQIs: true,
    annualRevenue: '$17.8B', productionVolume: '50M bearings/month', employees: 83000,
    facilities: 75, topCustomers: 'VW, BMW, GM, Ford', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'World leader in bearings, massive capacity', weaknesses: 'High MOQs',
    observations: 'Approved Go — ready for Preliminary Eval', recommendations: 'Advance to Preliminary Evaluation',
    priority: 1, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(5), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-03-01', action: 'Supplier registered directly', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-04-10', action: 'Moved from B2B to Parking Lot', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-05-17', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
    ],
    onboardingDate: '2026-03-01',
  },
  {
    id: 'ps8', folio: 'SSD-2026-008', name: 'CONDUMEX', stage: 'Parking Lot',
    commodity: 'Wiring', productType: 'Wire Harnesses', country: 'Mexico',
    manufacturingAddress: 'Querétaro, QRO', buyer: 'Carlos Mendoza',
    scoutingInput: 'EV Components Fair 2026', daysInStage: 31,
    daysSinceParkingLot: 31, docsPercent: 50, sla: 'red', globalSla: 'green', subStatus: 'No Go',
    fullName: 'Condumex S.A. de C.V.', dunsNumber: '80-345-6789', companyType: 'Private',
    foundedYear: 1952, headquarters: 'Mexico City, Mexico', website: 'https://condumex.com.mx',
    phone: '+52 55 5328 0000', contactEmail: 'autos@condumex.com', contactName: 'Fernando López',
    technology: 'Wire Drawing & Harness Assembly', machineryType: 'Wire drawing, crimping lines',
    processMethod: 'Drawing, stranding, assembly', pressCapacity: 'N/A', materials: 'Copper, PVC, Cross-linked PE',
    safetyCritical: false, safetyExperience: false, certifications: 'ISO 9001, ISO 14001',
    knowsCQIs: false,
    annualRevenue: '$2.1B', productionVolume: '1M harnesses/month', employees: 15000,
    facilities: 8, topCustomers: 'Nissan, GM, Ford', hasIMMEX: true, planIMMEX: true,
    exportCapability: true,
    strengths: 'Strong Mexico presence, USMCA compliant', weaknesses: 'No IATF, no CQI knowledge, missed SLA',
    observations: 'SLA exceeded — No Go decision due to lack of certifications', recommendations: 'Reject or revisit after IATF',
    priority: 3, primaryDriver: 'USMCA', confidenceLevel: 'Low',
    documents: makeDocs(3), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-03-10', action: 'Supplier registered from Scouting Event', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-04-01', action: 'Moved from B2B to Parking Lot', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-05-20', action: 'Sub-status changed to: No Go', user: 'Carlos Mendoza', role: 'SSD Lead', note: 'Lacks IATF, SLA exceeded' },
    ],
    onboardingDate: '2026-03-10',
  },
  {
    id: 'ps9', folio: 'SSD-2026-009', name: 'CONTINENTAL', stage: 'Parking Lot',
    commodity: 'Electronics', productType: 'ECU Modules', country: 'Germany',
    manufacturingAddress: 'Regensburg, Germany', buyer: 'Ana García',
    scoutingInput: 'Registro directo', daysInStage: 18,
    daysSinceParkingLot: 18, docsPercent: 67, sla: 'green', globalSla: 'green', subStatus: 'On Hold',
    fullName: 'Continental AG', dunsNumber: '31-111-2222', companyType: 'Public',
    foundedYear: 1871, headquarters: 'Hanover, Germany', website: 'https://continental.com',
    phone: '+49 511 938 01', contactEmail: 'auto.sales@continental.com', contactName: 'Andrea Braun',
    technology: 'ECU Manufacturing', machineryType: 'SMT, ICT, Conformal Coating',
    processMethod: 'PCB assembly, programming, testing', pressCapacity: 'N/A', materials: 'PCBs, ICs, Passive components',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 26262, ISO 14001',
    knowsCQIs: true,
    annualRevenue: '$44.4B', productionVolume: '8M ECUs/month', employees: 190000,
    facilities: 350, topCustomers: 'BMW, VW, Toyota, Ford', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Tier-1 electronics leader, ISO 26262 ASIL-D', weaknesses: 'Capacity constraints in short term',
    observations: 'On Hold — awaiting capacity confirmation Q3 2026', recommendations: 'Monitor capacity timeline',
    priority: 2, primaryDriver: 'Dual Source', confidenceLevel: 'Medium',
    documents: makeDocs(4), preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-04-05', action: 'Supplier registered directly', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-11', action: 'Moved from B2B to Parking Lot', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-18', action: 'Sub-status changed to: On Hold', user: 'Ana García', role: 'Buyer', note: 'Capacity not confirmed yet' },
    ],
    onboardingDate: '2026-04-05',
  },

  // === PRELIMINARY EVALUATION ===
  {
    id: 'ps10', folio: 'SSD-2026-010', name: 'JTEKT', stage: 'Preliminary Evaluation',
    commodity: 'Bearings', productType: 'Column Bearings', country: 'Japan',
    manufacturingAddress: 'Osaka, Japan', buyer: 'Roberto Sánchez',
    scoutingInput: 'Registro directo', daysInStage: 55,
    daysSinceParkingLot: 85, docsPercent: 83, sla: 'amber', globalSla: 'amber', subStatus: null,
    fullName: 'JTEKT Corporation', dunsNumber: '69-012-3456', companyType: 'Public',
    foundedYear: 2006, headquarters: 'Osaka, Japan', website: 'https://jtekt.co.jp',
    phone: '+81 6 6271 8451', contactEmail: 'global@jtekt.co.jp', contactName: 'Takeshi Yamamoto',
    technology: 'Precision Bearing & Steering', machineryType: 'Grinding, Honing, Assembly',
    processMethod: 'Forging, grinding, assembly', pressCapacity: '3000T', materials: 'Bearing Steel, Chrome Steel',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, ISO 26262',
    knowsCQIs: true,
    annualRevenue: '$13.2B', productionVolume: '30M bearings/month', employees: 45000,
    facilities: 60, topCustomers: 'Toyota, Honda, Nissan, GM', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Column bearing specialist, Toyota Group quality standards', weaknesses: 'Long evaluation cycles, Japan-centric',
    observations: 'Approaching SLA limit — need decision soon', recommendations: 'Expedite RFQ submission',
    priority: 1, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(5), preEvalStartDate: '2026-04-04',
    parts: [
      { partNumber: 'CB-100-A', partDescription: 'Column Bearing Assy', pl: 'EPS', peakVolume: 500000, program: 'MY2028 SUV', eop: '2032', targetPrice: 4.20, rfqPrice: 4.85, confidence: 'High' },
      { partNumber: 'CB-200-B', partDescription: 'Backup Bearing', pl: 'EPS', peakVolume: 200000, program: 'MY2027 Sedan', eop: '2031', targetPrice: 3.10, rfqPrice: 3.45, confidence: 'Medium' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$4.65', savingExpected: '6%', tooling: '$120K',
    selectedForDevelopment: false, investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-01-15', action: 'Supplier registered directly', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-02-20', action: 'Moved from B2B to Parking Lot', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-03-05', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-04-04', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Roberto Sánchez', role: 'SQD' },
    ],
    onboardingDate: '2026-01-15',
  },
  {
    id: 'ps11', folio: 'SSD-2026-011', name: 'THYSSENKRUPP', stage: 'Preliminary Evaluation',
    commodity: 'Steel', productType: 'EPS Shafts', country: 'Germany',
    manufacturingAddress: 'Essen, Germany', buyer: 'Carlos Mendoza',
    scoutingInput: 'Automotive Supplier Summit 2026', daysInStage: 20,
    daysSinceParkingLot: 55, docsPercent: 100, sla: 'green', globalSla: 'green', subStatus: null,
    fullName: 'thyssenkrupp AG', dunsNumber: '31-555-6666', companyType: 'Public',
    foundedYear: 1999, headquarters: 'Essen, Germany', website: 'https://thyssenkrupp.com',
    phone: '+49 201 844 0', contactEmail: 'auto.steel@thyssenkrupp.com', contactName: 'Klaus Richter',
    technology: 'Steel Forging & Machining', machineryType: 'Forging press, CNC lathes',
    processMethod: 'Hot forging, precision machining', pressCapacity: '8000T', materials: 'Alloy Steel, Carbon Steel',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, VDA 6.3',
    knowsCQIs: true,
    annualRevenue: '$42.7B', productionVolume: '5M shafts/month', employees: 96000,
    facilities: 200, topCustomers: 'Nexteer, ZF, Bosch', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Existing Nexteer supplier, proven quality, massive scale', weaknesses: 'Pricing pressure from Asian alternatives',
    observations: 'Evaluation on track, competitive pricing received', recommendations: 'Proceed to RFQ',
    priority: 1, primaryDriver: 'Savings', confidenceLevel: 'High',
    documents: makeDocs(6), preEvalStartDate: '2026-05-09',
    parts: [
      { partNumber: 'SH-400-A', partDescription: 'EPS Input Shaft', pl: 'EPS', peakVolume: 800000, program: 'Global EPS Platform', eop: '2034', targetPrice: 8.50, rfqPrice: 8.20, confidence: 'High' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$8.20', savingExpected: '3.5%', tooling: '$85K',
    selectedForDevelopment: false, investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-02-01', action: 'Supplier registered from Scouting Event', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-03-15', action: 'Moved from B2B to Parking Lot', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-04-02', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-05-09', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Carlos Mendoza', role: 'SSD Lead' },
    ],
    onboardingDate: '2026-02-01',
  },

  // === RFQ ===
  {
    id: 'ps12', folio: 'SSD-2026-012', name: 'DANA INC', stage: 'RFQ',
    commodity: 'Steering', productType: 'Steering Columns', country: 'USA',
    manufacturingAddress: 'Maumee, OH', buyer: 'Ana García',
    scoutingInput: 'Registro directo', daysInStage: 10,
    daysSinceParkingLot: 78, docsPercent: 100, sla: 'green', globalSla: 'amber', subStatus: null,
    fullName: 'Dana Incorporated', dunsNumber: '00-678-9012', companyType: 'Public',
    foundedYear: 1904, headquarters: 'Maumee, OH, USA', website: 'https://dana.com',
    phone: '+1 419 887 3000', contactEmail: 'automotive@dana.com', contactName: 'Michael Torres',
    technology: 'Steering System Assembly', machineryType: 'Assembly & Test',
    processMethod: 'Modular assembly, EOL test', pressCapacity: '800T', materials: 'Steel, Aluminum, Polymers',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, ISO 26262',
    knowsCQIs: true,
    annualRevenue: '$10.2B', productionVolume: '1.5M columns/month', employees: 42000,
    facilities: 90, topCustomers: 'Ford, GM, Stellantis', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Column specialist, strong US presence, competitive', weaknesses: 'Limited EV portfolio expansion',
    observations: 'RFQ submitted, pricing competitive, approaching global SLA', recommendations: 'Fast-track to Investigation Record',
    priority: 1, primaryDriver: 'Savings', confidenceLevel: 'High',
    documents: makeDocs(6), preEvalStartDate: '2026-03-20',
    parts: [
      { partNumber: 'SC-300-A', partDescription: 'Steering Column Assy', pl: 'EPS', peakVolume: 600000, program: 'MY2028 Truck', eop: '2033', targetPrice: 28.00, rfqPrice: 26.50, confidence: 'High' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$26.50', savingExpected: '5.4%', tooling: '$250K',
    selectedForDevelopment: true, investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2026-01-10', action: 'Supplier registered directly', user: 'Ana García', role: 'Buyer' },
      { date: '2026-02-15', action: 'Moved from B2B to Parking Lot', user: 'Ana García', role: 'Buyer' },
      { date: '2026-02-28', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-03-20', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-19', action: 'Moved from Preliminary Evaluation to RFQ', user: 'Ana García', role: 'Buyer' },
    ],
    onboardingDate: '2026-01-10',
  },
  {
    id: 'ps13', folio: 'SSD-2026-013', name: 'ZF GROUP', stage: 'RFQ',
    commodity: 'Chassis', productType: 'Rack & Pinion', country: 'Germany',
    manufacturingAddress: 'Friedrichshafen, Germany', buyer: 'Roberto Sánchez',
    scoutingInput: 'Automotive Supplier Summit 2026', daysInStage: 5,
    daysSinceParkingLot: 92, docsPercent: 100, sla: 'green', globalSla: 'red', subStatus: null,
    fullName: 'ZF Friedrichshafen AG', dunsNumber: '31-333-4444', companyType: 'Private (Foundation)',
    foundedYear: 1915, headquarters: 'Friedrichshafen, Germany', website: 'https://zf.com',
    phone: '+49 7541 77 0', contactEmail: 'chassis@zf.com', contactName: 'Markus Bauer',
    technology: 'Steering Gear Manufacturing', machineryType: 'Precision Grinding, Assembly',
    processMethod: 'Machining, heat treat, assembly', pressCapacity: '4000T', materials: 'Alloy Steel, Aluminum',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 26262, ISO 14001',
    knowsCQIs: true,
    annualRevenue: '$46.6B', productionVolume: '3M units/month', employees: 165000,
    facilities: 260, topCustomers: 'BMW, VW, Ford, Stellantis', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Global steering leader, proven rack technology', weaknesses: 'Global SLA exceeded — urgent decision needed',
    observations: 'SLA global vencido — escalation required', recommendations: 'Decision within 5 business days',
    priority: 1, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(6), preEvalStartDate: '2026-02-25',
    parts: [
      { partNumber: 'RP-500-A', partDescription: 'Rack & Pinion Assy', pl: 'EPS', peakVolume: 400000, program: 'MY2027 EV Platform', eop: '2032', targetPrice: 45.00, rfqPrice: 43.80, confidence: 'High' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$43.80', savingExpected: '2.7%', tooling: '$380K',
    selectedForDevelopment: true, investigateRecordNumber: null, intelexDate: null,
    history: [
      { date: '2025-12-01', action: 'Supplier registered from Scouting Event', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-01-10', action: 'Moved from B2B to Parking Lot', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-01-25', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-02-25', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Roberto Sánchez', role: 'SQD' },
      { date: '2026-05-24', action: 'Moved from Preliminary Evaluation to RFQ', user: 'Roberto Sánchez', role: 'SQD', note: 'Global SLA exceeded — escalate' },
    ],
    onboardingDate: '2025-12-01',
  },

  // === INVESTIGATION RECORD ===
  {
    id: 'ps14', folio: 'SSD-2026-014', name: 'DENSO', stage: 'Investigation Record',
    commodity: 'Electronics', productType: 'Motor Controllers', country: 'Japan',
    manufacturingAddress: 'Kariya, Japan', buyer: 'Ana García',
    scoutingInput: 'Registro directo', daysInStage: 15,
    daysSinceParkingLot: 120, docsPercent: 100, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'DENSO Corporation', dunsNumber: '69-456-7890', companyType: 'Public',
    foundedYear: 1949, headquarters: 'Kariya, Aichi, Japan', website: 'https://denso.com',
    phone: '+81 566 25 5511', contactEmail: 'global.sales@denso.com', contactName: 'Yuki Tanaka',
    technology: 'Power Electronics', machineryType: 'SMT, Die Bonding, Wire Bonding',
    processMethod: 'Semiconductor packaging + PCB assy', pressCapacity: 'N/A', materials: 'Silicon, Copper, Ceramics',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 26262 ASIL-D, ISO 14001',
    knowsCQIs: true,
    annualRevenue: '$54.7B', productionVolume: '20M controllers/month', employees: 167000,
    facilities: 200, topCustomers: 'Toyota, Honda, Subaru', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'Tier-1 electronics leader, Toyota Production System, ASIL-D', weaknesses: 'Toyota-first allocation policy',
    observations: 'Investigation Record created, development initiated', recommendations: 'Track milestone deliverables',
    priority: 1, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(6), preEvalStartDate: '2026-01-15',
    parts: [
      { partNumber: 'MC-600-A', partDescription: 'EPS Motor Controller', pl: 'EPS', peakVolume: 1000000, program: 'Global EPS Gen4', eop: '2035', targetPrice: 18.00, rfqPrice: 17.20, confidence: 'High' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$17.20', savingExpected: '4.4%', tooling: '$450K',
    selectedForDevelopment: true, investigateRecordNumber: 'IR-2026-0042', intelexDate: '2026-05-14',
    history: [
      { date: '2025-10-01', action: 'Supplier registered directly', user: 'Ana García', role: 'Buyer' },
      { date: '2025-11-15', action: 'Moved from B2B to Parking Lot', user: 'Ana García', role: 'Buyer' },
      { date: '2025-12-01', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-01-15', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Ana García', role: 'Buyer' },
      { date: '2026-04-20', action: 'Moved from Preliminary Evaluation to RFQ', user: 'Ana García', role: 'Buyer' },
      { date: '2026-05-14', action: 'Moved from RFQ to Investigation Record', user: 'Ana García', role: 'Buyer', note: 'IR created: IR-2026-0042' },
    ],
    onboardingDate: '2025-10-01',
  },
  {
    id: 'ps15', folio: 'SSD-2026-015', name: 'AISIN', stage: 'Investigation Record',
    commodity: 'Transmission', productType: 'EPS Pumps', country: 'Japan',
    manufacturingAddress: 'Kariya, Japan', buyer: 'Carlos Mendoza',
    scoutingInput: 'Scouting B2B Sessions Q2', daysInStage: 8,
    daysSinceParkingLot: 105, docsPercent: 100, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Aisin Corporation', dunsNumber: '69-234-5678', companyType: 'Public',
    foundedYear: 1949, headquarters: 'Kariya, Aichi, Japan', website: 'https://aisin.com',
    phone: '+81 566 24 8441', contactEmail: 'sales@aisin.com', contactName: 'Hiroshi Sato',
    technology: 'Hydraulic Pump Manufacturing', machineryType: 'CNC, Assembly & Test',
    processMethod: 'Machining, assembly, end-of-line test', pressCapacity: '1500T', materials: 'Aluminum, Steel',
    safetyCritical: true, safetyExperience: true, certifications: 'IATF 16949, ISO 14001, ISO 26262',
    knowsCQIs: true,
    annualRevenue: '$37B', productionVolume: '8M pumps/month', employees: 100000,
    facilities: 100, topCustomers: 'Toyota, Honda, Stellantis', hasIMMEX: false, planIMMEX: false,
    exportCapability: true,
    strengths: 'EPS pump expertise, Toyota Group supplier', weaknesses: 'Premium pricing',
    observations: 'Development initiated, first samples expected Q4 2026', recommendations: 'Monitor sample delivery',
    priority: 2, primaryDriver: 'Dual Source', confidenceLevel: 'High',
    documents: makeDocs(6), preEvalStartDate: '2026-02-01',
    parts: [
      { partNumber: 'EP-700-A', partDescription: 'EPS Hydraulic Pump', pl: 'EPS', peakVolume: 350000, program: 'MY2028 Truck', eop: '2033', targetPrice: 22.00, rfqPrice: 21.50, confidence: 'High' },
    ],
    initialQuoteSubmitted: true, qadPrice: '$21.50', savingExpected: '2.3%', tooling: '$200K',
    selectedForDevelopment: true, investigateRecordNumber: 'IR-2026-0038', intelexDate: '2026-05-21',
    history: [
      { date: '2025-11-01', action: 'Supplier registered from Scouting Event', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2025-12-20', action: 'Moved from B2B to Parking Lot', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-01-10', action: 'Sub-status changed to: Go', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-02-01', action: 'Moved from Parking Lot to Preliminary Evaluation', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-05-01', action: 'Moved from Preliminary Evaluation to RFQ', user: 'Carlos Mendoza', role: 'SSD Lead' },
      { date: '2026-05-21', action: 'Moved from RFQ to Investigation Record', user: 'Carlos Mendoza', role: 'SSD Lead', note: 'IR created: IR-2026-0038' },
    ],
    onboardingDate: '2025-11-01',
  },
];

export const blacklistedSuppliers: BlacklistedSupplier[] = [
  {
    ...pipelineSuppliers.find(s => s.id === 'ps8')!,
    id: 'bl1', folio: 'SSD-2025-044', name: 'NEXTEER CHINA', stage: 'Parking Lot' as PipelineStage,
    commodity: 'Components', productType: 'Housing Assemblies', country: 'China',
    manufacturingAddress: 'Suzhou, China', buyer: 'Carlos Mendoza',
    scoutingInput: 'Registro directo', daysInStage: 0,
    daysSinceParkingLot: null, docsPercent: 100, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Nexteer Automotive (Suzhou) Co. Ltd',
    rejectedBy: 'Carlos Mendoza',
    rejectionDate: '2026-02-15',
    rejectionReason: 'Conflict of interest — internal Nexteer entity cannot be treated as external supplier per corporate governance policy.',
  },
  {
    ...pipelineSuppliers.find(s => s.id === 'ps8')!,
    id: 'bl2', folio: 'SSD-2025-038', name: 'SUNTECH METALS', stage: 'Preliminary Evaluation' as PipelineStage,
    commodity: 'Machined Parts', productType: 'Aluminum Brackets', country: 'China',
    manufacturingAddress: 'Dongguan, China', buyer: 'Roberto Sánchez',
    scoutingInput: 'EV Components Fair 2025', daysInStage: 0,
    daysSinceParkingLot: null, docsPercent: 50, sla: 'red', globalSla: null, subStatus: null,
    fullName: 'Suntech Metals Co. Ltd',
    rejectedBy: 'Roberto Sánchez',
    rejectionDate: '2026-01-20',
    rejectionReason: 'Failed preliminary quality audit — multiple critical non-conformances on dimensional control. No corrective action plan submitted within 30-day window.',
  },
  {
    ...pipelineSuppliers.find(s => s.id === 'ps8')!,
    id: 'bl3', folio: 'SSD-2025-051', name: 'METALSA FORGE', stage: 'B2B' as PipelineStage,
    commodity: 'Forgings', productType: 'Steel Forgings', country: 'Mexico',
    manufacturingAddress: 'Monterrey, NL', buyer: 'Ana García',
    scoutingInput: 'Registro directo', daysInStage: 0,
    daysSinceParkingLot: null, docsPercent: 33, sla: 'green', globalSla: null, subStatus: null,
    fullName: 'Metalsa Forge S.A. de C.V.',
    rejectedBy: 'Ana García',
    rejectionDate: '2026-03-05',
    rejectionReason: 'Financial instability — credit risk assessment flagged negative cash flow for 3 consecutive quarters. Supplier declined to provide updated financial statements.',
  },
];
