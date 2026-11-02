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

export function makeTestApp() {
  const { db } = createDb(':memory:');
  seedEssentials(db, { staffPin: STAFF_PIN });

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

  async function staffAgent() {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ pin: STAFF_PIN }).expect(200);
    return agent;
  }

  return { app, db, ctx, events, menu, token, item, staffAgent };
}
