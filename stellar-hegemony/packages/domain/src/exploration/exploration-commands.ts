import { timingOpen } from '../action-card/card-timing.ts';
import { endTurn } from '../action/action-commands.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, RelicId } from '../shared/ids.ts';
import { err, map, ok, type Result } from '../shared/result.ts';
import { tacticalStepCheck } from '../tactical/tactical-commands.ts';
import type { FragmentKind, RewardEffect } from './exploration-definition.ts';
import { exploreFrontierEvents } from './explore.ts';
import { fragmentSetValid, frontierConditions, holdsFragments } from './exploration-queries.ts';
import { findRelic } from './relic-queries.ts';
import { rewardEvents, rewardUsable, type RewardSituation } from './reward-effects.ts';

/** PoK Grenzmarker: am Ende der Taktikaktion den Marker im aktivierten System erkunden. */
export type ExploreFrontier = Command<'ExploreFrontier'>;

/** PoK Relikt: drei Fragmente einer Art abwerfen und ein Relikt ziehen (Komponentenaktion). */
export interface PurgeRelicFragments extends Command<'PurgeRelicFragments'> {
  readonly fragments: readonly FragmentKind[];
}

/** PoK Relikt: Komponentenaktion eines gehaltenen Relikts. */
export interface UseRelic extends Command<'UseRelic'> {
  readonly relic: RelicId;
}

/** PoK Legendäre Planeten: Fähigkeit eines eigenen legendären Planeten (Komponentenaktion). */
export interface UseLegendaryAbility extends Command<'UseLegendaryAbility'> {
  readonly planet: PlanetId;
}

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 51: Eine Komponentenaktion beendet nach ihrer Wirkung den Zug. */
function asComponentAction(state: GameState, player: PlayerId, events: readonly GameEvent[]) {
  const after = events.reduce(evolveGame, state);
  return [...events, ...endTurn(after, player, after.actionPhase?.passed ?? [])];
}

const componentTiming = (state: GameState, player: PlayerId): Check =>
  guard(timingOpen(state, player, 'action'), 'exploration.notAction', 'Nur als eigene Aktion');

export const exploreFrontierHandler = {
  commandType: 'ExploreFrontier',
  decide(state: GameState, command: ExploreFrontier, context: DecisionContext): Events {
    const system = state.actionPhase?.tactical?.system;
    if (system === undefined) return err(domainError('tactical.notActive', 'Keine Taktikaktion'));
    const checked = firstFailure([
      tacticalStepCheck(state, command, 'done'),
      ...frontierConditions(state, command.issuedBy, system, context.content),
    ]);
    if (!checked.ok) return checked;
    return ok(exploreFrontierEvents(state, command.issuedBy, system, context));
  },
} as const satisfies CommandHandler<GameState, ExploreFrontier, GameEvent>;

/** Wirkung eines Relikts beim Erhalt (Siegpunkt, Marker, Karten). */
function onGain(state: GameState, player: PlayerId, relic: RelicId, context: DecisionContext) {
  const effect = findRelic(context.content, relic)?.effect;
  if (effect?.kind !== 'onGain') return [];
  const { content, random } = context;
  return rewardEvents(
    { state, player, planet: null, source: relic, content, random },
    effect.reward,
  );
}

function purgeChecks(state: GameState, command: PurgeRelicFragments): Check {
  const { issuedBy: player, fragments } = command;
  return firstFailure([
    componentTiming(state, player),
    guard(fragmentSetValid(fragments), 'relic.invalidFragments', 'Drei Fragmente einer Art'),
    guard(holdsFragments(state, player, fragments), 'relic.fragmentsMissing', 'Fragmente fehlen'),
  ]);
}

export const purgeRelicFragmentsHandler = {
  commandType: 'PurgeRelicFragments',
  decide(state: GameState, command: PurgeRelicFragments, context: DecisionContext): Events {
    const checked = purgeChecks(state, command);
    if (!checked.ok) return checked;
    const [relic] = state.exploration.relicDeck;
    if (relic === undefined) return err(domainError('relic.deckEmpty', 'Keine Relikte mehr'));
    const player = command.issuedBy;
    const drawn: readonly GameEvent[] = [
      { type: 'RelicFragmentsPurged', player, fragments: command.fragments },
      { type: 'RelicDrawn', player, relic },
    ];
    const gained = onGain(drawn.reduce(evolveGame, state), player, relic, context);
    return ok(asComponentAction(state, player, [...drawn, ...gained]));
  },
} as const satisfies CommandHandler<GameState, PurgeRelicFragments, GameEvent>;

/** Eine Belohnung als Komponentenaktion: Quelle, Zusatzprüfungen und das Nutzungs-Event. */
interface RewardAction {
  readonly input: RewardSituation;
  readonly reward: RewardEffect;
  readonly checks: readonly Check[];
  readonly used: GameEvent;
}

function rewardAction(action: RewardAction, context: DecisionContext): Events {
  const { input, reward, used } = action;
  const checked = firstFailure([
    componentTiming(input.state, input.player),
    ...action.checks,
    guard(rewardUsable(input, reward), 'exploration.noEffect', 'Die Fähigkeit hätte keine Wirkung'),
  ]);
  return map(checked, () => {
    const after = evolveGame(input.state, used);
    const resolved = rewardEvents({ ...input, state: after, random: context.random }, reward);
    return asComponentAction(input.state, input.player, [used, ...resolved]);
  });
}

export const useRelicHandler = {
  commandType: 'UseRelic',
  decide(state: GameState, command: UseRelic, context: DecisionContext): Events {
    const { issuedBy: player, relic } = command;
    const effect = findRelic(context.content, relic)?.effect;
    if (effect?.kind !== 'action') return err(domainError('relic.noAction', 'Keine Reliktaktion'));
    const owned = findPlayer(state, player)?.relics.find((candidate) => candidate.id === relic);
    const input = { state, player, planet: null, source: relic, content: context.content };
    const used: GameEvent = { type: 'RelicUsed', player, relic, purged: effect.usage === 'purge' };
    const checks = [
      guard(owned !== undefined, 'relic.notOwned', 'Du hältst dieses Relikt nicht'),
      guard(owned?.exhausted !== true, 'relic.exhausted', 'Das Relikt ist erschöpft'),
    ];
    return rewardAction({ input, reward: effect.reward, checks, used }, context);
  },
} as const satisfies CommandHandler<GameState, UseRelic, GameEvent>;

const legendaryChecks = (state: GameState, player: PlayerId, planet: PlanetId) => [
  guard(state.planets[planet]?.controller === player, 'legendary.notControlled', 'Nicht deiner'),
  guard(
    !state.exploration.exhaustedLegendaries.includes(planet),
    'legendary.exhausted',
    'Die Fähigkeit wurde in dieser Runde schon genutzt',
  ),
];

export const useLegendaryAbilityHandler = {
  commandType: 'UseLegendaryAbility',
  decide(state: GameState, command: UseLegendaryAbility, context: DecisionContext): Events {
    const { issuedBy: player, planet } = command;
    const ability = findPlanetDefinition(context.content.tiles, planet)?.legendary;
    if (ability === undefined)
      return err(domainError('legendary.unknown', 'Kein legendärer Planet'));
    const input = { state, player, planet, source: planet, content: context.content };
    const used: GameEvent = { type: 'LegendaryAbilityUsed', player, planet };
    const checks = legendaryChecks(state, player, planet);
    return rewardAction({ input, reward: ability, checks, used }, context);
  },
} as const satisfies CommandHandler<GameState, UseLegendaryAbility, GameEvent>;
