import { COMMAND_POOLS, type CommandPool } from '@stellar/domain';
import { Octagon } from 'lucide-react';
import { AnimatePresence, type MotionStyle } from 'motion/react';
import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { rackOf, type SheetModel } from '../../hud/sheet-model.ts';
import type { TokenLedger } from '../../hud/token-ledger.ts';
import type { SheetPulse } from '../../hud/use-sheet.ts';
import { useT } from '../../use-translation.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import { SheetDelta, Socket, TokenChip } from './SheetTokens.tsx';

/** Wohin Marker gehen und woher sie kommen: auf der Karte liegt, was das Pult nicht zeigt. */
interface Flow {
  /** Marker, die jetzt auf der Karte liegen (für den Abflug). */
  readonly onMap: ReadonlySet<number>;
  /** Marker, die vor diesem Stand auf der Karte lagen (für die Landung). */
  readonly arriving: ReadonlySet<number>;
}

interface WingProps {
  readonly model: SheetModel;
  readonly ledger: TokenLedger;
  readonly pulse: SheetPulse;
}

/** So viele Marker liegen sichtbar in der Nachschubschale; die Zahl darunter zählt alle. */
const DEPOT_SHOWN = 9;
/** Lose Lage in der Schale: links, oben (in %) und Drehung je Marker. */
const DEPOT_SPOTS: readonly (readonly [number, number, number])[] = [
  [36, 40, -8],
  [56, 38, 14],
  [22, 52, 22],
  [46, 56, -18],
  [66, 54, 6],
  [30, 26, 30],
  [52, 22, -26],
  [14, 34, -12],
  [72, 32, 18],
];

const depotPlace = (index: number): MotionStyle => {
  const [left, top, tilt] = DEPOT_SPOTS[index % DEPOT_SPOTS.length] ?? [40, 40, 0];
  return {
    left: `${String(left)}%`,
    top: `${String(top)}%`,
    '--tilt': `${String(tilt)}deg`,
  } as MotionStyle;
};

const rackPlace = (index: number): MotionStyle => ({ gridColumn: index + 1, gridRow: 1 });

/** Merkt sich, welche Marker beim vorigen Stand auf der Karte lagen. */
function usePreviousBoard(board: readonly number[]): ReadonlySet<number> {
  const previous = useRef<ReadonlySet<number>>(new Set(board));
  const before = previous.current;
  useEffect(() => {
    previous.current = new Set(board);
  }, [board]);
  return before;
}

interface TrayProps {
  readonly pool: CommandPool;
  readonly ids: readonly number[];
  readonly faction: string;
  readonly count: number;
  readonly pulse: SheetPulse;
  readonly flow: Flow;
}

/** Eine Leiste mit Fassungen; belegte tragen Marker. Sehr schmal steht nur der Anfangsbuchstabe. */
export function CommandTray({ pool, ids, faction, count, pulse, flow }: TrayProps): ReactElement {
  const t = useT();
  const rack = rackOf(count);
  const slots = rack.filled + rack.empty;
  return (
    <div className="sheet-tray" data-pool={pool} aria-label={`${t(pool)}: ${String(count)}`}>
      <span className="sheet-tray-label" data-short={t(pool).charAt(0)}>
        <span>{t(pool)}</span>
      </span>
      <div className="sheet-rack" style={{ '--slots': slots } as CSSProperties}>
        {Array.from({ length: slots }, (_, index) => (
          <Socket key={index} column={index + 1} />
        ))}
        <AnimatePresence initial={false} custom={flow.onMap}>
          {ids.slice(0, rack.filled).map((id, index) => (
            <TokenChip
              key={id}
              {...{ id, faction }}
              zone={pool}
              arriving={flow.arriving.has(id)}
              place={rackPlace(index)}
            />
          ))}
        </AnimatePresence>
      </div>
      <TrayCount count={count} overflow={rack.overflow} />
      <SheetDelta zone={pool} pulse={pulse} />
    </div>
  );
}

/** Eingravierte Zahl am Leistenende; was nicht mehr in die Fassungen passt, steht als „+n“ darunter. */
function TrayCount({ count, overflow }: { readonly count: number; readonly overflow: number }) {
  return (
    <span className="sheet-count">
      {count}
      {overflow > 0 && <small className="sheet-overflow">+{overflow}</small>}
    </span>
  );
}

interface DepotProps {
  readonly ids: readonly number[];
  readonly faction: string;
  readonly count: number;
  readonly pulse: SheetPulse;
  readonly flow: Flow;
}

/** Schale mit dem Nachschub: Marker, die weder auf dem Pult noch auf der Karte liegen. */
function Depot({ ids, faction, count, pulse, flow }: DepotProps): ReactElement {
  const t = useT();
  return (
    <div className="sheet-depot" aria-label={`${t('reinforcements')}: ${String(count)}`}>
      <div className="sheet-bowl">
        <AnimatePresence initial={false} custom={flow.onMap}>
          {ids.slice(0, DEPOT_SHOWN).map((id, index) => (
            <TokenChip
              key={id}
              {...{ id, faction }}
              zone="reinforcements"
              arriving={flow.arriving.has(id)}
              place={depotPlace(index)}
            />
          ))}
        </AnimatePresence>
      </div>
      <span className="sheet-depot-label">
        <Octagon className="sheet-icon" size={12} aria-hidden="true" />
        <span className="sheet-word">{t('reinforcements')}</span> <b>{count}</b>
      </span>
      <SheetDelta zone="reinforcements" pulse={pulse} />
    </div>
  );
}

/** Wappen der eigenen Fraktion mit einer Linie in Platzfarbe. */
function Crest({ faction }: { readonly faction: string }): ReactElement {
  return (
    <div className="sheet-crest" aria-hidden="true">
      <FactionEmblem id={faction} size={40} />
      <span className="sheet-crest-line" />
    </div>
  );
}

/**
 * Linker Flügel: außen der Nachschub, in der Mitte drei Leisten für Taktik, Flotte und Strategie,
 * innen das Wappen (dort darf ein voller Fächer der Hand hineinragen).
 */
export function CommandWing({ model, ledger, pulse }: WingProps): ReactElement {
  const t = useT();
  const arriving = usePreviousBoard(ledger.board);
  const flow: Flow = { onMap: new Set(ledger.board), arriving };
  const shared = { faction: model.faction, pulse, flow };
  return (
    <div className="sheet-wing command" role="group" aria-label={t('commandTokens')}>
      <Crest faction={model.faction} />
      <div className="sheet-rails">
        {COMMAND_POOLS.map((pool) => (
          <CommandTray
            key={pool}
            pool={pool}
            ids={ledger[pool]}
            count={model.summary.pools[pool]}
            {...shared}
          />
        ))}
      </div>
      <Depot ids={ledger.reinforcements} count={model.reinforcements} {...shared} />
      <small className="sheet-onboard">
        {t('onBoard').replace('{count}', String(model.onBoard))}
      </small>
    </div>
  );
}
