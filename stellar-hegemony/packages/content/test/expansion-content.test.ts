import { describe, expect, it } from 'vitest';
import {
  LEADER_KINDS,
  strategyCardsPerPlayer,
  validateGameConfig,
  type FactionDefinition,
} from '@stellar/domain';
import {
  ACTION_CARDS,
  actionCardText,
  AGENDAS,
  agendaText,
  BASE_RULE_NUMBERS,
  createBaseContent,
  FACTION_NAMES,
  FACTION_PROFILES,
  FACTIONS,
  ALL_FACTIONS,
  factionAbilityText,
  galaxyTemplate,
  LEADERS,
  leaderText,
  type LocalizedText,
  mechAbilityOf,
  OBJECTIVES,
  objectiveText,
  planetName,
  SECRET_OBJECTIVES,
  STAGE_ONE_OBJECTIVES,
  STAGE_TWO_OBJECTIVES,
  STRATEGY_CARDS,
  TECHNOLOGIES,
  technologyText,
} from '../src/index.ts';

/** Ein Text ist vollständig, wenn er auf Deutsch und Englisch nicht leer ist. */
const complete = (text: LocalizedText | undefined): boolean =>
  text !== undefined && text.de.trim().length > 0 && text.en.trim().length > 0;

const ids = (list: readonly { readonly id: string }[]) => new Set(list.map((entry) => entry.id));

/** Alles, was eine Fraktion für eine Partie braucht, als Liste fehlender Teile. */
function missingParts(faction: FactionDefinition): readonly string[] {
  const leaders = LEADERS.filter((leader) => leader.faction === faction.id);
  const mech = mechAbilityOf(faction.id);
  const checks: readonly (readonly [string, boolean])[] = [
    ['name', complete(FACTION_NAMES[faction.id])],
    ['home', faction.homeSystem.back === 'home' && faction.homeSystem.planets.length > 0],
    ['planetNames', faction.homeSystem.planets.every((p) => complete(planetName(p.id)))],
    ['mech', mech !== undefined && faction.abilities.includes(mech)],
    ['abilityTexts', faction.abilities.every((a) => complete(factionAbilityText(a.id)?.effect))],
    ['leaders', leaders.map((leader) => leader.kind).join() === LEADER_KINDS.join()],
    ['leaderTexts', leaders.every((leader) => complete(leaderText(leader.id)?.effect))],
    ['profile', complete(FACTION_PROFILES[faction.id]?.lore)],
    ['commodities', faction.commodityLimit > 0],
  ];
  return checks.filter(([, ok]) => !ok).map(([part]) => part);
}

describe('Content: Erweiterung für 7–8 Spieler (PoK)', () => {
  it('PoK 8 Spieler: acht Fraktionen mit eindeutigen Ids und Heimatsystemen', () => {
    expect(FACTIONS).toHaveLength(8);
    expect(ids(FACTIONS).size).toBe(8);
    expect(new Set(FACTIONS.map((faction) => faction.homeSystem.id)).size).toBe(8);
    expect(FACTIONS.map((faction) => faction.id)).toEqual(expect.arrayContaining(['vyr', 'tarn']));
  });

  it.each(FACTIONS.map((faction) => [faction.id, faction] as const))(
    'PoK 8 Spieler: %s hat Heimatsystem, Mech-Fähigkeit, drei Anführer und Texte in beiden Sprachen',
    (_, faction) => {
      expect(missingParts(faction)).toEqual([]);
    },
  );

  it('RR 76: mit 7 und 8 Spielern nimmt jeder genau 1 Strategiekarte, 8 Karten reichen', () => {
    for (const playerCount of [7, 8]) {
      const config = { playerCount, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS };
      expect(validateGameConfig(config).ok).toBe(true);
      expect(strategyCardsPerPlayer(config)).toBe(1);
      expect(STRATEGY_CARDS.length).toBeGreaterThanOrEqual(playerCount);
    }
    const nine = { playerCount: 9, victoryPointsToWin: 10, rules: BASE_RULE_NUMBERS };
    expect(validateGameConfig(nine).ok).toBe(false);
  });

  it('RR 37: genug geheime Aufträge, damit 8 Spieler je 2 erhalten', () => {
    const dealt = 8 * BASE_RULE_NUMBERS.secretObjectivesDealt;
    expect(SECRET_OBJECTIVES.length).toBeGreaterThanOrEqual(dealt);
    expect(STAGE_ONE_OBJECTIVES.length).toBeGreaterThanOrEqual(5);
    expect(STAGE_TWO_OBJECTIVES.length).toBeGreaterThanOrEqual(5);
  });

  it('der Content-Adapter kennt Vorlagen bis 8 Spieler', () => {
    const content = createBaseContent();
    expect(content.galaxyTemplate(8)).toEqual(galaxyTemplate(8));
    expect(content.factions).toBe(ALL_FACTIONS);
  });
});

describe('Content: neue Technologien, Aktionskarten, Aufträge und Agenden (Erweiterung)', () => {
  it('PoK Erweiterung: je Farbe eine neue Technologie, alle mit Texten', () => {
    const added = ['chitin-plating', 'cargo-lattices', 'relay-command', 'siege-mortars'];
    const colors = added.map((id) => TECHNOLOGIES.find((tech) => tech.id === id)?.color);
    expect(new Set(colors)).toEqual(new Set(['biotic', 'propulsion', 'cybernetic', 'warfare']));
    expect(ids(TECHNOLOGIES).size).toBe(TECHNOLOGIES.length);
    for (const tech of TECHNOLOGIES) expect(complete(technologyText(tech.id)?.effect)).toBe(true);
  });

  it('RR 3: sechs neue Aktionskarten, jede Karte mit Name, Zeitpunkt und Wirkung', () => {
    const added = ['emergency-session', 'border-levy', 'militia-muster'];
    const more = ['overcharged-guns', 'deflector-surge', 'scorched-earth'];
    expect([...added, ...more].every((id) => ids(ACTION_CARDS).has(id))).toBe(true);
    for (const card of ACTION_CARDS) {
      const text = actionCardText(card.id);
      expect(complete(text?.name) && complete(text?.timing) && complete(text?.effect)).toBe(true);
    }
  });

  it('RR 12: neue öffentliche und geheime Aufträge, alle mit Namen und Anforderung', () => {
    const added = ['far-patrols', 'first-walkers', 'chain-of-command', 'iron-host'];
    expect([...added, 'dread-armada', 'tech-hoard'].every((id) => ids(OBJECTIVES).has(id))).toBe(
      true,
    );
    expect(ids(OBJECTIVES).size).toBe(OBJECTIVES.length);
    for (const objective of OBJECTIVES) {
      const text = objectiveText(objective.id);
      expect(complete(text?.name) && complete(text?.requirement)).toBe(true);
    }
  });

  it('RR 1: vier neue Agenden, jede mit Name und Ergebnistexten', () => {
    const added = ['austerity-act', 'frontier-bounty', 'imperial-census', 'veterans-charter'];
    expect(added.every((id) => ids(AGENDAS).has(id))).toBe(true);
    expect(ids(AGENDAS).size).toBe(AGENDAS.length);
    for (const agenda of AGENDAS) {
      const text = agendaText(agenda.id);
      expect(complete(text?.name) && complete(text?.passed) && complete(text?.rejected)).toBe(true);
    }
  });
});
