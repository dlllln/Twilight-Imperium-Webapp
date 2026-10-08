import { expect, test } from '@playwright/test';
import { chooseFactions } from './draft.ts';

test('Galaxie wird angezeigt, neu erzeugt und per Map-String importiert', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hex')).toHaveCount(37);
  await expect(page.locator('.tile-home')).toHaveCount(6);

  await page.getByLabel('Spieler').selectOption('3');
  await expect(page.locator('.tile-home')).toHaveCount(3);

  await page.locator('[data-slot="0,0"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('Thronwelt Aurum');

  const mapString = page.locator('#map-string');
  await mapString.fill('thronwelt b01 b02 r01 b03 r02 b04 H . . . H . . . H . . . H');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.locator('.tile-home')).toHaveCount(4);
  await expect(page.locator('.hex')).toHaveCount(11);

  await mapString.fill('thronwelt b01 b01');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.getByRole('alert')).toContainText('doppelt');

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'New galaxy' })).toBeVisible();
});

test('Anleitung führt durch die Oberfläche; Einstellungen bleiben nach dem Neuladen', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Anleitung' }).click();
  const guide = page.getByRole('dialog', { name: 'Anleitung' });
  await expect(guide).toContainText('Willkommen');
  await guide.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.locator('[data-tutorial="galaxy"]')).toHaveClass(/tutorial-focus/);
  await guide.getByRole('button', { name: 'Schließen' }).click();
  await expect(guide).toBeHidden();

  const settings = page.getByRole('button', { name: 'Einstellungen' });
  const animations = page.getByRole('switch', { name: 'Animationen' });
  await settings.click();
  await animations.click();
  await expect(page.locator('html')).toHaveClass(/motion-off/);
  await page.reload();
  await settings.click();
  await expect(animations).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('html')).toHaveClass(/motion-off/);
});

test('Ein Klick zeigt die Knöpfe am System, Ansehen zoomt ohne Fenster hinein; Mausrad und Escape fahren zurück', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Partie starten' }).click();
  await chooseFactions(page);
  await page.locator('[data-seat="1"][data-system]').click();
  await page.getByRole('button', { name: 'System ansehen' }).click();
  const view = page.getByRole('region', { name: 'Systemansicht' });
  await expect(view).toBeVisible();
  await expect(view.getByRole('list', { name: 'Im System' })).toContainText('Raumdock');
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await page.locator('[data-seat="1"][data-system]').click();
  await expect(view).toBeVisible();
  await view.hover();
  await page.mouse.wheel(0, 200);
  await expect(view).toBeHidden();
  const zoomIn = page.getByRole('button', { name: 'Hineinzoomen' });
  for (let step = 0; step < 5; step += 1) await zoomIn.click();
  await expect(view).toBeVisible();
  await view.getByRole('button', { name: 'Zur Sternenkarte' }).click();
  await expect(view).toBeHidden();
});
