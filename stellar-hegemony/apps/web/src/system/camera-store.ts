import { create } from 'zustand';
import { useSettingsStore } from '../settings-store.ts';
import { DEFAULT_VIEWPORT, useGalaxyStore, type Viewport } from '../store.ts';
import { animateViewport, glideGoal, glideTo, settled, stopCamera } from './viewport-tween.ts';

export interface CameraStore {
  /** Ansicht vor dem Heranfahren an ein System; Escape kehrt dorthin zurück. */
  readonly returnTo: Viewport | null;
  /** Fährt an ein System heran und merkt sich, woher die Kamera kam. */
  readonly focus: (to: Viewport) => void;
  /** Zurück zur gemerkten Ansicht bzw. zur ganzen Karte. */
  readonly back: () => void;
}

const animated = (): boolean => useSettingsStore.getState().animations;

/** Kamerafahrt (mit Animationen) oder Sprung (ohne); steht die Kamera schon dort, bleibt alles ruhig. */
export function moveCamera(to: Viewport): void {
  const galaxy = useGalaxyStore.getState();
  if (settled(galaxy.viewport, to)) return;
  if (animated()) animateViewport(galaxy.viewport, to, galaxy.setViewport);
  else galaxy.setViewport(to);
}

/** Zoomschritt: gleitet weich, weitere Schritte bauen auf dem Ziel auf. */
export function glideCamera(change: (from: Viewport) => Viewport): void {
  const galaxy = useGalaxyStore.getState();
  const to = change(glideGoal() ?? galaxy.viewport);
  if (!animated()) {
    stopCamera();
    galaxy.setViewport(to);
    return;
  }
  glideTo(to, () => useGalaxyStore.getState().viewport, useGalaxyStore.getState().setViewport);
}

/** Kamera der Sternenkarte: heranfahren und zurück, ohne eigene Ansicht. */
export const useCameraStore = create<CameraStore>()((set, get) => ({
  returnTo: null,
  focus: (to) => {
    set({ returnTo: get().returnTo ?? useGalaxyStore.getState().viewport });
    moveCamera(to);
  },
  back: () => {
    moveCamera(get().returnTo ?? DEFAULT_VIEWPORT);
    set({ returnTo: null });
  },
}));
