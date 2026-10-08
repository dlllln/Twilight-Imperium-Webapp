import { expect, test } from '@playwright/test';

test('KI-Gegner: zwei Bots wählen Strategiekarten und ziehen, bis der Mensch dran ist', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByLabel('KI-Gegner').selectOption('2');
  await page.getByRole('button', { name: 'Partie starten' }).click();

  await page.locator('.secret-choice input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Behalten' }).click();
  await expect(page.locator('.player-list .bot-badge')).toHaveCount(2);

  const phase = page.locator('.phases [aria-current="step"]');
  await expect(phase).toHaveText('Strategie');
  for (let pick = 0; pick < 2; pick += 1) {
    const free = page.locator('.hand-card[data-kind="pick"]:not([data-leaving])').first();
    await expect(free).toBeVisible();
    await free.click();
  }
  await expect(phase).toHaveText('Aktion', { timeout: 15_000 });
  await expect(page.locator('.strategy-card .swatch')).toHaveCount(6);
  await expect(page.getByTestId('actor')).toContainText('P1', { timeout: 30_000 });
  await expect(page.getByText('ist am Zug und überlegt …')).toHaveCount(0);
});
