import { expect, test } from '@playwright/test';
import { keepSecrets, openTable, phaseOf, pickFirstFree } from './table.ts';

test('the hand displays complete original scans at their real proportions, with no thumbnail or replacement face', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1);
  if (page === undefined) throw new Error('Missing seat');
  await keepSecrets([page]);
  const warfare = page.locator('.hand-card[data-kind="pick"][data-look="warfare"]');
  await expect(warfare.locator('.hand-original-face .ti4-complete-card img')).toHaveAttribute(
    'src',
    '/ti4/cards/strategy/6.png',
  );
  await expect(warfare.locator('.hand-art, .hand-print-copy, .hand-print-frame')).toHaveCount(0);
  await warfare.hover();
  await expect
    .poll(() =>
      warfare.locator('.ti4-complete-card').evaluate((scan) => {
        const box = scan.getBoundingClientRect();
        return box.width / box.height;
      }),
    )
    .toBeCloseTo(1, 2);
  await expect
    .poll(() => warfare.evaluate((card) => getComputedStyle(card).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)');
  await expect
    .poll(() => warfare.evaluate((card) => getComputedStyle(card).backgroundImage))
    .toBe('none');
  await expect(warfare.locator('.hand-initiative')).toHaveCount(0);
  const agent = page.locator('.hand-card[data-kind="leader"]').first();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Tab');
  await agent.focus();
  await expect.poll(async () => (await agent.boundingBox())?.width ?? 0).toBeGreaterThan(160);
  await expect
    .poll(() =>
      agent.locator('.ti4-complete-card').evaluate((scan) => {
        const box = scan.getBoundingClientRect();
        return box.width / box.height;
      }),
    )
    .toBeCloseTo(1.5, 2);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.mouse.move(0, 0);
  await pickFirstFree([page], 2);
  await expect(phaseOf(page)).toHaveText('Aktion');
  const tactical = page.locator('.hand-card[data-kind="tactical"]');
  await expect(tactical).toBeVisible();
  await expect(tactical.locator('img')).toHaveCount(0);
  await expect(page.locator('.hand-card[data-kind="pass"] img')).toHaveCount(0);
});
