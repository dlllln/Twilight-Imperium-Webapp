import { expect, test } from '@playwright/test';

test('all 30 faction images load and every official edition is searchable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kampfsimulator' }).click();
  await expect(page.getByRole('radio')).toHaveCount(30);
  const edition = page.getByLabel('Fraktionsedition');
  for (const [id, count] of [
    ['base', 17],
    ['pok', 7],
    ['codex', 1],
    ['te', 5],
  ] as const) {
    await edition.selectOption(id);
    await expect(page.getByRole('radio')).toHaveCount(count);
  }
  await edition.selectOption('all');
  const search = page.getByLabel('Fraktionen suchen');
  await search.fill('Universities');
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('radio')).toHaveAccessibleName('Universitäten von Jol-Nar');
  await search.fill('');
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/ti4/factions/') && response.status() >= 400)
      failures.push(response.url());
  });
  for (const button of await page.getByRole('radio').all()) {
    const name = await button.getAttribute('aria-label');
    await button.click();
    await expect(page.getByRole('heading', { name: name ?? '', exact: true })).toBeVisible();
    const image = page.locator('.ti4-faction-illustration');
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true);
  }
  expect(failures).toEqual([]);
  await search.fill('Nomad');
  await page.getByRole('radio').click();
  await page.getByRole('button', { name: 'Wählen', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Flaggschiff', exact: true })).toBeVisible();
});
