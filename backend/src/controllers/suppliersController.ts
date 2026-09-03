import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as suppliersService from '../services/suppliersService';
import * as notesService from '../services/notesService';
import { DEMO_USER } from '../middleware/auth';
import { isOptionalEmail } from '../domain/textValidation';
import { IMMEX_ANSWERS } from '../domain/constants';

/** Shared shape for the optional contact address (see isOptionalEmail). */
const optionalEmail = z.string().refine(isOptionalEmail, {
  message: 'Invalid email format',
});

const createSchema = z.object({
  name: z.string().min(1),
  commodity: z.string().min(1),
  entrySource: z.enum(['Scouting Event', 'Recommendation']),
  productCategory: z.enum(['Direct', 'Indirect']).optional(),
  productType: z.string().optional(),
  country: z.string().optional(),
  manufacturingAddress: z.string().optional(),
  buyer: z.string().optional(),
  scoutingInput: z.string().optional(),
  recommendedBy: z.string().optional(),
  recommenderDept: z.string().optional(),
  fullName: z.string().optional(),
  dunsNumber: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  contactEmail: optionalEmail.optional(),
  contactName: z.string().optional(),
});

const noteSchema = z.object({ text: z.string().min(1) });

// ── PATCH /api/suppliers/:id — TYPE validation only ─────────────────────────
// WHICH keys are patchable stays the service's decision: updateSupplier routes
// the known ones to their table and answers 400 with its own "Fields not
// updatable via PATCH" list for the rest. Nothing here changes that, and every
// key stays optional — the endpoint is a partial patch by design.
//
// What this adds is the TYPE gate the endpoint never had. `req.body` used to go
// straight through as Record<string, unknown>, so `{"foundedYear": "abc"}` or
// `{"employees": {}}` reached Prisma raw and came back as a 500 INTERNAL, where
// the equivalent POST answers 400 VALIDATION_ERROR. Types below mirror the
// columns in schema.prisma (nullable column ⇒ `.nullable()` here).
//
// Every free-text field also carries the NVarChar width of the column it lands
// in, the idiom `formIntakeController` already uses: without it an over-long
// answer reached SQL Server as "String or binary data would be truncated",
// which aborts the ENTIRE patch (one transaction) behind an opaque error. Now
// it is a 400 naming the field. The only strings left uncapped are the ones
// that never reach a column — catalog names resolved to FK ids, and the
// server-owned values the service drops; each is marked where it appears.
//
// `.passthrough()` is deliberate and load-bearing: an unrecognised key must
// still reach the service so IT produces the rejection message.
const str = z.string();
const strOrNull = z.string().nullable();
const int = z.number().int();
const intOrNull = z.number().int().nullable();
const bool = z.boolean();
const numOrNull = z.number().nullable();
/** Trimmed, length-capped free text — `.trim()` runs before `.max()`. */
const text = (max: number) => z.string().trim().max(max);
/** Same, for a nullable column. */
const textOrNull = (max: number) => text(max).nullable();
/** `{ overview: true, … }` — the service picks the flags it knows. */
const tabFlags = z.record(z.string(), z.boolean());

const updateSchema = z
  .object({
    // ── Supplier core ──
    name: text(200),
    scoutingPhase: textOrNull(20),
    productType: text(200),
    country: text(100),
    manufacturingAddress: text(300),
    buyer: text(100),
    scoutingInput: text(200),
    daysInStage: int,
    daysSinceParkingLot: intOrNull,
    docsPercent: int,
    onboardingDate: text(30),
    preEvalStartDate: textOrNull(30),
    initialQuoteSubmitted: bool,
    // NVarChar columns despite the money-ish names — see schema.prisma.
    qadPrice: textOrNull(50),
    savingExpected: textOrNull(50),
    tooling: textOrNull(50),
    selectedForDevelopment: bool,
    investigateRecordNumber: textOrNull(100),
    intelexDate: textOrNull(30),

    // ── Catalog-backed (resolved to FK ids by name) ──
    // No `.max()` on this group on purpose: none of these strings is written to
    // a column. updateSupplier looks each one up in its catalog table and stores
    // the resulting int FK, answering 400 for a name it does not know — a length
    // cap here would only shadow that clearer rejection.
    commodity: str,
    productCategory: str,
    sla: str,
    globalSla: strOrNull,
    subStatus: strOrNull,
    confidenceLevel: str,
    // Form A Q34's one answer, one value on the wire — the service resolves it
    // to the single IMMEX FK. See IMMEX_ANSWERS for why it is not a flag pair.
    immexAnswer: z.enum(IMMEX_ANSWERS),
    // Boolean on the frontend contract, stored as the string 'true'/'false' in
    // CommercialInfo.ExportCapability — hence the width on the string arm.
    exportCapability: z.union([bool, text(300)]),

    // ── CompanyInfo ──
    fullName: text(300),
    dunsNumber: text(50),
    taxIdNumber: textOrNull(50),
    recommendedBy: textOrNull(100),
    recommenderDept: textOrNull(100),
    companyType: text(50),
    foundedYear: int,
    headquarters: text(300),
    website: text(300),
    phone: text(50),
    contactEmail: text(200),
    contactName: text(100),

    // ── TechnicalInfo ──
    technology: text(200),
    machineryType: text(200),
    processMethod: text(200),
    pressCapacity: text(100),
    materials: text(300),
    complementaryOperations: textOrNull(300),
    safetyCritical: bool,
    safetyExperience: bool,
    certifications: text(300),
    knowsCQIs: bool,

    // ── CommercialInfo ──
    annualRevenue: text(50),
    productionVolume: text(100),
    employees: int,
    facilities: int,
    topCustomers: text(300),
    strengths: text(1000),
    weaknesses: text(1000),
    observations: text(1000),
    recommendations: text(1000),
    priority: int,
    primaryDriver: text(100),

    // ── ScoutingData ──
    scoutingTabsCompleted: tabFlags,
    b2bStatus: textOrNull(5),
    b2bWhoAttends: textOrNull(300),
    b2bManager: textOrNull(100),
    b2bBuyer: textOrNull(100),
    b2bComments: textOrNull(1000),
    agendaStatus: textOrNull(50),
    agendaTeamsLink: textOrNull(500),
    agendaScheduledDate: textOrNull(30),
    agendaTimezone: textOrNull(20),
    agendaStand: textOrNull(50),
    agendaStartTime: textOrNull(20),
    agendaEndTime: textOrNull(20),
    agendaDuration: textOrNull(20),
    selectedForParking: bool.nullable(),
    selectionReason: textOrNull(1000),

    // ── ParkingData ──
    parkingTabsCompleted: tabFlags,
    // Catalog-backed like the top-level `subStatus` above — FK, not a column.
    parkingSubStatus: strOrNull,
    parkingOnboardingDate: textOrNull(30),
    parkingTimeless: bool,
    parkingDateToMovePreliminary: textOrNull(30),
    parkingScoutingInput: textOrNull(200),
    parkingIsRecommendation: bool,
    parkingBuyer: textOrNull(100),
    parkingCompanyName: textOrNull(200),
    parkingB2BMeeting: textOrNull(5),
    parkingName1: textOrNull(100),
    parkingWebsite: textOrNull(300),
    parkingEmail1: textOrNull(200),
    parkingPhone: textOrNull(50),
    // ParkingData.Commodity is a plain NVarChar column, not the Commodity FK.
    parkingCommodity: textOrNull(100),
    parkingProductType: textOrNull(200),
    parkingManufacturingCountry: textOrNull(100),
    parkingManufacturingAddress: textOrNull(300),
    parkingAdditionalComments: textOrNull(2000),

    // ── PreliminaryData (prelim_* on the wire) ──
    preliminaryTabsCompleted: tabFlags,
    prelim_startDate: textOrNull(30),
    prelim_priority: intOrNull,
    prelim_scoutingInput: textOrNull(200),
    prelim_buyer: textOrNull(100),
    // Like parkingCommodity: a plain column on the satellite, not the FK.
    prelim_commodity: textOrNull(100),
    prelim_primaryDriver: textOrNull(100),
    prelim_ssdLeader: textOrNull(100),
    prelim_sdeLeader: textOrNull(100),
    prelim_companyName: textOrNull(300),
    prelim_dunsNumber: textOrNull(50),
    prelim_hqAddress: textOrNull(300),
    prelim_hqCity: textOrNull(100),
    prelim_hqCountry: textOrNull(100),
    prelim_manufacturingAddress: textOrNull(300),
    prelim_manufacturingCity: textOrNull(100),
    prelim_manufacturingCountry: textOrNull(100),
    prelim_companyType: textOrNull(50),
    prelim_foundedYear: intOrNull,
    prelim_footprint: textOrNull(100),
    prelim_yearsInMexico: intOrNull,
    prelim_facilities: intOrNull,
    prelim_employees: intOrNull,
    prelim_annualRevenue: textOrNull(50),
    prelim_productionVolume: textOrNull(100),
    prelim_mainTechnology: textOrNull(200),
    prelim_pressCapacity: textOrNull(100),
    prelim_generalManager: textOrNull(100),
    prelim_market: textOrNull(100),
    prelim_topCustomers: textOrNull(300),
    prelim_exportCapability: textOrNull(300),
    prelim_certifications: textOrNull(300),
    prelim_planToGetIMMEX: textOrNull(5),
    prelim_machineryType: textOrNull(200),
    prelim_processingMethod: textOrNull(200),
    prelim_complementaryOps: textOrNull(300),
    prelim_toolingDesign: textOrNull(100),
    prelim_materials: textOrNull(300),
    prelim_rawMaterialIndex: textOrNull(200),
    prelim_applications: textOrNull(300),

    // ── SupplierEvalData (still prelim_* on the wire — DEBT.md entry 1) ──
    supplierEvalTabsCompleted: tabFlags,
    prelim_rfqReceived: textOrNull(5),
    prelim_ndaSigned: textOrNull(5),
    prelim_tcsSigned: textOrNull(5),
    prelim_ttcsSigned: textOrNull(5),
    prelim_nsrSigned: textOrNull(5),
    prelim_sdaSigned: textOrNull(5),
    prelim_costModel: textOrNull(5),
    prelim_visitDatePlanned: textOrNull(30),
    prelim_visitDateCompleted: textOrNull(30),
    prelim_visitParticipants: textOrNull(300),
    prelim_strengths: textOrNull(1000),
    prelim_weaknesses: textOrNull(1000),
    prelim_observations: textOrNull(1000),
    prelim_recommendations: textOrNull(1000),

    // Full replacement of the preliminary part list. Typed as an array here so a
    // non-array no longer slips into the generic prelim_* branch and dies inside
    // Prisma; the objects stay permissive (the service coerces each column).
    prelim_parts: z.array(
      z
        .object({
          partNumber: text(100),
          partDescription: text(300),
          pl: text(50),
          annualPeakVolume: intOrNull,
          program: text(100),
          eop: text(20),
          initialQuote: numOrNull,
          qadPrice: numOrNull,
          delta: numOrNull,
          tooling: numOrNull,
          savingExpected: numOrNull,
          // Catalog-backed: resolved to the ConfidenceLevel FK, never written.
          confidence: strOrNull,
          cost: z.enum(['Saving', 'Impact']).nullable(),
        })
        .partial()
        .passthrough(),
    ),

    // ── IntelexData ──
    intelexTabsCompleted: tabFlags,
    intelexSaved: bool,
    intelex_recordCreationDate: textOrNull(30),
    intelex_investigateRecordNumber: textOrNull(100),
    intelex_investigateExpected: textOrNull(30),
    intelex_investigateReal: textOrNull(30),
    intelex_l0Expected: textOrNull(30),
    intelex_l0Real: textOrNull(30),
    intelex_l1Expected: textOrNull(30),
    intelex_l1Real: textOrNull(30),
    intelex_l2Expected: textOrNull(30),
    intelex_l2Real: textOrNull(30),
    intelex_l3Expected: textOrNull(30),
    intelex_l3Real: textOrNull(30),
    intelex_l4Expected: textOrNull(30),
    intelex_l4Real: textOrNull(30),
    // Server-owned: accepted from the client and then dropped by the service,
    // which derives CurrentLevel from the Real dates. It reaches no column, so
    // it stays uncapped — the width that matters is the derived value's, not
    // whatever the client happened to send.
    intelex_currentLevel: str,
    intelex_efficiencyL0: numOrNull,
    intelex_efficiencyL1: numOrNull,
    intelex_efficiencyL2: numOrNull,
    intelex_efficiencyL3: numOrNull,
    intelex_efficiencyL4: numOrNull,
    intelex_efficiencyGlobal: numOrNull,
  })
  .partial()
  .passthrough();

export function suppliersController(deps: Deps) {
  const list: RequestHandler = async (req, res, next) => {
    try {
      res.json(
        await suppliersService.listSuppliers(deps.prisma, {
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          stage: typeof req.query.stage === 'string' ? req.query.stage : undefined,
          commodity: typeof req.query.commodity === 'string' ? req.query.commodity : undefined,
          country: typeof req.query.country === 'string' ? req.query.country : undefined,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  const listTracker: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'ACTIVE'));
    } catch (err) {
      next(err);
    }
  };

  const listBlacklisted: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'BLACKLISTED'));
    } catch (err) {
      next(err);
    }
  };

  const listCompleted: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'COMPLETED'));
    } catch (err) {
      next(err);
    }
  };

  const detail: RequestHandler = async (req, res, next) => {
    try {
      res.json(await suppliersService.getSupplierById(deps.prisma, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  const create: RequestHandler = async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(await suppliersService.createSupplier(deps.prisma, input, actor));
    } catch (err) {
      next(err);
    }
  };

  const update: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      res.json(
        await suppliersService.updateSupplier(
          deps.prisma,
          req.params.id,
          updateSchema.parse(req.body) as Record<string, unknown>,
          actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const remove: RequestHandler = async (req, res, next) => {
    try {
      await suppliersService.deleteSupplier(deps.prisma, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  // Notes (stage-tagged, author-owned)
  const addNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(await notesService.addSupplierNote(deps.prisma, req.params.id, text, actor));
    } catch (err) {
      next(err);
    }
  };

  const editNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await notesService.updateSupplierNote(
          deps.prisma, req.params.id, req.params.noteId, text, actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const removeNote: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      await notesService.deleteSupplierNote(deps.prisma, req.params.id, req.params.noteId, actor);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return {
    list, listTracker, listBlacklisted, listCompleted, detail,
    create, update, remove, addNote, editNote, removeNote,
  };
}
