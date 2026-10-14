import type { GalaxyStore } from './store.ts';
import { useOrbitStore } from './system/orbit-store.ts';

const ZOOM_STEP = 1.2;
const PAN_STEP = 40;

type Shortcuts = Pick<GalaxyStore, 'generate' | 'zoomBy' | 'panBy' | 'resetView'>;

const BINDINGS: Readonly<Record<string, (store: Shortcuts) => void>> = {
  g: (store) => store.generate(),
  q: () => useOrbitStore.getState().rotateStep(1),
  e: () => useOrbitStore.getState().rotateStep(-1),
  t: () => useOrbitStore.getState().toggleTop(),
  '+': (store) => store.zoomBy(ZOOM_STEP),
  '-': (store) => store.zoomBy(1 / ZOOM_STEP),
  '0': (store) => {
    store.resetView();
    useOrbitStore.getState().resetOrbit();
  },
  ArrowLeft: (store) => store.panBy(PAN_STEP, 0),
  ArrowRight: (store) => store.panBy(-PAN_STEP, 0),
  ArrowUp: (store) => store.panBy(0, PAN_STEP),
  ArrowDown: (store) => store.panBy(0, -PAN_STEP),
};

/** Tastaturkürzel; in Eingabefeldern bleibt die Tastatur unberührt. */
export function handleShortcut(event: KeyboardEvent, store: Shortcuts): boolean {
  const target = event.target;
  if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    return false;
  const action = BINDINGS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (action === undefined) return false;
  action(store);
  return true;
}
