import {
  type ActionCardDefinition,
  type ActionEffect,
  actionCardId,
  type ActionTiming,
} from '@stellar/domain';
import type { LocalizedText } from './localized.ts';
import { UNIT_TYPES } from './units.ts';

/*
 * Eigener Aktionskartensatz: 19 Karten in 49 Exemplaren. Zwölf sind Materialaktionen
 * (RR 51), sieben Reaktionen in Zeitfenstern. Namen und Texte sind eigene Entwürfe.
 */
const card = (
  id: string,
  copies: number,
  timing: ActionTiming,
  effect: ActionEffect,
): ActionCardDefinition => ({ id: actionCardId(id), copies, timing, effect });

const TWO = 2;
const THREE = 3;
const FOUR = 4;

export const ACTION_CARDS: readonly ActionCardDefinition[] = [
  card('black-market', THREE, 'action', { kind: 'gainTradeGoods', amount: THREE }),
  card('supply-convoy', TWO, 'action', { kind: 'replenishCommodities' }),
  card('reactivation', THREE, 'action', { kind: 'readyPlanets', count: TWO }),
  card('command-reserve', THREE, 'action', { kind: 'gainCommandTokens', amount: 1 }),
  card('recall', THREE, 'action', { kind: 'recallToken' }),
  card('recruitment', TWO, 'action', {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: TWO,
    where: 'homePlanet',
  }),
  card('intelligence', TWO, 'action', { kind: 'drawActionCards', count: TWO }),
  card('unrest', TWO, 'action', { kind: 'exhaustForeignPlanet' }),
  card('letter-of-marque', TWO, 'action', { kind: 'stealTradeGoods', amount: TWO }),
  card('commando-raid', TWO, 'action', { kind: 'destroyGroundForce', count: 1 }),
  card('dock-shift', TWO, 'action', { kind: 'repairUnits' }),
  card('trade-mission', TWO, 'action', { kind: 'tradeGoodsPerNeighbor', amount: 1 }),
  card('counterplay', FOUR, 'cancel', { kind: 'cancelCard' }),
  card('mobilization', THREE, 'afterActivation', {
    kind: 'placeUnits',
    unit: UNIT_TYPES.infantry,
    count: 1,
    where: 'activatedPlanet',
  }),
  card('combat-drill', FOUR, 'combatRound', { kind: 'combatBonus', amount: 1 }),
  card('evasive-maneuvers', THREE, 'afterHits', { kind: 'cancelHits', amount: 1 }),
  card('entrenchment', TWO, 'invasion', { kind: 'groundBonus', amount: 1, role: 'defender' }),
  card('landing-drill', TWO, 'invasion', { kind: 'groundBonus', amount: 1, role: 'attacker' }),
  card('free-rider', THREE, 'secondary', { kind: 'freeSecondary' }),
];

export interface ActionCardText {
  readonly name: LocalizedText;
  /** Zeitpunkt (RR 3.6: erster Absatz der Karte). */
  readonly timing: LocalizedText;
  readonly effect: LocalizedText;
}

const ACTION: LocalizedText = { de: 'Aktion', en: 'Action' };

const text = (name: LocalizedText, timing: LocalizedText, effect: LocalizedText) => ({
  name,
  timing,
  effect,
});

export const ACTION_CARD_TEXTS: Readonly<Record<string, ActionCardText>> = {
  'black-market': text({ de: 'Schwarzmarkt', en: 'Black Market' }, ACTION, {
    de: 'Erhalte 3 Handelswaren.',
    en: 'Gain 3 trade goods.',
  }),
  'supply-convoy': text({ de: 'Nachschubkonvoi', en: 'Supply Convoy' }, ACTION, {
    de: 'Fülle deine Rohstoffe bis zum Limit auf.',
    en: 'Refill your commodities up to your limit.',
  }),
  reactivation: text({ de: 'Reaktivierung', en: 'Reactivation' }, ACTION, {
    de: 'Mache bis zu 2 deiner erschöpften Planeten bereit.',
    en: 'Ready up to 2 of your exhausted planets.',
  }),
  'command-reserve': text({ de: 'Kommandoreserve', en: 'Command Reserve' }, ACTION, {
    de: 'Erhalte 1 Kommandomarker und lege ihn in einen Pool deiner Wahl.',
    en: 'Gain 1 command token and place it in a pool of your choice.',
  }),
  recall: text({ de: 'Rückruf', en: 'Recall' }, ACTION, {
    de: 'Nimm 1 deiner Kommandomarker vom Spielplan und lege ihn in deinen Taktikpool.',
    en: 'Take 1 of your command tokens off the board and place it in your tactic pool.',
  }),
  recruitment: text({ de: 'Rekrutierung', en: 'Recruitment' }, ACTION, {
    de: 'Setze 2 Infanterie auf einen Planeten deines Heimatsystems, den du kontrollierst.',
    en: 'Place 2 infantry on a planet you control in your home system.',
  }),
  intelligence: text({ de: 'Geheimdienst', en: 'Intelligence Network' }, ACTION, {
    de: 'Ziehe 2 Aktionskarten.',
    en: 'Draw 2 action cards.',
  }),
  unrest: text({ de: 'Aufruhr', en: 'Unrest' }, ACTION, {
    de: 'Erschöpfe 1 Planeten eines anderen Spielers außerhalb seines Heimatsystems.',
    en: "Exhaust 1 planet of another player outside that player's home system.",
  }),
  'letter-of-marque': text({ de: 'Kaperbrief', en: 'Letter of Marque' }, ACTION, {
    de: 'Nimm einem Nachbarn bis zu 2 seiner Handelswaren ab.',
    en: 'Take up to 2 trade goods from a neighbour.',
  }),
  'commando-raid': text({ de: 'Sabotagetrupp', en: 'Commando Raid' }, ACTION, {
    de: 'Zerstöre 1 fremde Bodentruppe auf einem Planeten in einem System mit deinen Schiffen.',
    en: 'Destroy 1 enemy ground force on a planet in a system that contains your ships.',
  }),
  'dock-shift': text({ de: 'Werftschicht', en: 'Dock Shift' }, ACTION, {
    de: 'Repariere alle deine beschädigten Einheiten.',
    en: 'Repair all of your damaged units.',
  }),
  'trade-mission': text({ de: 'Handelsmission', en: 'Trade Mission' }, ACTION, {
    de: 'Erhalte 1 Handelsware für jeden deiner Nachbarn.',
    en: 'Gain 1 trade good for each of your neighbours.',
  }),
  counterplay: text(
    { de: 'Gegenspiel', en: 'Counterplay' },
    {
      de: 'Wenn ein anderer Spieler eine Aktionskarte spielt',
      en: 'When another player plays an action card',
    },
    { de: 'Die Karte bleibt ohne Wirkung.', en: 'That card has no effect.' },
  ),
  mobilization: text(
    { de: 'Mobilmachung', en: 'Mobilization' },
    {
      de: 'Nachdem ein anderer Spieler ein System mit einem deiner Planeten aktiviert hat',
      en: 'After another player activates a system containing one of your planets',
    },
    { de: 'Setze 1 Infanterie auf diesen Planeten.', en: 'Place 1 infantry on that planet.' },
  ),
  'combat-drill': text(
    { de: 'Gefechtsdrill', en: 'Combat Drill' },
    {
      de: 'Zu Beginn einer Raumkampfrunde, an der du beteiligt bist',
      en: 'At the start of a space combat round you take part in',
    },
    {
      de: '+1 auf alle deine Kampfwürfe in dieser Runde.',
      en: '+1 to all of your combat rolls this round.',
    },
  ),
  'evasive-maneuvers': text(
    { de: 'Ausweichmanöver', en: 'Evasive Maneuvers' },
    {
      de: 'Nachdem Treffer gegen deine Schiffe erzielt wurden',
      en: 'After hits are produced against your ships',
    },
    { de: 'Wende 1 dieser Treffer ab.', en: 'Prevent 1 of those hits.' },
  ),
  entrenchment: text(
    { de: 'Verschanzung', en: 'Entrenchment' },
    {
      de: 'Zu Beginn eines Einmarschs in ein System mit deinen Bodentruppen',
      en: 'At the start of an invasion of a system with your ground forces',
    },
    {
      de: '+1 auf deine Bodenkampfwürfe während dieses Einmarschs.',
      en: '+1 to your ground combat rolls during this invasion.',
    },
  ),
  'landing-drill': text(
    { de: 'Landungsdrill', en: 'Landing Drill' },
    { de: 'Zu Beginn deines Einmarschs', en: 'At the start of your invasion' },
    {
      de: '+1 auf deine Bodenkampfwürfe während dieses Einmarschs.',
      en: '+1 to your ground combat rolls during this invasion.',
    },
  ),
  'free-rider': text(
    { de: 'Trittbrettfahrer', en: 'Free Rider' },
    {
      de: 'Wenn du die Sekundärfähigkeit einer Strategiekarte nutzen darfst',
      en: "When you may use a strategy card's secondary ability",
    },
    {
      de: 'Sie kostet dich keinen Strategiemarker.',
      en: 'It costs you no strategy token.',
    },
  ),
};

export const actionCardText = (id: string): ActionCardText | undefined => ACTION_CARD_TEXTS[id];
