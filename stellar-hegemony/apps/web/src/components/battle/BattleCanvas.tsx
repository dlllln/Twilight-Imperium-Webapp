import { type ReactElement, useEffect, useMemo, useRef } from 'react';
import {
  type BattleFrame,
  battleLayout,
  type BattleSide,
  FULL_FRAME,
} from '../../battle/battle-layout.ts';
import type { Shot } from '../../battle/battle-shots.ts';
import { BattleScene } from '../../render/battle-scene.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { usePixiScene } from '../ui/use-pixi-scene.ts';

interface BattleCanvasProps {
  readonly left: BattleSide;
  readonly right: BattleSide;
  /** Schüsse der letzten Runde; `volley` zählt hoch, sobald neue abgespielt werden sollen. */
  readonly shots: readonly Shot[];
  readonly volley: number;
  readonly seed: number;
  readonly frame?: BattleFrame;
  /** Bereits aufgedeckte Runde: ausstehende dekorative Wirkungen abbrechen. */
  readonly settled?: boolean;
}

/** Bewegte Kampfbühne; rein dekorativ, der Stand steht lesbar in der Oberfläche darüber. */
export function BattleCanvas({
  left,
  right,
  shots,
  volley,
  seed,
  frame = FULL_FRAME,
  settled = false,
}: BattleCanvasProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const motion = useSettingsStore((state) => state.animations);
  const scene = usePixiScene(host, (app) => new BattleScene(app, motion, seed, frame), [
    motion,
    seed,
    frame,
  ]);
  const spots = useMemo(() => battleLayout(left, right), [left, right]);
  useEffect(() => scene?.show(spots), [scene, spots]);
  useEffect(() => {
    if (volley > 0) scene?.fire(shots);
  }, [scene, volley]); // Schüsse nur bei einer neuen Salve abspielen.
  useEffect(() => {
    if (settled) scene?.finish();
  }, [scene, settled]);
  return <div ref={host} className="battle-canvas" aria-hidden="true" />;
}
