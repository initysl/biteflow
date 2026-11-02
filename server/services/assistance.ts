import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { AssistanceRequest, AssistanceType } from '../../shared/schemas';
import type { DB } from '../db/client';
import { assistanceRequests } from '../db/schema';
import { notFound } from '../http';

export function listActiveAssistance(db: DB, tableId?: string): AssistanceRequest[] {
  const active = isNull(assistanceRequests.resolvedAt);
  return db
    .select()
    .from(assistanceRequests)
    .where(tableId ? and(active, eq(assistanceRequests.tableId, tableId)) : active)
    .orderBy(asc(assistanceRequests.createdAt))
    .all();
}

/** Creating the same request twice while one is open returns the existing one. */
export function requestAssistance(db: DB, tableId: string, type: AssistanceType, note?: string): AssistanceRequest {
  const existing = listActiveAssistance(db, tableId).find((r) => r.type === type);
  if (existing) return existing;
  return db
    .insert(assistanceRequests)
    .values({ id: ulid(), tableId, type, note: note ?? null, createdAt: new Date().toISOString() })
    .returning()
    .get();
}

export function resolveAssistance(db: DB, id: string): AssistanceRequest {
  const row = db
    .update(assistanceRequests)
    .set({ resolvedAt: new Date().toISOString() })
    .where(eq(assistanceRequests.id, id))
    .returning()
    .get();
  if (!row) throw notFound('Assistance request');
  return row;
}
