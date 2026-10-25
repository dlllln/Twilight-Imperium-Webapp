import { expect, type Page, test } from '@playwright/test';
import {
  actorPage,
  dragOnto,
  keepSecrets,
  NAMES,
  openTable,
  phaseOf,
  pickCard,
  pickFirstFree,
  portraitTarget,
  whereVisible,
} from './table.ts';

/*
 * Handeln am Tisch (RR 82): Die Handelsmatte liegt nur, wenn es Nachbarn gibt. Am Anfang einer
 * frischen Partie zu dritt ist niemand Nachbar (die Heimatsysteme liegen nicht nebeneinander,
 * geprüft über viele zufällige Karten); dann liegt weder die Matte noch eine Münze oder Kiste
 * zum Aufnehmen bereit. Mit einer eigenen Galaxie, in der alle Heimatsysteme aneinanderstoßen,
 * zieht der Aktive eine Kiste auf das Bild eines Nachbarn, und der nimmt das Angebot an.
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

test('Tischansicht: ohne Nachbarn liegt weder Handelsmatte noch Münze zum Aufnehmen', async ({
  browser,
}) => {
  const page = await actionPhase(browser);
  const prompt = page.getByTestId('decision');
  await expect(prompt).toHaveAttribute('data-kind', 'idle');
  await expect(prompt).toBeVisible();
  await expect(page.locator('.trade-mat')).toHaveCount(0);
  await expect(page.locator('details.transaction')).toHaveCount(0);
  // Außerhalb einer Bezahlung liegen Waren nur zum Handeln bereit; ohne Nachbarn also keine.
  await expect(page.locator('.planet-row:not([data-mode="rest"])')).toHaveCount(0);
  await expect(page.locator('[data-piece^="goods:"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rohstoff aufnehmen' })).toHaveCount(0);
  await expect(page.locator('.portrait-trade-mark')).toHaveCount(0);
});

/** Spiralplätze, die einander berühren: Ring 2 Norden, Ring 3 Norden und sein Nachbar im Osten. */
const TOUCHING_HOMES = [7, 19, 20];

/** Legt die Heimat-Plätze (`H`) des Map-Strings auf drei einander berührende Felder. */
function touchingHomes(mapString: string): string {
  const tokens = mapString.trim().split(/\s+/);
  for (const wanted of TOUCHING_HOMES) {
    const from = tokens.findIndex((token, at) => token === 'H' && !TOUCHING_HOMES.includes(at));
    if (tokens[wanted] === 'H' || from < 0) continue;
    [tokens[wanted], tokens[from]] = [tokens[from] ?? '.', tokens[wanted] ?? '.'];
  }
  return tokens.join(' ');
}

/**
 * Handel primär: Der Aktive füllt Münzen und Rohstoffe auf, sein Zug endet. Wer als Nächster am
 * Zug ist, folgt (füllt seine Rohstoffe auf), der Dritte lehnt ab. Zurück kommt das Gerät dessen,
 * der jetzt am Zug ist.
 */
async function tradeRound(pages: readonly Page[]): Promise<Page> {
  const holder = await actorPage(pages);
  await holder.getByRole('button', { name: 'Strategische Aktion: Handel' }).click();
  await holder.getByRole('button', { name: 'Ausführen', exact: true }).click();
  await expect(holder.getByTestId('actor')).not.toContainText(NAMES[pages.indexOf(holder)] ?? '');
  const next = await actorPage(pages);
  for (let turn = 0; turn < 2; turn += 1) {
    const page = await whereVisible(pages, (p) => p.getByRole('button', { name: 'Ablehnen' }));
    const answer = page === next ? 'Ausführen' : 'Ablehnen';
    await page.getByRole('button', { name: answer, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ablehnen' })).toHaveCount(0);
  }
  return next;
}

test('Tischansicht: Rohstoffkiste auf das Bild eines Nachbarn ziehen, anbieten und annehmen lassen', async ({
  browser,
}) => {
  const pages = await openTable(browser, 3, 3, touchingHomes);
  await keepSecrets(pages);
  // Wer zuerst wählt, nimmt Handel und danach Führung und ist damit zuerst am Zug.
  for (const name of ['Handel', 'Kriegsführung', 'Technologie', 'Führung'])
    await pickCard(pages, name);
  await pickFirstFree(pages, 2);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const holder = await actorPage(pages);
  const trader = await tradeRound(pages);

  // Alle Heimatsysteme stoßen aneinander: Der Dritte ist Nachbar und bekommt die Kiste.
  const partner = pages.find((page) => page !== holder && page !== trader) ?? trader;
  const name = NAMES[pages.indexOf(partner)] ?? '';
  await expect(trader.locator('.trade-mat')).toBeVisible();
  const crate = trader.locator('[data-piece="goods:commodities"]');
  await dragOnto(trader, crate, portraitTarget(trader, name));
  await expect(trader.locator('.trade-partner', { hasText: name }).locator('input')).toBeChecked();
  const given = trader.locator('.trade-mat [data-side="offer"] [data-good="commodities"] output');
  await expect(given).toHaveText('1');
  await trader.locator('.trade-mat').getByRole('button', { name: 'Angebot machen' }).click();

  // Rohstoffe werden beim Empfänger zu Handelswaren (RR 82.3).
  await expect(partner.getByTestId('goods-count')).toHaveText('0');
  await partner.getByRole('button', { name: 'Annehmen' }).click();
  await expect(partner.getByTestId('goods-count')).toHaveText('1');
});
