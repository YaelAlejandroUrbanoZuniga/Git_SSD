import { beforeEach, describe, expect, it } from 'vitest';
import {
  blacklistSupplier,
  moveSupplierToStage,
  promoteToB2B,
  setParkingSubStatus,
} from '../../src/services/trackerService';
import { deleteSupplier } from '../../src/services/suppliersService';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../src/domain/errors';
import type { AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, fakeSupplierRow, type MockPrisma } from '../helpers/mockPrisma';

const actor: AuthUser = { id: 'u1', username: 'ana.garcia', displayName: 'Ana García', role: 'Buyer' };

// A valid stage-change note (passes assertMeaningfulText: ≥10 chars, not junk).
const NOTE = 'Advancing after completing the required checklist';

describe('stage transition rules', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('rejects a missing or junk stage-change note before any DB access', async () => {
    for (const bad of [undefined, '', '   ', 'na', 'ok', 'short']) {
      mock = createMockPrisma();
      await expect(
        moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', bad as unknown as string, actor),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mock.supplier.findUnique).not.toHaveBeenCalled();
    }
  });

  it('rejects an unknown target stage', async () => {
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Limbo', NOTE, actor),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('404s when the supplier does not exist', async () => {
    mock.supplier.findUnique.mockResolvedValue(null);
    await expect(
      moveSupplierToStage(asPrisma(mock), 'nope', 'Parking Lot', NOTE, actor),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to move a blacklisted supplier', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ status: 'BLACKLISTED' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', NOTE, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('Completed is terminal — refuses to move a completed supplier back', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ status: 'COMPLETED', stage: 'Completed' }),
    );
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Supplier Evaluation', NOTE, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('only allows completing from Intelex Handoff', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Completed', NOTE, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('completes a supplier from Intelex Handoff (status + completion entry + history)', async () => {
    const row = fakeSupplierRow({ stage: 'Intelex Handoff' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 7, name: 'Completed' });
    mock.supplier.update.mockResolvedValue(row);
    mock.completionEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.supplierNote.create.mockResolvedValue({});

    await moveSupplierToStage(asPrisma(mock), 'ps1', 'Completed', NOTE, actor);

    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: { connect: { name: 'Completed' } },
          status: { connect: { name: 'COMPLETED' } },
          stageEnteredAt: expect.any(Date),
        }),
      }),
    );
    expect(mock.completionEntry.create).toHaveBeenCalledOnce();
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledOnce();
  });

  it('rejects a backward move (Preliminary Evaluation -> Parking Lot)', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Preliminary Evaluation' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', NOTE, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('moves between working stages: satellite, structured history and a real note', async () => {
    const row = fakeSupplierRow({ stage: 'Scouting Event' }); // stageId = 1
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 2, name: 'Parking Lot' });
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.supplierNote.create.mockResolvedValue({});

    await moveSupplierToStage(asPrisma(mock), 'ps1', 'Parking Lot', NOTE, actor);

    expect(mock.parkingData.upsert).toHaveBeenCalledOnce();
    // stageEnteredAt stamped on the supplier
    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stageEnteredAt: expect.any(Date) }) }),
    );
    // history carries the structured from/to stage ids + the note
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'Moved from Scouting Event to Parking Lot',
          fromStageId: 1,
          toStageId: 2,
          note: NOTE,
        }),
      }),
    );
    // a real SupplierNote tagged to the DESTINATION stage
    expect(mock.supplierNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ text: NOTE, stage: { connect: { name: 'Parking Lot' } } }),
      }),
    );
  });

  it('blocks Parking Lot -> Preliminary Evaluation when the supplier has no DUNS number', async () => {
    // companyInfo stays null (fakeSupplierRow default) — country/manufacturingAddress
    // are populated by the fixture, so DUNS is the only thing missing here.
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));
    await expect(
      moveSupplierToStage(asPrisma(mock), 'ps1', 'Preliminary Evaluation', NOTE, actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('allows Parking Lot -> Preliminary Evaluation once the external form data is complete', async () => {
    const row = fakeSupplierRow({
      stage: 'Parking Lot',
      companyInfo: { dunsNumber: '123456789' } as never,
    });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 3, name: 'Preliminary Evaluation' });
    mock.supplier.update.mockResolvedValue(row);
    mock.preliminaryData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.supplierNote.create.mockResolvedValue({});

    await moveSupplierToStage(asPrisma(mock), 'ps1', 'Preliminary Evaluation', NOTE, actor);

    expect(mock.preliminaryData.upsert).toHaveBeenCalledOnce();
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

  it('rejects a junk reason that used to pass the non-empty check ("na")', async () => {
    await expect(
      blacklistSupplier(asPrisma(mock), 'ps1', 'na', actor),
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
      blacklistSupplier(asPrisma(mock), 'ps1', 'Terminal completed record', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('blacklists with reason (entry + status + history)', async () => {
    const row = fakeSupplierRow({ stage: 'Preliminary Evaluation' }); // stageId = 1
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 6, name: 'Blacklisted' });
    mock.supplier.update.mockResolvedValue(row);
    mock.blacklistEntry.create.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await blacklistSupplier(asPrisma(mock), 'ps1', 'Failed the on-site audit', actor);

    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: { connect: { name: 'BLACKLISTED' } },
          stageEnteredAt: expect.any(Date),
        }),
      }),
    );
    expect(mock.blacklistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: 'Failed the on-site audit', rejectedBy: 'Ana García' }),
      }),
    );
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStageId: 1, toStageId: 6 }),
      }),
    );
  });
});

describe('B2B promotion rules (Scouting Event)', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  it('404s when the supplier does not exist', async () => {
    mock.supplier.findUnique.mockResolvedValue(null);
    await expect(
      promoteToB2B(asPrisma(mock), 'nope', actor),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects promotion of a non-active supplier', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ status: 'BLACKLISTED', stage: 'Scouting Event' }),
    );
    await expect(
      promoteToB2B(asPrisma(mock), 'ps1', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('rejects promotion outside Scouting Event', async () => {
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));
    await expect(
      promoteToB2B(asPrisma(mock), 'ps1', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('rejects promotion when already in B2B phase', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ stage: 'Scouting Event', scoutingPhase: 'B2B' }),
    );
    await expect(
      promoteToB2B(asPrisma(mock), 'ps1', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('rejects promotion when scoutingPhase is null', async () => {
    mock.supplier.findUnique.mockResolvedValue(
      fakeSupplierRow({ stage: 'Scouting Event', scoutingPhase: null }),
    );
    await expect(
      promoteToB2B(asPrisma(mock), 'ps1', actor),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(mock.supplier.update).not.toHaveBeenCalled();
  });

  it('promotes an Identified supplier to B2B (update + history, no stage change)', async () => {
    const row = fakeSupplierRow({ stage: 'Scouting Event', scoutingPhase: 'Identified' });
    mock.supplier.findUnique.mockResolvedValue(row);
    mock.supplier.update.mockResolvedValue(row);
    mock.supplierHistoryEntry.create.mockResolvedValue({});

    await promoteToB2B(asPrisma(mock), 'ps1', actor);

    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scoutingPhase: 'B2B' }) }),
    );
    // no stage connect — phase change only, stays in Scouting Event
    const updateArg = mock.supplier.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('stage');
    expect(mock.supplierHistoryEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'Promoted to B2B phase within Scouting Event' }),
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
    mock.stage.findUniqueOrThrow.mockResolvedValue({ id: 6, name: 'Blacklisted' });
    mock.supplier.update.mockResolvedValue(row);
    mock.parkingData.upsert.mockResolvedValue({});
    mock.supplierHistoryEntry.create.mockResolvedValue({});
    mock.blacklistEntry.create.mockResolvedValue({});

    await setParkingSubStatus(asPrisma(mock), 'ps1', 'No Go', actor, 'Not competitive enough');

    expect(mock.blacklistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: 'Not competitive enough' }),
      }),
    );
    expect(mock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: { connect: { name: 'BLACKLISTED' } } }),
      }),
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
