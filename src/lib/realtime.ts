import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import type { ClientEvent, ServerEvent } from '@shared/events';
import type { Order } from '@shared/schemas';
import { queryKeys } from './queries';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
type Subscription = Extract<ClientEvent, { type: 'subscribe' }>;
type Listener = (event: ServerEvent) => void;

/**
 * One socket per browser tab, shared by every screen. Subscriptions are
 * replayed after reconnects, and a reconnect triggers a refetch so nothing
 * missed while offline stays stale.
 */
class RealtimeClient {
  private ws: WebSocket | null = null;
  private subs = new Map<string, Subscription>();
  private listeners = new Set<Listener>();
  private statusListeners = new Set<() => void>();
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private hadConnection = false;
  status: ConnectionStatus = 'connecting';
  onReconnect: (() => void) | null = null;

  private setStatus(s: ConnectionStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((l) => l());
  }

  private connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.retryTimer);
    this.setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('online');
      this.subs.forEach((s) => this.send(s));
      if (this.hadConnection) this.onReconnect?.();
      this.hadConnection = true;
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;
        this.listeners.forEach((l) => l(event));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      this.setStatus('offline');
      if (this.subs.size === 0) return;
      // Exponential backoff with jitter, capped at 15s.
      const delay = Math.min(15_000, 500 * 2 ** this.attempt++) * (0.7 + Math.random() * 0.6);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private send(event: ClientEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event));
  }

  subscribe(sub: Subscription): () => void {
    const key = sub.room === 'staff' ? 'staff' : `table:${sub.tableId}:${sub.token}`;
    this.subs.set(key, sub);
    if (this.ws?.readyState === WebSocket.OPEN) this.send(sub);
    else this.connect();
    return () => {
      this.subs.delete(key);
      if (this.subs.size === 0) {
        clearTimeout(this.retryTimer);
        this.ws?.close();
        this.ws = null;
      }
    };
  }

  /** Called when the tab regains focus or the network returns. */
  wake() {
    if (this.subs.size && !this.ws) {
      this.attempt = 0;
      this.connect();
    }
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  onStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  }
}

export const realtime = new RealtimeClient();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => realtime.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') realtime.wake();
  });
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (cb) => realtime.onStatus(cb),
    () => realtime.status,
  );
}

export function useRealtimeSubscription(sub: Subscription | null) {
  const key = sub ? JSON.stringify(sub) : null;
  useEffect(() => {
    if (!key) return;
    return realtime.subscribe(JSON.parse(key));
  }, [key]);
}

/** Maps server events onto the React Query cache. Mounted once at the app root. */
export function bindRealtimeToQueries(qc: QueryClient) {
  realtime.onReconnect = () => qc.invalidateQueries();
  return realtime.on((event) => {
    switch (event.type) {
      case 'order.upserted': {
        const order = event.order;
        qc.setQueryData<Order[]>(queryKeys.staffOrders, (prev) => {
          if (!prev) return prev;
          const i = prev.findIndex((o) => o.id === order.id);
          if (i === -1) return [order, ...prev];
          const next = prev.slice();
          next[i] = order;
          return next;
        });
        if (order.tableId) qc.invalidateQueries({ queryKey: queryKeys.tableOrders(order.tableId) });
        qc.invalidateQueries({ queryKey: queryKeys.staffReports });
        break;
      }
      case 'tables.changed':
        qc.invalidateQueries({ queryKey: queryKeys.staffTables });
        qc.invalidateQueries({ queryKey: queryKeys.staffReports });
        if (event.tableId) {
          qc.invalidateQueries({ queryKey: queryKeys.table(event.tableId) });
        } else {
          qc.invalidateQueries({ queryKey: ['table'] });
        }
        break;
      case 'assistance.changed':
        qc.invalidateQueries({ queryKey: queryKeys.staffAssistance });
        qc.invalidateQueries({ queryKey: queryKeys.tableAssistance(event.tableId) });
        break;
      case 'menu.changed':
        qc.invalidateQueries({ queryKey: queryKeys.menu });
        break;
    }
  });
}
