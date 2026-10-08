import { type Application, Container, Sprite, type Ticker } from 'pixi.js';
import { hashString } from './noise.ts';
import {
  backdropPiece,
  centralPiece,
  fleetPiece,
  orbitPiece,
  type Piece,
  planetPiece,
  starfield,
  wormholePiece,
} from './system-pieces.ts';
import { nebulaTexture } from './textures.ts';
import { fitScale, type SystemLayout, WORLD } from '../system/system-layout.ts';

const INTRO_MS = 1100;
const STAGGER_MS = 90;
const FADE_MS = 420;
const INTRO_SCALE = 0.45;

const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Alle Teile in Zeichenreihenfolge: hinten Nebel und Bahnen, vorn Flotten. */
function piecesOf(layout: SystemLayout, seed: number): Piece[] {
  const backdrop = backdropPiece(layout);
  return [
    starfield(seed, WORLD.width * 1.6, WORLD.height * 1.6),
    ...(backdrop === null ? [] : [backdrop]),
    ...layout.planets.map((planet) => orbitPiece(planet, layout.star)),
    centralPiece(layout),
    ...layout.wormholes.map((hole) => wormholePiece(hole.kind, hole.x, hole.y)),
    ...layout.planets.map(planetPiece),
    ...layout.fleets.map(fleetPiece),
  ];
}

/**
 * Pixi-Bühne der Systemansicht (Controller der Darstellung, wie `GalaxyScene`):
 * baut die Teile aus dem `SystemLayout`, zoomt beim Öffnen hinein und bewegt Schiffe,
 * Jäger, Monde und Docks. Ohne Animationen wird einmal gezeichnet und nichts bewegt sich.
 */
export class SystemScene {
  private readonly background = new Sprite(nebulaTexture());
  private readonly world = new Container();
  private pieces: Piece[] = [];
  private opened = -1;

  constructor(
    private readonly app: Application,
    private readonly motion: boolean,
  ) {
    this.background.anchor.set(0.5);
    app.stage.addChild(this.background, this.world);
    app.ticker.maxFPS = 60;
    app.ticker.add(this.tick);
    app.renderer.on('resize', this.reframe);
  }

  show(layout: SystemLayout, key: string): void {
    const old = this.world.removeChildren();
    this.pieces = piecesOf(layout, hashString(key));
    for (const piece of this.pieces) this.world.addChild(piece.display);
    this.reframe();
    for (const child of old) child.destroy({ children: true });
    if (this.motion) this.app.start();
    else this.still();
  }

  destroy(): void {
    this.app.ticker.remove(this.tick);
    this.app.renderer.off('resize', this.reframe);
  }

  private still(): void {
    for (const piece of this.pieces) piece.animate(0);
    this.app.stop();
    this.app.render();
  }

  private readonly reframe = (): void => {
    const { width, height } = this.app.screen;
    const scale = fitScale(width, height);
    this.world.position.set(width / 2, height / 2);
    this.world.scale.set(scale * this.introScale());
    const cover = Math.max(
      width / this.background.texture.width,
      height / this.background.texture.height,
    );
    this.background.scale.set(cover * 1.1);
    this.background.position.set(width / 2, height / 2);
    if (!this.motion) this.app.render();
  };

  private introScale(): number {
    if (!this.motion || this.opened < 0) return 1;
    const t = easeOut((this.app.ticker.lastTime - this.opened) / INTRO_MS);
    return INTRO_SCALE + (1 - INTRO_SCALE) * t;
  }

  private readonly tick = (ticker: Ticker): void => {
    if (this.opened < 0) this.opened = ticker.lastTime;
    const elapsed = ticker.lastTime - this.opened;
    this.pieces.forEach((piece, index) => {
      piece.display.alpha = easeOut((elapsed - index * STAGGER_MS) / FADE_MS);
      piece.animate(ticker.lastTime);
    });
    const { width, height } = this.app.screen;
    this.world.scale.set(fitScale(width, height) * this.introScale());
    this.background.rotation = elapsed * 0.000004;
  };
}
