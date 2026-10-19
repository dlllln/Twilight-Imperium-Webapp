import { expect, test } from '@playwright/test';
import {
  actorPage,
  keepSecrets,
  neighbourOfHome,
  openTable,
  phaseOf,
  pickFirstFree,
  seatOf,
} from './table.ts';

/*
 * Die Bewegung am Tisch: Die angetippte Flotte zeigt ihren Weg gestrichelt, „Fracht laden“ füllt
 * die Träger, und erst die Checkliste schickt alles gemeinsam ab.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 120_000 });

test('Tischansicht: Flotte antippen, Weg sehen, Fracht laden und gemeinsam bewegen', async ({
  browser,
}) => {
  const pages = await openTable(browser);
  try {
    await keepSecrets(pages);
    await pickFirstFree(pages, 6);
    for (const seated of pages) await expect(phaseOf(seated)).toHaveText('Aktion');
    const page = await actorPage(pages);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const seat = seatOf(pages, page);
    const home = page.locator(`polygon[data-seat="${seat}"][data-system]`);
    const origin = (await home.getAttribute('data-system')) ?? '';
    await (await neighbourOfHome(page, seat)).click();
    await page.getByRole('button', { name: 'System aktivieren', exact: true }).click();
    await page.locator(`.fleet-pickup[data-origin="${origin}"]`).click();
    await expect(page.locator('.move-path').first()).toBeVisible();
    await expect(page.locator(`.move-path[data-from="${origin}"]`)).toHaveCount(1);
    await page.getByRole('button', { name: 'Fracht laden', exact: true }).click();
    await expect(page.getByTestId('move-summary')).toHaveText(/Fracht [1-9]/);
    await expect(page.getByTestId('staged-summary')).toHaveText(/Fracht [1-9]/);
    await expect(page.locator('.history-list')).not.toContainText('bewegt');
    await page.getByRole('button', { name: 'Schiffe bewegen', exact: true }).click();
    await expect(page.locator('.move-path')).toHaveCount(0);
    await expect(page.locator('.history-list')).toContainText('bewegt');
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(pages.map((page) => page.context().close()));
  }
});
