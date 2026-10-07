// spectate.js - what you see after dying in a match (Juan 2026-10-06: "el modo espectador no está muy bien hecho").
// 1) death cam (~2 s): the camera lifts off your body, pulls back and turns to whoever killed you ("ELIMINATED by NAME").
// 2) spectate: teammates first, otherwise anyone still alive (so 1v1 / vs bots works too). Left/right click = next/previous
//    player, Space = smooth third-person chase cam <-> their own first-person view. Auto-switches when your target dies.
// 3) nobody left to watch: slow orbit over the spot where you fell.
// Camera only (no gameplay). Walls stop the chase cam (raycast against the world colliders).
import { raycast } from './hitscan.js';
import { WEAPONS, WEAPON_ORDER } from './player.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
const lerpA = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
export function createSpectator(THREE, { camera, root, world }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const pos = V(), look = V(), tmp = V();
  let mode = 'third', idx = 0, targetId = null, deadT = -1, deathPos = null, deathEye = null, killer = null, lostT = 0, hidden = null, yawS = 0, pitchS = 0, active = false;
  // ---- HUD: death banner + spectate panel ----
  const css = 'position:absolute;left:50%;transform:translateX(-50%);z-index:41;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-align:center;text-shadow:0 0 4px #000,0 2px 8px rgba(0,0,0,.8)';
  const ban = document.createElement('div'); ban.className = 'sp-ban'; ban.style.cssText = css + ';bottom:20%;display:none';   // hidden while a calling card shows (callingcard.js)
  ban.innerHTML = '<div style="font-weight:700;font-size:38px;letter-spacing:.16em">ELIMINATED</div><div class="sp-by" style="font-size:17px;letter-spacing:.06em;opacity:.95;margin-top:4px"></div>';
  const pan = document.createElement('div'); pan.style.cssText = css + ';bottom:11%;display:none;min-width:260px;padding:10px 18px 9px;border-radius:14px;background:rgba(11,16,32,.72);border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 30px rgba(0,0,0,.35)';
  pan.innerHTML = '<div style="font-size:11px;letter-spacing:.24em;opacity:.7">SPECTATING</div><div class="sp-name" style="font-weight:700;font-size:26px;line-height:1.15"></div><div class="sp-info" style="font-size:14px;opacity:.9;margin-top:2px"></div><div class="sp-keys" style="font-size:11px;letter-spacing:.08em;opacity:.65;margin-top:6px">LEFT / RIGHT CLICK switch player &nbsp;·&nbsp; SPACE first / third person</div>';
  root.appendChild(ban); root.appendChild(pan);
  if (!document.getElementById('sp-css')) { const st = document.createElement('style'); st.id = 'sp-css'; st.textContent = '.sp-on .sc-ch,.sp-on .sc-scope{display:none!important}'; document.head.appendChild(st); }
  const $ = (el, c) => el.querySelector('.' + c);
  const wname = (w) => { const id = WEAPON_ORDER[w]; return (id && WEAPONS[id] && WEAPONS[id].name) || 'Knife'; };
  const layer = (g, n) => g.traverse((o) => o.layers.set(n));   // layer 1 = not drawn by the camera (bots.js rewrites .visible every frame)
  const restore = () => { if (hidden) { layer(hidden.group, 0); hidden = null; } };
  // ---- input (only while spectating) ----
  let ctxRef = null;
  const onDown = (e) => { if (!active || deadT < 2.1 || !ctxRef) return; if (e.button === 0) cycle(1); else if (e.button === 2) cycle(-1); };
  const onKey = (e) => { if (!active || deadT < 2.1) return; if (e.code === 'Space') { mode = mode === 'third' ? 'first' : 'third'; e.preventDefault(); } else if (e.code === 'ArrowRight') cycle(1); else if (e.code === 'ArrowLeft') cycle(-1); };
  document.addEventListener('mousedown', onDown, true); document.addEventListener('keydown', onKey, true);
  function candidates(ctx) {
    const alive = ctx.players.filter((b) => b.net && b.alive && b.net.alive !== false && b.net.connected !== false && b.netId !== ctx.myId);
    const mates = alive.filter((b) => b.net.team === ctx.myTeam), others = alive.filter((b) => b.net.team !== ctx.myTeam);
    return mates.length ? mates : others;   // teammates if any are alive, else anyone (1v1, vs bots, last one standing)
  }
  function cycle(dir) { const c = candidates(ctxRef); if (!c.length) return; let i = c.findIndex((b) => b.netId === targetId); i = (i + dir + c.length) % c.length; restore(); targetId = c[i].netId; lostT = 0; }
  function eyeOf(b) { const n = b.net; return V(n.x, n.y + (n.crouched ? 1.1 : 1.6), n.z); }
  function safe(from, to, pad = .3) { // pull the camera in front of walls between from and to
    const d = tmp.subVectors(to, from), L = d.length(); if (L < 1e-3) return to.clone(); d.divideScalar(L);
    const h = raycast(from, d, { colliders: world, maxDistance: L }); return h ? from.clone().addScaledVector(d, Math.max(.2, h.distance - pad)) : to.clone(); }
  const api = {
    get active() { return active; },
    // ctx: { dead, phase, myId, myTeam, players (game.bots.list), eye (own eye), killerId }
    update(dt, ctx) {
      ctxRef = ctx; const want = !!ctx.dead && ctx.phase !== 'waiting' && ctx.phase !== 'freeze';
      if (!want) { if (active) api.stop(); return false; }
      if (!active) { active = true; deadT = 0; root.classList.add('sp-on'); mode = 'third'; targetId = null; deathEye = V(ctx.eye.x, ctx.eye.y, ctx.eye.z); deathPos = V(ctx.eye.x, ctx.eye.y - 1.6, ctx.eye.z);
        killer = ctx.players.find((b) => b.netId === ctx.killerId) || null; pos.copy(deathEye); look.copy(deathEye).add(V(0, -.3, -1));
        $(ban, 'sp-by').textContent = killer && killer.net ? 'by ' + (killer.net.name || killer.name || 'enemy') + ' · ' + wname(killer.net.weapon) + ' · ' + Math.max(0, killer.net.hp | 0) + ' HP left' : '';
        ban.style.display = ''; pan.style.display = 'none'; }
      deadT += dt;
      // ---- 1) death cam ----
      if (deadT < 2.1) {
        const k = Math.min(1, deadT / .9), e = 1 - Math.pow(1 - k, 3);
        const kp = killer && killer.net ? eyeOf(killer) : null;
        const away = kp ? V(deathEye.x - kp.x, 0, deathEye.z - kp.z).normalize() : V(0, 0, 1);
        const want2 = deathEye.clone().addScaledVector(away, 3.2 * e).add(V(0, 1.6 * e, 0));
        pos.lerp(safe(deathEye, want2), Math.min(1, dt * 8));
        const tgt = kp || deathPos; look.lerp(tgt, Math.min(1, dt * (kp ? 5 : 3)));
        camera.position.copy(pos); camera.lookAt(look); camera.fov = 75 - 10 * e; camera.updateProjectionMatrix(); return true;
      }
      if (ban.style.display !== 'none') ban.style.display = 'none';
      camera.fov = 75; camera.updateProjectionMatrix();   // reset every frame (kill effects add fov kicks on top)
      // ---- 2) spectate a player ----
      const cands = candidates(ctx); let t = ctx.players.find((b) => b.netId === targetId);
      if (!t || !t.alive || (t.net && t.net.alive === false)) { if (t && lostT < 1) { lostT += dt; } else { restore(); t = cands[0] || null; targetId = t ? t.netId : null; lostT = 0; } }
      if (t && t.net) {
        const n = t.net, eye = eyeOf(t); yawS = lerpA(yawS, n.yaw, Math.min(1, dt * 14)); pitchS += (n.pitch - pitchS) * Math.min(1, dt * 14);
        if (mode === 'first' && t.alive) {
          if (hidden !== t) { restore(); hidden = t; layer(t.group, 1); }
          pos.copy(eye); camera.position.copy(eye); camera.rotation.set(pitchS, yawS, 0, 'YXZ');
        } else {
          restore(); const fw = V(-Math.sin(yawS), 0, -Math.cos(yawS)), want3 = eye.clone().addScaledVector(fw, -3.3).add(V(0, .9, 0));
          pos.lerp(safe(eye, want3), Math.min(1, dt * 7)); look.lerp(eye.clone().addScaledVector(fw, 2.5).add(V(0, -.2 + Math.sin(pitchS) * -1.5, 0)), Math.min(1, dt * 9));
          camera.position.copy(pos); camera.lookAt(look);
        }
        $(pan, 'sp-name').textContent = n.name || t.name || 'Player'; $(pan, 'sp-name').style.color = TEAMC[n.team] || '#fff';
        $(pan, 'sp-info').textContent = '♥ ' + Math.max(0, n.hp | 0) + '  ·  ' + wname(n.weapon) + (n.team === ctx.myTeam ? '  ·  teammate' : '');
        $(pan, 'sp-keys').style.display = cands.length > 1 || mode ? '' : 'none'; pan.style.display = '';
        return true;
      }
      // ---- 3) nobody to watch: slow orbit over where you fell ----
      restore(); pan.style.display = 'none'; const a = deadT * .25, c = deathPos.clone().add(V(Math.cos(a) * 6, 4.5, Math.sin(a) * 6));
      pos.lerp(safe(deathPos.clone().add(V(0, 1.6, 0)), c), Math.min(1, dt * 3)); camera.position.copy(pos); camera.lookAt(deathPos); return true;
    },
    target() { return ctxRef && ctxRef.players.find((b) => b.netId === targetId) || null; },
    stop() { active = false; deadT = -1; restore(); root.classList.remove('sp-on'); ban.style.display = 'none'; pan.style.display = 'none'; camera.fov = 75; camera.updateProjectionMatrix(); },
    dispose() { api.stop(); document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true); ban.remove(); pan.remove(); },
  };
  return api;
}
