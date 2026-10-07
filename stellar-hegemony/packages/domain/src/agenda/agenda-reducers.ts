import type { ReducerMap } from '../eventsourcing/domain-event.ts';
import { type GameState, updatePlayer } from '../game/game-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import type { AgendaEvent } from './agenda-events.ts';
import type { AgendaPhaseState } from './agenda-state.ts';
import { applyLaw } from './law-effects.ts';

const withAgenda = (
  state: GameState,
  update: (phase: AgendaPhaseState) => AgendaPhaseState,
): GameState =>
  state.agendaPhase === null ? state : { ...state, agendaPhase: update(state.agendaPhase) };

const voted = (state: GameState, player: PlayerId, outcome: string | null, votes: number) =>
  withAgenda(state, (phase) => ({
    ...phase,
    awaiting: phase.awaiting.filter((id) => id !== player),
    votes: [...phase.votes, { player, outcome, votes }],
  }));

const exhaust = (state: GameState, planets: readonly string[]): GameState => ({
  ...state,
  planets: Object.fromEntries(
    Object.entries(state.planets).map(([id, planet]) => [
      id,
      planets.includes(id) ? { ...planet, exhausted: true } : planet,
    ]),
  ),
});

const readyAll = (state: GameState): GameState => ({
  ...state,
  planets: Object.fromEntries(
    Object.entries(state.planets).map(([id, planet]) => [id, { ...planet, exhausted: false }]),
  ),
});

const removeFromDeck = (state: GameState, agenda: string): GameState => ({
  ...state,
  agendaDeck: { ...state.agendaDeck, deck: state.agendaDeck.deck.filter((id) => id !== agenda) },
});

export const agendaReducers: ReducerMap<GameState, AgendaEvent> = {
  AgendaDeckPrepared: (state, event) => ({
    ...state,
    agendaDeck: { deck: event.deck, discard: [] },
  }),
  AgendaDeckReshuffled: (state, event) => ({
    ...state,
    agendaDeck: { deck: event.deck, discard: [] },
  }),
  AgendaPhaseStarted: (state) => ({ ...state, phase: 'agenda' }),
  AgendaRevealed: (state, event) => ({
    ...removeFromDeck(state, event.agenda),
    agendaPhase: {
      number: event.number,
      agenda: event.agenda,
      awaiting: event.order,
      votes: [],
      tied: null,
    },
  }),
  VotesCast: (state, event) =>
    voted(exhaust(state, event.planets), event.player, event.outcome, event.votes),
  PlayerAbstained: (state, event) => voted(state, event.player, null, 0),
  AgendaTied: (state, event) => withAgenda(state, (phase) => ({ ...phase, tied: event.outcomes })),
  AgendaResolved: (state) => withAgenda(state, (phase) => ({ ...phase, tied: null })),
  LawEnacted: (state, event) =>
    applyLaw({ ...state, laws: [...state.laws, event.law] }, event.law, 1),
  AgendaDiscarded: (state, event) => ({
    ...state,
    agendaDeck: { ...state.agendaDeck, discard: [event.agenda, ...state.agendaDeck.discard] },
  }),
  LawsRepealed: (state) =>
    state.laws.reduce<GameState>((current, law) => applyLaw(current, law, -1), {
      ...state,
      laws: [],
      agendaDeck: {
        ...state.agendaDeck,
        discard: [...state.laws.map((law) => law.agenda), ...state.agendaDeck.discard],
      },
    }),
  CommandTokensLost: (state, event) =>
    updatePlayer(state, event.player, (player) => ({
      ...player,
      commandPools: {
        ...player.commandPools,
        [event.pool]: player.commandPools[event.pool] - event.amount,
      },
      reinforcementTokens: player.reinforcementTokens + event.amount,
    })),
  AgendaPhaseEnded: (state) => ({ ...readyAll(state), agendaPhase: null }),
};
