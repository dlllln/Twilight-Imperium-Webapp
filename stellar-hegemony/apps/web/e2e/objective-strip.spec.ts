import { expect, type Locator, type Page, test } from '@playwright/test';
import { keepSecrets, openTable } from './table.ts';

/*
 * Auftragsleiste: Die aufgedeckten öffentlichen Aufträge und der eigene geheime liegen oben in der
 * Mitte des Tisches, ohne Spielerleiste und Vorrat zu verdecken. Die klassische Ansicht behält
 * ihre Seitenleiste und zeigt keine Leiste.
 */

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

const boxOf = async (locator: Locator): Promise<Box> => {
  const found = await locator.boundingBox();
  if (found === null) throw new Error('nicht sichtbar');
  return found;
};

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('Auftragsleiste: öffentliche Aufträge und der eigene geheime liegen auf dem Tisch, nicht in der klassischen Ansicht', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1);
  if (page === undefined) throw new Error('kein Gerät');
  await keepSecrets([page]);
  const strip = page.getByRole('region', { name: 'Aufträge auf dem Tisch' });
  await expect(strip).toBeVisible();
  const revealed = strip.locator('[data-category="public"][data-revealed="true"]');
  await expect(revealed.first()).toBeVisible();
  await expect(strip.locator('[data-category="secret"]')).toHaveCount(1);
  await expect(strip.locator('[data-category="secret"]')).toBeVisible();

  // Weder Spielerleiste (links oben) noch Vorrat (rechts oben) liegen unter den Karten.
  const cards = await boxOf(strip.locator('.objective-strip-cards'));
  expect(overlaps(cards, await boxOf(page.locator('.hud-players')))).toBe(false);
  expect(overlaps(cards, await boxOf(page.locator('.tabletop-supply')))).toBe(false);
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  const settings = page.getByRole('button', { name: 'Einstellungen' });
  const tableView = page.getByRole('switch', { name: 'Tischansicht' });
  await settings.click();
  await tableView.click();
  await expect(strip).toHaveCount(0);
  await tableView.click();
  await expect(strip).toBeVisible();
  await page.keyboard.press('Escape');

  // Hochkant auf dem Telefon: eingeklappt hinter einem Schalter, ohne seitliches Scrollen.
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = strip.getByRole('button', { name: 'Aufträge' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(strip.locator('.objective-strip-cards')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(strip.locator('[data-category="secret"]')).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
});

/** Breiten, auf denen Leiste und Spalte der Meldungen nebeneinander am oberen Rand liegen. */
const WIDE_TABLES = [1101, 1200, 1280, 1366, 1415, 1440];

/**
 * Die höchste Oberkante, bis zu der die Spalte der Meldungen wachsen darf: Unterkante minus
 * berechnete Höchsthöhe. Die Höchsthöhe ist in Prozent angegeben; die Spalte wird dafür kurz
 * übergroß gesetzt, ihre dann begrenzte Höhe ist die Höchsthöhe in Pixeln.
 */
const highestCornerTop = (page: Page) =>
  page.evaluate(() => {
    const corner = document.querySelector<HTMLElement>('.hud-corner');
    if (corner === null) throw new Error('keine Spalte der Meldungen');
    const height = corner.style.height;
    corner.style.height = '100000px';
    const { bottom, height: maxHeight } = corner.getBoundingClientRect();
    corner.style.height = height;
    return bottom - maxHeight;
  });

test('Auftragsleiste und Spalte der Meldungen überschneiden sich auf keiner Breite', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1);
  if (page === undefined) throw new Error('kein Gerät');
  await keepSecrets([page]);
  const cards = page.locator('.objective-strip-cards');
  const corner = page.locator('.hud-corner');
  for (const width of WIDE_TABLES) {
    await page.setViewportSize({ width, height: 800 });
    await expect(cards).toBeVisible();
    const strip = await boxOf(cards);
    expect(overlaps(strip, await boxOf(corner)), `Breite ${String(width)}`).toBe(false);
    const top = await highestCornerTop(page);
    expect(top, `Breite ${String(width)}`).toBeGreaterThanOrEqual(strip.y + strip.height);
  }
});
