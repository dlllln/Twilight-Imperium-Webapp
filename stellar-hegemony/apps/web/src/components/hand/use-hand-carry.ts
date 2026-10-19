import type { HandCard } from '@stellar/domain';
import { type PointerEvent, useRef } from 'react';
import { cardTargetKeys } from '../../table/card-targets.ts';
import { type CarryStore, useCarryStore } from '../../table/carry-store.ts';
import { actionPiece, type DropHandler, targetKey } from '../../table/target-ref.ts';
import { type DragSourceProps, useDragSource } from '../../table/use-drag-source.ts';

/*
 * Eine Aktionskarte mit Zielen lässt sich aus der Hand auf den Tisch ziehen: auf ein leuchtendes
 * System, einen Planetenring, das Bild eines Mitspielers oder eine Leiste. Nur die Zeigergesten
 * kommen von der gemeinsamen Ziehquelle; Antippen ohne Bewegung öffnet weiter die Zielwahl über
 * der Karte, die auch der Weg für Tastatur und Screenreader ist.
 */

export interface HandCarry {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: () => void;
  /** Die Karte liegt gerade als Geist unter dem Zeiger. */
  readonly carried: boolean;
  /** Nach einem Ziehen folgt ein Klick, der die Zielwahl nicht öffnen soll; setzt sich zurück. */
  readonly swallowClick: () => boolean;
}

const NOWHERE: ReadonlySet<string> = new Set();

/** Ob gerade genau dieses Stück mit dem Zeiger getragen wird. */
const dragging = (state: CarryStore, key: string): boolean =>
  state.mode === 'drag' && state.piece !== null && targetKey(state.piece) === key;

interface Flag {
  current: boolean;
}

/** Liest den Merker und setzt ihn zurück. */
function takeFlag(flag: Flag): boolean {
  const was = flag.current;
  flag.current = false;
  return was;
}

/** Die Gesten der Ziehquelle, dazu ein Merker, ob zwischen Drücken und Loslassen gezogen wurde. */
interface Carrier {
  readonly source: DragSourceProps;
  readonly key: string;
  readonly dragged: Flag;
}

function handlersOf({ source, key, dragged }: Carrier, carried: boolean): HandCarry {
  return {
    onPointerDown: (event) => {
      dragged.current = false;
      source.onPointerDown(event);
    },
    onPointerMove: (event) => {
      source.onPointerMove(event);
      if (dragging(useCarryStore.getState(), key)) dragged.current = true;
    },
    onPointerUp: source.onPointerUp,
    onPointerCancel: source.onPointerCancel,
    carried,
    swallowClick: () => takeFlag(dragged),
  };
}

/**
 * Zeigergesten zum Tragen einer Handkarte; `null` für Karten ohne Ziele oder solange die Hand
 * nicht ausspielt (`enabled`).
 */
export function useHandCarry(
  card: HandCard | null,
  router: DropHandler,
  enabled: boolean,
): HandCarry | null {
  const piece = actionPiece(card?.definition.id ?? '');
  const key = targetKey(piece);
  const legal = () => (card === null ? NOWHERE : cardTargetKeys(card.targets));
  const source = useDragSource(piece, legal, router);
  const dragged = useRef(false);
  const carried = useCarryStore((state) => dragging(state, key));
  return card === null || !enabled ? null : handlersOf({ source, key, dragged }, carried);
}
