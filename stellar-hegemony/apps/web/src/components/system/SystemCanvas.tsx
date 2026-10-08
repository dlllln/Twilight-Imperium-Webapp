import type { Application } from 'pixi.js';
import { type ReactElement, type RefObject, useEffect, useRef, useState } from 'react';
import { createApplication, KEEP_SHARED } from '../../render/pixi-app.ts';
import { SystemScene } from '../../render/system-scene.ts';
import type { SystemLayout } from '../../system/system-layout.ts';

function mountSystem(element: HTMLElement, app: Application, motion: boolean) {
  element.appendChild(app.canvas);
  const scene = new SystemScene(app, motion);
  const observer = new ResizeObserver(() => app.resize());
  observer.observe(element);
  const dispose = () => {
    observer.disconnect();
    scene.destroy();
    app.destroy(KEEP_SHARED, { children: true });
  };
  return { scene, dispose };
}

/** Startet die Pixi-Bühne des Systems; ohne WebGL bleibt nur die Beschriftung darüber. */
function useSystemScene(host: RefObject<HTMLDivElement | null>, motion: boolean) {
  const [scene, setScene] = useState<SystemScene | null>(null);
  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    let disposed = false;
    let mounted: ReturnType<typeof mountSystem> | null = null;
    const attach = (app: Application) => {
      if (disposed) {
        app.destroy(KEEP_SHARED, { children: true });
        return;
      }
      mounted = mountSystem(element, app, motion);
      setScene(mounted.scene);
    };
    createApplication(element).then(attach, () => undefined);
    return () => {
      disposed = true;
      mounted?.dispose();
    };
  }, [host, motion]);
  return scene;
}

interface SystemCanvasProps {
  readonly layout: SystemLayout;
  readonly systemKey: string;
  readonly motion: boolean;
}

/** Die große, bewegte Darstellung eines Systems; rein dekorativ (Inhalt steht im Text daneben). */
export function SystemCanvas({ layout, systemKey, motion }: SystemCanvasProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const scene = useSystemScene(host, motion);
  useEffect(() => scene?.show(layout, systemKey), [scene, layout, systemKey]);
  return <div ref={host} className="system-canvas" aria-hidden="true" />;
}
