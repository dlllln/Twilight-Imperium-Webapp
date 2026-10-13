import { describe, expect, it } from 'vitest';
import {
  currentActor,
  decideGameCommand,
  evolveGame,
  factionId,
  type GameCommand,
  type GameEvent,
  type GameState,
  isReversible,
  type PlayerColor,
  type PlayerId,
  replayGame,
  systemId,
  undoStep,
  withoutUndone,
} from '../src/index.ts';
import { BLUE, CARD, config, contextWith, RED } from './fixtures.ts';
import { GREEN, SMALL_MAP } from './game-flow.ts';

/** Ein Event-Strom wie im Event Store: jeder Command hängt seine Events an. */
interface Stream {
  readonly events: readonly GameEvent[];
  readonly state: GameState;
}

function record(stream: Stream, command: GameCommand): Stream {
  const decided = decideGameCommand(stream.state, command, contextWith());
  if (!decided.ok) throw new Error(`${command.type}: ${decided.error.code}`);
  return {
    events: [...stream.events, ...decided.value],
    state: decided.value.reduce(evolveGame, stream.state),
  };
}

const seat = (id: PlayerId, color: PlayerColor): GameCommand => ({
  type: 'SeatPlayer',
  issuedBy: id,
  name: id,
  color,
  faction: factionId(`f-${id}`),
  commodityLimit: 3,
});

const pick = (player: PlayerId, initiative: number): GameCommand => ({
  type: 'PickStrategyCard',
  issuedBy: player,
  card: CARD(initiative),
});

/** Drei Spieler bis in die Aktionsphase; Rot ist am Zug. */
function actionStream(): Stream {
  const created: GameEvent = {
    type: 'GameCreated',
    gameId: 'g' as never,
    host: RED,
    config: config(3),
  };
  const start = replayGame([created]);
  if (!start.ok) throw new Error('replay');
  const commands: GameCommand[] = [
    seat(RED, 'red'),
    seat(BLUE, 'blue'),
    seat(GREEN, 'green'),
    { type: 'ImportMap', issuedBy: RED, mapString: SMALL_MAP },
    { type: 'StartGame', issuedBy: RED },
    ...[RED, BLUE, GREEN, RED, BLUE, GREEN].map((player, index) => pick(player, index + 1)),
  ];
  return commands.reduce(record, { events: [created], state: start.value });
}

const freeSystem = (state: GameState) =>
  systemId(
    Object.values(state.systems).find(
      (system) => system.commandTokens.length === 0 && system.spaceUnits.length === 0,
    )?.id ?? 'keins',
  );

const activate = (state: GameState): GameCommand => ({
  type: 'ActivateSystem',
  issuedBy: RED,
  system: freeSystem(state),
});

describe('Rückgängig für den letzten eigenen Schritt', () => {
  it('eine Aktivierung lässt sich zurücknehmen: das Replay streicht sie, die Version zählt weiter', () => {
    const before = actionStream();
    const after = record(before, activate(before.state));
    expect(isReversible(after.events.slice(before.events.length))).toBe(true);
    const undone = undoStep(after.state, RED, before.state.version);
    if (!undone.ok) throw new Error(undone.error.code);
    const replayed = replayGame([...after.events, ...undone.value]);
    if (!replayed.ok) throw new Error(replayed.error.code);
    expect(replayed.value.actionPhase?.tactical).toBeNull();
    expect(replayed.value.players[0]?.commandPools).toEqual(before.state.players[0]?.commandPools);
    expect(replayed.value.version).toBe(after.state.version + 1);
  });

  it('nach der Rücknahme geht es normal weiter, auch über eine zweite Rücknahme hinweg', () => {
    const base = actionStream();
    const first = record(base, activate(base.state));
    const marker = undoStep(first.state, RED, base.state.version);
    if (!marker.ok) throw new Error(marker.error.code);
    const events = [...first.events, ...marker.value];
    const again = replayGame(events);
    if (!again.ok) throw new Error(again.error.code);
    const second = record({ events, state: again.value }, activate(again.value));
    const effective = withoutUndone(second.events);
    expect(effective).toHaveLength(base.events.length + 1);
    expect(effective.at(-1)?.type).toBe('SystemActivated');
    expect(currentActor(second.state)).toBe(RED);
  });

  it('nur wer am Zug ist und nur einen Schritt nach dem Aufbau', () => {
    const { state } = actionStream();
    expect(undoStep(state, BLUE, state.version - 1)).toMatchObject({
      ok: false,
      error: { code: 'undo.notYourTurn' },
    });
    for (const version of [0, state.version, 1.5])
      expect(undoStep(state, RED, version)).toMatchObject({
        ok: false,
        error: { code: 'undo.nothing' },
      });
  });

  it('Würfe, gezogene Karten und leere Schritte bleiben endgültig', () => {
    const roll = { type: 'GravityRiftRolled', player: RED, ship: 'x', roll: 3, destroyed: false };
    const moved = { type: 'ShipsMoved', player: RED, system: 'a', movements: [] };
    expect(isReversible([moved as GameEvent])).toBe(true);
    expect(isReversible([moved, roll] as GameEvent[])).toBe(false);
    expect(isReversible([{ type: 'ActionCardsDrawn', player: RED, cards: [] } as never])).toBe(
      false,
    );
    expect(isReversible([])).toBe(false);
  });
});
