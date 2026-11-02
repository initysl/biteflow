import { and, desc, eq, gte, inArray, isNull, max, ne, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import {
  OPEN_STATUSES,
  STAFF_TRANSITIONS,
  type BillRequest,
  type Order,
  type OrderStatus,
  type SplitType,
  type StaffUser,
} from '../../shared/schemas';
import { type PlaceOrderInput, type PosOrderInput, placeOrderSchema, posOrderSchema } from '../../shared/validation';
import type { DB } from '../db/client';
import { billRequests, orderItems, orders, staffUsers } from '../db/schema';
import { badRequest, conflict, notFound, parse } from '../http';
import { type PricedLine, priceCart } from './pricing';
import { getTable, verifyTableToken } from './tables';

type OrderRow = typeof orders.$inferSelect;
type ItemRow = typeof orderItems.$inferSelect;

const now = () => new Date().toISOString();

function toOrder(row: OrderRow, items: ItemRow[], staffName: string | null): Order {
  const { paymentRef: _ref, completedAt: _completed, staffId: _staffId, ...rest } = row;
  return {
    ...rest,
    staffName,
    items: items.map(({ orderId: _orderId, ...i }) => i),
  };
}

function hydrate(db: DB, rows: OrderRow[]): Order[] {
  if (rows.length === 0) return [];
  const items = db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const staffIds = [...new Set(rows.map((r) => r.staffId).filter((id): id is string => !!id))];
  const staff = staffIds.length
    ? db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, staffIds)).all()
    : [];
  return rows.map((r) =>
    toOrder(
      r,
      items.filter((i) => i.orderId === r.id),
      staff.find((s) => s.id === r.staffId)?.name ?? null,
    ),
  );
}

export function getOrder(db: DB, id: string): Order {
  const row = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!row) throw notFound('Order');
  return hydrate(db, [row])[0];
}

/** Staff view: everything open (held tickets too) plus anything closed in the last `sinceHours`. */
export function listOrders(db: DB, { sinceHours = 12 } = {}): Order[] {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const rows = db
    .select()
    .from(orders)
    .where(or(inArray(orders.status, [...OPEN_STATUSES, 'held']), gte(orders.createdAt, since)))
    .orderBy(desc(orders.createdAt))
    .all();
  return hydrate(db, rows);
}

/**
 * Diner view: every open order on the table, plus any specific orders the
 * device placed itself (so a diner keeps their receipt after paying).
 */
export function listTableOrders(db: DB, tableId: string, includeIds: string[] = []): Order[] {
  const rows = db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.tableId, tableId),
        ne(orders.status, 'cancelled'),
        includeIds.length
          ? or(inArray(orders.status, [...OPEN_STATUSES]), inArray(orders.id, includeIds))
          : inArray(orders.status, [...OPEN_STATUSES]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .all();
  return hydrate(db, rows);
}

function nextOrderNumber(db: DB): number {
  const row = db
    .select({ n: max(orders.number) })
    .from(orders)
    .get();
  return Math.max(1000, row?.n ?? 0) + 1;
}

export function placeOrder(db: DB, input: PlaceOrderInput, money?: { currency: string; locale: string }): Order {
  const data = parse(placeOrderSchema, input);
  verifyTableToken(db, data.tableId, data.token);
  const { lines, quote } = priceCart(db, data, money);
  if (quote.promoError) throw badRequest(quote.promoError);

  const id = ulid();
  db.transaction((tx) => {
    tx.insert(orders)
      .values({
        id,
        number: nextOrderNumber(tx as unknown as DB),
        type: 'dine_in',
        source: 'qr',
        tableId: data.tableId,
        status: data.paymentMethod === 'card' ? 'awaiting_payment' : 'pending',
        notes: data.notes ?? null,
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        totalCents: quote.totalCents,
        promoCode: quote.promo?.code ?? null,
        paymentMethod: data.paymentMethod,
        paymentStatus: 'unpaid',
        createdAt: now(),
      })
      .run();
    insertItems(tx as unknown as DB, id, lines);
  });
  return getOrder(db, id);
}

function insertItems(db: DB, orderId: string, lines: PricedLine[]) {
  for (const line of lines) {
    db.insert(orderItems)
      .values({
        id: ulid(),
        orderId,
        menuItemId: line.item.id,
        name: line.item.name,
        unitPriceCents: line.item.priceCents,
        quantity: line.quantity,
        station: line.item.station,
        note: line.note ?? null,
      })
      .run();
  }
}

/**
 * Rings up an order at the register. `hold` parks it (the kitchen never sees
 * it); `send` fires it to the KDS. With `orderId`, a held ticket is updated
 * in place so it keeps its number.
 */
export function savePosOrder(db: DB, input: PosOrderInput, staff: StaffUser): Order {
  const data = parse(posOrderSchema, input);
  const tableId = data.type === 'dine_in' ? getTable(db, data.tableId!).id : null;
  const { lines, quote } = priceCart(db, { items: data.items });

  if (data.orderId) {
    const existing = getOrder(db, data.orderId);
    if (existing.status !== 'held') throw conflict(`Order #${existing.number} has already been sent to the kitchen`);
  }

  const id = data.orderId ?? ulid();
  const fields = {
    type: data.type,
    tableId,
    customerName: data.type === 'takeaway' ? (data.customerName ?? null) : null,
    status: (data.action === 'send' ? 'pending' : 'held') as OrderStatus,
    notes: data.notes ?? null,
    subtotalCents: quote.subtotalCents,
    discountCents: 0,
    totalCents: quote.subtotalCents,
    staffId: staff.id,
    // The kitchen clock starts when the ticket is sent, not when it was parked.
    createdAt: now(),
  };

  db.transaction((tx) => {
    if (data.orderId) {
      tx.update(orders).set(fields).where(eq(orders.id, id)).run();
      tx.delete(orderItems).where(eq(orderItems.orderId, id)).run();
    } else {
      tx.insert(orders)
        .values({
          id,
          number: nextOrderNumber(tx as unknown as DB),
          source: 'pos',
          paymentMethod: 'counter',
          paymentStatus: 'unpaid',
          ...fields,
        })
        .run();
    }
    insertItems(tx as unknown as DB, id, lines);
  });
  return getOrder(db, id);
}

/** Throws away a parked ticket. It never reached the kitchen, so no approval is needed. */
export function discardHeldOrder(db: DB, id: string): Order {
  const order = getOrder(db, id);
  if (order.status !== 'held') throw conflict('Only held tickets can be discarded — sent orders must be voided');
  db.delete(orders).where(eq(orders.id, id)).run();
  return { ...order, status: 'cancelled' };
}

/** Voids an order the kitchen has already received. Callers must have manager approval. */
export function voidOrder(db: DB, id: string): Order {
  const order = getOrder(db, id);
  if (order.paymentStatus === 'paid') throw conflict(`Order #${order.number} is already paid — it needs a refund, not a void`);
  if (!['pending', 'preparing', 'ready'].includes(order.status)) {
    throw conflict(`Order #${order.number} can’t be voided once it’s ${order.status}`);
  }
  db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, id)).run();
  return getOrder(db, id);
}

/** Takes payment for a takeaway order at the counter. Dine-in orders are settled per table. */
export function payTakeawayOrder(db: DB, id: string): Order {
  const order = getOrder(db, id);
  if (order.type !== 'takeaway') throw conflict('Dine-in orders are paid when the table settles up');
  if (order.status === 'held') throw conflict('Send the order to the kitchen before taking payment');
  return markOrderPaid(db, id, 'counter');
}

const statusTimestamp: Partial<Record<OrderStatus, keyof OrderRow>> = {
  preparing: 'preparingAt',
  ready: 'readyAt',
  served: 'servedAt',
};

export function transitionOrder(db: DB, id: string, to: OrderStatus): Order {
  const order = getOrder(db, id);
  const allowed = STAFF_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(to)) {
    throw conflict(`Can't move order #${order.number} from ${order.status} to ${to}`);
  }

  const patch: Partial<OrderRow> = { status: to };
  const stamp = statusTimestamp[to];
  if (stamp) (patch as Record<string, string>)[stamp] = now();
  // Going backwards clears the later timestamps so prep-time reporting stays honest.
  if (to === 'pending') Object.assign(patch, { preparingAt: null, readyAt: null });
  if (to === 'preparing') Object.assign(patch, { readyAt: null });
  if (to === 'served' && order.paymentStatus === 'paid') {
    Object.assign(patch, { status: 'completed', completedAt: now() });
  }

  db.update(orders).set(patch).where(eq(orders.id, id)).run();
  return getOrder(db, id);
}

export function markOrderPaid(db: DB, id: string, paymentRef?: string): Order {
  const order = getOrder(db, id);
  if (order.paymentStatus === 'paid') return order;
  if (order.status === 'cancelled') throw conflict('This order was cancelled');

  const patch: Partial<OrderRow> = { paymentStatus: 'paid', paidAt: now(), paymentRef: paymentRef ?? null };
  if (order.status === 'awaiting_payment') patch.status = 'pending';
  if (order.status === 'served') Object.assign(patch, { status: 'completed', completedAt: now() });

  db.update(orders).set(patch).where(eq(orders.id, id)).run();
  return getOrder(db, id);
}

/** A diner may abandon a card checkout before paying. */
export function cancelUnpaidCheckout(db: DB, id: string, tableId: string): Order {
  const order = getOrder(db, id);
  if (order.tableId !== tableId) throw notFound('Order');
  if (order.status !== 'awaiting_payment') throw conflict('Only unpaid checkouts can be cancelled');
  db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, id)).run();
  return getOrder(db, id);
}

export function activeBillRequest(db: DB, tableId: string): BillRequest | null {
  const row = db
    .select()
    .from(billRequests)
    .where(and(eq(billRequests.tableId, tableId), isNull(billRequests.settledAt)))
    .get();
  return row ? { id: row.id, tableId: row.tableId, split: row.split, people: row.people, createdAt: row.createdAt } : null;
}

function unpaidTableOrders(db: DB, tableId: string) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.tableId, tableId),
        eq(orders.paymentStatus, 'unpaid'),
        inArray(orders.status, ['pending', 'preparing', 'ready', 'served']),
      ),
    )
    .all();
}

export function requestBill(db: DB, tableId: string, split: SplitType, people: number): BillRequest {
  if (unpaidTableOrders(db, tableId).length === 0) throw conflict('There’s nothing left to pay on this table');
  const existing = activeBillRequest(db, tableId);
  const values = { split, people: split === 'even' ? people : 1 };
  if (existing) {
    db.update(billRequests).set(values).where(eq(billRequests.id, existing.id)).run();
  } else {
    db.insert(billRequests)
      .values({ id: ulid(), tableId, ...values, createdAt: now() })
      .run();
  }
  return activeBillRequest(db, tableId)!;
}

/** Staff take payment for everything outstanding on a table. Returns affected orders. */
export function settleTable(db: DB, tableId: string): Order[] {
  const unpaid = unpaidTableOrders(db, tableId);
  const settled = unpaid.map((o) => markOrderPaid(db, o.id, 'counter'));
  db.update(billRequests)
    .set({ settledAt: now() })
    .where(and(eq(billRequests.tableId, tableId), isNull(billRequests.settledAt)))
    .run();
  return settled;
}
