import { clockwiseFrom, type GameState } from '../game/game-state.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import { homeSystemIdOf, systemOfPlanet } from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetState } from '../planet/planet-state.ts';
import type { PlayerId } from '../shared/ids.ts';
import { AGAINST, type AgendaDefinition, FOR, type PlanetFilter } from './agenda-definition.ts';
import type { OutcomeId, Vote } from './agenda-state.ts';

/** RR 2.2: links vom Sprecher beginnend im Uhrzeigersinn, der Sprecher zuletzt (RR 72.2). */
export function voteOrder(state: GameState): readonly PlayerId[] {
  const speaker = state.speaker ?? state.host;
  const [first, ...rest] = clockwiseFrom(state, speaker).map((player) => player.id);
  return first === undefined ? [] : [...rest, first];
}

const isHomePlanet = (state: GameState, planet: PlanetState, content: ContentPort): boolean =>
  planet.controller !== null &&
  systemOfPlanet(state, planet.id)?.id === homeSystemIdOf(state, planet.controller, content);

function planetMatches(
  state: GameState,
  planet: PlanetState,
  filter: PlanetFilter,
  content: ContentPort,
): boolean {
  switch (filter.kind) {
    case 'any':
      return true;
    case 'nonHome':
      return !isHomePlanet(state, planet, content);
    case 'trait':
      return findPlanetDefinition(content.tiles, planet.id)?.trait === filter.trait;
  }
}

/** Wählbare Ergebnisse (RR 2.8–2.12): Dafür/Dagegen, jeder Spieler oder ein Planet mit Besitzer. */
export function outcomesFor(
  state: GameState,
  agenda: AgendaDefinition,
  content: ContentPort,
): readonly OutcomeId[] {
  const election = agenda.election;
  if (election.kind === 'forAgainst') return [FOR, AGAINST];
  if (election.kind === 'player') return state.players.map((player) => player.id);
  return Object.values(state.planets)
    .filter((planet) => planet.controller !== null)
    .filter((planet) => planetMatches(state, planet, election.filter, content))
    .map((planet) => planet.id);
}

/** Stimmen je Ergebnis; Ergebnisse ohne Stimmen zählen mit 0. */
export function tally(
  outcomes: readonly OutcomeId[],
  votes: readonly Vote[],
): ReadonlyMap<OutcomeId, number> {
  return new Map(
    outcomes.map((outcome) => [
      outcome,
      votes.filter((vote) => vote.outcome === outcome).reduce((sum, vote) => sum + vote.votes, 0),
    ]),
  );
}

/** Ergebnisse mit den meisten Stimmen; mehr als eines heißt Gleichstand (RR 2.19). */
export function leaders(counts: ReadonlyMap<OutcomeId, number>): readonly OutcomeId[] {
  const most = Math.max(0, ...counts.values());
  return [...counts.entries()].filter(([, votes]) => votes === most).map(([outcome]) => outcome);
}
