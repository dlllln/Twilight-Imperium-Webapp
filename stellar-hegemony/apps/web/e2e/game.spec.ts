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

/** Bombardement, Landung und Produktion auslassen, falls das Zielsystem sie anbietet. */
async function skipRemainingSteps(page: Page) {
  for (const name of [
    'Ohne Bombardement weiter',
    'Ohne Landung weiter',
    'Ohne Produktion weiter',
  ]) {
    const button = page.getByRole('button', { name });
    if (await button.isVisible()) await button.click();
  }
}

/** RR 12.20: jeder Spieler behält einen der beiden gezogenen geheimen Aufträge. */
async function keepSecrets(page: Page) {
  for (let player = 0; player < 3; player += 1) {
    await page.locator('.secret-choice input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: 'Behalten' }).click();
  }
  await expect(page.locator('.secret-choice')).toHaveCount(0);
}

async function startThreePlayers(page: Page) {
  await page.goto('/');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await keepSecrets(page);
}

async function pickCards(page: Page) {
  for (let pick = 0; pick < 6; pick += 1)
    await page.locator('.strategy-card button:not([disabled])').first().click();
}

test('Hot-Seat: Vorhut, Gesandtschaft und eine taktische Aktion mit Bewegung', async ({ page }) => {
  await startThreePlayers(page);

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
  await skipRemainingSteps(page);
  await expect(
    page.getByText(/Alle Schritte dieser taktischen Aktion sind erledigt/),
  ).toBeVisible();

  const actorBefore = await page.getByTestId('actor').innerText();
  await page.getByRole('button', { name: 'Taktische Aktion beenden' }).click();
  await expect(page.getByTestId('actor')).not.toHaveText(actorBefore);

  await page.getByRole('button', { name: 'Zur Galaxie' }).click();
  await expect(page.getByRole('button', { name: 'Neue Galaxie' })).toBeVisible();
});

test('Hot-Seat: Produktion im eigenen Heimatsystem', async ({ page }) => {
  await startThreePlayers(page);
  await pickCards(page);

  const actor = await page.getByTestId('actor').innerText();
  const seat = /P(\d)/.exec(actor)?.[1] ?? '';
  await page.locator(`[data-seat="${seat}"]`).click();
  await page.getByRole('button', { name: 'System aktivieren' }).click();
  await page.getByRole('button', { name: 'Ohne Bewegung weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Produktion' })).toBeVisible();
  await page.getByRole('button', { name: 'Infanterie +' }).click();
  await page.getByRole('button', { name: 'Infanterie +' }).click();
  await expect(page.getByTestId('production-cost')).toHaveText('1');
  await page.locator('.payment input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Produzieren' }).click();
  await expect(
    page.getByText(/Alle Schritte dieser taktischen Aktion sind erledigt/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Taktische Aktion beenden' }).click();
  await expect(page.getByTestId('actor')).not.toHaveText(actor);
});

test('Hot-Seat: Forschung bringt eine neue Technologie', async ({ page }) => {
  await startThreePlayers(page);
  const free = page.locator('.strategy-card button:not([disabled])');
  for (let pick = 0; pick < 3; pick += 1) await free.first().click();
  await page.locator('.strategy-card button', { hasText: 'Forschung' }).click();
  for (let pick = 0; pick < 2; pick += 1) await free.first().click();

  const chips = page.locator('.tech-owners .tech-chip');
  const before = await chips.count();
  await page.getByRole('button', { name: 'Strategische Aktion: Forschung' }).click();
  await page.locator('.tech-option:not(.locked) input').first().check();
  await expect(page.getByTestId('paid')).toHaveCount(0);
  await page.getByRole('button', { name: 'Erforschen' }).click();
  await expect(page.getByRole('heading', { name: /Sekundärfähigkeit/ })).toBeVisible();
  await expect(chips).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
});

test('Hot-Seat: Aufträge und Siegpunkte sind sichtbar', async ({ page }) => {
  await startThreePlayers(page);
  await expect(page.locator('.victory-track li')).toHaveCount(3);
  await expect(page.locator('.objective-row .objective-card:not(.hidden)')).not.toHaveCount(0);
  await pickCards(page);
  await expect(page.getByRole('heading', { name: /Geheime Aufträge von/ })).toBeVisible();
});

test('Hot-Seat: der Senat bringt Aktionskarten auf die Hand', async ({ page }) => {
  await startThreePlayers(page);
  await expect(page.locator('.hand-panel')).toContainText('Keine Aktionskarten');
  const free = page.locator('.strategy-card button:not([disabled])');
  for (let pick = 0; pick < 2; pick += 1) await free.first().click();
  await page.locator('.strategy-card button', { hasText: 'Baukunst' }).click();
  await page.locator('.strategy-card button', { hasText: 'Senat' }).click();
  for (let pick = 0; pick < 2; pick += 1) await free.first().click();

  await page.getByRole('button', { name: 'Strategische Aktion: Senat' }).click();
  await page.getByRole('button', { name: 'Ausführen' }).click();
  await expect(page.getByText('Du ziehst 2 Aktionskarten.')).toBeVisible();
  await page.getByRole('button', { name: 'Ausführen' }).click();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.locator('[data-testid^="hand-p"]', { hasText: '▤ 2' })).toHaveCount(2);
  await expect(page.locator('.hand-panel .action-card')).not.toHaveCount(0);
});
