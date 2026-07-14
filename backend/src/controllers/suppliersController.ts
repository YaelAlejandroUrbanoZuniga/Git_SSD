import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as suppliersService from '../services/suppliersService';
import * as notesService from '../services/notesService';
import { DEMO_USER } from '../middleware/auth';

const createSchema = z.object({
  name: z.string().min(1),
  commodity: z.string().min(1),
  entrySource: z.enum(['Scouting Event', 'Recommendation']),
  productCategory: z.enum(['Direct', 'Indirect']).optional(),
  productType: z.string().optional(),
  country: z.string().optional(),
  manufacturingAddress: z.string().optional(),
  buyer: z.string().optional(),
  scoutingInput: z.string().optional(),
  recommendedBy: z.string().optional(),
  recommenderDept: z.string().optional(),
  fullName: z.string().optional(),
  dunsNumber: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  contactEmail: z.string().optional(),
  contactName: z.string().optional(),
});

const noteSchema = z.object({ text: z.string().min(1) });

export function suppliersController(deps: Deps) {
  const list: RequestHandler = async (req, res, next) => {
    try {
      res.json(
        await suppliersService.listSuppliers(deps.prisma, {
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          stage: typeof req.query.stage === 'string' ? req.query.stage : undefined,
          commodity: typeof req.query.commodity === 'string' ? req.query.commodity : undefined,
          country: typeof req.query.country === 'string' ? req.query.country : undefined,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
        }),
      );
    } catch (err) {
      next(err);
    }
  };

  const listTracker: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'ACTIVE'));
    } catch (err) {
      next(err);
    }
  };

  const listBlacklisted: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'BLACKLISTED'));
    } catch (err) {
      next(err);
    }
  };

  const listCompleted: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await suppliersService.listByStatus(deps.prisma, 'COMPLETED'));
    } catch (err) {
      next(err);
    }
  };

  const detail: RequestHandler = async (req, res, next) => {
    try {
      res.json(await suppliersService.getSupplierById(deps.prisma, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  const create: RequestHandler = async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(await suppliersService.createSupplier(deps.prisma, input, actor));
    } catch (err) {
      next(err);
    }
  };

  const update: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      res.json(
        await suppliersService.updateSupplier(
          deps.prisma,
          req.params.id,
          req.body as Record<string, unknown>,
          actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const remove: RequestHandler = async (req, res, next) => {
    try {
      await suppliersService.deleteSupplier(deps.prisma, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  // Notes (stage-tagged, author-owned)
  const addNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(await notesService.addSupplierNote(deps.prisma, req.params.id, text, actor));
    } catch (err) {
      next(err);
    }
  };

  const editNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await notesService.updateSupplierNote(
          deps.prisma, req.params.id, req.params.noteId, text, actor,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  const removeNote: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      await notesService.deleteSupplierNote(deps.prisma, req.params.id, req.params.noteId, actor);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return {
    list, listTracker, listBlacklisted, listCompleted, detail,
    create, update, remove, addNote, editNote, removeNote,
  };
}
