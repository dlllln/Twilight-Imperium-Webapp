import { expect, test } from '@playwright/test';

test('Hot-Seat: Strategiekarten wählen, Vorhut spielen, Sekundärfähigkeit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Partie starten' }).click();

  const phase = page.locator('.phases [aria-current="step"]');
  await expect(phase).toHaveText('Strategie');
  await expect(page.locator('.strategy-card')).toHaveCount(8);

  const pickLowestFree = async () => {
    await page.locator('.strategy-card button:not([disabled])').first().click();
  };
  for (let pick = 0; pick < 6; pick += 1) await pickLowestFree();

  await expect(phase).toHaveText('Aktion');
  await expect(page.locator('.strategy-card .goods')).toHaveCount(2);

  await page.getByRole('button', { name: 'Strategische Aktion: Vorhut' }).click();
  await expect(page.getByTestId('tokens-gained')).toHaveText('3');
  await page.getByRole('button', { name: 'Taktik +' }).click();
  await page.getByRole('button', { name: 'Taktik +' }).click();
  await page.getByRole('button', { name: 'Flotte +' }).click();
  await page.getByRole('button', { name: 'Ausführen' }).click();

  await expect(page.getByRole('heading', { name: /Sekundärfähigkeit/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(
    page.getByRole('button', { name: 'Strategische Aktion: Gesandtschaft' }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Passen' })).toBeDisabled();

  await page.getByRole('button', { name: 'Zur Galaxie' }).click();
  await expect(page.getByRole('button', { name: 'Neue Galaxie' })).toBeVisible();
});
