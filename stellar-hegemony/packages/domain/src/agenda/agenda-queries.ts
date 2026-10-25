import { type GameState } from '../game/game-state.ts';
import { ownPlanets } from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import type { AgendaDefinition } from './agenda-definition.ts';
import { findAgenda } from './agenda-flow.ts';
import type { OutcomeId } from './agenda-state.ts';
import { lawVotes } from './law-effects.ts';
import { outcomesFor, tally } from './voting.ts';

/** Wer in der Agendaphase entscheidet: bei Gleichstand der Sprecher, sonst der nächste Wähler. */
export function agendaActor(state: GameState): PlayerId | null {
  const phase = state.agendaPhase;
  if (phase === null) return null;
  if (phase.tied !== null) return state.speaker;
  return phase.awaiting[0] ?? null;
}

/** Information Expert für Clients: die laufende Abstimmung samt Zwischenstand. */
export interface AgendaView {
  readonly agenda: AgendaDefinition;
  readonly outcomes: readonly OutcomeId[];
  readonly counts: ReadonlyMap<OutcomeId, number>;
}

export function currentAgenda(state: GameState, content: ContentPort): AgendaView | null {
  const phase = state.agendaPhase;
  const agenda = phase === null ? undefined : findAgenda(content, phase.agenda);
  if (phase === null || agenda === undefined) return null;
  const outcomes = outcomesFor(state, agenda, content);
  return { agenda, outcomes, counts: tally(outcomes, phase.votes) };
}

export interface VotingPlanet {
  readonly id: PlanetId;
  readonly influence: number;
}

/** Bereite eigene Planeten mit ihrem Einfluss und die Zusatzstimmen aus Gesetzen. */
export function votingPower(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): { readonly planets: readonly VotingPlanet[]; readonly bonus: number } {
  const planets = ownPlanets(state, player, content)
    .filter((planet) => !planet.state.exhausted)
    .map((planet) => ({ id: planet.state.id, influence: planet.definition.influence }));
  return { planets, bonus: lawVotes(state, player) };
}

/**
 * Stimmen einer Abgabe (RR 2.6, RR 2.13): Einfluss der gewählten bereiten eigenen Planeten plus
 * Stimmen aus Gesetzen. Planeten, die nicht abstimmen dürfen, zählen nicht.
 */
export function votesFrom(
  state: GameState,
  player: PlayerId,
  planets: readonly PlanetId[],
  content: ContentPort,
): number {
  const power = votingPower(state, player, content);
  const chosen = power.planets.filter((planet) => planets.includes(planet.id));
  return chosen.reduce((sum, planet) => sum + planet.influence, power.bonus);
}
