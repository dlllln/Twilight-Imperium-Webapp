import type { DecisionContext } from '../eventsourcing/command.ts';
import type { GameState } from '../game/game-state.ts';
import { shuffle } from '../ports/random-port.ts';
import type { ObjectiveId } from '../shared/ids.ts';
import type { ObjectiveDefinition } from './objective-definition.ts';
import type {
  ObjectivesPrepared,
  PublicObjectiveRevealed,
  SecretObjectivesDealt,
} from './objective-events.ts';
import type { PublicObjectiveSlot } from './objective-state.ts';

export type ObjectiveSetupEvent =
  ObjectivesPrepared | PublicObjectiveRevealed | SecretObjectivesDealt;

function drawRow(context: DecisionContext, stage: number, count: number): PublicObjectiveSlot[] {
  const pool = context.content.objectives.filter((objective) => objective.stage === stage);
  return shuffle(context.random, pool)
    .slice(0, count)
    .map((objective) => ({ id: objective.id, stage, revealed: false }));
}

const ids = (objectives: readonly ObjectiveDefinition[]): readonly ObjectiveId[] =>
  objectives.map((objective) => objective.id);

const STAGE_ONE = 1;
const STAGE_TWO = 2;

/** RR 12.20: Jeder Spieler bekommt die nächsten Karten des Stapels zur Auswahl. */
const dealSecrets = (state: GameState, deck: readonly ObjectiveId[]): SecretObjectivesDealt[] => {
  const { secretObjectivesDealt: dealt, secretObjectivesKept: keep } = state.config.rules;
  return state.players.map((player, seat) => ({
    type: 'SecretObjectivesDealt',
    player: player.id,
    choice: { options: deck.slice(seat * dealt, (seat + 1) * dealt), keep },
  }));
};

/** Aufbau Schritt 12 (RR 12.13/12.20): Reihe, aufgedeckte Aufträge, Geheimaufträge zur Wahl. */
export function objectiveSetupEvents(
  state: GameState,
  context: DecisionContext,
): readonly ObjectiveSetupEvent[] {
  const { publicObjectivesPerStage: count, initiallyRevealedObjectives } = state.config.rules;
  const row = [...drawRow(context, STAGE_ONE, count), ...drawRow(context, STAGE_TWO, count)];
  const secrets = context.content.objectives.filter((objective) => objective.category === 'secret');
  const deck = shuffle(context.random, ids(secrets));
  const revealed = row.slice(0, initiallyRevealedObjectives);
  return [
    { type: 'ObjectivesPrepared', public: row, secretDeck: deck },
    ...revealed.map((slot) => ({ type: 'PublicObjectiveRevealed', objective: slot.id }) as const),
    ...dealSecrets(state, deck),
  ];
}
