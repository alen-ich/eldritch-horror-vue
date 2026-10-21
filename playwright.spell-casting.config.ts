import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'spell-casting.spec.ts', timeout: 45000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3001', trace: 'retain-on-failure' }, reporter: 'list',
  webServer: [
    { command: 'pnpm --filter server exec tsx test/fixtures/spell-casting-server.ts', url: 'http://127.0.0.1:2568/hi', reuseExistingServer: false, timeout: 30000, env: { PORT: '2568' } },
    { command: 'pnpm --filter web exec nuxt dev --host 127.0.0.1 --port 3001', url: 'http://127.0.0.1:3001', reuseExistingServer: false, timeout: 60000, env: { NUXT_PUBLIC_COLYSEUS_URL: 'http://127.0.0.1:2568' } },
  ],
})
