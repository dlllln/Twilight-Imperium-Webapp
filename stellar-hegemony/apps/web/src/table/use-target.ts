import type { KeyboardEvent } from 'react';
import { useCarryStore } from './carry-store.ts';
import { type DropHandler, type TargetRef, targetKey, type TargetState } from './target-ref.ts';

/*
 * Ein Ziel, auf das sich ein getragenes Stück legen lässt. Klick und Enter wirken nur, solange
 * etwas getragen wird: auf ein erlaubtes Ziel abgelegt, sonst zurückgelegt.
 */

export interface TargetProps {
  readonly 'data-target': string;
  readonly 'data-target-state'?: TargetState;
  readonly onClick?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent) => void;
}

export interface TargetView {
  readonly state: TargetState | 'none';
  readonly over: boolean;
  readonly props: TargetProps;
}

/** Legt das getragene Stück hier ab, falls erlaubt; liest den Stand erst beim Auslösen. */
function dropHere(ref: TargetRef, onDrop: DropHandler): void {
  const { piece, legal, place, putDown } = useCarryStore.getState();
  if (piece === null) return;
  if (!legal.has(targetKey(ref))) {
    putDown();
    return;
  }
  onDrop(piece, ref);
  place(ref);
}

function keyHere(ref: TargetRef, onDrop: DropHandler, event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  dropHere(ref, onDrop);
}

export function useTarget(
  ref: TargetRef,
  decided: TargetState | undefined,
  onDrop: DropHandler,
): TargetView {
  const key = targetKey(ref);
  const carrying = useCarryStore((state) => state.piece !== null);
  const allowed = useCarryStore((state) => state.legal.has(key));
  const over = useCarryStore((state) => state.over === key);
  const state = carrying && allowed ? 'legal' : (decided ?? 'none');
  const base = { 'data-target': key, ...(state === 'none' ? {} : { 'data-target-state': state }) };
  if (!carrying) return { state, over, props: base };
  const handlers = {
    onClick: () => dropHere(ref, onDrop),
    onKeyDown: (event: KeyboardEvent) => keyHere(ref, onDrop, event),
  };
  return { state, over, props: { ...base, ...handlers } };
}
