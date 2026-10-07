import type { GameEvent } from '../game/game-events.ts';
import type { HitsAssigned, SpaceCombatEnded } from '../combat/combat-events.ts';
import type { GroundCombatEnded, PlanetControlGained } from '../invasion/invasion-events.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { RoundStat } from './objective-definition.ts';
import { NO_ROUND_STATS } from './objective-state.ts';

const bump = (state: GameState, player: PlayerId | null, stat: RoundStat, by = 1): GameState =>
  player === null || by === 0
    ? state
    : updatePlayer(state, player, (p) => ({
        ...p,
        roundStats: { ...p.roundStats, [stat]: p.roundStats[stat] + by },
      }));

/** Gegner im aktiven System: für den aktiven Spieler der Verteidiger, sonst der aktive Spieler. */
function opponentOf(before: GameState, player: PlayerId): PlayerId | null {
  const turn = before.actionPhase;
  if (turn?.active == null) return null;
  return player === turn.active ? (turn.tactical?.combat?.defender ?? null) : turn.active;
}

type Tracker = (before: GameState, after: GameState, event: never) => GameState;

const TRACKERS: Partial<Record<GameEvent['type'], Tracker>> = {
  StrategyPhaseStarted: (_before, after) => ({
    ...after,
    players: after.players.map((p) => ({ ...p, roundStats: NO_ROUND_STATS })),
  }),
  SpaceCombatEnded: (_b, after, event: SpaceCombatEnded) =>
    bump(after, event.winner, 'spaceCombatsWon'),
  GroundCombatEnded: (_b, after, event: GroundCombatEnded) =>
    bump(after, event.winner, 'groundCombatsWon'),
  PlanetControlGained: (before, after, event: PlanetControlGained) =>
    before.planets[event.planet] === undefined ? after : bump(after, event.player, 'planetsGained'),
  HitsAssigned: (before, after, event: HitsAssigned) =>
    bump(after, opponentOf(before, event.player), 'shipsDestroyed', event.destroyed.length),
};

/**
 * Observer auf den Event-Strom: zählt Siege, zerstörte Schiffe und eroberte Planeten der
 * laufenden Runde mit, ohne die Reducer der Kampf-Module zu ändern (OCP).
 */
export function trackRoundStats(before: GameState, after: GameState, event: GameEvent): GameState {
  const tracker = TRACKERS[event.type];
  return tracker === undefined ? after : tracker(before, after, event as never);
}
