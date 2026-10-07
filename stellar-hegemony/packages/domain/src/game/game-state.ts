import type { GameId, PlayerId } from '../shared/ids.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { GameConfig } from './game-config.ts';

export type PhaseName = 'setup' | 'strategy' | 'action' | 'status' | 'agenda' | 'gameOver';

/**
 * Vollständiger, serialisierbarer Spielzustand. Er wird ausschließlich durch
 * Reducer aus Domain-Events aufgebaut (Event Sourcing).
 */
export interface GameState {
  readonly id: GameId;
  readonly config: GameConfig;
  /** Anzahl angewendeter Events; dient als Versionsnummer für optimistische Sperren. */
  readonly version: number;
  readonly round: number;
  readonly phase: PhaseName;
  readonly speaker: PlayerId | null;
  /** In Sitzreihenfolge (im Uhrzeigersinn). */
  readonly players: readonly PlayerState[];
  readonly systems: Readonly<Record<string, SystemState>>;
  readonly planets: Readonly<Record<string, PlanetState>>;
  readonly nextUnitNumber: number;
  readonly winner: PlayerId | null;
}

export function findPlayer(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === id);
}

/** Spieler im Uhrzeigersinn, beginnend mit `first` (z. B. Sprecher). */
export function clockwiseFrom(state: GameState, first: PlayerId): readonly PlayerState[] {
  const start = state.players.findIndex((player) => player.id === first);
  if (start < 0) return state.players;
  return [...state.players.slice(start), ...state.players.slice(0, start)];
}

export function updatePlayer(
  state: GameState,
  id: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === id ? update(player) : player)),
  };
}
