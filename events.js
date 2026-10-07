// events.js - live map events + care packages on the client (Juan 2026-10-07: "que vayan pasando cosas").
// Server (room.js fireEvent / crates) decides what and where; this file shows it:
//   starship  10 s countdown, red danger ring on the launch pad, then the real Plaza rocket lifts off (flames, smoke, shake)
//   blimp     a "SERIES A" funding blimp crosses the sky and drops a care package
//   sand      sandstorm: fog closes in for 30 s (bots can't see far either)
//   bull      bull market: superpowers charge 2x for 30 s (ticker on top)
//   crate     care packages fall with a parachute, glow when landed; hold E to open (progress from the snapshot)
const CSS = `.ev-tick{position:fixed;left:0;right:0;top:0;height:24px;z-index:26;display:none;overflow:hidden;background:#06331c;border-bottom:2px solid #2fe37a;font:800 13px Fredoka,system-ui,sans-serif;color:#7dffb0;letter-spacing:.14em;pointer-events:none}
.ev-tick span{position:absolute;white-space:nowrap;top:4px;animation:evt 14s linear infinite}@keyframes evt{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
.ev-sand{position:fixed;inset:0;z-index:22;pointer-events:none;opacity:0;transition:opacity 2.5s;background:radial-gradient(circle at 50% 55%,rgba(216,185,138,.25) 0%,rgba(196,160,104,.7) 100%)}
.ev-tip{position:fixed;left:50%;top:63%;transform:translateX(-50%);z-index:25;pointer-events:none;font:700 15px Fredoka,system-ui,sans-serif;color:#fff;text-shadow:0 2px 6px #000;text-align:center;display:none}
.ev-tip i{display:block;width:200px;height:8px;margin:6px auto 0;border-radius:5px;background:#0009;border:1px solid #fff6;overflow:hidden}.ev-tip i b{display:block;height:100%;width:0;background:#ffd166}`;
const ITEM = { gun: 'a big gun', power: 'a full superpower', shield: 'shield + helmet + taser', hp: '150 HP' };
export function createEvents({ game, net, THREE, an, banner = () => {}, play }) {
  if (!document.getElementById('ev-css')) { const s = document.createElement('style'); s.id = 'ev-css'; s.textContent = CSS; document.head.appendChild(s); }
  const tick = document.createElement('div'); tick.className = 'ev-tick'; document.body.appendChild(tick);
  const sand = document.createElement('div'); sand.className = 'ev-sand'; document.body.appendChild(sand);
  const tip = document.createElement('div'); tip.className = 'ev-tip'; document.body.appendChild(tip);
  const crates = new Map(), fx = [], timers = [], SANDC = new THREE.Color(0xd2b27e); let shake = 0, fog0 = null, bullUntil = 0, sandUntil = 0, rocketT = -1;
  const later = (s, f) => timers.push(setTimeout(f, s * 1000));
  const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const rocket = () => (game.map && game.map.rockets && game.map.rockets[0]) || null;
  // ---- care packages ----
  function crateMesh(kind) {
    const g = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), M(0xc8955a)); box.position.y = 0.35; g.add(box);
    for (const z of [-0.455, 0.455]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.02), M(kind === 'blimp' ? 0x2fe37a : 0xffc83d)); band.position.set(0, 0.42, z); g.add(band); }
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), M(0x7a5a32)); lid.position.y = 0.72; g.add(lid);
    const chute = new THREE.Group(), dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(kind === 'blimp' ? 0x2fe37a : 0xff5a4a, { side: THREE.DoubleSide }));
    dome.scale.y = 0.55; dome.position.y = 3.2; chute.add(dome);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.6, 3), M(0xffffff)); l.position.set(x * 0.55, 1.95, z * 0.55); l.rotation.set(z * 0.22, 0, -x * 0.22); chute.add(l); }
    g.add(chute);
    const glowM = new THREE.MeshBasicMaterial({ color: kind === 'blimp' ? 0x2fe37a : 0xffd166, transparent: true, opacity: 0.35, depthWrite: false }), glow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 7, 12, 1, true), glowM); glow.position.y = 3.5; glow.visible = false; g.add(glow);
    return { g, chute, glow, glowM };
  }
  net.on('crate', (m) => {
    if (!m || crates.has(m.id)) return; const c = crateMesh(m.kind); c.g.position.set(m.x, m.y + 35 * Math.min(1, m.fall / 3), m.z); game.scene.add(c.g);
    crates.set(m.id, { ...c, m, landAt: performance.now() + m.fall * 1000, y0: m.y + 35 * Math.min(1, m.fall / 3) });
    if (m.kind === 'series' && m.owner !== net.id) { const r = net.roster.get(m.owner); banner(((r && r.name) || 'Someone').toUpperCase() + ' CALLED A SERIES A · go steal it', 2.5); }
  });
  net.on('crategone', (m) => {
    const c = m && crates.get(m.id); if (c) { game.scene.remove(c.g); crates.delete(m.id); }
    if (!m) return; const r = net.roster.get(m.by), who = m.by === net.id ? 'You' : (r && r.name) || 'Someone', what = m.item === 'gun' && m.w ? m.w : ITEM[m.item] || m.item;
    if (m.by === net.id) { an.medal(m.stolen ? 'STOLEN!' : 'CARE PACKAGE', String(ITEM[m.item] || m.item).toUpperCase(), '#ffd166', 2.4); an.sound('level'); }
    else banner(who.toUpperCase() + (m.stolen ? ' STOLE A CARE PACKAGE' : ' OPENED A CARE PACKAGE') + ' · ' + String(what).toUpperCase(), 2.5);
  });
  net.on('crateclear', () => { for (const c of crates.values()) game.scene.remove(c.g); crates.clear(); });
  // ---- map events ----
  net.on('mevent', (m) => {
    if (!m) return;
    if (m.k === 'starship') {
      an.say('Starship launch in ten seconds. Clear the launch pad.', 3); banner('STARSHIP LAUNCH IN 10 · CLEAR THE LAUNCH PAD (B)', 3);
      const ring = new THREE.Mesh(new THREE.RingGeometry(6.0, 6.5, 48), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, 0.36, m.z); game.scene.add(ring);
      fx.push({ obj: ring, t: 0, life: 13, tick: (v) => { ring.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(v.t * 5)); } });
      for (let i = 9; i >= 1; i--) later(10 - i, () => { banner('STARSHIP LAUNCH IN ' + i, 1.05); try { an.sound('bsod'); } catch (e) {} });
    } else if (m.k === 'liftoff') {
      an.say('Liftoff!', 3); banner('LIFTOFF!', 2); rocketT = 0; shake = 1;
    } else if (m.k === 'blimp') {
      an.say('A funding blimp is dropping a care package.', 2); banner('FUNDING BLIMP · A CARE PACKAGE IS COMING DOWN', 4); blimp(m);
    } else if (m.k === 'sand') {
      an.say('Sandstorm incoming.', 2); banner('SANDSTORM · 30 s · you can barely see', 3.5); sandUntil = performance.now() + m.dur * 1000;
      sand.style.opacity = '1';
    } else if (m.k === 'bull') {
      an.say('Bull market! Superpowers charge twice as fast.', 2); bullUntil = performance.now() + m.dur * 1000; tick.style.display = 'block';
      tick.innerHTML = '<span>▲ BULL MARKET · SUPERPOWERS CHARGE 2X · $JOBS ▲ 12% · $ZUCK ▲ 8% · $SAMA ▲ 41% · $MUSK ▲ 420% · $BEZOS ▲ 9% · $NVDA ▲ 69% · $MSFT ▲ 7% · $AMD ▲ 23% · BUY THE DIP ▲</span>';
    }
  });
  function blimp(m) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M(0xdfe6f2)); body.scale.set(9, 3, 3); g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 2.2, 20, 1, true), M(0x2fe37a, { side: THREE.DoubleSide })); band.rotation.z = Math.PI / 2; g.add(band);
    for (let i = 0; i < 4; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.2), M(0xff5a4a)); fin.position.x = -7.6; fin.rotation.x = i * Math.PI / 2; fin.translateZ(1.6); g.add(fin); }
    const gon = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), M(0x1f2433)); gon.position.y = -3.3; g.add(gon);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#2fe37a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#06331c'; c.font = '800 70px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SERIES A', 256, 66);
    const tx = new THREE.CanvasTexture(cv); for (const s2 of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: tx })); p.position.set(0, 0, s2 * 3.07); if (s2 < 0) p.rotation.y = Math.PI; g.add(p); }
    const [x0, z0] = m.from, [x1, z1] = m.to; g.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); game.scene.add(g);
    fx.push({ obj: g, t: 0, life: m.T, tick: (v) => { const u = v.t / v.life; g.position.set(x0 + (x1 - x0) * u, 36 + Math.sin(v.t) * 0.4, z0 + (z1 - z0) * u); } });
  }
  return {
    update(dt) {
      const now = performance.now();
      // crates: fall, then glow; prompt + progress when you are close
      let near = null;
      for (const c of crates.values()) {
        const left = Math.max(0, (c.landAt - now) / 1000), k = left / 3; c.g.position.y = c.m.y + (c.y0 - c.m.y) * Math.min(1, k * k);
        c.chute.visible = left > 0.05; c.glow.visible = left <= 0.05; c.glowM.opacity = 0.25 + 0.15 * Math.sin(now / 200); if (left > 0) c.g.rotation.y += dt * 0.6;
        if (left <= 0 && net.alive) { const e = net.eye(); const d = Math.hypot(e.x - c.m.x, e.z - c.m.z); if (d < 1.8 && Math.abs(e.y - 1.6 - c.m.y) < 1.8) near = c; }
      }
      if (near) { tip.style.display = 'block'; const own = near.m.owner === net.id; tip.innerHTML = `Hold E · ${own ? 'open your' : near.m.owner ? 'steal the' : 'open the'} ${near.m.kind === 'blimp' ? 'blimp' : 'Series A'} care package<i><b style="width:${Math.round((net.me.cp || 0) * 100)}%"></b></i>`; } else tip.style.display = 'none';
      // the rocket: liftoff and comeback
      const R = rocket();
      if (R && rocketT >= 0) {
        rocketT += dt; const t = rocketT;
        if (t < 9) { R.group.position.y = 0.5 * 6 * t * t; R.group.visible = true; R.flame.scale.set(1.6, 2.5 + Math.random(), 1.6); shake = Math.max(shake, t < 3 ? 1 : 0.4); if (Math.random() < dt * 25) puff(R.x + (Math.random() - .5) * 4, 0.6 + R.group.position.y * 0.1, R.z + (Math.random() - .5) * 4); }
        else if (t < 45) R.group.visible = false;
        else { R.group.position.y = 0; R.group.visible = true; R.flame.scale.set(1, 1, 1); rocketT = -1; banner('A NEW STARSHIP IS ON THE PAD', 2); }
      }
      // camera shake (CSS: independent of who moves the camera), stronger close to the pad
      if (shake > 0) { let k = shake; if (R) { const e = net.eye(); k *= Math.max(0.15, 1 - Math.hypot(e.x - R.x, e.z - R.z) / 70); } const a = 6 * k; game.canvas.style.transform = `translate(${(Math.random() - .5) * a}px,${(Math.random() - .5) * a}px)`; shake = Math.max(0, shake - dt * 0.35); if (!shake) game.canvas.style.transform = ''; }
      // sandstorm: fog closes in, then goes back to the map's own fog
      const f = game.scene.fog;
      if (f && sandUntil) {
        if (!fog0) fog0 = { near: f.near, far: f.far, color: f.color.clone() };
        const on = now < sandUntil, a = Math.min(1, dt * 0.9);
        f.near += ((on ? 2 : fog0.near) - f.near) * a; f.far += ((on ? 30 : fog0.far) - f.far) * a; f.color.lerp(on ? SANDC : fog0.color, a);
        if (!on) { sand.style.opacity = '0'; if (Math.abs(f.far - fog0.far) < 1) { f.near = fog0.near; f.far = fog0.far; f.color.copy(fog0.color); fog0 = null; sandUntil = 0; } }
      }
      if (bullUntil && now > bullUntil) { bullUntil = 0; tick.style.display = 'none'; }
      for (let i = fx.length - 1; i >= 0; i--) { const v = fx[i]; v.t += dt; v.tick && v.tick(v, dt); if (v.t >= v.life) { game.scene.remove(v.obj); fx.splice(i, 1); } }
    },
    dispose() { for (const t of timers) clearTimeout(t); for (const c of crates.values()) game.scene.remove(c.g); crates.clear(); for (const v of fx) game.scene.remove(v.obj); fx.length = 0; const R = rocket(); if (R) { R.group.position.y = 0; R.group.visible = true; } if (fog0 && game.scene.fog) { game.scene.fog.near = fog0.near; game.scene.fog.far = fog0.far; game.scene.fog.color.copy(fog0.color); } game.canvas.style.transform = ''; tick.remove(); sand.remove(); tip.remove(); },
  };
  function puff(x, y, z) {   // rocket smoke
    const m = new THREE.MeshLambertMaterial({ color: 0xf2efe8 }), p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m); p.position.set(x, y, z); game.scene.add(p);
    const vx = (Math.random() - .5) * 6, vz = (Math.random() - .5) * 6; fx.push({ obj: p, t: 0, life: 3, tick: (v, dt) => { p.position.x += vx * dt; p.position.z += vz * dt; p.position.y += dt * 0.6; p.scale.setScalar(1 + v.t * 1.4); } });
  }
    }
