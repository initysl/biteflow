import 'dotenv/config';

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

export const config = {
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 3000,
  appUrl: (env.APP_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || './data/biteflow.db',
  restaurantName: env.RESTAURANT_NAME || 'BiteFlow Bistro',
  currency: env.CURRENCY || 'USD',
  locale: env.LOCALE || 'en-US',
  /** Demo mode exposes a public "try a table" link and seeds sample data on first boot. */
  demoMode: env.DEMO_MODE ? env.DEMO_MODE === 'true' : !isProduction,
  staffDemoPin: env.STAFF_DEMO_PIN || '1234',
  /** Private PIN for the manager account, which approves voids and destructive changes. Optional. */
  managerPin: env.MANAGER_PIN || '',
  sessionTtlHours: Number(env.SESSION_TTL_HOURS) || 12,
  stripeSecretKey: env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
};

if (config.managerPin && (!/^\d{4}$/.test(config.managerPin) || config.managerPin === config.staffDemoPin)) {
  throw new Error('MANAGER_PIN must be exactly 4 digits and different from STAFF_DEMO_PIN');
}

if (!/^\d{4}$/.test(config.staffDemoPin)) {
  throw new Error('STAFF_DEMO_PIN must be exactly 4 digits');
}

if (isProduction && config.demoMode && config.staffDemoPin === '1234') {
  console.warn('[config] DEMO_MODE is on in production with the default staff PIN. Set STAFF_DEMO_PIN.');
}
