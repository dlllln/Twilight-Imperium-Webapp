import { expect, type Page, test } from '@playwright/test';

/** Sicherung gegen Endlosschleifen: so viele Runden dauert kein Kampf. */
const MAX_ROUNDS = 40;

const more = (page: Page, ship: string) =>
  page.getByRole('listitem', { name: ship }).getByRole('button', { name: 'Mehr' });

test('Kampfsimulator: Fraktion wählen, Flotte bauen, kämpfen bis zum Ergebnis', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kampfsimulator' }).click();
  const simulator = page.getByRole('dialog', { name: 'Kampfsimulator' });
  await simulator.getByRole('radio', { name: 'Sternwacht Nesh' }).click();
  await expect(simulator.getByRole('heading', { name: 'Sternwacht Nesh' })).toBeVisible();
  await page.getByRole('button', { name: 'Wählen' }).click();

  await expect(page.getByRole('button', { name: 'Kampf!' })).toBeDisabled();
  for (const [ship, count] of [
    ['Kreuzer', 3],
    ['Träger', 1],
    ['Jäger', 2],
  ] as const)
    for (let step = 0; step < count; step += 1) await more(page, ship).click();
  await page.getByRole('button', { name: 'Kampf!' }).click();
  await expect(page.getByText('Raumkampf')).toBeVisible();
  await expect(page.getByTestId('fleet-you')).toContainText('3 Kreuzer');

  const result = page.getByRole('alert');
  const fire = page.getByRole('button', { name: 'Feuer!' });
  const ready = page.locator('.fire-button:enabled, .battle-result').first();
  const busy = page.locator('.fire-button:disabled, .battle-result').first();
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    await expect(ready).toBeVisible({ timeout: 15_000 });
    if (await result.isVisible()) break;
    await fire.click();
    await expect(busy).toBeVisible();
  }
  await expect(result).toContainText(/Sieg|Niederlage|Unentschieden/);
  await page.getByRole('button', { name: 'Simulator verlassen' }).first().click();
  await expect(simulator).toBeHidden();
});
