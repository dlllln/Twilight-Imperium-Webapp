import { describe, expect, it } from 'vitest';
import {
  decideGameCommand,
  type GameCommand,
  type GameState,
  NO_FACTION_RULES,
  type PlayerId,
  playerId,
  statusTokenGain,
  updatePlayer,
  warfareTokenSystems,
} from '../src/index.ts';
import { BLUE, CARD, contextWith, RED } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, statusPhaseGame } from './game-flow.ts';

const playerOf = (state: GameState, id: PlayerId) =>
  state.players.find((player) => player.id === id) as GameState['players'][number];

/** Statusphase im Schritt der Markerverteilung; Rot ist an der Reihe. */
const tokenStep = (): GameState =>
  run(statusPhaseGame(), [
    { type: 'EndScoring', issuedBy: RED },
    { type: 'EndScoring', issuedBy: BLUE },
    { type: 'EndScoring', issuedBy: GREEN },
  ]);

/** Rot hält zusätzlich die Kriegsführung (Initiative 6). */
function warfareHeld(): GameState {
  const state = actionPhaseGame();
  const card = state.strategyCards[CARD(6)] as GameState['strategyCards'][string];
  return {
    ...state,
    strategyCards: { ...state.strategyCards, [card.id]: { ...card, holder: RED } },
  };
}

function withToken(state: GameState, system: string, player: PlayerId): GameState {
  const target = state.systems[system] as GameState['systems'][string];
  const tokens = [...target.commandTokens, player];
  return {
    ...state,
    systems: { ...state.systems, [system]: { ...target, commandTokens: tokens } },
  };
}

describe('Abfragen für Kommandomarker', () => {
  it('Statusphase: Grundmenge plus Fraktionsbonus, höchstens so viele wie im Nachschub', () => {
    const state = tokenStep();
    expect(statusTokenGain(state, RED)).toBe(2);
    const short = updatePlayer(state, RED, (p) => ({ ...p, reinforcementTokens: 1 }));
    expect(statusTokenGain(short, RED)).toBe(1);
    expect(statusTokenGain(state, playerId('niemand'))).toBe(0);
  });

  it('eiserne Disziplin bringt in der Statusphase einen Marker mehr', () => {
    const state = updatePlayer(tokenStep(), RED, (p) => ({
      ...p,
      factionRules: { ...NO_FACTION_RULES, statusCommandTokens: 1 },
    }));
    expect(statusTokenGain(state, RED)).toBe(3);
    const pools = playerOf(state, RED).commandPools;
    const command = {
      type: 'AllocateCommandTokens',
      issuedBy: RED,
      pools: { ...pools, fleet: pools.fleet + 3 },
    } as const;
    expect(decideGameCommand(state, command, contextWith()).ok).toBe(true);
  });

  it('Kriegsführung: wählbar sind genau die Systeme mit eigenem Marker', () => {
    const state = warfareHeld();
    const [first, second, third] = Object.keys(state.systems);
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('zu wenige Systeme');
    const marked = withToken(withToken(withToken(state, first, RED), second, BLUE), third, RED);
    expect([...warfareTokenSystems(marked, RED)].sort()).toEqual([first, third].sort());
    expect(warfareTokenSystems(marked, BLUE)).toEqual([second]);
  });

  it('ohne eigenen Marker auf der Karte ist die Liste leer und system null wird angenommen', () => {
    const state = warfareHeld();
    expect(warfareTokenSystems(state, RED)).toEqual([]);
    const pools = playerOf(state, RED).commandPools;
    const choice = {
      mechanic: 'warfare',
      system: null,
      pools: { ...pools, tactic: pools.tactic - 1, strategy: pools.strategy + 1 },
      production: null,
    } as const;
    const command: GameCommand = {
      type: 'PerformStrategicAction',
      issuedBy: RED,
      card: CARD(6),
      choice,
    };
    expect(decideGameCommand(state, command, contextWith()).ok).toBe(true);
  });
});
