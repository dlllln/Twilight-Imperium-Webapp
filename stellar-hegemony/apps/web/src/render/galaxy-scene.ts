import { AdvancedBloomFilter } from 'pixi-filters';
import { type Application, Container, type Graphics, Sprite, type Ticker } from 'pixi.js';
import { EffectLayer } from '../animation/effect-layer.ts';
import type { MapEffect } from '../animation/map-effects.ts';
import type { Bounds } from '../hex-geometry.ts';
import type { Viewport } from '../store.ts';
import { drawHex, type HexLayers } from './hex-view.ts';
import type { SceneHex } from './scene-model.ts';
import { nebulaTexture } from './textures.ts';
import { worldTransform } from './view-transform.ts';

const BACKGROUND_OVERSCAN = 1.1;
const PARALLAX = 0.04;
const PULSE_SPEED = 0.004;
/** Nur für das Pulsieren der Hervorhebung; sonst wird erst bei Änderungen gezeichnet. */
const PULSE_FPS = 30;
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
    glow: bloomLayer(),
    content: new Container(),
  };
  private readonly effects = new EffectLayer();
  private pulses: readonly Graphics[] = [];
  private framing: Framing | null = null;

  constructor(private readonly app: Application) {
    this.background.anchor.set(0.5);
    this.layers.base.sortableChildren = true;
    this.layers.content.sortableChildren = true;
    this.world.addChild(
      this.layers.base,
      this.layers.glow,
      this.layers.content,
      this.effects.container,
    );
    app.stage.addChild(this.background, this.world);
    app.ticker.maxFPS = PULSE_FPS;
    app.ticker.add(this.pulse);
    app.renderer.on('resize', this.reframe);
  }

  /** Baut alle Felder neu auf; die Texturen bleiben im Cache. */
  show(hexes: readonly SceneHex[]): void {
    const { base, glow, content } = this.layers;
    const old = [base, glow, content].flatMap((layer) => layer.removeChildren());
    this.pulses = hexes.flatMap((hex) => drawHex(hex, this.layers) ?? []);
    this.redraw();
    // Erst nach dem Zeichnen freigeben, damit kein Shader mehr auf die alten Objekte zeigt.
    for (const child of old) child.destroy({ children: true });
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
    this.coverBackground(viewport);
    this.redraw();
  };

  private redraw(): void {
    if (this.pulses.length > 0 || this.effects.active) this.app.start();
    else this.app.stop();
    this.app.render();
  }

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
