// Führt genau einen Bot-Zug aus. Gibt true zurück, wenn ein Bot gehandelt hat.
const E = require('./engine');
const B = require('./bot');

function stepBots(room) {
  const s = room.state;
  if (!s.wait || s.phase === 'ended' || s.phase === 'lobby') return false;
  const botId = s.wait.players.find((id) => { const p = E.player(s, id); return p && p.bot; });
  if (!botId) return false;
  const cands = B.candidates(s, botId);
  const fallback = [{ type: 'endTurn' }, { type: 'skipStage' }, { type: 'pass' }, { type: 'secondary', skip: true }, { type: 'vote', outcome: null }];
  for (const a of [...cands, ...fallback]) {
    const copy = JSON.parse(JSON.stringify(s));
    const { _plan, ...action } = a;
    try {
      E.act(copy, botId, action);
      if (_plan && copy.turn && copy.turn.tactical) copy.turn.botPlan = _plan;
      room.state = copy;
      return true;
    } catch (e) {
      if (!(e instanceof E.RuleError)) { console.error('Bot-Fehler', e); }
    }
  }
  console.error('Bot', botId, 'findet keine gültige Aktion in', s.phase, s.wait.type, JSON.stringify(E.player(s, botId).cards), JSON.stringify(E.player(s, botId).used), cands.map((a) => { try { E.act(JSON.parse(JSON.stringify(s)), botId, a); return 'ok'; } catch (e) { return a.type + ':' + e.message; } }).join(' / '));
  return false;
}

module.exports = { stepBots };
