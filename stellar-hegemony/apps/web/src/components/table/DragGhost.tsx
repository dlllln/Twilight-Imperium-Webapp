import type { CSSProperties, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useCarryStore } from '../../table/carry-store.ts';
import { CoinFace, CommandToken } from '../sheet/SheetTokens.tsx';

/*
 * Das Stück unter dem Zeiger, solange es gezogen wird: ein Marker oder eine Münze (Handelsware
 * vom Haufen oder aus der Kasse). Es liegt außerhalb des schrägen Pults direkt im Dokument, damit
 * es dem Zeiger unverzerrt folgt; die Platzfarbe bringt es selbst mit.
 */

interface GhostProps {
  readonly faction: string;
  /** Platzfarbe; im Dokument gibt es kein Pult, von dem er sie erben könnte. */
  readonly seat: string;
}

export function DragGhost({ faction, seat }: GhostProps): ReactElement | null {
  const point = useCarryStore((state) => (state.mode === 'drag' ? state.point : null));
  const coin = useCarryStore(
    (state) => state.piece?.kind === 'goods' || state.piece?.kind === 'slot',
  );
  if (point === null) return null;
  const style = {
    '--x': `${String(point.x)}px`,
    '--y': `${String(point.y)}px`,
    '--seat': seat,
  } as CSSProperties;
  return createPortal(
    <div className={coin ? 'drag-ghost coin' : 'drag-ghost'} aria-hidden="true" style={style}>
      {coin ? <CoinFace /> : <CommandToken faction={faction} />}
    </div>,
    document.body,
  );
}
