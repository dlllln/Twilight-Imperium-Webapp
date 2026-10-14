import type { TileBack } from '@stellar/domain';
import type { SceneHex } from '../render/scene-model.ts';

/** Unlabelled original backs preserve this app's custom planet names and values. */
const TILE_BACKS: Readonly<Record<TileBack, string>> = {
  blue: '00_blue.png',
  red: '00_red.png',
  center: '00_gray.png',
  home: '00_green.png',
};

const ANOMALY_TILES: Readonly<Record<string, string>> = {
  asteroidField: '44_Asteroids.png',
  nebula: '42_Nebula.png',
  supernova: '43_Supernova.png',
  gravityRift: '41_GravityRift.png',
  space: '46_Void.png',
};

const WORMHOLE_TILES: Readonly<Record<string, string>> = {
  alpha: '39_AlphaWH.png',
  beta: '40_BetaWH.png',
};

const artworkPath = (name: string): string => `/ti4/tiles/${name}`;

function faceArtwork(hex: SceneHex): string | undefined {
  if (hex.wormholes.length > 0)
    return hex.anomaly === undefined && hex.wormholes.length === 1
      ? WORMHOLE_TILES[hex.wormholes[0] ?? '']
      : undefined;
  return ANOMALY_TILES[hex.anomaly ?? 'space'];
}

/** Only show a full original face when its planet, anomaly and wormhole content matches. */
export function boardArtwork(hex: SceneHex): string {
  if (hex.planets.length > 0 || hex.kind === 'homeSlot') return artworkPath(TILE_BACKS[hex.back]);
  return artworkPath(faceArtwork(hex) ?? TILE_BACKS[hex.back]);
}

export const boardHasWormholeArt = (hex: SceneHex): boolean =>
  hex.planets.length === 0 && hex.anomaly === undefined && hex.wormholes.length === 1;

export const BOARD_ARTWORK_PATHS: readonly string[] = [
  ...Object.values(TILE_BACKS),
  ...Object.values(ANOMALY_TILES),
  ...Object.values(WORMHOLE_TILES),
].map(artworkPath);
