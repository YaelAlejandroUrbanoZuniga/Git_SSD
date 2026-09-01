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
// `.passthrough()` is deliberate and load-bearing: an unrecognised key must
// still reach the service so IT produces the rejection message.
const str = z.string();
const strOrNull = z.string().nullable();
const int = z.number().int();
const intOrNull = z.number().int().nullable();
const bool = z.boolean();
const numOrNull = z.number().nullable();
/** `{ overview: true, … }` — the service picks the flags it knows. */
const tabFlags = z.record(z.string(), z.boolean());

const updateSchema = z
  .object({
    // ── Supplier core ──
    name: str,
    scoutingPhase: strOrNull,
    productType: str,
    country: str,
    manufacturingAddress: str,
    buyer: str,
    scoutingInput: str,
    daysInStage: int,
    daysSinceParkingLot: intOrNull,
    docsPercent: int,
    onboardingDate: str,
    preEvalStartDate: strOrNull,
    initialQuoteSubmitted: bool,
    // NVarChar columns despite the money-ish names — see schema.prisma.
    qadPrice: strOrNull,
    savingExpected: strOrNull,
    tooling: strOrNull,
    selectedForDevelopment: bool,
    investigateRecordNumber: strOrNull,
    intelexDate: strOrNull,

    // ── Catalog-backed (resolved to FK ids by name) ──
    commodity: str,
    productCategory: str,
    sla: str,
    globalSla: strOrNull,
    subStatus: strOrNull,
    confidenceLevel: str,
    // Form A Q34's one answer, one value on the wire — the service resolves it
    // to the single IMMEX FK. See IMMEX_ANSWERS for why it is not a flag pair.
    immexAnswer: z.enum(IMMEX_ANSWERS),
    // Boolean on the frontend contract, stored as the string 'true'/'false'.
    exportCapability: z.union([bool, str]),

    // ── CompanyInfo ──
    fullName: str,
    dunsNumber: str,
    taxIdNumber: strOrNull,
    recommendedBy: strOrNull,
    recommenderDept: strOrNull,
    companyType: str,
    foundedYear: int,
    headquarters: str,
    website: str,
    phone: str,
    contactEmail: str,
    contactName: str,

    // ── TechnicalInfo ──
    technology: str,
    machineryType: str,
    processMethod: str,
    pressCapacity: str,
    materials: str,
    complementaryOperations: strOrNull,
    safetyCritical: bool,
    safetyExperience: bool,
    certifications: str,
    knowsCQIs: bool,

    // ── CommercialInfo ──
    annualRevenue: str,
    productionVolume: str,
    employees: int,
    facilities: int,
    topCustomers: str,
    strengths: str,
    weaknesses: str,
    observations: str,
    recommendations: str,
    priority: int,
    primaryDriver: str,

    // ── ScoutingData ──
    scoutingTabsCompleted: tabFlags,
    b2bStatus: strOrNull,
    b2bWhoAttends: strOrNull,
    b2bManager: strOrNull,
    b2bBuyer: strOrNull,
    b2bComments: strOrNull,
    agendaStatus: strOrNull,
    agendaTeamsLink: strOrNull,
    agendaScheduledDate: strOrNull,
    agendaTimezone: strOrNull,
    agendaStand: strOrNull,
    agendaStartTime: strOrNull,
    agendaEndTime: strOrNull,
    agendaDuration: strOrNull,
    selectedForParking: bool.nullable(),
    selectionReason: strOrNull,

    // ── ParkingData ──
    parkingTabsCompleted: tabFlags,
    parkingSubStatus: strOrNull,
    parkingOnboardingDate: strOrNull,
    parkingTimeless: bool,
    parkingDateToMovePreliminary: strOrNull,
    parkingScoutingInput: strOrNull,
    parkingIsRecommendation: bool,
    parkingBuyer: strOrNull,
    parkingCompanyName: strOrNull,
    parkingB2BMeeting: strOrNull,
    parkingName1: strOrNull,
    parkingWebsite: strOrNull,
    parkingEmail1: strOrNull,
    parkingPhone: strOrNull,
    parkingCommodity: strOrNull,
    parkingProductType: strOrNull,
    parkingManufacturingCountry: strOrNull,
    parkingManufacturingAddress: strOrNull,
    parkingAdditionalComments: strOrNull,

    // ── PreliminaryData (prelim_* on the wire) ──
    preliminaryTabsCompleted: tabFlags,
    prelim_startDate: strOrNull,
    prelim_priority: intOrNull,
    prelim_scoutingInput: strOrNull,
    prelim_buyer: strOrNull,
    prelim_commodity: strOrNull,
    prelim_primaryDriver: strOrNull,
    prelim_ssdLeader: strOrNull,
    prelim_sdeLeader: strOrNull,
    prelim_companyName: strOrNull,
    prelim_dunsNumber: strOrNull,
    prelim_hqAddress: strOrNull,
    prelim_hqCity: strOrNull,
    prelim_hqCountry: strOrNull,
    prelim_manufacturingAddress: strOrNull,
    prelim_manufacturingCity: strOrNull,
    prelim_manufacturingCountry: strOrNull,
    prelim_companyType: strOrNull,
    prelim_foundedYear: intOrNull,
    prelim_footprint: strOrNull,
    prelim_yearsInMexico: intOrNull,
    prelim_facilities: intOrNull,
    prelim_employees: intOrNull,
    prelim_annualRevenue: strOrNull,
    prelim_productionVolume: strOrNull,
    prelim_mainTechnology: strOrNull,
    prelim_pressCapacity: strOrNull,
    prelim_generalManager: strOrNull,
    prelim_market: strOrNull,
    prelim_topCustomers: strOrNull,
    prelim_exportCapability: strOrNull,
    prelim_certifications: strOrNull,
    prelim_planToGetIMMEX: strOrNull,
    prelim_machineryType: strOrNull,
    prelim_processingMethod: strOrNull,
    prelim_complementaryOps: strOrNull,
    prelim_toolingDesign: strOrNull,
    prelim_materials: strOrNull,
    prelim_rawMaterialIndex: strOrNull,
    prelim_applications: strOrNull,

    // ── SupplierEvalData (still prelim_* on the wire — DEBT.md entry 1) ──
    supplierEvalTabsCompleted: tabFlags,
    prelim_rfqReceived: strOrNull,
    prelim_ndaSigned: strOrNull,
    prelim_tcsSigned: strOrNull,
    prelim_ttcsSigned: strOrNull,
    prelim_nsrSigned: strOrNull,
    prelim_sdaSigned: strOrNull,
    prelim_costModel: strOrNull,
    prelim_visitDatePlanned: strOrNull,
    prelim_visitDateCompleted: strOrNull,
    prelim_visitParticipants: strOrNull,
    prelim_strengths: strOrNull,
    prelim_weaknesses: strOrNull,
    prelim_observations: strOrNull,
    prelim_recommendations: strOrNull,

    // Full replacement of the preliminary part list. Typed as an array here so a
    // non-array no longer slips into the generic prelim_* branch and dies inside
    // Prisma; the objects stay permissive (the service coerces each column).
    prelim_parts: z.array(
      z
        .object({
          partNumber: str,
          partDescription: str,
          pl: str,
          annualPeakVolume: intOrNull,
          program: str,
          eop: str,
          initialQuote: numOrNull,
          qadPrice: numOrNull,
          delta: numOrNull,
          tooling: numOrNull,
          savingExpected: numOrNull,
          confidence: strOrNull,
        })
        .partial()
        .passthrough(),
    ),

    // ── IntelexData ──
    intelexTabsCompleted: tabFlags,
    intelexSaved: bool,
    intelex_recordCreationDate: strOrNull,
    intelex_investigateRecordNumber: strOrNull,
    intelex_investigateExpected: strOrNull,
    intelex_investigateReal: strOrNull,
    intelex_l0Expected: strOrNull,
    intelex_l0Real: strOrNull,
    intelex_l1Expected: strOrNull,
    intelex_l1Real: strOrNull,
    intelex_l2Expected: strOrNull,
    intelex_l2Real: strOrNull,
    intelex_l3Expected: strOrNull,
    intelex_l3Real: strOrNull,
    intelex_l4Expected: strOrNull,
    intelex_l4Real: strOrNull,
    // Server-owned: accepted from the client and then dropped by the service.
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
