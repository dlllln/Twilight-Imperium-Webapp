import { expect, type Page, test } from '@playwright/test';
import {
  actorPage,
  center,
  keepSecrets,
  neighbourOfHome,
  openTable,
  phaseOf,
  pickFirstFree,
  seatOf,
} from './table.ts';

/*
 * Entscheidungen am Tisch statt in Fenstern: Marker werden auf dem Pult verteilt, und ein
 * Taktikmarker wird auf ein System gelegt, mit der Maus wie mit der Tastatur.
 */

// Drei Geräte mit Software-Rendering teilen sich den Rechner; der Ablauf braucht Luft.
test.describe.configure({ timeout: 180_000 });

/** Drei Menschen bis in die Aktionsphase; zurück kommt das Gerät, das am Zug ist. */
async function actionPhase(browser: Parameters<typeof openTable>[0]) {
  const pages = await openTable(browser);
  await keepSecrets(pages);
  await pickFirstFree(pages, 6);
  for (const page of pages) await expect(phaseOf(page)).toHaveText('Aktion');
  const active = await actorPage(pages);
  return { pages, active };
}

const activated = (page: Page) => page.getByRole('heading', { name: /Aktiviertes System/ });

test('Tischansicht: Führung wird auf dem Pult verteilt, ohne Entscheidungsfenster', async ({
  browser,
}) => {
  const { active: leader } = await actionPhase(browser);
  await leader.getByRole('button', { name: 'Strategische Aktion: Führung' }).click();
  await expect(leader.locator('.notice.decision')).toHaveCount(0);
  await expect(leader.getByLabel('Neue Marker: 3')).toBeVisible();
  await leader.locator('[data-piece="pool:loose"]').click();
  await leader.locator('[data-target="pool:fleet"]').click();
  await leader.getByRole('button', { name: 'Taktik +' }).click();
  await leader.getByRole('button', { name: 'Taktik +' }).click();
  await leader.getByRole('button', { name: 'Ausführen' }).click();
  await expect(leader.getByRole('button', { name: 'Ausführen' })).toHaveCount(0);
  await expect(leader.getByLabel('Flotte: 4')).toBeVisible();
});

test('Tischansicht: Taktikmarker auf ein Nachbarsystem ziehen aktiviert es', async ({
  browser,
}) => {
  const { pages, active } = await actionPhase(browser);
  const target = await neighbourOfHome(active, seatOf(pages, active));
  const from = await center(active.locator('[data-piece="pool:tactic"]'));
  const to = await center(target);
  await active.mouse.move(from.x, from.y);
  await active.mouse.down();
  await active.mouse.move(to.x, to.y, { steps: 12 });
  await active.mouse.up();
  await expect(activated(active)).toBeVisible();
  await active.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(activated(active)).toHaveCount(0);
});

test('Tastatur: Taktikmarker mit Enter aufnehmen und auf einem System ablegen', async ({
  browser,
}) => {
  const { pages, active } = await actionPhase(browser);
  const target = await neighbourOfHome(active, seatOf(pages, active));
  const piece = active.locator('[data-piece="pool:tactic"]');
  await piece.focus();
  await piece.press('Enter');
  await expect(piece).toHaveAttribute('aria-pressed', 'true');
  await target.focus();
  await target.press('Enter');
  await expect(activated(active)).toBeVisible();
});
