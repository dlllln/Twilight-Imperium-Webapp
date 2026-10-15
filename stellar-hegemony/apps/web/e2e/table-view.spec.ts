import { expect, type Locator, test } from '@playwright/test';
import { keepSecrets, openTable } from './table.ts';

/*
 * Tischansicht: Vor dem eigenen Platz liegt das Kommandopult, dahinter das Brett mit der
 * eigenen Heimat vorne unten. Der Schalter in den Einstellungen holt die klassische Ansicht zurück.
 */

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (found === null) throw new Error('nicht sichtbar');
  return found;
};

const middleY = async (locator: Locator) => {
  const found = await box(locator);
  return found.y + found.height / 2;
};

test('Kommandopult vor dem eigenen Platz; der Schalter wechselt zur klassischen Ansicht und zurück', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1);
  if (page === undefined) throw new Error('kein Gerät');
  await keepSecrets([page]);
  const sheet = page.getByRole('region', { name: 'Dein Kommandopult' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Taktik: 3')).toBeVisible();
  await expect(page.locator('.hud-resources')).toHaveCount(0);

  // Die eigene Heimat liegt vorne unten, direkt über dem Pult.
  const home = page.locator('[data-seat="1"][data-system]');
  const others = await page.locator('[data-system]:not([data-seat="1"])').all();
  const lowest = Math.max(...(await Promise.all(others.map(middleY))));
  expect(await middleY(home)).toBeGreaterThan(lowest);
  const homeBox = await box(home);
  expect(homeBox.y + homeBox.height).toBeLessThanOrEqual((await box(sheet)).y + 2);

  const settings = page.getByRole('button', { name: 'Einstellungen' });
  const tableView = page.getByRole('switch', { name: 'Tischansicht' });
  await settings.click();
  await expect(tableView).toHaveAttribute('aria-checked', 'true');
  await tableView.click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.hud-resources')).toBeVisible();

  await tableView.click();
  await expect(sheet).toBeVisible();
  await expect(page.locator('.hud-resources')).toHaveCount(0);
});
