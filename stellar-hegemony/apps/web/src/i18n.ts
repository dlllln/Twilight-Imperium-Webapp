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
} as const satisfies Record<string, LocalizedText>;

export type MessageKey = keyof typeof DICTIONARY;

export const translate = (language: Language, key: MessageKey): string => DICTIONARY[key][language];

export const isMessageKey = (value: string): value is MessageKey => value in DICTIONARY;
