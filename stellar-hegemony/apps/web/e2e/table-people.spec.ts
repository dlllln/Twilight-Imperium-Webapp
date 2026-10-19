import { expect, test } from '@playwright/test';
import {
  actorPage,
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
  await dragOnto(follower, follower.locator('[data-piece="pool:strategy"]'), socket);
  await expect(follower.locator('.secondary-socket')).toHaveCount(0);
  await declineSecondaries(pages, 1);
});
