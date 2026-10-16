import type { CSSProperties, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useCarryStore } from '../../table/carry-store.ts';
import { CommandToken } from '../sheet/SheetTokens.tsx';

/*
 * Der Marker unter dem Zeiger, solange er gezogen wird. Er liegt außerhalb des schrägen Pults
 * direkt im Dokument, damit er dem Zeiger unverzerrt folgt; die Platzfarbe bringt er selbst mit.
 */

interface GhostProps {
  readonly faction: string;
  /** Platzfarbe; im Dokument gibt es kein Pult, von dem er sie erben könnte. */
  readonly seat: string;
}

export function DragGhost({ faction, seat }: GhostProps): ReactElement | null {
  const point = useCarryStore((state) => (state.mode === 'drag' ? state.point : null));
  if (point === null) return null;
  const style = {
    '--x': `${String(point.x)}px`,
    '--y': `${String(point.y)}px`,
    '--seat': seat,
  } as CSSProperties;
  return createPortal(
    <div className="drag-ghost" aria-hidden="true" style={style}>
      <CommandToken faction={faction} />
    </div>,
    document.body,
  );
}
