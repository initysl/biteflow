import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApp } from './app';
import { config } from './config';
import type { AppContext } from './context';
import { createDb } from './db/client';
import { isEmptyOfOrders, seedDemoActivity, seedEssentials } from './db/seed';
import { createRealtime } from './realtime';
import { demoProvider, stripeProvider } from './services/payments';

async function main() {
  const { db, sqlite } = createDb(config.databaseUrl);
  seedEssentials(db, { staffPin: config.staffDemoPin, managerPin: config.managerPin, demoMode: config.demoMode });
  if (config.demoMode && isEmptyOfOrders(db)) seedDemoActivity(db);

  const server = http.createServer();
  const realtime = createRealtime(server, db);
  const payments = config.stripeSecretKey ? stripeProvider(config.stripeSecretKey, config.stripeWebhookSecret) : demoProvider;

  const ctx: AppContext = { db, config, realtime, payments };
  const app = createApp(ctx);

  if (config.isProduction) {
    const dist = path.resolve(process.cwd(), 'dist/client');
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.on('request', app);
  server.listen(config.port, () => {
    console.log(`${config.restaurantName} running at ${config.appUrl}`);
    console.log(`  payments: ${payments.name}   demo mode: ${config.demoMode ? 'on' : 'off'}`);
    if (config.demoMode) console.log(`  staff console: ${config.appUrl}/staff  (demo PIN ${config.staffDemoPin})`);
    console.log(`  manager approvals: ${config.managerPin ? 'enabled' : 'off — set MANAGER_PIN to approve voids and deletions'}`);
  });

  const shutdown = () => {
    console.log('Shutting down…');
    realtime.close();
    server.close(() => {
      sqlite.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
