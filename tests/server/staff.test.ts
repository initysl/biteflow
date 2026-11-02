import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

describe('staff auth', () => {
  it('protects every staff endpoint', async () => {
    const { app } = makeTestApp();
    for (const [method, path] of [
      ['get', '/api/staff/orders'],
      ['get', '/api/staff/tables'],
      ['post', '/api/staff/menu'],
      ['get', '/api/staff/reports/summary'],
    ] as const) {
      await request(app)[method](path).expect(401);
    }
  });

  it('rejects a wrong PIN and accepts the right one', async () => {
    const { app } = makeTestApp();
    await request(app).post('/api/auth/login').send({ pin: '0000' }).expect(401);
    await request(app).post('/api/auth/login').send({ pin: 'abc' }).expect(400);
    const res = await request(app).post('/api/auth/login').send({ pin: '4321' }).expect(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/bf_session=.*HttpOnly/);
  });

  it('logs out', async () => {
    const { staffAgent } = makeTestApp();
    const staff = await staffAgent();
    await staff.get('/api/auth/me').expect(200);
    await staff.post('/api/auth/logout').expect(204);
    await staff.get('/api/auth/me').expect(401);
  });

  it('never exposes table tokens publicly', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/tables/1').expect(200);
    expect(res.body.table.token).toBeUndefined();
    expect(res.body.canOrder).toBe(false);
  });
});

describe('assistance', () => {
  it('notifies the table when staff resolve its request', async () => {
    const { app, token, events, staffAgent } = makeTestApp();
    const created = await request(app)
      .post('/api/assistance')
      .send({ tableId: '4', token: token('4'), type: 'water' })
      .expect(201);

    // A second tap shouldn't create a duplicate.
    const again = await request(app)
      .post('/api/assistance')
      .send({ tableId: '4', token: token('4'), type: 'water' });
    expect(again.body.id).toBe(created.body.id);

    events.length = 0;
    const staff = await staffAgent();
    await staff.post(`/api/staff/assistance/${created.body.id}/resolve`).expect(200);
    expect(events).toContainEqual({ audience: 'table:4', event: { type: 'assistance.changed', tableId: '4' } });

    const open = await request(app)
      .get(`/api/tables/4/assistance?k=${token('4')}`)
      .expect(200);
    expect(open.body).toEqual([]);
  });
});

describe('menu admin', () => {
  it('validates menu items', async () => {
    const { staffAgent } = makeTestApp();
    const staff = await staffAgent();
    const res = await staff
      .post('/api/staff/menu')
      .send({ name: 'X', priceCents: -5, category: 'snacks', station: 'grill' })
      .expect(400);
    expect(res.body.error).toBeTruthy();
  });

  it('creates items and broadcasts the change', async () => {
    const { app, events, staffAgent } = makeTestApp();
    const staff = await staffAgent();
    await staff
      .post('/api/staff/menu')
      .send({
        name: 'Burrata',
        description: 'With heirloom tomatoes',
        priceCents: 1150,
        category: 'starters',
        station: 'pantry',
        dietary: ['vegetarian'],
        allergens: ['milk'],
      })
      .expect(201);
    expect(events.some((e) => e.event.type === 'menu.changed')).toBe(true);
    const menu = await request(app).get('/api/menu').expect(200);
    expect(menu.body.find((m: { name: string }) => m.name === 'Burrata')).toMatchObject({
      priceCents: 1150,
      allergens: ['milk'],
    });
  });
});

describe('tables admin', () => {
  it('rotating a token invalidates the old QR code', async () => {
    const { app, token, item, staffAgent } = makeTestApp();
    const old = token('2');
    const staff = await staffAgent();
    const rotated = await staff.post('/api/staff/tables/2/rotate-token').expect(200);
    expect(rotated.body.token).not.toBe(old);

    await request(app)
      .post('/api/orders')
      .send({
        tableId: '2',
        token: old,
        paymentMethod: 'counter',
        items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }],
      })
      .expect(403);
  });

  it('reports today’s numbers', async () => {
    const { app, token, item, staffAgent } = makeTestApp();
    await request(app)
      .post('/api/orders')
      .send({
        tableId: '1',
        token: token('1'),
        paymentMethod: 'counter',
        items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 3 }],
      })
      .expect(201);
    const staff = await staffAgent();
    const res = await staff.get('/api/staff/reports/summary').expect(200);
    expect(res.body).toMatchObject({ orderCount: 1, openOrderCount: 1, revenueCents: 0, outstandingCents: 2400 });
    expect(res.body.topItems[0]).toMatchObject({ name: 'Classic Tiramisu', quantity: 3 });
  });
});
