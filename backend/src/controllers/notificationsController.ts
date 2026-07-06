import type { RequestHandler } from 'express';
import type { Deps } from '../types/deps';
import * as notificationsService from '../services/notificationsService';

export function notificationsController(deps: Deps) {
  const list: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await notificationsService.listNotifications(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const markRead: RequestHandler = async (req, res, next) => {
    try {
      res.json(await notificationsService.markNotificationRead(deps.prisma, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  const markAllRead: RequestHandler = async (_req, res, next) => {
    try {
      await notificationsService.markAllNotificationsRead(deps.prisma);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { list, markRead, markAllRead };
}
