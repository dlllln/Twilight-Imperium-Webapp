import { expect, test } from '@playwright/test';
import { keepSecrets, openTable } from './table.ts';

test('original faction and unit images load in the simulator on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Kampfsimulator' }).click();
  await page.getByRole('radio', { name: 'Handelsbund von Sel' }).click();
  const portrait = page.getByRole('img', { name: 'Emirate von Hacan', exact: true });
  await expect(portrait).toHaveAttribute('src', '/ti4/factions/hacan-back.jpg');
  await expect
    .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const grid = await page.locator('.faction-grid').boundingBox();
      return grid === null ? Infinity : grid.x + grid.width;
    })
    .toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Wählen', exact: true }).click();
  const miniatures = page.locator('.ship-card img[src^="/ti4/units/"]');
  await expect(miniatures).toHaveCount(6);
  for (const image of await miniatures.all()) {
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test('packaged original card images load in a real online hand without external image hosts', async ({
  browser,
}) => {
  const pages = await openTable(browser, 1);
  const [host] = pages;
  if (host === undefined) throw new Error('Host page missing');
  const secretArt = host.locator('.secret-choice img[src^="/ti4/cards/"]');
  await expect(secretArt.first()).toBeVisible();
  await keepSecrets(pages);
  const strategyArt = host.locator('.hand-dock img[src^="/ti4/cards/strategy/"]');
  await expect(strategyArt.first()).toBeVisible();
  await expect
    .poll(() =>
      strategyArt.evaluateAll((images) =>
        images.every(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  const external = await host.evaluate(() =>
    Array.from(document.images)
      .filter(
        (image) =>
          new URL(image.src).origin !== window.location.origin && !image.src.startsWith('data:'),
      )
      .map((image) => image.src),
  );
  expect(external).toEqual([]);
});
