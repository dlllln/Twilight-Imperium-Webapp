import { AnimatePresence, type MotionStyle } from 'motion/react';
import type { ReactElement } from 'react';
import { poolPlanOf, type SheetTable } from '../../hud/use-sheet.ts';
import { poolTarget, targetKey } from '../../table/target-ref.ts';
import { useTarget } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';
import { dropAttributes, type Flow, SheetPiece, useDraggedZone } from './SheetPiece.tsx';
import { TokenChip } from './SheetTokens.tsx';

/*
 * Die Schale „Neue Marker“: Während einer Verteilung liegen hier die gewonnenen (oder bei der
 * Kriegsführung von der Karte genommenen) Marker, bis sie auf eine Leiste wandern. Sie ist
 * selbst ein Ziel, damit ein Marker auch zurückgelegt werden kann.
 */

/** So viele Marker liegen sichtbar in der Schale; die Zahl darunter zählt alle. */
const LOOSE_SHOWN = 6;
/** Lose Lage in der Schale: links, oben (in %) und Drehung je Marker. */
const LOOSE_SPOTS: readonly (readonly [number, number, number])[] = [
  [30, 46, -10],
  [52, 40, 16],
  [72, 50, -4],
  [40, 64, 24],
  [62, 66, -20],
  [22, 30, 8],
];

/** Lage eines Markers in der Schale; der Knopf zum Aufnehmen liegt auf dem obersten. */
const loosePlace = (index: number) => {
  const [left, top, tilt] = LOOSE_SPOTS[index % LOOSE_SPOTS.length] ?? [50, 50, 0];
  return { left: `${String(left)}%`, top: `${String(top)}%`, '--tilt': `${String(tilt)}deg` };
};

interface BowlProps {
  readonly ids: readonly number[];
  readonly faction: string;
  readonly flow: Flow;
  readonly table: SheetTable;
}

/** Die gezeigten Marker der Schale; der oberste blasst ab, solange er gezogen wird. */
function LooseTokens({ ids, faction, flow }: Omit<BowlProps, 'table'>): ReactElement {
  const dragged = useDraggedZone() === 'loose';
  const shown = ids.slice(0, LOOSE_SHOWN);
  return (
    <AnimatePresence initial={false} custom={flow.onMap}>
      {shown.map((id, index) => (
        <TokenChip
          key={id}
          {...{ id, faction }}
          zone="loose"
          arriving={flow.arriving.has(id)}
          place={loosePlace(index) as MotionStyle}
          dragging={dragged && index === shown.length - 1}
        />
      ))}
    </AnimatePresence>
  );
}

function Bowl({ ids, faction, flow, table, loose }: BowlProps & { readonly loose: number }) {
  const t = useT();
  const ref = poolTarget('loose');
  const target = useTarget(ref, table.decision?.targets.get(targetKey(ref)), table.router);
  const top = Math.min(ids.length, LOOSE_SHOWN) - 1;
  return (
    <div
      className="sheet-loose"
      role="group"
      aria-label={`${t('looseTokens')}: ${String(loose)}`}
      {...target.props}
      {...dropAttributes(target)}
      data-over={target.over ? 'true' : undefined}
    >
      <div className="sheet-loose-bowl">
        <LooseTokens {...{ ids, faction, flow }} />
        {loose > 0 && (
          <SheetPiece zone="loose" table={table} style={loosePlace(Math.max(0, top))} />
        )}
      </div>
      <span className="sheet-loose-label">
        <span className="sheet-word">{t('looseTokens')}</span>
        <span className="sheet-short" aria-hidden="true">
          {t('looseShort')}
        </span>{' '}
        <b>{loose}</b>
      </span>
    </div>
  );
}

/** Nur während einer Verteilung sichtbar. */
export function LooseBowl(props: BowlProps): ReactElement | null {
  const plan = poolPlanOf(props.table);
  return plan === null ? null : <Bowl {...props} loose={plan.loose} />;
}
