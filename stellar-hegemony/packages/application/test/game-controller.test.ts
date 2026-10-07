import { describe, expect, it } from 'vitest';
import { BASE_RULE_NUMBERS, createBaseContent } from '@stellar/content';
import { factionId, gameId, type GameEvent, playerId, type SeatPlayer } from '@stellar/domain';
import {
  InMemoryEventStore,
  InProcessEventPublisher,
  SeededRandom,
  SystemClock,
} from '@stellar/infrastructure';
import { GameController } from '../src/index.ts';

const GAME = gameId('partie-1');

function setup() {
  const store = new InMemoryEventStore();
  const publisher = new InProcessEventPublisher();
  const published: GameEvent[] = [];
  publisher.subscribe((_, events) => published.push(...events));
  const controller = new GameController({
    store,
    publisher,
    random: new SeededRandom(1),
    clock: new SystemClock(),
    content: createBaseContent(),
  });
  return { controller, published };
}

const seat = (id: string, color: SeatPlayer['color']): SeatPlayer => ({
  type: 'SeatPlayer',
  issuedBy: playerId(id),
  name: id,
  color,
  faction: factionId(id),
  commodityLimit: 3,
});

const create = {
  type: 'CreateGame',
  issuedBy: playerId('host'),
  gameId: GAME,
  config: { playerCount: 3, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS },
} as const;

describe('GameController (Integration mit In-Memory-Adaptern)', () => {
  it('erstellt eine Partie, nimmt Commands an und veröffentlicht Events', async () => {
    const { controller, published } = setup();
    expect((await controller.create(create)).ok).toBe(true);
    const outcome = await controller.execute(GAME, seat('anna', 'red'));
    expect(outcome.ok && outcome.value.state.players.map((p) => p.name)).toEqual(['anna']);
    expect(published.map((event) => event.type)).toEqual(['GameCreated', 'PlayerSeated']);
  });

  it('Reconnect: der geladene Zustand entspricht dem zuletzt gelieferten', async () => {
    const { controller } = setup();
    await controller.create(create);
    const last = await controller.execute(GAME, seat('ben', 'blue'));
    expect(await controller.load(GAME)).toEqual(
      last.ok ? { ok: true, value: last.value.state } : null,
    );
  });

  it('ungültige Commands verändern nichts', async () => {
    const { controller, published } = setup();
    await controller.create(create);
    await controller.execute(GAME, seat('anna', 'red'));
    const rejected = await controller.execute(GAME, seat('ben', 'red'));
    expect(rejected).toMatchObject({ ok: false, error: { code: 'setup.colorTaken' } });
    expect(published).toHaveLength(2);
  });

  it('eine Partie kann nicht zweimal erstellt werden', async () => {
    const { controller } = setup();
    await controller.create(create);
    expect(await controller.create(create)).toMatchObject({
      ok: false,
      error: { code: 'store.versionConflict' },
    });
  });

  it('ungültige Konfiguration und unbekannte Partien werden abgelehnt', async () => {
    const { controller } = setup();
    expect(
      (await controller.create({ ...create, config: { ...create.config, playerCount: 1 } })).ok,
    ).toBe(false);
    expect((await controller.execute(gameId('fehlt'), seat('anna', 'red'))).ok).toBe(false);
  });
});
