import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteAllNotifications,
  deleteNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyTeam,
  summarizeChangedFields,
} from '../../src/services/notificationsService';
import { createSupplier, updateSupplier } from '../../src/services/suppliersService';
import { updateStrategyEntry, upsertStrategyEntryByCommodity } from '../../src/services/strategyService';
import { createMrlRequirement, deleteMrlRequirement, updateMrlRequirement } from '../../src/services/mrlService';
import type { AuthUser } from '../../src/middleware/auth';
import {
  asPrisma, createMockPrisma, fakeSlaCatalog, fakeSupplierRow, type MockPrisma,
} from '../helpers/mockPrisma';

describe('notificationsService', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  describe('notifyTeam', () => {
    it('excludes the acting user from the audience query and notifies everyone else', async () => {
      // What the DB returns once the actor is filtered out by the where-clause.
      mock.user.findMany.mockResolvedValue([{ id: 'pm1' }, { id: 'buyer1' }, { id: 'sqd1' }]);

      await notifyTeam(asPrisma(mock), {
        message: 'hi', type: 'info', category: 'supplier_created_scouting', link: '/x',
        excludeUserId: 'ssd1',
      });

      // The actor is excluded in SQL, not filtered afterwards.
      expect(mock.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { is: { name: { in: ['SSD', 'PM', 'Buyer', 'SDE'] } } },
          NOT: { id: 'ssd1' },
        },
        select: { id: true },
      });
      // Exactly one row per remaining recipient — and none for the actor.
      const data = mock.notification.createMany.mock.calls[0][0].data as any[];
      expect(data).toHaveLength(3);
      expect(data.map(n => n.userId)).toEqual(['pm1', 'buyer1', 'sqd1']);
      expect(data.some(n => n.userId === 'ssd1')).toBe(false);
      expect(data.every(n => n.read === false && n.id.startsWith('notif-'))).toBe(true);
    });

    it('targets all four operational roles, not only SSD — they read the same panel', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      await notifyTeam(asPrisma(mock), { message: 'hi', type: 'info', category: 'mrl_created' });
      const { where } = mock.user.findMany.mock.calls[0][0];
      expect(where.role.is.name.in).toEqual(expect.arrayContaining(['SSD', 'PM', 'Buyer', 'SDE']));
    });

    it('never notifies Guest — they are 403\'d from the data these messages name', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      await notifyTeam(asPrisma(mock), { message: 'hi', type: 'info', category: 'mrl_created' });
      const { where } = mock.user.findMany.mock.calls[0][0];
      expect(where.role.is.name.in).not.toContain('Guest');
    });

    it('notifies everyone when there is no actor to exclude', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      await notifyTeam(asPrisma(mock), {
        message: 'hi', type: 'info', category: 'event_created', excludeUserId: null,
      });
      // No id exclusion at all when there is no actor.
      expect(mock.user.findMany.mock.calls[0][0].where).not.toHaveProperty('NOT');
      expect(mock.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
    });

    it('writes ONE row per recipient per save, whatever the save touched', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

      // A four-field supplier edit is still a single notifyTeam call…
      await notifyTeam(asPrisma(mock), {
        message: 'Itzel actualizó 4 campos de Aceros del Bajío: DUNS, País, Buyer, Website',
        type: 'info',
        category: 'supplier_updated_scouting',
        excludeUserId: 'itzel',
      });

      expect(mock.notification.createMany).toHaveBeenCalledTimes(1);
      const data = mock.notification.createMany.mock.calls[0][0].data as any[];
      // …so each recipient gets exactly one row, not one per changed field.
      expect(data).toHaveLength(2);
      expect(data.filter(n => n.userId === 'u1')).toHaveLength(1);
      expect(data.filter(n => n.userId === 'u2')).toHaveLength(1);
    });

    it('creates no notifications when the actor is the only user', async () => {
      mock.user.findMany.mockResolvedValue([]);
      await notifyTeam(asPrisma(mock), {
        message: 'hi', type: 'info', category: 'event_created', excludeUserId: 'solo',
      });
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('persists the domain category alongside — not instead of — the severity type', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 's1' }]);

      await notifyTeam(asPrisma(mock), {
        message: 'X fue movido a Blacklisted: dup',
        type: 'warning',
        category: 'blacklisted',
        link: '/tracker/blacklisted/supplier/ps1',
      });

      const [row] = mock.notification.createMany.mock.calls[0][0].data as any[];
      expect(row.category).toBe('blacklisted');
      expect(row.type).toBe('warning'); // severity is untouched by the category
      expect(row.message).toBe('X fue movido a Blacklisted: dup');
    });

    it('trims a long message/link to the column limits instead of failing the insert', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 's1' }]);

      await notifyTeam(asPrisma(mock), {
        message: 'x'.repeat(700),
        type: 'info',
        category: 'supplier_updated_scouting',
        link: `/suppliers/supplier/${'y'.repeat(400)}`,
      });

      const [row] = mock.notification.createMany.mock.calls[0][0].data as any[];
      expect(row.message).toHaveLength(500); // NVarChar(500)
      expect(row.link).toHaveLength(300);    // NVarChar(300)
    });
  });

  describe('summarizeChangedFields', () => {
    it('lists the changed fields as-is while they fit', () => {
      expect(summarizeChangedFields(['DUNS', 'País', 'Buyer', 'Website']))
        .toBe('DUNS, País, Buyer, Website');
    });

    it('caps the list and counts the rest, so a 30-field save still fits Message', () => {
      const labels = Array.from({ length: 12 }, (_, i) => `Campo ${i + 1}`);
      expect(summarizeChangedFields(labels)).toBe(
        'Campo 1, Campo 2, Campo 3, Campo 4, Campo 5, Campo 6, Campo 7, Campo 8 y 4 más',
      );
    });
  });

  describe('listNotifications', () => {
    it('scopes the query to the requested userId only', async () => {
      mock.notification.findMany.mockResolvedValue([
        { id: 'n1', message: 'm', type: 'info', category: null, read: false, link: null, createdAt: new Date() },
      ]);
      const rows = await listNotifications(asPrisma(mock), 'u-42');
      expect(mock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-42' } }),
      );
      expect(rows).toHaveLength(1);
    });

    it('returns the stored category, and null for rows written before the column existed', async () => {
      const createdAt = new Date('2026-08-06T12:00:00.000Z');
      mock.notification.findMany.mockResolvedValue([
        { id: 'n1', message: 'nuevo evento', type: 'info', category: 'event_created', read: false, link: '/events/e1', createdAt },
        { id: 'n0', message: 'legacy', type: 'info', category: null, read: true, link: null, createdAt },
      ]);
      const rows = await listNotifications(asPrisma(mock), 'u-42');
      expect(rows[0]).toMatchObject({ category: 'event_created', type: 'info' });
      // Pre-category rows must still come back (and render off the severity).
      expect(rows[1]).toMatchObject({ category: null, type: 'info' });
      // The panel's "last 7 days" filter needs a real instant, not the label.
      expect(rows[0].createdAt).toBe(createdAt.toISOString());
    });
  });

  describe('markAllNotificationsRead', () => {
    it('only marks the requesting user\'s unread notifications (never another user\'s)', async () => {
      mock.notification.updateMany.mockResolvedValue({ count: 2 });
      await markAllNotificationsRead(asPrisma(mock), 'u-42');
      expect(mock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-42', read: false },
        data: { read: true },
      });
    });
  });

  describe('markNotificationRead', () => {
    it('marks a notification the user owns, and echoes its category back', async () => {
      mock.notification.findUnique.mockResolvedValue({
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', category: 'stage_advanced_parking', read: false, link: null, createdAt: new Date(),
      });
      mock.notification.update.mockResolvedValue({
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', category: 'stage_advanced_parking', read: true, link: null, createdAt: new Date(),
      });
      const res = await markNotificationRead(asPrisma(mock), 'n1', 'u-42');
      expect(res.read).toBe(true);
      // Without this the row would lose its icon the moment it is read.
      expect(res.category).toBe('stage_advanced_parking');
    });

    it('throws 404 for a notification owned by another user (without revealing it exists)', async () => {
      mock.notification.findUnique.mockResolvedValue({
        id: 'n1', userId: 'someone-else', message: 'm', type: 'info', read: false, link: null, createdAt: new Date(),
      });
      await expect(markNotificationRead(asPrisma(mock), 'n1', 'u-42')).rejects.toMatchObject({ status: 404 });
      expect(mock.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteNotifications', () => {
    it('deletes the ids the user owns, scoping the delete by userId too', async () => {
      mock.notification.findMany.mockResolvedValue([
        { id: 'n1', userId: 'u-42' },
        { id: 'n2', userId: 'u-42' },
      ]);
      mock.notification.deleteMany.mockResolvedValue({ count: 2 });

      const res = await deleteNotifications(asPrisma(mock), ['n1', 'n2'], 'u-42');

      expect(res).toEqual({ deleted: 2 });
      expect(mock.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['n1', 'n2'] }, userId: 'u-42' },
      });
    });

    it('throws 404 for another user\'s notification (without revealing it exists)', async () => {
      mock.notification.findMany.mockResolvedValue([{ id: 'n1', userId: 'someone-else' }]);
      await expect(deleteNotifications(asPrisma(mock), ['n1'], 'u-42')).rejects.toMatchObject({ status: 404 });
      expect(mock.notification.deleteMany).not.toHaveBeenCalled();
    });

    it('throws the same 404 for an id that does not exist at all', async () => {
      mock.notification.findMany.mockResolvedValue([]);
      await expect(deleteNotifications(asPrisma(mock), ['ghost'], 'u-42')).rejects.toMatchObject({ status: 404 });
      expect(mock.notification.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes nothing when ONE id of a batch belongs to another user', async () => {
      mock.notification.findMany.mockResolvedValue([
        { id: 'n1', userId: 'u-42' },
        { id: 'n2', userId: 'someone-else' },
      ]);
      await expect(deleteNotifications(asPrisma(mock), ['n1', 'n2'], 'u-42')).rejects.toMatchObject({ status: 404 });
      expect(mock.notification.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects an empty selection as a 400 rather than deleting everything', async () => {
      await expect(deleteNotifications(asPrisma(mock), [], 'u-42')).rejects.toMatchObject({ status: 400 });
      expect(mock.notification.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllNotifications', () => {
    it('only deletes the requesting user\'s rows (never another user\'s)', async () => {
      mock.notification.deleteMany.mockResolvedValue({ count: 5 });
      const res = await deleteAllNotifications(asPrisma(mock), 'u-42');
      expect(mock.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-42' } });
      expect(res).toEqual({ deleted: 5 });
    });
  });
});

// ── The write paths that fan out ────────────────────────────────────────────
// One notification per SAVE (never per field), the actor always excluded.
describe('domain events that notify', () => {
  const actor: AuthUser = {
    id: 'u-itzel', username: 'itzel.ramirez', displayName: 'Itzel', role: 'SSD',
  };
  let mock: MockPrisma;

  /** The two other accounts the fan-out reaches once the actor is filtered out. */
  function stubRecipients() {
    mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }, { id: 'u-buyer' }]);
  }

  /** Rows written by the single createMany the save is allowed to issue. */
  function notifiedRows(): any[] {
    expect(mock.notification.createMany).toHaveBeenCalledTimes(1);
    return mock.notification.createMany.mock.calls[0][0].data as any[];
  }

  beforeEach(() => {
    mock = createMockPrisma();
    stubRecipients();
  });

  // The panel colours a notification with the stage's own colour/icon, so a
  // creation has to say WHICH stage the supplier was born in — Form B lands in
  // Parking Lot (yellow/pause), Form A in Scouting Event (blue/binoculars).
  describe('suppliersService.createSupplier', () => {
    beforeEach(() => {
      mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
      mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
      mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
      mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
      mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
      mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
      mock.supplier.findFirst.mockResolvedValue(null); // next folio
      mock.supplier.create.mockResolvedValue({});
    });

    it('an internal recommendation notifies as supplier_created_parking', async () => {
      mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Parking Lot' }));

      await createSupplier(
        asPrisma(mock),
        { name: 'Recomendada', commodity: 'Machining', entrySource: 'Recommendation' },
        actor,
      );

      expect(notifiedRows()[0].category).toBe('supplier_created_parking');
    });

    it('a registration from an event notifies as supplier_created_scouting', async () => {
      mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage: 'Scouting Event' }));

      await createSupplier(
        asPrisma(mock),
        { name: 'ACME', commodity: 'Machining', entrySource: 'Scouting Event' },
        actor,
      );

      expect(notifiedRows()[0].category).toBe('supplier_created_scouting');
    });
  });

  describe('suppliersService.updateSupplier', () => {
    beforeEach(() => {
      mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
      mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
      mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
      mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
      mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
      mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    });

    it('a four-field edit is ONE notification per recipient, not four', async () => {
      await updateSupplier(
        asPrisma(mock), 'ps1',
        { dunsNumber: '123456789', country: 'México', buyer: 'Ana García', website: 'x.com' },
        actor,
      );

      const rows = notifiedRows();
      expect(rows).toHaveLength(2); // one each for u-pm / u-buyer — not 4 × 2
      expect(rows[0].category).toBe('supplier_updated_scouting');
      // The single message names every field the save touched.
      expect(rows[0].message).toBe(
        'Itzel actualizó 4 campos de TEST SUPPLIER: DUNS, País, Buyer, Website',
      );
    });

    it('excludes the editor — they never see their own edit', async () => {
      await updateSupplier(asPrisma(mock), 'ps1', { country: 'México' }, actor);

      expect(mock.user.findMany.mock.calls[0][0].where).toMatchObject({ NOT: { id: 'u-itzel' } });
      expect(notifiedRows().some(n => n.userId === 'u-itzel')).toBe(false);
    });

    it('says "1 campo" in the singular', async () => {
      await updateSupplier(asPrisma(mock), 'ps1', { country: 'México' }, actor);
      expect(notifiedRows()[0].message).toContain('actualizó 1 campo de');
    });

    it('names the supplier as it is AFTER a rename in the same save', async () => {
      await updateSupplier(asPrisma(mock), 'ps1', { name: 'ACEROS DEL BAJÍO' }, actor);
      expect(notifiedRows()[0].message).toContain('de ACEROS DEL BAJÍO: Nombre');
    });

    it('does not notify for an empty patch (nothing was written)', async () => {
      await updateSupplier(asPrisma(mock), 'ps1', {}, actor);
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('does not notify for a patch of server-owned Intelex fields only (all dropped)', async () => {
      await updateSupplier(asPrisma(mock), 'ps1', { intelex_currentLevel: 'L4' }, actor);
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    // An edit is coloured by where the supplier IS, not by "a supplier changed":
    // editing a Parking Lot record must read as Parking Lot in the panel.
    const byStage: Array<[string, string]> = [
      ['Scouting Event', 'supplier_updated_scouting'],
      ['Parking Lot', 'supplier_updated_parking'],
      ['Preliminary Evaluation', 'supplier_updated_preliminary'],
      ['Supplier Evaluation', 'supplier_updated_supplier_eval'],
      ['Intelex Handoff', 'supplier_updated_intelex'],
    ];

    for (const [stage, category] of byStage) {
      it(`an edit while in ${stage} notifies as ${category}`, async () => {
        mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow({ stage }));
        await updateSupplier(asPrisma(mock), 'ps1', { country: 'México' }, actor);
        expect(notifiedRows()[0].category).toBe(category);
      });
    }

    it('falls back to supplier_updated_scouting for a closed record (Completed)', async () => {
      // Completed and Blacklisted have left the board, so no stage colour would
      // mean anything — the neutral first-stage styling is the documented fallback.
      mock.supplier.findUnique.mockResolvedValue(
        fakeSupplierRow({ stage: 'Completed', status: 'COMPLETED' }),
      );
      await updateSupplier(asPrisma(mock), 'ps1', { country: 'México' }, actor);
      expect(notifiedRows()[0].category).toBe('supplier_updated_scouting');
    });
  });

  describe('strategyService', () => {
    it('notifies on an inline entry edit, naming the commodity and the years', async () => {
      mock.strategyEntry.findUnique.mockResolvedValue({ id: 'strat-1' });
      mock.strategyEntry.update.mockResolvedValue({ commodity: { name: 'Machining' } });

      await updateStrategyEntry(asPrisma(mock), 'strat-1', { '2026': 15, '2027': 8 }, actor);

      const rows = notifiedRows();
      expect(rows).toHaveLength(2);
      expect(rows[0].category).toBe('strategy_updated');
      expect(rows[0].message).toBe(
        'Itzel actualizó la estrategia de Machining: necesidad 2026 → 15, necesidad 2027 → 8',
      );
      expect(rows.some(n => n.userId === 'u-itzel')).toBe(false);
    });

    it('notifies on the by-commodity upsert too', async () => {
      mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
      mock.strategyEntry.upsert.mockResolvedValue({ commodity: { name: 'Machining' } });

      await upsertStrategyEntryByCommodity(asPrisma(mock), 'Machining', { '2026': 20 }, actor);

      expect(notifiedRows()[0].message).toBe(
        'Itzel actualizó la estrategia de Machining: necesidad 2026 → 20',
      );
    });

    it('does not notify when the save sets no year at all', async () => {
      mock.strategyEntry.findUnique.mockResolvedValue({ id: 'strat-1' });
      mock.strategyEntry.update.mockResolvedValue({ commodity: { name: 'Machining' } });

      await updateStrategyEntry(asPrisma(mock), 'strat-1', {}, actor);
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('mrlService', () => {
    const mrlRow = {
      id: 'mrl-1', buyerName: 'Ana García', commodity: { name: 'Machining' },
      partNumber: 'P-12345', partDescription: 'Housing',
    };

    it('notifies every other user when a requirement is created', async () => {
      mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
      mock.mrlRequirement.create.mockResolvedValue(mrlRow);

      await createMrlRequirement(
        asPrisma(mock), { commodity: 'Machining', buyerName: 'Ana García' }, actor,
      );

      const rows = notifiedRows();
      expect(rows).toHaveLength(2);
      expect(rows[0].category).toBe('mrl_created');
      expect(rows[0].message).toBe(
        'Itzel creó un requerimiento MRL: Machining · P-12345 (Ana García)',
      );
      expect(rows.some(n => n.userId === 'u-itzel')).toBe(false);
    });

    it('a multi-field edit is ONE notification listing the fields (volumes by year)', async () => {
      mock.mrlRequirement.findUnique.mockResolvedValue({ id: 'mrl-1' });
      mock.mrlRequirement.update.mockResolvedValue(mrlRow);

      await updateMrlRequirement(
        asPrisma(mock), 'mrl-1',
        { targetPrice: 12.5, volumeByYear: { '2026': 100, '2027': 200 } },
        actor,
      );

      const rows = notifiedRows();
      expect(rows).toHaveLength(2);
      expect(rows[0].category).toBe('mrl_updated');
      expect(rows[0].message).toContain('actualizó 3 campos del requerimiento MRL');
      expect(rows[0].message).toContain('Target price, Volumen 2026, Volumen 2027');
    });

    it('does not notify when the MRL patch carries no field', async () => {
      mock.mrlRequirement.findUnique.mockResolvedValue({ id: 'mrl-1' });
      mock.mrlRequirement.update.mockResolvedValue(mrlRow);

      await updateMrlRequirement(asPrisma(mock), 'mrl-1', {}, actor);
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('notifies on delete, as a warning, linking to the list (the row is gone)', async () => {
      mock.mrlRequirement.findUnique.mockResolvedValue(mrlRow);

      await deleteMrlRequirement(asPrisma(mock), 'mrl-1', actor);

      const rows = notifiedRows();
      expect(rows[0].category).toBe('mrl_deleted');
      expect(rows[0].type).toBe('warning');
      expect(rows[0].link).toBe('/strategy/mrl');
      expect(rows[0].message).toBe(
        'Itzel eliminó el requerimiento MRL: Machining · P-12345 (Ana García)',
      );
    });
  });
});
