import { expect, type Page, test } from '@playwright/test';
import {
  actorPage,
  declineSecondaries,
  freePick,
  keepSecrets,
  NAMES,
  neighbourOfHome,
  openTable,
  phaseOf,
  pickFirstFree,
  seatOf,
  whereVisible,
} from './table.ts';

/*
 * Drei Menschen, drei Geräte: Jeder sieht nur seine eigene Hand und entscheidet nur auf
 * seinem Gerät. Ein Gerät pro Mensch, wie im echten Spiel.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

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

/** Auf dem Gerät, das die Karte gerade wählen darf, genau diese Karte nehmen. */
async function pickCard(pages: readonly Page[], name: string) {
  const page = await whereVisible(pages, freePick);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
}

async function startTable(browser: Parameters<typeof openTable>[0]) {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  return pages;
}

test('Lobby zu dritt: Führung, Diplomatie, taktische Aktion mit Rückgängig und Verlauf', async ({
  browser,
}) => {
  const pages = await startTable(browser);
  const [host] = pages as [Page];
  await expect(host.locator('.victory-track li')).toHaveCount(3);
  await expect(host.locator('.strategy-card')).toHaveCount(8);
  await pickFirstFree(pages, 6);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');

  const leader = await actorPage(pages);
  await leader.getByRole('button', { name: 'Strategische Aktion: Führung' }).click();
  await expect(leader.getByTestId('tokens-gained')).toHaveText('3');
  await leader.getByRole('button', { name: 'Taktik +' }).click();
  await leader.getByRole('button', { name: 'Taktik +' }).click();
  await leader.getByRole('button', { name: 'Flotte +' }).click();
  await leader.getByRole('button', { name: 'Ausführen' }).click();
  await declineSecondaries(pages, 2);

  const diplomat = await whereVisible(pages, (page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Diplomatie' }),
  );
  await diplomat.getByRole('button', { name: 'Strategische Aktion: Diplomatie' }).click();
  await expect(diplomat.getByLabel('System wählen')).toBeVisible();
  await diplomat.getByRole('button', { name: 'Ausführen' }).click();
  await declineSecondaries(pages, 2);

  const active = await actorPage(pages);
  const target = await neighbourOfHome(active, seatOf(pages, active));
  await target.click();
  await active.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  await expect(active.getByRole('heading', { name: /Aktiviertes System/ })).toBeVisible();
  await active.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(active.getByRole('heading', { name: /Aktiviertes System/ })).toHaveCount(0);

  await target.click();
  await active.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  await active.locator('.ship-choices input[type="checkbox"]').first().check();
  await active.getByRole('button', { name: 'Schiffe bewegen' }).click();
  await skipRemainingSteps(active);
  await expect(
    active.getByText(/Alle Schritte dieser taktischen Aktion sind erledigt/),
  ).toBeVisible();
  const actorBefore = await active.getByTestId('actor').innerText();
  await active.getByRole('button', { name: 'Taktische Aktion beenden' }).click();
  await expect(host.getByTestId('actor')).not.toHaveText(actorBefore);

  const watcher = pages.find((page) => page !== active) ?? host;
  await watcher.getByRole('tab', { name: 'Verlauf' }).click();
  const history = watcher.getByRole('tabpanel', { name: 'Verlauf' });
  await expect(history).toContainText('nimmt den letzten Schritt zurück');
  await expect(history).toContainText('bewegt');
});

test('Lobby zu dritt: Produktion im eigenen Heimatsystem', async ({ browser }) => {
  const pages = await startTable(browser);
  await pickFirstFree(pages, 6);
  const active = await actorPage(pages);
  const actor = await active.getByTestId('actor').innerText();
  await active.locator(`[data-seat="${seatOf(pages, active)}"]`).click();
  await active.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  await active.getByRole('button', { name: 'Ohne Bewegung weiter' }).click();
  await expect(active.getByRole('heading', { name: 'Produktion' })).toBeVisible();
  await active.getByRole('button', { name: 'Infanterie +' }).click();
  await active.getByRole('button', { name: 'Infanterie +' }).click();
  await expect(active.getByTestId('production-cost')).toHaveText('1');
  await active.locator('.planet-row [role="checkbox"]:not([data-value="0"])').first().click();
  await active.getByRole('button', { name: 'Produzieren' }).click();
  await expect(
    active.getByText(/Alle Schritte dieser taktischen Aktion sind erledigt/),
  ).toBeVisible();
  await active.getByRole('button', { name: 'Taktische Aktion beenden' }).click();
  await expect(active.getByTestId('actor')).not.toHaveText(actor);
});

test('Lobby zu dritt: Technologie bringt eine neue Technologie', async ({ browser }) => {
  const pages = await startTable(browser);
  await pickFirstFree(pages, 3);
  await pickCard(pages, 'Technologie');
  await pickFirstFree(pages, 2);

  const researcher = await whereVisible(pages, (page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Technologie' }),
  );
  const chips = researcher.locator('.tech-owners .tech-chip');
  const before = await chips.count();
  await researcher.getByRole('button', { name: 'Strategische Aktion: Technologie' }).click();
  await researcher.locator('.tech-option:not(.locked) input').first().check();
  await expect(researcher.getByTestId('paid')).toHaveCount(0);
  await researcher.getByRole('button', { name: 'Erforschen' }).click();
  await expect(chips).toHaveCount(before + 1);
  await declineSecondaries(pages, 2);
});

test('Lobby zu dritt: Politik bringt Aktionskarten, Wertung zeigt nur die eigenen Geheimaufträge', async ({
  browser,
}) => {
  const pages = await startTable(browser);
  await pickFirstFree(pages, 2);
  await pickCard(pages, 'Konstruktion');
  await pickCard(pages, 'Politik');
  await pickFirstFree(pages, 2);

  const politician = await whereVisible(pages, (page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Politik' }),
  );
  await expect(politician.locator('.hand-dock .action-card')).toHaveCount(0);
  await politician.getByRole('button', { name: 'Strategische Aktion: Politik' }).click();
  await politician.getByRole('button', { name: 'Ausführen' }).click();
  await expect(politician.locator('.hand-dock .action-card')).not.toHaveCount(0);
  const drawer = await whereVisible(pages, (page) => page.getByText('Du ziehst 2 Aktionskarten.'));
  await drawer.getByRole('button', { name: 'Ausführen' }).click();
  await expect(drawer.locator('.hand-dock .action-card')).not.toHaveCount(0);

  const other = pages.find((page) => page !== politician) ?? politician;
  await other.getByRole('tab', { name: 'Wertung' }).click();
  await expect(other.getByRole('heading', { name: /Geheime Aufträge von/ })).toBeVisible();
  const name = NAMES[pages.indexOf(other)] ?? '';
  await expect(other.getByRole('heading', { name: /Geheime Aufträge von/ })).toContainText(name);
});
