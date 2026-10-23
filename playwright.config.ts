import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['spell-casting.spec.ts', 'norman-action.spec.ts'],
  timeout: 45000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  reporter: 'list',
  webServer: [
    { command: 'pnpm --filter server exec tsx src/index.ts', url: 'http://127.0.0.1:2567/hi', reuseExistingServer: !process.env.CI, timeout: 30000 },
    { command: 'pnpm --filter web exec nuxt dev --host 127.0.0.1 --port 3000', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 60000 },
  ],
})
