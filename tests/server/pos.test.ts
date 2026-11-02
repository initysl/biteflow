import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MANAGER_PIN, makeTestApp } from './helpers';

describe('register (POS)', () => {
  it('holds a ticket out of the kitchen, then sends it with the same number', async () => {
    const { item, staffAgent, events } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    const burger = item('Wagyu Beef Burger');

    const held = await staff
      .post('/api/staff/pos/orders')
      .send({ type: 'dine_in', tableId: '7', items: [{ menuItemId: burger.id, quantity: 1 }], action: 'hold' })
      .expect(201);
    expect(held.body).toMatchObject({ status: 'held', source: 'pos', type: 'dine_in', tableId: '7', staffName: 'Demo staff' });
    // Held tickets stay off guests' phones.
    expect(events.some((e) => e.audience === 'table:7')).toBe(false);

    const tables = await staff.get('/api/staff/tables').expect(200);
    expect(tables.body.find((t: { id: string }) => t.id === '7')).toMatchObject({ status: 'vacant', openTotalCents: 0 });

    const sent = await staff
      .post('/api/staff/pos/orders')
      .send({ orderId: held.body.id, type: 'dine_in', tableId: '7', items: [{ menuItemId: burger.id, quantity: 2 }], action: 'send' })
      .expect(201);
    expect(sent.body).toMatchObject({ id: held.body.id, number: held.body.number, status: 'pending', totalCents: burger.priceCents * 2 });
    expect(events.some((e) => e.audience === 'table:7' && e.event.type === 'order.upserted')).toBe(true);

    // A sent order can't be edited as a held ticket any more.
    await staff
      .post('/api/staff/pos/orders')
      .send({ orderId: held.body.id, type: 'dine_in', tableId: '7', items: [{ menuItemId: burger.id, quantity: 1 }], action: 'send' })
      .expect(409);
  });

  it('puts dine-in register orders on the table’s bill, visible to the guests', async () => {
    const { app, item, token, staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    const order = await staff
      .post('/api/staff/pos/orders')
      .send({ type: 'dine_in', tableId: '8', items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 2 }], action: 'send' })
      .expect(201);
    const guestView = await request(app).get(`/api/tables/8/orders?k=${token('8')}`).expect(200);
    expect(guestView.body.map((o: { id: string }) => o.id)).toContain(order.body.id);
    const tables = await staff.get('/api/staff/tables').expect(200);
    expect(tables.body.find((t: { id: string }) => t.id === '8')).toMatchObject({ status: 'seated', openTotalCents: 1600 });
  });

  it('requires a table for dine-in and validates takeaway orders', async () => {
    const { item, staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    const res = await staff
      .post('/api/staff/pos/orders')
      .send({ type: 'dine_in', items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }], action: 'send' })
      .expect(400);
    expect(res.body.error).toMatch(/Pick a table/);
    await staff.post('/api/staff/pos/orders').send({ type: 'takeaway', items: [], action: 'send' }).expect(400);
  });

  it('runs a takeaway order from register to paid and completed', async () => {
    const { item, staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    const order = await staff
      .post('/api/staff/pos/orders')
      .send({ type: 'takeaway', customerName: 'Sam', items: [{ menuItemId: item('House Mint Lemonade').id, quantity: 3 }], action: 'send' })
      .expect(201);
    expect(order.body).toMatchObject({ type: 'takeaway', tableId: null, customerName: 'Sam', totalCents: 1500 });

    for (const status of ['preparing', 'ready', 'served']) {
      await staff.patch(`/api/staff/orders/${order.body.id}`).send({ status }).expect(200);
    }
    const paid = await staff.post(`/api/staff/orders/${order.body.id}/pay`).expect(200);
    expect(paid.body).toMatchObject({ paymentStatus: 'paid', status: 'completed' });
  });

  it('discards held tickets freely but needs a manager to void a sent order', async () => {
    const { item, staffAgent } = makeTestApp({ demo: true });
    const staff = await staffAgent();
    const line = [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }];

    const held = await staff.post('/api/staff/pos/orders').send({ type: 'takeaway', items: line, action: 'hold' }).expect(201);
    await staff.delete(`/api/staff/pos/orders/${held.body.id}`).expect(200);
    await staff.get('/api/staff/orders').expect(200).expect((r) => expect(r.body.some((o: { id: string }) => o.id === held.body.id)).toBe(false));

    const sent = await staff.post('/api/staff/pos/orders').send({ type: 'takeaway', items: line, action: 'send' }).expect(201);
    await staff.delete(`/api/staff/pos/orders/${sent.body.id}`).expect(409);
    await staff.patch(`/api/staff/orders/${sent.body.id}`).send({ status: 'cancelled' }).expect(409);
    await staff.post(`/api/staff/orders/${sent.body.id}/void`).expect(403);
    const voided = await staff.post(`/api/staff/orders/${sent.body.id}/void`).set('X-Manager-Pin', MANAGER_PIN).expect(200);
    expect(voided.body.status).toBe('cancelled');
  });
});
