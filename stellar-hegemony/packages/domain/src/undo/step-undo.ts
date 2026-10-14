import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import { currentActor } from '../phases/current-actor.ts';
import { type DomainError, domainError } from '../shared/domain-error.ts';
import type { PlayerId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { StepUndone } from './undo-events.ts';

/*
 * Rückgängig für den letzten eigenen Schritt (Pure Fabrication): Zurücknehmen darf man nur,
 * was nichts Neues verrät. Würfe, gezogene Karten, Kämpfe und alles, was andere erfahren oder
 * entscheiden müssen, bleiben stehen. Deshalb eine Positivliste statt einer Ausnahmeliste:
 * Ein neues Event ist erst einmal endgültig, bis es bewusst hier aufgenommen wird.
 */
const REVERSIBLE: ReadonlySet<GameEvent['type']> = new Set<GameEvent['type']>([
  'SystemActivated',
  'ShipsMoved',
  'TacticalStepReached',
  'TokenStepReached',
  'CommandTokensPlaced',
  'CommandTokensRedistributed',
  'PlanetsExhausted',
  'TradeGoodsSpent',
  'UnitsProduced',
  'StructuresPlaced',
  'UnitsDeployed',
  'GroundForcesCommitted',
  'PlanetControlGained',
]);

/** Ob sich die Events eines Schritts zurücknehmen lassen, ohne dass jemand etwas Neues weiß. */
export const isReversible = (events: readonly GameEvent[]): boolean =>
  events.length > 0 && events.every((event) => REVERSIBLE.has(event.type));

const undoError = (code: string, message: string): DomainError =>
  domainError(`undo.${code}`, message);

/**
 * Entscheidung über das Zurücknehmen: Der Spieler muss noch selbst am Zug sein, und der Schritt
 * muss nach der Partieerstellung liegen. Ob seitdem nichts anderes geschah, prüft die Anwendung,
 * denn nur sie kennt die Grenzen der Commands.
 */
export function undoStep(
  state: GameState,
  player: PlayerId,
  fromVersion: number,
): Result<readonly StepUndone[], DomainError> {
  if (currentActor(state) !== player)
    return err(undoError('notYourTurn', 'Zurücknehmen geht nur, solange du am Zug bist'));
  if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion >= state.version)
    return err(undoError('nothing', 'Es gibt keinen Schritt zum Zurücknehmen'));
  return ok([{ type: 'StepUndone', player, fromVersion }]);
}

/**
 * Events, die nach allen Rücknahmen noch gelten. Position im Strom = Version vor dem Event;
 * ein `StepUndone` streicht alle noch geltenden Events ab seiner `fromVersion`.
 */
export function withoutUndone(events: readonly GameEvent[]): readonly GameEvent[] {
  const kept: { readonly position: number; readonly event: GameEvent }[] = [];
  events.forEach((event, position) => {
    if (event.type !== 'StepUndone') {
      kept.push({ position, event });
      return;
    }
    while ((kept.at(-1)?.position ?? -1) >= event.fromVersion) kept.pop();
  });
  return kept.map(({ event }) => event);
}
