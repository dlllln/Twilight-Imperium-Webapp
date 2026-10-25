import { type Browser, expect, type Locator, type Page, test } from '@playwright/test';
import {
  actorPage,
  dragOnto,
  keepSecrets,
  openShipList,
  openTable,
  phaseOf,
  pickCard,
  pickFirstFree,
  seatOf,
  touchingHomes,
} from './table.ts';

/*
 * Kampfmatte (RR 63, RR 89.1): Zwei Menschen (Nekro und Hacan), deren Heimatsysteme aneinanderstoßen.
 * Wer zuerst am Zug ist, fliegt mit der ganzen Flotte in die Heimat des anderen. Der Kampf liegt als Matte in
 * der Mitte, kein Dialog verdeckt die Karte. Wer Treffer verteilen muss, nimmt rote Stifte aus
 * dem Kasten und legt sie mit Ziehen oder der Tastatur auf seine Schiffe; „Vorschlag“ stellt die
 * Stifte der Domain wieder her, das Siegel bestätigt.
 */

// Zwei Geräte mit Software-Rendering und ein ganzer Kampf; der Ablauf braucht Luft.
test.describe.configure({ timeout: 240_000 });

const HITS = '.battle-mat[data-deciding="hits"]';

/**
 * Beide Seiten mit fünf bis sechs Schiffen, aber ohne Zerstörer (Sperrfeuer trifft nur Jäger und
 * wird zwangsweise zugewiesen) und ohne Weltraumkanonen in der Heimat. Die erste Salve mit Treffern
 * lässt damit stets die Wahl, wohin sie geht, statt eine Flotte auf einen Schlag zu tilgen.
 */
const SIDES = ['Nekro-Virus', 'Emirate von Hacan'];

/** Zwei Menschen und eine KI bis in die Aktionsphase; der Erste greift die Heimat des Zweiten an. */
async function attack(browser: Browser): Promise<readonly Page[]> {
  const pages = await openTable(browser, 2, 3, touchingHomes, SIDES);
  await keepSecrets(pages);
  // Wer zuerst wählt, nimmt Führung und ist damit zuerst am Zug.
  await pickCard(pages, 'Führung');
  await pickFirstFree(pages, 3);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const attacker = await actorPage(pages);
  const defender = pages.find((page) => page !== attacker) ?? attacker;
  await attacker.locator(`[data-seat="${seatOf(pages, defender)}"]`).click();
  await attacker.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  // Nur die Schiffe selbst (direkte Einträge); geladene Fracht schiebt sich als Unterliste dazwischen.
  await openShipList(attacker);
  const ships = attacker.locator('.ship-choices > li > label > input');
  await expect(ships.first()).toBeVisible();
  for (let ship = 0; ship < (await ships.count()); ship += 1) await ships.nth(ship).check();
  await attacker.getByRole('button', { name: 'Schiffe bewegen' }).click();
  return pages;
}

/** Ein Gerät: Liegen Stifte bereit? Eine Rückzugsfrage beantwortet „Weiterkämpfen“. */
async function pegsOn(page: Page): Promise<boolean> {
  if (await page.locator(HITS).isVisible()) return true;
  const fight = page.getByTestId('confirm').filter({ hasText: 'Weiterkämpfen' });
  if (await fight.isVisible()) await fight.click();
  return false;
}

/** Das erste Gerät, auf dem Stifte bereitliegen, oder `null`. */
async function firstWithPegs(pages: readonly Page[]): Promise<Page | null> {
  for (const page of pages) if (await pegsOn(page)) return page;
  return null;
}

/** Bis auf einem Gerät Treffer zu verteilen sind. */
async function untilPegs(pages: readonly Page[]): Promise<Page> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const page = await firstWithPegs(pages);
    if (page !== null) return page;
    await pages[0]?.waitForTimeout(150);
  }
  throw new Error('niemand musste Treffer verteilen');
}

const pegCount = (page: Page) => page.getByTestId('hit-count');

/** Tippt ein Schiff an, bis keine Stifte mehr darin stecken. */
async function clearShip(ship: Locator): Promise<void> {
  for (let turn = 0; turn < 4 && (await ship.getAttribute('data-mark')) !== 'none'; turn += 1)
    await ship.click();
}

/** Schiffe der Matte mit Schaden, als Vergleichswert vor und nach dem Bestätigen. */
async function fleetOf(mat: Locator): Promise<string> {
  const ships = await mat.locator('[data-unit]').all();
  const marks = ships.map(async (ship) =>
    [await ship.getAttribute('data-unit'), await ship.getAttribute('data-damaged')].join(':'),
  );
  return (await Promise.all(marks)).join(',');
}

/** Der erste Stift mit der Maus, alle weiteren per Tastatur (Kasten Enter, Schiff Enter). */
async function placePegs(page: Page, mat: Locator, needed: number): Promise<void> {
  const ships = mat.locator('button.mat-ship-target');
  const pile = mat.getByRole('button', { name: 'Trefferstift aufnehmen' });
  await dragOnto(page, pile, ships.first());
  await expect(pegCount(page)).toHaveText('1');
  await expect(ships.first()).not.toHaveAttribute('data-mark', 'none');
  for (let peg = 1; peg < needed; peg += 1) {
    await pile.focus();
    await pile.press('Enter');
    await mat.locator('button.mat-ship-target[data-target-state="legal"]').first().press('Enter');
    await expect(pegCount(page)).toHaveText(String(peg + 1));
  }
  await expect(pile).toHaveCount(0);
}

test('Tischansicht: Trefferstifte auf der Kampfmatte ziehen, legen und bestätigen', async ({
  browser,
}) => {
  const page = await untilPegs(await attack(browser));
  const mat = page.getByRole('region', { name: 'Kampfmatte' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const meter = (await pegCount(page).locator('..').textContent()) ?? '';
  const needed = Number(/\/\s*(\d+)/.exec(meter)?.[1]);
  expect(needed).toBeGreaterThan(0);
  await expect(pegCount(page)).toHaveText(String(needed));
  const ships = mat.locator('button.mat-ship-target');
  const suggested = await Promise.all(
    (await ships.all()).map((ship) => ship.getAttribute('data-mark')),
  );

  // Alle Stifte heraus (Antippen schaltet weiter), dann neu legen.
  for (const ship of await ships.all()) await clearShip(ship);
  await expect(pegCount(page)).toHaveText('0');
  await placePegs(page, mat, needed);

  // „Vorschlag“ stellt die Stifte der Domain wieder her; das Siegel bestätigt.
  await page.getByRole('button', { name: 'Vorschlag' }).click();
  for (const [index, mark] of suggested.entries())
    await expect(ships.nth(index)).toHaveAttribute('data-mark', mark ?? 'none');
  const before = await fleetOf(mat);
  await page.getByTestId('confirm').filter({ hasText: 'Treffer bestätigen' }).click();
  // Die Treffer wirken: ein Schiff ist beschädigt oder fort.
  await expect.poll(() => fleetOf(mat)).not.toBe(before);
});
