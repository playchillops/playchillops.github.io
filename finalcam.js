// finalcam.js - FINAL KILLCAM at the end of every match (Juan 2026-10-06, Black Ops 2 style).
// The server keeps ~8 s of snapshots and sends the last kill's clip ('fkc': frames every 2 ticks + shots). We replay it through the
// normal remote avatars (bots.syncRemote gets the clip instead of live data, the local player included), over the killer's
// shoulder, in slow motion around the kill. Space / click skips. Camera only: nothing here touches gameplay.
import { raycast } from './hitscan.js';
import { WEAPONS, WEAPON_ORDER, shotSound } from './player.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
const lerpA = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
export function createFinalCam(THREE, { camera, world, play, onShot }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), pos = V(), look = V(), tmp = V();
  let clip = null, t = 0, active = false, done = null, names = null, shotI = 0, lastT = 0;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:46;pointer-events:none;display:none;font-family:Fredoka,system-ui,sans-serif;color:#fff';
  ov.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;height:11vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:11vh;background:#000"></div>
<div style="position:absolute;left:50%;top:2.6vh;transform:translateX(-50%);font-weight:800;font-size:clamp(20px,3.6vh,34px);letter-spacing:.32em;text-shadow:0 0 18px #ff6b6b">FINAL KILLCAM</div>
<div class="fc-who" style="position:absolute;left:50%;bottom:3.2vh;transform:translateX(-50%);font-size:clamp(14px,2.4vh,22px);letter-spacing:.08em;white-space:nowrap"></div>
<div style="position:absolute;right:16px;bottom:1.2vh;font-size:11px;letter-spacing:.14em;opacity:.6">SPACE TO SKIP</div>
<div class="fc-slow" style="position:absolute;left:16px;bottom:1.2vh;font-size:11px;letter-spacing:.2em;color:#ffd166;opacity:0">SLOW MOTION</div>`;
  document.body.appendChild(ov);
  const skip = (e) => { if (!active) return; if (e.type === 'keydown' && e.code !== 'Space' && e.code !== 'Enter') return; e.preventDefault(); e.stopPropagation(); api.stop(); };
  document.addEventListener('keydown', skip, true); document.addEventListener('mousedown', skip, true);
  function frameAt(k) {   // interpolated state of every player at tick k
    const f = clip.f; let i = 0; while (i < f.length - 2 && f[i + 1].k <= k) i++;
    const a = f[i], b = f[Math.min(f.length - 1, i + 1)], u = b.k === a.k ? 0 : Math.max(0, Math.min(1, (k - a.k) / (b.k - a.k))), bm = new Map(b.p.map((e) => [e[0], e])), out = [];
    for (const ea of a.p) { const eb = bm.get(ea[0]) || ea, r = names(ea[0]);
      out.push({ id: ea[0], name: r.name, team: r.team, x: ea[1] + (eb[1] - ea[1]) * u, y: ea[2] + (eb[2] - ea[2]) * u, z: ea[3] + (eb[3] - ea[3]) * u, yaw: lerpA(ea[4], eb[4], u), pitch: ea[5] + (eb[5] - ea[5]) * u,
        crouched: !!(ea[6] & 1), alive: !!((u < 0.5 ? ea : eb)[6] & 2), connected: true, hp: (u < 0.5 ? ea : eb)[7], weapon: (u < 0.5 ? ea : eb)[8] }); }
    return out;
  }
  const speed = (k) => { const d = (k - clip.k) / clip.tr; return d > -0.75 && d < 0.45 ? 0.28 : 1; };   // slow motion around the kill
  const api = {
    get active() { return active; },
    /** m = 'fkc' message; who(id) -> { name, team }; onDone after the clip (or skip) */
    play(m, who, onDone) {
      if (!m || !Array.isArray(m.f) || m.f.length < 10) { onDone && onDone(); return; }
      clip = m; names = (id) => who(id) || { name: 'Player', team: '' }; done = onDone; active = true; shotI = 0; lastT = performance.now(); document.body.classList.add('fc-on');
      t = Math.max(m.f[0].k, m.k - Math.round(3.4 * m.tr));
      while (shotI < (m.s || []).length && m.s[shotI][0] < t) shotI++;
      const k = names(m.by), v = names(m.id), w = WEAPONS[m.w] ? WEAPONS[m.w].name : m.w === 'knife' ? 'Knife' : m.w === 'streak' ? 'Killstreak' : '';
      ov.querySelector('.fc-who').innerHTML = `<b style="color:${TEAMC[k.team] || '#fff'}">${esc(k.name)}</b> &nbsp;${w ? '<span style="opacity:.75">[' + esc(w) + (m.hs ? ' · HEADSHOT' : '') + ']</span>' : ''}&nbsp; <b style="color:${TEAMC[v.team] || '#fff'}">${esc(v.name)}</b>`;
      ov.style.display = ''; const kp = frameAt(t).find((p) => p.id === m.by); if (kp) { pos.set(kp.x, kp.y + 2.4, kp.z + 3); look.set(kp.x, kp.y + 1.4, kp.z); }
    },
    /** replay players for bots.syncRemote while active */
    players() { return active ? frameAt(t) : null; },
    update() {
      if (!active) return false;
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;   // wall clock: the clip plays at real speed even at low FPS
      const sp = speed(t); t += dt * clip.tr * sp; ov.querySelector('.fc-slow').style.opacity = sp < 1 ? '1' : '0';
      const ss = clip.s || [];
      while (shotI < ss.length && ss[shotI][0] <= t) { const [, id, w, o, e] = ss[shotI++]; try { onShot && onShot({ id, w, o, e }); play && play(shotSound(WEAPON_ORDER[w]) || 'bot_shot', { x: o[0], y: o[1], z: o[2] }); } catch (er) {} }
      const fr = frameAt(t), kp = fr.find((p) => p.id === clip.by), vp = fr.find((p) => p.id === clip.id);
      if (kp) {   // over the killer's shoulder, looking where they aim; walls pull the camera in
        const eye = V(kp.x, kp.y + (kp.crouched ? 1.1 : 1.6), kp.z), fw = V(-Math.sin(kp.yaw) * Math.cos(kp.pitch), Math.sin(kp.pitch), -Math.cos(kp.yaw) * Math.cos(kp.pitch));
        const side = V(Math.cos(kp.yaw), 0, -Math.sin(kp.yaw)), want = eye.clone().addScaledVector(fw, -2.6).addScaledVector(side, 0.75).add(V(0, 0.45, 0));
        const d = tmp.subVectors(want, eye), L = d.length(); d.divideScalar(L || 1); const h = raycast(eye, d, { colliders: world, maxDistance: L }); const cam = h ? eye.clone().addScaledVector(d, Math.max(0.3, h.distance - 0.3)) : want;
        const tgt = eye.clone().addScaledVector(fw, 8); if (vp && Math.abs(t - clip.k) < clip.tr * 0.9) tgt.lerp(V(vp.x, vp.y + 1.2, vp.z), 0.35);
        pos.lerp(cam, Math.min(1, dt * 10)); look.lerp(tgt, Math.min(1, dt * 12));
      }
      camera.position.copy(pos); camera.lookAt(look);
      if (t >= clip.f[clip.f.length - 1].k) api.stop();
      return true;
    },
    stop() { if (!active) return; active = false; ov.style.display = 'none'; document.body.classList.remove('fc-on'); const d = done; done = null; clip = null; try { d && d(); } catch (e) {} },
    dispose() { api.stop(); document.removeEventListener('keydown', skip, true); document.removeEventListener('mousedown', skip, true); ov.remove(); },
  };
  return api;
}
