import type { AnomalyKind, TileBack } from '@stellar/domain';
import { Texture } from 'pixi.js';
import { seatColor } from '../seat-colors.ts';
import { paintAnomaly } from './anomaly-texture.ts';
import { paintNebula } from './nebula-texture.ts';
import { hexOf, type Rgb, rgbOf } from './palette.ts';
import { type PlanetLook, paintPlanet } from './planet-texture.ts';
import { paintUnit } from './ship-texture.ts';
import { paintTileFace } from './tile-texture.ts';

/* Texturgrößen in Pixeln: groß genug für dreifachen Zoom auf hochauflösenden Bildschirmen. */
const TILE_RADIUS = 160;
const PLANET_SIZE = 160;
const ANOMALY_SIZE = 256;
const SHIP_SIZE = { width: 112, height: 70 };
const GROUND_SIZE = 64;
const NEBULA_SIZE = { width: 960, height: 600, seed: 7 };

const cache = new Map<string, Texture>();

/**
 * Flyweight: jede prozedurale Grafik wird einmal gemalt und dann von allen
 * Sprites geteilt. Ohne Canvas (Tests) gibt es eine leere Textur.
 */
function cached(key: string, paint: () => HTMLCanvasElement | null): Texture {
  const known = cache.get(key);
  if (known !== undefined) return known;
  const canvas = paint();
  const texture = canvas === null ? Texture.EMPTY : Texture.from(canvas);
  cache.set(key, texture);
  return texture;
}

export const seatRgb = (seat: number): Rgb => rgbOf(hexOf(seatColor(seat)));

export const tileTexture = (back: TileBack): Texture =>
  cached(`tile:${back}`, () => paintTileFace(back, TILE_RADIUS));

export const planetTexture = (id: string, look: PlanetLook): Texture =>
  cached(`planet:${id}`, () => paintPlanet(id, look, PLANET_SIZE));

export const anomalyTexture = (kind: AnomalyKind): Texture =>
  cached(`anomaly:${kind}`, () => paintAnomaly(kind, ANOMALY_SIZE));

const isGroundPiece = (type: string): boolean =>
  ['infantry', 'orbitalBattery', 'orbitalDock'].includes(type);

export function unitTexture(type: string, seat: number): Texture {
  const ground = isGroundPiece(type);
  const width = ground ? GROUND_SIZE : SHIP_SIZE.width;
  const height = ground ? GROUND_SIZE : SHIP_SIZE.height;
  return cached(`unit:${type}:${String(seat)}`, () =>
    paintUnit(type, seatRgb(seat), width, height),
  );
}

export const nebulaTexture = (): Texture =>
  cached('nebula', () => paintNebula(NEBULA_SIZE.width, NEBULA_SIZE.height, NEBULA_SIZE.seed));
