import { beforeEach, describe, expect, it } from 'vitest';
import {
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

      await notifySsdTeam(asPrisma(mock), { message: 'hi', type: 'info', link: '/x' });

      // audience query is role.name === 'SSD'
      expect(mock.user.findMany).toHaveBeenCalledWith({ where: { role: { is: { name: 'SSD' } } } });
      // one row per SSD user
      const data = mock.notification.createMany.mock.calls[0][0].data as unknown[];
      expect(data).toHaveLength(3);
      expect(data.every((n: any) => n.userId && n.read === false && n.id.startsWith('notif-'))).toBe(true);
    });

    it('creates no notifications when there are no SSD users', async () => {
      mock.user.findMany.mockResolvedValue([]);
      await notifySsdTeam(asPrisma(mock), { message: 'hi', type: 'info' });
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listNotifications', () => {
    it('scopes the query to the requested userId only', async () => {
      mock.notification.findMany.mockResolvedValue([
        { id: 'n1', message: 'm', type: 'info', read: false, link: null, createdAt: new Date() },
      ]);
      const rows = await listNotifications(asPrisma(mock), 'u-42');
      expect(mock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-42' } }),
      );
      expect(rows).toHaveLength(1);
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
    it('marks a notification the user owns', async () => {
      mock.notification.findUnique.mockResolvedValue({
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', read: false, link: null, createdAt: new Date(),
      });
      mock.notification.update.mockResolvedValue({
        id: 'n1', userId: 'u-42', message: 'm', type: 'info', read: true, link: null, createdAt: new Date(),
      });
      const res = await markNotificationRead(asPrisma(mock), 'n1', 'u-42');
      expect(res.read).toBe(true);
    });

    it('throws 404 for a notification owned by another user (without revealing it exists)', async () => {
      mock.notification.findUnique.mockResolvedValue({
        id: 'n1', userId: 'someone-else', message: 'm', type: 'info', read: false, link: null, createdAt: new Date(),
      });
      await expect(markNotificationRead(asPrisma(mock), 'n1', 'u-42')).rejects.toMatchObject({ status: 404 });
      expect(mock.notification.update).not.toHaveBeenCalled();
    });
  });
});
