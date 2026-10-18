import { useEffect } from 'react';
import { create } from 'zustand';
import type { TargetRef } from './target-ref.ts';

/*
 * Das Stück in der Hand: aufgenommen per Ziehen ('drag'), per Klick ('sticky') oder per Taste
 * ('keyboard'; dann wandert der Fokus mit). `news` meldet jedes Aufnehmen, Ablegen und
 * Zurücklegen einmal (für die Live-Ansage und den Fokus).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type CarryMode = 'drag' | 'sticky' | 'keyboard';

export interface CarryNews {
  readonly serial: number;
  readonly kind: 'carried' | 'placed' | 'putBack';
  /** Das Ziel beim Ablegen, sonst das Stück selbst. */
  readonly ref: TargetRef;
  /** Das getragene Stück. */
  readonly piece: TargetRef;
  readonly mode: CarryMode;
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

interface Report {
  readonly kind: CarryNews['kind'];
  readonly ref: TargetRef;
  readonly piece: TargetRef;
  readonly mode: CarryMode;
}

const report = (state: CarryStore, news: Report): CarryNews => ({
  serial: (state.news?.serial ?? 0) + 1,
  ...news,
});

/** Ablegen oder Zurücklegen des getragenen Stücks; ohne Stück ändert sich nichts. */
function settle(set: Set, kind: 'placed' | 'putBack', target: TargetRef | null): void {
  set((state) => {
    const { piece, mode } = state;
    if (piece === null || mode === null) return {};
    const news = report(state, { kind, ref: target ?? piece, piece, mode });
    return { ...EMPTY_HAND, news };
  });
}

export const useCarryStore = create<CarryStore>()((set) => ({
  ...EMPTY_HAND,
  news: null,
  pickUp: (piece, legal, mode) => {
    const news = (state: CarryStore) => report(state, { kind: 'carried', ref: piece, piece, mode });
    set((state) => ({ ...EMPTY_HAND, piece, legal, mode, news: news(state) }));
  },
  track: (point, over) => {
    set({ point, over });
  },
  place: (target) => {
    settle(set, 'placed', target);
  },
  putDown: () => {
    settle(set, 'putBack', null);
  },
}));

/**
 * Eine neue Entscheidung oder ein neuer Spielstand legt das getragene Stück zurück: Seine
 * erlaubten Ziele gehören zur alten Entscheidung.
 */
export function useCarryReset(key: string): void {
  useEffect(() => {
    useCarryStore.getState().putDown();
  }, [key]);
}

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
