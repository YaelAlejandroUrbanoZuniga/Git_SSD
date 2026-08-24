import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { COMMODITIES, todayISO, type Commodity } from '../domain/constants';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import { deriveIntelexLevelBy, INTELEX_LEVEL_SEQUENCE } from '../domain/intelexLevels';
import {
  calcIntelexGlobalEfficiency,
  calcIntelexLevelEfficiency,
  INTELEX_EFFICIENCY_GLOBAL_KEY,
  INTELEX_EFFICIENCY_LEVELS,
} from '../domain/intelexEfficiency';
import { supplierInclude, toSupplierDTO } from '../mappers/supplierMapper';
import { immexNameFromFlags, normalizeConfidence } from './catalogMapping';
import { syncSupplierSla, syncSuppliersSla } from './slaService';
import { notifyTeam, summarizeChangedFields } from './notificationsService';
import type { AuthUser } from '../middleware/auth';

interface SupplierSearchParams {
  q?: string;
  stage?: string;
  commodity?: string;
  country?: string;
  status?: string; // ACTIVE | BLACKLISTED | COMPLETED
}

/** Master list: tracker + blacklisted (mirror of frontend getSuppliers). */
export async function listSuppliers(prisma: PrismaClient, params: SupplierSearchParams = {}) {
  const where: Prisma.SupplierWhereInput = {};
  if (params.status) where.status = { is: { name: params.status } };
  if (params.stage) where.stage = { is: { name: params.stage } };
  if (params.country) where.country = params.country;
  if (params.commodity) where.commodity = { is: { name: params.commodity } };
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { folio: { contains: params.q } },
      { companyInfo: { is: { fullName: { contains: params.q } } } },
    ];
  }
  const rows = await prisma.supplier.findMany({
    where,
    include: supplierInclude,
    orderBy: { folio: 'asc' },
  });
  return (await syncSuppliersSla(prisma, rows)).map(toSupplierDTO);
}

export async function listByStatus(prisma: PrismaClient, status: 'ACTIVE' | 'BLACKLISTED' | 'COMPLETED') {
  return listSuppliers(prisma, { status });
}

export async function getSupplierById(prisma: PrismaClient, id: string) {
  const row = await prisma.supplier.findUnique({ where: { id }, include: supplierInclude });
  if (!row) throw new NotFoundError(`Supplier ${id} not found`);
  return toSupplierDTO(await syncSupplierSla(prisma, row));
}

export interface CreateSupplierInput {
  name: string;
  commodity: string;
  productCategory?: 'Direct' | 'Indirect';
  productType?: string;
  country?: string;
  manufacturingAddress?: string;
  buyer?: string;
  /** 'Scouting Event' (form A) | 'Recommendation' (form B → straight to Parking Lot) */
  entrySource: 'Scouting Event' | 'Recommendation';
  scoutingInput?: string;
  recommendedBy?: string;
  recommenderDept?: string;
  // Optional company/contact details
  fullName?: string;
  dunsNumber?: string;
  website?: string;
  phone?: string;
  contactEmail?: string;
  contactName?: string;
}

/**
 * Next native folio. MUST be called inside the same transaction as the
 * `supplier.create` that consumes it (see createSupplier): `folio` is @unique,
 * so reading the maximum and writing the successor in two separate operations
 * lets two parallel creates settle on the same number.
 */
async function nextFolio(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SSD-${year}-`;
  // Only natively-generated folios feed the sequence. Suppliers imported from Excel
  // carry an 'XL-' prefixed folio (XL-SSD-2026-NNNN) to distinguish them from records
  // captured in the system; their numbers must NOT consume the native range, so they
  // are excluded here (the SSD- prefix already skips them, but the exclusion is
  // explicit so the rule survives any change to how the prefix is built).
  const rows = await tx.supplier.findMany({
    where: { folio: { startsWith: prefix }, NOT: { folio: { startsWith: 'XL-' } } },
    select: { folio: true },
  });
  // Derive the next number from the real numeric maximum rather than from a
  // lexicographic `orderBy folio desc`: string ordering breaks the moment padding
  // widths differ (legacy 3-digit folios vs. the 4-digit ones below — e.g.
  // 'SSD-2026-012' sorts AFTER 'SSD-2026-0013'), which would pick the wrong "last".
  const maxNum = rows.reduce((max, r) => {
    const n = Number(r.folio.slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  // padStart(4) → SSD-2026-0001. Three-digit padding broke lexicographic ordering
  // past 999 suppliers, and the real-data import will land close to that number.
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * A P2002 on the Folio column means a parallel create won the race for the same
 * number. Translated into a readable 409 the caller can retry, instead of the
 * generic 500 the raw Prisma error would become in the error handler.
 */
function translateFolioConflict(err: unknown): unknown {
  const target = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
    ? String((err.meta as { target?: unknown } | undefined)?.target ?? '')
    : '';
  return target.toLowerCase().includes('folio')
    ? new ConflictError(
        'Folio already in use — another supplier was registered at the same instant. Please retry.',
      )
    : err;
}

/**
 * Form A → Scouting Event; Form B → Parking Lot (business rule).
 *
 * `alsoWrite` lets a caller add rows that MUST commit together with the supplier
 * (eventsService.addSupplierToEvent uses it for the event link), so a failure
 * there rolls the supplier back instead of leaving one orphaned from the event
 * it was born in, with its folio already consumed.
 */
export async function createSupplier(
  prisma: PrismaClient,
  input: CreateSupplierInput,
  actor: AuthUser,
  alsoWrite?: (tx: Prisma.TransactionClient, supplierId: string) => Promise<void>,
) {
  if (!input.name?.trim()) throw new ValidationError('Supplier name is required');
  if (!COMMODITIES.includes(input.commodity as Commodity)) {
    throw new ValidationError(
      `Unknown commodity "${input.commodity}". Allowed: ${COMMODITIES.join(', ')}`,
    );
  }
  const commodity = await prisma.commodity.findUnique({ where: { name: input.commodity } });
  if (!commodity) throw new ValidationError(`Commodity not in catalog: ${input.commodity}`);

  const isRecommendation = input.entrySource === 'Recommendation';
  const stage = isRecommendation ? 'Parking Lot' : 'Scouting Event';
  const today = todayISO();
  const id = `ps-${randomUUID()}`;

  // Folio allocation, the supplier row and whatever `alsoWrite` adds all commit
  // as ONE unit — see nextFolio for why the folio must not be computed outside.
  let folio: string;
  try {
    folio = await prisma.$transaction(
      async tx => {
        const allocated = await nextFolio(tx);
        await tx.supplier.create({
          data: {
            id,
            folio: allocated,
            name: input.name.trim(),
            status: { connect: { name: 'ACTIVE' } },
            stage: { connect: { name: stage } },
            // Start the days-in-stage clock from day 1 for brand-new suppliers, same
            // as moveSupplierToStage does on every later transition.
            stageEnteredAt: new Date(),
            // Day-zero placeholder FK; the trailing getSupplierById re-derives it (slaService).
            sla: { connect: { name: 'green' } },
            scoutingPhase: isRecommendation ? null : 'Identified',
            entrySource: input.entrySource,
            commodity: { connect: { id: commodity.id } },
            productCategory: { connect: { name: input.productCategory ?? 'Direct' } },
            productType: input.productType ?? '',
            country: input.country ?? '',
            manufacturingAddress: input.manufacturingAddress ?? '',
            buyer: input.buyer ?? actor.displayName,
            scoutingInput: input.scoutingInput ?? (isRecommendation ? 'Registro directo' : ''),
            onboardingDate: today,
            companyInfo: {
              create: {
                fullName: input.fullName ?? input.name.trim(),
                dunsNumber: input.dunsNumber ?? '',
                recommendedBy: input.recommendedBy ?? null,
                recommenderDept: input.recommenderDept ?? null,
                companyType: '',
                foundedYear: 0,
                headquarters: '',
                website: input.website ?? '',
                phone: input.phone ?? '',
                contactEmail: input.contactEmail ?? '',
                contactName: input.contactName ?? '',
              },
            },
            ...(isRecommendation
              ? {
                  parkingData: {
                    create: {
                      onboardingDate: today,
                      isRecommendation: true,
                      buyer: input.buyer ?? actor.displayName,
                      companyName: input.name.trim(),
                    },
                  },
                }
              : { scoutingData: { create: { tabScoutingEvent: true } } }),
            history: {
              // The one history entry every supplier is born with. It carries the
              // destination stage (fromStage stays null — nothing preceded it), so a
              // supplier that never moves is still reconstructable by date from its
              // history alone (reportsService.getStageSnapshot depends on this).
              create: {
                date: today,
                action: isRecommendation
                  ? 'Supplier registered from internal recommendation'
                  : 'Supplier registered from Scouting Event',
                user: actor.displayName,
                role: actor.role,
                toStage: { connect: { name: stage } },
              },
            },
          },
        });
        if (alsoWrite) await alsoWrite(tx, id);
        return allocated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    throw translateFolioConflict(err);
  }

  // Notify the team — never let a notification failure break the create.
  try {
    await notifyTeam(prisma, {
      message: `Nuevo proveedor registrado: ${input.name.trim()} (${folio})`,
      type: 'info',
      category: 'supplier_created',
      link: `/suppliers/supplier/${id}`,
      excludeUserId: actor.id,
    });
  } catch (err) {
    console.error('[notify] createSupplier notification failed:', err);
  }

  return getSupplierById(prisma, id);
}

// ── Update ──────────────────────────────────────────────────────────────
// Routes each flat TrackerSupplier field back to its table.

// Plain scalar supplier fields (catalog-backed ones handled below).
const SUPPLIER_FIELDS = new Set([
  'name', 'scoutingPhase', 'productType', 'country',
  'manufacturingAddress', 'buyer', 'scoutingInput', 'daysInStage',
  'daysSinceParkingLot', 'docsPercent',
  'onboardingDate', 'preEvalStartDate', 'initialQuoteSubmitted', 'qadPrice',
  'savingExpected', 'tooling', 'selectedForDevelopment',
  'investigateRecordNumber', 'intelexDate',
]);
const SUPPLIER_CATALOG_FIELDS = new Set(['productCategory', 'sla', 'globalSla', 'subStatus']);
const COMPANY_FIELDS = new Set([
  'fullName', 'dunsNumber', 'taxIdNumber', 'recommendedBy', 'recommenderDept',
  'companyType', 'foundedYear', 'headquarters', 'website', 'phone',
  'contactEmail', 'contactName',
]);
const TECH_FIELDS = new Set([
  'technology', 'machineryType', 'processMethod', 'pressCapacity', 'materials',
  'complementaryOperations', 'safetyCritical', 'safetyExperience',
  'certifications', 'knowsCQIs',
]);
// Plain scalar commercial fields (catalog-backed ones handled below).
const COMMERCIAL_FIELDS = new Set([
  'annualRevenue', 'productionVolume', 'employees', 'facilities',
  'topCustomers', 'strengths',
  'weaknesses', 'observations', 'recommendations', 'priority', 'primaryDriver',
]);
const SCOUTING_FIELDS = new Set([
  'b2bStatus', 'b2bWhoAttends', 'b2bManager', 'b2bBuyer', 'b2bComments',
  'agendaStatus', 'agendaTeamsLink', 'agendaScheduledDate', 'agendaTimezone',
  'agendaStand', 'agendaStartTime', 'agendaEndTime', 'agendaDuration',
  'selectedForParking', 'selectionReason',
]);

const PARKING_PREFIX = 'parking';
const PRELIM_PREFIX = 'prelim_';
const INTELEX_PREFIX = 'intelex_';

// IntelexData columns the server owns: whatever the client sends for them is
// dropped here and recomputed below from the dates (currentLevel from the Real
// sequence, the efficiencies from each level's Expected/Real pair).
const INTELEX_DERIVED_FIELDS = new Set([
  'currentLevel',
  ...INTELEX_EFFICIENCY_LEVELS.map(l => l.efficiencyKey),
  INTELEX_EFFICIENCY_GLOBAL_KEY,
]);

// prelim_*-prefixed on the wire but stored on SupplierEvalData — they belong to
// the Supplier Evaluation → Fundamentals/Visit tabs, not to PreliminaryData.
const SUPPLIER_EVAL_FIELDS = new Set([
  'prelim_rfqReceived', 'prelim_ndaSigned', 'prelim_tcsSigned',
  'prelim_ttcsSigned', 'prelim_nsrSigned', 'prelim_sdaSigned',
  'prelim_costModel',
  'prelim_visitDatePlanned', 'prelim_visitDateCompleted', 'prelim_visitParticipants',
  'prelim_strengths', 'prelim_weaknesses', 'prelim_observations', 'prelim_recommendations',
]);

function stripPrefix(key: string, prefix: string): string {
  const raw = key.slice(prefix.length);
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

// ── Change summary for the notification ─────────────────────────────────
// One save = one notification, so its message has to say *which* fields moved.
// Only the fields people recognise on screen get an explicit Spanish label;
// everything else is humanized from its wire name (below), which keeps this map
// from having to mirror all ~120 patchable keys to stay correct.
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre', commodity: 'Commodity', productCategory: 'Categoría de producto',
  productType: 'Tipo de producto', country: 'País',
  manufacturingAddress: 'Dirección de manufactura', buyer: 'Buyer',
  scoutingInput: 'Scouting input', scoutingPhase: 'Fase de scouting',
  subStatus: 'Sub-status', parkingSubStatus: 'Sub-status de Parking Lot',
  onboardingDate: 'Fecha de onboarding', preEvalStartDate: 'Inicio de pre-evaluación',
  selectedForDevelopment: 'Seleccionado para desarrollo',
  fullName: 'Razón social', dunsNumber: 'DUNS', taxIdNumber: 'Tax ID',
  website: 'Website', phone: 'Teléfono', contactEmail: 'Email de contacto',
  contactName: 'Contacto', headquarters: 'Headquarters', companyType: 'Tipo de compañía',
  foundedYear: 'Año de fundación', recommendedBy: 'Recomendado por',
  recommenderDept: 'Departamento del recomendador',
  technology: 'Tecnología', machineryType: 'Maquinaria', processMethod: 'Proceso',
  pressCapacity: 'Capacidad de prensa', materials: 'Materiales',
  certifications: 'Certificaciones', knowsCQIs: 'CQIs',
  safetyCritical: 'Safety critical', safetyExperience: 'Experiencia en safety',
  annualRevenue: 'Ventas anuales', productionVolume: 'Volumen de producción',
  employees: 'Empleados', facilities: 'Plantas', topCustomers: 'Clientes principales',
  exportCapability: 'Capacidad de exportación', confidenceLevel: 'Nivel de confianza',
  hasIMMEX: 'IMMEX', planIMMEX: 'Plan IMMEX',
  strengths: 'Fortalezas', weaknesses: 'Debilidades', observations: 'Observaciones',
  recommendations: 'Recomendaciones', priority: 'Prioridad', primaryDriver: 'Primary driver',
};

// Wire prefixes → the section the field belongs to, for the humanized fallback.
const FIELD_GROUPS: Array<[prefix: string, group: string]> = [
  [INTELEX_PREFIX, 'Intelex'],
  [PRELIM_PREFIX, 'Preliminar'],
  [PARKING_PREFIX, 'Parking Lot'],
];

/** `'agendaTeamsLink'` → `'Agenda teams link'`. */
function humanizeField(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelForField(key: string): string {
  const explicit = FIELD_LABELS[key];
  if (explicit) return explicit;
  for (const [prefix, group] of FIELD_GROUPS) {
    if (key.startsWith(prefix)) return `${group}: ${humanizeField(stripPrefix(key, prefix))}`;
  }
  return humanizeField(key);
}

export async function updateSupplier(
  prisma: PrismaClient,
  id: string,
  patch: Record<string, unknown>,
  actor: AuthUser,
) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError(`Supplier ${id} not found`);

  // Catalog id maps — resolve the frontend's string values to FK ids.
  const [slas, subs, cats, confs, immexes] = await Promise.all([
    prisma.sla.findMany(),
    prisma.subStatus.findMany(),
    prisma.productCategory.findMany(),
    prisma.confidenceLevel.findMany(),
    prisma.immexStatus.findMany(),
  ]);
  const slaIds = new Map(slas.map(s => [s.name, s.id]));
  const subStatusIds = new Map(subs.map(s => [s.name, s.id]));
  const productCategoryIds = new Map(cats.map(s => [s.name, s.id]));
  const confidenceLevelIds = new Map(confs.map(c => [c.code, c.id]));
  const immexStatusIds = new Map(immexes.map(s => [s.name, s.id]));

  const core: Record<string, unknown> = {};
  const company: Record<string, unknown> = {};
  const tech: Record<string, unknown> = {};
  const commercial: Record<string, unknown> = {};
  const scouting: Record<string, unknown> = {};
  const parking: Record<string, unknown> = {};
  const prelim: Record<string, unknown> = {};
  const supplierEval: Record<string, unknown> = {};
  const intelex: Record<string, unknown> = {};
  const rejected: string[] = [];
  // hasIMMEX/planIMMEX arrive as two flat booleans but map to one FK.
  let immexHas: boolean | undefined;
  let immexPlan: boolean | undefined;
  // prelim_parts is a full replacement of the supplier's part list; the rows are
  // built during routing and written inside the main transaction (see below).
  let prelimParts: Prisma.PrelimPartCreateManyInput[] | null = null;

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'commodity') {
      const commodity = await prisma.commodity.findUnique({ where: { name: String(value) } });
      if (!commodity) throw new ValidationError(`Unknown commodity: ${String(value)}`);
      core.commodityId = commodity.id;
    } else if (SUPPLIER_CATALOG_FIELDS.has(key)) {
      // productCategory / sla / globalSla / subStatus → FK ids. sla/globalSla are
      // accepted but derived: getSupplierById re-derives and overwrites them.
      if (key === 'productCategory') core.productCategoryId = productCategoryIds.get(String(value));
      else if (key === 'sla') core.slaId = slaIds.get(String(value));
      else if (key === 'globalSla') core.globalSlaId = value ? slaIds.get(String(value)) : null;
      else if (key === 'subStatus') core.subStatusId = value ? subStatusIds.get(String(value)) : null;
    } else if (key === 'hasIMMEX') {
      immexHas = Boolean(value);
    } else if (key === 'planIMMEX') {
      immexPlan = Boolean(value);
    } else if (key === 'confidenceLevel') {
      commercial.confidenceLevelId = confidenceLevelIds.get(normalizeConfidence(String(value)));
    } else if (key === 'exportCapability') {
      // frontend sends a boolean; the column is now NVarChar (see mapper note)
      commercial.exportCapability = String(value);
    } else if (SUPPLIER_FIELDS.has(key)) {
      core[key] = value;
    } else if (COMPANY_FIELDS.has(key)) {
      company[key] = value;
    } else if (TECH_FIELDS.has(key)) {
      tech[key] = value;
    } else if (COMMERCIAL_FIELDS.has(key)) {
      commercial[key] = value;
    } else if (SCOUTING_FIELDS.has(key)) {
      scouting[key] = value;
    } else if (key === 'scoutingTabsCompleted' && value && typeof value === 'object') {
      const tabs = value as Record<string, boolean>;
      if ('scoutingEvent' in tabs) scouting.tabScoutingEvent = tabs.scoutingEvent;
      if ('supplierInfo' in tabs) scouting.tabSupplierInfo = tabs.supplierInfo;
      if ('attendees' in tabs) scouting.tabAttendees = tabs.attendees;
      if ('agenda' in tabs) scouting.tabAgenda = tabs.agenda;
      if ('nextStep' in tabs) scouting.tabNextStep = tabs.nextStep;
    } else if (key === 'parkingTabsCompleted') {
      if (value && typeof value === 'object') {
        const tabs = value as Record<string, boolean>;
        parking.hasTabs = true;
        if ('overview' in tabs) parking.tabOverview = tabs.overview;
        if ('contact' in tabs) parking.tabContact = tabs.contact;
        if ('details' in tabs) parking.tabDetails = tabs.details;
      }
    } else if (key === 'preliminaryTabsCompleted') {
      if (value && typeof value === 'object') {
        const tabs = value as Record<string, boolean>;
        prelim.hasTabs = true;
        if ('overview' in tabs) prelim.tabOverview = tabs.overview;
        if ('capabilities' in tabs) prelim.tabCapabilities = tabs.capabilities;
      }
    } else if (key === 'supplierEvalTabsCompleted') {
      if (value && typeof value === 'object') {
        const tabs = value as Record<string, boolean>;
        supplierEval.hasTabs = true;
        if ('competitiveness' in tabs) supplierEval.tabCompetitiveness = tabs.competitiveness;
        if ('fundamentals' in tabs) supplierEval.tabFundamentals = tabs.fundamentals;
        // Visit moved into Supplier Evaluation — only the flag, not the columns.
        if ('visit' in tabs) supplierEval.tabVisit = tabs.visit;
      }
    } else if (key === 'intelexTabsCompleted') {
      if (value && typeof value === 'object') {
        const tabs = value as Record<string, boolean>;
        intelex.hasTabs = true;
        if ('record' in tabs) intelex.tabRecord = tabs.record;
        if ('timeline' in tabs) intelex.tabTimeline = tabs.timeline;
        if ('efficiency' in tabs) intelex.tabEfficiency = tabs.efficiency;
      }
    } else if (key === 'intelexSaved') {
      intelex.saved = value;
    } else if (SUPPLIER_EVAL_FIELDS.has(key)) {
      supplierEval[stripPrefix(key, PRELIM_PREFIX)] = value;
    } else if (key === 'prelim_parts' && Array.isArray(value)) {
      // Only BUILT here — the delete+recreate runs in the main transaction below,
      // never in this routing loop: a patch that also carries a rejected key must
      // not have already wiped and rewritten the parts by the time it 400s.
      prelimParts = (value as Record<string, unknown>[]).map(p => ({
        supplierId: id,
        partNumber: String(p.partNumber ?? ''),
        partDescription: String(p.partDescription ?? ''),
        pl: String(p.pl ?? ''),
        annualPeakVolume: (p.annualPeakVolume as number | null) ?? null,
        program: String(p.program ?? ''),
        eop: String(p.eop ?? ''),
        initialQuote: (p.initialQuote as number | null) ?? null,
        qadPrice: (p.qadPrice as number | null) ?? null,
        delta: (p.delta as number | null) ?? null,
        tooling: (p.tooling as number | null) ?? null,
        savingExpected: (p.savingExpected as number | null) ?? null,
        confidenceLevelId: p.confidence
          ? confidenceLevelIds.get(normalizeConfidence(String(p.confidence)))
          : null,
      }));
    } else if (key.startsWith(INTELEX_PREFIX)) {
      const field = stripPrefix(key, INTELEX_PREFIX);
      // currentLevel and the six efficiencies are derived server-side (below)
      // from the captured dates — never written straight from the client patch.
      if (!INTELEX_DERIVED_FIELDS.has(field)) intelex[field] = value;
    } else if (key.startsWith(PRELIM_PREFIX)) {
      prelim[stripPrefix(key, PRELIM_PREFIX)] = value;
    } else if (key === 'parkingDaysElapsed') {
      // The column behind it (T_Supplier_ParkingData.DaysElapsed) is gone — it
      // was read but never maintained, so it rendered a number frozen at seed
      // time (`DEBT.md` entry 6). Rejected explicitly here, ahead of the generic
      // PARKING_PREFIX branch below: that one would route `daysElapsed` straight
      // into the Prisma upsert and turn a stale client's patch into a 500, where
      // this answers the same 400 as any other non-patchable key. The live
      // figure is `daysSinceParkingLot`, derived in domain/sla.ts.
      rejected.push(key);
    } else if (key === 'parkingSubStatus') {
      // ParkingData.subStatus is a relation (FK_SubStatus), not a plain column —
      // route through subStatusId like the top-level `subStatus` field does,
      // instead of letting the generic PARKING_PREFIX branch below write the
      // raw string into a relation field (Prisma throws, surfacing as a 500).
      parking.subStatusId = value ? subStatusIds.get(String(value)) : null;
    } else if (key.startsWith(PARKING_PREFIX)) {
      const field = stripPrefix(key, PARKING_PREFIX);
      // parkingB2BMeeting → b2bMeeting (preserve internal capitalization quirk)
      parking[field === 'b2BMeeting' ? 'b2bMeeting' : field] = value;
    } else if (key === 'id' || key === 'folio' || key === 'stage' || key === 'entrySource'
      || key === 'notes' || key === 'history' || key === 'documents' || key === 'parts') {
      // stage moves, notes, history and documents have dedicated endpoints;
      // id/folio/entrySource are immutable
      rejected.push(key);
    } else {
      rejected.push(key);
    }
  }

  if (rejected.length > 0) {
    throw new ValidationError(
      `Fields not updatable via PATCH /suppliers/:id: ${rejected.join(', ')}`,
    );
  }

  // Collapse the two IMMEX booleans into the single FK once both are known.
  if (immexHas !== undefined || immexPlan !== undefined) {
    commercial.immexStatusId = immexStatusIds.get(
      immexNameFromFlags(immexHas ?? false, immexPlan ?? false),
    );
  }

  // ── Intelex Handoff level sequencing ────────────────────────────────────
  // When this patch captures any "Real" date, enforce that the levels advance
  // in order (a level's Real requires the previous level's Real to already
  // exist, whether from the DB or from this same patch) and derive the new
  // currentLevel. Validated before any write so an out-of-sequence attempt
  // touches nothing. "Expected" dates are never sequenced.
  const touchesIntelexReal = INTELEX_LEVEL_SEQUENCE.some(l => l.realKey in intelex);
  // Efficiency reads BOTH dates of a level, so an "Expected"-only patch has to
  // recompute too — hence its own flag rather than reusing the one above.
  const touchesIntelexDates = touchesIntelexReal
    || INTELEX_EFFICIENCY_LEVELS.some(l => l.expectedKey in intelex);
  // The stored row completes the patch: a level scores from whichever of its two
  // dates the patch carries plus whatever is already on file. Read once, before
  // the transaction, and shared by both derivations below.
  const existingIntelex = touchesIntelexDates
    ? ((await prisma.intelexData.findUnique({ where: { supplierId: id } })) ?? null)
    : null;
  if (touchesIntelexReal) {
    const hasReal = (i: number): boolean => {
      const { realKey } = INTELEX_LEVEL_SEQUENCE[i];
      const v = realKey in intelex
        ? intelex[realKey]
        : (existingIntelex as Record<string, unknown> | null)?.[realKey];
      return typeof v === 'string' && v.trim().length > 0;
    };
    // Reject a level's Real being newly set while its predecessor has none.
    for (let i = 1; i < INTELEX_LEVEL_SEQUENCE.length; i++) {
      const { realKey, label } = INTELEX_LEVEL_SEQUENCE[i];
      const settingNow = realKey in intelex
        && typeof intelex[realKey] === 'string'
        && (intelex[realKey] as string).trim().length > 0;
      if (settingNow && !hasReal(i - 1)) {
        throw new BusinessRuleError(
          `Cannot capture the "${label}" real date before "${INTELEX_LEVEL_SEQUENCE[i - 1].label}". `
          + 'Intelex levels advance in order: Investigate → L0 → L1 → L2 → L3 → L4.',
        );
      }
    }
    // currentLevel = the furthest level whose Real (and every Real before it) is
    // set; 'Investigate' until the Investigate Real itself is captured. This is
    // the LIVE level — dates are irrelevant here, only whether the Real exists.
    intelex.currentLevel = deriveIntelexLevelBy(hasReal);
  }

  // ── Intelex Handoff efficiency ──────────────────────────────────────────
  // Each level scores its own delay (Real vs. its own Expected) through the
  // team's stepped scale in domain/intelexEfficiency.ts, and the global value is
  // the average of the levels that have one. All six are rewritten whenever any
  // Intelex date moves, so a corrected date can never leave a stale score
  // behind; a level that loses a date goes back to null.
  if (touchesIntelexDates) {
    const dateOf = (key: string): string | null => {
      const value = key in intelex
        ? intelex[key]
        : (existingIntelex as Record<string, unknown> | null)?.[key];
      return typeof value === 'string' ? value : null;
    };
    const levelEfficiencies = INTELEX_EFFICIENCY_LEVELS.map(
      l => calcIntelexLevelEfficiency(dateOf(l.expectedKey), dateOf(l.realKey)),
    );
    INTELEX_EFFICIENCY_LEVELS.forEach((l, i) => { intelex[l.efficiencyKey] = levelEfficiencies[i]; });
    intelex[INTELEX_EFFICIENCY_GLOBAL_KEY] = calcIntelexGlobalEfficiency(levelEfficiencies);
  }

  // The fields this save really writes. Every key that survived the loop above
  // is routed to a table, EXCEPT the Intelex values the server owns — those are
  // accepted from the client and then dropped, so they are not a change.
  const changedFields = Object.keys(patch).filter(
    key => !(key.startsWith(INTELEX_PREFIX)
      && INTELEX_DERIVED_FIELDS.has(stripPrefix(key, INTELEX_PREFIX))),
  );
  // A rename lands in this same save, so the message must name the supplier as
  // it is now, not as it was read.
  const supplierName = typeof patch.name === 'string' && patch.name.trim()
    ? patch.name.trim()
    : supplier.name;

  await prisma.$transaction(async tx => {
    if (Object.keys(core).length > 0) {
      await tx.supplier.update({ where: { id }, data: core as Prisma.SupplierUpdateInput });
    }
    if (Object.keys(company).length > 0) {
      await tx.companyInfo.upsert({
        where: { supplierId: id },
        create: {
          supplierId: id, fullName: supplier.name, dunsNumber: '', companyType: '',
          foundedYear: 0, headquarters: '', website: '', phone: '', contactEmail: '',
          contactName: '', ...(company as object),
        },
        update: company,
      });
    }
    if (Object.keys(tech).length > 0) {
      await tx.technicalInfo.upsert({
        where: { supplierId: id },
        create: {
          supplierId: id, technology: '', machineryType: '', processMethod: '',
          pressCapacity: '', materials: '', certifications: '', ...(tech as object),
        },
        update: tech,
      });
    }
    if (Object.keys(commercial).length > 0) {
      // Fresh CommercialInfo needs its required FKs; default to No IMMEX and
      // Medium confidence (overridden by the patched values spread after).
      await tx.commercialInfo.upsert({
        where: { supplierId: id },
        create: {
          supplierId: id, annualRevenue: '', productionVolume: '', employees: 0,
          facilities: 0, topCustomers: '', exportCapability: '', strengths: '',
          weaknesses: '', observations: '', recommendations: '', primaryDriver: '',
          immexStatusId: immexStatusIds.get('No')!,
          confidenceLevelId: confidenceLevelIds.get('M')!,
          ...(commercial as object),
        },
        update: commercial,
      });
    }
    if (Object.keys(scouting).length > 0) {
      await tx.scoutingData.upsert({
        where: { supplierId: id },
        create: { supplierId: id, ...(scouting as object) },
        update: scouting,
      });
    }
    if (Object.keys(parking).length > 0) {
      await tx.parkingData.upsert({
        where: { supplierId: id },
        create: { supplierId: id, ...(parking as object) },
        update: parking,
      });
    }
    if (Object.keys(prelim).length > 0) {
      await tx.preliminaryData.upsert({
        where: { supplierId: id },
        create: { supplierId: id, ...(prelim as object) },
        update: prelim,
      });
    }
    if (Object.keys(supplierEval).length > 0) {
      await tx.supplierEvalData.upsert({
        where: { supplierId: id },
        create: { supplierId: id, ...(supplierEval as object) },
        update: supplierEval,
      });
    }
    if (Object.keys(intelex).length > 0) {
      await tx.intelexData.upsert({
        where: { supplierId: id },
        create: { supplierId: id, ...(intelex as object) },
        update: intelex,
      });
    }
    if (prelimParts !== null) {
      // Full replacement of the part list, inside the same transaction as the
      // rest of the save so a later failure rolls the old rows back too.
      await tx.prelimPart.deleteMany({ where: { supplierId: id } });
      await tx.prelimPart.createMany({ data: prelimParts });
    }
    if (Object.keys(patch).length > 0) {
      await tx.supplierHistoryEntry.create({
        data: {
          supplierId: id,
          date: todayISO(),
          action: 'Supplier information updated',
          user: actor.displayName,
          role: actor.role,
        },
      });
    }
  });

  // ONE notification for the whole save, listing what it changed — never one
  // per field. `changedFields` is what the save actually writes, not "the
  // endpoint was called": a patch carrying only server-owned Intelex values
  // (dropped above) changes nothing and must notify nobody.
  if (changedFields.length > 0) {
    const labels = changedFields.map(labelForField);
    const noun = labels.length === 1 ? 'campo' : 'campos';
    try {
      await notifyTeam(prisma, {
        message: `${actor.displayName} actualizó ${labels.length} ${noun} de ${supplierName}: `
          + summarizeChangedFields(labels),
        type: 'info',
        category: 'supplier_updated',
        link: `/suppliers/supplier/${id}`,
        excludeUserId: actor.id,
      });
    } catch (err) {
      console.error('[notify] updateSupplier notification failed:', err);
    }
  }

  return getSupplierById(prisma, id);
}

/** Hard delete allowed only in 'Scouting Event' (business rule). */
export async function deleteSupplier(prisma: PrismaClient, id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { status: true, stage: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${id} not found`);
  if (supplier.status.name !== 'ACTIVE' || supplier.stage.name !== 'Scouting Event') {
    throw new BusinessRuleError(
      'Suppliers can only be deleted while in Scouting Event; use blacklist instead',
    );
  }
  await prisma.$transaction([
    prisma.eventSupplierEntry.deleteMany({ where: { supplierId: id } }),
    prisma.eventB2BMeeting.updateMany({ where: { supplierId: id }, data: { supplierId: null } }),
    prisma.supplier.delete({ where: { id } }),
  ]);
}
