import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { COMMODITIES, todayISO, type Commodity } from '../domain/constants';
import { BusinessRuleError, NotFoundError, ValidationError } from '../domain/errors';
import { supplierInclude, toSupplierDTO } from '../mappers/supplierMapper';
import { immexNameFromFlags, normalizeConfidence } from './catalogMapping';
import { syncSupplierSla, syncSuppliersSla } from './slaService';
import type { AuthUser } from '../middleware/auth';

export interface SupplierSearchParams {
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

async function nextFolio(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SSD-${year}-`;
  const last = await prisma.supplier.findFirst({
    where: { folio: { startsWith: prefix } },
    orderBy: { folio: 'desc' },
    select: { folio: true },
  });
  const lastNum = last ? Number(last.folio.slice(prefix.length)) : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

/** Form A → Scouting Event; Form B → Parking Lot (business rule). */
export async function createSupplier(
  prisma: PrismaClient,
  input: CreateSupplierInput,
  actor: AuthUser,
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
  const folio = await nextFolio(prisma);

  await prisma.supplier.create({
    data: {
      id,
      folio,
      name: input.name.trim(),
      status: { connect: { name: 'ACTIVE' } },
      stage: { connect: { name: stage } },
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
        create: {
          date: today,
          action: isRecommendation
            ? 'Supplier registered from internal recommendation'
            : 'Supplier registered from Scouting Event',
          user: actor.displayName,
          role: actor.role,
        },
      },
    },
  });

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

const SUPPLIER_EVAL_FIELDS = new Set([
  'prelim_rfqReceived', 'prelim_ndaSigned', 'prelim_tcsSigned',
  'prelim_ttcsSigned', 'prelim_nsrSigned', 'prelim_sdaSigned',
]);

function stripPrefix(key: string, prefix: string): string {
  const raw = key.slice(prefix.length);
  return raw.charAt(0).toLowerCase() + raw.slice(1);
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
        if ('visit' in tabs) prelim.tabVisit = tabs.visit;
      }
    } else if (key === 'supplierEvalTabsCompleted') {
      if (value && typeof value === 'object') {
        const tabs = value as Record<string, boolean>;
        supplierEval.hasTabs = true;
        if ('competitiveness' in tabs) supplierEval.tabCompetitiveness = tabs.competitiveness;
        if ('fundamentals' in tabs) supplierEval.tabFundamentals = tabs.fundamentals;
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
      await prisma.$transaction([
        prisma.prelimPart.deleteMany({ where: { supplierId: id } }),
        prisma.prelimPart.createMany({
          data: (value as Record<string, unknown>[]).map(p => ({
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
          })),
        }),
      ]);
    } else if (key.startsWith(INTELEX_PREFIX)) {
      intelex[stripPrefix(key, INTELEX_PREFIX)] = value;
    } else if (key.startsWith(PRELIM_PREFIX)) {
      prelim[stripPrefix(key, PRELIM_PREFIX)] = value;
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
