import type { DecisionContext } from '../eventsourcing/command.ts';
import { chain, type Stage } from '../game/event-chain.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { pickQueueFor } from '../phases/start-game.ts';
import { shuffle } from '../ports/random-port.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { AgendaId, PlayerId } from '../shared/ids.ts';
import {
  FOR,
  type AgendaDefinition,
  type AgendaStep,
  type Recipients,
} from './agenda-definition.ts';
import { agendaEffectEvents } from './agenda-effects.ts';
import type { AgendaPhaseState, EnactedLaw, OutcomeId } from './agenda-state.ts';
import { leaders, outcomesFor, tally, voteOrder } from './voting.ts';

export const findAgenda = (content: ContentPort, id: AgendaId): AgendaDefinition | undefined =>
  content.agendas.find((agenda) => agenda.id === id);

/** RR 2.2 i: der Sprecher deckt die oberste Agenda auf; ein leerer Stapel wird neu gemischt. */
function revealEvents(state: GameState, number: number, context: DecisionContext) {
  const { deck, discard } = state.agendaDeck;
  const refilled = deck.length > 0 ? deck : shuffle(context.random, discard);
  const [agenda] = refilled;
  if (agenda === undefined) return [];
  const reshuffle: readonly GameEvent[] =
    deck.length > 0 ? [] : [{ type: 'AgendaDeckReshuffled', deck: refilled }];
  return [
    ...reshuffle,
    { type: 'AgendaRevealed', agenda, number, order: voteOrder(state) } as const,
  ];
}

/** RR 2.4: alle Planeten bereitmachen, dann beginnt die nächste Runde mit der Strategiephase. */
function endEvents(state: GameState): readonly GameEvent[] {
  const speaker = state.speaker ?? state.host;
  return [
    { type: 'AgendaPhaseEnded' },
    {
      type: 'StrategyPhaseStarted',
      round: state.round + 1,
      pickQueue: pickQueueFor(state, speaker),
    },
  ];
}

/** Nächste Agenda aufdecken oder, wenn keine mehr kommt, die Phase beenden. */
function nextAgenda(state: GameState, number: number, context: DecisionContext) {
  const revealed =
    number <= state.config.rules.agendasPerPhase ? revealEvents(state, number, context) : [];
  return revealed.length > 0 ? revealed : endEvents(state);
}

/** RR 36.4: Nach der Statusphase folgt die Agendaphase, sobald der Zentrumsmarker entfernt ist. */
export const agendaPhaseEvents = (state: GameState, context: DecisionContext) =>
  chain(state, [
    () => [{ type: 'AgendaPhaseStarted' }],
    (current) => nextAgenda(current, 1, context),
  ]);

const supporters = (phase: AgendaPhaseState, outcome: OutcomeId) =>
  phase.votes
    .filter((vote) => vote.outcome === outcome && vote.votes > 0)
    .map((vote) => vote.player);

const opponents = (phase: AgendaPhaseState, outcome: OutcomeId) =>
  phase.votes
    .filter((vote) => vote.outcome !== null && vote.outcome !== outcome)
    .map((vote) => vote.player);

/** Der gewählte Spieler bzw. der Besitzer des gewählten Planeten. */
function electedPlayer(state: GameState, agenda: AgendaDefinition, outcome: OutcomeId) {
  if (agenda.election.kind === 'player')
    return state.players.find((p) => p.id === outcome)?.id ?? null;
  if (agenda.election.kind === 'planet') return state.planets[outcome]?.controller ?? null;
  return null;
}

function recipientsOf(
  state: GameState,
  agenda: AgendaDefinition,
  outcome: OutcomeId,
  who: Recipients,
) {
  const phase = state.agendaPhase;
  if (phase === null) return [];
  const elected = electedPlayer(state, agenda, outcome);
  const byKind: Readonly<Record<Recipients, readonly PlayerId[]>> = {
    all: state.players.map((player) => player.id),
    supporters: supporters(phase, outcome),
    opponents: opponents(phase, outcome),
    elected: elected === null ? [] : [elected],
    speaker: [state.speaker ?? state.host],
  };
  return byKind[who];
}

const electedPlanet = (agenda: AgendaDefinition, outcome: OutcomeId) =>
  agenda.election.kind === 'planet' ? (outcome as EnactedLaw['planet']) : null;

/** Ein Schritt für alle Empfänger nacheinander; jeder sieht den Zustand nach dem vorigen. */
function stepStage(
  agenda: AgendaDefinition,
  outcome: OutcomeId,
  step: AgendaStep,
  context: DecisionContext,
): Stage {
  const planet = electedPlanet(agenda, outcome);
  return (state) =>
    chain(
      state,
      recipientsOf(state, agenda, outcome, step.recipients).map(
        (player) => (current: GameState) =>
          agendaEffectEvents({ state: current, player, effect: step.effect, planet, context }),
      ),
    );
}

/** RR 1.3/1.6: angenommene Gesetze bleiben im Spiel, alles andere kommt auf die Ablage. */
function keepOrDiscard(
  state: GameState,
  agenda: AgendaDefinition,
  outcome: OutcomeId,
): readonly GameEvent[] {
  const passed = agenda.election.kind !== 'forAgainst' || outcome === FOR;
  const effect = agenda.passed.law;
  if (!passed || effect === undefined) return [{ type: 'AgendaDiscarded', agenda: agenda.id }];
  const law = {
    agenda: agenda.id,
    effect,
    owner: electedPlayer(state, agenda, outcome),
    planet: electedPlanet(agenda, outcome),
  };
  return [{ type: 'LawEnacted', law }];
}

/** RR 2.2 iii: das Ergebnis abhandeln, dann die nächste Agenda. */
export function resolveAgenda(
  state: GameState,
  outcome: OutcomeId,
  context: DecisionContext,
): readonly GameEvent[] {
  const phase = state.agendaPhase;
  const agenda = phase === null ? undefined : findAgenda(context.content, phase.agenda);
  if (phase === null || agenda === undefined) return [];
  const passed = agenda.election.kind !== 'forAgainst' || outcome === FOR;
  return chain(state, [
    () => [{ type: 'AgendaResolved', agenda: agenda.id, outcome }],
    ...(passed ? agenda.passed.steps : agenda.rejected).map((step) =>
      stepStage(agenda, outcome, step, context),
    ),
    (current) => keepOrDiscard(current, agenda, outcome),
    (current) => nextAgenda(current, phase.number + 1, context),
  ]);
}

/** Ohne wählbares Ergebnis (kein passender Planet) wird die Agenda ohne Wirkung abgelegt. */
const discardUnelectable = (
  state: GameState,
  agenda: AgendaDefinition,
  number: number,
  context: DecisionContext,
) =>
  chain(state, [
    () => [{ type: 'AgendaDiscarded', agenda: agenda.id }],
    (current) => nextAgenda(current, number + 1, context),
  ]);

/** Nach der letzten Stimme: auszählen, bei Gleichstand entscheidet der Sprecher (RR 2.19). */
export function afterVoting(state: GameState, context: DecisionContext): readonly GameEvent[] {
  const phase = state.agendaPhase;
  const agenda = phase === null ? undefined : findAgenda(context.content, phase.agenda);
  if (phase === null || agenda === undefined || phase.awaiting.length > 0) return [];
  const best = leaders(tally(outcomesFor(state, agenda, context.content), phase.votes));
  const [single] = best;
  if (best.length === 0) return discardUnelectable(state, agenda, phase.number, context);
  if (best.length === 1 && single !== undefined) return resolveAgenda(state, single, context);
  return [{ type: 'AgendaTied', outcomes: best }];
}
