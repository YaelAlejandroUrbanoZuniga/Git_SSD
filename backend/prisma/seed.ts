// Seed in two parts:
//   • seedCatalogsAndUsers() — ALWAYS runs, never deletes, all upserts. Safe to
//     re-run against a database that already holds real suppliers/events.
//   • seedDemoTrackerData()  — only when SEED_DEMO=true. Wipes + reseeds the
//     demo suppliers/events/strategy from frontend/src/data/*.ts (dev only).
// Run with: npm run seed  (or SEED_DEMO=true npm run seed for the demo dataset).
//
// ⚠ The role upsert below seeds APP_ROLES, which now includes 'Guest' (renamed
// from 'Default'). This seed requires 07_rename_default_role_to_guest.sql to have
// run first, or this upsert will create a stray 'Guest' role alongside a
// still-present 'Default' row.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// The demo files are plain TS with type-only imports — tsx compiles them fine.
import {
  pipelineSuppliers,
  blacklistedSuppliers,
  completedSuppliers,
  mrlRequirements,
  type TrackerSupplier,
  type BlacklistedSupplier,
  type CompletedSupplier,
} from '../../frontend/src/data/pipeline-demo';
import { scoutingEvents } from '../../frontend/src/data/events-demo';
import { strategyEntries } from '../../frontend/src/data/strategy-demo';
import {
  COMMODITIES,
  TRACKER_STAGES,
  SUPPLIER_STATUS,
  SUB_STATUSES,
  SLA_VALUES,
  PRODUCT_CATEGORIES,
  CONFIDENCE_LEVELS,
  IMMEX_STATUSES,
  APP_ROLES,
  todayISO,
} from '../src/domain/constants';
import { immexNameFromFlags, normalizeConfidence } from '../src/services/catalogMapping';
import { pendingUsername } from '../src/services/usersService';

const prisma = new PrismaClient();

/** Attributed as the actor for demo-data writes (history entries, notes already carry their own). */
const SEED_ACTOR = { displayName: 'Seed Script', role: 'SSD' };

/** The 21 real GSM-team users. username = local part of the email, verbatim. */
const REAL_USERS: { displayName: string; email: string; role: string }[] = [
  { displayName: 'Miguel Angel Camacho', email: 'miguel.angel.camacho@nexteer.com', role: 'PM' },
  { displayName: 'Lucia Morales', email: 'lucia.morales@nexteer.com', role: 'PM' },
  { displayName: 'Christian Arturo Armendariz', email: 'christianarturo.armendariz@nexteer.com', role: 'PM' },
  { displayName: 'Ivan Aguila', email: 'ivan.aguila@nexteer.com', role: 'PM' },
  { displayName: 'Jaime Cabrera', email: 'jaime.cabrera@nexteer.com', role: 'PM' },
  { displayName: 'Fernando Ramos', email: 'fernando.ramos@nexteer.com', role: 'Buyer' },
  { displayName: 'Miguel Angel Molina', email: 'miguel.molina@nexteer.com', role: 'Buyer' },
  { displayName: 'Antonio Toscano', email: 'antonio.toscano@nexteer.com', role: 'Buyer' },
  { displayName: 'Kenia Hernandez', email: 'kenia.hernandez@nexteer.com', role: 'Buyer' },
  { displayName: 'Oscar Alejandro Sanchez', email: 'oscar.alejandro.sanchez@nexteer.com', role: 'Buyer' },
  { displayName: 'Diego Campos', email: 'diego.campos@nexteer.com', role: 'Buyer' },
  { displayName: 'Agustin Antonio Carvalho', email: 'agustin.carvalho@nexteer.com', role: 'Buyer' },
  { displayName: 'Fernanda Merlo', email: 'fernanda.merlo@nexteer.com', role: 'Buyer' },
  { displayName: 'Ivan Mendoza', email: 'ivan.mendoza.guadarrama@nexteer.com', role: 'Buyer' },
  { displayName: 'Miguel Angel Guzman', email: 'miguel.angel.guzman@nexteer.com', role: 'Buyer' },
  { displayName: 'Ramon Gutierrez', email: 'ramon.gutierrez@nexteer.com', role: 'SQD' },
  { displayName: 'Vianey Perea', email: 'vianey.perea@nexteer.com', role: 'SSD' },
  { displayName: 'Itzel Campos', email: 'itzel.campos@nexteer.com', role: 'SSD' },
  { displayName: 'Lorena Luna', email: 'lorena.luna@nexteer.com', role: 'SSD' },
  { displayName: 'Marissa Hernandez', email: 'marissa.hernandez@nexteer.com', role: 'SSD' },
  { displayName: 'Yael Urbano', email: 'yael.urbano@nexteer.com', role: 'SSD' },
];


type AnySupplier = TrackerSupplier | BlacklistedSupplier | CompletedSupplier;

function isBlacklisted(s: AnySupplier): s is BlacklistedSupplier {
  return 'rejectionReason' in s;
}
function isCompleted(s: AnySupplier): s is CompletedSupplier {
  return 'completedDate' in s;
}

export interface CatalogIds {
  commodity: Map<string, number>;
  stage: Map<string, number>;
  status: Map<string, number>;
  subStatus: Map<string, number>;
  sla: Map<string, number>;
  productCategory: Map<string, number>;
  confidence: Map<string, number>; // keyed by 3-char code
  immex: Map<string, number>;
  role: Map<string, number>;
}

export async function seedSupplier(prisma: PrismaClient, s: AnySupplier, ids: CatalogIds) {
  const commodityId = ids.commodity.get(s.commodity);
  if (!commodityId) throw new Error(`Commodity not in catalog: ${s.commodity} (${s.id})`);

  const status = isBlacklisted(s) ? 'BLACKLISTED' : isCompleted(s) ? 'COMPLETED' : 'ACTIVE';

  const reachedParking = s.parkingOnboardingDate != null || s.stage !== 'Scouting Event';
  const hasPrelim =
    s.preliminaryTabsCompleted != null || s.prelim_startDate != null;
  const hasSupplierEval =
    s.supplierEvalTabsCompleted != null || s.prelim_parts.length > 0 || s.prelim_rfqReceived != null;
  const hasIntelex =
    s.intelexTabsCompleted != null || s.intelexSaved || s.intelex_recordCreationDate != null;

  await prisma.supplier.create({
    data: {
      id: s.id,
      folio: s.folio,
      name: s.name,
      statusId: ids.status.get(status)!,
      stageId: ids.stage.get(s.stage)!,
      scoutingPhase: s.scoutingPhase,
      entrySource: s.entrySource,
      commodityId,
      productCategoryId: ids.productCategory.get(s.productCategory)!,
      productType: s.productType,
      country: s.country,
      manufacturingAddress: s.manufacturingAddress,
      buyer: s.buyer,
      scoutingInput: s.scoutingInput,
      daysInStage: s.daysInStage,
      daysSinceParkingLot: s.daysSinceParkingLot,
      docsPercent: s.docsPercent,
      slaId: ids.sla.get(s.sla)!,
      globalSlaId: s.globalSla ? ids.sla.get(s.globalSla) : null,
      subStatusId: s.subStatus ? ids.subStatus.get(s.subStatus) : null,
      onboardingDate: s.onboardingDate,
      preEvalStartDate: s.preEvalStartDate,
      initialQuoteSubmitted: s.initialQuoteSubmitted,
      qadPrice: s.qadPrice,
      savingExpected: s.savingExpected,
      tooling: s.tooling,
      selectedForDevelopment: s.selectedForDevelopment,
      investigateRecordNumber: s.investigateRecordNumber,
      intelexDate: s.intelexDate,

      companyInfo: {
        create: {
          fullName: s.fullName,
          dunsNumber: s.dunsNumber,
          taxIdNumber: s.taxIdNumber,
          recommendedBy: s.recommendedBy,
          recommenderDept: s.recommenderDept,
          companyType: s.companyType,
          foundedYear: s.foundedYear,
          headquarters: s.headquarters,
          website: s.website,
          phone: s.phone,
          contactEmail: s.contactEmail,
          contactName: s.contactName,
        },
      },
      technicalInfo: {
        create: {
          technology: s.technology,
          machineryType: s.machineryType,
          processMethod: s.processMethod,
          pressCapacity: s.pressCapacity,
          materials: s.materials,
          complementaryOperations: s.complementaryOperations,
          safetyCritical: s.safetyCritical,
          safetyExperience: s.safetyExperience,
          certifications: s.certifications,
          knowsCQIs: s.knowsCQIs,
        },
      },
      commercialInfo: {
        create: {
          annualRevenue: s.annualRevenue,
          productionVolume: s.productionVolume,
          employees: s.employees,
          facilities: s.facilities,
          topCustomers: s.topCustomers,
          immexStatusId: ids.immex.get(immexNameFromFlags(s.hasIMMEX, s.planIMMEX))!,
          exportCapability: String(s.exportCapability),
          strengths: s.strengths,
          weaknesses: s.weaknesses,
          observations: s.observations,
          recommendations: s.recommendations,
          priority: s.priority,
          primaryDriver: s.primaryDriver,
          confidenceLevelId: ids.confidence.get(normalizeConfidence(s.confidenceLevel))!,
        },
      },
      documents: {
        create: s.documents.map(d => ({
          name: d.name,
          status: d.status,
          date: d.date ?? null,
          link: d.link ?? null,
        })),
      },
      notes: {
        create: s.notes.map((n, i) => ({
          // demo IDs collide across the blacklist spread copies — prefix them
          id: `${s.id}-${n.id}-${i}`,
          text: n.text,
          author: n.author,
          role: n.role,
          date: n.date,
          stageId: ids.stage.get(n.stage)!,
        })),
      },
      history: {
        create: [
          ...s.history.map(h => ({
            date: h.date,
            action: h.action,
            user: h.user,
            role: h.role,
            note: h.note ?? null,
          })),
          // Same foundation createSupplier gives every real supplier (see
          // reportsService.getStageSnapshot): one stage-bearing entry so a
          // demo supplier is reconstructable by date instead of being
          // invisible to snapshot/diff reporting.
          {
            date: todayISO(),
            action: 'Demo supplier seeded',
            user: SEED_ACTOR.displayName,
            role: SEED_ACTOR.role,
            toStageId: ids.stage.get(s.stage)!,
          },
        ],
      },
      parts: {
        create: s.parts.map(p => ({
          partNumber: p.partNumber,
          partDescription: p.partDescription,
          pl: p.pl,
          peakVolume: p.peakVolume,
          program: p.program,
          eop: p.eop,
          targetPrice: p.targetPrice,
          rfqPrice: p.rfqPrice,
          confidenceLevelId: ids.confidence.get(normalizeConfidence(p.confidence))!,
        })),
      },
      prelimParts: {
        create: s.prelim_parts.map(p => ({
          partNumber: p.partNumber,
          partDescription: p.partDescription,
          pl: p.pl,
          annualPeakVolume: p.annualPeakVolume,
          program: p.program,
          eop: p.eop,
          initialQuote: p.initialQuote,
          qadPrice: p.qadPrice,
          delta: p.delta,
          tooling: p.tooling,
          savingExpected: p.savingExpected,
          confidenceLevelId: p.confidence
            ? ids.confidence.get(normalizeConfidence(p.confidence))
            : undefined,
        })),
      },

      scoutingData: {
        create: {
          tabScoutingEvent: s.scoutingTabsCompleted.scoutingEvent,
          tabSupplierInfo: s.scoutingTabsCompleted.supplierInfo,
          tabAttendees: s.scoutingTabsCompleted.attendees,
          tabAgenda: s.scoutingTabsCompleted.agenda,
          tabNextStep: s.scoutingTabsCompleted.nextStep,
          b2bStatus: s.b2bStatus,
          b2bWhoAttends: s.b2bWhoAttends,
          b2bManager: s.b2bManager,
          b2bBuyer: s.b2bBuyer,
          b2bComments: s.b2bComments,
          agendaStatus: s.agendaStatus,
          agendaTeamsLink: s.agendaTeamsLink,
          agendaScheduledDate: s.agendaScheduledDate,
          agendaTimezone: s.agendaTimezone,
          agendaStand: s.agendaStand,
          agendaStartTime: s.agendaStartTime,
          agendaEndTime: s.agendaEndTime,
          agendaDuration: s.agendaDuration,
          selectedForParking: s.selectedForParking,
          selectionReason: s.selectionReason,
        },
      },
      ...(reachedParking
        ? {
          parkingData: {
            create: {
              onboardingDate: s.parkingOnboardingDate,
              timeless: s.parkingTimeless,
              dateToMovePreliminary: s.parkingDateToMovePreliminary,
              daysElapsed: s.parkingDaysElapsed,
              scoutingInput: s.parkingScoutingInput,
              subStatusId: s.parkingSubStatus ? ids.subStatus.get(s.parkingSubStatus) : null,
              isRecommendation: s.parkingIsRecommendation,
              buyer: s.parkingBuyer,
              companyName: s.parkingCompanyName,
              b2bMeeting: s.parkingB2BMeeting,
              name1: s.parkingName1,
              website: s.parkingWebsite,
              email1: s.parkingEmail1,
              phone: s.parkingPhone,
              commodity: s.parkingCommodity,
              productType: s.parkingProductType,
              manufacturingCountry: s.parkingManufacturingCountry,
              manufacturingAddress: s.parkingManufacturingAddress,
              additionalComments: s.parkingAdditionalComments,
              hasTabs: s.parkingTabsCompleted != null,
              tabOverview: s.parkingTabsCompleted?.overview ?? false,
              tabContact: s.parkingTabsCompleted?.contact ?? false,
              tabDetails: s.parkingTabsCompleted?.details ?? false,
            },
          },
        }
        : {}),
      ...(hasPrelim
        ? {
          preliminaryData: {
            create: {
              hasTabs: s.preliminaryTabsCompleted != null,
              tabOverview: s.preliminaryTabsCompleted?.overview ?? false,
              tabCapabilities: s.preliminaryTabsCompleted?.capabilities ?? false,
              tabVisit: s.preliminaryTabsCompleted?.visit ?? false,
              startDate: s.prelim_startDate,
              priority: s.prelim_priority,
              scoutingInput: s.prelim_scoutingInput,
              buyer: s.prelim_buyer,
              commodity: s.prelim_commodity,
              primaryDriver: s.prelim_primaryDriver,
              companyName: s.prelim_companyName,
              dunsNumber: s.prelim_dunsNumber,
              hqAddress: s.prelim_hqAddress,
              hqCity: s.prelim_hqCity,
              hqCountry: s.prelim_hqCountry,
              manufacturingAddress: s.prelim_manufacturingAddress,
              manufacturingCity: s.prelim_manufacturingCity,
              manufacturingCountry: s.prelim_manufacturingCountry,
              companyType: s.prelim_companyType,
              foundedYear: s.prelim_foundedYear,
              footprint: s.prelim_footprint,
              yearsInMexico: s.prelim_yearsInMexico,
              facilities: s.prelim_facilities,
              employees: s.prelim_employees,
              annualRevenue: s.prelim_annualRevenue,
              productionVolume: s.prelim_productionVolume,
              mainTechnology: s.prelim_mainTechnology,
              pressCapacity: s.prelim_pressCapacity,
              generalManager: s.prelim_generalManager,
              market: s.prelim_market,
              topCustomers: s.prelim_topCustomers,
              exportCapability: s.prelim_exportCapability,
              certifications: s.prelim_certifications,
              immexStatusId: s.prelim_hasIMMEX ? ids.immex.get(s.prelim_hasIMMEX) : null,
              planToGetIMMEX: s.prelim_planToGetIMMEX,
              machineryType: s.prelim_machineryType,
              processingMethod: s.prelim_processingMethod,
              complementaryOps: s.prelim_complementaryOps,
              toolingDesign: s.prelim_toolingDesign,
              materials: s.prelim_materials,
              rawMaterialIndex: s.prelim_rawMaterialIndex,
              applications: s.prelim_applications,
              visitDatePlanned: s.prelim_visitDatePlanned,
              visitDateCompleted: s.prelim_visitDateCompleted,
              visitParticipants: s.prelim_visitParticipants,
              strengths: s.prelim_strengths,
              weaknesses: s.prelim_weaknesses,
              observations: s.prelim_observations,
              recommendations: s.prelim_recommendations,
            },
          },
        }
        : {}),
      ...(hasSupplierEval
        ? {
          supplierEvalData: {
            create: {
              hasTabs: s.supplierEvalTabsCompleted != null,
              tabCompetitiveness: s.supplierEvalTabsCompleted?.competitiveness ?? false,
              tabFundamentals: s.supplierEvalTabsCompleted?.fundamentals ?? false,
              rfqReceived: s.prelim_rfqReceived,
              ndaSigned: s.prelim_ndaSigned,
              tcsSigned: s.prelim_tcsSigned,
              ttcsSigned: s.prelim_ttcsSigned,
              nsrSigned: s.prelim_nsrSigned,
              sdaSigned: s.prelim_sdaSigned,
            },
          },
        }
        : {}),
      ...(hasIntelex
        ? {
          intelexData: {
            create: {
              hasTabs: s.intelexTabsCompleted != null,
              tabRecord: s.intelexTabsCompleted?.record ?? false,
              tabTimeline: s.intelexTabsCompleted?.timeline ?? false,
              tabEfficiency: s.intelexTabsCompleted?.efficiency ?? false,
              saved: s.intelexSaved,
              recordCreationDate: s.intelex_recordCreationDate,
              investigateRecordNumber: s.intelex_investigateRecordNumber,
              investigateExpected: s.intelex_investigateExpected,
              investigateReal: s.intelex_investigateReal,
              l0Expected: s.intelex_l0Expected,
              l0Real: s.intelex_l0Real,
              l1Expected: s.intelex_l1Expected,
              l1Real: s.intelex_l1Real,
              l2Expected: s.intelex_l2Expected,
              l2Real: s.intelex_l2Real,
              l3Expected: s.intelex_l3Expected,
              l3Real: s.intelex_l3Real,
              l4Expected: s.intelex_l4Expected,
              l4Real: s.intelex_l4Real,
              efficiencyL0: s.intelex_efficiencyL0,
              efficiencyL1: s.intelex_efficiencyL1,
              efficiencyL2: s.intelex_efficiencyL2,
              efficiencyL3: s.intelex_efficiencyL3,
              efficiencyL4: s.intelex_efficiencyL4,
            },
          },
        }
        : {}),
      ...(isBlacklisted(s)
        ? {
          blacklistEntry: {
            create: {
              rejectedBy: s.rejectedBy,
              rejectionDate: s.rejectionDate,
              rejectionReason: s.rejectionReason,
            },
          },
        }
        : {}),
      ...(isCompleted(s)
        ? {
          completionEntry: {
            create: { completedDate: s.completedDate, completedBy: s.completedBy },
          },
        }
        : {}),
    },
  });
}

async function seedCatalogsAndUsers() {
  // ALWAYS runs; never deletes; everything is an idempotent upsert by unique key
  // (createdBy = 'seed-script'). Safe to re-run against a DB that already holds
  // real suppliers/events/users. T_Role_RasicAssignment is left unseeded on
  // purpose (awaiting SSD matrix).
  console.log('[seed] catalogs…');
  for (const [i, name] of TRACKER_STAGES.entries()) {
    await prisma.stage.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i, createdBy: 'seed-script' },
    });
  }
  for (const name of SUPPLIER_STATUS) {
    await prisma.supplierStatus.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }
  for (const name of SUB_STATUSES) {
    await prisma.subStatus.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }
  for (const name of SLA_VALUES) {
    await prisma.sla.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }
  for (const name of PRODUCT_CATEGORIES) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }
  for (const c of CONFIDENCE_LEVELS) {
    await prisma.confidenceLevel.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, label: c.label, sortOrder: c.sortOrder, createdBy: 'seed-script' },
    });
  }
  for (const name of IMMEX_STATUSES) {
    await prisma.immexStatus.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }
  for (const name of APP_ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }

  console.log('[seed] commodities…');
  // Upsert by name (was create-in-loop): real suppliers may already FK these ids,
  // so the catalog can never be DELETE+recreated on a re-run.
  for (const name of COMMODITIES) {
    await prisma.commodity.upsert({
      where: { name },
      update: {},
      create: { name, createdBy: 'seed-script' },
    });
  }

  console.log('[seed] users…');
  // 21 real GSM-team users, pre-provisioned BY EMAIL (email is the stable identity;
  // the real AD netid is unknown until first login, so username starts as a
  // 'pending:' placeholder). email is not @unique in Prisma, so we resolve
  // manually with findFirst instead of upsert. On re-run we refresh only
  // displayName — NEVER username (a real login may have already stamped the true
  // netid; don't clobber it back to the placeholder) and NEVER roleId (app-owned).
  for (const u of REAL_USERS) {
    const existing = await prisma.user.findFirst({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { displayName: u.displayName },
      });
    } else {
      await prisma.user.create({
        data: {
          username: pendingUsername(u.email),
          displayName: u.displayName,
          email: u.email,
          adObjectId: null,
          role: { connect: { name: u.role } },
        },
      });
    }
  }
}

async function seedDemoTrackerData() {
  // Only invoked when SEED_DEMO=true. Wipes + reseeds the demo suppliers/events/
  // strategy from frontend/src/data/*.ts. The deleteMany() calls live HERE (they
  // used to run unconditionally in main()), so a normal `npm run seed` never
  // deletes real suppliers/events captured by the team.
  console.log('[seed:demo] wiping demo suppliers/events/strategy…');
  await prisma.eventB2BMeeting.deleteMany();
  await prisma.eventSupplierEntry.deleteMany();
  await prisma.eventNote.deleteMany();
  await prisma.event.deleteMany();
  await prisma.supplier.deleteMany(); // satellites cascade
  await prisma.strategyEntry.deleteMany();
  await prisma.mrlRequirement.deleteMany();

  // Catalog name → id maps for every FK write below (catalogs already upserted).
  const commodityIds = new Map((await prisma.commodity.findMany()).map(c => [c.name, c.id]));
  const catalogIds: CatalogIds = {
    commodity: commodityIds,
    stage: new Map((await prisma.stage.findMany()).map(s => [s.name, s.id])),
    status: new Map((await prisma.supplierStatus.findMany()).map(s => [s.name, s.id])),
    subStatus: new Map((await prisma.subStatus.findMany()).map(s => [s.name, s.id])),
    sla: new Map((await prisma.sla.findMany()).map(s => [s.name, s.id])),
    productCategory: new Map((await prisma.productCategory.findMany()).map(s => [s.name, s.id])),
    confidence: new Map((await prisma.confidenceLevel.findMany()).map(c => [c.code, c.id])),
    immex: new Map((await prisma.immexStatus.findMany()).map(s => [s.name, s.id])),
    role: new Map((await prisma.role.findMany()).map(r => [r.name, r.id])),
  };

  console.log('[seed] suppliers…');
  const all: AnySupplier[] = [...pipelineSuppliers, ...completedSuppliers, ...blacklistedSuppliers];
  for (const s of all) {
    await seedSupplier(prisma, s, catalogIds);
  }

  console.log('[seed] events…');
  const supplierIds = new Set(all.map(s => s.id));
  for (const e of scoutingEvents) {
    await prisma.event.create({
      data: {
        id: e.id,
        name: e.name,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        location: e.location,
        organizer: e.organizer,
        contactName: e.contactName ?? null,
        contactEmail: e.contactEmail ?? null,
        contactPhone: e.contactPhone ?? null,
        status: e.status,
        description: e.description,
        productCategoryId: catalogIds.productCategory.get(e.type)!,
        objective: e.objective,
        topCountry: e.topCountry,
        supplierEntries: {
          create: e.supplierEntries
            .filter(en => supplierIds.has(en.supplierId))
            .map(en => ({
              supplierId: en.supplierId,
              b2bMeeting: en.b2bMeeting,
              status: en.status,
              result: en.result,
            })),
        },
        b2bMeetings: {
          create: e.b2bMeetings.map(m => ({
            supplierId: supplierIds.has(m.supplierId) ? m.supplierId : null,
            time: m.time,
            stand: m.stand,
            companyName: m.companyName,
            commodity: m.commodity,
            attendeeManager: m.attendeeManager,
            attendeeBuyer: m.attendeeBuyer,
            duration: m.duration,
            status: m.status,
          })),
        },
        notes: {
          create: e.notes.map(n => ({
            id: n.id,
            text: n.text,
            author: n.author,
            role: n.role,
            date: n.date,
          })),
        },
      },
    });
  }

  console.log('[seed] strategy entries…');
  for (const se of strategyEntries) {
    const commodityId = commodityIds.get(se.commodity);
    if (!commodityId) throw new Error(`Commodity not in catalog: ${se.commodity}`);
    await prisma.strategyEntry.create({
      data: {
        id: se.id,
        commodityId,
        needs2026: se.strategyNeeds['2026'],
        needs2027: se.strategyNeeds['2027'],
        needs2028: se.strategyNeeds['2028'],
        needs2029: se.strategyNeeds['2029'],
        needs2030: se.strategyNeeds['2030'],
        needs2031: se.strategyNeeds['2031'],
        createdBy: se.createdBy,
        updatedAt: se.updatedAt,
      },
    });
  }

  console.log('[seed] MRL requirements…');
  for (const m of mrlRequirements) {
    const commodityId = commodityIds.get(m.commodity);
    if (!commodityId) throw new Error(`Commodity not in catalog: ${m.commodity}`);
    await prisma.mrlRequirement.create({
      data: {
        id: m.id,
        buyerName: m.buyerName,
        commodityId,
        nexteerProductLine: m.nexteerProductLine,
        vol2026: m.volumeByYear['2026'],
        vol2027: m.volumeByYear['2027'],
        vol2028: m.volumeByYear['2028'],
        vol2029: m.volumeByYear['2029'],
        vol2030: m.volumeByYear['2030'],
        vol2031: m.volumeByYear['2031'],
        partNumber: m.partNumber,
        partDescription: m.partDescription,
        mainMaterialsSpecTech: m.mainMaterialsSpecTech,
        peakVolume: m.peakVolume,
        program: m.program,
        eop: m.eop,
        targetPrice: m.targetPrice,
        priority: m.priority,
        primaryDriver: m.primaryDriver,
        keyManufacturingCapabilities: m.keyManufacturingCapabilities,
        safetyCriticalPart: m.safetyCriticalPart,
        supplierExperienceInSafetyRequired: m.supplierExperienceInSafetyRequired,
        certifications: m.certifications,
        knowsCQIs: m.knowsCQIs,
      },
    });
  }

  console.log('[seed:demo] done ✔');
}

async function main() {
  // Notifications are NOT seeded any more — they are generated by real domain
  // events (see notificationsService.notifySsdTeam).
  await seedCatalogsAndUsers();

  if (process.env.SEED_DEMO === 'true') {
    await seedDemoTrackerData();
  } else {
    console.log(
      '[seed] SEED_DEMO no está en true — se omiten proveedores/eventos/' +
        'estrategia demo. Usa SEED_DEMO=true npm run seed si los necesitas para dev local.',
    );
  }

  console.log('[seed] done ✔');
}

// Only run when invoked directly (`tsx prisma/seed.ts`) — not when imported
// by tests, which need seedSupplier() without triggering a real DB seed.
if (require.main === module) {
  main()
    .catch(err => {
      console.error('[seed] failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
