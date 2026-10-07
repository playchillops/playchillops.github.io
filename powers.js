// powers.js - superpowers + taser on the client (Juan 2026-10-06): HUD meter (Q), your power's screen effect, remote effects
// (cloaked players fade out, X-ray shows enemies through walls, stunned players spark), taser arcs, Blue Screen and taser stun
// overlays, and the VFX of every 'power' event (Starship flames, Prime box drop, Blue Screen wave). Server rules: room.js usePower().
import { POWERS, legendOf, isFree } from './common.js';
const CSS = `.pw-hud{position:fixed;left:24px;bottom:112px;z-index:24;display:flex;align-items:center;gap:10px;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-shadow:0 1px 4px #000}
.pw-hud svg{width:56px;height:56px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}.pw-hud b{display:block;font-size:15px;letter-spacing:.1em}.pw-hud small{font-size:11px;letter-spacing:.16em;opacity:.85}
.pw-hud.ready svg{animation:pwpulse 1s ease-in-out infinite}@keyframes pwpulse{50%{transform:scale(1.12)}}
.pw-fx{position:fixed;inset:0;z-index:23;pointer-events:none;display:none}
.pw-tag{position:fixed;left:50%;top:21%;transform:translateX(-50%);z-index:43;pointer-events:none;font:800 16px Fredoka,system-ui,sans-serif;letter-spacing:.2em;color:#fff;text-shadow:0 0 12px var(--c),0 2px 4px #000;display:none}
.pw-stun{position:fixed;inset:0;z-index:47;pointer-events:none;display:none;align-items:center;justify-content:center;flex-direction:column;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-align:center}
.pw-stun.t{background:radial-gradient(circle,rgba(170,230,255,.1) 30%,rgba(90,170,255,.55) 100%);animation:zapfl .09s steps(2) infinite}
@keyframes zapfl{0%{opacity:.75;transform:translate(3px,-2px)}100%{opacity:1;transform:translate(-3px,2px)}}
.pw-stun.b{background:#0a5fd0;opacity:.93;align-items:flex-start;padding-left:12vw}
.pw-stun.b .face{font-size:min(22vh,180px);line-height:1}.pw-stun.b p{font-size:clamp(16px,2.6vh,26px);max-width:60vw;text-align:left;margin:12px 0}`;
const RING = (f, c) => { const r = 23, L = 2 * Math.PI * r; return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="rgba(8,12,26,.72)" stroke="rgba(255,255,255,.18)" stroke-width="5"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(L * f).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="34" text-anchor="middle" font-family="Fredoka,system-ui,sans-serif" font-weight="800" font-size="17" fill="#fff">Q</text></svg>`; };
const FX = {   // your own active power: a screen tint + a tag under the scoreboard
  xray: ['#ffd166', 'radial-gradient(circle,transparent 55%,rgba(255,209,102,.28) 100%)'], cloak: ['#c9a2ff', 'radial-gradient(circle,transparent 45%,rgba(150,110,255,.38) 100%)'],
  agi: ['#7fe3ff', 'radial-gradient(circle,transparent 60%,rgba(127,227,255,.3) 100%)'], overclock: ['#76ff7a', 'radial-gradient(circle,transparent 55%,rgba(118,255,122,.3) 100%)'],
  turbo: ['#ff6b6b', 'repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,0) 0deg 7deg,rgba(255,255,255,.12) 7deg 8deg),radial-gradient(circle,transparent 50%,rgba(255,80,80,.3) 100%)'],
};
export function createPowers({ game, net, THREE, an, play, banner = () => {} }) {
  if (!document.getElementById('pw-css')) { const s = document.createElement('style'); s.id = 'pw-css'; s.textContent = CSS; document.head.appendChild(s); }
  const hud = document.createElement('div'); hud.className = 'pw-hud'; document.body.appendChild(hud);
  const fx = document.createElement('div'); fx.className = 'pw-fx'; document.body.appendChild(fx);
  const tag = document.createElement('div'); tag.className = 'pw-tag'; document.body.appendChild(tag);
  const stun = document.createElement('div'); stun.className = 'pw-stun'; document.body.appendChild(stun);
  const mine = () => POWERS[net.ch] || null;
  const enemy = (b) => b && b.net && (isFree(net.mode) || b.net.team !== net.team);
  let lastKey = '', lastStun = '', vfx = [], xrayOn = false;
  // ---- per-avatar material tricks: fade (cloak) and draw through walls (X-ray) ----
  const mats = (b) => { if (!b._pwm) { const l = new Set(); b.group.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) l.add(o.material); }); b._pwm = [...l].map((m) => ({ m, t: m.transparent, o: m.opacity, d: m.depthTest, w: m.depthWrite })); } return b._pwm; };
  function look(b, cloak, xray) {
    const key = (cloak ? 'c' : '') + (xray ? 'x' : ''); if (b._pwk === key) return; b._pwk = key;
    for (const e of mats(b)) { e.m.transparent = cloak || e.t; e.m.opacity = cloak ? 0.08 : e.o; e.m.depthWrite = cloak ? false : e.w; e.m.depthTest = xray ? false : e.d; e.m.needsUpdate = true; }
    b.group.traverse((o) => { if (o.isMesh) o.renderOrder = xray ? 999 : 0; });
  }
  // ---- small VFX helpers (meshes in the scene, removed after `life` s) ----
  function add(obj, life, tick) { game.scene.add(obj); vfx.push({ obj, t: 0, life, tick }); }
  function arc(o, e, color = 0x9fe8ff) {   // jagged electric arc (taser)
    const pts = [], n = 10; for (let i = 0; i <= n; i++) { const u = i / n, j = i && i < n ? 0.12 : 0; pts.push(new THREE.Vector3(o.x + (e.x - o.x) * u + (Math.random() - .5) * j, o.y + (e.y - o.y) * u + (Math.random() - .5) * j, o.z + (e.z - o.z) * u + (Math.random() - .5) * j)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts), m = new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false }), l = new THREE.Line(g, m); l.renderOrder = 998;
    add(l, 0.3, (v) => { m.opacity = 1 - v.t / v.life; const p = g.attributes.position; for (let i = 1; i < n; i++) { p.setXYZ(i, pts[i].x + (Math.random() - .5) * .15, pts[i].y + (Math.random() - .5) * .15, pts[i].z + (Math.random() - .5) * .15); } p.needsUpdate = true; });
  }
  function burst(pos, color, n = 24, speed = 6, life = 0.9, up = 4) {   // flame / spark puff
    const geo = new THREE.SphereGeometry(0.12, 6, 4), m = new THREE.MeshBasicMaterial({ color, transparent: true }), im = new THREE.InstancedMesh(geo, m, n), vel = [], P = [], M4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random(); vel.push([Math.cos(a) * r * speed, Math.random() * up, Math.sin(a) * r * speed]); P.push([pos.x, pos.y + 0.2, pos.z]); }
    add(im, life, (v, dt) => { const k = 1 - v.t / v.life; m.opacity = k; for (let i = 0; i < n; i++) { P[i][0] += vel[i][0] * dt; P[i][1] += vel[i][1] * dt; P[i][2] += vel[i][2] * dt; vel[i][1] -= 6 * dt; M4.makeScale(0.5 + 1.5 * (1 - k), 0.5 + 1.5 * (1 - k), 0.5 + 1.5 * (1 - k)).setPosition(P[i][0], P[i][1], P[i][2]); im.setMatrixAt(i, M4); } im.instanceMatrix.needsUpdate = true; });
  }
  function wave(pos, color, R) {   // expanding ring (Blue Screen radius)
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }), r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), m); r.rotation.x = -Math.PI / 2; r.position.set(pos.x, pos.y + 0.15, pos.z);
    add(r, 0.8, (v) => { const k = v.t / v.life; r.scale.setScalar(0.5 + k * R); m.opacity = 0.85 * (1 - k); });
  }
  function box(pos) {   // Prime Delivery: a cardboard box drops on you and pops
    const g = new THREE.Group(), cb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xc8955a })), tape = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.52), new THREE.MeshLambertMaterial({ color: 0x2a3b5c }));
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 4, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x1b1b1b })); smile.rotation.z = Math.PI; smile.position.set(0, -0.05, -0.256);
    g.add(cb, tape, smile); g.position.set(pos.x, pos.y + 7, pos.z);
    add(g, 1.3, (v) => { const k = Math.min(1, v.t / 0.7); g.position.y = pos.y + 0.25 + 7 * (1 - k * k); g.rotation.y = v.t * 4; if (v.t > 0.75 && !v.popped) { v.popped = 1; burst(g.position, 0xffd166, 18, 4, 0.6); } if (v.t > 0.75) g.scale.setScalar(Math.max(0.01, 1 - (v.t - 0.75) / 0.5)); });
  }
  const posOf = (id) => { if (id === net.id) { const e = net.eye(); return { x: e.x, y: e.y - 1.6, z: e.z }; } const b = game.bots.list.find((x) => x.netId === id); return b && b.net ? { x: b.net.x, y: b.net.y, z: b.net.z } : null; };
  net.on('power', (m) => {
    if (!m) return; const P = POWERS[m.ch] || Object.values(POWERS).find((x) => x.k === m.k), pos = posOf(m.id), me = m.id === net.id, r = net.roster.get(m.id), who = (r && r.name) || 'Someone';
    try { an.sound('power'); } catch (e) {}
    if (pos) { if (m.k === 'rocket') { burst(pos, 0xff7a2f, 30, 3, 1.0, 1); burst(pos, 0xffd166, 16, 2, 0.7, 2); } else if (m.k === 'prime') box(pos); else if (m.k === 'bsod') wave(pos, 0x2f8cff, 14); else burst({ x: pos.x, y: pos.y + 0.8, z: pos.z }, FX[m.k] ? parseInt(FX[m.k][0].slice(1), 16) : 0xffffff, 18, 2.5, 0.7, 2); }
    if (me && P) { an.medal(P.name.toUpperCase(), P.desc.toUpperCase(), FX[m.k] ? FX[m.k][0] : '#ffd166', 2.2); an.say(P.name, 3); }
    else if (P) { const foe = isFree(net.mode) || !r || r.team !== net.team; banner((foe ? 'ENEMY ' : '') + who.toUpperCase() + ' · ' + P.name.toUpperCase(), 2.5); if (foe && (m.k === 'xray' || m.k === 'bsod' || m.k === 'cloak')) an.say((foe ? 'Enemy ' : '') + P.name, 2); }
  });
  net.on('zap', (m) => { if (!m || !m.o || !m.e) return; const o = new THREE.Vector3(...m.o), e = new THREE.Vector3(...m.e); if (m.id === net.id) o.add(new THREE.Vector3(0, -0.35, 0)); arc(o, e); arc(o, e, 0xffffff); if (m.v) burst(e, 0x9fe8ff, 14, 3, 0.5, 2); try { an.sound('zap'); } catch (er) {} });
  return {
    /** X: zap the taser (server decides the hit) */
    taser() { const inv = game.eco && game.eco.getState().inventory; if (!net.alive || (net.me.st || 0) > 0) return; if (!inv || !inv.taser) { banner('No taser · buy one in the shop (B, gear)', 1.6); return; } net.sendRaw({ t: 'taser', vt: Math.round(net.renderTick() * 100) / 100 }); try { an.sound('zap'); } catch (e) {} },
    /** Q: fire your power when it is charged */
    use() { const P = mine(); if (!P || !net.alive) return; if ((net.me.st || 0) > 0) return; if ((net.me.pw || 0) < 100) { banner(P.name + ' charging · ' + (net.me.pw | 0) + '%', 1.2); return; } net.setInput({ pw: true, rk: P.k === 'rocket' }); },
    /** turbo input flag (prediction runs at the same speed as the server) */
    get turbo() { const P = mine(); return !!(P && P.k === 'turbo' && (net.me.pa || 0) > 0); },
    get stunned() { return (net.me.st || 0) > 0 && net.alive; },
    update(dt) {
      // HUD meter
      const P = mine(), lg = legendOf(net.ch);
      if (P && net.alive && game.state === 'play' && !document.body.classList.contains('fc-on')) {
        const pa = net.me.pa || 0, pw = net.me.pw || 0, f = pa > 0 ? pa / Math.max(0.1, P.dur) : pw / 100, col = pa > 0 ? '#7dffb0' : pw >= 100 ? '#ffd166' : '#7fe3ff';
        const key = P.k + '|' + Math.round(f * 40) + '|' + (pw >= 100) + '|' + (pa > 0 ? pa.toFixed(0) : '');
        if (key !== lastKey) { lastKey = key; hud.innerHTML = RING(Math.min(1, f), col) + `<div><b>${P.name.toUpperCase()}</b><small>${pa > 0 ? 'ACTIVE · ' + pa.toFixed(0) + ' s' : pw >= 100 ? 'READY · PRESS Q' : (pw | 0) + '%  ·  ' + (lg ? lg.name.toUpperCase() : '')}</small></div>`; hud.classList.toggle('ready', pw >= 100 && !(pa > 0)); }
        hud.style.display = '';
        const on = pa > 0 && FX[P.k]; fx.style.display = on ? 'block' : 'none'; if (on) fx.style.background = FX[P.k][1];
        tag.style.display = on ? 'block' : 'none'; if (on) { tag.style.setProperty('--c', FX[P.k][0]); tag.textContent = P.name.toUpperCase() + ' · ' + pa.toFixed(1) + ' s'; }
      } else { hud.style.display = 'none'; fx.style.display = 'none'; tag.style.display = 'none'; }
      // stun overlays (taser: electric flicker; Blue Screen: the famous blue screen)
      const st = net.alive ? net.me.st || 0 : 0, sk = st > 0 ? net.me.sk || 't' : '';
      if (sk !== lastStun) { lastStun = sk; stun.className = 'pw-stun' + (sk ? ' ' + sk : ''); stun.style.display = sk ? 'flex' : 'none'; if (sk === 'b') { stun.innerHTML = '<div class="face">:(</div><p>Your PC ran into a problem and needs to restart. We\'re just collecting some error info, and then we\'ll restart for you.</p><p class="pc" style="font-size:clamp(14px,2.2vh,22px)"></p>'; try { an.sound('bsod'); } catch (e) {} } else if (sk === 't') { stun.innerHTML = '<div style="font-weight:800;font-size:clamp(30px,6vh,60px);letter-spacing:.2em;text-shadow:0 0 20px #7fe3ff">TASED</div><div class="pc" style="font-size:16px;letter-spacing:.14em"></div>'; } }
      if (sk) { const pc = stun.querySelector('.pc'); if (pc) pc.textContent = sk === 'b' ? Math.max(0, Math.min(100, Math.round(100 * (1 - st / 2.5)))) + '% complete' : 'paralysed · ' + st.toFixed(1) + ' s'; }
      // remote players: cloak fade, X-ray through walls, stun sparks
      const P2 = mine(), xray = !!(P2 && P2.k === 'xray' && (net.me.pa || 0) > 0 && net.alive);
      for (const b of game.bots.list) {
        if (!b.net || !b.group) continue; look(b, !!b.net.cloak && b.alive, xray && enemy(b) && b.alive);
        if (b.net.stun && b.alive && Math.random() < dt * 10) burst({ x: b.net.x + (Math.random() - .5) * .5, y: b.net.y + 0.6 + Math.random(), z: b.net.z + (Math.random() - .5) * .5 }, 0x9fe8ff, 4, 1.5, 0.3, 1);
      }
      xrayOn = xray;
      // VFX
      for (let i = vfx.length - 1; i >= 0; i--) { const v = vfx[i]; v.t += dt; if (v.tick) v.tick(v, dt); if (v.t >= v.life) { game.scene.remove(v.obj); v.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); vfx.splice(i, 1); } }
    },
    dispose() { for (const v of vfx) game.scene.remove(v.obj); vfx = []; for (const b of game.bots.list) if (b._pwk) look(b, false, false); hud.remove(); fx.remove(); tag.remove(); stun.remove(); },
  };
         }
