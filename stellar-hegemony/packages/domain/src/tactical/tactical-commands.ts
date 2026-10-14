import type { ContentPort } from '../ports/content-port.ts';
import { fleetLimitOf } from '../technology/technology-catalog.ts';
import { activeTurnChecks, endTurn } from '../action/action-commands.ts';
import type { Command, CommandHandler, DecisionContext } from '../eventsourcing/command.ts';
import { StarSystem } from '../galaxy/star-system.ts';
import { evolveGame, type GameEvent } from '../game/game-events.ts';
import type { TacticalStep } from '../combat/combat-state.ts';
import { reachNext } from './tactical-steps.ts';
import { progressTactical } from '../combat/tactical-flow.ts';
import { excessCargo } from '../combat/space-combat.ts';
import { chain } from '../game/event-chain.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { type RandomPort, rollDie } from '../ports/random-port.ts';
import {
  type Check,
  type DomainError,
  domainError,
  firstFailure,
  guard,
} from '../shared/domain-error.ts';
import type { SystemId } from '../shared/ids.ts';
import { andThen, combine, err, map, ok, type Result } from '../shared/result.ts';
import {
  type MoveContext,
  type ShipMoveOrder,
  validateShipMove,
  type ValidatedMove,
} from './ship-move-validator.ts';
import type { GravityRiftRolled, ShipsMoved } from './tactical-events.ts';
import { tacticalReducers } from './tactical-reducers.ts';
import { collectCache } from '../exploration/explore.ts';

export interface ActivateSystem extends Command<'ActivateSystem'> {
  readonly system: SystemId;
}

export interface MoveShips extends Command<'MoveShips'> {
  readonly moves: readonly ShipMoveOrder[];
}

export type EndTacticalAction = Command<'EndTacticalAction'>;

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 79.1: Kommandomarker aus dem Taktikpool in ein System ohne eigenen Marker. */
export const activateSystemHandler = {
  commandType: 'ActivateSystem',
  decide(state: GameState, command: ActivateSystem): Events {
    const system = state.systems[command.system];
    const tactic = findPlayer(state, command.issuedBy)?.commandPools.tactic ?? 0;
    const checked = firstFailure([
      ...activeTurnChecks(state, command.issuedBy),
      guard(system !== undefined, 'tactical.unknownSystem', 'Unbekanntes System'),
      guard(tactic > 0, 'tactical.noTacticToken', 'Kein Marker im Taktikpool'),
      guard(
        system?.commandTokens.includes(command.issuedBy) === false,
        'tactical.alreadyActivated',
        'Dort liegt bereits ein eigener Kommandomarker',
      ),
    ]);
    if (!checked.ok) return checked;
    return ok([{ type: 'SystemActivated', player: command.issuedBy, system: command.system }]);
  },
} as const satisfies CommandHandler<GameState, ActivateSystem, GameEvent>;

export function tacticalStepCheck(state: GameState, command: Command, step: TacticalStep): Check {
  const turn = state.actionPhase;
  return firstFailure([
    guard(turn?.active === command.issuedBy, 'action.notYourTurn', 'Du bist nicht am Zug'),
    guard(turn?.tactical != null, 'tactical.notActive', 'Keine Taktikaktion aktiv'),
    guard(turn?.tactical?.step === step, 'tactical.wrongStep', 'Dieser Schritt ist nicht dran', {
      step: turn?.tactical?.step ?? 'none',
    }),
  ]);
}

/** Jede Einheit darf nur einmal bewegt oder mitgenommen werden. */
function uniqueUnits(moves: readonly ShipMoveOrder[]): Check {
  const ids = moves.flatMap((move) => [move.ship, ...move.cargo]);
  return guard(new Set(ids).size === ids.length, 'move.duplicateUnit', 'Einheit doppelt angegeben');
}

type Catalog = DecisionContext['content']['units'];

function activeSystemAfter(context: MoveContext, moved: ShipsMoved, catalog: Catalog) {
  const after = tacticalReducers.ShipsMoved(context.state, moved);
  const system = after.systems[context.active];
  if (system === undefined) return err(domainError('tactical.unknownSystem', 'Unbekanntes System'));
  const planets = system.planetIds.flatMap((id) => after.planets[id] ?? []);
  return StarSystem.inspect(system, planets, catalog);
}

/** RR 28.3, RR 43.3: Flottenlimit und Kapazität im aktiven System nach der Bewegung. */
function limitsCheck(context: MoveContext, moved: ShipsMoved, content: ContentPort): Check {
  const fleet = fleetLimitOf(context.state, context.player, content);
  return andThen(activeSystemAfter(context, moved, content.units), (system) =>
    firstFailure([
      guard(
        !system.exceedsFleetLimit(context.player, fleet),
        'move.fleetLimit',
        'Flottenlimit überschritten',
      ),
      guard(!system.exceedsCapacity(context.player), 'move.capacity', 'Zu wenig Kapazität'),
    ]),
  );
}

/** RR 33: Würfe je verlassenem Strudel, bis das Schiff zerstört ist oder alle Würfe gelungen sind. */
function riftRollsFor(
  context: MoveContext,
  move: ValidatedMove,
  random: RandomPort,
): GravityRiftRolled[] {
  const { dieSides, gravityRiftDestroyMaxRoll } = context.rules;
  const rolls: GravityRiftRolled[] = [];
  while (rolls.length < move.riftExits && !rolls.some((roll) => roll.destroyed)) {
    const roll = rollDie(random, dieSides);
    const destroyed = roll <= gravityRiftDestroyMaxRoll;
    rolls.push({
      type: 'GravityRiftRolled',
      player: context.player,
      ship: move.ship,
      roll,
      destroyed,
    });
  }
  return rolls;
}

function destroyedEvents(
  context: MoveContext,
  moves: readonly ValidatedMove[],
  rolls: readonly GravityRiftRolled[],
): readonly GameEvent[] {
  const lost = moves.filter((move) =>
    rolls.some((roll) => roll.ship === move.ship && roll.destroyed),
  );
  const units = lost.flatMap((move) => [move.ship, ...move.cargo.map((cargo) => cargo.unit)]);
  return units.length > 0 ? [{ type: 'UnitsDestroyed', system: context.active, units }] : [];
}

/** RR 43.3: Was ohne Träger im Herkunftssystem zurückbleibt und keinen Platz hat, geht verloren. */
const leftBehind = (
  context: MoveContext,
  moves: readonly ValidatedMove[],
  state: GameState,
): readonly GameEvent[] =>
  chain(
    state,
    [...new Set(moves.map((move) => move.from))].map(
      (origin) => (current: GameState) =>
        excessCargo(current, origin, context.player, context.catalog),
    ),
  );

function movementEvents(
  context: MoveContext,
  moves: readonly ValidatedMove[],
  decision: DecisionContext,
): Events {
  const movements = moves.map(({ ship, from, path, cargo }) => ({ ship, from, path, cargo }));
  const { player, active: system } = context;
  const moved: ShipsMoved = { type: 'ShipsMoved', player, system, movements };
  const limits = limitsCheck(context, moved, decision.content);
  if (!limits.ok) return limits;
  const rolls = moves.flatMap((move) => riftRollsFor(context, move, decision.random));
  const flown = [...rolls, moved, ...destroyedEvents(context, moves, rolls)];
  const landed = flown.reduce(evolveGame, context.state);
  const settled = [...flown, ...leftBehind(context, moves, landed)];
  const arrived = settled.reduce(evolveGame, context.state);
  const resolved = [...settled, ...collectCache(arrived, player, system, decision.content.units)];
  const after = resolved.reduce(evolveGame, context.state);
  const reached = reachNext(after, 'movement', decision.content);
  return ok([...resolved, reached, ...progressTactical(evolveGame(after, reached), decision)]);
}

/** RR 79.2: Bewegung ins aktive System (auch ohne Schiffe möglich). */
export const moveShipsHandler = {
  commandType: 'MoveShips',
  decide(state: GameState, command: MoveShips, decision: DecisionContext): Events {
    const checked = firstFailure([
      tacticalStepCheck(state, command, 'movement'),
      uniqueUnits(command.moves),
    ]);
    const active = state.actionPhase?.tactical?.system;
    if (!checked.ok) return checked;
    if (active === undefined) return err(domainError('tactical.notActive', 'Keine Taktikaktion'));
    const context = {
      state,
      player: command.issuedBy,
      active,
      catalog: decision.content.units,
      rules: state.config.rules,
    };
    const validated = combine(command.moves.map((move) => validateShipMove(context, move)));
    return andThen(validated, (moves) => movementEvents(context, moves, decision));
  },
} as const satisfies CommandHandler<GameState, MoveShips, GameEvent>;

/** Nach Raumkampf (und ab Iteration 6 Einmarsch und Produktion) endet die Taktikaktion. */
export const endTacticalActionHandler = {
  commandType: 'EndTacticalAction',
  decide(state: GameState, command: EndTacticalAction): Events {
    const checked = tacticalStepCheck(state, command, 'done');
    const passed = state.actionPhase?.passed ?? [];
    return map(checked, () => [
      { type: 'TacticalActionEnded', player: command.issuedBy } as const,
      ...endTurn(state, command.issuedBy, passed),
    ]);
  },
} as const satisfies CommandHandler<GameState, EndTacticalAction, GameEvent>;
