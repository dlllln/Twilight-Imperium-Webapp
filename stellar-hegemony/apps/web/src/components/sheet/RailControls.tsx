import type { CommandPool } from '@stellar/domain';
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { poolPlanOf, type SheetTable } from '../../hud/use-sheet.ts';
import { canMove } from '../../table/pool-draft.ts';
import type { DraftZone } from '../../table/target-ref.ts';
import { useT } from '../../use-translation.ts';

/*
 * Plus und Minus an einer Leiste: der Tastaturweg einer Markerverteilung. „+“ legt einen Marker
 * aus der Schale auf die Leiste, „−“ nimmt einen zurück in die Schale. Die Knöpfe sitzen auf der
 * Leiste, die selbst ein Ziel ist; ihre Klicks und Tasten erreichen die Leiste daher nicht.
 */

const keepKey = (event: KeyboardEvent): void => {
  event.stopPropagation();
};

interface RailProps {
  readonly pool: CommandPool;
  readonly table: SheetTable;
}

/** Nur während einer Verteilung; sonst gibt es nichts zu verschieben. */
export function RailControls({ pool, table }: RailProps): ReactElement | null {
  const t = useT();
  const plan = poolPlanOf(table);
  const act = table.decision?.act;
  if (plan === null || act === undefined) return null;
  const step = (from: DraftZone, to: DraftZone) => (event: MouseEvent) => {
    event.stopPropagation();
    act({ kind: 'move', from, to });
  };
  const button = (sign: '−' | '+', from: DraftZone, to: DraftZone) => (
    <button
      type="button"
      className="rail-step"
      aria-label={`${t(pool)} ${sign}`}
      disabled={!canMove(plan, from, to)}
      onClick={step(from, to)}
      onKeyDown={keepKey}
    >
      {sign}
    </button>
  );
  return (
    <span className="rail-controls" role="group" aria-label={t(pool)}>
      {button('−', pool, 'loose')}
      {button('+', 'loose', pool)}
    </span>
  );
}
