import { expect, type Page, test } from '@playwright/test';
import { center, keepSecrets, openTable, pickCard, pickFirstFree, whereVisible } from './table.ts';

/*
 * Forschungsauslage: Wer die Technologie spielt, wählt seine Technologie auf dem offenen
 * Kartentisch statt im Formular. Wer ihr folgt, wählt dort ebenso, bezahlt mit Planeten und legt
 * dann seinen Strategiemarker in den Sockel der Ansage.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

const spreadOf = (page: Page) => page.getByTestId('research-spread');

/** Eine offene Karte der Auslage ankreuzen; gesperrte sind nicht wählbar. */
async function chooseOpenCard(page: Page): Promise<void> {
  const locked = page.locator('.tech-option.locked input');
  if ((await locked.count()) > 0) await expect(locked.first()).toBeDisabled();
  await page.locator('.tech-option:not(.locked) input').first().check();
}

/** Angebotene Planeten der Reihe antippen, bis `needed` Ressourcen beisammen sind. */
async function payWithPlanets(page: Page, needed: number): Promise<boolean> {
  const cards = page.locator('.planet-row [role="checkbox"]:not([data-value="0"])');
  const values = await Promise.all(
    (await cards.all()).map(async (card) => Number(await card.getAttribute('data-value'))),
  );
  if (values.reduce((sum, value) => sum + value, 0) < needed) return false;
  let paid = 0;
  for (const [index, value] of values.entries()) {
    if (paid >= needed) break;
    await cards.nth(index).click();
    paid += value;
  }
  return true;
}

/**
 * Den obersten Strategiemarker in den Sockel legen. Kommen oder gehen währenddessen Meldungen
 * über der Ansage, rückt der Sockel mit: Darum wird sein Ort beim Tragen gemessen und direkt vor
 * dem Loslassen noch einmal nachgefasst.
 */
async function dropTokenInSocket(page: Page): Promise<void> {
  const socket = page.locator('[data-target="slot:socket"]');
  await expect(socket).toBeVisible();
  const start = await center(page.locator('[data-piece="pool:strategy"]'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const near = await center(socket);
  await page.mouse.move(near.x, near.y, { steps: 12 });
  const end = await center(socket);
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}

/** Wer folgt: Karte wählen, bezahlen und den Strategiemarker in den Sockel legen, sonst ablehnen. */
async function follow(page: Page): Promise<void> {
  await expect(page.locator('.secondary-socket')).toContainText(
    'Technologie – Kosten: 1 Strategiemarker',
  );
  await chooseOpenCard(page);
  const paid = await payWithPlanets(page, 4);
  if (!paid) {
    await expect(page.getByRole('button', { name: 'Erforschen' })).toBeDisabled();
    await page.getByRole('button', { name: 'Ablehnen' }).click();
    await expect(spreadOf(page)).toHaveCount(0);
    return;
  }
  await dropTokenInSocket(page);
  await expect(page.locator('.secondary-socket')).toHaveCount(0);
  await expect(spreadOf(page)).toHaveCount(0);
}

test('Tischansicht: Technologie in der Forschungsauslage erforschen und sekundär über den Sockel folgen', async ({
  browser,
}) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  await pickFirstFree(pages, 3);
  await pickCard(pages, 'Technologie');
  await pickFirstFree(pages, 2);

  const action = (page: Page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Technologie' });
  const researcher = await whereVisible(pages, action);
  const chips = researcher.locator('.tech-owners .tech-chip');
  const before = await chips.count();
  await action(researcher).click();
  await expect(spreadOf(researcher)).toBeVisible();
  await expect(researcher.locator('.notice.decision')).toHaveCount(0);
  await expect(researcher.locator('.technology-form')).toHaveCount(0);
  await chooseOpenCard(researcher);
  await expect(researcher.getByTestId('paid')).toHaveCount(0);
  await researcher.getByRole('button', { name: 'Erforschen' }).click();
  await expect(chips).toHaveCount(before + 1);
  await expect(spreadOf(researcher)).toHaveCount(0);

  // Beide Mitspieler folgen nacheinander, jeder auf seinem Gerät: bezahlen oder ablehnen.
  const others = pages.filter((page) => page !== researcher);
  for (let turn = 0; turn < others.length; turn += 1)
    await follow(await whereVisible(others, spreadOf));
  for (const page of pages) await expect(page.locator('.secondary-socket')).toHaveCount(0);
});
