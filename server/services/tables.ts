import { randomBytes, timingSafeEqual } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { OPEN_STATUSES, type BillRequest, type RestaurantTable, type TableWithToken } from '../../shared/schemas';
import { type TableInput, tableInputSchema, tableUpdateSchema } from '../../shared/validation';
import type { DB } from '../db/client';
import { billRequests, orders, restaurantTables } from '../db/schema';
import { HttpError, conflict, notFound, parse } from '../http';

export const newTableToken = () => randomBytes(9).toString('base64url');

type TableRow = typeof restaurantTables.$inferSelect;
type BillRow = typeof billRequests.$inferSelect;

const toBillRequest = (r: BillRow): BillRequest => ({
  id: r.id,
  tableId: r.tableId,
  split: r.split,
  people: r.people,
  createdAt: r.createdAt,
});

function summarise(db: DB, rows: TableRow[]): TableWithToken[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const open = db
    .select({
      tableId: orders.tableId,
      status: orders.status,
      totalCents: orders.totalCents,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(and(inArray(orders.tableId, ids), inArray(orders.status, [...OPEN_STATUSES])))
    .all();
  const bills = db
    .select()
    .from(billRequests)
    .where(and(inArray(billRequests.tableId, ids), isNull(billRequests.settledAt)))
    .all();

  return rows.map((t) => {
    // Unpaid card checkouts don't seat a table — they never reached the kitchen.
    const tableOrders = open.filter((o) => o.tableId === t.id && o.status !== 'awaiting_payment');
    const bill = bills.find((b) => b.tableId === t.id);
    const openTotalCents = tableOrders.filter((o) => o.paymentStatus === 'unpaid').reduce((s, o) => s + o.totalCents, 0);
    return {
      id: t.id,
      label: t.label,
      seats: t.seats,
      token: t.token,
      status: bill ? 'billing' : tableOrders.length > 0 ? 'seated' : 'vacant',
      openTotalCents,
      openOrderCount: tableOrders.length,
      billRequest: bill ? toBillRequest(bill) : null,
    };
  });
}

const naturalOrder = (a: TableRow, b: TableRow) =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, undefined, { numeric: true });

export function listTables(db: DB): TableWithToken[] {
  return summarise(db, db.select().from(restaurantTables).orderBy(asc(restaurantTables.sortOrder)).all().sort(naturalOrder));
}

export function getTable(db: DB, id: string): TableWithToken {
  const row = db.select().from(restaurantTables).where(eq(restaurantTables.id, id)).get();
  if (!row) throw notFound('Table');
  return summarise(db, [row])[0];
}

export function publicTable({ token: _token, ...t }: TableWithToken): RestaurantTable {
  return t;
}

export function verifyTableToken(db: DB, tableId: string, token: string | undefined): void {
  const row = db.select({ token: restaurantTables.token }).from(restaurantTables).where(eq(restaurantTables.id, tableId)).get();
  if (!row) throw notFound('Table');
  const a = Buffer.from(row.token);
  const b = Buffer.from(token ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, 'This table link has expired. Please scan the QR code on your table again.');
  }
}

export function createTable(db: DB, input: TableInput): TableWithToken {
  const data = parse(tableInputSchema, input);
  const exists = db.select({ id: restaurantTables.id }).from(restaurantTables).where(eq(restaurantTables.id, data.id)).get();
  if (exists) throw conflict(`Table ${data.id} already exists`);
  const count = db.select({ id: restaurantTables.id }).from(restaurantTables).all().length;
  db.insert(restaurantTables)
    .values({ ...data, token: newTableToken(), sortOrder: count })
    .run();
  return getTable(db, data.id);
}

export function updateTable(db: DB, id: string, input: unknown): TableWithToken {
  const data = parse(tableUpdateSchema, input);
  const res = db.update(restaurantTables).set(data).where(eq(restaurantTables.id, id)).run();
  if (res.changes === 0) throw notFound('Table');
  return getTable(db, id);
}

export function rotateTableToken(db: DB, id: string): TableWithToken {
  const res = db.update(restaurantTables).set({ token: newTableToken() }).where(eq(restaurantTables.id, id)).run();
  if (res.changes === 0) throw notFound('Table');
  return getTable(db, id);
}

export function deleteTable(db: DB, id: string): void {
  const table = getTable(db, id);
  if (table.status !== 'vacant') throw conflict('Settle and clear the table before removing it');
  db.delete(restaurantTables).where(eq(restaurantTables.id, id)).run();
}
