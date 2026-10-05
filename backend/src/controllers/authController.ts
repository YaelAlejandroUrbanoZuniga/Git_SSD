import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import * as authService from '../services/authService';
import { NotFoundError, UnauthorizedError } from '../domain/errors';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export function authController(deps: Deps) {
  const login: RequestHandler = async (req, res, next) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const result = await authService.login(
        deps.prisma, deps.ldap, deps.env, username, password, req.requestId,
      );
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

  // Flag off -> 404 (not 403): the route's existence is not revealed either way.
  const guest: RequestHandler = (req, res, next) => {
    try {
      if (!deps.env.guestLoginEnabled) throw new NotFoundError();
      res.json(authService.loginAsGuest(deps.prisma, deps.env, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  return { login, refresh, logout, me, guest };
}
