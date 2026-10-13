import { expect, test } from '@playwright/test';
import { freePick, keepSecrets, openTable, phaseOf } from './table.ts';

test('Allein in der Lobby: zwei KI-Gegner wählen Strategiekarten und ziehen, bis der Mensch dran ist', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1);
  if (page === undefined) throw new Error('kein Gerät');
  await keepSecrets([page]);
  await expect(page.locator('.player-list .bot-badge')).toHaveCount(2);

  for (let pick = 0; pick < 2; pick += 1) {
    await expect(freePick(page).first()).toBeVisible({ timeout: 15_000 });
    await freePick(page).first().click();
  }
  await expect(phaseOf(page)).toHaveText('Aktion', { timeout: 15_000 });
  await expect(page.locator('.strategy-card .swatch')).toHaveCount(6);
  await expect(page.getByTestId('actor')).toContainText('Anna', { timeout: 30_000 });
  await expect(page.getByText('ist am Zug und überlegt …')).toHaveCount(0);
});
