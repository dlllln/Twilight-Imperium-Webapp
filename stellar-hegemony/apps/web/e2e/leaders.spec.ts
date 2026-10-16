import { expect, test } from '@playwright/test';
import { TI4_FACTION_METADATA } from '@stellar/content';
import { keepSecrets, openSeat, phaseOf } from './table.ts';

test('every faction exposes its own original leader cards, including all three Nomad agents', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kampfsimulator' }).click();
  for (const faction of Object.values(TI4_FACTION_METADATA)) {
    await page.getByRole('radio', { name: faction.name.de, exact: true }).click();
    await page.getByRole('tab', { name: 'Anführer', exact: true }).click();
    const cards = page.locator('.faction-leader-cards .original-leader-card');
    await expect(cards).toHaveCount(faction.leaders.length);
    for (const leader of faction.leaders) {
      await page.getByText(`Originalkarte: ${leader.name}`, { exact: true }).click();
      const image = page.getByRole('img', {
        name: `${leader.name} · ${faction.name.de}`,
        exact: true,
      });
      await expect(image).toHaveAttribute('src', `/ti4/cards/leaders/${leader.sourceId}.png`);
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of await page.getByRole('tab').all()) {
    const bounds = await tab.boundingBox();
    expect(bounds === null ? Infinity : bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
});

test('Sol’s hand shows Evelyn’s own portrait and rules; inspecting a card does not play its adapted action', async ({
  browser,
}) => {
  const page = await openSeat(browser, 'Anna');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await page.getByRole('button', { name: 'Fraktion wählen', exact: true }).click();
  await page.getByRole('radio', { name: 'Föderation Sol', exact: true }).click();
  await page.getByRole('button', { name: 'Wählen', exact: true }).click();
  await expect(page.getByTestId('lobby-seat-0')).toContainText('Föderation Sol');
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await expect(phaseOf(page)).toHaveText('Strategie');
  await keepSecrets([page]);
  const agent = page
    .locator('.hand-dock')
    .getByRole('button', { name: 'Evelyn DeLouis', exact: true });
  await expect(agent.locator('img').first()).toHaveAttribute(
    'src',
    '/ti4/cards/leaders/solagent.png',
  );
  await expect(agent).toContainText('ground force rolls 1 additional die');
  await agent.click();
  const preview = page.locator('.leader-card-preview');
  await expect(
    preview.getByRole('img', { name: 'Evelyn DeLouis · Föderation Sol', exact: true }),
  ).toBeVisible();
  await expect(preview).toContainText('Webapp (vereinfacht)');
  await expect(
    preview.getByRole('button', { name: 'Vereinfachte Aktion ausführen' }),
  ).toBeDisabled();
  await preview.getByRole('button', { name: 'Schließen' }).click();
  await expect(agent).not.toContainText('erschöpft');
});
