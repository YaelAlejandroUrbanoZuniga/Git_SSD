import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as authService from '../services/authService';
import { UnauthorizedError } from '../domain/errors';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export function authController(deps: Deps) {
  const login: RequestHandler = async (req, res, next) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const result = await authService.login(deps.prisma, deps.ldap, deps.env, username, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  const refresh: RequestHandler = async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      res.json(await authService.refresh(deps.prisma, deps.env, refreshToken));
    } catch (err) {
      next(err);
    }
  };

  const logout: RequestHandler = async (req, res, next) => {
    try {
      const refreshToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken ?? '';
      await authService.logout(deps.prisma, refreshToken);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  const me: RequestHandler = (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    res.json({ user: req.user });
  };

  return { login, refresh, logout, me };
}
