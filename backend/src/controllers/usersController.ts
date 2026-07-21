import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as usersService from '../services/usersService';

const createSchema = z.object({
  email: z.string().min(1),
  role: z.string().min(1),
});

const patchSchema = z.object({ role: z.string().min(1) });

export function usersController(deps: Deps) {
  const list: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await usersService.listUsers(deps.prisma));
    } catch (err) {
      next(err);
    }
  };

  const create: RequestHandler = async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await usersService.createUser(deps.prisma, input));
    } catch (err) {
      next(err);
    }
  };

  const updateRole: RequestHandler = async (req, res, next) => {
    try {
      const { role } = patchSchema.parse(req.body);
      res.json(await usersService.updateUserRole(deps.prisma, req.params.id, role));
    } catch (err) {
      next(err);
    }
  };

  const remove: RequestHandler = async (req, res, next) => {
    try {
      await usersService.deleteUser(deps.prisma, req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { list, create, updateRole, remove };
}
