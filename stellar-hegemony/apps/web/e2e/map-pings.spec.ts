import { expect, test } from '@playwright/test';

test('Zeigen am Spieltisch: Mitspieler sehen dieselbe Geste und Neuladen übernimmt keine alten Marker', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto('/');
    await host.getByLabel('Dein Name').fill('Anna');
    await host.getByLabel('Spieler').selectOption('3');
    await host.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
    const code = (await host.getByTestId('lobby-code').textContent()) ?? '';
    await guest.goto('/');
    await guest.getByLabel('Dein Name').fill('Ben');
    await guest.getByLabel('Lobbycode').fill(code);
    await guest.getByRole('button', { name: 'Beitreten' }).click();
    await expect(host.getByTestId('lobby-seat-1')).toContainText('verbunden');
    await host.getByRole('button', { name: 'Partie starten' }).click();
    for (const page of [host, guest]) {
      await page.locator('.secret-choice input[type="radio"]').first().press('Space');
      await page.getByRole('button', { name: 'Behalten' }).click();
    }
    const system = host.locator('polygon[data-system]').first();
    const id = (await system.getAttribute('data-system')) ?? '';
    await system.click({ modifiers: ['Shift'] });
    for (const page of [host, guest]) {
      const marker = page.locator(`[data-system-ping="${id}"]`);
      await expect(marker).toBeVisible();
      await expect(marker).toContainText('Anna');
    }
    await guest.reload();
    await expect(guest.locator('.phases [aria-current="step"]')).toHaveText('Strategie');
    await expect(guest.locator('[data-system-ping]')).toHaveCount(0);
    await expect(host.locator('[data-system-ping]')).toHaveCount(0, { timeout: 6000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
