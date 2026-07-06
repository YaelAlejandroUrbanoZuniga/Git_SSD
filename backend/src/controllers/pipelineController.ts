import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as pipelineService from '../services/pipelineService';
import { DEMO_USER } from '../middleware/auth';

const moveSchema = z.object({ newStage: z.string().min(1) });
const blacklistSchema = z.object({ reason: z.string().optional() });
const subStatusSchema = z.object({
  subStatus: z.string().min(1),
  reason: z.string().optional(),
});

export function pipelineController(deps: Deps) {
  const stageConfig: RequestHandler = (_req, res) => {
    res.json(pipelineService.getStageConfig());
  };

  const list: RequestHandler = async (req, res, next) => {
    try {
      const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
      res.json(await pipelineService.listByStage(deps.prisma, stage));
    } catch (err) {
      next(err);
    }
  };

  const detail: RequestHandler = async (req, res, next) => {
    try {
      res.json(await pipelineService.getPipelineSupplier(deps.prisma, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  const move: RequestHandler = async (req, res, next) => {
    try {
      const { newStage } = moveSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(await pipelineService.moveSupplierToStage(deps.prisma, req.params.id, newStage, actor));
    } catch (err) {
      next(err);
    }
  };

  const blacklist: RequestHandler = async (req, res, next) => {
    try {
      const { reason } = blacklistSchema.parse(req.body ?? {});
      const actor = req.user ?? DEMO_USER;
      res.json(await pipelineService.blacklistSupplier(deps.prisma, req.params.id, reason, actor));
    } catch (err) {
      next(err);
    }
  };

  const subStatus: RequestHandler = async (req, res, next) => {
    try {
      const { subStatus: value, reason } = subStatusSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await pipelineService.setParkingSubStatus(deps.prisma, req.params.id, value, actor, reason),
      );
    } catch (err) {
      next(err);
    }
  };

  return { stageConfig, list, detail, move, blacklist, subStatus };
}
