import { AdvancedBloomFilter } from 'pixi-filters';
import { type Application, Container, type Graphics, Sprite, type Ticker } from 'pixi.js';
import { EffectLayer } from '../animation/effect-layer.ts';
import type { MapEffect } from '../animation/map-effects.ts';
import type { Bounds } from '../hex-geometry.ts';
import type { Viewport } from '../store.ts';
import { boardGrid } from './board-grid.ts';
import type { Placed } from './board-pieces.ts';
import { type BoardView, FLAT_VIEW, sameView } from './board-view.ts';
import { drawHex, type HexLayers } from './hex-view.ts';
import type { SceneHex } from './scene-model.ts';
import { nebulaTexture } from './textures.ts';
import { CLOSE_ZOOM } from '../system/viewport-tween.ts';
import { detailLevel, lineScale, worldTransform } from './view-transform.ts';

const BACKGROUND_OVERSCAN = 1.1;
const PARALLAX = 0.04;
const PULSE_SPEED = 0.004;
/** Nur für das langsame Pulsieren der Hervorhebung (12 Bilder/s genügen, schont Akku und CPU); sonst wird erst bei Änderungen gezeichnet. */
const PULSE_FPS = 12;
/** Effekte (Flug, Explosion) laufen flüssiger, aber nur, solange sie dauern. */
const EFFECT_FPS = 60;

interface Framing {
  readonly bounds: Bounds;
  readonly viewport: Viewport;
}

function bloomLayer(): Container {
  const layer = new Container();
  layer.filters = [
    new AdvancedBloomFilter({ threshold: 0.3, bloomScale: 1.2, brightness: 1, blur: 5 }),
  ];
  return layer;
}

/**
 * Controller der Pixi-Darstellung (GRASP Controller, Single Responsibility):
 * kennt nur Szene-Daten und Ansicht, keine Spielregeln. React steuert sie über
 * `show` und `frame`, Treffer und Tastatur übernimmt die SVG-Ebene darüber.
 * Gezeichnet wird nur bei Änderungen; die Schleife läuft nur, solange etwas pulsiert
 * oder ein Effekt abläuft.
 */
export class GalaxyScene {
  private readonly background = new Sprite(nebulaTexture());
  private readonly world = new Container();
  private readonly layers: HexLayers = {
    base: new Container(),
    shadows: new Container(),
    glow: bloomLayer(),
    content: new Container(),
    labels: new Container(),
  };
  private readonly effects = new EffectLayer();
  private pulses: readonly Graphics[] = [];
  private framing: Framing | null = null;
  private placed: readonly Placed[] = [];
  private view: BoardView = FLAT_VIEW;
  /** Detailstufe des Zooms; bei einem Wechsel werden die Striche neu gezeichnet. */
  private level = 0;
  /** Angefordertes Bild (requestAnimationFrame), 0 wenn keins aussteht. */
  private pending = 0;

  constructor(private readonly app: Application) {
    this.background.anchor.set(0.5);
    this.layers.base.sortableChildren = true;
    this.layers.content.sortableChildren = true;
    this.layers.labels.sortableChildren = true;
    this.world.addChild(
      this.layers.base,
      this.layers.shadows,
      this.layers.glow,
      this.layers.content,
      this.layers.labels,
      this.effects.container,
    );
    app.stage.addChild(this.background, this.world);
    app.ticker.maxFPS = PULSE_FPS;
    app.ticker.add(this.pulse);
    app.renderer.on('resize', this.reframe);
  }

  /** Baut alle Felder neu auf; die Texturen bleiben im Cache. */
  show(hexes: readonly SceneHex[]): void {
    const names = Object.keys(this.layers) as (keyof HexLayers)[];
    const old = names.flatMap((name) => this.layers[name].removeChildren());
    const drawn = hexes.map((hex) => drawHex(hex, this.layers));
    this.placed = [...drawn.flatMap((hex) => hex.placed), ...boardGrid(this.layers.base, hexes)];
    this.pulses = drawn.flatMap((hex) => (hex.pulse === null ? [] : [hex.pulse]));
    this.arrange();
    this.redraw(true);
    // Erst nach dem Zeichnen freigeben, damit kein Shader mehr auf die alten Objekte zeigt.
    for (const child of old) child.destroy({ children: true });
  }

  /** Dreht das Brett zu einem neuen Blick; die Stücke werden nur neu ausgerichtet. */
  look(view: BoardView): void {
    if (sameView(view, this.view)) return;
    this.view = view;
    this.effects.view = view;
    this.arrange();
    this.redraw();
  }

  /** Nur die Striche neu, wenn der Zoom die Detailstufe wechselt. */
  private refine(level: number): void {
    if (level === this.level) return;
    this.level = level;
    this.arrange();
  }

  private arrange(): void {
    const frame = { view: this.view, line: lineScale(this.level) };
    for (const piece of this.placed) piece.arrange(frame);
  }

  /** Spielt Effekte eines Zuges ab; die Zeichenschleife läuft nur, solange sie dauern. */
  play(effects: readonly MapEffect[]): void {
    if (effects.length === 0) return;
    this.effects.play(effects);
    this.app.ticker.maxFPS = EFFECT_FPS;
    this.app.start();
  }

  frame(bounds: Bounds, viewport: Viewport): void {
    this.framing = { bounds, viewport };
    this.reframe();
  }

  destroy(): void {
    cancelAnimationFrame(this.pending);
    this.app.ticker.remove(this.pulse);
    this.app.renderer.off('resize', this.reframe);
  }

  private readonly reframe = (): void => {
    if (this.framing === null) return;
    const { bounds, viewport } = this.framing;
    const screen = this.app.screen;
    const transform = worldTransform(bounds, screen, viewport);
    this.world.scale.set(transform.scale);
    this.world.position.set(transform.x, transform.y);
    this.layers.labels.visible = viewport.zoom < CLOSE_ZOOM;
    this.coverBackground(viewport);
    this.refine(detailLevel(viewport.zoom));
    this.redraw();
  };

  /**
   * Zeichnet neu: sofort (nach einem Neuaufbau) oder einmal im nächsten Bild, auch wenn Kamera
   * und Drehung des Bretts im selben Bild beide etwas ändern. Läuft die Schleife, zeichnet sie selbst.
   */
  private redraw(now = false): void {
    const looping = this.pulses.length > 0 || this.effects.active;
    if (looping) this.app.start();
    else this.app.stop();
    if (now) this.app.render();
    else if (!looping && this.pending === 0) this.pending = requestAnimationFrame(this.paint);
  }

  private readonly paint = (): void => {
    this.pending = 0;
    this.app.render();
  };

  private coverBackground(viewport: Viewport): void {
    const { width, height } = this.app.screen;
    const texture = this.background.texture;
    const cover = Math.max(width / texture.width, height / texture.height) * BACKGROUND_OVERSCAN;
    this.background.scale.set(cover);
    this.background.position.set(
      width / 2 + viewport.panX * PARALLAX,
      height / 2 + viewport.panY * PARALLAX,
    );
  }

  private readonly pulse = (ticker: Ticker): void => {
    const alpha = 0.6 + 0.4 * Math.sin(ticker.lastTime * PULSE_SPEED);
    for (const frame of this.pulses) frame.alpha = alpha;
    if (this.effects.active && !this.effects.update(ticker.deltaMS)) {
      this.app.ticker.maxFPS = PULSE_FPS;
      this.redraw();
    }
  };
}
