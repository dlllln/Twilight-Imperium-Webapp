import type { Page } from '@playwright/test';

/** Jeder Mensch am Bildschirm übernimmt die vorgeschlagene Fraktion. */
export async function chooseFactions(page: Page): Promise<void> {
  const draft = page.getByRole('dialog', { name: 'Fraktion wählen' });
  await draft.waitFor();
  while (await draft.isVisible()) await draft.getByRole('button', { name: 'Wählen' }).click();
}
