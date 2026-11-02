import { Router } from 'express';
import { menuItemInputSchema, orderStatusUpdateSchema } from '../../shared/validation';
import { requireStaff } from '../auth';
import { type AppContext, emitAssistance, emitMenu, emitOrder, emitTables } from '../context';
import { resetDemo } from '../db/seed';
import { HttpError, asyncHandler, parse } from '../http';
import { listActiveAssistance, resolveAssistance } from '../services/assistance';
import { createMenuItem, deleteMenuItem, replaceMenu, updateMenuItem } from '../services/menu';
import { fetchSampleMenu } from '../services/menuImport';
import { listOrders, settleTable, transitionOrder } from '../services/orders';
import { summary } from '../services/reports';
import { createTable, deleteTable, listTables, rotateTableToken, updateTable } from '../services/tables';

/** Everything behind the staff login. */
export function staffRoutes(ctx: AppContext): Router {
  const { db, config } = ctx;
  const r = Router();
  r.use(requireStaff(db));

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

  r.delete('/tables/:id', (req, res) => {
    deleteTable(db, req.params.id);
    emitTables(ctx);
    res.status(204).end();
  });

  r.post('/tables/:id/rotate-token', (req, res) => {
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

  r.delete('/menu/:id', (req, res) => {
    deleteMenuItem(db, req.params.id);
    emitMenu(ctx);
    res.status(204).end();
  });

  r.post(
    '/menu/import-sample',
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
  r.post('/demo/reset', (_req, res) => {
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
