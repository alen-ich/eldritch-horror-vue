import { test, expect } from '@playwright/test'

test('two browsers join, resolve an Asset test, and share Travel state', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  try {
    await host.goto('/')
    await host.waitForLoadState('networkidle')
    await host.getByLabel('Display name').fill('Host')
    await host.getByRole('button', { name: 'Create game' }).click()
    await expect(host.getByText('Investigator roster')).toBeVisible()
    const inviteUrl = host.url()

    await guest.goto(inviteUrl)
    await guest.waitForLoadState('networkidle')
    await expect(guest.getByText('Investigator roster')).toBeVisible()
    await host.getByRole('button', { name: /Akachi Onyele/i }).click()
    await expect(guest.locator('.roster article').filter({ hasText: 'Akachi Onyele' })).toBeVisible()
    await guest.getByRole('button', { name: /Trish Scarborough/i }).click()
    await expect(host.locator('.roster article').filter({ hasText: 'Trish Scarborough' })).toBeVisible()
    await host.getByRole('button', { name: /Cthulhu.*Doom 12/i }).click()
    await expect(host.getByRole('button', { name: 'Start game' })).toBeEnabled()
    await host.getByRole('button', { name: 'Start game' }).click()
    await expect(host.getByRole('button', { name: 'Acquire Assets' })).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Acquire Assets' })).toBeVisible()

    await host.getByRole('button', { name: 'Acquire Assets' }).click()
    await expect(host.getByRole('dialog', { name: /influence test/i })).toBeVisible()
    await expect(host.getByRole('button', { name: 'Spend 1 Clue: reroll die 1', exact: true })).toBeVisible()
    await host.getByRole('button', { name: 'Keep result' }).click()
    await expect(host.getByRole('button', { name: 'Buy nothing' })).toBeVisible()
    await host.getByRole('button', { name: 'Buy nothing' }).click()
    // Private decision messages can arrive before the corresponding schema patch.
    // Retry this no-op discard only if the server rejected its stale version.
    await expect(async () => {
      await host.getByRole('button', { name: 'Keep all' }).click()
      await expect(host.getByText('Your action · 1 remaining')).toBeVisible()
    }).toPass({ timeout: 15000 })

    await host.getByRole('button', { name: 'Close investigator details' }).click()
    await host.getByRole('button', { name: '10, wilderness, legal destination' }).click()
    await expect(host.getByRole('region', { name: 'Planned travel' })).toContainText('15 → 10')
    await host.getByRole('button', { name: 'Confirm travel' }).click()
    await guest.getByRole('button', { name: 'Show Host' }).click()
    await expect(guest.locator('.investigator-facts').getByText('10', { exact: true })).toBeVisible()
    await guest.getByRole('button', { name: 'End actions' }).click()
    await expect(host.getByRole('region', { name: 'Location encounter' })).toBeVisible()
    await expect(host.getByRole('button', { name: 'General', exact: true })).toBeVisible()
  } finally {
    await guestContext.close()
    await hostContext.close()
  }
})

test("Lily can use Lucky Rabbit's Foot once during an Asset test", async ({ page, browser }) => {
  const guestContext = await browser.newContext()
  try {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Display name').fill('Lily player')
    await page.getByRole('button', { name: 'Create game' }).click()
    await page.getByRole('button', { name: /Lily Chen/i }).click()
    const guest = await guestContext.newPage()
    await guest.goto(page.url())
    await guest.waitForLoadState('networkidle')
    await expect(guest.locator('.roster article').filter({ hasText: 'Lily Chen' })).toBeVisible()
    await guest.getByRole('button', { name: /Trish Scarborough/i }).click()
    await expect(page.locator('.roster article').filter({ hasText: 'Trish Scarborough' })).toBeVisible()
    await page.getByRole('button', { name: /Cthulhu.*Doom 12/i }).click()
    await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled()
    await page.getByRole('button', { name: 'Start game' }).click()
    const dialog = page.getByRole('dialog', { name: /influence test/i })
    const freeReroll = dialog.getByRole('button', { name: "Lucky Rabbit's Foot: reroll die 1 (no Clue)", exact: true })
    await expect(async () => {
      await page.getByRole('button', { name: 'Acquire Assets' }).click()
      // Two-player setup opens one Gate. If its Monster is in Shanghai,
      // use an ordinary Travel action to the adjacent, unoccupied City.
      const monsterError = page.getByRole('alert').filter({ hasText: 'cannot acquire Assets on a space containing a Monster' }).first()
      await expect(freeReroll.or(monsterError)).toBeVisible()
      if (await monsterError.isVisible()) {
        await page.getByRole('button', { name: 'Close investigator details' }).click()
        await page.getByRole('button', { name: 'Tokyo, city, legal destination', exact: true }).click()
        await page.getByRole('button', { name: 'Confirm travel' }).click()
        await expect(page.getByText('Your action · 1 remaining')).toBeVisible()
        await page.getByRole('button', { name: 'Acquire Assets' }).click()
      }
      await expect(freeReroll).toBeVisible()
    }).toPass({ timeout: 15000 })
    await freeReroll.click()
    await dialog.getByRole('button', { name: 'Use selected reroll' }).click()
    await expect(page.getByRole('button', { name: /Lucky Rabbit's Foot: reroll die/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Buy nothing' })).toBeVisible()
    await expect(guest.getByRole('dialog', { name: /influence test/i })).toHaveCount(0)
  } finally {
    await guestContext.close()
  }
})

test('Personal Assistant offers an explicit free reroll during Acquire Assets', async ({ page, browser }) => {
  const guestContext = await browser.newContext()
  try {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Display name').fill('Charlie player')
  await page.getByRole('button', { name: 'Create game' }).click()
  await page.getByRole('button', { name: /Charlie Kane/i }).click()
  const guest = await guestContext.newPage()
  await guest.goto(page.url())
  await guest.waitForLoadState('networkidle')
  await expect(guest.locator('.roster article').filter({ hasText: 'Charlie Kane' })).toBeVisible()
  await guest.getByRole('button', { name: /Trish Scarborough/i }).click()
  await expect(page.locator('.roster article').filter({ hasText: 'Trish Scarborough' })).toBeVisible()
  await page.getByRole('button', { name: /Cthulhu.*Doom 12/i }).click()
  await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start game' }).click()
  const dialog = page.getByRole('dialog', { name: /influence test/i })
  const freeReroll = dialog.getByRole('button', { name: 'Personal Assistant: reroll die 1 (no Clue)', exact: true })
  // The first click can use a pre-start version while the final room patch arrives.
  // Retry only until the owner-private test is visible; never retry a reroll itself.
  await expect(async () => {
    await page.getByRole('button', { name: 'Acquire Assets' }).click()
    await expect(freeReroll).toBeVisible()
  }).toPass({ timeout: 15000 })
  await freeReroll.click()
  await dialog.getByRole('button', { name: 'Use selected reroll' }).click()
  await expect(page.getByRole('button', { name: /Personal Assistant: reroll die/ })).toHaveCount(0)
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Keep result' }).click()
  await expect(page.getByRole('button', { name: 'Buy nothing' })).toBeVisible()
  } finally {
    await guestContext.close()
  }
})
