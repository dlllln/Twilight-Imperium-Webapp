import type { LocalizedText } from '@stellar/content';
import type { PhaseName } from '@stellar/domain';

/** Ein Schritt der Anleitung; `anchor` nennt das hervorgehobene Element (`data-tutorial`). */
export interface TutorialStep {
  readonly id: string;
  readonly anchor: string | null;
  readonly title: LocalizedText;
  readonly text: LocalizedText;
}

const step = (
  id: string,
  anchor: string | null,
  title: LocalizedText,
  text: LocalizedText,
): TutorialStep => ({ id, anchor, title, text });

/** Unsere eigene Anleitung: kurze Erklärungen zur Bedienung und zum Ablauf. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  step(
    'welcome',
    null,
    { de: 'Willkommen bei Stellar Hegemony', en: 'Welcome to Stellar Hegemony' },
    {
      de: 'Du führst ein Sternenreich. Wer zuerst 10 Siegpunkte sammelt, gewinnt. Gespielt wird am selben Bildschirm, gegen die KI oder online mit Freunden.',
      en: 'You lead a stellar empire. The first to collect 10 victory points wins. Play on one screen, against the AI, or online with friends.',
    },
  ),
  step(
    'galaxy',
    'galaxy',
    { de: 'Die Galaxie', en: 'The galaxy' },
    {
      de: 'Jedes Sechseck ist ein System. Unter jedem Planeten stehen Ressourcen (links) und Einfluss (rechts). Die Zahlen am Rand markieren die Heimatsysteme, in der Mitte liegt die Thronwelt. Nebel, Asteroiden, Supernovae und Gravitationsrisse erschweren den Flug. Mausrad zoomt, Ziehen verschiebt.',
      en: 'Each hexagon is a system. Below each planet you see resources (left) and influence (right). The numbers on the rim mark home systems; the throne world sits in the centre. Nebulae, asteroids, supernovae and gravity rifts hinder travel. Scroll to zoom, drag to pan.',
    },
  ),
  step(
    'toolbar',
    'toolbar',
    { de: 'Partie einrichten', en: 'Setting up' },
    {
      de: 'Hier wählst du Spielerzahl und KI-Gegner, würfelst eine neue Galaxie aus und startest. Rechts schaltest du Klang und Animationen und öffnest diese Anleitung wieder.',
      en: 'Pick the number of players and AI opponents, roll a new galaxy and start. On the right you switch sound and animations and reopen this guide.',
    },
  ),
  step(
    'online',
    'online',
    { de: 'Online spielen', en: 'Playing online' },
    {
      de: 'Eröffne eine Online-Partie und gib den Code weiter. Mitspieler treten mit dem Code bei. Beim Start übernimmt die KI alle freien Plätze. Verlierst du die Verbindung, bringt dich ein Neuladen auf deinen Platz zurück.',
      en: 'Open an online game and share the code. Others join with it. At the start the AI takes every open seat. If you lose the connection, reloading brings you back to your seat.',
    },
  ),
  step(
    'phases',
    'phases',
    { de: 'Eine Runde', en: 'A round' },
    {
      de: 'Jede Runde hat vier Abschnitte: Strategie, Aktion, Status und, sobald jemand die Thronwelt erobert hat, den Rat mit seinen Abstimmungen.',
      en: 'Each round has four parts: strategy, action, status and, once someone has taken the throne world, the council with its votes.',
    },
  ),
  step(
    'strategy',
    'strategy',
    { de: 'Strategiekarten', en: 'Strategy cards' },
    {
      de: 'Reihum wählt jeder eine Karte. Die Zahl bestimmt, wer in der Aktionsphase zuerst handelt. Wer die Karte ausspielt, nutzt ihre starke Fähigkeit; alle anderen dürfen die schwächere gegen einen Strategiemarker mitnutzen. Liegen gebliebene Karten sammeln Handelswaren.',
      en: 'Everyone picks a card in turn. Its number decides who acts first in the action phase. Whoever plays it uses its strong ability; everyone else may use the weaker one for a strategy token. Cards left over collect trade goods.',
    },
  ),
  step(
    'turn',
    'turn',
    { de: 'Dein Zug', en: 'Your turn' },
    {
      de: 'In der Aktionsphase handelt jeder reihum einmal. Taktisch: ein System mit einem Taktikmarker aktivieren, Schiffe hineinfliegen, kämpfen, landen und bauen. Strategisch: die eigene Karte ausspielen. Passen darf, wer seine Karte genutzt hat.',
      en: 'In the action phase everyone acts once per turn. Tactical: activate a system with a tactic token, fly ships in, fight, land and build. Strategic: play your own card. You may pass once your card is used.',
    },
  ),
  step(
    'players',
    'players',
    { de: 'Marker und Vorräte', en: 'Tokens and supplies' },
    {
      de: 'Die drei Zahlen sind deine Kommandomarker: Taktik, Flotte und Strategie. Die Flotte begrenzt, wie viele Schiffe in einem System stehen dürfen. Dazu kommen Handelswaren, Rohstoffe und Handkarten.',
      en: 'The three numbers are your command tokens: tactic, fleet and strategy. Fleet limits how many ships may share a system. Next to them: trade goods, commodities and hand size.',
    },
  ),
  step(
    'combat',
    null,
    { de: 'Kampf', en: 'Combat' },
    {
      de: 'Treffen Flotten aufeinander, öffnet sich die Kampfansicht. Jede Einheit würfelt; erreicht der Wurf ihren Kampfwert, trifft sie. Der Getroffene verteilt die Treffer, manche Schiffe werden erst beschädigt. Vor jeder Runde ist ein Rückzug möglich.',
      en: 'When fleets meet, the combat view opens. Every unit rolls; reaching its combat value scores a hit. The defender of each hit chooses which units take it; some ships are only damaged at first. A retreat is possible before each round.',
    },
  ),
  step(
    'objectives',
    'objectives',
    { de: 'Aufträge und Punkte', en: 'Objectives and points' },
    {
      de: 'Öffentliche Aufträge gelten für alle, geheime nur für dich. In der Statusphase wertest du, was du erfüllst. Die Leiste zeigt, wie nah jeder dem Sieg ist.',
      en: 'Public objectives are open to everyone, secret ones only to you. In the status phase you score what you have achieved. The track shows how close everyone is to winning.',
    },
  ),
  step(
    'hand',
    'hand',
    { de: 'Aktionskarten', en: 'Action cards' },
    {
      de: 'Aktionskarten wirken zu bestimmten Zeitpunkten, etwa im Kampf. Mitspieler können eine Karte mit einer Gegenkarte verhindern. Mehr als sieben Karten darfst du nicht halten.',
      en: 'Action cards work at specific moments, for example in combat. Others may cancel a card with a counter card. You may not hold more than seven.',
    },
  ),
  step(
    'factions',
    'factions',
    { de: 'Fraktionen', en: 'Factions' },
    {
      de: 'Jede Fraktion hat zwei eigene Fähigkeiten. Hier siehst du, womit deine Gegner rechnen können.',
      en: 'Each faction has two abilities of its own. Here you see what your opponents can count on.',
    },
  ),
  step(
    'done',
    null,
    { de: 'Bereit', en: 'Ready' },
    {
      de: 'Im Zugfeld steht zu jeder Phase ein kurzer Tipp. Diese Anleitung öffnest du jederzeit über „Anleitung“. Viel Erfolg!',
      en: 'The turn panel shows a short tip for each phase. Reopen this guide any time via “Guide”. Good luck!',
    },
  ),
];

/** Ein Satz je Phase im Zugfeld, solange Tipps eingeschaltet sind. */
export const PHASE_TIPS: Readonly<Record<PhaseName, LocalizedText>> = {
  setup: { de: 'Die Partie wird aufgebaut.', en: 'The game is being set up.' },
  strategy: {
    de: 'Tipp: Niedrige Zahlen handeln zuerst, Karten mit Handelswaren bringen sofort Gewinn.',
    en: 'Tip: low numbers act first; cards with trade goods pay off right away.',
  },
  action: {
    de: 'Tipp: Wähle ein System auf der Karte und aktiviere es, oder spiele deine Strategiekarte aus.',
    en: 'Tip: pick a system on the map and activate it, or play your strategy card.',
  },
  status: {
    de: 'Tipp: Werte erfüllte Aufträge und verteile deine neuen Kommandomarker.',
    en: 'Tip: score completed objectives and place your new command tokens.',
  },
  agenda: {
    de: 'Tipp: Erschöpfe Planeten für Stimmen; Einfluss zählt, Handelswaren nicht.',
    en: 'Tip: exhaust planets for votes; influence counts, trade goods do not.',
  },
  gameOver: { de: 'Die Partie ist entschieden.', en: 'The game is decided.' },
};
