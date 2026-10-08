import type { Application } from 'pixi.js';
import { type RefObject, useEffect, useState } from 'react';
import { createApplication, KEEP_SHARED } from '../../render/pixi-app.ts';

/** Was eine Pixi-Bühne zum Abbau braucht. */
export interface DisposableScene {
  destroy(): void;
}

function mount<S extends DisposableScene>(
  element: HTMLElement,
  app: Application,
  create: (app: Application) => S,
) {
  element.appendChild(app.canvas);
  const scene = create(app);
  const observer = new ResizeObserver(() => app.resize());
  observer.observe(element);
  const dispose = () => {
    observer.disconnect();
    scene.destroy();
    app.destroy(KEEP_SHARED, { children: true });
  };
  return { scene, dispose };
}

type Mounted<S> = ReturnType<typeof mount<S & DisposableScene>>;

type Prepare<S> = (app: Application) => Mounted<S>;

/** Hängt die Anwendung ein, sofern das Element noch steht; sonst wird sie gleich verworfen. */
function attacher<S>(prepare: Prepare<S>, onReady: (mounted: Mounted<S>) => void) {
  let disposed = false;
  let mounted: Mounted<S> | null = null;
  const attach = (app: Application) => {
    if (disposed) {
      app.destroy(KEEP_SHARED, { children: true });
      return;
    }
    mounted = prepare(app);
    onReady(mounted);
  };
  const detach = () => {
    disposed = true;
    mounted?.dispose();
  };
  return { attach, detach };
}

/**
 * Startet eine Pixi-Anwendung im Element und baut darauf die Bühne. Ohne WebGL (etwa in
 * Tests) bleibt die Bühne `null`; die Oberfläche darüber funktioniert trotzdem.
 */
export function usePixiScene<S extends DisposableScene>(
  host: RefObject<HTMLDivElement | null>,
  create: (app: Application) => S,
  deps: readonly unknown[],
): S | null {
  const [scene, setScene] = useState<S | null>(null);
  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    const prepare = (app: Application) => mount(element, app, create);
    const { attach, detach } = attacher(prepare, (mounted) => setScene(mounted.scene));
    createApplication(element).then(attach, () => undefined);
    return detach;
  }, [host, ...deps]); // Die Bühne hängt nur an `deps`, nicht an `create`.
  return scene;
}
