import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { SupplierWithRelations } from '../../src/mappers/supplierMapper';

/**
 * Hand-rolled Prisma mock covering the model methods the services use.
 * $transaction supports both the array form and the callback form (callback
 * receives the mock itself as tx).
 */
export function createMockPrisma() {
  const model = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });

  const mock = {
    supplier: model(),
    companyInfo: model(),
    technicalInfo: model(),
    commercialInfo: model(),
    supplierDocument: model(),
    supplierNote: model(),
    supplierHistoryEntry: model(),
    supplierPart: model(),
    prelimPart: model(),
    scoutingData: model(),
    parkingData: model(),
    preliminaryData: model(),
    supplierEvalData: model(),
    intelexData: model(),
    blacklistEntry: model(),
    completionEntry: model(),
    event: model(),
    eventSupplierEntry: model(),
    eventB2BMeeting: model(),
    eventNote: model(),
    commodity: model(),
    stage: model(),
    supplierStatus: model(),
    subStatus: model(),
    sla: model(),
    productCategory: model(),
    confidenceLevel: model(),
    immexStatus: model(),
    role: model(),
    strategyEntry: model(),
    mrlRequirement: model(),
    user: model(),
    refreshToken: model(),
    notification: model(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(mock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return mock;
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;

export function asPrisma(mock: MockPrisma): PrismaClient {
  return mock as unknown as PrismaClient;
}

/**
 * Params for fakeSupplierRow. Catalog values are passed as their plain string
 * name (status/stage/etc) — the helper wraps them in the relation shape the
 * services and mapper now read (supplier.status.name, supplier.stage.name, …).
 */
interface FakeSupplierParams {
  id?: string;
  status?: string; // status name
  stage?: string; // stage name
  stageBeforeExit?: string | null;
  scoutingPhase?: string | null; // 'Identified' | 'B2B' | null
  scoutingData?: SupplierWithRelations['scoutingData'];
  // SLA inputs: the stored counters plus the stage anchor dates they fall back from.
  daysInStage?: number;
  daysSinceParkingLot?: number | null;
  sla?: string; // current sla name
  globalSla?: string | null; // current globalSla name
  parkingOnboardingDate?: string | null;
  preliminaryStartDate?: string | null;
}

const catRef = (id: number, name: string) => ({ id, name });

/** C_Sla as seeded — ids match SLA_IDS in the SLA tests. */
export const fakeSlaCatalog = [
  { id: 1, name: 'green' },
  { id: 2, name: 'yellow' },
  { id: 3, name: 'red' },
];

const slaRef = (name: string | null | undefined) =>
  fakeSlaCatalog.find(s => s.name === name) ?? null;

/** Full supplier row (with relations) accepted by toSupplierDTO. */
export function fakeSupplierRow(params: FakeSupplierParams = {}): SupplierWithRelations {
  const statusName = params.status ?? 'ACTIVE';
  const stageName = params.stage ?? 'Scouting Event';
  const sla = slaRef(params.sla ?? 'green')!;
  const globalSla = slaRef(params.globalSla);
  const base = {
    id: params.id ?? 'ps1',
    folio: 'SSD-2026-001',
    name: 'TEST SUPPLIER',
    statusId: 1,
    status: catRef(1, statusName),
    stageId: 1,
    stage: catRef(1, stageName),
    stageBeforeExit: params.stageBeforeExit ?? null,
    scoutingPhase: params.scoutingPhase === undefined ? 'Identified' : params.scoutingPhase,
    entrySource: 'Scouting Event',
    commodityId: 1,
    commodity: catRef(1, 'Machining'),
    productCategoryId: 1,
    productCategory: catRef(1, 'Direct'),
    productType: 'Housings',
    country: 'Mexico',
    manufacturingAddress: 'Celaya, GTO',
    buyer: 'Ana García',
    scoutingInput: 'Test Event 2026',
    daysInStage: params.daysInStage ?? 3,
    daysSinceParkingLot: params.daysSinceParkingLot ?? null,
    docsPercent: 0,
    slaId: sla.id,
    sla,
    globalSlaId: globalSla?.id ?? null,
    globalSla,
    subStatusId: null,
    subStatus: null,
    onboardingDate: '2026-05-01',
    preEvalStartDate: null,
    initialQuoteSubmitted: false,
    qadPrice: null,
    savingExpected: null,
    tooling: null,
    selectedForDevelopment: false,
    investigateRecordNumber: null,
    intelexDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyInfo: null,
    technicalInfo: null,
    commercialInfo: null,
    documents: [],
    notes: [],
    history: [],
    parts: [],
    prelimParts: [],
    scoutingData: params.scoutingData ?? null,
    parkingData: params.parkingOnboardingDate ? { onboardingDate: params.parkingOnboardingDate } : null,
    preliminaryData: params.preliminaryStartDate ? { startDate: params.preliminaryStartDate } : null,
    supplierEvalData: null,
    intelexData: null,
    blacklistEntry: null,
    completionEntry: null,
  };
  return base as unknown as SupplierWithRelations;
}
