import { describe, expect, it } from 'vitest';
import { Planet, planetId, unclaimedPlanet, type PlanetDefinition } from '../src/index.ts';
import { BLUE, planetState, RED } from './fixtures.ts';

const definition: PlanetDefinition = {
  id: planetId('p1'),
  resources: 3,
  influence: 1,
  trait: 'industrial',
};

const planet = (overrides = {}) => {
  const result = Planet.of(definition, planetState(overrides));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('Planet als Information Expert (RR 59)', () => {
  it('RR 65/22: kennt Ressourcen und Einfluss', () => {
    expect(planet().resources).toBe(3);
    expect(planet().influence).toBe(1);
  });

  it('RR 26: erschöpfen geht nur bei bereiten, eigenen Planeten', () => {
    const exhausted = planet().exhaust(RED);
    expect(exhausted.ok && exhausted.value.exhausted).toBe(true);
    expect(planet({ exhausted: true }).exhaust(RED)).toMatchObject({
      ok: false,
      error: { code: 'planet.alreadyExhausted' },
    });
    expect(planet().exhaust(BLUE)).toMatchObject({
      ok: false,
      error: { code: 'planet.notControlled' },
    });
  });

  it('RR 26: erschöpfte Planeten tragen nichts zur Bezahlung bei', () => {
    expect(planet().availableResources()).toBe(3);
    expect(planet({ exhausted: true }).availableResources()).toBe(0);
    expect(planet({ exhausted: true }).availableInfluence()).toBe(0);
    expect(planet().availableInfluence()).toBe(1);
  });

  it('RR 69: bereitmachen hebt die Erschöpfung auf', () => {
    expect(planet({ exhausted: true }).ready().exhausted).toBe(false);
  });

  it('RR 47: kennt seinen Besitzer', () => {
    expect(planet().isControlledBy(RED)).toBe(true);
    expect(planet({ controller: null }).isControlledBy(RED)).toBe(false);
  });

  it('lehnt Zustand eines anderen Planeten ab', () => {
    expect(Planet.of(definition, unclaimedPlanet(planetId('p2'))).ok).toBe(false);
  });
});
