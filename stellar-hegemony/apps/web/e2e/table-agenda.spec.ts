import { type Browser, expect, type Locator, type Page, test } from '@playwright/test';
import { chooseFaction, keepSecrets, NAMES, openSeat, phaseOf, pickCard } from './table.ts';

/*
 * Agendatisch (RR 2, RR 7): Erst nach der Landung auf der Thronwelt gibt es eine Agendaphase. Anna
 * spielt die Universitäten von Jol-Nar (fünf Einfluss daheim) gegen zwei KI-Gegner; ihre Heimat
 * liegt direkt neben der Thronwelt. Handel bringt drei Handelswaren, ein Träger bringt Infanterie
 * auf die Thronwelt, bezahlt mit Planeten und Münzen in der Kasse. In der Agendaphase liegt die
 * Agenda in der Mitte, darunter die Ergebnisplatten; Anna tippt eine Platte und ihre Planeten an,
 * die Stimmen stapeln sich auf der Platte, das Siegel gibt sie ab.
 */

// Ein ganzer Spielzug mit Taktik, Statusphase und Agenda; der Ablauf braucht Luft.
test.describe.configure({ timeout: 300_000 });

/** Spiralplatz 1 liegt im ersten Ring direkt an der Thronwelt (Platz 0). */
const BESIDE_THRONE = 1;

/** Legt die erste Heimat (Platz des Gastgebers) direkt neben die Thronwelt. */
function homeBesideThrone(mapString: string): string {
  const tokens = mapString.trim().split(/\s+/);
  const home = tokens.indexOf('H');
  if (home < 0) return mapString;
  [tokens[BESIDE_THRONE], tokens[home]] = [tokens[home] ?? '.', tokens[BESIDE_THRONE] ?? '.'];
  return tokens.join(' ');
}

/** Anna allein mit zwei KI-Gegnern, als Jol-Nar neben der Thronwelt, bis zu den Strategiekarten. */
async function openAgendaTable(browser: Browser): Promise<Page> {
  const page = await openSeat(browser, NAMES[0]);
  await page.getByLabel('Spieler').selectOption('3');
  const field = page.getByLabel('Map-String');
  await field.fill(homeBesideThrone(await field.inputValue()));
  await page.getByRole('button', { name: 'Importieren', exact: true }).click();
  await page.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await chooseFaction(page, 'Universitäten von Jol-Nar');
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(phaseOf(page)).toHaveText('Strategie', { timeout: 15_000 });
  return page;
}

const mine = (page: Page) => page.getByTestId('actor').filter({ hasText: NAMES[0] });

/** Ist Anna am Zug, ohne dass die Ansage etwas anderes verlangt? Fremde Sekundärfähigkeiten lehnt sie ab. */
async function idleTurn(page: Page): Promise<boolean> {
  const decline = page.getByRole('button', { name: 'Ablehnen' });
  if (await decline.isVisible()) await decline.click();
  const kind = await page.getByTestId('decision').getAttribute('data-kind');
  return kind === 'idle' && (await mine(page).isVisible());
}

/** Wartet, bis Anna wieder frei am Zug ist. */
async function myTurn(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (await idleTurn(page)) return;
    await page.waitForTimeout(200);
  }
  throw new Error('Anna kommt nicht an die Reihe');
}

/** Klickt einen Knopf, falls er da ist (Schritte ohne Wahl). */
async function skipIf(button: Locator, next: Locator): Promise<void> {
  await expect(next.or(button).first()).toBeVisible();
  if (await button.isVisible()) await button.click();
}

/** Träger mit Infanterie auf die Thronwelt; bezahlt mit allen Planeten und Münzen in der Kasse. */
async function landOnThrone(page: Page): Promise<void> {
  await page.locator('[data-system="thronwelt"]').first().click();
  await page.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  const carrier = page.locator('.ship-choices li', { hasText: 'Träger' }).first();
  await carrier.locator('input').first().check();
  await carrier.locator('.cargo li', { hasText: 'Infanterie' }).first().locator('input').check();
  await page.getByRole('button', { name: 'Schiffe bewegen' }).click();
  const figure = page.locator('[data-piece^="unit:"]').first();
  await skipIf(page.getByRole('button', { name: 'Ohne Bombardement weiter' }), figure);
  await figure.click();
  await page.locator('svg .site-target[data-target-state="legal"]').first().click();
  await payThrone(page);
  const end = page.getByRole('button', { name: 'Taktische Aktion beenden' });
  await skipIf(page.getByRole('button', { name: 'Ohne Produktion weiter' }), end);
  await end.click();
}

/** Alle bereiten Planeten und so viele Münzen, bis „Landen“ bereit ist. */
async function payThrone(page: Page): Promise<void> {
  const cards = page.locator('.planet-row [role="checkbox"][aria-checked="false"]');
  await expect(cards.first()).toBeVisible();
  while ((await cards.count()) > 0) await cards.first().click();
  const land = page.getByTestId('confirm').filter({ hasText: 'Landen' });
  for (let coin = 0; coin < 6 && (await land.isDisabled()); coin += 1)
    await page.getByRole('button', { name: 'Kasse +' }).click();
  await land.click();
}

/** Führung primär: alle neuen Marker auf die Taktikleiste. */
async function leadership(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Strategische Aktion: Führung' }).click();
  const free = page.getByTestId('free-tokens');
  while ((await free.textContent()) !== '0')
    await page.getByRole('button', { name: 'Taktik +' }).click();
  await page.getByRole('button', { name: 'Ausführen' }).click();
}

/** Klickt einen sichtbaren, bereiten Knopf; fehlt er, wird nicht auf ihn gewartet. */
async function clickReady(button: Locator): Promise<void> {
  if ((await button.isVisible()) && (await button.isEnabled())) await button.click();
}

/**
 * Bis zur Agendaphase: fremde Sekundärfähigkeiten ablehnen, in der Statusphase neue Marker auf die
 * Taktikleiste und jedes bereite Siegel bestätigen.
 */
async function untilAgenda(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if ((await phaseOf(page).textContent()) === 'Agenda') return;
    const decline = page.getByRole('button', { name: 'Ablehnen' });
    if (await decline.isVisible()) await decline.click();
    await clickReady(page.getByRole('button', { name: 'Taktik +' }));
    await clickReady(page.getByTestId('confirm'));
    await page.waitForTimeout(250);
  }
}

/**
 * Nach der Stimmabgabe: Stimmen gezählt, Agenda entschieden (nächste Agenda oder Phase vorbei)
 * oder noch nichts. Fragt nur ab, was gerade da ist, ohne auf Elemente zu warten.
 */
async function afterVote(
  table: Locator,
  tally: Locator,
  agenda: string | null,
  counted: string,
): Promise<string> {
  const shown = await table
    .locator('.agenda-flip')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-agenda')));
  if (shown[0] !== agenda) return 'decided';
  return (await tally.allTextContents()).includes(counted) ? 'counted' : 'pending';
}

test('Tischansicht: auf den Ergebnisplatten des Agendatischs abstimmen', async ({ browser }) => {
  const page = await openAgendaTable(browser);
  await keepSecrets([page]);
  await pickCard([page], 'Handel');
  await pickCard([page], 'Führung');
  await expect(phaseOf(page)).toHaveText('Aktion');

  await myTurn(page);
  await page.getByRole('button', { name: 'Strategische Aktion: Handel' }).click();
  await page.getByRole('button', { name: 'Ausführen', exact: true }).click();
  await myTurn(page);
  await landOnThrone(page);
  await myTurn(page);
  await leadership(page);
  await myTurn(page);
  await page.getByRole('button', { name: 'Passen', exact: true }).first().click();
  await untilAgenda(page);

  const table = page.getByRole('region', { name: 'Agendatisch' });
  await expect(table).toBeVisible();
  await expect(mine(page)).toBeVisible({ timeout: 60_000 });
  const plates = table.locator('button.outcome-plate:not([disabled])');
  await expect(plates.first()).toBeVisible();
  const plate = plates.first();
  const outcome = (await plate.getAttribute('data-outcome')) ?? '';
  await plate.click();
  await expect(plate).toHaveAttribute('aria-pressed', 'true');
  const cards = page.locator('.planet-row [role="checkbox"]');
  await cards.first().click();
  await expect(plate.getByTestId('plate-pending').locator('.plate-chip')).toHaveCount(1);
  const votes = Number(await page.getByTestId('vote-total').textContent());
  expect(votes).toBeGreaterThan(0);
  const tally = table.getByTestId(`plate-votes-${outcome}`);
  const before = Number(/\d+/.exec((await tally.textContent()) ?? '')?.[0]);
  const agenda = await table.locator('.agenda-flip').getAttribute('data-agenda');
  await page.getByTestId('confirm').filter({ hasText: 'Abstimmen' }).click();
  // Die Stimmen liegen auf der Platte; stimmte Anna als Letzte (Sprecherin), ist die Agenda entschieden.
  const counted = `${String(before + votes)} Stimmen`;
  await expect.poll(() => afterVote(table, tally, agenda, counted)).toMatch(/^(counted|decided)$/);
});
