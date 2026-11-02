import type { ServerEvent } from '../shared/events';
import type { Order } from '../shared/schemas';
import type { config as appConfig } from './config';
import type { DB } from './db/client';
import type { PaymentProvider } from './services/payments';

export interface Broadcaster {
  toStaff(event: ServerEvent): void;
  toTable(tableId: string, event: ServerEvent): void;
  toAll(event: ServerEvent): void;
}

export interface AppContext {
  db: DB;
  config: typeof appConfig;
  realtime: Broadcaster;
  payments: PaymentProvider;
}

export const silentBroadcaster: Broadcaster = {
  toStaff() {},
  toTable() {},
  toAll() {},
};

// Small helpers so every route notifies the same audiences the same way.

export function emitOrder({ realtime }: Pick<AppContext, 'realtime'>, order: Order) {
  const event: ServerEvent = { type: 'order.upserted', order };
  realtime.toStaff(event);
  realtime.toTable(order.tableId, event);
  emitTables({ realtime }, order.tableId);
}

export function emitTables({ realtime }: Pick<AppContext, 'realtime'>, tableId?: string) {
  realtime.toStaff({ type: 'tables.changed', tableId });
  if (tableId) realtime.toTable(tableId, { type: 'tables.changed', tableId });
}

export function emitAssistance({ realtime }: Pick<AppContext, 'realtime'>, tableId: string) {
  const event: ServerEvent = { type: 'assistance.changed', tableId };
  realtime.toStaff(event);
  realtime.toTable(tableId, event);
}

export function emitMenu({ realtime }: Pick<AppContext, 'realtime'>) {
  realtime.toAll({ type: 'menu.changed' });
}
