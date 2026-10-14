import type { Hex } from '../hex/hex-coordinate.ts';
import type { GameId, PlayerId } from '../shared/ids.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { PlayerState } from '../player/player-state.ts';
import type { SystemState } from '../galaxy/system-state.ts';
import type { ActionPhaseState } from '../phases/turn-state.ts';
import type { StrategyCardState } from '../strategy/strategy-card.ts';
import type { ObjectivesState, StatusPhaseState } from '../objective/objective-state.ts';
import type { GameConfig } from './game-config.ts';
import type {
  ActionDeckState,
  PendingPlay,
  ReactionWindow,
} from '../action-card/action-card-state.ts';
import type { AgendaDeckState, AgendaPhaseState, EnactedLaw } from '../agenda/agenda-state.ts';
import type { ExplorationState } from '../exploration/exploration-state.ts';

export type PhaseName = 'setup' | 'strategy' | 'action' | 'status' | 'agenda' | 'gameOver';

/**
 * Vollständiger, serialisierbarer Spielzustand. Er wird ausschließlich durch
 * Reducer aus Domain-Events aufgebaut (Event Sourcing).
 */
export interface GameState {
  readonly id: GameId;
  readonly config: GameConfig;
  /** Wer die Partie erstellt hat und den Aufbau steuert. */
  readonly host: PlayerId;
  /** Anzahl angewendeter Events; dient als Versionsnummer für optimistische Sperren. */
  readonly version: number;
  readonly round: number;
  readonly phase: PhaseName;
  readonly speaker: PlayerId | null;
  /** In Sitzreihenfolge (im Uhrzeigersinn). */
  readonly players: readonly PlayerState[];
  readonly systems: Readonly<Record<string, SystemState>>;
  readonly planets: Readonly<Record<string, PlanetState>>;
  /** Heimat-Plätze in Sitzreihenfolge, bis die Fraktionen ihre Heimat-Systeme setzen. */
  readonly homeSlots: readonly Hex[];
  readonly nextUnitNumber: number;
  readonly strategyCards: Readonly<Record<string, StrategyCardState>>;
  /** Wer in der Strategiephase noch wählen muss, in Reihenfolge. */
  readonly pickQueue: readonly PlayerId[];
  readonly actionPhase: ActionPhaseState | null;
  readonly statusPhase: StatusPhaseState | null;
  readonly objectives: ObjectivesState;
  /** Solange der Marker auf der Zentrumswelt liegt, entfällt die Agendaphase (RR 36). */
  readonly centerTokenRemoved: boolean;
  readonly actionDeck: ActionDeckState;
  /** Offenes Zeitfenster für Reaktionen; solange es offen ist, ruht der übrige Ablauf. */
  readonly reactionWindow: ReactionWindow | null;
  /** Gespielte Karte, die noch verhindert werden kann (RR 3.8). */
  readonly pendingPlay: PendingPlay | null;
  readonly agendaDeck: AgendaDeckState;
  /** Laufende Abstimmung der Agendaphase (RR 8). */
  readonly agendaPhase: AgendaPhaseState | null;
  /** Beschlossene Gesetze in der Reihenfolge ihres Inkrafttretens (RR 7.3). */
  readonly laws: readonly EnactedLaw[];
  /** PoK Erkundung: Stapel, Grenzmarker, Depots und legendäre Marker. */
  readonly exploration: ExplorationState;
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

export const strategyCardsOf = (state: GameState, player: PlayerId): readonly StrategyCardState[] =>
  Object.values(state.strategyCards).filter((card) => card.holder === player);
