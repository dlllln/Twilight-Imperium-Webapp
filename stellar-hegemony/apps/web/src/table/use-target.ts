import type { KeyboardEvent } from 'react';
import { useCarryStore } from './carry-store.ts';
import { type DropHandler, type TargetRef, targetKey, type TargetState } from './target-ref.ts';

/*
 * Ein Ziel, auf das sich ein getragenes Stück legen lässt. Klick und Enter wirken nur, solange
 * etwas getragen wird: auf ein erlaubtes Ziel abgelegt, sonst zurückgelegt. Bildschirmleser hören
 * an erlaubten Zielen „Hierher legen“; ein gewähltes Ziel ist `aria-current`.
 */

/** Kennung des versteckten Satzes „Hierher legen“ (liegt beim Ansager des Pults). */
export const PLACE_HERE_ID = 'carry-place-here';

export interface TargetProps {
  readonly 'data-target': string;
  readonly 'data-target-state'?: TargetState;
  readonly 'aria-describedby'?: string;
  readonly 'aria-current'?: 'true';
  readonly onClick?: () => void;
  readonly onKeyDown?: (event: KeyboardEvent) => void;
}

export interface TargetView {
  readonly state: TargetState | 'none';
  readonly over: boolean;
  readonly props: TargetProps;
}

/**
 * Legt das getragene Stück hier ab, falls erlaubt und wirksam, sonst zurück; liest den Stand
 * erst beim Auslösen.
 */
function dropHere(ref: TargetRef, onDrop: DropHandler): void {
  const { piece, legal, place, putDown } = useCarryStore.getState();
  if (piece === null) return;
  if (legal.has(targetKey(ref)) && onDrop(piece, ref)) place(ref);
  else putDown();
}

function keyHere(ref: TargetRef, onDrop: DropHandler, event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
  dropHere(ref, onDrop);
}

/** Zustand und Ansage eines Ziels; nur wo das getragene Stück hin darf, heißt es „Hierher legen“. */
function markOf(state: TargetState | 'none', droppable: boolean): Omit<TargetProps, 'data-target'> {
  if (state === 'none') return {};
  const described = droppable ? { 'aria-describedby': PLACE_HERE_ID } : {};
  const current = state === 'chosen' ? { 'aria-current': 'true' as const } : {};
  return { 'data-target-state': state, ...described, ...current };
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
  const base = { 'data-target': key, ...markOf(state, carrying && allowed) };
  if (!carrying) return { state, over, props: base };
  const handlers = {
    onClick: () => dropHere(ref, onDrop),
    onKeyDown: (event: KeyboardEvent) => keyHere(ref, onDrop, event),
  };
  return { state, over, props: { ...base, ...handlers } };
}
