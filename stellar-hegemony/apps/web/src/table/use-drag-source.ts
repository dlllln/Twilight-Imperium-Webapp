import { type KeyboardEvent, type MouseEvent, type PointerEvent, useRef } from 'react';
import { type CarryMode, type Point, useCarryStore } from './carry-store.ts';
import { dropTargetAt } from './drop-target.ts';
import { type DropHandler, type TargetRef, targetKey } from './target-ref.ts';

/*
 * Ein Stück, das sich aufnehmen lässt: Ziehen ab fünf Pixeln trägt es mit dem Zeiger, ein Klick
 * (oder Enter/Leertaste) nimmt es auf und legt es zurück, Escape legt es zurück. Wer es per Taste
 * aufnimmt, dessen Fokus wandert zu den Zielen (siehe `carry-focus.ts`).
 */

/** Ab dieser Strecke wird aus einem Druck ein Ziehen. */
const DRAG_THRESHOLD = 5;

interface Gesture {
  start: Point | null;
  dragging: boolean;
  /** Nach einem Ziehen folgt ein Klick, der nicht noch einmal aufnehmen soll. */
  swallowClick: boolean;
}

interface Source {
  readonly piece: TargetRef;
  readonly legal: () => ReadonlySet<string>;
  readonly onDrop: DropHandler;
  readonly gesture: Gesture;
}

export interface DragSourceProps {
  readonly 'data-piece': string;
  readonly 'aria-pressed': boolean;
  readonly tabIndex: 0;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onClick: (event: MouseEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const pointOf = (event: PointerEvent<HTMLElement>): Point => ({
  x: event.clientX,
  y: event.clientY,
});

function pressed(gesture: Gesture, event: PointerEvent<HTMLElement>): void {
  if (event.button !== 0) return;
  gesture.start = pointOf(event);
  gesture.dragging = false;
  const element = event.currentTarget;
  if ('setPointerCapture' in element) element.setPointerCapture(event.pointerId);
}

function moved(source: Source, event: PointerEvent<HTMLElement>): void {
  const { gesture } = source;
  const point = pointOf(event);
  if (gesture.start === null) return;
  const far = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= DRAG_THRESHOLD;
  if (!gesture.dragging && far) {
    gesture.dragging = true;
    useCarryStore.getState().pickUp(source.piece, source.legal(), 'drag');
  }
  if (!gesture.dragging) return;
  const over = dropTargetAt(point);
  useCarryStore.getState().track(point, over === null ? null : targetKey(over));
}

/** Ablegen nur auf einem erlaubten Ziel, und nur wenn es dort etwas bewirkt. */
function dropOn(source: Source, target: TargetRef): boolean {
  const { legal } = useCarryStore.getState();
  return legal.has(targetKey(target)) && source.onDrop(source.piece, target);
}

/** Loslassen über einem erlaubten Ziel legt ab, sonst springt das Stück zurück. */
function released(source: Source, event: PointerEvent<HTMLElement>): void {
  const { gesture } = source;
  const dragged = gesture.dragging;
  gesture.start = null;
  gesture.dragging = false;
  if (!dragged) return;
  gesture.swallowClick = true;
  const carry = useCarryStore.getState();
  const target = dropTargetAt(pointOf(event));
  if (target !== null && dropOn(source, target)) carry.place(target);
  else carry.putDown();
}

function cancelled(gesture: Gesture): void {
  if (gesture.dragging) useCarryStore.getState().putDown();
  gesture.start = null;
  gesture.dragging = false;
}

/** Klick: aufnehmen, oder zurücklegen, wenn genau dieses Stück getragen wird. */
function clicked(source: Source, mode: CarryMode): void {
  if (source.gesture.swallowClick) {
    source.gesture.swallowClick = false;
    return;
  }
  const carry = useCarryStore.getState();
  const mine = carry.piece !== null && targetKey(carry.piece) === targetKey(source.piece);
  if (mine) carry.putDown();
  else carry.pickUp(source.piece, source.legal(), mode);
}

/** Ein Klick ohne Zeiger (`detail` 0) kommt von Enter oder Leertaste: der Fokus soll mitwandern. */
const clickMode = (event: MouseEvent<HTMLElement>): CarryMode =>
  event.detail === 0 ? 'keyboard' : 'sticky';

/** Knöpfe lösen Enter und Leertaste selbst als Klick aus; andere Elemente brauchen Hilfe. */
function keyed(source: Source, event: KeyboardEvent<HTMLElement>): void {
  if (event.key === 'Escape') {
    useCarryStore.getState().putDown();
    return;
  }
  const activates = event.key === 'Enter' || event.key === ' ';
  if (!activates || event.currentTarget instanceof HTMLButtonElement) return;
  event.preventDefault();
  clicked(source, 'keyboard');
}

function sourceProps(source: Source, carried: boolean): DragSourceProps {
  const { gesture } = source;
  return {
    'data-piece': targetKey(source.piece),
    'aria-pressed': carried,
    tabIndex: 0,
    onPointerDown: (event) => pressed(gesture, event),
    onPointerMove: (event) => moved(source, event),
    onPointerUp: (event) => released(source, event),
    onPointerCancel: () => cancelled(gesture),
    onClick: (event) => clicked(source, clickMode(event)),
    onKeyDown: (event) => keyed(source, event),
  };
}

export function useDragSource(
  piece: TargetRef,
  legal: () => ReadonlySet<string>,
  onDrop: DropHandler,
): DragSourceProps {
  const key = targetKey(piece);
  const carried = useCarryStore((state) => state.piece !== null && targetKey(state.piece) === key);
  const gesture = useRef<Gesture>({ start: null, dragging: false, swallowClick: false }).current;
  return sourceProps({ piece, legal, onDrop, gesture }, carried);
}
