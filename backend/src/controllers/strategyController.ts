import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as strategyService from '../services/strategyService';
import * as mrlService from '../services/mrlService';
import { DEMO_USER } from '../middleware/auth';

/**
 * Only the six years strategyService maps onto needs2026…needs2031. The previous
 * open `z.record(z.string(), …)` accepted `{"2032": 10}`, answered 200 and stored
 * nothing — the user believed they had captured a need that does not exist.
 * `.strict()` makes any other key a 400.
 *
 * 2026 is the one year that may not be null: `Needs2026` is NOT NULL in the
 * database, while the other five are nullable (see schema.prisma).
 */
const needsSchema = z.object({
  strategyNeeds: z
    .object({
      '2026': z.number().int().min(0).optional(),
      '2027': z.number().int().min(0).nullable().optional(),
      '2028': z.number().int().min(0).nullable().optional(),
      '2029': z.number().int().min(0).nullable().optional(),
      '2030': z.number().int().min(0).nullable().optional(),
      '2031': z.number().int().min(0).nullable().optional(),
    })
    .strict(),
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

/**
 * CREATE additionally requires `commodity` and `buyerName`, which
 * mrlService.createMrlRequirement has always demanded by hand — the client
 * already got a 400 without them, but only the service said so. The contract
 * now states it. Kept as a separate schema rather than tightening `mrlSchema`
 * itself because UPDATE is a genuine partial patch: updateMrlRequirement writes
 * only the keys present, so requiring them there WOULD change behaviour.
 */
const mrlCreateSchema = mrlSchema.extend({
  buyerName: z.string().min(1),
  commodity: z.string().min(1),
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
          deps.prisma, req.params.id, strategyNeeds, actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const upsertEntryByCommodity: RequestHandler = async (req, res, next) => {
    try {
      const { strategyNeeds } = needsSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await strategyService.upsertStrategyEntryByCommodity(
          deps.prisma, req.params.commodity, strategyNeeds, actor,
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
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(
        await mrlService.createMrlRequirement(deps.prisma, mrlCreateSchema.parse(req.body), actor),
      );
    } catch (err) {
      next(err);
    }
  };

  const mrlUpdate: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      res.json(
        await mrlService.updateMrlRequirement(
          deps.prisma, req.params.id, mrlSchema.parse(req.body), actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const mrlRemove: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      await mrlService.deleteMrlRequirement(deps.prisma, req.params.id, actor);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { entries, updateEntry, upsertEntryByCommodity, overview, drilldown, mrlList, mrlCreate, mrlUpdate, mrlRemove };
}
