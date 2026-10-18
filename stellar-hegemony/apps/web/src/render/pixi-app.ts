import { Application } from 'pixi.js';
import { preloadOriginalArtwork } from './original-artwork.ts';

/** Pixi misst Text sofort; die Schriften müssen daher vorher geladen sein. */
const FONT_FACES = ["700 30px 'Cinzel'", "700 10px 'Exo 2'", "400 10px 'Exo 2'"];
const loadFonts = () =>
  Promise.all(FONT_FACES.map((face) => document.fonts.load(face))).catch(() => []);

/** DOM labels stay native sharp; oversampling the decorative board is bounded. */
export const renderResolution = (ratio: number): number =>
  Math.min(1.5, Math.max(1, Number.isFinite(ratio) ? ratio : 1));

/** Eine Pixi-Anwendung, die ihre Größe vom Elternelement übernimmt (Karte und Systemansicht). */
export async function createApplication(host: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    preference: 'webgl',
    resolution: renderResolution(window.devicePixelRatio),
    autoDensity: true,
    autoStart: false,
  });
  app.stage.eventMode = 'none';
  app.stage.interactiveChildren = false;
  await Promise.all([loadFonts(), preloadOriginalArtwork()]);
  return app;
}

/**
 * Leinwand entfernen, aber Pixis globale Pools behalten: Karte und Systemansicht laufen
 * gleichzeitig, und `destroy(true)` würde die Pools der anderen Anwendung mit leeren.
 */
export const KEEP_SHARED = { removeView: true, releaseGlobalResources: false } as const;
