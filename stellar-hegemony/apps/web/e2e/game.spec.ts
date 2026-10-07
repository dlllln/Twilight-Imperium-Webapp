import { expect, type Locator, type Page, test } from '@playwright/test';

const center = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('nicht sichtbar');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Ein Nachbarfeld der Heimat des Spielers am Zug, ohne Anomalie und ohne fremde Heimat. */
async function neighbourOfActiveHome(page: Page): Promise<Locator> {
  const actor = await page.getByTestId('actor').innerText();
  const seat = /P(\d)/.exec(actor)?.[1] ?? '';
  const home = await center(page.locator(`[data-seat="${seat}"]`));
  const hexes = page.locator('[data-system]:not([data-anomaly]):not([data-seat])');
  const centers = await Promise.all((await hexes.all()).map(center));
  const distances = centers.map((c) => Math.hypot(c.x - home.x, c.y - home.y));
  const step = Math.min(...distances);
  const index = distances.findIndex((distance) => distance < step * 1.1);
  return hexes.nth(index);
}

async function pickCards(page: Page) {
  for (let pick = 0; pick < 6; pick += 1)
    await page.locator('.strategy-card button:not([disabled])').first().click();
}

test('Hot-Seat: Vorhut, Gesandtschaft und eine taktische Aktion mit Bewegung', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Partie starten' }).click();

  const phase = page.locator('.phases [aria-current="step"]');
  await expect(phase).toHaveText('Strategie');
  await expect(page.locator('.strategy-card')).toHaveCount(8);
  await pickCards(page);
  await expect(phase).toHaveText('Aktion');

  await page.getByRole('button', { name: 'Strategische Aktion: Vorhut' }).click();
  await expect(page.getByTestId('tokens-gained')).toHaveText('3');
  await page.getByRole('button', { name: 'Taktik +' }).click();
  await page.getByRole('button', { name: 'Taktik +' }).click();
  await page.getByRole('button', { name: 'Flotte +' }).click();
  await page.getByRole('button', { name: 'Ausführen' }).click();
  await expect(page.getByRole('heading', { name: /Sekundärfähigkeit/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();

  await page.getByRole('button', { name: 'Strategische Aktion: Gesandtschaft' }).click();
  await expect(page.getByLabel('System wählen')).toBeVisible();
  await page.getByRole('button', { name: 'Ausführen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();

  const target = await neighbourOfActiveHome(page);
  await target.click();
  await expect(page.getByText(/^Gewählt:/)).toBeVisible();
  await page.getByRole('button', { name: 'System aktivieren' }).click();
  await expect(page.getByRole('heading', { name: /Aktiviertes System/ })).toBeVisible();
  await page.locator('.ship-choices input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Schiffe bewegen' }).click();
  await expect(page.getByText(/Die Bewegung ist abgeschlossen/)).toBeVisible();

  const actorBefore = await page.getByTestId('actor').innerText();
  await page.getByRole('button', { name: 'Taktische Aktion beenden' }).click();
  await expect(page.getByTestId('actor')).not.toHaveText(actorBefore);

  await page.getByRole('button', { name: 'Zur Galaxie' }).click();
  await expect(page.getByRole('button', { name: 'Neue Galaxie' })).toBeVisible();
});
