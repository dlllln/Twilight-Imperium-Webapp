import {
  agendaActor,
  currentAgenda,
  FOR,
  type GameCommand,
  type OutcomeId,
  votingPower,
} from '@stellar/domain';
import { type BotView, contentOf, issued, type Planner } from './bot-view.ts';

/** Ergebnisse, die dem Bot nützen: er selbst, eigene Planeten, sonst „dafür“. */
export function preferredOutcomes(view: BotView, outcomes: readonly OutcomeId[]) {
  const own = new Set<string>([
    view.player,
    ...Object.values(view.state.planets)
      .filter((planet) => planet.controller === view.player)
      .map((planet) => planet.id),
  ]);
  const rank = (outcome: OutcomeId) => (own.has(outcome) ? 0 : outcome === FOR ? 1 : 2);
  return [...outcomes].sort((a, b) => rank(a) - rank(b));
}

function votes(view: BotView): readonly GameCommand[] {
  const agenda = currentAgenda(view.state, contentOf(view));
  const outcome = preferredOutcomes(view, agenda?.outcomes ?? [])[0];
  const abstain = { type: 'Abstain', ...issued(view) } as const;
  if (outcome === undefined) return [abstain];
  const planets = votingPower(view.state, view.player, contentOf(view)).planets.map((p) => p.id);
  const cast = (chosen: typeof planets) =>
    ({ type: 'CastVotes', ...issued(view), outcome, planets: chosen }) as const;
  return [cast(planets), cast([]), abstain];
}

/** RR 2: abstimmen; als Sprecher bei Gleichstand das liebste Ergebnis wählen. */
export const agendaPhase: Planner = (view) => {
  const phase = view.state.agendaPhase;
  if (phase === null || agendaActor(view.state) !== view.player) return [];
  if (phase.tied === null) return votes(view);
  return preferredOutcomes(view, phase.tied).map((outcome) => ({
    type: 'BreakTie',
    ...issued(view),
    outcome,
  }));
};
