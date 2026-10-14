import { timingOpen } from '../action-card/card-timing.ts';
import { shipsOf } from '../combat/combat-queries.ts';
import { findPlanetDefinition } from '../economy/payment.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import { type Check, firstFailure, guard } from '../shared/domain-error.ts';
import type { PlanetId, PlayerId, RelicId, SystemId } from '../shared/ids.ts';
import { ownedTechnologies } from '../technology/technology-catalog.ts';
import { EXPLORATION_DECKS, type FragmentKind } from './exploration-definition.ts';
import { withoutFragments } from './exploration-reducers.ts';
import { findRelic } from './relic-queries.ts';
import { rewardUsable } from './reward-effects.ts';

/** PoK Relikt: so viele Fragmente einer Art ergeben ein Relikt. */
export const FRAGMENTS_PER_RELIC = 3;

/** Drei Fragmente einer Art; Grenzfragmente zählen als jede Art. */
export function fragmentSetValid(fragments: readonly FragmentKind[]): boolean {
  const kinds = new Set(fragments.filter((fragment) => fragment !== 'frontier'));
  return fragments.length === FRAGMENTS_PER_RELIC && kinds.size <= 1;
}

/** Ob der Spieler die Fragmente (mit Vielfachheit) alle offen vor sich liegen hat. */
export function holdsFragments(
  state: GameState,
  player: PlayerId,
  fragments: readonly FragmentKind[],
): boolean {
  const held = findPlayer(state, player)?.relicFragments ?? [];
  return withoutFragments(held, fragments).length === held.length - fragments.length;
}

/** Mögliche Dreiergruppen zum Abwerfen: je Art erst die eigenen, dann Grenzfragmente. */
export function purgeOptions(
  state: GameState,
  player: PlayerId,
): readonly (readonly FragmentKind[])[] {
  const held = findPlayer(state, player)?.relicFragments ?? [];
  const wild = held.filter((fragment) => fragment === 'frontier');
  return EXPLORATION_DECKS.flatMap((kind) => {
    const own = held.filter((fragment) => fragment === kind);
    const set = (kind === 'frontier' ? own : [...own, ...wild]).slice(0, FRAGMENTS_PER_RELIC);
    return set.length === FRAGMENTS_PER_RELIC && set.includes(kind) ? [set] : [];
  });
}

/** Ob eine Technologie des Spielers das Erkunden von Grenzmarkern erlaubt. */
export const exploresFrontier = (state: GameState, player: PlayerId, content: ContentPort) =>
  ownedTechnologies(state, player, content).some((tech) => tech.rules?.exploresFrontier === true);

/** Ob noch eine Grenzkarte im Stapel oder in der Ablage liegt. */
export const frontierCardsLeft = (state: GameState): boolean =>
  state.exploration.decks.frontier.length + state.exploration.discards.frontier.length > 0;

/** PoK Grenzmarker im aktivierten System: Marker, eigenes Schiff, Technologie, Karten übrig. */
export const frontierConditions = (
  state: GameState,
  player: PlayerId,
  system: SystemId,
  content: ContentPort,
): readonly Check[] => [
  guard(
    state.exploration.frontierTokens.includes(system),
    'exploration.noFrontierToken',
    'Im aktivierten System liegt kein Grenzmarker',
  ),
  guard(
    shipsOf(state, system, player, content.units).length > 0,
    'exploration.noShips',
    'Kein eigenes Schiff im System',
  ),
  guard(exploresFrontier(state, player, content), 'exploration.noTechnology', 'Technologie fehlt'),
  guard(frontierCardsLeft(state), 'exploration.deckEmpty', 'Keine Grenzkarten mehr'),
];

/** Ob der Spieler jetzt (Schritt `done` seiner Taktikaktion) einen Grenzmarker erkunden darf. */
export function canExploreFrontier(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): boolean {
  const tactical = state.actionPhase?.active === player ? state.actionPhase.tactical : null;
  if (tactical?.step !== 'done') return false;
  return firstFailure(frontierConditions(state, player, tactical.system, content)).ok;
}

const situation = (state: GameState, player: PlayerId, content: ContentPort) => ({
  state,
  player,
  content,
});

/** Bereite Relikte mit Komponentenaktion, die gerade etwas bewirken würden. */
export function usableRelics(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly RelicId[] {
  if (!timingOpen(state, player, 'action')) return [];
  const ready = (findPlayer(state, player)?.relics ?? []).filter((relic) => !relic.exhausted);
  return ready
    .filter(({ id }) => {
      const effect = findRelic(content, id)?.effect;
      const input = { ...situation(state, player, content), planet: null, source: id };
      return effect?.kind === 'action' && rewardUsable(input, effect.reward);
    })
    .map(({ id }) => id);
}

/** Eigene legendäre Planeten, deren Fähigkeit in dieser Runde noch bereit ist und wirken würde. */
export function usableLegendaryPlanets(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly PlanetId[] {
  if (!timingOpen(state, player, 'action')) return [];
  return Object.values(state.planets)
    .filter((planet) => planet.controller === player)
    .filter((planet) => !state.exploration.exhaustedLegendaries.includes(planet.id))
    .filter((planet) => {
      const ability = findPlanetDefinition(content.tiles, planet.id)?.legendary;
      const input = { ...situation(state, player, content), planet: planet.id, source: planet.id };
      return ability !== undefined && rewardUsable(input, ability);
    })
    .map((planet) => planet.id);
}
