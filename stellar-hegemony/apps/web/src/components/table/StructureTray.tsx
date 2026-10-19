import type { GameState, PlayerId } from '@stellar/domain';
import type { CSSProperties, ReactElement } from 'react';
import { unitArtwork } from '../../artwork/units.ts';
import { unitLabel } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import type { TablePiece } from '../../table/table-specs.ts';
import type { DropHandler } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import type { PartProps } from './PromptParts.tsx';

/*
 * Der Bauvorrat der Infrastruktur: Gebäude als Spielsteine in der Ansage. Sie werden aufgenommen
 * wie Marker und Münzen (ziehen, klicken oder Enter) und auf einen leuchtenden Bauplatz auf der
 * Karte gelegt; per Tastatur springt der Fokus nach dem Aufnehmen auf den ersten Bauplatz.
 */

/** Platznummer (1-basiert) eines Spielers für Bild und Farbe; unbekannt ergibt den ersten Platz. */
export const seatNumberOf = (game: GameState, player: PlayerId | null): number =>
  (game.players.find((entry) => entry.id === player)?.seat ?? 0) + 1;

interface PieceProps {
  readonly piece: TablePiece;
  readonly seat: number;
  readonly decision: TableDecision;
  readonly router: DropHandler;
}

function StructurePiece({ piece, seat, decision, router }: PieceProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const drag = useDragSource(piece.ref, () => decision.legalFor(piece.ref), router);
  const name = unitLabel(piece.type, language);
  const artwork = unitArtwork(piece.type, seat);
  return (
    <button
      type="button"
      className="structure-piece"
      aria-label={`${t('pickUpStructure')}: ${name}`}
      {...drag}
    >
      {artwork === null ? (
        <span className="structure-piece-shape" aria-hidden="true" />
      ) : (
        <img src={artwork} alt="" draggable={false} />
      )}
      <span className="structure-piece-name">{name}</span>
    </button>
  );
}

/** Die Gebäude, die jetzt irgendwo passen; ohne solche bleibt der Vorrat weg. */
export function StructureTray({ game, decision }: PartProps): ReactElement | null {
  const t = useT();
  const router = useDropRouter(game);
  const structures = decision.pieces.filter((piece) => piece.ref.kind === 'structure');
  if (structures.length === 0) return null;
  const seat = seatNumberOf(game, decision.route.actor);
  const style = { '--seat': seatColor(seat) } as CSSProperties;
  return (
    <section className="structure-tray" aria-label={t('structureSupply')} style={style}>
      {structures.map((piece) => (
        <StructurePiece
          key={piece.type}
          piece={piece}
          seat={seat}
          decision={decision}
          router={router}
        />
      ))}
    </section>
  );
}
