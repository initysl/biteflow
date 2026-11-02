/**
 * Remembers a table's QR token and the orders this device placed, so a diner
 * can refresh or come back to the tab without rescanning.
 */

const tokenKey = (tableId: string) => `bf:table:${tableId}:token`;
const ordersKey = (tableId: string) => `bf:table:${tableId}:orders`;
const ORDER_MEMORY_MS = 12 * 3600_000;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full — the session just won't survive a reload.
  }
}

export const getTableToken = (tableId: string) => read<string | null>(tokenKey(tableId), null);
export const setTableToken = (tableId: string, token: string) => write(tokenKey(tableId), token);

export function rememberOrder(tableId: string, orderId: string) {
  const list = read<{ id: string; at: number }[]>(ordersKey(tableId), []);
  write(ordersKey(tableId), [{ id: orderId, at: Date.now() }, ...list.filter((o) => o.id !== orderId)].slice(0, 20));
}

export function rememberedOrderIds(tableId: string): string[] {
  const cutoff = Date.now() - ORDER_MEMORY_MS;
  return read<{ id: string; at: number }[]>(ordersKey(tableId), [])
    .filter((o) => o.at > cutoff)
    .map((o) => o.id);
}
