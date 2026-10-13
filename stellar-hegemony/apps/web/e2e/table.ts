import { type Browser, expect, type Locator, type Page } from '@playwright/test';

/*
 * Ein Tisch wie im echten Spiel: Jeder Mensch hat sein eigenes Gerät (hier einen eigenen
 * Browserkontext), der Gastgeber eröffnet eine private Lobby, die anderen treten mit dem Code bei.
 */

export const NAMES = ['Anna', 'Ben', 'Cleo'] as const;

export const phaseOf = (page: Page) => page.locator('.phases [aria-current="step"]');

/** Ein eigenes Gerät mit eigenem Namen; die Hand liegt dort ausgeklappt. */
export async function openSeat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
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
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Strategie');
  return pages;
}

/** RR 12.20: jeder behält auf seinem Gerät einen der gezogenen geheimen Aufträge. */
export async function keepSecrets(pages: readonly Page[]): Promise<void> {
  for (const page of pages) {
    await page.locator('.secret-choice input[type="checkbox"]').first().check();
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
