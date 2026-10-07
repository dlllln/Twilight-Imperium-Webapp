import { describe, expect, it } from 'vitest';
import { factionId, planetId, startGameHandler, systemId } from '../src/index.ts';
import { BLUE, contextWith, RED, T } from './fixtures.ts';
import { GREEN, setupGame, startedGame } from './game-flow.ts';

describe('Heimatsysteme beim Spielstart (Spielaufbau: Heimatsystem und Startflotte)', () => {
  it('jeder Spieler erhält sein Heimatsystem auf dem Heimat-Platz seines Sitzes', () => {
    const state = startedGame();
    const homes = [RED, BLUE, GREEN].map((_, seat) => state.homeSlots[seat]);
    const placed = ['red', 'blue', 'green'].map(
      (color) => state.systems[`home-${color}`]?.position,
    );
    expect(placed).toEqual(homes);
  });

  it('Startflotte im Weltraum, Bodentruppen und Gebäude auf dem kontrollierten Planeten', () => {
    const state = startedGame();
    const home = state.systems[systemId('home-red')];
    expect(home?.spaceUnits.map((unit) => unit.type)).toEqual([
      T.carrier,
      T.cruiser,
      T.cruiser,
      T.fighter,
      T.fighter,
    ]);
    expect(home?.spaceUnits.every((unit) => unit.owner === RED)).toBe(true);
    const prime = state.planets[planetId('red-prime')];
    expect(prime?.controller).toBe(RED);
    expect(prime?.units.map((unit) => unit.type)).toEqual([
      T.infantry,
      T.infantry,
      T.infantry,
      T.dock,
    ]);
  });

  it('Einheiten-Ids sind eindeutig und der Zähler läuft weiter', () => {
    const state = startedGame();
    const ids = [
      ...Object.values(state.systems).flatMap((system) => system.spaceUnits),
      ...Object.values(state.planets).flatMap((planet) => planet.units),
    ].map((unit) => unit.id);
    expect(new Set(ids).size).toBe(27);
    expect(state.nextUnitNumber).toBe(28);
  });

  it('eine unbekannte Fraktion verhindert den Start', () => {
    const setup = setupGame();
    const players = setup.players.map((player, seat) =>
      seat === 1 ? { ...player, faction: factionId('unbekannt') } : player,
    );
    const result = startGameHandler.decide(
      { ...setup, players },
      { type: 'StartGame', issuedBy: RED },
      contextWith(),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'setup.unknownFaction', details: { faction: 'unbekannt' } },
    });
  });

  it('ohne genügend Heimat-Plätze kein Start', () => {
    const setup = setupGame();
    const result = startGameHandler.decide(
      { ...setup, homeSlots: setup.homeSlots.slice(1) },
      { type: 'StartGame', issuedBy: RED },
      contextWith(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'setup.homeSlots' } });
  });
});
