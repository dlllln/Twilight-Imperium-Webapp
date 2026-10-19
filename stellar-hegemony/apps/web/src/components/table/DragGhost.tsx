import { type GameState, locateUnit, type PlayerId } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { actionFrame } from '../../artwork/cards.ts';
import { unitArtwork } from '../../artwork/units.ts';
import { useGameStore } from '../../game-store.ts';
import { useCarryStore } from '../../table/carry-store.ts';
import type { TargetRef } from '../../table/target-ref.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import { CoinFace, CommandToken } from '../sheet/SheetTokens.tsx';
import { SpeakerFace } from './SpeakerFace.tsx';
import { seatNumberOf } from './StructureTray.tsx';

/*
 * Das Stück unter dem Zeiger, solange es gezogen wird: ein Marker, eine Münze (Handelsware vom
 * Haufen oder aus der Kasse), eine Figur oder ein Gebäude (mit ihrem Bild in der Platzfarbe des
 * Besitzers), eine Aktionskarte aus der Hand (klein und schräg) oder der Sprechermarker. Es liegt
 * außerhalb des schrägen Pults direkt im Dokument, damit es dem Zeiger unverzerrt folgt; die
 * Platzfarbe bringt es selbst mit.
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

type Material = 'unit' | 'coin' | 'token' | 'card' | 'speaker';

/** Figur oder Gebäude mit Bild; ohne Bild ein Sechseck, ohne Figur ein Marker. */
function FigureFace({ faction }: { readonly faction: string }) {
  const figure = useCarriedFigure();
  const artwork = figure === null ? null : unitArtwork(figure.type, figure.seat);
  if (figure === null) return <CommandToken faction={faction} />;
  if (artwork === null) return <span className="drag-ghost-figure" />;
  return <img src={artwork} alt="" draggable={false} />;
}

/** Die getragene Aktionskarte als kleine Kartenseite. */
function CardFace() {
  const card = useCarryStore((state) => (state.piece?.kind === 'action' ? state.piece.id : null));
  if (card === null) return null;
  return (
    <span className="drag-ghost-card">
      <CompleteCardArtwork artwork={actionFrame(card)} />
    </span>
  );
}

function GhostFace({
  material,
  faction,
}: {
  readonly material: Material;
  readonly faction: string;
}) {
  switch (material) {
    case 'coin':
      return <CoinFace />;
    case 'token':
      return <CommandToken faction={faction} />;
    case 'card':
      return <CardFace />;
    case 'speaker':
      return <SpeakerFace />;
    case 'unit':
      return <FigureFace faction={faction} />;
  }
}

const MATERIALS: Partial<Record<TargetRef['kind'], Material>> = {
  goods: 'coin',
  slot: 'coin',
  unit: 'unit',
  structure: 'unit',
  action: 'card',
  speaker: 'speaker',
};

function useMaterial(): Material {
  return useCarryStore((state) =>
    state.piece === null ? 'token' : (MATERIALS[state.piece.kind] ?? 'token'),
  );
}

/** Marker und Münzen tragen kein eigenes Material-Attribut; ihre Regeln sind älter. */
const materialAttribute = (material: Material): Material | undefined =>
  material === 'coin' || material === 'token' ? undefined : material;

export function DragGhost({ faction, seat }: GhostProps): ReactElement | null {
  const point = useCarryStore((state) => (state.mode === 'drag' ? state.point : null));
  const over = useCarryStore((state) => state.over !== null && state.legal.has(state.over));
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
      data-material={materialAttribute(material)}
      data-over={over ? 'true' : undefined}
      aria-hidden="true"
      style={style}
    >
      <GhostFace material={material} faction={faction} />
    </div>,
    document.body,
  );
}
