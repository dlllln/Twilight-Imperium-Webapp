// Sternenthron – Spielserver (HTTP für statische Dateien + WebSocket für das Spiel)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const E = require('./src/engine');
const D = require('./src/data');
const { stepBots } = require('./src/botrunner');
const BOT_DELAY = +(process.env.BOT_DELAY || 700);

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.GAME_PASSWORD || ''; // leer = kein Passwort
const MAX_ROOMS = +(process.env.MAX_ROOMS || 300);
const ROOM_TTL_MS = 1000 * 60 * 60 * 24 * 14; // ungenutzte Spiele nach 14 Tagen löschen
const SAVE_DIR = process.env.SAVE_DIR || path.join(__dirname, 'saves');
fs.mkdirSync(SAVE_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PUBLIC = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// rooms: code -> { state, tokens: {token: playerId}, sockets: Set }
const rooms = new Map();

function loadRooms() {
  for (const f of fs.readdirSync(SAVE_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, f), 'utf8'));
      const room = { state: r.state, tokens: r.tokens, sockets: new Set() };
      rooms.set(r.state.id, room);
      scheduleBots(room);
    } catch (e) { console.error('Konnte Spielstand nicht laden:', f, e.message); }
  }
}
function save(room) {
  const file = path.join(SAVE_DIR, room.state.id + '.json');
  fs.writeFile(file, JSON.stringify({ state: room.state, tokens: room.tokens }), () => {});
}

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(c));
  return c;
}

function broadcast(room) {
  room.state.version++;
  room.lastActive = Date.now();
  for (const ws of room.sockets) send(ws, { type: 'state', state: E.view(room.state, ws.pid), you: ws.pid });
  save(room);
  scheduleBots(room);
}
// Bots handeln nacheinander mit kurzer Pause, damit Menschen mitlesen können
function scheduleBots(room) {
  if (room.botTimer) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (stepBots(room)) broadcast(room);
  }, BOT_DELAY);
}
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  ws.authed = false;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try { handle(ws, msg); } catch (e) {
      if (!(e instanceof E.RuleError)) console.error(e);
      send(ws, { type: 'error', message: e instanceof E.RuleError ? e.message : 'Interner Fehler: ' + e.message });
    }
  });
  ws.on('close', () => { if (ws.room) ws.room.sockets.delete(ws); });
});

function handle(ws, msg) {
  if (msg.type === 'hello') {
    if (PASSWORD && msg.password !== PASSWORD) return send(ws, { type: 'auth', ok: false, message: 'Falsches Passwort.' });
    ws.authed = true;
    send(ws, { type: 'auth', ok: true, data: D, open: !PASSWORD });
    return;
  }
  if (!ws.authed) return send(ws, { type: 'error', message: 'Bitte zuerst das Passwort eingeben.' });

  if (msg.type === 'create' || msg.type === 'join') {
    let room;
    if (msg.type === 'create') {
      if (rooms.size >= MAX_ROOMS) cleanupRooms(true);
      if (rooms.size >= MAX_ROOMS) return send(ws, { type: 'error', message: 'Der Server ist gerade voll. Bitte später erneut versuchen.' });
      const code = newCode();
      room = { state: E.createGame(code), tokens: {}, sockets: new Set() };
      rooms.set(code, room);
    } else {
      room = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!room) return send(ws, { type: 'error', message: 'Kein Spiel mit diesem Code gefunden.' });
    }
    let pid = msg.token && room.tokens[msg.token];
    let token = msg.token;
    if (!pid) {
      if (room.state.phase !== 'lobby') return send(ws, { type: 'error', message: 'Das Spiel läuft bereits. Neue Spieler können nicht mehr beitreten.' });
      pid = 'p' + crypto.randomBytes(4).toString('hex');
      token = crypto.randomBytes(16).toString('hex');
      E.addPlayer(room.state, pid, msg.name);
      room.tokens[token] = pid;
    }
    if (ws.room) ws.room.sockets.delete(ws);
    ws.room = room; ws.pid = pid;
    room.sockets.add(ws);
    send(ws, { type: 'joined', code: room.state.id, token, pid });
    broadcast(room);
    return;
  }

  if (msg.type === 'action') {
    const room = ws.room;
    if (!room) return send(ws, { type: 'error', message: 'Du bist in keinem Spiel.' });
    // Auf einer Kopie arbeiten, damit ungültige Aktionen nichts halb verändern
    const copy = JSON.parse(JSON.stringify(room.state));
    E.act(copy, ws.pid, msg.action);
    room.state = copy;
    broadcast(room);
  }
  if (msg.type === 'chat' && ws.room) {
    const p = E.player(ws.room.state, ws.pid);
    const text = String(msg.text || '').slice(0, 300);
    if (!text) return;
    ws.room.state.chat = ws.room.state.chat || [];
    ws.room.state.chat.push({ name: p ? p.name : '?', text, t: Date.now() });
    if (ws.room.state.chat.length > 100) ws.room.state.chat.shift();
    broadcast(ws.room);
  }
}

loadRooms();
// Alte Spiele entfernen: beendete oder lange ungenutzte; bei force auch leere Lobbys ohne Verbindung
function cleanupRooms(force = false) {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.sockets.size) continue;
    const last = room.state.log.length ? room.state.log[room.state.log.length - 1].t : 0;
    const idle = now - (room.lastActive || last || 0);
    const stale = idle > ROOM_TTL_MS || (room.state.phase === 'ended' && idle > 1000 * 60 * 60 * 24) || (force && room.state.phase === 'lobby');
    if (stale) { rooms.delete(code); fs.unlink(path.join(SAVE_DIR, code + '.json'), () => {}); }
  }
}
setInterval(cleanupRooms, 1000 * 60 * 60);

server.listen(PORT, () => console.log(`Sternenthron läuft auf http://localhost:${PORT} (${PASSWORD ? 'mit Passwort' : 'öffentlich, ohne Passwort'})`));
