import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    galaxyDrawCalls: number;
  }
}

test('Ausgewählte Galaxie ruht; Zoom und Ziehen zeichnen wieder und halten die Trefferflächen passend', async ({
  browser,
}) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('stellar.settings', JSON.stringify({ animations: true, handOpen: false }));
    window.galaxyDrawCalls = 0;
    for (const Type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      // Preserve the native method and supply its actual context with call below.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const original = Type.prototype.drawElements;
      Type.prototype.drawElements = function (mode, count, type, offset) {
        window.galaxyDrawCalls++;
        original.call(this, mode, count, type, offset);
      };
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Dein Name').fill('Rendering');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.locator('.secret-choice input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Behalten', exact: true }).click();
  const home = page.locator('[data-seat="1"][data-system]');
  await home.click();
  await page.mouse.move(10, 100);
  await page.waitForTimeout(3000);
  const idle = await page.evaluate(() => window.galaxyDrawCalls);
  expect(idle).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.galaxyDrawCalls)).toBe(idle);
  const density = await page
    .locator('.pixi-host canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.width / canvas.clientWidth);
  expect(density).toBeCloseTo(1.5, 2);
  await home.hover();
  const before = await home.boundingBox();
  if (before === null) throw new Error('Heimatsystem fehlt');
  await page.mouse.wheel(0, -240);
  await expect
    .poll(async () => (await home.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width * 1.3);
  expect(await page.evaluate(() => window.galaxyDrawCalls)).toBeGreaterThan(idle);
  await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
  await page.waitForTimeout(1000);
  const box = await page.locator('.galaxy').boundingBox();
  if (box === null) throw new Error('Karte fehlt');
  const x = box.x + box.width * 0.42;
  const y = box.y + box.height * 0.4;
  const prior = await home.boundingBox();
  if (prior === null) throw new Error('Heimatsystem fehlt');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 40, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await home.boundingBox())?.x ?? 0).toBeCloseTo(prior.x + 100, 0);
  await home.click();
  await expect(page.getByRole('button', { name: 'System ansehen' })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
