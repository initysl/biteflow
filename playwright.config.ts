import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Set PW_CHANNEL=chrome to use an installed Chrome instead of Playwright's Chromium.
    channel: process.env.PW_CHANNEL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL } }],
  webServer: {
    command: `rm -f data/e2e.db* && NODE_ENV=development DEMO_MODE=true PORT=${PORT} DATABASE_URL=data/e2e.db STAFF_DEMO_PIN=1234 tsx server/index.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
