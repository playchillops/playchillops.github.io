import { weaponClass } from './player.js';
import { LEGENDS, LEGEND_IDS } from './common.js';
// characters.js - procedural stylized characters for Sniper Chill (no external assets).
//
//   import { createCharacter, ROSTER, createViewmodelHand } from './characters.js';
//   const ch = createCharacter(THREE, { id: 'bruno', team: 'CT', weapon: 'machinegun' });
//   scene.add(ch.group);   // group origin = FEET, faces -Z (same as the old bots: rotation.y = yaw)
//   each frame:  ch.group.position.set(x,y,z); ch.group.rotation.y = yaw;
//                ch.update(dt, { speed, crouched, aiming, reloading, alive, pitch, weapon });
//   one-shots:   ch.setAnim('shoot') | 'hit' | 'reload' | 'death'   (also idle/walk/run/aim/crouch)
//   hitscan:     target.hitZones = ch.hitZones()  -> [{zone,center,radius}|{zone,min,max}] world-space (hitscan.js format)
//                or raycast ch.hitboxes (invisible meshes, userData.zone = head|body|legs)
//
// update() state (all optional): speed m/s (0 idle, ~1.7 walk, 3+ run), crouched, aiming, reloading, alive (false => death,
// true after death => revive), distance (to camera, m: outlines are hidden beyond ~26 m to save draw calls), pitch (aim elevation, rad), weapon ('pistol'|'machinegun'|'sniper'), team.
export const ROSTER = [
  { id: 'bruno', name: 'Bruno', role: 'Bruiser' },
  { id: 'mimi', name: 'Mimi', role: 'Scout' },
  { id: 'otto', name: 'Otto', role: 'Heavy' },
  { id: 'zed', name: 'Zed', role: 'Sniper' },
  { id: 'pip', name: 'Pip', role: 'Rookie' },
  { id: 'rex', name: 'Rex', role: 'Punk' },
  ...LEGENDS.map((l) => ({ id: l.id, name: l.name, role: l.co, legend: true })),
];
export const CHARACTER_IDS = ROSTER.map((r) => r.id);
export { LEGEND_IDS };

const OUTLINE = 0x1a1428;
const lib = new WeakMap();
function getLib(THREE) {
  if (lib.has(THREE)) return lib.get(THREE);
  const grad = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const geoCache = new Map();
  const L = { grad, geoCache };
  L.rrect = (w, h, d, r, bev) => {
    const key = ['r', w, h, d, r].join(); if (geoCache.has(key)) return geoCache.get(key);
    r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001); bev = Math.min(bev ?? r * 0.6, d / 2 - 0.001);
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * bev) / 2); geoCache.set(key, g); return g;
  };
  lib.set(THREE, L); return L;
}

const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function specs() {
  return {
    bruno: { leg: 0.74, torso: 0.54, headR: 0.2, bulk: 1.25, depth: 1.15, shoulder: 0.27, skin: 0xd9a07a, arm: 0.6,
      pal: { CT: { main: 0x2f5fbf, accent: 0x8fd8ff, pants: 0x27304d, boots: 0x1f2433, gloves: 0x1f2433, trim: 0xe8f4ff },
             T:  { main: 0xc9482a, accent: 0xffc36b, pants: 0x45362c, boots: 0x2b211b, gloves: 0x2b211b, trim: 0xfff0d0 } },
      brow: -0.3, mouth: 'flat', eye: 0.9 },
    mimi: { leg: 0.78, torso: 0.5, headR: 0.2, bulk: 0.82, depth: 0.85, shoulder: 0.2, skin: 0xf2c29b, arm: 0.58,
      pal: { CT: { main: 0x20a8b8, accent: 0xffe066, pants: 0x2d3a55, boots: 0xf2f2f2, gloves: 0xffe066, trim: 0xffffff },
             T:  { main: 0xe8723a, accent: 0xffe066, pants: 0x4a3340, boots: 0xf2f2f2, gloves: 0xffe066, trim: 0xffffff } },
      brow: 0.1, mouth: 'smile', eye: 1.2 },
    otto: { leg: 0.66, torso: 0.56, headR: 0.2, bulk: 1.45, depth: 1.3, shoulder: 0.3, skin: 0xb98563, arm: 0.56,
      pal: { CT: { main: 0x3b4a78, accent: 0x5fb0ff, pants: 0x2a3050, boots: 0x181b27, gloves: 0x181b27, trim: 0xb9d4ff },
             T:  { main: 0x7a3a2a, accent: 0xff8a3d, pants: 0x3b2c24, boots: 0x1e1612, gloves: 0x1e1612, trim: 0xffd2a8 } },
      brow: 0, mouth: 'flat', eye: 1 },
    zed: { leg: 0.82, torso: 0.52, headR: 0.18, bulk: 0.78, depth: 0.8, shoulder: 0.2, skin: 0xe6b794, arm: 0.64,
      pal: { CT: { main: 0x2a3a5c, accent: 0x6af0ff, pants: 0x1f2840, boots: 0x131824, gloves: 0x131824, trim: 0x9ad8e8 },
             T:  { main: 0x4a2a2a, accent: 0xff6a4a, pants: 0x2a1e1e, boots: 0x161010, gloves: 0x161010, trim: 0xe8a898 } },
      brow: -0.12, mouth: 'flat', eye: 0.8 },
    pip: { leg: 0.64, torso: 0.46, headR: 0.235, bulk: 0.9, depth: 0.95, shoulder: 0.2, skin: 0xf5cba7, arm: 0.5,
      pal: { CT: { main: 0x4a7fe0, accent: 0x59c2ff, pants: 0x3a4a6a, boots: 0x6a4a35, gloves: 0xe8d8b0, trim: 0xffffff },
             T:  { main: 0xe0603a, accent: 0xffcf3f, pants: 0x6a4a3a, boots: 0x4a3322, gloves: 0xe8d8b0, trim: 0xffffff } },
      brow: 0.2, mouth: 'grin', eye: 1.35 },
    rex: { leg: 0.76, torso: 0.52, headR: 0.2, bulk: 1.0, depth: 1, shoulder: 0.23, skin: 0x8d5a3b, arm: 0.6,
      pal: { CT: { main: 0x1c1f2a, accent: 0x3dffb0, pants: 0x2b3f6b, boots: 0x14161d, gloves: 0x14161d, trim: 0x3dffb0 },
             T:  { main: 0x1c1f2a, accent: 0xff4f7b, pants: 0x5a2a2a, boots: 0x14161d, gloves: 0x14161d, trim: 0xff4f7b } },
      brow: -0.1, mouth: 'smirk', eye: 1 },
    // ---- Silicon Valley legends (civ: no armour bits; accent = team colour: lanyard badge, armband, shoe stripe)
    jobs: { civ: 1, leg: 0.8, torso: 0.52, headR: 0.2, bulk: 0.86, depth: 0.88, shoulder: 0.21, skin: 0xe9b993, arm: 0.62, pal: civ(0x1d1d22, 0x46679a, 0xa3a8b0, 0xf2f2f2, 0xe9b993), brow: 0.05, mouth: 'smile', eye: 0.95 },
    zuck: { civ: 1, leg: 0.76, torso: 0.5, headR: 0.205, bulk: 0.9, depth: 0.9, shoulder: 0.21, skin: 0xf3cfb3, arm: 0.6, sleeve: 'short', pal: civ(0x8d929b, 0x3a4f78, 0x6b7280, 0xf4f4f4, 0xf3cfb3), brow: 0.15, mouth: 'flat', eye: 1.3 },
    altman: { civ: 1, leg: 0.77, torso: 0.5, headR: 0.2, bulk: 0.82, depth: 0.85, shoulder: 0.2, skin: 0xf0c6a6, arm: 0.6, pal: civ(0x2f3e5c, 0x3b3f47, 0xf4f4f4, 0xffffff, 0xf0c6a6), brow: 0.2, mouth: 'smile', eye: 1.35 },
    musk: { civ: 1, leg: 0.8, torso: 0.56, headR: 0.205, bulk: 1.12, depth: 1.05, shoulder: 0.25, skin: 0xeec3a3, arm: 0.64, sleeve: 'short', pal: civ(0x16171b, 0x24262c, 0x16171b, 0x3a3d45, 0xeec3a3), brow: -0.12, mouth: 'smirk', eye: 0.95 },
    bezos: { civ: 1, leg: 0.74, torso: 0.54, headR: 0.2, bulk: 1.3, depth: 1.15, shoulder: 0.27, skin: 0xe2ae8a, arm: 0.6, armC: 0x9cc3e6, pal: civ(0x1f2b44, 0x3a4a6a, 0x2a2220, 0x1a1512, 0xe2ae8a), brow: -0.05, mouth: 'grin', eye: 1 },
    jensen: { civ: 1, leg: 0.74, torso: 0.52, headR: 0.2, bulk: 0.98, depth: 0.95, shoulder: 0.23, skin: 0xe0b48e, arm: 0.6, pal: civ(0x26201f, 0x1c1c22, 0x18181c, 0x2e2e34, 0xe0b48e), brow: 0.05, mouth: 'smile', eye: 1 },
    gates: { civ: 1, leg: 0.76, torso: 0.5, headR: 0.2, bulk: 0.9, depth: 0.9, shoulder: 0.21, skin: 0xf1c7a8, arm: 0.6, pal: civ(0x5b6b8c, 0xb59f78, 0x4a3426, 0x2a1f18, 0xf1c7a8), brow: 0.18, mouth: 'smile', eye: 1 },
    lisa: { civ: 1, leg: 0.76, torso: 0.48, headR: 0.195, bulk: 0.78, depth: 0.82, shoulder: 0.2, skin: 0xe8c09a, arm: 0.58, pal: civ(0x9e2235, 0x1d1f27, 0x1d1f27, 0x101116, 0xe8c09a), brow: 0.1, mouth: 'smile', eye: 1.15 },
  };
}
// legend palette: outfit + shoes identical for both teams; accent = team colour (badge, armband, shoe stripe); bare hands
function civ(main, pants, shoes, sole, skin) {
  return { CT: { main, accent: 0x2f8cff, pants, boots: shoes, gloves: skin, trim: sole }, T: { main, accent: 0xff7a2f, pants, boots: shoes, gloves: skin, trim: sole } };
}

// ---------------------------------------------------------------- main factory
export function createCharacter(THREE, opts = {}) {
  const L = getLib(THREE);
  const SPECS = specs();
  const id = SPECS[opts.id] ? opts.id : CHARACTER_IDS[Math.abs(opts.seed | 0) % CHARACTER_IDS.length];
  const sp = SPECS[id];
  let team = opts.team === 'T' ? 'T' : 'CT'; let rawTeam = team;
  const pal = () => sp.pal[team];
  const seed = (opts.seed ?? (id.charCodeAt(0) * 7.31)) % 100;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const mats = new Map(), allMats = [], teamParts = [];
  const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
  const geos = [], outlines = []; let outlineOn = true;
  function mat(color, o = {}) {
    const key = color + (o.glow ? 'g' : '');
    if (mats.has(key)) return mats.get(key);
    const m = o.glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshToonMaterial({ color, gradientMap: L.grad });
    mats.set(key, m); if (!o.glow) allMats.push(m); return m;
  }
  function tm(slot) { const m = new THREE.MeshToonMaterial({ color: pal()[slot], gradientMap: L.grad }); m.userData.slot = slot; allMats.push(m); teamParts.push(m); return m; }
  function add(parent, geo, m, x = 0, y = 0, z = 0, o = {}) {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z);
    if (o.rot) me.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    if (o.s) me.scale.set(o.s[0], o.s[1], o.s[2]);
    if (o.name) me.name = o.name;
    parent.add(me);
    if (o.outline !== false) {
      geo.computeBoundingBox(); const bb = geo.boundingBox, t = o.ot ?? 0.016, c = bb.getCenter(new V3()), sz = bb.getSize(new V3());
      const S = o.s || [1, 1, 1];
      const sx = 1 + 2 * t / Math.max(0.02, sz.x * S[0]), sy = 1 + 2 * t / Math.max(0.02, sz.y * S[1]), sz2 = 1 + 2 * t / Math.max(0.02, sz.z * S[2]);
      const ol = new THREE.Mesh(geo, outlineMat); ol.scale.set(sx, sy, sz2); ol.position.set(c.x * (1 - sx), c.y * (1 - sy), c.z * (1 - sz2)); me.add(ol); outlines.push(ol);
    }
    return me;
  }
  const sph = (p, r, m, x, y, z, o = {}) => { const g = new THREE.SphereGeometry(r, o.seg || 14, o.seg ? Math.max(6, o.seg - 4) : 10, 0, Math.PI * 2, 0, o.phi ?? Math.PI); geos.push(g); return add(p, g, m, x, y, z, o); };
  const cyl = (p, rt, rb, h, m, x, y, z, o = {}) => { const g = new THREE.CylinderGeometry(rt, rb, h, o.seg || 14); geos.push(g); return add(p, g, m, x, y, z, o); };
  const cone = (p, r, h, m, x, y, z, o = {}) => cyl(p, 0, r, h, m, x, y, z, { seg: 6, ...o });
  const rbox = (p, w, h, d, r, m, x, y, z, o = {}) => add(p, L.rrect(w, h, d, r, o.bev), m, x, y, z, o);
  const caps = (p, r, len, m, x, y, z, o = {}) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); geos.push(g); return add(p, g, m, x, y, z, o); };
  const torus = (p, R, t, m, x, y, z, o = {}) => { const g = new THREE.TorusGeometry(R, t, 6, o.seg || 16, o.arc ?? Math.PI * 2); geos.push(g); return add(p, g, m, x, y, z, { outline: false, ...o }); };
  const node = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const limb = (p, len, r, m, o = {}) => { const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10); geos.push(g); g.translate(0, -len / 2, 0); return add(p, g, m, 0, 0, 0, o); };
  const glow = (c) => mat(c, { glow: true });

  // ---------- skeleton
  const group = new THREE.Group(); group.name = 'char_' + id;
  const rig = node(group);
  const B = sp.bulk, D = sp.depth;
  const legLen = sp.leg, L1 = legLen / 2, L2 = legLen / 2;
  const hipBase = legLen * 0.985 + 0.08;
  const hips = node(rig, 0, hipBase, 0);
  const pelvis = node(hips);
  const spineLen = sp.torso * 0.38, chestLen = sp.torso * 0.62;
  const spine = node(hips, 0, 0.02, 0);
  const chest = node(spine, 0, spineLen, 0);
  const shY = chestLen * 0.8, shX = sp.shoulder;
  const neck = node(chest, 0, chestLen, 0);
  const head = node(neck, 0, 0.03, 0);
  const HR = sp.headR, headC = HR * 0.88, HZ = { otto: 1.3, zed: 1.22, pip: 1.1, bruno: 1.12, rex: 1.08, mimi: 1.08 }[id] ?? 1.1;
  const headTop = hipBase + 0.02 + spineLen + chestLen + 0.03 + headC + HR;
  const skin = mat(sp.skin), dark = mat(0x23202e), white = mat(0xffffff);
  const mMain = tm('main'), mAcc = tm('accent'), mPants = tm('pants'), mBoots = tm('boots'), mGloves = tm('gloves'), mTrim = tm('trim');

  rbox(pelvis, 0.3 * B, 0.16, 0.2 * D, 0.06, mPants, 0, -0.01, 0);
  cyl(pelvis, 0.155 * B, 0.155 * B, 0.045, sp.civ ? mat(0x2a2422) : mBoots, 0, 0.08, 0, { s: [1, 1, 0.72 * D], seg: 16 });
  rbox(pelvis, 0.05, 0.05, 0.03, 0.012, sp.civ ? mat(0xc9ccd2) : mTrim, 0, 0.08, -0.12 * D, { outline: false });
  sph(spine, 0.5, mMain, 0, spineLen * 0.5 + 0.02, 0, { s: [0.27 * B, 0.24 + spineLen * 0.4, 0.2 * D] });
  sph(chest, 0.5, mMain, 0, chestLen * 0.42, 0, { s: [shX * 2 * 1.08, chestLen * 1.15, 0.27 * D], seg: 16 });
  cyl(neck, 0.055, 0.065, 0.1, skin, 0, 0.0, 0, { outline: false });

  // ---------- face
  const face = node(head, 0, headC, 0);
  sph(face, HR, skin, 0, 0, 0, { seg: 20 });
  const eyeParts = [];
  for (const sx of [-1, 1]) {
    const ex = sx * HR * 0.38, ey = HR * 0.06, es = HR * 0.19 * sp.eye;
    const eg = node(face, ex, ey, -HR * 0.86);
    sph(eg, es, white, 0, 0, 0, { s: [0.95, 1.2, 0.6], seg: 10, outline: false });
    sph(eg, es * 0.62, mat(0x161320), sx * 0.003, -0.002, -es * 0.28, { s: [1, 1.2, 0.5], seg: 8, outline: false });
    sph(eg, es * 0.2, white, -es * 0.2, es * 0.35, -es * 0.5, { seg: 6, outline: false });
    eyeParts.push(eg);
    const br = rbox(face, HR * 0.4, HR * 0.07, 0.03, 0.01, mat(0x3a2a22), ex, ey + es * 1.6 + 0.012, -HR * 0.86, { outline: false });
    br.rotation.z = -sx * sp.brow; br.rotation.x = 0.2; br.userData.brow = true;
  }
  const mm = mat(0x7a2e2e);
  if (sp.mouth === 'smile' || sp.mouth === 'grin') {
    const m = torus(face, HR * 0.2, HR * 0.035, mm, 0, -HR * 0.3, -HR * 0.9, { arc: Math.PI, seg: 10 }); m.rotation.z = Math.PI; m.scale.y = sp.mouth === 'grin' ? 1.3 : 0.9;
    if (sp.mouth === 'grin') rbox(face, HR * 0.3, HR * 0.07, 0.01, 0.005, white, 0, -HR * 0.36, -HR * 0.93, { outline: false });
  } else if (sp.mouth === 'smirk') { const m = rbox(face, HR * 0.34, HR * 0.07, 0.02, 0.01, mm, HR * 0.05, -HR * 0.42, -HR * 0.93, { outline: false }); m.rotation.z = 0.25; }
  else rbox(face, HR * 0.3, HR * 0.06, 0.02, 0.01, mat(0x5a2a2a), 0, -HR * 0.44, -HR * 0.93, { outline: false });
  sph(face, HR * 0.09, skin, 0, -HR * 0.14, -HR * 0.98, { seg: 8, outline: false });
  for (const sx of [-1, 1]) sph(face, HR * 0.17, skin, sx * HR * 0.97, -HR * 0.02, 0.01, { s: [0.5, 1, 0.8], seg: 8, outline: false });

  // ---------- per-character headgear / outfit
  const dangles = [];
  const dangle = (nd, amp, freq, ph = 0) => dangles.push({ nd, amp, freq, ph });
  // ---- legend helpers: hair caps (tilted back = hairline on the forehead, nape at the back), jaw shells, glasses, conference badge
  const hairCap = (m, tilt = 0.45, r = 1.07, phi = 0.56, dy = 0.04, dz = 0.03, sc = [1, 1, 1]) => sph(head, HR * r, m, 0, headC + HR * dy, HR * dz, { phi: Math.PI * phi, rot: [tilt, 0, 0], s: sc, seg: 18 });
  const shell = (par, r, m, th0, th1, x, y, z, o = {}) => { const g = new THREE.SphereGeometry(r, 16, 8, Math.PI * (o.p0 ?? 1), Math.PI * (o.pl ?? 1), Math.PI * th0, Math.PI * (th1 - th0)); geos.push(g); return add(par, g, m, x, y, z, { outline: false, ...o }); };
  function glasses(frame, shape = 'round', o = {}) {
    const gz = -HR * 1.0, gy = HR * 0.07, R = HR * (o.size ?? 0.25), t = HR * (o.thick ?? 0.035);
    for (const sx of [-1, 1]) {
      const cx = sx * HR * 0.38;
      if (o.lens != null) { const ln = sph(face, R, mat(o.lens), cx, gy - (shape === 'aviator' ? HR * 0.03 : 0), gz + 0.004, { s: [shape === 'aviator' ? 1.12 : 1, shape === 'aviator' ? 1.0 : 0.9, 0.3], seg: 12, outline: false }); ln.userData.lens = true; }
      if (shape === 'rect') { const w = R * 2.3, h = R * 1.55; rbox(face, w, t, t, t * 0.4, frame, cx, gy + h / 2, gz, { outline: false }); rbox(face, w, t, t, t * 0.4, frame, cx, gy - h / 2, gz, { outline: false }); for (const ex of [-1, 1]) rbox(face, t, h, t, t * 0.4, frame, cx + ex * w / 2, gy, gz, { outline: false }); }
      else torus(face, R, t * 0.5, frame, cx, gy, gz, { seg: 18 });
      rbox(face, 0.012, 0.012, HR * 0.95, 0.005, frame, sx * HR * 0.86, gy + HR * 0.04, -HR * 0.5, { outline: false, rot: [0, sx * 0.12, 0] });   // temple arms
    }
    rbox(face, HR * 0.22, t * 0.8, t * 0.8, t * 0.3, frame, 0, gy + HR * 0.04, gz, { outline: false });
  }
  function badge() {   // conference lanyard + badge in the team colour: tells teams apart at a glance
    const strap = mat(0x22252e), cz = -0.135 * D;
    for (const sx of [-1, 1]) rbox(chest, 0.022, chestLen * 0.5, 0.012, 0.005, mAcc, sx * 0.055, chestLen * 0.7, cz - 0.01, { outline: false, rot: [-0.12, 0, sx * 0.22] });
    rbox(chest, 0.1, 0.13, 0.014, 0.012, white, 0, chestLen * 0.37, cz - 0.022, { ot: 0.008 });
    rbox(chest, 0.1, 0.045, 0.016, 0.01, mAcc, 0, chestLen * 0.415, cz - 0.026, { outline: false });
    rbox(chest, 0.035, 0.035, 0.016, 0.006, strap, -0.02, chestLen * 0.345, cz - 0.026, { outline: false });
    for (let i = 0; i < 2; i++) rbox(chest, 0.03, 0.007, 0.016, 0.003, strap, 0.022, chestLen * (0.355 - i * 0.03), cz - 0.026, { outline: false });
  }
  const collarRing = (m, r = 0.074, h = 0.1, y = 0.0) => cyl(neck, r, r + 0.01, h, m, 0, y, 0, { seg: 16 });
  const extras = {
    // Steve Jobs: black mock turtleneck, jeans, grey sneakers, round rimless glasses, receding salt-and-pepper hair, stubble
    jobs() {
      const hair = mat(0x6b6966), beard = mat(0x75716c);
      hairCap(hair, 0.85, 1.05, 0.6, 0.0, 0.05);
      shell(face, HR * 1.025, beard, 0.64, 0.98, 0, 0, 0, { p0: 0.95, pl: 1.1 });
      rbox(face, HR * 0.42, HR * 0.08, 0.03, 0.015, beard, 0, -HR * 0.24, -HR * 0.92, { outline: false });
      glasses(mat(0xb8bdc6), 'round', { size: 0.27, thick: 0.03 });
      collarRing(mMain, 0.078, 0.12, 0.0);
      badge();
    },
    // Mark Zuckerberg: heather grey tee, jeans, short curly hair, a gold chain (2024 era)
    zuck() {
      const hair = mat(0x5e4129);
      hairCap(hair, 0.42, 1.06, 0.55, 0.06, 0.03);
      for (let i = 0; i < 9; i++) { const a = -1.15 + i * (2.3 / 8); sph(head, HR * 0.17, hair, Math.sin(a) * HR * 0.93, headC + HR * (0.48 + 0.05 * Math.cos(a * 2)), -Math.cos(a) * HR * 0.86, { seg: 8, outline: false }); }
      for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; sph(head, HR * 0.2, hair, Math.sin(a) * HR * 0.5, headC + HR * 0.98, -Math.cos(a) * HR * 0.35 + HR * 0.1, { seg: 8, outline: false }); }
      torus(neck, 0.07, 0.009, mat(0xffcf4d), 0, -0.035, -0.012, { rot: [Math.PI / 2 - 0.35, 0, 0], seg: 18 });
      torus(neck, 0.064, 0.012, mMain, 0, -0.05, 0, { rot: [Math.PI / 2, 0, 0], seg: 16 });
      badge();
    },
    // Sam Altman: navy crewneck sweater, dark jeans, white sneakers, short brown hair with a side part
    altman() {
      const hair = mat(0x4a3426);
      hairCap(hair, 0.4, 1.05, 0.55, 0.05, 0.03);
      sph(head, HR * 0.55, hair, -HR * 0.25, headC + HR * 0.72, -HR * 0.55, { s: [1.3, 0.42, 0.75], rot: [0.2, 0, 0.18], seg: 12, outline: false });
      torus(neck, 0.07, 0.02, mMain, 0, -0.04, 0, { rot: [Math.PI / 2, 0, 0], seg: 16 });
      badge();
    },
    // Elon Musk: black tee with an X, black jeans and boots, thick swept-back dark hair
    musk() {
      const hair = mat(0x2e241c);
      hairCap(hair, 0.62, 1.1, 0.58, 0.1, 0.06, [1.02, 1.05, 1.08]);
      sph(head, HR * 0.6, hair, 0, headC + HR * 0.9, -HR * 0.12, { s: [1.35, 0.5, 1.1], rot: [0.35, 0, 0], seg: 12, outline: false });
      const xm = mat(0xf2f2f2); for (const r of [0.75, -0.75]) rbox(chest, 0.018, 0.12, 0.012, 0.004, xm, 0.06, chestLen * 0.62, -0.14 * D, { outline: false, rot: [0, 0, r] });
      torus(neck, 0.072, 0.014, mMain, 0, -0.05, 0, { rot: [Math.PI / 2, 0, 0], seg: 16 });
      badge();
    },
    // Jeff Bezos: bald, gold aviators, navy puffer vest over a light blue shirt, big laugh
    bezos() {
      glasses(mat(0xd9b24a), 'aviator', { size: 0.27, thick: 0.03, lens: 0x14181f });
      for (let i = 0; i < 3; i++) for (const z of [-1, 1]) rbox(chest, shX * 2.05, 0.012, 0.03, 0.006, mat(0x172036), 0, chestLen * (0.2 + i * 0.25), z * 0.128 * D, { outline: false });
      rbox(chest, 0.014, chestLen * 0.85, 0.02, 0.005, mat(0xc9ccd2), 0, chestLen * 0.42, -0.14 * D, { outline: false });
      const shirt = mat(0x9cc3e6); for (const sx of [-1, 1]) rbox(neck, 0.07, 0.05, 0.02, 0.01, shirt, sx * 0.045, 0.0, -0.07, { rot: [-0.3, 0, sx * 0.7] });
      collarRing(mMain, 0.08, 0.06, -0.04);
      badge();
    },
    // Jensen Huang: black leather jacket, black tee and jeans, swept-back silver hair, dark rectangular glasses
    jensen() {
      const hair = mat(0x9da3ab), lap = mat(0x15110f), zip = mat(0xc9ccd2);
      hairCap(hair, 0.32, 1.09, 0.57, 0.08, 0.05, [1.02, 1.03, 1.06]);
      sph(head, HR * 0.6, hair, 0, headC + HR * 0.75, -HR * 0.2, { s: [1.3, 0.48, 1.15], rot: [0.3, 0, 0], seg: 12, outline: false });
      glasses(mat(0x22222a), 'rect', { size: 0.22, thick: 0.045 });
      for (const sx of [-1, 1]) rbox(chest, 0.1, chestLen * 0.55, 0.03, 0.012, lap, sx * 0.075, chestLen * 0.7, -0.125 * D, { rot: [0, 0, sx * 0.32] });
      for (const sx of [-1, 1]) rbox(neck, 0.08, 0.07, 0.02, 0.012, mMain, sx * 0.06, 0.0, -0.02, { rot: [0, sx * 0.5, sx * 0.4] });
      rbox(chest, 0.012, chestLen * 0.7, 0.02, 0.004, zip, 0.03, chestLen * 0.35, -0.14 * D, { outline: false });
      badge();
    },
    // Bill Gates: blue-grey V-neck sweater over a light blue collared shirt, khakis, rectangular glasses, sandy side part
    gates() {
      const hair = mat(0x9c8a74), shirt = mat(0xbfd9f2);
      hairCap(hair, 0.42, 1.05, 0.55, 0.04, 0.03);
      sph(head, HR * 0.5, hair, HR * 0.3, headC + HR * 0.7, -HR * 0.6, { s: [1.35, 0.4, 0.7], rot: [0.25, 0, -0.2], seg: 12, outline: false });
      glasses(mat(0x7a7d85), 'rect', { size: 0.24, thick: 0.03 });
      rbox(chest, 0.09, 0.13, 0.02, 0.012, shirt, 0, chestLen * 0.86, -0.115 * D, { rot: [0.2, 0, 0], outline: false });
      for (const sx of [-1, 1]) rbox(neck, 0.065, 0.05, 0.018, 0.01, shirt, sx * 0.04, -0.01, -0.07, { rot: [-0.3, 0, sx * 0.75] });
      badge();
    },
    // Lisa Su: deep red blazer over a black top, black slacks, sleek black bob with a fringe
    lisa() {
      const hair = mat(0x16141a), top = mat(0x1b1b22), lap = mat(0x7e1828);
      hairCap(hair, 0.28, 1.08, 0.6, 0.06, 0.04);
      for (const sx of [-1, 1]) sph(head, HR * 0.72, hair, sx * HR * 0.74, headC - HR * 0.22, HR * 0.12, { s: [0.42, 1.05, 1.1], seg: 12 });
      sph(head, HR * 0.95, hair, 0, headC - HR * 0.25, HR * 0.45, { s: [1.05, 0.9, 0.6], seg: 12, outline: false });
      rbox(face, HR * 1.55, HR * 0.3, HR * 0.4, HR * 0.12, hair, 0, HR * 0.6, -HR * 0.68, { rot: [-0.35, 0, 0], outline: false });
      rbox(chest, 0.1, chestLen * 0.5, 0.02, 0.01, top, 0, chestLen * 0.72, -0.125 * D, { outline: false });
      for (const sx of [-1, 1]) rbox(chest, 0.07, chestLen * 0.55, 0.025, 0.01, lap, sx * 0.06, chestLen * 0.68, -0.13 * D, { rot: [0, 0, sx * 0.3] });
      collarRing(top, 0.066, 0.05, -0.03);
      badge();
    },
    bruno() {
      const hair = mat(0x3d2618);
      sph(head, HR * 1.1, mAcc, 0, headC + HR * 0.05, 0.01, { phi: Math.PI * 0.52, s: [1, 0.95, 1.02], seg: 18 });
      cyl(head, HR * 1.12, HR * 1.12, HR * 0.34, mTrim, 0, headC + HR * 0.4, 0.01, { seg: 18, s: [1, 1, 1.02] });
      sph(head, HR * 0.24, mTrim, 0, headC + HR * 1.18, 0.01, { seg: 10 });
      sph(face, HR * 0.78, hair, 0, -HR * 0.6, -HR * 0.32, { phi: Math.PI * 0.85, s: [1.02, 0.7, 0.85], seg: 14 });
      rbox(face, HR * 0.62, HR * 0.12, 0.05, 0.02, hair, 0, -HR * 0.3, -HR * 0.86, { outline: false });
      for (const sx of [-1, 1]) sph(chest, 0.1 * B, mAcc, sx * (shX + 0.02), shY + 0.025, 0, { s: [1.05, 0.7, 1.15] });
      rbox(chest, 0.4 * B, chestLen * 0.8, 0.06, 0.03, mPants, 0, chestLen * 0.36, -0.115 * D);
      for (const sx of [-1, 1]) rbox(chest, 0.035, chestLen * 0.85, 0.07, 0.012, mTrim, sx * 0.09 * B, chestLen * 0.4, -0.12 * D, { outline: false });
      for (const sx of [-1, 1]) rbox(chest, 0.1, 0.1, 0.06, 0.02, mAcc, sx * 0.11 * B, chestLen * 0.15, -0.15 * D);
      rbox(chest, 0.3 * B, 0.13, 0.12, 0.04, mPants, 0, chestLen * 0.5, 0.16 * D);
    },
    mimi() {
      const hair = mat(0x8a3b1c);
      sph(head, HR * 1.07, hair, 0, headC + HR * 0.06, 0.035, { phi: Math.PI * 0.62, seg: 18 });
      sph(head, HR * 0.95, hair, 0, headC - HR * 0.1, HR * 0.28, { s: [1.0, 0.95, 0.9], seg: 12 });
      for (let i = -1; i <= 1; i++) cone(face, HR * 0.17, HR * 0.5, hair, i * HR * 0.34, HR * 0.74, -HR * 0.72, { rot: [Math.PI * 0.8, 0, i * 0.35], outline: false });
      torus(head, HR * 1.01, HR * 0.05, mAcc, 0, headC + HR * 0.28, 0, { rot: [Math.PI / 2 - 0.15, 0, 0] });
      const gg = node(face, 0, HR * 0.62, -HR * 0.78); gg.rotation.x = -0.4;
      for (const sx of [-1, 1]) { cyl(gg, HR * 0.24, HR * 0.24, 0.05, mat(0x2b2b38), sx * HR * 0.34, 0, 0, { rot: [Math.PI / 2, 0, 0] }); cyl(gg, HR * 0.17, HR * 0.17, 0.056, glow(0x9ef0ff), sx * HR * 0.34, 0, -0.004, { rot: [Math.PI / 2, 0, 0], outline: false }); }
      const pt = node(head, 0, headC + HR * 0.15, HR * 0.95); const p1 = node(pt); caps(p1, 0.055, 0.12, hair, 0, -0.11, 0.03, { rot: [0.3, 0, 0] });
      const p2 = node(p1, 0, -0.2, 0.06); caps(p2, 0.05, 0.12, hair, 0, -0.1, 0, {}); sph(p2, 0.04, mAcc, 0, 0.0, 0.0, { seg: 8 });
      dangle(p1, 0.5, 5, 0); dangle(p2, 0.45, 6, 1);
      rbox(chest, 0.52 * B * 0.7, 0.07, 0.34 * D, 0.025, mAcc, 0, chestLen * 0.45, 0.0, { rot: [0, 0, -0.75] });
      for (let i = 0; i < 3; i++) rbox(chest, 0.04, 0.07, 0.04, 0.01, mTrim, (i - 1) * 0.085, chestLen * 0.45 - (i - 1) * 0.085, -0.14 * D, { outline: false, rot: [0, 0, -0.75] });
      rbox(chest, 0.2, 0.17, 0.08, 0.03, mAcc, 0, chestLen * 0.1, 0.15 * D);
    },
    otto() {
      cyl(head, HR * 1.2, HR * 1.28, HR * 1.35, mAcc, 0, headC + HR * 0.18, 0, { seg: 20 });
      sph(head, HR * 1.2, mAcc, 0, headC + HR * 0.84, 0, { phi: Math.PI * 0.5, seg: 20 });
      cyl(head, HR * 1.42, HR * 1.42, 0.03, mTrim, 0, headC - HR * 0.52, 0, { seg: 20 });
      rbox(face, HR * 1.35, HR * 0.4, 0.1, 0.03, dark, 0, HR * 0.1, -HR * 1.06);
      for (const sx of [-1, 1]) { const vg = rbox(face, HR * 0.4, HR * 0.1, 0.02, 0.01, glow(0x7fe8ff), sx * HR * 0.33, HR * 0.1, -HR * 1.13, { outline: false }); vg.name = 'visorGlow'; }
      rbox(face, 0.05, HR * 0.9, 0.05, 0.02, mTrim, 0, HR * 0.55, -HR * 1.12);
      cyl(head, 0.012, 0.012, 0.2, dark, HR * 1.22, headC + HR * 0.3, 0.04, { seg: 6 });
      for (const e of eyeParts) e.visible = false;
      face.children.forEach((c) => { if (c.userData.brow) c.visible = false; });
      for (const sx of [-1, 1]) { sph(chest, 0.14 * B, mAcc, sx * (shX + 0.03), shY, 0, { s: [1.05, 0.8, 1.2] }); cyl(chest, 0.12 * B, 0.13 * B, 0.03, mTrim, sx * (shX + 0.05), shY + 0.07, 0, { s: [1, 1, 1.2], outline: false }); }
      rbox(chest, 0.46 * B * 0.8, chestLen * 0.9, 0.07, 0.04, mAcc, 0, chestLen * 0.38, -0.14 * D);
      rbox(chest, 0.2, 0.16, 0.03, 0.02, mTrim, 0, chestLen * 0.45, -0.19 * D, { outline: false });
      rbox(chest, 0.4 * B * 0.8, chestLen * 0.9, 0.16, 0.05, mPants, 0, chestLen * 0.35, 0.2 * D);
    },
    zed() {
      const hoodDark = mat(0x151a24), maskM = mat(0x1c2230);
      sph(head, HR * 1.18, mMain, 0, headC + HR * 0.02, HR * 0.1, { phi: Math.PI * 0.72, s: [1, 1.06, 1.1], seg: 18 });
      sph(head, HR * 0.9, hoodDark, 0, headC - HR * 0.4, HR * 0.4, { s: [1, 0.9, 0.85], seg: 12, outline: false });
      cone(head, HR * 0.55, HR * 0.9, mMain, 0, headC + HR * 0.1, HR * 1.3, { rot: [Math.PI / 2 + 0.35, 0, 0] });
      rbox(face, HR * 1.7, HR * 0.78, HR * 0.2, 0.03, maskM, 0, -HR * 0.55, -HR * 0.8, { outline: false });
      sph(face, HR * 0.1, mAcc, 0, -HR * 0.55, -HR * 1.0, { seg: 6, outline: false });
      cyl(face, HR * 0.34, HR * 0.34, 0.06, hoodDark, HR * 0.38, HR * 0.05, -HR * 0.82, { rot: [Math.PI / 2, 0, 0] });
      const lens = cyl(face, HR * 0.24, HR * 0.24, 0.066, glow(0x6af0ff), HR * 0.38, HR * 0.05, -HR * 0.86, { rot: [Math.PI / 2, 0, 0], outline: false }); lens.name = 'lens';
      rbox(face, HR * 1.9, HR * 0.07, 0.03, 0.01, hoodDark, 0, HR * 0.05, -HR * 0.55, { outline: false });
      torus(neck, 0.1, 0.045, mAcc, 0, -0.02, 0, { rot: [Math.PI / 2, 0, 0], outline: true });
      const sc = node(neck, -0.07, -0.05, 0.06);
      const s1 = node(sc); rbox(s1, 0.09, 0.28, 0.025, 0.012, mAcc, 0, -0.14, 0); const s2 = node(s1, 0, -0.28, 0); rbox(s2, 0.09, 0.22, 0.025, 0.012, mAcc, 0, -0.11, 0);
      dangle(s1, 0.35, 4, 0); dangle(s2, 0.4, 5, 1);
      for (const sx of [-1, 1]) { const c0 = node(hips, sx * 0.1, -0.03, 0.04); const c1 = node(c0); rbox(c1, 0.17 * B * 1.5, 0.36, 0.03, 0.015, mMain, 0, -0.18, 0.0); dangle(c1, 0.4, 3.5, sx); }
      rbox(chest, 0.1, 0.16, 0.09, 0.03, mAcc, 0.0, chestLen * 0.1, 0.17 * D);
      for (const sx of [-1, 1]) rbox(chest, 0.09 * B, 0.12, 0.06, 0.025, mAcc, sx * shX * 0.55, chestLen * 0.25, -0.13 * D);
    },
    pip() {
      const hn = node(head, 0, headC + HR * 0.12, 0); hn.rotation.set(0.1, 0, -0.12);
      sph(hn, HR * 1.28, mAcc, 0, 0.0, 0.0, { phi: Math.PI * 0.62, seg: 20, s: [1, 0.95, 1.02] });
      torus(hn, HR * 1.2, HR * 0.07, mTrim, 0, -HR * 0.28, 0, { rot: [Math.PI / 2, 0, 0], seg: 20, outline: true });
      cyl(hn, HR * 0.5, HR * 0.5, 0.02, white, 0, HR * 0.5, -HR * 1.02, { rot: [Math.PI / 2 - 0.42, 0, 0], outline: false });
      rbox(hn, 0.03, HR * 0.9, 0.03, 0.01, mat(0x5a4636), HR * 0.95, -HR * 0.6, -0.01, { outline: false });
      rbox(hn, 0.03, HR * 0.9, 0.03, 0.01, mat(0x5a4636), -HR * 0.95, -HR * 0.6, -0.01, { outline: false });
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) sph(face, 0.009, mat(0xc4875a), sx * (HR * 0.52 + i * 0.016), -HR * 0.2 - (i % 2) * 0.014, -HR * 0.8, { seg: 5, outline: false });
      rbox(chest, 0.34 * B, chestLen * 1.0, 0.2, 0.06, mAcc, 0, chestLen * 0.35, 0.24 * D);
      cyl(chest, 0.065, 0.065, 0.44 * B, mTrim, 0, chestLen * 0.98, 0.26 * D, { rot: [0, 0, Math.PI / 2], seg: 10 });
      rbox(chest, 0.2, 0.14, 0.06, 0.03, mTrim, 0, chestLen * 0.2, 0.37 * D);
      for (const sx of [-1, 1]) rbox(chest, 0.04, chestLen * 0.9, 0.02, 0.01, mTrim, sx * 0.1 * B, chestLen * 0.4, -0.125 * D, { outline: false });
    },
    rex() {
      torus(head, HR * 1.0, HR * 0.07, mat(0x14161d), 0, headC + HR * 0.36, 0, { rot: [Math.PI / 2 - 0.12, 0, 0], seg: 18, outline: true });
      const mh = node(head, 0, headC + HR * 0.72, 0);
      for (let i = 0; i < 6; i++) { const t = i / 5, a = lerp(-0.9, 0.9, t); cone(mh, HR * (0.2 - 0.02 * Math.abs(t - 0.5)), HR * (0.9 - 0.25 * Math.abs(t - 0.45)), mAcc, 0, Math.cos(a) * HR * 0.3, Math.sin(a) * HR * 0.85, { rot: [-a * 0.85, 0, 0], seg: 6 }); }
      const sg = mat(0x0c0c14);
      for (const sx of [-1, 1]) rbox(face, HR * 0.62, HR * 0.36, 0.05, 0.03, sg, sx * HR * 0.38, HR * 0.06, -HR * 0.92);
      rbox(face, HR * 0.22, HR * 0.07, 0.04, 0.015, sg, 0, HR * 0.1, -HR * 0.94, { outline: false });
      for (const sx of [-1, 1]) rbox(face, HR * 0.2, HR * 0.05, 0.01, 0.008, white, sx * HR * 0.46, HR * 0.17, -HR * 0.99, { outline: false, rot: [0, 0, 0.5] });
      cone(face, HR * 0.13, HR * 0.28, mat(0x2a1a12), 0, -HR * 0.72, -HR * 0.78, { rot: [Math.PI, 0, 0], outline: false });
      torus(face, 0.025, 0.007, mat(0xffd54a), HR * 1.0, -HR * 0.22, 0, { rot: [0, Math.PI / 2, 0] });
      torus(chest, 0.11, 0.012, mat(0xdddddd), 0, chestLen * 0.78, -0.05, { rot: [Math.PI / 2 - 0.5, 0, 0], seg: 12 });
      rbox(chest, 0.2 * B, chestLen * 0.7, 0.05, 0.02, mTrim, 0, chestLen * 0.3, -0.135 * D, { outline: false });
      for (const sx of [-1, 1]) cone(chest, 0.03, 0.08, mat(0xbfc4d0), sx * (shX + 0.02), shY + 0.08, 0, { seg: 5, outline: false });
      rbox(chest, 0.34 * B, chestLen * 0.85, 0.07, 0.03, mMain, 0, chestLen * 0.4, 0.17 * D);
    },
  };
  extras[id]();
  const bareArms = id === 'rex', rolled = id === 'mimi' || id === 'pip', short = sp.sleeve === 'short', armM = sp.armC != null ? mat(sp.armC) : mMain;

  // ---------- arms
  const armU = sp.arm * 0.47, armF = sp.arm * 0.53, armRad = 0.052 * Math.sqrt(B);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = node(chest, sx * shX, shY, 0);
    const up = node(sh), fo = node(up, 0, -armU, 0), hand = node(fo, 0, -armF, 0);
    sph(sh, armRad * 1.25, armM, 0, 0, 0, { seg: 10, outline: false });
    limb(up, armU, armRad * 1.1, bareArms || short ? skin : armM);
    limb(fo, armF, armRad * 0.95, bareArms || rolled || short ? skin : armM);
    if (short) cyl(up, armRad * 1.4, armRad * 1.32, armU * 0.48, armM, 0, -armU * 0.2, 0, { seg: 12 });   // T-shirt sleeve
    else if (!sp.civ || rolled) cyl(fo, armRad * 1.12, armRad * 1.12, 0.05, rolled ? mMain : mGloves, 0, -armF * 0.62, 0, { seg: 10 });
    if (sp.civ && sx < 0) cyl(up, armRad * (short ? 1.46 : 1.22), armRad * (short ? 1.4 : 1.18), 0.05, mAcc, 0, -armU * (short ? 0.36 : 0.42), 0, { seg: 12 });   // team armband (left arm)
    if (bareArms) cyl(fo, armRad * 1.2, armRad * 1.2, 0.045, mAcc, 0, -armF * 0.78, 0, { seg: 8 });
    rbox(hand, 0.082, 0.085, 0.1, 0.03, mGloves, 0, 0.0, 0.0);
    arms.push({ sx, sh, up, fo, hand });
  }

  // ---------- legs
  const legs = [], legRad = 0.075 * Math.sqrt(B);
  for (const sx of [-1, 1]) {
    const hp = node(hips, sx * 0.1 * B, -0.01, 0);
    const th = node(hp), sh = node(th, 0, -L1, 0), ft = node(sh, 0, -L2, 0);
    limb(th, L1 + 0.02, legRad * 1.08, mPants);
    limb(sh, L2 + 0.02, legRad * 0.92, mPants);
    if (!sp.civ) sph(sh, legRad * 0.8, mAcc, 0, 0.02, -legRad * 0.85, { s: [1.0, 0.9, 0.5], seg: 8, outline: false });
    cyl(sh, legRad * 1.05, legRad * 1.0, 0.12, mBoots, 0, -L2 + 0.09, 0, { seg: 10 });
    rbox(ft, 0.12 * Math.sqrt(B), 0.1, 0.27, 0.04, mBoots, 0, -0.03, -0.055);
    rbox(ft, 0.115 * Math.sqrt(B), 0.03, 0.28, 0.012, mTrim, 0, -0.07, -0.055, { outline: false });
    if (sp.civ) rbox(ft, 0.125 * Math.sqrt(B), 0.025, 0.16, 0.01, mAcc, 0, -0.01, -0.07, { outline: false });   // team stripe on the sneaker
    if (id === 'rex' || id === 'otto') rbox(th, 0.12, 0.14, 0.12, 0.04, mAcc, 0, -L1 * 0.55, 0.0, { outline: false });
    legs.push({ sx, hp, th, sh, ft });
  }

  // ---------- weapon
  const weapon = node(chest);
  const wmodels = {};
  const gunMat = mat(0x2b2f3a), gunHi = mat(0x4a5163);
  function buildGun(kind) {
    const g = node(weapon); g.visible = false;
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false });
    const o = { g, mag: null, gripR: new V3(0, -0.07, 0.06), gripL: new V3(0, -0.04, -0.24), muzzle: new V3(0, 0.02, -0.5), magRest: new V3() };
    if (kind === 'pistol') {
      rbox(g, 0.05, 0.065, 0.26, 0.02, mat(0x5ad1ff), 0, 0.02, -0.07);
      rbox(g, 0.045, 0.11, 0.06, 0.02, gunMat, 0, -0.05, 0.03, { rot: [0.25, 0, 0] });
      o.mag = rbox(g, 0.035, 0.07, 0.05, 0.01, gunHi, 0, -0.1, 0.045, { rot: [0.25, 0, 0], outline: false });
      o.gripR.set(0.0, -0.07, 0.04); o.gripL.set(0.0, -0.075, 0.02); o.muzzle.set(0, 0.025, -0.21);
    } else if (kind === 'sniper') {
      rbox(g, 0.055, 0.075, 0.64, 0.025, mat(0x9affc4), 0, 0, -0.13);
      cyl(g, 0.016, 0.016, 0.5, gunMat, 0, 0.01, -0.68, { rot: [Math.PI / 2, 0, 0], seg: 8, outline: false });
      rbox(g, 0.05, 0.12, 0.24, 0.03, gunMat, 0, -0.03, 0.3);
      cyl(g, 0.035, 0.035, 0.28, gunHi, 0, 0.095, -0.12, { rot: [Math.PI / 2, 0, 0], seg: 10 });
      cyl(g, 0.045, 0.045, 0.04, gunMat, 0, 0.095, -0.28, { rot: [Math.PI / 2, 0, 0], seg: 10, outline: false });
      o.mag = rbox(g, 0.04, 0.09, 0.06, 0.012, gunHi, 0, -0.07, -0.02, { outline: false });
      o.gripR.set(0, -0.08, 0.1); o.gripL.set(0, -0.055, -0.3); o.muzzle.set(0, 0.01, -0.95);
    } else {
      rbox(g, 0.065, 0.09, 0.4, 0.025, mat(0xffb347), 0, 0, -0.1);
      cyl(g, 0.018, 0.018, 0.3, gunMat, 0, 0.01, -0.45, { rot: [Math.PI / 2, 0, 0], seg: 8, outline: false });
      rbox(g, 0.045, 0.1, 0.06, 0.02, gunMat, 0, -0.08, 0.1, { rot: [0.3, 0, 0] });
      rbox(g, 0.06, 0.08, 0.2, 0.025, gunMat, 0, -0.005, 0.28);
      o.mag = rbox(g, 0.04, 0.16, 0.07, 0.015, gunHi, 0, -0.12, -0.04, { rot: [-0.2, 0, 0], outline: false });
      rbox(g, 0.02, 0.03, 0.03, 0.008, gunHi, 0, 0.065, -0.3, { outline: false });
      o.gripR.set(0, -0.085, 0.09); o.gripL.set(0, -0.06, -0.3); o.muzzle.set(0, 0.012, -0.62);
    }
    o.magRest.copy(o.mag.position);
    const fl = new THREE.Group(); fl.position.copy(o.muzzle); fl.visible = false;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), flashMat); c.rotation.x = -Math.PI / 2; c.position.z = -0.08; fl.add(c);
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), flashMat); fl.add(p1); const p2 = p1.clone(); p2.rotation.z = Math.PI / 4; fl.add(p2);
    g.add(fl); o.flash = fl; geos.push(c.geometry, p1.geometry); allMats.push(flashMat); flashMat.emissive = null;
    return o;
  }
  const wkind = (w) => { const c = weaponClass(w); return c === 'pistol' || c === 'hpistol' ? 'pistol' : c === 'sniper' ? 'sniper' : 'machinegun'; };   // every arsenal gun maps to a third-person silhouette
  let curW = null;
  function setWeapon(w) {
    const k = wkind(w); if (curW && curW.kind === k) return;
    if (!wmodels[k]) { wmodels[k] = buildGun(k); wmodels[k].kind = k; }
    if (curW) { curW.g.visible = false; if (curW.g.parent !== weapon) weapon.add(curW.g); }
    curW = wmodels[k]; curW.g.visible = true;
  }
  setWeapon(opts.weapon || (id === 'zed' ? 'sniper' : id === 'pip' ? 'pistol' : 'machinegun'));

  // ---------- hitboxes (invisible meshes riding the bones)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitboxes = [];
  function hb(zone, geo, parent, x, y, z) { geos.push(geo); const m = new THREE.Mesh(geo, hitMat); m.position.set(x, y, z); m.userData.zone = zone; m.userData.charId = id; parent.add(m); hitboxes.push({ zone, object: m }); return m; }
  hb('head', new THREE.SphereGeometry(HR * HZ, 10, 8), head, 0, headC, 0);
  hb('body', new THREE.BoxGeometry(shX * 2 + 0.1, chestLen * 0.95, 0.34 * D), chest, 0, chestLen * 0.42, 0);
  hb('body', new THREE.BoxGeometry(0.3 * B + 0.05, spineLen + 0.12, 0.26 * D), spine, 0, spineLen * 0.5, 0);
  for (const l of legs) { hb('legs', new THREE.CylinderGeometry(legRad * 1.5, legRad * 1.3, L1 + 0.02, 8), l.th, 0, -L1 / 2, 0); hb('legs', new THREE.CylinderGeometry(legRad * 1.3, legRad * 1.4, L2 + 0.08, 8), l.sh, 0, -L2 / 2 - 0.02, 0); }

  // ---------- animation
  const S = { speed: 0, crouched: false, aiming: false, pitch: 0, reloadingPrev: false };
  let t = Math.random() * 10, phase = Math.random() * 6.28, moveS = 0, aimW = 0, crouchW = 0, hitT = 0, hitDir = 1, recoil = 0, flashT = 0, shootHold = 0;
  let reloadP = -1, reloadDur = 1.7, deadT = 0, deadStyle = 'back', isDead = false, flashHit = 0, blinkT = 2 + Math.random() * 3, blink = 0, headYaw = 0, headPitch = 0;
  const wDrop = { v: new V3(), spin: new V3(), active: false };
  const _v = new V3(), _u = new V3(), _perp = new V3(), _E = new V3(), _d1 = new V3(), _d2 = new V3(), _T = new V3(), _S = new V3(), _pole = new V3(), _w = new V3(), _w2 = new V3();
  const q1 = new Q(), q2 = new Q(), qi = new Q(), qW = new Q(), DOWN = new V3(0, -1, 0), eW = new THREE.Euler();

  // 2-bone IK in the parent frame of `upper` (joint at origin); sets quaternions, optionally orients the end node.
  function ik(upper, lower, T0, l1, l2, pole, endDesired, endNode) {
    _u.copy(T0); let d = _u.length(); if (d < 1e-4) { _u.set(0, -1, 0); d = 1e-4; } else _u.divideScalar(d);
    d = clamp(d, 0.06, l1 + l2 - 0.003);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _perp.copy(pole).addScaledVector(_u, -pole.dot(_u)); if (_perp.lengthSq() < 1e-6) _perp.set(1, 0, 0); _perp.normalize();
    _E.copy(_u).multiplyScalar(a).addScaledVector(_perp, h);
    _d1.copy(_E).normalize();
    _d2.copy(_u).multiplyScalar(d).sub(_E).normalize();
    q1.setFromUnitVectors(DOWN, _d1); upper.quaternion.copy(q1);
    q2.setFromUnitVectors(DOWN, _d2); lower.quaternion.copy(qi.copy(q1).invert()).multiply(q2);
    if (endNode && endDesired) endNode.quaternion.copy(qi.copy(q2).invert()).multiply(endDesired);
  }

  function reset() {
    isDead = false; deadT = 0; rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0); reloadP = -1; hitT = 0; recoil = 0; crouchW = 0;
    if (wDrop.active) { weapon.add(curW.g); wDrop.active = false; } curW.g.position.set(0, 0, 0); curW.g.rotation.set(0, 0, 0);
  }
  function killNow(style) {
    if (isDead) return; isDead = true; deadT = 0; reloadP = -1;
    deadStyle = style || ['back', 'back', 'front', 'side'][Math.floor(Math.random() * 4)];
    group.attach(curW.g); wDrop.active = true; curW.flash.visible = false;
    wDrop.v.set((Math.random() - 0.5) * 1.2, 1.4, (Math.random() - 0.5) * 1.2); wDrop.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
  }
  function setAnim(name, o = {}) {
    if (name !== 'death' && name !== 'hit' && name !== 'shoot' && isDead) reset();
    switch (name) {
      case 'idle': S.speed = 0; S.crouched = false; S.aiming = false; break;
      case 'walk': S.speed = o.speed ?? 1.7; S.crouched = false; break;
      case 'run': S.speed = o.speed ?? 4.4; S.crouched = false; break;
      case 'aim': S.aiming = o.on ?? true; break;
      case 'crouch': S.crouched = o.on ?? true; break;
      case 'shoot': if (isDead) break; recoil = Math.min(1.5, recoil + 1); flashT = 0.07; shootHold = 0.9; curW.flash.rotation.z = Math.random() * 6.28; break;
      case 'reload': reloadDur = o.duration ?? 1.7; reloadP = 0; break;
      case 'hit': if (isDead) break; hitT = 1; hitDir = o.dir ?? (Math.random() < 0.5 ? -1 : 1); flashHit = 0.12; break;
      case 'death': killNow(o.style); break;
      case 'revive': reset(); break;
    }
  }

  const poseC = { carry: { p: new V3(0.17, -0.03, -0.25), r: [-0.55, 0.15, 0.05] }, aim: { p: new V3(0.075, 0.17, -0.3), r: [0.02, 0.0, 0.0] }, run: { p: new V3(0.16, -0.08, -0.22), r: [-0.8, 0.15, 0.1] } };
  const wp = new V3();

  function update(dt, state) {
    dt = clamp(dt || 0, 0, 0.05);
    if (state) {
      if (state.speed !== undefined) S.speed = state.speed;
      if (state.crouched !== undefined) S.crouched = !!state.crouched;
      if (state.aiming !== undefined) S.aiming = !!state.aiming;
      if (state.pitch !== undefined) S.pitch = state.pitch;
      if (state.weapon) setWeapon(state.weapon);
      if (state.distance !== undefined) { const on = state.distance < 26; if (on !== outlineOn) { outlineOn = on; for (const o of outlines) o.visible = on; } }
      if (state.team && state.team !== rawTeam) setTeam(state.team);
      if (state.reloading !== undefined) { if (state.reloading && !S.reloadingPrev && reloadP < 0) { reloadP = 0; reloadDur = state.reloadDuration ?? reloadDur; } if (!state.reloading && S.reloadingPrev) reloadP = -1; S.reloadingPrev = !!state.reloading; }
      if (state.alive === false && !isDead) killNow(); else if (state.alive === true && isDead) reset();
    }
    t += dt;
    const k = (r) => 1 - Math.exp(-r * dt);
    shootHold = Math.max(0, shootHold - dt); flashT = Math.max(0, flashT - dt);
    recoil *= Math.exp(-13 * dt); hitT *= Math.exp(-4.2 * dt); flashHit = Math.max(0, flashHit - dt);
    const em = flashHit > 0 ? 0.35 : 0; for (const m of allMats) if (m.emissive) m.emissive.setRGB(em, em, em);
    curW.flash.visible = flashT > 0 && !isDead;
    if (isDead) { updateDeath(dt); return; }

    moveS += (S.speed - moveS) * k(9);
    const reloading = reloadP >= 0;
    if (reloading) { reloadP += dt / reloadDur; if (reloadP >= 1) reloadP = -1; }
    aimW += (((S.aiming || shootHold > 0) && !reloading ? 1 : 0) - aimW) * k(11);
    crouchW += ((S.crouched ? 1 : 0) - crouchW) * k(9);
    const mv = clamp(moveS / 1.1, 0, 1), runW = clamp((moveS - 2.4) / 1.6, 0, 1), spd = clamp(moveS / 4, 0, 1);
    phase += dt * moveS * Math.PI * 2 / 1.5;
    const aimStance = aimW * (1 - mv * 0.7);

    // hips + legs
    const breathe = Math.sin(t * 1.8 + seed);
    hips.position.set(Math.sin(phase) * 0.012 * mv, hipBase - crouchW * legLen * 0.36 + Math.cos(phase * 2) * (0.012 + 0.02 * runW) * mv + breathe * 0.004 - hitT * 0.03, crouchW * 0.02);
    pelvis.rotation.set(0, Math.sin(phase) * 0.18 * mv, Math.sin(phase) * 0.04 * mv);
    for (let i = 0; i < 2; i++) {
      const l = legs[i], ph = phase + (i === 0 ? 0 : Math.PI), A = (0.12 + 0.22 * spd) * mv;
      const fx = l.sx * (0.105 * B + 0.025 * crouchW + 0.03 * aimStance);
      const fz = -Math.cos(ph) * A + (l.sx < 0 ? -0.15 : 0.1) * aimStance + crouchW * (l.sx < 0 ? -0.07 : 0.05);
      const lift = Math.max(0, -Math.sin(ph)) * (0.06 + 0.09 * spd) * mv;
      _T.set(fx - l.sx * 0.1 * B, 0.08 + lift - hips.position.y + 0.01, fz);
      _pole.set(l.sx * 0.15, 0, -1);
      qW.setFromEuler(eW.set(Math.max(0, -Math.sin(ph)) * 0.35 * mv - Math.max(0, Math.sin(ph) - 0.5) * 0.4 * mv, -l.sx * 0.1 * aimStance, 0));
      ik(l.th, l.sh, _T, L1, L2, _pole, qW, l.ft);
    }
    // spine / chest / head
    const lean = -(0.09 * runW + 0.28 * crouchW + 0.03 * mv);
    const twist = 0.3 * aimW * (1 - runW * 0.5) + Math.sin(phase) * 0.16 * mv * (1 - aimW);
    spine.rotation.set(lean * 0.6 + breathe * 0.008 - hitT * 0.1 - recoil * 0.015, twist * 0.5, 0);
    chest.rotation.set(lean * 0.4 + S.pitch * 0.45 - hitT * 0.26 - recoil * 0.03 + breathe * 0.012, twist * 0.5, hitDir * hitT * 0.13 + Math.sin(phase * 2) * 0.01 * mv);
    chest.scale.y = 1 + breathe * 0.012;
    const idleW = (1 - aimW) * (1 - mv);
    const hy = (Math.sin(t * 0.55 + seed) * 0.5 + Math.sin(t * 1.3 + seed * 2) * 0.2) * 0.45 * idleW - twist * 0.9;
    headYaw += (hy - headYaw) * k(8);
    headPitch += ((-lean * 0.32) + S.pitch * 0.4 + Math.sin(t * 0.9 + seed) * 0.05 * idleW + hitT * 0.35 - headPitch) * k(10);
    head.rotation.set(headPitch, headYaw, -hitDir * hitT * 0.1 + aimW * 0.07 + (id === 'pip' ? Math.sin(t * 2 + seed) * 0.03 : 0));
    blinkT -= dt; if (blinkT <= 0) { blink = 0.12; blinkT = 2 + Math.random() * 4; } blink = Math.max(0, blink - dt);
    for (const e of eyeParts) e.scale.y = blink > 0 ? 0.12 : 1;

    // weapon pose (chest space)
    const c = poseC;
    wp.copy(c.carry.p).lerp(c.run.p, runW); wp.lerp(c.aim.p, aimW);
    const wr = [0, 1, 2].map((i) => lerp(lerp(c.carry.r[i], c.run.r[i], runW), c.aim.r[i], aimW));
    wp.y += Math.sin(phase * 2) * 0.012 * mv * (1 - aimW) + breathe * 0.004 + S.pitch * 0.1 * aimW;
    wp.z += recoil * 0.06; wr[0] += recoil * 0.07 + S.pitch * (0.6 * aimW + 0.5 * (1 - aimW));
    wr[2] += Math.sin(phase) * 0.05 * mv * (1 - aimW); wr[1] -= twist * 0.45 * aimW;
    const g = curW; let leftT = null;
    if (reloading) {
      const p = reloadP, w = ease(clamp(p / 0.12, 0, 1)) * (1 - ease(clamp((p - 0.88) / 0.12, 0, 1)));
      wp.lerp(_v.set(0.1, 0.02, -0.2), w); wr[0] = lerp(wr[0], 0.35, w); wr[2] = lerp(wr[2], 0.55, w); wr[1] = lerp(wr[1], -0.15, w);
      const fore = g.gripL, mag = g.magRest, away = _w2.copy(g.magRest).add(_E.set(0.1, -0.2, 0.08));
      const away2 = away.clone();
      let tg = new V3();
      if (p < 0.2) tg.copy(fore).lerp(mag, ease(p / 0.2)); else if (p < 0.4) tg.copy(mag).lerp(away2, ease((p - 0.2) / 0.2));
      else if (p < 0.65) tg.copy(away2).y += Math.sin((p - 0.4) * 30) * 0.015; else if (p < 0.82) tg.copy(away2).lerp(mag, ease((p - 0.65) / 0.17)); else tg.copy(mag).lerp(fore, ease((p - 0.82) / 0.18));
      leftT = tg;
      g.mag.visible = !(p > 0.2 && p < 0.65);
      g.mag.position.copy(g.magRest); if (p > 0.65 && p < 0.82) g.mag.position.y -= (0.82 - p) * 0.5;
    } else { g.mag.visible = true; g.mag.position.copy(g.magRest); }
    g.g.position.copy(wp); g.g.rotation.set(wr[0], wr[1], wr[2]); g.g.updateMatrix();
    // arms: IK to the grips
    for (let i = 0; i < 2; i++) {
      const a = arms[i], right = a.sx > 0;
      _T.copy(right ? g.gripR : (leftT || g.gripL)).applyMatrix4(g.g.matrix).sub(_v.set(a.sx * shX, shY, 0));
      _pole.set(a.sx * 0.9, -1, 0.6);
      qW.copy(g.g.quaternion); if (!right) qW.multiply(qi.setFromEuler(eW.set(0, 0, 0.4)));
      ik(a.up, a.fo, _T, armU, armF, _pole, qW, a.hand);
    }
    // dangly bits
    for (const d of dangles) d.nd.rotation.x = (moveS * 0.1 + Math.sin(t * d.freq + d.ph * 2 + seed) * 0.08 + hitT * 0.4) * d.amp + Math.sin(phase * 2 + d.ph) * 0.04 * mv * d.amp;
    rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
  }

  function updateDeath(dt) {
    deadT += dt;
    const fall = ease(clamp((deadT - 0.04) / 0.7, 0, 1)), buckle = ease(clamp(deadT / 0.35, 0, 1)), sign = deadStyle === 'front' ? -1 : 1;
    for (const l of legs) { _T.set(l.sx * 0.04 * fall, -legLen * (1 - 0.3 * buckle) * 0.99 + 0.0, -0.12 * buckle); _pole.set(0, 0, -1); ik(l.th, l.sh, _T, L1, L2, _pole, qW.identity(), l.ft); }
    hips.position.set(0, hipBase - legLen * 0.28 * buckle, 0);
    if (deadStyle === 'side') { rig.rotation.set(0, 0, -fall * (Math.PI / 2 - 0.1)); rig.position.set(0.0, 0.12 * fall, 0); }
    else { rig.rotation.set(sign * fall * (Math.PI / 2 - 0.08), 0, 0); rig.position.set(0, 0.13 * fall, 0); }
    chest.rotation.set(sign * -0.2 * fall, 0, 0.1 * fall); spine.rotation.set(sign * -0.1 * fall, 0.2 * fall, 0); head.rotation.set(sign * 0.3 * fall, 0.3 * fall, 0.2 * fall); pelvis.rotation.set(0, 0, 0);
    for (const a of arms) { a.up.quaternion.setFromEuler(eW.set(0.3 * fall, 0, a.sx * (0.4 + 0.9 * fall))); a.fo.quaternion.setFromEuler(eW.set(-0.5 * fall, 0, a.sx * 0.3 * fall)); a.hand.quaternion.identity(); }
    for (const e of eyeParts) e.scale.y = 0.12;
    if (wDrop.active) {
      wDrop.v.y -= 9.8 * dt; const g = curW.g; g.position.addScaledVector(wDrop.v, dt);
      if (g.position.y < 0.06) { g.position.y = 0.06; wDrop.v.set(0, 0, 0); wDrop.spin.set(0, 0, 0); }
      g.rotation.x += wDrop.spin.x * dt; g.rotation.y += wDrop.spin.y * dt; g.rotation.z += wDrop.spin.z * dt;
    }
    for (const d of dangles) d.nd.rotation.x = 0.2 * fall;
  }

  function setTeam(tm2) {
    rawTeam = tm2; team = tm2 === 'T' ? 'T' : 'CT'; const zt = tm2 === 'Z';
    for (const m of teamParts) m.color.setHex(pal()[m.userData.slot]);
    group.traverse((o) => { if (o.name === 'visorGlow') o.material = glow(zt ? 0x7dff9a : team === 'CT' ? 0x7fe8ff : 0xff9a4a); });
  }

  // world-space hit zones in hitscan.js format (follow the pose: crouch, lean; [] when dead)
  function hitZones() {
    if (isDead) return [];
    group.updateMatrixWorld(true);
    const hc = head.localToWorld(new V3(0, headC, 0));
    const hipW = hips.getWorldPosition(new V3()), chW = chest.localToWorld(new V3(0, chestLen * 0.85, 0));
    const yaw = group.rotation.y, cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
    const hx = 0.15 * B + shX * 0.6, hz = 0.17 * D, ex = hx * cs + hz * sn + 0.04, ez = hx * sn + hz * cs + 0.04;
    const cx = (hipW.x + chW.x) / 2, cz = (hipW.z + chW.z) / 2, fy = group.position.y;
    const zones = [{ zone: 'head', center: { x: hc.x, y: hc.y, z: hc.z }, radius: HR * HZ },
      { zone: 'body', min: { x: cx - ex, y: hipW.y - 0.1, z: cz - ez }, max: { x: cx + ex, y: Math.max(chW.y, hc.y - HR), z: cz + ez } }];
    for (const l of legs) {
      const a = l.th.getWorldPosition(new V3()), b = l.ft.getWorldPosition(new V3()), r = legRad * 1.6 + 0.02;
      zones.push({ zone: 'legs', min: { x: Math.min(a.x, b.x) - r, y: Math.max(fy, Math.min(a.y, b.y) - 0.05), z: Math.min(a.z, b.z) - r }, max: { x: Math.max(a.x, b.x) + r, y: hipW.y - 0.1, z: Math.max(a.z, b.z) + r } });
    }
    return zones;
  }
  function muzzleWorld(out = new V3()) { group.updateMatrixWorld(true); return curW.g.localToWorld(out.copy(curW.muzzle)); }
  function dispose() { for (const g of geos) g.dispose(); for (const m of allMats) m.dispose(); outlineMat.dispose(); }

  update(0.0001, null);
  const info = ROSTER.find((r) => r.id === id);
  return {
    id, name: info.name, role: info.role, group, update, setAnim, setTeam, setWeapon, hitboxes, hitZones, muzzleWorld, dispose, reset,
    get team() { return team; }, get dead() { return isDead; },
    height: headTop, headRadius: HR, radius: 0.3,
  };
}

/** first-person colours for a legend (gunvm / knifevm setOutfit): bare hands, sleeve = outfit (skin for T-shirts), cuff = team */
export function legendOutfit(id, team) {
  const sp = specs()[id]; if (!sp || !sp.civ) return null; const p = sp.pal[team === 'T' ? 'T' : 'CT'];
  return { sleeve: sp.sleeve === 'short' ? sp.skin : (sp.armC ?? p.main), glove: sp.skin, cuff: p.accent, skin: sp.skin };
}

// ---------------------------------------------------------------- first-person hand + sleeve for viewmodels
// createViewmodelHand(THREE, { sleeve, glove, cuff, skin, side }) -> Group. Origin = palm centre, fingers toward -Z,
// sleeve/forearm extends toward +Z (back to the camera). Drop-in for the old box hand().
export function createViewmodelHand(THREE, o = {}) {
  const L = getLib(THREE);
  const M = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: L.grad });
  const side = o.side === 'left' ? -1 : 1, g = new THREE.Group();
  const add = (geo, m, x, y, z, rot) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); if (rot) me.rotation.set(rot[0], rot[1], rot[2]); g.add(me); return me; };
  const gm = M(o.glove ?? 0x23262f), sm = M(o.sleeve ?? 0x3d6bff), cm = M(o.cuff ?? 0xffd166);
  add(L.rrect(0.056, 0.05, 0.06, 0.016), gm, 0, 0, 0.0);
  for (let i = 0; i < 4; i++) add(L.rrect(0.011, 0.014, 0.05, 0.005), gm, -0.02 + i * 0.0135, 0.0, -0.05, [0.35, 0, 0]);
  add(L.rrect(0.014, 0.018, 0.045, 0.006), gm, side * -0.032, 0.012, -0.03, [0, side * 0.5, 0]);
  add(L.rrect(0.07, 0.066, 0.03, 0.01), cm, 0, 0, 0.055);
  add(L.rrect(0.066, 0.062, 0.34, 0.02), sm, 0, -0.004, 0.23, [0.0, 0, 0]);
  return g;
}
