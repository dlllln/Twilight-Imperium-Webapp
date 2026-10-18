import { AdvancedBloomFilter } from 'pixi-filters';
import { type Application, Container, Sprite, type Ticker } from 'pixi.js';
import { EffectLayer } from '../animation/effect-layer.ts';
import type { MapEffect } from '../animation/map-effects.ts';
import type { Bounds } from '../hex-geometry.ts';
import type { Viewport } from '../store.ts';
import type { Placed } from './board-pieces.ts';
import { type BoardView, FLAT_VIEW, sameView } from './board-view.ts';
import { type HexLayers } from './hex-view.ts';
import { HexSceneCache } from './hex-scene-cache.ts';
import type { SceneHex } from './scene-model.ts';
import { nebulaTexture } from './textures.ts';
import { CLOSE_ZOOM } from '../system/viewport-tween.ts';
import { detailLevel, lineScale, worldTransform } from './view-transform.ts';

const BACKGROUND_OVERSCAN = 1.1;
const PARALLAX = 0.04;
/** Effekte (Flug, Explosion) laufen flüssiger, aber nur, solange sie dauern. */
const EFFECT_FPS = 60;

interface Framing {
  readonly bounds: Bounds;
  readonly viewport: Viewport;
}

function bloomLayer(): Container {
  const layer = new Container();
  const bloom = new AdvancedBloomFilter({
    threshold: 0.3,
    bloomScale: 1.2,
    brightness: 1,
    blur: 5,
  });
  bloom.resolution = 0.5;
  layer.filters = [bloom];
  return layer;
}

/**
 * Controller der Pixi-Darstellung (GRASP Controller, Single Responsibility):
 * kennt nur Szene-Daten und Ansicht, keine Spielregeln. React steuert sie über
 * `show` und `frame`, Treffer und Tastatur übernimmt die SVG-Ebene darüber.
 * Gezeichnet wird nur bei Änderungen; die Schleife läuft nur während kurzer Spieleffekte.
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
  private readonly cache = new HexSceneCache(this.layers);
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
    app.ticker.maxFPS = EFFECT_FPS;
    app.ticker.add(this.pulse);
    app.renderer.on('resize', this.reframe);
  }

  /** Aktualisiert nur veränderte Systeme; unveränderte Figuren und Beschriftungen bleiben bestehen. */
  show(hexes: readonly SceneHex[]): void {
    const update = this.cache.update(hexes);
    if (!update.changed) return;
    this.placed = update.placed;
    const frame = { view: this.view, line: lineScale(this.level) };
    for (const piece of update.fresh) piece.arrange(frame);
    this.redraw(true);
    // Erst nach dem Zeichnen freigeben, damit kein Shader mehr auf die alten Objekte zeigt.
    for (const child of update.retired) child.destroy({ children: true });
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
    const looping = this.effects.active;
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
    if (this.effects.active && !this.effects.update(ticker.deltaMS)) {
      this.redraw();
    }
  };
}
