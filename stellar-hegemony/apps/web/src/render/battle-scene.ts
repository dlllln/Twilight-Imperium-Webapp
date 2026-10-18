import { type Application, Container, Sprite, type Ticker } from 'pixi.js';
import { type BattleFrame, FULL_FRAME, type ShipSpot, WORLD } from '../battle/battle-layout.ts';
import type { Shot } from '../battle/battle-shots.ts';
import { seatColor } from '../seat-colors.ts';
import { EffectLayer, type Point } from './battle-effects.ts';
import { BattleShipPiece } from './battle-ships.ts';
import { hexOf } from './palette.ts';
import type { PlanetLook } from './planet-texture.ts';
import { starfield } from './starfield.ts';
import { detailPlanetTexture, glowTexture, nebulaTexture } from './textures.ts';
import { originalPlanetPiece } from './planet-artwork.ts';

const LOOKS: readonly PlanetLook[] = ['cultural', 'hazardous', 'industrial', 'plain'];
/** Zwei große Planeten am unteren Rand, wie aus der Umlaufbahn gesehen. */
const PLANETS = [
  { x: -260, y: 640, size: 760 },
  { x: 330, y: 600, size: 430 },
] as const;
/** Fehlschüsse fliegen ein Stück am Ziel vorbei. */
const MISS_OFFSET = { x: 70, y: 55 } as const;

function planetBody(seed: number, index: number, look: PlanetLook, size: number): Container {
  const original = originalPlanetPiece(look, size);
  if (original !== null) return original;
  const body = new Sprite(detailPlanetTexture(`battle-${String(seed)}-${String(index)}`, look));
  body.anchor.set(0.5);
  body.width = body.height = size;
  return body;
}

function planetBackdrop(seed: number): Container {
  const display = new Container();
  PLANETS.forEach((spot, index) => {
    const look = LOOKS[(seed + index) % LOOKS.length] ?? 'plain';
    const halo = new Sprite(glowTexture());
    halo.anchor.set(0.5);
    halo.width = halo.height = spot.size * 1.35;
    halo.tint = 0x8fd0ff;
    halo.alpha = 0.35;
    halo.blendMode = 'add';
    const body = planetBody(seed, index, look, spot.size);
    halo.position.set(spot.x, spot.y);
    body.position.set(spot.x, spot.y);
    display.addChild(halo, body);
  });
  return display;
}

/**
 * Pixi-Bühne eines Raumkampfs (Controller der Darstellung): Schiffe beider Seiten,
 * Hintergrund mit Nebel und Planeten und die Wirkungen jeder Salve. `show` gleicht die
 * Schiffe mit dem Stand ab, `fire` spielt die Schüsse einer Runde ab.
 */
export class BattleScene {
  private readonly background = new Sprite(nebulaTexture());
  private readonly world = new Container();
  private readonly fleet = new Container();
  private readonly effects = new EffectLayer();
  private readonly stars;
  private ships = new Map<string, BattleShipPiece>();
  /** Schiffe, die gerade verglühen und danach abgebaut werden. */
  private dying: BattleShipPiece[] = [];

  constructor(
    private readonly app: Application,
    private readonly motion: boolean,
    seed: number,
    private readonly frame: BattleFrame = FULL_FRAME,
  ) {
    this.background.anchor.set(0.5);
    this.stars = starfield(seed, WORLD.width * 1.6, WORLD.height * 1.6);
    this.world.addChild(this.stars.display, planetBackdrop(seed), this.fleet, this.effects.display);
    app.stage.addChild(this.background, this.world);
    app.ticker.maxFPS = 60;
    app.ticker.add(this.tick);
    app.renderer.on('resize', this.reframe);
    this.reframe();
    if (motion) app.start();
  }

  /** Gleicht die Schiffe ab: neue erscheinen, fehlende explodieren, Schäden werden sichtbar. */
  show(spots: readonly ShipSpot[]): void {
    const next = new Map<string, BattleShipPiece>();
    spots.forEach((spot, index) => next.set(spot.id, this.pieceFor(spot, index)));
    for (const [id, piece] of this.ships) if (!next.has(id)) this.retire(piece);
    this.ships = next;
    this.redraw();
  }

  /** Spielt die Schüsse einer Runde ab; ohne Animationen bleibt es beim Endstand. */
  fire(shots: readonly Shot[]): void {
    if (!this.motion) return;
    const now = this.app.ticker.lastTime;
    for (const shot of shots) this.effects.at(now + shot.delay, () => this.resolve(shot));
  }

  /** Ein übersprungener Wurf hinterlässt keine Schüsse oder verspäteten Explosionen. */
  finish(): void {
    this.effects.clear();
    for (const piece of this.dying) piece.display.destroy({ children: true });
    this.dying = [];
    this.app.render();
  }

  destroy(): void {
    this.effects.clear();
    this.app.ticker.remove(this.tick);
    this.app.renderer.off('resize', this.reframe);
  }

  private pieceFor(spot: ShipSpot, index: number): BattleShipPiece {
    const known = this.ships.get(spot.id);
    if (known?.spot.x === spot.x && known.spot.y === spot.y) {
      known.setDamaged(spot.damaged);
      return known;
    }
    known?.display.destroy({ children: true });
    const piece = new BattleShipPiece(spot, index);
    this.fleet.addChild(piece.display);
    return piece;
  }

  /** Ein Schiff verlässt die Bühne; ohne vorherigen Treffer mit eigener Explosion. */
  private retire(piece: BattleShipPiece): void {
    if (!this.motion) {
      piece.display.destroy({ children: true });
      return;
    }
    if (!piece.vanishing) {
      const now = this.app.ticker.lastTime;
      this.effects.explosion({ x: piece.display.x, y: piece.display.y }, piece.width * 0.9, now);
      piece.vanish(now);
    }
    this.dying.push(piece);
  }

  private resolve(shot: Shot): void {
    const from = this.ships.get(shot.from);
    const to = this.ships.get(shot.to);
    if (from === undefined || to === undefined) return;
    const now = this.app.ticker.lastTime;
    const color = hexOf(seatColor(from.spot.seat));
    const target = { x: to.display.x, y: to.display.y };
    const end: Point =
      shot.outcome === 'miss'
        ? { x: target.x + from.spot.facing * MISS_OFFSET.x, y: target.y + MISS_OFFSET.y }
        : target;
    this.effects.laser(from.muzzle, end, color, from.spot.type === 'sunbreaker', now);
    this.impact(shot, to, target, now);
  }

  private impact(shot: Shot, to: BattleShipPiece, at: Point, now: number): void {
    if (shot.outcome === 'miss') return;
    if (shot.outcome === 'blocked') {
      this.effects.shield(at, to.width * 0.45, now);
      return;
    }
    this.effects.spark(at, 0xffe2a0, now);
    if (shot.outcome === 'hit') return;
    if (shot.outcome === 'damage') to.setDamaged(true);
    if (shot.outcome !== 'destroy') return;
    this.effects.explosion(at, to.width * 0.9, now);
    to.vanish(now);
  }

  private redraw(): void {
    if (this.motion) return;
    this.stars.animate(0);
    for (const piece of this.ships.values()) piece.animate(0);
    this.app.render();
  }

  private readonly reframe = (): void => {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / this.frame.width, height / this.frame.height);
    this.world.position.set(width / 2, height / 2 - this.frame.centerY * scale);
    this.world.scale.set(scale);
    const texture = this.background.texture;
    this.background.scale.set(Math.max(width / texture.width, height / texture.height) * 1.1);
    this.background.position.set(width / 2, height / 2);
    if (!this.motion) this.app.render();
  };

  private readonly tick = (ticker: Ticker): void => {
    const now = ticker.lastTime;
    this.stars.animate(now);
    for (const piece of this.ships.values()) piece.animate(now);
    this.dying = this.dying.filter((piece) => {
      piece.animate(now);
      if (!piece.gone) return true;
      piece.display.destroy({ children: true });
      return false;
    });
    this.effects.tick(now);
    this.background.rotation = now * 0.000003;
  };
}
