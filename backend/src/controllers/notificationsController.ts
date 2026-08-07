import type { RequestHandler } from 'express';
import type { Deps } from '../types/deps';
import * as notificationsService from '../services/notificationsService';
import { DEMO_USER } from '../middleware/auth';
import { ValidationError } from '../domain/errors';

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

  /** Delete one — 404 when the notification is not the caller's. */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      await notificationsService.deleteNotifications(deps.prisma, [req.params.id], userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  /** Delete a selection — `{ ids: string[] }`. A POST (not DELETE) because the
   *  id list is a body, and DELETE-with-body is not portable across proxies. */
  const removeMany: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      const raw = (req.body as { ids?: unknown })?.ids;
      const ids = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
      if (ids.length === 0 || (Array.isArray(raw) && ids.length !== raw.length)) {
        throw new ValidationError('ids must be a non-empty array of notification ids');
      }
      await notificationsService.deleteNotifications(deps.prisma, ids, userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  /** Delete every notification the caller owns. */
  const removeAll: RequestHandler = async (req, res, next) => {
    try {
      const userId = (req.user ?? DEMO_USER).id;
      await notificationsService.deleteAllNotifications(deps.prisma, userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { list, markRead, markAllRead, remove, removeMany, removeAll };
}
