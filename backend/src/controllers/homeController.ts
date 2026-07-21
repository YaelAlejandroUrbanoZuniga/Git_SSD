import type { RequestHandler } from 'express';
import type { Deps } from '../types/deps';
import * as homeService from '../services/homeService';

export function homeController(deps: Deps) {
  const summary: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await homeService.getHomeSummary(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  return { summary };
}
