const E = require('../src/engine');
const s = E.createGame('C');
E.addPlayer(s, 'a', 'A'); E.addPlayer(s, 'b', 'B');
E.act(s, 'a', { type: 'chooseFaction', faction: 'eisen' }); E.act(s, 'b', { type: 'chooseFaction', faction: 'glut' });
E.act(s, 'a', { type: 'start' });
const ok = (pid, a) => { const c = JSON.parse(JSON.stringify(s)); E.act(c, pid, a); Object.assign(s, c); };
for (const id of [...s.wait.players]) ok(id, { type: 'secretPick', keep: E.player(s, id).secrets[0] });
while (s.phase === 'strategy') ok(s.wait.players[0], { type: 'pick', card: s.strategyPool[0] });
const att = s.turn.player, def = s.seat.find((x) => x !== att);
// Feindflotte neben Angreifer-Heimat platzieren
const home = s.map[E.player(s, att).homeKey];
const nb = E.neighbors(s, home.key).map((k) => s.map[k]).find((x) => !x.anomaly && x.planets.length);
home.ships[att] = { dreadnought: 2, carrier: 1 };
nb.ships[def] = { cruiser: 2, destroyer: 1 };
nb.planets[0].owner = def; // Rückzugsziel für Verteidiger ermöglichen? (eigener Planet im selben System zählt nicht)
ok(att, { type: 'activate', system: nb.key });
ok(att, { type: 'move', moves: [{ from: home.key, ships: { dreadnought: 2, carrier: 1 } }] });
console.log('wait', s.wait, 'combat', s.combat && s.combat.round);
let guard = 0;
while (s.combat && guard++ < 50) {
  const w = s.wait;
  for (const pid of [...w.players]) {
    if (w.step === 'declare') ok(pid, { type: 'combat' });
    else {
      const hits = s.combat.hits[pid];
      // manuell: Schlachtschiffe zuerst beschädigen, sonst automatisch
      const sys = s.map[s.combat.sys];
      const d = (sys.ships[pid] || {}).dreadnought || 0;
      const dmg = ((sys.damaged[pid] || {}).dreadnought) || 0;
      const absorb = Math.min(hits, d - dmg);
      try { if (absorb === hits) ok(pid, { type: 'combat', damage: { dreadnought: absorb } }); else ok(pid, { type: 'combat', auto: true }); }
      catch (e) { console.log('manual failed:', e.message); ok(pid, { type: 'combat', auto: true }); }
    }
  }
}
console.log(s.log.slice(-8).map((l) => l.msg).join('\n'));
console.log('stage', s.turn.tactical && s.turn.tactical.stage, 'wait', s.wait.type);
