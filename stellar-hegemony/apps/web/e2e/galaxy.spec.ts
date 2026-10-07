import { expect, test } from '@playwright/test';

test('Galaxie wird angezeigt, neu erzeugt und per Map-String importiert', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hex')).toHaveCount(37);
  await expect(page.locator('.tile-home')).toHaveCount(6);

  await page.getByLabel('Spieler').selectOption('3');
  await expect(page.locator('.tile-home')).toHaveCount(3);

  await page.locator('[data-slot="0,0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('Thronwelt Aurum');

  const mapString = page.locator('#map-string');
  await mapString.fill('thronwelt b01 b02 r01 b03 r02 b04 H . . . H . . . H . . . H');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.locator('.tile-home')).toHaveCount(4);
  await expect(page.locator('.hex')).toHaveCount(11);

  await mapString.fill('thronwelt b01 b01');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.getByRole('alert')).toContainText('doppelt');

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New galaxy' })).toBeVisible();
});
