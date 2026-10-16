import { useEffect } from 'react';
import { create } from 'zustand';
import type { TargetRef } from './target-ref.ts';

/*
 * Das Stück in der Hand: aufgenommen per Ziehen ('drag') oder per Klick bzw. Taste ('sticky').
 * `news` meldet jedes Aufnehmen, Ablegen und Zurücklegen einmal (für die Live-Ansage).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type CarryMode = 'drag' | 'sticky';

export interface CarryNews {
  readonly serial: number;
  readonly kind: 'carried' | 'placed' | 'putBack';
  readonly ref: TargetRef;
}

export interface CarryStore {
  readonly piece: TargetRef | null;
  /** Schlüssel der Ziele, auf die das Stück gelegt werden darf. */
  readonly legal: ReadonlySet<string>;
  /** Ziel unter dem Zeiger beim Ziehen. */
  readonly over: string | null;
  readonly point: Point | null;
  readonly mode: CarryMode | null;
  readonly news: CarryNews | null;
  readonly pickUp: (piece: TargetRef, legal: ReadonlySet<string>, mode: CarryMode) => void;
  readonly track: (point: Point, over: string | null) => void;
  readonly place: (target: TargetRef) => void;
  readonly putDown: () => void;
}

const EMPTY_HAND = { piece: null, legal: new Set<string>(), over: null, point: null, mode: null };

type Set = (update: (state: CarryStore) => Partial<CarryStore>) => void;

const report = (state: CarryStore, kind: CarryNews['kind'], ref: TargetRef): CarryNews => ({
  serial: (state.news?.serial ?? 0) + 1,
  kind,
  ref,
});

const putDownWith = (set: Set) => () => {
  set((state) =>
    state.piece === null ? {} : { ...EMPTY_HAND, news: report(state, 'putBack', state.piece) },
  );
};

export const useCarryStore = create<CarryStore>()((set) => ({
  ...EMPTY_HAND,
  news: null,
  pickUp: (piece, legal, mode) => {
    set((state) => ({ ...EMPTY_HAND, piece, legal, mode, news: report(state, 'carried', piece) }));
  },
  track: (point, over) => {
    set({ point, over });
  },
  place: (target) => {
    set((state) => ({ ...EMPTY_HAND, news: report(state, 'placed', target) }));
  },
  putDown: putDownWith(set),
}));

/** Escape legt das getragene Stück zurück, bevor andere Tastenhörer (z. B. die Kamera) es sehen. */
function escapeWhileCarrying(event: KeyboardEvent): void {
  const { piece, putDown } = useCarryStore.getState();
  if (event.key !== 'Escape' || piece === null) return;
  putDown();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

export function useCarryEscape(): void {
  useEffect(() => {
    window.addEventListener('keydown', escapeWhileCarrying, true);
    return () => {
      window.removeEventListener('keydown', escapeWhileCarrying, true);
    };
  }, []);
}
