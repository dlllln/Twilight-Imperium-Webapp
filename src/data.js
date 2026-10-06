// Spieldaten für "Sternenthron". Alle Namen, Texte und Fraktionen sind eigene Erfindungen.

const UNITS = {
  fighter:     { name: 'Jäger',          cost: 1, batch: 2, combat: 9, dice: 1, move: 0, capacity: 0, ship: true,  fighterLike: true },
  infantry:    { name: 'Infanterie',     cost: 1, batch: 2, combat: 8, dice: 1, ground: true },
  destroyer:   { name: 'Zerstörer',      cost: 1, batch: 1, combat: 9, dice: 1, move: 2, capacity: 0, ship: true, barrage: { hit: 9, dice: 2 } },
  cruiser:     { name: 'Kreuzer',        cost: 2, batch: 1, combat: 7, dice: 1, move: 2, capacity: 0, ship: true },
  carrier:     { name: 'Träger',         cost: 3, batch: 1, combat: 9, dice: 1, move: 1, capacity: 4, ship: true },
  dreadnought: { name: 'Schlachtschiff', cost: 4, batch: 1, combat: 5, dice: 1, move: 1, capacity: 1, ship: true, sustain: true, bombard: { hit: 5, dice: 1 } },
  warsun:      { name: 'Sonnenbrecher',  cost: 12, batch: 1, combat: 3, dice: 3, move: 2, capacity: 6, ship: true, sustain: true, bombard: { hit: 3, dice: 3 }, needsTech: 'u_warsun' },
  dock:        { name: 'Raumwerft',      structure: true, produce: 2 },
  pds:         { name: 'Orbitalgeschütz', structure: true, cannon: { hit: 6, dice: 1 }, shield: true },
};

// Einheiten-Verbesserungen: überschreiben Werte der Basiseinheit
const UPGRADES = {
  u_fighter:     { unit: 'fighter',     name: 'Abfangjäger Mk II',      prereq: { green: 1, blue: 1 }, stats: { combat: 8, move: 2 }, text: 'Jäger treffen auf 8+ und haben Bewegung 2 (fliegen ohne Träger).' },
  u_infantry:    { unit: 'infantry',    name: 'Sturmlegion Mk II',      prereq: { green: 2 }, stats: { combat: 7 }, text: 'Infanterie trifft im Bodenkampf auf 7+.' },
  u_destroyer:   { unit: 'destroyer',   name: 'Geleitschiff Mk II',     prereq: { red: 2 }, stats: { combat: 8, barrage: { hit: 6, dice: 3 } }, text: 'Zerstörer treffen auf 8+, Flakfeuer 6+ mit 3 Würfeln.' },
  u_cruiser:     { unit: 'cruiser',     name: 'Linienkreuzer Mk II',    prereq: { green: 1, yellow: 1, red: 1 }, stats: { combat: 6, move: 3, capacity: 1 }, text: 'Kreuzer treffen auf 6+, Bewegung 3, Kapazität 1.' },
  u_carrier:     { unit: 'carrier',     name: 'Transportträger Mk II',  prereq: { blue: 2 }, stats: { move: 2, capacity: 6 }, text: 'Träger haben Bewegung 2 und Kapazität 6.' },
  u_dreadnought: { unit: 'dreadnought', name: 'Bollwerk Mk II',         prereq: { blue: 2, yellow: 1 }, stats: { combat: 5, move: 2, bombard: { hit: 4, dice: 1 } }, text: 'Schlachtschiffe haben Bewegung 2 und Bombardement 4+.' },
  u_dock:        { unit: 'dock',        name: 'Großwerft Mk II',        prereq: { yellow: 2 }, stats: { produce: 4 }, text: 'Raumwerften produzieren bis zu Ressourcenwert +4.' },
  u_pds:         { unit: 'pds',         name: 'Orbitalbatterie Mk II',  prereq: { red: 1, yellow: 1 }, stats: { cannon: { hit: 5, dice: 1, range: 1 } }, text: 'Geschütze treffen auf 5+ und feuern auch in benachbarte Systeme.' },
  u_warsun:      { unit: 'warsun',      name: 'Sonnenbrecher-Bauplan',  prereq: { red: 3, yellow: 1 }, stats: {}, text: 'Erlaubt den Bau von Sonnenbrechern.' },
};

const TECH_COLORS = { green: 'Biologie', blue: 'Antrieb', red: 'Kriegskunst', yellow: 'Kybernetik' };

const TECHS = {
  // Biologie
  g_regen:   { color: 'green', name: 'Zellwuchs',          prereq: {},           text: 'Wenn du in einem System produzierst, erhältst du dort 1 Infanterie zusätzlich gratis.' },
  g_neural:  { color: 'green', name: 'Synapsenfunk',       prereq: { green: 1 }, text: 'Wenn du die Primärfähigkeit einer Strategiekarte nutzt, ziehst du 1 Aktionskarte.' },
  g_gene:    { color: 'green', name: 'Erbgutschmiede',     prereq: { green: 2 }, text: 'Deine Bodentruppen erhalten +1 auf Kampfwürfe.' },
  g_spark:   { color: 'green', name: 'Lebensfunke',        prereq: { green: 3 }, text: 'In der Statusphase erhältst du 1 Kommandomarker zusätzlich.' },
  // Antrieb
  b_field:   { color: 'blue',  name: 'Feldtriebwerk',      prereq: {},           text: 'Deine Kreuzer und Zerstörer erhalten +1 Bewegung.' },
  b_drift:   { color: 'blue',  name: 'Driftnavigation',    prereq: { blue: 1 },  text: 'Deine Schiffe dürfen Asteroidenfelder durchqueren.' },
  b_hyper:   { color: 'blue',  name: 'Hyperspur',          prereq: { blue: 2 },  text: 'Alle deine Schiffe erhalten +1 Bewegung.' },
  b_fold:    { color: 'blue',  name: 'Faltraumtor',        prereq: { blue: 3 },  text: 'Alle Systeme mit deiner Raumwerft gelten für dich als benachbart.' },
  // Kriegskunst
  r_ablat:   { color: 'red',   name: 'Ablativschilde',     prereq: {},           text: 'Einmal pro Kampfrunde darfst du einen Fehlwurf wiederholen.' },
  r_shield:  { color: 'red',   name: 'Bunkerkuppeln',      prereq: { red: 1 },   text: 'Deine Planeten mit mindestens 2 Infanterie können nicht bombardiert werden.' },
  r_salvo:   { color: 'red',   name: 'Erstschlag-Doktrin', prereq: { red: 2 },   text: 'In der ersten Runde eines Raumkampfs erhalten deine Schiffe +1.' },
  // Kybernetik
  y_core:    { color: 'yellow', name: 'Rechenkern',        prereq: {},             text: 'Zu Beginn jeder Strategiephase erhältst du 1 Handelsware.' },
  y_logis:   { color: 'yellow', name: 'Logistiknetz',      prereq: { yellow: 1 },  text: 'Deine Raumwerften erhalten +2 Produktionslimit.' },
  y_oracle:  { color: 'yellow', name: 'Prognosematrix',    prereq: { yellow: 2 },  text: 'In der Statusphase ziehst du 2 Aktionskarten statt 1.' },
  y_singul:  { color: 'yellow', name: 'Singularitätskern', prereq: { yellow: 3 },  text: 'Beim Erforschen darfst du eine fehlende Voraussetzung ignorieren.' },
};

const STRATEGY = [
  null,
  { id: 1, name: 'Vorhut',         primary: 'Erhalte 3 Kommandomarker. Kaufe danach beliebig viele weitere für je 3 Einfluss.', secondary: 'Kaufe Kommandomarker für je 3 Einfluss (kostet keinen Strategiemarker).' },
  { id: 2, name: 'Gesandtschaft',  primary: 'Wähle ein System mit einem deiner Planeten (nicht die Thronwelt). Alle anderen legen dort einen Kommandomarker ab. Mache bis zu 2 deiner Planeten wieder bereit.', secondary: 'Mache bis zu 2 deiner Planeten wieder bereit.' },
  { id: 3, name: 'Senat',          primary: 'Bestimme einen anderen Spieler zum neuen Sprecher und ziehe 2 Aktionskarten.', secondary: 'Ziehe 1 Aktionskarte.' },
  { id: 4, name: 'Baukunst',       primary: 'Errichte eine Raumwerft oder ein Orbitalgeschütz auf einem deiner Planeten, danach ein weiteres Orbitalgeschütz.', secondary: 'Errichte eine Raumwerft oder ein Orbitalgeschütz auf einem deiner Planeten und lege einen Kommandomarker aus deiner Reserve in dieses System.' },
  { id: 5, name: 'Kontor',         primary: 'Erhalte 3 Handelswaren und fülle deine Rohstoffe auf.', secondary: 'Fülle deine Rohstoffe auf.' },
  { id: 6, name: 'Rüstung',        primary: 'Nimm einen deiner Kommandomarker vom Spielbrett zurück in einen Vorrat deiner Wahl.', secondary: 'Produziere in deinem Heimatsystem, ohne es zu aktivieren.' },
  { id: 7, name: 'Forschung',      primary: 'Erforsche 1 Technologie gratis, danach darfst du 1 weitere für 6 Ressourcen erforschen.', secondary: 'Erforsche 1 Technologie für 4 Ressourcen.' },
  { id: 8, name: 'Krone',          primary: 'Erfülle sofort ein offenes Ziel, falls möglich. Kontrollierst du die Thronwelt, erhältst du 1 Siegpunkt, sonst ziehst du ein geheimes Ziel.', secondary: 'Ziehe ein geheimes Ziel.' },
];

const FACTIONS = {
  aurel: {
    name: 'Aurelische Liga', color: '#e0b341', commodities: 4,
    home: [{ name: 'Aurelia Prima', res: 3, inf: 2 }, { name: 'Goldhafen', res: 1, inf: 2 }],
    units: { carrier: 2, cruiser: 1, destroyer: 1, fighter: 2, infantry: 4, dock: 1, pds: 0 },
    techs: ['y_core'],
    ability: 'Händlergeist: Beim Kontor erhältst du 2 Handelswaren zusätzlich.',
    flags: { tradeBonus: 2 },
  },
  kesh: {
    name: 'Schwarm von Kesh', color: '#6dbb4f', commodities: 2,
    home: [{ name: 'Kesh-Brutwelt', res: 4, inf: 1 }],
    units: { carrier: 2, cruiser: 1, fighter: 3, infantry: 6, dock: 1, pds: 1 },
    techs: ['g_regen'],
    ability: 'Brutkammern: Deine Infanterie kostet nur 1 Ressource für 3 Einheiten.',
    flags: { infantryBatch: 3 },
  },
  eisen: {
    name: 'Eisenkanzlei', color: '#9aa6b5', commodities: 3,
    home: [{ name: 'Ferrum', res: 4, inf: 2 }, { name: 'Schlackenmond', res: 1, inf: 0 }],
    units: { carrier: 1, dreadnought: 2, destroyer: 1, fighter: 2, infantry: 3, dock: 1, pds: 0 },
    techs: ['r_ablat'],
    ability: 'Hochöfen: Deine Schlachtschiffe kosten 1 Ressource weniger.',
    flags: { dreadDiscount: 1 },
  },
  licht: {
    name: 'Orden des Stillen Lichts', color: '#d6d0ff', commodities: 3,
    home: [{ name: 'Lumen', res: 2, inf: 4 }],
    units: { carrier: 2, cruiser: 2, fighter: 2, infantry: 4, dock: 1, pds: 1 },
    techs: ['g_regen'],
    ability: 'Stille Andacht: Du beginnst mit 1 zusätzlichen Strategiemarker und hast bei Abstimmungen +2 Stimmen.',
    flags: { extraStrategyToken: 1, voteBonus: 2 },
  },
  tharr: {
    name: 'Nomaden von Tharr', color: '#e2733b', commodities: 3,
    home: [{ name: 'Wanderfeste Tharr', res: 3, inf: 3 }],
    units: { carrier: 2, cruiser: 1, destroyer: 2, fighter: 2, infantry: 3, dock: 1, pds: 0 },
    techs: ['b_field'],
    ability: 'Ewige Reise: Alle deine Schiffe haben +1 Bewegung.',
    flags: { moveBonus: 1 },
  },
  mnemo: {
    name: 'Mnemonisches Kollektiv', color: '#43c6d1', commodities: 2,
    home: [{ name: 'Archivwelt', res: 2, inf: 2 }, { name: 'Datenmond', res: 2, inf: 1 }],
    units: { carrier: 2, cruiser: 1, fighter: 2, infantry: 3, dock: 1, pds: 1 },
    techs: ['y_core', 'g_regen', 'b_field'],
    ability: 'Gedächtnisstrom: Du beginnst mit 3 Technologien.',
    flags: {},
  },
  vyr: {
    name: 'Vyr-Konsortium', color: '#c45bd6', commodities: 4,
    home: [{ name: 'Vyr Zentral', res: 3, inf: 3 }],
    units: { carrier: 2, destroyer: 2, fighter: 2, infantry: 4, dock: 1, pds: 0 },
    techs: ['y_core'],
    ability: 'Schattenagenten: In der Statusphase ziehst du 1 Aktionskarte zusätzlich.',
    flags: { extraActionCard: 1 },
  },
  glut: {
    name: 'Glutlegion', color: '#d94a4a', commodities: 2,
    home: [{ name: 'Aschenthron', res: 3, inf: 1 }, { name: 'Funkenfeld', res: 2, inf: 1 }],
    units: { carrier: 2, cruiser: 1, destroyer: 1, fighter: 2, infantry: 5, dock: 1, pds: 0 },
    techs: ['r_ablat'],
    ability: 'Feuertaufe: Deine Bodentruppen erhalten +1 auf Kampfwürfe.',
    flags: { groundBonus: 1 },
  },
  maren: {
    name: 'Gezeitenhof von Maren', color: '#4fb0a0', commodities: 3,
    home: [{ name: 'Maren Tiefsee', res: 2, inf: 3 }, { name: 'Perlriff', res: 1, inf: 1 }],
    units: { carrier: 2, cruiser: 2, fighter: 2, infantry: 4, dock: 1, pds: 0 },
    techs: ['b_field'],
    ability: 'Strömungsreiter: Deine Schiffe dürfen Nebel durchqueren und starten dort mit voller Bewegung.',
    flags: { nebulaPass: true },
  },
  quar: {
    name: 'Kristallsänger von Quar', color: '#b8e0ff', commodities: 3,
    home: [{ name: 'Quar Resonanz', res: 3, inf: 2 }],
    units: { carrier: 2, cruiser: 1, destroyer: 1, fighter: 2, infantry: 4, dock: 1, pds: 2 },
    techs: ['r_ablat'],
    ability: 'Klingende Türme: Deine Orbitalgeschütze würfeln 2 Würfel statt 1.',
    flags: { pdsDice: 2 },
  },
  halden: {
    name: 'Freie Werften von Halden', color: '#c9a27a', commodities: 3,
    home: [{ name: 'Halden-Ring', res: 4, inf: 1 }],
    units: { carrier: 2, cruiser: 1, destroyer: 1, fighter: 2, infantry: 3, dock: 1, pds: 0 },
    techs: ['y_core'],
    ability: 'Serienfertigung: Jede deiner Raumwerften hat +2 Produktionslimit.',
    flags: { prodBonus: 2 },
  },
  pilger: {
    name: 'Pilgerzug der Stillen', color: '#f0e6c0', commodities: 4,
    home: [{ name: 'Wallfahrt', res: 2, inf: 3 }, { name: 'Rastmond', res: 1, inf: 1 }],
    units: { carrier: 2, cruiser: 1, fighter: 2, infantry: 4, dock: 1, pds: 1 },
    techs: ['g_regen'],
    ability: 'Gelübde der Geduld: Wenn du passt, erhältst du 1 Handelsware je verbliebenem Taktikmarker (höchstens 3).',
    flags: { passIncome: 3 },
  },
};

// Planeten: res = Ressourcen, inf = Einfluss, trait: kultur | industrie | wildnis, tech: Farbe der Spezialisierung
const P = (name, res, inf, trait, tech) => ({ name, res, inf, trait, tech: tech || null });

const PLANET_SYSTEMS = [
  [P('Orrin', 2, 1, 'industrie')],
  [P('Calyx', 1, 2, 'kultur')],
  [P('Veyra', 3, 0, 'wildnis', 'red')],
  [P('Tamsin', 0, 3, 'kultur')],
  [P('Brunn', 2, 2, 'industrie', 'yellow')],
  [P('Sol Dera', 1, 3, 'kultur')],
  [P('Kharn', 4, 1, 'wildnis')],
  [P('Lysse', 2, 0, 'industrie', 'blue')],
  [P('Mirabel', 1, 1, 'kultur', 'green')],
  [P('Quorra', 3, 1, 'industrie')],
  [P('Nebulon', 0, 2, 'wildnis', 'blue')],
  [P('Ystra', 2, 3, 'kultur')],
  [P('Fendel', 1, 0, 'wildnis'), P('Fendel Minor', 2, 1, 'industrie')],
  [P('Adara', 1, 2, 'kultur'), P('Brekk', 2, 0, 'wildnis', 'green')],
  [P('Sorrow', 3, 2, 'wildnis'), P('Pell', 0, 1, 'kultur')],
  [P('Zenith', 2, 1, 'industrie', 'red'), P('Halcyon', 1, 1, 'kultur')],
  [P('Ombra', 1, 1, 'industrie'), P('Lantis', 1, 2, 'kultur', 'yellow')],
  [P('Ruskar', 3, 0, 'industrie'), P('Myrr', 0, 3, 'kultur')],
  [P('Thessaly', 2, 2, 'wildnis', 'blue')],
  [P('Corvin', 1, 3, 'industrie')],
  [P('Ilmar', 2, 1, 'wildnis', 'green'), P('Ost-Ilmar', 1, 1, 'industrie')],
  [P('Gardo', 4, 0, 'industrie')],
  [P('Pallas', 0, 4, 'kultur')],
  [P('Wyrm', 2, 2, 'wildnis', 'yellow')],
];

// Rote / Sondersysteme
const SPECIAL_SYSTEMS = [
  { anomaly: 'asteroid' }, { anomaly: 'asteroid' },
  { anomaly: 'nebula' }, { anomaly: 'nebula' },
  { anomaly: 'supernova' },
  { anomaly: 'rift' }, { anomaly: 'rift' },
  {}, {}, {},
];
const WORMHOLE_SYSTEMS = [
  { wormhole: 'alpha' },
  { wormhole: 'alpha', planets: [P('Torus', 1, 2, 'kultur')] },
  { wormhole: 'beta' },
  { wormhole: 'beta', planets: [P('Spirale', 2, 1, 'wildnis')] },
];

const THRONE = { name: 'Thronwelt Aurum', res: 1, inf: 6, trait: null, tech: null };

const OBJECTIVES_1 = [
  { id: 'o1_border',  name: 'Grenzposten',        text: 'Kontrolliere 5 Planeten außerhalb deines Heimatsystems.' },
  { id: 'o1_variety', name: 'Vielfalt der Welten', text: 'Kontrolliere je einen Kultur-, Industrie- und Wildnisplaneten.' },
  { id: 'o1_docks',   name: 'Werftenring',        text: 'Besitze mindestens 2 Raumwerften.' },
  { id: 'o1_tech',    name: 'Forscherdrang',      text: 'Besitze je 2 Technologien in 2 verschiedenen Farben.' },
  { id: 'o1_fleet',   name: 'Flottenschau',       text: 'Habe mindestens 8 Schiffe (ohne Jäger) auf dem Spielbrett.' },
  { id: 'o1_gold',    name: 'Schatzkammer',       text: 'Besitze mindestens 6 Handelswaren.' },
  { id: 'o1_anom',    name: 'Grenzgänger',        text: 'Habe Schiffe in 2 verschiedenen Anomalie-Systemen.' },
  { id: 'o1_throne',  name: 'Vor den Toren',      text: 'Habe Schiffe in 2 Systemen, die an die Thronwelt angrenzen.' },
  { id: 'o1_res',     name: 'Wohlstand',          text: 'Kontrolliere Planeten mit zusammen mindestens 10 Ressourcen.' },
  { id: 'o1_inf',     name: 'Ansehen',            text: 'Kontrolliere Planeten mit zusammen mindestens 10 Einfluss.' },
  { id: 'o1_patrol',  name: 'Patrouillendienst',  text: 'Habe Schiffe in 4 Systemen außerhalb deines Heimatsystems.' },
];
const OBJECTIVES_2 = [
  { id: 'o2_border',  name: 'Sternenreich',       text: 'Kontrolliere 10 Planeten außerhalb deines Heimatsystems.' },
  { id: 'o2_tech',    name: 'Gelehrtenrepublik',  text: 'Besitze je 3 Technologien in 2 verschiedenen Farben.' },
  { id: 'o2_home',    name: 'Vorstoß',            text: 'Habe Schiffe im Heimatsystem eines anderen Spielers.' },
  { id: 'o2_res',     name: 'Industriemacht',     text: 'Kontrolliere Planeten mit zusammen mindestens 18 Ressourcen.' },
  { id: 'o2_inf',     name: 'Hegemonie',          text: 'Kontrolliere Planeten mit zusammen mindestens 18 Einfluss.' },
  { id: 'o2_throne',  name: 'Herr des Throns',    text: 'Kontrolliere die Thronwelt.' },
  { id: 'o2_docks',   name: 'Werftenimperium',    text: 'Besitze mindestens 3 Raumwerften.' },
  { id: 'o2_upg',     name: 'Neue Generation',    text: 'Besitze 3 Einheiten-Verbesserungen.' },
  { id: 'o2_armada',  name: 'Armada',             text: 'Habe mindestens 14 Schiffe (ohne Jäger) auf dem Spielbrett.' },
];
const SECRETS = [
  { id: 's_kill3',   name: 'Vernichtungsschlag', text: 'Zerstöre in einem einzigen Kampf mindestens 3 gegnerische Schiffe.' },
  { id: 's_conq',    name: 'Eroberer',           text: 'Erobere einen Planeten, den ein anderer Spieler kontrolliert hat.' },
  { id: 's_dread',   name: 'Stahlwand',          text: 'Habe 3 Schlachtschiffe auf dem Spielbrett.' },
  { id: 's_wild',    name: 'Wildnisjäger',       text: 'Kontrolliere 4 Wildnisplaneten.' },
  { id: 's_kult',    name: 'Kulturträger',       text: 'Kontrolliere 4 Kulturplaneten.' },
  { id: 's_indu',    name: 'Industriebaron',     text: 'Kontrolliere 4 Industrieplaneten.' },
  { id: 's_mono',    name: 'Spezialist',         text: 'Besitze 3 Technologien derselben Farbe.' },
  { id: 's_rich',    name: 'Kriegskasse',        text: 'Besitze mindestens 9 Handelswaren.' },
  { id: 's_worm',    name: 'Tunnelreiter',       text: 'Habe Schiffe in 2 Wurmloch-Systemen.' },
  { id: 's_warsun',  name: 'Sonnenschmied',      text: 'Habe einen Sonnenbrecher auf dem Spielbrett.' },
  { id: 's_pds',     name: 'Festungswelt',       text: 'Besitze 4 Orbitalgeschütze.' },
  { id: 's_spread',  name: 'Allgegenwart',       text: 'Habe Einheiten in 6 verschiedenen Systemen.' },
  { id: 's_siege',   name: 'Belagerer',          text: 'Habe Schiffe in 3 Systemen, die an die Thronwelt angrenzen.' },
  { id: 's_poly',    name: 'Universalgelehrter', text: 'Besitze mindestens eine Technologie jeder Farbe.' },
];

// Aktionskarten: timing 'action' = verbraucht deinen Zug, 'free' = jederzeit in deinem Zug zusätzlich
const ACTION_CARDS = [
  { id: 'ac_repair',  name: 'Notreparatur',      timing: 'free',   copies: 2, text: 'Repariere alle deine beschädigten Einheiten.' },
  { id: 'ac_courier', name: 'Kurierdienst',      timing: 'free',   copies: 3, text: 'Erhalte 2 Handelswaren.' },
  { id: 'ac_spy',     name: 'Spionagebericht',   timing: 'action', copies: 2, text: 'Ziehe 2 Aktionskarten.' },
  { id: 'ac_sabot',   name: 'Sabotagetrupp',     timing: 'action', copies: 2, text: 'Zerstöre ein gegnerisches Orbitalgeschütz in einem System, in dem du Schiffe hast.' },
  { id: 'ac_mobil',   name: 'Mobilisierung',     timing: 'free',   copies: 3, text: 'Mache 2 deiner erschöpften Planeten wieder bereit.' },
  { id: 'ac_recall',  name: 'Rückruf',           timing: 'free',   copies: 2, text: 'Nimm einen deiner Kommandomarker vom Spielbrett in deine Taktikreserve.' },
  { id: 'ac_prosp',   name: 'Prospektion',       timing: 'free',   copies: 2, text: 'Erhalte Handelswaren in Höhe der Ressourcen eines deiner Planeten.' },
  { id: 'ac_troops',  name: 'Truppenverlegung',  timing: 'action', copies: 3, text: 'Setze 2 Infanterie auf einen deiner Planeten.' },
  { id: 'ac_overch',  name: 'Überladene Reaktoren', timing: 'free', copies: 3, text: 'Deine Einheiten erhalten bis zum Ende dieses Zuges +1 auf alle Kampfwürfe.' },
  { id: 'ac_blackm',  name: 'Schwarzmarkt',      timing: 'free',   copies: 2, text: 'Tausche 3 Handelswaren gegen 1 Kommandomarker.' },
  { id: 'ac_reinf',   name: 'Verstärkung',       timing: 'action', copies: 2, text: 'Setze 1 Kreuzer in ein System mit deiner Raumwerft, in dem keine feindlichen Schiffe sind.' },
  { id: 'ac_drill',   name: 'Flottenmanöver',    timing: 'free',   copies: 2, text: 'Erhalte 1 Flottenmarker.' },
  { id: 'ac_bribe',   name: 'Gefällige Beamte',  timing: 'free',   copies: 2, text: 'Zahle 2 Handelswaren und erhalte 1 Strategiemarker.' },
  { id: 'ac_embargo', name: 'Embargo',           timing: 'action', copies: 2, text: 'Ein Spieler deiner Wahl verliert 2 Handelswaren.' },
  { id: 'ac_relocate',name: 'Umsiedlung',        timing: 'free',   copies: 2, text: 'Versetze bis zu 3 Infanterie zwischen zwei deiner Planeten im selben System.' },
  { id: 'ac_refit',   name: 'Werftüberholung',   timing: 'free',   copies: 2, text: 'Deine Raumwerften haben in diesem Zug +2 Produktionslimit.' },
  { id: 'ac_comet',   name: 'Kometenschauer',    timing: 'action', copies: 2, text: 'Zerstöre 1 gegnerische Infanterie auf einem Planeten in einem System mit deinen Schiffen oder angrenzend daran.' },
];

// Ratsbeschlüsse (Abstimmungsphase). kind: 'yesno' | 'player'
const AGENDAS = [
  { id: 'ag_bond',    name: 'Kriegsanleihe',        kind: 'yesno', text: 'Dafür: Jeder Spieler erhält 2 Handelswaren. Dagegen: Jeder Spieler mit mehr als 3 Handelswaren verliert 2.' },
  { id: 'ag_chanc',   name: 'Ehrenkanzler',         kind: 'player', text: 'Der gewählte Spieler erhält 1 Siegpunkt.' },
  { id: 'ag_tax',     name: 'Thronsteuer',          kind: 'yesno', text: 'Dafür: Jeder Spieler zahlt 1 Handelsware an den Spieler, der die Thronwelt kontrolliert (falls jemand). Dagegen: Keine Wirkung.' },
  { id: 'ag_disarm',  name: 'Abrüstungsvertrag',    kind: 'yesno', text: 'Dafür: Jeder Spieler zerstört 1 seiner Schlachtschiffe (falls vorhanden). Dagegen: Jeder Spieler erhält 1 Handelsware.' },
  { id: 'ag_grant',   name: 'Forschungsstipendium', kind: 'player', text: 'Der gewählte Spieler erhält 1 Kommandomarker und 3 Handelswaren.' },
  { id: 'ag_census',  name: 'Volkszählung',         kind: 'yesno', text: 'Dafür: Jeder Spieler setzt 1 Infanterie auf seinen Heimatplaneten. Dagegen: Keine Wirkung.' },
  { id: 'ag_censure', name: 'Rüge des Rates',       kind: 'player', text: 'Der gewählte Spieler verliert 1 Kommandomarker aus seiner Strategiereserve (falls vorhanden).' },
  { id: 'ag_ready',   name: 'Aufbauprogramm',       kind: 'yesno', text: 'Dafür: Alle Planeten werden wieder bereit gemacht. Dagegen: Jeder Spieler zieht 1 Aktionskarte.' },
  { id: 'ag_relic',   name: 'Reliquie der Ahnen',   kind: 'player', text: 'Der gewählte Spieler erhält 1 Siegpunkt, verliert aber 2 Handelswaren.' },
  { id: 'ag_patrol',  name: 'Grenzpatrouillen',     kind: 'yesno', text: 'Dafür: Jeder Spieler erhält 1 Flottenmarker. Dagegen: Keine Wirkung.' },
  { id: 'ag_tariff',  name: 'Handelszoll',          kind: 'yesno', text: 'Dafür: Jeder Spieler außer dem Sprecher verliert 1 Handelsware, der Sprecher erhält 2. Dagegen: Keine Wirkung.' },
  { id: 'ag_lottery', name: 'Kolonielotterie',      kind: 'player', text: 'Der gewählte Spieler erhält 4 Handelswaren.' },
  { id: 'ag_morat',   name: 'Nachrichtensperre',    kind: 'yesno', text: 'Dafür: Jeder Spieler wirft 1 zufällige Aktionskarte ab. Dagegen: Jeder Spieler zieht 1 Aktionskarte.' },
  { id: 'ag_conscr',  name: 'Wehrpflicht',          kind: 'yesno', text: 'Dafür: Jeder Spieler setzt 2 Infanterie auf seinen Heimatplaneten. Dagegen: Keine Wirkung.' },
  { id: 'ag_amnesty', name: 'Amnestie',             kind: 'yesno', text: 'Dafür: Jeder Spieler nimmt 1 Kommandomarker vom Spielbrett zurück in die Taktikreserve. Dagegen: Keine Wirkung.' },
];

module.exports = {
  UNITS, UPGRADES, TECHS, TECH_COLORS, STRATEGY, FACTIONS, PLANET_SYSTEMS, SPECIAL_SYSTEMS,
  WORMHOLE_SYSTEMS, THRONE, OBJECTIVES_1, OBJECTIVES_2, SECRETS, ACTION_CARDS, AGENDAS,
  VP_TO_WIN: 10,
};
