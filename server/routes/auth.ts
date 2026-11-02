import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginSchema } from '../../shared/validation';
import { SESSION_COOKIE, createSession, destroySession, userForToken, verifyPin } from '../auth';
import type { AppContext } from '../context';
import { HttpError, asyncHandler, parse } from '../http';

export function authRoutes({ db, config }: AppContext): Router {
  const r = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.isTest ? 1000 : 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many attempts. Try again in a few minutes.' },
  });

  r.post(
    '/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { pin } = parse(loginSchema, req.body);
      const user = await verifyPin(db, pin);
      if (!user) throw new HttpError(401, 'That PIN didn’t match');
      const { token, expiresAt } = createSession(db, user.id, config.sessionTtlHours);
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        expires: expiresAt,
        path: '/',
      });
      res.json(user);
    }),
  );

  r.post('/logout', (req, res) => {
    destroySession(db, req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  r.get('/me', (req, res) => {
    const user = userForToken(db, req.cookies?.[SESSION_COOKIE]);
    if (!user) throw new HttpError(401, 'Not signed in');
    res.json(user);
  });

  return r;
}
