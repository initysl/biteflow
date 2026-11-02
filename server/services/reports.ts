import { and, gte, inArray, ne } from 'drizzle-orm';
import type { ReportSummary } from '../../shared/schemas';
import type { DB } from '../db/client';
import { orderItems, orders } from '../db/schema';
import { listTables } from './tables';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function summary(db: DB, from: Date = startOfToday()): ReportSummary {
  const since = from.toISOString();
  const todays = db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, since), ne(orders.status, 'cancelled'), ne(orders.status, 'awaiting_payment')))
    .all();
  const paid = todays.filter((o) => o.paymentStatus === 'paid');
  const revenueCents = paid.reduce((s, o) => s + o.totalCents, 0);

  const prepMinutes = todays.filter((o) => o.readyAt).map((o) => (Date.parse(o.readyAt!) - Date.parse(o.createdAt)) / 60_000);
  const averagePrepMinutes = prepMinutes.length
    ? Math.round((prepMinutes.reduce((a, b) => a + b, 0) / prepMinutes.length) * 10) / 10
    : null;

  const items = todays.length
    ? db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            todays.map((o) => o.id),
          ),
        )
        .all()
    : [];
  const byName = new Map<string, { name: string; quantity: number; revenueCents: number }>();
  for (const i of items) {
    const agg = byName.get(i.name) ?? { name: i.name, quantity: 0, revenueCents: 0 };
    agg.quantity += i.quantity;
    agg.revenueCents += i.quantity * i.unitPriceCents;
    byName.set(i.name, agg);
  }
  const topItems = [...byName.values()].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents).slice(0, 6);

  const hours = new Map<number, { hour: number; orders: number; revenueCents: number }>();
  for (const o of todays) {
    const hour = new Date(o.createdAt).getHours();
    const h = hours.get(hour) ?? { hour, orders: 0, revenueCents: 0 };
    h.orders += 1;
    if (o.paymentStatus === 'paid') h.revenueCents += o.totalCents;
    hours.set(hour, h);
  }
  const hourKeys = [...hours.keys()];
  const firstHour = Math.min(11, ...hourKeys);
  const lastHour = Math.max(new Date().getHours(), ...hourKeys);
  const ordersByHour = [];
  for (let h = firstHour; h <= lastHour; h++) ordersByHour.push(hours.get(h) ?? { hour: h, orders: 0, revenueCents: 0 });

  const tables = listTables(db);
  const open = todays.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));

  return {
    revenueCents,
    orderCount: todays.length,
    averageTicketCents: todays.length ? Math.round(todays.reduce((s, o) => s + o.totalCents, 0) / todays.length) : 0,
    averagePrepMinutes,
    openOrderCount: open.length,
    occupiedTables: tables.filter((t) => t.status !== 'vacant').length,
    totalTables: tables.length,
    outstandingCents: tables.reduce((s, t) => s + t.openTotalCents, 0),
    topItems,
    ordersByHour,
  };
}
