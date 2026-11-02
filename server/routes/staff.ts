import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { menuItemInputSchema, orderStatusUpdateSchema } from '../../shared/validation';
import { requireManager, requireStaff } from '../auth';
import { type AppContext, emitAssistance, emitMenu, emitOrder, emitTables } from '../context';
import { resetDemo } from '../db/seed';
import { HttpError, asyncHandler, parse } from '../http';
import { listActiveAssistance, resolveAssistance } from '../services/assistance';
import { createMenuItem, deleteMenuItem, replaceMenu, updateMenuItem } from '../services/menu';
import { fetchSampleMenu } from '../services/menuImport';
import {
  discardHeldOrder,
  listOrders,
  payTakeawayOrder,
  savePosOrder,
  settleTable,
  transitionOrder,
  voidOrder,
} from '../services/orders';
import { summary } from '../services/reports';
import { createTable, deleteTable, listTables, rotateTableToken, updateTable } from '../services/tables';

/** Everything behind the staff login. */
export function staffRoutes(ctx: AppContext): Router {
  const { db, config } = ctx;
  const r = Router();
  r.use(requireStaff(db));

  // Voids and destructive changes need a manager. Failed PIN attempts are
  // rate-limited so a 4-digit manager PIN can't be guessed.
  const managerOnly = [
    rateLimit({
      windowMs: 15 * 60_000,
      limit: config.isTest ? 1000 : 10,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many manager PIN attempts. Try again in a few minutes.' },
    }),
    requireManager(db),
  ];

  // Orders --------------------------------------------------------------------
  r.get('/orders', (_req, res) => {
    res.json(listOrders(db));
  });

  r.patch('/orders/:id', (req, res) => {
    const { status } = parse(orderStatusUpdateSchema, req.body);
    const order = transitionOrder(db, req.params.id, status);
    emitOrder(ctx, order);
    res.json(order);
  });

  r.post('/orders/:id/void', ...managerOnly, (req, res) => {
    const order = voidOrder(db, req.params.id);
    emitOrder(ctx, order);
    res.json(order);
  });

  r.post('/orders/:id/pay', (req, res) => {
    const order = payTakeawayOrder(db, req.params.id);
    emitOrder(ctx, order);
    res.json(order);
  });

  // Register (POS) ------------------------------------------------------------
  r.post('/pos/orders', (req, res) => {
    const order = savePosOrder(db, req.body, req.staff!);
    emitOrder(ctx, order);
    res.status(201).json(order);
  });

  r.delete('/pos/orders/:id', (req, res) => {
    const order = discardHeldOrder(db, req.params.id);
    emitOrder(ctx, order);
    res.json(order);
  });

  // Tables --------------------------------------------------------------------
  r.get('/tables', (_req, res) => {
    res.json(listTables(db));
  });

  r.post('/tables', (req, res) => {
    const table = createTable(db, req.body);
    emitTables(ctx, table.id);
    res.status(201).json(table);
  });

  r.patch('/tables/:id', (req, res) => {
    const table = updateTable(db, req.params.id, req.body);
    emitTables(ctx, table.id);
    res.json(table);
  });

  r.delete('/tables/:id', ...managerOnly, (req, res) => {
    deleteTable(db, req.params.id);
    emitTables(ctx);
    res.status(204).end();
  });

  r.post('/tables/:id/rotate-token', ...managerOnly, (req, res) => {
    res.json(rotateTableToken(db, req.params.id));
  });

  r.post('/tables/:id/settle', (req, res) => {
    const settled = settleTable(db, req.params.id);
    settled.forEach((o) => emitOrder(ctx, o));
    emitTables(ctx, req.params.id);
    res.json({ settled: settled.length });
  });

  // Assistance ----------------------------------------------------------------
  r.get('/assistance', (_req, res) => {
    res.json(listActiveAssistance(db));
  });

  r.post('/assistance/:id/resolve', (req, res) => {
    const request = resolveAssistance(db, req.params.id);
    emitAssistance(ctx, request.tableId);
    res.json(request);
  });

  // Menu ----------------------------------------------------------------------
  r.post('/menu', (req, res) => {
    const item = createMenuItem(db, req.body);
    emitMenu(ctx);
    res.status(201).json(item);
  });

  r.patch('/menu/:id', (req, res) => {
    const item = updateMenuItem(db, req.params.id, parse(menuItemInputSchema.partial(), req.body));
    emitMenu(ctx);
    res.json(item);
  });

  r.delete('/menu/:id', ...managerOnly, (req, res) => {
    deleteMenuItem(db, req.params.id);
    emitMenu(ctx);
    res.status(204).end();
  });

  r.post(
    '/menu/import-sample',
    ...managerOnly,
    asyncHandler(async (_req, res) => {
      const items = await fetchSampleMenu();
      if (items.length === 0) throw new HttpError(502, 'Couldn’t reach the sample menu service. Try again shortly.');
      const menu = replaceMenu(db, items);
      emitMenu(ctx);
      res.json(menu);
    }),
  );

  // Reports -------------------------------------------------------------------
  r.get('/reports/summary', (_req, res) => {
    res.json(summary(db));
  });

  // Demo ----------------------------------------------------------------------
  r.post('/demo/reset', ...managerOnly, (_req, res) => {
    if (!config.demoMode) throw new HttpError(404, 'Not found');
    resetDemo(db);
    emitMenu(ctx);
    emitTables(ctx);
    for (const t of listTables(db)) {
      emitTables(ctx, t.id);
      emitAssistance(ctx, t.id);
    }
    res.status(204).end();
  });

  return r;
}
