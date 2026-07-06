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
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
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

/** Full supplier row (with relations) accepted by toSupplierDTO. */
export function fakeSupplierRow(
  overrides: Partial<SupplierWithRelations> = {},
): SupplierWithRelations {
  const base = {
    id: 'ps1',
    folio: 'SSD-2026-001',
    name: 'TEST SUPPLIER',
    status: 'ACTIVE',
    stage: 'Scouting Event',
    scoutingPhase: 'Identified',
    entrySource: 'Scouting Event',
    commodityId: 1,
    commodity: { id: 1, name: 'Machining' },
    productCategory: 'Direct',
    productType: 'Housings',
    country: 'Mexico',
    manufacturingAddress: 'Celaya, GTO',
    buyer: 'Ana García',
    scoutingInput: 'Test Event 2026',
    daysInStage: 3,
    daysSinceParkingLot: null,
    docsPercent: 0,
    sla: 'green',
    globalSla: null,
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
    scoutingData: null,
    parkingData: null,
    preliminaryData: null,
    supplierEvalData: null,
    intelexData: null,
    blacklistEntry: null,
    completionEntry: null,
  };
  return { ...base, ...overrides } as SupplierWithRelations;
}
