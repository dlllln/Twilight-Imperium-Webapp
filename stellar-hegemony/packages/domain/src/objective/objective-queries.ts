import { findPlayer, type GameState } from '../game/game-state.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlayerId } from '../shared/ids.ts';
import { timingCheck } from './objective-commands.ts';
import { meetsCondition } from './objective-conditions.ts';
import type { ObjectiveDefinition } from './objective-definition.ts';
import { availabilityChecks } from './objective-scoring.ts';

/** Ein Auftrag, den der Spieler werten dürfte, und ob er die Anforderung schon erfüllt. */
export interface ObjectiveOption {
  readonly definition: ObjectiveDefinition;
  readonly met: boolean;
}

/** Aufgedeckte öffentliche und eigene geheime Aufträge, die noch nicht gewertet sind. */
export function availableObjectives(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly ObjectiveOption[] {
  const revealed = state.objectives.public.filter((slot) => slot.revealed).map((slot) => slot.id);
  const ids = [...revealed, ...(findPlayer(state, player)?.secretObjectives ?? [])];
  return ids
    .flatMap((id) => content.objectives.find((objective) => objective.id === id) ?? [])
    .filter((definition) => availabilityChecks(state, player, definition, content).ok)
    .map((definition) => ({
      definition,
      met: meetsCondition({ state, player, content }, definition.condition),
    }));
}

/**
 * Information Expert für Clients: was der Spieler jetzt mit `ScoreObjective` werten könnte
 * (Zeitpunkt und Limit wie beim Command; Ausgaben prüft erst die Bezahlung).
 */
export function scoringOptions(
  state: GameState,
  player: PlayerId,
  content: ContentPort,
): readonly ObjectiveOption[] {
  if (state.phase !== 'action' && state.phase !== 'status') return [];
  return availableObjectives(state, player, content).filter(
    ({ definition }) => timingCheck(state, player, definition).ok,
  );
}
