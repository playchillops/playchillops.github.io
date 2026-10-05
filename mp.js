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
.mp-hud .top{top:44px}
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
  if (!document.getElementById('mp-css')) { const s = document.createElement('style'); s.id = 'mp-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = game.root;
  const mp = { active: false, net: null };
  const bodies = new Map(); let bombBeepT = 0; let screen = null, hud = null, remotes = new Map(), keys = {}, locked = false, wakeTimer = null, wakeStop = false, mode = '1v1', binds = [], lastMsg = '', msgT = 0;
  const getName = () => { try { return localStorage.getItem('sc_name') || ''; } catch (e) { return ''; } };
  const setName = (n) => { try { localStorage.setItem('sc_name', n); } catch (e) {} };
  const clear = () => { if (screen) { screen.remove(); screen = null; } };
  const show = (html) => { clear(); screen = el(`<div class="mp-card">${html}</div>`, 'mp'); root.appendChild(screen); return screen; };

  function lobby(preset) {
    const s = show(`<h2>MULTIPLAYER</h2><p>Bomb mode. Plant or defuse, first to 5 rounds.</p>
<label>YOUR NAME</label><input id="mpn" maxlength="14" value="${esc(getName())}" placeholder="Player">
<label>MODE</label><div class="mp-row" style="margin-top:0"><button class="mp-btn" id="m1">1v1</button><button class="mp-btn alt" id="m2">2v2</button></div>
<div class="mp-row"><button class="mp-btn" id="mpf">FIND MATCH</button><button class="mp-btn alt" id="mpc">CREATE PRIVATE ROOM</button></div>
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
    q('mpr').onclick = loadList; loadList();
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
    const url = WS + '?room=' + encodeURIComponent(p.room) + '&name=' + encodeURIComponent(p.name) + (p.room === 'new' || p.room === 'MATCH' ? '&mode=' + mode : '') + (ACC.hasAccount() ? '&acct=' + encodeURIComponent(ACC.token()) : '');
    const net = new NetClient({ createController, colliders: game.phys, url });
    mp.net = net; let welcomed = false, tries = 0;
    net.on('welcome', (w) => { welcomed = true; if (!mp.active) begin(w); else banner('Reconnected', 1.5); try { history.replaceState(0, '', '?room=' + w.room); } catch (e) {} });
    net.on('error', (m) => { if (!welcomed) { stop(); show(`<div class="mp-c"><h2 style="font-size:22px">Could not join</h2><p>${esc(m.msg || m.code || 'Room unavailable')}</p><div class="mp-row"><button class="mp-btn" id="mpr">BACK</button></div></div>`).querySelector('#mpr').onclick = () => lobby(); } });
    net.on('reconnecting', () => { banner('Connection lost. Reconnecting...', 99); });
    net.on('disconnected', () => { stop(); show(`<div class="mp-c"><h2 style="font-size:22px">Disconnected</h2><p>The connection dropped.</p><div class="mp-row"><button class="mp-btn" id="mpr">BACK TO LOBBY</button></div></div>`).querySelector('#mpr').onclick = () => lobby(); });
    net.on('close', () => { if (!welcomed && !net.closing && ++tries > 3) { stop(); p._n = (p._n || 0) + 1; if (p._n >= 3) { show(`<div class="mp-c"><h2 style="font-size:22px">Can't reach the server</h2><p>The game server answered but refused the connection. Check your internet, or try again in a minute.</p><div class="mp-row"><button class="mp-btn" id="mpy">TRY AGAIN</button><button class="mp-btn alt" id="mpr">BACK</button></div></div>`).querySelector('#mpy').onclick = () => { p._n = 0; connect(p); }; screen.querySelector('#mpr').onclick = () => lobby(); } else wakeScreen(p, 0); } });
    net.on('swap', () => banner('Switching sides', 3));
    net.on('round_start', () => banner('Round start', 1.6));
    net.on('round_end', (m) => banner(m && m.winner != null ? 'Round over' : 'Round over', 2.5));
    net.on('planted', () => banner('Bomb planted', 2));
    net.on('defused', () => banner('Bomb defused', 2));
    net.on('explode', () => banner('Bomb exploded', 2));
    net.on('kill', (m) => { if (!m) return; if (m.by === net.id) banner('You got a kill', 1.2); else if (m.id === net.id) banner(m.rv ? 'You were killed. A teammate can revive you for ' + m.rv + 's' : 'You were killed', 2.5);
      if (m.rv) bodies.set(m.id, { x: m.x, y: m.y, z: m.z, t: performance.now() / 1000, rv: m.rv }); });
    net.on('revive', (m) => { if (!m) return; bodies.delete(m.id); banner(m.id === net.id ? 'You were revived' : 'Teammate revived', 1.6); });
    net.on('round_start', () => { bodies.clear(); play('round_start'); });
    net.on('shot', (m) => { if (!m) return; const nm = SHOT[m.w] || 'shot_mg'; if (m.id === net.id) { play(nm); try { game.vm.fire(); } catch (e) {} } else { play(nm, P3(m.o)); const rr = remotes.get(m.id); if (rr) rr.aimT = 0.5; } });
    net.on('hit', (m) => { if (!m) return; if (m.id === net.id) { play('hurt'); try { game.hud.damageFlash(); } catch (e) {} } else if (m.by === net.id) { play(m.head ? 'headshot' : 'hit'); try { game.hud.hitMarker(!!m.kill, !!m.head); } catch (e) {} } if (m.kill && m.by === net.id) play('kill'); });
    net.on('planted', () => play('bomb_plant')); net.on('defused', () => play('bomb_defuse')); net.on('explode', () => play('bomb_explode'));
    net.on('round_end', (m) => { try { play(m && m.winner === net.team ? 'round_win' : 'round_lose'); } catch (e) {} });
    net.connect();
  }

  function banner(t, secs) { lastMsg = t; msgT = secs; }

  function begin(w) {
    clear(); mp.active = true; game.state = 'mp';
    if (game.ov) game.ov.style.display = 'none';
    if (game.menuStop) try { game.menuStop(); } catch (e) {}
    game.bots && game.bots.clear && game.bots.clear();
    try { game.vm.group.visible = true; } catch (e) {}
    hud = el(`<div class="cr"></div><div class="top"><div class="sc"><b>0</b> : <b>0</b></div><div class="ph"></div></div><div class="rc"></div><div class="hp"></div><div class="am"></div><div class="net"></div><div class="msg"></div>`, 'mp-hud');
    root.appendChild(hud); try { game.hud.root.style.display = ''; game.hud.setHealth(100); } catch (e) {}
    mp._sk = null; hud.querySelector('.rc').textContent = 'ROOM ' + w.room + ' - share the link or code. L to leave';
    bind(); game.canvas.requestPointerLock && game.canvas.requestPointerLock();
  }

  function bind() {
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); binds.push([t, ev, f, o]); };
    on(document, 'keydown', (e) => { if (!mp.active) return; if (e.code === 'Escape') return; if (e.code === 'KeyL') { game.showMenu(); return; } keys[e.code] = true; if (e.code === 'KeyQ' && !e.repeat) mp.net.input.aim = !mp.net.input.aim; if (e.code.startsWith('Digit') && +e.code[5] >= 1 && +e.code[5] <= 3 && e.code !== 'Digit3') mp.net.setInput({ w: +e.code[5] - 1 }); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    on(document, 'keyup', (e) => { keys[e.code] = false; });
    on(game.canvas, 'mousedown', (e) => { if (!mp.active) return; if (document.pointerLockElement !== game.canvas) { game.canvas.requestPointerLock(); return; } if (e.button === 0) { if (!(mp.net.me.pp > 0 || mp.net.me.dp > 0)) { mp.net.setInput({ fire: true }); mp.net.tap(); } } if (e.button === 2) mp.net.input.aim = !mp.net.input.aim; e.preventDefault(); });
    on(document, 'mouseup', (e) => { if (mp.active && e.button === 0) mp.net.setInput({ fire: false }); });
    on(document, 'mousemove', (e) => { if (mp.active && document.pointerLockElement === game.canvas) mp.net.look(e.movementX, e.movementY); });
    on(window, 'blur', () => { keys = {}; });
  }

  function charFor(p) {
    let r = remotes.get(p.id);
    if (!r) {
      const ch = createCharacter(THREE, { id: CHARACTER_IDS[p.id % CHARACTER_IDS.length], team: p.team === mp.net.team ? 'CT' : 'T', weapon: WEAPON_ORDER[p.weapon] || 'machinegun' });
      game.scene.add(ch.group);
      const tag = el(esc(p.name), 'tag'); hud.appendChild(tag);
      r = { ch, tag, lx: p.x, lz: p.z, wp: p.weapon }; remotes.set(p.id, r);
    }
    return r;
  }

  const v3 = new THREE.Vector3();
  mp.frame = (dt) => {
    const net = mp.net; if (!net) return;
    const k = keys;
    net.setInput({ f: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), j: !!k.Space, c: !!(k.ShiftLeft || k.ShiftRight), rl: !!k.KeyR, use: !!k.KeyE });
    const busy = (net.me.pp > 0 || net.me.dp > 0) && net.alive; if (busy) net.setInput({ fire: false });
    net.update(dt);
    game.plantT = busy ? 1 : 0; try { game.plantAnimTick(dt); } catch (er) {}
    const e = net.eye(), cam = game.camera;
    cam.position.set(e.x, e.y, e.z); cam.rotation.order = 'YXZ'; cam.rotation.set(e.pitch, e.yaw, 0);
    try { setListener({ x: e.x, y: e.y, z: e.z }, { x: -Math.sin(e.yaw) * Math.cos(e.pitch), y: Math.sin(e.pitch), z: -Math.cos(e.yaw) * Math.cos(e.pitch) }); } catch (er) {}
    const want = new Set(); const rem = net.remotes(); let spec = null;
    if (!net.alive && net.phase !== 'waiting') spec = rem.find((r) => r.team === net.team && r.alive && r.connected !== false) || null;
    if (spec) { cam.position.set(spec.x, spec.y + (spec.crouched ? 1.1 : 1.6), spec.z); cam.rotation.set(spec.pitch, spec.yaw, 0); }
    for (const p of rem) {
      want.add(p.id); const r = charFor(p);
      const bd = bodies.get(p.id), fresh = bd && !p.alive && (performance.now() / 1000 - bd.t) < bd.rv;
      r.ch.group.visible = (p.alive || fresh) && p.connected !== false && p !== spec; r.ch.group.rotation.z = fresh ? Math.PI / 2 : 0; r.ch.group.position.set(p.x, p.y, p.z); r.ch.group.rotation.y = p.yaw;
      const sp = dt > 0 ? Math.hypot(p.x - r.lx, p.z - r.lz) / dt : 0; r.lx = p.x; r.lz = p.z; r.sp = (r.sp || 0) + (sp - (r.sp || 0)) * 0.3;
      r.aimT = Math.max(0, (r.aimT || 0) - dt); try { r.ch.update(dt, { speed: r.sp, crouched: !!p.crouched || !!p.c, aiming: r.aimT > 0, pitch: p.pitch, reloading: false, weapon: WEAPON_ORDER[p.weapon], alive: p.alive }); } catch (er) {}
      if (p.alive && r.sp > 3 && (r.stepT = (r.stepT || 0) - dt) <= 0) { r.stepT = 0.36; play('footstep', { x: p.x, y: p.y, z: p.z }); }
      v3.set(p.x, p.y + 2.1, p.z).project(cam); const vis = r.ch.group.visible && v3.z < 1;
      const mate = p.team === net.team; r.tag.style.display = vis && mate ? '' : 'none'; if (vis) { r.tag.style.left = ((v3.x + 1) / 2 * 100) + '%'; r.tag.style.top = ((1 - v3.y) / 2 * 100) + '%'; r.tag.style.color = p.team === net.team ? '#7fe3ff' : '#ffb347'; }
    }
    if (net.alive && bodies.size) { const nowS = performance.now() / 1000; let best = null, bdist = 2.4; for (const [id, b] of bodies) { if (nowS - b.t > b.rv) { bodies.delete(id); continue; } const rp = rem.find((r) => r.id === id); if (!rp || rp.team !== net.team) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bdist) { bdist = d; best = rp; } } if (best) banner('Hold E to revive ' + (best.name || 'teammate'), 0.2); }
    if (net.bomb && net.bomb.t != null && net.phase === 'planted') { bombBeepT -= dt; if (bombBeepT <= 0) { const left = Math.max(0, net.bomb.t); bombBeepT = left < 5 ? 0.25 : left < 10 ? 0.5 : left < 20 ? 0.8 : 1.1; play('bomb_beep', typeof net.bomb.x === 'number' ? { x: net.bomb.x, y: net.bomb.y || 0, z: net.bomb.z } : undefined); } }
    for (const [id, r] of remotes) if (!want.has(id)) { game.scene.remove(r.ch.group); r.tag.remove(); remotes.delete(id); }
    // viewmodel
    try { const wi = WEAPON_ORDER[net.me.weapon]; if (wi && game.vm.current !== wi) game.vm.setWeapon(wi); game.vm.group.visible = net.alive && !(game.handBomb && game.handBomb.hid); game.vm.update(dt, { speed: e.speed, grounded: e.grounded, crouched: e.crouched, aiming: net.input.aim }); } catch (er) {}
    cam.fov = net.input.aim ? 30 : 75; cam.updateProjectionMatrix();
    // HUD
    const q = (c) => hud.querySelector('.' + c);
    try { const my = net.team === 'T' ? 0 : 1, key = net.score[my] + ':' + net.score[1 - my] + ':' + net.round;
      if (mp._sk !== key) { mp._sk = key; game.match = { p: net.score[my], b: net.score[1 - my], round: net.round }; game.renderSB(); }
      if (game.sbm) game.sbm.style.display = 'none'; } catch (er) {}
    q('ph').textContent = (net.phase || '').toUpperCase() + (net.phaseLeft ? '  ' + Math.ceil(net.phaseLeft) + 's' : '') + (net.bomb ? '  BOMB ' + (net.bomb.t != null ? Math.ceil(net.bomb.t) + 's' : '') : '');
    q('hp').textContent = (net.alive || net.phase !== 'live') ? Math.max(0, Math.round(net.me.hp || 100)) : 'DEAD';
    q('am').innerHTML = (net.alive || net.phase !== 'live') ? `${net.me.mag} <small>/ ${net.me.res}</small>` : '';
    q('net').textContent = Math.round(net.rttMs) + ' ms';
    try { const H = game.hud, show = net.alive || net.phase !== 'live'; H.setHealth(Math.max(0, net.me.hp || 100)); H.setAmmo(net.me.mag, net.me.res, String(WEAPON_ORDER[net.me.weapon] || '').toUpperCase(), net.me.rl > 0); H.setScope(!!net.input.aim, net.input.aim ? 1 : 0); H.setCrosshair(6 + (net.me.bloom || 0) * 400, show && !net.input.aim);
      if (net.me.rl > 0 && !mp._rl) { try { game.vm.reload(1.4); } catch (e) {} } mp._rl = net.me.rl > 0; } catch (er) {}
    if (msgT > 0) { msgT -= dt; q('msg').textContent = msgT > 0 ? lastMsg : ''; } else if (lastMsg && msgT <= 0 && lastMsg.indexOf('Reconnecting') < 0) q('msg').textContent = '';
    else q('msg').textContent = lastMsg;
    if (!net.alive && net.phase === 'live') q('msg').textContent = spec ? 'Spectating ' + spec.name : 'You are dead. Waiting for the round to end';
    game.renderMP();
  };

  function stop() {
    mp.active = false; remotes.forEach((r) => { game.scene.remove(r.ch.group); }); remotes.clear();
    if (mp.net) { try { mp.net.closing = true; mp.net.ws && mp.net.ws.close(); } catch (e) {} mp.net = null; }
    binds.forEach(([t, ev, f, o]) => t.removeEventListener(ev, f, o)); binds = [];
    if (hud) { hud.remove(); hud = null; } try { game.hud.root.style.display = 'none'; game.hud.setScope(false); game.sb.style.display = 'none'; if (game.sbm) game.sbm.style.display = 'none'; } catch (e) {} keys = {}; game.state = 'menu'; wakeStop = true; clearTimeout(wakeTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    try { game.vm.group.visible = false; } catch (e) {}
  }
  mp.stop = stop; mp.open = lobby;
  mp.autoJoin = () => { const m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search); if (m) { lobby(m[1].toUpperCase()); return true; } return false; };
  return mp;
}
