// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { toSlotViews } from '../src/galaxy-view.ts';
import { handleShortcut } from '../src/keyboard.ts';
import { content, currentMapString, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';

const store = () => useGalaxyStore.getState();

beforeEach(() => {
  useGalaxyStore.setState({
    playerCount: 6,
    layout: [],
    error: null,
    viewport: DEFAULT_VIEWPORT,
    language: 'de',
  });
});

describe('Galaxie-Store', () => {
  it('gleicher Seed erzeugt dieselbe Galaxie', () => {
    store().generate(42);
    const first = currentMapString(store().layout);
    store().generate(42);
    expect(currentMapString(store().layout)).toBe(first);
    expect(store().layout).toHaveLength(37);
  });

  it('Spielerzahl ändern erzeugt eine passende Galaxie', () => {
    store().setPlayerCount(3);
    expect(store().layout.filter((slot) => slot.content.kind === 'home')).toHaveLength(3);
  });

  it('Import übernimmt gültige Karten und leitet die Spielerzahl ab', () => {
    store().generate(7);
    const exported = currentMapString(store().layout);
    useGalaxyStore.setState({ layout: [], playerCount: 4 });
    expect(store().importMap(exported)).toBe(true);
    expect(store().playerCount).toBe(6);
    expect(currentMapString(store().layout)).toBe(exported);
  });

  it('Import lehnt ungültige Karten mit Fehlercode ab', () => {
    expect(store().importMap('thronwelt b01 b01 H . . H . . H')).toBe(false);
    expect(store().error?.code).toBe('galaxy.duplicateTile');
  });

  it('Zoom bleibt in Grenzen, Pan verschiebt', () => {
    for (let step = 0; step < 20; step++) store().zoomBy(2);
    expect(store().viewport.zoom).toBe(3);
    store().panBy(10, -5);
    expect(store().viewport).toMatchObject({ panX: 10, panY: -5 });
    store().resetView();
    expect(store().viewport).toEqual(DEFAULT_VIEWPORT);
  });

  it('Tastaturkürzel steuern Zoom und Galaxie, nicht aber Eingabefelder', () => {
    const press = (key: string, target: EventTarget = document.body) => {
      const event = new KeyboardEvent('keydown', { key });
      Object.defineProperty(event, 'target', { value: target });
      return handleShortcut(event, store());
    };
    expect(press('+')).toBe(true);
    expect(store().viewport.zoom).toBeCloseTo(1.2);
    expect(press('G')).toBe(true);
    expect(store().layout.length).toBeGreaterThan(0);
    expect(press('x')).toBe(false);
    expect(press('+', document.createElement('textarea'))).toBe(false);
  });

  it('Feldansichten enthalten Planetennamen in der gewählten Sprache und Sitzplätze', () => {
    store().generate(3);
    const views = toSlotViews(store().layout, content, 'de');
    const center = views.find((view) => view.kind === 'system' && view.back === 'center');
    expect(center?.kind === 'system' && center.planets[0]?.name).toBe('Thronwelt Aurum');
    expect(views.flatMap((view) => (view.kind === 'home' ? [view.seat] : []))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});
