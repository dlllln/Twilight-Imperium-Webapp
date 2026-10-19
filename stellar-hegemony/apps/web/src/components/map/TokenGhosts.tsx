import type { GameState, PlayerState, SystemId } from '@stellar/domain';
import { type CSSProperties, memo, type ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
import { hexToPixel, type Point } from '../../hex-geometry.ts';
import { lift, plus, turn } from '../../render/board-view.ts';
import { TOKEN_Y } from '../../render/hex-layout.ts';
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
 * nennt die Wirkung.
 */

/** Abstand der Geister nebeneinander, in Bildschirmpixeln. */
const SPREAD = 30;

/** Wo die Kommandomarker eines Systems liegen, im Bild der Karte. */
function tokenPoint(frame: FleetProjection, system: SystemId): Point | null {
  const hex = frame.hexes.find((entry) => entry.systemId === system);
  if (hex === undefined) return null;
  const center = turn(frame.view, hexToPixel(hex.position));
  return boardPoint(frame, lift(plus(center, { x: 0, y: TOKEN_Y }), 0, frame.view.tilt));
}

interface Placed {
  readonly ghost: GhostToken;
  readonly player: PlayerState;
  readonly at: Point;
}

/** Jeder Geist an seinem Platz; die eines Systems nebeneinander um die Markerstelle. */
function placed(game: GameState, frame: FleetProjection, ghosts: readonly GhostToken[]): Placed[] {
  return ghosts.flatMap((ghost) => {
    const player = game.players.find((entry) => entry.id === ghost.player);
    const base = tokenPoint(frame, ghost.system);
    if (player === undefined || base === null) return [];
    const row = ghosts.filter((other) => other.system === ghost.system);
    const index = row.indexOf(ghost);
    const at = { x: base.x + (index - (row.length - 1) / 2) * SPREAD, y: base.y };
    return [{ ghost, player, at }];
  });
}

function Ghost({ ghost, player, at }: Placed): ReactElement {
  const t = useT();
  const style = {
    left: at.x,
    top: at.y,
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
      <FactionEmblem id={player.faction} size={22} />
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
