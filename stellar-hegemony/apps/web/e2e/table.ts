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

/** Gastgeber eröffnet, Gäste treten bei, der Gastgeber startet; freie Plätze übernimmt die KI. */
export async function openTable(browser: Browser, humans = 3, players = 3): Promise<Page[]> {
  const host = await openSeat(browser, NAMES[0]);
  await host.getByLabel('Spieler').selectOption(String(players));
  await host.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  const code = (await host.getByTestId('lobby-code').textContent()) ?? '';
  const pages = [host];
  for (const name of NAMES.slice(1, humans)) {
    const guest = await openSeat(browser, name);
    await guest.getByLabel('Lobbycode').fill(code);
    await guest.getByRole('button', { name: 'Beitreten' }).click();
    await expect(host.getByTestId(`lobby-seat-${String(pages.length)}`)).toContainText('verbunden');
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
