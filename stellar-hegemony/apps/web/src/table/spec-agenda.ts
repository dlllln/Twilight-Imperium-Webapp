import { currentAgenda, type PlanetId, votesFrom, votingPower } from '@stellar/domain';
import { content } from '../store.ts';
import { planetStates, type PlanetSide } from './planet-table.ts';
import type { OutcomePlan, SpecContext, TableAction, TableSpec, VotePlan } from './spec-types.ts';
import {
  outcomeTarget,
  playerTarget,
  siteTarget,
  type TargetRef,
  targetKey,
  type TargetState,
} from './target-ref.ts';

/*
 * Der Agendatisch (RR 2): Die Ergebnisse liegen als Platten auf dem Tisch. Wer abstimmt, wählt
 * eine Platte (bei einer Wahl auch das Porträt des Spielers, bei einer Planetenwahl den Planeten
 * auf der Karte) und tippt Planeten der Planetenreihe an; ihr Einfluss stapelt sich als Stimmen
 * auf der Platte. Bei Gleichstand leuchten nur die gleichauf liegenden Platten, der Sprecher
 * tippt eine an und entscheidet mit dem Siegel. Ergebnisse und Stimmen nennt die Domain.
 */

export type VoteSpec = TableSpec<VotePlan, TableAction>;
export type TieSpec = TableSpec<OutcomePlan, TableAction>;

const outcomesOf = (ctx: SpecContext): readonly string[] =>
  currentAgenda(ctx.game, content)?.outcomes ?? [];

const tiedOf = (ctx: SpecContext): readonly string[] => ctx.game.agendaPhase?.tied ?? [];

/** Wahl und Planetenwahl: das Ergebnis lässt sich auch am Porträt bzw. auf der Karte antippen. */
function aliasOf(ctx: SpecContext, outcome: string): TargetRef | null {
  const election = currentAgenda(ctx.game, content)?.agenda.election.kind;
  if (election === 'player') return playerTarget(outcome);
  return election === 'planet' ? siteTarget(outcome) : null;
}

/** Platten (und ihre zweiten Ziele) mit ihrem Zustand. */
function plateStates(
  ctx: SpecContext,
  outcomes: readonly string[],
  chosen: string | null,
): Map<string, TargetState> {
  const states = new Map<string, TargetState>();
  for (const outcome of outcomes) {
    const state: TargetState = outcome === chosen ? 'chosen' : 'legal';
    const alias = aliasOf(ctx, outcome);
    states.set(targetKey(outcomeTarget(outcome)), state);
    if (alias !== null) states.set(targetKey(alias), state);
  }
  return states;
}

/** Welches Ergebnis eine Handlung meint: Platte, Porträt oder Planet auf der Karte. */
function outcomeOf(action: TableAction): string | null {
  if (action.kind === 'outcome') return action.outcome;
  if (action.kind === 'player') return action.player;
  return action.kind === 'site' ? action.planet : null;
}

/** Eine Platte wählen; ein zweites Antippen derselben gibt sie wieder frei. */
function pickOutcome(current: string | null, outcome: string, allowed: readonly string[]) {
  if (!allowed.includes(outcome)) return current;
  return current === outcome ? null : outcome;
}

const votingPlanets = (ctx: SpecContext): readonly PlanetId[] =>
  votingPower(ctx.game, ctx.actor, content).planets.map((planet) => planet.id);

function toggled(ctx: SpecContext, draft: VotePlan, planet: PlanetId): VotePlan {
  if (draft.planets.includes(planet))
    return { ...draft, planets: draft.planets.filter((id) => id !== planet) };
  const allowed = votingPlanets(ctx).includes(planet);
  return allowed ? { ...draft, planets: [...draft.planets, planet] } : draft;
}

function applyVote(ctx: SpecContext, draft: VotePlan, action: TableAction): VotePlan {
  if (action.kind === 'planet') return toggled(ctx, draft, action.planet);
  const outcome = outcomeOf(action);
  if (outcome === null) return draft;
  return { ...draft, outcome: pickOutcome(draft.outcome, outcome, outcomesOf(ctx)) };
}

/** Die Planetenreihe zahlt in Einfluss, ohne Kasse: Handelswaren sind keine Stimmen (RR 2.13). */
const votePlanets = (ctx: SpecContext, draft: VotePlan): PlanetSide => ({
  mode: 'pay',
  currency: 'influence',
  chosen: draft.planets,
  offered: votingPlanets(ctx),
  limit: null,
  tradeGoods: null,
  required: null,
});

const votesOf = (ctx: SpecContext, draft: VotePlan): number =>
  votesFrom(ctx.game, ctx.actor, draft.planets, content);

export const VOTE_SPEC: VoteSpec = {
  id: 'vote',
  hint: () => 'tableHintVote',
  confirm: () => 'castVotes',
  initial: () => ({ kind: 'vote', outcome: null, planets: [] }),
  apply: applyVote,
  targets: (ctx, draft) =>
    new Map([
      ...plateStates(ctx, outcomesOf(ctx), draft.outcome),
      ...planetStates(votePlanets(ctx, draft)),
    ]),
  progress: (ctx, draft) => {
    const done = votesOf(ctx, draft);
    return { done, needed: 0, ready: draft.outcome !== null && done > 0 };
  },
  command: (ctx, draft) => ({
    type: 'CastVotes',
    issuedBy: ctx.actor,
    outcome: draft.outcome ?? '',
    planets: draft.planets,
  }),
  alternative: (ctx) => ({ label: 'abstain', command: { type: 'Abstain', issuedBy: ctx.actor } }),
  planets: votePlanets,
};

export const TIE_SPEC: TieSpec = {
  id: 'tieBreak',
  hint: () => 'tableHintTieBreak',
  confirm: () => 'decide',
  initial: () => ({ kind: 'outcome', outcome: null }),
  apply: (ctx, draft, action) => {
    const outcome = outcomeOf(action);
    if (outcome === null) return draft;
    return { kind: 'outcome', outcome: pickOutcome(draft.outcome, outcome, tiedOf(ctx)) };
  },
  targets: (ctx, draft) => plateStates(ctx, tiedOf(ctx), draft.outcome),
  progress: (_ctx, draft) => ({
    done: draft.outcome === null ? 0 : 1,
    needed: 1,
    ready: draft.outcome !== null,
  }),
  command: (ctx, draft) => ({
    type: 'BreakTie',
    issuedBy: ctx.actor,
    outcome: draft.outcome ?? '',
  }),
};
