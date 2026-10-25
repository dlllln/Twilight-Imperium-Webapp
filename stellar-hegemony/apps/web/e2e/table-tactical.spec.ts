import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  actorPage,
  declineSecondaries,
  keepSecrets,
  neighbourWithPlanet,
  openShipList,
  openTable,
  phaseOf,
  pickCard,
  pickFirstFree,
  seatOf,
} from './table.ts';

/*
 * Die taktische Aktion und die Diplomatie auf der Karte: Ein System wird auf der Karte gewählt,
 * Bodentruppen werden als Figuren aufgenommen und auf einem leuchtenden Planeten abgelegt.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

/** Ohne Führung im Spiel: Wer die Diplomatie hält, ist als Erster am Zug. */
const WITHOUT_LEADERSHIP = [
  'Diplomatie',
  'Politik',
  'Konstruktion',
  'Handel',
  'Kriegsführung',
  'Technologie',
];

/** Wie viele eigene Kommandomarker auf der Karte liegen (Pult: „Auf der Karte: n“). */
async function onBoard(page: Page): Promise<number> {
  const text = (await page.locator('.sheet-onboard').textContent()) ?? '';
  return Number(/\d+/.exec(text)?.[0] ?? Number.NaN);
}

/**
 * Wartet, bis `next` oder der Knopf `skip` erscheint; erscheint der Knopf, wird der Schritt
 * ausgelassen. So wartet der Test auf den Stand, statt ihn zu früh abzufragen.
 */
async function skipUntil(page: Page, skip: string, next: Locator): Promise<void> {
  const button = page.getByRole('button', { name: skip });
  await expect(next.or(button).first()).toBeVisible();
  if (await button.isVisible()) await button.click();
}

/**
 * Liegt der Geist in seiner Mitte zuoberst, nicht unter einer Flottenfigur? Geister lassen Zeiger
 * durch; für die Probe fängt der Geist sie kurz selbst, sonst fände `elementFromPoint` ihn nie.
 */
const onTop = (ghost: Locator): Promise<boolean> =>
  ghost.evaluate((element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    element.style.pointerEvents = 'auto';
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    element.style.pointerEvents = '';
    return hit !== null && element.contains(hit);
  });

/** Der Geist steht im gewählten System, ist mindestens 40px groß und liegt sichtbar obenauf. */
async function expectGhostIn(ghost: Locator, system: string): Promise<void> {
  await expect(ghost).toHaveAttribute('data-system', system);
  expect((await ghost.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(await onTop(ghost)).toBe(true);
}

test('Tischansicht: Diplomatie wählt das System auf der Karte', async ({ browser }) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  for (const name of WITHOUT_LEADERSHIP) await pickCard(pages, name);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const diplomat = await actorPage(pages);
  await diplomat.getByRole('button', { name: 'Strategische Aktion: Diplomatie' }).click();
  // Zu Beginn ist nur die eigene Heimat wählbar, und sie ist schon vorgewählt.
  const system = diplomat.locator('polygon.target-legal, polygon.target-chosen').first();
  await system.click();
  await expect(system).toHaveClass(/target-chosen/);
  // Per Tastatur wählt Enter dasselbe System; die Geister stehen genau darin.
  await system.focus();
  await system.press('Enter');
  const chosen = (await system.getAttribute('data-system')) ?? '';
  const ghosts = diplomat.locator('.token-ghost');
  await expect(ghosts).toHaveCount(2);
  for (const ghost of await ghosts.all()) await expectGhostIn(ghost, chosen);
  const others = pages.filter((page) => page !== diplomat);
  const before = await Promise.all(others.map(onBoard));
  await diplomat.getByRole('button', { name: 'Ausführen' }).click();
  // Die Vorschau weicht den echten Markern: Jeder andere hat jetzt einen mehr auf der Karte.
  await expect(ghosts).toHaveCount(0);
  for (const [index, page] of others.entries())
    await expect(page.locator('.sheet-onboard')).toHaveText(
      `Auf der Karte: ${String((before[index] ?? 0) + 1)}`,
    );
  await declineSecondaries(pages, 2);
});

test('Tischansicht: Bodentruppen landen über Figur und grünen Ring', async ({ browser }) => {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  await pickFirstFree(pages, 6);
  const active = await actorPage(pages);
  const target = await neighbourWithPlanet(active, seatOf(pages, active));
  await target.click();
  await active.getByRole('button', { name: 'System aktivieren', exact: true }).click();
  await openShipList(active);
  await active
    .locator('.ship-choices li', { hasText: 'Träger' })
    .first()
    .locator('input')
    .first()
    .check();
  // Fracht kann auch ein Jäger sein; geladen wird ausdrücklich ein Infanterist.
  await active.locator('.cargo li', { hasText: 'Infanterie' }).first().locator('input').check();
  await active.getByRole('button', { name: 'Schiffe bewegen' }).click();
  const figure = active.locator('[data-piece^="unit:"]').first();
  await skipUntil(active, 'Ohne Bombardement weiter', figure);
  await figure.click();
  const ring = active.locator('svg .site-target[data-target-state="legal"]').first();
  await ring.click();
  await expect(active.locator('[data-piece^="unit:"][data-assigned]')).toHaveCount(1);
  await active.getByRole('button', { name: 'Landen' }).click();
  const end = active.getByRole('button', { name: 'Taktische Aktion beenden' });
  await skipUntil(active, 'Ohne Produktion weiter', end);
  const actor = await active.getByTestId('actor').innerText();
  await end.click();
  await expect(active.getByTestId('actor')).not.toHaveText(actor);
});
