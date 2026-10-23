import { test, expect } from '@playwright/test'

test('automatic reconnect rotates credentials and reload preserves the same host seat', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  try {
    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()
    const transports: { sessionId: string | null }[] = []
    host.on('websocket', socket => {
      const url = new URL(socket.url())
      if (url.port === '2567') transports.push({ sessionId: url.searchParams.get('sessionId') })
    })
    await host.goto('/')
    await host.waitForLoadState('networkidle')
    await host.getByLabel('Display name').fill('Reconnect host')
    await host.getByRole('button', { name: 'Create game' }).click()
    await expect(host.getByText('Investigator roster')).toBeVisible()
    const connectedAt = Date.now()
    const invite = host.url()
    const savedToken = () => host.evaluate(() => localStorage.getItem('eldritch-reconnection-token'))
    const originalToken = await savedToken()
    expect(Boolean(originalToken)).toBe(true)
    await guest.goto(invite)
    await expect(guest.getByText('Investigator roster')).toBeVisible()
    await host.getByRole('button', { name: /Akachi Onyele/i }).click()
    await expect(guest.locator('.roster article').filter({ hasText: 'Akachi Onyele' })).toBeVisible()
    await guest.getByRole('button', { name: /Mark Harrigan/i }).click()
    await expect(host.locator('.roster article').filter({ hasText: 'Mark Harrigan' })).toBeVisible()

    // SDK 0.18.2 refuses automatic reconnect before its 5000 ms minimum uptime.
    await expect.poll(() => Date.now() - connectedAt, { timeout: 7000 }).toBeGreaterThanOrEqual(5100)
    expect(transports.length).toBe(1)
    const first = transports[0]!
    expect(Boolean(first.sessionId)).toBe(true)
    // The real SDK's offline handler closes its native game socket with 4010.
    await host.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect.poll(() => transports.length).toBe(2)
    await expect.poll(async () => {
      const token = await savedToken()
      return Boolean(token) && token !== originalToken
    }).toBe(true)
    await expect(host.getByRole('button', { name: /Akachi Onyele/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(host.locator('.roster article')).toHaveCount(2)
    expect(transports[1]!.sessionId).toBe(first.sessionId)
    expect(host.url()).toBe(invite)

    await host.reload()
    await expect(host.getByRole('button', { name: /Akachi Onyele/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(host.getByRole('button', { name: 'Start game' })).toBeVisible()
    await expect(host.locator('.roster article')).toHaveCount(2)
    await expect(guest.locator('.roster article')).toHaveCount(2)
    expect(transports[2]!.sessionId).toBe(first.sessionId)
    expect(host.url()).toBe(invite)
    await host.getByRole('button', { name: /Cthulhu.*Doom 12/i }).click()
    await expect(guest.getByRole('button', { name: /Cthulhu.*Doom 12/i })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close()])
  }
})
