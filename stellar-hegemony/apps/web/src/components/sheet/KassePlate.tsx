import { AnimatePresence } from 'motion/react';
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import type { SheetTable } from '../../hud/use-sheet.ts';
import { useCarryStore } from '../../table/carry-store.ts';
import type { PlanetTable } from '../../table/planet-table.ts';
import { KASSE, type TargetRef, targetKey } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import { useTarget } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';
import { dropAttributes } from './SheetPiece.tsx';
import { Coin } from './SheetTokens.tsx';

/*
 * Die Kasse am Pult: Handelswaren, die in die offene Bezahlung gehen. Münzen wandern vom Haufen
 * herüber und zurück (aufnehmen, ablegen), Plus und Minus sind der zweite Weg.
 */

/** So viele Münzen liegen sichtbar auf der Kasse; die Zahl daneben zählt alle. */
const KASSE_SHOWN = 5;

const keepKey = (event: KeyboardEvent): void => {
  event.stopPropagation();
};

interface CoinPieceProps {
  readonly piece: TargetRef;
  readonly label: string;
  readonly table: SheetTable;
}

/** Eine Münze zum Aufnehmen; nur da, wo sie hin darf. Trägt man etwas anderes, klickt man durch. */
export function CoinPiece({ piece, label, table }: CoinPieceProps): ReactElement | null {
  const key = targetKey(piece);
  const source = useDragSource(piece, () => table.legalFor(piece), table.router);
  const elsewhere = useCarryStore(
    (state) => state.piece !== null && targetKey(state.piece) !== key,
  );
  if (table.legalFor(piece).size === 0) return null;
  return (
    <button
      type="button"
      className="sheet-piece sheet-coin-piece"
      aria-label={label}
      style={elsewhere ? { pointerEvents: 'none' } : undefined}
      {...source}
    />
  );
}

interface StepsProps {
  readonly planets: PlanetTable;
  readonly count: number;
}

/** Plus und Minus der Kasse; ihre Klicks erreichen die Kasse als Ziel nicht. */
function KasseSteps({ planets, count }: StepsProps): ReactElement {
  const t = useT();
  const step = (sign: '−' | '+', delta: 1 | -1, enabled: boolean) => (
    <button
      type="button"
      className="rail-step"
      aria-label={`${t('kasse')} ${sign}`}
      disabled={!enabled}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        planets.addCoins(delta);
      }}
      onKeyDown={keepKey}
    >
      {sign}
    </button>
  );
  return (
    <span className="rail-controls" role="group" aria-label={t('kasse')}>
      {step('−', -1, count > 0)}
      {step('+', 1, count < planets.ownTradeGoods)}
    </span>
  );
}

interface KasseProps {
  readonly table: SheetTable;
  readonly planets: PlanetTable;
}

export function KassePlate({ table, planets }: KasseProps): ReactElement {
  const t = useT();
  const target = useTarget(KASSE, undefined, table.router);
  const count = planets.tradeGoods ?? 0;
  return (
    <div
      className="sheet-kasse"
      role="group"
      aria-label={`${t('kasse')}: ${String(count)}`}
      {...target.props}
      {...dropAttributes(target)}
      data-over={target.over ? 'true' : undefined}
    >
      <div className="sheet-kasse-tray">
        <AnimatePresence initial={false}>
          {Array.from({ length: Math.min(count, KASSE_SHOWN) }, (_, index) => (
            <Coin key={index} index={index} />
          ))}
        </AnimatePresence>
        <CoinPiece piece={KASSE} label={`${t('pickUpCoin')}: ${t('kasse')}`} table={table} />
      </div>
      <strong data-testid="kasse-count">{count}</strong>
      <KasseSteps planets={planets} count={count} />
      <span className="sheet-caption" aria-hidden="true">
        {t('kasse')}
      </span>
    </div>
  );
}
