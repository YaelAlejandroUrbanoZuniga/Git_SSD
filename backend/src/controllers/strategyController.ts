import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as strategyService from '../services/strategyService';
import * as mrlService from '../services/mrlService';
import { DEMO_USER } from '../middleware/auth';

const needsSchema = z.object({
  strategyNeeds: z.record(z.string(), z.number().int().min(0).nullable()),
});

const mrlSchema = z.object({
  buyerName: z.string().optional(),
  commodity: z.string().optional(),
  nexteerProductLine: z.string().optional(),
  volumeByYear: z.record(z.string(), z.number().nullable()).optional(),
  partNumber: z.string().optional(),
  partDescription: z.string().optional(),
  mainMaterialsSpecTech: z.string().optional(),
  peakVolume: z.number().nullable().optional(),
  program: z.string().optional(),
  eop: z.string().optional(),
  targetPrice: z.number().nullable().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  primaryDriver: z.string().optional(),
  keyManufacturingCapabilities: z.string().optional(),
  safetyCriticalPart: z.boolean().optional(),
  supplierExperienceInSafetyRequired: z.boolean().optional(),
  certifications: z.string().optional(),
  knowsCQIs: z.boolean().optional(),
});

export function strategyController(deps: Deps) {
  const entries: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await strategyService.getStrategyEntries(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const updateEntry: RequestHandler = async (req, res, next) => {
    try {
      const { strategyNeeds } = needsSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await strategyService.updateStrategyEntry(
          deps.prisma, req.params.id, strategyNeeds, actor.displayName,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const overview: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await strategyService.getStrategyOverview(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const drilldown: RequestHandler = async (req, res, next) => {
    try {
      res.json(await strategyService.getCommodityDrilldown(deps.prisma, req.params.commodity));
    } catch (err) {
      next(err);
    }
  };

  // ── MRL ────────────────────────────────────────────────────────────
  const mrlList: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await mrlService.getMrlRequirements(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const mrlCreate: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await mrlService.createMrlRequirement(deps.prisma, mrlSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  };

  const mrlUpdate: RequestHandler = async (req, res, next) => {
    try {
      res.json(
        await mrlService.updateMrlRequirement(deps.prisma, req.params.id, mrlSchema.parse(req.body)),
      );
    } catch (err) {
      next(err);
    }
  };

  const mrlRemove: RequestHandler = async (req, res, next) => {
    try {
      await mrlService.deleteMrlRequirement(deps.prisma, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { entries, updateEntry, overview, drilldown, mrlList, mrlCreate, mrlUpdate, mrlRemove };
}
