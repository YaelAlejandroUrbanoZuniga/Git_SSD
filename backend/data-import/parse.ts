/**
 * Excel → intermediate JSON parser for the GSM supplier data (5 spreadsheets).
 *
 *   npm run import:parse   (from backend/)
 *
 * Reads backend/data-import/source/*.xlsx and writes backend/data-import/output/:
 *   suppliers.json  events.json  mrl.json  import-report.md
 *
 * This script writes NO database. It deduplicates suppliers that were written across
 * several sheets (the sheets are LAYERS of one pipeline, not separate sets), resolves
 * each supplier's most-advanced stage, maps commodities to the catalog, truncates every
 * text field to its real NVARCHAR limit, and produces a human-readable report of every
 * transformation. Output shape mirrors frontend/src/types/index.ts (TrackerSupplier /
 * BlacklistedSupplier) with id/folio left null (assigned by the DB importer) plus two
 * importer fields the DB needs but the frontend derives: `status` and `stageBeforeExit`.
 *
 * Dedup key = normalized name + mapped commodity (a company evaluated for two commodities
 * is two suppliers, by design — DunsNumber has no UNIQUE). Scouting-List rows have no
 * defined commodity, so they dedup by name only and attach to an existing supplier when
 * one already exists.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import {
  extractInt, extractYear, isSeededUser, mapCommodity, normalizeBuyer, normalizeConfidence,
  normalizeEventName, normalizeImmex, normalizeName, normalizePlanToGetImmex, normalizeSpace,
  normalizeSubStatus, normalizeYN, parseExcelDate, resolveEntrySource, resolveStage,
  truncate, type CommodityReason,
} from './normalize';
import { CANONICAL_EVENTS, FIELD_LIMITS, PENDING_GSM } from './mappings';
import { calcIntelexGlobalEfficiency } from '../src/domain/intelexEfficiency';

const SRC = path.join(__dirname, 'source');
const OUT = path.join(__dirname, 'output');
const NOW = new Date();

// ── Report accumulators ───────────────────────────────────────────────────
interface MergeInfo { name: string; commodity: string; stage: string; status: string; sources: string[]; }
interface TruncInfo { supplier: string; field: string; originalLength: number; limit: number; }
interface TbdInfo { name: string; original: string; reason: CommodityReason; sheet: string; }
interface BuyerInfo { buyer: string; sheet: string; }
interface AmbiguityInfo { scoutingName: string; event: string; chosen: string; candidates: string[]; }
interface DiscardInfo { sheet: string; row: number; reason: string; }

const merges: MergeInfo[] = [];
const truncations: TruncInfo[] = [];
const tbd: TbdInfo[] = [];
const unknownBuyers: BuyerInfo[] = [];
const ambiguities: AmbiguityInfo[] = [];
const discarded: DiscardInfo[] = [];

// ── XLSX helpers ──────────────────────────────────────────────────────────
function sheet(file: string, name: string): XLSX.WorkSheet {
  const wb = XLSX.readFile(path.join(SRC, file), { cellDates: true });
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found in ${file}. Available: ${wb.SheetNames.join(' | ')}`);
  return ws;
}
/** Raw cell value at 1-based row / 0-based col. */
function cell(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const c = ws[XLSX.utils.encode_cell({ r: row - 1, c: col })];
  return c ? c.v : undefined;
}
/** Trimmed, whitespace-collapsed string cell. */
function str(ws: XLSX.WorkSheet, row: number, col: number): string {
  return normalizeSpace(cell(ws, row, col));
}
function date(ws: XLSX.WorkSheet, row: number, col: number): string | null {
  return parseExcelDate(cell(ws, row, col));
}

// ── Supplier accumulator (one per dedup key) ───────────────────────────────
interface Rows { ws: XLSX.WorkSheet; row: number; }
interface Acc {
  key: string;
  normName: string;
  originalName: string;
  commodity: string;         // mapped catalog value (or PENDING_GSM)
  onboardingSort: string;    // best onboarding date for the oldest-tie-break ('' if none)
  parking?: Rows;
  prelim?: Rows;
  blacklist?: Rows;
  scouting?: Rows;           // first scouting row (for a scouting-only supplier's fields)
  events: Set<string>;       // canonical event names this supplier participated in
  reachedSupplierEval: boolean;
  reachedIntelex: boolean;
  scoutingCommodityOriginal: string; // raw Commodity col from Scouting List (preserved)
  sources: string[];                 // Excel provenance (folio/item per source sheet)
}

const byKey = new Map<string, Acc>();

function getAcc(normName: string, commodity: string, originalName: string, keySuffix = ''): Acc {
  const key = keySuffix ? `${normName}||${keySuffix}` : `${normName}||${commodity}`;
  let a = byKey.get(key);
  if (!a) {
    a = {
      key, normName, originalName, commodity, onboardingSort: '',
      events: new Set(), reachedSupplierEval: false, reachedIntelex: false,
      scoutingCommodityOriginal: '', sources: [],
    };
    byKey.set(key, a);
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. PARKING LOT LIST — rows 9-159, key columns B..U
// ═══════════════════════════════════════════════════════════════════════════
function readParking() {
  const ws = sheet('Supplier_Parking.xlsx', 'PARKING LOT LIST');
  for (let r = 9; r <= 159; r++) {
    const name = str(ws, r, 10); // K Company Name
    if (!name) { continue; }
    const { commodity, reason } = mapCommodity(cell(ws, r, 16)); // Q Commodity
    recordTbd(name, str(ws, r, 16), reason, 'Parking');
    const a = getAcc(normalizeName(name), commodity, name);
    if (a.parking) { merges.push({ name, commodity, stage: '(dup in Parking)', status: '', sources: [`Parking row ${a.parking.row}`, `Parking row ${r}`] }); continue; }
    a.parking = { ws, row: r };
    a.originalName = name;
    a.sources.push(`Parking Lot List folio ${str(ws, r, 1)}`); // B No. Folio
    const onboard = date(ws, r, 2); // C Onboarding Date
    if (onboard) a.onboardingSort = earliest(a.onboardingSort, onboard);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PRELIMINARY EVALUATION — rows 4-36, key columns D..CQ
// ═══════════════════════════════════════════════════════════════════════════
function readPreliminary() {
  const ws = sheet('Preliminary_Evaluation_of_Suppliers_for_Development.xlsx', 'Preliminary evaluation');
  for (let r = 4; r <= 36; r++) {
    const name = str(ws, r, 9); // J Company Name
    if (!name) { continue; }
    const { commodity, reason } = mapCommodity(cell(ws, r, 8)); // I Commodity
    recordTbd(name, str(ws, r, 8), reason, 'Preliminary');
    const a = getAcc(normalizeName(name), commodity, name);
    a.prelim = { ws, row: r };
    a.originalName = name; // Preliminary is the most authoritative name source
    a.sources.push(`Preliminary Evaluation folio ${str(ws, r, 3)}`); // D No. Folio
    // Stage evidence within Preliminary.
    const ixDate = str(ws, r, 72); // BU Intelex Investigate Record Creation Date
    const ixRec = str(ws, r, 74);  // BW Investigate record number
    const selected = str(ws, r, 71); // BT Selected for Development Y/N
    if (ixDate && ixRec && ixDate !== '-' && ixRec !== '-') a.reachedIntelex = true;
    else if (/^yes$/i.test(selected)) a.reachedSupplierEval = true;
    const start = date(ws, r, 5); // F Pre-Eval Start Date
    if (start) a.onboardingSort = earliest(a.onboardingSort, start);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. BLACKLIST — rows 7-94, key columns B..P
// ═══════════════════════════════════════════════════════════════════════════
function readBlacklist() {
  const ws = sheet('BlackList_Suppliers.xlsx', 'Supplier Black List ');
  for (let r = 7; r <= 94; r++) {
    const name = str(ws, r, 3); // D Company Name
    if (!name) { continue; }
    const { commodity, reason } = mapCommodity(cell(ws, r, 7)); // H Commodity
    recordTbd(name, str(ws, r, 7), reason, 'Blacklist');
    const a = getAcc(normalizeName(name), commodity, name);
    a.blacklist = { ws, row: r };
    if (!a.parking && !a.prelim) a.originalName = name;
    a.sources.push(`Blacklist folio ${str(ws, r, 1)}`); // B No.
    // Record columns tell us how far it got before exit.
    const invRec = str(ws, r, 5); // F Investigate Record
    const devRec = str(ws, r, 6); // G Supplier Development Record
    if (invRec && invRec !== '-') a.reachedIntelex = true;
    if (devRec && devRec !== '-') a.reachedSupplierEval = true;
    const rej = date(ws, r, 2); // C Date (rejection)
    if (rej) a.onboardingSort = earliest(a.onboardingSort, rej);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SCOUTING LIST — rows 5-424. Dedup by NAME ONLY (commodity undefined here).
// ═══════════════════════════════════════════════════════════════════════════
function readScouting() {
  const ws = sheet('Scouting_Event_-_B2B_Meetings.xlsx', 'Scouting List');
  for (let r = 5; r <= 424; r++) {
    const name = str(ws, r, 4); // E Company Name
    if (!name) { continue; }
    const nn = normalizeName(name);
    const event = normalizeEventName(cell(ws, r, 2)); // C Name of the event
    // Existing NON-scouting suppliers with the same normalized name.
    const candidates = [...byKey.values()].filter(a => a.normName === nn && (a.parking || a.prelim || a.blacklist));
    if (candidates.length > 0) {
      // Attach the event participation to the oldest-onboarding candidate.
      const chosen = candidates.slice().sort((x, y) => oldest(x.onboardingSort, y.onboardingSort))[0];
      chosen.events.add(event || 'Scouting Event');
      chosen.sources.push(`Scouting List item ${str(ws, r, 1)}${event ? ` (${event})` : ''}`); // B Item
      if (candidates.length > 1) {
        ambiguities.push({ scoutingName: name, event: event || '(no event)', chosen: `${chosen.originalName} [${chosen.commodity}]`, candidates: candidates.map(c => `${c.originalName} [${c.commodity}]`) });
      }
      continue;
    }
    // No existing supplier → a scouting-only supplier (name-only key).
    const a = getAcc(nn, PENDING_GSM, name, '__SCOUTING__');
    if (!a.scouting) { a.scouting = { ws, row: r }; a.originalName = name; a.scoutingCommodityOriginal = str(ws, r, 6); }
    a.sources.push(`Scouting List item ${str(ws, r, 1)}${event ? ` (${event})` : ''}`); // B Item
    if (event) a.events.add(event);
  }
}

// ── small date helpers ─────────────────────────────────────────────────────
function earliest(a: string, b: string): string { if (!a) return b; if (!b) return a; return a < b ? a : b; }
function oldest(a: string, b: string): number {
  // sort comparator: empty dates sort LAST (treated as newest/unknown)
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function recordTbd(name: string, original: string, reason: CommodityReason, sheetName: string) {
  if (reason === 'aggregated' || reason === 'unmapped') {
    tbd.push({ name, original, reason, sheet: sheetName });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DTO construction
// ═══════════════════════════════════════════════════════════════════════════
function emptySupplier(): Record<string, unknown> {
  return {
    id: null, folio: null, name: '', stage: 'Scouting Event', scoutingPhase: 'Identified',
    entrySource: 'Recommendation', commodity: PENDING_GSM, productCategory: 'Direct',
    productType: '', country: '', manufacturingAddress: '', buyer: '', scoutingInput: '',
    daysInStage: 0, daysSinceParkingLot: null, docsPercent: 0, sla: 'green', globalSla: null,
    subStatus: null,
    fullName: '', dunsNumber: '', taxIdNumber: null, recommendedBy: null, recommenderDept: null,
    companyType: '', foundedYear: 0, headquarters: '', website: '', phone: '', contactEmail: '',
    contactName: '',
    technology: '', machineryType: '', processMethod: '', pressCapacity: '', materials: '',
    complementaryOperations: null, safetyCritical: false, safetyExperience: false,
    certifications: '', knowsCQIs: false,
    annualRevenue: '', productionVolume: '', employees: 0, facilities: 0, topCustomers: '',
    hasIMMEX: false, planIMMEX: false, exportCapability: false,
    strengths: '', weaknesses: '', observations: '', recommendations: '', priority: 2,
    primaryDriver: '', confidenceLevel: 'Medium',
    documents: [], preEvalStartDate: null, parts: [], initialQuoteSubmitted: false,
    qadPrice: null, savingExpected: null, tooling: null, selectedForDevelopment: false,
    investigateRecordNumber: null, intelexDate: null, history: [], notes: [],
    scoutingTabsCompleted: { scoutingEvent: false, supplierInfo: false, attendees: false, agenda: false, nextStep: false },
    b2bStatus: null, b2bWhoAttends: null, b2bManager: null, b2bBuyer: null, b2bComments: null,
    agendaStatus: null, agendaTeamsLink: null, agendaScheduledDate: null, agendaTimezone: null,
    agendaStand: null, agendaStartTime: null, agendaEndTime: null, agendaDuration: null,
    selectedForParking: null, selectionReason: null,
    parkingOnboardingDate: null, parkingTimeless: false, parkingDateToMovePreliminary: null,
    parkingDaysElapsed: null, parkingScoutingInput: null, parkingSubStatus: null,
    parkingIsRecommendation: false, parkingBuyer: null, parkingCompanyName: null,
    parkingB2BMeeting: null, parkingName1: null, parkingWebsite: null, parkingEmail1: null,
    parkingPhone: null, parkingCommodity: null, parkingProductType: null,
    parkingManufacturingCountry: null, parkingManufacturingAddress: null,
    parkingAdditionalComments: null, parkingTabsCompleted: null, preliminaryTabsCompleted: null,
    supplierEvalTabsCompleted: null, intelexTabsCompleted: null, intelexSaved: false,
    intelex_currentLevel: 'Investigate', intelex_recordCreationDate: null,
    intelex_investigateRecordNumber: null,
    intelex_investigateExpected: null, intelex_investigateReal: null, intelex_l0Expected: null,
    intelex_l0Real: null, intelex_l1Expected: null, intelex_l1Real: null, intelex_l2Expected: null,
    intelex_l2Real: null, intelex_l3Expected: null, intelex_l3Real: null, intelex_l4Expected: null,
    intelex_l4Real: null, intelex_efficiencyL0: null, intelex_efficiencyL1: null,
    intelex_efficiencyL2: null, intelex_efficiencyL3: null, intelex_efficiencyL4: null,
    intelex_efficiencyGlobal: null,
    prelim_startDate: null, prelim_priority: null, prelim_scoutingInput: null, prelim_buyer: null,
    prelim_commodity: null, prelim_primaryDriver: null, prelim_companyName: null,
    prelim_dunsNumber: null, prelim_hqAddress: null, prelim_hqCity: null, prelim_hqCountry: null,
    prelim_manufacturingAddress: null, prelim_manufacturingCity: null, prelim_manufacturingCountry: null,
    prelim_companyType: null, prelim_foundedYear: null, prelim_footprint: null,
    prelim_yearsInMexico: null, prelim_facilities: null, prelim_employees: null,
    prelim_annualRevenue: null, prelim_productionVolume: null, prelim_mainTechnology: null,
    prelim_pressCapacity: null, prelim_generalManager: null, prelim_market: null,
    prelim_topCustomers: null, prelim_exportCapability: null, prelim_certifications: null,
    prelim_hasIMMEX: null, prelim_planToGetIMMEX: null, prelim_machineryType: null,
    prelim_processingMethod: null, prelim_complementaryOps: null, prelim_toolingDesign: null,
    prelim_materials: null, prelim_rawMaterialIndex: null, prelim_applications: null,
    prelim_visitDatePlanned: null, prelim_visitDateCompleted: null, prelim_visitParticipants: null,
    prelim_strengths: null, prelim_weaknesses: null, prelim_observations: null,
    prelim_recommendations: null, prelim_parts: [], prelim_rfqReceived: null, prelim_ndaSigned: null,
    prelim_tcsSigned: null, prelim_ttcsSigned: null, prelim_nsrSigned: null, prelim_sdaSigned: null,
    prelim_costModel: null,
    onboardingDate: '', stageEnteredAt: null,
  };
}

/** Set a core field only if the incoming value is non-empty (precedence: later wins). */
function setCore(dto: Record<string, unknown>, field: string, val: string) {
  if (val && val.trim()) dto[field] = val.trim();
}

function confidenceLabel(raw: unknown): string {
  const code = normalizeConfidence(String(raw ?? ''));
  return code === 'H' ? 'High' : code === 'L' ? 'Low' : 'Medium';
}

function buyerField(raw: unknown, sheetName: string): string {
  const b = normalizeBuyer(raw);
  if (b && !b.includes('/') && !isSeededUser(b)) unknownBuyers.push({ buyer: b, sheet: sheetName });
  return b;
}

/** Truncate + record a single nested value (applyLimits only reaches top-level DTO
 *  fields, so nested arrays like prelim_parts truncate through this). */
function truncField(name: string, field: string, value: string, limit: number): string {
  if (value.length > limit) {
    truncations.push({ supplier: name, field, originalLength: value.length, limit });
    return truncate(value, limit);
  }
  return value;
}

/** Apply every FIELD_LIMITS entry present as a string on the DTO, recording truncations. */
function applyLimits(dto: Record<string, unknown>, name: string) {
  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    const v = dto[field];
    if (typeof v === 'string' && v.length > limit) {
      truncations.push({ supplier: name, field, originalLength: v.length, limit });
      dto[field] = truncate(v, limit);
    }
  }
}

// ── per-layer fillers (called in precedence order: scouting < blacklist < parking < prelim) ──
function fillScouting(dto: Record<string, unknown>, a: Acc) {
  if (!a.scouting) return;
  const { ws, row: r } = a.scouting;
  setCore(dto, 'name', str(ws, r, 4));
  setCore(dto, 'productType', str(ws, r, 5)); // F Type of Products
  setCore(dto, 'contactName', str(ws, r, 7)); // H
  setCore(dto, 'contactEmail', str(ws, r, 8)); // I
  setCore(dto, 'phone', str(ws, r, 9)); // J
  setCore(dto, 'website', str(ws, r, 10)); // K
  setCore(dto, 'buyer', buyerField(cell(ws, r, 14), 'Scouting')); // O Buyer
  // Scouting tab detail
  const b2b = str(ws, r, 11); // L B2B Meeting Yes/No
  dto.b2bStatus = /^yes$/i.test(b2b) ? 'Yes' : /^no$/i.test(b2b) ? 'No' : null;
  dto.b2bWhoAttends = str(ws, r, 12) || null; // M Attender
  dto.b2bManager = str(ws, r, 13) || null;    // N Manager
  dto.b2bBuyer = str(ws, r, 14) || null;      // O Buyer
  dto.b2bComments = str(ws, r, 15) || null;   // P Comments
  dto.agendaStatus = str(ws, r, 16) || null;  // Q Status
  dto.agendaScheduledDate = date(ws, r, 18);  // S Scheduled Date
  dto.agendaTimezone = str(ws, r, 19) || null; // T Time zone
  dto.agendaStand = str(ws, r, 20) || null;   // U Stand
  dto.agendaDuration = str(ws, r, 23) || null; // X Duration
  const sel = str(ws, r, 24); // Y Selected for Parking Lot Included/Not Included
  dto.selectedForParking = /included/i.test(sel) && !/not/i.test(sel) ? true : /not/i.test(sel) ? false : null;
  dto.selectionReason = str(ws, r, 25) || null; // Z Reason
  dto.scoutingTabsCompleted = { scoutingEvent: true, supplierInfo: true, attendees: !!b2b, agenda: !!dto.agendaScheduledDate, nextStep: dto.selectedForParking != null };
  // Preserve the raw Scouting-List commodity (not a catalog value) so nothing is lost.
  if (a.scoutingCommodityOriginal) {
    dto.parkingAdditionalComments = `[Excel: Commodity=${a.scoutingCommodityOriginal}]`;
  }
}

function fillBlacklist(dto: Record<string, unknown>, a: Acc) {
  if (!a.blacklist) return;
  const { ws, row: r } = a.blacklist;
  setCore(dto, 'name', str(ws, r, 3));       // D Company Name
  setCore(dto, 'productType', str(ws, r, 8)); // I Type of Products
  setCore(dto, 'contactName', str(ws, r, 9)); // J Name 1
  setCore(dto, 'contactEmail', str(ws, r, 10)); // K Email 1
  setCore(dto, 'phone', str(ws, r, 11));     // L Phone
  setCore(dto, 'website', str(ws, r, 12));   // M Website
  setCore(dto, 'buyer', buyerField(cell(ws, r, 13), 'Blacklist')); // N Buyer
  setCore(dto, 'scoutingInput', normalizeEventName(cell(ws, r, 4))); // E Scouting Input
  // Rejection (BlacklistedSupplier fields).
  dto.rejectedBy = buyerField(cell(ws, r, 14), 'Blacklist'); // O Rejected By
  dto.rejectionDate = date(ws, r, 2) ?? ''; // C Date
  dto.rejectionReason = str(ws, r, 15);     // P Reason
}

function fillParking(dto: Record<string, unknown>, a: Acc) {
  if (!a.parking) return;
  const { ws, row: r } = a.parking;
  setCore(dto, 'name', str(ws, r, 10)); // K
  setCore(dto, 'productType', str(ws, r, 17)); // R Product Type
  setCore(dto, 'country', str(ws, r, 18)); // S Manufacturing Country
  setCore(dto, 'manufacturingAddress', str(ws, r, 19)); // T
  setCore(dto, 'contactName', str(ws, r, 12)); // M Name 1
  setCore(dto, 'website', str(ws, r, 13)); // N
  setCore(dto, 'contactEmail', str(ws, r, 14)); // O Email 1
  setCore(dto, 'phone', str(ws, r, 15)); // P
  setCore(dto, 'buyer', buyerField(cell(ws, r, 9), 'Parking')); // J Buyer
  const recommender = str(ws, r, 8); // I Recomendation (person)
  if (recommender) dto.recommendedBy = recommender;
  const status = normalizeSubStatus(cell(ws, r, 7)); // H
  dto.subStatus = status;
  // Parking satellite (Timeless col D and broken "Days elapsed" col F are ignored on purpose).
  dto.parkingOnboardingDate = date(ws, r, 2); // C
  dto.parkingDateToMovePreliminary = date(ws, r, 4); // E
  dto.parkingScoutingInput = normalizeEventName(cell(ws, r, 6)) || null; // G
  dto.parkingSubStatus = status;
  dto.parkingBuyer = buyerField(cell(ws, r, 9), 'Parking') || null;
  dto.parkingCompanyName = str(ws, r, 10) || null;
  const pb2b = str(ws, r, 11); // L B2B Meeting
  dto.parkingB2BMeeting = /^yes$/i.test(pb2b) ? 'Yes' : /^no$/i.test(pb2b) ? 'No' : null;
  dto.parkingName1 = str(ws, r, 12) || null;
  dto.parkingWebsite = str(ws, r, 13) || null;
  dto.parkingEmail1 = str(ws, r, 14) || null;
  dto.parkingPhone = str(ws, r, 15) || null;
  dto.parkingCommodity = a.commodity;
  dto.parkingProductType = str(ws, r, 17) || null;
  dto.parkingManufacturingCountry = str(ws, r, 18) || null;
  dto.parkingManufacturingAddress = str(ws, r, 19) || null;
  const addComments = str(ws, r, 20); // U
  if (addComments) dto.parkingAdditionalComments = addComments;
  dto.parkingTabsCompleted = { overview: !!status, contact: false, details: false };
}

function fillPreliminary(dto: Record<string, unknown>, a: Acc) {
  if (!a.prelim) return;
  const { ws, row: r } = a.prelim;
  const g = (c: number) => str(ws, r, c);
  setCore(dto, 'name', g(9)); // J
  setCore(dto, 'buyer', buyerField(cell(ws, r, 7), 'Preliminary')); // H
  setCore(dto, 'country', g(18)); // S Country of Manufacturing
  setCore(dto, 'manufacturingAddress', g(16)); // Q
  setCore(dto, 'dunsNumber', g(10)); // K
  setCore(dto, 'headquarters', g(11)); // L HQ address
  setCore(dto, 'companyType', g(23)); // X
  setCore(dto, 'technology', g(30)); // AE Main Technology
  setCore(dto, 'pressCapacity', g(31)); // AF
  setCore(dto, 'machineryType', g(39)); // AN
  setCore(dto, 'processMethod', g(40)); // AO
  setCore(dto, 'complementaryOperations', g(41)); // AP
  setCore(dto, 'materials', g(43)); // AR
  setCore(dto, 'certifications', g(36)); // AK
  setCore(dto, 'annualRevenue', g(28)); // AC
  setCore(dto, 'productionVolume', g(29)); // AD
  setCore(dto, 'topCustomers', g(34)); // AI
  setCore(dto, 'strengths', g(46)); // AU
  setCore(dto, 'weaknesses', g(47)); // AV
  setCore(dto, 'observations', g(48)); // AW
  setCore(dto, 'recommendations', g(49)); // AX
  setCore(dto, 'primaryDriver', g(50)); // AY
  setCore(dto, 'scoutingInput', normalizeEventName(cell(ws, r, 6))); // G
  // Numbers from prose.
  const fy = extractYear(g(22)); if (fy != null) dto.foundedYear = fy; // W
  const emp = extractInt(g(27)); if (emp != null) dto.employees = emp; // AB
  const fac = extractInt(g(26)); if (fac != null) dto.facilities = fac; // AA
  const pr = extractInt(g(4)); if (pr != null) dto.priority = Math.min(3, Math.max(1, pr)) as number; // E
  // IMMEX + confidence + export.
  dto.hasIMMEX = normalizeImmex(g(37)) === 'Yes'; // AL
  dto.planIMMEX = normalizeImmex(g(37)) === 'In Plan';
  dto.confidenceLevel = confidenceLabel(g(63)); // BL
  dto.exportCapability = /^yes$/i.test(g(35)); // AJ
  dto.preEvalStartDate = date(ws, r, 5); // F

  // Preliminary satellite (prelim_*) — the confirmed-at-Preliminary profile.
  dto.prelim_startDate = date(ws, r, 5);
  dto.prelim_priority = pr != null ? (Math.min(3, Math.max(1, pr)) as number) : null;
  dto.prelim_scoutingInput = normalizeEventName(cell(ws, r, 6)) || null;
  dto.prelim_buyer = buyerField(cell(ws, r, 7), 'Preliminary') || null;
  dto.prelim_commodity = a.commodity;
  dto.prelim_primaryDriver = g(50) || null;
  dto.prelim_companyName = g(9) || null;
  dto.prelim_dunsNumber = g(10) || null;
  dto.prelim_hqAddress = g(11) || null;
  dto.prelim_hqCity = g(14) || null; // O City of HQ
  dto.prelim_hqCountry = g(15) || null; // P Country of HQ
  dto.prelim_manufacturingAddress = g(16) || null; // Q
  dto.prelim_manufacturingCity = g(17) || null; // R
  dto.prelim_manufacturingCountry = g(18) || null; // S
  dto.prelim_companyType = g(23) || null;
  dto.prelim_foundedYear = fy;
  dto.prelim_footprint = g(24) || null; // Y Footprint
  dto.prelim_yearsInMexico = extractInt(g(25)); // Z
  dto.prelim_facilities = fac;
  dto.prelim_employees = emp;
  dto.prelim_annualRevenue = g(28) || null;
  dto.prelim_productionVolume = g(29) || null;
  dto.prelim_mainTechnology = g(30) || null;
  dto.prelim_pressCapacity = g(31) || null;
  dto.prelim_generalManager = g(32) || null; // AG
  dto.prelim_market = g(33) || null; // AH
  dto.prelim_topCustomers = g(34) || null;
  dto.prelim_exportCapability = g(35) || null;
  dto.prelim_certifications = g(36) || null;
  dto.prelim_hasIMMEX = g(37) ? normalizeImmex(g(37)) : null;
  dto.prelim_planToGetIMMEX = normalizePlanToGetImmex(g(38)); // AM (NVARCHAR(5) — normalized, not truncated)
  const planFull = g(38);
  if (planFull && (planFull.length > 5)) {
    // Keep the full sentence so nothing is lost (col is only 5 chars).
    dto.prelim_observations = `[Plan IMMEX] ${planFull}`;
  }
  dto.prelim_machineryType = g(39) || null;
  dto.prelim_processingMethod = g(40) || null;
  dto.prelim_complementaryOps = g(41) || null;
  dto.prelim_toolingDesign = g(42) || null; // AQ
  dto.prelim_materials = g(43) || null;
  dto.prelim_rawMaterialIndex = g(44) || null; // AS
  dto.prelim_applications = g(45) || null; // AT
  dto.prelim_visitDatePlanned = date(ws, r, 19); // T
  dto.prelim_visitDateCompleted = date(ws, r, 20); // U
  dto.prelim_visitParticipants = g(21) || null; // V
  dto.prelim_strengths = g(46) || null;
  dto.prelim_weaknesses = g(47) || null;
  // If Plan IMMEX overflowed we already used observations; otherwise map the real one.
  if (!(planFull && planFull.length > 5)) dto.prelim_observations = g(48) || null;
  dto.prelim_recommendations = g(49) || null;
  dto.preliminaryTabsCompleted = { overview: true, capabilities: true };
  // Visit is a Supplier Evaluation tab now; its completion is still derived from
  // the "visit date completed" column (U) that feeds the prelim_visit* data.
  const visitDone = !!date(ws, r, 20);
  // "Noteworthy Notes" (CQ) is a running log with no dedicated column — kept as a
  // supplier note (built after stage resolution). Stashed on a temp key here.
  const noteworthy = g(94); // CQ
  if (noteworthy) (dto as Record<string, unknown>).__noteworthy = noteworthy;

  // Fundamentals (Supplier Evaluation tab).
  dto.prelim_rfqReceived = normalizeYN(g(64)); // BM
  dto.prelim_ndaSigned = normalizeYN(g(65)); // BN
  dto.prelim_tcsSigned = normalizeYN(g(66)); // BO
  dto.prelim_ttcsSigned = normalizeYN(g(67)); // BP
  dto.prelim_nsrSigned = normalizeYN(g(68)); // BQ
  dto.prelim_sdaSigned = normalizeYN(g(69)); // BR
  const hasFundamentals = !!(dto.prelim_rfqReceived || dto.prelim_ndaSigned);
  if (hasFundamentals || visitDone) {
    dto.supplierEvalTabsCompleted = {
      competitiveness: hasFundamentals,
      fundamentals: hasFundamentals,
      visit: visitDone,
    };
  }

  // Competitiveness (prelim_parts) — one part per row when a part number exists.
  const partNumber = g(52); // BA
  if (partNumber) {
    const conf = normalizeConfidence(g(63));
    const nm = a.originalName;
    // Nested prelim_parts fields aren't reached by applyLimits — truncate to the
    // T_Supplier_PrelimPart column limits here (a part number can be a joined list).
    dto.prelim_parts = [{
      partNumber: truncField(nm, 'prelim_parts.partNumber', partNumber, 100),
      partDescription: truncField(nm, 'prelim_parts.partDescription', g(53), 300),
      pl: truncField(nm, 'prelim_parts.pl', g(54), 50),
      annualPeakVolume: extractInt(g(55)),
      program: truncField(nm, 'prelim_parts.program', g(56), 100),
      eop: truncField(nm, 'prelim_parts.eop', g(57), 20),
      initialQuote: numOrNull(g(58)), qadPrice: numOrNull(g(59)), delta: numOrNull(g(60)),
      tooling: numOrNull(g(61)), savingExpected: numOrNull(g(62)),
      confidence: conf === 'TBD' ? null : conf,
    }];
    dto.initialQuoteSubmitted = !!g(58);
  }

  // Intelex satellite (only populated for the ~2 that reached it, but harmless otherwise).
  const invRec = g(74); // BW
  if (a.reachedIntelex) {
    dto.selectedForDevelopment = true;
    dto.investigateRecordNumber = invRec || null;
    dto.intelexDate = date(ws, r, 72); // BU
    dto.intelex_recordCreationDate = date(ws, r, 72);
    dto.intelex_investigateRecordNumber = invRec || null;
    dto.intelex_investigateExpected = date(ws, r, 76); // BY
    dto.intelex_l0Expected = date(ws, r, 77); dto.intelex_l1Expected = date(ws, r, 78);
    dto.intelex_l2Expected = date(ws, r, 79); dto.intelex_l3Expected = date(ws, r, 80);
    dto.intelex_l4Expected = date(ws, r, 81);
    dto.intelex_investigateReal = date(ws, r, 82); // CE
    dto.intelex_l0Real = date(ws, r, 83); dto.intelex_l1Real = date(ws, r, 84);
    dto.intelex_l2Real = date(ws, r, 85); dto.intelex_l3Real = date(ws, r, 86);
    dto.intelex_l4Real = date(ws, r, 87);
    dto.intelex_efficiencyL0 = numOrNull(g(89)); dto.intelex_efficiencyL1 = numOrNull(g(90));
    dto.intelex_efficiencyL2 = numOrNull(g(91)); dto.intelex_efficiencyL3 = numOrNull(g(92));
    dto.intelex_efficiencyL4 = numOrNull(g(93));
    // The Excel carries the five per-level percentages but not their average —
    // aggregate it here with the same rule the app uses (nulls skipped, never
    // counted as 0) so an imported supplier shows a Global straight away.
    dto.intelex_efficiencyGlobal = calcIntelexGlobalEfficiency(
      [89, 90, 91, 92, 93].map(c => numOrNull(g(c))),
    );
    dto.intelex_currentLevel = deriveIntelexLevel(dto);
    dto.intelexSaved = true;
    // The Efficiency tab has reviewable data when the handoff advanced past
    // Investigate (the UI derives efficiency from expected-vs-real dates, so any
    // captured level produces something to review) or when the Excel carries an
    // explicit efficiency value. This used to be hardcoded `false`, which left the
    // tab permanently incomplete and so permanently disabled the detail page's
    // "Complete" button for every imported supplier, however complete its data was.
    dto.intelexTabsCompleted = {
      record: true,
      timeline: true,
      efficiency: dto.intelex_currentLevel !== 'Investigate' || hasEfficiencyValue(dto),
    };
  } else if (a.reachedSupplierEval) {
    dto.selectedForDevelopment = true;
  }
}

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t || t === '-') return null;
  // Strip currency/thousands; a value that is ONLY '$' (or similar) leaves an empty
  // string — Number('') is 0, so guard against it → null (not a real 0). e.g. the MRL
  // row whose target price is the literal '$'.
  const cleaned = t.replace(/[$,]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** True when the Excel gave at least one Intelex efficiency percentage (L0…L4). */
function hasEfficiencyValue(dto: Record<string, unknown>): boolean {
  return ['intelex_efficiencyL0', 'intelex_efficiencyL1', 'intelex_efficiencyL2',
    'intelex_efficiencyL3', 'intelex_efficiencyL4'].some(k => dto[k] != null);
}

/** Furthest Intelex level whose Real date (and all before it) is set. */
function deriveIntelexLevel(dto: Record<string, unknown>): string {
  const seq: [string, string][] = [
    ['intelex_investigateReal', 'Investigate'], ['intelex_l0Real', 'L0'], ['intelex_l1Real', 'L1'],
    ['intelex_l2Real', 'L2'], ['intelex_l3Real', 'L3'], ['intelex_l4Real', 'L4'],
  ];
  let level = 'Investigate';
  for (const [key, label] of seq) {
    if (dto[key]) level = label; else break;
  }
  return level;
}

// ═══════════════════════════════════════════════════════════════════════════
// Build final suppliers
// ═══════════════════════════════════════════════════════════════════════════
function buildSuppliers(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const a of byKey.values()) {
    const dto = emptySupplier();
    dto.commodity = a.commodity;
    // Precedence: scouting < blacklist < parking < preliminary (later wins on core fields).
    fillScouting(dto, a);
    fillBlacklist(dto, a);
    fillParking(dto, a);
    fillPreliminary(dto, a);

    // Original name always preserved (never the normalized form).
    dto.name = a.originalName;
    if (!dto.fullName || !(dto.fullName as string).trim()) dto.fullName = a.originalName;

    // Stage / status / stageBeforeExit.
    const res = resolveStage({
      inScouting: !!a.scouting || a.events.size > 0,
      inParking: !!a.parking,
      inPreliminary: !!a.prelim,
      reachedSupplierEval: a.reachedSupplierEval,
      reachedIntelex: a.reachedIntelex,
      inBlacklist: !!a.blacklist,
    });
    dto.stage = res.stage;
    dto.status = res.status;
    dto.stageBeforeExit = res.stageBeforeExit;
    dto.scoutingPhase = res.stage === 'Scouting Event' ? 'Identified' : null;

    // entrySource + scoutingInput.
    const inputSource = (dto.parkingScoutingInput as string) || (dto.prelim_scoutingInput as string)
      || (dto.scoutingInput as string) || [...a.events][0] || '';
    dto.entrySource = resolveEntrySource(inputSource);
    if (!(dto.scoutingInput as string)?.trim()) {
      dto.scoutingInput = inputSource || (a.events.size ? [...a.events][0] : '');
    }
    dto.parkingIsRecommendation = dto.entrySource === 'Recommendation';

    // onboardingDate (required string). Best available; scouting-only → ''.
    dto.onboardingDate = (dto.parkingOnboardingDate as string) || (dto.preEvalStartDate as string)
      || (dto.rejectionDate as string) || a.onboardingSort || '';

    // "Noteworthy Notes" → a supplier note tagged to the resolved stage (SupplierNote
    // text is NVARCHAR(2000), so truncate there and record it).
    if ((dto as Record<string, unknown>).__noteworthy) {
      const raw = (dto as Record<string, unknown>).__noteworthy as string;
      let text = raw;
      if (text.length > 2000) {
        truncations.push({ supplier: a.originalName, field: 'note (Noteworthy Notes)', originalLength: text.length, limit: 2000 });
        text = truncate(text, 2000);
      }
      (dto.notes as unknown[]).push({
        id: null, text, author: 'Excel import', role: 'SSD',
        date: (dto.onboardingDate as string) || NOW.toISOString().slice(0, 10), stage: dto.stage,
      });
      delete (dto as Record<string, unknown>).__noteworthy;
    }

    // Record the merge (2+ source sheets) for the report.
    const sources: string[] = [];
    if (a.scouting || a.events.size) sources.push(`Scouting${a.events.size ? ` (${[...a.events].join(', ')})` : ''}`);
    if (a.parking) sources.push('Parking');
    if (a.prelim) sources.push('Preliminary');
    if (a.blacklist) sources.push('Blacklist');
    if (sources.length > 1) merges.push({ name: a.originalName, commodity: a.commodity, stage: dto.stage as string, status: dto.status as string, sources });

    // Excel provenance: the exact folio/item of every source row (the DB importer
    // writes it into the supplier's first history entry). Not part of the frontend
    // TrackerSupplier shape — seedSupplier ignores unknown keys.
    dto._excelSources = a.sources;

    applyLimits(dto, a.originalName);
    out.push(dto);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Events (Scouting Events Agenda) + MRL (Master Requirements List)
// ═══════════════════════════════════════════════════════════════════════════
function eventStatus(start: string | null, end: string | null): string {
  const today = NOW.toISOString().slice(0, 10);
  if (end && end < today) return 'Completed';
  if (start && start > today) return 'Upcoming';
  return 'Ongoing';
}

function buildEvents(supplierEventCounts: Map<string, number>): Record<string, unknown>[] {
  const ws = sheet('Scouting_Event_-_B2B_Meetings.xlsx', 'Scouting Events Agenda');
  const out: Record<string, unknown>[] = [];
  for (let r = 5; r <= 11; r++) {
    const name = str(ws, r, 2); // C
    if (!name) { discarded.push({ sheet: 'Scouting Events Agenda', row: r, reason: 'empty event name' }); continue; }
    const start = date(ws, r, 5); // F
    const end = date(ws, r, 6); // G
    const dto: Record<string, unknown> = {
      id: null, name: truncate(name, FIELD_LIMITS.eventName), dateStart: start ?? '', dateEnd: end ?? '',
      location: truncate(str(ws, r, 4), FIELD_LIMITS.location), // E
      organizer: '', // captured manually in-system (GSM)
      contactName: str(ws, r, 7) || undefined, // H
      contactEmail: str(ws, r, 8) || undefined, // I
      contactPhone: str(ws, r, 9) || undefined, // J
      status: eventStatus(start, end), description: '', type: 'Direct',
      suppliersRegistered: supplierEventCounts.get(name) ?? 0,
      supplierEntries: [], b2bMeetings: [], objective: '', topCountry: '', notes: [],
    };
    out.push(dto);
  }
  return out;
}

function buildMrl(): Record<string, unknown>[] {
  const ws = sheet('Master_Requirements_List_for_Supplier_Scouting.xlsx', 'Master Requirements List  ');
  const out: Record<string, unknown>[] = [];
  for (let r = 5; r <= 41; r++) {
    const buyer = str(ws, r, 2); // C Buyer Name
    const part = str(ws, r, 11); // L Part Number
    const desc = str(ws, r, 12); // M Part Description
    if (!buyer && !part && !desc) { continue; } // fully empty row
    const { commodity, reason } = mapCommodity(cell(ws, r, 3)); // D Commodity
    recordTbd(part || buyer || `MRL row ${r}`, str(ws, r, 3), reason, 'MRL');
    out.push({
      id: null, buyerName: truncate(buyer, FIELD_LIMITS.buyerName), commodity,
      nexteerProductLine: truncate(str(ws, r, 4), FIELD_LIMITS.nexteerProductLine), // E
      volumeByYear: {
        '2026': extractInt(cell(ws, r, 5)), '2027': extractInt(cell(ws, r, 6)),
        '2028': extractInt(cell(ws, r, 7)), '2029': extractInt(cell(ws, r, 8)),
        '2030': extractInt(cell(ws, r, 9)), '2031': extractInt(cell(ws, r, 10)),
      },
      partNumber: truncate(part, FIELD_LIMITS.partNumber),
      partDescription: truncate(desc, FIELD_LIMITS.partDescription),
      mainMaterialsSpecTech: truncate(str(ws, r, 13), FIELD_LIMITS.mainMaterialsSpecTech), // N
      peakVolume: extractInt(cell(ws, r, 14)), // O
      program: truncate(str(ws, r, 15), FIELD_LIMITS.program), // P
      eop: truncate(str(ws, r, 16), FIELD_LIMITS.eop), // Q
      targetPrice: numOrNull(str(ws, r, 17)), // R
      priority: clampPriority(extractInt(cell(ws, r, 18))), // S
      primaryDriver: truncate(str(ws, r, 19), FIELD_LIMITS.primaryDriver), // T
      keyManufacturingCapabilities: truncate(str(ws, r, 20), FIELD_LIMITS.keyManufacturingCapabilities), // U
      safetyCriticalPart: /^yes$/i.test(str(ws, r, 21)), // V
      supplierExperienceInSafetyRequired: /^yes$/i.test(str(ws, r, 22)), // W
      certifications: truncate(str(ws, r, 23), FIELD_LIMITS.certifications), // X
      knowsCQIs: /^yes$/i.test(str(ws, r, 24)), // Y
    });
  }
  return out;
}

function clampPriority(n: number | null): number { return n == null ? 2 : Math.min(3, Math.max(1, n)); }

// ═══════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════
function writeReport(suppliers: Record<string, unknown>[], events: Record<string, unknown>[], mrl: Record<string, unknown>[]) {
  const byStage = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const s of suppliers) {
    const label = s.status === 'BLACKLISTED' ? 'Blacklisted' : (s.stage as string);
    byStage.set(label, (byStage.get(label) ?? 0) + 1);
    byStatus.set(s.status as string, (byStatus.get(s.status as string) ?? 0) + 1);
  }
  const L: string[] = [];
  L.push('# Reporte de importación — Excel → JSON intermedio');
  L.push('');
  L.push(`Generado: ${NOW.toISOString()}`);
  L.push('');
  L.push('> Este parser NO escribe en la base de datos. Produce `suppliers.json`, `events.json`');
  L.push('> y `mrl.json` en `output/`. `id` y `folio` van en `null` (los asigna el importador).');
  L.push('');
  L.push('## 1. Conteo final');
  L.push('');
  L.push(`- **Proveedores deduplicados: ${suppliers.length}**`);
  L.push(`- Eventos: ${events.length}`);
  L.push(`- MRL (Master Requirements List): ${mrl.length}`);
  L.push('');
  L.push('### Por etapa (los blacklisted se listan aparte; su etapa interna es `stageBeforeExit`)');
  L.push('');
  L.push('| Etapa | Proveedores |');
  L.push('|---|---:|');
  for (const st of ['Scouting Event', 'Parking Lot', 'Preliminary Evaluation', 'Supplier Evaluation', 'Intelex Handoff', 'Blacklisted']) {
    L.push(`| ${st} | ${byStage.get(st) ?? 0} |`);
  }
  L.push('');
  L.push(`Status: ACTIVE ${byStatus.get('ACTIVE') ?? 0} · BLACKLISTED ${byStatus.get('BLACKLISTED') ?? 0}`);
  L.push('');

  L.push('## 2. Proveedores fusionados (aparecían en 2+ hojas → 1 proveedor)');
  L.push('');
  L.push(`Total fusiones: ${merges.length}`);
  L.push('');
  L.push('| Proveedor | Commodity | Etapa resuelta | Status | Hojas unidas |');
  L.push('|---|---|---|---|---|');
  for (const m of merges) L.push(`| ${esc(m.name)} | ${esc(m.commodity)} | ${m.stage} | ${m.status} | ${m.sources.join(' + ')} |`);
  L.push('');

  L.push("## 3. Commodities que cayeron en 'TBD -- Pending GSM'");
  L.push('');
  const tbdAgg = tbd.filter(t => t.reason === 'aggregated');
  const tbdUnmapped = tbd.filter(t => t.reason === 'unmapped');
  L.push(`- Agregados que GSM reclasificará (esperado): **${tbdAgg.length}** filas`);
  L.push(`- No mapeables (incidencias — revisar): **${tbdUnmapped.length}** filas`);
  L.push('');
  if (tbdUnmapped.length) {
    L.push('### Incidencias (commodity no reconocido en catálogo)');
    L.push('');
    L.push('| Proveedor | Valor Excel | Hoja |');
    L.push('|---|---|---|');
    for (const t of tbdUnmapped) L.push(`| ${esc(t.name)} | ${esc(t.original)} | ${t.sheet} |`);
    L.push('');
  }
  L.push('### Agregados → TBD (por valor)');
  L.push('');
  const aggByValue = new Map<string, number>();
  for (const t of tbdAgg) aggByValue.set(t.original, (aggByValue.get(t.original) ?? 0) + 1);
  for (const [val, n] of aggByValue) L.push(`- \`${esc(val)}\` → ${n} filas`);
  L.push('');

  L.push('## 4. Campos truncados a su límite NVARCHAR');
  L.push('');
  L.push(`Total: ${truncations.length}`);
  L.push('');
  if (truncations.length) {
    L.push('| Proveedor | Campo | Long. original | Límite |');
    L.push('|---|---|---:|---:|');
    for (const t of truncations.sort((a, b) => b.originalLength - a.originalLength)) {
      L.push(`| ${esc(t.supplier)} | ${t.field} | ${t.originalLength} | ${t.limit} |`);
    }
  }
  L.push('');

  L.push('## 5. Buyers / recomendadores NO reconocidos (texto libre, no se inventan como usuarios)');
  L.push('');
  const bcount = new Map<string, number>();
  for (const b of unknownBuyers) bcount.set(b.buyer, (bcount.get(b.buyer) ?? 0) + 1);
  L.push('| Nombre | Apariciones |');
  L.push('|---|---:|');
  for (const [name, n] of [...bcount.entries()].sort((a, b) => b[1] - a[1])) L.push(`| ${esc(name)} | ${n} |`);
  L.push('');

  L.push('## 6. Ambigüedades de asignación de eventos (misma empresa, varios commodities)');
  L.push('');
  L.push(`Total: ${ambiguities.length}`);
  L.push('');
  if (ambiguities.length) {
    L.push('| Empresa (Scouting) | Evento | Asignado a (más antiguo) | Candidatos |');
    L.push('|---|---|---|---|');
    for (const a of ambiguities) L.push(`| ${esc(a.scoutingName)} | ${esc(a.event)} | ${esc(a.chosen)} | ${a.candidates.map(esc).join(' ; ')} |`);
  }
  L.push('');

  L.push('## 7. Filas descartadas');
  L.push('');
  L.push(`Total: ${discarded.length}`);
  if (discarded.length) {
    L.push('');
    L.push('| Hoja | Fila | Motivo |');
    L.push('|---|---:|---|');
    for (const d of discarded) L.push(`| ${d.sheet} | ${d.row} | ${esc(d.reason)} |`);
  }
  L.push('');

  fs.writeFileSync(path.join(OUT, 'import-report.md'), L.join('\n'), 'utf8');
}

function esc(s: string): string { return s.replace(/\|/g, '\\|').replace(/\n/g, ' '); }

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('[import] reading sheets…');
  readParking();
  readPreliminary();
  readBlacklist();
  readScouting();

  console.log('[import] building suppliers…');
  const suppliers = buildSuppliers();

  // Count suppliers per event (for events.suppliersRegistered) from scoutingInput/events.
  const evCounts = new Map<string, number>();
  for (const a of byKey.values()) for (const e of a.events) evCounts.set(e, (evCounts.get(e) ?? 0) + 1);

  const events = buildEvents(evCounts);
  const mrl = buildMrl();

  fs.writeFileSync(path.join(OUT, 'suppliers.json'), JSON.stringify(suppliers, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify(events, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'mrl.json'), JSON.stringify(mrl, null, 2), 'utf8');
  writeReport(suppliers, events, mrl);

  console.log(`[import] done ✔  suppliers=${suppliers.length}  events=${events.length}  mrl=${mrl.length}`);
  console.log(`[import] merges=${merges.length} truncations=${truncations.length} tbd=${tbd.length} unknownBuyers=${unknownBuyers.length} ambiguities=${ambiguities.length}`);
  console.log(`[import] output → ${OUT}`);
}

main();
