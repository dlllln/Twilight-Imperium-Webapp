// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  baseTilt,
  HOME_ORBIT,
  homeOrbit,
  isTopView,
  useOrbitStore,
} from '../src/system/orbit-store.ts';
import {
  type FrameAlign,
  fitScale,
  frameBounds,
  freeBand,
  hudInsets,
} from '../src/system/map-frame.ts';
import { hexToPixel } from '../src/hex-geometry.ts';
import {
  boardBounds,
  MAX_TILT,
  MIN_TILT,
  TABLE_TILT,
  TILT,
  viewFrom,
} from '../src/render/board-view.ts';
import { gameScene } from '../src/render/scene-model.ts';
import { homeOf } from '../src/system/board-camera.ts';
import { content } from '../src/store.ts';
import { worldTransform } from '../src/render/view-transform.ts';
import { useGameStore } from '../src/game-store.ts';
import { useSettingsStore } from '../src/settings-store.ts';
import { started } from './game-helpers.ts';

const BOARD = { minX: -400, minY: -260, width: 800, height: 560 };
const WIDE = { width: 1600, height: 900 };
const NO_PAN = { zoom: 1, panX: 0, panY: 0 };

/** Wo die Ecken der Karte auf dem Bildschirm landen. */
function onScreen(
  screen: typeof WIDE,
  insets: ReturnType<typeof hudInsets>,
  align: FrameAlign = 'center',
) {
  const frame = frameBounds(BOARD, screen, insets, align);
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

  it('Tablets hochkant: Spieler oben in einer Reihe, die Karte nutzt die ganze Breite', () => {
    expect(hudInsets(BOARD, { width: 820, height: 1180 }).left).toBeLessThan(20);
    expect(hudInsets(BOARD, { width: 1180, height: 820 }).left).toBeGreaterThan(200);
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

describe('Tischansicht: Karte über dem Kommandopult', () => {
  it('Tischansicht: die Karte endet direkt über dem Pult', () => {
    const insets = hudInsets(BOARD, WIDE, 'table');
    const box = onScreen(WIDE, insets, 'bottom');
    expect(insets.bottom).toBeGreaterThanOrEqual(132 + 20);
    expect(box.bottom).toBeCloseTo(WIDE.height - insets.bottom);
    expect(box.top).toBeGreaterThanOrEqual(insets.top - 0.01);
    expect(box.left).toBeGreaterThanOrEqual(insets.left - 0.01);
    expect(box.right).toBeLessThanOrEqual(WIDE.width - insets.right + 0.01);
    // Mittig stünde die Karte höher und ließe unten eine Lücke zum Pult.
    expect(onScreen(WIDE, insets).bottom).toBeLessThan(box.bottom - 1);
  });

  it('oben bleibt ohne Vorratsleiste fast alles frei', () => {
    expect(hudInsets(BOARD, WIDE, 'table').top).toBeLessThan(hudInsets(BOARD, WIDE).top);
    const phone = { width: 600, height: 900 };
    expect(hudInsets(BOARD, phone, 'table').top).toBeLessThan(hudInsets(BOARD, phone).top);
    expect(hudInsets(BOARD, phone, 'table').bottom).toBeGreaterThan(hudInsets(BOARD, phone).bottom);
    expect(hudInsets(BOARD, { width: 1100, height: 900 }, 'table').right).toBeLessThan(100);
  });

  it('klassische Ränder bleiben unverändert', () => {
    expect(hudInsets(BOARD, WIDE)).toEqual({ top: 76, right: 432, bottom: 78, left: 226 });
    expect(hudInsets(BOARD, WIDE, 'classic')).toEqual(hudInsets(BOARD, WIDE));
    const insets = hudInsets(BOARD, WIDE);
    expect(frameBounds(BOARD, WIDE, insets, 'center')).toEqual(frameBounds(BOARD, WIDE, insets));
  });
});

/** Die echte Karte einer Partie, so steil gesehen wie am Tisch. */
function tableBoard() {
  const hexes = gameScene(started(), content, 'de');
  const view = viewFrom(homeOf(hexes, 1), TABLE_TILT);
  return boardBounds(
    view,
    hexes.map((hex) => hexToPixel(hex.position)),
  );
}

describe('Tischansicht mit der echten Karte', () => {
  it('auf üblichen Laptops bleibt rechts Platz für Meldungen und Aktionsfeld, wie klassisch', () => {
    const board = tableBoard();
    for (const screen of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      expect(hudInsets(board, screen, 'table').right).toBe(432);
    }
  });

  it('Tablet hochkant: die Karte endet über Pult, Phase und Ansage', () => {
    const board = tableBoard();
    const tablet = { width: 820, height: 1180 };
    const insets = hudInsets(board, tablet, 'table');
    const frame = frameBounds(board, tablet, insets, 'bottom');
    const camera = worldTransform(frame, tablet, NO_PAN);
    const bottom = camera.y + (board.minY + board.height) * camera.scale;
    // Pult 96, angehobene Hand 200, Phase gut 80 und darüber die Ansage (höchstens 260).
    expect(bottom).toBeLessThanOrEqual(tablet.height - (96 + 200 + 80 + 260));
    // Die Karte füllt trotzdem fast die ganze Breite: hochkant ist genug Höhe übrig.
    expect(fitScale(board, tablet, insets)).toBeGreaterThan(
      0.9 * fitScale(board, tablet, { ...insets, bottom: 230 }),
    );
    expect(camera.y + board.minY * camera.scale).toBeGreaterThanOrEqual(insets.top - 0.01);
  });

  it('am Telefon rückt die Karte über die niedrigere Ansage, behält aber mehr als ein Drittel des Bildes', () => {
    const board = tableBoard();
    const phone = { width: 390, height: 844 };
    const insets = hudInsets(board, phone, 'table');
    expect(insets.bottom).toBeGreaterThanOrEqual(96 + 118 + 70 + 182 - 20);
    expect(insets.bottom).toBeLessThanOrEqual(0.64 * phone.height + 0.01);
    expect(hudInsets(board, { width: 1440, height: 900 }, 'table').bottom).toBe(156);
  });
});

describe('Karte frei drehen und neigen', () => {
  beforeEach(() => {
    useSettingsStore.setState({ animations: false, tableView: false });
    useOrbitStore.setState(HOME_ORBIT);
  });

  afterEach(() => {
    useGameStore.setState({ game: null });
  });

  it('außerhalb einer Partie bleibt auch mit Tischansicht der gewohnte Blick', () => {
    useSettingsStore.setState({ tableView: true });
    expect(baseTilt()).toBe(TILT);
    expect(useOrbitStore.getState()).toMatchObject(HOME_ORBIT);
    useGameStore.setState({ game: started() });
    expect(useOrbitStore.getState().tilt).toBe(TABLE_TILT);
    useGameStore.setState({ game: null });
    expect(useOrbitStore.getState()).toMatchObject(HOME_ORBIT);
  });

  it('Zurücksetzen fährt in der Tischansicht auf die Tischneigung', () => {
    useGameStore.setState({ game: started() });
    useSettingsStore.setState({ tableView: true });
    expect(baseTilt()).toBe(TABLE_TILT);
    expect(useOrbitStore.getState().tilt).toBe(TABLE_TILT);
    const store = useOrbitStore.getState();
    store.orbitBy(0.5, -0.4);
    store.resetOrbit();
    expect(useOrbitStore.getState()).toMatchObject(homeOrbit());
    store.toggleTop();
    store.toggleTop();
    expect(useOrbitStore.getState().tilt).toBe(TABLE_TILT);
    useSettingsStore.setState({ tableView: false });
    expect(useOrbitStore.getState()).toMatchObject(HOME_ORBIT);
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
