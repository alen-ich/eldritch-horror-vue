import { test, expect } from '@playwright/test'

test('Norman starts with Feed the Mind and restores its owner decision', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext()
  try {
    const host = await a.newPage(), guest = await b.newPage()
    await host.goto('/'); await host.waitForLoadState('networkidle')
    await host.getByLabel('Display name').fill('Starting Norman')
    await host.getByRole('button', { name: 'Create game' }).click()
    await expect(host.getByText('Investigator roster')).toBeVisible()
    await guest.goto(host.url()); await expect(guest.getByText('Investigator roster')).toBeVisible()
    await host.getByRole('button', { name: /Norman Withers/i }).click()
    await expect(guest.locator('.roster article').filter({ hasText: 'Norman Withers' })).toBeVisible()
    await guest.getByRole('button', { name: /Mark Harrigan/i }).click()
    await expect(host.locator('.roster article').filter({ hasText: 'Mark Harrigan' })).toBeVisible()
    await host.getByRole('button', { name: /Azathoth.*Doom 15/i }).click()
    await expect(host.getByRole('button', { name: 'Start game' })).toBeEnabled()
    await host.getByRole('button', { name: 'Start game' }).click()
    await host.getByRole('button', { name: /Spells/ }).click()
    const inventory = host.getByRole('region', { name: 'Spell inventory' })
    await expect(inventory.getByRole('heading', { name: 'Feed the Mind', exact: true })).toBeVisible()
    await guest.getByRole('button', { name: /Spells/ }).click()
    await expect(guest.getByRole('region', { name: 'Spell inventory' }).getByText('No Spells held')).toBeVisible()
    await inventory.getByRole('button', { name: 'Cast Feed the Mind' }).click()
    const keep = host.getByRole('button', { name: 'Keep result', exact: true })
    await expect(keep).toBeVisible()
    await expect(guest.getByRole('button', { name: /Spend 1 Sanity/ })).toHaveCount(0)
    await host.reload(); await expect(keep).toBeVisible()
    await keep.click()
    const dialog = host.getByRole('dialog').filter({ hasText: 'Spell action' })
    // Wait for each accepted command's next UI, never for a fixed time or a favorable roll.
    await expect.poll(async () => (await host.getByText('Your action · 1 remaining', { exact: true }).count()) + (await dialog.count())).toBeGreaterThan(0)
    for (let stage = 0; stage < 6; stage++) {
      if (await host.getByText('Your action · 1 remaining', { exact: true }).isVisible()) break
      const options = dialog.getByRole('button')
      await expect(options.first()).toBeVisible()
      const labels = await options.allTextContents()
      const label = ['norman_withers', 'Improve will once', 'Discard Spell', 'Decline'].find(value => labels.includes(value))
      expect(label, `Unexpected Spell stage: ${labels.join(', ')}`).toBeDefined()
      await dialog.getByRole('button', { name: label!, exact: true }).click()
      await expect.poll(async () => (await host.getByText('Your action · 1 remaining', { exact: true }).isVisible()) || JSON.stringify(await options.allTextContents()) !== JSON.stringify(labels)).toBe(true)
    }
    await expect(host.getByText('Your action · 1 remaining', { exact: true })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await host.getByRole('button', { name: /Spells/ }).click()
    const cast = inventory.getByRole('button', { name: 'Cast Feed the Mind' })
    await expect.poll(async () => (await cast.count()) === 0 || !(await cast.isEnabled())).toBe(true)
    for (const page of [host, guest]) expect(await page.locator('body').innerHTML()).not.toMatch(/sourcePhysicalId|heldByPlayer|feedTheMindByPhysicalId|private-card-assets/)
  } finally {
    await Promise.allSettled([a.close(), b.close()])
  }
})
