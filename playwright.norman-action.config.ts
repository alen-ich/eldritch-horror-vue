import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'norman-action.spec.ts', timeout: 45000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3002', trace: 'retain-on-failure' }, reporter: 'list',
  webServer: [
    { command: 'pnpm --filter server exec tsx test/fixtures/norman-action-server.ts', url: 'http://127.0.0.1:2569/hi', reuseExistingServer: false, timeout: 30000, env: { PORT: '2569' } },
    { command: 'pnpm --filter web exec nuxt dev --host 127.0.0.1 --port 3002', url: 'http://127.0.0.1:3002', reuseExistingServer: false, timeout: 60000, env: { NUXT_PUBLIC_COLYSEUS_URL: 'http://127.0.0.1:2569' } },
  ],
})
