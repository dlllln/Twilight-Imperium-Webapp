import type { GameState } from '@stellar/domain';
import { type CSSProperties, memo, type ReactElement, type SyntheticEvent } from 'react';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import type { Point } from '../../hex-geometry.ts';
import { planetLabel, unitLabel } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import { useGalaxyStore } from '../../store.ts';
import { fleetPoint, type FleetProjection, systemOutline } from '../../system/fleet-placement.ts';
import { useLegalFor } from '../../table/carry-rules.ts';
import type { TablePiece } from '../../table/table-specs.ts';
import { type DropHandler, SPACE, targetKey } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useTarget } from '../../table/use-target.ts';
import { useT } from '../../use-translation.ts';
import { dropAttributes } from '../sheet/SheetPiece.tsx';
import './unit-chips.css';

/*
 * Figuren im aktivierten System als Spielsteine: Beim Bombardement die Schiffe, bei der Landung
 * Bodentruppen. Jede Figur lässt sich aufnehmen und auf einen leuchtenden Planeten legen; die
 * Platte „Im Weltraum“ nimmt sie wieder zurück. Die Steine liegen in derselben Bildebene wie die
 * Flottengriffe und folgen Kamera und Drehung über dieselbe Abbildung (`fleetPoint`). Sie stehen
 * in höchstens drei Spalten und wachsen und schrumpfen mit dem Feld, damit sie im aktivierten
 * System bleiben und keine Nachbarn verdecken.
 */

/** Gesten an den Figuren sollen die Karte darunter nicht verschieben. */
const keep = (event: SyntheticEvent) => event.stopPropagation();
const shield = { onPointerDown: keep, onPointerMove: keep, onPointerUp: keep, onWheel: keep };

/** Höchstens so viele Steine nebeneinander; weitere rücken in die nächste Reihe. */
const MAX_COLUMNS = 3;
/** Breite eines Steins samt Abstand und die Polsterung des Rahmens (Pixel, wie unit-chips.css). */
const CHIP_PX = 38;
const FRAME_PX = 12;
/** Anteil der Feldbreite, den die Steine höchstens einnehmen. */
const FIELD_SHARE = 0.6;
/** Kleiner werden die Steine nie, sonst lassen sie sich kaum noch greifen. */
const MIN_SCALE = 0.62;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Lage, Spalten und Maßstab der Steine: so groß, dass sie ins aktivierte Feld passen. */
export interface ChipLayout {
  readonly at: Point;
  readonly columns: number;
  readonly scale: number;
}

/** Spalten und Maßstab für `count` Steine in einem Feld, das `fieldWidth` Pixel breit ist. */
export function chipLayout(at: Point, count: number, fieldWidth: number): ChipLayout {
  const columns = clamp(count, 1, MAX_COLUMNS);
  const natural = columns * CHIP_PX + FRAME_PX;
  const scale = fieldWidth > 0 ? clamp((fieldWidth * FIELD_SHARE) / natural, MIN_SCALE, 1) : 1;
  return { at, columns, scale };
}

const atStyle = ({ at, columns, scale }: ChipLayout, seat: number): CSSProperties =>
  ({
    left: at.x,
    top: at.y,
    '--chip-seat': seatColor(seat),
    '--chip-columns': columns,
    '--chip-scale': scale,
  }) as CSSProperties;

interface ChipProps {
  readonly piece: TablePiece;
  readonly seat: number;
  readonly legal: ReturnType<typeof useLegalFor>;
  readonly router: DropHandler;
}

/** Eine Figur: Bild in Sitzfarbe, aufnehmen per Ziehen, Klick oder Tastatur. */
function UnitChip({ piece, seat, legal, router }: ChipProps): ReactElement {
  const t = useT();
  const language = useGalaxyStore((state) => state.language);
  const source = useDragSource(piece.ref, () => legal(piece.ref), router);
  const name = unitLabel(piece.type, language);
  const where = piece.at === null ? t('spaceSlot') : planetLabel(piece.at, language);
  const art = unitArtwork(piece.type, seat);
  return (
    <button
      type="button"
      className="unit-chip"
      aria-label={`${t('pickUpUnit')}: ${name} · ${where}`}
      title={`${name} · ${where}`}
      data-assigned={piece.at ?? undefined}
      {...source}
    >
      {art === null ? <span>{name.slice(0, 2)}</span> : <img src={art} alt="" draggable={false} />}
    </button>
  );
}

/** Die Ablage „Im Weltraum“: Hier landet eine Figur, die doch nicht auf einen Planeten geht. */
interface PlateProps {
  readonly decision: TableDecision;
  readonly router: DropHandler;
}

function SpacePlate({ decision, router }: PlateProps): ReactElement {
  const t = useT();
  const target = useTarget(SPACE, decision.targets.get(targetKey(SPACE)), router);
  const over = target.over ? ' target-over' : '';
  return (
    <div
      className={`unit-chip-space target-${target.state}${over}`}
      aria-label={t('spaceSlot')}
      {...dropAttributes(target)}
      {...target.props}
    >
      {t('spaceSlot')}
    </div>
  );
}

const unitsOf = (decision: TableDecision | null): readonly TablePiece[] =>
  decision?.pieces.filter((piece) => piece.ref.kind === 'unit') ?? [];

/** Sitz (1-basiert) des Besitzers, für Bild und Farbe. */
const seatOf = (game: GameState, pieces: readonly TablePiece[]): number =>
  (game.players.find((player) => player.id === pieces[0]?.owner)?.seat ?? 0) + 1;

interface RowProps {
  readonly game: GameState;
  readonly decision: TableDecision;
  readonly pieces: readonly TablePiece[];
  readonly layout: ChipLayout;
}

function ChipRow({ game, decision, pieces, layout }: RowProps): ReactElement {
  const legal = useLegalFor(game);
  const router = useDropRouter(game);
  const seat = seatOf(game, pieces);
  const style = atStyle(layout, seat);
  return (
    <div className="unit-chips" style={style} data-spec={decision.specId} {...shield}>
      {pieces.map((piece) => (
        <UnitChip key={targetKey(piece.ref)} {...{ piece, seat, legal, router }} />
      ))}
      <SpacePlate decision={decision} router={router} />
    </div>
  );
}

/** Breite des Felds auf dem Bildschirm (Pixel). */
function fieldWidth(frame: FleetProjection, system: string): number {
  const xs = systemOutline(frame, system).map((point) => point.x);
  return xs.length === 0 ? 0 : Math.max(...xs) - Math.min(...xs);
}

/** Wo und wie groß die Figuren stehen: im aktivierten System, wie die Flottengriffe. */
function activeLayout(game: GameState, frame: FleetProjection, count: number): ChipLayout | null {
  const active = game.actionPhase?.tactical?.system;
  const at = active === undefined ? null : fleetPoint(frame, active);
  if (active === undefined || at === null) return null;
  return chipLayout(at, count, fieldWidth(frame, active));
}

/** Figuren der laufenden Entscheidung im aktivierten System; ohne Figuren nichts. */
export const UnitChips = memo(function UnitChips(frame: FleetProjection) {
  const game = useGameStore((state) => state.game);
  const decision = useTableDecision(game);
  const pieces = unitsOf(decision);
  const layout = game === null ? null : activeLayout(game, frame, pieces.length);
  if (game === null || decision === null || pieces.length === 0 || layout === null) return null;
  return (
    <div className="unit-chip-layer">
      <ChipRow {...{ game, decision, pieces, layout }} />
    </div>
  );
});
