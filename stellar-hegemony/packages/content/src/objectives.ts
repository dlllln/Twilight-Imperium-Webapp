import {
  objectiveId,
  type ObjectiveCondition,
  type ObjectiveDefinition,
  type ObjectiveTiming,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigene Aufträge: 10 öffentliche der Stufe I (1 Punkt), 10 der Stufe II (2 Punkte) und
 * 20 geheime (1 Punkt). Namen, Anforderungen und Texte sind eigene Entwürfe.
 */
const STAGE_ONE_POINTS = 1;
const STAGE_TWO_POINTS = 2;
const SECRET_POINTS = 1;

const publicObjective =
  (stage: 1 | 2) =>
  (id: string, condition: ObjectiveCondition): ObjectiveDefinition => ({
    id: objectiveId(id),
    category: 'public',
    stage,
    points: stage === 1 ? STAGE_ONE_POINTS : STAGE_TWO_POINTS,
    timing: 'status',
    condition,
  });

const secret = (
  id: string,
  condition: ObjectiveCondition,
  timing: ObjectiveTiming = 'status',
): ObjectiveDefinition => ({
  id: objectiveId(id),
  category: 'secret',
  stage: null,
  points: SECRET_POINTS,
  timing,
  condition,
});

const one = publicObjective(1);
const two = publicObjective(2);

export const STAGE_ONE_OBJECTIVES: readonly ObjectiveDefinition[] = [
  one('settled-reach', { kind: 'planets', count: 6, exceptHome: true }),
  one('three-cultures', { kind: 'planetsOfEachTrait', count: 1 }),
  one('merchant-reserve', { kind: 'spend', currency: 'tradeGoods', amount: 5 }),
  one('war-chest', { kind: 'spend', currency: 'resources', amount: 8 }),
  one('courtly-favour', { kind: 'spend', currency: 'influence', amount: 8 }),
  one('twin-disciplines', { kind: 'technologiesInColors', colors: 2, perColor: 2 }),
  one('refitted-fleet', { kind: 'unitUpgrades', count: 2 }),
  one('built-frontier', { kind: 'structuredPlanets', count: 4 }),
  one('wild-space', { kind: 'systemsWithShips', where: 'anomaly', count: 2 }),
  one('throne-watch', { kind: 'systemsWithShips', where: 'adjacentToCenter', count: 2 }),
];

export const STAGE_TWO_OBJECTIVES: readonly ObjectiveDefinition[] = [
  two('sprawling-domain', { kind: 'planets', count: 11, exceptHome: true }),
  two('woven-peoples', { kind: 'planetsOfEachTrait', count: 3 }),
  two('trade-dynasty', { kind: 'spend', currency: 'tradeGoods', amount: 10 }),
  two('grand-treasury', { kind: 'spend', currency: 'resources', amount: 16 }),
  two('hall-of-voices', { kind: 'spend', currency: 'influence', amount: 16 }),
  two('four-pillars', { kind: 'technologiesInColors', colors: 4, perColor: 2 }),
  two('modern-armada', { kind: 'unitUpgrades', count: 3 }),
  two('fortified-realm', { kind: 'structuredPlanets', count: 7 }),
  two('seat-of-power', { kind: 'systemsWithShips', where: 'center', count: 1 }),
  two('learned-worlds', { kind: 'specialtyPlanets', count: 3 }),
];

export const SECRET_OBJECTIVES: readonly ObjectiveDefinition[] = [
  secret('harsh-frontier', { kind: 'planets', trait: 'hazardous', count: 4 }),
  secret('forge-worlds', { kind: 'planets', trait: 'industrial', count: 4 }),
  secret('cradle-worlds', { kind: 'planets', trait: 'cultural', count: 4 }),
  secret('single-minded', { kind: 'technologiesOfColor', count: 4 }),
  secret('gun-line', { kind: 'structures', capability: 'spaceCannon', count: 4 }),
  secret('shipwright-guild', { kind: 'structures', capability: 'production', count: 3 }),
  secret('storm-riders', { kind: 'systemsWithShips', where: 'anomaly', count: 3 }),
  secret('iron-fist', { kind: 'shipsInOneSystem', count: 5 }),
  secret('swarm-doctrine', { kind: 'units', type: UNIT_TYPES.fighter, count: 8 }),
  secret('scholar-worlds', { kind: 'specialtyPlanets', count: 3, distinct: true }),
  secret('hoarder', { kind: 'tradeGoods', count: 10 }),
  secret('at-the-gates', { kind: 'systemsWithShips', where: 'foreignHome', count: 1 }),
  secret('foothold', { kind: 'foreignHomePlanet' }),
  secret('crowned-world', { kind: 'centerPlanet' }),
  secret('grand-fleet', { kind: 'fleetPool', count: 5 }),
  secret('long-reach', { kind: 'systemsWithTokens', count: 6 }),
  secret('fleet-breaker', { kind: 'roundStat', stat: 'spaceCombatsWon', count: 2 }, 'action'),
  secret('bloody-harvest', { kind: 'roundStat', stat: 'shipsDestroyed', count: 5 }, 'action'),
  secret('lightning-campaign', { kind: 'roundStat', stat: 'planetsGained', count: 3 }, 'action'),
  secret('boots-on-ground', { kind: 'roundStat', stat: 'groundCombatsWon', count: 1 }, 'action'),
];

export const OBJECTIVES: readonly ObjectiveDefinition[] = [
  ...STAGE_ONE_OBJECTIVES,
  ...STAGE_TWO_OBJECTIVES,
  ...SECRET_OBJECTIVES,
];

export interface ObjectiveText {
  readonly name: LocalizedText;
  readonly requirement: LocalizedText;
}

const text = (de: string, en: string, needDe: string, needEn: string): ObjectiveText => ({
  name: { de, en },
  requirement: { de: needDe, en: needEn },
});

export const OBJECTIVE_TEXTS: Readonly<Record<string, ObjectiveText>> = {
  'settled-reach': text(
    'Besiedelte Weite',
    'Settled Reach',
    'Kontrolliere 6 Planeten außerhalb deines Heimatsystems.',
    'Control 6 planets outside your home system.',
  ),
  'three-cultures': text(
    'Drei Kulturen',
    'Three Cultures',
    'Kontrolliere je 1 kulturellen, gefährlichen und industriellen Planeten.',
    'Control 1 cultural, 1 hazardous and 1 industrial planet.',
  ),
  'merchant-reserve': text(
    'Händlerreserve',
    'Merchant Reserve',
    'Gib 5 Handelswaren aus.',
    'Spend 5 trade goods.',
  ),
  'war-chest': text('Kriegskasse', 'War Chest', 'Gib 8 Ressourcen aus.', 'Spend 8 resources.'),
  'courtly-favour': text(
    'Gunst des Hofes',
    'Courtly Favour',
    'Gib 8 Einfluss aus.',
    'Spend 8 influence.',
  ),
  'twin-disciplines': text(
    'Doppelte Lehre',
    'Twin Disciplines',
    'Besitze je 2 Technologien in 2 Farben.',
    'Own 2 technologies in each of 2 colours.',
  ),
  'refitted-fleet': text(
    'Umgerüstete Flotte',
    'Refitted Fleet',
    'Besitze 2 Aufwertungen für Einheiten.',
    'Own 2 unit upgrades.',
  ),
  'built-frontier': text(
    'Ausgebaute Grenze',
    'Built Frontier',
    'Habe Gebäude auf 4 Planeten.',
    'Have structures on 4 planets.',
  ),
  'wild-space': text(
    'Wilder Raum',
    'Wild Space',
    'Habe Schiffe in 2 Systemen mit Anomalie.',
    'Have ships in 2 systems with an anomaly.',
  ),
  'throne-watch': text(
    'Wacht am Thron',
    'Throne Watch',
    'Habe Schiffe in 2 Systemen neben der Thronwelt.',
    'Have ships in 2 systems next to the throne world.',
  ),
  'sprawling-domain': text(
    'Weites Reich',
    'Sprawling Domain',
    'Kontrolliere 11 Planeten außerhalb deines Heimatsystems.',
    'Control 11 planets outside your home system.',
  ),
  'woven-peoples': text(
    'Verwobene Völker',
    'Woven Peoples',
    'Kontrolliere je 3 kulturelle, gefährliche und industrielle Planeten.',
    'Control 3 cultural, 3 hazardous and 3 industrial planets.',
  ),
  'trade-dynasty': text(
    'Handelsdynastie',
    'Trade Dynasty',
    'Gib 10 Handelswaren aus.',
    'Spend 10 trade goods.',
  ),
  'grand-treasury': text(
    'Große Schatzkammer',
    'Grand Treasury',
    'Gib 16 Ressourcen aus.',
    'Spend 16 resources.',
  ),
  'hall-of-voices': text(
    'Halle der Stimmen',
    'Hall of Voices',
    'Gib 16 Einfluss aus.',
    'Spend 16 influence.',
  ),
  'four-pillars': text(
    'Vier Säulen',
    'Four Pillars',
    'Besitze je 2 Technologien in allen 4 Farben.',
    'Own 2 technologies in each of the 4 colours.',
  ),
  'modern-armada': text(
    'Moderne Armada',
    'Modern Armada',
    'Besitze 3 Aufwertungen für Einheiten.',
    'Own 3 unit upgrades.',
  ),
  'fortified-realm': text(
    'Befestigtes Reich',
    'Fortified Realm',
    'Habe Gebäude auf 7 Planeten.',
    'Have structures on 7 planets.',
  ),
  'seat-of-power': text(
    'Sitz der Macht',
    'Seat of Power',
    'Habe Schiffe im System der Thronwelt.',
    'Have ships in the throne world system.',
  ),
  'learned-worlds': text(
    'Gelehrte Welten',
    'Learned Worlds',
    'Kontrolliere 3 Planeten mit Spezialisierung.',
    'Control 3 planets with a specialty.',
  ),
  'harsh-frontier': text(
    'Raue Grenze',
    'Harsh Frontier',
    'Kontrolliere 4 gefährliche Planeten.',
    'Control 4 hazardous planets.',
  ),
  'forge-worlds': text(
    'Schmiedewelten',
    'Forge Worlds',
    'Kontrolliere 4 industrielle Planeten.',
    'Control 4 industrial planets.',
  ),
  'cradle-worlds': text(
    'Wiegenwelten',
    'Cradle Worlds',
    'Kontrolliere 4 kulturelle Planeten.',
    'Control 4 cultural planets.',
  ),
  'single-minded': text(
    'Zielstrebig',
    'Single-Minded',
    'Besitze 4 Technologien derselben Farbe.',
    'Own 4 technologies of one colour.',
  ),
  'gun-line': text(
    'Geschützlinie',
    'Gun Line',
    'Habe 4 Gebäude mit Weltraumkanone.',
    'Have 4 structures with space cannon.',
  ),
  'shipwright-guild': text(
    'Werftgilde',
    'Shipwright Guild',
    'Habe 3 Gebäude mit Produktion.',
    'Have 3 structures with production.',
  ),
  'storm-riders': text(
    'Sturmreiter',
    'Storm Riders',
    'Habe Schiffe in 3 Systemen mit Anomalie.',
    'Have ships in 3 systems with an anomaly.',
  ),
  'iron-fist': text(
    'Eiserne Faust',
    'Iron Fist',
    'Habe 5 Schiffe außer Jägern in einem System.',
    'Have 5 non-fighter ships in one system.',
  ),
  'swarm-doctrine': text(
    'Schwarmdoktrin',
    'Swarm Doctrine',
    'Habe 8 Jäger auf dem Spielplan.',
    'Have 8 fighters on the board.',
  ),
  'scholar-worlds': text(
    'Gelehrtenwelten',
    'Scholar Worlds',
    'Kontrolliere Planeten mit 3 verschiedenen Spezialisierungen.',
    'Control planets with 3 different specialties.',
  ),
  hoarder: text('Hortung', 'Hoarder', 'Besitze 10 Handelswaren.', 'Hold 10 trade goods.'),
  'at-the-gates': text(
    'Vor den Toren',
    'At the Gates',
    'Habe Schiffe im Heimatsystem eines anderen Spielers.',
    "Have ships in another player's home system.",
  ),
  foothold: text(
    'Brückenkopf',
    'Foothold',
    'Kontrolliere einen Planeten im Heimatsystem eines anderen Spielers.',
    "Control a planet in another player's home system.",
  ),
  'crowned-world': text(
    'Gekrönte Welt',
    'Crowned World',
    'Kontrolliere die Thronwelt.',
    'Control the throne world.',
  ),
  'grand-fleet': text(
    'Große Flotte',
    'Grand Fleet',
    'Habe 5 Marker in deinem Flottenpool.',
    'Have 5 tokens in your fleet pool.',
  ),
  'long-reach': text(
    'Langer Arm',
    'Long Reach',
    'Habe Kommandomarker in 6 Systemen.',
    'Have command tokens in 6 systems.',
  ),
  'fleet-breaker': text(
    'Flottenbrecher',
    'Fleet Breaker',
    'Gewinne in dieser Runde 2 Raumkämpfe.',
    'Win 2 space combats this round.',
  ),
  'bloody-harvest': text(
    'Blutige Ernte',
    'Bloody Harvest',
    'Zerstöre in dieser Runde 5 gegnerische Schiffe.',
    'Destroy 5 enemy ships this round.',
  ),
  'lightning-campaign': text(
    'Blitzfeldzug',
    'Lightning Campaign',
    'Erobere in dieser Runde 3 Planeten.',
    'Gain control of 3 planets this round.',
  ),
  'boots-on-ground': text(
    'Stiefel am Boden',
    'Boots on the Ground',
    'Gewinne in dieser Runde einen Bodenkampf.',
    'Win a ground combat this round.',
  ),
};

export const objectiveText = (id: string): ObjectiveText | undefined => OBJECTIVE_TEXTS[id];
