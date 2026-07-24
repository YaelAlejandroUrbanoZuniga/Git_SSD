import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as eventsService from '../services/eventsService';
import * as notesService from '../services/notesService';
import { DEMO_USER } from '../middleware/auth';

const eventSchema = z.object({
  name: z.string().min(1),
  dateStart: z.string().min(1),
  dateEnd: z.string().min(1),
  location: z.string().min(1),
  // organizer, topCountry, description and objective are captured manually in the
  // system after the event is created (not from the Excel import), so an empty
  // string is a valid value at creation — they are not required here. The columns
  // stay NOT NULL in the DB; '' satisfies them.
  organizer: z.string(),
  contactName: z.string().nullish(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  status: z.enum(['Upcoming', 'Ongoing', 'Completed', 'Canceled']),
  description: z.string().optional(),
  type: z.enum(['Direct', 'Indirect']),
  objective: z.string().optional(),
  topCountry: z.string().optional(),
});

const eventPatchSchema = eventSchema.partial();

const addSupplierSchema = z.object({
  name: z.string().min(1),
  commodity: z.string().min(1),
  productCategory: z.enum(['Direct', 'Indirect']).optional(),
  productType: z.string().optional(),
  country: z.string().optional(),
  manufacturingAddress: z.string().optional(),
  buyer: z.string().optional(),
  fullName: z.string().optional(),
  dunsNumber: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  contactEmail: z.string().optional(),
  contactName: z.string().optional(),
  b2bMeeting: z.boolean().optional(),
  status: z.enum(['Accepted', 'Rejected', 'Cancelled']).optional(),
  result: z.enum(['Included', 'Not Included']).optional(),
});

const linkSupplierSchema = z.object({
  supplierId: z.string().min(1),
  b2bMeeting: z.boolean().optional(),
  status: z.enum(['Accepted', 'Rejected', 'Cancelled']).optional(),
  result: z.enum(['Included', 'Not Included']).optional(),
});

const noteSchema = z.object({ text: z.string().min(1) });

export function eventsController(deps: Deps) {
  const list: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await eventsService.listEvents(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const detail: RequestHandler = async (req, res, next) => {
    try {
      res.json(await eventsService.getEventById(deps.prisma, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  const create: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await eventsService.createEvent(
        deps.prisma, eventSchema.parse(req.body), req.user, req.requestId,
      ));
    } catch (err) {
      next(err);
    }
  };

  const update: RequestHandler = async (req, res, next) => {
    try {
      res.json(
        await eventsService.updateEvent(deps.prisma, req.params.id, eventPatchSchema.parse(req.body)),
      );
    } catch (err) {
      next(err);
    }
  };

  const remove: RequestHandler = async (req, res, next) => {
    try {
      await eventsService.deleteEvent(deps.prisma, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  /** Form A — create a NEW supplier from the event registration form. */
  const addSupplier: RequestHandler = async (req, res, next) => {
    try {
      const input = addSupplierSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res
        .status(201)
        .json(await eventsService.addSupplierToEvent(deps.prisma, req.params.id, input, actor));
    } catch (err) {
      next(err);
    }
  };

  /** Link an existing supplier to the event. */
  const linkSupplier: RequestHandler = async (req, res, next) => {
    try {
      const { supplierId, ...entry } = linkSupplierSchema.parse(req.body);
      res.json(await eventsService.linkSupplierToEvent(deps.prisma, req.params.id, supplierId, entry));
    } catch (err) {
      next(err);
    }
  };

  const addNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.status(201).json(await notesService.addEventNote(deps.prisma, req.params.id, text, actor));
    } catch (err) {
      next(err);
    }
  };

  const editNote: RequestHandler = async (req, res, next) => {
    try {
      const { text } = noteSchema.parse(req.body);
      const actor = req.user ?? DEMO_USER;
      res.json(
        await notesService.updateEventNote(deps.prisma, req.params.id, req.params.noteId, text, actor),
      );
    } catch (err) {
      next(err);
    }
  };

  const removeNote: RequestHandler = async (req, res, next) => {
    try {
      const actor = req.user ?? DEMO_USER;
      await notesService.deleteEventNote(deps.prisma, req.params.id, req.params.noteId, actor);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { list, detail, create, update, remove, addSupplier, linkSupplier, addNote, editNote, removeNote };
}
