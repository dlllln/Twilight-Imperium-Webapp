// Regel-Engine für "Sternenthron". Reiner Zustandsautomat: act(state, playerId, action) verändert state oder wirft einen Fehler.
const D = require('./data');

class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };
const need = (cond, msg) => { if (!cond) fail(msg); };

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => `${q},${r}`;
const SHIP_TYPES = ['warsun', 'dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter'];
const SHIP_LOSS_ORDER = ['fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun'];

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const d10 = () => 1 + Math.floor(Math.random() * 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- Spielaufbau

function createGame(id) {
  return {
    id, phase: 'lobby', round: 0, players: [], seat: [], speaker: null,
    map: {}, log: [], strategyTG: {}, strategyPool: [], publicObjectives: [],
    decks: {}, custodians: true, turn: null, wait: null, winner: null, agenda: null, version: 0,
  };
}

function log(s, msg) {
  s.log.push({ r: s.round, t: Date.now(), msg });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

function addPlayer(s, id, name) {
  need(s.phase === 'lobby', 'Das Spiel läuft bereits.');
  need(s.players.length < 6, 'Das Spiel ist voll.');
  s.players.push({ id, name: String(name).slice(0, 24) || 'Spieler', faction: null, ready: false });
}

function player(s, id) { return s.players.find((p) => p.id === id); }
function pname(s, id) { const p = player(s, id); return p ? p.name : '?'; }

function buildMap(s) {
  const n = s.players.length;
  const homeIdx = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[n];
  const homeCoords = homeIdx.map((i) => [DIRS[i][0] * 3, DIRS[i][1] * 3]);
  const slots = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
    const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (ring <= 3) slots.push({ q, r, ring });
  }
  const free = slots.filter((h) => h.ring > 0 && !homeCoords.some(([q, r]) => q === h.q && r === h.r));
  const reds = shuffle(clone(D.SPECIAL_SYSTEMS));
  const blues = shuffle(clone(D.PLANET_SYSTEMS)).map((planets) => ({ planets }));
  const worm = clone(D.WORMHOLE_SYSTEMS);
  const redCount = Math.max(4, Math.round(free.length * 0.25));
  let tiles = [...worm, ...reds.slice(0, redCount - 2)];
  tiles = [...tiles, ...blues.slice(0, free.length - tiles.length)];
  // Falls Pool nicht reicht, mit leeren Systemen auffüllen
  while (tiles.length < free.length) tiles.push({});
  shuffle(tiles);
  // Keine Supernova direkt neben Heimatsystemen
  const nearHome = (h) => homeCoords.some(([q, r]) => hexDist(q, r, h.q, h.r) === 1);
  free.forEach((h, i) => {
    if (tiles[i].anomaly === 'supernova' && nearHome(h)) {
      const j = free.findIndex((h2, j2) => !nearHome(h2) && !tiles[j2].anomaly);
      if (j >= 0) [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
  });
  const mkPlanet = (p) => ({ ...p, owner: null, exhausted: false, infantry: 0, pds: 0, dock: 0 });
  const mkSys = (h, t) => ({ key: key(h.q, h.r), q: h.q, r: h.r, planets: (t.planets || []).map(mkPlanet), anomaly: t.anomaly || null, wormhole: t.wormhole || null, home: null, throne: false, ships: {}, damaged: {}, tokens: [] });
  s.map = {};
  const center = mkSys({ q: 0, r: 0 }, { planets: [D.THRONE] });
  center.throne = true;
  center.planets[0].custodians = true;
  s.map[center.key] = center;
  free.forEach((h, i) => { const sys = mkSys(h, tiles[i]); s.map[sys.key] = sys; });
  // Sitzreihenfolge = Reihenfolge um den Ring
  homeCoords.forEach(([q, r], i) => {
    const p = s.players[i];
    const f = D.FACTIONS[p.faction];
    const sys = mkSys({ q, r }, { planets: f.home.map((h) => ({ ...h, trait: null, tech: null })) });
    sys.home = p.id;
    s.map[sys.key] = sys;
    p.homeKey = sys.key;
  });
}

function hexDist(q1, r1, q2, r2) { return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2; }

function startGame(s, hostId) {
  need(s.phase === 'lobby', 'Das Spiel läuft bereits.');
  need(s.players.length >= 2, 'Mindestens 2 Spieler nötig (empfohlen 3 bis 6).');
  need(s.players.every((p) => p.faction), 'Alle Spieler müssen eine Fraktion wählen.');
  shuffle(s.players);
  buildMap(s);
  for (const p of s.players) {
    const f = D.FACTIONS[p.faction];
    Object.assign(p, {
      color: f.color, vp: 0, tokens: { tactic: 3, fleet: 3, strategy: 2 + (f.flags.extraStrategyToken || 0) },
      tg: 0, comm: 0, commMax: f.commodities, techs: [...f.techs], hand: [], secrets: [], scoredSecrets: [], scoredPublic: [],
      cards: [], used: [], passed: false, flags: { ...f.flags }, events: {}, turnBuffs: {},
    });
    const home = s.map[p.homeKey];
    for (const pl of home.planets) pl.owner = p.id;
    const hp = home.planets[0];
    hp.infantry = f.units.infantry || 0;
    hp.dock = f.units.dock || 0;
    hp.pds = f.units.pds || 0;
    home.ships[p.id] = {};
    for (const t of SHIP_TYPES) if (f.units[t]) home.ships[p.id][t] = f.units[t];
  }
  s.seat = s.players.map((p) => p.id);
  s.speaker = s.seat[0];
  s.decks.action = shuffle(D.ACTION_CARDS.flatMap((c) => Array(c.copies).fill(c.id)));
  s.decks.discard = [];
  s.decks.secret = shuffle(D.SECRETS.map((o) => o.id));
  s.decks.stage1 = shuffle(D.OBJECTIVES_1.map((o) => o.id));
  s.decks.stage2 = shuffle(D.OBJECTIVES_2.map((o) => o.id));
  s.decks.agenda = shuffle(D.AGENDAS.map((a) => a.id));
  s.publicObjectives = [];
  revealObjective(s); revealObjective(s);
  for (const p of s.players) { drawSecret(s, p); drawSecret(s, p); }
  s.round = 1;
  log(s, 'Das Spiel beginnt. Sprecher: ' + pname(s, s.speaker) + '. Jeder behält eines von zwei geheimen Zielen.');
  s.phase = 'setup';
  s.wait = { type: 'secretPick', players: [...s.seat] };
}
function pickSecret(s, p, a) {
  need(s.phase === 'setup' && s.wait.players.includes(p.id), 'Du hast dein geheimes Ziel schon gewählt.');
  need(p.secrets.includes(a.keep), 'Wähle eines deiner beiden geheimen Ziele.');
  for (const id of p.secrets) if (id !== a.keep) s.decks.secret.unshift(id);
  p.secrets = [a.keep];
  s.wait.players = s.wait.players.filter((x) => x !== p.id);
  if (!s.wait.players.length) beginStrategy(s);
}

// ---------------------------------------------------------------- Hilfsfunktionen

function revealObjective(s) {
  const n1 = s.publicObjectives.filter((o) => o.stage === 1).length;
  const stage = n1 < 5 && s.decks.stage1.length ? 1 : 2;
  const deck = stage === 1 ? s.decks.stage1 : s.decks.stage2;
  const id = deck.pop();
  if (!id) return;
  const def = (stage === 1 ? D.OBJECTIVES_1 : D.OBJECTIVES_2).find((o) => o.id === id);
  s.publicObjectives.push({ id, stage, vp: stage, name: def.name, text: def.text, scoredBy: [] });
  log(s, `Neues öffentliches Ziel: ${def.name} (${stage} SP)`);
}

function drawAction(s, p, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!s.decks.action.length) { s.decks.action = shuffle(s.decks.discard); s.decks.discard = []; }
    const c = s.decks.action.pop();
    if (c) p.hand.push(c);
  }
  while (p.hand.length > 7) s.decks.discard.push(p.hand.shift());
}

function drawSecret(s, p) {
  if (p.secrets.length >= 3) return;
  const id = s.decks.secret.pop();
  if (id) p.secrets.push(id);
}

function hasTech(p, t) { return p.techs.includes(t); }

function unitStat(p, type) {
  const u = clone(D.UNITS[type]);
  for (const [uid, up] of Object.entries(D.UPGRADES)) if (up.unit === type && hasTech(p, uid)) Object.assign(u, clone(up.stats));
  if (u.ship && u.move > 0) {
    u.move += p.flags.moveBonus || 0;
    if (hasTech(p, 'b_hyper')) u.move += 1;
    if (hasTech(p, 'b_field') && (type === 'cruiser' || type === 'destroyer')) u.move += 1;
  }
  if (type === 'infantry' && p.flags.infantryBatch) u.batch = p.flags.infantryBatch;
  if (type === 'dreadnought' && p.flags.dreadDiscount) u.cost -= p.flags.dreadDiscount;
  return u;
}

function neighbors(s, k, p) {
  const sys = s.map[k];
  const out = new Set();
  for (const [dq, dr] of DIRS) { const nk = key(sys.q + dq, sys.r + dr); if (s.map[nk]) out.add(nk); }
  if (sys.wormhole) for (const o of Object.values(s.map)) if (o.key !== k && o.wormhole === sys.wormhole) out.add(o.key);
  if (p && hasTech(p, 'b_fold') && hasDock(s, sys, p.id)) for (const o of Object.values(s.map)) if (o.key !== k && hasDock(s, o, p.id)) out.add(o.key);
  return [...out];
}

function hasDock(s, sys, pid) { return sys.planets.some((pl) => pl.owner === pid && pl.dock > 0); }
function shipsOf(sys, pid) { return sys.ships[pid] || {}; }
function countShips(sys, pid, excludeFighters = false) {
  return Object.entries(shipsOf(sys, pid)).reduce((a, [t, n]) => a + (excludeFighters && t === 'fighter' ? 0 : (t === 'infantry' ? 0 : n)), 0);
}
function enemiesIn(sys, pid) { return Object.keys(sys.ships).filter((o) => o !== pid && countShips(sys, o) > 0); }
function addUnits(sys, pid, type, n) {
  if (!n) return;
  sys.ships[pid] = sys.ships[pid] || {};
  sys.ships[pid][type] = (sys.ships[pid][type] || 0) + n;
  if (sys.ships[pid][type] <= 0) delete sys.ships[pid][type];
}
function removeUnits(sys, pid, type, n) {
  addUnits(sys, pid, type, -n);
  const dmg = (sys.damaged[pid] || {});
  if (dmg[type] && dmg[type] > ((sys.ships[pid] || {})[type] || 0)) dmg[type] = (sys.ships[pid] || {})[type] || 0;
}
function cleanSys(sys) {
  for (const pid of Object.keys(sys.ships)) {
    for (const t of Object.keys(sys.ships[pid])) if (sys.ships[pid][t] <= 0) delete sys.ships[pid][t];
    if (!Object.keys(sys.ships[pid]).length) delete sys.ships[pid];
  }
}

function capacity(s, sys, p) {
  let cap = 0;
  for (const [t, n] of Object.entries(shipsOf(sys, p.id))) if (t !== 'infantry') cap += (unitStat(p, t).capacity || 0) * n;
  return cap;
}
// Überzählige Jäger/Infanterie im All entfernen
function enforceCapacity(s, sys, p) {
  const ships = shipsOf(sys, p.id);
  const docks = sys.planets.filter((pl) => pl.owner === p.id).reduce((a, pl) => a + pl.dock, 0) * 3;
  let cap = capacity(s, sys, p);
  const fighterMove = unitStat(p, 'fighter').move > 0;
  let fighters = ships.fighter || 0;
  let inf = ships.infantry || 0;
  // Werften tragen bis zu 3 Jäger; Jäger mit eigener Bewegung brauchen keinen Platz
  const fighterNeed = fighterMove ? 0 : Math.max(0, fighters - docks);
  let over = fighterNeed + inf - cap;
  if (over > 0) {
    const killInf = Math.min(inf, over); removeUnits(sys, p.id, 'infantry', killInf); over -= killInf;
    if (over > 0) removeUnits(sys, p.id, 'fighter', over);
  }
  cleanSys(sys);
}

function fleetCheck(s, sys, p) {
  return countShips(sys, p.id, true) <= p.tokens.fleet;
}

function controlled(s, pid) {
  const out = [];
  for (const sys of Object.values(s.map)) for (const pl of sys.planets) if (pl.owner === pid) out.push({ sys, pl });
  return out;
}
function findPlanet(s, name) {
  for (const sys of Object.values(s.map)) for (const pl of sys.planets) if (pl.name === name) return { sys, pl };
  return null;
}

function initiative(s, pid) {
  const p = player(s, pid);
  return p.cards.length ? Math.min(...p.cards) : 99;
}
function turnOrder(s) { return [...s.seat].sort((a, b) => initiative(s, a) - initiative(s, b)); }
function speakerOrder(s) { const i = s.seat.indexOf(s.speaker); return [...s.seat.slice(i), ...s.seat.slice(0, i)]; }

// Bezahlung: { planets: [Namen], tg: Zahl }, kind: 'res' | 'inf'
function payValue(s, p, pay, kind) {
  pay = pay || {};
  const names = [...new Set(pay.planets || [])];
  let total = 0;
  for (const n of names) {
    const f = findPlanet(s, n);
    need(f && f.pl.owner === p.id, `Planet ${n} gehört dir nicht.`);
    need(!f.pl.exhausted, `Planet ${n} ist bereits erschöpft.`);
    total += kind === 'res' ? f.pl.res : f.pl.inf;
  }
  const tg = Math.max(0, Math.floor(pay.tg || 0));
  need(tg <= p.tg, 'Nicht genug Handelswaren.');
  return { total: total + tg, names, tg };
}
function applyPay(s, p, pv) {
  for (const n of pv.names) findPlanet(s, n).pl.exhausted = true;
  p.tg -= pv.tg;
}
function pay(s, p, payObj, kind, amount, what) {
  if (amount <= 0) return;
  const pv = payValue(s, p, payObj, kind);
  need(pv.total >= amount, `${what}: ${amount} ${kind === 'res' ? 'Ressourcen' : 'Einfluss'} nötig, du bietest ${pv.total}.`);
  applyPay(s, p, pv);
}

function gainVP(s, p, n, why) {
  p.vp += n;
  log(s, `${p.name} erhält ${n} SP (${why}). Stand: ${p.vp}`);
  if (p.vp >= D.VP_TO_WIN && !s.winner) {
    s.winner = p.id;
    s.phase = 'ended';
    s.wait = null;
    log(s, `${p.name} hat ${p.vp} Siegpunkte und gewinnt das Spiel!`);
  }
}

// ---------------------------------------------------------------- Ziele

function techCountByColor(p) {
  const c = { green: 0, blue: 0, red: 0, yellow: 0 };
  for (const t of p.techs) if (D.TECHS[t]) c[D.TECHS[t].color]++;
  return c;
}
function prereqColors(s, p) {
  // Technologien plus Spezialisierungen bereiter Planeten zählen als Voraussetzungen
  const c = techCountByColor(p);
  return c;
}

function checkObjective(s, p, id) {
  const ctrl = controlled(s, p.id);
  const nonHome = ctrl.filter((x) => x.sys.home !== p.id);
  const res = ctrl.reduce((a, x) => a + x.pl.res, 0);
  const inf = ctrl.reduce((a, x) => a + x.pl.inf, 0);
  const traits = (t) => ctrl.filter((x) => x.pl.trait === t).length;
  const docks = ctrl.reduce((a, x) => a + x.pl.dock, 0);
  const pds = ctrl.reduce((a, x) => a + x.pl.pds, 0);
  const tc = techCountByColor(p);
  const colorsWith = (n) => Object.values(tc).filter((v) => v >= n).length;
  const sysWithShips = Object.values(s.map).filter((sys) => countShips(sys, p.id) > 0);
  const shipsTotal = (type) => Object.values(s.map).reduce((a, sys) => a + (shipsOf(sys, p.id)[type] || 0), 0);
  const throneAdj = neighbors(s, '0,0');
  const upgrades = p.techs.filter((t) => D.UPGRADES[t]).length;
  switch (id) {
    case 'o1_border': return nonHome.length >= 5;
    case 'o1_variety': return traits('kultur') && traits('industrie') && traits('wildnis');
    case 'o1_docks': return docks >= 2;
    case 'o1_tech': return colorsWith(2) >= 2;
    case 'o1_fleet': return sysWithShips.reduce((a, sys) => a + countShips(sys, p.id, true), 0) >= 8;
    case 'o1_gold': return p.tg >= 6;
    case 'o1_anom': return sysWithShips.filter((sys) => sys.anomaly).length >= 2;
    case 'o1_throne': return sysWithShips.filter((sys) => throneAdj.includes(sys.key)).length >= 2;
    case 'o1_res': return res >= 10;
    case 'o1_inf': return inf >= 10;
    case 'o1_patrol': return sysWithShips.filter((sys) => sys.home !== p.id).length >= 4;
    case 'o2_armada': return sysWithShips.reduce((a, sys) => a + countShips(sys, p.id, true), 0) >= 14;
    case 's_siege': return sysWithShips.filter((sys) => throneAdj.includes(sys.key)).length >= 3;
    case 's_poly': return Object.values(tc).every((v) => v >= 1);
    case 'o2_border': return nonHome.length >= 10;
    case 'o2_tech': return colorsWith(3) >= 2;
    case 'o2_home': return sysWithShips.some((sys) => sys.home && sys.home !== p.id);
    case 'o2_res': return res >= 18;
    case 'o2_inf': return inf >= 18;
    case 'o2_throne': return s.map['0,0'].planets[0].owner === p.id;
    case 'o2_docks': return docks >= 3;
    case 'o2_upg': return upgrades >= 3;
    case 's_kill3': return !!p.events.kill3;
    case 's_conq': return !!p.events.conquer;
    case 's_dread': return shipsTotal('dreadnought') >= 3;
    case 's_wild': return traits('wildnis') >= 4;
    case 's_kult': return traits('kultur') >= 4;
    case 's_indu': return traits('industrie') >= 4;
    case 's_mono': return colorsWith(3) >= 1;
    case 's_rich': return p.tg >= 9;
    case 's_worm': return sysWithShips.filter((sys) => sys.wormhole).length >= 2;
    case 's_warsun': return shipsTotal('warsun') >= 1;
    case 's_pds': return pds >= 4;
    case 's_spread': {
      const sysAny = Object.values(s.map).filter((sys) => countShips(sys, p.id) > 0 || (shipsOf(sys, p.id).infantry || 0) > 0 || sys.planets.some((pl) => pl.owner === p.id && (pl.infantry || pl.pds || pl.dock)));
      return sysAny.length >= 6;
    }
  }
  return false;
}

function scorePublic(s, p, id) {
  const o = s.publicObjectives.find((x) => x.id === id);
  need(o, 'Unbekanntes Ziel.');
  need(!o.scoredBy.includes(p.id), 'Dieses Ziel hast du bereits erfüllt.');
  need(checkObjective(s, p, id), `Bedingung für "${o.name}" ist nicht erfüllt.`);
  o.scoredBy.push(p.id);
  p.scoredPublic.push(id);
  gainVP(s, p, o.vp, o.name);
}
function scoreSecret(s, p, id) {
  need(p.secrets.includes(id), 'Dieses geheime Ziel hast du nicht.');
  need(checkObjective(s, p, id), 'Bedingung des geheimen Ziels ist nicht erfüllt.');
  p.secrets = p.secrets.filter((x) => x !== id);
  p.scoredSecrets.push(id);
  gainVP(s, p, 1, 'Geheimes Ziel: ' + D.SECRETS.find((x) => x.id === id).name);
}

// ---------------------------------------------------------------- Phasen

function beginStrategy(s) {
  s.phase = 'strategy';
  for (const p of s.players) {
    p.cards = []; p.used = []; p.passed = false;
    if (hasTech(p, 'y_core')) { p.tg += 1; }
  }
  s.strategyPool = [1, 2, 3, 4, 5, 6, 7, 8];
  const picks = s.players.length <= 4 ? 2 : 1;
  const order = speakerOrder(s);
  s.pickOrder = [];
  for (let i = 0; i < picks; i++) s.pickOrder.push(...order);
  s.wait = { type: 'pick', players: [s.pickOrder[0]] };
  log(s, `Runde ${s.round}: Strategiephase.`);
}

function pickStrategy(s, p, card) {
  need(s.phase === 'strategy', 'Gerade werden keine Strategiekarten gewählt.');
  need(s.pickOrder[0] === p.id, 'Du bist nicht an der Reihe.');
  need(s.strategyPool.includes(card), 'Diese Karte ist nicht verfügbar.');
  s.strategyPool = s.strategyPool.filter((c) => c !== card);
  p.cards.push(card);
  if (s.strategyTG[card]) { p.tg += s.strategyTG[card]; log(s, `${p.name} nimmt ${s.strategyTG[card]} Handelswaren von der Karte.`); s.strategyTG[card] = 0; }
  log(s, `${p.name} wählt ${D.STRATEGY[card].name} (${card}).`);
  s.pickOrder.shift();
  if (s.pickOrder.length) { s.wait = { type: 'pick', players: [s.pickOrder[0]] }; return; }
  for (const c of s.strategyPool) s.strategyTG[c] = (s.strategyTG[c] || 0) + 1;
  beginAction(s);
}

function beginAction(s) {
  s.phase = 'action';
  s.wait = null;
  const first = turnOrder(s)[0];
  startTurn(s, first);
  log(s, 'Aktionsphase beginnt.');
}

function startTurn(s, pid) {
  s.turn = { player: pid, step: 'choose', tactical: null, freeUsed: [] };
  const p = player(s, pid);
  p.turnBuffs = {};
  s.wait = { type: 'turn', players: [pid] };
}

function endTurn(s) {
  const order = turnOrder(s);
  const cur = s.turn.player;
  player(s, cur).turnBuffs = {};
  const idx = order.indexOf(cur);
  for (let i = 1; i <= order.length; i++) {
    const nid = order[(idx + i) % order.length];
    if (!player(s, nid).passed) { startTurn(s, nid); return; }
  }
  beginStatus(s);
}

function beginStatus(s) {
  s.phase = 'status';
  s.turn = null;
  log(s, 'Statusphase: Ziele erfüllen und Kommandomarker verteilen.');
  s.wait = { type: 'status', players: [...s.seat], done: {} };
}

function submitStatus(s, p, a) {
  need(s.phase === 'status' && s.wait.players.includes(p.id), 'Du hast die Statusphase schon abgeschlossen.');
  const gain = 2 + (hasTech(p, 'g_spark') ? 1 : 0);
  const t = a.tokens || {};
  const total = p.tokens.tactic + p.tokens.fleet + p.tokens.strategy + gain;
  const nt = { tactic: Math.max(0, t.tactic | 0), fleet: Math.max(0, t.fleet | 0), strategy: Math.max(0, t.strategy | 0) };
  need(nt.tactic + nt.fleet + nt.strategy === total, `Du musst genau ${total} Kommandomarker verteilen.`);
  need(nt.fleet >= 1, 'Mindestens 1 Flottenmarker nötig.');
  // Ziele prüfen, bevor etwas verändert wird
  if (a.publicId) {
    const o = s.publicObjectives.find((x) => x.id === a.publicId);
    need(o && !o.scoredBy.includes(p.id) && checkObjective(s, p, a.publicId), 'Dieses öffentliche Ziel kannst du nicht erfüllen.');
  }
  if (a.secretId) need(p.secrets.includes(a.secretId) && checkObjective(s, p, a.secretId), 'Dieses geheime Ziel kannst du nicht erfüllen.');
  s.wait.done[p.id] = { publicId: a.publicId || null, secretId: a.secretId || null, tokens: nt };
  s.wait.players = s.wait.players.filter((x) => x !== p.id);
  if (s.wait.players.length) return;
  // Alle fertig: in Initiative-Reihenfolge auswerten
  const done = s.wait.done;
  for (const pid of turnOrder(s)) {
    const q = player(s, pid); const d = done[pid];
    if (d.publicId && checkObjective(s, q, d.publicId)) scorePublic(s, q, d.publicId);
    if (s.winner) return;
    if (d.secretId && q.secrets.includes(d.secretId) && checkObjective(s, q, d.secretId)) scoreSecret(s, q, d.secretId);
    if (s.winner) return;
  }
  revealObjective(s);
  for (const pid of s.seat) {
    const q = player(s, pid);
    drawAction(s, q, 1 + (hasTech(q, 'y_oracle') ? 1 : 0) + (q.flags.extraActionCard || 0));
    q.tokens = done[pid].tokens;
  }
  for (const sys of Object.values(s.map)) { sys.tokens = []; sys.damaged = {}; }
  for (const q of s.players) for (const sys of Object.values(s.map)) {
    let over = countShips(sys, q.id, true) - q.tokens.fleet;
    if (over <= 0) continue;
    for (const t of SHIP_LOSS_ORDER) { if (t === 'fighter') continue; while (over > 0 && (shipsOf(sys, q.id)[t] || 0) > 0) { removeUnits(sys, q.id, t, 1); over--; } }
    cleanSys(sys); enforceCapacity(s, sys, q);
    log(s, `${q.name} hat in ${sysName(sys)} mehr Schiffe als Flottenmarker und muss überzählige auflösen.`);
  }
  for (const sys of Object.values(s.map)) for (const pl of sys.planets) pl.exhausted = false;
  for (const q of s.players) { q.cards = []; q.used = []; }
  if (!s.custodians) beginAgenda(s);
  else { s.round++; beginStrategy(s); }
}

// ---------------------------------------------------------------- Abstimmungsphase

function beginAgenda(s) {
  s.phase = 'agenda';
  s.agenda = { left: 2, current: null };
  nextAgenda(s);
}
function nextAgenda(s) {
  if (s.winner) return;
  if (s.agenda.left <= 0) {
    for (const sys of Object.values(s.map)) for (const pl of sys.planets) pl.exhausted = false;
    s.agenda = null;
    s.round++;
    beginStrategy(s);
    return;
  }
  s.agenda.left--;
  if (!s.decks.agenda.length) s.decks.agenda = shuffle(D.AGENDAS.map((a) => a.id));
  const id = s.decks.agenda.pop();
  s.agenda.current = id;
  const def = D.AGENDAS.find((a) => a.id === id);
  log(s, `Ratsbeschluss zur Abstimmung: ${def.name}`);
  const i = s.seat.indexOf(s.speaker);
  const order = [...s.seat.slice(i + 1), ...s.seat.slice(0, i + 1)];
  s.wait = { type: 'vote', players: order, votes: {}, sequential: true };
}
function submitVote(s, p, a) {
  need(s.phase === 'agenda' && s.wait.type === 'vote' && s.wait.players.includes(p.id), 'Du hast bereits abgestimmt.');
  need(s.wait.players[0] === p.id, `Erst stimmt ${pname(s, s.wait.players[0])} ab.`);
  const def = D.AGENDAS.find((x) => x.id === s.agenda.current);
  let outcome = a.outcome || null;
  let votes = 0;
  if (outcome) {
    if (def.kind === 'yesno') need(outcome === 'for' || outcome === 'against', 'Ungültige Wahl.');
    else need(player(s, outcome), 'Ungültiger Spieler.');
    const pv = payValue(s, p, { planets: a.planets || [] }, 'inf');
    applyPay(s, p, pv);
    votes = pv.total + (p.flags.voteBonus || 0);
  }
  s.wait.votes[p.id] = { outcome, votes };
  s.wait.players = s.wait.players.filter((x) => x !== p.id);
  if (s.wait.players.length) return;
  resolveAgenda(s, def);
}
function resolveAgenda(s, def) {
  const tally = {};
  for (const [pid, v] of Object.entries(s.wait.votes)) if (v.outcome) tally[v.outcome] = (tally[v.outcome] || 0) + v.votes;
  const lines = Object.entries(s.wait.votes).map(([pid, v]) => `${pname(s, pid)}: ${v.outcome ? (v.outcome === 'for' ? 'Dafür' : v.outcome === 'against' ? 'Dagegen' : pname(s, v.outcome)) + ' (' + v.votes + ')' : 'Enthaltung'}`);
  log(s, 'Abstimmung – ' + lines.join(', '));
  const entries = Object.entries(tally);
  let result = def.kind === 'yesno' ? 'against' : null;
  if (entries.length) {
    const max = Math.max(...entries.map((e) => e[1]));
    const top = entries.filter((e) => e[1] === max).map((e) => e[0]);
    if (top.length > 1) {
      log(s, `Gleichstand. ${pname(s, s.speaker)} entscheidet als Sprecher.`);
      s.wait = { type: 'tiebreak', players: [s.speaker], options: top, agenda: def.id };
      return;
    }
    result = top[0];
  }
  s.wait = null;
  applyAgenda(s, def, result);
  nextAgenda(s);
}
function submitTiebreak(s, p, a) {
  need(s.wait && s.wait.type === 'tiebreak' && s.wait.players[0] === p.id, 'Du musst keinen Gleichstand entscheiden.');
  need(s.wait.options.includes(a.outcome), 'Wähle eine der gleichauf liegenden Optionen.');
  const def = D.AGENDAS.find((x) => x.id === s.wait.agenda);
  s.wait = null;
  applyAgenda(s, def, a.outcome);
  nextAgenda(s);
}
function applyAgenda(s, def, result) {
  const label = result === 'for' ? 'Dafür' : result === 'against' ? 'Dagegen' : result ? pname(s, result) : 'niemand';
  log(s, `${def.name}: Ergebnis ${label}.`);
  const all = s.players;
  const tgt = result && player(s, result);
  switch (def.id) {
    case 'ag_bond': if (result === 'for') all.forEach((p) => { p.tg += 2; }); else all.forEach((p) => { if (p.tg > 3) p.tg -= 2; }); break;
    case 'ag_chanc': if (tgt) gainVP(s, tgt, 1, def.name); break;
    case 'ag_tax': if (result === 'for') { const o = s.map['0,0'].planets[0].owner; if (o) all.forEach((p) => { if (p.id !== o && p.tg > 0) { p.tg--; player(s, o).tg++; } }); } break;
    case 'ag_disarm':
      if (result === 'for') all.forEach((p) => { const sys = Object.values(s.map).find((x) => shipsOf(x, p.id).dreadnought); if (sys) { removeUnits(sys, p.id, 'dreadnought', 1); cleanSys(sys); } });
      else all.forEach((p) => { p.tg++; });
      break;
    case 'ag_grant': if (tgt) { tgt.tokens.tactic++; tgt.tg += 3; } break;
    case 'ag_census': if (result === 'for') all.forEach((p) => { const h = s.map[p.homeKey].planets.find((pl) => pl.owner === p.id); if (h) h.infantry++; }); break;
    case 'ag_censure': if (tgt && tgt.tokens.strategy > 0) tgt.tokens.strategy--; break;
    case 'ag_ready': if (result === 'for') Object.values(s.map).forEach((sys) => sys.planets.forEach((pl) => { pl.exhausted = false; })); else all.forEach((p) => drawAction(s, p, 1)); break;
    case 'ag_relic': if (tgt) { gainVP(s, tgt, 1, def.name); tgt.tg = Math.max(0, tgt.tg - 2); } break;
    case 'ag_patrol': if (result === 'for') all.forEach((p) => { p.tokens.fleet++; }); break;
    case 'ag_tariff': if (result === 'for') { all.forEach((p) => { if (p.id !== s.speaker && p.tg > 0) p.tg--; }); player(s, s.speaker).tg += 2; } break;
    case 'ag_lottery': if (tgt) tgt.tg += 4; break;
    case 'ag_morat': if (result === 'for') all.forEach((p) => { if (p.hand.length) s.decks.discard.push(p.hand.splice(Math.floor(Math.random() * p.hand.length), 1)[0]); }); else all.forEach((p) => drawAction(s, p, 1)); break;
    case 'ag_conscr': if (result === 'for') all.forEach((p) => { const hp = s.map[p.homeKey].planets.find((pl) => pl.owner === p.id); if (hp) hp.infantry += 2; }); break;
    case 'ag_amnesty': if (result === 'for') all.forEach((p) => { const sys = Object.values(s.map).find((x) => x.tokens.includes(p.id)); if (sys) { sys.tokens = sys.tokens.filter((t) => t !== p.id); p.tokens.tactic++; } }); break;
  }
}

// ---------------------------------------------------------------- Kampf

function rollUnits(s, p, groups, opts = {}) {
  // groups: [{type, n, hit, dice}]
  let hits = 0; const rolls = [];
  let rerollLeft = hasTech(p, 'r_ablat') && opts.combat ? 1 : 0;
  for (const g of groups) {
    for (let i = 0; i < g.n * g.dice; i++) {
      let r = d10();
      const mod = (opts.mod || 0) + (p.turnBuffs.overcharge && opts.combat ? 1 : 0);
      if (r + mod < g.hit && rerollLeft) { rerollLeft--; r = d10(); }
      rolls.push(r);
      if (r + mod >= g.hit) hits++;
    }
  }
  return { hits, rolls };
}

function assignShipHits(s, sys, p, hits, onlyFighters = false) {
  let destroyed = 0;
  const ships = shipsOf(sys, p.id);
  sys.damaged[p.id] = sys.damaged[p.id] || {};
  const dmg = sys.damaged[p.id];
  if (onlyFighters) {
    const k = Math.min(hits, ships.fighter || 0);
    removeUnits(sys, p.id, 'fighter', k); cleanSys(sys);
    return k;
  }
  // Zuerst Schadensresistenz nutzen
  for (const t of ['warsun', 'dreadnought']) {
    while (hits > 0 && (ships[t] || 0) > (dmg[t] || 0)) { dmg[t] = (dmg[t] || 0) + 1; hits--; }
  }
  for (const t of SHIP_LOSS_ORDER) {
    while (hits > 0 && (ships[t] || 0) > 0) { removeUnits(sys, p.id, t, 1); hits--; destroyed++; }
  }
  cleanSys(sys);
  return destroyed;
}

function shipGroups(s, sys, p, opts = {}) {
  const g = [];
  for (const [t, n] of Object.entries(shipsOf(sys, p.id))) {
    if (t === 'infantry' || !n) continue;
    const u = unitStat(p, t);
    g.push({ type: t, n, hit: u.combat, dice: u.dice || 1 });
  }
  return g;
}

function spaceCombat(s, sys, attId, defId) {
  const A = player(s, attId), B = player(s, defId);
  log(s, `Raumkampf in ${sysName(sys)}: ${A.name} gegen ${B.name}.`);
  const killed = { [attId]: 0, [defId]: 0 };
  // Flakfeuer (nur erste Runde)
  for (const [X, Y] of [[A, B], [B, A]]) {
    const bar = [];
    for (const [t, n] of Object.entries(shipsOf(sys, X.id))) { const u = unitStat(X, t); if (u.barrage && n) bar.push({ type: t, n, hit: u.barrage.hit, dice: u.barrage.dice }); }
    if (bar.length && (shipsOf(sys, Y.id).fighter || 0) > 0) {
      const r = rollUnits(s, X, bar);
      const k = assignShipHits(s, sys, Y, r.hits, true);
      killed[X.id] += k;
      log(s, `Flakfeuer von ${X.name}: [${r.rolls.join(' ')}] → ${k} Jäger zerstört.`);
    }
  }
  for (let round = 1; round <= 30; round++) {
    if (!countShips(sys, attId) || !countShips(sys, defId)) break;
    const modA = (round === 1 && hasTech(A, 'r_salvo') ? 1 : 0);
    const modB = (round === 1 && hasTech(B, 'r_salvo') ? 1 : 0) + (sys.anomaly === 'nebula' ? 1 : 0);
    const ra = rollUnits(s, A, shipGroups(s, sys, A), { mod: modA, combat: true });
    const rb = rollUnits(s, B, shipGroups(s, sys, B), { mod: modB, combat: true });
    const kb = assignShipHits(s, sys, B, ra.hits);
    const ka = assignShipHits(s, sys, A, rb.hits);
    killed[attId] += kb; killed[defId] += ka;
    log(s, `Runde ${round}: ${A.name} [${ra.rolls.join(' ')}] ${ra.hits} Treffer, ${B.name} [${rb.rolls.join(' ')}] ${rb.hits} Treffer.`);
  }
  const winner = countShips(sys, attId) ? attId : countShips(sys, defId) ? defId : null;
  for (const X of [A, B]) {
    if (killed[X.id] >= 3) X.events.kill3 = true;
    // Ohne Schiffe keine Fracht
    if (!countShips(sys, X.id)) { delete sys.ships[X.id]; }
    else enforceCapacity(s, sys, X);
  }
  log(s, winner ? `${pname(s, winner)} gewinnt den Raumkampf.` : 'Beide Flotten wurden vernichtet.');
  return winner;
}

function spaceCannonOffense(s, sys, attacker) {
  // Reihenfolge: aktiver Spieler zuerst, dann im Uhrzeigersinn
  const i0 = s.seat.indexOf(attacker.id);
  const order = [...s.seat.slice(i0), ...s.seat.slice(0, i0)];
  for (const pid of order) {
    const P2 = player(s, pid);
    // Ziel: Der aktive Spieler beschießt einen Gegner mit Schiffen hier, alle anderen beschießen den aktiven Spieler
    const targetId = pid === attacker.id ? enemiesIn(sys, pid)[0] : attacker.id;
    if (!targetId || !countShips(sys, targetId)) continue;
    const T2 = player(s, targetId);
    const groups = [];
    const cands = [sys, ...neighbors(s, sys.key).map((k) => s.map[k])];
    for (const c of cands) for (const pl of c.planets) {
      if (pl.owner !== pid || !pl.pds) continue;
      const u = unitStat(P2, 'pds');
      if (c !== sys && !(u.cannon.range >= 1)) continue;
      groups.push({ type: 'pds', n: pl.pds, hit: u.cannon.hit, dice: P2.flags.pdsDice || u.cannon.dice });
    }
    if (!groups.length) continue;
    const r = rollUnits(s, P2, groups);
    const k = assignShipHits(s, sys, T2, r.hits);
    log(s, `Orbitalgeschütze von ${P2.name} feuern auf ${T2.name}: [${r.rolls.join(' ')}] → ${r.hits} Treffer.`);
    if (k >= 3) P2.events.kill3 = true;
    enforceCapacity(s, sys, T2);
  }
}

function sysName(sys) {
  if (sys.planets.length) return sys.planets.map((p) => p.name).join('/');
  return ({ asteroid: 'Asteroidenfeld', nebula: 'Nebel', supernova: 'Supernova', rift: 'Schwerkraftriss' })[sys.anomaly] || (sys.wormhole ? `Wurmloch ${sys.wormhole}` : 'Leerer Raum') + ` (${sys.key})`;
}

function groundCombat(s, sys, pl, att, n) {
  const defId = pl.owner;
  const D2 = defId ? player(s, defId) : null;
  // Verteidigungsfeuer der Geschütze auf dem Planeten
  if (D2 && pl.pds && n > 0) {
    const u = unitStat(D2, 'pds');
    const r = rollUnits(s, D2, [{ type: 'pds', n: pl.pds, hit: u.cannon.hit, dice: D2.flags.pdsDice || u.cannon.dice }]);
    const k = Math.min(n, r.hits); n -= k;
    log(s, `Verteidigungsfeuer auf ${pl.name}: [${r.rolls.join(' ')}] → ${k} Infanterie verloren.`);
  }
  let def = D2 ? pl.infantry : 0;
  const gmod = (q) => (q.flags.groundBonus || 0) + (hasTech(q, 'g_gene') ? 1 : 0);
  for (let round = 1; n > 0 && def > 0 && round <= 40; round++) {
    const ia = unitStat(att, 'infantry'), idf = unitStat(D2, 'infantry');
    const ra = rollUnits(s, att, [{ type: 'infantry', n, hit: ia.combat, dice: 1 }], { mod: gmod(att), combat: true });
    const rd = rollUnits(s, D2, [{ type: 'infantry', n: def, hit: idf.combat, dice: 1 }], { mod: gmod(D2), combat: true });
    def = Math.max(0, def - ra.hits); n = Math.max(0, n - rd.hits);
    log(s, `Bodenkampf ${pl.name} Runde ${round}: ${att.name} [${ra.rolls.join(' ')}], ${D2.name} [${rd.rolls.join(' ')}].`);
  }
  if (D2) pl.infantry = def;
  if (n > 0) {
    if (defId && defId !== att.id) {
      att.events.conquer = true;
      log(s, `${att.name} erobert ${pl.name} von ${D2.name}.`);
    } else log(s, `${att.name} übernimmt ${pl.name}.`);
    if (pl.owner !== att.id) { pl.pds = 0; pl.dock = 0; pl.exhausted = true; }
    pl.owner = att.id; pl.infantry = n;
  } else if (D2) log(s, `${D2.name} hält ${pl.name}.`);
}


// ---------------------------------------------------------------- Interaktiver Raumkampf
// Ablauf je Runde: beide erklären (Rückzug ja/nein) -> Würfeln -> Verluste zuordnen -> Rückzug ausführen.

function startCombat(s, sys, attId, defId) {
  const A = player(s, attId), B = player(s, defId);
  log(s, `Raumkampf in ${sysName(sys)}: ${A.name} greift ${B.name} an.`);
  s.combat = { sys: sys.key, att: attId, def: defId, round: 0, killed: { [attId]: 0, [defId]: 0 }, retreat: {}, hits: {} };
  // Flakfeuer vor der ersten Runde
  for (const [X, Y] of [[A, B], [B, A]]) {
    const bar = [];
    for (const [t, n] of Object.entries(shipsOf(sys, X.id))) { const u = unitStat(X, t); if (u.barrage && n) bar.push({ type: t, n, hit: u.barrage.hit, dice: u.barrage.dice }); }
    if (bar.length && (shipsOf(sys, Y.id).fighter || 0) > 0) {
      const r = rollUnits(s, X, bar);
      const k = assignShipHits(s, sys, Y, r.hits, true);
      s.combat.killed[X.id] += k;
      log(s, `Flakfeuer von ${X.name}: [${r.rolls.join(' ')}] → ${k} Jäger zerstört.`);
    }
  }
  nextCombatRound(s);
}

function nextCombatRound(s) {
  const c = s.combat; const sys = s.map[c.sys];
  if (!countShips(sys, c.att) || !countShips(sys, c.def)) return endCombat(s);
  c.round++; c.retreat = {}; c.hits = {};
  s.wait = { type: 'combat', step: 'declare', players: [c.def, c.att], sequential: true };
}

function retreatTargets(s, sys, p) {
  return neighbors(s, sys.key, p).filter((k) => {
    const n = s.map[k];
    if (n.anomaly === 'supernova' || (n.anomaly === 'asteroid' && !hasTech(p, 'b_drift'))) return false;
    if (enemiesIn(n, p.id).length) return false;
    return countShips(n, p.id) > 0 || n.planets.some((pl) => pl.owner === p.id);
  });
}

function combatDeclare(s, p, a) {
  const c = s.combat; const sys = s.map[c.sys];
  if (a.retreat) {
    need(!(p.id === c.att && c.retreat[c.def]), 'Der Verteidiger zieht sich bereits zurück; in dieser Runde kannst du dich nicht zurückziehen.');
    need(retreatTargets(s, sys, p).includes(a.retreat), 'Rückzug nur in ein angrenzendes System mit eigenen Einheiten oder Planeten und ohne fremde Schiffe.');
    c.retreat[p.id] = a.retreat;
  }
  // Erst der Verteidiger, dann der Angreifer
  s.wait.players = s.wait.players.filter((x) => x !== p.id);
  if (s.wait.players.length) return;
  // Beide haben erklärt: würfeln
  const A = player(s, c.att), B = player(s, c.def);
  const modA = (c.round === 1 && hasTech(A, 'r_salvo') ? 1 : 0);
  const modB = (c.round === 1 && hasTech(B, 'r_salvo') ? 1 : 0) + (sys.anomaly === 'nebula' ? 1 : 0);
  const ra = rollUnits(s, A, shipGroups(s, sys, A), { mod: modA, combat: true });
  const rb = rollUnits(s, B, shipGroups(s, sys, B), { mod: modB, combat: true });
  log(s, `Runde ${c.round}: ${A.name} würfelt [${ra.rolls.join(' ')}] = ${ra.hits} Treffer, ${B.name} würfelt [${rb.rolls.join(' ')}] = ${rb.hits} Treffer.`);
  c.hits = { [c.def]: ra.hits, [c.att]: rb.hits };
  const who = [c.att, c.def].filter((id) => c.hits[id] > 0 && countShips(sys, id) > 0);
  if (!who.length) return finishRound(s);
  s.wait = { type: 'combat', step: 'assign', players: who };
}

// Verluste: { destroy: {typ: n}, damage: {typ: n} } – oder auto: true
function combatAssign(s, p, a) {
  const c = s.combat; const sys = s.map[c.sys];
  const hits = c.hits[p.id];
  const ships = shipsOf(sys, p.id);
  if (a.auto) {
    const before = countShips(sys, p.id);
    assignShipHits(s, sys, p, hits);
    c.killed[p.id === c.att ? c.def : c.att] += before - countShips(sys, p.id);
  } else {
    sys.damaged[p.id] = sys.damaged[p.id] || {};
    const dmg = sys.damaged[p.id];
    let used = 0;
    const destroy = {}, damage = {};
    for (const [t, n0] of Object.entries(a.damage || {})) {
      const n = Math.max(0, n0 | 0); if (!n) continue;
      need(unitStat(p, t).sustain, `${D.UNITS[t].name} hat keine Schadensresistenz.`);
      need((ships[t] || 0) - (dmg[t] || 0) >= n, `Nicht genug unbeschädigte ${D.UNITS[t].name}.`);
      damage[t] = n; used += n;
    }
    for (const [t, n0] of Object.entries(a.destroy || {})) {
      const n = Math.max(0, n0 | 0); if (!n) continue;
      need(SHIP_TYPES.includes(t) && (ships[t] || 0) >= n, `Nicht genug ${D.UNITS[t] ? D.UNITS[t].name : t}.`);
      destroy[t] = n; used += n;
    }
    const units = Object.entries(ships).reduce((acc, [t, n]) => acc + (t === 'infantry' ? 0 : n), 0);
    const sustainLeft = Object.entries(ships).reduce((acc, [t, n]) => acc + (unitStat(p, t).sustain ? n - (dmg[t] || 0) : 0), 0);
    const maxAbsorb = units + sustainLeft;
    need(used === Math.min(hits, maxAbsorb), `Du musst genau ${Math.min(hits, maxAbsorb)} Treffer zuordnen.`);
    for (const [t, n] of Object.entries(damage)) dmg[t] = (dmg[t] || 0) + n;
    let k = 0;
    for (const [t, n] of Object.entries(destroy)) { removeUnits(sys, p.id, t, n); k += n; }
    c.killed[p.id === c.att ? c.def : c.att] += k;
    cleanSys(sys);
  }
  s.wait.players = s.wait.players.filter((x) => x !== p.id);
  if (!s.wait.players.length) finishRound(s);
}

function finishRound(s) {
  const c = s.combat; const sys = s.map[c.sys];
  for (const id of [c.att, c.def]) {
    const P2 = player(s, id);
    if (countShips(sys, id)) enforceCapacity(s, sys, P2);
    const to = c.retreat[id];
    if (to && countShips(sys, id)) {
      const dest = s.map[to];
      for (const [t, n] of Object.entries(shipsOf(sys, id))) addUnits(dest, id, t, n);
      if (sys.damaged[id]) { dest.damaged[id] = dest.damaged[id] || {}; for (const [t, n] of Object.entries(sys.damaged[id])) dest.damaged[id][t] = (dest.damaged[id][t] || 0) + n; delete sys.damaged[id]; }
      delete sys.ships[id];
      if (!dest.tokens.includes(id)) dest.tokens.push(id);
      log(s, `${P2.name} zieht sich nach ${sysName(dest)} zurück.`);
    }
  }
  if (!countShips(sys, c.att) || !countShips(sys, c.def) || Object.keys(c.retreat).length) return endCombat(s);
  nextCombatRound(s);
}

function endCombat(s) {
  const c = s.combat; const sys = s.map[c.sys];
  for (const id of [c.att, c.def]) {
    if (c.killed[id] >= 3) player(s, id).events.kill3 = true;
    if (!countShips(sys, id)) delete sys.ships[id];
  }
  const winner = countShips(sys, c.att) ? c.att : countShips(sys, c.def) ? c.def : null;
  log(s, winner ? `${pname(s, winner)} behauptet das Feld in ${sysName(sys)}.` : 'Keine Flotte bleibt zurück.');
  cleanSys(sys);
  s.combat = null;
  s.wait = { type: 'turn', players: [s.turn.player] };
  // Angreifer verloren: Landung entfällt
  if (s.turn.tactical && (!countShips(sys, s.turn.player) || enemiesIn(sys, s.turn.player).length)) s.turn.tactical.stage = 'produce';
}

// ---------------------------------------------------------------- Bewegung

// Kürzeste Distanz (Dijkstra) von from nach to für Spieler p; Risse kosten 0 beim Durchqueren.
function pathInfo(s, p, from, to) {
  const dist = { [from]: 0 }; const viaRift = { [from]: s.map[from].anomaly === 'rift' };
  const q = [from]; const seen = new Set();
  while (q.length) {
    q.sort((a, b) => dist[a] - dist[b] || (viaRift[a] - viaRift[b]));
    const cur = q.shift();
    if (seen.has(cur)) continue; seen.add(cur);
    if (cur === to) break;
    const cs = s.map[cur];
    if (cur !== from) {
      // Durchqueren erlaubt?
      if (cs.anomaly === 'supernova' || (cs.anomaly === 'nebula' && !p.flags.nebulaPass)) continue;
      if (cs.anomaly === 'asteroid' && !hasTech(p, 'b_drift')) continue;
      if (Object.keys(cs.ships).some((o) => o !== p.id && countShips(cs, o, true) > 0)) continue;
    }
    for (const nk of neighbors(s, cur, p)) {
      const ns = s.map[nk];
      if (ns.anomaly === 'supernova') continue;
      if (ns.anomaly === 'asteroid' && !hasTech(p, 'b_drift')) continue;
      const cost = dist[cur] + (cs.anomaly === 'rift' ? 0 : 1);
      const rift = viaRift[cur] || cs.anomaly === 'rift';
      if (dist[nk] === undefined || cost < dist[nk] || (cost === dist[nk] && viaRift[nk] && !rift)) {
        dist[nk] = cost; viaRift[nk] = rift; q.push(nk);
      }
    }
  }
  if (dist[to] === undefined) return null;
  // Riss als Startsystem gibt +1 Bewegung: Distanz entsprechend reduzieren
  return { dist: dist[to], rift: !!viaRift[to] };
}

function doMove(s, p, moves) {
  const T = s.turn.tactical;
  const target = s.map[T.system];
  moves = Array.isArray(moves) ? moves : [];
  const usedFrom = new Set();
  const plan = [];
  for (const m of moves) {
    const from = s.map[m.from];
    need(from, 'Unbekanntes Startsystem.');
    need(m.from !== T.system, 'Schiffe im Zielsystem bleiben einfach dort.');
    need(!from.tokens.includes(p.id), `Aus ${sysName(from)} kannst du nicht ziehen: dort liegt dein Kommandomarker.`);
    need(!usedFrom.has(m.from), 'Jedes Startsystem nur einmal angeben.');
    usedFrom.add(m.from);
    const own = shipsOf(from, p.id);
    const ships = {}; let any = false;
    for (const [t, n0] of Object.entries(m.ships || {})) {
      const n = Math.max(0, n0 | 0); if (!n) continue;
      need(SHIP_TYPES.includes(t), 'Ungültiger Schiffstyp.');
      need((own[t] || 0) >= n, `Nicht genug ${D.UNITS[t].name} in ${sysName(from)}.`);
      ships[t] = n; any = true;
    }
    if (!any) continue;
    const info = pathInfo(s, p, m.from, T.system);
    need(info, `${sysName(target)} ist von ${sysName(from)} aus nicht erreichbar.`);
    let capOut = 0;
    for (const [t, n] of Object.entries(ships)) {
      const u = unitStat(p, t);
      let mv = u.move;
      if (from.anomaly === 'nebula' && !p.flags.nebulaPass) mv = Math.min(mv, 1);
      if (t === 'fighter' && mv === 0) continue;
      need(mv >= info.dist, `${u.name} hat Bewegung ${mv}, nötig wären ${info.dist}.`);
      capOut += (u.capacity || 0) * n;
    }
    const fightersCarried = unitStat(p, 'fighter').move > 0 ? 0 : (ships.fighter || 0);
    const infSpace = Math.max(0, (m.infantry | 0));
    need(infSpace <= (own.infantry || 0), 'So viel Infanterie ist dort nicht im All.');
    let infPlanets = 0;
    const fromPlanets = {};
    for (const [pn, c0] of Object.entries(m.fromPlanets || {})) {
      const c = Math.max(0, c0 | 0); if (!c) continue;
      const pl = from.planets.find((x) => x.name === pn);
      need(pl && pl.owner === p.id && pl.infantry >= c, `Auf ${pn} ist nicht genug Infanterie.`);
      fromPlanets[pn] = c; infPlanets += c;
    }
    need(fightersCarried + infSpace + infPlanets <= capOut, `Kapazität überschritten: ${fightersCarried + infSpace + infPlanets} Plätze nötig, ${capOut} vorhanden.`);
    plan.push({ from, ships, infSpace, fromPlanets, rift: info.rift });
  }
  const incoming = plan.reduce((acc, m) => acc + Object.entries(m.ships).reduce((x, [t, n]) => x + (t === 'fighter' ? 0 : n), 0), 0);
  need(countShips(target, p.id, true) + incoming <= p.tokens.fleet, `Flottenlimit: Du darfst höchstens ${p.tokens.fleet} Schiffe (ohne Jäger) in einem System haben.`);
  // Ausführen
  for (const m of plan) {
    for (const [t, n] of Object.entries(m.ships)) { removeUnits(m.from, p.id, t, n); addUnits(target, p.id, t, n); }
    if (m.infSpace) { removeUnits(m.from, p.id, 'infantry', m.infSpace); addUnits(target, p.id, 'infantry', m.infSpace); }
    for (const [pn, c] of Object.entries(m.fromPlanets)) { m.from.planets.find((x) => x.name === pn).infantry -= c; addUnits(target, p.id, 'infantry', c); }
    cleanSys(m.from);
    const desc = Object.entries(m.ships).map(([t, n]) => `${n} ${D.UNITS[t].name}`).join(', ');
    log(s, `${p.name} bewegt ${desc} von ${sysName(m.from)} nach ${sysName(target)}.`);
    if (m.rift) {
      let lost = 0;
      for (const [t, n] of Object.entries(m.ships)) for (let i = 0; i < n; i++) if (d10() <= 3) { removeUnits(target, p.id, t, 1); lost++; }
      if (lost) log(s, `Der Schwerkraftriss zerreißt ${lost} Schiff(e) von ${p.name}.`);
      cleanSys(target);
      enforceCapacity(s, target, p);
    }
  }
  // Orbitalgeschütze und Raumkampf
  spaceCannonOffense(s, target, p);
  const foes = enemiesIn(target, p.id);
  T.stage = 'invade';
  if (countShips(target, p.id) && foes.length) startCombat(s, target, p.id, foes[0]);
}

function doInvade(s, p, a) {
  const T = s.turn.tactical;
  const sys = s.map[T.system];
  need(!enemiesIn(sys, p.id).length, 'Solange feindliche Schiffe im System sind, kannst du nicht landen.');
  const landings = a.landings || {};
  let total = 0;
  const targets = [];
  for (const [pn, c0] of Object.entries(landings)) {
    const c = Math.max(0, c0 | 0); if (!c) continue;
    const pl = sys.planets.find((x) => x.name === pn);
    need(pl, 'Unbekannter Planet.');
    total += c; targets.push({ pl, c });
  }
  need(total <= (shipsOf(sys, p.id).infantry || 0), 'So viel Infanterie hast du hier nicht im All.');
  const throne = targets.find((t) => t.pl.custodians);
  if (throne) {
    pay(s, p, a.custodianPay, 'inf', 6, 'Wächter der Thronwelt ablösen');
    throne.pl.custodians = false;
    s.custodians = false;
    log(s, `${p.name} löst die Wächter der Thronwelt ab. Ab jetzt tagt der Galaktische Rat.`);
    gainVP(s, p, 1, 'Wächter abgelöst');
    if (s.winner) return;
  }
  // Bombardement
  const bombers = [];
  for (const [t, n] of Object.entries(shipsOf(sys, p.id))) { const u = unitStat(p, t); if (u.bombard && n) bombers.push({ type: t, n, hit: u.bombard.hit, dice: u.bombard.dice }); }
  for (const { pl } of targets) {
    if (!bombers.length || !pl.owner || pl.owner === p.id || !pl.infantry) continue;
    const O = player(s, pl.owner);
    if (pl.pds > 0) { log(s, `Planetenschild schützt ${pl.name} vor Bombardement.`); continue; }
    if (hasTech(O, 'r_shield') && pl.infantry >= 2) { log(s, `Bunkerkuppeln schützen ${pl.name}.`); continue; }
    const r = rollUnits(s, p, bombers);
    pl.infantry = Math.max(0, pl.infantry - r.hits);
    log(s, `${p.name} bombardiert ${pl.name}: [${r.rolls.join(' ')}] → ${r.hits} Treffer.`);
  }
  for (const { pl, c } of targets) {
    removeUnits(sys, p.id, 'infantry', c);
    if (pl.owner === p.id) { pl.infantry += c; continue; }
    groundCombat(s, sys, pl, p, c);
  }
  cleanSys(sys);
  T.stage = 'produce';
}

function productionLimit(s, sys, p) {
  let lim = 0;
  for (const pl of sys.planets) if (pl.owner === p.id && pl.dock) lim += pl.dock * (pl.res + unitStat(p, 'dock').produce + (hasTech(p, 'y_logis') ? 2 : 0) + (p.flags.prodBonus || 0) + (p.turnBuffs && p.turnBuffs.refit ? 2 : 0));
  return lim;
}

function doProduce(s, p, sys, a) {
  need(hasDock(s, sys, p.id), 'In diesem System hast du keine Raumwerft.');
  const blockaded = enemiesIn(sys, p.id).length > 0 && !countShips(sys, p.id);
  const build = a.build || {};
  let units = 0, cost = 0;
  const plan = {};
  for (const [t, n0] of Object.entries(build)) {
    const n = Math.max(0, n0 | 0); if (!n) continue;
    const u = unitStat(p, t);
    need(D.UNITS[t] && !D.UNITS[t].structure, 'Diese Einheit kann nicht produziert werden.');
    if (u.needsTech) need(hasTech(p, u.needsTech), `${u.name} erfordert ${D.UPGRADES[u.needsTech].name}.`);
    if (blockaded) need(t === 'infantry', 'Die Raumwerft ist blockiert: Fremde Schiffe im System erlauben nur noch Bodentruppen.');
    units += n;
    cost += Math.ceil(n / (u.batch || 1)) * u.cost;
    plan[t] = n;
  }
  if (!units) return;
  need(units <= productionLimit(s, sys, p), `Produktionslimit ${productionLimit(s, sys, p)} überschritten.`);
  pay(s, p, a.pay, 'res', cost, 'Produktion');
  const dockPlanet = sys.planets.find((pl) => pl.owner === p.id && pl.dock);
  for (const [t, n] of Object.entries(plan)) {
    if (t === 'infantry') dockPlanet.infantry += n; else addUnits(sys, p.id, t, n);
  }
  if (hasTech(p, 'g_regen')) dockPlanet.infantry += 1;
  log(s, `${p.name} produziert in ${sysName(sys)}: ${Object.entries(plan).map(([t, n]) => `${n} ${D.UNITS[t].name}`).join(', ')}.`);
  if (!fleetCheck(s, sys, p)) fail(`Flottenlimit (${p.tokens.fleet}) in diesem System überschritten.`);
  const docks3 = sys.planets.filter((pl) => pl.owner === p.id).reduce((acc, pl) => acc + pl.dock, 0) * 3;
  const fighters = unitStat(p, 'fighter').move > 0 ? 0 : Math.max(0, (shipsOf(sys, p.id).fighter || 0) - docks3);
  need(fighters + (shipsOf(sys, p.id).infantry || 0) <= capacity(s, sys, p), 'Nicht genug Kapazität für so viele Jäger in diesem System.');
}

// ---------------------------------------------------------------- Strategiekarten

function canResearch(s, p, tech, ignoreOne) {
  const def = D.TECHS[tech] || D.UPGRADES[tech];
  need(def, 'Unbekannte Technologie.');
  need(!hasTech(p, tech), 'Diese Technologie besitzt du bereits.');
  const have = techCountByColor(p);
  // Planeten-Spezialisierungen als Ersatz-Voraussetzung (bereite eigene Planeten)
  for (const { pl } of controlled(s, p.id)) if (pl.tech && !pl.exhausted) have[pl.tech]++;
  let missing = 0;
  for (const [c, n] of Object.entries(def.prereq || {})) missing += Math.max(0, n - (have[c] || 0));
  let allowed = (ignoreOne ? 1 : 0) + (hasTech(p, 'y_singul') ? 1 : 0);
  need(missing <= allowed, `Für ${def.name} fehlen ${missing} Voraussetzung(en).`);
}
function research(s, p, tech) {
  // Fehlende Voraussetzungen über bereite Planeten mit passender Spezialisierung decken (diese werden erschöpft)
  const def0 = D.TECHS[tech] || D.UPGRADES[tech];
  const own = techCountByColor(p);
  for (const [c, n] of Object.entries(def0.prereq || {})) {
    let gap = n - (own[c] || 0);
    for (const { pl } of controlled(s, p.id)) {
      if (gap <= 0) break;
      if (pl.tech === c && !pl.exhausted) { pl.exhausted = true; gap--; log(s, `${p.name} erschöpft ${pl.name} für die Voraussetzung.`); }
    }
  }
  p.techs.push(tech);
  const def = D.TECHS[tech] || D.UPGRADES[tech];
  log(s, `${p.name} erforscht ${def.name}.`);
}

function placeStructure(s, p, planetName, type) {
  need(type === 'pds' || type === 'dock', 'Nur Raumwerft oder Orbitalgeschütz.');
  const f = findPlanet(s, planetName);
  need(f && f.pl.owner === p.id, 'Das ist nicht dein Planet.');
  if (type === 'dock') need(!f.pl.dock, 'Auf diesem Planeten steht bereits eine Raumwerft.');
  if (type === 'pds') need(f.pl.pds < 2, 'Höchstens 2 Orbitalgeschütze pro Planet.');
  f.pl[type]++;
  log(s, `${p.name} errichtet ${D.UNITS[type].name} auf ${f.pl.name}.`);
  return f.sys;
}

function distributeTokens(p, n, dist) {
  dist = dist || {};
  const t = Math.max(0, dist.tactic | 0), f = Math.max(0, dist.fleet | 0), st = Math.max(0, dist.strategy | 0);
  need(t + f + st === n, `Verteile genau ${n} Kommandomarker.`);
  p.tokens.tactic += t; p.tokens.fleet += f; p.tokens.strategy += st;
}

function readyPlanets(s, p, names) {
  for (const n of (names || []).slice(0, 2)) {
    const f = findPlanet(s, n);
    need(f && f.pl.owner === p.id, 'Das ist nicht dein Planet.');
    f.pl.exhausted = false;
  }
}

function strategyPrimary(s, p, card, a) {
  switch (card) {
    case 1: {
      const buy = Math.max(0, a.buy | 0);
      pay(s, p, a.pay, 'inf', buy * 3, 'Kommandomarker kaufen');
      distributeTokens(p, 3 + buy, a.dist);
      log(s, `${p.name} erhält ${3 + buy} Kommandomarker.`);
      break;
    }
    case 2: {
      const sys = s.map[a.system];
      need(sys && !sys.throne && sys.planets.some((pl) => pl.owner === p.id), 'Wähle ein System mit deinem Planeten (nicht die Thronwelt).');
      for (const pid of s.seat) if (pid !== p.id && !sys.tokens.includes(pid)) sys.tokens.push(pid);
      readyPlanets(s, p, a.ready);
      log(s, `${p.name} stellt ${sysName(sys)} unter diplomatischen Schutz.`);
      break;
    }
    case 3: {
      need(a.speaker && a.speaker !== p.id && player(s, a.speaker), 'Wähle einen anderen Spieler als Sprecher.');
      s.speaker = a.speaker;
      drawAction(s, p, 2);
      log(s, `${pname(s, a.speaker)} ist neuer Sprecher. ${p.name} zieht 2 Aktionskarten.`);
      break;
    }
    case 4: {
      if (!a.planet) { log(s, `${p.name} verzichtet auf einen Bau.`); break; }
      placeStructure(s, p, a.planet, a.structure);
      if (a.planet2) placeStructure(s, p, a.planet2, 'pds');
      break;
    }
    case 5: {
      p.tg += 3 + (p.flags.tradeBonus || 0); p.comm = p.commMax;
      for (const id of (a.refresh || [])) { const q = player(s, id); if (q && q.id !== p.id) { q.comm = q.commMax; log(s, `${p.name} füllt die Rohstoffe von ${q.name} kostenlos auf.`); } }
      log(s, `${p.name} erhält ${3 + (p.flags.tradeBonus || 0)} Handelswaren und füllt Rohstoffe auf.`);
      break;
    }
    case 6: {
      if (!a.system) { log(s, `${p.name} verzichtet auf das Zurückholen eines Kommandomarkers.`); break; }
      const sys = s.map[a.system];
      need(sys && sys.tokens.includes(p.id), 'Dort liegt kein Kommandomarker von dir.');
      need(['tactic', 'fleet', 'strategy'].includes(a.pool), 'Wähle einen Vorrat.');
      sys.tokens = sys.tokens.filter((x) => x !== p.id);
      p.tokens[a.pool]++;
      log(s, `${p.name} zieht einen Kommandomarker aus ${sysName(sys)} zurück.`);
      if (a.redistribute) {
        const r = a.redistribute; const tot = p.tokens.tactic + p.tokens.fleet + p.tokens.strategy;
        const nt = { tactic: Math.max(0, r.tactic | 0), fleet: Math.max(0, r.fleet | 0), strategy: Math.max(0, r.strategy | 0) };
        need(nt.tactic + nt.fleet + nt.strategy === tot, `Verteile genau ${tot} Kommandomarker.`);
        p.tokens = nt;
      }
      break;
    }
    case 7: {
      if (!a.tech) { log(s, `${p.name} verzichtet auf Forschung.`); break; }
      canResearch(s, p, a.tech);
      research(s, p, a.tech);
      if (a.tech2) {
        canResearch(s, p, a.tech2);
        pay(s, p, a.pay, 'res', 6, 'Zweite Forschung');
        research(s, p, a.tech2);
      }
      break;
    }
    case 8: {
      if (a.objective) scorePublic(s, p, a.objective);
      if (s.winner) return;
      if (s.map['0,0'].planets[0].owner === p.id) gainVP(s, p, 1, 'Herrschaft über die Thronwelt');
      else { drawSecret(s, p); log(s, `${p.name} zieht ein geheimes Ziel.`); }
      break;
    }
  }
}

function strategySecondary(s, p, card, a) {
  if (card !== 1) {
    need(p.tokens.strategy > 0, 'Du hast keinen Strategiemarker.');
    p.tokens.strategy--;
  }
  switch (card) {
    case 1: {
      const buy = Math.max(0, a.buy | 0);
      need(buy > 0, 'Kaufe mindestens 1 Marker oder verzichte.');
      pay(s, p, a.pay, 'inf', buy * 3, 'Kommandomarker kaufen');
      distributeTokens(p, buy, a.dist);
      break;
    }
    case 2: readyPlanets(s, p, a.ready); break;
    case 3: drawAction(s, p, 1); break;
    case 4: {
      const sys = placeStructure(s, p, a.planet, a.structure);
      if (!sys.tokens.includes(p.id)) sys.tokens.push(p.id);
      break;
    }
    case 5: p.comm = p.commMax; break;
    case 6: doProduce(s, p, s.map[p.homeKey], a); break;
    case 7: canResearch(s, p, a.tech); pay(s, p, a.pay, 'res', 4, 'Forschung'); research(s, p, a.tech); break;
    case 8: drawSecret(s, p); break;
  }
  log(s, `${p.name} folgt ${D.STRATEGY[card].name}.`);
}

// ---------------------------------------------------------------- Aktionskarten

function playActionCard(s, p, a) {
  const idx = p.hand.indexOf(a.card);
  need(idx >= 0, 'Diese Karte hast du nicht.');
  const def = D.ACTION_CARDS.find((c) => c.id === a.card);
  need(s.phase === 'action' && s.turn.player === p.id, 'Aktionskarten nur in deinem Zug.');
  if (def.timing === 'action') need(s.turn.step === 'choose', 'Diese Karte verbraucht deine Aktion; du hast sie schon genutzt.');
  switch (a.card) {
    case 'ac_repair': for (const sys of Object.values(s.map)) delete sys.damaged[p.id]; break;
    case 'ac_courier': p.tg += 2; break;
    case 'ac_spy': break;
    case 'ac_sabot': {
      const f = findPlanet(s, a.planet);
      need(f && f.pl.owner && f.pl.owner !== p.id && f.pl.pds > 0, 'Wähle einen gegnerischen Planeten mit Orbitalgeschütz.');
      need(countShips(f.sys, p.id) > 0, 'Du brauchst Schiffe in diesem System.');
      f.pl.pds--;
      break;
    }
    case 'ac_mobil': readyPlanets(s, p, a.planets); break;
    case 'ac_recall': {
      const sys = s.map[a.system];
      need(sys && sys.tokens.includes(p.id), 'Dort liegt kein Marker von dir.');
      need(!(s.turn.tactical && s.turn.tactical.system === a.system), 'Nicht das gerade aktivierte System.');
      sys.tokens = sys.tokens.filter((x) => x !== p.id); p.tokens.tactic++;
      break;
    }
    case 'ac_prosp': {
      const f = findPlanet(s, a.planet);
      need(f && f.pl.owner === p.id, 'Wähle einen deiner Planeten.');
      p.tg += f.pl.res;
      break;
    }
    case 'ac_troops': {
      const f = findPlanet(s, a.planet);
      need(f && f.pl.owner === p.id, 'Wähle einen deiner Planeten.');
      f.pl.infantry += 2;
      break;
    }
    case 'ac_overch': p.turnBuffs.overcharge = true; break;
    case 'ac_blackm': need(p.tg >= 3, 'Du brauchst 3 Handelswaren.'); p.tg -= 3; p.tokens.tactic++; break;
    case 'ac_reinf': {
      const sys = s.map[a.system];
      need(sys && hasDock(s, sys, p.id) && !enemiesIn(sys, p.id).length, 'Wähle ein System mit deiner Raumwerft ohne feindliche Schiffe.');
      need(countShips(sys, p.id, true) < p.tokens.fleet, 'Flottenlimit erreicht.');
      addUnits(sys, p.id, 'cruiser', 1);
      break;
    }
    case 'ac_drill': p.tokens.fleet++; break;
    case 'ac_bribe': need(p.tg >= 2, 'Du brauchst 2 Handelswaren.'); p.tg -= 2; p.tokens.strategy++; break;
    case 'ac_embargo': {
      const t = player(s, a.target); need(t && t.id !== p.id, 'Wähle einen anderen Spieler.');
      t.tg = Math.max(0, t.tg - 2);
      break;
    }
    case 'ac_relocate': {
      const f1 = findPlanet(s, a.from), f2 = findPlanet(s, a.to);
      need(f1 && f2 && f1.sys === f2.sys && f1.pl.owner === p.id && f2.pl.owner === p.id && f1.pl !== f2.pl, 'Wähle zwei deiner Planeten im selben System.');
      const n = Math.min(3, Math.max(1, a.count | 0), f1.pl.infantry);
      need(n > 0, 'Dort ist keine Infanterie.');
      f1.pl.infantry -= n; f2.pl.infantry += n;
      break;
    }
    case 'ac_refit': p.turnBuffs.refit = true; break;
    case 'ac_comet': {
      const f = findPlanet(s, a.planet);
      need(f && f.pl.owner && f.pl.owner !== p.id && f.pl.infantry > 0, 'Wähle einen gegnerischen Planeten mit Infanterie.');
      const near = [f.sys.key, ...neighbors(s, f.sys.key)].some((k) => countShips(s.map[k], p.id) > 0);
      need(near, 'Du brauchst Schiffe in diesem oder einem angrenzenden System.');
      f.pl.infantry--;
      break;
    }
  }
  p.hand.splice(idx, 1);
  s.decks.discard.push(a.card);
  if (a.card === 'ac_spy') drawAction(s, p, 2);
  log(s, `${p.name} spielt die Aktionskarte "${def.name}".`);
  if (def.timing === 'action') { s.turn.step = 'done'; }
}

// ---------------------------------------------------------------- Zentrale Aktionsverarbeitung

function act(s, pid, a) {
  const p = player(s, pid);
  need(p, 'Unbekannter Spieler.');
  need(a && typeof a.type === 'string', 'Ungültige Aktion.');
  if (s.phase === 'ended') fail('Das Spiel ist vorbei.');
  // Lobby
  if (a.type === 'chooseFaction') {
    need(s.phase === 'lobby', 'Das Spiel läuft bereits.');
    need(D.FACTIONS[a.faction], 'Unbekannte Fraktion.');
    need(!s.players.some((x) => x.id !== pid && x.faction === a.faction), 'Diese Fraktion ist schon vergeben.');
    p.faction = a.faction; return;
  }
  if (a.type === 'start') return startGame(s, pid);
  if (a.type === 'addBot' || a.type === 'removeBot') {
    need(s.phase === 'lobby', 'Das Spiel läuft bereits.');
    if (a.type === 'removeBot') { s.players = s.players.filter((x) => x.id !== a.id || !x.bot); return; }
    need(s.players.length < 6, 'Das Spiel ist voll.');
    const free = Object.keys(D.FACTIONS).filter((f) => !s.players.some((x) => x.faction === f));
    need(free.length, 'Keine Fraktion mehr frei.');
    const f = free[Math.floor(Math.random() * free.length)];
    const id = 'bot' + Math.random().toString(36).slice(2, 8);
    addPlayer(s, id, 'KI ' + D.FACTIONS[f].name.split(' ').pop());
    const bp = player(s, id); bp.faction = f; bp.bot = true;
    return;
  }
  if (a.type === 'give') {
    need(s.phase !== 'lobby', 'Das Spiel läuft noch nicht.');
    const to = player(s, a.to); need(to && to.id !== pid, 'Ungültiger Empfänger.');
    const tg = Math.max(0, a.tg | 0), comm = Math.max(0, a.comm | 0);
    need(tg <= p.tg && comm <= p.comm, 'So viel hast du nicht.');
    p.tg -= tg; p.comm -= comm; to.tg += tg + comm;
    log(s, `${p.name} gibt ${to.name} ${tg + comm} Handelsware(n).`);
    return;
  }
  if (a.type === 'pick') return pickStrategy(s, p, a.card | 0);
  if (a.type === 'secretPick') return pickSecret(s, p, a);
  if (a.type === 'tiebreak') return submitTiebreak(s, p, a);
  if (a.type === 'status') return submitStatus(s, p, a);
  if (a.type === 'vote') return submitVote(s, p, a);
  if (a.type === 'combat') {
    need(s.wait && s.wait.type === 'combat' && s.wait.players.includes(pid), 'Im Moment ist keine Kampfentscheidung von dir nötig.');
    need(!s.wait.sequential || s.wait.players[0] === pid, 'Erst entscheidet der Verteidiger über einen Rückzug.');
    return s.wait.step === 'declare' ? combatDeclare(s, p, a) : combatAssign(s, p, a);
  }
  if (a.type === 'secondary') {
    need(s.wait && s.wait.type === 'secondary' && s.wait.players.includes(pid), 'Hier gibt es nichts zu folgen.');
    if (!a.skip) strategySecondary(s, p, s.wait.card, a);
    s.wait.players = s.wait.players.filter((x) => x !== pid);
    if (!s.wait.players.length && !s.winner) { s.wait = { type: 'turn', players: [s.turn.player] }; }
    return;
  }

  // Ab hier: eigener Zug in der Aktionsphase
  need(s.phase === 'action' && s.turn && s.turn.player === pid, 'Du bist nicht am Zug.');
  need(s.wait && s.wait.type === 'turn', 'Warte, bis die Mitspieler ihre Entscheidung getroffen haben.');
  const T = s.turn;
  switch (a.type) {
    case 'playCard': return playActionCard(s, p, a);
    case 'activate': {
      need(T.step === 'choose', 'Du hast in diesem Zug bereits gehandelt.');
      const sys = s.map[a.system];
      need(sys, 'Unbekanntes System.');
      need(!sys.tokens.includes(pid), 'Dieses System hast du bereits aktiviert.');
      need(p.tokens.tactic > 0, 'Keine Taktikmarker mehr.');
      need(sys.anomaly !== 'supernova', 'Eine Supernova kann nicht aktiviert werden.');
      p.tokens.tactic--; sys.tokens.push(pid);
      T.step = 'tactical'; T.tactical = { system: a.system, stage: 'move' };
      log(s, `${p.name} aktiviert ${sysName(sys)}.`);
      return;
    }
    case 'move': need(T.step === 'tactical' && T.tactical.stage === 'move', 'Bewegung ist gerade nicht möglich.'); return doMove(s, p, a.moves);
    case 'invade': need(T.step === 'tactical' && T.tactical.stage === 'invade', 'Landung ist gerade nicht möglich.'); return doInvade(s, p, a);
    case 'produce': {
      need(T.step === 'tactical' && T.tactical.stage === 'produce', 'Produktion ist gerade nicht möglich.');
      doProduce(s, p, s.map[T.tactical.system], a);
      T.step = 'done'; T.tactical = null;
      return;
    }
    case 'skipStage': {
      need(T.step === 'tactical', 'Keine Taktikaktion aktiv.');
      if (T.tactical.stage === 'move') { T.tactical.stage = 'invade'; if (enemiesIn(s.map[T.tactical.system], pid).length && countShips(s.map[T.tactical.system], pid)) T.tactical.stage = 'produce'; }
      else if (T.tactical.stage === 'invade') T.tactical.stage = 'produce';
      else { T.step = 'done'; T.tactical = null; }
      return;
    }
    case 'strategy': {
      need(T.step === 'choose', 'Du hast in diesem Zug bereits gehandelt.');
      const card = a.card | 0;
      need(p.cards.includes(card) && !p.used.includes(card), 'Diese Strategiekarte kannst du nicht spielen.');
      strategyPrimary(s, p, card, a);
      if (s.winner) return;
      if (hasTech(p, 'g_neural')) drawAction(s, p, 1);
      p.used.push(card);
      log(s, `${p.name} spielt die Strategiekarte ${D.STRATEGY[card].name}.`);
      T.step = 'done';
      const others = s.seat.filter((x) => x !== pid);
      if (others.length) s.wait = { type: 'secondary', card, players: others, active: pid };
      return;
    }
    case 'pass': {
      need(T.step === 'choose', 'Du hast in diesem Zug bereits gehandelt; beende den Zug.');
      need(p.cards.every((c) => p.used.includes(c)), 'Du musst erst alle deine Strategiekarten spielen.');
      p.passed = true;
      log(s, `${p.name} passt.`);
      if (p.flags.passIncome) { const g = Math.min(p.flags.passIncome, p.tokens.tactic); p.tg += g; if (g) log(s, `${p.name} erhält ${g} Handelswaren durch das Gelübde der Geduld.`); }
      return endTurn(s);
    }
    case 'endTurn': {
      need(T.step === 'done' || (T.step === 'tactical' && T.tactical.stage === 'produce'), 'Du musst zuerst eine Aktion ausführen (oder passen).');
      return endTurn(s);
    }
  }
  fail('Unbekannte Aktion.');
}

// ---------------------------------------------------------------- Sicht für einzelne Spieler

function view(s, pid) {
  const v = clone(s);
  delete v.decks;
  v.deckCounts = { action: s.decks.action ? s.decks.action.length : 0, secret: s.decks.secret ? s.decks.secret.length : 0 };
  for (const p of v.players) {
    if (p.id !== pid) {
      p.handCount = (p.hand || []).length; p.hand = [];
      p.secretCount = (p.secrets || []).length; p.secrets = [];
    } else if (s.phase !== 'lobby') {
      p.eligible = {
        public: s.publicObjectives.filter((o) => !o.scoredBy.includes(pid) && checkObjective(s, player(s, pid), o.id)).map((o) => o.id),
        secret: (p.secrets || []).filter((id) => checkObjective(s, player(s, pid), id)),
      };
    }
  }
  if (s.wait && s.wait.type === 'combat' && s.wait.step === 'declare' && s.wait.players.includes(pid)) {
    v.retreatOptions = retreatTargets(s, s.map[s.combat.sys], player(s, pid));
  }
  if (v.wait && v.wait.votes) v.wait.voted = Object.keys(v.wait.votes);
  if (v.wait && v.wait.done) { v.wait.submitted = Object.keys(v.wait.done); delete v.wait.done; }
  return v;
}

module.exports = { retreatTargets, hexDist, neighbors, controlled, hasDock, shipsOf, countShips, enemiesIn, canResearch, initiative, createGame, addPlayer, act, view, RuleError, player, pathInfo, productionLimit, unitStat, checkObjective };
