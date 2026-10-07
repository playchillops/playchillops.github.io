// gunvm.js - first-person guns: procedural toon models for the whole arsenal + part animations.
// createViewmodels(THREE) -> { group, models, current, setWeapon(id), fire(), inspect(), inspecting, reload(dur), setAim(on), aimAmount,
//                              reloading, muzzleWorldPosition(v3), update(dt, {moving, sprinting}) }   (same API as before; animations.js
// still layers springy recoil/sway/reload dip on `group`; this file animates the PARTS: slide, bolt, pump, mag, hands, brass)
// Per class: pistol/hpistol (slide), smg/rifle/lmg (mag + charging handle, LMG cover), shotgun (pump, shell-by-shell reload),
// sniper (bolt cycle after every shot, bolt reload). Draw racks the gun, inspect turns it to show it off. Brass ejects on every shot.
import { WEAPONS, WEAPON_ORDER } from './player.js';
const PI = Math.PI, cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sm = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => cl((t - a) / (b - a));                // 0..1 over [a,b]
const bump = (t, a, b) => Math.sin(PI * seg(t, a, b));         // 0 ->1 ->0 over [a,b]
// look of each gun: k = class kit, c = main colour, a = accent, extras per model
const SPEC = {
  bazooka: { k: 'launcher', c: 0x9fbf62, a: 0x38412e, len: .75 },
  grenadelauncher: { k: 'launcher', c: 0xffa76e, a: 0x45414a, len: .42 },
  pistol: { k: 'pistol', c: 0x5ad1ff, a: 0x2b2f3a, len: .24 },
  thunderpop: { k: 'pistol', c: 0xffd166, a: 0x8d6a2b, len: .31, big: 1.25, rib: true, comp: false },
  fizztwin: { k: 'pistol', c: 0xf2a9b8, a: 0x3a2f3f, len: .26, extMag: true, comp: true },
  buzzbox: { k: 'smg', c: 0xc8b3cb, a: 0x2f2a3a, len: .3, supp: true },
  machinegun: { k: 'rifle', c: 0xffb347, a: 0xb98b64, len: .44, curved: true, wood: true },
  breeze: { k: 'rifle', c: 0x68e3db, a: 0x2b3a3f, len: .46, rail: true, flip: true, skel: true },
  taptap: { k: 'bullpup', c: 0xffda8d, a: 0x4a5163, len: .42 },
  partypopper: { k: 'lmg', c: 0xa9e0c4, a: 0x2b3a33, len: .52 },
  bigpuff: { k: 'shotgun', c: 0xff846e, a: 0x8a5a3c, len: .5 },
  sniper: { k: 'sniper', c: 0x9affc4, a: 0x2b2f3a, len: .62, scope: 1 },
  skyneedle: { k: 'sniper', c: 0x7fe3ff, a: 0x3a4555, len: .56, scope: .8, light: true },
};
const HOME = { pistol: [.17, -.17, -.38], smg: [.18, -.19, -.39], rifle: [.19, -.2, -.42], bullpup: [.19, -.19, -.38], lmg: [.2, -.21, -.44], shotgun: [.19, -.2, -.43], sniper: [.2, -.2, -.43] };
const ADS = { pistol: [0, -.093, -.34], smg: [0, -.115, -.35], rifle: [0, -.118, -.37], bullpup: [0, -.145, -.34], lmg: [0, -.125, -.4], shotgun: [0, -.1, -.4], sniper: [0, -.09, -.3] };

export function createViewmodels(THREE) {
  const T = THREE, group = new T.Group(); group.name = 'viewmodels';
  const mats = new Map(), mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new T.MeshLambertMaterial({ color: c, flatShading: true, ...o })); return mats.get(k); };
  const dark = mat(0x2b2f3a), mid = mat(0x4a5163), metal = mat(0x8e9bb0), brass = mat(0xffc85a), skin = mat(0xf0c3a0);
  // hand / sleeve materials are not shared with gun parts (setOutfit recolours them: your legend's sleeves, bare hands, team cuff)
  const own = (c) => new T.MeshLambertMaterial({ color: c, flatShading: true }), OUTFIT0 = { glove: 0x2f3b55, sleeve: 0x3d6bff, cuff: 0xffd166, knuckle: 0x3a4766 };
  const glove = own(OUTFIT0.glove), sleeveM = own(OUTFIT0.sleeve), cuffM = own(OUTFIT0.cuff), knuckM = own(OUTFIT0.knuckle);
  const B = (p, w, h, d, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  const C = (p, r, l, m, x = 0, y = 0, z = 0, sg = 10, r2 = r) => { const o = new T.Mesh(new T.CylinderGeometry(r, r2, l, sg), m); o.rotation.x = PI / 2; o.position.set(x, y, z); p.add(o); return o; };
  const G = (p, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); p.add(g); return g; };
  function flashMesh(color) {
    const g = new T.Group(), m = new T.MeshBasicMaterial({ color, transparent: true, opacity: .95, depthWrite: false });
    const a = new T.Mesh(new T.CylinderGeometry(0, .035, .13, 6), m); a.rotation.x = PI / 2; a.position.z = -.065; g.add(a);
    const b = new T.Mesh(new T.PlaneGeometry(.15, .15), m); g.add(b); const c = b.clone(); c.rotation.z = PI / 4; g.add(c);
    g.visible = false; g.userData.mat = m; g.userData.isFlash = true; return g;
  }
  // a stylised gloved hand: palm, curled finger block, thumb, sleeve running back out of view
  function hand(p, x, y, z, ry = 0, sleeveDir = [.03, -.07, .2]) {
    const h = G(p, x, y, z); h.rotation.y = ry; h.userData.hand = true;
    B(h, .052, .05, .07, glove, 0, 0, 0); B(h, .056, .03, .062, glove, -.008, .028, -.004); B(h, .02, .022, .05, glove, .028, .018, -.03, 0, -.5, 0);
    for (let i = 0; i < 3; i++) B(h, .052, .012, .006, knuckM, 0, .045, -.026 + i * .02);
    const s = G(h, 0, -.01, .04), L = Math.hypot(...sleeveDir); s.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(...sleeveDir).normalize());
    const sl = C(s, .034, L, sleeveM, 0, 0, L / 2, 10, .042); void sl; C(s, .04, .028, cuffM, 0, 0, .018, 10);
    return h;
  }
  function magBox(p, w, h, d, m, curved) { const g = G(p); if (!curved) B(g, w, h, d, m, 0, -h / 2, 0); else for (let i = 0; i < 3; i++) B(g, w, h / 3 + .004, d, m, 0, -h / 6 - i * h / 3, -i * .016, -.12 * i); B(g, w * 1.05, .012, d * 1.08, dark, 0, -h - .004 - (curved ? .005 : 0), curved ? -.035 : 0); return g; }

  const models = {};
  function build(id) {
    const S = SPEC[id] || SPEC.pistol, k = S.k, g = new T.Group(), body = mat(S.c), acc = mat(S.a), P = {};
    const L = S.len, big = S.big || 1;
    P.muzzle = new T.Object3D(); P.eject = new T.Object3D();
    if (k === 'launcher') {
      C(g,id==='bazooka'?.075:.055,L,body,0,.02,-L/2,16);
      C(g,id==='bazooka'?.06:.044,.02,dark,0,.02,-L-.01,16);
      B(g,.06,.16,.08,acc,0,-.12,.01,-.2);
      B(g,.03,.045,.025,dark,0,.095,-.15);
      P.mag=G(g,0,-.08,-.14);
      if(id==='grenadelauncher') C(P.mag,.09,.16,acc,0,0,0,12); else B(P.mag,.04,.12,.04,dark,0,0,0);
      P.magRest=P.mag.position.clone();
      P.charge=G(g,.07,.02,-.06);B(P.charge,.03,.02,.03,metal,0,0,0);P.chargeRest=P.charge.position.clone();
      P.muzzle.position.set(0,.02,-L-.03);P.eject.position.set(.07,.02,-.1);
      P.rh=hand(g,0,-.12,.03);P.lh=hand(g,0,-.04,-.35);P.lhRest=P.lh.position.clone();
    } else if (k === 'pistol') {

      P.slide = G(g, 0, .022 * big, 0); B(P.slide, .05 * big, .055 * big, L, body, 0, 0, -L / 2 + .07); B(P.slide, .052 * big, .02, .05, acc, 0, .005, .05);
      for (let i = 0; i < 4; i++) B(P.slide, .053 * big, .035, .006, acc, 0, 0, .03 + i * .011);           // rear serrations
      if (S.rib) { B(P.slide, .014, .012, L * .8, acc, 0, .034 * big, -L / 2 + .07); for (let i = 0; i < 5; i++) B(P.slide, .016, .006, .012, mat(0x2b2f3a), 0, .041 * big, -L + .1 + i * L / 6); }
      B(P.slide, .012, .016, .012, mid, 0, .036 * big, -L + .085); B(P.slide, .022, .016, .012, mid, 0, .036 * big, .075);   // sights
      B(g, .042 * big, .032, L * .75, dark, 0, -.018, -L * .3);                                                   // frame
      const grip = B(g, .046 * big, .1 * big, .06, acc, 0, -.07 * big, .045, .26); void grip;
      B(g, .012, .03, .05, dark, 0, -.045, -.01, .3);                                                             // trigger guard
      P.mag = G(g, 0, -.03, .055); P.mag.rotation.x = .26; B(P.mag, .038 * big, (S.extMag ? .15 : .1) * big, .045, dark, 0, -.06 * big - (S.extMag ? .025 : 0), 0); P.magRest = P.mag.position.clone();
      if (S.comp) B(g, .046, .05, .05, mid, 0, .022, -L + .045);
      P.muzzle.position.set(0, .022 * big, -L + .035 - (S.comp ? .05 : 0)); P.eject.position.set(.03, .045 * big, -.02);
      P.rh = hand(g, 0, -.07 * big, .06, 0, [.03, -.06, .2]); P.lh = hand(g, -.03, -.09 * big, .05, .5, [-.05, -.06, .18]); P.lhRest = P.lh.position.clone();
    } else {
      // long guns: receiver, barrel, grip, stock, mag; class details below
      const bull = k === 'bullpup', recL = bull ? L * .6 : L * .55;
      B(g, .065, .085, recL, body, 0, 0, -recL / 2 + .1);                                                       // receiver
      const barL = k === 'sniper' ? L * 1.05 : k === 'shotgun' ? L * .95 : L * .65, bz = -recL + .1;
      C(g, k === 'shotgun' ? .022 : .015, barL, dark, 0, .012, bz - barL / 2);                                    // barrel
      if (k !== 'shotgun' && k !== 'sniper') { B(g, .07, .07, L * .42, S.wood ? acc : mid, 0, -.002, bz - L * .21); }  // handguard
      if (S.rail || k === 'lmg') for (let i = 0; i < 6; i++) B(g, .03, .012, .025, dark, 0, .05, -.05 - i * .05);   // top rail
      B(g, .042, .12, .06, acc, 0, -.1, bull ? -.08 : .02, -.25);                                                 // pistol grip
      if (k !== 'sniper') { B(g, .012, .04, .07, dark, 0, -.06, bull ? -.13 : -.035, .1); }
      // stock
      if (S.skel) { B(g, .02, .02, .2, dark, 0, .0, .22); B(g, .02, .02, .2, dark, 0, -.07, .22, -.25); B(g, .04, .1, .03, dark, 0, -.035, .32); }
      else if (k === 'smg') { B(g, .016, .016, .2, dark, .025, -.02, .2); B(g, .016, .016, .2, dark, -.025, -.02, .2); B(g, .06, .07, .02, dark, 0, -.03, .3); }
      else if (!bull) { B(g, .055, .09, .24, k === 'shotgun' || S.wood ? acc : dark, 0, -.035, .25, -.12); }
      else B(g, .066, .095, .16, body, 0, -.01, .2);
      // magazine / feed
      const magZ = bull ? .11 : k === 'sniper' ? -.02 : -.06;
      if (k === 'shotgun') { C(g, .016, barL * .8, mid, 0, -.03, bz - barL * .4); P.pump = G(g, 0, -.03, bz - barL * .22); C(P.pump, .028, .17, acc, 0, 0, 0, 10); for (let i = 0; i < 4; i++) C(P.pump, .03, .008, dark, 0, 0, -.06 + i * .04, 10); P.pumpRest = P.pump.position.clone(); }
      else if (k === 'lmg') { P.mag = G(g, 0, -.045, magZ); B(P.mag, .11, .1, .11, dark, -.02, -.05, 0); B(P.mag, .112, .02, .112, mid, -.02, -.006, 0); P.cover = G(g, 0, .043, .05); B(P.cover, .07, .02, .2, mid, 0, .01, -.1); P.coverRest = P.cover.rotation.x;
        const bp = G(g, 0, -.02, bz - barL * .8); B(bp, .012, .012, .16, dark, .02, 0, .08, .05); B(bp, .012, .012, .16, dark, -.02, 0, .08, .05); }
      else { P.mag = G(g, 0, -.042, magZ); const mh = k === 'sniper' ? .06 : k === 'smg' ? .16 : .13; const mm = magBox(P.mag, .04, mh, .055, k === 'smg' ? dark : S.curved ? mat(0x6b4423) : dark, S.curved); void mm; }
      if (P.mag) P.magRest = P.mag.position.clone();
      // class details
      if (k === 'sniper') { const sc = S.scope; C(g, .03 * sc, .3 * sc, dark, 0, .085, -.12, 12); C(g, .042 * sc, .06, dark, 0, .085, -.28 * sc, 12, .034); C(g, .036 * sc, .05, dark, 0, .085, .03, 12); C(g, .03, .002, mat(0x7fe3ff), 0, .085, -.31 * sc, 12);
        B(g, .02, .045, .02, mid, 0, .045, -.17); B(g, .02, .045, .02, mid, 0, .045, -.03); C(g, .024, .07, dark, 0, .012, bz - barL - .02, 8);   // rings + muzzle brake
        P.bolt = G(g, .035, .02, .05); B(P.bolt, .05, .014, .014, metal, .02, 0, 0); const knob = new T.Mesh(new T.SphereGeometry(.014, 8, 6), metal); knob.position.set(.045, 0, 0); P.bolt.add(knob); }
      if (S.flip) { B(g, .02, .03, .02, dark, 0, .07, .06); B(g, .02, .03, .02, dark, 0, .06, bz - L * .38); }
      if (bull) { B(g, .02, .045, recL * .9, dark, 0, .065, -recL / 2 + .1); B(g, .07, .014, recL * .9, mid, 0, .09, -recL / 2 + .1); }
      if (k === 'rifle' && !S.flip) { B(g, .012, .04, .012, dark, 0, .052, bz - L * .4); B(g, .03, .02, .03, dark, 0, .05, .06); }        // AK sights
      if (k === 'smg') { B(g, .02, .03, .02, dark, 0, .06, .05); B(g, .012, .03, .012, dark, 0, .055, bz - .02); }
      if (k === 'shotgun') { const bead = new T.Mesh(new T.SphereGeometry(.007, 6, 5), metal); bead.position.set(0, .038, bz - barL + .01); g.add(bead); }
      if (S.supp) C(g, .027, .14, dark, 0, .012, bz - barL - .07, 10);
      P.charge = G(g, .036, .02, .05); B(P.charge, .025, .012, .02, metal, .012, 0, 0); P.chargeRest = P.charge.position.clone();
      const mz = bz - barL - (S.supp ? .14 : k === 'sniper' ? .06 : 0);
      P.muzzle.position.set(0, .012, mz); P.eject.position.set(.04, .03, bull ? .12 : -.02);
      // hands: right on the grip, left on the handguard / pump
      P.rh = hand(g, 0, -.1, bull ? -.06 : .04, 0, [.03, -.07, .2]);
      P.lh = hand(g, 0, -.045, k === 'shotgun' ? bz - barL * .22 : bull ? -.3 : bz - L * .2, 0, [-.08, -.07, .19]); P.lhRest = P.lh.position.clone();
    }
    g.add(P.muzzle); g.add(P.eject);
    const fl = flashMesh(id === 'bigpuff' ? 0xffb38a : id === 'sniper' || id === 'skyneedle' ? 0xbfffe0 : 0xfff2a0); fl.position.copy(P.muzzle.position); g.add(fl);
    const hk = HOME[k === 'bullpup' ? 'bullpup' : k] || HOME.rifle, ak = ADS[k] || ADS.rifle;
    g.visible = false; group.add(g);
    return { g, k, spec: S, ...P, flash: fl, home: new T.Vector3(...hk), ads: new T.Vector3(...ak), slideRest: P.slide ? P.slide.position.z : 0 };
  }
  for (const id of WEAPON_ORDER) models[id] = build(id);

  // brass: one instanced mesh, casings fly out of the ejection port in viewmodel space
  const NB = 24, brassG = new T.CylinderGeometry(.006, .006, .022, 6); brassG.rotateZ(PI / 2);
  const brassI = new T.InstancedMesh(brassG, brass, NB); brassI.frustumCulled = false; group.add(brassI); const shells = [];
  const m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), v4 = new T.Vector3(), s4 = new T.Vector3(1, 1, 1), hid = new T.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < NB; i++) brassI.setMatrixAt(i, hid);
  function eject(m, n = 1, shell = false) { for (let j = 0; j < n; j++) { m.eject.getWorldPosition(v4); group.worldToLocal(v4); const big = shell ? 2.2 : 1;
    shells.push({ p: v4.clone(), v: new T.Vector3(.9 + Math.random() * .6, 1.1 + Math.random() * .7, .25 + Math.random() * .3), r: Math.random() * 6, w: 18 + Math.random() * 10, t: 0, s: big }); }
    while (shells.length > NB) shells.shift(); }

  const st = { current: 'pistol', recoil: 0, flash: 0, reloadT: -1, reloadDur: 1, aim: 0, aimTarget: 0, bob: 0, swap: 1, kick: 0, time: 0, inspT: -1, actT: -1, drawT: -1, empty: false };
  const api = {
    group, models,
    get current() { return st.current; },
    /** o = { sleeve, glove, cuff } colours (legendOutfit) or null for the default gloves + blue sleeves */
    setOutfit(o) { const c = o || OUTFIT0; glove.color.setHex(c.glove ?? OUTFIT0.glove); sleeveM.color.setHex(c.sleeve ?? OUTFIT0.sleeve); cuffM.color.setHex(c.cuff ?? OUTFIT0.cuff);
      knuckM.color.setHex(o ? new T.Color(c.glove).multiplyScalar(0.82).getHex() : OUTFIT0.knuckle); },
    setWeapon(id) {
      if (!models[id] || id === st.current && models[id].g.visible) return;
      models[st.current].g.visible = false;
      st.current = id; models[id].g.visible = true; st.swap = 0; st.reloadT = -1; st.flash = 0; st.inspT = -1; st.actT = -1; st.drawT = 0;
    },
    fire() { const w = WEAPONS[st.current], m = models[st.current]; st.recoil = Math.min(1.6, st.recoil + 1); st.flash = .06; st.kick = w.recoil.kick;
      m.flash.rotation.z = Math.random() * 6.28; st.inspT = -1; st.drawT = -1;
      if (m.k === 'sniper' || m.k === 'shotgun') st.actT = 0;        // bolt / pump cycles after the shot (brass comes out with it)
      else eject(m); },
    inspect() { if (st.reloadT >= 0 || st.inspT >= 0 || st.aimTarget > 0 || st.recoil > .15 || st.swap < 1 || st.actT >= 0) return false; st.inspT = 0; st.drawT = -1; return true; },
    get inspecting() { return st.inspT >= 0; },
    reload(dur) { st.inspT = -1; st.actT = -1; st.drawT = -1; st.reloadT = 0; st.reloadDur = dur ?? WEAPONS[st.current].reloadTime; st.dropped = false; st.shellIn = 0; },
    setAim(on) { st.aimTarget = on ? 1 : 0; },
    get aimAmount() { return st.aim; },
    get reloading() { return st.reloadT >= 0; },
    muzzleWorldPosition(v) { models[st.current].muzzle.getWorldPosition(v); return v; },
    update(dt, s = {}) {
      st.time += dt;
      const m = models[st.current], w = WEAPONS[st.current], g = m.g, k = m.k;
      st.aim += (st.aimTarget - st.aim) * Math.min(1, dt * 14);
      st.swap = Math.min(1, st.swap + dt * 4);
      st.recoil = Math.max(0, st.recoil - dt * w.recoil.recover);
      st.kick = Math.max(0, st.kick - dt * .6);
      if (s.moving) st.bob += dt * (s.sprinting ? 13 : 8);
      const bobAmt = (s.moving ? 1 : 0) * (1 - st.aim * .9) * (s.sprinting ? 1.6 : 1), idle = Math.sin(st.time * 1.6) * .0015;
      const p = m.home.clone().lerp(m.ads, st.aim);
      p.x += Math.cos(st.bob * .5) * .012 * bobAmt; p.y += Math.abs(Math.sin(st.bob * .5)) * .014 * bobAmt + idle - (1 - sm(st.swap)) * .26; p.z += st.recoil * w.recoil.kick * 1.3;
      g.position.copy(p);
      g.rotation.set(st.recoil * w.recoil.kick * 2.2 - (1 - sm(st.swap)) * .9, 0, (1 - sm(st.swap)) * .25);
      if (s.sprinting && s.moving) { g.rotation.y = .35 * (1 - st.aim); g.rotation.z = -.1; }
      // ---- parts at rest
      if (m.slide) m.slide.position.z = m.slideRest + Math.min(1, st.recoil) * .055 * (m.spec.big || 1);
      if (m.mag) m.mag.position.copy(m.magRest), m.mag.rotation.z = 0;
      if (m.lh) m.lh.position.copy(m.lhRest);
      if (m.pump) m.pump.position.copy(m.pumpRest);
      if (m.charge) m.charge.position.copy(m.chargeRest);
      if (m.bolt) m.bolt.rotation.z = 0, m.bolt.position.z = .05;
      if (m.cover) m.cover.rotation.x = 0;
      // ---- draw: the gun comes up and gets racked (slide / charging handle / bolt / pump)
      if (st.drawT >= 0) { st.drawT += dt; const t = st.drawT / .7; const r = bump(t, .35, .8);
        if (m.slide) m.slide.position.z += r * .06; if (m.charge) m.charge.position.z += r * .07; if (m.pump) m.pump.position.z += r * .09;
        if (m.bolt) { m.bolt.rotation.z = bump(t, .3, .85) * 1.2; m.bolt.position.z += bump(t, .4, .75) * .06; }
        g.rotation.z += bump(t, 0, .5) * .25; if (t >= 1) st.drawT = -1; }
      // ---- action after a shot: sniper bolt (lift, back, forward, down) / shotgun pump (back, forward)
      if (st.actT >= 0) { st.actT += dt; const dur = k === 'sniper' ? (st.current === 'sniper' ? .85 : .65) : .42, t = st.actT / dur;
        if (k === 'sniper') { m.bolt.rotation.z = (seg(t, .15, .3) - seg(t, .7, .85)) * 1.3; m.bolt.position.z = .05 + (seg(t, .3, .45) - seg(t, .55, .7)) * .09; g.rotation.z += bump(t, .1, .9) * .18; g.rotation.y += bump(t, .1, .9) * .06; if (t > .45 && !st.ej) { st.ej = true; eject(m, 1, true); } }
        else { const back = seg(t, .1, .45) - seg(t, .55, .9); m.pump.position.z = m.pumpRest.z + back * .1; m.lh.position.z = m.lhRest.z + back * .1; g.rotation.x += bump(t, .1, .9) * .06; if (t > .45 && !st.ej) { st.ej = true; eject(m, 1, true); } }
        if (t >= 1) { st.actT = -1; st.ej = false; } }
      // ---- reload choreography
      if (st.reloadT >= 0) {
        st.reloadT += dt; const t = Math.min(1, st.reloadT / st.reloadDur);
        if (k === 'shotgun') {                          // tilt, feed shells one by one with the left hand, pump to finish
          const n = Math.max(1, Math.round(st.reloadDur / .45) - 1), u = seg(t, .12, .85) * n, f = u % 1, tilt = seg(t, 0, .12) - seg(t, .85, 1);
          g.rotation.z += tilt * .55; g.rotation.x += tilt * .12;
          if (t > .12 && t < .85) { m.lh.position.set(m.lhRest.x + .02, m.lhRest.y - .05 + Math.sin(f * PI) * .04, m.lhRest.z + .14 - Math.sin(f * PI) * .05); if (f > .5 && st.shellIn < Math.floor(u) + 1) st.shellIn = Math.floor(u) + 1; }
          const pp = bump(t, .88, 1); m.pump.position.z = m.pumpRest.z + pp * .1; if (t > .88) m.lh.position.z = m.lhRest.z + pp * .1;
        } else if (k === 'sniper') {                    // bolt up/back, mag out/in, bolt forward/down
          const open = seg(t, .05, .2) - seg(t, .82, .95); m.bolt.rotation.z = open * 1.3; m.bolt.position.z = .05 + (seg(t, .12, .25) - seg(t, .75, .85)) * .09;
          const out = seg(t, .25, .4) - seg(t, .55, .7); m.mag.position.y = m.magRest.y - out * .16; m.lh.position.set(m.lhRest.x + out * .02, m.lhRest.y - out * .14, m.lhRest.z + seg(t, .2, .3) * .25 - seg(t, .7, .8) * .25);
          g.rotation.z += (seg(t, 0, .1) - seg(t, .9, 1)) * .3;
        } else if (k === 'lmg') {                       // cover up, box out, new box, belt, cover down, charge
          const cov = seg(t, .08, .2) - seg(t, .7, .82); m.cover.rotation.x = -cov * 1.1;
          const out = seg(t, .2, .35) - seg(t, .45, .6); m.mag.position.y = m.magRest.y - out * .22; m.mag.position.x = m.magRest.x - out * .05;
          m.lh.position.set(m.lhRest.x - .02, m.lhRest.y - out * .18 + cov * .03, m.lhRest.z + seg(t, .15, .25) * .3 - seg(t, .82, .9) * .3);
          if (m.charge) m.charge.position.z = m.chargeRest.z + bump(t, .86, .97) * .08; g.rotation.z += (seg(t, 0, .1) - seg(t, .88, 1)) * .4;
        } else {                                        // box-mag guns + pistols: hand to mag, drop it, new mag in, slap, rack if empty
          const toMag = seg(t, .08, .2), out = seg(t, .2, .34), inn = seg(t, .45, .62), slap = bump(t, .62, .7), rack = bump(t, .74, .9);
          if (out > 0 && !st.dropped) { st.dropped = true; }
          const magY = out < 1 ? -out * .2 : -.2 + inn * .2; m.mag.position.y = m.magRest.y + magY; m.mag.rotation.z = out > 0 && inn === 0 ? out * .4 : (1 - inn) * .25;
          const lhTarget = m.mag.position.clone().add(new T.Vector3(-.01, -.07, 0)), back = seg(t, .72, .9);
          m.lh.position.lerpVectors(m.lhRest, lhTarget, Math.min(toMag, 1 - back)); m.lh.position.y += slap * .02;
          if (m.slide) m.slide.position.z = m.slideRest + rack * .06; if (m.charge) { m.charge.position.z = m.chargeRest.z + rack * .07; if (rack > 0) m.lh.position.lerp(m.charge.position.clone().add(new T.Vector3(-.03, .0, .02)), rack); }
          g.rotation.z += (seg(t, 0, .15) - seg(t, .85, 1)) * (k === 'pistol' ? .5 : .35); g.rotation.x -= slap * .08;
        }
        if (t >= 1) st.reloadT = -1;
      }
      // ---- inspect: turn to show the left side, flip, check the mag / bolt, back
      if (st.inspT >= 0) {
        if (st.recoil > .05 || st.aimTarget > 0 || st.reloadT >= 0) st.inspT = -1;
        else { st.inspT += dt; const t = Math.min(1, st.inspT / 2.6), a = sm(seg(t, 0, .2)) - sm(seg(t, .85, 1)), flip = sm(seg(t, .35, .5)) - sm(seg(t, .62, .75));
          g.position.x -= a * .08; g.position.y += a * .04; g.position.z += a * .06;
          g.rotation.y += a * (k === 'pistol' ? .9 : .7) - flip * 1.6; g.rotation.z += a * .35 + flip * .4; g.rotation.x -= a * .15;
          if (m.mag && k !== 'lmg') m.mag.position.y = m.magRest.y - bump(t, .78, .92) * .05;
          if (m.slide) m.slide.position.z = m.slideRest + bump(t, .22, .32) * .03;
          if (m.bolt) m.bolt.rotation.z = bump(t, .78, .95) * 1.1;
          if (m.pump) m.pump.position.z = m.pumpRest.z + bump(t, .78, .92) * .06;
          if (t >= 1) st.inspT = -1; } }
      // ---- brass physics (viewmodel space)
      for (let i = shells.length - 1; i >= 0; i--) { const b = shells[i]; b.t += dt; b.v.y -= 6 * dt; b.p.addScaledVector(b.v, dt * .35); b.r += b.w * dt; if (b.t > .7) shells.splice(i, 1); }
      for (let i = 0; i < NB; i++) { const b = shells[i]; if (!b) { brassI.setMatrixAt(i, hid); continue; } brassI.setMatrixAt(i, m4.compose(b.p, q4.setFromEuler(e4.set(b.r, b.r * .7, 0)), s4.set(b.s, b.s, b.s))); }
      brassI.instanceMatrix.needsUpdate = true; brassI.visible = !(w.scope && st.aim > .9);
      // ---- muzzle flash, scope hides the gun
      st.flash = Math.max(0, st.flash - dt);
      const fl = m.flash; fl.visible = st.flash > 0 && !(w.scope && st.aim > .8);
      if (fl.visible) { const kk = st.flash / .06; fl.userData.mat.opacity = kk; fl.scale.setScalar((k === 'sniper' ? 1.4 : 1) * (.7 + .6 * kk) * w.flash); }
      g.visible = !(w.scope && st.aim > .9);
    },
  };
  api.setWeapon('pistol'); models.pistol.g.visible = true; st.drawT = -1;
  return api;
}
