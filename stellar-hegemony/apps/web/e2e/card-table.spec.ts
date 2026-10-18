import { expect, type Locator, type Page, test } from '@playwright/test';
import { openTable } from './table.ts';

const secretTable = (page: Page) => page.getByRole('dialog', { name: 'Geheime Aufträge wählen' });

async function expectOriginalCards(dialog: Locator): Promise<void> {
  const frames = dialog.locator('.ti4-complete-card');
  await expect(frames).toHaveCount(2);
  const images = frames.locator('img');
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0,
        ),
      ),
    )
    .toBe(true);
  for (const image of await images.all())
    await expect(image).toHaveAttribute('src', '/ti4/cards/objective-secret.jpg');
  for (const frame of await frames.all()) {
    // Layout dimensions ignore the deliberately tilted card's visual bounding box.
    const size = await frame.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    }));
    expect(size.width).toBeGreaterThan(160);
    expect(size.width / size.height).toBeCloseTo(2 / 3, 2);
  }
}

async function closeTable(pages: readonly Page[]): Promise<void> {
  await Promise.all(pages.map((page) => page.context().close()));
}

test('Originalkarten auf dem privaten Kartentisch wählen, per Tastatur wechseln und wirklich behalten', async ({
  browser,
}) => {
  const pages = await openTable(browser, 2);
  const [host, guest] = pages as [Page, Page];
  try {
    const dialog = secretTable(host);
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) =>
          element instanceof HTMLDialogElement && element.open && element.matches(':modal'),
      ),
    ).toBe(true);
    await expect(guest.locator('.secret-card')).toHaveCount(0);
    await expect(secretTable(guest)).toHaveCount(0);
    await expectOriginalCards(dialog);

    const radios = dialog.getByRole('radio');
    const confirm = dialog.getByRole('button', { name: 'Behalten', exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.locator('.secret-card-face').nth(0).click();
    await expect(radios.nth(0)).toBeChecked();
    await expect(confirm).toBeEnabled();
    await dialog.locator('.secret-card-face').nth(1).click();
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(0)).not.toBeChecked();

    await expect(host.locator('.galaxy')).toHaveAttribute('data-board-settled', 'true');
    const camera = host.locator('.galaxy > svg[aria-label="galaxy"] > g').first();
    const before = await camera.getAttribute('transform');
    await radios.nth(1).press('ArrowLeft');
    await expect(radios.nth(0)).toBeChecked();
    await expect(radios.nth(0)).toBeFocused();
    expect(await camera.getAttribute('transform')).toBe(before);
    await radios.nth(0).press('ArrowRight');
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    expect(await camera.getAttribute('transform')).toBe(before);
    await host.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(await camera.getAttribute('transform')).toBe(before);

    await confirm.click();
    await expect(dialog).toHaveCount(0);
    // The next device receiving its own choice proves that the server accepted the keep.
    await expect(secretTable(guest)).toBeVisible();
    await expect(host.locator('.secret-card')).toHaveCount(0);
  } finally {
    await closeTable(pages);
  }
});

test('Am Handy scrollt nur die Kartenauslage; die zweite Karte und Bestätigung bleiben erreichbar', async ({
  browser,
}) => {
  const pages = await openTable(browser, 1);
  const [page] = pages as [Page];
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const dialog = secretTable(page);
    await expect(dialog).toBeVisible();
    await expectOriginalCards(dialog);
    const rail = dialog.locator('.card-table-spread');
    const dimensions = await rail.evaluate((element) => ({
      viewport: element.clientWidth,
      content: element.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeGreaterThan(dimensions.viewport);
    expect(dimensions.document).toBeLessThanOrEqual(390);
    const second = dialog.locator('.secret-card').nth(1);
    await expect(second.locator('.secret-card-face')).toHaveCSS('transition-duration', '0s');
    await second.scrollIntoViewIfNeeded();
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await second.locator('.secret-card-face').click();
    await expect(dialog.getByRole('radio').nth(1)).toBeChecked();

    const confirm = dialog.getByRole('button', { name: 'Behalten', exact: true });
    await expect(confirm).toBeEnabled();
    await expect(confirm).toBeInViewport({ ratio: 1 });
    await confirm.click({ trial: true });
    await confirm.click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await closeTable(pages);
  }
});
