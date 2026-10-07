import {
  type AgendaDefinition,
  type AgendaEffect,
  agendaId,
  type AgendaStep,
  type Election,
  type LawEffect,
  type Recipients,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigener Agendasatz des Sternenrats: 9 Gesetze und 15 Direktiven. Namen, Wirkungen
 * und Texte sind eigene Entwürfe; nur der Ablauf der Abstimmung folgt dem Regelwerk.
 */
const FOR_AGAINST: Election = { kind: 'forAgainst' };
const PLAYER: Election = { kind: 'player' };
const ANY_PLANET: Election = { kind: 'planet', filter: { kind: 'any' } };
const OUTER_PLANET: Election = { kind: 'planet', filter: { kind: 'nonHome' } };

const step = (recipients: Recipients, effect: AgendaEffect): AgendaStep => ({
  recipients,
  effect,
});

const law = (
  id: string,
  election: Election,
  effect: LawEffect,
  rejected: readonly AgendaStep[] = [],
): AgendaDefinition => ({
  id: agendaId(id),
  kind: 'law',
  election,
  passed: { steps: [], law: effect },
  rejected,
});

const directive = (
  id: string,
  election: Election,
  passed: readonly AgendaStep[],
  rejected: readonly AgendaStep[] = [],
): AgendaDefinition => ({
  id: agendaId(id),
  kind: 'directive',
  election,
  passed: { steps: passed },
  rejected,
});

const ONE = 1;
const TWO = 2;
const THREE = 3;

export const AGENDAS: readonly AgendaDefinition[] = [
  law('trade-charter', FOR_AGAINST, { kind: 'commodityLimitAll', delta: ONE }, [
    step('supporters', { kind: 'gainTradeGoods', amount: ONE }),
  ]),
  law('card-quota', FOR_AGAINST, { kind: 'ruleChange', rule: 'actionCardHandLimit', delta: -TWO }, [
    step('all', { kind: 'drawActionCards', count: ONE }),
  ]),
  law('extended-briefings', FOR_AGAINST, {
    kind: 'ruleChange',
    rule: 'statusPhaseActionCards',
    delta: ONE,
  }),
  law(
    'command-reform',
    FOR_AGAINST,
    { kind: 'ruleChange', rule: 'statusPhaseCommandTokens', delta: ONE },
    [step('opponents', { kind: 'loseCommandTokens', pool: 'strategy', amount: ONE })],
  ),
  law('nebula-corridors', FOR_AGAINST, {
    kind: 'ruleChange',
    rule: 'nebulaMoveValue',
    delta: ONE,
  }),
  law(
    'sealed-archive',
    FOR_AGAINST,
    { kind: 'ruleChange', rule: 'maxSecretObjectives', delta: ONE },
    [step('opponents', { kind: 'loseTradeGoods', amount: ONE })],
  ),
  law('council-seat', PLAYER, { kind: 'ownerVotes', amount: TWO }),
  law('star-chancellor', PLAYER, { kind: 'ownerVictoryPoints', amount: ONE }),
  law('merchant-guild', PLAYER, { kind: 'ownerCommodityLimit', amount: TWO }),
  directive(
    'stimulus-package',
    FOR_AGAINST,
    [step('all', { kind: 'gainTradeGoods', amount: TWO })],
    [step('all', { kind: 'replenishCommodities' })],
  ),
  directive(
    'audit',
    FOR_AGAINST,
    [step('all', { kind: 'loseTradeGoods', amount: TWO })],
    [step('supporters', { kind: 'gainTradeGoods', amount: ONE })],
  ),
  directive('medal-of-honor', PLAYER, [
    step('elected', { kind: 'gainVictoryPoints', amount: ONE }),
  ]),
  directive('data-leak', PLAYER, [step('elected', { kind: 'drawActionCards', count: THREE })]),
  directive('secret-mandate', PLAYER, [step('elected', { kind: 'drawSecretObjective' })]),
  directive(
    'general-mobilization',
    FOR_AGAINST,
    [step('all', { kind: 'gainCommandTokens', pool: 'tactic', amount: ONE })],
    [step('opponents', { kind: 'loseCommandTokens', pool: 'fleet', amount: ONE })],
  ),
  directive(
    'grid-failure',
    FOR_AGAINST,
    [step('all', { kind: 'exhaustPlanets', trait: 'industrial' })],
    [step('all', { kind: 'exhaustPlanets', trait: 'cultural' })],
  ),
  directive('colonial-survey', OUTER_PLANET, [
    step('elected', {
      kind: 'placeUnits',
      unit: UNIT_TYPES.infantry,
      count: TWO,
      where: 'electedPlanet',
    }),
  ]),
  directive('orbital-cleanup', ANY_PLANET, [step('speaker', { kind: 'destroyStructures' })]),
  directive(
    'amnesty',
    FOR_AGAINST,
    [step('all', { kind: 'drawActionCards', count: ONE })],
    [step('all', { kind: 'discardActionCards', count: ONE })],
  ),
  directive('reparations', PLAYER, [
    step('elected', { kind: 'gainTradeGoods', amount: THREE }),
    step('elected', { kind: 'replenishCommodities' }),
  ]),
  directive('constitutional-reform', FOR_AGAINST, [step('speaker', { kind: 'repealLaws' })]),
  directive('conscription', PLAYER, [
    step('elected', {
      kind: 'placeUnits',
      unit: UNIT_TYPES.infantry,
      count: THREE,
      where: 'homeSystem',
    }),
  ]),
  directive(
    'fleet-review',
    FOR_AGAINST,
    [step('all', { kind: 'repairUnits' })],
    [step('opponents', { kind: 'gainCommandTokens', pool: 'fleet', amount: ONE })],
  ),
  directive('tribunal', PLAYER, [step('elected', { kind: 'discardActionCards', count: null })]),
];

export interface AgendaText {
  readonly name: LocalizedText;
  /** Was bei „Dafür“ bzw. für den Gewählten geschieht. */
  readonly passed: LocalizedText;
  /** Was bei „Dagegen“ geschieht; leer, wenn nichts. */
  readonly rejected: LocalizedText;
}

const NOTHING: LocalizedText = { de: 'Nichts geschieht.', en: 'Nothing happens.' };

const text = (
  name: LocalizedText,
  passed: LocalizedText,
  rejected: LocalizedText = NOTHING,
): AgendaText => ({ name, passed, rejected });

export const AGENDA_TEXTS: Readonly<Record<string, AgendaText>> = {
  'trade-charter': text(
    { de: 'Handelscharta', en: 'Trade Charter' },
    {
      de: 'Gesetz: Das Rohstofflimit jedes Spielers steigt um 1.',
      en: 'Law: Every player’s commodity limit rises by 1.',
    },
    {
      de: 'Wer dagegen gestimmt hat, erhält 1 Handelsware.',
      en: 'Each player who voted against gains 1 trade good.',
    },
  ),
  'card-quota': text(
    { de: 'Kartenkontingent', en: 'Card Quota' },
    {
      de: 'Gesetz: Das Handkartenlimit für Aktionskarten sinkt um 2.',
      en: 'Law: The action card hand limit drops by 2.',
    },
    { de: 'Jeder Spieler zieht 1 Aktionskarte.', en: 'Each player draws 1 action card.' },
  ),
  'extended-briefings': text(
    { de: 'Erweiterte Lagebesprechung', en: 'Extended Briefings' },
    {
      de: 'Gesetz: In jeder Statusphase zieht jeder Spieler 1 Aktionskarte mehr.',
      en: 'Law: In every status phase each player draws 1 more action card.',
    },
  ),
  'command-reform': text(
    { de: 'Kommandoreform', en: 'Command Reform' },
    {
      de: 'Gesetz: In jeder Statusphase erhält jeder Spieler 1 Kommandomarker mehr.',
      en: 'Law: In every status phase each player gains 1 more command token.',
    },
    {
      de: 'Wer dafür gestimmt hat, verliert 1 Marker aus seinem Strategiepool.',
      en: 'Each player who voted for loses 1 token from their strategy pool.',
    },
  ),
  'nebula-corridors': text(
    { de: 'Nebelkorridore', en: 'Nebula Corridors' },
    {
      de: 'Gesetz: Schiffe, die in einem Nebel starten, haben Bewegung 2.',
      en: 'Law: Ships that start in a nebula have move 2.',
    },
  ),
  'sealed-archive': text(
    { de: 'Versiegeltes Archiv', en: 'Sealed Archive' },
    {
      de: 'Gesetz: Jeder Spieler darf 1 geheimen Auftrag mehr besitzen.',
      en: 'Law: Each player may hold 1 more secret objective.',
    },
    {
      de: 'Wer dafür gestimmt hat, verliert 1 Handelsware.',
      en: 'Each player who voted for loses 1 trade good.',
    },
  ),
  'council-seat': text(
    { de: 'Ratssitz', en: 'Council Seat' },
    {
      de: 'Gesetz: Wähle einen Spieler. Er gibt bei jeder späteren Abstimmung 2 Stimmen zusätzlich ab.',
      en: 'Law: Elect a player. They cast 2 additional votes in every later vote.',
    },
  ),
  'star-chancellor': text(
    { de: 'Sternkanzler', en: 'Star Chancellor' },
    {
      de: 'Gesetz: Wähle einen Spieler. Er erhält 1 Siegpunkt, solange dieses Gesetz gilt.',
      en: 'Law: Elect a player. They gain 1 victory point while this law stands.',
    },
  ),
  'merchant-guild': text(
    { de: 'Händlergilde', en: 'Merchant Guild' },
    {
      de: 'Gesetz: Wähle einen Spieler. Sein Rohstofflimit steigt um 2.',
      en: 'Law: Elect a player. Their commodity limit rises by 2.',
    },
  ),
  'stimulus-package': text(
    { de: 'Konjunkturpaket', en: 'Stimulus Package' },
    { de: 'Jeder Spieler erhält 2 Handelswaren.', en: 'Each player gains 2 trade goods.' },
    {
      de: 'Jeder Spieler füllt seine Rohstoffe auf.',
      en: 'Each player refills their commodities.',
    },
  ),
  audit: text(
    { de: 'Rechnungsprüfung', en: 'Audit' },
    {
      de: 'Jeder Spieler verliert bis zu 2 Handelswaren.',
      en: 'Each player loses up to 2 trade goods.',
    },
    {
      de: 'Wer dagegen gestimmt hat, erhält 1 Handelsware.',
      en: 'Each player who voted against gains 1 trade good.',
    },
  ),
  'medal-of-honor': text(
    { de: 'Ehrenmedaille', en: 'Medal of Honor' },
    {
      de: 'Wähle einen Spieler. Er erhält 1 Siegpunkt.',
      en: 'Elect a player. They gain 1 victory point.',
    },
  ),
  'data-leak': text(
    { de: 'Datenleck', en: 'Data Leak' },
    {
      de: 'Wähle einen Spieler. Er zieht 3 Aktionskarten.',
      en: 'Elect a player. They draw 3 action cards.',
    },
  ),
  'secret-mandate': text(
    { de: 'Geheimmandat', en: 'Secret Mandate' },
    {
      de: 'Wähle einen Spieler. Er zieht 1 geheimen Auftrag.',
      en: 'Elect a player. They draw 1 secret objective.',
    },
  ),
  'general-mobilization': text(
    { de: 'Generalmobilmachung', en: 'General Mobilization' },
    {
      de: 'Jeder Spieler legt 1 Marker aus seinem Nachschub in seinen Taktikpool.',
      en: 'Each player places 1 token from reinforcements into their tactic pool.',
    },
    {
      de: 'Wer dafür gestimmt hat, verliert 1 Marker aus seinem Flottenpool.',
      en: 'Each player who voted for loses 1 token from their fleet pool.',
    },
  ),
  'grid-failure': text(
    { de: 'Netzausfall', en: 'Grid Failure' },
    {
      de: 'Jeder Spieler erschöpft seine industriellen Planeten.',
      en: 'Each player exhausts their industrial planets.',
    },
    {
      de: 'Jeder Spieler erschöpft seine kulturellen Planeten.',
      en: 'Each player exhausts their cultural planets.',
    },
  ),
  'colonial-survey': text(
    { de: 'Kolonialvermessung', en: 'Colonial Survey' },
    {
      de: 'Wähle einen Planeten außerhalb der Heimatsysteme. Sein Besitzer setzt 2 Infanterie darauf.',
      en: 'Elect a planet outside the home systems. Its controller places 2 infantry on it.',
    },
  ),
  'orbital-cleanup': text(
    { de: 'Orbitale Säuberung', en: 'Orbital Cleanup' },
    {
      de: 'Wähle einen Planeten. Alle Gebäude darauf werden zerstört.',
      en: 'Elect a planet. All structures on it are destroyed.',
    },
  ),
  amnesty: text(
    { de: 'Amnestie', en: 'Amnesty' },
    { de: 'Jeder Spieler zieht 1 Aktionskarte.', en: 'Each player draws 1 action card.' },
    {
      de: 'Jeder Spieler wirft 1 zufällige Aktionskarte ab.',
      en: 'Each player discards 1 random action card.',
    },
  ),
  reparations: text(
    { de: 'Reparationen', en: 'Reparations' },
    {
      de: 'Wähle einen Spieler. Er erhält 3 Handelswaren und füllt seine Rohstoffe auf.',
      en: 'Elect a player. They gain 3 trade goods and refill their commodities.',
    },
  ),
  'constitutional-reform': text(
    { de: 'Verfassungsreform', en: 'Constitutional Reform' },
    {
      de: 'Alle geltenden Gesetze werden aufgehoben und abgelegt.',
      en: 'All laws in force are repealed and discarded.',
    },
  ),
  conscription: text(
    { de: 'Wehrpflicht', en: 'Conscription' },
    {
      de: 'Wähle einen Spieler. Er setzt 3 Infanterie auf einen Planeten seines Heimatsystems.',
      en: 'Elect a player. They place 3 infantry on a planet in their home system.',
    },
  ),
  'fleet-review': text(
    { de: 'Flottenschau', en: 'Fleet Review' },
    {
      de: 'Jeder Spieler repariert alle seine Einheiten.',
      en: 'Each player repairs all their units.',
    },
    {
      de: 'Wer dafür gestimmt hat, legt 1 Marker aus seinem Nachschub in seinen Flottenpool.',
      en: 'Each player who voted for places 1 token from reinforcements into their fleet pool.',
    },
  ),
  tribunal: text(
    { de: 'Tribunal', en: 'Tribunal' },
    {
      de: 'Wähle einen Spieler. Er wirft alle Aktionskarten ab.',
      en: 'Elect a player. They discard all of their action cards.',
    },
  ),
};

export const agendaText = (id: string): AgendaText | undefined => AGENDA_TEXTS[id];
