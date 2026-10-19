import { expect, type Page, test } from '@playwright/test';
import { actorPage, keepSecrets, openTable, phaseOf, pickFirstFree } from './table.ts';

/*
 * Bezahlen am Tisch: Die eigenen Planeten liegen als Karten über dem Schatzflügel. Antippen merkt
 * sie vor, das Siegel erschöpft sie; danach liegen sie quer.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

/** Drei Menschen bis in die Aktionsphase; zurück kommt das Gerät, das am Zug ist. */
async function actionPhase(browser: Parameters<typeof openTable>[0]): Promise<Page> {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  await pickFirstFree(pages, 6);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  return actorPage(pages);
}

const planetCards = (page: Page) => page.locator('.planet-row [role="checkbox"]');

/** Die Werte der angebotenen Planetenkarten, in ihrer Reihenfolge. */
const cardValues = (page: Page) =>
  planetCards(page).evaluateAll((cards) =>
    cards.map((card) => Number(card.getAttribute('data-value'))),
  );

test('Tischansicht: Führung mit Einflussplaneten bezahlen', async ({ browser }) => {
  const leader = await actionPhase(browser);
  await leader.getByRole('button', { name: 'Strategische Aktion: Führung' }).click();
  await expect(planetCards(leader).first()).toBeVisible();
  const values = await cardValues(leader);
  for (let index = 0; index < values.length; index += 1) {
    await planetCards(leader).nth(index).click();
    await expect(planetCards(leader).nth(index)).toHaveAttribute('aria-checked', 'true');
  }
  const influence = values.reduce((sum, value) => sum + value, 0);
  const gained = 3 + Math.floor(influence / 3);
  await expect(leader.getByTestId('tokens-gained')).toHaveText(String(gained));
  const free = leader.getByTestId('free-tokens');
  await expect(free).toHaveText(String(gained));
  for (let token = 1; token <= gained; token += 1) {
    await leader.getByRole('button', { name: 'Taktik +' }).click();
    await expect(free).toHaveText(String(gained - token));
  }
  await leader.getByRole('button', { name: 'Ausführen' }).click();
  const exhausted = leader.locator('[data-planet][data-exhausted="true"]');
  await expect(exhausted).toHaveCount(values.length);
  await expect(exhausted.first()).toBeVisible();
});
