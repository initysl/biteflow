import { describe, expect, it } from 'vitest';
import { createDb } from '../../server/db/client';
import { seedEssentials } from '../../server/db/seed';
import { staffUsers } from '../../server/db/schema';
import { MANAGER_PIN, STAFF_PIN, makeTestApp } from './helpers';

describe('manager approval (public demo setup)', () => {
  it('lets the demo PIN run service but not void, delete, replace or reset without a manager', async () => {
    const { item, staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();

    const me = await staff.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ name: 'Demo staff', role: 'staff' });

    // Everyday service still works.
    await staff.patch(`/api/staff/menu/${item('Classic Tiramisu').id}`).send({ available: false }).expect(200);
    await staff.get('/api/staff/orders').expect(200);

    const refused = await Promise.all([
      staff.delete(`/api/staff/menu/${item('Classic Tiramisu').id}`),
      staff.post('/api/staff/menu/import-sample'),
      staff.delete('/api/staff/tables/7'),
      staff.post('/api/staff/tables/7/rotate-token'),
      staff.post('/api/staff/demo/reset'),
    ]);
    for (const res of refused) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: 'Manager approval required', details: { code: 'manager_approval' } });
    }
  });

  it('accepts a manager’s PIN as approval for a staff member', async () => {
    const { staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    await staff.post('/api/staff/tables/7/rotate-token').set('X-Manager-Pin', '0000').expect(403);
    // The demo PIN itself can never approve.
    await staff.post('/api/staff/tables/7/rotate-token').set('X-Manager-Pin', STAFF_PIN).expect(403);
    await staff.post('/api/staff/tables/7/rotate-token').set('X-Manager-Pin', MANAGER_PIN).expect(200);
  });

  it('lets a manager session go straight through', async () => {
    const { item, staffAgent } = makeTestApp({ demo: true });
    const manager = await staffAgent(MANAGER_PIN);
    const me = await manager.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ name: 'Owner', role: 'manager' });
    await manager.delete(`/api/staff/menu/${item('Classic Tiramisu').id}`).expect(204);
    await manager.post('/api/staff/demo/reset').expect(204);
  });

  it('downgrades an existing manager account that uses the public demo PIN', () => {
    const { db } = createDb(':memory:');
    seedEssentials(db, { staffPin: STAFF_PIN, demoMode: false });
    expect(db.select().from(staffUsers).all()).toMatchObject([{ role: 'manager' }]);

    seedEssentials(db, { staffPin: STAFF_PIN, managerPin: MANAGER_PIN, demoMode: true });
    const users = db.select().from(staffUsers).all();
    expect(users.find((u) => u.id !== 'owner')).toMatchObject({ role: 'staff', name: 'Demo staff' });
    expect(users.find((u) => u.id === 'owner')).toMatchObject({ role: 'manager' });
  });

  it('keeps the first account as manager outside demo mode', async () => {
    const { staffAgent } = makeTestApp();
    const me = await (await staffAgent()).get('/api/auth/me').expect(200);
    expect(me.body.role).toBe('manager');
  });
});
