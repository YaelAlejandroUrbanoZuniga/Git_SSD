import { beforeEach, describe, expect, it } from 'vitest';
import { importProspects } from '../../src/services/eventProspectsService';
import { ValidationError } from '../../src/domain/errors';
import type { AuthUser } from '../../src/middleware/auth';
import { asPrisma, createMockPrisma, type MockPrisma } from '../helpers/mockPrisma';

const ssd: AuthUser = { id: 'u1', username: 'ssd.user', displayName: 'SSD User', role: 'SSD' };

const fakeEvent = { id: 'ev1', dateStart: '2026-09-01' };

describe('importProspects — batched DB access', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
    mock.event.findUnique.mockResolvedValue(fakeEvent);
  });

  it('resolves creates vs. updates with a single findMany, not one findUnique per row', async () => {
    mock.eventProspect.findMany.mockResolvedValueOnce([
      { id: 10, companyName: 'Acme Corp' },
    ]);
    mock.eventProspect.findMany.mockResolvedValueOnce([]); // final re-read for the response

    const result = await importProspects(
      asPrisma(mock),
      'ev1',
      [
        { companyName: 'Acme Corp', productType: 'Machining', website: 'acme.com' },
        { companyName: 'Beta Inc', productType: 'Casting', website: null },
      ],
      ssd,
      { sourceFileName: 'list.xlsx' },
    );

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);

    // Never falls back to a per-row lookup.
    expect(mock.eventProspect.findUnique).not.toHaveBeenCalled();
    // Exactly one findMany to resolve existing rows, one to build the response.
    expect(mock.eventProspect.findMany).toHaveBeenCalledTimes(2);
    // One create() and one update() call — no loop of awaited round trips —
    // both went through the batched $transaction.
    expect(mock.eventProspect.create).not.toHaveBeenCalled();
    expect(mock.eventProspect.createMany).toHaveBeenCalledOnce();
    expect(mock.eventProspect.update).toHaveBeenCalledOnce();
    expect(mock.$transaction).toHaveBeenCalledOnce();
  });

  it('matches an existing company case-insensitively, same as the DB unique index', async () => {
    mock.eventProspect.findMany.mockResolvedValueOnce([{ id: 5, companyName: 'acme corp' }]);
    mock.eventProspect.findMany.mockResolvedValueOnce([]);

    const result = await importProspects(
      asPrisma(mock),
      'ev1',
      [{ companyName: 'ACME CORP', productType: null, website: null }],
      ssd,
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(mock.eventProspect.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
  });

  it('never touches interested*/b2b* fields on an existing prospect', async () => {
    mock.eventProspect.findMany.mockResolvedValueOnce([{ id: 7, companyName: 'Beta Inc' }]);
    mock.eventProspect.findMany.mockResolvedValueOnce([]);

    await importProspects(
      asPrisma(mock),
      'ev1',
      [{ companyName: 'Beta Inc', productType: 'Casting', website: null }],
      ssd,
    );

    const updateCall = mock.eventProspect.update.mock.calls[0][0];
    const dataKeys = Object.keys(updateCall.data);
    for (const forbidden of ['interestedBy', 'interestedById', 'interestedAt', 'b2bScheduled', 'b2bDateTime', 'b2bLocation', 'b2bSetBy', 'b2bSetAt']) {
      expect(dataKeys).not.toContain(forbidden);
    }
  });

  it('does not blank out productType/website on a thinner re-import', async () => {
    mock.eventProspect.findMany.mockResolvedValueOnce([{ id: 9, companyName: 'Gamma LLC' }]);
    mock.eventProspect.findMany.mockResolvedValueOnce([]);

    await importProspects(
      asPrisma(mock),
      'ev1',
      [{ companyName: 'Gamma LLC', productType: null, website: null }],
      ssd,
    );

    const updateCall = mock.eventProspect.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('productType');
    expect(updateCall.data).not.toHaveProperty('website');
  });

  it('still rejects an empty or all-blank file before touching the database', async () => {
    await expect(importProspects(asPrisma(mock), 'ev1', [], ssd)).rejects.toBeInstanceOf(ValidationError);
    expect(mock.eventProspect.findMany).not.toHaveBeenCalled();

    await expect(
      importProspects(asPrisma(mock), 'ev1', [{ companyName: '   ' }], ssd),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
