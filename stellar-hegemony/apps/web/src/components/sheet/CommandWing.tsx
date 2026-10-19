import { COMMAND_POOLS, type CommandPool } from '@stellar/domain';
import { Octagon } from 'lucide-react';
import { AnimatePresence, type MotionStyle } from 'motion/react';
import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { rackOf, type SheetModel } from '../../hud/sheet-model.ts';
import type { TokenLedger } from '../../hud/token-ledger.ts';
import type { SheetPulse, SheetTable } from '../../hud/use-sheet.ts';
import type { SecondarySocket } from '../../table/secondary-socket.ts';
import { poolTarget, targetKey } from '../../table/target-ref.ts';
import { useTarget } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import { LooseBowl } from './LooseBowl.tsx';
import { RailControls } from './RailControls.tsx';
import { dropAttributes, type Flow, SheetPiece, useDraggedZone } from './SheetPiece.tsx';
import { SheetDelta, Socket, TokenChip } from './SheetTokens.tsx';

interface WingProps {
  readonly model: SheetModel;
  /** Nummern der Marker je Feld; während einer Verteilung der geplante Stand. */
  readonly ledger: TokenLedger;
  readonly pulse: SheetPulse;
  readonly table: SheetTable;
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

/** Fassung eines Markers in der Leiste; der Knopf zum Aufnehmen liegt in derselben Fassung. */
const rackPlace = (index: number): { readonly gridColumn: number; readonly gridRow: number } => ({
  gridColumn: index + 1,
  gridRow: 1,
});

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
  /** Nummern der Marker auf der Leiste; während einer Verteilung die geplanten. */
  readonly ids: readonly number[];
  readonly faction: string;
  readonly pulse: SheetPulse;
  readonly flow: Flow;
  readonly table: SheetTable;
}

interface RackProps extends Omit<TrayProps, 'pulse'> {
  readonly slots: number;
  /** Der oberste Marker geht an die Sekundärfähigkeit eines anderen. */
  readonly spending: boolean;
}

/** Folgt man einer Karte, die einen Strategiemarker kostet, und hat einen, wird er bezahlt. */
const spendsToken = (socket: SecondarySocket | null): boolean =>
  socket?.cost === 1 && socket.affordable;

/**
 * Über dem obersten Marker: ein roter, gestrichelter Ring, der ihn als bezahlt kennzeichnet. Er
 * liegt in derselben Fassung wie der Marker und fängt keine Gesten.
 */
function SpendMark({ index }: { readonly index: number }): ReactElement {
  const t = useT();
  return (
    <span
      className="sheet-spend"
      data-spending="true"
      title={t('spendingToken')}
      aria-hidden="true"
      style={rackPlace(index)}
    />
  );
}

/** Fassungen mit den Markern; über dem obersten liegt der Knopf zum Aufnehmen. */
function TrayRack(props: RackProps): ReactElement {
  const { pool, ids, faction, flow, table, slots, spending } = props;
  const dragged = useDraggedZone() === pool;
  const top = ids.length - 1;
  return (
    <div className="sheet-rack" style={{ '--slots': slots } as CSSProperties}>
      {Array.from({ length: slots }, (_, index) => (
        <Socket key={index} column={index + 1} />
      ))}
      <AnimatePresence initial={false} custom={flow.onMap}>
        {ids.map((id, index) => (
          <TokenChip
            key={id}
            {...{ id, faction }}
            zone={pool}
            arriving={flow.arriving.has(id)}
            place={rackPlace(index)}
            dragging={dragged && index === top}
          />
        ))}
      </AnimatePresence>
      {top >= 0 && <SheetPiece zone={pool} table={table} style={rackPlace(top)} />}
      {spending && top >= 0 && <SpendMark index={top} />}
    </div>
  );
}

/**
 * Eine Leiste mit Fassungen; belegte tragen Marker. Sehr schmal steht nur der Anfangsbuchstabe.
 * Die Leiste ist ein Ziel für getragene Marker; während einer Verteilung trägt sie „+“ und „−“.
 */
export function CommandTray({ pool, ids, faction, pulse, flow, table }: TrayProps): ReactElement {
  const t = useT();
  const ref = poolTarget(pool);
  const target = useTarget(ref, table.decision?.targets.get(targetKey(ref)), table.router);
  const rack = rackOf(ids.length);
  const spending = pool === 'strategy' && spendsToken(table.socket);
  const paid = spending ? ` · ${t('spendingToken')}` : '';
  return (
    <div
      className="sheet-tray"
      data-pool={pool}
      aria-label={`${t(pool)}: ${String(ids.length)}${paid}`}
      {...target.props}
      {...dropAttributes(target)}
      data-over={target.over ? 'true' : undefined}
    >
      <span className="sheet-tray-label" data-short={t(pool).charAt(0)}>
        <span>{t(pool)}</span>
      </span>
      <TrayRack
        {...{ pool, faction, flow, table, spending }}
        ids={ids.slice(0, rack.filled)}
        slots={rack.filled + rack.empty}
      />
      <TrayCount count={ids.length} overflow={rack.overflow} />
      <SheetDelta zone={pool} pulse={pulse} />
      <RailControls pool={pool} table={table} />
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
  readonly pulse: SheetPulse;
  readonly flow: Flow;
}

/** Schale mit dem Nachschub: Marker, die weder auf dem Pult noch auf der Karte liegen. */
function Depot({ ids, faction, pulse, flow }: DepotProps): ReactElement {
  const t = useT();
  return (
    <div className="sheet-depot" aria-label={`${t('reinforcements')}: ${String(ids.length)}`}>
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
        <span className="sheet-word">{t('reinforcements')}</span> <b>{ids.length}</b>
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
 * innen das Wappen (dort darf ein voller Fächer der Hand hineinragen). Während einer Verteilung
 * kommt die Schale „Neue Marker“ dazu; alle Zahlen zeigen dann den geplanten Stand.
 */
export function CommandWing({ model, ledger, pulse, table }: WingProps): ReactElement {
  const t = useT();
  const arriving = usePreviousBoard(ledger.board);
  const flow: Flow = { onMap: new Set(ledger.board), arriving };
  const shared = { faction: model.faction, pulse, flow };
  return (
    <div className="sheet-wing command" role="group" aria-label={t('commandTokens')}>
      <Crest faction={model.faction} />
      <div className="sheet-rails">
        {COMMAND_POOLS.map((pool) => (
          <CommandTray key={pool} pool={pool} ids={ledger[pool]} table={table} {...shared} />
        ))}
      </div>
      <Depot ids={ledger.reinforcements} {...shared} />
      <LooseBowl ids={ledger.loose} faction={model.faction} flow={flow} table={table} />
      <small className="sheet-onboard">
        {t('onBoard').replace('{count}', String(ledger.board.length))}
      </small>
    </div>
  );
}
