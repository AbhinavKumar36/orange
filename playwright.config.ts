import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:backend',
      url: 'http://localhost:4000/api/v1/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run dev:customer',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 45000,
    },
    {
      command: 'npm run dev:admin',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 45000,
    },
  ],
});
