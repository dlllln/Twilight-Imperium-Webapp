import {
  adjacentSystemIds,
  type GameState,
  type PlayerId,
  systemId,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/local-game.ts';
import { countUnits, gameScene, layoutScene } from '../src/render/scene-model.ts';
import { worldTransform } from '../src/render/view-transform.ts';
import { content, DEFAULT_VIEWPORT, useGalaxyStore } from '../src/store.ts';
import { cargoAtOrigin, highlightsOf, movementChoices } from '../src/tactical-view.ts';
import { pickAll, started } from './game-helpers.ts';

const SEED = 7;

function activeOf(game: GameState): PlayerId {
  const active = game.actionPhase?.active;
  if (active == null) throw new Error('niemand am Zug');
  return active;
}

const homeOf = (game: GameState, player: PlayerId) => {
  const faction = game.players.find((candidate) => candidate.id === player)?.faction;
  const home = content.factions.find((definition) => definition.id === faction)?.homeSystem;
  const system = home === undefined ? undefined : game.systems[home.id];
  if (system === undefined) throw new Error('kein Heimatsystem');
  return system;
};

/** Aktiviert das erste Nachbarsystem der Heimat, das eigene Schiffe erreichen können. */
function activatedNeighbour(game: GameState): GameState {
  const player = activeOf(game);
  for (const id of adjacentSystemIds(game.systems, homeOf(game, player))) {
    const command = { type: 'ActivateSystem', issuedBy: player, system: systemId(id) } as const;
    const next = applyCommand(game, command, SEED);
    if (next.ok && movementChoices(next.value, content).length > 0) return next.value;
  }
  throw new Error('kein erreichbares Nachbarsystem');
}

describe('Szenenmodell der Karte', () => {
  it('Aufbau: Planetennamen in der Sprache und Heimat-Plätze mit Sitznummer', () => {
    useGalaxyStore.getState().setPlayerCount(6);
    const hexes = layoutScene(useGalaxyStore.getState().layout, content, 'de');
    const center = hexes.find((hex) => hex.back === 'center');
    expect(center?.planets[0]?.name).toBe('Thronwelt Aurum');
    expect(center?.planets[0]?.look).toBe('center');
    const seats = hexes.flatMap((hex) => (hex.kind === 'homeSlot' ? [hex.seat] : []));
    expect(seats).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Partie: Heimatsysteme zeigen Sitz, Planetenkontrolle und gezählte Flotten', () => {
    const game = started();
    const hexes = gameScene(game, content, 'de');
    const homes = hexes.filter((hex) => hex.seat !== null);
    expect(homes).toHaveLength(3);
    const first = homes.find((hex) => hex.seat === 1);
    expect(first?.planets.every((planet) => planet.controllerSeat === 1)).toBe(true);
    expect(first?.ships.reduce((sum, ships) => sum + ships.count, 0)).toBeGreaterThan(0);
    expect(hexes.some((hex) => hex.kind === 'homeSlot')).toBe(false);
  });

  it('zählt Einheiten je Sitz und Typ', () => {
    const unit = (id: string, type: string, owner: string) => ({
      id: unitId(id),
      type: unitTypeId(type),
      owner: owner as PlayerId,
      damaged: false,
    });
    const units = [
      unit('a', 'fighter', 'p2'),
      unit('b', 'fighter', 'p2'),
      unit('c', 'carrier', 'p1'),
    ];
    const seatOf = (u: { owner: string }) => (u.owner === 'p1' ? 1 : 2);
    expect(countUnits(units, seatOf)).toEqual([
      { type: 'carrier', seat: 1, count: 1 },
      { type: 'fighter', seat: 2, count: 2 },
    ]);
  });
});

describe('Taktische Aktion in der Ansicht (RR 79)', () => {
  it('hebt aktiviertes System, Auswahl und Herkunft beweglicher Schiffe hervor', () => {
    const game = activatedNeighbour(pickAll(started()));
    const options = movementChoices(game, content);
    const active = game.actionPhase?.tactical?.system ?? '';
    const highlights = highlightsOf(game, options, 'r01');
    expect(highlights.get(active)).toBe('active');
    expect(highlights.get('r01')).toBe('selected');
    expect(highlights.get(options[0]?.from ?? '')).toBe('origin');
  });

  it('der Kommandomarker liegt in der Farbe des aktiven Sitzes im System (RR 79.2)', () => {
    const game = activatedNeighbour(pickAll(started()));
    const active = game.actionPhase?.tactical?.system;
    const hex = gameScene(game, content, 'de').find((h) => h.systemId === active);
    const seat = game.players.find((player) => player.id === activeOf(game))?.seat;
    expect(hex?.tokens).toEqual([(seat ?? -1) + 1]);
  });

  it('Fracht im Herkunftssystem: eigene Jäger und Bodentruppen (RR 83)', () => {
    const game = activatedNeighbour(pickAll(started()));
    const option = movementChoices(game, content)[0];
    if (option === undefined) throw new Error('keine Option');
    const cargo = cargoAtOrigin(game, content, option, activeOf(game));
    expect(cargo.length).toBeGreaterThan(0);
    expect(cargo.every((unit) => ['fighter', 'infantry'].includes(unit.type))).toBe(true);
    expect(
      cargoAtOrigin(game, content, { ...option, from: systemId('fehlt') }, activeOf(game)),
    ).toEqual([]);
  });

  it('ohne laufende Taktikaktion gibt es keine Bewegungsoptionen', () => {
    const game = pickAll(started());
    expect(movementChoices(game, content)).toEqual([]);
    expect(highlightsOf(game, [], null).size).toBe(0);
  });
});

describe('Abbildung Welt → Bildschirm', () => {
  const bounds = { minX: -100, minY: -50, width: 200, height: 100 };

  it('passt die Galaxie mittig ein wie eine SVG-viewBox', () => {
    expect(worldTransform(bounds, { width: 400, height: 400 }, DEFAULT_VIEWPORT)).toEqual({
      scale: 2,
      x: 200,
      y: 200,
    });
  });

  it('Zoom und Verschiebung wirken in Welteinheiten', () => {
    const view = { zoom: 2, panX: 10, panY: -5 };
    expect(worldTransform(bounds, { width: 200, height: 100 }, view)).toEqual({
      scale: 2,
      x: 110,
      y: 45,
    });
  });
});
