import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

/*
 * Ein Tisch wie im echten Spiel: Jeder Mensch hat sein eigenes Gerät (hier einen eigenen
 * Browserkontext), der Gastgeber eröffnet eine private Lobby, die anderen treten mit dem Code bei.
 */

export const NAMES = ['Anna', 'Ben', 'Cleo'] as const;

export const phaseOf = (page: Page) => page.locator('.phases [aria-current="step"]');

/*
 * Geräte, die ein Test selbst öffnet, schließt Playwright nicht: Ihre Seiten zeichneten nach dem
 * Test weiter und bremsten alle folgenden Tests desselben Workers aus. Darum merkt sich jedes
 * Gerät seinen Test, und das erste Gerät eines neuen Tests schließt die der früheren.
 */
const devices = new Map<BrowserContext, string>();

async function closeEarlierDevices(current: string): Promise<void> {
  const earlier = [...devices].filter(([, owner]) => owner !== current).map(([context]) => context);
  for (const context of earlier) devices.delete(context);
  await Promise.all(earlier.map((context) => context.close()));
}

/** Ein frisches Gerät (eigener Browserkontext) für den laufenden Test. */
export async function newDevice(browser: Browser): Promise<Page> {
  const current = test.info().testId;
  await closeEarlierDevices(current);
  const context = await browser.newContext();
  devices.set(context, current);
  return context.newPage();
}

/** Ein eigenes Gerät mit eigenem Namen; die Hand liegt dort ausgeklappt. */
export async function openSeat(browser: Browser, name: string): Promise<Page> {
  const page = await newDevice(browser);
  await page.addInitScript(() => {
    if (localStorage.getItem('stellar.settings') === null)
      localStorage.setItem('stellar.settings', JSON.stringify({ handOpen: true }));
  });
  await page.goto('/');
  await page.getByLabel('Dein Name').fill(name);
  return page;
}

/** Ändert den Map-String der Galaxie, bevor die Partie eröffnet wird. */
export type MapEdit = (mapString: string) => string;

/** Spiralplätze, die einander berühren: Ring 2 Norden, Ring 3 Norden und sein Nachbar im Osten. */
const TOUCHING_HOMES = [7, 19, 20];

/** Legt die Heimat-Plätze (`H`) des Map-Strings auf drei einander berührende Felder. */
export function touchingHomes(mapString: string): string {
  const tokens = mapString.trim().split(/\s+/);
  for (const wanted of TOUCHING_HOMES) {
    const from = tokens.findIndex((token, at) => token === 'H' && !TOUCHING_HOMES.includes(at));
    if (tokens[wanted] === 'H' || from < 0) continue;
    [tokens[wanted], tokens[from]] = [tokens[from] ?? '.', tokens[wanted] ?? '.'];
  }
  return tokens.join(' ');
}

/** Der Gastgeber setzt die Galaxie über das Feld „Map-String“ und importiert sie. */
async function importMap(host: Page, edit: MapEdit): Promise<void> {
  const field = host.getByLabel('Map-String');
  await field.fill(edit(await field.inputValue()));
  await host.getByRole('button', { name: 'Importieren', exact: true }).click();
  await expect(host.locator('.map-panel .error')).toHaveCount(0);
}

/** Wählt in der Lobby die eigene Fraktion (über ihren deutschen Namen). */
export async function chooseFaction(page: Page, faction: string): Promise<void> {
  await page.getByRole('button', { name: 'Fraktion wählen' }).click();
  const draft = page.getByRole('dialog', { name: 'Fraktion wählen' });
  await draft.getByRole('radio', { name: faction }).click();
  await draft.getByRole('button', { name: 'Wählen' }).click();
  await expect(draft).toBeHidden();
}

/** Wählt die Fraktion des Platzes, falls der Test eine vorgibt. */
async function factionOf(page: Page, faction: string | undefined): Promise<void> {
  if (faction !== undefined) await chooseFaction(page, faction);
}

/**
 * Gastgeber eröffnet, Gäste treten bei, der Gastgeber startet; freie Plätze übernimmt die KI.
 * Mit `edit` legt der Gastgeber vorher eine eigene Galaxie aus, mit `factions` wählt jeder Mensch
 * seine Fraktion (in Platzreihenfolge).
 */
export async function openTable(
  browser: Browser,
  humans = 3,
  players = 3,
  edit?: MapEdit,
  factions: readonly string[] = [],
): Promise<Page[]> {
  const host = await openSeat(browser, NAMES[0]);
  await host.getByLabel('Spieler').selectOption(String(players));
  if (edit !== undefined) await importMap(host, edit);
  await host.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await factionOf(host, factions[0]);
  const code = (await host.getByTestId('lobby-code').textContent()) ?? '';
  const pages = [host];
  for (const name of NAMES.slice(1, humans)) {
    const guest = await openSeat(browser, name);
    await guest.getByLabel('Lobbycode').fill(code);
    await guest.getByRole('button', { name: 'Beitreten' }).click();
    await expect(host.getByTestId(`lobby-seat-${String(pages.length)}`)).toContainText('verbunden');
    await factionOf(guest, factions[pages.length]);
    pages.push(guest);
  }
  await host.getByRole('button', { name: 'Partie starten' }).click();
  for (const page of pages)
    await expect(phaseOf(page)).toHaveText('Strategie', { timeout: 15_000 });
  return pages;
}

/** RR 12.20: jeder behält auf seinem Gerät einen der gezogenen geheimen Aufträge. */
export async function keepSecrets(pages: readonly Page[]): Promise<void> {
  for (const page of pages) {
    await page.locator('.secret-choice input[type="radio"]').first().press('Space');
    await page.getByRole('button', { name: 'Behalten' }).click();
  }
  for (const page of pages) await expect(page.locator('.secret-choice')).toHaveCount(0);
}

type Find = (page: Page) => Locator;

async function firstVisible(pages: readonly Page[], locator: Find): Promise<Page | null> {
  for (const page of pages) if (await locator(page).first().isVisible()) return page;
  return null;
}

/** Die Seite, auf der `locator` als Erstes sichtbar wird: dort ist der Mensch am Zug. */
export async function whereVisible(pages: readonly Page[], locator: Find): Promise<Page> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const page = await firstVisible(pages, locator);
    if (page !== null) return page;
    await pages[0]?.waitForTimeout(100);
  }
  throw new Error('auf keinem Gerät sichtbar');
}

/** Die Seite des Menschen, der gerade am Zug ist (Leiste oben: „Am Zug: Name“). */
export async function actorPage(pages: readonly Page[]): Promise<Page> {
  const actor = (await pages[0]?.getByTestId('actor').innerText()) ?? '';
  const index = NAMES.findIndex((name) => actor.includes(name));
  const page = pages[index];
  if (page === undefined) throw new Error(`niemand am Zug: ${actor}`);
  return page;
}

/** Eine wählbare Strategiekarte in der Hand, die nicht gerade ausfliegt. */
export const freePick = (page: Page) =>
  page.locator('.hand-card.playable[data-kind="pick"]:not([data-leaving])');

/** Wer gerade wählt, nimmt die erste freie Strategiekarte. */
export async function pickFirstFree(pages: readonly Page[], count: number): Promise<void> {
  for (let pick = 0; pick < count; pick += 1) {
    const page = await whereVisible(pages, freePick);
    const before = await freePick(page).count();
    await freePick(page).first().click();
    await expect(freePick(page)).not.toHaveCount(before);
  }
}

/** Alle anderen lehnen die Sekundärfähigkeit nacheinander ab, jeder auf seinem Gerät. */
export async function declineSecondaries(pages: readonly Page[], count: number): Promise<void> {
  for (let decline = 0; decline < count; decline += 1) {
    const decline = (p: Page) => p.getByRole('button', { name: 'Ablehnen' });
    const page = await whereVisible(pages, decline);
    await decline(page).click();
    await expect(decline(page)).toHaveCount(0);
  }
}

/**
 * Die Schiffsliste der Bewegung liegt in der Ansage eingeklappt „Als Liste“ (der Tisch bewegt mit
 * den Flottengriffen); wer per Liste wählt, klappt sie zuerst auf.
 */
export async function openShipList(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Als Liste' });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(page.locator('.ship-choices')).toBeVisible();
}

/** Mittelpunkt eines Elements auf dem Bildschirm. */
export const center = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('nicht sichtbar');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Sitz (1-basiert) des Geräts am Tisch. */
export const seatOf = (pages: readonly Page[], page: Page) => String(pages.indexOf(page) + 1);

/** Ein Nachbarfeld der eigenen Heimat, ohne Anomalie und ohne fremde Heimat. */
export async function neighbourOfHome(page: Page, seat: string): Promise<Locator> {
  const home = await center(page.locator(`[data-seat="${seat}"]`));
  const hexes = page.locator('[data-system]:not([data-anomaly]):not([data-seat])');
  const centers = await Promise.all((await hexes.all()).map(center));
  const distances = centers.map((c) => Math.hypot(c.x - home.x, c.y - home.y));
  const step = Math.min(...distances);
  const index = distances.findIndex((distance) => distance < step * 1.1);
  return hexes.nth(index);
}

/** Das eigene Heimatsystem wählen und aktivieren (Klick auf das Feld, dann „System aktivieren“). */
export async function activateHome(page: Page, pages: readonly Page[]): Promise<void> {
  await page.locator(`[data-seat="${seatOf(pages, page)}"]`).click();
  await page.getByRole('button', { name: 'System aktivieren', exact: true }).click();
}

/** Auf dem Gerät, das die Karte gerade wählen darf, genau diese Strategiekarte nehmen. */
export async function pickCard(pages: readonly Page[], name: string): Promise<void> {
  const page = await whereVisible(pages, freePick);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
}

/** Ein Nachbarfeld der eigenen Heimat wie `neighbourOfHome`, aber mit mindestens einem Planeten. */
export async function neighbourWithPlanet(page: Page, seat: string): Promise<Locator> {
  const home = await center(page.locator(`[data-seat="${seat}"]`));
  const hexes = page.locator('[data-system]:not([data-anomaly]):not([data-seat])');
  const centers = await Promise.all((await hexes.all()).map(center));
  const distances = centers.map((c) => Math.hypot(c.x - home.x, c.y - home.y));
  const step = Math.min(...distances);
  const planets = await Promise.all(
    (await hexes.all()).map(async (hex) => Number(await hex.getAttribute('data-planets'))),
  );
  const index = distances.findIndex(
    (distance, at) => distance < step * 1.1 && (planets[at] ?? 0) > 0,
  );
  if (index < 0) throw new Error('kein Nachbarfeld mit Planet');
  return hexes.nth(index);
}

/** Der Knopf eines Porträts links oben, gefunden über den Namen des Spielers. */
export const portraitTarget = (page: Page, name: string): Locator =>
  page.locator(`.hud-portrait > button[aria-label="${name}"]`);

/** Zieht ein Stück mit der Maus auf ein Ziel: drücken, in zwölf Schritten hinüber, loslassen. */
export async function dragOnto(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

/**
 * Zieht ein Stück auf ein Ziel, das erst beim Tragen erscheint (Bauplätze der Werft): drücken,
 * ein Stück anheben, auf das Ziel warten, hinüber und loslassen.
 */
export async function dragOntoShown(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await center(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 12, start.y - 12, { steps: 3 });
  await expect(to).toBeVisible();
  const end = await center(to);
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}
