import { create } from 'zustand';
import { useSettingsStore } from '../settings-store.ts';
import { useGalaxyStore, type Viewport } from '../store.ts';
import { animateViewport } from './viewport-tween.ts';

export interface SystemViewStore {
  /** Schlüssel des geöffneten Feldes (`q,r`) oder null, wenn die Galaxie zu sehen ist. */
  readonly key: string | null;
  /** Kameraposition vor dem Hineinzoomen; beim Schließen fährt die Kamera dorthin zurück. */
  readonly returnTo: Viewport | null;
  readonly open: (key: string, focus: Viewport) => void;
  readonly close: () => void;
}

function moveCamera(to: Viewport): void {
  const galaxy = useGalaxyStore.getState();
  if (useSettingsStore.getState().animations)
    animateViewport(galaxy.viewport, to, galaxy.setViewport);
  else galaxy.setViewport(to);
}

/** Systemansicht: Kamerafahrt in ein Feld hinein und wieder hinaus. */
export const useSystemViewStore = create<SystemViewStore>()((set, get) => ({
  key: null,
  returnTo: null,
  open: (key, focus) => {
    const returnTo = get().returnTo ?? useGalaxyStore.getState().viewport;
    set({ key, returnTo });
    moveCamera(focus);
  },
  close: () => {
    const { returnTo } = get();
    set({ key: null, returnTo: null });
    if (returnTo !== null) moveCamera(returnTo);
  },
}));
