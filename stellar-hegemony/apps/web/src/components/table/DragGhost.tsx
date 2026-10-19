import { type GameState, locateUnit, type PlayerId } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import { useCarryStore } from '../../table/carry-store.ts';
import type { TargetRef } from '../../table/target-ref.ts';
import { CoinFace, CommandToken } from '../sheet/SheetTokens.tsx';
import { seatNumberOf } from './StructureTray.tsx';

/*
 * Das Stück unter dem Zeiger, solange es gezogen wird: ein Marker, eine Münze (Handelsware vom
 * Haufen oder aus der Kasse), eine Figur oder ein Gebäude (mit ihrem Bild in der Platzfarbe des
 * Besitzers). Es liegt außerhalb des schrägen Pults direkt im Dokument, damit es dem Zeiger
 * unverzerrt folgt; die Platzfarbe bringt es selbst mit.
 */

interface GhostProps {
  readonly faction: string;
  /** Platzfarbe; im Dokument gibt es kein Pult, von dem er sie erben könnte. */
  readonly seat: string;
}

/** Eine getragene Figur oder ein Gebäude: Art und Platznummer für das Bild. */
interface Figure {
  readonly type: string;
  readonly seat: number;
}

/** Figuren stehen auf dem Spielplan, Gebäude kommen aus dem eigenen Bauvorrat. */
function figureOf(game: GameState, piece: TargetRef, me: PlayerId | null): Figure | null {
  if (piece.kind === 'structure') return { type: piece.type, seat: seatNumberOf(game, me) };
  if (piece.kind !== 'unit') return null;
  const unit = locateUnit(game, piece.id)?.unit;
  return unit === undefined ? null : { type: unit.type, seat: seatNumberOf(game, unit.owner) };
}

function useCarriedFigure(): Figure | null {
  const piece = useCarryStore((state) => state.piece);
  const game = useGameStore((state) => state.game);
  const me = useGameStore((state) => state.me);
  return game === null || piece === null ? null : figureOf(game, piece, me);
}

type Material = 'unit' | 'coin' | 'token';

function GhostFace({
  material,
  faction,
}: {
  readonly material: Material;
  readonly faction: string;
}) {
  const figure = useCarriedFigure();
  const artwork = figure === null ? null : unitArtwork(figure.type, figure.seat);
  if (material === 'coin') return <CoinFace />;
  if (material === 'token' || figure === null) return <CommandToken faction={faction} />;
  if (artwork === null) return <span className="drag-ghost-figure" />;
  return <img src={artwork} alt="" draggable={false} />;
}

function useMaterial(): Material {
  return useCarryStore((state) => {
    const kind = state.piece?.kind;
    if (kind === 'goods' || kind === 'slot') return 'coin';
    return kind === 'unit' || kind === 'structure' ? 'unit' : 'token';
  });
}

export function DragGhost({ faction, seat }: GhostProps): ReactElement | null {
  const point = useCarryStore((state) => (state.mode === 'drag' ? state.point : null));
  const material = useMaterial();
  if (point === null) return null;
  const style = {
    '--x': `${String(point.x)}px`,
    '--y': `${String(point.y)}px`,
    '--seat': seat,
  } as CSSProperties;
  return createPortal(
    <div
      className={material === 'coin' ? 'drag-ghost coin' : 'drag-ghost'}
      data-material={material === 'unit' ? 'unit' : undefined}
      aria-hidden="true"
      style={style}
    >
      <GhostFace material={material} faction={faction} />
    </div>,
    document.body,
  );
}
