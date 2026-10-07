import { Container, Graphics } from 'pixi.js';
import { hexToPixel, HEX_SIZE } from '../hex-geometry.ts';
import { hexOf } from '../render/palette.ts';
import { seatColor } from '../seat-colors.ts';
import type { MapEffect } from './map-effects.ts';

const DURATION_MS: Readonly<Record<MapEffect['kind'], number>> = {
  travel: 900,
  pulse: 700,
  blast: 650,
  capture: 1000,
  arrive: 800,
};
const BLAST_COLOR = 0xffb347;
const TRAIL_STEPS = 6;

interface Running {
  readonly effect: MapEffect;
  readonly graphic: Graphics;
  elapsed: number;
}

const colorOf = (effect: MapEffect): number =>
  effect.kind === 'blast' ? BLAST_COLOR : hexOf(seatColor(effect.seat));

/** Punkt entlang eines Weges aus Hexfeldern; `t` von 0 bis 1. */
function along(path: Extract<MapEffect, { kind: 'travel' }>, t: number) {
  const points = path.path.map((hex) => hexToPixel(hex));
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const scaled = t * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const from = points[index] ?? { x: 0, y: 0 };
  const to = points[index + 1] ?? from;
  const local = scaled - index;
  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local };
}

function drawTravel(graphic: Graphics, effect: Extract<MapEffect, { kind: 'travel' }>, t: number) {
  const color = colorOf(effect);
  for (let step = TRAIL_STEPS; step >= 0; step -= 1) {
    const point = along(effect, Math.max(0, t - step * 0.03));
    const fade = 1 - step / (TRAIL_STEPS + 1);
    graphic.circle(point.x, point.y, 4 + 6 * fade).fill({ color, alpha: 0.15 + 0.6 * fade });
  }
}

type RingEffect = Exclude<MapEffect, { kind: 'travel' }>;

function drawRing(graphic: Graphics, effect: RingEffect, t: number) {
  const center = hexToPixel(effect.at);
  const color = colorOf(effect);
  const grow = effect.kind === 'arrive' ? 1 - t : t;
  const radius = HEX_SIZE * (0.3 + 0.7 * grow);
  graphic.circle(center.x, center.y, radius).stroke({ width: 4, color, alpha: 1 - t });
  if (effect.kind === 'blast' || effect.kind === 'capture')
    graphic.circle(center.x, center.y, radius * 0.6).fill({ color, alpha: 0.5 * (1 - t) });
}

/**
 * Ebene für kurze Effekte über der Karte (Bewegung, Aktivierung, Explosion, Eroberung).
 * Sie läuft nur, solange ein Effekt aktiv ist; danach ruht die Zeichenschleife wieder.
 */
export class EffectLayer {
  readonly container = new Container();
  private running: Running[] = [];

  get active(): boolean {
    return this.running.length > 0;
  }

  play(effects: readonly MapEffect[]): void {
    for (const effect of effects) {
      const graphic = new Graphics();
      this.container.addChild(graphic);
      this.running.push({ effect, graphic, elapsed: 0 });
    }
  }

  /** Ein Bild weiter; liefert, ob noch etwas läuft. */
  update(deltaMs: number): boolean {
    for (const item of this.running) this.advance(item, deltaMs);
    const finished = this.running.filter((item) => item.elapsed >= DURATION_MS[item.effect.kind]);
    for (const item of finished) item.graphic.destroy();
    this.running = this.running.filter((item) => !finished.includes(item));
    return this.active;
  }

  private advance(item: Running, deltaMs: number): void {
    item.elapsed += deltaMs;
    const t = Math.min(1, item.elapsed / DURATION_MS[item.effect.kind]);
    item.graphic.clear();
    if (item.effect.kind === 'travel') drawTravel(item.graphic, item.effect, t);
    else drawRing(item.graphic, item.effect, t);
  }
}
