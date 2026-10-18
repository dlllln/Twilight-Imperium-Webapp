import { expect, test, type Page } from '@playwright/test';

const expectNoOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
};

test('Startansicht bleibt auf schmalen Handys lesbar und die Lobby erreichbar', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Die Galaxie wartet.' })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoOverflow(page);
    const bounds = await page.locator('.galaxy').boundingBox();
    expect(bounds?.width).toBeGreaterThan(280);
    expect(bounds?.height).toBeGreaterThanOrEqual(320);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Dein Name').fill('Nova');
  await page.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await expect(page.getByTestId('lobby-code')).toBeVisible();
  await expectNoOverflow(page);
  await expect(page.getByRole('button', { name: 'Fraktion wählen', exact: true })).toBeVisible();
  await context.close();
});

test('Auf dem Handy bleiben Zuganzeige und beide Kommandopultansichten im Bildschirm', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Dein Name').fill('Nova');
  await page.getByLabel('Spieler').selectOption('3');
  await page.getByRole('button', { name: 'Online-Partie eröffnen' }).click();
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await page.locator('.secret-choice input[type=radio]').first().press('Space');
  await page.getByRole('button', { name: 'Behalten', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Dein Kommandopult' })).toBeVisible();
  await expectNoOverflow(page);
  const actor = await page.getByTestId('actor').boundingBox();
  expect(actor).not.toBeNull();
  expect((actor?.x ?? 0) + (actor?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('switch', { name: 'Tischansicht' }).click();
  await expect(page.locator('.hud-resources')).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoOverflow(page);
  await context.close();
});

test('Weltraumbewegungen respektieren den Schalter und den Systemwunsch nach weniger Bewegung', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  const orbit = page.locator('.astral-orbit');
  await expect(orbit).toHaveCSS('animation-name', 'orbital-drift');
  await page.locator('.galaxy').hover();
  await expect(orbit).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('heading', { name: 'Stellar Hegemony' }).hover();
  await expect(orbit).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('switch', { name: 'Animationen' }).click();
  await expect(orbit).toHaveCSS('animation-name', 'none');
  await page.reload();
  await expect(orbit).toHaveCSS('animation-name', 'none');
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const quiet = await reduced.newPage();
  await quiet.goto('/');
  await expect(quiet.locator('.astral-orbit')).toHaveCSS('animation-name', 'none');
  await expect(quiet.locator('.mission-orbit')).toHaveCSS('animation-name', 'none');
  await reduced.close();
});
