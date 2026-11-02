import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

describe('placing orders', () => {
  it('prices orders from the database, ignoring anything the client sends', async () => {
    const { app, token, item } = makeTestApp();
    const burger = item('Wagyu Beef Burger');

    const res = await request(app)
      .post('/api/orders')
      .send({
        tableId: '3',
        token: token('3'),
        paymentMethod: 'counter',
        items: [{ menuItemId: burger.id, quantity: 2, priceCents: 1 }],
        totalCents: 1,
      })
      .expect(201);

    expect(res.body.order.subtotalCents).toBe(burger.priceCents * 2);
    expect(res.body.order.totalCents).toBe(burger.priceCents * 2);
    expect(res.body.order.items[0]).toMatchObject({ name: burger.name, unitPriceCents: burger.priceCents });
    expect(res.body.order.status).toBe('pending');
  });

  it('rejects orders without a valid table token', async () => {
    const { app, item } = makeTestApp();
    const res = await request(app)
      .post('/api/orders')
      .send({ tableId: '3', token: 'nope', paymentMethod: 'counter', items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }] })
      .expect(403);
    expect(res.body.error).toMatch(/scan the QR code/i);
  });

  it('rejects sold-out items', async () => {
    const { app, token, item, staffAgent } = makeTestApp();
    const tiramisu = item('Classic Tiramisu');
    const staff = await staffAgent();
    await staff.patch(`/api/staff/menu/${tiramisu.id}`).send({ available: false }).expect(200);

    const res = await request(app)
      .post('/api/orders')
      .send({ tableId: '1', token: token('1'), paymentMethod: 'counter', items: [{ menuItemId: tiramisu.id, quantity: 1 }] })
      .expect(409);
    expect(res.body.error).toBe('Classic Tiramisu is sold out');
  });

  it('applies percentage promo codes as a percentage', async () => {
    const { app, item } = makeTestApp();
    const salmon = item('Pan-Seared Salmon'); // $22.00
    const res = await request(app)
      .post('/api/quote')
      .send({ items: [{ menuItemId: salmon.id, quantity: 1 }], promoCode: 'welcome10' })
      .expect(200);
    expect(res.body).toMatchObject({ subtotalCents: 2200, discountCents: 220, totalCents: 1980, promoError: null });
  });

  it('enforces promo minimum spend', async () => {
    const { app, item } = makeTestApp();
    const res = await request(app)
      .post('/api/quote')
      .send({ items: [{ menuItemId: item('House Mint Lemonade').id, quantity: 1 }], promoCode: 'BISTRO5' })
      .expect(200);
    expect(res.body.discountCents).toBe(0);
    expect(res.body.promoError).toMatch(/Spend \$30\.00/);
  });

  it('holds card orders out of the kitchen until paid', async () => {
    const { app, token, item, events } = makeTestApp();
    const placed = await request(app)
      .post('/api/orders')
      .send({ tableId: '2', token: token('2'), paymentMethod: 'card', items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }] })
      .expect(201);
    expect(placed.body.order.status).toBe('awaiting_payment');
    expect(events.filter((e) => e.event.type === 'order.upserted')).toHaveLength(0);

    const paid = await request(app)
      .post('/api/payments/demo/confirm')
      .send({ tableId: '2', token: token('2'), orderId: placed.body.order.id })
      .expect(200);
    expect(paid.body).toMatchObject({ status: 'pending', paymentStatus: 'paid' });
    expect(events.some((e) => e.audience === 'staff' && e.event.type === 'order.upserted')).toBe(true);
  });

  it('gives orders sequential human-friendly numbers', async () => {
    const { app, token, item } = makeTestApp();
    const send = () =>
      request(app)
        .post('/api/orders')
        .send({ tableId: '1', token: token('1'), paymentMethod: 'counter', items: [{ menuItemId: item('Classic Tiramisu').id, quantity: 1 }] });
    const a = await send();
    const b = await send();
    expect(b.body.order.number).toBe(a.body.order.number + 1);
  });
});

describe('order lifecycle', () => {
  async function placed() {
    const t = makeTestApp();
    const res = await request(t.app)
      .post('/api/orders')
      .send({ tableId: '5', token: t.token('5'), paymentMethod: 'counter', items: [{ menuItemId: t.item('Wagyu Beef Burger').id, quantity: 1 }] });
    return { ...t, order: res.body.order, staff: await t.staffAgent() };
  }

  it('moves through the kitchen pipeline and records timestamps', async () => {
    const { order, staff } = await placed();
    const preparing = await staff.patch(`/api/staff/orders/${order.id}`).send({ status: 'preparing' }).expect(200);
    expect(preparing.body.preparingAt).toBeTruthy();
    const ready = await staff.patch(`/api/staff/orders/${order.id}`).send({ status: 'ready' }).expect(200);
    expect(ready.body.readyAt).toBeTruthy();
    const served = await staff.patch(`/api/staff/orders/${order.id}`).send({ status: 'served' }).expect(200);
    expect(served.body.status).toBe('served');
  });

  it('refuses illegal transitions', async () => {
    const { order, staff } = await placed();
    await staff.patch(`/api/staff/orders/${order.id}`).send({ status: 'served' }).expect(409);
  });

  it('settling a table pays its orders, completes served ones and frees the table', async () => {
    const { app, order, staff, token } = await placed();
    for (const status of ['preparing', 'ready', 'served']) {
      await staff.patch(`/api/staff/orders/${order.id}`).send({ status }).expect(200);
    }
    await request(app).post('/api/bill-requests').send({ tableId: '5', token: token('5'), split: 'even', people: 3 }).expect(201);

    let tables = await staff.get('/api/staff/tables').expect(200);
    expect(tables.body.find((t: { id: string }) => t.id === '5')).toMatchObject({
      status: 'billing',
      billRequest: { split: 'even', people: 3 },
    });

    await staff.post('/api/staff/tables/5/settle').expect(200);
    tables = await staff.get('/api/staff/tables').expect(200);
    expect(tables.body.find((t: { id: string }) => t.id === '5')).toMatchObject({ status: 'vacant', openTotalCents: 0 });

    const orders = await staff.get('/api/staff/orders').expect(200);
    expect(orders.body.find((o: { id: string }) => o.id === order.id)).toMatchObject({
      status: 'completed',
      paymentStatus: 'paid',
    });
  });

  it('won’t take a bill request when nothing is owed', async () => {
    const { app, token } = makeTestApp();
    await request(app).post('/api/bill-requests').send({ tableId: '7', token: token('7'), split: 'single' }).expect(409);
  });
});
