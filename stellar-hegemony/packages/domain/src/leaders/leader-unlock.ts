import { combinedRules } from '../faction/faction-ability.ts';
import { chain } from '../game/event-chain.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { isCenterSystem } from '../invasion/invasion-queries.ts';
import {
  type OwnPlanet,
  ownPlanets,
  systemOfPlanet,
  unitsOnBoard,
} from '../objective/board-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import { type UnlockCondition, type UnlockKind, unlockOf } from './leader-definition.ts';
import { commanderAbilities, leadersOf, type LeaderView } from './leader-queries.ts';

/** Fortschritt einer Freischaltbedingung, z. B. 4 von 6 Planeten. */
export interface UnlockProgress {
  readonly current: number;
  readonly needed: number;
}

interface Subject {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly content: ContentPort;
}

type Counters = {
  readonly [K in UnlockKind]: (
    subject: Subject,
    condition: Extract<UnlockCondition, { kind: K }>,
  ) => number;
};

/** Planet im Zentrum oder legendärer Planet. */
const special = ({ state, content }: Subject, planet: OwnPlanet): boolean => {
  const system = systemOfPlanet(state, planet.state.id);
  const center = system !== undefined && isCenterSystem(content.tiles, system.id);
  return center || planet.definition.legendary !== undefined;
};

/** Strategy je Bedingungsart: was gezählt wird. */
const COUNTERS: Counters = {
  controlPlanets: ({ state, player, content }, { trait }) =>
    ownPlanets(state, player, content).filter(
      (planet) => trait === undefined || planet.definition.trait === trait,
    ).length,
  ownTechnologies: ({ state, player }) => findPlayer(state, player)?.technologies.length ?? 0,
  unitsOnBoard: ({ state, player }, { unit }) =>
    unitsOnBoard(state, player).filter((candidate) => candidate.type === unit).length,
  controlSpecialPlanets: (subject) =>
    ownPlanets(subject.state, subject.player, subject.content).filter((planet) =>
      special(subject, planet),
    ).length,
  scoredObjectives: ({ state, player }) =>
    Object.values(state.objectives.scored).filter((players) => players.includes(player)).length,
};

// TypeScript kann die Art der Bedingung nicht mit dem Zähler korrelieren.
const counterOf = (condition: UnlockCondition) =>
  COUNTERS[condition.kind] as (subject: Subject, condition: UnlockCondition) => number;

/** Wie weit ein Spieler eine Bedingung erfüllt. */
export function unlockProgress(
  state: GameState,
  player: PlayerId,
  condition: UnlockCondition,
  content: ContentPort,
): UnlockProgress {
  const current = counterOf(condition)({ state, player, content }, condition);
  return { current, needed: condition.count };
}

/** Fortschritt eines gesperrten Anführers (Kommandant oder Held); frei oder Agent: null. */
export function leaderProgress(
  state: GameState,
  player: PlayerId,
  leader: LeaderView,
  content: ContentPort,
): UnlockProgress | null {
  const condition = unlockOf(leader.definition);
  if (leader.status !== 'locked' || condition === null) return null;
  return unlockProgress(state, player, condition, content);
}

/** PoK Kommandant: Fortschritt zur Freischaltung des eigenen Kommandanten; frei oder fehlend: null. */
export function commanderProgress(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): UnlockProgress | null {
  const commander = leadersOf(state, player, content).find((leader) => leader.kind === 'commander');
  return commander === undefined ? null : leaderProgress(state, player, commander, content);
}

const fulfilled = (subject: Subject, leader: LeaderView): boolean => {
  const condition = unlockOf(leader.definition);
  if (leader.status !== 'locked' || condition === null) return false;
  return counterOf(condition)(subject, condition) >= condition.count;
};

/** Regelwerte der Fraktion samt aller freien Kommandanten (sie ersetzen die bisherigen). */
function rulesEvent(state: GameState, player: PlayerId, content: ContentPort): GameEvent {
  const faction = findPlayer(state, player)?.faction;
  const own = content.factions.find((candidate) => candidate.id === faction)?.abilities ?? [];
  const abilities = [...own, ...commanderAbilities(state, player, content)];
  return { type: 'FactionAbilitiesGranted', player, rules: combinedRules(abilities) };
}

function playerUnlocks(subject: Subject): readonly GameEvent[] {
  const { state, player, content } = subject;
  const ready = leadersOf(state, player, content).filter((leader) => fulfilled(subject, leader));
  const unlocked: readonly GameEvent[] = ready.map((leader) => ({
    type: 'LeaderUnlocked',
    player,
    leader: leader.id,
  }));
  if (!ready.some((leader) => leader.kind === 'commander')) return unlocked;
  return [...unlocked, rulesEvent(unlocked.reduce(evolveGame, state), player, content)];
}

/**
 * PoK Anführer: Nach jedem Command werden Kommandanten und Helden frei, deren Bedingung
 * erfüllt ist. Ein freier Kommandant bringt seine Regelwerte sofort mit.
 */
export const leaderUnlockEvents = (state: GameState, content: ContentPort): readonly GameEvent[] =>
  chain(
    state,
    state.players.map(
      ({ id }) =>
        (current: GameState) =>
          playerUnlocks({ state: current, player: id, content }),
    ),
  );
