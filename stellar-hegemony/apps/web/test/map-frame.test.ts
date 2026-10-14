// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { HOME_ORBIT, isTopView, useOrbitStore } from '../src/system/orbit-store.ts';
import { fitScale, frameBounds, freeBand, hudInsets } from '../src/system/map-frame.ts';
import { MAX_TILT, MIN_TILT, TILT } from '../src/render/board-view.ts';
import { worldTransform } from '../src/render/view-transform.ts';
import { useSettingsStore } from '../src/settings-store.ts';

const BOARD = { minX: -400, minY: -260, width: 800, height: 560 };
const WIDE = { width: 1600, height: 900 };
const NO_PAN = { zoom: 1, panX: 0, panY: 0 };

/** Wo die Ecken der Karte auf dem Bildschirm landen. */
function onScreen(screen: typeof WIDE, insets: ReturnType<typeof hudInsets>) {
  const frame = frameBounds(BOARD, screen, insets);
  const camera = worldTransform(frame, screen, NO_PAN);
  return {
    left: camera.x + BOARD.minX * camera.scale,
    top: camera.y + BOARD.minY * camera.scale,
    right: camera.x + (BOARD.minX + BOARD.width) * camera.scale,
    bottom: camera.y + (BOARD.minY + BOARD.height) * camera.scale,
  };
}

describe('Die ganze Karte im freien Bereich', () => {
  it('die Karte liegt vollständig zwischen Spielern, Vorräten, Hand und Benachrichtigungen', () => {
    const insets = hudInsets(BOARD, WIDE);
    const box = onScreen(WIDE, insets);
    expect(box.left).toBeGreaterThanOrEqual(insets.left - 0.01);
    expect(box.top).toBeGreaterThanOrEqual(insets.top - 0.01);
    expect(box.right).toBeLessThanOrEqual(WIDE.width - insets.right + 0.01);
    expect(box.bottom).toBeLessThanOrEqual(WIDE.height - insets.bottom + 0.01);
    const filled = Math.max(
      (box.right - box.left) / (WIDE.width - insets.left - insets.right),
      (box.bottom - box.top) / (WIDE.height - insets.top - insets.bottom),
    );
    expect(filled).toBeCloseTo(1);
  });

  it('der Platz für Benachrichtigungen bleibt nur frei, wenn die Karte dadurch kaum kleiner wird', () => {
    expect(hudInsets(BOARD, WIDE).right).toBeGreaterThan(400);
    const square = { width: 1100, height: 900 };
    expect(hudInsets(BOARD, square).right).toBeLessThan(100);
    expect(hudInsets(BOARD, { width: 600, height: 900 }).left).toBeLessThan(20);
  });

  it('ohne bekannte Bildgröße bleibt es bei der Karte; das freie Band liegt zwischen Vorräten und Hand', () => {
    expect(frameBounds(BOARD, { width: 0, height: 0 }, hudInsets(BOARD, WIDE))).toEqual(BOARD);
    expect(freeBand(BOARD, { width: 0, height: 0 }, hudInsets(BOARD, WIDE))).toEqual({
      top: BOARD.minY,
      bottom: BOARD.minY + BOARD.height,
    });
    const insets = hudInsets(BOARD, WIDE);
    const frame = frameBounds(BOARD, WIDE, insets);
    const band = freeBand(frame, WIDE, insets);
    const unit = 1 / fitScale(BOARD, WIDE, insets);
    expect(band.top).toBeCloseTo(frame.minY + insets.top * unit);
    expect(band.bottom).toBeCloseTo(frame.minY + frame.height - insets.bottom * unit);
  });
});

describe('Karte frei drehen und neigen', () => {
  beforeEach(() => {
    useSettingsStore.setState({ animations: false });
    useOrbitStore.setState(HOME_ORBIT);
  });

  it('Ziehen dreht und neigt sofort, die Neigung bleibt zwischen Draufsicht und flachem Blick', () => {
    useOrbitStore.getState().orbitBy(0.3, 10);
    expect(useOrbitStore.getState()).toMatchObject({ turn: 0.3, tilt: MAX_TILT });
    useOrbitStore.getState().orbitBy(0, -10);
    expect(useOrbitStore.getState().tilt).toBe(MIN_TILT);
  });

  it('Knöpfe drehen um eine Achtelumdrehung, wechseln zur Draufsicht und zurück', () => {
    const store = useOrbitStore.getState();
    store.rotateStep(1);
    expect(useOrbitStore.getState().turn).toBeCloseTo(Math.PI / 4);
    store.toggleTop();
    expect(isTopView(useOrbitStore.getState())).toBe(true);
    store.toggleTop();
    expect(useOrbitStore.getState().tilt).toBe(TILT);
    store.resetOrbit();
    expect(useOrbitStore.getState()).toMatchObject(HOME_ORBIT);
  });
});
