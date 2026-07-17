// Seed derived directly from the frontend demo data (frontend/src/data/*.ts).
// Run with: npm run seed  (requires a reachable SQL Server).
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
import { notifications } from '../../frontend/src/data/demo';
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
} from '../src/domain/constants';
import { immexNameFromFlags, normalizeConfidence } from '../src/services/catalogMapping';

const prisma = new PrismaClient();

const HOURS = 60 * 60 * 1000;

/** 'hace 1h' → Date one hour ago (so the API reproduces the same label). */
function timeLabelToDate(label: string): Date {
  const m = /hace\s+(\d+)\s*(h|m|d)/i.exec(label);
  if (!m) return new Date();
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = unit === 'h' ? n * HOURS : unit === 'm' ? n * 60_000 : n * 24 * HOURS;
  return new Date(Date.now() - ms);
}

type AnySupplier = TrackerSupplier | BlacklistedSupplier | CompletedSupplier;

function isBlacklisted(s: AnySupplier): s is BlacklistedSupplier {
  return 'rejectionReason' in s;
}
function isCompleted(s: AnySupplier): s is CompletedSupplier {
  return 'completedDate' in s;
}

interface CatalogIds {
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

async function seedSupplier(s: AnySupplier, ids: CatalogIds) {
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
        create: s.history.map(h => ({
          date: h.date,
          action: h.action,
          user: h.user,
          role: h.role,
          note: h.note ?? null,
        })),
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

async function main() {
  console.log('[seed] wiping existing data…');
  // Delete in dependency order (junctions / children first)
  await prisma.eventB2BMeeting.deleteMany();
  await prisma.eventSupplierEntry.deleteMany();
  await prisma.eventNote.deleteMany();
  await prisma.event.deleteMany();
  await prisma.supplier.deleteMany(); // satellites cascade
  await prisma.strategyEntry.deleteMany();
  await prisma.mrlRequirement.deleteMany();
  await prisma.commodity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Catalogs first (referenced by suppliers/events/users). Idempotent upserts
  // by unique key so re-runs don't collide; createdBy = 'seed-script'.
  // T_Role_RasicAssignment is left unseeded on purpose (awaiting SSD matrix).
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
  const commodityIds = new Map<string, number>();
  for (const name of COMMODITIES) {
    const c = await prisma.commodity.create({ data: { name, createdBy: 'seed-script' } });
    commodityIds.set(name, c.id);
  }

  // Catalog name → id maps for every FK write below (built from the rows just seeded).
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

  console.log('[seed] users…');
  await prisma.user.createMany({
    data: [
      { username: 'yael.urbano', displayName: 'Yael Urbano', email: 'y.urbano@nexteer.com', adObjectId: 'ad-guid-yael-urbano', roleId: catalogIds.role.get('SSD')! },
      { username: 'carlos.mendoza', displayName: 'Carlos Mendoza', email: 'c.mendoza@nexteer.com', adObjectId: 'ad-guid-carlos-mendoza', roleId: catalogIds.role.get('SSD')! },
      { username: 'ana.garcia', displayName: 'Ana García', email: 'a.garcia@nexteer.com', adObjectId: 'ad-guid-ana-garcia', roleId: catalogIds.role.get('Buyer')! },
      { username: 'roberto.sanchez', displayName: 'Roberto Sánchez', email: 'r.sanchez@nexteer.com', adObjectId: 'ad-guid-roberto-sanchez', roleId: catalogIds.role.get('SQD')! },
      { username: 'marissa.hernandez', displayName: 'Marissa Hernández', email: 'm.hernandez@nexteer.com', adObjectId: 'ad-guid-marissa-hernandez', roleId: catalogIds.role.get('PM')! },
    ],
  });

  console.log('[seed] suppliers…');
  const all: AnySupplier[] = [...pipelineSuppliers, ...completedSuppliers, ...blacklistedSuppliers];
  for (const s of all) {
    await seedSupplier(s, catalogIds);
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
        topCommodity: e.topCommodity,
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

  console.log('[seed] notifications…');
  // The demo notifications carry no owner; attach them all to the first seeded
  // user (yael.urbano) since Notification.userId is now required.
  const yael = await prisma.user.findUniqueOrThrow({ where: { username: 'yael.urbano' } });
  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        id: n.id,
        message: n.message,
        type: n.type,
        read: n.read,
        link: n.link,
        userId: yael.id,
        createdAt: timeLabelToDate(n.time),
      },
    });
  }

  console.log('[seed] done ✔');
}

main()
  .catch(err => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
