const E = require('../src/engine');
const { stepBots } = require('../src/botrunner');
let wins = 0, rounds = [];
const N = +(process.env.N || 5);
for (let g = 0; g < N; g++) {
  const room = { state: E.createGame('B' + g) };
  E.addPlayer(room.state, 'h', 'Host');
  room.state.players[0].faction = 'aurel'; room.state.players[0].bot = true;
  for (let i = 0; i < 4; i++) E.act(room.state, 'h', { type: 'addBot' });
  E.act(room.state, 'h', { type: 'start' });
  let steps = 0;
  while (room.state.phase !== 'ended' && steps < 20000 && room.state.round < 30) { if (!stepBots(room)) break; steps++; }
  const s = room.state;
  if (s.phase === 'ended') wins++;
  rounds.push(s.round);
  if (s.phase !== "ended" && process.env.V) console.log(s.log.slice(-12).map(l=>l.msg).join("\n"), JSON.stringify(s.turn), JSON.stringify(s.wait));
  console.log(`Partie ${g}: Runde ${s.round}, Phase ${s.phase}, Schritte ${steps}, SP ${s.players.map((p) => p.vp).join('/')}, Wächter ${s.custodians ? 'da' : 'weg'}`);
}
console.log(`${wins}/${N} Partien beendet`);
