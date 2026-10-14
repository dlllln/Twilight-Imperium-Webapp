import type { DecisionContext } from '../eventsourcing/command.ts';
import type { GameState } from '../game/game-state.ts';
import { shuffle } from '../ports/random-port.ts';
import type { SystemId } from '../shared/ids.ts';
import type { ExplorationDeckKind } from './exploration-definition.ts';
import type { ExplorationPrepared } from './exploration-events.ts';
import type { ExplorationPiles } from './exploration-state.ts';

/** Alle Exemplare der Karten eines Stapels, gemischt. */
const shuffledDeck = (context: DecisionContext, deck: ExplorationDeckKind) =>
  shuffle(
    context.random,
    context.content.explorationCards
      .filter((card) => card.deck === deck)
      .flatMap((card) => Array.from({ length: card.copies }, () => card.id)),
  );

/** PoK Grenzmarker: jedes System ohne Planeten außer Heimatsystemen und dem Zentrum. */
function frontierSystems(state: GameState, context: DecisionContext): readonly SystemId[] {
  return Object.values(state.systems)
    .filter((system) => {
      const back = context.content.tiles.find(system.id)?.back;
      return system.planetIds.length === 0 && (back === 'blue' || back === 'red');
    })
    .map((system) => system.id);
}

/** PoK Spielaufbau: Erkundungsstapel und Reliktstapel mischen, Grenzmarker auslegen. */
export function explorationSetupEvent(
  state: GameState,
  context: DecisionContext,
): ExplorationPrepared {
  const decks: ExplorationPiles = {
    cultural: shuffledDeck(context, 'cultural'),
    hazardous: shuffledDeck(context, 'hazardous'),
    industrial: shuffledDeck(context, 'industrial'),
    frontier: shuffledDeck(context, 'frontier'),
  };
  return {
    type: 'ExplorationPrepared',
    decks,
    relicDeck: shuffle(
      context.random,
      context.content.relics.map((relic) => relic.id),
    ),
    frontierTokens: frontierSystems(state, context),
  };
}
