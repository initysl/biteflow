import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { type ClientEvent, type ServerEvent, staffRoom, tableRoom } from '../shared/events';
import { SESSION_COOKIE, readCookie, userForToken } from './auth';
import type { Broadcaster } from './context';
import type { DB } from './db/client';
import { verifyTableToken } from './services/tables';

interface Client {
  rooms: Set<string>;
  isStaff: boolean;
  alive: boolean;
}

export const REALTIME_PATH = '/ws';

export function createRealtime(server: Server, db: DB): Broadcaster & { close(): void } {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const clients = new Map<WebSocket, Client>();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== REALTIME_PATH) return; // leave other upgrades (e.g. Vite HMR) alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const send = (ws: WebSocket, event: ServerEvent) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const client: Client = {
      rooms: new Set(),
      isStaff: !!userForToken(db, readCookie(req.headers.cookie, SESSION_COOKIE)),
      alive: true,
    };
    clients.set(ws, client);
    send(ws, { type: 'hello' });

    ws.on('pong', () => (client.alive = true));
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));

    ws.on('message', (raw) => {
      let msg: ClientEvent;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', message: 'Malformed message' });
      }
      if (msg.type === 'ping') return send(ws, { type: 'pong' });
      if (msg.type !== 'subscribe') return;

      if (msg.room === 'staff') {
        if (!client.isStaff) return send(ws, { type: 'error', message: 'Not authorised for staff updates' });
        client.rooms.add(staffRoom);
        return send(ws, { type: 'subscribed', room: staffRoom });
      }
      if (msg.room === 'table' && typeof msg.tableId === 'string') {
        try {
          verifyTableToken(db, msg.tableId, msg.token);
        } catch {
          return send(ws, { type: 'error', message: 'Invalid table link' });
        }
        const room = tableRoom(msg.tableId);
        client.rooms.add(room);
        return send(ws, { type: 'subscribed', room });
      }
    });
  });

  // Drop connections that stop answering pings (phones going to sleep, flaky Wi-Fi).
  const heartbeat = setInterval(() => {
    for (const [ws, client] of clients) {
      if (!client.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      client.alive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  const publish = (predicate: (c: Client) => boolean, event: ServerEvent) => {
    const payload = JSON.stringify(event);
    for (const [ws, client] of clients) {
      if (predicate(client) && ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  };

  return {
    toStaff: (event) => publish((c) => c.rooms.has(staffRoom), event),
    toTable: (tableId, event) => publish((c) => c.rooms.has(tableRoom(tableId)), event),
    toAll: (event) => publish((c) => c.rooms.size > 0, event),
    close() {
      clearInterval(heartbeat);
      for (const ws of clients.keys()) ws.terminate();
      wss.close();
    },
  };
}
