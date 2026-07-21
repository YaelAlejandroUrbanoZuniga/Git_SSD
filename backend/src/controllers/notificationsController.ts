import type { RequestHandler } from 'express';
import type { Deps } from '../types/deps';
import * as notificationsService from '../services/notificationsService';
import { DEMO_USER } from '../middleware/auth';

export function notificationsController(deps: Deps) {
  const list: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      res.json(await notificationsService.listNotifications(deps.prisma, userId));
    } catch (err) {
      next(err);
    }
  };

  const markRead: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      res.json(await notificationsService.markNotificationRead(deps.prisma, req.params.id, userId));
    } catch (err) {
      next(err);
    }
  };

  const markAllRead: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      await notificationsService.markAllNotificationsRead(deps.prisma, userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { list, markRead, markAllRead };
}
