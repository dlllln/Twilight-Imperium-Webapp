import type { Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
