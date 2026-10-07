import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assembleGalaxy,
  generateGalaxyLayout,
  hexDistance,
  ORIGIN,
  type RandomPort,
} from '@stellar/domain';
import {
  ALL_TILES,
  BLUE_TILES,
  createBaseContent,
  galaxyTemplate,
  planetName,
  RED_TILES,
} from '../src/index.ts';

class LinearRandom implements RandomPort {
  constructor(private seed: number) {}
  nextInt(min: number, max: number): number {
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
    return min + (this.seed % (max - min + 1));
  }
}

const content = createBaseContent();

describe('Content: Systemtafeln', () => {
  it('Tafel- und Planeten-Ids sind eindeutig, jeder Planet hat einen Namen', () => {
    expect(new Set(ALL_TILES.map((tile) => tile.id)).size).toBe(ALL_TILES.length);
    const planets = ALL_TILES.flatMap((tile) => tile.planets);
    expect(new Set(planets.map((planet) => planet.id)).size).toBe(planets.length);
    for (const planet of planets) expect(planetName(planet.id)?.de).toBeTruthy();
  });

  it('rote Tafeln haben keine Planeten, blaue mindestens einen', () => {
    expect(RED_TILES.every((tile) => tile.planets.length === 0)).toBe(true);
    expect(BLUE_TILES.every((tile) => tile.planets.length > 0)).toBe(true);
  });

  it('RR 53: die Zentrumswelt hat 1 Ressource und 6 Einfluss', () => {
    const center = ALL_TILES.find((tile) => tile.back === 'center');
    expect(center?.planets[0]).toMatchObject({ resources: 1, influence: 6 });
  });
});

describe('Content: Galaxie-Vorlagen für 3–6 Spieler', () => {
  it.each([3, 4, 5, 6])('%i Spieler: Felder und Tafelzahl passen zusammen', (players) => {
    const template = galaxyTemplate(players);
    expect(template?.homeSlots).toHaveLength(players);
    expect(template && template.blueTiles + template.redTiles).toBe(template?.systemSlots.length);
    expect(template?.homeSlots.every((home) => hexDistance(ORIGIN, home) === 3)).toBe(true);
  });

  it('keine Vorlage für nicht unterstützte Spielerzahlen', () => {
    expect(galaxyTemplate(2)).toBeUndefined();
    expect(galaxyTemplate(7)).toBeUndefined();
  });

  it('jede erzeugte Galaxie ist gültig', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 6 }), fc.nat(), (players, seed) => {
        const template = galaxyTemplate(players);
        if (template === undefined) return false;
        const layout = generateGalaxyLayout(template, content.tiles, new LinearRandom(seed));
        return layout.ok && assembleGalaxy(layout.value, content.tiles, players).ok;
      }),
      { numRuns: 50 },
    );
  });
});
