import type { AnomalyKind, TileBack } from '@stellar/domain';
import { CanvasSource, Texture } from 'pixi.js';
import { seatColor } from '../seat-colors.ts';
import { paintAnomaly } from './anomaly-texture.ts';
import { paintNebula } from './nebula-texture.ts';
import { hexOf, type Rgb, rgbOf } from './palette.ts';
import { type PlanetLook, paintPlanet } from './planet-texture.ts';
import { paintUnit } from './ship-texture.ts';
import { paintGlow } from './glow-texture.ts';
import { paintTile } from './tile-texture.ts';

/*
 * Texturgrößen in Pixeln. Was beim Nahzoom groß wird (Schiffe, Anomalien), ist groß gemalt
 * und hat Mipmaps, damit es aus der Ferne nicht flimmert. Planeten rechnet ein Shader,
 * Kachelränder und Sterne sind Vektorgrafik; die Kachelfläche ist weich und darf skalieren.
 */
export const TILE_RADIUS = 160;
/** Kacheln gibt es in mehreren Varianten (Sterne, Schleier), damit die Karte nicht gekachelt wirkt. */
export const TILE_VARIANTS = 4;
const ANOMALY_SIZE = 768;
const SHIP_SIZE = { width: 480, height: 300 };
const GROUND_SIZE = 192;
const NEBULA_SIZE = { width: 960, height: 600, seed: 7 };

const cache = new Map<string, Texture>();

const textureOf = (canvas: HTMLCanvasElement, mipmaps: boolean): Texture =>
  new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: mipmaps }) });

/**
 * Flyweight: jede prozedurale Grafik wird einmal gemalt und dann von allen
 * Sprites geteilt. Ohne Canvas (Tests) gibt es eine leere Textur.
 */
function cached(key: string, paint: () => HTMLCanvasElement | null, mipmaps = false): Texture {
  const known = cache.get(key);
  if (known !== undefined) return known;
  const canvas = paint();
  const texture = canvas === null ? Texture.EMPTY : textureOf(canvas, mipmaps);
  cache.set(key, texture);
  return texture;
}

export const seatRgb = (seat: number): Rgb => rgbOf(hexOf(seatColor(seat)));

export const tileTexture = (back: TileBack, variant: number): Texture =>
  cached(`tile:${back}:${String(variant)}`, () => paintTile(back, TILE_RADIUS, variant));

export const anomalyTexture = (kind: AnomalyKind): Texture =>
  cached(`anomaly:${kind}`, () => paintAnomaly(kind, ANOMALY_SIZE), true);

const isGroundPiece = (type: string): boolean =>
  ['infantry', 'mech', 'orbitalBattery', 'orbitalDock'].includes(type);

export function unitTexture(type: string, seat: number): Texture {
  const ground = isGroundPiece(type);
  const width = ground ? GROUND_SIZE : SHIP_SIZE.width;
  const height = ground ? GROUND_SIZE : SHIP_SIZE.height;
  return cached(
    `unit:${type}:${String(seat)}`,
    () => paintUnit(type, seatRgb(seat), width, height),
    true,
  );
}

export const nebulaTexture = (): Texture =>
  cached('nebula', () => paintNebula(NEBULA_SIZE.width, NEBULA_SIZE.height, NEBULA_SIZE.seed));

/* Kampfbühne: Planeten und Schiffe als Bilder in hoher Auflösung. */
const DETAIL = { planet: 384, ship: { width: 240, height: 150 }, ground: 96 } as const;
const GLOW_SIZE = 64;

export const detailPlanetTexture = (id: string, look: PlanetLook): Texture =>
  cached(`planet-detail:${id}`, () => paintPlanet(id, look, DETAIL.planet));

export function detailUnitTexture(type: string, seat: number): Texture {
  const ground = isGroundPiece(type);
  const width = ground ? DETAIL.ground : DETAIL.ship.width;
  const height = ground ? DETAIL.ground : DETAIL.ship.height;
  return cached(`unit-detail:${type}:${String(seat)}`, () =>
    paintUnit(type, seatRgb(seat), width, height),
  );
}

export const glowTexture = (): Texture => cached('glow', () => paintGlow(GLOW_SIZE));

/** Seitenverhältnis der Schiffstexturen (Höhe zu Breite). */
export const SHIP_ASPECT = DETAIL.ship.height / DETAIL.ship.width;
