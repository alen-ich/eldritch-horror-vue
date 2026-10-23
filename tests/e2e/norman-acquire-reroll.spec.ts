import { test, expect } from '@playwright/test'

test('Norman buys Assets with a Sanity reroll restored after reload', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext()
  try {
    const host = await a.newPage(), guest = await b.newPage()
    await host.goto('/'); await host.waitForLoadState('networkidle')
    await host.getByLabel('Display name').fill('Acquiring Norman')
    await host.getByRole('button', { name: 'Create game' }).click()
    await expect(host.getByText('Investigator roster')).toBeVisible()
    await guest.goto(host.url()); await expect(guest.getByText('Investigator roster')).toBeVisible()
    await host.getByRole('button', { name: /Norman Withers/i }).click()
    await expect(guest.locator('.roster article').filter({ hasText: 'Norman Withers' })).toBeVisible()
    await guest.getByRole('button', { name: /Mark Harrigan/i }).click()
    await expect(host.locator('.roster article').filter({ hasText: 'Mark Harrigan' })).toBeVisible()
    await host.getByRole('button', { name: /Azathoth.*Doom 15/i }).click()
    await host.getByRole('button', { name: 'Start game' }).click()
    const payment = host.getByRole('button', { name: 'Spend 1 Sanity (Norman): reroll die 1', exact: true })
    let traveled = false
    // As in the existing multiplayer journey, retry only an unaccepted initial
    // intent whose observed state version can precede the post-start patch.
    await expect(async () => {
      await host.getByRole('button', { name: 'Acquire Assets', exact: true }).click()
      const monsterError = host.getByRole('alert').filter({ hasText: 'cannot acquire Assets on a space containing a Monster' }).first()
      await expect(payment.or(monsterError)).toBeVisible()
      if (await monsterError.isVisible()) {
        // City 5 is adjacent to Arkham and cannot receive a starting Gate Monster.
        await host.getByRole('button', { name: 'Close investigator details' }).click()
        await host.getByRole('button', { name: 'Collapse reserve' }).click()
        await host.getByRole('button', { name: '5, city, legal destination', exact: true }).click()
        await host.getByRole('button', { name: 'Confirm travel' }).click()
        await expect(host.getByText('Your action · 1 remaining', { exact: true })).toBeVisible()
        traveled = true
        await host.getByRole('button', { name: 'Acquire Assets', exact: true }).click()
      }
      await expect(payment).toBeVisible()
    }).toPass({ timeout: 15000 })
    await expect(guest.getByRole('button', { name: /Spend 1 Sanity/ })).toHaveCount(0)
    await host.reload(); await expect(payment).toBeVisible()
    await payment.focus(); await host.keyboard.press('Enter')
    await host.getByRole('button', { name: 'Use selected reroll', exact: true }).click()
    await expect(host.locator('.dock-vitals .sanity')).toHaveText('✦ 6')
    await expect(payment).toHaveCount(0)
    await host.getByRole('button', { name: 'Buy nothing', exact: true }).click()
    await host.getByRole('button', { name: 'Keep all', exact: true }).click()
    if (!traveled) await expect(host.getByText('Your action · 1 remaining', { exact: true })).toBeVisible()
    await host.reload()
    await expect(host.locator('.dock-vitals .sanity')).toHaveText('✦ 6')
    await expect(payment).toHaveCount(0)
    for (const page of [host, guest]) expect(await page.locator('body').innerHTML()).not.toMatch(/investigatorAbilityUsage|normanClueSubstitutions|tokenPoolById|held_clues|feedTheMindByPhysicalId|private-card-assets/)
  } finally { await Promise.allSettled([a.close(), b.close()]) }
})
