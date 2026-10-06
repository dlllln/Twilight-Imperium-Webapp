// Sternenthron – Browser-Client
'use strict';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const S = {
  ws: null, D: null, G: null, me: null, code: null, tab: 'zug', selected: null, mode: null,
  view: { x: -520, y: -460, w: 1040, h: 920 }, openPrompt: null,
};
const LS = {
  get(k) { try { return localStorage.getItem('st_' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('st_' + k, v); } catch { /* egal */ } },
};

// ------------------------------------------------------------ Verbindung
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  S.ws = new WebSocket(`${proto}://${location.host}`);
  S.ws.onopen = () => send({ type: 'hello', password: LS.get('pw') || '' });
  S.ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  S.ws.onclose = () => { toast('Verbindung verloren, verbinde neu …'); setTimeout(connect, 2000); };
}
function send(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }
function act(action) { send({ type: 'action', action }); }

function onMsg(m) {
  if (m.type === 'auth') {
    if (!m.ok) { const had = LS.get('pw'); LS.set('pw', ''); renderLogin(had ? m.message : ''); return; }
    S.D = m.data;
    const code = LS.get('code'), token = code && LS.get('tok_' + code);
    if (code && token) send({ type: 'join', code, token }); else renderMenu();
  } else if (m.type === 'joined') {
    S.code = m.code; S.me = m.pid; LS.set('code', m.code); LS.set('tok_' + m.code, m.token);
  } else if (m.type === 'state') {
    S.G = m.state; S.me = m.you; render();
  } else if (m.type === 'error') {
    toast(m.message);
    // Fehlgeschlagene Entscheidung erneut anbieten
    if (S.G && S.openPrompt && !$('.modal')) { S.openPrompt = null; autoPrompt(); }
    if (!S.G && /Kein Spiel|läuft bereits/.test(m.message)) { LS.set('code', ''); renderMenu(); }
  }
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 4500);
}

// ------------------------------------------------------------ Startbildschirme
function renderLogin(err) {
  $('#app').innerHTML = `<div class="center"><div class="card login col">
    <h1>STERNENTHRON</h1><div class="muted">Ein Strategiespiel um die Herrschaft über die Galaxis</div>
    <input id="pw" type="password" placeholder="Gruppenpasswort">
    ${err ? `<div style="color:var(--bad)">${esc(err)}</div>` : ''}
    <button class="primary" id="go">Weiter</button></div></div>`;
  const go = () => { LS.set('pw', $('#pw').value); send({ type: 'hello', password: $('#pw').value }); };
  $('#go').onclick = go; $('#pw').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#pw').focus();
}
function renderMenu() {
  S.G = null;
  $('#app').innerHTML = `<div class="center"><div class="card login col">
    <h1>STERNENTHRON</h1>
    <input id="name" placeholder="Dein Name" value="${esc(LS.get('name') || '')}">
    <button class="primary" id="create">Neues Spiel erstellen</button>
    <div class="row" style="justify-content:center"><input id="code" placeholder="Spielcode" style="width:140px;text-transform:uppercase"><button id="join">Beitreten</button></div>
  </div></div>`;
  const name = () => { const n = $('#name').value.trim() || 'Spieler'; LS.set('name', n); return n; };
  $('#create').onclick = () => send({ type: 'create', name: name() });
  $('#join').onclick = () => {
    const code = $('#code').value.trim().toUpperCase();
    send({ type: 'join', code, name: name(), token: LS.get('tok_' + code) || undefined });
  };
}

function renderLobby() {
  const G = S.G, D = S.D;
  const me = G.players.find((p) => p.id === S.me);
  $('#app').innerHTML = `<div class="center"><div class="card col" style="width:min(980px,100%)">
    <div class="row" style="justify-content:space-between"><h1>STERNENTHRON</h1>
      <div>Spielcode: <b style="font-size:22px;color:var(--gold);letter-spacing:.15em">${esc(G.id)}</b></div></div>
    <div class="muted">Gib deinen Freunden den Spielcode. Empfohlen sind 3 bis 6 Spieler.</div>
    <h3>Spieler (${G.players.length}/6)</h3>
    <div class="row">${G.players.map((p) => `<span class="chip">${p.bot ? '🤖 ' : ''}${esc(p.name)}${p.faction ? ' · ' + esc(D.FACTIONS[p.faction].name) : ' · <i>wählt …</i>'}${p.bot ? ` <button class="small rmbot" data-id="${p.id}">×</button>` : ''}</span>`).join('')}
      <button class="small" id="addbot" ${G.players.length >= 6 ? 'disabled' : ''}>+ KI-Gegner</button></div>
    <h3>Wähle deine Fraktion</h3>
    <div class="factions">${Object.entries(D.FACTIONS).map(([id, f]) => {
      const owner = G.players.find((p) => p.faction === id);
      const cls = owner ? (owner.id === S.me ? 'mine' : 'taken') : '';
      return `<div class="faction ${cls}" data-f="${id}"><div><span class="sw" style="background:${f.color}"></span><b>${esc(f.name)}</b></div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(f.ability)}</div>
        <div style="font-size:12px;margin-top:4px">Heimat: ${f.home.map((h) => `${esc(h.name)} (${h.res}/${h.inf})`).join(', ')}</div>
        ${owner ? `<div style="font-size:12px;color:var(--gold)">${esc(owner.name)}</div>` : ''}</div>`;
    }).join('')}</div>
    <div class="row"><button class="primary" id="start" ${G.players.length < 2 || !G.players.every((p) => p.faction) ? 'disabled' : ''}>Spiel starten</button>
    <button id="leave">Lobby verlassen</button>
    <span class="muted">${me && !me.faction ? 'Wähle zuerst eine Fraktion.' : ''}</span></div>
  </div></div>`;
  document.querySelectorAll('.faction').forEach((el) => { el.onclick = () => act({ type: 'chooseFaction', faction: el.dataset.f }); });
  $('#start').onclick = () => act({ type: 'start' });
  $('#addbot').onclick = () => act({ type: 'addBot' });
  document.querySelectorAll('.rmbot').forEach((el) => { el.onclick = () => act({ type: 'removeBot', id: el.dataset.id }); });
  $('#leave').onclick = () => { LS.set('code', ''); location.reload(); };
}

// ------------------------------------------------------------ Hilfen
const me = () => S.G.players.find((p) => p.id === S.me);
const P = (id) => S.G.players.find((p) => p.id === id);
const pcolor = (id) => (P(id) || {}).color || '#888';
const pnameC = (id) => `<span style="color:${pcolor(id)}">${esc((P(id) || {}).name || '?')}</span>`;
const systems = () => Object.values(S.G.map);
const myPlanets = () => systems().flatMap((sys) => sys.planets.filter((pl) => pl.owner === S.me).map((pl) => ({ ...pl, sys })));
const sysName = (sys) => sys.planets.length ? sys.planets.map((p) => p.name).join(' / ') :
  ({ asteroid: 'Asteroidenfeld', nebula: 'Nebel', supernova: 'Supernova', rift: 'Schwerkraftriss' }[sys.anomaly] || (sys.wormhole ? `Wurmloch ${sys.wormhole === 'alpha' ? 'α' : 'β'}` : 'Leerer Raum'));
const hasTech = (p, t) => p.techs.includes(t);
const isMyTurn = () => S.G.phase === 'action' && S.G.turn && S.G.turn.player === S.me && S.G.wait && S.G.wait.type === 'turn';
const SHIP_ORDER = ['warsun', 'dreadnought', 'carrier', 'cruiser', 'destroyer', 'fighter', 'infantry'];
const ABBR = { warsun: 'SB', dreadnought: 'S', carrier: 'T', cruiser: 'K', destroyer: 'Z', fighter: 'J', infantry: 'I', pds: 'G', dock: 'W' };
const ANOM_TEXT = {
  asteroid: 'Asteroidenfeld: nur mit „Driftnavigation“ befahrbar.',
  nebula: 'Nebel: nicht durchquerbar, nur als Ziel. Schiffe hier haben Bewegung 1; der Verteidiger erhält +1 im Raumkampf.',
  supernova: 'Supernova: unpassierbar.',
  rift: 'Schwerkraftriss: Durchflug oder Abflug gibt +1 Bewegung, aber jedes Schiff wird bei einer 1–3 zerstört.',
};

function unitStat(p, type) {
  const D = S.D; const u = JSON.parse(JSON.stringify(D.UNITS[type]));
  for (const [uid, up] of Object.entries(D.UPGRADES)) if (up.unit === type && hasTech(p, uid)) Object.assign(u, up.stats);
  if (u.ship && u.move > 0) {
    u.move += p.flags.moveBonus || 0;
    if (hasTech(p, 'b_hyper')) u.move += 1;
    if (hasTech(p, 'b_field') && (type === 'cruiser' || type === 'destroyer')) u.move += 1;
  }
  if (type === 'infantry' && p.flags.infantryBatch) u.batch = p.flags.infantryBatch;
  if (type === 'dreadnought' && p.flags.dreadDiscount) u.cost -= p.flags.dreadDiscount;
  return u;
}
function hexDist(a, b) { return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2; }

// ------------------------------------------------------------ Hauptansicht
function render() {
  const G = S.G;
  if (!G) return renderMenu();
  if (G.phase === 'lobby') return renderLobby();
  if (!$('.game')) {
    $('#app').innerHTML = `<div class="game"><div class="topbar" id="topbar"></div>
      <div class="mapwrap" id="mapwrap"></div><div class="side"><div class="tabs" id="tabs"></div><div class="tabbody" id="tabbody"></div></div></div>`;
    setupMap();
  }
  renderTop(); renderMap(); renderTabs(); renderTab();
  autoPrompt();
}

const PHASES = { strategy: 'Strategiephase', action: 'Aktionsphase', status: 'Statusphase', agenda: 'Ratsversammlung', ended: 'Spielende' };
function renderTop() {
  const G = S.G;
  const active = G.wait ? G.wait.players : [];
  $('#topbar').innerHTML = `<span class="brand">STERNENTHRON</span>
    <span>Runde ${G.round} · ${PHASES[G.phase] || G.phase}</span>
    <span class="muted">Sprecher: ${pnameC(G.speaker)}</span>
    <div class="vp">${G.players.map((p) => `<span class="${active.includes(p.id) ? 'turn' : ''}" style="border-color:${p.color}">${p.bot ? '🤖 ' : ''}${esc(p.name)} <b>${p.vp}</b> SP</span>`).join('')}</div>
    <span class="muted" style="margin-left:auto">Spiel ${esc(G.id)} · Ziel: ${S.D.VP_TO_WIN} SP</span>`;
}

// ------------------------------------------------------------ Karte
const HS = 60;
function hexXY(q, r) { return [HS * 1.5 * q, HS * Math.sqrt(3) * (r + q / 2)]; }
function hexPoints(cx, cy, s = HS) {
  return Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i; return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`; }).join(' ');
}
function hash(str) { let x = 0; for (const c of str) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); }
const TRAIT_COL = { kultur: ['#7fb4ff', '#2b4b9a'], industrie: ['#ffbf73', '#8a4a1c'], wildnis: ['#8fe07a', '#2f6b2a'] };

function setupMap() {
  const wrap = $('#mapwrap');
  wrap.innerHTML = `<svg id="map" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="g-throne"><stop offset="0" stop-color="#fff3c0"/><stop offset=".6" stop-color="#e6c35c"/><stop offset="1" stop-color="#7a5a10"/></radialGradient>
    <radialGradient id="g-nova"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffcf5c"/><stop offset=".7" stop-color="#e2461f"/><stop offset="1" stop-color="#2a0505" stop-opacity=".2"/></radialGradient>
    <radialGradient id="g-rift"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#1a0630"/><stop offset="1" stop-color="#6a2fb0" stop-opacity=".5"/></radialGradient>
    <radialGradient id="g-neb"><stop offset="0" stop-color="#d06fd9" stop-opacity=".7"/><stop offset="1" stop-color="#3b1a5c" stop-opacity=".2"/></radialGradient>
    ${Object.entries(TRAIT_COL).map(([t, [a, b]]) => `<radialGradient id="g-${t}" cx=".35" cy=".35"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`).join('')}
    <radialGradient id="g-home" cx=".35" cy=".35"><stop offset="0" stop-color="#f2f2f2"/><stop offset="1" stop-color="#505a7a"/></radialGradient>
  </defs><g id="stars"></g><g id="hexes"></g></svg><div class="maphint" id="maphint" style="display:none"></div>`;
  const svg = $('#map');
  // Sterne im Hintergrund
  let stars = '';
  for (let i = 0; i < 260; i++) stars += `<circle cx="${(Math.random() - .5) * 2400}" cy="${(Math.random() - .5) * 2000}" r="${Math.random() * 1.3}" fill="#fff" opacity="${.2 + Math.random() * .6}"/>`;
  $('#stars').innerHTML = stars;
  const setVB = () => svg.setAttribute('viewBox', `${S.view.x} ${S.view.y} ${S.view.w} ${S.view.h}`);
  setVB();
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = S.view.w / svg.clientWidth;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    S.view.x = drag.vx - dx * k; S.view.y = drag.vy - dy * k; setVB();
  });
  window.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const g = e.target.closest && e.target.closest('.hex');
      if (g) onHexClick(g.dataset.key);
    }
    drag = null;
  });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const r = svg.getBoundingClientRect();
    const mx = S.view.x + (e.clientX - r.left) / r.width * S.view.w, my = S.view.y + (e.clientY - r.top) / r.height * S.view.h;
    S.view.w *= f; S.view.h *= f;
    S.view.x = mx - (mx - S.view.x) * f; S.view.y = my - (my - S.view.y) * f; setVB();
  }, { passive: false });
}

function renderMap() {
  const G = S.G;
  let out = '';
  const T = G.turn && G.turn.tactical;
  for (const sys of systems()) {
    const [cx, cy] = hexXY(sys.q, sys.r);
    const homeCol = sys.home ? pcolor(sys.home) : null;
    const sel = S.selected === sys.key;
    const active = T && T.system === sys.key;
    let fill = '#121935';
    if (sys.anomaly === 'nebula') fill = 'url(#g-neb)';
    if (sys.anomaly === 'rift') fill = 'url(#g-rift)';
    out += `<g class="hex" data-key="${sys.key}">
      <polygon class="base" points="${hexPoints(cx, cy, HS - 1.5)}" fill="${fill}" stroke="${active ? '#fff' : sel ? '#e6c35c' : homeCol || '#2c3660'}" stroke-width="${active || sel ? 4 : homeCol ? 3 : 1.5}"/>`;
    const seed = hash(sys.key);
    if (sys.anomaly === 'asteroid') {
      for (let i = 0; i < 16; i++) { const a = (seed * (i + 3)) % 628 / 100, d = 10 + (seed * (i + 7)) % 38; out += `<ellipse cx="${cx + Math.cos(a) * d}" cy="${cy + Math.sin(a) * d}" rx="${2 + i % 4}" ry="${1.5 + i % 3}" fill="#8a7d6a"/>`; }
    }
    if (sys.anomaly === 'supernova') out += `<circle cx="${cx}" cy="${cy}" r="40" fill="url(#g-nova)"/>`;
    if (sys.wormhole) out += `<circle cx="${cx - 30}" cy="${cy - 26}" r="11" fill="none" stroke="${sys.wormhole === 'alpha' ? '#ff9f43' : '#3fd0c9'}" stroke-width="3"/><text x="${cx - 30}" y="${cy - 22}" text-anchor="middle" font-size="12" fill="#fff">${sys.wormhole === 'alpha' ? 'α' : 'β'}</text>`;
    // Planeten
    const pls = sys.planets;
    pls.forEach((pl, i) => {
      const off = pls.length === 1 ? [0, -8] : [i === 0 ? -22 : 22, i === 0 ? -18 : 2];
      const px = cx + off[0], py = cy + off[1];
      const r = sys.throne ? 22 : 13 + Math.min(6, pl.res + pl.inf);
      const grad = sys.throne ? 'url(#g-throne)' : sys.home ? 'url(#g-home)' : `url(#g-${pl.trait || 'kultur'})`;
      out += `<circle cx="${px}" cy="${py}" r="${r}" fill="${grad}" ${pl.owner ? `stroke="${pcolor(pl.owner)}" stroke-width="3"` : ''} ${pl.exhausted ? 'opacity=".55"' : ''}/>`;
      if (pl.tech) out += `<circle cx="${px + r - 3}" cy="${py - r + 3}" r="4" fill="${({ green: '#5cc46b', blue: '#4f8ff0', red: '#e65c6a', yellow: '#e6c35c' })[pl.tech]}"/>`;
      out += `<text x="${px}" y="${py + r + 10}" text-anchor="middle" font-size="9" fill="#dfe4ff">${esc(pl.name)}</text>`;
      out += `<text x="${px}" y="${py + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#000">${pl.res}/${pl.inf}</text>`;
      const ground = [pl.infantry ? `I${pl.infantry}` : '', pl.pds ? `G${pl.pds}` : '', pl.dock ? 'W' : ''].filter(Boolean).join(' ');
      if (ground) out += `<text x="${px}" y="${py - r - 3}" text-anchor="middle" font-size="9" fill="${pcolor(pl.owner)}" font-weight="700">${ground}</text>`;
      if (pl.custodians) out += `<text x="${px}" y="${py - r - 3}" text-anchor="middle" font-size="9" fill="#ffe9a6">Wächter</text>`;
    });
    // Schiffe
    const fleets = Object.entries(sys.ships);
    fleets.forEach(([pid, ships], i) => {
      const txt = SHIP_ORDER.filter((t) => ships[t]).map((t) => `${ABBR[t]}${ships[t]}`).join(' ');
      if (!txt) return;
      const y = cy + 38 + i * 13 - (fleets.length - 1) * 6;
      const w = txt.length * 5.6 + 8;
      out += `<rect x="${cx - w / 2}" y="${y - 9}" width="${w}" height="12" rx="6" fill="#000c" stroke="${pcolor(pid)}"/>
        <text x="${cx}" y="${y}" text-anchor="middle" font-size="9" fill="${pcolor(pid)}" font-weight="700">${txt}</text>`;
    });
    // Kommandomarker
    sys.tokens.forEach((pid, i) => {
      const tx = cx + 34 - i * 11, ty = cy - 30;
      out += `<rect x="${tx - 4}" y="${ty - 4}" width="8" height="8" transform="rotate(45 ${tx} ${ty})" fill="${pcolor(pid)}" stroke="#000"/>`;
    });
    out += '</g>';
  }
  $('#hexes').innerHTML = out;
  const hint = $('#maphint');
  if (S.mode === 'activate') { hint.style.display = 'block'; hint.innerHTML = 'Klicke ein System zum Aktivieren. <button class="small" id="cancelmode">Abbrechen</button>'; $('#cancelmode').onclick = () => { S.mode = null; renderMap(); }; }
  else hint.style.display = 'none';
}

function onHexClick(k) {
  if (S.mode === 'activate') { S.mode = null; S.tab = 'zug'; act({ type: 'activate', system: k }); return; }
  S.selected = k; S.tab = 'system'; renderMap(); renderTabs(); renderTab();
}

// ------------------------------------------------------------ Seitenleiste
const TABS = [['zug', 'Zug'], ['system', 'System'], ['reich', 'Reich'], ['ziele', 'Ziele'], ['tech', 'Technik'], ['spieler', 'Spieler'], ['log', 'Chronik']];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('');
  document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => { S.tab = b.dataset.t; renderTabs(); renderTab(); }; });
}
function renderTab() {
  const el = $('#tabbody');
  const fn = { zug: tabTurn, system: tabSystem, reich: tabEmpire, ziele: tabObjectives, tech: tabTech, spieler: tabPlayers, log: tabLog }[S.tab];
  el.innerHTML = '';
  fn(el);
}

function tabTurn(el) {
  const G = S.G, D = S.D, p = me();
  if (G.phase === 'ended') {
    el.append(h(`<div class="card"><h3>Spielende</h3><p>${pnameC(G.winner)} hat gewonnen!</p></div>`));
    return;
  }
  const w = G.wait || { players: [] };
  const waiting = w.players.filter((x) => x !== S.me).map(pnameC).join(', ');
  // Strategiekarten
  if (G.phase === 'strategy') {
    const mine = w.type === 'pick' && w.players[0] === S.me;
    el.append(h(`<div class="card"><h3>${mine ? 'Wähle eine Strategiekarte' : 'Warte auf ' + waiting}</h3>
      <div class="stratgrid">${[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
        const owner = G.players.find((x) => x.cards.includes(c));
        const avail = mine && G.strategyPool.includes(c);
        return `<div class="strat ${avail ? 'avail' : ''}" data-c="${c}" style="${owner ? 'opacity:.5' : ''}"><b>${c} ${esc(D.STRATEGY[c].name)}</b>
          ${G.strategyTG[c] ? `<span class="chip res">+${G.strategyTG[c]} HW</span>` : ''}${owner ? ' · ' + pnameC(owner.id) : ''}
          <div>${esc(D.STRATEGY[c].primary)}</div><div class="muted">Andere: ${esc(D.STRATEGY[c].secondary)}</div></div>`;
      }).join('')}</div></div>`));
    el.querySelectorAll('.strat.avail').forEach((d) => { d.onclick = () => act({ type: 'pick', card: +d.dataset.c }); });
    return;
  }
  if (w.players.includes(S.me) && w.type !== 'turn') {
    el.append(h(`<div class="card"><h3>Deine Entscheidung ist gefragt</h3><button class="primary" id="openp">Öffnen</button></div>`));
    $('#openp', el).onclick = () => { S.openPrompt = null; autoPrompt(true); };
  } else if (!w.players.includes(S.me) && waiting) {
    el.append(h(`<div class="card muted">Warte auf ${waiting} …</div>`));
  }
  if (G.phase === 'action' && G.turn) {
    const T = G.turn;
    const mineTurn = isMyTurn();
    const box = h(`<div class="card col"><h3>${mineTurn ? 'Du bist am Zug' : 'Am Zug: ' + pnameC(T.player)}</h3></div>`);
    el.append(box);
    if (mineTurn) {
      if (T.step === 'choose') {
        const row = h('<div class="col"></div>');
        row.append(btn(`System aktivieren (${p.tokens.tactic} Taktikmarker)`, () => { S.mode = 'activate'; renderMap(); toast('Klicke auf der Karte das System, das du aktivieren willst.'); }, p.tokens.tactic <= 0, true));
        for (const c of p.cards.filter((c) => !p.used.includes(c))) row.append(btn(`Strategiekarte spielen: ${D.STRATEGY[c].name}`, () => strategyDialog(c, false)));
        row.append(btn('Passen', () => confirmDlg('Wirklich passen? Du bist in dieser Runde dann nicht mehr am Zug.', () => act({ type: 'pass' })), p.cards.some((c) => !p.used.includes(c))));
        box.append(row);
      } else if (T.step === 'tactical') {
        const sys = G.map[T.tactical.system];
        const stage = T.tactical.stage;
        box.append(h(`<div>Aktiviert: <b>${esc(sysName(sys))}</b></div>`));
        if (stage === 'move') { box.append(btn('Schiffe bewegen …', moveDialog, false, true)); box.append(btn('Keine Bewegung', () => act({ type: 'skipStage' }))); }
        if (stage === 'invade') { box.append(btn('Truppen landen …', invadeDialog, !sys.planets.length || !((sys.ships[S.me] || {}).infantry), true)); box.append(btn('Keine Landung', () => act({ type: 'skipStage' }))); }
        if (stage === 'produce') {
          const dock = sys.planets.some((pl) => pl.owner === S.me && pl.dock);
          box.append(btn('Produzieren …', () => produceDialog(sys.key, false), !dock, true));
          box.append(btn('Zug beenden', () => act({ type: 'endTurn' })));
        }
      } else if (T.step === 'done') {
        box.append(btn('Zug beenden', () => act({ type: 'endTurn' }), false, true));
      }
      // Aktionskarten
      if (p.hand.length) {
        const ac = h('<div class="col"><div class="muted">Aktionskarten</div></div>');
        for (const [i, cid] of p.hand.entries()) {
          const def = D.ACTION_CARDS.find((c) => c.id === cid);
          const dis = def.timing === 'action' && T.step !== 'choose';
          ac.append(btn(`${def.name}${def.timing === 'action' ? ' (Aktion)' : ''}`, () => actionCardDialog(cid), dis));
        }
        box.append(ac);
      }
    }
  }
  if (G.phase === 'agenda' && G.agenda) {
    const def = D.AGENDAS.find((a) => a.id === G.agenda.current);
    if (def) el.append(h(`<div class="card"><h3>Ratsbeschluss: ${esc(def.name)}</h3><div>${esc(def.text)}</div></div>`));
  }
  el.append(h(`<div class="card"><h3>Ablauf einer Runde</h3><div class="muted" style="font-size:12px">
    1. Strategiephase: Strategiekarten wählen (niedrigste Zahl handelt zuerst).<br>
    2. Aktionsphase: Abwechselnd System aktivieren (bewegen, kämpfen, landen, produzieren), Strategiekarte spielen oder passen.<br>
    3. Statusphase: Ziele erfüllen, Kommandomarker erhalten, Planeten werden bereit.<br>
    4. Ratsversammlung (sobald die Wächter der Thronwelt abgelöst sind): über zwei Beschlüsse abstimmen.</div></div>`));
}

function btn(label, fn, disabled = false, primary = false) {
  const b = h(`<button class="${primary ? 'primary' : ''}">${esc(label)}</button>`);
  b.disabled = !!disabled; b.onclick = fn; return b;
}

function unitLine(ships, pid) {
  return SHIP_ORDER.filter((t) => ships[t]).map((t) => `${ships[t]}× ${esc(S.D.UNITS[t].name)}`).join(', ');
}

function tabSystem(el) {
  const sys = S.selected && S.G.map[S.selected];
  if (!sys) { el.append(h('<div class="muted">Klicke auf ein System auf der Karte.</div>')); return; }
  const box = h(`<div class="card col"><h3>${esc(sysName(sys))}</h3></div>`);
  if (sys.home) box.append(h(`<div>Heimatsystem von ${pnameC(sys.home)}</div>`));
  if (sys.throne) box.append(h(`<div class="muted">Die Thronwelt im Zentrum der Galaxis. ${S.G.custodians ? 'Wer hier zuerst landet, muss 6 Einfluss zahlen, um die Wächter abzulösen, und erhält 1 Siegpunkt.' : ''}</div>`));
  if (sys.anomaly) box.append(h(`<div class="muted">${esc(ANOM_TEXT[sys.anomaly])}</div>`));
  if (sys.wormhole) box.append(h(`<div class="muted">Wurmloch ${sys.wormhole === 'alpha' ? 'α' : 'β'}: grenzt an alle anderen ${sys.wormhole === 'alpha' ? 'α' : 'β'}-Wurmlöcher.</div>`));
  for (const pl of sys.planets) {
    box.append(h(`<div class="planetrow ${pl.exhausted ? 'exhausted' : ''}"><div><b>${esc(pl.name)}</b> ${pl.trait ? `<span class="muted">${esc(pl.trait)}</span>` : ''} ${pl.tech ? `<span class="chip">${esc(S.D.TECH_COLORS[pl.tech])}</span>` : ''}
      <div style="font-size:12px">${pl.owner ? pnameC(pl.owner) : '<span class="muted">unbesetzt</span>'}${pl.infantry ? ` · ${pl.infantry} Infanterie` : ''}${pl.pds ? ` · ${pl.pds} Geschütz` : ''}${pl.dock ? ' · Raumwerft' : ''}${pl.exhausted ? ' · erschöpft' : ''}</div></div>
      <div><span class="chip res">${pl.res} R</span><span class="chip inf">${pl.inf} E</span></div></div>`));
  }
  for (const [pid, ships] of Object.entries(sys.ships)) {
    const dmg = sys.damaged[pid] || {};
    const d = Object.entries(dmg).filter(([, n]) => n).map(([t, n]) => `${n} ${S.D.UNITS[t].name} beschädigt`).join(', ');
    box.append(h(`<div>${pnameC(pid)}: ${unitLine(ships)}${d ? ` <span class="muted">(${esc(d)})</span>` : ''}</div>`));
  }
  if (sys.tokens.length) box.append(h(`<div class="muted">Kommandomarker: ${sys.tokens.map(pnameC).join(', ')}</div>`));
  if (isMyTurn() && S.G.turn.step === 'choose' && !sys.tokens.includes(S.me) && sys.anomaly !== 'supernova') box.append(btn('Dieses System aktivieren', () => { S.tab = 'zug'; act({ type: 'activate', system: sys.key }); }, me().tokens.tactic <= 0, true));
  el.append(box);
}

function tabEmpire(el) {
  const p = me(), D = S.D;
  const pls = myPlanets();
  const readyR = pls.filter((x) => !x.exhausted).reduce((a, x) => a + x.res, 0);
  const readyI = pls.filter((x) => !x.exhausted).reduce((a, x) => a + x.inf, 0);
  el.append(h(`<div class="card col"><h3>${esc(D.FACTIONS[p.faction].name)}</h3>
    <div class="muted" style="font-size:12px">${esc(D.FACTIONS[p.faction].ability)}</div>
    <div class="row"><span class="chip">Taktik ${p.tokens.tactic}</span><span class="chip">Flotte ${p.tokens.fleet}</span><span class="chip">Strategie ${p.tokens.strategy}</span></div>
    <div class="row"><span class="chip res">Handelswaren ${p.tg}</span><span class="chip">Rohstoffe ${p.comm}/${p.commMax}</span><span class="chip">Aktionskarten ${p.hand.length}</span></div>
    <div>Bereit: <span class="chip res">${readyR} Ressourcen</span><span class="chip inf">${readyI} Einfluss</span></div>
    <div class="row">${p.cards.map((c) => `<span class="chip" style="${p.used.includes(c) ? 'opacity:.5' : ''}">${c} ${esc(D.STRATEGY[c].name)}</span>`).join('')}</div>
    <button id="give">Handelswaren geben …</button></div>`));
  $('#give', el).onclick = giveDialog;
  const pl = h('<div class="card"><h3>Planeten</h3></div>');
  for (const x of pls) pl.append(h(`<div class="planetrow ${x.exhausted ? 'exhausted' : ''}"><span>${esc(x.name)}${x.tech ? ` <span class="chip">${esc(D.TECH_COLORS[x.tech])}</span>` : ''}</span><span><span class="chip res">${x.res}</span><span class="chip inf">${x.inf}</span></span></div>`));
  el.append(pl);
  const hand = h('<div class="card col"><h3>Aktionskarten</h3></div>');
  if (!p.hand.length) hand.append(h('<div class="muted">Keine</div>'));
  for (const cid of p.hand) { const c = D.ACTION_CARDS.find((x) => x.id === cid); hand.append(h(`<div><b>${esc(c.name)}</b> <span class="muted">(${c.timing === 'action' ? 'verbraucht Aktion' : 'zusätzlich im Zug'})</span><div style="font-size:12px">${esc(c.text)}</div></div>`)); }
  el.append(hand);
  const types = ['fighter', 'infantry', 'destroyer', 'cruiser', 'carrier', 'dreadnought', 'warsun', 'pds', 'dock'];
  el.append(h(`<div class="card"><h3>Deine Einheiten</h3><table class="units"><tr><th>Einheit</th><th>Kosten</th><th>Kampf</th><th>Bew.</th><th>Kap.</th></tr>
    ${types.map((t) => { const u = unitStat(p, t); if (u.needsTech && !hasTech(p, u.needsTech)) return ''; return `<tr><td>${esc(u.name)}</td><td>${u.cost != null ? u.cost + (u.batch > 1 ? ` (${u.batch}×)` : '') : '–'}</td><td>${u.combat ? u.combat + '+' + (u.dice > 1 ? ' ×' + u.dice : '') : u.cannon ? 'Gesch. ' + u.cannon.hit + '+' : '–'}</td><td>${u.move ?? '–'}</td><td>${u.capacity || '–'}</td></tr>`; }).join('')}
    </table><div class="muted" style="font-size:12px;margin-top:6px">Ein Würfelwurf (W10) trifft, wenn er mindestens den Kampfwert erreicht.</div></div>`));
}

function tabObjectives(el) {
  const G = S.G, p = me();
  const pub = h('<div class="card col"><h3>Öffentliche Ziele</h3></div>');
  for (const o of G.publicObjectives) {
    const ok = p.eligible && p.eligible.public.includes(o.id);
    pub.append(h(`<div><b>${esc(o.name)}</b> <span class="chip">${o.vp} SP</span>${ok ? ' <span class="chip" style="color:var(--good)">erfüllbar</span>' : ''}<div style="font-size:12px">${esc(o.text)}</div>
      <div style="font-size:12px">${o.scoredBy.length ? 'Erfüllt: ' + o.scoredBy.map(pnameC).join(', ') : ''}</div></div>`));
  }
  el.append(pub);
  const sec = h('<div class="card col"><h3>Deine geheimen Ziele</h3></div>');
  for (const id of p.secrets) {
    const o = S.D.SECRETS.find((x) => x.id === id);
    const ok = p.eligible && p.eligible.secret.includes(id);
    sec.append(h(`<div><b>${esc(o.name)}</b>${ok ? ' <span class="chip" style="color:var(--good)">erfüllbar</span>' : ''}<div style="font-size:12px">${esc(o.text)}</div></div>`));
  }
  for (const id of p.scoredSecrets) { const o = S.D.SECRETS.find((x) => x.id === id); sec.append(h(`<div class="muted"><b>${esc(o.name)}</b> (erfüllt)</div>`)); }
  if (!p.secrets.length && !p.scoredSecrets.length) sec.append(h('<div class="muted">Keine</div>'));
  sec.append(h('<div class="muted" style="font-size:12px">Ziele werden in der Statusphase erfüllt (je 1 öffentliches und 1 geheimes pro Runde).</div>'));
  el.append(sec);
}

function techColorOf(id) { const D = S.D; return D.TECHS[id] ? D.TECHS[id].color : 'none'; }
function prereqText(pr) { return Object.entries(pr || {}).map(([c, n]) => `${n}× ${S.D.TECH_COLORS[c]}`).join(', ') || 'keine'; }
function tabTech(el) {
  const D = S.D, p = me();
  for (const c of ['green', 'blue', 'red', 'yellow']) {
    const box = h(`<div class="card"><h3>${D.TECH_COLORS[c]}</h3><div class="techs"></div></div>`);
    for (const [id, t] of Object.entries(D.TECHS).filter(([, t]) => t.color === c)) {
      $('.techs', box).append(h(`<div class="tech tc-${c} ${hasTech(p, id) ? 'own' : ''}"><b>${esc(t.name)}</b>${hasTech(p, id) ? ' ✓' : ''}<div class="muted">Voraussetzung: ${prereqText(t.prereq)}</div><div>${esc(t.text)}</div></div>`));
    }
    el.append(box);
  }
  const ub = h('<div class="card"><h3>Einheiten-Verbesserungen</h3><div class="techs"></div></div>');
  for (const [id, t] of Object.entries(D.UPGRADES)) $('.techs', ub).append(h(`<div class="tech tc-none ${hasTech(p, id) ? 'own' : ''}"><b>${esc(t.name)}</b>${hasTech(p, id) ? ' ✓' : ''}<div class="muted">Voraussetzung: ${prereqText(t.prereq)}</div><div>${esc(t.text)}</div></div>`));
  el.append(ub);
  el.append(h('<div class="muted" style="font-size:12px">Bereite Planeten mit Spezialisierung zählen beim Erforschen als Voraussetzung ihrer Farbe.</div>'));
}

function tabPlayers(el) {
  const D = S.D;
  for (const p of S.G.players) {
    const pls = systems().flatMap((s) => s.planets.filter((pl) => pl.owner === p.id));
    el.append(h(`<div class="card"><h3 style="color:${p.color}">${esc(p.name)} · ${esc(D.FACTIONS[p.faction].name)}</h3>
      <div style="font-size:12px">${p.vp} SP · ${pls.length} Planeten · ${p.tg} Handelswaren · ${p.handCount ?? p.hand.length} Aktionskarten · ${p.secretCount ?? p.secrets.length} geheime Ziele</div>
      <div style="font-size:12px">Marker: ${p.tokens.tactic}/${p.tokens.fleet}/${p.tokens.strategy} · Strategiekarten: ${p.cards.map((c) => D.STRATEGY[c].name).join(', ') || '–'}${p.passed ? ' · <b>gepasst</b>' : ''}</div>
      <div style="font-size:12px">Technologien: ${p.techs.map((t) => esc((D.TECHS[t] || D.UPGRADES[t]).name)).join(', ')}</div>
      <div class="muted" style="font-size:12px">${esc(D.FACTIONS[p.faction].ability)}</div></div>`));
  }
}

function tabLog(el) {
  const chat = h(`<div class="card col"><h3>Chat</h3><div class="log" id="chatlog">${(S.G.chat || []).slice(-30).map((c) => `<div><b>${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('')}</div>
    <div class="row"><input id="chatin" style="flex:1" placeholder="Nachricht …"><button id="chatsend">Senden</button></div></div>`);
  el.append(chat);
  const sendChat = () => { const v = $('#chatin').value.trim(); if (v) send({ type: 'chat', text: v }); $('#chatin').value = ''; };
  $('#chatsend', chat).onclick = sendChat; $('#chatin', chat).onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
  el.append(h(`<div class="card"><h3>Chronik</h3><div class="log">${S.G.log.slice().reverse().slice(0, 150).map((l) => `<div><span class="muted">R${l.r}</span> ${esc(l.msg)}</div>`).join('')}</div></div>`));
}

// ------------------------------------------------------------ Dialoge
function modal(title, bodyEl, buttons) {
  closeModal();
  const bg = h(`<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3><div class="col body"></div><div class="row btns" style="justify-content:flex-end"></div></div></div>`);
  $('.body', bg).append(bodyEl);
  for (const [label, fn, primary] of buttons) {
    const b = h(`<button class="${primary ? 'primary' : ''}">${esc(label)}</button>`);
    b.onclick = () => { if (fn() !== false) closeModal(); };
    $('.btns', bg).append(b);
  }
  $('#modal-root').append(bg);
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function confirmDlg(text, fn) { modal('Bestätigen', h(`<div>${esc(text)}</div>`), [['Abbrechen', () => {}], ['OK', fn, true]]); }

function num(label, max, val = 0, min = 0) {
  const el = h(`<label class="row"><input type="number" min="${min}" ${max != null ? `max="${max}"` : ''} value="${val}"> <span>${label}</span></label>`);
  el.get = () => Math.max(min, Math.min(max ?? 999, parseInt($('input', el).value, 10) || 0));
  return el;
}
function selectEl(label, options, withNone) {
  const el = h(`<label class="row"><span>${esc(label)}</span><select>${withNone ? `<option value="">${esc(withNone)}</option>` : ''}${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`);
  el.get = () => $('select', el).value;
  return el;
}
// Bezahlung mit Planeten und Handelswaren
function payPicker(kind, needFn, opts = {}) {
  const p = me();
  const pls = myPlanets().filter((x) => !x.exhausted);
  const key = kind === 'res' ? 'res' : 'inf';
  const el = h(`<div class="group col"><div><b>Bezahlen mit ${kind === 'res' ? 'Ressourcen' : 'Einfluss'}</b> <span class="sum"></span></div></div>`);
  for (const x of pls) el.append(h(`<label class="payline"><span><input type="checkbox" value="${esc(x.name)}"> ${esc(x.name)}</span><span class="chip ${key}">${x[key]}</span></label>`));
  if (!pls.length) el.append(h('<div class="muted">Keine bereiten Planeten.</div>'));
  const tg = opts.noTG ? null : num(`Handelswaren (von ${p.tg})`, p.tg);
  if (tg) el.append(tg);
  const upd = () => {
    const sel = [...el.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value);
    const v = sel.reduce((a, n) => a + pls.find((x) => x.name === n)[key], 0) + (tg ? tg.get() : 0);
    const need = needFn ? needFn() : null;
    $('.sum', el).innerHTML = `– gewählt: <b>${v}</b>${need != null ? ` / benötigt: <b>${need}</b>` : ''}`;
  };
  el.addEventListener('input', upd); setTimeout(upd);
  el.update = upd;
  el.get = () => ({ planets: [...el.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value), tg: tg ? tg.get() : 0 });
  return el;
}
function tokenDist(total, initial) {
  const el = h(`<div class="group col"><div><b>Kommandomarker verteilen</b> <span class="sum"></span></div></div>`);
  const t = num('Taktik', null, initial ? initial.tactic : 0), f = num('Flotte', null, initial ? initial.fleet : 0), s = num('Strategie', null, initial ? initial.strategy : 0);
  el.append(t, f, s);
  const upd = () => { const tot = typeof total === 'function' ? total() : total; $('.sum', el).textContent = `– ${t.get() + f.get() + s.get()} von ${tot}`; };
  el.addEventListener('input', upd); setTimeout(upd);
  el.update = upd;
  el.get = () => ({ tactic: t.get(), fleet: f.get(), strategy: s.get() });
  return el;
}
function planetChecks(label, list, max) {
  const el = h(`<div class="group col"><b>${esc(label)}</b></div>`);
  for (const x of list) el.append(h(`<label><input type="checkbox" value="${esc(x.name)}"> ${esc(x.name)} (${x.res}/${x.inf})</label>`));
  if (!list.length) el.append(h('<div class="muted">Keine passenden Planeten.</div>'));
  el.get = () => [...el.querySelectorAll('input:checked')].map((i) => i.value).slice(0, max || 99);
  return el;
}
function researchable(p, ignoreOne) {
  const D = S.D;
  const have = { green: 0, blue: 0, red: 0, yellow: 0 };
  for (const t of p.techs) if (D.TECHS[t]) have[D.TECHS[t].color]++;
  for (const x of myPlanets()) if (x.tech && !x.exhausted) have[x.tech]++;
  const all = { ...D.TECHS, ...D.UPGRADES };
  return Object.entries(all).filter(([id, t]) => {
    if (hasTech(p, id)) return false;
    let miss = 0; for (const [c, n] of Object.entries(t.prereq || {})) miss += Math.max(0, n - have[c]);
    return miss <= (ignoreOne ? 1 : 0) + (hasTech(p, 'y_singul') ? 1 : 0);
  }).map(([id, t]) => [id, `${t.name} (${D.TECHS[id] ? D.TECH_COLORS[t.color] : 'Verbesserung'})`]);
}

function strategyDialog(card, secondary) {
  const D = S.D, p = me();
  const def = D.STRATEGY[card];
  const body = h('<div class="col"></div>');
  body.append(h(`<div>${esc(secondary ? def.secondary : def.primary)}</div>`));
  if (secondary && card !== 1) body.append(h(`<div class="muted">Kostet 1 Strategiemarker (du hast ${p.tokens.strategy}).</div>`));
  let get = () => ({});
  const ownPlanets = myPlanets();
  switch (card) {
    case 1: {
      const buy = num('Marker zusätzlich kaufen (je 3 Einfluss)', 20, secondary ? 1 : 0);
      const pay = payPicker('inf', () => buy.get() * 3);
      const dist = tokenDist(() => (secondary ? 0 : 3) + buy.get(), secondary ? { tactic: 1, fleet: 0, strategy: 0 } : { tactic: 1, fleet: 1, strategy: 1 });
      buy.addEventListener('input', () => { pay.update(); dist.update(); });
      body.append(buy, pay, dist);
      get = () => ({ buy: buy.get(), pay: pay.get(), dist: dist.get() });
      break;
    }
    case 2: {
      const ex = ownPlanets.filter((x) => x.exhausted);
      let sysSel = null;
      if (!secondary) {
        const opts = [...new Set(ownPlanets.filter((x) => !x.sys.throne).map((x) => x.sys.key))].map((k) => [k, sysName(S.G.map[k])]);
        sysSel = selectEl('System', opts); body.append(sysSel);
      }
      const rd = planetChecks('Bis zu 2 Planeten bereit machen', ex, 2); body.append(rd);
      get = () => ({ system: sysSel && sysSel.get(), ready: rd.get() });
      break;
    }
    case 3: {
      if (!secondary) {
        const sp = selectEl('Neuer Sprecher', S.G.players.filter((x) => x.id !== S.me).map((x) => [x.id, x.name])); body.append(sp);
        get = () => ({ speaker: sp.get() });
      }
      break;
    }
    case 4: {
      const pl = selectEl('Planet', ownPlanets.map((x) => [x.name, x.name]));
      const ty = selectEl('Bauwerk', [['pds', 'Orbitalgeschütz'], ['dock', 'Raumwerft']]);
      body.append(pl, ty);
      let pl2 = null;
      if (!secondary) { pl2 = selectEl('Zusätzliches Orbitalgeschütz auf', ownPlanets.map((x) => [x.name, x.name]), '– keins –'); body.append(pl2); }
      get = () => ({ planet: pl.get(), type: ty.get(), planet2: pl2 ? pl2.get() || undefined : undefined });
      // "type" kollidiert mit dem Aktionstyp; wird unten umbenannt
      break;
    }
    case 6: {
      if (!secondary) {
        const opts = systems().filter((s) => s.tokens.includes(S.me)).map((s) => [s.key, sysName(s)]);
        const sy = selectEl('Kommandomarker zurückholen aus', opts);
        const pool = selectEl('In Vorrat', [['tactic', 'Taktik'], ['fleet', 'Flotte'], ['strategy', 'Strategie']]);
        body.append(sy, pool);
        get = () => ({ system: sy.get(), pool: pool.get() });
      } else {
        const home = S.G.map[p.homeKey];
        const pr = productionForm(home);
        body.append(pr);
        get = () => pr.get();
      }
      break;
    }
    case 7: {
      const t1 = selectEl(secondary ? 'Technologie (4 Ressourcen)' : 'Gratis-Technologie', researchable(p));
      body.append(t1);
      let t2 = null, pay = null;
      if (!secondary) {
        t2 = selectEl('Zweite Technologie (6 Ressourcen)', researchable(p), '– keine –');
        pay = payPicker('res', () => (t2.get() ? 6 : 0));
        t2.addEventListener('change', () => pay.update());
        body.append(t2, pay);
      } else { pay = payPicker('res', () => 4); body.append(pay); }
      get = () => ({ tech: t1.get(), tech2: t2 ? t2.get() || undefined : undefined, pay: pay.get() });
      break;
    }
    case 8: {
      if (!secondary) {
        const el = p.eligible ? p.eligible.public : [];
        const ob = selectEl('Ziel sofort erfüllen', S.G.publicObjectives.filter((o) => el.includes(o.id)).map((o) => [o.id, `${o.name} (${o.vp} SP)`]), '– keins –');
        body.append(ob);
        get = () => ({ objective: ob.get() || undefined });
      }
      break;
    }
  }
  const wrap = (o) => { const out = { ...o }; if (card === 4) { out.type = undefined; out.structure = o.type; } return out; };
  if (secondary) {
    modal(`${def.name} folgen?`, body, [['Verzichten', () => { act({ type: 'secondary', skip: true }); }],
      ['Folgen', () => { const o = wrap(get()); act({ ...o, type: 'secondary' }); }, true]]);
  } else {
    modal(`Strategiekarte: ${def.name}`, body, [['Abbrechen', () => {}], ['Ausführen', () => { const o = wrap(get()); act({ ...o, type: 'strategy', card }); }, true]]);
  }
}

function productionForm(sys) {
  const p = me();
  const el = h('<div class="col"></div>');
  const lim = sys.planets.filter((pl) => pl.owner === S.me && pl.dock).reduce((a, pl) => a + pl.dock * (pl.res + unitStat(p, 'dock').produce + (hasTech(p, 'y_logis') ? 2 : 0)), 0);
  el.append(h(`<div class="muted">Produktionslimit: ${lim} Einheiten · Flottenlimit: ${p.tokens.fleet} Schiffe (ohne Jäger) pro System</div>`));
  const types = ['infantry', 'fighter', 'destroyer', 'cruiser', 'carrier', 'dreadnought'];
  if (hasTech(p, 'u_warsun')) types.push('warsun');
  const inputs = {};
  for (const t of types) { const u = unitStat(p, t); inputs[t] = num(`${u.name} (${u.cost} R${u.batch > 1 ? ' für ' + u.batch : ''})`, 20); el.append(inputs[t]); }
  const cost = () => Object.entries(inputs).reduce((a, [t, i]) => { const u = unitStat(p, t); return a + Math.ceil(i.get() / (u.batch || 1)) * u.cost; }, 0);
  const pay = payPicker('res', cost);
  el.append(pay);
  el.addEventListener('input', () => pay.update());
  el.get = () => ({ build: Object.fromEntries(Object.entries(inputs).map(([t, i]) => [t, i.get()])), pay: pay.get() });
  return el;
}
function produceDialog(key) {
  const form = productionForm(S.G.map[key]);
  modal('Produktion', form, [['Abbrechen', () => {}], ['Produzieren', () => act({ type: 'produce', ...form.get() }), true]]);
}

function moveDialog() {
  const G = S.G, p = me();
  const target = G.map[G.turn.tactical.system];
  const body = h('<div class="col"></div>');
  body.append(h(`<div>Ziel: <b>${esc(sysName(target))}</b>. Wähle Schiffe aus Systemen ohne deinen Kommandomarker. Träger nehmen Infanterie und Jäger mit (Kapazität).</div>`));
  const rows = [];
  const srcs = systems().filter((s) => s.key !== target.key && !s.tokens.includes(S.me) && Object.keys(s.ships[S.me] || {}).some((t) => t !== 'infantry'))
    .sort((a, b) => hexDist(a, target) - hexDist(b, target));
  if (!srcs.length) body.append(h('<div class="muted">Keine Schiffe verfügbar.</div>'));
  for (const s of srcs) {
    const ships = s.ships[S.me];
    const g = h(`<div class="group col"><b>${esc(sysName(s))} <span class="muted">(Entfernung ca. ${hexDist(s, target)})</span></b></div>`);
    const inp = {};
    for (const t of SHIP_ORDER) {
      if (t === 'infantry' || !ships[t]) continue;
      const u = unitStat(p, t);
      inp[t] = num(`${u.name} (von ${ships[t]}, Bew. ${u.move}${u.capacity ? ', Kap. ' + u.capacity : ''})`, ships[t]);
      g.append(inp[t]);
    }
    const infSpace = ships.infantry ? num(`Infanterie im All (von ${ships.infantry})`, ships.infantry) : null;
    if (infSpace) g.append(infSpace);
    const fromPl = {};
    for (const pl of s.planets.filter((x) => x.owner === S.me && x.infantry)) { fromPl[pl.name] = num(`Infanterie von ${pl.name} (von ${pl.infantry})`, pl.infantry); g.append(fromPl[pl.name]); }
    rows.push({ from: s.key, get: () => ({ from: s.key, ships: Object.fromEntries(Object.entries(inp).map(([t, i]) => [t, i.get()])), infantry: infSpace ? infSpace.get() : 0, fromPlanets: Object.fromEntries(Object.entries(fromPl).map(([n, i]) => [n, i.get()])) }) });
    body.append(g);
  }
  modal('Schiffe bewegen', body, [['Abbrechen', () => {}], ['Bewegen', () => {
    const moves = rows.map((r) => r.get()).filter((m) => Object.values(m.ships).some((n) => n > 0));
    act({ type: 'move', moves });
  }, true]]);
}

function invadeDialog() {
  const G = S.G;
  const sys = G.map[G.turn.tactical.system];
  const inf = (sys.ships[S.me] || {}).infantry || 0;
  const body = h(`<div class="col"><div>Du hast ${inf} Infanterie im All. Verteile sie auf die Planeten.</div></div>`);
  const inputs = {};
  for (const pl of sys.planets) { inputs[pl.name] = num(`${pl.name} ${pl.owner ? '(' + esc((P(pl.owner) || {}).name) + (pl.infantry ? ', ' + pl.infantry + ' Infanterie' : '') + ')' : '(unbesetzt)'}`, inf); body.append(inputs[pl.name]); }
  let pay = null;
  if (sys.planets.some((pl) => pl.custodians)) { body.append(h('<div>Die Wächter der Thronwelt verlangen 6 Einfluss, wenn du dort landest (du erhältst 1 Siegpunkt).</div>')); pay = payPicker('inf', () => 6); body.append(pay); }
  modal('Truppen landen', body, [['Abbrechen', () => {}], ['Landen', () => act({ type: 'invade', landings: Object.fromEntries(Object.entries(inputs).map(([n, i]) => [n, i.get()])), custodianPay: pay ? pay.get() : undefined }), true]]);
}

function actionCardDialog(cid) {
  const D = S.D, G = S.G;
  const def = D.ACTION_CARDS.find((c) => c.id === cid);
  const body = h(`<div class="col"><div>${esc(def.text)}</div></div>`);
  let get = () => ({});
  if (cid === 'ac_sabot') {
    const opts = systems().filter((s) => (s.ships[S.me] && Object.keys(s.ships[S.me]).some((t) => t !== 'infantry'))).flatMap((s) => s.planets.filter((pl) => pl.owner && pl.owner !== S.me && pl.pds).map((pl) => [pl.name, pl.name]));
    const s = selectEl('Planet', opts); body.append(s); get = () => ({ planet: s.get() });
  }
  if (cid === 'ac_mobil') { const c = planetChecks('Planeten (max. 2)', myPlanets().filter((x) => x.exhausted), 2); body.append(c); get = () => ({ planets: c.get() }); }
  if (cid === 'ac_recall') { const s = selectEl('System', systems().filter((x) => x.tokens.includes(S.me)).map((x) => [x.key, sysName(x)])); body.append(s); get = () => ({ system: s.get() }); }
  if (cid === 'ac_prosp' || cid === 'ac_troops') { const s = selectEl('Planet', myPlanets().map((x) => [x.name, `${x.name} (${x.res}/${x.inf})`])); body.append(s); get = () => ({ planet: s.get() }); }
  if (cid === 'ac_reinf') { const s = selectEl('System', systems().filter((x) => x.planets.some((pl) => pl.owner === S.me && pl.dock)).map((x) => [x.key, sysName(x)])); body.append(s); get = () => ({ system: s.get() }); }
  if (cid === 'ac_embargo') { const s = selectEl('Spieler', G.players.filter((x) => x.id !== S.me).map((x) => [x.id, x.name])); body.append(s); get = () => ({ target: s.get() }); }
  if (cid === 'ac_relocate') {
    const opts = myPlanets().map((x) => [x.name, `${x.name} (${x.infantry} Inf.)`]);
    const a1 = selectEl('Von', opts), a2 = selectEl('Nach', opts), n = num('Anzahl', 3, 1, 1);
    body.append(a1, a2, n); get = () => ({ from: a1.get(), to: a2.get(), count: n.get() });
  }
  if (cid === 'ac_comet') {
    const opts = systems().flatMap((x) => x.planets.filter((pl) => pl.owner && pl.owner !== S.me && pl.infantry).map((pl) => [pl.name, `${pl.name} (${pl.infantry} Inf.)`]));
    const s = selectEl('Planet', opts); body.append(s); get = () => ({ planet: s.get() });
  }
  modal(def.name, body, [['Abbrechen', () => {}], ['Ausspielen', () => act({ type: 'playCard', card: cid, ...get() }), true]]);
}

function giveDialog() {
  const p = me();
  const body = h('<div class="col"></div>');
  const to = selectEl('An', S.G.players.filter((x) => x.id !== S.me).map((x) => [x.id, x.name]));
  const tg = num(`Handelswaren (von ${p.tg})`, p.tg);
  const comm = num(`Rohstoffe (von ${p.comm}) – werden beim Empfänger zu Handelswaren`, p.comm);
  body.append(to, tg, comm);
  modal('Handel', body, [['Abbrechen', () => {}], ['Geben', () => act({ type: 'give', to: to.get(), tg: tg.get(), comm: comm.get() }), true]]);
}

function statusDialog() {
  const p = me(), G = S.G, D = S.D;
  const gain = 2 + (hasTech(p, 'g_spark') ? 1 : 0);
  const total = p.tokens.tactic + p.tokens.fleet + p.tokens.strategy + gain;
  const body = h('<div class="col"></div>');
  const pub = selectEl('Öffentliches Ziel', G.publicObjectives.filter((o) => p.eligible.public.includes(o.id)).map((o) => [o.id, `${o.name} (${o.vp} SP)`]), '– keins –');
  const sec = selectEl('Geheimes Ziel', p.secrets.filter((id) => p.eligible.secret.includes(id)).map((id) => [id, D.SECRETS.find((x) => x.id === id).name]), '– keins –');
  body.append(pub, sec);
  body.append(h(`<div>Du erhältst ${gain} Kommandomarker und darfst alle Marker neu verteilen (gesamt ${total}).</div>`));
  const dist = tokenDist(total, { tactic: p.tokens.tactic + gain, fleet: p.tokens.fleet, strategy: p.tokens.strategy });
  body.append(dist);
  modal('Statusphase', body, [['Später', () => {}], ['Bestätigen', () => act({ type: 'status', publicId: pub.get() || undefined, secretId: sec.get() || undefined, tokens: dist.get() }), true]]);
}

function voteDialog() {
  const G = S.G, D = S.D, p = me();
  const def = D.AGENDAS.find((a) => a.id === G.agenda.current);
  const body = h(`<div class="col"><div><b>${esc(def.name)}</b></div><div>${esc(def.text)}</div></div>`);
  const opts = def.kind === 'yesno' ? [['for', 'Dafür'], ['against', 'Dagegen']] : G.players.map((x) => [x.id, x.name]);
  const o = selectEl('Deine Stimme', opts, 'Enthaltung');
  body.append(o);
  const c = planetChecks('Planeten erschöpfen (Einfluss = Stimmen)', myPlanets().filter((x) => !x.exhausted));
  body.append(c);
  if (p.flags.voteBonus) body.append(h(`<div class="muted">Fraktionsbonus: +${p.flags.voteBonus} Stimmen</div>`));
  modal('Ratsversammlung', body, [['Später', () => {}], ['Abstimmen', () => act({ type: 'vote', outcome: o.get() || null, planets: c.get() }), true]]);
}

// Öffnet automatisch die passende Entscheidung, wenn sie neu ansteht
function autoPrompt(force) {
  const G = S.G, w = G.wait;
  if (!w || !w.players.includes(S.me) || w.type === 'turn' || w.type === 'pick') { S.openPrompt = null; return; }
  const k = `${w.type}-${G.round}-${w.card || ''}-${G.agenda ? G.agenda.current : ''}-${G.combat ? G.combat.round + w.step : ''}`;
  if (!force && S.openPrompt === k) return;
  S.openPrompt = k;
  if (w.type === 'secondary') strategyDialog(w.card, true);
  if (w.type === 'status') statusDialog();
  if (w.type === 'vote') voteDialog();
  if (w.type === 'combat') combatDialog();
}

function combatDialog() {
  const G = S.G, c = G.combat, sys = G.map[c.sys], p = me();
  const foe = c.att === S.me ? c.def : c.att;
  const body = h('<div class="col"></div>');
  body.append(h(`<div>Raumkampf in <b>${esc(sysName(sys))}</b>, Runde ${G.wait.step === 'declare' ? c.round : c.round}.</div>`));
  body.append(h(`<div>Deine Flotte: ${unitLine(sys.ships[S.me] || {})}</div>`));
  body.append(h(`<div>Gegner ${pnameC(foe)}: ${unitLine(sys.ships[foe] || {})}</div>`));
  if (G.wait.step === 'declare') {
    const opts = (G.retreatOptions || []).map((k) => [k, sysName(G.map[k])]);
    const r = selectEl('Nach dieser Runde zurückziehen nach', opts, 'Nicht zurückziehen');
    body.append(r);
    body.append(h('<div class="muted" style="font-size:12px">Ein Rückzug wird nach dem Würfeln dieser Runde ausgeführt. Ziel muss angrenzen, darf keine feindlichen Schiffe enthalten und muss eigene Schiffe oder Planeten haben.</div>'));
    modal('Raumkampf', body, [['Kämpfen', () => act({ type: 'combat', retreat: r.get() || undefined }), true]]);
    return;
  }
  const hits = c.hits[S.me];
  const dmg = sys.damaged[S.me] || {};
  body.append(h(`<div><b>${hits} Treffer</b> musst du zuordnen. Schiffe mit Schadensresistenz können einen Treffer als Beschädigung abfangen.</div>`));
  const inputs = [];
  for (const t of SHIP_ORDER) {
    const n = (sys.ships[S.me] || {})[t];
    if (!n || t === 'infantry') continue;
    const u = unitStat(p, t);
    const row = h(`<div class="group row"><b style="min-width:120px">${esc(u.name)} (${n})</b></div>`);
    const d = num('zerstören', n); row.append(d); inputs.push(['destroy', t, d]);
    if (u.sustain && n - (dmg[t] || 0) > 0) { const dm = num('beschädigen', n - (dmg[t] || 0)); row.append(dm); inputs.push(['damage', t, dm]); }
    body.append(row);
  }
  const collect = () => {
    const out = { destroy: {}, damage: {} };
    for (const [k, t, el] of inputs) if (el.get()) out[k][t] = el.get();
    return out;
  };
  modal('Verluste zuordnen', body, [['Automatisch', () => act({ type: 'combat', auto: true })], ['Bestätigen', () => act({ type: 'combat', ...collect() }), true]]);
}

connect();
