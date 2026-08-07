import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteAllNotifications,
  deleteNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifySsdTeam,
} from '../../src/services/notificationsService';
import { asPrisma, createMockPrisma, type MockPrisma } from '../helpers/mockPrisma';

describe('notificationsService', () => {
  let mock: MockPrisma;

  beforeEach(() => {
    mock = createMockPrisma();
  });

  describe('notifySsdTeam', () => {
    it('creates exactly one notification per SSD user and filters by role=SSD', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);

      await notifySsdTeam(asPrisma(mock), {
        message: 'hi', type: 'info', category: 'supplier_created', link: '/x',
      });

      // audience query is role.name === 'SSD'
      expect(mock.user.findMany).toHaveBeenCalledWith({ where: { role: { is: { name: 'SSD' } } } });
      // one row per SSD user
      const data = mock.notification.createMany.mock.calls[0][0].data as unknown[];
      expect(data).toHaveLength(3);
      expect(data.every((n: any) => n.userId && n.read === false && n.id.startsWith('notif-'))).toBe(true);
    });

    it('creates no notifications when there are no SSD users', async () => {
      mock.user.findMany.mockResolvedValue([]);
      await notifySsdTeam(asPrisma(mock), { message: 'hi', type: 'info', category: 'event_created' });
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('persists the domain category alongside — not instead of — the severity type', async () => {
      mock.user.findMany.mockResolvedValue([{ id: 's1' }]);

      await notifySsdTeam(asPrisma(mock), {
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
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', category: 'stage_advanced', read: false, link: null, createdAt: new Date(),
      });
      mock.notification.update.mockResolvedValue({
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', category: 'stage_advanced', read: true, link: null, createdAt: new Date(),
      });
      const res = await markNotificationRead(asPrisma(mock), 'n1', 'u-42');
      expect(res.read).toBe(true);
      // Without this the row would lose its icon the moment it is read.
      expect(res.category).toBe('stage_advanced');
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
