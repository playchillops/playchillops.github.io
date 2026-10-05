/** KITE GARDEN V4 - an original pastel garden-quarter. Data-driven, drop-in Three.js r160 map module.
 * buildMap(THREE, layout = KITE_GARDEN_V4) -> same public API as v3 (group, lights, colliders, physicsColliders,
 * floors, ramps, getHeight, spawnPoints, bombsites, navGrid, callouts, bounds, sky, dispose) + layout/stairs.
 * All gameplay geometry is axis-aligned boxes, wedges and real stair treads on a 1m grid, so movement.js and
 * hitscan.js see exactly what is drawn. Navigation is single-layer (top surface), like v3: walkable areas never
 * overlap each other (tunnels/doors/windows are fine; roofs are solid and not walkable).
 * No imports, assets or network requests. Meshes are batched per colour. dispose() frees everything.
 */
const PAL = { ground:0x91c990, tile:0xe2d2b4, edge:0xb2c4a0, metal:0x6d8494, roof:0xc48576, cream:0xffedce,
  coral:0xff846e, cyan:0x68e3db, purple:0xc8b3cb, green:0x73b787, gold:0xffda8d, mint:0xa9e0c4, peach:0xffc9a3,
  sky:0x9fd0e8, wood:0xb98b64, lilac:0xd9c4e8, stone:0xcfc6b8, dark:0x4b5b70, rose:0xf2a9b8, brick:0xe39a86 };

export function buildMap(THREE, layout = scaleLayout(KITE_GARDEN_V4)) {
  const L = layout, H = L.half, P = L.plateau;
  const group = new THREE.Group(); group.name = L.name + ' v' + L.version;
  const colliders = [], floors = [], ramps = [], stairsList = [], rampColliders = [], geos = new Set(), mats = new Set(), textures = [];
  const STEP = .34;
  const col = k => (typeof k === 'number' ? k : (PAL[k] ?? PAL.cream));
  const batches = new Map(), matCache = new Map();
  function material(color, basic = false) {
    const key = color + ':' + basic;
    if (!matCache.has(key)) { const m = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, flatShading: true }); matCache.set(key, m); mats.add(m); }
    return matCache.get(key);
  }
  function mesh(g, m, x, y, z, solid = false, name = 'detail') {
    geos.add(g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.userData.solid = solid;
    o.name = name; o.userData.structural = solid; o.userData.breakable = false; o.castShadow = solid; o.receiveShadow = true; group.add(o); return o;
  }
  const vbox = (x0, z0, x1, z1, y0, y1, color, basic = false) => {
    const c = col(color), key = c + (basic ? 'b' : 'l'); let b = batches.get(key);
    if (!b) { b = { c, basic, boxes: [] }; batches.set(key, b); } b.boxes.push([x0, y0, z0, x1, y1, z1]);
  };
  function sbox(x0, z0, x1, z1, y0, y1, color, name = 'wall') {
    vbox(x0, z0, x1, z1, y0, y1, color, false);
    const b = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    b.name = name; b.structural = true; b.breakable = false; colliders.push(b); return b;
  }
  function flushBatches() {
    for (const b of batches.values()) {
      const parts = b.boxes.map(([x0, y0, z0, x1, y1, z1]) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; });
      let nv = 0, ni = 0; for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const g of parts) { pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
        for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; vo += g.attributes.position.count; io += g.index.count; g.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      const m = mesh(g, material(b.c, b.basic), 0, 0, 0, !b.basic, b.basic ? 'detail' : 'structure'); m.castShadow = !b.basic;
    }
  }
  // ---------- ground first (graphics.js re-skins the mesh named 'ground') ----------
  { const g = new THREE.BoxGeometry(2 * H + 6, .55, 2 * H + 6); const o = mesh(g, material(PAL.ground), 0, -.275, 0, false, 'ground'); o.castShadow = false; }

  // ---------- primitives ----------
  function paths(list) { for (const [x0, z0, x1, z1, y = 0] of list) vbox(x0, z0, x1, z1, y + .02, y + .045, 'tile', true); }
  function wall(x0, z0, x1, z1, o = {}) {
    const y0 = o.y0 || 0, h = o.h || 4, c = o.color || 'cream', alongX = (x1 - x0) >= (z1 - z0), a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
    const op = (o.open || []).map(q => ({ a: q[0], b: q[1], sill: q[2] ?? 0, top: q[3] ?? (q[2] > 0 ? 2.3 : 2.7) })).sort((p, q) => p.a - q.a);
    const seg = (a, b, ya, yb) => { if (b - a < .001 || yb - ya < .001) return; if (alongX) sbox(a, z0, b, z1, y0 + ya, y0 + yb, c, o.name || 'wall'); else sbox(x0, a, x1, b, y0 + ya, y0 + yb, c, o.name || 'wall'); };
    let cur = a0;
    for (const q of op) { seg(cur, q.a, 0, h); if (q.sill > 0) seg(q.a, q.b, 0, q.sill); if (q.top < h) seg(q.a, q.b, q.top, h); cur = q.b; }
    seg(cur, a1, 0, h);
    if (o.trim !== false) for (const q of op) { // painted frames, visual only
      const T = .1, e = .07, tc = o.trimColor || 'cream';
      const fr = (a, b, ya, yb) => { if (alongX) vbox(a, z0 - e, b, z1 + e, y0 + ya, y0 + yb, tc, true); else vbox(x0 - e, a, x1 + e, b, y0 + ya, y0 + yb, tc, true); };
      fr(q.a - T, q.b + T, q.top, q.top + .16); fr(q.a - T, q.a, q.sill, q.top); fr(q.b, q.b + T, q.sill, q.top);
      if (q.sill > 0) fr(q.a - T, q.b + T, q.sill - .12, q.sill);
    }
  }
  function building(b) {
    const { x0, z0, x1, z1 } = b, y0 = b.y0 || 0, h = b.h || 4.4, t = 1, c = b.color || 'cream', rc = b.roof || 'roof';
    const side = (k) => [...(b.doors?.[k] || []).map(q => [q[0], q[1], q[2] ?? 0, q[3] ?? 2.7]), ...(b.windows?.[k] || []).map(q => [q[0], q[1], q[2] ?? 1, q[3] ?? 2.3])];
    const o = { y0, h, color: c, name: b.name || 'house wall' };
    wall(x0, z0, x1, z0 + t, { ...o, open: side('N') }); wall(x0, z1 - t, x1, z1, { ...o, open: side('S') });
    wall(x0, z0 + t, x0 + t, z1 - t, { ...o, open: side('W') }); wall(x1 - t, z0 + t, x1, z1 - t, { ...o, open: side('E') });
    for (const w of b.inner || []) wall(w[0], w[1], w[2], w[3], { y0, h, color: c, name: 'interior wall', ...(w[4] || {}) });
    sbox(x0, z0, x1, z1, y0 + h, y0 + h + .35, rc, 'roof');
    vbox(x0 - .35, z0 - .35, x1 + .35, z1 + .35, y0 + h + .35, y0 + h + .5, rc);
    vbox(x0 - .35, z0 - .35, x1 + .35, z0 - .2, y0 + h + .5, y0 + h + .8, 'cream'); vbox(x0 - .35, z1 + .2, x1 + .35, z1 + .35, y0 + h + .5, y0 + h + .8, 'cream');
    vbox(x0 - .35, z0 - .2, x0 - .2, z1 + .2, y0 + h + .5, y0 + h + .8, 'cream'); vbox(x1 + .2, z0 - .2, x1 + .35, z1 + .2, y0 + h + .5, y0 + h + .8, 'cream');
    vbox(x0 + 1, z0 + 1, x1 - 1, z1 - 1, y0 + .004, y0 + .012, b.floor || 'wood', true);
    for (const k of ['N', 'S', 'W', 'E']) for (const q of b.doors?.[k] || []) { // striped awnings above doors, head-height clear
      const a = (q[0] + q[1]) / 2, w = q[1] - q[0] + .6, d = 1.1, ac = b.awning || 'gold';
      if (k === 'N') vbox(a - w / 2, z0 - d, a + w / 2, z0, y0 + 3.0, y0 + 3.15, ac, true); if (k === 'S') vbox(a - w / 2, z1, a + w / 2, z1 + d, y0 + 3.0, y0 + 3.15, ac, true);
      if (k === 'W') vbox(x0 - d, a - w / 2, x0, a + w / 2, y0 + 3.0, y0 + 3.15, ac, true); if (k === 'E') vbox(x1, a - w / 2, x1 + d, a + w / 2, y0 + 3.0, y0 + 3.15, ac, true);
    }
  }
  function mass(m) { // solid block with carved tunnels (corridors are the gaps between rects; ceil rects roof them)
    const h = m.h || 4.4;
    for (const r of m.rects) sbox(r[0], r[1], r[2], r[3], 0, h, m.color || 'cream', m.name || 'tunnel wall');
    for (const r of m.ceil) sbox(r[0], r[1], r[2], r[3], m.ceilY || 3, h, m.color || 'cream', 'tunnel roof');
    for (const r of m.ceil) vbox(r[0], r[1], r[2], r[3], .004, .012, m.floor || 'stone', true);
    for (const r of m.rects) { vbox(r[0] - .25, r[1] - .25, r[2] + .25, r[3] + .25, h, h + .15, m.roof || 'roof'); }
  }
  function block(x0, z0, x1, z1, h, color = 'edge', top = 'tile', name = 'terrace') {
    sbox(x0, z0, x1, z1, 0, h, color, name); floors.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: h });
    vbox(x0, z0, x1, z1, h + .005, h + .03, top, true);
  }
  function ramp(x0, z0, x1, z1, axis, yMin, yMax, color = 'purple') {
    const low = Math.min(yMin, yMax), high = Math.max(yMin, yMax), a = axis === 'x';
    const tp = (x, z) => { const t = a ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0); return yMin + (yMax - yMin) * t; };
    const V = [[x0, low, z0], [x1, low, z0], [x1, low, z1], [x0, low, z1], [x0, tp(x0, z0), z0], [x1, tp(x1, z0), z0], [x1, tp(x1, z1), z1], [x0, tp(x0, z1), z1]];
    const cx = (x0 + x1) / 2, cy = (low + high) / 2 - .2, cz = (z0 + z1) / 2, pos = [];
    const quad = (i, j, k, l) => { // orient outward
      const p = [V[i], V[j], V[k], V[l]], ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], mx = (p[0][0] + p[2][0]) / 2 - cx, my = (p[0][1] + p[2][1]) / 2 - cy, mz = (p[0][2] + p[2][2]) / 2 - cz;
      const order = (n[0] * mx + n[1] * my + n[2] * mz) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const q of order) pos.push(...p[q]);
    };
    quad(4, 5, 6, 7); quad(0, 1, 5, 4); quad(3, 2, 6, 7); quad(0, 3, 7, 4); quad(1, 2, 6, 5); quad(0, 1, 2, 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    mesh(g, material(col(color)), 0, 0, 0, true, 'access ramp');
    const r = { minX: x0, maxX: x1, minZ: z0, maxZ: z1, axis, y0: yMin, y1: yMax }; ramps.push(r);
    rampColliders.push({ name: 'ramp', type: 'ramp', axis, direction: yMax > yMin ? 1 : -1, min: { x: x0, y: low, z: z0 }, max: { x: x1, y: high, z: z1 } });
  }
  function stairs(x0, z0, x1, z1, axis, yMin, yMax, color = 'purple') {
    const dy = Math.abs(yMax - yMin), a = axis === 'x', len = a ? x1 - x0 : z1 - z0, n = 1 + Math.max(0, Math.round((len - .8) / .4)), base = Math.min(yMin, yMax), rise = yMax > yMin;
    stairsList.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    for (let i = 0; i < n; i++) { // i = 0 at the LOW end
      const top = base + (i + 1) * dy / n, s0 = i === 0 ? 0 : .8 + (i - 1) * (len - .8) / (n - 1), s1 = .8 + i * (len - .8) / (n - 1);
      let ax0 = x0, ax1 = x1, az0 = z0, az1 = z1; // position along axis: low end is min side when !rise... compute
      const lo = rise ? s0 : len - s1, hi = rise ? s1 : len - s0;
      if (a) { ax0 = x0 + lo; ax1 = x0 + hi; } else { az0 = z0 + lo; az1 = z0 + hi; }
      sbox(ax0, az0, ax1, az1, base, top, color, 'stair tread');
      floors.push({ minX: ax0, maxX: ax1, minZ: az0, maxZ: az1, y: top });
      vbox(ax0, az0, ax1, az1, top + .005, top + .025, i % 2 ? 'cream' : 'cyan', true);
    }
  }
  // breakable planters / crates keep the exact v3 naming so destruction.js can split them
  const coneG = new THREE.ConeGeometry(.38, .55, 5); geos.add(coneG);
  function cover(x, z, w = 3, d = 1.7, h = 1.2, y = 0, color = 'cream') {
    const g = new THREE.BoxGeometry(w, h, d), o = mesh(g, material(col(color)), x, y + h / 2, z, true, 'planter / cover');
    const b = new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)); b.name = 'planter / cover'; b.structural = false; b.breakable = true;
    o.userData.structural = false; o.userData.breakable = true; o.userData.collider = b; colliders.push(b);
    vbox(x - w / 2 - .02, z - d / 2 - .02, x + w / 2 + .02, z + d / 2 + .02, y + h - .12, y + h, 'metal', true);
    for (let i = 0; i < 3; i++) mesh(coneG, material(PAL.green), x + (i - 1) * w * .22, y + h + .2, z, false, 'plant');
  }
  function crate(x, z, w, d, h, y = 0, color = 'peach') {
    const g = new THREE.BoxGeometry(w, h, d), o = mesh(g, material(col(color)), x, y + h / 2, z, true, 'crate');
    const b = new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)); b.name = 'crate'; b.structural = false; b.breakable = true;
    o.userData.structural = false; o.userData.breakable = true; o.userData.collider = b; colliders.push(b);
    vbox(x - w / 2 - .02, z - d / 2 - .02, x + w / 2 + .02, z + d / 2 + .02, y + h - .1, y + h, 'wood', true);
  }
  function label(text, x, y, z, color, width = 4, rotation = 0) {
    if (typeof document === 'undefined') return;
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const ctx = c.getContext('2d');
    ctx.fillStyle = '#182839'; ctx.fillRect(0, 0, 512, 160); ctx.fillStyle = '#' + col(color).toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 12, 160);
    ctx.font = 'bold 66px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 262, 82);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); mats.add(m);
    const o = mesh(new THREE.PlaneGeometry(width, width * 160 / 512), m, x, y, z, false, 'wayfinding'); o.rotation.y = rotation;
  }
  function discLabel(letter, v, color) {
    mesh(new THREE.CylinderGeometry(4, 4, .06, 32), material(col(color)), v.x, v.y + .04, v.z, false, 'site ' + letter);
    const ring = mesh(new THREE.TorusGeometry(3.7, .05, 4, 48), material(PAL.cream, true), v.x, v.y + .085, v.z); ring.rotation.x = Math.PI / 2;
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#344359'; ctx.font = 'bold 175px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 128, 135);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; textures.push(t);
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }); mats.add(m);
    const l = mesh(new THREE.PlaneGeometry(2.8, 2.8), m, v.x, v.y + .085, v.z); l.rotation.x = -Math.PI / 2;
  }
  // ---------- landmarks (decor is never solid above head height) ----------
  const LM = {
    fountain(o) { const { x, z, y = 0 } = o;
      sbox(x - 3, z - 3, x + 3, z + 3, y, y + .8, 'stone', 'fountain basin'); vbox(x - 2.5, z - 2.5, x + 2.5, z + 2.5, y + .8, y + .86, 'cyan', true);
      sbox(x - .6, z - .6, x + .6, z + .6, y, y + 3.2, 'cream', 'fountain pillar');
      const k = mesh(new THREE.OctahedronGeometry(1.5, 0), material(PAL.coral), x, y + 4.6, z, false, 'fountain kite'); k.scale.set(1, 1.5, .25); k.rotation.y = .7;
      const cap = mesh(new THREE.SphereGeometry(.8, 10, 8), material(PAL.gold), x, y + 3.5, z, false, 'fountain orb'); void cap; },
    windmill(o) { const { x, z, y = 0, w = 4, h = 7 } = o, hw = w / 2;
      sbox(x - hw, z - hw, x + hw, z + hw, y, y + h, o.color || 'cream', 'windmill tower');
      vbox(x - hw - .2, z - hw - .2, x + hw + .2, z + hw + .2, y + h, y + h + .3, 'roof');
      const cone = mesh(new THREE.ConeGeometry(hw * 1.5, 2.4, 4), material(PAL.roof), x, y + h + 1.5, z, false, 'windmill roof'); cone.rotation.y = Math.PI / 4;
      const hub = new THREE.Group(); hub.position.set(x, y + h - 1.5, z + hw + .35); group.add(hub);
      for (let i = 0; i < 4; i++) { const s = mesh(new THREE.BoxGeometry(.5, 5.2, .08), material(PAL.cream, true), 0, 0, 0, false, 'windmill sail'); group.remove(s); s.position.set(0, 0, 0); s.geometry.translate(0, 2.8, 0); s.rotation.z = i * Math.PI / 2 + .35; hub.add(s); }
      mesh(new THREE.SphereGeometry(.35, 8, 6), material(PAL.coral), hub.position.x, hub.position.y, hub.position.z, false, 'windmill hub'); },
    clock(o) { const { x, z, y = 0, w = 4, h = 6 } = o, hw = w / 2;
      vbox(x - hw, z - hw, x + hw, z + hw, y, y + h, o.color || 'coral'); vbox(x - hw - .3, z - hw - .3, x + hw + .3, z + hw + .3, y + h, y + h + .3, 'roof');
      const cone = mesh(new THREE.ConeGeometry(hw * 1.4, 2.6, 4), material(PAL.roof), x, y + h + 1.6, z, false, 'clock roof'); cone.rotation.y = Math.PI / 4;
      if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        g.fillStyle = '#ffedce'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#344359'; g.lineWidth = 10; g.stroke();
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(128 + 98 * Math.sin(a), 128 - 98 * Math.cos(a)); g.lineTo(128 + 112 * Math.sin(a), 128 - 112 * Math.cos(a)); g.stroke(); }
        g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 52); g.stroke(); g.beginPath(); g.moveTo(128, 128); g.lineTo(178, 150); g.stroke();
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; textures.push(t); const m = new THREE.MeshBasicMaterial({ map: t }); mats.add(m);
        for (const [dx, dz, ry] of [[0, hw + .02, 0], [0, -hw - .02, Math.PI], [hw + .02, 0, Math.PI / 2], [-hw - .02, 0, -Math.PI / 2]]) { const f = mesh(new THREE.CircleGeometry(hw * .78, 24), m, x + dx, y + h - hw * .85, z + dz, false, 'clock face'); f.rotation.y = ry; f.castShadow = false; } } },
    tree(o) { const { x, z, y = 0 } = o; sbox(x - .25, z - .25, x + .25, z + .25, y, y + 2.7, 0x8d7061, 'tree trunk');
      mesh(new THREE.IcosahedronGeometry(o.r || 1.7, 1), material(PAL.green), x, y + 3.5, z, false, 'tree'); },
    pillar(o) { const { x, z, y = 0, w = 1, h = 3.2 } = o; sbox(x - w / 2, z - w / 2, x + w / 2, z + w / 2, y, y + h, o.color || 'cream', 'pillar'); vbox(x - w / 2 - .1, z - w / 2 - .1, x + w / 2 + .1, z + w / 2 + .1, y + h, y + h + .15, 'gold'); },
    lantern(o) { const { x, z, y = 0 } = o; sbox(x - .12, z - .12, x + .12, z + .12, y, y + 2.6, 'dark', 'lamp post'); mesh(new THREE.OctahedronGeometry(.3, 0), material(PAL.gold, true), x, y + 2.8, z, false, 'lantern'); },
    kite(o) { const { x, y, z, size, color } = o;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, size, 0, -size * .7, 0, 0, 0, 0, .4, size * .7, 0, 0, 0, size, 0, 0, 0, .4, 0, -size * 1.1, 0, size * .7, 0, 0, 0, 0, .4, -size * .7, 0, 0, 0, -size * 1.1, 0, 0, 0, .4], 3)); g.computeVertexNormals();
      const km = new THREE.MeshLambertMaterial({ color: col(color), side: THREE.DoubleSide, flatShading: true }); mats.add(km); const k = mesh(g, km, x, y, z, false, 'signature kite'); k.rotation.y = o.rot ?? .25; k.castShadow = false;
      const pts = [new THREE.Vector3(x, y - size, z), new THREE.Vector3(x + .9, y - size - 2, z), new THREE.Vector3(x - .5, y - size - 4, z), new THREE.Vector3(x + .5, y - size - 6, z)];
      const tail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .055, 4, false), material(PAL.cream), 0, 0, 0, false, 'kite tail'); tail.castShadow = false;
      for (let i = 0; i < 3; i++) { const bow = mesh(new THREE.OctahedronGeometry(.35, 0), material(i % 2 ? PAL.cyan : PAL.coral), x + (i % 2 ? .7 : -.3), y - size - 2 - i * 1.5, z, false, 'ribbon'); bow.scale.set(1.6, .45, .25); bow.castShadow = false; } },
    banner(o) { const { x, z, y = 3.3, w = 5, rot = 0, color = 'gold' } = o; for (let i = 0; i < 5; i++) { const m = mesh(new THREE.BoxGeometry(w / 5 - .1, .8, .06), material(col(i % 2 ? 'cream' : color), true), x + Math.cos(rot) * (i - 2) * w / 5, y, z - Math.sin(rot) * (i - 2) * w / 5, false, 'bunting'); m.rotation.y = rot; m.castShadow = false; } }
  };
  // ================= build the layout =================
  const A = L.sites.A, B = L.sites.B;
  paths(L.paths || []);
  for (const o of L.walls || []) wall(o[0], o[1], o[2], o[3], o[4] || {});
  for (const o of L.blocks || []) block(...o);
  for (const o of L.masses || []) mass(o);
  for (const o of L.buildings || []) building(o);
  for (const o of L.ramps || []) ramp(...o);
  for (const o of L.stairs || []) stairs(...o);
  for (const o of L.covers || []) cover(...o);
  for (const o of L.crates || []) crate(...o);
  for (const o of L.landmarks || []) LM[o.type](o);
  for (const o of L.signs || []) label(...o);
  for (const [x0, z0, x1, z1, h] of [[-H - 1, -H - 1, H + 1, -H, 7], [-H - 1, H, H + 1, H + 1, 7], [-H - 1, -H, -H, H, 7], [H, -H, H + 1, H, 7]]) sbox(x0, z0, x1, z1, 0, h, 'cream', 'perimeter');
  flushBatches();
  for (const [x, z, r] of [[-60, -80, 30], [45, -85, 40], [-90, 10, 35], [90, 10, 30], [60, 70, 32], [-50, 85, 30]]) mesh(new THREE.SphereGeometry(r, 16, 8), material(0x92baa1), x, -r * .6, z, false, 'hill');
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const spawnPoints = [];
  for (const team of ['T', 'CT']) for (const [x, z] of L.spawns[team]) spawnPoints.push({ position: V3(x, 0, z), yaw: team === 'T' ? 0 : Math.PI, team });
  const lights = new THREE.Group(); lights.add(new THREE.HemisphereLight(0xcceeff, 0x8cad72, 2));
  const sun = new THREE.DirectionalLight(0xfff3df, 2); sun.position.set(-30, 55, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -56, right: 56, top: 56, bottom: -56, near: 1, far: 150 }); sun.shadow.bias = -.001; sun.shadow.normalBias = .025; lights.add(sun); group.add(lights);
  // ---------- heights + navigation ----------
  function getHeight(x, z) {
    if (x < -H || x > H || z < -H || z > H) return -Infinity;
    let h = 0; for (const f of floors) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y > h) h = f.y;
    for (const r of ramps) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) { const t = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ); const v = r.y0 + (r.y1 - r.y0) * t; if (v > h) h = v; }
    return h;
  }
  const cs = 1, cols = 2 * H, rows = 2 * H, originX = -H, originZ = -H, N = cols * rows;
  const walkable = new Uint8Array(N), height = new Float32Array(N), valid = [];
  const inStairs = (x, z) => stairsList.some(s => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
  const stairCell = new Uint8Array(N);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = originX + c + .5, z = originZ + r + .5, y = getHeight(x, z), i = r * cols + c; height[i] = y; stairCell[i] = inStairs(x, z) ? 1 : 0;
    walkable[i] = Number.isFinite(y) && !colliders.some(b => x > b.min.x - .45 && x < b.max.x + .45 && z > b.min.z - .45 && z < b.max.z + .45 && b.max.y > y + .5 && b.min.y < y + 1.8) ? 1 : 0;
    if (walkable[i]) valid.push(i);
  }
  const navGrid = { cellSize: cs, cols, rows, originX, originZ, walkable, height,
    worldToCell(x, z) { return [Math.floor(x - originX), Math.floor(z - originZ)]; },
    cellToWorld(c, r) { return new THREE.Vector3(originX + c + .5, height[r * cols + c], originZ + r + .5); },
    isWalkable(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && walkable[r * cols + c] === 1; },
    randomWalkable() { const i = valid[Math.floor(Math.random() * valid.length)]; return this.cellToWorld(i % cols, Math.floor(i / cols)); },
    findPath(from, to) {
      const nearest = v => { let [c, r] = this.worldToCell(v.x, v.z); c = Math.max(0, Math.min(cols - 1, c)); r = Math.max(0, Math.min(rows - 1, r));
        for (let k = 0; k < 10; k++) { let best = -1, dist = Infinity; for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (this.isWalkable(c + dc, r + dr)) {
          const i = (r + dr) * cols + c + dc, d = dc * dc + dr * dr + Math.abs(height[i] - v.y) * 4; if (d < dist) { dist = d; best = i; } } if (best >= 0) return best; } return -1; };
      const start = nearest(from), end = nearest(to); if (start < 0 || end < 0) return [];
      const g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const ex = end % cols, ez = Math.floor(end / cols), hh = i => Math.hypot(i % cols - ex, Math.floor(i / cols) - ez);
      const heap = []; const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      const pass = (c, r, i) => { if (!this.isWalkable(c, r)) return false; const j = r * cols + c; return Math.abs(height[j] - height[i]) <= (stairCell[j] && stairCell[i] ? .56 : STEP); };
      g[start] = 0; push(hh(start), start);
      while (heap.length) { const i = pop()[1]; if (closed[i]) continue; closed[i] = 1; if (i === end) break; const c = i % cols, r = Math.floor(i / cols);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nc = c + dc, nr = r + dr; if (!pass(nc, nr, i)) continue;
          if (dc && dr && (!pass(c + dc, r, i) || !pass(c, r + dr, i))) continue; const ni = nr * cols + nc, cost = g[i] + Math.hypot(dc, dr) + Math.abs(height[ni] - height[i]) * .15;
          if (cost < g[ni]) { g[ni] = cost; prev[ni] = i; push(cost + hh(ni), ni); } } }
      if (!closed[end]) return []; const out = []; for (let i = end; i >= 0; i = prev[i]) out.push(this.cellToWorld(i % cols, Math.floor(i / cols))); return out.reverse();
    }
  };
  // site discs, decor and callouts need heights
  const Av = V3(A.x, A.y, A.z), Bv = V3(B.x, B.y, B.z); discLabel('A', Av, 'coral'); discLabel('B', Bv, 'cyan');
  const bombsites = {}; for (const [k, v] of Object.entries({ A: Av, B: Bv })) bombsites[k] = { center: v.clone(), radius: 4, box: new THREE.Box3(V3(v.x - 4, v.y - 1, v.z - 4), V3(v.x + 4, v.y + 3, v.z + 4)) };
  // palm trees: shared by the renderer (graphics.js), the server and bots so trunks block players, cars and bullets
  const palmSpots = []; { const wp = new THREE.Vector3(); let ci = 0; group.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry') { if (o.name === 'plant' && ci % 2 === 0) { o.getWorldPosition(wp); palmSpots.push({ x: wp.x, z: wp.z, s: 1.05, y0: 0 }); } ci++; } });
    const fr = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.2832 + (fr(i + 1) - .5) * .3, rad = 55 + fr(i + 20) * 6; palmSpots.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, s: .9 + fr(i + 40) * .6, y0: -.35 }); }
    for (const p of palmSpots) { const hw = .32 * p.s, b = new THREE.Box3(new THREE.Vector3(p.x - hw, p.y0, p.z - hw), new THREE.Vector3(p.x + hw, p.y0 + 4.2 * p.s, p.z + hw)); b.name = 'palm trunk'; b.structural = true; b.breakable = false; colliders.push(b); } }
  const physicsColliders = [...colliders, ...rampColliders];
  return { layout: L, palmSpots, stairs: stairsList, callouts: L.callouts.map(([name, x, z]) => ({ name, position: V3(x, getHeight(x, z), z) })), group, lights, colliders, physicsColliders, floors, ramps, getHeight,
    stepHeight: STEP, spawnPoints, bombsites, navGrid, bounds: { minX: -H, maxX: H, minZ: -H, maxZ: H }, sky: { background: 0xb4dcf0, fog: { color: 0xb4dcf0, near: 80, far: 200 } },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of textures) t.dispose(); sun.shadow.map?.dispose(); } };
}

// ======================= LAYOUT DATA (metres, x west-/east+, z north-/south+, T south, CT north) =======================
// Borrowed ideas (original names/geometry): Dust2 long doors + tunnels with a bend; Mirage mid windows, apartment overlook,
// A ramp + connector; Inferno banana-style zig-zag with a 2m chokepoint; Overpass "heaven" perch; Ancient-style tunnel exit ramp.
export const KITE_GARDEN_V4 = {
  name: 'Kite Garden', version: 4, half: 35, plateau: 1.6,
  sites: { A: { x: -28, y: 1.6, z: -14 }, B: { x: 26, y: 1.6, z: -13 } },
  spawns: { T: [[0, 32], [-4, 32], [4, 32], [-8, 32], [8, 32]], CT: [[0, -31], [-4, -31], [4, -31], [-8, -31], [8, -31]] },
  paths: [[-35, 16, 35, 26], [-13, -26, -5, 16], [5, -26, 13, 16], [-10, 27, 10, 35], [-12, -35, 12, -27], [-19, 2, -13, 16], [-35, 2, -27, 16], [14, 14, 29, 16], [29, 0, 35, 16], [13, -6, 29, 0], [-35, -35, -13, -24], [13, -35, 35, -24]],
  blocks: [
    [-35, -24, -13, -6, 1.6, 'edge', 'tile', 'A terrace'],
    [13, -24, 35, -6, 1.6, 'edge', 'tile', 'B terrace'],
    [31, -18, 35, -14, 3.2, 'edge', 'gold', 'Heaven perch'],
  ],
  ramps: [
    [-35, -6, -27, 2, 'z', 1.6, 0, 'purple'], [-21, -6, -15, 2, 'z', 1.6, 0, 'purple'],
    [14, -6, 20, 0, 'z', 1.6, 0, 'purple'], [29, -6, 35, 0, 'z', 1.6, 0, 'purple'],
    [-29, -32, -23, -24, 'z', 0, 1.6, 'purple'], [21, -30, 27, -24, 'z', 0, 1.6, 'purple'],
  ],
  stairs: [[-13, -14, -9, -10, 'x', 1.6, 0], [9, -14, 13, -10, 'x', 0, 1.6], [31, -14, 35, -10, 'z', 3.2, 1.6]],
  walls: [
    // T court
    [-11, 26, -10, 35, { h: 4.5 }], [10, 26, 11, 35, { h: 4.5 }], [-10, 26, -6, 27, { h: 4.5 }], [6, 26, 10, 27, { h: 4.5 }],
    // CT court (four gates)
    [-13, -35, -12, -27, { h: 4.5, open: [[-33, -29]] }], [12, -35, 13, -27, { h: 4.5, open: [[-33, -29]] }],
    [-13, -27, -5, -26, { h: 4.5, open: [[-11, -7]] }], [5, -27, 13, -26, { h: 4.5, open: [[7, 11]] }],
    // Long Doors gatehouse wall (two 2m doorways, hero chokepoint)
    [-35, 12, -27, 13, { h: 4.6, color: 'coral', open: [[-34, -32, 0, 3.1], [-30, -28, 0, 3.1]] }],
    // market rows in the plaza and zig-zag stalls in the mid streets (break T-to-CT and T-to-site sightlines)
    [-20, 20, -6, 22, { h: 3.6, color: 'gold', name: 'market row' }], [6, 20, 20, 22, { h: 3.6, color: 'gold', name: 'market row' }],
    [-13, 10, -7, 12, { h: 3.2, color: 'peach', name: 'market stall' }], [7, 10, 13, 12, { h: 3.2, color: 'peach', name: 'market stall' }],
    [-10, -18, -5, -16, { h: 3.2, color: 'peach', name: 'market stall' }], [5, -18, 10, -16, { h: 3.2, color: 'peach', name: 'market stall' }],
    [-9, 14, -3, 15, { h: 3.2, color: 'cyan', name: 'notice board' }], [3, 14, 9, 15, { h: 3.2, color: 'cyan', name: 'notice board' }],
    // Banana zig-zag
    [29, 10, 33, 11, { h: 3, color: 'wood' }], [31, 5, 35, 6, { h: 3, color: 'wood' }],
    // Heaven rail
    [30.7, -18, 31, -14, { y0: 3.2, h: 1.0, color: 'cream', trim: false }],
    // Long corner
    [-34, -10, -31, -8, { y0: 1.6, h: 2.6, color: 'rose', name: 'long corner' }],
  ],
  masses: [{ name: 'burrow wall', h: 4.4, ceilY: 3, color: 'mint', roof: 'roof',
    rects: [[13, 8, 21, 14], [24, 0, 29, 14], [13, 0, 15, 8], [18, 0, 24, 5]],
    ceil: [[21, 8, 24, 14], [15, 5, 19, 8], [21, 5, 24, 8], [15, 0, 18, 5]] }],
  buildings: [
    { name: 'bakery', x0: -27, z0: 2, x1: -19, z1: 12, h: 4.6, color: 'coral', roof: 'roof', awning: 'gold',
      doors: { W: [[5, 7]], E: [[8, 10]], N: [[-23, -21]], S: [[-24, -22]] }, windows: { S: [[-26, -25]], E: [[4, 5]] }, inner: [[-24, 6, -22, 8, { h: 1.1, name: 'counter', color: 'cream' }]] },
    { name: 'teahouse', x0: -5, z0: -8, x1: 5, z1: 4, h: 5, color: 'cream', roof: 'roof', awning: 'coral',
      doors: { S: [[-4, -2]], W: [[-4, -2]], E: [[0, 2]] }, windows: { W: [[0, 2], [-7, -5]], E: [[-4, -2], [-7, -5]], S: [[2, 4]] }, inner: [[0, -7, 1, -2, { h: 2.2, name: 'tea partition' }]] },
    { name: 'clock hall', x0: -5, z0: -27, x1: 5, z1: -8, h: 6, color: 'cyan', roof: 'roof', awning: 'gold',
      doors: { W: [[-24, -22], [-14, -12]], E: [[-21, -19], [-12, -10]], N: [[-3, -1]] }, windows: { W: [[-20, -18]], E: [[-17, -15], [-24, -22]] },
      inner: [[-4, -18, -1, -17, { h: 6 }], [1, -18, 4, -17, { h: 6 }]] },
    { name: 'apartments', x0: 16, z0: -19, x1: 22, z1: -11, y0: 1.6, h: 4.6, color: 'purple', roof: 'roof', awning: 'cyan',
      doors: { W: [[-14, -12]], E: [[-14, -12]], N: [[18, 20]] }, windows: { E: [[-18, -16]], S: [[17, 19]], W: [[-18, -16]] } },
    { name: 'greenhouse', x0: 28, z0: -24, x1: 35, z1: -18, y0: 1.6, h: 4.2, color: 'mint', roof: 'roof', awning: 'coral',
      doors: { S: [[30, 32]], W: [[-22, -20]] }, windows: { S: [[33, 34]], N: [[29, 31], [32, 34]] } },
    { name: 'bell loft', x0: -22, z0: -20, x1: -16, z1: -12, y0: 1.6, h: 4.6, color: 'rose', roof: 'roof', awning: 'gold',
      doors: { E: [[-16, -14]], W: [[-18, -16]], S: [[-21, -19]] }, windows: { N: [[-21, -19]], W: [[-14, -13]] } },
  ],
  covers: [
    [-27, -17, 2.4, 1.6, 1.2, 1.6], [-24, -10, 2.4, 1.6, 1.2, 1.6], [-30, -13, 1.6, 2.4, 1.2, 1.6], [-26, -22, 2.4, 1.6, 1.2, 1.6],
    [23, -17, 2.4, 1.6, 1.2, 1.6], [27, -10, 2.4, 1.6, 1.2, 1.6], [29, -14, 1.6, 2.4, 1.2, 1.6], [24, -22, 2.4, 1.6, 1.2, 1.6],
    [-30, 22, 2.4, 1.6, 1.2], [30, 22, 2.4, 1.6, 1.2], [-15, 21, 2.4, 1.6, 1.2], [15, 21, 2.4, 1.6, 1.2],
    [-9, -4, 1.6, 2.4, 1.2], [9, -4, 1.6, 2.4, 1.2], [-24, -3, 2.4, 1.6, 1.2], [24, -3, 2.4, 1.6, 1.2],
    [-24, -30, 2.4, 1.6, 1.2], [24, -30, 2.4, 1.6, 1.2],
  ],
  crates: [[32, 13, 1.4, 1.4, 1.2, 0], [34, 7.5, 1.4, 1.4, 1.2, 0], [-31, 6, 1.4, 1.4, 1.2, 0], [-8, 14, 1.4, 1.4, 1.2, 0], [8, 14, 1.4, 1.4, 1.2, 0]],
  landmarks: [
    { type: 'fountain', x: 0, z: 11 }, { type: 'windmill', x: -33, z: -22, y: 1.6, w: 4, h: 7, color: 'cream' },
    { type: 'clock', x: 0, z: -17, y: 6.35, w: 4, h: 5 },
    { type: 'tree', x: -30, z: 26 }, { type: 'tree', x: 30, z: 26 }, { type: 'tree', x: -20, z: -30 }, { type: 'tree', x: -32, z: -31 }, { type: 'tree', x: 20, z: -31 }, { type: 'tree', x: 32, z: -31 },
    { type: 'lantern', x: -12, z: 20 }, { type: 'lantern', x: 12, z: 20 }, { type: 'lantern', x: -3, z: -29 }, { type: 'lantern', x: 3, z: -29 },
    { type: 'kite', x: -26, y: 17, z: -22, size: 3.8, color: 'coral' }, { type: 'kite', x: 25, y: 16, z: -20, size: 3.2, color: 'cyan' },
    { type: 'kite', x: -55, y: 22, z: -70, size: 4, color: 'gold' }, { type: 'kite', x: 40, y: 30, z: -85, size: 5, color: 'coral' },
  ],
  signs: [
    ['LONG DOORS', -31, 4.0, 12.55, 'cream', 4], ['A ← → B', 0, 3.0, 25.4, 'gold', 5], ['MID', 0, 3.6, 4.55, 'gold', 3.2], ['BURROW', 22.5, 3.1, 14.55, 'cream', 3.2],
    ['TEAHOUSE', -5.55, 3.4, -2, 'coral', 3.4, Math.PI / 2], ['CLOCK HALL', 5.55, 4.0, -17, 'gold', 3.8, -Math.PI / 2], ['BANANA', 32, 3.4, 14.55, 'cream', 3.2],
  ],
  callouts: [['T SPAWN', 0, 31], ['PLAZA', 0, 21], ['LONG', -31, 7], ['BAKERY', -23, 7], ['A RAMP', -18, -2], ['A SITE', -28, -14], ['WINDMILL', -33, -22], ['BELL LOFT', -19, -16],
    ['MID', 0, 13], ['TEAHOUSE', 0, -2], ['CLOCK HALL', 0, -17], ['MID WEST', -9, 0], ['MID EAST', 9, 0], ['A STEPS', -9, -12], ['B STEPS', 9, -12],
    ['BURROW', 22, 11], ['TUNNEL', 16, 3], ['BANANA', 32, 8], ['B SITE', 26, -13], ['APARTMENTS', 19, -15], ['HEAVEN', 33, -16], ['GREENHOUSE', 31, -21],
    ['CT COURT', 0, -31], ['ORCHARD', -24, -30], ['GARDEN YARD', 24, -30]],
};

// ---- map scale (Juan 11:44 PM: "somewhat bigger map"). Every footprint, lane and door is stretched sideways by MAP_SCALE;
// heights, props and art keep their size, so the world feels longer without changing how anything looks.
export const MAP_SCALE = 1.2;
export function scaleLayout(L, S = MAP_SCALE) {
  if (!S || S === 1) return L;
  const f = (v) => +(v * S).toFixed(3), rect = (r) => [f(r[0]), f(r[1]), f(r[2]), f(r[3]), ...r.slice(4)];
  const pair = (q) => [f(q[0]), f(q[1]), ...q.slice(2)];
  const wallOpts = (o) => (o && o.open ? { ...o, open: o.open.map(pair) } : o);
  const sides = (d) => { if (!d) return d; const out = {}; for (const k of Object.keys(d)) out[k] = d[k].map(pair); return out; };
  return {
    ...L, __raw: L, half: f(L.half),
    sites: Object.fromEntries(Object.entries(L.sites).map(([k, v]) => [k, { ...v, x: f(v.x), z: f(v.z) }])),
    spawns: Object.fromEntries(Object.entries(L.spawns).map(([k, a]) => [k, a.map((p) => [f(p[0]), f(p[1])])])),
    paths: L.paths.map(rect), blocks: L.blocks.map(rect), ramps: L.ramps.map(rect), stairs: L.stairs.map(rect),
    walls: L.walls.map((w) => [f(w[0]), f(w[1]), f(w[2]), f(w[3]), wallOpts(w[4])]),
    masses: L.masses.map((m) => ({ ...m, rects: m.rects.map(rect), ceil: m.ceil.map(rect) })),
    buildings: L.buildings.map((b) => ({ ...b, x0: f(b.x0), z0: f(b.z0), x1: f(b.x1), z1: f(b.z1), doors: sides(b.doors), windows: sides(b.windows),
      inner: b.inner && b.inner.map((w) => [f(w[0]), f(w[1]), f(w[2]), f(w[3]), wallOpts(w[4])]) })),
    covers: L.covers.map((c) => [f(c[0]), f(c[1]), ...c.slice(2)]), crates: L.crates.map((c) => [f(c[0]), f(c[1]), ...c.slice(2)]),
    landmarks: L.landmarks.map((m) => (m.type === 'kite' ? m : { ...m, x: f(m.x), z: f(m.z) })),
    signs: L.signs.map((q) => [q[0], f(q[1]), q[2], f(q[3]), ...q.slice(4)]),
    callouts: L.callouts.map((c) => [c[0], f(c[1]), f(c[2])]),
  };
}
export default buildMap;
