import type { CSSProperties, ReactElement } from 'react';
import type { SheetTable } from '../../hud/use-sheet.ts';
import { useCarryStore } from '../../table/carry-store.ts';
import { type DraftZone, poolTarget, targetKey } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import type { TargetView } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';

/*
 * Stücke am Pult: Über dem obersten Marker eines Feldes liegt ein Knopf, mit dem er sich
 * aufnehmen, ziehen und ablegen lässt.
 */

/** Wohin Marker gehen und woher sie kommen: auf der Karte liegt, was das Pult nicht zeigt. */
export interface Flow {
  /** Marker, die jetzt auf der Karte liegen (für den Abflug). */
  readonly onMap: ReadonlySet<number>;
  /** Marker, die vor diesem Stand auf der Karte lagen (für die Landung). */
  readonly arriving: ReadonlySet<number>;
}

/** Das Feld, dessen oberster Marker gerade mit dem Zeiger gezogen wird. */
export function useDraggedZone(): DraftZone | null {
  return useCarryStore((state) =>
    state.mode === 'drag' && state.piece?.kind === 'pool' ? state.piece.pool : null,
  );
}

/**
 * Ein Feld, auf das das getragene Stück darf, ist per Tab erreichbar (Enter legt dort ab) und
 * gilt dann als Knopf; sonst bleibt es, was es ist.
 */
export const dropAttributes = (
  target: TargetView,
): { readonly tabIndex?: 0; readonly role?: 'button' } =>
  target.state === 'legal' && target.props.onKeyDown !== undefined
    ? { tabIndex: 0, role: 'button' }
    : {};

interface PieceProps {
  readonly zone: DraftZone;
  readonly table: SheetTable;
  readonly style?: CSSProperties;
}

/** Ein anderes Stück in der Hand: Klicks gehen durch diesen Knopf hindurch auf das Feld darunter. */
function useCarriedElsewhere(key: string): boolean {
  return useCarryStore((state) => state.piece !== null && targetKey(state.piece) !== key);
}

function Piece({ zone, table, style }: PieceProps): ReactElement {
  const t = useT();
  const piece = poolTarget(zone);
  const source = useDragSource(piece, () => table.legalFor(piece), table.router);
  const elsewhere = useCarriedElsewhere(targetKey(piece));
  const name = zone === 'loose' ? t('looseTokens') : t(zone);
  return (
    <button
      type="button"
      className="sheet-piece"
      aria-label={`${t('pickUpToken')}: ${name}`}
      style={elsewhere ? { ...style, pointerEvents: 'none' } : style}
      {...source}
    />
  );
}

/** Der Knopf zum Aufnehmen erscheint nur, wenn der Marker irgendwohin darf. */
export function SheetPiece(props: PieceProps): ReactElement | null {
  const movable = props.table.legalFor(poolTarget(props.zone)).size > 0;
  return movable ? <Piece {...props} /> : null;
}
