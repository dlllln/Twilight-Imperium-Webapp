import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  actorPage,
  center,
  declineSecondaries,
  dragOnto,
  keepSecrets,
  openTable,
  phaseOf,
  pickCard,
  portraitTarget,
  whereVisible,
} from './table.ts';

/*
 * Menschen am Tisch: Bei der Politik wandert der Sprechermarker per Ziehen auf das Porträt des
 * neuen Sprechers; wer danach der Karte folgt, sieht in der Ansage, was ihn das kostet.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

/**
 * Trägt den Strategiemarker über den Sockel, ohne loszulassen: Der Geist liegt sichtbar und
 * mittig unter dem Zeiger, und an dieser Stelle ist er das oberste Element (nichts verdeckt ihn).
 */
async function hoverSocket(page: Page, token: Locator, socket: Locator): Promise<void> {
  const start = await center(token);
  const end = await center(socket);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  const point = await center(socket);
  await page.mouse.move(point.x, point.y, { steps: 2 });
  const ghost = page.locator('.drag-ghost');
  await expect(ghost).toBeVisible();
  const middle = await center(ghost);
  expect(Math.abs(middle.x - point.x)).toBeLessThanOrEqual(12);
  expect(Math.abs(middle.y - point.y)).toBeLessThanOrEqual(12);
  const onTop = await page.evaluate(({ x, y }) => {
    const element = document.querySelector<HTMLElement>('.drag-ghost');
    if (element === null) return false;
    element.style.pointerEvents = 'auto';
    const hit = document.elementFromPoint(x, y)?.closest('.drag-ghost') != null;
    element.style.pointerEvents = '';
    return hit;
  }, point);
  expect(onTop).toBe(true);
}

/** Ohne Führung und Diplomatie im Spiel: Wer die Politik hält, ist als Erster am Zug. */
const POLITICS_FIRST = [
  'Politik',
  'Konstruktion',
  'Handel',
  'Kriegsführung',
  'Technologie',
  'Imperium',
];

test('Tischansicht: Politik – der Sprechermarker wandert auf ein anderes Porträt', async ({
  browser,
}) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  for (const name of POLITICS_FIRST) await pickCard(pages, name);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const politician = await actorPage(pages);
  await politician.getByRole('button', { name: 'Strategische Aktion: Politik' }).click();
  // Die Gruppe besitzt die Porträts der Kandidaten über aria-owns; sie liegen in der Leiste.
  await expect(politician.getByRole('radiogroup', { name: 'Neuer Sprecher' })).toHaveAttribute(
    'aria-owns',
    /portrait-radio-/,
  );
  const radios = politician.locator('.hud-players [role="radio"]');
  await expect(radios.and(politician.locator('[aria-checked="true"]'))).toHaveCount(1);
  // Nicht der vorgewählte, sondern der andere mögliche Sprecher.
  const target = radios.and(politician.locator('[aria-checked="false"]')).first();
  const name = (await target.getAttribute('aria-label')) ?? '';
  await dragOnto(politician, politician.locator('[data-piece="speaker:token"]'), target);
  await expect(portraitTarget(politician, name)).toHaveAttribute('aria-checked', 'true');
  await politician.getByRole('button', { name: 'Ausführen' }).click();
  const holder = politician.locator(`li.hud-portrait:has(> button[aria-label="${name}"])`);
  await expect(holder.locator('.speaker-token')).toHaveCount(1);
  await expect(politician.locator('.speaker-token')).toHaveCount(1);
  const others = pages.filter((page) => page !== politician);
  const follower = await whereVisible(others, (page) => page.locator('.secondary-socket'));
  await expect(follower.locator('.secondary-socket')).toContainText(
    'Politik – Kosten: 1 Strategiemarker',
  );
  // Folgen heißt: den obersten Strategiemarker vom Pult in den Sockel der Ansage legen.
  const socket = follower.locator('[data-target="slot:socket"]');
  await hoverSocket(follower, follower.locator('[data-piece="pool:strategy"]'), socket);
  await follower.mouse.up();
  await expect(follower.locator('.secondary-socket')).toHaveCount(0);
  await declineSecondaries(pages, 1);
});
