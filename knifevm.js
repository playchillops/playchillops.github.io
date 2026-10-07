// knifevm.js - first-person knife: arm + hand rig, karambit / Kite Cutter / butterfly models, CS-style animations.
// createKnifeVM(THREE, camera) -> { root, setType(type), draw(), slash(), stab(), inspect(), busy(), update(dt, look) }
//   type: 'default' | 'kite' | 'butterfly'
//   draw     karambit spins around the finger ring / butterfly flips open
//   slash    fast diagonal swing, alternates right->left and left->right, blade trail
//   stab     heavy: pull back, thrust, hold, recover
//   inspect  karambit: show the blade + double ring spin / butterfly: flip closed-open tricks
// Visual only (no gameplay); game.js decides hits. Everything hangs off the camera, toon materials + ink outlines like the rest.
const ease = { lin: (t) => t, in: (t) => t * t, out: (t) => 1 - (1 - t) * (1 - t), io: (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), snap: (t) => 1 - Math.pow(1 - t, 4) };
const ZERO = { p: [0, 0, 0], r: [0, 0, 0], spin: 0, b: 0, h: 0 };
// keyframes: [time, {p, r, spin, b, h}, easeIntoThisKey]
function sample(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) { const [t1, k1, e = 'io'] = keys[i], [t0, k0] = keys[i - 1]; if (t > t1) continue;
    const u = ease[e]((t - t0) / Math.max(1e-6, t1 - t0)), L = (a, b) => a + (b - a) * u;
    return { p: k0.p.map((v, j) => L(v, k1.p[j])), r: k0.r.map((v, j) => L(v, k1.r[j])), spin: L(k0.spin, k1.spin), b: L(k0.b, k1.b), h: L(k0.h, k1.h) }; }
  return keys[keys.length - 1][1];
}
const K = (p = [0, 0, 0], r = [0, 0, 0], o = {}) => ({ p, r, spin: o.spin || 0, b: o.b || 0, h: o.h || 0 });
const PI = Math.PI;
const ANIM = {
  draw: [[0, K([.06, -.26, .12], [-1.0, .4, .7])], [.28, K([.01, -.03, -.07], [.12, 0, .12], { spin: -4.6 }), 'out'], [.46, K([0, .012, -.02], [-.04, 0, 0], { spin: -2 * PI }), 'out'], [.62, K(), 'io']],
  drawB: [[0, K([.06, -.26, .12], [-1.0, .4, .7], { b: PI })], [.24, K([0, -.03, 0], [0, 0, .25], { b: PI }), 'out'], [.44, K([-.01, -.01, 0], [0, 0, -.35], { b: PI / 2, h: PI / 2 }), 'in'],
    [.56, K([0, 0, 0], [0, 0, .3], { b: 0, h: PI }), 'out'], [.72, K([0, .01, 0], [.05, 0, -.1], { b: 0, h: 0 }), 'snap'], [.9, K(), 'io']],
  slashA: [[0, K()], [.05, K([.07, .05, .02], [.25, -.55, -.7]), 'out'], [.15, K([-.17, -.06, -.09], [-.35, .95, 1.0]), 'snap'], [.22, K([-.19, -.09, -.05], [-.45, 1.05, 1.05]), 'out'], [.4, K(), 'io']],
  slashB: [[0, K()], [.05, K([-.09, .05, 0], [.25, .65, .75]), 'out'], [.15, K([.13, -.07, -.09], [-.35, -.75, -.85]), 'snap'], [.22, K([.15, -.1, -.05], [-.45, -.85, -.95]), 'out'], [.4, K(), 'io']],
  stab: [[0, K()], [.18, K([.025, .035, .13], [.38, .08, -.22]), 'out'], [.28, K([-.05, 0, -.24], [-.28, .14, .1]), 'snap'], [.42, K([-.05, -.012, -.21], [-.28, .14, .1]), 'lin'], [.8, K(), 'io']],
  inspect: [[0, K()], [.35, K([-.09, .06, .02], [0, .95, 1.35]), 'io'], [1.05, K([-.08, .065, .02], [.12, 1.15, 1.55]), 'io'], [1.35, K([-.02, .04, 0], [0, .3, .2]), 'io'],
    [1.85, K([-.02, .05, 0], [0, .3, .2], { spin: -4 * PI }), 'io'], [2.4, K([0, 0, 0], [0, 0, 0], { spin: -4 * PI }), 'io']],
  inspectB: [[0, K()], [.3, K([-.07, .05, 0], [0, .65, .95]), 'io'], [.8, K([-.07, .06, 0], [.1, .8, 1.1]), 'io'],
    [.95, K([-.04, .04, 0], [0, .3, .5], { b: PI / 2, h: PI / 2 }), 'in'], [1.1, K([-.03, .04, 0], [0, .2, -.2], { b: PI, h: 0 }), 'out'],
    [1.28, K([-.03, .04, 0], [0, .2, .4], { b: PI / 2, h: PI }), 'in'], [1.42, K([-.03, .05, 0], [0, .2, -.1], { b: 0, h: 0 }), 'snap'],
    [1.58, K([-.04, .05, 0], [0, .3, .5], { b: PI / 2, h: PI / 2 }), 'in'], [1.72, K([-.03, .04, 0], [0, .2, -.2], { b: PI, h: 0 }), 'out'],
    [1.9, K([-.03, .04, 0], [0, .2, .4], { b: PI / 2, h: PI }), 'in'], [2.05, K([-.02, .03, 0], [0, .1, -.1], { b: 0, h: 0 }), 'snap'], [2.6, K(), 'io']],
};
export function createKnifeVM(THREE, camera) {
  const T = THREE, toon = (c) => new T.MeshToonMaterial({ color: c }), ink = new T.MeshBasicMaterial({ color: 0x2a2140, side: T.BackSide });
  const mesh = (g, c, parent, x = 0, y = 0, z = 0, line = 1.08) => { const m = new T.Mesh(g, toon(c)); m.position.set(x, y, z); parent.add(m); if (line) { const o = new T.Mesh(g, ink); o.scale.setScalar(line); m.add(o); } m.renderOrder = 2; return m; };
  const root = new T.Group(); root.name = 'knife viewmodel'; root.visible = false; camera.add(root);
  const HOME = new T.Vector3(.15, -.16, -.32), HROT = new T.Euler(.38, .34, -.14);
  const rig = new T.Group(); root.add(rig);                     // animated: whole arm + hand + knife
  // ---- forearm + sleeve (runs back to the lower right corner) ----
  const arm = new T.Group(); arm.position.set(.02, -.03, .1); arm.rotation.set(-.35, .32, 0); rig.add(arm);
  const skin = 0xf2c9a0, sleeveC = 0x2a6fd6;
  const fa = new T.CylinderGeometry(.034, .04, .3, 14); fa.rotateX(PI / 2); mesh(fa, skin, arm, 0, 0, .1, 1.06);
  const sl = new T.CylinderGeometry(.047, .053, .26, 14); sl.rotateX(PI / 2); const slM = mesh(sl, sleeveC, arm, 0, 0, .29, 1.05);
  const cuff = new T.CylinderGeometry(.05, .05, .035, 14); cuff.rotateX(PI / 2); const cuM = mesh(cuff, 0xffd166, arm, 0, 0, .165, 1.06);
  const band = new T.CylinderGeometry(.037, .037, .02, 14); band.rotateX(PI / 2); mesh(band, 0xff846e, arm, 0, 0, -.035, 1.08);
  // ---- hand: fist around a handle along z (palm on the right, fingers curl over the top to the left) ----
  const hand = new T.Group(); rig.add(hand);
  const palm = new T.BoxGeometry(.05, .062, .078); palm.translate(0, 0, 0); mesh(palm, skin, hand, .03, -.004, .038, 1.07);
  const knuckle = new T.CapsuleGeometry(.0105, .006, 4, 8);
  for (let i = 0; i < 4; i++) { const z = .004 + i * .021, f = new T.Group(); f.position.set(.002, .033, z); hand.add(f);       // finger: 3 phalanges wrapping the handle (over the top, down the left, under)
    const a = new T.Group(); a.rotation.z = -.12; f.add(a); const p1 = new T.CapsuleGeometry(.0102, .022, 4, 8); p1.rotateZ(PI / 2); p1.translate(-.016, 0, 0); mesh(p1, skin, a, 0, 0, 0, 1.12);
    const b = new T.Group(); b.position.set(-.032, 0, 0); b.rotation.z = 1.62; a.add(b); const p2 = p1.clone(); mesh(p2, skin, b, 0, 0, 0, 1.12);
    const c = new T.Group(); c.position.set(-.032, 0, 0); c.rotation.z = .95; b.add(c); const p3 = new T.CapsuleGeometry(.0096, .012, 4, 8); p3.rotateZ(PI / 2); p3.translate(-.01, 0, 0); mesh(p3, skin, c, 0, 0, 0, 1.12);
    mesh(knuckle, skin, f, .004, .002, 0, 0); }
  const thumb = new T.Group(); thumb.position.set(.03, .022, -.006); thumb.rotation.set(-.5, .2, .6); hand.add(thumb);
  const tg = new T.CapsuleGeometry(.0115, .036, 4, 8); tg.rotateX(PI / 2); tg.translate(0, 0, -.02); mesh(tg, skin, thumb, 0, 0, 0, 1.1);
  // ---- knives (each built around the grip at the origin, blade toward -z) ----
  const grip = new T.Group(); rig.add(grip);
  const S = 1.5, P = (u, v) => [u * S, v * S];
  // karambit (default + Kite Cutter colours), wrapped in a spin pivot at the finger ring
  const kar = new T.Group(), karSpin = new T.Group(), ringPos = new T.Vector3(0, -.03, .118); karSpin.position.copy(ringPos); kar.add(karSpin);
  const kb = new T.Group(); kb.position.copy(ringPos).multiplyScalar(-1); karSpin.add(kb); grip.add(kar);
  const KM = {};
  { const sh = new T.Shape(); sh.moveTo(...P(0, .018)); sh.quadraticCurveTo(...P(.06, .042), ...P(.115, .012)); sh.quadraticCurveTo(...P(.15, -.012), ...P(.158, -.082));
    sh.quadraticCurveTo(...P(.112, -.03), ...P(.07, -.012)); sh.quadraticCurveTo(...P(.035, 0), ...P(0, -.014)); sh.closePath();
    const bg = new T.ExtrudeGeometry(sh, { depth: .006, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 2, curveSegments: 14 }); bg.translate(0, 0, -.003); bg.rotateY(PI / 2);
    KM.blade = mesh(bg, 0xe8f4ff, kb, 0, .01, -.045, 1.07);
    const sp = new T.Shape(); sp.moveTo(...P(0, .018)); sp.quadraticCurveTo(...P(.06, .042), ...P(.115, .012)); sp.quadraticCurveTo(...P(.15, -.012), ...P(.158, -.082));
    sp.quadraticCurveTo(...P(.152, -.05), ...P(.12, 0)); sp.quadraticCurveTo(...P(.06, .03), ...P(0, .006)); sp.closePath();
    const sg = new T.ExtrudeGeometry(sp, { depth: .011, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 1, curveSegments: 14 }); sg.translate(0, 0, -.0055); sg.rotateY(PI / 2);
    KM.spine = mesh(sg, 0xffffff, kb, 0, .01, -.045, 0);
    KM.tip = new T.Object3D(); KM.tip.position.set(0, .01 - .082 * S, -.045 - .158 * S); kb.add(KM.tip);
    KM.mid = new T.Object3D(); KM.mid.position.set(0, .01 + .02, -.045 - .09 * S); kb.add(KM.mid);
    const hg = new T.CylinderGeometry(.019, .023, .15, 14); hg.rotateX(PI / 2); KM.handle = mesh(hg, 0xff7a3c, kb, 0, 0, .035, 1.12);
    KM.wraps = []; for (let i = 0; i < 6; i++) KM.wraps.push(mesh(new T.TorusGeometry(.0228, .0042, 6, 16), 0xffd9a8, kb, 0, 0, -.022 + i * .02, 0));
    const gd = new T.CylinderGeometry(.033, .033, .009, 16); gd.rotateX(PI / 2); KM.guard = mesh(gd, 0xffb347, kb, 0, 0, -.045, 1.1);
    KM.pom = mesh(new T.SphereGeometry(.026, 14, 10), 0xffb347, kb, 0, 0, .112, 1.1);
    const rg = new T.TorusGeometry(.034, .0085, 8, 20); rg.rotateY(PI / 2); KM.ring = mesh(rg, 0xffb347, kb, ringPos.x, ringPos.y, ringPos.z, 1.12); }
  // butterfly / balisong: blade + two handles on pins; b = blade angle (0 open, PI folded), h = bite handle swing (0 closed on the safe handle)
  const bfly = new T.Group(); bfly.scale.setScalar(1.3); grip.add(bfly); const BM = {};
  { const pivot = new T.Group(); pivot.position.set(0, .004, -.06); bfly.add(pivot); BM.pivot = pivot;
    const blade = new T.Group(); pivot.add(blade); BM.blade = blade;
    const sh = new T.Shape(); sh.moveTo(0, .011); sh.lineTo(.115, .011); sh.quadraticCurveTo(.15, .01, .175, -.002); sh.lineTo(.14, -.004); sh.quadraticCurveTo(.07, -.016, .012, -.013); sh.lineTo(0, -.009); sh.closePath();
    const bg = new T.ExtrudeGeometry(sh, { depth: .004, bevelEnabled: true, bevelThickness: .0016, bevelSize: .0016, bevelSegments: 1, curveSegments: 10 }); bg.translate(0, 0, -.002); bg.rotateY(PI / 2);
    BM.steel = mesh(bg, 0xe8f4ff, blade, 0, 0, 0, 1.06);
    const fl = new T.BoxGeometry(.0052, .0022, .085); mesh(fl, 0x9ab4cc, blade, 0, .003, -.07, 0);           // fuller groove
    const tang = new T.CylinderGeometry(.006, .006, .018, 10); tang.rotateZ(PI / 2); mesh(tang, 0xffd166, blade, 0, 0, 0, 1.15);
    BM.tip = new T.Object3D(); BM.tip.position.set(0, -.002, -.175); blade.add(BM.tip); BM.mid = new T.Object3D(); BM.mid.position.set(0, .006, -.085); blade.add(BM.mid);
    const handleG = new T.BoxGeometry(.0075, .024, .135); handleG.translate(0, 0, .0675);
    const holes = (h, c) => { for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(.0082, .009, .016), c, h, 0, .001, .026 + i * .026, 0); };
    BM.safe = new T.Group(); BM.safe.position.set(-.0072, 0, 0); pivot.add(BM.safe); BM.safeM = mesh(handleG, 0xff846e, BM.safe, 0, 0, 0, 1.08); holes(BM.safe, 0x7a2a44);
    BM.bite = new T.Group(); BM.bite.position.set(.0072, 0, 0); pivot.add(BM.bite); BM.biteM = mesh(handleG, 0x68e3db, BM.bite, 0, 0, 0, 1.08); holes(BM.bite, 0x1d6670);
    const latch = new T.BoxGeometry(.006, .006, .026); latch.translate(0, 0, .013); mesh(latch, 0xffd166, BM.bite, 0, -.01, .128, 1.1);
    for (const g of [BM.safe, BM.bite]) { const pin = new T.CylinderGeometry(.0045, .0045, .012, 10); pin.rotateZ(PI / 2); mesh(pin, 0xffd166, g, 0, 0, 0, 0); } }
  // ---- slash trail (camera space ribbon between tip and mid-blade, fades in ~0.12 s) ----
  const NT = 10, tpos = new Float32Array(NT * 2 * 3), tcol = new Float32Array(NT * 2 * 4), tg2 = new T.BufferGeometry(); tg2.setAttribute('position', new T.BufferAttribute(tpos, 3)); tg2.setAttribute('color', new T.BufferAttribute(tcol, 4));
  const tidx = []; for (let i = 0; i < NT - 1; i++) { const a = i * 2; tidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg2.setIndex(tidx);
  const trail = new T.Mesh(tg2, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide })); trail.frustumCulled = false; trail.renderOrder = 3; camera.add(trail); trail.visible = false;
  const hist = []; const wv = new T.Vector3(), wv2 = new T.Vector3();
  let type = 'default', cur = null, t = 0, flip = false, trailOn = 0, swayX = 0, swayY = 0, lastYaw = null, lastPitch = null, walk = 0;
  function colors(kind) { const c = (m, h) => m.material.color.set(h);
    if (kind === 'kite') { c(KM.blade, 0xff9ac8); c(KM.handle, 0x8f5cff); c(KM.guard, 0xffd166); c(KM.pom, 0x7dffb0); c(KM.ring, 0xffd166); KM.wraps.forEach((w) => c(w, 0xd9c2ff)); }
    else { c(KM.blade, 0xe8f4ff); c(KM.handle, 0xff7a3c); c(KM.guard, 0xffb347); c(KM.pom, 0xffb347); c(KM.ring, 0xffb347); KM.wraps.forEach((w) => c(w, 0xffd9a8)); } }
  const api = {
    root,
    /** your legend's sleeve + team cuff (null = default blue sleeve, yellow cuff) */
    setOutfit(o) { slM.material.color.setHex(o ? o.sleeve : sleeveC); cuM.material.color.setHex(o ? o.cuff : 0xffd166); },
    setType(k) { k = k === 'butterfly' || k === 'kite' ? k : 'default'; if (k === type) return; type = k; kar.visible = k !== 'butterfly'; bfly.visible = k === 'butterfly'; if (k !== 'butterfly') colors(k); },
    play(name) { cur = ANIM[name]; t = 0; trailOn = name.startsWith('slash') ? .3 : name === 'stab' ? .5 : 0; hist.length = 0; },
    draw() { api.play(type === 'butterfly' ? 'drawB' : 'draw'); },
    slash() { flip = !flip; api.play(flip ? 'slashA' : 'slashB'); },
    stab() { api.play('stab'); },
    inspect() { if (!cur) api.play(type === 'butterfly' ? 'inspectB' : 'inspect'); },
    busy() { return !!cur; },
    update(dt, look = {}) {
      if (!root.visible) { trail.visible = false; return; }
      let k = ZERO; if (cur) { t += dt; k = sample(cur, t); if (t >= cur[cur.length - 1][0]) cur = null; }
      // look sway (the arm lags behind mouse turns) + walk bob + idle breathing
      if (look.yaw != null) { if (lastYaw != null) { let dy = look.yaw - lastYaw; if (dy > PI) dy -= 2 * PI; if (dy < -PI) dy += 2 * PI; swayX += (Math.max(-.6, Math.min(.6, dy * 6)) - swayX) * Math.min(1, dt * 10); swayY += (Math.max(-.4, Math.min(.4, (look.pitch - lastPitch) * 6)) - swayY) * Math.min(1, dt * 10); } lastYaw = look.yaw; lastPitch = look.pitch; }
      swayX *= Math.pow(.02, dt); swayY *= Math.pow(.02, dt);
      const sp = Math.min(1, (look.speed || 0) / 4.6); walk += dt * (4 + 6 * sp); const now = performance.now() / 1000;
      const bx = Math.sin(walk) * .012 * sp, by = -Math.abs(Math.cos(walk)) * .012 * sp + Math.sin(now * 1.6) * .0035;
      rig.position.set(HOME.x + k.p[0] + bx + swayX * .03, HOME.y + k.p[1] + by - swayY * .02, HOME.z + k.p[2]);
      rig.rotation.set(HROT.x + k.r[0] + swayY * .4, HROT.y + k.r[1] + swayX * .5, HROT.z + k.r[2] + Math.sin(now * 1.1) * .012);
      karSpin.rotation.x = k.spin; BM.blade.rotation.x = k.b; BM.bite.rotation.x = k.h;
      // trail: sample tip + mid in camera space while a swing is active
      if (trailOn > 0) { trailOn -= dt; const tip = type === 'butterfly' ? BM.tip : KM.tip, mid = type === 'butterfly' ? BM.mid : KM.mid;
        tip.getWorldPosition(wv); mid.getWorldPosition(wv2); camera.worldToLocal(wv); camera.worldToLocal(wv2); hist.unshift([wv.x, wv.y, wv.z, wv2.x, wv2.y, wv2.z]); if (hist.length > NT) hist.length = NT; }
      else if (hist.length) hist.pop();
      trail.visible = hist.length > 1;
      if (trail.visible) { for (let i = 0; i < NT; i++) { const h = hist[Math.min(i, hist.length - 1)], a = i < hist.length ? (1 - i / NT) * .55 : 0;
          tpos.set(h.slice(0, 3), i * 6); tpos.set(h.slice(3, 6), i * 6 + 3); tcol.set([1, .97, .9, a, 1, .85, .95, a * .2], i * 8); }
        tg2.attributes.position.needsUpdate = true; tg2.attributes.color.needsUpdate = true; tg2.computeBoundingSphere(); }
    },
    dispose() { camera.remove(root); camera.remove(trail); root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== ink) o.material.dispose(); } }); ink.dispose(); tg2.dispose(); trail.material.dispose(); },
  };
  bfly.visible = false; colors('default');
  return api;
}
