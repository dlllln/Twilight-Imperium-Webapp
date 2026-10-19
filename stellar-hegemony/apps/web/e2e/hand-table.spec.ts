import { expect, type Locator, test } from '@playwright/test';
import { freePick, keepSecrets, openTable, whereVisible } from './table.ts';

/*
 * Die Hand liegt am Tisch über dem Kommandopult: Keine Karte darf unter einem Flügel, dem Wappen
 * oder der Mulde verschwinden. Geprüft wird die Mitte des sichtbaren Teils jeder Karte; ganz
 * außen ragt der Fächer über den unteren Bildschirmrand hinaus.
 */

/** Ob ein Klick in die Mitte des sichtbaren Teils der Karte die Karte selbst trifft. */
const hitsItself = (card: Locator) =>
  card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const left = Math.max(box.left, 0);
    const right = Math.min(box.right, window.innerWidth);
    const top = Math.max(box.top, 0);
    const bottom = Math.min(box.bottom, window.innerHeight);
    const found = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    return found !== null && element.contains(found);
  });

test('Tischansicht 1440×900: jede Strategiekarte der Hand liegt über dem Pult und lässt sich anklicken', async ({
  browser,
}) => {
  const [page] = await openTable(browser, 1, 3);
  if (page === undefined) throw new Error('kein Gerät');
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSecrets([page]);
  await whereVisible([page], freePick);
  await expect(page.locator('.player-sheet')).toBeVisible();
  await page.mouse.move(4, 4);
  const count = await freePick(page).count();
  expect(count).toBeGreaterThan(1);
  for (let index = 0; index < count; index += 1) {
    const card = freePick(page).nth(index);
    await card.click({ trial: true });
    expect(await hitsItself(card), `Karte ${String(index + 1)} von ${String(count)}`).toBe(true);
  }
  await freePick(page).first().click();
  await expect.poll(() => freePick(page).count()).toBeLessThan(count);
});
