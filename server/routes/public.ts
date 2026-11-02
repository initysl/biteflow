import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  type AppConfig,
  assistanceInputSchema,
  billRequestInputSchema,
  placeOrderSchema,
  quoteInputSchema,
  tableAuthSchema,
} from '../../shared/schemas';
import { type AppContext, emitAssistance, emitOrder, emitTables } from '../context';
import { HttpError, asyncHandler, badRequest, conflict, parse } from '../http';
import { listActiveAssistance, requestAssistance } from '../services/assistance';
import { listMenu } from '../services/menu';
import {
  cancelUnpaidCheckout,
  getOrder,
  listTableOrders,
  markOrderPaid,
  placeOrder,
  requestBill,
} from '../services/orders';
import { priceCart } from '../services/pricing';
import { getTable, listTables, publicTable, verifyTableToken } from '../services/tables';

/** Routes diners use from the table. Writes require the table's QR token. */
export function publicRoutes(ctx: AppContext): Router {
  const { db, config, payments } = ctx;
  const r = Router();

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.isTest ? 1000 : 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests — please wait a moment and try again.' },
  });

  r.get('/config', (_req, res) => {
    const body: AppConfig = {
      restaurantName: config.restaurantName,
      currency: config.currency,
      locale: config.locale,
      paymentProvider: payments.name,
      demoMode: config.demoMode,
    };
    res.json(body);
  });

  r.get('/menu', (_req, res) => {
    res.json(listMenu(db));
  });

  r.post('/quote', (req, res) => {
    const input = parse(quoteInputSchema, req.body);
    res.json(priceCart(db, input, config).quote);
  });

  // Table info is readable without a token so a bare /t/3 link can show the menu.
  r.get('/tables/:id', (req, res) => {
    const table = getTable(db, req.params.id);
    const token = typeof req.query.k === 'string' ? req.query.k : undefined;
    let canOrder = false;
    if (token) {
      try {
        verifyTableToken(db, table.id, token);
        canOrder = true;
      } catch {
        canOrder = false;
      }
    }
    res.json({ table: publicTable(table), canOrder });
  });

  r.get('/tables/:id/orders', (req, res) => {
    verifyTableToken(db, req.params.id, String(req.query.k ?? ''));
    const include = String(req.query.include ?? '')
      .split(',')
      .filter(Boolean)
      .slice(0, 50);
    res.json(listTableOrders(db, req.params.id, include));
  });

  r.get('/tables/:id/assistance', (req, res) => {
    verifyTableToken(db, req.params.id, String(req.query.k ?? ''));
    res.json(listActiveAssistance(db, req.params.id));
  });

  r.post(
    '/orders',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const input = parse(placeOrderSchema, req.body);
      const order = placeOrder(db, input, config);
      if (order.status !== 'awaiting_payment') emitOrder(ctx, order);
      const checkout =
        order.paymentMethod === 'card'
          ? await payments.startCheckout(order, {
              appUrl: config.appUrl,
              currency: config.currency,
              restaurantName: config.restaurantName,
            })
          : null;
      res.status(201).json({ order, checkout });
    }),
  );

  r.post(
    '/orders/:id/checkout',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const { tableId, token } = parse(tableAuthSchema, req.body);
      verifyTableToken(db, tableId, token);
      const order = getOrder(db, req.params.id);
      if (order.tableId !== tableId) throw new HttpError(404, 'Order not found');
      if (order.status !== 'awaiting_payment') throw conflict('This order no longer needs payment');
      const checkout = await payments.startCheckout(order, {
        appUrl: config.appUrl,
        currency: config.currency,
        restaurantName: config.restaurantName,
      });
      res.json({ order, checkout });
    }),
  );

  r.post('/orders/:id/cancel', writeLimiter, (req, res) => {
    const { tableId, token } = parse(tableAuthSchema, req.body);
    verifyTableToken(db, tableId, token);
    const order = cancelUnpaidCheckout(db, req.params.id, tableId);
    emitOrder(ctx, order);
    res.json(order);
  });

  r.post('/payments/demo/confirm', writeLimiter, (req, res) => {
    if (payments.name !== 'demo') throw badRequest('Demo payments are disabled');
    const { tableId, token, orderId } = parse(tableAuthSchema.extend({ orderId: z.string() }), req.body);
    verifyTableToken(db, tableId, token);
    const existing = getOrder(db, orderId);
    if (existing.tableId !== tableId) throw new HttpError(404, 'Order not found');
    const order = markOrderPaid(db, orderId, `demo_${Date.now()}`);
    emitOrder(ctx, order);
    res.json(order);
  });

  r.post(
    '/payments/stripe/confirm',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const { sessionId } = parse(z.object({ sessionId: z.string().min(1).max(200) }), req.body);
      const paid = await payments.confirmCheckout(sessionId);
      if (!paid) throw conflict('Payment has not completed yet');
      const order = markOrderPaid(db, paid.orderId, paid.ref);
      emitOrder(ctx, order);
      res.json(order);
    }),
  );

  r.post('/assistance', writeLimiter, (req, res) => {
    const { tableId, token, type, note } = parse(assistanceInputSchema, req.body);
    verifyTableToken(db, tableId, token);
    const request = requestAssistance(db, tableId, type, note);
    emitAssistance(ctx, tableId);
    res.status(201).json(request);
  });

  r.post('/bill-requests', writeLimiter, (req, res) => {
    const { tableId, token, split, people } = parse(billRequestInputSchema, req.body);
    verifyTableToken(db, tableId, token);
    const bill = requestBill(db, tableId, split, people);
    emitTables(ctx, tableId);
    res.status(201).json(bill);
  });

  // Demo helper so the landing page can open a working table without a printed QR code.
  r.get('/demo/table', (_req, res) => {
    if (!config.demoMode) throw new HttpError(404, 'Not found');
    const tables = listTables(db);
    const table = tables.find((t) => t.status === 'vacant') ?? tables[0];
    if (!table) throw new HttpError(404, 'No tables configured');
    res.json({ tableId: table.id, token: table.token });
  });

  return r;
}

/** Stripe signs the raw body, so this must be mounted before the JSON body parser. */
export function stripeWebhookRoute(ctx: AppContext): Router {
  const { db, payments } = ctx;
  const r = Router();
  r.post('/payments/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    if (!payments.parseWebhook) throw badRequest('Webhooks are not configured');
    let paid;
    try {
      paid = payments.parseWebhook(req.body as Buffer, String(req.headers['stripe-signature'] ?? ''));
    } catch {
      throw badRequest('Invalid webhook signature');
    }
    if (paid) emitOrder(ctx, markOrderPaid(db, paid.orderId, paid.ref));
    res.json({ received: true });
  });
  return r;
}
