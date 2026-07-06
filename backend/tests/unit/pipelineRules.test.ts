import { beforeEach, describe, expect, it } from 'vitest';
import {
  blacklistSupplier,
  moveSupplierToStage,
  setParkingSubStatus,
} from '../../src/services/pipelineService';
import { deleteSupplier } from '../../src/services/suppliersService';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../src/domain/errors';
import type { AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, fakeSupplierRow, type MockPrisma } from '../helpers/mockPrisma';

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };

describe('stage transition rules', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('rejects an unknown target stage', async () => {
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Limbo', actor),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('404s when the supplier does not exist', async () => {
    mock.supplier.findUnique.mockResolvedValue(null);
    await expect(
      moveSupplierToStage(asPrisma(mock), 'nope', 'Parking Lot', actor),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to move a blacklisted supplier', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ status: 'BLACKLISTED' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('Completed is terminal — refuses to move a completed supplier back', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ status: 'COMPLETED', stage: 'Completed' }),
    );
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Supplier Evaluation', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('only allows completing from Intelex Handoff', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Completed', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('completes a supplier from Intelex Handoff (status + completion entry + history)', async () => {
    const row = fakeSupplierRow({ stage: 'Intelex Handoff' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.completionEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await moveSupplierToStage(asPrisma(mock), 'ps1', 'Completed', actor);

    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stage: 'Completed', status: 'COMPLETED' }),
      }),
    );
    expect(mock.completionEntry.create).toHaveBeenCalledOnce();
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledOnce();
  });

  it('rejects a backward move (Preliminary Evaluation -> Parking Lot)', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Preliminary Evaluation' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('moves between working stages and creates the target satellite row', async () => {
    const row = fakeSupplierRow({ stage: 'Scouting Event' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', actor);

    expect(mock.parkingData.upsert).toHaveBeenCalledOnce();
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'Moved from Scouting Event to Parking Lot' }),
      }),
    );
  });
});

describe('blacklist rules', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('rejects blacklisting without a reason', async () => {
    await expect(
      blacklistSupplier(asPrisma(mock), 'ps1', undefined, actor),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      blacklistSupplier(asPrisma(mock), 'ps1', '   ', actor),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mock.supplier.findUnique).not.toHaveBeenCalled();
  });

  it('rejects double-blacklisting', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ status: 'BLACKLISTED' }));
    await expect(
      blacklistSupplier(asPrisma(mock), 'ps1', 'quality issues', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('rejects blacklisting a completed supplier', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ status: 'COMPLETED', stage: 'Completed' }),
    );
    await expect(
      blacklistSupplier(asPrisma(mock), 'ps1', 'reason', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('blacklists with reason (entry + status + history)', async () => {
    const row = fakeSupplierRow({ stage: 'Preliminary Evaluation' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.blacklistEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await blacklistSupplier(asPrisma(mock), 'ps1', 'Failed audit', actor);

    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'BLACKLISTED' } }),
    );
    expect(mock.blacklistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: 'Failed audit', rejectedBy: 'Ana García' }),
      }),
    );
  });
});

describe('parking lot sub-status rules', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('rejects an unknown sub-status', async () => {
    await expect(
      setParkingSubStatus(asPrisma(mock), 'ps1', 'Maybe', actor),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('"No Go" without a reason is rejected before any write', async () => {
    await expect(
      setParkingSubStatus(asPrisma(mock), 'ps1', 'No Go', actor),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('sub-status only applies in Parking Lot', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Scouting Event' }));
    await expect(
      setParkingSubStatus(asPrisma(mock), 'ps1', 'On Hold', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('"No Go" with reason auto-blacklists the supplier', async () => {
    const row = fakeSupplierRow({ stage: 'Parking Lot' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.blacklistEntry.create.mockResolvedValue({});

    await setParkingSubStatus(asPrisma(mock), 'ps1', 'No Go', actor, 'Not competitive');

    expect(mock.blacklistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: 'Not competitive' }),
      }),
    );
    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'BLACKLISTED' } }),
    );
  });

  it('"Go" does not blacklist', async () => {
    const row = fakeSupplierRow({ stage: 'Parking Lot' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await setParkingSubStatus(asPrisma(mock), 'ps1', 'Go', actor);

    expect(mock.blacklistEntry.create).not.toHaveBeenCalled();
  });
});

describe('delete rules', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('allows hard delete only in Scouting Event', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Scouting Event' }));
    mock.supplier.delete.mockResolvedValue({});
    await deleteSupplier(asPrisma(mock), 'ps1');
    expect(mock.supplier.delete).toHaveBeenCalledOnce();
  });

  it('rejects delete in any later stage', async () => {
    for (const stage of ['Parking Lot', 'Preliminary Evaluation', 'Supplier Evaluation', 'Intelex Handoff']) {
      mock = createMockPrisma();
      mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage }));
      await expect(deleteSupplier(asPrisma(mock), 'ps1')).rejects.toBeInstanceOf(BusinessRuleError);
      expect(mock.supplier.delete).not.toHaveBeenCalled();
    }
  });

  it('rejects delete of blacklisted suppliers (even at Scouting Event stage)', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ stage: 'Scouting Event', status: 'BLACKLISTED' }),
    );
    await expect(deleteSupplier(asPrisma(mock), 'ps1')).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
