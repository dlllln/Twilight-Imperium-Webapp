// Einfache KI für Sternenthron: liefert eine Liste von Aktionen in absteigender Priorität.
// Der Server probiert sie der Reihe nach auf einer Kopie aus und nimmt die erste gültige.
const D = require('./data');
const E = require('./engine');

const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

function readyPlanets(s, pid) { return E.controlled(s, pid).filter((x) => !x.pl.exhausted); }
function payAll(s, pid, kind, amount) {
  // Planeten mit dem höchsten Wert zuerst, bis der Betrag gedeckt ist
  const key = kind === 'res' ? 'res' : 'inf';
  const list = readyPlanets(s, pid).sort((a, b) => b.pl[key] - a.pl[key]);
  const planets = []; let sum = 0;
  for (const x of list) { if (sum >= amount) break; planets.push(x.pl.name); sum += x.pl[key]; }
  const p = E.player(s, pid);
  const tg = Math.min(p.tg, Math.max(0, amount - sum));
  return { planets, tg };
}
function resourcesReady(s, pid) { return readyPlanets(s, pid).reduce((a, x) => a + x.pl.res, 0) + E.player(s, pid).tg; }

function researchOptions(s, p) {
  const all = [...Object.keys(D.TECHS), ...Object.keys(D.UPGRADES)];
  const ok = [];
  for (const t of all) {
    try { E.canResearch(s, p, t); ok.push(t); } catch { /* nicht erforschbar */ }
  }
  // Bevorzugt: Verbesserungen für Kampf und Bewegung
  const pref = ['u_carrier', 'u_cruiser', 'b_hyper', 'u_dreadnought', 'b_field', 'u_fighter', 'r_salvo', 'u_infantry', 'y_logis', 'u_dock', 'g_gene'];
  return ok.sort((a, b) => (pref.indexOf(a) + 1 || 99) - (pref.indexOf(b) + 1 || 99));
}

function strategyParams(s, p, card) {
  const own = E.controlled(s, p.id);
  switch (card) {
    case 1: return [{ dist: { tactic: 2, fleet: 1, strategy: 0 } }];
    case 2: return [{ system: p.homeKey, ready: own.filter((x) => x.pl.exhausted).slice(0, 2).map((x) => x.pl.name) }];
    case 3: return [{ speaker: s.seat.find((x) => x !== p.id) }];
    case 4: {
      const noDock = own.filter((x) => !x.pl.dock && x.sys.home !== p.id).sort((a, b) => b.pl.res - a.pl.res);
      const opts = [];
      const pdsOk = own.filter((x) => x.pl.pds < 2).sort((a, b) => a.pl.pds - b.pl.pds);
      if (noDock[0]) {
        if (pdsOk[0]) opts.push({ planet: noDock[0].pl.name, structure: 'dock', planet2: pdsOk[0].pl.name });
        opts.push({ planet: noDock[0].pl.name, structure: 'dock' });
      }
      if (pdsOk[0]) opts.push({ planet: pdsOk[0].pl.name, structure: 'pds' });
      opts.push({});
      return opts;
    }
    case 5: return [{}];
    case 6: {
      const sys = Object.values(s.map).find((x) => x.tokens.includes(p.id));
      return [{ system: sys ? sys.key : undefined, pool: 'tactic' }];
    }
    case 7: {
      const r = researchOptions(s, p);
      const opts = [];
      if (r[0] && r[1] && resourcesReady(s, p.id) >= 10) opts.push({ tech: r[0], tech2: r[1], pay: payAll(s, p.id, 'res', 6) });
      if (r[0]) opts.push({ tech: r[0] });
      opts.push({});
      return opts;
    }
    case 8: {
      const ob = s.publicObjectives.find((o) => !o.scoredBy.includes(p.id) && E.checkObjective(s, p, o.id));
      return [{ objective: ob ? ob.id : undefined }];
    }
  }
  return [{}];
}

function secondaryChoice(s, p, card) {
  const res = resourcesReady(s, p.id);
  const opts = [];
  if (p.tokens.strategy > 1 || (p.tokens.strategy > 0 && [7, 8].includes(card))) {
    if (card === 7 && res >= 6) { const r = researchOptions(s, p); if (r[0]) opts.push({ tech: r[0], pay: payAll(s, p.id, 'res', 4) }); }
    if (card === 8 || card === 3 || card === 5) opts.push({});
  }
  opts.push({ skip: true });
  return opts.map((o) => ({ type: 'secondary', ...o }));
}

// Zielsysteme für Expansion: unkontrollierte oder gegnerische Planeten in Reichweite einer Trägerflotte
function expansionPlans(s, p) {
  const plans = [];
  const sources = Object.values(s.map).filter((sys) => !sys.tokens.includes(p.id) && (E.shipsOf(sys, p.id).carrier || E.shipsOf(sys, p.id).warsun || E.shipsOf(sys, p.id).dreadnought));
  for (const src of sources) {
    const ships = E.shipsOf(src, p.id);
    const avail = src.planets.filter((pl) => pl.owner === p.id).reduce((a, pl) => a + Math.max(0, pl.infantry - (src.home === p.id ? 1 : 0)), 0) + (ships.infantry || 0);
    if (!avail) continue;
    for (const tgt of Object.values(s.map)) {
      if (tgt.key === src.key || tgt.tokens.includes(p.id) || !tgt.planets.length) continue;
      const targets = tgt.planets.filter((pl) => pl.owner !== p.id && !(pl.custodians && E.controlled(s, p.id).filter((x) => !x.pl.exhausted).reduce((a, x) => a + x.pl.inf, 0) + p.tg < 6));
      if (!targets.length) continue;
      const info = E.pathInfo(s, p, src.key, tgt.key);
      if (!info) continue;
      // Welche Schiffe kommen an?
      const move = {}; let cap = 0;
      for (const [t, n] of Object.entries(ships)) {
        if (t === 'infantry' || t === 'fighter') continue;
        const u = E.unitStat(p, t);
        let mv = u.move; if (src.anomaly === 'nebula') mv = Math.min(mv, 1);
        if (mv >= info.dist) { move[t] = n; cap += (u.capacity || 0) * n; }
      }
      if (!cap) continue;
      const enemyShips = E.enemiesIn(tgt, p.id).reduce((a, o) => a + E.countShips(tgt, o), 0);
      const ourShips = Object.entries(move).reduce((a, [, n]) => a + n, 0);
      if (enemyShips && enemyShips >= ourShips) continue;
      const enemyInf = targets.reduce((a, pl) => a + (pl.owner ? pl.infantry : 0), 0);
      // Fracht: zuerst Infanterie im All, dann von Planeten
      let room = cap; const fromPlanets = {};
      const infSpace = Math.min(ships.infantry || 0, room); room -= infSpace;
      for (const pl of src.planets.filter((x) => x.owner === p.id)) {
        const keep = src.home === p.id ? 1 : 0;
        const take = Math.min(room, Math.max(0, pl.infantry - keep));
        if (take) { fromPlanets[pl.name] = take; room -= take; }
      }
      const carried = cap - room;
      if (carried <= enemyInf) continue;
      const value = targets.reduce((a, pl) => a + pl.res + pl.inf + (pl.custodians ? 6 : 0), 0) - info.dist - enemyInf * 2 + (enemyShips ? -2 : 0) + Math.random();
      plans.push({ value, target: tgt.key, move: { from: src.key, ships: move, infantry: infSpace, fromPlanets } });
    }
  }
  return plans.sort((a, b) => b.value - a.value);
}

function landingFor(s, p, sys) {
  const inf = E.shipsOf(sys, p.id).infantry || 0;
  const targets = sys.planets.filter((pl) => pl.owner !== p.id).sort((a, b) => (a.owner ? a.infantry : 0) - (b.owner ? b.infantry : 0));
  const out = {}; let left = inf;
  targets.forEach((pl, i) => {
    const need = (pl.owner ? pl.infantry : 0) + 1;
    const n = i === targets.length - 1 ? left : Math.min(left, need + 1);
    if (n > 0) { out[pl.name] = n; left -= n; }
  });
  const pay = sys.planets.some((pl) => pl.custodians && out[pl.name]) ? payAll(s, p.id, 'inf', 6) : undefined;
  return { landings: out, custodianPay: pay };
}

function buildFor(s, p, sys) {
  const lim = E.productionLimit(s, sys, p);
  let budget = resourcesReady(s, p.id);
  if (!lim || budget < 2) return null;
  const build = {}; let units = 0, cost = 0;
  const fleetRoom = p.tokens.fleet - E.countShips(sys, p.id, true);
  const add = (t, n) => {
    const u = E.unitStat(p, t);
    const c = Math.ceil(n / (u.batch || 1)) * u.cost;
    if (units + n > lim || cost + c > budget) return false;
    build[t] = (build[t] || 0) + n; units += n; cost += c; return true;
  };
  let shipsAdded = 0;
  const wantCarrier = !(E.shipsOf(sys, p.id).carrier) || Math.random() < 0.4;
  if (wantCarrier && shipsAdded < fleetRoom && add('carrier', 1)) shipsAdded++;
  add('infantry', 2);
  if (shipsAdded < fleetRoom && budget - cost >= 4 && add(Math.random() < 0.5 ? 'dreadnought' : 'cruiser', 1)) shipsAdded++;
  if (shipsAdded < fleetRoom && add('cruiser', 1)) shipsAdded++;
  add('fighter', 2);
  if (!units) return null;
  return { build, pay: payAll(s, p.id, 'res', cost) };
}

function turnActions(s, p) {
  const T = s.turn;
  const out = [];
  if (T.step === 'choose') {
    // Kostenlose Aktionskarten sofort nutzen, wenn sinnvoll
    for (const c of p.hand) {
      if (c === 'ac_courier') out.push({ type: 'playCard', card: c });
      if (c === 'ac_mobil' && E.controlled(s, p.id).some((x) => x.pl.exhausted)) out.push({ type: 'playCard', card: c, planets: E.controlled(s, p.id).filter((x) => x.pl.exhausted).map((x) => x.pl.name).slice(0, 2) });
    }
    if (out.length) return out;
    const unused = p.cards.filter((c) => !p.used.includes(c));
    // Strategiekarte spielen, wenn keine gute Expansion mehr möglich oder zufällig früh
    const plans = p.tokens.tactic > 0 ? expansionPlans(s, p) : [];
    if (unused.length && (!plans.length || Math.random() < 0.35 || p.tokens.tactic <= 1)) {
      for (const c of unused) for (const params of strategyParams(s, p, c)) out.push({ type: 'strategy', card: c, ...params });
    }
    for (const pl of plans.slice(0, 4)) out.push({ type: 'activate', system: pl.target, _plan: pl });
    // Produktion im Heimatsystem
    const home = s.map[p.homeKey];
    if (p.tokens.tactic > 0 && !home.tokens.includes(p.id) && buildFor(s, p, home)) out.push({ type: 'activate', system: home.key, _plan: { produceOnly: true } });
    for (const c of unused) for (const params of strategyParams(s, p, c)) out.push({ type: 'strategy', card: c, ...params });
    out.push({ type: 'pass' });
    return out;
  }
  if (T.step === 'tactical') {
    const sys = s.map[T.tactical.system];
    const st = T.tactical.stage;
    if (st === 'move') {
      const plan = T.botPlan;
      if (plan && plan.move) out.push({ type: 'move', moves: [plan.move] });
      out.push({ type: 'skipStage' });
    } else if (st === 'invade') {
      if (sys.planets.some((pl) => pl.owner !== p.id) && (E.shipsOf(sys, p.id).infantry || 0)) out.push({ type: 'invade', ...landingFor(s, p, sys) });
      // Infanterie, die übrig ist, auf eigenen Planeten absetzen
      const own = sys.planets.find((pl) => pl.owner === p.id);
      if (own && (E.shipsOf(sys, p.id).infantry || 0)) out.push({ type: 'invade', landings: { [own.name]: E.shipsOf(sys, p.id).infantry } });
      out.push({ type: 'skipStage' });
    } else {
      if (E.hasDock(s, sys, p.id)) { const b = buildFor(s, p, sys); if (b) out.push({ type: 'produce', ...b }); }
      out.push({ type: 'endTurn' });
    }
    return out;
  }
  out.push({ type: 'endTurn' });
  return out;
}

function candidates(s, pid) {
  const p = E.player(s, pid);
  const w = s.wait;
  if (!w || !w.players.includes(pid)) return [];
  switch (w.type) {
    case 'pick': {
      const pref = [7, 1, 8, 5, 4, 2, 3, 6];
      const pool = [...s.strategyPool].sort((a, b) => pref.indexOf(a) - pref.indexOf(b) + (s.strategyTG[b] || 0) - (s.strategyTG[a] || 0));
      return pool.map((c) => ({ type: 'pick', card: c }));
    }
    case 'secondary': return secondaryChoice(s, p, w.card);
    case 'status': {
      const gain = 2 + (p.techs.includes('g_spark') ? 1 : 0);
      const total = p.tokens.tactic + p.tokens.fleet + p.tokens.strategy + gain;
      const fleet = Math.min(Math.max(p.tokens.fleet, 3), total - 2);
      const strategy = Math.min(2, total - fleet - 1);
      const tokens = { tactic: total - fleet - strategy, fleet, strategy };
      const pub = s.publicObjectives.find((o) => !o.scoredBy.includes(pid) && E.checkObjective(s, p, o.id));
      const sec = p.secrets.find((id) => E.checkObjective(s, p, id));
      return [{ type: 'status', publicId: pub && pub.id, secretId: sec, tokens }, { type: 'status', tokens }];
    }
    case 'vote': {
      const def = D.AGENDAS.find((a) => a.id === s.agenda.current);
      const planets = readyPlanets(s, pid).slice(0, 2).map((x) => x.pl.name);
      if (def.kind === 'player') return [{ type: 'vote', outcome: pid, planets }, { type: 'vote', outcome: null }];
      const good = { ag_bond: 'for', ag_disarm: 'against', ag_census: 'for', ag_ready: 'for', ag_amnesty: 'for', ag_tax: s.map['0,0'].planets[0].owner === pid ? 'for' : 'against' };
      return [{ type: 'vote', outcome: good[def.id] || 'for', planets }, { type: 'vote', outcome: null }];
    }
    case 'combat': {
      if (w.step === 'assign') return [{ type: 'combat', auto: true }];
      const sys = s.map[s.combat.sys];
      const foe = s.combat.att === pid ? s.combat.def : s.combat.att;
      const mine = E.countShips(sys, pid), theirs = E.countShips(sys, foe);
      const opts = [];
      if (mine * 2 < theirs) { const t = E.retreatTargets(s, sys, p)[0]; if (t) opts.push({ type: 'combat', retreat: t }); }
      opts.push({ type: 'combat' });
      return opts;
    }
    case 'turn': return turnActions(s, p);
  }
  return [];
}

module.exports = { candidates, shuffle };
