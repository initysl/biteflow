import request from 'supertest';
import type { ServerEvent } from '../../shared/events';
import { createApp } from '../../server/app';
import { config } from '../../server/config';
import type { AppContext, Broadcaster } from '../../server/context';
import { createDb } from '../../server/db/client';
import { seedEssentials } from '../../server/db/seed';
import { listMenu } from '../../server/services/menu';
import { demoProvider } from '../../server/services/payments';
import { getTable } from '../../server/services/tables';

export const STAFF_PIN = '4321';
export const MANAGER_PIN = '8765';

/** `demo: true` mirrors the public portfolio setup: STAFF_PIN is a plain staff account and MANAGER_PIN owns the manager account. */
export function makeTestApp({ demo = false } = {}) {
  const { db } = createDb(':memory:');
  seedEssentials(
    db,
    demo ? { staffPin: STAFF_PIN, managerPin: MANAGER_PIN, demoMode: true } : { staffPin: STAFF_PIN, demoMode: false },
  );

  const events: { audience: string; event: ServerEvent }[] = [];
  const realtime: Broadcaster = {
    toStaff: (event) => events.push({ audience: 'staff', event }),
    toTable: (tableId, event) => events.push({ audience: `table:${tableId}`, event }),
    toAll: (event) => events.push({ audience: 'all', event }),
  };

  const ctx: AppContext = { db, config: { ...config, demoMode: true }, realtime, payments: demoProvider };
  const app = createApp(ctx);
  const menu = listMenu(db);
  const token = (tableId: string) => getTable(db, tableId).token;
  const item = (name: string) => {
    const found = menu.find((m) => m.name === name);
    if (!found) throw new Error(`No menu item ${name}`);
    return found;
  };

  async function staffAgent(pin = STAFF_PIN) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ pin }).expect(200);
    return agent;
  }

  return { app, db, ctx, events, menu, token, item, staffAgent };
}
