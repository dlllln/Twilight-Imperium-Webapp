// Ersetzt im Einzelspieler-Build den Server: gleiche Nachrichten wie server.js, aber lokal im Browser.
(function () {
  const E = require('./engine'), D = require('./data'), { stepBots } = require('./botrunner');
  const KEY = 'st_solo_room';
  let room = null; let sock = null; let timer = null;
  const load = () => { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.state ? r : null; } catch { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ state: room.state, token: room.token })); } catch { /* egal */ } };
  const emit = (m) => setTimeout(() => sock && sock.onmessage && sock.onmessage({ data: JSON.stringify(m) }), 0);
  function broadcast() {
    room.state.version++;
    emit({ type: 'state', state: E.view(room.state, 'me'), you: 'me' });
    save();
    if (!timer) timer = setTimeout(() => { timer = null; if (stepBots(room)) broadcast(); }, 550);
  }
  function handle(msg) {
    try {
      if (msg.type === 'hello') return emit({ type: 'auth', ok: true, data: D, open: true });
      if (msg.type === 'create') {
        room = { state: E.createGame('SOLO'), token: 'solo' };
        E.addPlayer(room.state, 'me', msg.name);
        emit({ type: 'joined', code: 'SOLO', token: 'solo', pid: 'me' });
        return broadcast();
      }
      if (msg.type === 'join') {
        room = room || load();
        if (!room) return emit({ type: 'error', message: 'Kein Spiel mit diesem Code gefunden.' });
        emit({ type: 'joined', code: 'SOLO', token: 'solo', pid: 'me' });
        return broadcast();
      }
      if (msg.type === 'action' && room) {
        const copy = JSON.parse(JSON.stringify(room.state));
        E.act(copy, 'me', msg.action);
        room.state = copy;
        return broadcast();
      }
      if (msg.type === 'chat' && room) {
        room.state.chat = room.state.chat || [];
        room.state.chat.push({ name: E.player(room.state, 'me').name, text: String(msg.text).slice(0, 300), t: Date.now() });
        return broadcast();
      }
    } catch (e) {
      emit({ type: 'error', message: e instanceof E.RuleError ? e.message : 'Interner Fehler: ' + e.message });
    }
  }
  window.SoloSocket = function () {
    sock = this; this.readyState = 1;
    setTimeout(() => this.onopen && this.onopen(), 0);
  };
  window.SoloSocket.prototype.send = function (raw) { handle(JSON.parse(raw)); };
})();
