import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import type { StaffUser } from '../shared/schemas';
import type { DB } from './db/client';
import { sessions, staffUsers } from './db/schema';
import { HttpError } from './http';

export const SESSION_COOKIE = 'bf_session';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function verifyPin(db: DB, pin: string): Promise<StaffUser | null> {
  const users = db.select().from(staffUsers).all();
  for (const u of users) {
    if (await bcrypt.compare(pin, u.pinHash)) return { id: u.id, name: u.name };
  }
  return null;
}

export function createSession(db: DB, userId: string, ttlHours: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
  db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: expiresAt.toISOString() }).run();
  return { token, expiresAt };
}

export function destroySession(db: DB, token: string | undefined): void {
  if (token) db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

export function userForToken(db: DB, token: string | undefined): StaffUser | null {
  if (!token) return null;
  const row = db
    .select({ id: staffUsers.id, name: staffUsers.name })
    .from(sessions)
    .innerJoin(staffUsers, eq(sessions.userId, staffUsers.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .get();
  return row ?? null;
}

/** Minimal cookie parsing for the WebSocket upgrade request, which bypasses express. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffUser;
  }
}

export const requireStaff = (db: DB) => (req: Request, _res: Response, next: NextFunction) => {
  const user = userForToken(db, req.cookies?.[SESSION_COOKIE]);
  if (!user) return next(new HttpError(401, 'Please sign in to the staff console'));
  req.staff = user;
  next();
};
