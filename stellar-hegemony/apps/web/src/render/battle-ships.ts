import { Container, Sprite } from 'pixi.js';
import type { ShipSpot } from '../battle/battle-layout.ts';
import { detailUnitTexture, glowTexture, SHIP_ASPECT } from './textures.ts';

/** Breite eines Schiffs bei Maßstab 1 auf der Kampfbühne. */
export const BATTLE_SHIP_WIDTH = 124;
const FLAME_COLOR = 0x7fe3ff;
const FIRE_COLOR = 0xff7a2a;
const SMOKE_COLOR = 0x8a8478;
const PUFFS = 3;
const FADE_MS = 500;

function glow(color: number, size: number): Sprite {
  const sprite = new Sprite(glowTexture());
  sprite.anchor.set(0.5);
  sprite.width = size;
  sprite.height = size;
  sprite.tint = color;
  sprite.blendMode = 'add';
  return sprite;
}

function smokePuff(): Sprite {
  const puff = new Sprite(glowTexture());
  puff.anchor.set(0.5);
  puff.tint = SMOKE_COLOR;
  return puff;
}

/** Rauch und Flammen an einem beschädigten Schiff. */
function damageFx(width: number) {
  const display = new Container();
  const fire = glow(FIRE_COLOR, width * 0.35);
  const puffs = Array.from({ length: PUFFS }, () => display.addChild(smokePuff()));
  display.addChild(fire);
  const animate = (time: number, phase: number) => {
    fire.alpha = 0.55 + 0.35 * Math.sin(time * 0.03 + phase);
    puffs.forEach((puff, index) => {
      const t = (((time * 0.0006 + index / PUFFS + phase) % 1) + 1) % 1;
      puff.position.set(-width * 0.1 * t, -width * 0.35 * t);
      puff.width = puff.height = width * (0.15 + t * 0.3);
      puff.alpha = 0.55 * (1 - t);
    });
  };
  return { display, animate };
}

/** Ein Schiff der Kampfbühne: Rumpf, Triebwerk, bei Schaden Rauch; kann verglühen. */
export class BattleShipPiece {
  readonly display = new Container();
  readonly width: number;
  private readonly flame: Sprite;
  private readonly damage: ReturnType<typeof damageFx>;
  private readonly phase: number;
  private fadeFrom = -1;

  constructor(
    readonly spot: ShipSpot,
    index: number,
  ) {
    this.width = BATTLE_SHIP_WIDTH * spot.scale;
    this.phase = index * 1.37;
    this.flame = glow(FLAME_COLOR, this.width * 0.5);
    this.flame.position.set(-spot.facing * this.width * 0.48, 0);
    const hull = new Sprite(detailUnitTexture(spot.type, spot.seat));
    hull.anchor.set(0.5);
    hull.width = this.width;
    hull.height = this.width * SHIP_ASPECT;
    hull.scale.x *= spot.facing;
    this.damage = damageFx(this.width);
    this.damage.display.visible = spot.damaged;
    this.display.addChild(this.flame, hull, this.damage.display);
    this.display.position.set(spot.x, spot.y);
  }

  get muzzle(): { x: number; y: number } {
    return { x: this.display.x + this.spot.facing * this.width * 0.45, y: this.display.y };
  }

  setDamaged(damaged: boolean): void {
    this.damage.display.visible = damaged;
  }

  /** Nach einer Explosion: der Rumpf verglüht und verschwindet. */
  vanish(now: number): void {
    this.fadeFrom = now;
  }

  get vanishing(): boolean {
    return this.fadeFrom >= 0;
  }

  get gone(): boolean {
    return this.fadeFrom >= 0 && this.display.alpha <= 0;
  }

  animate(time: number): void {
    this.display.y = this.spot.y + Math.sin(time * 0.0012 + this.phase) * 4;
    this.flame.alpha = 0.6 + 0.3 * Math.sin(time * 0.02 + this.phase * 3);
    this.damage.animate(time, this.phase);
    if (this.fadeFrom >= 0) this.display.alpha = Math.max(0, 1 - (time - this.fadeFrom) / FADE_MS);
  }
}
