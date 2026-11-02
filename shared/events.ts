import type { Order } from './schemas';

/** Messages the server pushes over the realtime socket. */
export type ServerEvent =
  | { type: 'hello' }
  | { type: 'subscribed'; room: string }
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'order.upserted'; order: Order }
  | { type: 'menu.changed' }
  | { type: 'tables.changed'; tableId?: string }
  | { type: 'assistance.changed'; tableId: string };

/** Messages a client may send. */
export type ClientEvent =
  { type: 'ping' } | { type: 'subscribe'; room: 'staff' } | { type: 'subscribe'; room: 'table'; tableId: string; token: string };

export const staffRoom = 'staff';
export const tableRoom = (tableId: string) => `table:${tableId}`;
