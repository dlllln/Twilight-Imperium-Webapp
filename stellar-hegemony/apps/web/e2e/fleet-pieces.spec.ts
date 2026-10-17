import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { actorPage, keepSecrets, openTable, phaseOf, pickFirstFree } from './table.ts';

test.describe.configure({ timeout: 120_000 });

type Input = 'mouse' | 'touch';
interface Point {
  readonly x: number;
  readonly y: number;
}

async function prepareInput(page: Page, input: Input): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  if (input === 'touch') {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const supply = page.getByRole('button', { name: 'Gemeinsamer Vorrat', exact: true });
    await expect(supply).toHaveAttribute('aria-expanded', 'false');
  }
  return cdp;
}

async function dragMouse(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function dragTouch(cdp: CDPSession, from: Point, to: Point): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...from, id: 1 }],
  });
  for (let step = 1; step <= 12; step++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / 12,
          y: from.y + ((to.y - from.y) * step) / 12,
          id: 1,
        },
      ],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function tracePointers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const trace: unknown[] = [];
    (window as unknown as { fleetTrace: unknown[] }).fleetTrace = trace;
    const observe = (event: PointerEvent) => {
      const target = event.target as Element | null;
      trace.push({
        type: event.type,
        pointer: event.pointerId,
        kind: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        target: target?.tagName,
        class: target?.getAttribute('class'),
        origin: target?.closest('[data-origin]')?.getAttribute('data-origin'),
        lifting: document.querySelector('.galaxy')?.hasAttribute('data-lifting-fleet'),
      });
    };
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const)
      document.addEventListener(name, observe, true);
  });
}

async function pointDiagnostics(page: Page, from: Point, to: Point) {
  return page.evaluate(
    ({ from, to }) => {
      const describe = (point: Point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return {
          point,
          tag: target?.tagName,
          class: target?.getAttribute('class'),
          origin: target?.closest('[data-origin]')?.getAttribute('data-origin'),
          system: target?.closest('[data-system]')?.getAttribute('data-system'),
        };
      };
      return {
        from: describe(from),
        to: describe(to),
        scroll: { x: scrollX, y: scrollY },
        viewport: { width: innerWidth, height: innerHeight },
        coarse: matchMedia('(pointer: coarse)').matches,
        camera: document.querySelector('svg[aria-label="galaxy"] > g')?.getAttribute('transform'),
      };
    },
    { from, to },
  );
}

async function attachTrace(page: Page): Promise<void> {
  const trace = await page.evaluate(
    () => (window as unknown as { fleetTrace?: unknown[] }).fleetTrace ?? [],
  );
  await test.info().attach('fleet-pointer-events', {
    body: JSON.stringify(trace, null, 2),
    contentType: 'application/json',
  });
  await test
    .info()
    .attach('fleet-board', { body: await page.screenshot(), contentType: 'image/png' });
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Spielstein nicht sichtbar');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function neighbour(page: Page, home: Locator): Promise<Locator> {
  const from = await center(home);
  const targets = page.locator('polygon[data-system]:not([data-anomaly]):not([data-seat])');
  const distances = await Promise.all(
    (await targets.all()).map(async (target) => {
      const point = await center(target);
      return Math.hypot(point.x - from.x, point.y - from.y);
    }),
  );
  return targets.nth(distances.indexOf(Math.min(...distances)));
}

async function loadFighters(page: Page) {
  const fighters = page.locator('.cargo label').filter({ hasText: 'Jäger' }).locator('input');
  for (const input of await fighters.all())
    if ((await input.isEnabled()) && !(await input.isChecked())) await input.check();
}

for (const input of ['mouse', 'touch'] as const) {
  test(`Flotte mit ${input} aufnehmen, Vorschau ablegen und erst nach Prüfung gemeinsam bewegen`, async ({
    browser,
  }) => {
    const pages = await openTable(browser);
    try {
      await keepSecrets(pages);
      await pickFirstFree(pages, 6);
      for (const seated of pages) await expect(phaseOf(seated)).toHaveText('Aktion');
      const page = await actorPage(pages);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const seat = String(pages.indexOf(page) + 1);
      const cdp = await prepareInput(page, input);
      const home = page.locator(`polygon[data-seat="${seat}"][data-system]`);
      const origin = (await home.getAttribute('data-system')) ?? '';
      const target = await neighbour(page, home);
      await target.click();
      await page.getByRole('button', { name: 'System aktivieren', exact: true }).click();
      const handle = page.locator(`.fleet-pickup[data-origin="${origin}"]`);
      await expect(handle).toBeVisible();
      const from = await center(handle);
      const to = await center(target);
      const diagnostics = await pointDiagnostics(page, from, to);
      await test.info().attach('fleet-hit-targets', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json',
      });
      await page.screenshot({ path: test.info().outputPath('fleet-before-drag.png') });
      expect(diagnostics.from.origin, JSON.stringify(diagnostics)).toBe(origin);
      await tracePointers(page);
      const camera = page.locator('svg[aria-label="galaxy"] > g').first();
      const prior = await camera.getAttribute('transform');
      if (input === 'mouse') {
        await dragMouse(page, from, { x: 20, y: 110 });
        await expect(page.locator('.ship-choices > li > label > input:checked')).toHaveCount(0);
        await dragMouse(page, from, to);
      } else await dragTouch(cdp, from, to);
      try {
        await expect(page.locator('.fleet-staged')).toContainText('Vorschau');
      } finally {
        await attachTrace(page);
      }
      expect(await camera.getAttribute('transform')).toBe(prior);
      await expect(page.locator('.ship-choices > li > label > input:checked')).not.toHaveCount(0);
      await expect(page.locator('.history-list')).not.toContainText('bewegt');
      await loadFighters(page);
      await page.getByRole('button', { name: 'Schiffe bewegen', exact: true }).click();
      await expect(page.locator('.ship-choices')).toHaveCount(0);
      await expect(page.locator('.history-list')).toContainText('bewegt');
      await expect(page.locator('.fleet-pickup')).toHaveCount(0);
      expect(errors).toEqual([]);
      await cdp.detach();
    } finally {
      await Promise.all(pages.map((page) => page.context().close()));
    }
  });
}
