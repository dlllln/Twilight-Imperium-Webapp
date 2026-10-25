import type { GameState, PlayerId } from '@stellar/domain';

/*
 * Die Siegpunktleiste des Tischs (reine Abbildung): je Spieler eine Scheibe in seiner Sitzfarbe
 * auf dem Feld seiner Punkte. Mehrere Scheiben auf einem Feld stapeln sich in Sitzreihenfolge.
 * Am Ende der Partie liegt darüber der Endstand.
 */

export interface TrackMarker {
  readonly player: PlayerId;
  readonly name: string;
  /** Sitz ab 1, wie `seatColor` ihn erwartet. */
  readonly seat: number;
  /** Punkte, höchstens bis zum Ziel (die Leiste endet dort). */
  readonly field: number;
  readonly points: number;
  /** Lage im Stapel auf demselben Feld, ab 0. */
  readonly stack: number;
}

export interface VpTrack {
  readonly goal: number;
  readonly markers: readonly TrackMarker[];
}

const bySeat = (game: GameState) => [...game.players].sort((a, b) => a.seat - b.seat);

/** Die Leiste mit allen Scheiben; das Ziel kommt aus der Spielkonfiguration. */
export function vpTrack(game: GameState): VpTrack {
  const goal = game.config.victoryPointsToWin;
  const seen = new Map<number, number>();
  const markers = bySeat(game).map((player) => {
    const field = Math.min(goal, Math.max(0, player.victoryPoints));
    const stack = seen.get(field) ?? 0;
    seen.set(field, stack + 1);
    const { id, name, seat, victoryPoints: points } = player;
    return { player: id, name, seat: seat + 1, field, points, stack };
  });
  return { goal, markers };
}

export interface StandingRow {
  readonly player: PlayerId;
  readonly name: string;
  readonly seat: number;
  readonly points: number;
  /** Platz ab 1; gleich viele Punkte teilen sich den Platz. */
  readonly rank: number;
  readonly winner: boolean;
}

/**
 * Der Endstand: Sieger zuerst, dann nach Punkten, bei Gleichstand nach Sitz. Der Platz zählt,
 * wer vorn liegt: der Sieger (auch bei gleichen Punkten) und jeder mit mehr Punkten.
 */
export function finalStanding(game: GameState): readonly StandingRow[] {
  const won = (id: PlayerId): boolean => id === game.winner;
  const sorted = bySeat(game).sort(
    (a, b) => Number(won(b.id)) - Number(won(a.id)) || b.victoryPoints - a.victoryPoints,
  );
  return sorted.map((player) => {
    const { id, name, seat, victoryPoints: points } = player;
    const ahead = sorted.filter(
      (other) => other.id !== id && (won(other.id) || other.victoryPoints > points),
    );
    return { player: id, name, seat: seat + 1, points, rank: ahead.length + 1, winner: won(id) };
  });
}
