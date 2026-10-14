import { create } from 'zustand';
import { clampTilt, MIN_TILT, TILT } from '../render/board-view.ts';
import { useSettingsStore } from '../settings-store.ts';
import { easeInOut } from './viewport-tween.ts';

/*
 * Freier Blick auf das Brett: Der Spieler dreht die Karte um ihre Mitte und neigt sie, bis hin
 * zur Draufsicht. Gespeichert wird nur die eigene Verstellung; die Grundrichtung (vom eigenen
 * Heimatsystem aus) kommt weiter vom Platz.
 */

/** Dauer, wenn ein Knopf die Karte dreht oder neigt. */
export const ORBIT_MS = 450;
/** Ein Knopfdruck dreht um eine Achtelumdrehung. */
export const TURN_STEP = Math.PI / 4;
/** Unterhalb davon gilt die Karte als Draufsicht. */
const TOP_LIMIT = (8 * Math.PI) / 180;

export interface Orbit {
  /** Zusätzliche Drehung zur Grundrichtung (Bogenmaß). */
  readonly turn: number;
  readonly tilt: number;
}

export const HOME_ORBIT: Orbit = { turn: 0, tilt: TILT };

export interface OrbitStore extends Orbit {
  /** Sofort verstellen, z. B. beim Ziehen mit Maus oder Fingern. */
  readonly orbitBy: (turn: number, tilt: number) => void;
  /** Weich zu einer Stellung fahren, z. B. per Knopf. */
  readonly orbitTo: (to: Orbit) => void;
  readonly rotateStep: (direction: 1 | -1) => void;
  /** Zwischen Draufsicht und Schrägansicht wechseln. */
  readonly toggleTop: () => void;
  readonly resetOrbit: () => void;
}

let frame = 0;

const stopOrbit = (): void => cancelAnimationFrame(frame);

/** Weicher Übergang zwischen zwei Stellungen; ohne Animationen ein Sprung. */
function glide(from: Orbit, to: Orbit, apply: (orbit: Orbit) => void): void {
  stopOrbit();
  if (!useSettingsStore.getState().animations) {
    apply(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = easeInOut(Math.min(1, (now - start) / ORBIT_MS));
    apply({
      turn: from.turn + (to.turn - from.turn) * t,
      tilt: from.tilt + (to.tilt - from.tilt) * t,
    });
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

export const isTopView = (orbit: Orbit): boolean => orbit.tilt <= TOP_LIMIT;

export const useOrbitStore = create<OrbitStore>()((set, get) => ({
  ...HOME_ORBIT,
  orbitBy: (turn, tilt) => {
    stopOrbit();
    set((state) => ({ turn: state.turn + turn, tilt: clampTilt(state.tilt + tilt) }));
  },
  orbitTo: (to) => glide(get(), { turn: to.turn, tilt: clampTilt(to.tilt) }, set),
  rotateStep: (direction) => get().orbitTo({ ...get(), turn: get().turn + direction * TURN_STEP }),
  toggleTop: () => get().orbitTo({ ...get(), tilt: isTopView(get()) ? TILT : MIN_TILT }),
  resetOrbit: () => get().orbitTo(HOME_ORBIT),
}));
