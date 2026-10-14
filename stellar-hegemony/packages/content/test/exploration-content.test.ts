import { describe, expect, it } from 'vitest';
import { EXPLORATION_DECKS, technologyId } from '@stellar/domain';
import {
  BASE_UNITS,
  createBaseContent,
  EXPLORATION_CARDS,
  EXPLORATION_DECK_NAMES,
  explorationCardText,
  GALAXY_TILES,
  LEGENDARY_TILES,
  legendaryText,
  planetName,
  relicText,
  RELICS,
  technologyText,
  TECHNOLOGIES,
} from '../src/index.ts';

const copiesIn = (deck: string) =>
  EXPLORATION_CARDS.filter((card) => card.deck === deck).reduce(
    (sum, card) => sum + card.copies,
    0,
  );

describe('Content: Erkundungsstapel (PoK Erkundung)', () => {
  it('PoK Erkundung: je Eigenschaft 10 bis 12 Karten, an der Grenze 8 bis 10', () => {
    for (const deck of ['cultural', 'hazardous', 'industrial']) {
      expect(copiesIn(deck)).toBeGreaterThanOrEqual(10);
      expect(copiesIn(deck)).toBeLessThanOrEqual(12);
    }
    expect(copiesIn('frontier')).toBeGreaterThanOrEqual(8);
    expect(copiesIn('frontier')).toBeLessThanOrEqual(10);
  });

  it('PoK Erkundung: eindeutige Ids, jede Karte und jeder Stapel mit deutschem und englischem Text', () => {
    expect(new Set(EXPLORATION_CARDS.map((card) => card.id)).size).toBe(EXPLORATION_CARDS.length);
    for (const card of EXPLORATION_CARDS) {
      expect(explorationCardText(card.id)?.name.de.length).toBeGreaterThan(0);
      expect(explorationCardText(card.id)?.effect.en.length).toBeGreaterThan(0);
    }
    for (const deck of EXPLORATION_DECKS) expect(EXPLORATION_DECK_NAMES[deck].en).toBeTruthy();
    expect(explorationCardText('unbekannt')).toBeUndefined();
  });

  it('PoK Relikt: jeder Stapel enthält mindestens drei Fragmente seiner Art', () => {
    for (const deck of EXPLORATION_DECKS) {
      const fragments = EXPLORATION_CARDS.filter(
        (card) => card.deck === deck && card.effect.kind === 'relicFragment',
      );
      expect(fragments.reduce((sum, card) => sum + card.copies, 0)).toBeGreaterThanOrEqual(3);
    }
  });

  it('PoK Erkundung: Anlagen nur auf Planetenstapeln, eingesetzte Einheiten gibt es', () => {
    const frontier = EXPLORATION_CARDS.filter((card) => card.deck === 'frontier');
    expect(frontier.some((card) => card.effect.kind === 'attachment')).toBe(false);
    const known = new Set(BASE_UNITS.map((unit) => unit.id));
    for (const card of EXPLORATION_CARDS)
      if (card.effect.kind === 'placeUnits') expect(known.has(card.effect.unit)).toBe(true);
  });
});

describe('Content: Relikte, legendäre Planeten, Tiefraumscanner (PoK)', () => {
  it('PoK Relikt: acht Relikte mit eindeutigen Ids und Texten', () => {
    expect(RELICS).toHaveLength(8);
    expect(new Set(RELICS.map((relic) => relic.id)).size).toBe(RELICS.length);
    for (const relic of RELICS) expect(relicText(relic.id)?.effect.de.length).toBeGreaterThan(0);
    expect(relicText('unbekannt')).toBeUndefined();
  });

  it('PoK Legendäre Planeten: zwei blaue Tafeln mit je einem legendären Planeten im Galaxie-Vorrat', () => {
    expect(LEGENDARY_TILES).toHaveLength(2);
    for (const tile of LEGENDARY_TILES) {
      expect(tile.back).toBe('blue');
      expect(GALAXY_TILES).toContain(tile);
      expect(tile.planets).toHaveLength(1);
      for (const planet of tile.planets) {
        expect(planet.legendary).toBeDefined();
        expect(planet.trait).toBeDefined();
        expect(planetName(planet.id)?.de).toBeTruthy();
        expect(legendaryText(planet.id)?.name.en).toBeTruthy();
      }
    }
    expect(legendaryText('unbekannt')).toBeUndefined();
  });

  it('PoK Grenzmarker: der Tiefraumscanner ist eine Antriebstechnologie ohne Voraussetzungen', () => {
    const scanner = TECHNOLOGIES.find((tech) => tech.id === technologyId('deep-space-scanner'));
    expect(scanner).toMatchObject({
      color: 'propulsion',
      prerequisites: [],
      rules: { exploresFrontier: true },
    });
    expect(technologyText('deep-space-scanner')?.name.de).toBe('Tiefraumscanner');
  });

  it('der Content-Adapter liefert Erkundungskarten und Relikte', () => {
    const content = createBaseContent();
    expect(content.explorationCards).toBe(EXPLORATION_CARDS);
    expect(content.relics).toBe(RELICS);
  });
});
