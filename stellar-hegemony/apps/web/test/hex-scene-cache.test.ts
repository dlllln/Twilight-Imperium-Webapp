import { Container } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { HexSceneCache } from '../src/render/hex-scene-cache.ts';
import type { HexLayers } from '../src/render/hex-view.ts';
import type { SceneHex } from '../src/render/scene-model.ts';

const home = (q: number): SceneHex => ({
  key: `${String(q)},0`,
  position: { q, r: 0 },
  kind: 'homeSlot',
  systemId: null,
  back: 'home',
  seat: 1,
  planets: [],
  ships: [],
  tokens: [],
  highlight: 'none',
  control: null,
  frontier: false,
  cache: 0,
  wormholes: [],
});

function fixture() {
  const layers: HexLayers = {
    base: new Container(),
    shadows: new Container(),
    glow: new Container(),
    content: new Container(),
    labels: new Container(),
  };
  const draw = vi.fn((hex: SceneHex) => {
    layers.content.addChild(new Container({ label: hex.key }));
    layers.labels.addChild(new Container({ label: hex.key }));
    return { placed: [{ arrange: vi.fn() }], pulse: null };
  });
  const grid = vi.fn(() => {
    layers.base.addChild(new Container({ label: 'grid' }));
    return [{ arrange: vi.fn() }];
  });
  return { layers, draw, grid, cache: new HexSceneCache(layers, draw, grid) };
}

describe('Inkrementelle Galaxieszene', () => {
  it('behält unveränderte Systeme auch bei neu erzeugten Szenendaten', () => {
    const { cache, draw, grid } = fixture();
    const initial = cache.update([home(0), home(1)]);
    const again = cache.update([home(0), home(1)]);
    expect(initial.fresh).toHaveLength(3);
    expect(again.changed).toBe(false);
    expect(again.placed).toEqual(initial.placed);
    expect(again.fresh).toEqual([]);
    expect(again.retired).toEqual([]);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(grid).toHaveBeenCalledTimes(1);
  });

  it.each([
    { highlight: 'selected' as const },
    { control: 2 },
    { ships: [{ type: 'cruiser', seat: 2, count: 3 }] },
    { tokens: [2], frontier: true, cache: 2 },
  ])('aktualisiert geänderte Spielinformationen: %j', (change) => {
    const { cache, layers, draw, grid } = fixture();
    cache.update([home(0), home(1)]);
    const untouched = layers.content.children[1];
    const result = cache.update([{ ...home(0), ...change }, home(1)]);
    expect(result.changed).toBe(true);
    expect(result.fresh).toHaveLength(1);
    expect(result.retired).toHaveLength(2);
    expect(result.retired.every((child) => child.parent === null)).toBe(true);
    // Destruction is deferred until GalaxyScene has rendered the replacements.
    expect(result.retired.every((child) => !child.destroyed)).toBe(true);
    expect(layers.content.children).toContain(untouched);
    expect(layers.content.children).toHaveLength(2);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(grid).toHaveBeenCalledTimes(1);
  });

  it('entfernt verschwundene Systeme und passt das Raster an das neue Layout an', () => {
    const { cache, layers, grid } = fixture();
    cache.update([home(0), home(1)]);
    const result = cache.update([home(1)]);
    expect(result.retired).toHaveLength(3);
    expect(result.placed).toHaveLength(2);
    expect(layers.content.children.map((child) => child.label)).toEqual(['1,0']);
    expect(layers.base.children).toHaveLength(1);
    expect(grid).toHaveBeenCalledTimes(2);
    const moved = cache.update([{ ...home(1), position: { q: 2, r: 0 } }]);
    expect(moved.fresh).toHaveLength(2);
    expect(grid).toHaveBeenCalledTimes(3);
  });
});
