import type { GameState, PlayerState, SystemId } from '@stellar/domain';
import { type CSSProperties, memo, type ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { HEX_SIZE, hexToPixel, type Point } from '../../hex-geometry.ts';
import { lift, plus, turn } from '../../render/board-view.ts';
import { TOKEN_Y } from '../../render/hex-layout.ts';
import { worldTransform } from '../../render/view-transform.ts';
import { seatColor } from '../../seat-colors.ts';
import { boardPoint, type FleetProjection } from '../../system/fleet-placement.ts';
import type { GhostToken } from '../../table/table-specs.ts';
import { useTableDecision } from '../../table/use-table-decision.ts';
import { useT } from '../../use-translation.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';
import './unit-chips.css';

/*
 * Vorschau der Kommandomarker, die das Siegel in Systeme legen würde (Diplomatie primär,
 * Infrastruktur sekundär): durchscheinende Marker an der Stelle, an der echte Marker liegen.
 * Mehrere Spieler stehen nebeneinander. Reine Anzeige, für Hilfsmittel unsichtbar; die Ansage
 * nennt die Wirkung. Die Geister wachsen mit dem Feld auf dem Bildschirm, damit sie auch in der
 * Kommandodeck-Ansicht am Desktop deutlich zu sehen sind.
 */

/** Grenzen der Geistgröße in Bildschirmpixeln und ihr Anteil an der Feldbreite. */
const MIN_GHOST = 40;
const MAX_GHOST = 76;
const GHOST_SHARE = 0.45;
/** Anteil des Fraktionszeichens am Geist. */
const EMBLEM_SHARE = 0.64;
/** Luft zwischen Geistern nebeneinander, in Bildschirmpixeln. */
const GHOST_GAP = 6;

/** Größe eines Geists bei dieser Feldbreite auf dem Bildschirm, gerundet auf ganze Pixel. */
export const ghostSize = (hexPx: number): number =>
  Math.round(Math.min(MAX_GHOST, Math.max(MIN_GHOST, hexPx * GHOST_SHARE)));

interface Spot {
  readonly at: Point;
  /** Geistgröße an dieser Stelle (Zoom, Maßstab der Ansicht und Perspektive). */
  readonly size: number;
}

/** Wo die Kommandomarker eines Systems liegen, im Bild der Karte, und wie groß das Feld dort ist. */
function tokenSpot(frame: FleetProjection, system: SystemId): Spot | null {
  const hex = frame.hexes.find((entry) => entry.systemId === system);
  if (hex === undefined) return null;
  const center = turn(frame.view, hexToPixel(hex.position));
  const point = lift(plus(center, { x: 0, y: TOKEN_Y }), 0, frame.view.tilt);
  const camera = worldTransform(frame.bounds, frame.size, frame.viewport);
  const hexPx = 2 * HEX_SIZE * camera.scale * point.scale;
  return { at: boardPoint(frame, point), size: ghostSize(hexPx) };
}

interface Placed extends Spot {
  readonly ghost: GhostToken;
  readonly player: PlayerState;
}

/** Jeder Geist an seinem Platz; die eines Systems nebeneinander um die Markerstelle. */
function placed(game: GameState, frame: FleetProjection, ghosts: readonly GhostToken[]): Placed[] {
  return ghosts.flatMap((ghost) => {
    const player = game.players.find((entry) => entry.id === ghost.player);
    const spot = tokenSpot(frame, ghost.system);
    if (player === undefined || spot === null) return [];
    const row = ghosts.filter((other) => other.system === ghost.system);
    const shift = (row.indexOf(ghost) - (row.length - 1) / 2) * (spot.size + GHOST_GAP);
    const at = { x: spot.at.x + shift, y: spot.at.y };
    return [{ ghost, player, at, size: spot.size }];
  });
}

function Ghost({ ghost, player, at, size }: Placed): ReactElement {
  const t = useT();
  const style = {
    left: at.x,
    top: at.y,
    '--ghost-size': `${String(size)}px`,
    '--ghost-seat': seatColor(player.seat + 1),
  } as CSSProperties;
  return (
    <div
      className="token-ghost"
      style={style}
      data-system={ghost.system}
      data-player={ghost.player}
      title={t('tokenGhost').replace('{player}', player.name)}
      aria-hidden="true"
    >
      <FactionEmblem id={player.faction} size={Math.round(size * EMBLEM_SHARE)} />
    </div>
  );
}

/** Geister der laufenden Entscheidung über der Karte; ohne Geister nichts. */
export const TokenGhosts = memo(function TokenGhosts(frame: FleetProjection) {
  const game = useGameStore((state) => state.game);
  const ghosts = useTableDecision(game)?.ghosts ?? [];
  if (game === null || ghosts.length === 0) return null;
  return (
    <div className="token-ghost-layer">
      {placed(game, frame, ghosts).map((entry) => (
        <Ghost key={`${entry.ghost.system}:${entry.ghost.player}`} {...entry} />
      ))}
    </div>
  );
});
