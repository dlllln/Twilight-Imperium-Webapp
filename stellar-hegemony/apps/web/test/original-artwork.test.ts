import type { Texture } from 'pixi.js';
import { SECRET_OBJECTIVES } from '@stellar/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { objectiveFrame } from '../src/artwork/cards.ts';
import { BOARD_ARTWORK_PATHS } from '../src/artwork/board.ts';
import { UNIT_ARTWORK_PATHS } from '../src/artwork/units.ts';
import { PLANET_ARTWORK_PATHS } from '../src/artwork/planets.ts';

const { load } = vi.hoisted(() => ({ load: vi.fn<(path: string) => Promise<Texture>>() }));
vi.mock('pixi.js', () => ({ Assets: { load } }));

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  load.mockReset();
});

describe('Original artwork initialization', () => {
  it('shares one preload across simultaneous map and battle initialization, tolerating missing PNGs', async () => {
    const texture = { width: 73, height: 79 } as Texture;
    const failed = UNIT_ARTWORK_PATHS[0];
    load.mockImplementation((path) =>
      path === failed ? Promise.reject(new Error('404')) : Promise.resolve(texture),
    );
    const { preloadOriginalArtwork, originalTexture } =
      await import('../src/render/original-artwork.ts');
    const first = preloadOriginalArtwork();
    expect(preloadOriginalArtwork()).toBe(first);
    await expect(first).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(
      UNIT_ARTWORK_PATHS.length + BOARD_ARTWORK_PATHS.length + PLANET_ARTWORK_PATHS.length,
    );
    expect(originalTexture(failed ?? null)).toBeUndefined();
    expect(originalTexture(UNIT_ARTWORK_PATHS[1] ?? null)).toBe(texture);
  });

  it('finishes initialization when an asset request never responds', async () => {
    vi.useFakeTimers();
    load.mockImplementation(() => new Promise<Texture>(() => undefined));
    const { preloadOriginalArtwork, originalTexture } =
      await import('../src/render/original-artwork.ts');
    const completion = preloadOriginalArtwork();
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(completion).resolves.toBeUndefined();
    expect(originalTexture(UNIT_ARTWORK_PATHS[0] ?? null)).toBeUndefined();
  });
});

describe('Original secret objective fronts', () => {
  it('keeps every dealt secret on a populated original face instead of the unrelated default faction-technology card', () => {
    expect(SECRET_OBJECTIVES).toHaveLength(22);
    for (const objective of SECRET_OBJECTIVES) {
      const artwork = objectiveFrame(objective.id, objective.category, objective.stage);
      expect(artwork.path, objective.id).toBe('/ti4/cards/objective-secret.jpg');
      expect(artwork.columns).toBe(12);
      expect(artwork.rows).toBe(2);
      // Original cells 20–23 are empty; cell 0 requires faction technologies,
      // a condition that none of this game's current secret objectives has.
      expect(artwork.index, objective.id).toBeGreaterThan(0);
      expect(artwork.index, objective.id).toBeLessThan(20);
      expect(artwork.crop, objective.id).toBeUndefined();
    }
  });

  it('uses the dreadnought and technology originals for the two expansion goals', () => {
    expect(objectiveFrame('dread-armada', 'secret', null).index).toBe(9);
    expect(objectiveFrame('tech-hoard', 'secret', null).index).toBe(12);
  });
});
