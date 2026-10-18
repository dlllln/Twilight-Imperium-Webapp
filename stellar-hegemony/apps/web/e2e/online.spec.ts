import { type Browser, expect, type Page, test } from '@playwright/test';

async function openPage(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Dein Name').fill(name);
  return page;
}

const phaseOf = (page: Page) => page.locator('.phases [aria-current="step"]');

async function keepSecret(page: Page) {
  await page.locator('.secret-choice input[type="radio"]').first().press('Space');
  await page.getByRole('button', { name: 'Behalten' }).click();
  await expect(page.locator('.secret-choice')).toHaveCount(0);
}

async function pickIfAllowed(page: Page) {
  const free = page.locator('.hand-card[data-kind="pick"]:not([data-leaving])').first();
  if (await free.isVisible()) await free.click();
}

/** Wer gerade wählen darf, nimmt die erste freie Strategiekarte; die KI wählt selbst. */
async function pickUntilAction(host: Page, guest: Page) {
  for (let round = 0; round < 60; round += 1) {
    if ((await phaseOf(host).textContent()) === 'Aktion') return;
    await pickIfAllowed(host);
    await pickIfAllowed(guest);
    await host.waitForTimeout(200);
  }
}

test('Private Lobby: Code, Fraktionswahl je Gerät, KI auf dem freien Platz, Reconnect nach Neuladen', async ({
  browser,
}) => {
  const host = await openPage(browser, 'Anna');
  await host.getByLabel('Spieler').selectOption('3');
  await host.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  const code = (await host.getByTestId('lobby-code').textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  const guest = await openPage(browser, 'Ben');
  await guest.getByLabel('Lobbycode').fill(code);
  await guest.getByRole('button', { name: 'Beitreten' }).click();
  await expect(guest.getByText('Warte, bis der Gastgeber die Partie startet …')).toBeVisible();
  await expect(host.getByTestId('lobby-seat-1')).toContainText('verbunden');
  await expect(host.getByTestId('lobby-seat-2')).toContainText('frei, sonst KI');

  await guest.getByRole('button', { name: 'Fraktion wählen' }).click();
  const draft = guest.getByRole('dialog', { name: 'Fraktion wählen' });
  await draft.getByRole('radio').nth(3).click();
  await draft.getByRole('button', { name: 'Wählen' }).click();
  await expect(draft).toBeHidden();
  await expect(host.getByTestId('lobby-seat-1')).not.toContainText('Fraktion noch offen');
  await expect(host.getByTestId('lobby-seat-0')).toContainText('Fraktion noch offen');

  await host.getByRole('button', { name: 'Partie starten' }).click();
  for (const page of [host, guest]) {
    await expect(phaseOf(page)).toHaveText('Strategie');
    await expect(page.locator('.player-list .bot-badge')).toHaveCount(1);
  }
  await keepSecret(host);
  await keepSecret(guest);

  await pickUntilAction(host, guest);
  for (const page of [host, guest]) {
    await expect(phaseOf(page)).toHaveText('Aktion', { timeout: 15_000 });
    await expect(page.locator('.strategy-card .swatch')).toHaveCount(6);
  }

  await guest.reload();
  await expect(phaseOf(guest)).toHaveText('Aktion', { timeout: 15_000 });
  await expect(guest.locator('.secret-choice')).toHaveCount(0);
  await expect(host.locator('.player-list .offline-badge')).toHaveCount(0);
});
