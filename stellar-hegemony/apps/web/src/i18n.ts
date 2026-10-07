import type { LocalizedText } from '@stellar/content';

export type Language = keyof LocalizedText;

const DICTIONARY = {
  title: { de: 'Stellar Hegemony', en: 'Stellar Hegemony' },
  subtitle: { de: 'Galaxie-Aufbau', en: 'Galaxy setup' },
  players: { de: 'Spieler', en: 'Players' },
  newGalaxy: { de: 'Neue Galaxie', en: 'New galaxy' },
  mapString: { de: 'Map-String', en: 'Map string' },
  importMap: { de: 'Importieren', en: 'Import' },
  copyMap: { de: 'Kopieren', en: 'Copy' },
  resources: { de: 'Ressourcen', en: 'Resources' },
  influence: { de: 'Einfluss', en: 'Influence' },
  homeSlot: { de: 'Heimat-Platz', en: 'Home slot' },
  seat: { de: 'Platz', en: 'Seat' },
  emptySpace: { de: 'Leerer Raum', en: 'Empty space' },
  wormhole: { de: 'Wurmloch', en: 'Wormhole' },
  asteroidField: { de: 'Asteroidenfeld', en: 'Asteroid field' },
  nebula: { de: 'Nebel', en: 'Nebula' },
  supernova: { de: 'Supernova', en: 'Supernova' },
  gravityRift: { de: 'Gravitationsriss', en: 'Gravity rift' },
  cultural: { de: 'kulturell', en: 'cultural' },
  hazardous: { de: 'gefährlich', en: 'hazardous' },
  industrial: { de: 'industriell', en: 'industrial' },
  biotic: { de: 'Biotik', en: 'Biotic' },
  propulsion: { de: 'Antrieb', en: 'Propulsion' },
  cybernetic: { de: 'Kybernetik', en: 'Cybernetic' },
  warfare: { de: 'Kriegsführung', en: 'Warfare' },
  shortcuts: {
    de: 'Tasten: G neue Galaxie · +/− Zoom · Pfeile verschieben · 0 zurücksetzen',
    en: 'Keys: G new galaxy · +/− zoom · arrows pan · 0 reset',
  },
  errorPrefix: { de: 'Karte abgelehnt', en: 'Map rejected' },
  startGame: { de: 'Partie starten', en: 'Start game' },
  backToGalaxy: { de: 'Zur Galaxie', en: 'Back to galaxy' },
  subtitleGame: { de: 'Lokale Partie (Hot-Seat)', en: 'Local game (hot seat)' },
  round: { de: 'Runde', en: 'Round' },
  speaker: { de: 'Sprecher', en: 'Speaker' },
  onTurn: { de: 'Am Zug', en: 'To act' },
  'phase.strategy': { de: 'Strategie', en: 'Strategy' },
  'phase.action': { de: 'Aktion', en: 'Action' },
  'phase.status': { de: 'Status', en: 'Status' },
  'phase.agenda': { de: 'Agenda', en: 'Agenda' },
  strategyCards: { de: 'Strategiekarten', en: 'Strategy cards' },
  pickHint: {
    de: 'Wähle eine freie Strategiekarte.',
    en: 'Pick an available strategy card.',
  },
  initiativeOrder: { de: 'Initiative', en: 'Initiative' },
  tradeGoods: { de: 'Handelswaren', en: 'Trade goods' },
  reinforcements: { de: 'Nachschub', en: 'Reinforcements' },
  tactic: { de: 'Taktik', en: 'Tactic' },
  fleet: { de: 'Flotte', en: 'Fleet' },
  strategy: { de: 'Strategie', en: 'Strategy' },
  passed: { de: 'gepasst', en: 'passed' },
  strategicAction: { de: 'Strategische Aktion', en: 'Strategic action' },
  pass: { de: 'Passen', en: 'Pass' },
  secondaryPrompt: { de: 'Sekundärfähigkeit', en: 'Secondary ability' },
  useSecondary: { de: 'Nutzen', en: 'Use' },
  decline: { de: 'Ablehnen', en: 'Decline' },
  spendTradeGoods: { de: 'Handelswaren als Einfluss', en: 'Trade goods as influence' },
  tokensGained: { de: 'Erhaltene Marker', en: 'Tokens gained' },
  toDistribute: { de: 'noch zu verteilen', en: 'left to place' },
  confirm: { de: 'Ausführen', en: 'Confirm' },
  cancel: { de: 'Zurück', en: 'Back' },
  laterIteration: {
    de: 'Diese Karte wird in einer späteren Ausbaustufe spielbar.',
    en: 'This card becomes playable in a later stage.',
  },
  statusReached: {
    de: 'Die Aktionsphase ist vorbei. Die Statusphase folgt in einer späteren Ausbaustufe.',
    en: 'The action phase is over. The status phase follows in a later stage.',
  },
  ruleError: { de: 'Nicht erlaubt', en: 'Not allowed' },
  'strategy.mechanicUnavailable': {
    de: 'Diese Karte ist noch nicht spielbar.',
    en: 'This card is not playable yet.',
  },
  'tokens.allocationMismatch': {
    de: 'Verteile genau so viele Marker, wie du erhältst.',
    en: 'Place exactly as many tokens as you gain.',
  },
  'action.noStrategyToken': {
    de: 'Dafür brauchst du einen Marker im Strategiepool.',
    en: 'You need a token in your strategy pool.',
  },
  'action.strategyCardUnused': {
    de: 'Passen geht erst, wenn du deine Strategiekarten genutzt hast.',
    en: 'You can pass only after using your strategy cards.',
  },
  'payment.tradeGoods': {
    de: 'So viele Handelswaren hast du nicht.',
    en: 'Not enough trade goods.',
  },
  'map.empty': { de: 'Der Map-String ist leer.', en: 'The map string is empty.' },
  'map.invalidToken': {
    de: 'Der Map-String enthält ungültige Zeichen.',
    en: 'The map string contains invalid characters.',
  },
  'galaxy.unknownTile': { de: 'Eine Systemtafel ist unbekannt.', en: 'A system tile is unknown.' },
  'galaxy.duplicateTile': {
    de: 'Eine Systemtafel kommt doppelt vor.',
    en: 'A system tile appears twice.',
  },
  'galaxy.duplicatePosition': {
    de: 'Ein Feld ist doppelt belegt.',
    en: 'A position is used twice.',
  },
  'galaxy.center': {
    de: 'In der Mitte muss die Thronwelt liegen.',
    en: 'The throne world must be in the center.',
  },
  'galaxy.homeTile': {
    de: 'Heimat-Systeme werden mit H markiert.',
    en: 'Mark home systems with H.',
  },
  'galaxy.homeSlots': {
    de: 'Es braucht 3 bis 6 Heimat-Plätze (H).',
    en: 'The map needs 3 to 6 home slots (H).',
  },
  'galaxy.noTemplate': {
    de: 'Für diese Spielerzahl gibt es keine Vorlage.',
    en: 'No template for this player count.',
  },
  exhausted: { de: 'erschöpft', en: 'exhausted' },
  homeSystem: { de: 'Heimatsystem', en: 'Home system' },
  commandTokens: { de: 'Kommandomarker', en: 'Command tokens' },
  tacticalAction: { de: 'Taktische Aktion', en: 'Tactical action' },
  activateSystem: { de: 'System aktivieren', en: 'Activate system' },
  selectSystemHint: {
    de: 'Wähle auf der Karte ein System, um es mit einem Taktik-Marker zu aktivieren.',
    en: 'Pick a system on the map to activate it with a tactic token.',
  },
  selectedSystem: { de: 'Gewählt', en: 'Selected' },
  activeSystem: { de: 'Aktiviertes System', en: 'Activated system' },
  movement: { de: 'Bewegung', en: 'Movement' },
  moveShips: { de: 'Schiffe bewegen', en: 'Move ships' },
  noMovableShips: {
    de: 'Keine eigenen Schiffe können dieses System erreichen.',
    en: 'None of your ships can reach this system.',
  },
  fleetArrived: {
    de: 'Die Bewegung ist abgeschlossen. Kampf, Invasion und Produktion folgen in späteren Ausbaustufen.',
    en: 'Movement is done. Combat, invasion and production follow in later stages.',
  },
  endTactical: { de: 'Taktische Aktion beenden', en: 'End tactical action' },
  cargo: { de: 'Fracht', en: 'Cargo' },
  from: { de: 'aus', en: 'from' },
  step: { de: 'Schritt', en: 'step' },
  steps: { de: 'Schritte', en: 'steps' },
  chooseSystem: { de: 'System wählen', en: 'Choose system' },
  readyPlanets: { de: 'Planeten bereitmachen', en: 'Ready planets' },
  noExhaustedPlanets: {
    de: 'Du hast keine erschöpften Planeten.',
    en: 'You have no exhausted planets.',
  },
  'tactical.noTacticToken': {
    de: 'Dein Taktikpool ist leer.',
    en: 'Your tactic pool is empty.',
  },
  'tactical.alreadyActivated': {
    de: 'Dort liegt schon dein Kommandomarker.',
    en: 'Your command token is already there.',
  },
  'move.blocked': {
    de: 'Fremde Schiffe versperren den Weg.',
    en: 'Enemy ships block the way.',
  },
  'move.capacity': {
    de: 'Nicht genug Kapazität für alle Jäger und Bodentruppen.',
    en: 'Not enough capacity for all fighters and ground forces.',
  },
  'move.fleetLimit': {
    de: 'Das überschreitet dein Flottenlimit.',
    en: 'That exceeds your fleet limit.',
  },
  'move.overCapacity': {
    de: 'Zu viel Fracht für dieses Schiff.',
    en: 'Too much cargo for this ship.',
  },
  'diplomacy.unknownSystem': { de: 'Wähle ein System.', en: 'Choose a system.' },
  'diplomacy.center': {
    de: 'Die Thronwelt ist ausgenommen.',
    en: 'The throne world is excluded.',
  },
  'diplomacy.noPlanet': {
    de: 'Du musst dort einen Planeten kontrollieren.',
    en: 'You must control a planet there.',
  },
} as const satisfies Record<string, LocalizedText>;

export type MessageKey = keyof typeof DICTIONARY;

export const translate = (language: Language, key: MessageKey): string => DICTIONARY[key][language];

export const isMessageKey = (value: string): value is MessageKey => value in DICTIONARY;

/** Übersetzter Fehlertext; unbekannte Codes erscheinen unverändert. */
export const errorText = (language: Language, code: string): string =>
  isMessageKey(code) ? translate(language, code) : code;
