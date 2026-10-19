import { expect, type Page, test } from '@playwright/test';
import {
  declineSecondaries,
  freePick,
  keepSecrets,
  openTable,
  pickFirstFree,
  whereVisible,
} from './table.ts';

/*
 * Infrastruktur am Tisch: Das Gebäude kommt aus dem Bauvorrat der Ansage auf einen leuchtenden
 * Bauplatz der Karte, das Siegel „Bauen“ schickt es ab. Kein Popup, kein Formular.
 */

test.describe.configure({ timeout: 180_000 });

/** Auf dem Gerät, das die Karte gerade wählen darf, genau diese Karte nehmen. */
async function pickCard(pages: readonly Page[], name: string) {
  const page = await whereVisible(pages, freePick);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
}

test('Lobby zu dritt: Konstruktion baut ein Gebäude aus dem Bauvorrat auf einem Bauplatz', async ({
  browser,
}) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  // Wer zuerst wählt, nimmt Führung und danach Konstruktion und ist damit zuerst am Zug.
  await pickFirstFree(pages, 3);
  await pickCard(pages, 'Konstruktion');
  await pickFirstFree(pages, 2);

  const play = (page: Page) =>
    page.getByRole('button', { name: 'Strategische Aktion: Konstruktion' });
  const builder = await whereVisible(pages, play);
  await play(builder).click();
  const prompt = builder.getByTestId('decision');
  await expect(prompt.getByRole('region', { name: 'Bauvorrat' })).toBeVisible();
  await expect(builder.locator('.notice.decision')).toHaveCount(0);

  const seal = prompt.getByRole('button', { name: 'Bauen' });
  await expect(seal).toBeDisabled();
  await builder.locator('[data-piece^="structure:"]').first().click();
  await builder.locator('svg .site-target[data-target-state="legal"]').first().click();
  await expect(builder.getByTestId('placed-count')).toHaveText('1');
  await seal.click();
  await expect(seal).toHaveCount(0);
  await declineSecondaries(pages, 2);
});
