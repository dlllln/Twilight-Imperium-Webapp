import { Container, Graphics, Sprite } from 'pixi.js';
import { glowTexture } from './textures.ts';

/*
 * Kurzlebige Wirkungen der Kampfbühne: Laserstrahlen, Funken, Schildblitze und Explosionen
 * mit Rauchring und Trümmern. Jede Wirkung läuft eine feste Zeit und räumt sich dann selbst ab.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

interface Running {
  readonly display: Container;
  readonly start: number;
  readonly duration: number;
  readonly step: (t: number) => void;
}

const LASER_MS = 320;
const SPARK_MS = 260;
const SHIELD_MS = 380;
const BLAST_MS = 1100;
const DEBRIS = 12;

const clamp = (t: number): number => Math.min(1, Math.max(0, t));

function glow(color: number, size: number, alpha = 1): Sprite {
  const sprite = new Sprite(glowTexture());
  sprite.anchor.set(0.5);
  sprite.width = size;
  sprite.height = size;
  sprite.tint = color;
  sprite.alpha = alpha;
  sprite.blendMode = 'add';
  return sprite;
}

function beam(from: Point, to: Point, color: number, width: number): Graphics {
  const graphics = new Graphics()
    .moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ width: width * 4, color, alpha: 0.25 })
    .moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ width, color: 0xffffff, alpha: 0.95 });
  graphics.blendMode = 'add';
  return graphics;
}

/** Verwaltet alle laufenden Wirkungen; `tick` bewegt sie und entfernt fertige. */
export class EffectLayer {
  readonly display = new Container();
  private running: Running[] = [];
  private scheduled: { readonly time: number; readonly action: () => void }[] = [];

  /** Führt `action` aus, sobald die Bühnenzeit `time` erreicht ist. */
  at(time: number, action: () => void): void {
    this.scheduled.push({ time, action });
  }

  laser(from: Point, to: Point, color: number, heavy: boolean, now: number): void {
    const width = heavy ? 7 : 2.5;
    const display = new Container();
    const muzzle = glow(color, heavy ? 90 : 40);
    muzzle.position.set(from.x, from.y);
    display.addChild(beam(from, to, color, width), muzzle);
    this.add(display, now, LASER_MS, (t) => (display.alpha = 1 - t * t));
  }

  spark(at: Point, color: number, now: number): void {
    const flash = glow(color, 30);
    flash.position.set(at.x, at.y);
    this.add(flash, now, SPARK_MS, (t) => {
      flash.scale.set((0.4 + t * 1.6) * (30 / flash.texture.width));
      flash.alpha = 1 - t;
    });
  }

  shield(at: Point, radius: number, now: number): void {
    const ring = new Graphics()
      .circle(0, 0, radius)
      .stroke({ width: 4, color: 0x7fd8ff, alpha: 0.9 });
    ring.position.set(at.x, at.y);
    ring.blendMode = 'add';
    this.add(ring, now, SHIELD_MS, (t) => {
      ring.alpha = 1 - t;
      ring.scale.set(1 + t * 0.25);
    });
  }

  explosion(at: Point, size: number, now: number): void {
    const display = new Container();
    display.position.set(at.x, at.y);
    const flash = glow(0xffffff, size * 1.6);
    const fire = glow(0xff9a3c, size * 1.2);
    const smoke = new Graphics()
      .circle(0, 0, size * 0.5)
      .stroke({ width: size * 0.22, color: 0xd8ccb4 });
    const debris = this.debris(size);
    display.addChild(smoke, fire, flash, debris.display);
    this.add(display, now, BLAST_MS, (t) => {
      flash.alpha = clamp(1 - t * 5);
      fire.alpha = clamp(1 - t * 1.6);
      smoke.scale.set(0.4 + t * 1.4);
      smoke.alpha = clamp(0.85 - t);
      debris.step(t);
    });
  }

  tick(now: number): void {
    const due = this.scheduled.filter((entry) => entry.time <= now);
    this.scheduled = this.scheduled.filter((entry) => entry.time > now);
    for (const entry of due) entry.action();
    const done = this.running.filter((effect) => now - effect.start >= effect.duration);
    this.running = this.running.filter((effect) => !done.includes(effect));
    for (const effect of done) effect.display.destroy({ children: true });
    for (const effect of this.running) {
      effect.display.visible = now >= effect.start;
      effect.step(clamp((now - effect.start) / effect.duration));
    }
  }

  clear(): void {
    for (const effect of this.running) effect.display.destroy({ children: true });
    this.running = [];
    this.scheduled = [];
  }

  private debris(size: number) {
    const display = new Container();
    const pieces = Array.from({ length: DEBRIS }, (_, index) => {
      const piece = glow(index % 2 === 0 ? 0xffd27a : 0xff6a2a, 10);
      display.addChild(piece);
      return {
        piece,
        angle: (index / DEBRIS) * Math.PI * 2 + index,
        speed: 0.6 + (index % 3) * 0.3,
      };
    });
    const step = (t: number) => {
      for (const { piece, angle, speed } of pieces) {
        piece.position.set(Math.cos(angle) * size * speed * t, Math.sin(angle) * size * speed * t);
        piece.alpha = 1 - t;
      }
    };
    return { display, step };
  }

  private add(
    display: Container,
    start: number,
    duration: number,
    step: (t: number) => void,
  ): void {
    step(0);
    display.visible = false;
    this.display.addChild(display);
    this.running.push({ display, start, duration, step });
  }
}
