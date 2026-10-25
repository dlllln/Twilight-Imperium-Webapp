import { findPlayer, type GameState, type Unit } from '@stellar/domain';
import type { ReactElement } from 'react';
import { UnitArtwork } from '../../artwork/UnitArtwork.tsx';
import type { MessageKey } from '../../i18n.ts';
import { unitLabel } from '../../labels.ts';
import { type HitMark, pegsOf } from '../../table/hit-draft.ts';
import { targetKey, unitTarget } from '../../table/target-ref.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useTarget } from '../../table/use-target.ts';
import type { DropHandler } from '../../table/target-ref.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { HitPeg } from './HitPeg.tsx';

/*
 * Ein Schiff auf der Kampfmatte. Wer Treffer verteilt, tippt es an (oder drückt Enter) und
 * schaltet seine Stifte weiter: keiner, Schaden abfangen, zerstören, beides. Ein getragener
 * Stift legt sich mit Klick oder Loslassen darauf. Die Stifte stecken sichtbar im Schiff.
 */

const MARK_LABELS: Readonly<Record<HitMark, MessageKey>> = {
  none: 'noHit',
  sustain: 'sustain',
  destroy: 'destroy',
  both: 'sustainAndDestroy',
};

const seatOf = (game: GameState, unit: Unit): number =>
  (findPlayer(game, unit.owner)?.seat ?? 0) + 1;

/** Die gesteckten Stifte eines Schiffs. */
function Pegs({ mark }: { readonly mark: HitMark }): ReactElement | null {
  const count = pegsOf(mark);
  if (count === 0) return null;
  return (
    <span className="mat-ship-pegs" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <HitPeg key={index} />
      ))}
    </span>
  );
}

/** Bild, Name und Schadenszeichen; gemeinsam für ruhende und bespielbare Schiffe. */
function ShipBody({ game, unit }: { readonly game: GameState; readonly unit: Unit }) {
  const t = useT();
  const language = useLanguage();
  return (
    <>
      <UnitArtwork type={unit.type} seat={seatOf(game, unit)} />
      <span className="mat-ship-name">
        {unitLabel(unit.type, language)}
        {unit.damaged && <span className="damage-mark"> · {t('damaged')}</span>}
      </span>
    </>
  );
}

/** Ein Schiff ohne Entscheidung: nur Figur und Name. */
export function MatFigure(props: { readonly game: GameState; readonly unit: Unit }): ReactElement {
  return (
    <span className="mat-ship" data-unit={props.unit.id} data-damaged={props.unit.damaged}>
      <ShipBody {...props} />
    </span>
  );
}

interface TargetShipProps {
  readonly game: GameState;
  readonly unit: Unit;
  readonly decision: TableDecision;
  readonly router: DropHandler;
}

const markOf = (decision: TableDecision, unit: Unit): HitMark =>
  (decision.draft?.kind === 'hits' ? decision.draft.marks[unit.id] : undefined) ?? 'none';

/** Ein eigenes Schiff, das Treffer nimmt: Knopf mit Stiften, Ziel für den getragenen Stift. */
export function MatTarget({ game, unit, decision, router }: TargetShipProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const ref = unitTarget(unit.id);
  const target = useTarget(ref, decision.targets.get(targetKey(ref)), router);
  const mark = markOf(decision, unit);
  const { onClick, onKeyDown, ...marks } = target.props;
  const cycle = () => decision.act({ kind: 'hit', unit: unit.id });
  return (
    <button
      type="button"
      className="mat-ship mat-ship-target"
      data-unit={unit.id}
      data-mark={mark}
      data-damaged={unit.damaged}
      data-over={target.over ? 'true' : undefined}
      aria-label={`${unitLabel(unit.type, language)}: ${t(MARK_LABELS[mark])}`}
      {...marks}
      onClick={onClick ?? cycle}
      {...(onKeyDown === undefined ? {} : { onKeyDown })}
    >
      <ShipBody game={game} unit={unit} />
      <Pegs mark={mark} />
    </button>
  );
}
