import { Application } from 'pixi.js';
import { type ReactElement, type RefObject, useEffect, useRef, useState } from 'react';
import type { MapEffect } from '../animation/map-effects.ts';
import type { Bounds } from '../hex-geometry.ts';
import { GalaxyScene } from '../render/galaxy-scene.ts';
import type { SceneHex } from '../render/scene-model.ts';
import type { Viewport } from '../store.ts';

/** Pixi misst Text sofort; die Schriften müssen daher vorher geladen sein. */
const FONT_FACES = ["700 30px 'Cinzel'", "700 10px 'Exo 2'", "400 10px 'Exo 2'"];
const loadFonts = () =>
  Promise.all(FONT_FACES.map((face) => document.fonts.load(face))).catch(() => []);

async function createApplication(host: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    preference: 'webgl',
    resolution: window.devicePixelRatio,
    autoDensity: true,
    autoStart: false,
  });
  await loadFonts();
  return app;
}

/** Hängt die Leinwand ein; `resizeTo` sieht nur Fenstergrößen, daher ein ResizeObserver. */
function mountScene(element: HTMLElement, app: Application) {
  element.appendChild(app.canvas);
  const scene = new GalaxyScene(app);
  const observer = new ResizeObserver(() => app.resize());
  observer.observe(element);
  const dispose = () => {
    observer.disconnect();
    scene.destroy();
    app.destroy(true, { children: true });
  };
  return { scene, dispose };
}

/** Startet Pixi einmalig; ohne WebGL meldet sie `onUnavailable` (SVG-Ersatzdarstellung). */
function useGalaxyScene(
  host: RefObject<HTMLDivElement | null>,
  onUnavailable: () => void,
): GalaxyScene | null {
  const [scene, setScene] = useState<GalaxyScene | null>(null);
  useEffect(() => {
    const element = host.current;
    let disposed = false;
    let mounted: ReturnType<typeof mountScene> | null = null;
    if (element === null) return;
    createApplication(element).then((app) => {
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      mounted = mountScene(element, app);
      setScene(mounted.scene);
    }, onUnavailable);
    return () => {
      disposed = true;
      mounted?.dispose();
    };
  }, [host, onUnavailable]);
  return scene;
}

interface PixiCanvasProps {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  /** Effekte des letzten Zugs; ein neues Array spielt sie ab. */
  readonly effects: readonly MapEffect[];
  readonly onUnavailable: () => void;
}

/** Die prachtvolle Darstellung der Galaxie; rein dekorativ, Bedienung liegt im SVG darüber. */
export function PixiCanvas({
  hexes,
  bounds,
  viewport,
  effects,
  onUnavailable,
}: PixiCanvasProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const scene = useGalaxyScene(host, onUnavailable);
  useEffect(() => scene?.show(hexes), [scene, hexes]);
  useEffect(() => scene?.frame(bounds, viewport), [scene, bounds, viewport]);
  useEffect(() => scene?.play(effects), [scene, effects]);
  return <div ref={host} className="pixi-host" aria-hidden="true" />;
}
