import {
  factionId,
  type CommanderDefinition,
  type LeaderDefinition,
  leaderId,
  type RewardEffect,
  type UnlockCondition,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES as U } from './units.ts';

/*
 * Eigene Anführer (Erweiterung Schritt 3): je Fraktion ein Agent, ein Kommandant und ein Held.
 * Agenten und Helden nutzen die Belohnungen der Erkundung, Kommandanten wirken wie eine
 * weitere Fraktionsfähigkeit. Namen, Texte und Wirkungen sind eigene Entwürfe.
 */
const ONE = 1;
const TWO = 2;
const THREE = 3;
const FOUR = 4;
const SIX = 6;
const EIGHT = 8;

const agent = (faction: string, id: string, action: readonly RewardEffect[]): LeaderDefinition => ({
  id: leaderId(id),
  faction: factionId(faction),
  kind: 'agent',
  action,
});

const commander = (
  faction: string,
  id: string,
  unlock: UnlockCondition,
  passive: CommanderDefinition['passive'],
): LeaderDefinition => ({
  id: leaderId(id),
  faction: factionId(faction),
  kind: 'commander',
  unlock,
  passive,
});

const hero = (faction: string, id: string, action: readonly RewardEffect[]): LeaderDefinition => ({
  id: leaderId(id),
  faction: factionId(faction),
  kind: 'hero',
  action,
});

const rules = (values: CommanderDefinition['passive']['rules']) => ({
  modifiers: [],
  rules: values,
});

const AUREL: readonly LeaderDefinition[] = [
  agent('aurel', 'ilka-brenn', [{ kind: 'repairUnits' }, { kind: 'gainTradeGoods', amount: ONE }]),
  commander(
    'aurel',
    'seraphine-kord',
    { kind: 'controlPlanets', count: SIX },
    rules({ statusTradeGoods: ONE }),
  ),
  hero('aurel', 'aurelian-voss', [
    { kind: 'readyPlanets' },
    { kind: 'gainTradeGoods', amount: THREE },
  ]),
];

const ORUN: readonly LeaderDefinition[] = [
  agent('orun', 'thessa-of-the-hollow', [{ kind: 'drawActionCards', count: ONE }]),
  commander(
    'orun',
    'keeper-maru',
    { kind: 'controlPlanets', count: FOUR, trait: 'cultural' },
    rules({ extraVotes: TWO }),
  ),
  hero('orun', 'the-first-chorus', [
    { kind: 'drawActionCards', count: THREE },
    { kind: 'gainCommandTokens', amount: TWO },
  ]),
];

const SEL: readonly LeaderDefinition[] = [
  agent('sel', 'yara-fenn', [{ kind: 'gainCommodities', amount: TWO }]),
  commander(
    'sel',
    'odo-lark',
    { kind: 'ownTechnologies', count: FOUR },
    rules({ freeSecondaries: ['technology'] }),
  ),
  hero('sel', 'mira-goldhand', [
    { kind: 'gainTradeGoods', amount: FOUR },
    { kind: 'gainCommodities', amount: THREE },
  ]),
];

const KARTH: readonly LeaderDefinition[] = [
  agent('karth', 'sergeant-brakk', [{ kind: 'gainCommandTokens', amount: ONE }]),
  commander(
    'karth',
    'varga-thorn',
    { kind: 'unitsOnBoard', unit: U.dreadnought, count: THREE },
    { modifiers: [], rules: {}, deploy: { unit: U.infantry, trigger: { kind: 'planetCaptured' } } },
  ),
  hero('karth', 'hetman-dorn', [
    { kind: 'gainCommandTokens', amount: THREE },
    { kind: 'placeUnits', unit: U.infantry, count: THREE },
  ]),
];

const NESH: readonly LeaderDefinition[] = [
  agent('nesh', 'liv-arden', [{ kind: 'gainRelicFragments', fragment: 'frontier', count: ONE }]),
  commander(
    'nesh',
    'ione-sarr',
    { kind: 'controlSpecialPlanets', count: ONE },
    {
      modifiers: [
        {
          target: { types: [U.orbitalBattery] },
          change: { capability: { kind: 'spaceCannon', hitOn: -ONE } },
        },
      ],
      rules: {},
    },
  ),
  hero('nesh', 'the-last-lighthouse', [
    { kind: 'gainRelicFragments', fragment: 'frontier', count: THREE },
    { kind: 'drawActionCards', count: ONE },
  ]),
];

const QUEL: readonly LeaderDefinition[] = [
  agent('quel', 'brood-mother-kesh', [{ kind: 'placeUnits', unit: U.infantry, count: TWO }]),
  commander(
    'quel',
    'swarm-mind-vir',
    { kind: 'unitsOnBoard', unit: U.fighter, count: EIGHT },
    { modifiers: [{ target: { types: [U.carrier] }, change: { capacity: ONE } }], rules: {} },
  ),
  hero('quel', 'queen-ixa', [
    { kind: 'placeUnits', unit: U.infantry, count: FOUR },
    { kind: 'placeUnits', unit: U.mech, count: ONE },
    { kind: 'repairUnits' },
  ]),
];

/** Alle Anführer, je Fraktion in der Reihenfolge Agent, Kommandant, Held. */
export const LEADERS: readonly LeaderDefinition[] = [
  ...AUREL,
  ...ORUN,
  ...SEL,
  ...KARTH,
  ...NESH,
  ...QUEL,
];

export interface LeaderText {
  readonly name: LocalizedText;
  readonly effect: LocalizedText;
  /** Freischaltbedingung von Kommandanten und Helden. */
  readonly unlock?: LocalizedText;
}

const HERO_UNLOCK: LocalizedText = {
  de: 'Frei, sobald du mindestens 3 Aufträge gewertet hast.',
  en: 'Unlocked once you have scored at least 3 objectives.',
};

const text = (name: LocalizedText, effect: LocalizedText, unlock?: LocalizedText): LeaderText =>
  unlock === undefined ? { name, effect } : { name, effect, unlock };

const heroText = (name: LocalizedText, effect: LocalizedText) => text(name, effect, HERO_UNLOCK);

export const LEADER_TEXTS: Readonly<Record<string, LeaderText>> = {
  'ilka-brenn': text(
    { de: 'Werftmeisterin Ilka Brenn', en: 'Shipwright Ilka Brenn' },
    {
      de: 'Agent – Aktion: Repariere alle deine beschädigten Einheiten und erhalte 1 Handelsware. Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Repair all of your damaged units and gain 1 trade good. Then exhausted until the status phase.',
    },
  ),
  'seraphine-kord': text(
    { de: 'Admiralin Seraphine Kord', en: 'Admiral Seraphine Kord' },
    {
      de: 'Kommandant: In jeder Statusphase erhältst du 1 Handelsware zusätzlich.',
      en: 'Commander: In every status phase you gain 1 additional trade good.',
    },
    { de: 'Frei, sobald du 6 Planeten kontrollierst.', en: 'Unlocked once you control 6 planets.' },
  ),
  'aurelian-voss': heroText(
    { de: 'Kanzler Aurelian Voss', en: 'Chancellor Aurelian Voss' },
    {
      de: 'Held – Aktion: Mache alle deine Planeten bereit und erhalte 3 Handelswaren. Danach ist er aus dem Spiel.',
      en: 'Hero – Action: Ready all of your planets and gain 3 trade goods. Then he is removed from the game.',
    },
  ),
  'thessa-of-the-hollow': text(
    { de: 'Thessa aus der Tiefe', en: 'Thessa of the Hollow' },
    {
      de: 'Agent – Aktion: Ziehe 1 Aktionskarte. Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Draw 1 action card. Then exhausted until the status phase.',
    },
  ),
  'keeper-maru': text(
    { de: 'Hüter Maru', en: 'Keeper Maru' },
    {
      de: 'Kommandant: Wenn du für ein Ergebnis stimmst, gibst du 2 Stimmen zusätzlich ab.',
      en: 'Commander: When you vote for an outcome, you cast 2 additional votes.',
    },
    {
      de: 'Frei, sobald du 4 kulturelle Planeten kontrollierst.',
      en: 'Unlocked once you control 4 cultural planets.',
    },
  ),
  'the-first-chorus': heroText(
    { de: 'Der Erste Chor', en: 'The First Chorus' },
    {
      de: 'Held – Aktion: Ziehe 3 Aktionskarten und lege 2 Kommandomarker aus deinem Nachschub in deinen Taktikpool. Danach aus dem Spiel.',
      en: 'Hero – Action: Draw 3 action cards and place 2 command tokens from your reinforcements in your tactic pool. Then removed from the game.',
    },
  ),
  'yara-fenn': text(
    { de: 'Maklerin Yara Fenn', en: 'Broker Yara Fenn' },
    {
      de: 'Agent – Aktion: Erhalte 2 Rohstoffe (höchstens bis zu deinem Rohstofflimit). Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Gain 2 commodities (up to your commodity limit). Then exhausted until the status phase.',
    },
  ),
  'odo-lark': text(
    { de: 'Schatzmeister Odo Lark', en: 'Treasurer Odo Lark' },
    {
      de: 'Kommandant: Die Sekundärfähigkeit der Technologie kostet dich keinen Strategiemarker.',
      en: 'Commander: The secondary ability of Technology costs you no strategy token.',
    },
    {
      de: 'Frei, sobald du 4 Technologien besitzt.',
      en: 'Unlocked once you own 4 technologies.',
    },
  ),
  'mira-goldhand': heroText(
    { de: 'Großhändlerin Mira Goldhand', en: 'Merchant Princess Mira Goldhand' },
    {
      de: 'Held – Aktion: Erhalte 4 Handelswaren und 3 Rohstoffe (höchstens bis zu deinem Rohstofflimit). Danach aus dem Spiel.',
      en: 'Hero – Action: Gain 4 trade goods and 3 commodities (up to your commodity limit). Then removed from the game.',
    },
  ),
  'sergeant-brakk': text(
    { de: 'Feldwebel Brakk', en: 'Sergeant Brakk' },
    {
      de: 'Agent – Aktion: Lege 1 Kommandomarker aus deinem Nachschub in deinen Taktikpool. Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Place 1 command token from your reinforcements in your tactic pool. Then exhausted until the status phase.',
    },
  ),
  'varga-thorn': text(
    { de: 'Marschall Varga Thorn', en: 'Marshal Varga Thorn' },
    {
      de: 'Kommandant: Übernimmst du bei einem Einmarsch einen Planeten, den ein anderer Spieler kontrolliert hat, kommt 1 Infanterie aus deiner Verstärkung kostenlos auf diesen Planeten.',
      en: 'Commander: When you take over a planet another player controlled during an invasion, 1 infantry from your reinforcements is placed on that planet for free.',
    },
    {
      de: 'Frei, sobald du 3 Schlachtschiffe auf dem Spielplan hast.',
      en: 'Unlocked once you have 3 dreadnoughts on the board.',
    },
  ),
  'hetman-dorn': heroText(
    { de: 'Hetman Dorn', en: 'Hetman Dorn' },
    {
      de: 'Held – Aktion: Lege 3 Kommandomarker aus deinem Nachschub in deinen Taktikpool und setze 3 Infanterie auf deinen Heimatplaneten. Danach aus dem Spiel.',
      en: 'Hero – Action: Place 3 command tokens from your reinforcements in your tactic pool and place 3 infantry on your home planet. Then removed from the game.',
    },
  ),
  'liv-arden': text(
    { de: 'Kartografin Liv Arden', en: 'Cartographer Liv Arden' },
    {
      de: 'Agent – Aktion: Erhalte 1 Grenzfragment (zählt als Fragment jeder Art). Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Gain 1 frontier fragment (counts as any kind). Then exhausted until the status phase.',
    },
  ),
  'ione-sarr': text(
    { de: 'Sternwärterin Ione Sarr', en: 'Star Warden Ione Sarr' },
    {
      de: 'Kommandant: Die Weltraumkanone deiner Orbitalbatterien trifft bei einem um 1 niedrigeren Wurf.',
      en: 'Commander: The space cannon of your PDS hits on a roll 1 lower.',
    },
    {
      de: 'Frei, sobald du einen Planeten im Zentrum oder einen legendären Planeten kontrollierst.',
      en: 'Unlocked once you control a planet in the center or a legendary planet.',
    },
  ),
  'the-last-lighthouse': heroText(
    { de: 'Der Letzte Leuchtturm', en: 'The Last Lighthouse' },
    {
      de: 'Held – Aktion: Erhalte 3 Grenzfragmente und ziehe 1 Aktionskarte. Danach aus dem Spiel.',
      en: 'Hero – Action: Gain 3 frontier fragments and draw 1 action card. Then removed from the game.',
    },
  ),
  'brood-mother-kesh': text(
    { de: 'Brutmutter Kesh', en: 'Brood Mother Kesh' },
    {
      de: 'Agent – Aktion: Setze 2 Infanterie aus deiner Verstärkung auf deinen Heimatplaneten. Danach erschöpft bis zur Statusphase.',
      en: 'Agent – Action: Place 2 infantry from your reinforcements on your home planet. Then exhausted until the status phase.',
    },
  ),
  'swarm-mind-vir': text(
    { de: 'Schwarmgeist Vir', en: 'Swarm Mind Vir' },
    {
      de: 'Kommandant: Deine Träger haben Kapazität +1.',
      en: 'Commander: Your carriers have +1 capacity.',
    },
    {
      de: 'Frei, sobald du 8 Jäger auf dem Spielplan hast.',
      en: 'Unlocked once you have 8 fighters on the board.',
    },
  ),
  'queen-ixa': heroText(
    { de: 'Königin Ixa', en: 'Queen Ixa' },
    {
      de: 'Held – Aktion: Setze 4 Infanterie und 1 Mech auf deinen Heimatplaneten und repariere alle deine Einheiten. Danach aus dem Spiel.',
      en: 'Hero – Action: Place 4 infantry and 1 mech on your home planet and repair all of your units. Then removed from the game.',
    },
  ),
};

export const leaderText = (id: string): LeaderText | undefined => LEADER_TEXTS[id];
