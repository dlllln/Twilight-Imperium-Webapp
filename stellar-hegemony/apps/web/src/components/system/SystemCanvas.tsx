import { type ReactElement, useEffect, useRef } from 'react';
import { SystemScene } from '../../render/system-scene.ts';
import type { SystemLayout } from '../../system/system-layout.ts';
import { usePixiScene } from '../ui/use-pixi-scene.ts';

interface SystemCanvasProps {
  readonly layout: SystemLayout;
  readonly systemKey: string;
  readonly motion: boolean;
}

/** Die große, bewegte Darstellung eines Systems; rein dekorativ (Inhalt steht im Text daneben). */
export function SystemCanvas({ layout, systemKey, motion }: SystemCanvasProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const scene = usePixiScene(host, (app) => new SystemScene(app, motion), [motion]);
  useEffect(() => scene?.show(layout, systemKey), [scene, layout, systemKey]);
  return <div ref={host} className="system-canvas" aria-hidden="true" />;
}
