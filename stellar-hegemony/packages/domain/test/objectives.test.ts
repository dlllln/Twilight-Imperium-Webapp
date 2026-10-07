import { describe, expect, it } from 'vitest';
import {
  decideGameCommand,
  evolveGame,
  type GameCommand,
  type GameEvent,
  type GameState,
  NO_PAYMENT,
  type ObjectiveId,
  objectiveId,
  type Payment,
  planetId,
  type PlayerId,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, startedGame, statusPhaseGame, step } from './game-flow.ts';

const id = objectiveId;
const RED_PRIME = planetId('red-prime');
const BLUE_PRIME = planetId('blue-prime');
const ALPHA = planetId('alpha-1');

const codeOf = (state: GameState, command: GameCommand) => {
  const result = decideGameCommand(state, command, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

const score = (issuedBy: PlayerId, objective: string, payment: Payment = NO_PAYMENT) =>
  ({ type: 'ScoreObjective', issuedBy, objective: id(objective), payment }) as const;

const endScoring = (issuedBy: PlayerId) => ({ type: 'EndScoring', issuedBy }) as const;

const control = (state: GameState, planet: string, player: PlayerId | null): GameState => {
  const current = state.planets[planet];
  if (current === undefined) throw new Error(`Planet ${planet} fehlt`);
  return { ...state, planets: { ...state.planets, [planet]: { ...current, controller: player } } };
};

const withSecrets = (state: GameState, player: PlayerId, secrets: readonly string[]) =>
  updatePlayer(state, player, (p) => ({ ...p, secretObjectives: secrets.map(id) }));

const playerOf = (state: GameState, player: PlayerId) => state.players.find((p) => p.id === player);

const revealAll = (state: GameState): GameState => ({
  ...state,
  objectives: {
    ...state.objectives,
    public: state.objectives.public.map((slot) => ({ ...slot, revealed: true })),
  },
});

describe('Aufträge vorbereiten (RR 12.13, RR 12.20)', () => {
  it('Reihe mit Stufe I vor Stufe II, zwei aufgedeckt; jeder zieht zwei geheime zur Wahl', () => {
    const state = startedGame();
    const row = state.objectives.public;
    expect(row.map((slot) => slot.stage)).toEqual([1, 1, 2]);
    expect(row.map((slot) => slot.revealed)).toEqual([true, true, false]);
    for (const player of state.players) expect(player.secretChoice?.options).toHaveLength(2);
    expect(state.objectives.secretDeck).toHaveLength(2);
  });

  it('RR 12.20: jeder behält einen; der andere kommt zurück in den Stapel', () => {
    const state = startedGame();
    const [kept] = playerOf(state, RED)?.secretChoice?.options ?? [];
    const after = run(state, [
      { type: 'KeepSecretObjectives', issuedBy: RED, keep: [kept as ObjectiveId] },
    ]);
    expect(playerOf(after, RED)).toMatchObject({ secretObjectives: [kept], secretChoice: null });
    expect(after.objectives.secretDeck).toHaveLength(3);
  });

  it('die Auswahl wird geprüft', () => {
    const state = startedGame();
    const options = playerOf(state, RED)?.secretChoice?.options ?? [];
    const keep = (ids: readonly ObjectiveId[], player = RED) =>
      codeOf(state, { type: 'KeepSecretObjectives', issuedBy: player, keep: ids });
    expect(keep([])).toBe('objective.keepCount');
    expect(keep([...options])).toBe('objective.keepCount');
    expect(keep([id('nothing')])).toBe('objective.notOffered');
    const decided = run(state, [
      { type: 'KeepSecretObjectives', issuedBy: RED, keep: [options[0] as ObjectiveId] },
    ]);
    expect(codeOf(decided, { type: 'KeepSecretObjectives', issuedBy: RED, keep: [] })).toBe(
      'objective.noChoice',
    );
  });
});

describe('Statusphase: Aufträge werten (RR 73.1, RR 12)', () => {
  it('RR 73.1: in Initiativreihenfolge; ein erfüllter öffentlicher Auftrag bringt seine Punkte', () => {
    const state = control(statusPhaseGame(), ALPHA, RED);
    expect(state.statusPhase).toMatchObject({ step: 'scoring', waiting: [RED, BLUE, GREEN] });
    const { state: after, events } = step(state, score(RED, 'two-worlds'));
    expect(events).toEqual([
      { type: 'ObjectiveScored', player: RED, objective: id('two-worlds'), points: 1 },
    ]);
    expect(playerOf(after, RED)?.victoryPoints).toBe(1);
    expect(codeOf(state, score(BLUE, 'two-worlds'))).toBe('status.notYourTurn');
  });

  it('RR 12.6: je Statusphase höchstens ein öffentlicher und ein geheimer Auftrag', () => {
    const base = withSecrets(control(statusPhaseGame(), ALPHA, RED), RED, ['fighters-2']);
    const after = run(base, [score(RED, 'two-worlds')]);
    expect(codeOf(after, score(RED, 'pay-three', { planets: [RED_PRIME], tradeGoods: 0 }))).toBe(
      'objective.limit',
    );
    const both = run(after, [score(RED, 'fighters-2')]);
    expect(playerOf(both, RED)?.victoryPoints).toBe(2);
  });

  it('RR 12.4: Ausgabe-Aufträge verlangen die Bezahlung', () => {
    const state = run(statusPhaseGame(), [endScoring(RED)]);
    const paid = step(state, score(BLUE, 'pay-three', { planets: [BLUE_PRIME], tradeGoods: 0 }));
    expect(paid.events.map((event) => event.type)).toEqual(['PlanetsExhausted', 'ObjectiveScored']);
    expect(codeOf(state, score(BLUE, 'pay-three'))).toBe('objective.payment');
  });

  it('RR 12.5: unerfüllte, verdeckte, fremde und schon gewertete Aufträge zählen nicht', () => {
    const state = withSecrets(statusPhaseGame(), BLUE, ['goods-3']);
    expect(codeOf(state, score(RED, 'two-worlds'))).toBe('objective.notMet');
    expect(codeOf(state, score(RED, 'hold-center'))).toBe('objective.notAvailable');
    expect(codeOf(state, score(RED, 'goods-3'))).toBe('objective.notAvailable');
    expect(codeOf(state, score(RED, 'unknown'))).toBe('objective.unknown');
    const scored = {
      ...state,
      objectives: { ...state.objectives, scored: { 'two-worlds': [RED] } },
    };
    expect(codeOf(scored, score(RED, 'two-worlds'))).toBe('objective.alreadyScored');
  });

  it('RR 12.16: ohne alle Planeten des Heimatsystems keine öffentlichen Aufträge', () => {
    const state = control(control(statusPhaseGame(), ALPHA, RED), RED_PRIME, BLUE);
    expect(codeOf(state, score(RED, 'two-worlds'))).toBe('objective.homeLost');
  });

  it('RR 12.3: Aufträge der Aktionsphase jederzeit in der Aktionsphase, sonst nicht', () => {
    const state = updatePlayer(
      withSecrets(actionPhaseGame(), BLUE, ['won-1', 'goods-3']),
      BLUE,
      (p) => ({
        ...p,
        tradeGoods: 3,
        roundStats: { ...p.roundStats, spaceCombatsWon: 1 },
      }),
    );
    expect(step(state, score(BLUE, 'won-1')).events.map((event) => event.type)).toEqual([
      'ObjectiveScored',
    ]);
    expect(codeOf(state, score(BLUE, 'goods-3'))).toBe('objective.wrongTiming');
    const status = withSecrets(statusPhaseGame(), RED, ['won-1']);
    expect(codeOf(status, score(RED, 'won-1'))).toBe('objective.wrongTiming');
  });
});

describe('Statusphase: Marker und neue Runde (RR 73.2–73.8)', () => {
  const allEnded = () => run(statusPhaseGame(), [endScoring(RED), endScoring(BLUE)]);

  it('RR 73.2/73.4: nach dem Werten Auftrag aufdecken, Marker vom Spielplan nehmen', () => {
    const before = allEnded();
    const system = Object.keys(before.systems)[0] as string;
    const marked = {
      ...before,
      systems: {
        ...before.systems,
        [system]: {
          ...(before.systems[system] as GameState['systems'][string]),
          commandTokens: [GREEN],
        },
      },
    };
    const { state, events } = step(marked, endScoring(GREEN));
    expect(events.map((event) => event.type)).toEqual([
      'ScoringFinished',
      'PublicObjectiveRevealed',
      'CommandTokensCleared',
      'TokenStepReached',
    ]);
    expect(state.objectives.public.every((slot) => slot.revealed)).toBe(true);
    expect(state.systems[system]?.commandTokens).toEqual([]);
    expect(playerOf(state, GREEN)?.reinforcementTokens).toBe(
      (playerOf(marked, GREEN)?.reinforcementTokens ?? 0) + 1,
    );
    expect(state.statusPhase).toMatchObject({ step: 'tokens', waiting: [RED, BLUE, GREEN] });
  });

  it('RR 73.5: zwei Marker erhalten und frei umverteilen; das Flottenlimit muss halten', () => {
    const state = run(allEnded(), [endScoring(GREEN)]);
    const allocate = (pools: { tactic: number; fleet: number; strategy: number }) =>
      ({ type: 'AllocateCommandTokens', issuedBy: RED, pools }) as const;
    const { state: after } = step(state, allocate({ tactic: 4, fleet: 3, strategy: 3 }));
    expect(playerOf(after, RED)).toMatchObject({
      commandPools: { tactic: 4, fleet: 3, strategy: 3 },
      reinforcementTokens: (playerOf(state, RED)?.reinforcementTokens ?? 0) - 2,
    });
    expect(codeOf(state, allocate({ tactic: 3, fleet: 3, strategy: 3 }))).toBe(
      'commandSheet.totalChanged',
    );
    expect(codeOf(state, allocate({ tactic: 8, fleet: 0, strategy: 2 }))).toBe('status.fleetLimit');
    expect(
      codeOf(state, { ...allocate({ tactic: 4, fleet: 3, strategy: 3 }), issuedBy: BLUE }),
    ).toBe('status.notYourTurn');
  });

  it('RR 73.6–73.8: bereitmachen, reparieren, Karten zurück, neue Runde ab dem Sprecher', () => {
    const tokens = run(allEnded(), [endScoring(GREEN)]);
    const exhausted = {
      ...tokens,
      planets: {
        ...tokens.planets,
        [RED_PRIME]: {
          ...(tokens.planets[RED_PRIME] as GameState['planets'][string]),
          exhausted: true,
        },
      },
    };
    const allocate = (issuedBy: PlayerId) => {
      const pools = playerOf(exhausted, issuedBy)?.commandPools ?? {
        tactic: 0,
        fleet: 0,
        strategy: 0,
      };
      return {
        type: 'AllocateCommandTokens',
        issuedBy,
        pools: { ...pools, tactic: pools.tactic + 2 },
      } as const;
    };
    const ready = run(exhausted, [allocate(RED), allocate(BLUE)]);
    const { state, events } = step(ready, allocate(GREEN));
    expect(events.map((event) => event.type).slice(-2)).toEqual([
      'RoundEnded',
      'StrategyPhaseStarted',
    ]);
    expect(state).toMatchObject({ phase: 'strategy', round: 2, statusPhase: null });
    expect(state.planets[RED_PRIME]?.exhausted).toBe(false);
    expect(
      Object.values(state.strategyCards).every((card) => card.holder === null && !card.exhausted),
    ).toBe(true);
    expect(state.pickQueue[0]).toBe(state.speaker);
  });

  it('RR 12.15: ohne verdeckten Auftrag gewinnt, wer die meisten Punkte hat (Gleichstand: Initiative)', () => {
    const tied = (points: number) =>
      revealAll(
        [BLUE, GREEN].reduce(
          (s, player) => updatePlayer(s, player, (p) => ({ ...p, victoryPoints: points })),
          allEnded(),
        ),
      );
    const { state, events } = step(tied(3), endScoring(GREEN));
    expect(events.at(-1)).toEqual({ type: 'GameWon', player: BLUE });
    expect(state).toMatchObject({ phase: 'gameOver', winner: BLUE });
    expect(codeOf(state, endScoring(GREEN))).toBe('game.over');
  });
});

describe('Sieg (RR 68)', () => {
  it('RR 68.7: Wer das Siegpunktziel erreicht, gewinnt sofort', () => {
    const state = updatePlayer(control(statusPhaseGame(), ALPHA, RED), RED, (p) => ({
      ...p,
      victoryPoints: 9,
    }));
    const { state: after, events } = step(state, score(RED, 'two-worlds'));
    expect(events.map((event) => event.type)).toEqual(['ObjectiveScored', 'GameWon']);
    expect(after).toMatchObject({ winner: RED, phase: 'gameOver' });
    expect(playerOf(after, RED)?.victoryPoints).toBe(10);
  });

  it('RR 68.5: mehr Punkte als das Ziel gibt es nicht', () => {
    const state = updatePlayer(actionPhaseGame(), RED, (p) => ({ ...p, victoryPoints: 10 }));
    const after = evolveGame(state, { type: 'VictoryPointsGained', player: RED, points: 2 });
    expect(playerOf(after, RED)?.victoryPoints).toBe(10);
  });
});

describe('Rundenzähler für Aufträge der Aktionsphase', () => {
  const apply = (state: GameState, events: readonly GameEvent[]) =>
    events.reduce(evolveGame, state);

  it('zählt Siege, eroberte Planeten und zerstörte Schiffe; neue Runde beginnt bei null', () => {
    const base = actionPhaseGame();
    const system = Object.keys(base.systems)[0] as never;
    const fighting = {
      ...base,
      actionPhase: base.actionPhase && {
        ...base.actionPhase,
        tactical: {
          system,
          step: 'spaceCombat',
          pendingHits: [],
          combat: {
            attacker: RED,
            defender: BLUE,
            round: 1,
            awaitingRetreat: [],
            retreat: null,
            rolled: true,
          },
        },
      },
    } as GameState;
    const after = apply(fighting, [
      { type: 'HitsAssigned', player: BLUE, system, sustained: [], destroyed: ['a', 'b'] as never },
      { type: 'HitsAssigned', player: RED, system, sustained: [], destroyed: ['c'] as never },
      { type: 'SpaceCombatEnded', system, winner: RED },
      { type: 'GroundCombatEnded', planet: ALPHA, winner: RED },
      { type: 'PlanetControlGained', player: RED, planet: ALPHA, structuresDestroyed: [] },
    ]);
    expect(playerOf(after, RED)?.roundStats).toEqual({
      spaceCombatsWon: 1,
      groundCombatsWon: 1,
      shipsDestroyed: 2,
      planetsGained: 1,
    });
    expect(playerOf(after, BLUE)?.roundStats.shipsDestroyed).toBe(1);
    const reset = evolveGame(after, { type: 'StrategyPhaseStarted', round: 2, pickQueue: [] });
    expect(playerOf(reset, RED)?.roundStats.spaceCombatsWon).toBe(0);
  });

  it('ohne aktive Taktikaktion zählt kein Gegner', () => {
    const state = statusPhaseGame();
    const after = evolveGame(state, {
      type: 'HitsAssigned',
      player: BLUE,
      system: Object.keys(state.systems)[0] as never,
      sustained: [],
      destroyed: ['x'] as never,
    });
    expect(after.players.map((p) => p.roundStats.shipsDestroyed)).toEqual([0, 0, 0]);
  });
});
