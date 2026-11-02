import compression from 'compression';
import cookieParser from 'cookie-parser';
import { sql } from 'drizzle-orm';
import express from 'express';
import helmet from 'helmet';
import type { AppContext } from './context';
import { errorHandler } from './http';
import { authRoutes } from './routes/auth';
import { publicRoutes, stripeWebhookRoute } from './routes/public';
import { staffRoutes } from './routes/staff';

/** Builds the API. Static/Vite serving is layered on in index.ts so tests can use this directly. */
export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: ctx.config.isProduction
        ? {
            directives: {
              'img-src': ["'self'", 'data:', 'blob:', 'https:'],
              'connect-src': ["'self'", 'ws:', 'wss:'],
              'form-action': ["'self'", 'https://checkout.stripe.com'],
              // Only force HTTPS sub-resources when the app is actually served over HTTPS.
              'upgrade-insecure-requests': ctx.config.appUrl.startsWith('https://') ? [] : null,
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.use('/api', stripeWebhookRoute(ctx));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    ctx.db.get(sql`select 1`);
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/staff', staffRoutes(ctx));
  app.use('/api', publicRoutes(ctx));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return app;
}
