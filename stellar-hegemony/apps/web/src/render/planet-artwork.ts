import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { PLANET_ART_CROPS } from '../artwork/planets.ts';
import { originalTexture } from './original-artwork.ts';
import type { PlanetLook } from './planet-texture.ts';

interface PlanetTexture {
  readonly texture: Texture;
  readonly circular: boolean;
}
const cache = new Map<PlanetLook, PlanetTexture>();

/** Bake the shared round illustration once instead of running a stencil mask for every planet/frame. */
function circularTexture(original: Texture, look: PlanetLook): Texture | undefined {
  const crop = PLANET_ART_CROPS[look];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = crop.size;
  const context = canvas.getContext('2d');
  const resource = original.source.resource as CanvasImageSource | undefined;
  if (context === null || resource === undefined) return undefined;
  context.beginPath();
  context.arc(crop.size / 2, crop.size / 2, crop.size / 2, 0, Math.PI * 2);
  context.clip();
  try {
    context.drawImage(resource, crop.x, crop.y, crop.size, crop.size, 0, 0, crop.size, crop.size);
    return Texture.from(canvas);
  } catch {
    return undefined;
  }
}

function croppedPlanetTexture(look: PlanetLook): PlanetTexture | undefined {
  const cached = cache.get(look);
  if (cached !== undefined) return cached;
  const crop = PLANET_ART_CROPS[look];
  const original = originalTexture(crop.path);
  if (original === undefined) return undefined;
  const baked = circularTexture(original, look);
  const texture =
    baked ??
    new Texture({
      source: original.source,
      frame: new Rectangle(crop.x, crop.y, crop.size, crop.size),
    });
  const result = { texture, circular: baked !== undefined };
  cache.set(look, result);
  return result;
}

/** Original illustration inside a circular mask; gameplay overlays keep their custom data. */
export function originalPlanetPiece(
  look: PlanetLook,
  diameter: number,
  tint = 0xffffff,
): Container | null {
  const art = croppedPlanetTexture(look);
  if (art === undefined) return null;
  const body = new Container();
  const sprite = new Sprite(art.texture);
  sprite.anchor.set(0.5);
  sprite.setSize(diameter, diameter);
  sprite.tint = tint;
  body.addChild(sprite);
  if (!art.circular) {
    const mask = new Graphics().circle(0, 0, diameter / 2).fill(0xffffff);
    body.addChild(mask);
    sprite.mask = mask;
  }
  return body;
}
