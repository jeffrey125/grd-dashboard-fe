import { defineConfig, devices } from '@playwright/test';

const apiOrigin = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}`;

export default defineConfig({
  testDir: './e2e-backend',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  outputDir: 'test-results/backend',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4175',
    // Auth requests contain passwords/cookies; do not save network traces.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: 'node scripts/auth-backend.mjs',
      url: `${apiOrigin}/api/v1/health/live`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'pnpm exec vite preview --host localhost --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm exec vite --host localhost --port 4176 --strictPort',
      env: { VITE_API_ORIGIN: apiOrigin },
      url: 'http://localhost:4176',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
