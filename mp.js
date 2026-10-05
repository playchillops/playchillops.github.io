// mp.js - multiplayer lobby, wake screen and in-match client (uses net.js / common.js)
import { NetClient } from './net.js';
import * as ACC from './account.js';
import { lobbyPanel } from './social.js';
import { createController } from './movement.js';
import { createCharacter, CHARACTER_IDS } from './characters.js';
import { WEAPON_ORDER } from './player.js';
import { play, setListener, initAudio } from './audio.js';
const SHOT = ['shot_pistol', 'shot_mg', 'shot_sniper'];
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
  const bodies = new Map(); let bombBeepT = 0; let screen = null, hud = null, remotes = new Map(), keys = {}, locked = false, wakeTimer = null, wakeStop = false, mode = '1v1', binds = [], lastMsg = '', msgT = 0;
  const getName = () => { try { return localStorage.getItem('sc_name') || ''; } catch (e) { return ''; } };
  const setName = (n) => { try { localStorage.setItem('sc_name', n); } catch (e) {} };
  const clear = () => { if (screen) { screen.remove(); screen = null; } };
  const show = (html) => { clear(); screen = el(`<div class="mp-card">${html}</div>`, 'mp'); root.appendChild(screen); return screen; };

  function lobby(preset) {
    const s = show(`<h2>MULTIPLAYER</h2><p>Bomb mode. Best of 5, sides swap after round 3.</p>
<label>YOUR NAME</label><input id="mpn" maxlength="14" value="${esc(getName())}" placeholder="Player">
<label>MODE</label><div class="mp-row" style="margin-top:0"><button class="mp-btn" id="m1">1v1</button><button class="mp-btn alt" id="m2">2v2</button></div>
<div class="mp-row"><button class="mp-btn" id="mpf">FIND MATCH</button><button class="mp-btn alt" id="mpc">CREATE PRIVATE ROOM</button></div>
<div id="mps" style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin:10px 0 0">Checking server...</div>
<label>OPEN GAMES <a id="mpr" style="cursor:pointer;opacity:.8">refresh</a></label><div id="mpl" style="max-height:110px;overflow:auto;font-size:14px;opacity:.9">Loading...</div>
<label>OR JOIN WITH A CODE</label><div class="mp-row" style="margin-top:0"><input id="mpj" maxlength="8" placeholder="CODE" style="text-transform:uppercase"><button class="mp-btn alt" id="mpg" style="flex:0 0 90px">JOIN</button></div>
<div class="mp-row"><button class="mp-btn alt" id="mpb">BACK</button></div>`);
    s.appendChild(lobbyPanel());
    const q = (i) => s.querySelector('#' + i), nm = () => (q('mpn').value.trim() || 'Player').slice(0, 14);
    const setMode = (m) => { mode = m; q('m1').classList.toggle('alt', m !== '1v1'); q('m2').classList.toggle('alt', m !== '2v2'); };
    setMode(mode);
    q('m1').onclick = () => setMode('1v1'); q('m2').onclick = () => setMode('2v2');
    q('mpf').onclick = () => { setName(nm()); connect({ room: 'MATCH', name: nm() }); };
    const loadList = async () => { const l = q('mpl'); try { const c = new AbortController(); setTimeout(() => c.abort(), 4000); const r = await (await fetch(HEALTH.replace('/healthz', '/rooms'), { cache: 'no-store', signal: c.signal })).json(); l.innerHTML = r.length ? r.map((g) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span>${g.mode.toUpperCase()} - ${g.players}/${g.max} - ${esc(g.phase)}</span><button class="mp-btn alt" style="flex:0 0 64px;padding:4px" data-c="${esc(g.code)}" ${g.full ? 'disabled' : ''}>${g.full ? 'FULL' : 'JOIN'}</button></div>`).join('') : 'No open games right now. Hit FIND MATCH to start one.'; l.querySelectorAll('button[data-c]').forEach((b) => { b.onclick = () => { setName(nm()); connect({ room: b.dataset.c, name: nm() }); }; }); } catch (e) { l.textContent = 'Server is asleep or unreachable. FIND MATCH will wake it up.'; } };
    const status = async () => { const e = q('mps'); if (!e) return; const t0 = performance.now(); try { const c = new AbortController(); const to = setTimeout(() => c.abort(), 6000); const r = await (await fetch(HEALTH.replace('/healthz', '/stats'), { cache: 'no-store', signal: c.signal })).json(); clearTimeout(to); if (e.isConnected) { e.style.color = '#7dffb0'; e.textContent = '\u25CF Server online \u00B7 ' + Math.round(performance.now() - t0) + ' ms \u00B7 ' + (r.players || 0) + ' playing \u00B7 ' + (r.rooms || 0) + ' rooms'; } } catch (er) { if (e.isConnected) { e.style.color = '#ffd24a'; e.textContent = '\u25CF Waking the server up... (free server, up to a minute)'; setTimeout(status, 4000); } } };
    status();
    q('mpr').onclick = () => { loadList(); status(); }; loadList();
    q('mpc').onclick = () => { setName(nm()); connect({ room: 'new', name: nm() }); };
    q('mpg').onclick = () => { const c = q('mpj').value.trim().toUpperCase(); if (!c) return q('mpj').focus(); setName(nm()); connect({ room: c, name: nm() }); };
    q('mpb').onclick = () => { clear(); game.showMenu && game.showMenu(); };
    s.addEventListener('keydown', (e) => e.stopPropagation());
    if (preset) { q('mpj').value = preset; }
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

  function connect(p) { wakeScreen(p, 0); }

  async function open(p) {
    show(`<div class="mp-c"><div class="mp-spin"></div><h2 style="font-size:22px">Connecting...</h2></div>`);
    try { await Promise.race([ACC.ensure(), new Promise((r) => setTimeout(r, 5000))]); } catch (e) {}
    const url = WS + '?room=' + encodeURIComponent(p.room) + '&name=' + encodeURIComponent(p.name) + (p.solo ? '&mode=solo&bots=' + Math.max(1, Math.min(4, (game.set && game.set.bots) || 4)) + '&diff=' + encodeURIComponent(game.diff || 'hard') : p.room === 'new' || p.room === 'MATCH' ? '&mode=' + mode : '') + (ACC.hasAccount() ? '&acct=' + encodeURIComponent(ACC.token()) : '');
    const net = new NetClient({ createController, colliders: game.phys, url });
    mp.net = net; let welcomed = false, tries = 0;
    net.on('welcome', (w) => { welcomed = true; if (!mp.active) begin(w); else recovered(); try { history.replaceState(0, '', '?room=' + w.room); } catch (e) {} });
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
    net.on('round_start', () => { bodies.clear(); play('round_start'); banner('Round start', 1.6); try { const g = game; if (g.deathCam) { g.deathCam.banner.remove(); g.deathCam = null; g.hud.root.style.display = ''; g.vm.group.visible = true; g.camera.fov = 75; g.camera.updateProjectionMatrix(); } g.killfx.reset(); g.kc.clear(); g.streaks.cancel('round'); g.player.reset(); g.ws.refill(); g.pick('secondary'); g.hud.setHealth(100); } catch (e) {} });
    net.on('round_end', (m) => { banner('Round over', 2.5); try { play(m && m.winner === net.team ? 'round_win' : 'round_lose'); } catch (e) {} });
    net.on('planted', () => { banner('Bomb planted', 2); play('bomb_plant'); });
    net.on('defused', () => { banner('Bomb defused', 2); play('bomb_defuse'); });
    net.on('explode', () => { banner('Bomb exploded', 2); play('bomb_explode'); });
    net.on('kill', (m) => { if (!m) return;
      if (m.id === net.id) { banner(m.rv ? 'You were killed. A teammate can revive you for ' + m.rv + 's' : '', 0.1); try { const g = game, kb = g.bots.list.find((b) => b.netId === m.by); g.streaks.registerDeath(); g.killfx.playerDied(); g.hud.setHealth(0); if (kb) g.startDeathCam(kb.group.position, 'You were eliminated.'); } catch (e) {} }
      if (m.rv) bodies.set(m.id, { x: m.x, y: m.y, z: m.z, t: performance.now() / 1000, rv: m.rv }); });
    net.on('revive', (m) => { if (!m) return; bodies.delete(m.id); banner(m.id === net.id ? 'You were revived' : 'Teammate revived', 1.6); });
    net.on('shot', (m) => { if (!m || m.id === net.id) return; const b = game.bots.list.find((x) => x.netId === m.id); if (b) b.aimT = 0.5; try { const from = new THREE.Vector3(m.o[0], m.o[1], m.o[2]), to = new THREE.Vector3(m.e[0], m.e[1], m.e[2]); play('bot_shot', from); game.anim.onBotShot({ from, to, hit: false }); } catch (e) {} });
    net.on('hit', (m) => { if (!m || m.id !== net.id) return; play('hurt'); try { game.hud.damageFlash(); } catch (e) {} });
    net.connect();
  }

  function banner(t, secs) { lastMsg = t; msgT = secs; }

  function begin(w) {
    try { game.setMusicMode('match'); } catch (e) {} clear(); mp.active = true; game.state = 'play'; game.mode = 'bomb'; game.over = false;
    if (game.ov) game.ov.style.display = 'none';
    if (game.menuStop) try { game.menuStop(); } catch (e) {}
    try { game.bots.setRemote(true); game.killfx.reset(); game.kc.clear(); game.streaks.reset(); game.streaks.show(true); game.player.reset(); game.ws.refill(); game.vm.group.visible = true; game.ctrl.setEnabled(true); } catch (e) {}
    hud = el(`<div class="rc"></div><div class="net"></div><div class="msg"></div>`, 'mp-hud');
    root.appendChild(hud); try { game.hud.root.style.display = ''; game.hud.setHealth(100); } catch (e) {}
    try { game.newEconomy(); game.eco.setRemote((id) => mp.net && mp.net.sendRaw({ t: 'buy', id })); } catch (e) {}
    try { if (!game._mpHooks) { game._mpHooks = true;
      game.streaks.on('called', ({ id }) => { if (mp.active && mp.net) mp.net.sendRaw({ t: 'scall', id }); });
      game.eco.on && 0; } game.eco.on('grenade', ({ id }) => { if (mp.active && mp.net) mp.net.sendRaw({ t: 'gren', id }); }); } catch (e) {}
    mp._sk = null; hud.querySelector('.rc').textContent = 'ROOM ' + w.room + ' - share the link or code. L to leave';
    bind(); game.canvas.requestPointerLock && game.canvas.requestPointerLock();
  }

  function bind() {
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); binds.push([t, ev, f, o]); };
    const isHost = () => { const ids = [mp.net.id, ...mp.net.roster.keys()]; return mp.net.id === Math.min(...ids); };
    const canBot = () => isHost() && (mp.net.phase === 'waiting' || mp.net.phase === 'freeze');
    on(window, 'keydown', (e) => { if (!mp.net || !canBot() || e.repeat) return; if (e.code === 'KeyK') { mp.net.sendRaw({ t: 'addbot', team: mp.net.team === 'T' ? 'CT' : 'T' }); banner('Enemy bot added', 1.5); } else if (e.code === 'KeyL') { mp.net.sendRaw({ t: 'addbot', team: mp.net.team }); banner('Ally bot added', 1.5); } else if (e.code === 'KeyU') { mp.net.sendRaw({ t: 'rmbots' }); banner('Bots removed', 1.5); } });
    mp._canBot = canBot;
    on(document, 'keydown', (e) => { if (!mp.active) return; if (e.code === 'Escape') return; if (e.code === 'KeyL') { game.showMenu(); return; } keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    on(document, 'keyup', (e) => { keys[e.code] = false; });
    on(game.canvas, 'mousedown', (e) => { if (!mp.active) return; if (document.pointerLockElement !== game.canvas) { game.canvas.requestPointerLock(); return; } if (game.eco && game.eco.getState().menuOpen) return; if (e.button === 0) { if (!(mp.net.me.pp > 0 || mp.net.me.dp > 0)) { mp.net.setInput({ fire: true }); mp.net.tap(); } } });
    on(document, 'mouseup', (e) => { if (mp.active && e.button === 0) mp.net.setInput({ fire: false }); });
    on(window, 'blur', () => { keys = {}; });
  }

  const v3 = new THREE.Vector3();
  // Called by the solo Game.update each frame: feeds local input to the server and mirrors the server state into the SAME solo systems
  // (ctrl pose, player hp, eco, bomb, opponents as bots).
  mp.drive = (dt) => {
    const net = mp.net; if (!net) return;
    const g = game, st = g.ctrl.state, k = keys;
    if (!net.cur) return;
    if (mp._re !== net.respawns) { mp._re = net.respawns; g.ctrl.teleport({ x: net.cur.x, y: net.cur.y, z: net.cur.z }, { yaw: net.yaw, pitch: net.pitch }); } else { net.yaw = st.yaw; net.pitch = st.pitch; }
    net.setInput({ f: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), j: !!k.Space, c: !!(k.ShiftLeft || k.ShiftRight), rl: !!k.KeyR, use: !!k.KeyE, aim: !!g.ws.aiming, w: Math.max(0, WEAPON_ORDER.indexOf(g.ws.current)) });
    const busy = (net.me.pp > 0 || net.me.dp > 0) && net.alive; if (busy || !net.alive) net.setInput({ fire: false });
    if (!net.alive || busy) g.ws.setTrigger(false);
    net.update(dt);
    const e = net.eye();
    g.ctrl.teleport({ x: e.feet.x, y: e.feet.y, z: e.feet.z }, { yaw: st.yaw, pitch: st.pitch });
    try { st.velocity.x = net.me.v ? net.me.v[0] : 0; st.velocity.y = net.me.v ? net.me.v[1] : 0; st.velocity.z = net.me.v ? net.me.v[2] : 0; st.grounded = e.grounded !== false; st.crouched = !!e.crouched; st.speed = Math.hypot(st.velocity.x, st.velocity.z); } catch (er) {}
    try { const sw = WEAPON_ORDER[net.me.weapon]; if (sw && mp._sw !== net.me.weapon) { mp._sw = net.me.weapon; if (g.ws.current !== sw && !g.knifeOn) { g.owned.add(sw); g.ws.select(sw); } } const ca = g.ws.ammo[g.ws.current]; if (ca && net.me.mag != null && g.ws.current === sw) { ca.mag = net.me.mag; ca.reserve = net.me.res; } } catch (er) {}
    g.player.hp = Math.max(0, net.me.hp || 0); g.player.alive = net.alive;
    g.bots.syncRemote(net.remotes());
    const ph = net.phase === 'freeze' ? 'freeze' : (net.phase === 'live' || net.phase === 'planted') ? 'live' : 'ended', inv = net.me.inv || [];
    g.eco.remote({ grenades: net.me.gr, armor: net.me.ar, helmet: net.me.he, money: net.me.m, primary: inv[0], secondary: inv[1], team: net.team, alive: net.alive, phase: ph, freezeRemaining: ph === 'freeze' ? net.phaseLeft : 0 });
    if (net.bomb && net.bomb.x != null) { g.bomb.planted = true; g.bomb.t = net.bomb.t; g.bomb.pos.set(net.bomb.x, net.bomb.y, net.bomb.z); g.bombMesh.position.set(net.bomb.x, net.bomb.y + 0.13, net.bomb.z); g.bombMesh.visible = true; }
    else { g.bomb.planted = false; g.bombMesh.visible = false; }
    g.plantT = busy ? 1 : 0;
  };
  mp.xdmg = (b, amt) => { if (mp.net && b && b.netId != null) mp.net.sendRaw({ t: 'xdmg', id: b.netId, amt: Math.round(amt) }); };
  mp.pickup = (id) => { if (mp.net) mp.net.sendRaw({ t: 'pickup', id }); };
  mp.fixCam = (cam) => {
    const net = mp.net; if (!net) return;
    const e = net.eye(); cam.position.set(e.x, e.y, e.z);
    let spec = null; if (!net.alive && net.phase !== 'waiting') { spec = game.bots.list.find((b) => b.net && b.net.team === net.team && b.alive && b.net.connected !== false) || null; }
    mp._spec = spec;
    if (spec) { cam.position.set(spec.net.x, spec.net.y + (spec.net.crouched ? 1.1 : 1.6), spec.net.z); cam.rotation.set(spec.net.pitch, spec.net.yaw, 0); }
  };
  mp.hud = (dt, hint) => {
    const net = mp.net; if (!net) return; const g = game;
    const q = (c) => hud.querySelector('.' + c);
    try { const my = net.team === 'T' ? 0 : 1, key = net.score[my] + ':' + net.score[1 - my] + ':' + net.round;
      if (mp._sk !== key) { mp._sk = key; g.match = { p: net.score[my], b: net.score[1 - my], round: net.round }; g.renderSB(); } } catch (er) {}
    const bt = net.bomb && net.bomb.t != null && net.phase === 'planted' ? 'BOMB ' + Math.ceil(net.bomb.t) + 's' : '';
    g.info.textContent = net.phase === 'freeze' ? `BUY PHASE · ${Math.ceil(net.phaseLeft)} s · B = shop` : `${bt || hint || ''}${bt ? '' : (hint ? ' · ' : '') + (net.phase || '').toUpperCase() + ' ' + Math.ceil(net.phaseLeft || 0) + 's'}`;
    q('net').textContent = Math.round(net.rttMs) + ' ms';
    if (mp._canBot && mp._canBot() && !(msgT > 0)) lastMsg = 'Host: K = add enemy bot · L = add ally bot · U = remove bots'; else if (lastMsg.indexOf('Host: K') === 0) lastMsg = '';
    if (net.alive && net.phase === 'live') { /* room hint fades after the round starts */ }
    const cam = g.camera;
    for (const b of g.bots.list) {
      if (!b.net) continue; const p = b.net;
      if (!b.tag) { b.tag = el(esc(p.name || ''), 'tag'); hud.appendChild(b.tag); }
      if (p.alive && b.sp3 !== 1 && (b.stepT = (b.stepT || 0) - dt) <= 0 && (b._sp || 0) > 3) { b.stepT = 0.36; play('footstep', { x: p.x, y: p.y, z: p.z }); }
      v3.set(p.x, p.y + 2.1, p.z).project(cam); const vis = b.group.visible && p.alive && v3.z < 1 && p.team === net.team;
      b.tag.style.display = vis ? '' : 'none'; if (vis) { b.tag.style.left = ((v3.x + 1) / 2 * 100) + '%'; b.tag.style.top = ((1 - v3.y) / 2 * 100) + '%'; b.tag.style.color = '#7fe3ff'; }
    }
    if (net.alive && bodies.size) { const nowS = performance.now() / 1000, e = net.eye(); let best = null, bdist = 2.4; for (const [id, b] of bodies) { if (nowS - b.t > b.rv) { bodies.delete(id); continue; } const bb = g.bots.list.find((x) => x.netId === id); if (!bb || bb.net.team !== net.team) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bdist) { bdist = d; best = bb; } } if (best) banner('Hold E to revive ' + (best.name || 'teammate'), 0.2); }
    if (net.bomb && net.bomb.t != null && net.phase === 'planted') { bombBeepT -= dt; if (bombBeepT <= 0) { const left = Math.max(0, net.bomb.t); bombBeepT = left < 5 ? 0.25 : left < 10 ? 0.5 : left < 20 ? 0.8 : 1.1; play('bomb_beep', { x: net.bomb.x, y: net.bomb.y, z: net.bomb.z }); } }
    if (msgT > 0) { msgT -= dt; q('msg').textContent = msgT > 0 ? lastMsg : ''; } else if (lastMsg && msgT <= 0 && lastMsg.indexOf('Reconnecting') < 0) q('msg').textContent = '';
    else q('msg').textContent = lastMsg;
    if (!net.alive && net.phase === 'live') q('msg').textContent = mp._spec ? 'Spectating ' + (mp._spec.name || '') : 'You are dead. Waiting for the round to end';
  };

  function stop() {
    try { game.setMusicMode('menu'); } catch (e) {}
    mp.active = false; remotes.forEach((r) => { game.scene.remove(r.ch.group); }); remotes.clear();
    if (mp.net) { try { mp.net.closing = true; mp.net.ws && mp.net.ws.close(); } catch (e) {} mp.net = null; }
    binds.forEach(([t, ev, f, o]) => t.removeEventListener(ev, f, o)); binds = [];
    if (hud) { hud.remove(); hud = null; } try { game.bots.setRemote(false); game.streaks.show(true); game.hud.root.style.display = 'none'; game.hud.setScope(false); game.sb.style.display = 'none'; if (game.sbm) game.sbm.style.display = 'none'; } catch (e) {} keys = {}; game.state = 'menu'; wakeStop = true; clearTimeout(wakeTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    try { game.vm.group.visible = false; } catch (e) {}
  }
  try { const V = (new URL(import.meta.url).searchParams.get('v') || 'dev').slice(0, 7), vd = document.createElement('div'); vd.textContent = 'v' + V; vd.style.cssText = 'position:fixed;right:10px;bottom:6px;z-index:5;font:600 11px Fredoka,system-ui,sans-serif;letter-spacing:.08em;color:#fff;opacity:.4;pointer-events:none;text-shadow:0 1px 3px #000'; document.body.appendChild(vd); setInterval(() => { vd.style.display = game.state === 'menu' ? '' : 'none'; }, 700); } catch (e) {}
  mp.stop = stop; mp.open = lobby;
  mp.solo = () => { let n = 'Player'; try { n = localStorage.getItem('sc_name') || 'Player'; } catch (e) {} connect({ room: 'new', name: n, solo: true }); };
  mp.autoJoin = () => { const m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search); if (m) { lobby(m[1].toUpperCase()); return true; } return false; };
  return mp;
}
