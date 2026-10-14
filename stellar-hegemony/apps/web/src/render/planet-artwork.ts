import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { PLANET_ART_CROPS } from '../artwork/planets.ts';
import { originalTexture } from './original-artwork.ts';
import type { PlanetLook } from './planet-texture.ts';

const cache = new Map<PlanetLook, Texture>();

function croppedPlanetTexture(look: PlanetLook): Texture | undefined {
  const cached = cache.get(look);
  if (cached !== undefined) return cached;
  const crop = PLANET_ART_CROPS[look];
  const original = originalTexture(crop.path);
  if (original === undefined) return undefined;
  const texture = new Texture({
    source: original.source,
    frame: new Rectangle(crop.x, crop.y, crop.size, crop.size),
  });
  cache.set(look, texture);
  return texture;
}

/** Original illustration inside a circular mask; gameplay overlays keep their custom data. */
export function originalPlanetPiece(
  look: PlanetLook,
  diameter: number,
  tint = 0xffffff,
): Container | null {
  const texture = croppedPlanetTexture(look);
  if (texture === undefined) return null;
  const body = new Container();
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.setSize(diameter, diameter);
  sprite.tint = tint;
  const mask = new Graphics().circle(0, 0, diameter / 2).fill(0xffffff);
  body.addChild(sprite, mask);
  sprite.mask = mask;
  return body;
}
