import { expect, type Page, test } from '@playwright/test';
import {
  activateHome,
  actorPage,
  center,
  declineSecondaries,
  dragOnto,
  dragOntoShown,
  keepSecrets,
  openTable,
  phaseOf,
  pickCard,
  pickFirstFree,
  whereVisible,
} from './table.ts';

/*
 * Die Werft am Tisch: Einheiten kommen aus der Werft der Ansage ins Dock oder auf einen Planeten
 * mit Produktion, bezahlt wird mit Planetenkarten. Dieselbe Werft dient der Kriegsführung
 * (sekundär) im Heimatsystem. Kein Popup, kein Formular.
 */

test.describe.configure({ timeout: 180_000 });

// Werft, Dock und Siegel stehen zugleich in der Ansage; dafür braucht die Ecke etwas Höhe.
test.use({ viewport: { width: 1440, height: 900 } });

const payWithPlanet = (page: Page) =>
  page.locator('.planet-row [role="checkbox"]:not([data-value="0"])').first().click();

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

test('Tischansicht: Werft – Infanterie ins Dock ziehen, eine auf einen Planeten legen und bezahlen', async ({
  browser,
}) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  await pickFirstFree(pages, 6);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const active = await actorPage(pages);
  await activateHome(active, pages);
  await active.getByRole('button', { name: 'Ohne Bewegung weiter' }).click();
  await expect(active.getByTestId('shipyard')).toBeVisible();
  await expect(active.locator('.notice.decision')).toHaveCount(0);
  await expect(active.locator('.production-form')).toHaveCount(0);

  // Die Werft rollt seitwärts: erst die Infanterie in den Blick holen.
  const infantry = active.locator('[data-piece="yard:infantry"]');
  await infantry.scrollIntoViewIfNeeded();
  await dragOnto(active, infantry, active.locator('[data-target="slot:dock"]'));
  await expect(active.getByTestId('dock-count')).toHaveText('1');
  const deploy = active.locator('svg .site-target[data-site-kind="deploy"]').first();
  await dragOntoShown(active, infantry, deploy);
  await expect(active.getByTestId('dock-count')).toHaveText('2');
  await expect(active.locator('svg .site-target[data-site-kind="deploy"]')).toHaveCount(0);
  await expect(active.getByTestId('production-cost')).toHaveText('1');

  const seal = active.getByRole('button', { name: 'Produzieren' });
  await expect(seal).toBeDisabled();
  await payWithPlanet(active);
  await seal.click();
  await expect(
    active.getByText(/Alle Schritte dieser taktischen Aktion sind erledigt/),
  ).toBeVisible();
});

test('Tischansicht: Kriegsführung sekundär baut in der Werft der Heimat', async ({ browser }) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  // Wer zuerst wählt, nimmt Führung und danach Kriegsführung und ist damit zuerst am Zug.
  await pickFirstFree(pages, 3);
  await pickCard(pages, 'Kriegsführung');
  await pickFirstFree(pages, 2);

  const play = (page: Page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Kriegsführung' });
  const holder = await whereVisible(pages, play);
  await play(holder).click();
  await holder.getByRole('button', { name: 'Ohne Marker ausführen' }).click();

  const others = pages.filter((page) => page !== holder);
  const follower = await whereVisible(others, (page) => page.locator('.secondary-socket'));
  await expect(follower.getByTestId('shipyard')).toBeVisible();
  await expect(follower.locator('.secondary-socket')).toContainText(
    'Kriegsführung – Kosten: 1 Strategiemarker',
  );
  await follower.getByRole('button', { name: 'Infanterie +' }).click();
  await expect(follower.getByTestId('production-cost')).toHaveText('1');
  await payWithPlanet(follower);
  // Folgen heißt: den obersten Strategiemarker vom Pult in den Sockel der Ansage legen.
  await dropTokenInSocket(follower);
  await expect(follower.locator('.secondary-socket')).toHaveCount(0);
  await declineSecondaries(pages, 1);
});
