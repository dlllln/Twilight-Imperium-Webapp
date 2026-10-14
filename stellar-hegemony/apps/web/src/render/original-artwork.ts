import { Assets, type Texture } from 'pixi.js';
import { BOARD_ARTWORK_PATHS } from '../artwork/board.ts';
import { UNIT_ARTWORK_PATHS } from '../artwork/units.ts';
import { PLANET_ARTWORK_PATHS } from '../artwork/planets.ts';

const textures = new Map<string, Texture>();
let loading: Promise<void> | null = null;
const LOAD_TIMEOUT_MS = 8_000;

function withDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TI4 artwork load timed out')), LOAD_TIMEOUT_MS);
  });
  return Promise.race([request, deadline]).finally(() => clearTimeout(timer));
}

async function loadTexture(path: string): Promise<void> {
  const texture = await withDeadline(Assets.load<Texture>(path));
  textures.set(path, texture);
}

/** Load once before creating scenes; failed assets retain their procedural fallback. */
export function preloadOriginalArtwork(): Promise<void> {
  loading ??= Promise.allSettled(
    [...UNIT_ARTWORK_PATHS, ...BOARD_ARTWORK_PATHS, ...PLANET_ARTWORK_PATHS].map(loadTexture),
  ).then(() => undefined);
  return loading;
}

export const originalTexture = (path: string | null): Texture | undefined =>
  path === null ? undefined : textures.get(path);

/** Keep the source art's proportions within the existing miniature bounds. */
export function fitTexture(texture: Texture, width: number, height: number) {
  const scale = Math.min(width / texture.width, height / texture.height);
  return { width: texture.width * scale, height: texture.height * scale };
}
