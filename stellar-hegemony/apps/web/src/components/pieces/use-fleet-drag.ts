import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { RefObject } from 'react';
import { useSettingsStore } from '../../settings-store.ts';
import { FleetDrag, type FleetDragConfig, type LiftedFleet } from '../../system/fleet-drag.ts';
import { fleetPoint, insideSystem, type FleetProjection } from '../../system/fleet-placement.ts';
import { stageShips } from '../../system/movement-draft.ts';
import type { Point } from '../../hex-geometry.ts';

const translate = (at: Point): string => `translate(${String(at.x)}px, ${String(at.y)}px)`;

function draw(ghost: RefObject<HTMLDivElement | null>, at: Point, valid: boolean): void {
  if (ghost.current === null) return;
  ghost.current.style.transform = translate(at);
  ghost.current.dataset['valid'] = String(valid);
}

interface DragView {
  readonly frame: FleetProjection;
  readonly active: string;
  readonly scope: string;
}

function snapAnimation(node: HTMLDivElement, to: Point): Animation {
  return node.animate([{ transform: node.style.transform }, { transform: translate(to) }], {
    duration: 220,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    fill: 'forwards',
  });
}

function allowsSnap(): boolean {
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return useSettingsStore.getState().animations && !reduced;
}

/** Finite compositor animation for a magnetic snap, or an immediate move without animations. */
function snap(node: HTMLDivElement | null, to: Point | null, clear: () => void): () => void {
  if (node === null || to === null || !allowsSnap() || typeof node.animate !== 'function') {
    clear();
    return () => undefined;
  }
  const animation = snapAnimation(node, to);
  const timer = setTimeout(clear, 230);
  return () => {
    clearTimeout(timer);
    animation.cancel();
  };
}

function useSnapPreference(reset: () => void): void {
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!animations || reduced) reset();
  }, [animations, reduced]);
}

function useDropGhost(view: DragView) {
  const ghost = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState<LiftedFleet | null>(null);
  const cleanup = useRef<() => void>(() => undefined);
  const lift = (fleet: LiftedFleet) => {
    cleanup.current();
    setLifted(fleet);
  };
  const settle = (fleet: LiftedFleet, valid: boolean) => {
    const target = valid ? view.active : fleet.origin.from;
    cleanup.current = snap(ghost.current, fleetPoint(view.frame, target), () => setLifted(null));
  };
  const reset = () => {
    cleanup.current();
    setLifted(null);
  };
  useSnapPreference(reset);
  useEffect(() => () => cleanup.current(), []);
  return { ghost, lifted, lift, settle, reset };
}

function useDragController(view: DragView, visual: ReturnType<typeof useDropGhost>) {
  const next: FleetDragConfig = {
    lift: visual.lift,
    settle: visual.settle,
    draw: (at, valid) => draw(visual.ghost, at, valid),
    accept: (at) => insideSystem(view.frame, view.active, at),
    stage: (origin) => stageShips(view.scope, origin.options),
  };
  const config = useRef(next);
  config.current = next;
  const controller = useRef<FleetDrag | null>(null);
  controller.current ??= new FleetDrag(() => config.current);
  return controller.current;
}

export function useFleetDrag(view: DragView) {
  const visual = useDropGhost(view);
  const drag = useDragController(view, visual);
  useEffect(() => {
    visual.reset();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !drag.active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drag.cancel();
    };
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('keydown', escape, true);
      drag.dispose();
    };
  }, [drag, view.scope]);
  return { ...visual, drag };
}
