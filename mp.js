// mp.js - multiplayer lobby, wake screen and in-match client (uses net.js / common.js)
import { NetClient } from './net.js';
import * as ACC from './account.js';
import { lobbyPanel } from './social.js';
import { createController } from './movement.js';
import { createCharacter, CHARACTER_IDS } from './characters.js';
import { WEAPON_ORDER, shotSound } from './player.js';
import { createSpectator } from './spectate.js';
import { profileComplete, requireProfile } from './profilegate.js';
import { play, setListener, initAudio } from './audio.js';
import { initProgress } from './progress.js';
import { createMatchFx } from './matchfx.js';
import { DM, isFree, GUN_ORDER, legendOf, R } from './common.js';
import { emblemSVG } from './emblem.js';
import { loadingStart, loadingStep, loadingDone } from './loading.js';
const SHOT = WEAPON_ORDER.map(shotSound);   // remote shots sound like their gun
const P3 = (a) => (a && a.length === 3 ? { x: a[0], y: a[1], z: a[2] } : undefined);

const HOST = 'sniper-chill-mp.onrender.com';
const TH = (/[?&]mphost=([\w.:-]+)/.exec(location.search) || [])[1];
const WS = TH ? 'ws://' + TH + '/ws' : 'wss://' + HOST + '/ws', HEALTH = TH ? 'http://' + TH + '/healthz' : 'https://' + HOST + '/healthz';
const CSS = `
.mp{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(30,60,80,.82),rgba(6,12,20,.96));font-family:Fredoka,system-ui,sans-serif;color:#fff}
.mp-card{width:min(440px,90vw);padding:26px 28px;border-radius:18px;background:rgba(10,18,28,.78);border:1px solid rgba(255,255,255,.12);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.mp-card h2{margin:0 0 4px;font-size:26px;letter-spacing:.12em;font-weight:600}.mp-card p{margin:6px 0 14px;opacity:.7;font-size:14px}
.mp-card label{display:block;font-size:11px;letter-spacing:.16em;opacity:.6;margin:12px 0 5px}
.mp-card input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:16px;outline:none}
.mp-card input:focus{border-color:#7fe3ff}
.mp-row{display:flex;gap:10px;margin-top:14px}.mp-btn{flex:1;padding:12px;border-radius:10px;border:0;background:#7fe3ff;color:#06202c;font:inherit;font-weight:600;font-size:15px;letter-spacing:.06em;cursor:pointer}
.mp-btn.alt{background:rgba(255,255,255,.1);color:#fff}.mp-btn:hover{filter:brightness(1.1)}
.mp-spin{width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.15);border-top-color:#7fe3ff;margin:6px auto 16px;animation:mpsp 1s linear infinite}@keyframes mpsp{to{transform:rotate(360deg)}}
.mp-c{text-align:center}.mp-code{font-size:30px;letter-spacing:.3em;font-weight:600;color:#7fe3ff;margin:6px 0}
.mp-hud{position:absolute;inset:0;z-index:25;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.mp-hud .top{position:absolute;top:14px;left:50%;transform:translateX(-50%);text-align:center}
.mp-hud .sc{font-size:30px;font-weight:600;letter-spacing:.08em}.mp-hud .sc b:first-child{color:#ffb347}.mp-hud .sc b:last-child{color:#7fe3ff}
.mp-hud .ph{font-size:13px;opacity:.85;letter-spacing:.14em}
.mp-hud .hp{position:absolute;left:28px;bottom:26px;font-size:34px;font-weight:600}.mp-hud .am{position:absolute;right:28px;bottom:44px;font-size:34px;font-weight:600}.mp-hud .am small{font-size:16px;opacity:.7}
.mp-hud .cr,.mp-hud .hp,.mp-hud .am,.mp-hud .sc{display:none}
.mp-hud .top{top:76px}
.mp-hud .net{position:absolute;right:14px;bottom:8px;font-size:11px;opacity:.65}
.mp-hud .msg{position:absolute;top:34%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:600;letter-spacing:.1em;text-align:center}
.mp-hud .rc{position:absolute;left:14px;top:12px;font-size:12px;opacity:.7;letter-spacing:.12em}
.mp-hud .cr{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.mp-hud .tag{position:absolute;transform:translate(-50%,-100%);font-size:12px;font-weight:600;padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.4);white-space:nowrap}

.mp{justify-content:flex-start;background:radial-gradient(ellipse at 72% 45%,#2b3560 0%,#141a33 45%,#070a14 100%)}
.mp:after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.65) 100%);pointer-events:none}
.mp-card{position:relative;z-index:2;background:none;border:0;box-shadow:none;border-radius:0;width:min(520px,92vw);margin-left:clamp(20px,6vw,90px);padding:0}
.mp-card h2{font-family:Teko,Fredoka,Impact,sans-serif;font-size:clamp(44px,8vh,80px);font-weight:600;letter-spacing:.12em;line-height:1;margin-bottom:2px;text-shadow:0 3px 0 rgba(0,0,0,.35)}
.mp-card h2:before{content:'';display:block;width:64px;height:4px;background:#ff8a2a;margin-bottom:10px}
.mp-card p{opacity:.65;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
.mp-card label{font-size:11px;letter-spacing:.24em;color:#ffb35c;opacity:.9}
.mp-card input{border:0;border-bottom:2px solid rgba(255,255,255,.3);border-radius:0;background:rgba(255,255,255,.05);letter-spacing:.12em;text-transform:uppercase}
.mp-card input:focus{border-bottom-color:#ff8a2a}
.mp-btn{background:transparent;color:#cfd6ea;border:0;border-left:3px solid transparent;border-radius:0;text-align:left;font-weight:500;text-transform:uppercase;letter-spacing:.14em;padding:9px 14px;transition:padding .12s,background .12s}
.mp-btn:hover,.mp-btn:not(.alt){background:linear-gradient(90deg,#ff8a2a,#ff6a1a 70%,rgba(255,106,26,0));color:#fff;border-left-color:#ffd166;text-shadow:0 1px 6px rgba(0,0,0,.4)}
.mp-btn.alt{background:transparent;color:#cfd6ea}.mp-btn.alt:hover{background:linear-gradient(90deg,rgba(255,138,42,.7),rgba(255,106,26,0));color:#fff;padding-left:20px}
.mp-btn:disabled{opacity:.35}
.mp-c{text-align:left}.mp-spin{margin:6px 0 16px}
.mp-code{font-family:Teko,Fredoka,sans-serif}
`;
const el = (h, c) => { const d = document.createElement('div'); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createMultiplayer(game, THREE) {
  try { fetch(HEALTH, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}   // wake the free server as soon as the page loads
  if (!document.getElementById('mp-css')) { const s = document.createElement('style'); s.id = 'mp-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = game.root;
  const mp = { active: false, net: null };
  const bodies = new Map(); let bombBeepT = 0; let mapSel = (/[?&]map=b/.test(location.search) ? 'b' : 'a'); let screen = null, hud = null, remotes = new Map(), keys = {}, locked = false, wakeTimer = null, wakeStop = false, mode = '1v1', binds = [], lastMsg = '', msgT = 0;
  const getName = () => { try { return localStorage.getItem('sc_name') || ''; } catch (e) { return ''; } };
  const setName = (n) => { try { localStorage.setItem('sc_name', n); } catch (e) {} };
  const clear = () => { if (screen) { screen.remove(); screen = null; } };
  const show = (html) => { clear(); screen = el(`<div class="mp-card">${html}</div>`, 'mp'); root.appendChild(screen); return screen; };

  function lobby(preset) {
    const s = show(`<h2>MULTIPLAYER</h2><p id="mpd">Bomb mode. Best of 5, sides swap after round 3.</p>
<label>YOUR NAME</label><input id="mpn" maxlength="14" value="${esc(getName())}" placeholder="Player">
<label>MAP</label><div class="mp-row" style="margin-top:0"><button class="mp-btn" id="ma">Kite Garden</button><button class="mp-btn alt" id="mb">Kite Plaza (A/B/C)</button></div>
<label>MODE</label><div class="mp-row" style="margin-top:0"><button class="mp-btn" id="m1">1v1</button><button class="mp-btn alt" id="m2">2v2</button><button class="mp-btn alt" id="m3">1v1v1 (Plaza)</button></div>
<div class="mp-row" style="margin-top:6px"><button class="mp-btn alt" id="m4">Team Deathmatch</button><button class="mp-btn alt" id="m5">Free-for-all</button><button class="mp-btn alt" id="m6">Gun Game</button></div>
<div class="mp-row"><button class="mp-btn" id="mpf">FIND MATCH</button><button class="mp-btn alt" id="mpc">CREATE PRIVATE ROOM</button></div>
<div id="mps" style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin:10px 0 0">Checking server...</div>
<label>OPEN GAMES <a id="mpr" style="cursor:pointer;opacity:.8">refresh</a></label><div id="mpl" style="max-height:110px;overflow:auto;font-size:14px;opacity:.9">Loading...</div>
<label>OR JOIN WITH A CODE</label><div class="mp-row" style="margin-top:0"><input id="mpj" maxlength="8" placeholder="CODE" style="text-transform:uppercase"><button class="mp-btn alt" id="mpg" style="flex:0 0 90px">JOIN</button></div>
<div class="mp-row"><button class="mp-btn alt" id="mpb">BACK</button></div>`);
    s.appendChild(lobbyPanel());
    const q = (i) => s.querySelector('#' + i), nm = () => (q('mpn').value.trim() || 'Player').slice(0, 14);
    const MD = { '1v1': 'Bomb mode. Best of 5, sides swap after round 3.', '2v2': 'Bomb mode, 2 per team. Revive a fallen teammate with E.', ffa3: '1v1v1 bomb on Kite Plaza: 3 teams, sites A, B and C.', tdm: 'Team Deathmatch: back in 2 s, free loadouts, first team to ' + DM.tdm.limit + ' kills.', ffa: 'Free-for-all: everyone is an enemy, back in 2 s, first to ' + DM.ffa.limit + ' kills.', gun: 'Gun Game: every kill gives you the next of the ' + (GUN_ORDER.length - 1) + ' guns, a knife kill on the last level wins.' };
    const setMode = (m) => { mode = m; [['m1', '1v1'], ['m2', '2v2'], ['m3', 'ffa3'], ['m4', 'tdm'], ['m5', 'ffa'], ['m6', 'gun']].forEach(([b, k]) => q(b).classList.toggle('alt', m !== k)); q('mpd').textContent = MD[m] || ''; };
    setMode(mode);
    try { const pend = sessionStorage.getItem('sc_mp_pending'); if (pend && /[?&]mpgo=1/.test(location.search)) { sessionStorage.removeItem('sc_mp_pending'); const o = JSON.parse(pend); mode = o.mode || mode; setMode(mode); setTimeout(() => connect({ room: o.room, name: o.name || nm(), solo: !!o.solo, gm: o.gm }), 300); } } catch (e) {}
    const setMap = (m) => { mapSel = m; q('ma').classList.toggle('alt', m !== 'a'); q('mb').classList.toggle('alt', m !== 'b'); }; setMap(mapSel); q('ma').onclick = () => { setMap('a'); if (mode === 'ffa3') setMode('1v1'); }; q('mb').onclick = () => setMap('b');
    q('m1').onclick = () => setMode('1v1'); q('m2').onclick = () => setMode('2v2'); q('m3').onclick = () => { setMode('ffa3'); setMap('b'); }; q('m4').onclick = () => setMode('tdm'); q('m5').onclick = () => setMode('ffa'); q('m6').onclick = () => setMode('gun');
    q('mpf').onclick = () => { setName(nm()); connect({ room: 'MATCH', name: nm() }); };
    const loadList = async () => { const l = q('mpl'); try { const c = new AbortController(); setTimeout(() => c.abort(), 4000); const r = await (await fetch(HEALTH.replace('/healthz', '/rooms'), { cache: 'no-store', signal: c.signal })).json(); l.innerHTML = r.length ? r.map((g) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span>${esc(DM[g.mode] ? DM[g.mode].short : g.mode.toUpperCase())} - ${g.players}/${g.max} - ${esc(g.phase)}</span><button class="mp-btn alt" style="flex:0 0 64px;padding:4px" data-c="${esc(g.code)}" ${g.full ? 'disabled' : ''}>${g.full ? 'FULL' : 'JOIN'}</button></div>`).join('') : 'No open games right now. Hit FIND MATCH to start one.'; l.querySelectorAll('button[data-c]').forEach((b) => { b.onclick = () => { setName(nm()); connect({ room: b.dataset.c, name: nm() }); }; }); } catch (e) { l.textContent = 'Server is asleep or unreachable. FIND MATCH will wake it up.'; } };
    const status = async () => { const e = q('mps'); if (!e) return; const t0 = performance.now(); try { const c = new AbortController(); const to = setTimeout(() => c.abort(), 6000); const r = await (await fetch(HEALTH.replace('/healthz', '/stats'), { cache: 'no-store', signal: c.signal })).json(); clearTimeout(to); if (e.isConnected) { e.style.color = '#7dffb0'; e.textContent = '\u25CF Server online \u00B7 ' + Math.round(performance.now() - t0) + ' ms \u00B7 ' + (r.players || 0) + ' playing \u00B7 ' + (r.rooms || 0) + ' rooms'; } } catch (er) { if (e.isConnected) { e.style.color = '#ffd24a'; e.textContent = '\u25CF Waking the server up... (free server, up to a minute)'; setTimeout(status, 4000); } } };
    status();
    q('mpr').onclick = () => { loadList(); status(); }; loadList();
    q('mpc').onclick = () => { setName(nm()); connect({ room: 'new', name: nm() }); };
    q('mpg').onclick = () => { const c = q('mpj').value.trim().toUpperCase(); if (!c) return q('mpj').focus(); setName(nm()); connect({ room: c, name: nm() }); };
    q('mpb').onclick = () => { clear(); game.showMenu && game.showMenu(); };
    s.addEventListener('keydown', (e) => e.stopPropagation());
    if (preset) { q('mpj').value = preset; }
    try { const rm = preset || (/[?&]room=([A-Za-z0-9]+)/.exec(location.search) || [])[1]; if (rm && /[?&]go=1/.test(location.search) && !mp.net && !mp._goDone) { mp._goDone = true; q('mpj').value = rm.toUpperCase(); setTimeout(() => q('mpg').click(), 500); } } catch (e) {}
  }

  function wakeScreen(p, attempt) {
    const t0 = performance.now();
    const s = show(`<div class="mp-c"><div class="mp-spin"></div><h2 style="font-size:22px">Waking up the server...</h2><p id="mpw">The free server naps when nobody plays. This takes up to a minute. Retrying automatically.</p><p id="mpt" style="opacity:.5">0s</p><div class="mp-row"><button class="mp-btn alt" id="mpx">CANCEL</button></div></div>`);
    wakeStop = false;
    s.querySelector('#mpx').onclick = () => { wakeStop = true; clearTimeout(wakeTimer); lobby(); };
    const tick = setInterval(() => { const e = s.querySelector('#mpt'); if (e) e.textContent = Math.round((performance.now() - t0) / 1000) + 's'; else clearInterval(tick); }, 500);
    const poll = async () => {
      if (wakeStop) { clearInterval(tick); return; }
      try { const c = new AbortController(); const to = setTimeout(() => c.abort(), 8000); await fetch(HEALTH, { mode: 'no-cors', cache: 'no-store', signal: c.signal }); clearTimeout(to); clearInterval(tick); if (!wakeStop) open(p); return; }
      catch (e) { const w = s.querySelector('#mpw'); if (w) w.textContent = 'Still waking up... retrying'; }
      wakeTimer = setTimeout(poll, 3000);
    };
    poll();
  }

  const keepQ = () => { const m = /[?&](mphost=[\w.:-]+)/.exec(location.search); return m ? '&' + m[1] : ''; }; // dev: keep the local server across map reloads
  function connect(p) {
    if (!profileComplete() && !/[?&]noonboard/.test(location.search)) { requireProfile(document.body, () => connect({ ...p, name: (localStorage.getItem('sc_name') || p.name) })); return; }   // name + company first (also for invite links)
    if ((p.room === 'new' || p.room === 'MATCH') && game.mapId && mapSel !== game.mapId) { loadingStart({ map: mapSel, mode: p.solo ? 'solo' : 'mp' }); loadingStep('SWITCHING MAP', 30); try { sessionStorage.setItem('sc_mp_pending', JSON.stringify({ room: p.room, mode, name: p.name, solo: !!p.solo, gm: p.gm })); } catch (e) {} show(`<div class="mp-c"><div class="mp-spin"></div><h2 style="font-size:22px">Loading map...</h2></div>`); setTimeout(() => location.replace(location.pathname + '?map=' + mapSel + '&mpgo=1' + keepQ()), 250); return; }
    wakeScreen(p, 0);
  }

  async function open(p) {
    show(`<div class="mp-c"><div class="mp-spin"></div><h2 style="font-size:22px">Connecting...</h2></div>`);
    try { await Promise.race([ACC.ensure(), new Promise((r) => setTimeout(r, 5000))]); } catch (e) {}
    const url = WS + '?room=' + encodeURIComponent(p.room) + '&name=' + encodeURIComponent(p.name) + (p.solo ? '&mode=solo&bots=' + Math.max(1, Math.min(4, (game.set && game.set.bots) || 4)) + '&diff=' + encodeURIComponent(game.diff || 'hard') + '&map=' + mapSel + (p.gm && p.gm !== 'bomb' ? '&gm=' + p.gm : '') : p.room === 'new' || p.room === 'MATCH' ? '&mode=' + mode + '&map=' + mapSel : '') + (ACC.hasAccount() ? '&acct=' + encodeURIComponent(ACC.token()) : '')
      + (() => { try { return '&co=' + encodeURIComponent(localStorage.getItem('sc_company') || '') + '&site=' + encodeURIComponent(localStorage.getItem('sc_site') || ''); } catch (e) { return ''; } })();   // company + website (spray logo) even without an account
    const net = new NetClient({ createController, colliders: game.phys, url });
    mp.net = net; let welcomed = false, tries = 0;
    try { initProgress(net, { me: () => (ACC.getProfile() || {}).name, defer: (f) => (mp.fx ? mp.fx.afterSummary(f) : f()) }); } catch (e) {}
    net.on('welcome', (w) => { if (w.map && game.mapId && w.map !== game.mapId) { try { net.close(); } catch (e) {} loadingStart({ map: w.map, mode: w.solo ? 'solo' : 'mp' }); loadingStep('SWITCHING MAP', 30); show(`<div class="mp-c"><div class="mp-spin"></div><h2 style="font-size:22px">Loading map...</h2></div>`); setTimeout(() => location.replace(location.pathname + '?map=' + w.map + '&room=' + w.room + '&go=1' + keepQ()), 250); return; } welcomed = true; loadingStart({ map: w.map || 'a', mode: w.solo ? 'solo' : 'mp' }); loadingStep('JOINING ROOM', 60, 'link'); if (!mp.active) begin(w); else recovered(); loadingStep('SPAWNING PLAYERS', 92, 'room'); loadingDone(); try { history.replaceState(0, '', '?room=' + w.room); } catch (e) {} });
    net.on('error', (m) => { if (!welcomed) { stop(); show(`<div class="mp-c"><h2 style="font-size:22px">Could not join</h2><p>${esc(m.msg || m.code || 'Room unavailable')}</p><div class="mp-row"><button class="mp-btn" id="mpr">BACK</button></div></div>`).querySelector('#mpr').onclick = () => lobby(); } });
    const diag = (o) => { try { fetch(HEALTH.replace('/healthz', '/diag'), { method: 'POST', mode: 'cors', keepalive: true, headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ room: net.room, vis: document.visibilityState, net: (navigator.connection && navigator.connection.effectiveType) || '', rtt: Math.round(net.rttMs || 0), ...o }) }).catch(() => {}); } catch (e) {} };
    const recovered = () => { clearTimeout(mp._rcT); mp._rcT = 0; const down = mp._dropT ? Math.round(performance.now() - mp._dropT) : 0; mp._dropT = 0; if (lastMsg.indexOf('Connection lost') === 0) banner('Reconnected', 1.5); if (down) diag({ c: 'recovered', down }); };
    net.on('close', (e) => { if (!e.intentional) { if (!mp._dropT) mp._dropT = performance.now(); diag({ c: 'close', code: e.code, sinceRx: e.sinceRx }); } });
    net.on('reconnecting', (r) => { if (!mp._rcT) mp._rcT = setTimeout(() => { banner('Connection lost. Reconnecting...', 99); }, 4000); mp._att = r && r.attempt; });
    net.on('disconnected', () => { stop(); show(`<div class="mp-c"><h2 style="font-size:22px">Disconnected</h2><p>The connection dropped.</p><div class="mp-row"><button class="mp-btn" id="mpr">BACK TO LOBBY</button></div></div>`).querySelector('#mpr').onclick = () => lobby(); });
    net.on('close', () => { if (!welcomed && !net.closing && ++tries > 3) { stop(); p._n = (p._n || 0) + 1; if (p._n >= 3) { show(`<div class="mp-c"><h2 style="font-size:22px">Can't reach the server</h2><p>The game server answered but refused the connection. Check your internet, or try again in a minute.</p><div class="mp-row"><button class="mp-btn" id="mpy">TRY AGAIN</button><button class="mp-btn alt" id="mpr">BACK</button></div></div>`).querySelector('#mpy').onclick = () => { p._n = 0; connect(p); }; screen.querySelector('#mpr').onclick = () => lobby(); } else wakeScreen(p, 0); } });
    net.on('drop', (m) => { try { if (m && m.d && !(game.drops || []).some((x) => x.drop.dropId === m.d.dropId)) game.addDrop(m.d); } catch (e) {} });
    net.on('dropgone', (m) => { try { const g = game, d = (g.drops || []).find((x) => x.drop.dropId === m.id); if (d) { g.scene.remove(d.mesh); g.drops.splice(g.drops.indexOf(d), 1); if (g.ws.ammo) { play('ui_click'); } } } catch (e) {} });
    net.on('dropsclear', () => { try { const g = game; for (const d of g.drops || []) g.scene.remove(d.mesh); g.drops = []; } catch (e) {} });
    net.on('swap', () => banner('Switching sides', 3));
    net.on('gnade', (m) => { try { if (!m || m.by === net.id || !Array.isArray(m.o) || !Array.isArray(m.d)) return; game.grenades.throwGrenade(m.id === 'frag' || m.id === 'smoke' || m.id === 'flash' ? m.id : 'frag', { position: { x: m.o[0], y: m.o[1], z: m.o[2] }, direction: { x: m.d[0], y: m.d[1], z: m.d[2] }, charge: Number.isFinite(m.c) ? m.c : undefined, owner: 'remote:' + m.by, team: m.team, consume: false }); } catch (e) {} });
    net.on('round_start', (m) => { bodies.clear(); play('round_start'); { const sd = m && m.sd, idx = { T: 0, CT: 1, Z: 2 }[net.team]; if (sd && idx != null) banner(sd[idx] ? 'ATTACK - plant the bomb at A, B or C (hold E). ' + (sd.reduce((a, b) => a + b, 0) === 2 ? '2 teams attack, 1 defends' : '1 team attacks, 2 defend') : 'DEFEND - stop the bomb at A, B and C. ' + (sd.reduce((a, b) => a + b, 0) === 2 ? 'Allied with 1 team vs 2 attackers' : 'Allied with 1 team vs 1 attacker'), 5.5); else if (!(m && m.dm)) banner('Round start - press B to open the shop', 4.5); } try { matchPoint(m && m.score); } catch (e) {} try { const g = game; if (g.deathCam) { g.deathCam.banner.remove(); g.deathCam = null; g.hud.root.style.display = ''; g.vm.group.visible = true; g.camera.fov = 75; g.camera.updateProjectionMatrix(); } g.killfx.reset(); g.kc.clear(); g.streaks.cancel('round'); g.player.reset(); g.ws.refill(); g.pick('secondary'); g.hud.setHealth(100); } catch (e) {} });
    net.on('round_end', (m) => { if (m && m.dm) { const wn = m.wid ? (net.roster.get(m.wid) || {}).name : m.winner ? { T: 'ORANGE', CT: 'CYAN' }[m.winner] + ' TEAM' : ''; banner(m.wid === net.id ? 'YOU WIN THE MATCH' : wn ? String(wn).toUpperCase() + ' WINS THE MATCH' : 'DRAW', 4); try { play(m.wid ? (m.wid === net.id ? 'round_win' : 'round_lose') : m.winner === net.team ? 'round_win' : 'round_lose'); } catch (e) {} return; }
      banner(net.mode === 'ffa3' && m && m.winner ? ({ T: 'ORANGE', CT: 'CYAN', Z: 'GREEN' }[m.winner] || '') + ' team wins the round' : 'Round over', 2.5); try { play(m && m.winner === net.team ? 'round_win' : 'round_lose'); } catch (e) {} });
    net.on('planted', (m) => { banner('Bomb planted' + (m && m.site ? ' at ' + m.site : ''), 2); play('bomb_plant'); try { mp.fx && mp.fx.an.say('Bomb has been planted', 3); } catch (e) {} });
    net.on('defused', () => { banner('Bomb defused', 2.5); play('bomb_defuse'); setTimeout(() => play('bomb_defuse'), 260); try { mp.fx && mp.fx.an.say('Bomb has been defused', 4); } catch (e) {} });
    net.on('explode', () => { banner('Bomb exploded', 2); play('bomb_explode'); });
    net.on('kill', (m) => { if (!m) return;
      if (m.by === net.id && m.id !== net.id) { try { const hs = m.cause === 'headshot'; play('kill'); game.streaks.registerKill({ headshot: hs }); if (!DM[net.mode]) { game.kf.textContent = hs ? 'HEADSHOT +150' : 'Kill +100'; game.kfT = 1.5; } } catch (e) {} }
      if (m.id !== net.id) { try { const vb = game.bots.list.find((x) => x.netId === m.id); if (vb && vb.alive) { vb._kt = performance.now(); game.bots.damage(vb, 0, false); } } catch (e) {} }
      if (m.id === net.id) { banner(m.rv ? 'You were killed. A teammate can revive you for ' + m.rv + 's' : '', 0.1); try { const g = game, kb = g.bots.list.find((b) => b.netId === m.by); play('death'); g.streaks.registerDeath(); g.killfx.playerDied(); g.hud.setHealth(0); mp._killer = m.by; } catch (e) {} }   // death cam + spectating: spectate.js
      if (m.rv) bodies.set(m.id, { x: m.x, y: m.y, z: m.z, t: performance.now() / 1000, rv: m.rv }); });
    net.on('buyr', (m) => { if (!m) return; try { if (m.ok) { play('buy'); banner('Purchased', 0.8); } else { play('buy_fail'); try { game.eco.cancelOpt(); } catch (e2) {} banner(m.reason || 'Cannot buy that', 1.6); } } catch (e) {} });
    net.on('revive', (m) => { if (!m) return; bodies.delete(m.id); banner(m.id === net.id ? 'You were revived' : 'Teammate revived', 1.6); });
    net.on('shot', (m) => { try { if (m && m.o && m.id !== net.id && mp._pings) { const pings = mp._pings, rt = net.roster.get(m.id), cl = { T: '#ff9a3c', CT: '#46d9ff', Z: '#6fe07a' }, c = cl[rt && rt.team] || '#ff5a5a'; for (let i = pings.length - 1; i >= 0; i--) if (pings[i].id === m.id) pings.splice(i, 1); pings.push({ id: m.id, x: m.o[0], z: m.o[2], t: performance.now(), c }); if (pings.length > 12) pings.shift(); } } catch (e) {} if (!m || m.id === net.id) return; const b = game.bots.list.find((x) => x.netId === m.id); if (b) b.aimT = 0.5; try { const from = new THREE.Vector3(m.o[0], m.o[1], m.o[2]), to = new THREE.Vector3(m.e[0], m.e[1], m.e[2]); play(['shot_pistol', 'shot_mg', 'shot_sniper'][m.w | 0] || 'bot_shot', from); game.anim.onBotShot({ from, to, hit: false });
      if (net.alive) { const e = net.eye(), dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, L2 = dx * dx + dy * dy + dz * dz || 1; let u = ((e.x - from.x) * dx + (e.y - from.y) * dy + (e.z - from.z) * dz) / L2; u = Math.max(0, Math.min(1, u)); const px = from.x + dx * u - e.x, py = from.y + dy * u - e.y, pz = from.z + dz * u - e.z, dd = Math.hypot(px, py, pz); if (dd < 3.2 && u > 0.02) play('whiz', { x: e.x + px, y: e.y + py, z: e.z + pz }); }
      play('impact', { x: to.x, y: to.y, z: to.z }); } catch (e) {} });
    net.on('hit', (m) => { if (!m || m.id !== net.id) return; play('hurt'); try { game.hud.damageFlash(); } catch (e) {} });
    net.on('respawn', (m) => { if (m && m.id === net.id) { bodies.clear(); try { game.hud.setHealth(100); game.ws.refill(); } catch (e) {} } });
    if (mp.fx) { try { mp.fx.dispose(); } catch (e) {} } mp.fx = createMatchFx({ game, net, THREE, play, banner });   // killfeed, announcer, killcam, MVP screen, sprays
    net.connect();
  }

  let isHostNow = () => false;
  function banner(t, secs) { lastMsg = t; msgT = secs; }
  let mpEl = null, mpTimer = 0;
  function matchPoint(sc) {   // a team one round from winning (best of 5 = 3 wins)
    if (!sc || !mp.net) return; if (mp.net.mode === 'ffa3' && Array.isArray(sc) && sc.length === 3) { const lead = sc.map((v, i) => ((v | 0) >= 2 ? ['ORANGE', 'CYAN', 'GREEN'][i] : null)).filter(Boolean); if (!lead.length || sc.some((v) => (v | 0) >= 3)) return; showMP('MATCH POINT - ' + lead.join(' & ')); return; }
    const t = Array.isArray(sc) ? sc : [sc.T, sc.CT]; const mine = mp.net.team === 'T' ? 0 : 1, me = t[mine] | 0, them = t[1 - mine] | 0;
    if (me < 2 && them < 2) return; if (me >= 3 || them >= 3) return;
    const text = me >= 2 && them >= 2 ? 'MATCH POINT - BOTH TEAMS' : me >= 2 ? 'MATCH POINT - ONE ROUND TO WIN' : 'MATCH POINT FOR THE OTHER TEAM';
    showMP(text);
  }
  function showMP(text) {
    if (!mpEl) { mpEl = document.createElement('div'); mpEl.style.cssText = 'position:fixed;left:50%;top:24%;transform:translateX(-50%);z-index:55;pointer-events:none;font:800 34px Fredoka,system-ui,sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 3px 0 #c0392b,0 0 22px #ff7a3a;padding:8px 22px;border-radius:14px;background:#00000066;white-space:nowrap;transition:opacity .4s'; document.body.appendChild(mpEl); }
    mpEl.textContent = text; mpEl.style.opacity = '1'; clearTimeout(mpTimer); mpTimer = setTimeout(() => { if (mpEl) mpEl.style.opacity = '0'; }, 4000);
  }

  function begin(w) {
    try { game.setMusicMode('match'); } catch (e) {} clear(); mp.active = true; game.state = 'play'; game.mode = 'bomb'; game.over = false;
    if (game.ov) game.ov.style.display = 'none';
    if (game.menuStop) try { game.menuStop(); } catch (e) {}
    try { game.bots.setRemote(true); game.killfx.reset(); game.kc.clear(); game.streaks.reset(); game.streaks.show(true); game.player.reset(); game.ws.refill(); game.vm.group.visible = true; game.ctrl.setEnabled(true); } catch (e) {}
    hud = el(`<div class="rc"></div><div class="net"></div><div class="msg"></div><div class="pb" style="display:none;position:absolute;left:50%;top:58%;transform:translateX(-50%);width:240px;text-align:center"><div style="height:10px;border-radius:6px;background:#0009;border:1px solid #fff5;overflow:hidden"><i style="display:block;height:100%;width:0;transition:width .1s linear"></i></div><span style="display:block;margin-top:5px;font-size:13px;font-weight:700;letter-spacing:.16em"></span></div>`, 'mp-hud');
    root.appendChild(hud); try { game.hud.root.style.display = ''; game.hud.setHealth(100); } catch (e) {}
    try { game.newEconomy(); game.eco.setRemote((id) => mp.net && mp.net.sendRaw({ t: 'buy', id })); } catch (e) {}
    try { if (!game._mpHooks) { game._mpHooks = true;
      game.streaks.on('called', ({ id }) => { if (mp.active && mp.net) mp.net.sendRaw({ t: 'scall', id }); });
      game.eco.on && 0; } game.eco.on('grenade', ({ id }) => { if (mp.active && mp.net) { const e = game.ctrl.state.eye, d = game.ctrl.getDirection(); mp.net.sendRaw({ t: 'gren', id, o: [e.x, e.y, e.z], d: [d.x, d.y, d.z], c: Math.round((game._gCharge ?? 0.4) * 1000) / 1000 }); } }); } catch (e) {}
    mp._sk = null; hud.querySelector('.rc').textContent = 'ROOM ' + w.room + ' - share the link or code. Esc = menu';
    bind(); game.canvas.requestPointerLock && game.canvas.requestPointerLock();
  }

  function bind() {
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); binds.push([t, ev, f, o]); };
    const isHost = () => { const ids = [mp.net.id, ...mp.net.roster.keys()]; return mp.net.id === Math.min(...ids); };
    const canBot = () => isHost() && (mp.net.phase === 'waiting' || mp.net.phase === 'freeze');
    on(window, 'keydown', (e) => { if (!mp.net || !canBot() || e.repeat) return; if (e.code === 'KeyK') { mp.net.sendRaw({ t: 'addbot', team: (mp.net.mode === 'ffa3' || isFree(mp.net.mode)) ? 'auto' : mp.net.team === 'T' ? 'CT' : 'T' }); banner('Enemy bot added', 1.5); } else if (e.code === 'KeyL') { mp.net.sendRaw({ t: 'addbot', team: mp.net.team }); banner('Ally bot added', 1.5); } else if (e.code === 'KeyU') { mp.net.sendRaw({ t: 'rmbots' }); banner('Bots removed', 1.5); } });
    mp._canBot = canBot;
    { // Tab = scoreboard: kills, deaths, damage dealt, grouped by team (server roster, refreshed while held)
      const box = document.createElement('div'); box.id = 'mp-sb'; box.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff';
      document.body.appendChild(box); let iv = null, shown = false;
      const rows = (t) => [...mp.net.roster.values()].filter((r) => t === '*' || r.team === t).sort((a, b) => (mp.net.mode === 'gun' ? (b.gl || 0) - (a.gl || 0) : 0) || (b.k || 0) - (a.k || 0) || (b.g || 0) - (a.g || 0));
      const sect = (t, col, label) => { const rs = rows(t), tk = rs.reduce((n, r) => n + (r.k || 0), 0); return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:8px 8px 0 0;background:${col};color:#111;font-weight:700;letter-spacing:.08em"><span>${label}</span><span>${t === '*' ? (mp.net.mode === 'gun' ? 'Gun Game · ' + GUN_ORDER.length + ' levels' : 'first to ' + DM.ffa.limit) : DM[mp.net.mode] ? tk + ' / ' + DM[mp.net.mode].limit + ' kills' : ((mp.net.score && mp.net.score[{ T: 0, CT: 1, Z: 2 }[t]]) ?? 0) + ' rounds &middot; ' + tk + ' kills'}</span></div><table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="opacity:.55;font-size:11px;letter-spacing:.12em"><td style="padding:4px 10px">PLAYER</td><td style="text-align:right">KILLS</td><td style="text-align:right">DEATHS</td><td style="text-align:right;padding-right:10px">DAMAGE</td></tr>${rs.map((r) => `<tr style="${r.id === mp.net.id ? 'background:#ffffff26;font-weight:700' : ''}"><td style="padding:5px 10px">${r.pr ? emblemSVG(r.pr, 14) + ' ' : ''}${esc(r.name || 'Player')}${!r.b && legendOf(r.ch) ? ' <small style="color:#ffd166;opacity:.85">as ' + esc(legendOf(r.ch).name) + '</small>' : ''}${r.b ? ' <small style="opacity:.5">BOT</small>' : r.co ? ' <small style="opacity:.5">' + esc(r.co) + '</small>' : ''}${mp.net.mode === 'gun' ? ' <small style="color:#ffd166">LVL ' + Math.min((r.gl || 0) + 1, GUN_ORDER.length) + '</small>' : ''}${r.id === mp.net.id ? ' <small style="opacity:.6">YOU</small>' : ''}</td><td style="text-align:right">${r.k || 0}</td><td style="text-align:right">${r.d || 0}</td><td style="text-align:right;padding-right:10px">${r.g || 0}</td></tr>`).join('') || '<tr><td style="padding:5px 10px;opacity:.5">-</td></tr>'}</table></div>`; };
      const draw = () => { if (!mp.net) return; box.innerHTML = `<div style="width:min(620px,92vw);padding:18px 20px;border-radius:16px;background:#0b1020e6;box-shadow:0 10px 50px #000a;border:1px solid #ffffff22">${isFree(mp.net.mode) ? sect('*', '#ffd166', mp.net.mode === 'gun' ? 'GUN GAME' : 'FREE-FOR-ALL') : mp.net.mode === 'ffa3' ? sect('T', '#ffb35c', 'ORANGE') + sect('CT', '#7fe3ff', 'CYAN') + sect('Z', '#7dff9a', 'GREEN') : sect('T', '#ffb35c', 'TEAM T') + sect('CT', '#7dffb0', 'TEAM CT')}<div style="opacity:.45;font-size:11px;text-align:center">Hold TAB</div></div>`; };
      const open = () => { if (shown) return; shown = true; box.style.display = 'flex'; draw(); try { mp.net.sendRaw({ t: 'sb' }); } catch (e) {} iv = setInterval(() => { try { mp.net.sendRaw({ t: 'sb' }); } catch (e) {} draw(); }, 500); };
      const close = () => { shown = false; box.style.display = 'none'; clearInterval(iv); iv = null; };
      on(window, 'keydown', (e) => { if (e.code === 'Tab' && mp.active) { e.preventDefault(); if (!e.repeat) open(); } });
      on(window, 'keyup', (e) => { if (e.code === 'Tab') { e.preventDefault(); close(); } });
      on(window, 'blur', close); try { mp.net.on('roster', () => { if (shown) draw(); }); } catch (e) {}
      binds.push([{ removeEventListener() { box.remove(); clearInterval(iv); } }, 'x', null, null]);
    }
    isHostNow = isHost;
    on(window, 'keydown', (e) => { if (e.code !== 'Enter' || e.repeat || !mp.net || !mp.net.lobby || !isHost()) return; const sh = document.querySelector('.eco-shade'); if (sh && !sh.hidden) return; mp.net.sendRaw({ t: 'start' }); });
    mp.net.on('startr', (m) => { if (m && !m.ok) banner(m.reason || 'Cannot start yet', 3); });
    { const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:50%;top:116px;transform:translateX(-50%);z-index:6;display:none;gap:8px;align-items:center;padding:8px 12px;border-radius:14px;background:rgba(10,24,40,.72);color:#fff;font:600 13px Fredoka,system-ui,sans-serif;backdrop-filter:blur(4px)';
      const lab = document.createElement('span'); lab.textContent = 'Host bots:'; lab.style.opacity = '.8'; box.appendChild(lab);
      const mk = (txt, key, fn) => { const b = document.createElement('button'); b.textContent = txt + ' (' + key + ')'; b.style.cssText = 'font:inherit;color:#fff;background:rgba(255,255,255,.16);border:0;border-radius:10px;padding:5px 10px;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); if (mp.net && canBot()) fn(); }; box.appendChild(b); return b; };
      mk('+ Enemy bot', 'K', () => { mp.net.sendRaw({ t: 'addbot', team: (mp.net.mode === 'ffa3' || isFree(mp.net.mode)) ? 'auto' : mp.net.team === 'T' ? 'CT' : 'T' }); banner('Enemy bot added', 1.5); });
      mk('+ Ally bot', 'L', () => { mp.net.sendRaw({ t: 'addbot', team: mp.net.team }); banner('Ally bot added', 1.5); });
      const sbtn = mk('START MATCH', 'Enter', () => { if (mp.net && mp.net.lobby) mp.net.sendRaw({ t: 'start' }); });
      mk('Remove bots', 'U', () => { mp.net.sendRaw({ t: 'rmbots' }); banner('Bots removed', 1.5); });
      document.body.appendChild(box); let hinted = false;
      binds.push([{ removeEventListener() { box.remove(); clearInterval(bt); } }, 'x', null, null]);
      const bt = setInterval(() => { let show = false; try { show = !!(mp.active && mp.net && mp.net.connected && canBot()); } catch (e) {} box.style.display = show ? 'flex' : 'none'; sbtn.style.display = mp.net && mp.net.lobby ? '' : 'none'; if (show && !hinted) { hinted = true; banner('Host: K enemy bot, L ally bot, U remove bots', 4); } if (!show && mp.net && mp.net.phase === 'live') hinted = true; }, 500); }
    { const tb = document.createElement('div'); tb.style.cssText = 'position:fixed;left:50%;top:160px;transform:translateX(-50%);z-index:6;display:none;gap:8px;align-items:center;padding:8px 12px;border-radius:14px;background:rgba(10,24,40,.72);color:#fff;font:600 13px Fredoka,system-ui,sans-serif;backdrop-filter:blur(4px)';
      const tl = document.createElement('span'); tl.textContent = 'Switch team:'; tl.style.opacity = '.8'; tb.appendChild(tl); const tbs = {};
      const defs = [['T', 'Orange', '#ff9a3c'], ['CT', 'Cyan', '#46d9ff'], ['Z', 'Green', '#6fe07a']];
      for (const [tm, nm, col] of defs) { const b = document.createElement('button'); b.style.cssText = 'font:inherit;color:#10162b;border:2px solid transparent;border-radius:10px;padding:5px 12px;cursor:pointer;background:' + col; b.onclick = (e) => { e.stopPropagation(); if (mp.net && mp.net.team !== tm) mp.net.sendRaw({ t: 'team', team: tm }); }; tbs[tm] = [b, nm]; tb.appendChild(b); }
      document.body.appendChild(tb);
      mp.net.on('teamr', (m) => { if (m && !m.ok) banner(m.reason || 'Cannot switch', 2.5); else if (m && m.team) mp.net.team = m.team; });
      mp.net.on('roster', () => { try { const r = mp.net.roster.get(mp.net.id); if (r && r.team) mp.net.team = r.team; } catch (e) {} });
      const tt = setInterval(() => { let show = false; try { const n = mp.net; show = !!(mp.active && n && n.connected && game.state !== 'menu' && (n.phase === 'waiting' || n.phase === 'end') && !isFree(n.mode)); if (show) { const ts = n.mode === 'ffa3' ? ['T', 'CT', 'Z'] : ['T', 'CT']; for (const k2 of Object.keys(tbs)) { const [b, nm] = tbs[k2]; b.style.display = ts.includes(k2) ? '' : 'none'; b.textContent = nm; b.style.borderColor = n.team === k2 ? '#fff' : 'transparent'; b.style.opacity = n.team === k2 ? '1' : '.75'; } } } catch (e) {} tb.style.display = show ? 'flex' : 'none'; }, 400);
      binds.push([{ removeEventListener() { tb.remove(); clearInterval(tt); } }, 'x', null, null]); }
    { // always-visible minimap (map layout + local player arrow only)
      const cv = document.createElement('canvas'); cv.className = 'mp-mini'; cv.width = 168; cv.height = 168; cv.style.cssText = 'position:fixed;left:12px;top:46px;width:168px;height:168px;z-index:5;display:none;border-radius:12px;border:2px solid rgba(255,255,255,.35);background:rgba(10,24,40,.55);pointer-events:none';
      document.body.appendChild(cv); let drawn = null, base = null, geo = null; const pings = mp._pings = [];
      const draw = () => { const m = game.map, ng = m && m.navGrid; if (!ng) return; drawn = m; const ctx = cv.getContext('2d'), W = cv.width; geo = ng; ctx.clearRect(0, 0, W, W);
        const off = document.createElement('canvas'); off.width = ng.cols; off.height = ng.rows; const ox = off.getContext('2d'), im = ox.createImageData(ng.cols, ng.rows);
        let hmax = 1; for (let i = 0; i < ng.walkable.length; i++) if (ng.walkable[i] && ng.height[i] > hmax) hmax = ng.height[i];
        for (let i = 0; i < ng.walkable.length; i++) { const o = i * 4; if (ng.walkable[i]) { const t = Math.min(1, Math.max(0, ng.height[i] / hmax)), v = 150 + 90 * t; im.data[o] = v; im.data[o + 1] = v + 10; im.data[o + 2] = v - 20; im.data[o + 3] = 235; } else { im.data[o + 3] = 0; } }
        ox.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 4, 4, W - 8, W - 8);
        ctx.font = '700 14px Fredoka,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const key of Object.keys(m.bombsites || {})) { const c = m.bombsites[key].center, px = 4 + (c.x - ng.originX) / ng.cols * (W - 8), py = 4 + (c.z - ng.originZ) / ng.rows * (W - 8); ctx.fillStyle = 'rgba(255,120,60,.9)'; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(key, px, py + 1); }
        base = document.createElement('canvas'); base.width = W; base.height = W; base.getContext('2d').drawImage(cv, 0, 0); };
      const dot = () => { if (!base || !geo) return; const ctx = cv.getContext('2d'), W = cv.width, p = mp.net && mp.net.cur ? mp.net.eye().feet : null; if (!p) return; ctx.clearRect(0, 0, W, W); ctx.drawImage(base, 0, 0); const yaw = game.ctrl.state.yaw || 0, px = 4 + (p.x - geo.originX) / geo.cols * (W - 8), py = 4 + (p.z - geo.originZ) / geo.rows * (W - 8), dx = -Math.sin(yaw), dy = -Math.cos(yaw);
        { const now = performance.now(); for (let i = pings.length - 1; i >= 0; i--) { const pg = pings[i], age = now - pg.t; if (age > 1600) { pings.splice(i, 1); continue; } const qx = 4 + (pg.x - geo.originX) / geo.cols * (W - 8), qy = 4 + (pg.z - geo.originZ) / geo.rows * (W - 8), k = age / 1600; ctx.globalAlpha = 1 - k; ctx.fillStyle = pg.c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(qx, qy, 3 + 6 * k, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(qx, qy, 3.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(dy, dx)); ctx.fillStyle = '#2ee6ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); };
      const mt = setInterval(() => { let show = false; try { show = !!(mp.active && mp.net && mp.net.connected && game.state !== 'menu' && !(game.eco && game.eco.getState().menuOpen)); /* hidden while the buy menu is open (it drew over the shop) */ if (show && drawn !== game.map) draw(); } catch (e) {} cv.style.display = show ? 'block' : 'none'; try { const fb = document.getElementById('fs'); if (fb) fb.style.display = show ? 'none' : 'block'; } catch (e) {} }, 300);   // fullscreen button leaves the HUD during multiplayer play (it covered the money); it lives in the Esc menu
      binds.push([{ removeEventListener() { const fb = document.getElementById('fs'); if (fb) fb.style.display = 'block'; } }, 'x', null, null]);
      const dt2 = setInterval(() => { try { if (cv.style.display !== 'none') dot(); } catch (e) {} }, 80);
      binds.push([{ removeEventListener() { cv.remove(); clearInterval(mt); clearInterval(dt2); } }, 'x', null, null]); }
    const pm = { el: null, t: 0 };   // Esc pause menu: stays fullscreen (keyboard lock in the browser), releases the mouse
    function closePause(relock) { if (pm.el) { pm.el.remove(); pm.el = null; } window.__pauseOpen = false; pm.t = performance.now(); if (relock) { try { game.canvas.requestPointerLock(); } catch (e) {} } }
    function openPause() {
      if (pm.el || !mp.active) return; window.__pauseOpen = true; for (const k of Object.keys(keys)) delete keys[k]; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
      const el = document.createElement('div'); pm.el = el; el.setAttribute('data-pm', '1');
      el.style.cssText = 'position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(5,10,24,.55);font-family:Fredoka,system-ui,sans-serif';
      const bs = 'display:block;width:260px;margin:10px auto;padding:13px 0;border:0;border-radius:12px;font:600 17px Fredoka,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;color:#10162b;background:#ffb347';
      el.innerHTML = `<div style="text-align:center;color:#fff;padding:26px 34px;border-radius:18px;background:#0b1020ee;box-shadow:0 10px 50px #000a;border:1px solid #ffffff22"><div style="font:700 26px Fredoka,system-ui,sans-serif;letter-spacing:.12em;margin-bottom:8px">PAUSED</div><div style="font-size:12px;opacity:.6;margin-bottom:10px">The match keeps running</div><button data-a="res" style="${bs}">RESUME</button><button data-a="set" style="${bs};background:#7fe3ff">SETTINGS</button><button data-a="leave" style="${bs};background:#ff8a8a">LEAVE ROOM / BACK TO MENU</button></div>`;
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      { const card = el.firstChild, leave = el.querySelector('[data-a=leave]'), row = document.createElement('div'), n = mp.net, ts = isFree(n.mode) ? [] : n.mode === 'ffa3' ? [['T', 'Orange', '#ff9a3c'], ['CT', 'Cyan', '#46d9ff'], ['Z', 'Green', '#6fe07a']] : [['T', 'Orange', '#ff9a3c'], ['CT', 'Cyan', '#46d9ff']], can = (n.phase === 'waiting' || n.phase === 'end') && !isFree(n.mode);
        row.style.cssText = 'margin:12px 0 4px;font:600 13px Fredoka,system-ui,sans-serif'; const cap = document.createElement('div'); cap.style.cssText = 'opacity:.7;margin-bottom:6px'; cap.textContent = can ? 'SWITCH TEAM' : 'SWITCH TEAM (lobby / between rounds only)'; row.appendChild(cap);
        for (const [tm, nm, col] of ts) { const b = document.createElement('button'); b.textContent = nm; b.disabled = !can; b.style.cssText = 'font:inherit;border:2px solid ' + (n.team === tm ? '#fff' : 'transparent') + ';border-radius:10px;padding:6px 12px;margin:0 4px;cursor:' + (can ? 'pointer' : 'not-allowed') + ';color:#10162b;background:' + col + ';opacity:' + (can ? (n.team === tm ? 1 : .8) : .4); b.onclick = (e) => { e.stopPropagation(); if (can && n.team !== tm) { n.sendRaw({ t: 'team', team: tm }); setTimeout(() => { closePause(true); }, 150); } }; row.appendChild(b); }
        card.insertBefore(row, leave);
        const fsb = document.createElement('button'); fsb.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; fsb.style.cssText = bs + ';background:#c9b8ff'; fsb.onclick = (e) => { e.stopPropagation(); const fb = document.getElementById('fs'); if (fb) fb.click(); setTimeout(() => { fsb.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; }, 300); };
        card.insertBefore(fsb, leave); }
      el.querySelector('[data-a=res]').onclick = () => closePause(true);
      el.querySelector('[data-a=set]').onclick = () => { el.style.display = 'none'; game.openSettings(); };
      el.querySelector('[data-a=leave]').onclick = () => { closePause(false); game.showMenu(); };
      document.body.appendChild(el);
    }
    if (!game._csWrapped) { game._csWrapped = true; const cs = game.closeSettings.bind(game); game.closeSettings = () => { cs(); pm.t = performance.now(); if (pm.el) pm.el.style.display = 'flex'; }; }
    on(document, 'pointerlockchange', () => { if (!mp.active || document.pointerLockElement || pm.el) return; setTimeout(() => { try { if (mp.active && !pm.el && !document.pointerLockElement && !(game.eco && game.eco.getState().menuOpen) && (!game.setOv || game.setOv.style.display === 'none') && game.state === 'play') openPause(); } catch (e) {} }, 120); });
    on(document, 'keydown', (e) => { if (!mp.active) return; if (e.code === 'Escape') { if (performance.now() - (pm.t || 0) < 150) return; if (game.setOv && game.setOv.style.display !== 'none') return; e.preventDefault(); pm.el ? closePause(true) : openPause(); return; } if (pm.el) return; keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    on(document, 'keyup', (e) => { keys[e.code] = false; });
    on(document, 'keydown', (e) => { if (e.code !== 'KeyT' || e.repeat || !mp.active || !mp.fx || pm.el || !document.pointerLockElement || (game.eco && game.eco.getState().menuOpen)) return; mp.fx.spray(); });   // T = spray your company logo
    on(document, 'keydown', (e) => { if ((e.code !== 'KeyQ' && e.code !== 'KeyX') || e.repeat || !mp.active || !mp.fx || pm.el || (game.eco && game.eco.getState().menuOpen)) return; if (e.code === 'KeyQ') mp.fx.pow.use(); else mp.fx.pow.taser(); });   // Q = superpower, X = taser
    on(game.canvas, 'mousedown', (e) => { if (!mp.active || pm.el) return; if (document.pointerLockElement !== game.canvas) { game.canvas.requestPointerLock(); return; } if (game.eco && game.eco.getState().menuOpen) return; if (e.button === 0) { if (!(mp.net.me.pp > 0 || mp.net.me.dp > 0)) { mp.net.setInput({ fire: true }); mp.net.tap(); } } });
    on(document, 'mouseup', (e) => { if (mp.active && e.button === 0) mp.net.setInput({ fire: false }); });
    on(window, 'blur', () => { keys = {}; });
  }

  const v3 = new THREE.Vector3();
  const isAttacker = () => { const net = mp.net; return net.mode === 'ffa3' ? !!(net.sd && net.sd[{ T: 0, CT: 1, Z: 2 }[net.team]]) : net.team === 'T'; };
  /** 'plant:A' when you can plant here, 'defuse' next to the planted bomb as a defender, else null (client mirror of room.tryPlant / tryDefuse) */
  function bombAction() {
    const net = mp.net; if (!net || !net.alive || DM[net.mode] || !net.cur || !game.map) return null; const c = net.cur, atk = isAttacker();
    if (atk && net.phase === 'live') { const bs = game.map.bombsites || {}; for (const k of Object.keys(bs)) { const s = bs[k]; if (Math.hypot(c.x - s.center.x, c.z - s.center.z) < s.radius && Math.abs(c.y - s.center.y) < 2) return 'plant:' + k; } }
    if (!atk && net.phase === 'planted' && net.bomb && Math.hypot(c.x - net.bomb.x, c.z - net.bomb.z) < R.DEFUSE_RADIUS && Math.abs(c.y - net.bomb.y) < 2) return 'defuse';
    return null;
  }
  // Called by the solo Game.update each frame: feeds local input to the server and mirrors the server state into the SAME solo systems
  // (ctrl pose, player hp, eco, bomb, opponents as bots).
  mp.drive = (dt) => {
    const net = mp.net; if (!net) return;
    const g = game, st = g.ctrl.state, k = keys;
    if (!net.cur) return;
    if (mp._re !== net.respawns) { mp._re = net.respawns; g.ctrl.teleport({ x: net.cur.x, y: net.cur.y, z: net.cur.z }, { yaw: net.yaw, pitch: net.pitch }); } else { net.yaw = st.yaw; net.pitch = st.pitch; }
    const drv = !!(g.streaks && g.streaks.cameraOverride);   // driving the RC car / guiding a missile: the body must stand still, only the car moves
    const stun = !!(mp.fx && mp.fx.pow.stunned);   // tased / blue-screened: no input at all (the server ignores it too)
    const hold = drv || stun || (!!k.KeyE && !!bombAction());   // planting / defusing: you stand still (like CS), so the progress never resets by itself
    net.setInput({ kn: !!g.knifeOn, f: hold ? 0 : (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r: hold ? 0 : (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), j: !hold && !!k.Space, c: !drv && !!(k.ShiftLeft || k.ShiftRight), rl: !stun && !!k.KeyR, use: !stun && !!k.KeyE, sm: !!(mp.fx && mp.fx.pow.turbo), aim: !!g.ws.aiming, w: Math.max(0, WEAPON_ORDER.indexOf(g.ws.current)) });
    const busy = ((net.me.pp > 0 || net.me.dp > 0) && net.alive) || stun; if (busy || !net.alive) net.setInput({ fire: false });
    if (!net.alive || busy) g.ws.setTrigger(false);
    net.update(dt);
    try { if (!g.zoneMesh) g.setZone(); if (net.sz && g.zoneMesh) {  g.zoneMesh.position.x = net.sz[0]; g.zoneMesh.position.z = net.sz[1]; if (g.zone) { g.zone.x = net.sz[0]; g.zone.z = net.sz[1]; if (net.sz[2] != null) { g.zone.y = net.sz[2]; g.zoneMesh.position.y = net.sz[2] + 0.05; } } } } catch (er) {}
    const e = net.eye();
    g.ctrl.teleport({ x: e.feet.x, y: e.feet.y, z: e.feet.z }, { yaw: st.yaw, pitch: st.pitch });
    try { const vy = net.me.v ? net.me.v[1] : 0; if (vy > 13 && (mp._vy || 0) < 6 && mp.fx) mp.fx.an.sound('boing'); mp._vy = vy; } catch (er) {}   // super trampoline / Starship launch
    try { st.velocity.x = net.me.v ? net.me.v[0] : 0; st.velocity.y = net.me.v ? net.me.v[1] : 0; st.velocity.z = net.me.v ? net.me.v[2] : 0; st.grounded = e.grounded !== false; st.crouched = !!e.crouched; st.speed = Math.hypot(st.velocity.x, st.velocity.z); } catch (er) {}
    try { const sw = WEAPON_ORDER[net.me.weapon]; if (sw && (mp._sw !== net.me.weapon || (net.mode === 'gun' && !g.knifeOn && g.ws.current !== sw))) { mp._sw = net.me.weapon;   /* Gun Game: you hold the gun of your level, nothing else */ if (g.ws.current !== sw && !g.knifeOn) { g.owned.add(sw); g.ws.select(sw); } } const ca = g.ws.ammo[g.ws.current]; if (ca && net.me.mag != null && g.ws.current === sw) { ca.mag = net.me.mag; ca.reserve = net.me.res; } } catch (er) {}
    g.player.hp = Math.max(0, net.me.hp || 0); g.player.alive = net.alive;
    g.bots.syncRemote((mp.fx && mp.fx.cam.players()) || net.remotes());
    if (g.zoneMesh) g.zoneMesh.visible = !DM[net.mode]; if (document.body.classList.contains('sc-dm') !== !!DM[net.mode]) document.body.classList.toggle('sc-dm', !!DM[net.mode]);
    if (net.mode === 'gun' && net.me.gl != null && mp._gl !== net.me.gl) { const was = mp._gl; mp._gl = net.me.gl; const kn = GUN_ORDER[net.me.gl] === 'knife'; try { if (kn && !g.knifeOn) g.toggleKnife(); else if (!kn && g.knifeOn && was != null && GUN_ORDER[was] === 'knife') { g.unKnife(); const sw2 = WEAPON_ORDER[net.me.weapon]; if (sw2) { g.owned.add(sw2); g.ws.select(sw2); } } } catch (er) {} }
    if (net.mode === 'gun' && net.alive && GUN_ORDER[net.me.gl] === 'knife' && !g.knifeOn) try { g.toggleKnife(); } catch (er) {}
    const ph = net.phase === 'freeze' ? 'freeze' : (net.phase === 'live' || net.phase === 'planted' || (net.phase === 'waiting' && net.lobby)) ? 'live' : 'ended', inv = net.me.inv || [];
    g.eco.remote({ ...(net.me.ks != null ? { knifeskin: !!(net.me.ks & 1), butterfly: !!(net.me.ks & 2) } : {}), grenades: net.me.gr, armor: net.me.ar, helmet: net.me.he, taser: !!net.me.tz, money: net.me.m, primary: inv[0], secondary: inv[1], team: (net.mode === 'ffa3' && net.sd ? (net.sd[{ T: 0, CT: 1, Z: 2 }[net.team]] ? 'T' : 'CT') : net.team), alive: net.alive, phase: ph, freezeRemaining: ph === 'freeze' ? net.phaseLeft : 0 });
    if (net.bomb && net.bomb.x != null) { g.bomb.planted = net.phase === 'planted';   // beacon only while the fuse runs: after a defuse or a round end the server keeps the bomb record until the next round
      g.bomb.t = net.bomb.t; g.bomb.site = net.bomb.site || ''; g.bomb.pos.set(net.bomb.x, net.bomb.y, net.bomb.z); g.bombMesh.position.set(net.bomb.x, net.bomb.y + 0.13, net.bomb.z); g.bombMesh.visible = true; }
    else { g.bomb.planted = false; g.bombMesh.visible = false; }
    g.plantT = net.alive && net.me.pp > 0 ? 1 : 0;   // bomb in hand only while planting (defusing used to show it too)
  };
  mp.xdmg = (b, amt) => { if (mp.net && b && b.netId != null) mp.net.sendRaw({ t: 'xdmg', id: b.netId, amt: Math.round(amt) }); };
  mp.pickup = (id) => { if (mp.net) mp.net.sendRaw({ t: 'pickup', id }); };
  mp.fixCam = (cam) => {
    const net = mp.net; if (!net) return;
    const e = net.eye(); cam.position.set(e.x, e.y, e.z);
    if (!mp.spec) mp.spec = createSpectator(THREE, { camera: cam, root: game.root, world: game.world });
    if (mp.fx && mp.fx.cam.active) { if (mp.spec.active) mp.spec.stop(); mp.fx.cam.update(game._real || 1 / 60); game.vm.group.visible = false; if (game.knife) game.knife.visible = false; mp._specVM = true; mp._spec = null; return; }
    const on = mp.spec.update(game._real || 1 / 60, { dead: !net.alive, phase: net.phase, myId: net.id, myTeam: isFree(net.mode) ? '-' : net.team, players: game.bots.list, eye: e, killerId: mp._killer });
    mp._spec = on ? mp.spec.target() : null;
    if (on) { game.vm.group.visible = false; if (game.knife) game.knife.visible = false; mp._specVM = true; }   // own hands/weapon hidden while dead
    else if (mp._specVM) { mp._specVM = false; mp._killer = null; if (game.knifeOn) game.knife.visible = true; else game.vm.group.visible = true; }
  };
  mp.hud = (dt, hint) => {
    const net = mp.net; if (!net) return; const g = game;
    const q = (c) => hud.querySelector('.' + c);
    try { mp.fx && mp.fx.pow.update(dt); } catch (e) {}
    const dsc = mp.fx && mp.fx.score();
    if (dsc) { const key = 'dm' + dsc.p + ':' + dsc.b + ':' + dsc.label; if (mp._sk !== key) { mp._sk = key; g.match = { p: dsc.p, b: dsc.b, round: 0, dm: dsc.label }; g.renderSB(); } }
    else try { const my = { T: 0, CT: 1, Z: 2 }[net.team] ?? 1, oth = net.mode === 'ffa3' ? Math.max(...net.score.filter((_, i) => i !== my).map((v) => v | 0)) : net.score[1 - my], key = net.score[my] + ':' + oth + ':' + net.round;
      if (mp._sk !== key) { mp._sk = key; g.match = { p: net.score[my], b: oth, round: net.round }; g.renderSB(); } } catch (er) {}
    const bt = net.bomb && net.bomb.t != null && net.phase === 'planted' ? 'BOMB ' + Math.ceil(net.bomb.t) + 's' : '';
    if (!DM[net.mode] && !hint) { try {   // bomb hints for every bomb mode (1v1 / 2v2 had none): where to plant, how to defuse
      const act = net.alive ? bombAction() : null, kit = !!(g.eco && g.eco.getState().inventory.defusekit), atk = isAttacker();
      if (act && act.startsWith('plant')) hint = 'Hold E to plant the bomb at ' + act.slice(6);
      else if (act === 'defuse') hint = 'Hold E to defuse' + (kit ? ' (kit: 2.5 s)' : ' (5 s, a kit halves it)');
      else if (net.mode === 'ffa3' && net.phase === 'live') hint = atk ? 'ATTACK' : 'DEFEND';
      else if (net.phase === 'planted') hint = atk ? 'Defend the bomb' : 'Find and defuse the bomb';
    } catch (e) {} }
    { // plant / defuse progress bar under the crosshair + sounds
      const pp = net.alive ? net.me.pp || 0 : 0, dp = net.alive ? net.me.dp || 0 : 0, kit = !!(g.eco && g.eco.getState().inventory.defusekit), pb = q('pb');
      const st = pp > 0 ? 'plant' : dp > 0 ? 'defuse' : '', f = pp > 0 ? Math.min(1, pp) : Math.min(1, dp / (kit ? 0.5 : 1)), total = pp > 0 ? R.PLANT : R.DEFUSE * (kit ? 0.5 : 1);
      if (pb) { pb.style.display = st ? '' : 'none'; if (st) { pb.querySelector('i').style.width = Math.round(f * 100) + '%'; pb.querySelector('i').style.background = st === 'plant' ? '#ff9a3c' : '#46d9ff'; pb.querySelector('span').textContent = (st === 'plant' ? 'PLANTING' : 'DEFUSING' + (kit ? ' · KIT' : '')) + ' · ' + Math.max(0, total * (1 - f)).toFixed(1) + ' s'; } }
      if (st !== mp._bst) { if (st === 'defuse') play('defuse_start'); mp._bst = st; mp._bsT = 0; }
      if (st) { mp._bsT = (mp._bsT || 0) - dt; if (mp._bsT <= 0) { mp._bsT = st === 'plant' ? 0.4 : 0.7; play(st === 'plant' ? 'bomb_beep' : 'defuse_start'); } }   // keypad beeps / wire clicks
    }
    if (DM[net.mode]) g.info.textContent = mp.fx ? mp.fx.info() : '';
    else g.info.textContent = net.phase === 'freeze' ? `BUY PHASE · ${Math.ceil(net.phaseLeft)} s · B = shop` : `${bt || hint || ''}${bt ? '' : (hint ? ' · ' : '') + (net.phase || '').toUpperCase() + ' ' + Math.ceil(net.phaseLeft || 0) + 's'}`;
    q('net').textContent = Math.round(net.rttMs) + ' ms';
    { const LH = 'PRESS ENTER TO START  -  K / L add bots', LW = 'Waiting for the host to start the match'; if (net.lobby) { let h = false; try { h = isHostNow(); } catch (e) {} lastMsg = h ? LH : LW; msgT = 0.5; } else if (lastMsg === LH || lastMsg === LW || lastMsg.indexOf('Host: K') === 0) { lastMsg = ''; msgT = 0; } }
    if (net.alive && net.phase === 'live') { /* room hint fades after the round starts */ }
    const cam = g.camera;
    for (const b of g.bots.list) {
      if (!b.net) continue; const p = b.net;
      if (!b.tag) { b.tag = el(esc(p.name || ''), 'tag'); hud.appendChild(b.tag); }
      if (p.alive && b.sp3 !== 1 && (b.stepT = (b.stepT || 0) - dt) <= 0 && (b._sp || 0) > 3) { b.stepT = 0.36; play('footstep', { x: p.x, y: p.y, z: p.z }); }
      v3.set(p.x, p.y + 2.1, p.z).project(cam); const vis = b.group.visible && p.alive && v3.z < 1 && p.team === net.team && !isFree(net.mode) && !(mp.fx && mp.fx.cam.active);
      b.tag.style.display = vis ? '' : 'none'; if (vis) { b.tag.style.left = ((v3.x + 1) / 2 * 100) + '%'; b.tag.style.top = ((1 - v3.y) / 2 * 100) + '%'; b.tag.style.color = '#7fe3ff'; }
    }
    if (net.alive && bodies.size) { const nowS = performance.now() / 1000, e = net.eye(); let best = null, bdist = 2.4; for (const [id, b] of bodies) { if (nowS - b.t > b.rv) { bodies.delete(id); continue; } const bb = g.bots.list.find((x) => x.netId === id); if (!bb || bb.net.team !== net.team) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bdist) { bdist = d; best = bb; } } if (best) banner('Hold E to revive ' + (best.name || 'teammate'), 0.2); }
    if (net.bomb && net.bomb.t != null && net.phase === 'planted') { bombBeepT -= dt; if (bombBeepT <= 0) { const left = Math.max(0, net.bomb.t); bombBeepT = left < 5 ? 0.25 : left < 10 ? 0.5 : left < 20 ? 0.8 : 1.1; play('bomb_beep', { x: net.bomb.x, y: net.bomb.y, z: net.bomb.z }); } }
    if (msgT > 0) { msgT -= dt; q('msg').textContent = msgT > 0 ? lastMsg : ''; } else if (lastMsg && msgT <= 0 && lastMsg.indexOf('Reconnecting') < 0) q('msg').textContent = '';
    else q('msg').textContent = lastMsg;
    if (!net.alive && (net.phase === 'live' || net.phase === 'planted')) q('msg').textContent = DM[net.mode] || mp._spec ? '' : 'You are dead. Waiting for the round to end';
    else if (net.alive && net.me.pt && !q('msg').textContent) q('msg').textContent = 'Spawn protection';
  };

  function stop() {
    window.__pauseOpen = false; document.querySelectorAll('[data-pm]').forEach((e) => e.remove());
    try { game.setMusicMode('menu'); } catch (e) {}
    mp.active = false; remotes.forEach((r) => { game.scene.remove(r.ch.group); }); remotes.clear(); if (mp.fx) { try { mp.fx.dispose(); } catch (e) {} mp.fx = null; }
    if (mp.net) { try { mp.net.closing = true; mp.net.ws && mp.net.ws.close(); } catch (e) {} mp.net = null; }
    binds.forEach(([t, ev, f, o]) => t.removeEventListener(ev, f, o)); binds = [];
    if (hud) { hud.remove(); hud = null; } try { game.bots.setRemote(false); game.streaks.show(true); game.hud.root.style.display = 'none'; game.hud.setScope(false); game.sb.style.display = 'none'; if (game.sbm) game.sbm.style.display = 'none'; } catch (e) {} keys = {}; game.state = 'menu'; wakeStop = true; clearTimeout(wakeTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    try { game.vm.group.visible = false; } catch (e) {}
  }
  try { const V = '1006h', vd = document.createElement('div'); vd.textContent = 'v' + V; vd.style.cssText = 'position:fixed;right:10px;bottom:6px;z-index:5;font:600 11px Fredoka,system-ui,sans-serif;letter-spacing:.08em;color:#fff;opacity:.4;pointer-events:none;text-shadow:0 1px 3px #000'; document.body.appendChild(vd); let first = null, newer = false; const chk = () => fetch(location.pathname + '?nv=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then((t) => { const m = /main\.js\?v=([0-9a-z]+)/.exec(t); if (!m) return; if (first === null) first = m[1]; else if (m[1] !== first && !newer) { newer = true; vd.textContent = 'v' + V + '  \u2022 new version available - refresh'; vd.style.opacity = '.85'; vd.style.color = '#ffd86b'; } }).catch(() => {}); chk(); setInterval(chk, 90000); setInterval(() => { vd.style.display = game.state === 'menu' ? '' : 'none'; }, 700); } catch (e) {}
  mp.stop = stop; mp.open = lobby;
  mp.solo = (m, gm) => { if (m === 'a' || m === 'b') mapSel = m; let n = 'Player'; try { n = localStorage.getItem('sc_name') || 'Player'; } catch (e) {} connect({ room: 'new', name: n, solo: true, gm: DM[gm] ? gm : 'bomb' }); };
  mp.autoJoin = () => { const m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search); if (m) { lobby(m[1].toUpperCase()); if (/[?&]go=1/.test(location.search)) { let n = 0; const iv = setInterval(() => { const b = document.querySelector('#mpg'); if (b && !mp.net) { clearInterval(iv); b.click(); } else if (++n > 40) clearInterval(iv); }, 400); } return true; } return false; };
  return mp;
      }
