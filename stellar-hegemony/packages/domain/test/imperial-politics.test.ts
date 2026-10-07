import { describe, expect, it } from 'vitest';
import {
  type GameState,
  NO_PAYMENT,
  objectiveId,
  performStrategicActionHandler,
  planetId,
  type PlayerId,
  resolveSecondaryHandler,
  type StrategyChoice,
  updatePlayer,
} from '../src/index.ts';
import { BLUE, CARD, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, step } from './game-flow.ts';

const ALPHA = planetId('alpha-1');
const THRONE = planetId('throne');

/** Rot hält die Karte mit der angegebenen Initiative zusätzlich. */
function holding(initiative: number, state = actionPhaseGame()): GameState {
  const card = state.strategyCards[CARD(initiative)];
  if (card === undefined) throw new Error('Karte fehlt');
  return {
    ...state,
    strategyCards: { ...state.strategyCards, [card.id]: { ...card, holder: RED } },
  };
}

const control = (state: GameState, planet: string, player: PlayerId): GameState => {
  const current = state.planets[planet];
  if (current === undefined) throw new Error(`Planet ${planet} fehlt`);
  return { ...state, planets: { ...state.planets, [planet]: { ...current, controller: player } } };
};

const act = (initiative: number, choice: StrategyChoice) =>
  ({ type: 'PerformStrategicAction', issuedBy: RED, card: CARD(initiative), choice }) as const;

const imperial = (objective: string | null) =>
  ({
    mechanic: 'imperial',
    objective: objective === null ? null : objectiveId(objective),
    payment: NO_PAYMENT,
  }) as const;

const codeOf = (state: GameState, initiative: number, choice: StrategyChoice) => {
  const result = performStrategicActionHandler.decide(
    state,
    act(initiative, choice),
    contextWith(),
  );
  return result.ok ? 'ok' : result.error.code;
};

const playerOf = (state: GameState, player: PlayerId) => state.players.find((p) => p.id === player);

describe('Imperium (RR 37)', () => {
  it('RR 37.2: einen öffentlichen Auftrag werten, ohne Thronwelt einen geheimen ziehen', () => {
    const state = control(holding(8), ALPHA, RED);
    const { state: after, events } = step(state, act(8, imperial('two-worlds')));
    expect(events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
      'ObjectiveScored',
      'SecretObjectiveDrawn',
    ]);
    expect(playerOf(after, RED)?.victoryPoints).toBe(1);
    expect(playerOf(after, RED)?.secretObjectives).toHaveLength(1);
  });

  it('RR 37.2: mit der Thronwelt 1 Siegpunkt statt eines geheimen Auftrags', () => {
    const { events } = step(control(holding(8), THRONE, RED), act(8, imperial(null)));
    expect(events.at(-1)).toEqual({ type: 'VictoryPointsGained', player: RED, points: 1 });
  });

  it('nur aufgedeckte, erfüllte öffentliche Aufträge', () => {
    const state = holding(8);
    expect(codeOf(state, 8, imperial('goods-3'))).toBe('objective.notPublic');
    expect(codeOf(state, 8, imperial('two-worlds'))).toBe('objective.notMet');
    expect(codeOf(state, 8, imperial('unknown'))).toBe('objective.unknown');
    const bare = { ...contextWith(), content: { ...contextWith().content } };
    const noParameter = performStrategicActionHandler.decide(
      control(state, THRONE, RED),
      act(8, imperial(null)),
      {
        ...bare,
        content: {
          ...bare.content,
          strategyCards: bare.content.strategyCards.map((card) => ({ ...card, parameters: {} })),
        },
      },
    );
    expect(noParameter).toMatchObject({ error: { code: 'strategy.parameter' } });
  });

  it('RR 37.3: Mitspieler ziehen für einen Strategiemarker einen geheimen Auftrag', () => {
    const { state } = step(holding(8), act(8, imperial(null)));
    const result = resolveSecondaryHandler.decide(
      state,
      { type: 'ResolveSecondary', issuedBy: BLUE, choice: imperial(null) },
      contextWith(),
    );
    expect(result.ok && result.value.map((event) => event.type)).toEqual([
      'SecondaryResolved',
      'SecretObjectiveDrawn',
    ]);
  });

  it('RR 37.4: über drei geheimen Aufträgen wird ein nicht gewerteter zurückgelegt', () => {
    const full = updatePlayer(holding(8), RED, (p) => ({
      ...p,
      secretObjectives: ['goods-3', 'fleet-4', 'won-1'].map(objectiveId),
    }));
    const scored = {
      ...full,
      objectives: { ...full.objectives, scored: { 'goods-3': [RED] } },
    };
    const { state } = step(scored, act(8, imperial(null)));
    const choice = playerOf(state, RED)?.secretChoice;
    expect(choice?.keep).toBe(2);
    expect(choice?.options).toHaveLength(3);
    expect(playerOf(state, RED)?.secretObjectives).toEqual([objectiveId('goods-3')]);
  });

  it('ohne Karten im Geheimstapel wird nichts gezogen', () => {
    const state = holding(8);
    const empty = { ...state, objectives: { ...state.objectives, secretDeck: [] } };
    expect(step(empty, act(8, imperial(null))).events.map((event) => event.type)).toEqual([
      'StrategicActionPerformed',
    ]);
  });
});

describe('Politik (RR 61)', () => {
  const politics = (speaker: PlayerId | null) => ({ mechanic: 'politics', speaker }) as const;
  /** Die Testkarten haben keine Politik; Karte 3 wird dafür umgewidmet. */
  const base = contextWith();
  const context = {
    ...base,
    content: {
      ...base.content,
      strategyCards: base.content.strategyCards.map((card) =>
        card.id === CARD(3) ? { ...card, mechanic: 'politics' as const, parameters: {} } : card,
      ),
    },
  };
  const politicsCode = (state: GameState, speaker: PlayerId | null) => {
    const result = performStrategicActionHandler.decide(state, act(3, politics(speaker)), context);
    return result.ok ? 'ok' : result.error.code;
  };

  it('RR 61.2: ein Spieler ohne Sprechermarker wird Sprecher', () => {
    const state = holding(3);
    const other = state.speaker === GREEN ? BLUE : GREEN;
    const { state: after } = step(state, act(3, politics(other)), context);
    expect(after.speaker).toBe(other);
    expect(politicsCode(state, state.speaker)).toBe('politics.speaker');
    expect(politicsCode(state, null)).toBe('politics.speaker');
    expect(politicsCode(state, 'ghost' as PlayerId)).toBe('politics.speaker');
  });

  it('RR 61.3: die Sekundärfähigkeit lässt sich nutzen', () => {
    const state = holding(3);
    const other = state.speaker === GREEN ? BLUE : GREEN;
    const { state: after } = step(state, act(3, politics(other)), context);
    const result = resolveSecondaryHandler.decide(
      after,
      { type: 'ResolveSecondary', issuedBy: BLUE, choice: politics(null) },
      context,
    );
    expect(result.ok && result.value.map((event) => event.type)).toEqual(['SecondaryResolved']);
  });
});
