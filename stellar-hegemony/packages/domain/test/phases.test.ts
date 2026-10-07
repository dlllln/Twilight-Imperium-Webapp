import { describe, expect, it } from 'vitest';
import {
  decideGameCommand,
  type GameState,
  phaseOf,
  pickQueueFor,
  playerId,
  startGameHandler,
} from '../src/index.ts';
import { BLUE, config, content, contextWith, RED, ScriptedRandom } from './fixtures.ts';
import { GREEN, setupGame, startedGame, step } from './game-flow.ts';

describe('Phasen als Zustandsautomat (RR 61: Rundenablauf)', () => {
  it('jede Phase nennt ihre erlaubten Commands', () => {
    const setup = setupGame();
    expect(phaseOf(setup).accepts('StartGame')).toBe(true);
    expect(phaseOf(setup).accepts('PickStrategyCard')).toBe(false);
    const strategy = startedGame();
    expect(phaseOf(strategy).accepts('PickStrategyCard')).toBe(true);
    expect(phaseOf({ ...strategy, phase: 'action' }).accepts('Pass')).toBe(true);
    expect(phaseOf({ ...strategy, phase: 'status' }).accepts('Pass')).toBe(false);
    expect(phaseOf({ ...strategy, phase: 'agenda' }).accepts('Pass')).toBe(false);
    expect(phaseOf({ ...strategy, phase: 'gameOver' }).accepts('Pass')).toBe(false);
  });

  it('Nachfolger: Aufbau → Strategie → Aktion → Status', () => {
    const state = setupGame();
    expect(phaseOf(state).next(state)).toBe('strategy');
    expect(phaseOf({ ...state, phase: 'strategy' }).next(state)).toBe('action');
    expect(phaseOf({ ...state, phase: 'action' }).next(state)).toBe('status');
    expect(phaseOf({ ...state, phase: 'agenda' }).next(state)).toBe('strategy');
    expect(phaseOf({ ...state, phase: 'gameOver' }).next(state)).toBe('gameOver');
  });

  it('RR 36: Agendaphase erst nach Entfernen des Markers auf der Zentrumswelt', () => {
    const status: GameState = { ...setupGame(), phase: 'status' };
    expect(phaseOf(status).next(status)).toBe('strategy');
    const opened = { ...status, centerTokenRemoved: true };
    expect(phaseOf(opened).next(opened)).toBe('agenda');
  });

  it('Commands außerhalb ihrer Phase werden abgelehnt', () => {
    const result = decideGameCommand(setupGame(), { type: 'Pass', issuedBy: RED }, contextWith());
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'phase.commandNotAllowed', details: { phase: 'setup' } },
    });
  });

  it('nach Spielende sind keine Commands mehr möglich', () => {
    const over = { ...startedGame(), winner: RED };
    const result = decideGameCommand(over, { type: 'Pass', issuedBy: RED }, contextWith());
    expect(result).toMatchObject({ ok: false, error: { code: 'game.over' } });
  });
});

describe('StartGame (RR 76.1: Sprecher und Kartenauslage)', () => {
  it('der Sprecher wird zufällig bestimmt, Karten liegen nach Initiative aus', () => {
    const { state, events } = step(
      setupGame(),
      { type: 'StartGame', issuedBy: RED },
      contextWith(new ScriptedRandom([1])),
    );
    expect(state.speaker).toBe(BLUE);
    expect(state.phase).toBe('strategy');
    expect(state.round).toBe(1);
    expect(events.map((event) => event.type)).toEqual([
      'GameStarted',
      'HomeSystemPlaced',
      'HomeSystemPlaced',
      'HomeSystemPlaced',
      'TechnologiesGranted',
      'StrategyPhaseStarted',
    ]);
    const initiatives = Object.values(state.strategyCards).map((card) => card.initiative);
    expect(initiatives).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Object.values(state.strategyCards).every((card) => card.holder === null)).toBe(true);
  });

  it('RR 76.2: Wahl ab dem Sprecher im Uhrzeigersinn, bei 3–4 Spielern zwei Durchgänge', () => {
    const state = startedGame();
    expect(state.pickQueue).toEqual([RED, BLUE, GREEN, RED, BLUE, GREEN]);
    expect(pickQueueFor(state, GREEN)).toEqual([GREEN, RED, BLUE, GREEN, RED, BLUE]);
  });

  it('ab 5 Spielern wählt jeder nur eine Karte', () => {
    const state = { ...setupGame(), config: config(5) };
    expect(pickQueueFor(state, BLUE)).toEqual([BLUE, GREEN, RED]);
  });

  it('nur der Gastgeber, mit allen Plätzen, Galaxie und vollständigen Karten', () => {
    const setup = setupGame();
    const decide = (state: GameState, issuedBy = RED, ctx = contextWith()) =>
      startGameHandler.decide(state, { type: 'StartGame', issuedBy }, ctx);
    expect(decide(setup, BLUE)).toMatchObject({ error: { code: 'setup.hostOnly' } });
    const missingSeat = { ...setup, players: setup.players.slice(1) };
    expect(decide(missingSeat)).toMatchObject({ error: { code: 'setup.seatsOpen' } });
    expect(decide({ ...setup, systems: {} })).toMatchObject({ error: { code: 'setup.noGalaxy' } });
    const fewCards = { ...contextWith(), content: { ...content, strategyCards: [] } };
    expect(decide(setup, RED, fewCards)).toMatchObject({
      error: { code: 'setup.strategyCards' },
    });
  });

  it('ohne Spieler gibt es keinen Sprecher', () => {
    const empty = { ...setupGame(), players: [], config: config(3) };
    const result = startGameHandler.decide(
      { ...empty, config: { ...empty.config, playerCount: 0 } },
      { type: 'StartGame', issuedBy: RED },
      contextWith(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'setup.noPlayers' } });
  });

  it('ein Gast kann keinen Platz mehr einnehmen, sobald gespielt wird', () => {
    const result = decideGameCommand(
      startedGame(),
      {
        type: 'SeatPlayer',
        issuedBy: playerId('spät'),
        name: 'x',
        color: 'pink',
        faction: 'f' as never,
        commodityLimit: 3,
      },
      contextWith(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'phase.commandNotAllowed' } });
  });
});
