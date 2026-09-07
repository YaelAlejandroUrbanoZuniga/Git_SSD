import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as reportsService from '../services/reportsService';
import { ValidationError } from '../domain/errors';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');
// Query params arrive as strings — coerce commodityId to a positive int.
const commodityIdParam = z.coerce.number().int().positive().optional();

const weeklySchema = z.object({
  from: dateStr,
  to: dateStr,
  commodityId: commodityIdParam,
});
const latestSchema = z.object({ commodityId: commodityIdParam });
// Caps at 50 to prevent abuse; defaults to 15 when omitted.
const recentActivitySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(15),
});

export function reportsController(deps: Deps) {
  const weekly: RequestHandler = async (req, res, next) => {
    try {
      const { from, to, commodityId } = weeklySchema.parse(req.query);
      if (from > to) {
        // 'YYYY-MM-DD' compares lexicographically = chronologically.
        throw new ValidationError('`from` must be on or before `to`');
      }
      res.json(await reportsService.getWeeklyDiff(deps.prisma, from, to, commodityId));
    } catch (err) {
      next(err);
    }
  };

  const latest: RequestHandler = async (req, res, next) => {
    try {
      const { commodityId } = latestSchema.parse(req.query);
      res.json(await reportsService.getLatestWeeklyDiff(deps.prisma, commodityId));
    } catch (err) {
      next(err);
    }
  };

  const commodities: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await reportsService.listReportCommodities(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const recentActivity: RequestHandler = async (req, res, next) => {
    try {
      const { limit } = recentActivitySchema.parse(req.query);
      res.json(await reportsService.getRecentActivity(deps.prisma, limit));
    } catch (err) {
      next(err);
    }
  };

  return { weekly, latest, commodities, recentActivity };
}
