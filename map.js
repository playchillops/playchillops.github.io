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
  sky:0x9fd0e8, wood:0xb98b64, lilac:0xd9c4e8, stone:0xcfc6b8, dark:0x4b5b70, rose:0xf2a9b8, brick:0xe39a86, sand:0xf3d8a2, water:0x7fdde3 };

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
    if (o.crenel) { const len = a1 - a0, n = Math.max(1, Math.floor(len / 2.2)), st = len / n; for (let k = 0; k < n; k++) { const a = a0 + k * st + st * .25, b = a + st * .5; // merlons, visual only
      if (alongX) vbox(a, z0 - .08, b, z1 + .08, y0 + h, y0 + h + .8, o.crenel, true); else vbox(x0 - .08, a, x1 + .08, b, y0 + h, y0 + h + .8, o.crenel, true); } }
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
  function stairs(x0, z0, x1, z1, axis, yMin, yMax, color = 'purple', trim = ['cream', 'cyan']) {
    const dy = Math.abs(yMax - yMin), a = axis === 'x', len = a ? x1 - x0 : z1 - z0, n = 1 + Math.max(0, Math.round((len - .8) / .4)), base = Math.min(yMin, yMax), rise = yMax > yMin;
    stairsList.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    for (let i = 0; i < n; i++) { // i = 0 at the LOW end
      const top = base + (i + 1) * dy / n, s0 = i === 0 ? 0 : .8 + (i - 1) * (len - .8) / (n - 1), s1 = .8 + i * (len - .8) / (n - 1);
      let ax0 = x0, ax1 = x1, az0 = z0, az1 = z1; // position along axis: low end is min side when !rise... compute
      const lo = rise ? s0 : len - s1, hi = rise ? s1 : len - s0;
      if (a) { ax0 = x0 + lo; ax1 = x0 + hi; } else { az0 = z0 + lo; az1 = z0 + hi; }
      sbox(ax0, az0, ax1, az1, base, top, color, 'stair tread');
      floors.push({ minX: ax0, maxX: ax1, minZ: az0, maxZ: az1, y: top });
      vbox(ax0, az0, ax1, az1, top + .005, top + .025, trim[i % 2], true);
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
  // rect minus holes -> a few non-overlapping rects (grid compression + greedy merge). Rects are [x0, z0, x1, z1].
  function carve(R, holes) {
    const hs = holes.map((h) => [Math.max(R[0], h[0]), Math.max(R[1], h[1]), Math.min(R[2], h[2]), Math.min(R[3], h[3])]).filter((h) => h[2] > h[0] + 1e-6 && h[3] > h[1] + 1e-6);
    if (!hs.length) return [R.slice(0, 4)];
    const X = [...new Set([R[0], R[2], ...hs.flatMap((h) => [h[0], h[2]])])].sort((a, b) => a - b), Z = [...new Set([R[1], R[3], ...hs.flatMap((h) => [h[1], h[3]])])].sort((a, b) => a - b);
    const out = []; let open = new Map();
    for (let j = 0; j < Z.length - 1; j++) {
      const mz = (Z[j] + Z[j + 1]) / 2, runs = [];
      for (let i = 0; i < X.length - 1; i++) { const mx = (X[i] + X[i + 1]) / 2; if (hs.some((h) => mx > h[0] && mx < h[2] && mz > h[1] && mz < h[3])) continue; const r = runs[runs.length - 1]; if (r && r[1] === i) r[1] = i + 1; else runs.push([i, i + 1]); }
      const next = new Map();
      for (const [i0, i1] of runs) { const k = i0 + ',' + i1, r = open.get(k); if (r) { r[3] = Z[j + 1]; open.delete(k); next.set(k, r); } else next.set(k, [X[i0], Z[j], X[i1], Z[j + 1]]); }
      for (const r of open.values()) out.push(r); open = next;
    }
    for (const r of open.values()) out.push(r); return out;
  }
  // ---------- landmarks (decor is never solid above head height) ----------
  const LM = {
    // themed zones: stepped pyramid with a N-S passage, and a launch-ready rocket with thrusters that fire now and then
    pyramid(o) { const { x, z, s = 12, layers = 5, h = 1.4, gap = 2.8 } = o; const cols = ['gold', 'peach', 'gold', 'peach', 'gold'];
      for (let i = 0; i < layers; i++) { const hw = (s / 2) * (1 - i / layers), y0 = i * h, y1 = y0 + h, c = cols[i % cols.length];
        if (i < 2) { sbox(x - hw, z - hw, x - gap / 2, z + hw, y0, y1, c, 'pyramid'); sbox(x + gap / 2, z - hw, x + hw, z + hw, y0, y1, c, 'pyramid'); }
        else sbox(x - hw, z - hw, x + hw, z + hw, y0, y1, c, 'pyramid'); }
      vbox(x - gap / 2, z - s / 2, x + gap / 2, z + s / 2, .02, .05, 'stone', true); },
    // ---- Pyramid Quarter (Plaza v13). Cones are drawn as 0-radius cylinders: graphics.js hides every ConeGeometry (planter palms).
    // Great pyramid: climbable tiers, ground-level halls, a crouch-only crawl, a tall tomb chamber and an open shaft from the top.
    // Walkable tops never sit above a passage (single-layer nav); players can still cross those slabs, bots go around.
    greatPyramid(o) {
      const { x: cx, z: cz, tiers, ceil = 3, crawlH = 1.3, chamber, halls = [], crawl = [], oculus, gaps = [], colors = ['sand', 'gold'] } = o;
      const T = tiers.map(([hw, top]) => [cx - hw, cz - hw, cx + hw, cz + hw, top]), ch = chamber[4], cr = chamber.slice(0, 4), inner = [...halls, ...crawl, cr], oc = oculus ? [oculus] : [];
      const lay = (outer, holes, y0, y1, c) => { if (y1 - y0 > .001) for (const r of carve(outer, holes)) sbox(r[0], r[1], r[2], r[3], y0, y1, c, 'pyramid'); };
      lay(T[0], inner, 0, crawlH, colors[0]); lay(T[0], [...halls, cr], crawlH, ceil, colors[0]); lay(T[0], [cr], ceil, T[0][4], colors[0]);
      for (let i = 1; i < T.length; i++) { const ya = T[i - 1][4], yb = T[i][4], c = colors[i % colors.length];
        if (ya < ch) lay(T[i], [cr], ya, Math.min(yb, ch), c); lay(T[i], oc, Math.max(ya, ch), yb, c); }
      T.forEach((t, i) => { const up = T[i + 1] ? [T[i + 1].slice(0, 4)] : [], y = t[4];
        for (const r of carve(t, [...inner, ...up, ...oc])) floors.push({ minX: r[0], maxX: r[2], minZ: r[1], maxZ: r[3], y });
        for (const r of carve(t, [...up, ...oc])) vbox(r[0], r[1], r[2], r[3], y + .004, y + .02, i % 2 ? 'tile' : 'stone', true);
        const [a, b, c, d] = t, e = .2, gx = gaps.map((g) => [g[0] - .05, g[1] - .05, g[2] + .05, g[3] + .05]); // cream lip on every tier edge, open where stairs land
        for (const lip of [[a - e, b - e, c + e, b], [a - e, d, c + e, d + e], [a - e, b, a, d], [c, b, c + e, d]]) for (const r of carve(lip, gx)) vbox(r[0], r[1], r[2], r[3], y - .32, y + .05, 'cream', true);
        if (i > 0) for (const [band, col2] of [[.45, 'coral'], [.62, 'cyan']]) { const yb = T[i - 1][4] + (y - T[i - 1][4]) * band; // painted bands on the upper tiers
          for (const s of [[a - .03, b - .03, c + .03, b], [a - .03, d, c + .03, d + .03], [a - .03, b, a, d], [c, b, c + .03, d]]) for (const r of carve(s, gx)) vbox(r[0], r[1], r[2], r[3], yb, yb + .16, col2, true); } });
      // portals around every opening on the outer face
      const [X0, Z0, X1, Z1] = T[0];
      for (const r of [...halls, ...crawl]) { const top = crawl.includes(r) ? crawlH : ceil, P = .5, D = .35;
        const face = r[0] <= X0 + 1e-6 ? 'W' : r[2] >= X1 - 1e-6 ? 'E' : r[1] <= Z0 + 1e-6 ? 'N' : r[3] >= Z1 - 1e-6 ? 'S' : null; if (!face) continue;
        if (face === 'N' || face === 'S') { const zf = face === 'N' ? Z0 : Z1, s = face === 'N' ? -1 : 1, z0 = Math.min(zf, zf + s * D), z1 = Math.max(zf, zf + s * D);
          sbox(r[0] - P, z0, r[0], z1, 0, top + .5, 'coral', 'portal'); sbox(r[2], z0, r[2] + P, z1, 0, top + .5, 'coral', 'portal'); vbox(r[0] - P, z0, r[2] + P, z1, top, top + .5, 'gold', true); vbox(r[0], z0 - .01, r[2], z1 + .01, top + .16, top + .3, 'cyan', true); }
        else { const xf = face === 'W' ? X0 : X1, s = face === 'W' ? -1 : 1, x0 = Math.min(xf, xf + s * D), x1 = Math.max(xf, xf + s * D);
          sbox(x0, r[1] - P, x1, r[1], 0, top + .5, 'coral', 'portal'); sbox(x0, r[3], x1, r[3] + P, 0, top + .5, 'coral', 'portal'); vbox(x0, r[1] - P, x1, r[3] + P, top, top + .5, 'gold', true); vbox(x0 - .01, r[1], x1 + .01, r[3], top + .16, top + .3, 'cyan', true); } }
      // inside: stone floors, painted glyph frieze in the chamber, braziers, and a sunbeam down the shaft
      for (const r of inner) vbox(r[0], r[1], r[2], r[3], .004, .014, 'stone', true);
      const doorHoles = [...halls, ...crawl].map((h) => [h[0] - .1, h[1] - .1, h[2] + .1, h[3] + .1]), [c0, c1, c2, c3] = cr, t = .04;
      for (const w of [[c0, c1, c2, c1 + t], [c0, c3 - t, c2, c3], [c0, c1, c0 + t, c3], [c2 - t, c1, c2, c3]]) for (const r of carve(w, doorHoles)) {
        vbox(r[0], r[1], r[2], r[3], ch - 1.1, ch - .85, 'coral', true); vbox(r[0], r[1], r[2], r[3], ch - .7, ch - .55, 'cyan', true);
        const along = r[2] - r[0] > r[3] - r[1], len = along ? r[2] - r[0] : r[3] - r[1];
        for (let k = .6; k < len - .4; k += 1.3) { const a = (along ? r[0] : r[1]) + k, gc = ['cyan', 'dark', 'coral'][Math.floor(k) % 3];
          if (along) vbox(a, r[1], a + .42, r[3], 1.5, 2.05, gc, true); else vbox(r[0], a, r[2], a + .42, 1.5, 2.05, gc, true); } }
      for (const [x, z] of [[c0 + .5, c1 + .5], [c2 - .5, c1 + .5], [c0 + .5, c3 - .5], [c2 - .5, c3 - .5]]) LM.torch({ x, z, h: 1.3 });
      if (oculus) { const [o0, o1, o2, o3] = oculus, m = new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: .2, depthWrite: false }); mats.add(m);
        const beam = mesh(new THREE.BoxGeometry(o2 - o0, T[T.length - 1][4], o3 - o1), m, (o0 + o2) / 2, T[T.length - 1][4] / 2, (o1 + o3) / 2, false, 'sunbeam'); beam.castShadow = false; beam.receiveShadow = false;
        vbox(o0 - .15, o1 - .15, o2 + .15, o3 + .15, .015, .03, 'gold', true); }
      // shrine on the summit: four pillars, a roof and a golden capstone; low parapet around the top edge
      const top = T[T.length - 1], ty = top[4], s = o.shrine || 3.5, pw = .8;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sbox(cx + dx * s - pw / 2, cz + dz * s - pw / 2, cx + dx * s + pw / 2, cz + dz * s + pw / 2, ty, ty + 2.5, 'cream', 'shrine pillar');
      sbox(cx - s - .7, cz - s - .7, cx + s + .7, cz + s + .7, ty + 2.5, ty + 2.9, 'coral', 'shrine roof');
      vbox(cx - s - .75, cz - s - .75, cx + s + .75, cz + s + .75, ty + 2.65, ty + 2.8, 'gold', true);
      const cr2 = (s + .7) * Math.SQRT2, cap = mesh(new THREE.CylinderGeometry(0, cr2, 6.5, 4), material(PAL.gold), cx, ty + 2.9 + 3.25, cz, false, 'capstone'); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
      vbox(cx - s - .7, cz - s - .7, cx + s + .7, cz + s + .7, ty + 2.9, ty + 3.05, 'coral', true);
      const [a, b, c, d] = top, pt = .35, ph = .95, gx = gaps.map((g) => [g[0] - .05, g[1] - .05, g[2] + .05, g[3] + .05]);
      for (const p of [[a, b, c, b + pt], [a, d - pt, c, d], [a, b + pt, a + pt, d - pt], [c - pt, b + pt, c, d - pt]]) for (const r of carve(p, gx)) sbox(r[0], r[1], r[2], r[3], ty, ty + ph, 'cream', 'parapet');
    },
    obelisk(o) { const { x, z, h = 6.5, w = 1.1, y: b = 0 } = o, hw = w / 2;
      sbox(x - w * .85, z - w * .85, x + w * .85, z + w * .85, b, b + .6, 'stone', 'obelisk base'); sbox(x - hw, z - hw, x + hw, z + hw, b + .6, b + h, o.color || 'cream', 'obelisk');
      for (let k = 0; k < 4; k++) { const y = b + 1.3 + k * 1.15, c = ['coral', 'cyan', 'dark', 'gold'][k], q = .17;
        vbox(x - q, z + hw, x + q, z + hw + .03, y, y + .34, c, true); vbox(x - q, z - hw - .03, x + q, z - hw, y, y + .34, c, true);
        vbox(x + hw, z - q, x + hw + .03, z + q, y, y + .34, c, true); vbox(x - hw - .03, z - q, x - hw, z + q, y, y + .34, c, true); }
      const tip = mesh(new THREE.CylinderGeometry(0, w * .72, 1.3, 4), material(PAL.gold), x, b + h + .65, z, false, 'obelisk tip'); tip.rotation.y = Math.PI / 4; },
    sphinx(o) { // a lying cat-sphinx: plinth, body, paws and a head with ears. o.face = 'N'|'S'|'E'|'W' (where it looks)
      const { x, z, face = 'S', s: sc = 1 } = o, f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[face], R = (u0, v0, u1, v1) => { // local (u forward, v side) -> world rect
        const p = [[u0 * sc, v0 * sc], [u1 * sc, v1 * sc]].map(([u, v]) => [x + f[0] * u - f[1] * v, z + f[1] * u + f[0] * v]); return [Math.min(p[0][0], p[1][0]), Math.min(p[0][1], p[1][1]), Math.max(p[0][0], p[1][0]), Math.max(p[0][1], p[1][1])]; };
      const S = (r, y0, y1, c, n = 'sphinx') => sbox(r[0], r[1], r[2], r[3], y0 * sc, y1 * sc, c, n), V = (r, y0, y1, c) => vbox(r[0], r[1], r[2], r[3], y0 * sc, y1 * sc, c, true);
      S(R(-5, -2.6, 5, 2.6), 0, 1.1, 'stone', 'sphinx plinth'); S(R(-4.4, -1.6, 1.6, 1.6), 1.1, 3.1, 'gold'); S(R(1.6, -1.5, 4.6, -.5), 1.1, 1.8, 'gold'); S(R(1.6, .5, 4.6, 1.5), 1.1, 1.8, 'gold');
      S(R(.6, -1.4, 3.2, 1.4), 3.1, 5.6, 'gold', 'sphinx head'); V(R(.4, -1.75, 2.4, 1.75), 3.2, 5.3, 'cyan'); V(R(.5, -1.8, 2.3, 1.8), 3.6, 3.8, 'gold'); V(R(.5, -1.8, 2.3, 1.8), 4.3, 4.5, 'gold');
      V(R(3.2, -.95, 3.24, -.45), 4.3, 4.75, 'dark'); V(R(3.2, .45, 3.24, .95), 4.3, 4.75, 'dark'); V(R(3.2, -.2, 3.26, .2), 3.75, 4.0, 'rose');
      V(R(-4.4, -.25, -3.6, .25), 1.6, 2.0, 'gold'); V(R(-5.6, -.25, -4.4, .25), 1.2, 1.6, 'gold'); // tail
      for (const sv of [-1, 1]) { const [ex, ez] = [x + f[0] * 1.9 - f[1] * sv * .9, z + f[1] * 1.9 + f[0] * sv * .9]; const ear = mesh(new THREE.CylinderGeometry(0, .55 * sc, 1.1 * sc, 4), material(PAL.peach), x + (ex - x) * sc, 6.1 * sc, z + (ez - z) * sc, false, 'sphinx ear'); ear.rotation.y = Math.PI / 4; }
      V(R(3.2, -1.1, 3.3, 1.1), 3.4, 5.2, 'cream'); V(R(3.25, -.95, 3.34, -.45), 4.3, 4.75, 'dark'); V(R(3.25, .45, 3.34, .95), 4.3, 4.75, 'dark'); V(R(3.25, -.2, 3.36, .2), 3.75, 4.0, 'rose'); // face
      for (const sv of [-1, 1]) for (let k = 0; k < 5; k++) { const y = 2.4 + k * .55; V(R(1.2, sv * 1.42, 2.8, sv * 1.42 + sv * .14), y, y + .3, k % 2 ? 'gold' : 'cyan'); V(R(1.2, sv * 1.42, 2.8, sv * 1.42 + sv * .14), y + .3, y + .55, k % 2 ? 'cyan' : 'gold'); } // nemes flaps
      V(R(3.2, -.3, 3.6, .3), 2.6, 3.4, 'gold'); V(R(3.2, -.32, 3.62, .32), 3.0, 3.1, 'cyan'); V(R(2.6, -1.5, 3.25, 1.5), 3.0, 3.2, 'coral'); // beard + collar
      for (const sv of [-1, 1]) for (const k of [-.3, 0, .3]) V(R(4.55, sv + k - .1, 4.7, sv + k + .1), 1.1, 1.6, 'cream'); // toes
      V(R(-4.4, -1.65, 1.6, -1.6), 1.6, 2.9, 'cyan'); V(R(-4.4, 1.6, 1.6, 1.65), 1.6, 2.9, 'cyan'); for (let u = -3.8; u < 1.4; u += 1.2) { V(R(u, -1.68, u + .5, -1.62), 1.6, 2.9, 'gold'); V(R(u, 1.62, u + .5, 1.68), 1.6, 2.9, 'gold'); } }, // body stripes
    column(o) { const { x, z, h = 4, w = .9, fallen = 0, y: b = 0 } = o; // standing (maybe broken) column, or a fallen drum lying along x (fallen>0) / z (fallen<0)
      if (fallen) { const L2 = Math.abs(fallen) / 2, a = fallen > 0; sbox(a ? x - L2 : x - w / 2, a ? z - w / 2 : z - L2, a ? x + L2 : x + w / 2, a ? z + w / 2 : z + L2, b, b + w, o.color || 'cream', 'fallen column'); return; }
      sbox(x - w * .7, z - w * .7, x + w * .7, z + w * .7, b, b + .35, 'stone', 'column base'); sbox(x - w / 2, z - w / 2, x + w / 2, z + w / 2, b + .35, b + h, o.color || 'cream', 'column');
      if (o.glyph) for (let k = 0; k < 3; k++) { const y = b + 1 + k * 1.2, c = ['coral', 'cyan', 'gold'][k]; vbox(x - w / 2 - .03, z - w / 2 - .03, x + w / 2 + .03, z + w / 2 + .03, y, y + .22, c, true); }
      if (o.cap !== false) vbox(x - w * .75, z - w * .75, x + w * .75, z + w * .75, b + h, b + h + .3, 'gold', true); },
    canopy(o) { const { x0, z0, x1, z1, y = 2.9, c1 = 'coral', c2 = 'cream' } = o, alongX = x1 - x0 >= z1 - z0, n = Math.max(2, Math.round((alongX ? x1 - x0 : z1 - z0) / .9));
      for (let i = 0; i < n; i++) { const a = (alongX ? x0 : z0) + i * ((alongX ? x1 - x0 : z1 - z0) / n), b = a + (alongX ? x1 - x0 : z1 - z0) / n, c = i % 2 ? c2 : c1;
        if (alongX) vbox(a, z0, b, z1, y, y + .08, c, true); else vbox(x0, a, x1, b, y, y + .08, c, true); }
      for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) sbox(px - .08, pz - .08, px + .08, pz + .08, 0, y, 'wood', 'canopy post'); },
    torch(o) { const { x, z, y = 0, h = 1.6 } = o; vbox(x - .1, z - .1, x + .1, z + .1, y, y + h, 'dark', true); vbox(x - .22, z - .22, x + .22, z + .22, y + h, y + h + .14, 'gold', true);
      const fm = new THREE.MeshBasicMaterial({ color: 0xffb347 }); mats.add(fm); const fl = mesh(new THREE.OctahedronGeometry(.2, 0), fm, x, y + h + .38, z, false, 'torch flame'); fl.castShadow = false;
      const ph = x * 1.7 + z; fl.onBeforeRender = () => { const t = performance.now() / 1000 + ph; const k = 1 + .18 * Math.sin(t * 13) + .1 * Math.sin(t * 7.3); fl.scale.set(.85 * k, 1.5 * k, .85 * k); fl.rotation.y = t * 2; }; },
    pool(o) { const { x0, z0, x1, z1, h = .7 } = o, r = .6; // oasis: low stone rim (cover), sunken water, ripples that grow and fade
      sbox(x0, z0, x1, z0 + r, 0, h, 'stone', 'pool rim'); sbox(x0, z1 - r, x1, z1, 0, h, 'stone', 'pool rim'); sbox(x0, z0 + r, x0 + r, z1 - r, 0, h, 'stone', 'pool rim'); const zm = (z0 + z1) / 2; sbox(x1 - r, z0 + r, x1, zm - 1.6, 0, h, 'stone', 'pool rim'); sbox(x1 - r, zm + 1.6, x1, z1 - r, 0, h, 'stone', 'pool rim'); // wade-in gap on the east side
      vbox(x0 + r, z0 + r, x1 - r, z1 - r, .02, .22, 'water');
      for (let i = 0; i < 3; i++) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false }); mats.add(m);
        const rg = mesh(new THREE.TorusGeometry(1, .04, 4, 32), m, x0 + (x1 - x0) * (.3 + .2 * i), .27, z0 + (z1 - z0) * (.35 + .15 * i), false, 'ripple'); rg.rotation.x = Math.PI / 2; rg.castShadow = false;
        rg.onBeforeRender = () => { const t = (performance.now() / 1000 / 2.6 + i / 3) % 1; rg.scale.setScalar(.2 + t * 1.6); m.opacity = .55 * (1 - t); }; } },
    lighthouse(o) { const { x, z, h = 13 } = o; // striped tower with a rotating lamp beam (visual), solid base
      sbox(x - 2.2, z - 2.2, x + 2.2, z + 2.2, 0, 1, 'stone', 'lighthouse base');
      for (let i = 0; i < 6; i++) { const y0 = 1 + i * (h - 1) / 6, y1 = y0 + (h - 1) / 6, w = 1.6 - i * .12; sbox(x - w, z - w, x + w, z + w, y0, y1, i % 2 ? 'cream' : 'coral', 'lighthouse'); }
      vbox(x - 1.4, z - 1.4, x + 1.4, z + 1.4, h, h + .25, 'dark', true);
      const lamp = mesh(new THREE.OctahedronGeometry(.6, 0), material(PAL.gold, true), x, h + .9, z, false, 'lighthouse lamp'); lamp.castShadow = false;
      const cap = mesh(new THREE.CylinderGeometry(0, 1.3, 1.5, 8), material(PAL.coral), x, h + 2.2, z, false, 'lighthouse cap'); void cap;
      const bm = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }); mats.add(bm);
      const bg = new THREE.CylinderGeometry(.25, 2.4, 22, 12, 1, true); bg.rotateZ(Math.PI / 2); bg.translate(11.5, 0, 0);
      const beam = mesh(bg, bm, x, h + .9, z, false, 'lighthouse beam'); beam.castShadow = false; beam.receiveShadow = false;
      beam.onBeforeRender = () => { beam.rotation.y = performance.now() / 1000 * .9; }; lamp.onBeforeRender = () => { lamp.rotation.y = performance.now() / 1000 * .9; }; },
    container(o) { const { x0, z0, x1, z1, h = 2.6, color = 'cyan' } = o, alongX = x1 - x0 >= z1 - z0; // shipping container: solid box, ribs, door bars
      sbox(x0, z0, x1, z1, 0, h, color, 'container'); vbox(x0 - .03, z0 - .03, x1 + .03, z1 + .03, h - .12, h, 'cream', true);
      const L2 = alongX ? x1 - x0 : z1 - z0; for (let a = .35; a < L2 - .2; a += .55) { const p = (alongX ? x0 : z0) + a;
        if (alongX) { vbox(p, z0 - .05, p + .12, z0, .1, h - .15, color, false); vbox(p, z1, p + .12, z1 + .05, .1, h - .15, color, false); }
        else { vbox(x0 - .05, p, x0, p + .12, .1, h - .15, color, false); vbox(x1, p, x1 + .05, p + .12, .1, h - .15, color, false); } }
      for (const e of [0, 1]) for (const k of [.3, .5, .7]) { if (alongX) { const xe = e ? x1 : x0 - .04, zz = z0 + (z1 - z0) * k; vbox(xe, zz - .04, xe + .04, zz + .04, .2, h - .2, 'dark', true); }
        else { const ze = e ? z1 : z0 - .04, xx = x0 + (x1 - x0) * k; vbox(xx - .04, ze, xx + .04, ze + .04, .2, h - .2, 'dark', true); } } },
    spinner(o) { const { x, y, z, size = 2.5, color = 'gold' } = o; // big floating kite-gem that turns slowly, visible across the district
      const g = mesh(new THREE.OctahedronGeometry(size, 0), material(col(color)), x, y, z, false, 'spinner'); g.scale.set(.7, 1.3, .7); g.castShadow = false;
      g.onBeforeRender = () => { const t = performance.now() / 1000; g.rotation.y = t * .5; g.position.y = y + Math.sin(t * .8) * .4; }; },
    // ---- Plaza v14 props ----
    bigRocket(o) { // B-site centrepiece: low launch platform, 4 legs you can crouch-walk between, 16 m rocket, swept fins, boosters, flames + smoke
      const { x, z } = o, T = THREE, cyl = (rt, rb, h, c, px, py, pz, n = 18, name = 'rocket') => mesh(new T.CylinderGeometry(rt, rb, h, n), material(col(c)), px, py, pz, false, name);
      sbox(x - 4.2, z - 4.2, x + 4.2, z + 4.2, 0, .3, 'stone', 'launch platform'); floors.push({ minX: x - 4.2, maxX: x + 4.2, minZ: z - 4.2, maxZ: z + 4.2, y: .3 });
      vbox(x - 4.2, z - 4.2, x + 4.2, z + 4.2, .3, .32, 'dark', true); for (let k = -3; k <= 3; k += 2) { vbox(x + k - .35, z - 4.2, x + k + .35, z - 3.4, .32, .335, 'gold', true); vbox(x + k - .35, z + 3.4, x + k + .35, z + 4.2, .32, .335, 'gold', true); }
      vbox(x - 1.5, z - 1.5, x + 1.5, z + 1.5, .321, .34, 'coral', true); // flame trench grate
      for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) { sbox(x + dx - .18, z + dz - .18, x + dx + .18, z + dz + .18, .3, 2.6, 'dark', 'rocket leg'); vbox(x + dx - .45, z + dz - .45, x + dx + .45, z + dz + .45, .3, .45, 'metal', true); }
      sbox(x - .75, z - .75, x + .75, z + .75, 1.3, 2.6, 'dark', 'engine bell'); cyl(.55, 1.05, 1.1, 'dark', x, 1.9, z, 14, 'engine bell');
      sbox(x - 1.3, z - 1.3, x + 1.3, z + 1.3, 2.6, 13, 'cream', 'rocket'); // body hitbox (above head height: you can stand under it)
      cyl(1.45, 1.45, 10.4, 'cream', x, 7.8, z); for (const [y, c] of [[3.4, 'coral'], [6.6, 'cyan'], [10.2, 'coral']]) cyl(1.5, 1.5, .55, c, x, y, z);
      cyl(0, 1.45, 4.2, 'coral', x, 15.1, z); cyl(.12, .12, 1.2, 'gold', x, 17.7, z, 6);
      const win = mesh(new T.CircleGeometry(.48, 16), material(PAL.cyan, true), x, 11.6, z + 1.47, false, 'rocket window'); void win; mesh(new T.TorusGeometry(.5, .07, 6, 18), material(PAL.gold), x, 11.6, z + 1.48, false, 'rocket window ring');
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, g = new T.BoxGeometry(.14, 3.6, 2.1); g.translate(0, 0, 2.1 / 2 + 1.2); const f = mesh(g, material(PAL.coral), x, 4.4, z, false, 'rocket fin'); f.rotation.y = a; f.rotation.x = 0;
        const sx = Math.sin(a) * 1.9, sz = Math.cos(a) * 1.9; cyl(.42, .42, 5, 'cream', x + sx, 5.1, z + sz, 12, 'booster'); cyl(0, .42, 1.1, 'coral', x + sx, 8.15, z + sz, 12, 'booster nose'); }
      const smoke = [], sm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }); mats.add(sm);
      for (let i = 0; i < 6; i++) { const s2 = mesh(new T.IcosahedronGeometry(1, 1), sm, x + Math.cos(i) * 2.2, .9, z + Math.sin(i) * 2.2, false, 'rocket smoke'); s2.castShadow = false; smoke.push(s2); }
      const fl = cyl(0, .8, 2.2, 'gold', x, .25, z, 12, 'rocket flame'); fl.geometry.rotateX(Math.PI); fl.material = new T.MeshBasicMaterial({ color: 0xff8a3d }); mats.add(fl.material); fl.castShadow = false;
      fl.onBeforeRender = () => { const t = (performance.now() / 1000) % 9, on = t < 2.2, k = on ? .7 + .4 * Math.abs(Math.sin(t * 17)) : .001; fl.scale.set(on ? 1 : .001, k, on ? 1 : .001);
        smoke.forEach((s2, i) => { const u = on ? Math.min(1, t / 2.2) : Math.max(0, 1 - (t - 2.2) / 1.5); s2.scale.setScalar(.4 + 1.6 * u + .2 * Math.sin(t * 3 + i)); }); sm.opacity = on ? .55 : Math.max(0, .55 * (1 - (t - 2.2) / 1.5)); }; },
    gantry(o) { // service tower beside the rocket: lattice mast on the gantry deck, swing arm at the capsule, warning light
      const { x, z, y = 3.2, h = 15, armTo } = o, s = .9;
      for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) vbox(x + dx - .12, z + dz - .12, x + dx + .12, z + dz + .12, y, y + h, 'coral', false);
      for (let yy = y + 1.4; yy < y + h; yy += 1.6) { vbox(x - s, z - s - .08, x + s, z - s + .08, yy, yy + .14, 'coral', false); vbox(x - s, z + s - .08, x + s, z + s + .08, yy, yy + .14, 'coral', false); vbox(x - s - .08, z - s, x - s + .08, z + s, yy, yy + .14, 'coral', false); vbox(x + s - .08, z - s, x + s + .08, z + s, yy, yy + .14, 'coral', false); }
      vbox(x - s - .3, z - s - .3, x + s + .3, z + s + .3, y + h, y + h + .3, 'cream', false);
      if (armTo) { const [ax, az] = armTo, ay = y + h - 4; vbox(Math.min(x, ax), z - .35, Math.max(x, ax), z + .35, ay, ay + .5, 'cream', false); vbox(Math.min(x, ax), z - .4, Math.max(x, ax), z + .4, ay + .5, ay + .6, 'coral', true); }
      const lm = new THREE.MeshBasicMaterial({ color: 0xff5a4a }); mats.add(lm); const l = mesh(new THREE.OctahedronGeometry(.3, 0), lm, x, y + h + .7, z, false, 'beacon'); l.onBeforeRender = () => { l.visible = true; lm.color.setHex(((performance.now() / 600) | 0) % 2 ? 0xff5a4a : 0x7a2a22); }; },
    tank(o) { const { x, z, r = 1.4, h = 5, color = 'cream' } = o, q = r * .82; // fuel tank: round to the eye, square hitbox inside it
      sbox(x - q, z - q, x + q, z + q, 0, h, color, 'fuel tank'); mesh(new THREE.CylinderGeometry(r, r, h, 20), material(col(color)), x, h / 2, z, false, 'tank shell');
      mesh(new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(col(color)), x, h, z, false, 'tank dome');
      for (const yy of [.8, h - 1]) mesh(new THREE.CylinderGeometry(r + .04, r + .04, .3, 20), material(col(o.band || 'coral')), x, yy, z, false, 'tank band');
      vbox(x - .1, z - r - .12, x + .1, z - r, .2, h, 'dark', true); },
    crane(o) { const { x, z, h = 13, len = 12, dir = [1, 0], color = 'gold' } = o; // dock crane: solid foot, mast, jib with a hanging container (above head height)
      sbox(x - 1.6, z - 1.6, x + 1.6, z + 1.6, 0, 1, 'stone', 'crane foot'); sbox(x - .8, z - .8, x + .8, z + .8, 1, h, color, 'crane mast');
      const ex = x + dir[0] * len, ez = z + dir[1] * len, bx = x - dir[0] * 4, bz = z - dir[1] * 4;
      vbox(Math.min(bx, ex) - .4, Math.min(bz, ez) - .4, Math.max(bx, ex) + .4, Math.max(bz, ez) + .4, h, h + .7, color, false);
      vbox(bx - 1, bz - 1, bx + 1, bz + 1, h - 1.4, h, 'stone', false); vbox(x - 1.1, z - 1.1, x + 1.1, z + 1.1, h - 2.2, h, 'cream', false);
      vbox(ex - .05, ez - .05, ex + .05, ez + .05, 6.6, h, 'dark', true); vbox(ex - 1.3, ez - 3, ex + 1.3, ez + 3, 4.2, 6.6, o.box || 'coral', false); },
    boat(o) { const { x, z, len = 7, along = 'x', color = 'cyan' } = o, a = along === 'x', L2 = len / 2; // boat on stands: hull is cover
      const R = (u0, v0, u1, v1) => (a ? [x + u0, z + v0, x + u1, z + v1] : [x + v0, z + u0, x + v1, z + u1]);
      const S = (r, y0, y1, c, n) => sbox(r[0], r[1], r[2], r[3], y0, y1, c, n), V = (r, y0, y1, c) => vbox(r[0], r[1], r[2], r[3], y0, y1, c, true);
      S(R(-L2 + .6, -1.2, L2 - .6, 1.2), .3, 1.5, color, 'boat hull'); S(R(-L2, -.8, -L2 + .6, .8), .5, 1.5, color, 'boat hull'); S(R(L2 - .6, -.7, L2, .7), .5, 1.5, color, 'boat hull');
      V(R(-L2 + .5, -1.25, L2 - .5, 1.25), 1.3, 1.45, 'cream'); V(R(-1, -.8, 1.2, .8), 1.5, 2.6, 'cream'); V(R(-1.05, -.85, 1.25, .85), 2.6, 2.75, 'coral');
      V(R(-L2 + 1.2, -.04, -L2 + 1.3, .04), 1.5, 6, 'wood'); for (const u of [-L2 + 1, L2 - 1]) V(R(u - .2, -1, u + .2, 1), 0, .3, 'wood'); },
    kiosk(o) { const { x, z, y = 0, s = 2.2, h = 3, color = 'cream', roof = 'coral' } = o; // open shrine: four pillars, roof, golden cap
      for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) sbox(x + dx - .28, z + dz - .28, x + dx + .28, z + dz + .28, y, y + h, color, 'kiosk pillar');
      sbox(x - s - .6, z - s - .6, x + s + .6, z + s + .6, y + h, y + h + .35, roof, 'kiosk roof'); vbox(x - s - .65, z - s - .65, x + s + .65, z + s + .65, y + h + .12, y + h + .24, 'gold', true);
      const c = mesh(new THREE.CylinderGeometry(0, (s + .6) * Math.SQRT2, 2.2, 4), material(PAL.gold), x, y + h + .35 + 1.1, z, false, 'kiosk cap'); c.rotation.y = Math.PI / 4; },
    well(o) { const { x, z } = o; sbox(x - 1.1, z - 1.1, x + 1.1, z + 1.1, 0, .9, 'stone', 'well'); vbox(x - .8, z - .8, x + .8, z + .8, .9, .92, 'water', true);
      for (const dx of [-1, 1]) vbox(x + dx * 1.0 - .08, z - .08, x + dx * 1.0 + .08, z + .08, .9, 2.6, 'wood', true); vbox(x - 1.4, z - 1.3, x + 1.4, z + 1.3, 2.6, 2.75, 'coral', true); vbox(x - .05, z - .05, x + .05, z + .05, 1.6, 2.6, 'dark', true); },
    urns(o) { const { x0, z0, x1, z1, n = 6, y = 0, seed = 1 } = o; let sd = seed * 9301 + 49297; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280); // visual pots along a strip
      for (let i = 0; i < n; i++) { const px = x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : .5), pz = z0 + (z1 - z0) * (n > 1 ? i / (n - 1) : .5), hh = .5 + r() * .5, rr = .2 + r() * .14, c = ['coral', 'cyan', 'gold', 'peach', 'rose'][Math.floor(r() * 5)];
        const g = new THREE.LatheGeometry([[0, 0], [rr * .7, 0], [rr, hh * .35], [rr * .55, hh * .85], [rr * .62, hh], [0, hh]].map(([a, b]) => new THREE.Vector2(a, b)), 7); // one mesh per pot
        const u = mesh(g, material(col(c)), px, y, pz, false, 'urn'); u.castShadow = false; } },
    frieze(o) { const { x0, z0, x1, z1, y = 2.4, y0 = 0 } = o, along = x1 - x0 >= z1 - z0, len = along ? x1 - x0 : z1 - z0; // painted band + glyph tiles on a wall face (rect is the face strip)
      vbox(x0, z0, x1, z1, y0 + y, y0 + y + .22, 'coral', true); vbox(x0, z0, x1, z1, y0 + y + .36, y0 + y + .48, 'cyan', true);
      for (let k = .5; k < len - .4; k += 1.1) { const a = (along ? x0 : z0) + k, c = ['cyan', 'dark', 'gold', 'coral'][Math.floor(k * 1.7) % 4];
        if (along) vbox(a, z0, a + .4, z1, y0 + 1.2, y0 + 1.75, c, true); else vbox(x0, a, x1, a + .4, y0 + 1.2, y0 + 1.75, c, true); } },
    rug(o) { const { x0, z0, x1, z1, y = 0, c1 = 'coral', c2 = 'gold' } = o; vbox(x0, z0, x1, z1, y + .016, y + .028, c1, true); vbox(x0 + .3, z0 + .3, x1 - .3, z1 - .3, y + .028, y + .034, c2, true); vbox(x0 + .6, z0 + .6, x1 - .6, z1 - .6, y + .034, y + .04, c1, true); },
    pier(o) { const { x0, z0, x1, z1 } = o, alongX = x1 - x0 >= z1 - z0; // wooden boardwalk (visual) with posts
      const L2 = alongX ? x1 - x0 : z1 - z0; for (let a = 0; a < L2; a += .5) { const p = (alongX ? x0 : z0) + a, c = Math.floor(a * 2) % 2 ? 'wood' : 'peach'; if (alongX) vbox(p, z0, p + .45, z1, .02, .09, c, true); else vbox(x0, p, x1, p + .45, .02, .09, c, true); }
      for (let a = 0; a <= L2; a += 3) { const p = (alongX ? x0 : z0) + a; if (alongX) { vbox(p - .1, z0 - .1, p + .1, z0 + .1, 0, .9, 'wood', true); vbox(p - .1, z1 - .1, p + .1, z1 + .1, 0, .9, 'wood', true); } else { vbox(x0 - .1, p - .1, x0 + .1, p + .1, 0, .9, 'wood', true); vbox(x1 - .1, p - .1, x1 + .1, p + .1, 0, .9, 'wood', true); } } },
    wtree(o) { const { x, z, k = 1, tx = 0, tz = 0, ry = 0 } = o; const T = THREE;
      sbox(x - .22 * k, z - .22 * k, x + .22 * k, z + .22 * k, 0, 2.4 * k, 0x8d7061, 'tree trunk');
      const g = new T.IcosahedronGeometry(1.35 * k, 0); const m = mesh(g, material(k > 1.1 ? PAL.green : PAL.mint), x, 3.1 * k, z, false, 'tree crown'); m.scale.set(1, .85 + .25 * (k - .8), 1); m.rotation.set(tx, ry, tz); m.castShadow = true; },
    rocket(o) { const { x, z } = o; const T = THREE;
      sbox(x - 3.2, z - 3.2, x + 3.2, z + 3.2, 0, .3, 'stone', 'rocket pad');
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) sbox(x + dx - .15, z + dz - .15, x + dx + .15, z + dz + .15, .3, 1.2, 'dark', 'rocket leg');
      sbox(x - 1, z - 1, x + 1, z + 1, 1.2, 9, 'cream', 'rocket'); sbox(x - 1.01, z - 1.01, x + 1.01, z + 1.01, 5.2, 5.8, 'coral', 'rocket stripe');
      sbox(x - 2.2, z - .15, x + 2.2, z + .15, 1.2, 3.6, 'coral', 'rocket fin'); sbox(x - .15, z - 2.2, x + .15, z + 2.2, 1.2, 3.6, 'coral', 'rocket fin');
      mesh(new T.CylinderGeometry(0, 1.25, 3.2, 8), material(PAL.coral), x, 10.6, z, false, 'rocket nose');
      mesh(new T.CircleGeometry(.5, 12), material(PAL.cyan, true), x, 7.2, z - 1.02, false, 'rocket window');
      [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]].forEach(([dx, dz], i) => { const g = new T.CylinderGeometry(0, .45, 1.3, 8); g.rotateX(Math.PI);
        const f = mesh(g, material(i % 2 ? 0xffb347 : 0xff6a3d, true), x + dx, .55, z + dz, false, 'rocket flame'); f.castShadow = false; f.scale.y = .001; const ph = i * .35;
        f.onBeforeRender = () => { const t = ((performance.now() / 1000) + ph * .2) % 7; f.scale.y = t < 1.8 ? .6 + .5 * Math.abs(Math.sin(t * 14)) : .001; f.scale.x = f.scale.z = f.scale.y > .01 ? 1 : .001; }; }); },
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
      const hb = mesh(new THREE.SphereGeometry(.35, 8, 6), material(PAL.coral), hub.position.x, hub.position.y, hub.position.z, false, 'windmill hub'); hb.onBeforeRender = () => { hub.rotation.z = -performance.now() / 1000 * .6; }; },
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
  for (const [x0, z0, x1, z1, c = 'sand'] of L.sand || []) vbox(x0, z0, x1, z1, .004, .016, c);
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
  for (const [x0, z0, x1, z1, h] of [[-H - 1, -H - 1, H + 1, -H, 7], [-H - 1, H, H + 1, H + 1, 7], [-H - 1, -H, -H, H, 7], [H, -H, H + 1, H, 7]]) { sbox(x0, z0, x1, z1, 0, h, 'cream', 'perimeter');
    if (L.crenel) { const ax = x1 - x0 > z1 - z0; for (let a = (ax ? x0 : z0) + .6; a < (ax ? x1 : z1) - 1; a += 2.2) if (ax) vbox(a, z0 - .08, a + 1.1, z1 + .08, h, h + .8, L.crenel, true); else vbox(x0 - .08, a, x1 + .08, a + 1.1, h, h + .8, L.crenel, true); } }
  flushBatches();
  for (const [x, z, r] of L.hills || [[-60, -80, 30], [45, -85, 40], [-90, 10, 35], [90, 10, 30], [60, 70, 32], [-50, 85, 30]]) mesh(new THREE.SphereGeometry(r, 16, 8), material(0x92baa1), x, -r * .6, z, false, 'hill');
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const spawnPoints = [];
  for (const team of ['T', 'CT', 'Z']) for (const [x, z] of (L.spawns[team] || [])) spawnPoints.push({ position: V3(x, 0, z), yaw: team === 'T' ? 0 : team === 'CT' ? Math.PI : Math.atan2(x, z), team });
  const lights = new THREE.Group(); lights.add(new THREE.HemisphereLight(0xcceeff, 0x8cad72, 2));
  const sun = new THREE.DirectionalLight(0xfff3df, 2); sun.position.set(-30, 55, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const SE = L.shadow || 56; Object.assign(sun.shadow.camera, { left: -SE, right: SE, top: SE, bottom: -SE, near: 1, far: 150 + Math.max(0, SE - 56) * 2 }); sun.shadow.bias = -.001; sun.shadow.normalBias = .025; lights.add(sun); group.add(lights);
  // ---------- heights + navigation ----------
  function getHeight(x, z) {
    if (x < -H || x > H || z < -H || z > H) return -Infinity;
    if (L.voids) for (const v of L.voids) if (x > v[0] && x < v[2] && z > v[1] && z < v[3]) return -Infinity; // walled-off space: never walkable
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
  { // random roam targets stay on the main connected area (e.g. pyramid tier rings cut by passage roofs are bot islands)
    const comp = new Int32Array(N).fill(-1); let best = 0, bestN = 0, id = 0;
    for (const s of valid) { if (comp[s] >= 0) continue; const q = [s]; comp[s] = id; let n = 0;
      while (q.length) { const i = q.pop(), c = i % cols, r = (i / cols) | 0; n++;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue; const j = nr * cols + nc;
          if (!walkable[j] || comp[j] >= 0 || Math.abs(height[j] - height[i]) > (stairCell[j] && stairCell[i] ? .56 : STEP)) continue; comp[j] = id; q.push(j); } }
      if (n > bestN) { bestN = n; best = id; } id++; }
    if (id > 1) { const main = valid.filter((i) => comp[i] === best); valid.length = 0; valid.push(...main); }
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
  const Av = V3(A.x, A.y, A.z), Bv = V3(B.x, B.y, B.z); discLabel('A', Av, 'coral'); discLabel('B', Bv, 'cyan'); const Cv = L.sites.C ? V3(L.sites.C.x, L.sites.C.y, L.sites.C.z) : null; if (Cv) discLabel('C', Cv, 'gold');
  const bombsites = {}; for (const [k, v] of Object.entries(Cv ? { A: Av, B: Bv, C: Cv } : { A: Av, B: Bv })) bombsites[k] = { center: v.clone(), radius: 4, box: new THREE.Box3(V3(v.x - 4, v.y - 1, v.z - 4), V3(v.x + 4, v.y + 3, v.z + 4)) };
  // palm trees: shared by the renderer (graphics.js), the server and bots so trunks block players, cars and bullets
  const palmSpots = []; { const wp = new THREE.Vector3(); let ci = 0; group.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'ConeGeometry') { if (o.name === 'plant' && ci % 2 === 0) { o.getWorldPosition(wp); palmSpots.push({ x: wp.x, z: wp.z, s: 1.05, y0: 0 }); } ci++; } });
    const fr = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.2832 + (fr(i + 1) - .5) * .3, rad = H + 13 + fr(i + 20) * 6; palmSpots.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, s: .9 + fr(i + 40) * .6, y0: -.35 }); }
    for (const [x, z, sc = 1.1] of L.palms || []) palmSpots.push({ x, z, s: sc, y0: 0 });
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
// ======================= KITE PLAZA v14 (3-team map, own layout; Kite Garden above stays untouched) =======================
// Three spawns in a triangle, a site between every pair, the Great Pyramid as MID:
//   T (orange) south harbor gate  |  Z (green) north-west palm oasis  |  CT (cyan) north-east old town
//   A BAZAAR (west, between T and Z)  |  B LAUNCH PAD (east, between T and CT, the rocket is the site)  |  C SPHINX TEMPLE (north, between Z and CT)
// Every spawn has three exits: left site, right site, and mid (pyramid). Connector buildings: Inn (T->A), Mission Control (T->B),
// Bakery (Z lane <-> mid), Clock Hall (CT lane <-> mid). Mirror-fair between Z and CT; themes differ per side.
const PYR = { x: 0, z: -2 };
const PSTAIRS = [ // switch-back flights (<= .19 m treads so bots climb too): west face (A side) and east face (B side)
  [-21, -11, -13, -7, 'x', 0, 3.4], [-13, -7, -9.5, -2, 'z', 3.4, 5.6], [-9.5, -8, -6, -2, 'z', 7.8, 5.6],
  [13, 3, 21, 7, 'x', 3.4, 0], [9.5, -2, 13, 3, 'z', 5.6, 3.4], [6, -2, 9.5, 4, 'z', 5.6, 7.8]].map((q) => [...q, 'peach', ['gold', 'cream']]);
const pw = (x0, z0, x1, z1, o = {}) => [x0, z0, x1, z1, { h: 7, color: 'cream', name: 'perimeter', crenel: 'sand', plain: true, ...o }];
const cw = (x0, z0, x1, z1, color, o = {}) => [x0, z0, x1, z1, { h: 4.6, color, name: 'court wall', ...o }];
const lowc = (x0, z0, x1, z1, color = 'stone', h = 1.2, name = 'low wall') => [x0, z0, x1, z1, { h, color, name, trim: false }];
const hedge = (x0, z0, x1, z1, h = 1.3) => [x0, z0, x1, z1, { h, color: 'green', name: 'hedge', trim: false, plain: true }];
const col = (x, z, h, o = {}) => ({ type: 'column', x, z, h, ...o });
export const KITE_PLAZA = {
  name: 'Kite Plaza', version: 14, half: 60, plateau: 1.6, shadow: 66, crenel: 'sand',
  hills: [[-80, -95, 32], [45, -98, 40], [-100, 10, 36], [100, 10, 30], [66, 92, 32], [-62, 95, 30]],
  voids: [[-61, 57, 61, 75]],
  sand: [[-24, -34, 24, 18], [-6, 18, 6, 41], [-24, -60, 24, -34], [-60, -60, -24, -43], [-60, -20, -40, 4], [-60, 4, -24, 36], [-60, 37, -13, 56],
    [24, 4, 60, 36, 'stone'], [13, 37, 60, 56, 'stone'], [-12, 41, 12, 56, 'tile']],
  sites: { A: { x: -42, y: 0, z: 20 }, B: { x: 42, y: .3, z: 20 }, C: { x: 0, y: 1.6, z: -47 } },
  spawns: { T: [[-8, 50], [-4, 50], [0, 50], [4, 50], [8, 50]], CT: [[54, -34], [50, -34], [46, -34], [52, -30], [48, -30]], Z: [[-54, -34], [-50, -34], [-46, -34], [-52, -30], [-48, -30]] },
  paths: [[-6, 18, 6, 32], [-3, 32, 3, 41], [-2, -24, 2, -15], [-24, 4, -13, 9], [13, 4, 24, 9], [-24, -14, -13, -11], [13, -14, 24, -11],
    [-56, -20, -50, 4], [50, -20, 56, 4], [-52, -43, -46, -60], [46, -60, 52, -43], [-38, 46, -14, 50], [14, 46, 38, 50], [-24, -50, -14, -48], [14, -50, 24, -48]].map((r) => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]),
  blocks: [
    [-14, -60, 14, -40, 1.6, 'edge', 'tile', 'temple platform'],
    [-60, 26, -50, 36, 1.6, 'edge', 'tile', 'tea terrace'],
    [48, 14, 54, 22, 3.2, 'metal', 'tile', 'gantry deck'],
  ],
  ramps: [[-22, -52, -14, -47, 'x', 0, 1.6, 'peach'], [14, -52, 22, -47, 'x', 1.6, 0, 'peach'], [-58, 20, -54, 26, 'z', 0, 1.6, 'purple']],
  stairs: [[-6, -40, 6, -35, 'z', 1.6, 0, 'peach', ['gold', 'cream']], [-50, 29, -46, 33, 'x', 1.6, 0, 'purple'], [50, 22, 54, 30, 'z', 3.2, 0, 'metal', ['cream', 'gold']], ...PSTAIRS],
  walls: [
    pw(-60, 56, 60, 57),
    // ---- T court + Sun Gate (screen blocks the summit -> spawn line) ----
    cw(-12, 41, 12, 42, 'coral', { open: [[-3, 3]] }), cw(-13, 36, -12, 56, 'coral', { open: [[45, 51]] }), cw(12, 36, 13, 56, 'coral', { open: [[45, 51]] }),
    [-12, 36, -7, 41, { h: 4.6, color: 'sand', name: 'gatehouse' }], [7, 36, 12, 41, { h: 4.6, color: 'sand', name: 'gatehouse' }],
    [-3.5, 35.5, 3.5, 36.5, { h: 4.6, color: 'coral', name: 'sun gate screen', open: [[-1, 1, 1.2, 2.2]] }],
    // ---- Z court (palm oasis) / CT court (old town) ----
    cw(-41, -42, -40, -24, 'mint', { open: [[-34, -28]] }), cw(-60, -43, -40, -42, 'mint', { open: [[-52, -46]] }), cw(-60, -20, -40, -19, 'mint', { open: [[-56, -50]] }),
    cw(40, -42, 41, -24, 'cyan', { open: [[-34, -28]] }), cw(40, -43, 60, -42, 'cyan', { open: [[46, 52]] }), cw(40, -20, 60, -19, 'cyan', { open: [[50, 56]] }),
    lowc(-44.5, -36, -43.5, -29, 'mint', 2.4, 'spawn screen'), lowc(43.5, -36, 44.5, -29, 'cyan', 2.4, 'spawn screen'),
    lowc(-10.5, 44, -9.5, 52, 'coral', 2.4, 'spawn screen'), lowc(9.5, 44, 10.5, 52, 'coral', 2.4, 'spawn screen'),
    lowc(-56.5, -23.5, -49.5, -22.5, 'mint', 3.2, 'spawn screen'), lowc(49.5, -23.5, 56.5, -22.5, 'cyan', 3.2, 'spawn screen'),
    lowc(-52.5, -39.5, -45.5, -38.5, 'mint', 3.2, 'spawn screen'), lowc(45.5, -39.5, 52.5, -38.5, 'cyan', 3.2, 'spawn screen'),
    // ---- gardens: tall hedge to the necropolis / windmill yard, low hedges inside ----
    hedge(-40, -43, -24, -42, 3.2), hedge(24, -43, 40, -42, 3.2),
    hedge(-37, -38, -31, -37), hedge(-29, -32, -28, -27), hedge(-37, -27, -33, -26), hedge(31, -38, 37, -37), hedge(28, -32, 29, -27), hedge(33, -27, 37, -26),
    // ---- C precinct ----
    [-25, -60, -24, -34, { h: 4.6, color: 'sand', name: 'precinct wall', open: [[-54, -46]], plain: true, crenel: 'gold' }], [24, -60, 25, -34, { h: 4.6, color: 'sand', name: 'precinct wall', open: [[-54, -46]], plain: true, crenel: 'gold' }],
    [-24, -35, -9, -34, { h: 4.6, color: 'sand', name: 'precinct wall', plain: true, crenel: 'gold' }], [9, -35, 24, -34, { h: 4.6, color: 'sand', name: 'precinct wall', plain: true, crenel: 'gold' }],
    [-14, -40.35, -6, -40, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }], [6, -40.35, 14, -40, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }],
    [-14, -60, -13.65, -52, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }], [13.65, -60, 14, -52, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }],
    [-14, -47, -13.65, -43, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }], [13.65, -47, 14, -43, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }],
    [-6.5, -46, -3.5, -44.6, { y0: 1.6, h: 1.1, color: 'gold', name: 'altar', trim: false }], [3.5, -49.4, 6.5, -48, { y0: 1.6, h: 1.1, color: 'gold', name: 'altar', trim: false }],
    lowc(-22, -40, -18, -39), lowc(18, -40, 22, -39),
    [-55, -56, -53, -54.6, { h: 1.0, color: 'gold', name: 'sarcophagus', trim: false }], [-35, -57.2, -32.4, -56, { h: 1.0, color: 'gold', name: 'sarcophagus', trim: false }],
    lowc(-58.5, -27, -58, -24, 'wood', .5, 'bench'), lowc(58, -27, 58.5, -24, 'wood', .5, 'bench'), lowc(-11.5, 43, -11, 46, 'wood', .5, 'bench'), lowc(11, 43, 11.5, 46, 'wood', .5, 'bench'),
    // ---- A bazaar ----
    [-25, 4, -24, 18, { h: 4.6, color: 'sand', name: 'bazaar wall', open: [[4, 9]] }], [-60, 36, -24, 37, { h: 4.6, color: 'sand', name: 'bazaar wall', open: [[-52, -46], [-32, -25]] }],
    [-46, 9, -42, 10, { h: 3.2, color: 'coral', name: 'spice wall' }], [-37, 13, -36, 18, { h: 3.2, color: 'gold', name: 'spice wall' }], [-55, 13, -51, 14, { h: 3.2, color: 'cyan', name: 'spice wall' }],
    [-35, 7, -29, 8, { h: 1.1, color: 'wood', name: 'stall counter', trim: false }], [-58, 7, -53, 8, { h: 1.1, color: 'wood', name: 'stall counter', trim: false }], [-47, 30, -43, 31, { h: 1.1, color: 'wood', name: 'stall counter', trim: false }],
    [-50.35, 26, -50, 29, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }], [-50.35, 33, -50, 36, { y0: 1.6, h: .95, color: 'cream', trim: false, name: 'parapet' }],
    // ---- B launch pad ----
    [24, 4, 25, 18, { h: 4.6, color: 'sand', name: 'pad wall', open: [[4, 9]] }], [24, 36, 60, 37, { h: 4.6, color: 'sand', name: 'pad wall', open: [[25, 32], [46, 52]] }],
    lowc(35, 26, 39, 27, 'stone', 1.3, 'blast wall'), lowc(45, 11, 47, 12, 'stone', 1.3, 'blast wall'), lowc(36, 12, 37, 16, 'stone', 1.3, 'blast wall'), lowc(46, 28, 50, 29, 'stone', 1.3, 'blast wall'),
    [48, 14, 48.3, 22, { y0: 3.2, h: 1.0, color: 'cream', trim: false, name: 'railing' }], [48, 14, 54, 14.3, { y0: 3.2, h: 1.0, color: 'cream', trim: false, name: 'railing' }],
    // ---- oasis lane / old town street ----
    lowc(-48, -12, -46, -11, 'sand'), lowc(-44, 0, -41, 1, 'sand', 1.2), lowc(46, -12, 48, -11), lowc(41, 0, 44, 1, 'stone', 1.2),
    // ---- harbor / docks ----
    lowc(-30, 42, -26, 43, 'wood', 1.2, 'net rack'), lowc(26, 42, 30, 43, 'stone', 1.2, 'bollard wall'),
  ],
  buildings: [
    { name: 'harbor inn', x0: -24, z0: 18, x1: -6, z1: 36, h: 4.6, color: 'cream', roof: 'roof', awning: 'coral', doors: { E: [[22, 25]], W: [[28, 31]] }, windows: { N: [[-20, -18], [-11, -9]], S: [[-21, -19]] },
      inner: [[-17, 18, -16, 30], [-13, 20, -9, 21, { h: 1.1, name: 'bar counter', color: 'wood' }], [-22, 33, -19, 34, { h: 1.1, name: 'bench', color: 'wood' }]] },
    { name: 'mission control', x0: 6, z0: 18, x1: 24, z1: 36, h: 4.6, color: 'purple', roof: 'roof', awning: 'cyan', floor: 'stone', doors: { W: [[22, 25]], E: [[28, 31]] }, windows: { N: [[9, 11], [18, 20]], S: [[19, 21]] },
      inner: [[16, 18, 17, 30], [9, 20, 13, 21, { h: 1.1, name: 'console', color: 'metal' }], [19, 33, 22, 34, { h: 1.1, name: 'console', color: 'metal' }]] },
    { name: 'bakery', x0: -40, z0: -24, x1: -24, z1: 4, h: 4.6, color: 'coral', roof: 'roof', awning: 'gold', doors: { E: [[-14, -11]], W: [[-7, -4]] }, windows: { N: [[-36, -33], [-30, -27]], S: [[-36, -33]], E: [[-2, 0]] },
      inner: [[-34, -10, -25, -9], [-38, -20, -35, -19, { h: 1.1, name: 'oven counter', color: 'wood' }], [-31, -3, -27, -2, { h: 1.1, name: 'bread counter', color: 'wood' }]] },
    { name: 'clock hall', x0: 24, z0: -24, x1: 40, z1: 4, h: 4.6, color: 'cyan', roof: 'roof', awning: 'coral', doors: { W: [[-14, -11]], E: [[-7, -4]] }, windows: { N: [[27, 30], [33, 36]], S: [[33, 36]], W: [[-2, 0]] },
      inner: [[25, -10, 34, -9], [35, -20, 38, -19, { h: 1.1, name: 'bench', color: 'wood' }], [27, -3, 31, -2, { h: 1.1, name: 'bench', color: 'wood' }]] },
    { name: 'bazaar hall', x0: -36, z0: 22, x1: -27, z1: 33, h: 4.2, color: 'peach', roof: 'roof', awning: 'cyan', doors: { W: [[26, 29]], N: [[-33, -30]] }, windows: { E: [[27, 29]], S: [[-33, -31]] },
      inner: [[-34, 30, -31, 31, { h: 1.1, name: 'rug stack', color: 'rose' }]] },
    { name: 'west tomb', x0: -58, z0: -58, x1: -49, z1: -49, h: 3.6, color: 'sand', roof: 'gold', awning: 'cyan', floor: 'stone', doors: { E: [[-55, -52]], S: [[-55, -53]] } },
    { name: 'east tomb', x0: -38, z0: -58, x1: -30, z1: -50, h: 3.6, color: 'sand', roof: 'gold', awning: 'coral', floor: 'stone', doors: { W: [[-55, -53]], S: [[-35, -33]] } },
    { name: 'hay shed', x0: 28, z0: -58, x1: 37, z1: -50, h: 3.8, color: 'brick', roof: 'roof', awning: 'gold', doors: { W: [[-55, -52]], S: [[32, 34]] }, windows: { E: [[-56, -54]] } },
    { name: 'old house', x0: 54, z0: -16, x1: 60, z1: -5, h: 4.4, color: 'rose', roof: 'roof', awning: 'cyan', doors: { W: [[-13, -11]] }, windows: { W: [[-8, -6]], N: [[56, 58]] } },
    { name: 'boat shed', x0: -46, z0: 42, x1: -36, z1: 52, h: 4.2, color: 'cyan', roof: 'roof', awning: 'coral', doors: { E: [[45, 48]], N: [[-43, -40]] }, windows: { W: [[46, 48]], S: [[-43, -41]] } },
    { name: 'dock warehouse', x0: 48, z0: 42, x1: 58, z1: 52, h: 4.6, color: 'brick', roof: 'roof', awning: 'gold', floor: 'stone', doors: { W: [[45, 48]], N: [[51, 54]] }, windows: { S: [[51, 53]] } },
  ],
  covers: [[-6, 26, 2.4, 1.6, 1.2], [4.5, 29, 1.6, 2.4, 1.2], [-3, 22, 1.6, 2.4, 1.2], // avenue
    [-20, -20, 2.4, 1.6, 1.2], [20, -20, 2.4, 1.6, 1.2], [-19, 15, 2.4, 1.6, 1.2], [19, 15, 2.4, 1.6, 1.2], [-9, 14.5, 2.4, 1.6, 1.2], [9, 14.5, 2.4, 1.6, 1.2], // plaza
    [-48, -27, 1.6, 2.4, 1.2], [48, -27, 1.6, 2.4, 1.2], [-31, -40, 2.4, 1.6, 1.2], [31, -40, 2.4, 1.6, 1.2], // courts / gardens
    [-40, 16, 2.4, 1.6, 1.2], [-47, 24, 1.6, 2.4, 1.2], [-33, 18, 1.6, 2.4, 1.2], // A
    [-52, -2, 2.4, 1.6, 1.2], [52, -2, 2.4, 1.6, 1.2], [-6, 46, 2.4, 1.6, 1.2], [6, 46, 2.4, 1.6, 1.2]],
  crates: [[-30, 11, 1.4, 1.4, 1.2, 0], [-49, 16.5, 1.4, 1.4, 1.2, 0], [-38, 25, 1.4, 1.4, 1.2, 0], [-56, 12, 1.4, 1.4, 1.2, 0], // A
    [33, 22, 1.4, 1.4, 1.2, 0], [38, 9, 1.4, 1.4, 1.2, 0], [47, 25.5, 1.4, 1.4, 1.2, 0], [57, 12, 1.4, 1.4, 1.2, 0], // B
    [-20, -44, 1.4, 1.4, 1.2, 0], [20, -44, 1.4, 1.4, 1.2, 0], [-19, -58, 1.4, 1.4, 1.2, 0], [19, -58, 1.4, 1.4, 1.2, 0], // C yards
    [-56, -46, 1.4, 1.4, 1.2, 0], [-42, -46, 1.4, 1.4, 1.2, 0], [56, -46, 1.4, 1.4, 1.2, 0], [42, -46, 1.4, 1.4, 1.2, 0], [33, -46, 1.4, 1.4, 1.2, 0], // necropolis / yard
    [-58, -16, 1.4, 1.4, 1.2, 0], [-42, -16, 1.4, 1.4, 1.2, 0], [58, 0, 1.4, 1.4, 1.2, 0], [42, -16, 1.4, 1.4, 1.2, 0], // lanes
    [-22, 39, 1.4, 1.4, 1.2, 0], [-52, 40, 1.4, 1.4, 1.2, 0], [-16, 54, 1.4, 1.4, 1.2, 0], [-33, 54, 1.4, 1.4, 1.2, 0], // harbor
    [22, 39, 1.4, 1.4, 1.2, 0], [16, 54, 1.4, 1.4, 1.2, 0], [35, 53, 1.4, 1.4, 1.2, 0], [44, 39.5, 1.4, 1.4, 1.2, 0]], // docks
  palms: [[-57, -39.5, 1.2], [-43, -39.5, 1.0], [-57.5, -22.5, 1.1], [57, -39.5, 1.15], [43, -39.5, 1.0], [57.5, -22.5, 1.05], // courts
    [-58, -9, 1.25], [-58, -5, 1.0], [-49.5, -15.5, 1.1], [-47.5, 2.5, 1.0], // oasis
    [-59, -45.5, 1.2], [-46.5, -59, 1.1], [-27, -46, 1.0], [-44, -55, 1.3], // necropolis
    [-22, -22, 1.1], [22, -22, 1.1], [-22, 16, 1.0], [22, 16, 1.0], // plaza corners
    [-58.5, 9, 1.1], [-26, 34.5, 1.0], [-58.5, 38.5, 1.2], [-15, 38.5, 1.0], [58, 54.5, 1.1], [-58, 54.5, 1.2], [-9.5, 54.5, 1.0], [9.5, 54.5, 1.0]],
  landmarks: [
    // ---- MID: Great Pyramid with a pinwheel of halls into a crossroads chamber (sun pillar in the middle), drop shaft from the summit ----
    { type: 'greatPyramid', x: PYR.x, z: PYR.z, tiers: [[13, 3.4], [9.5, 5.6], [6, 7.8]], ceil: 3, chamber: [-5, -7, 5, 3, 5],
      halls: [[1, 3, 4, 11], [-4, -15, -1, -7], [-13, -1, -5, 2], [5, -6, 13, -3]], oculus: [2.4, -.4, 4.4, 1.6], colors: ['gold', 'peach'], gaps: PSTAIRS.map((q) => q.slice(0, 4)), shrine: 4.5 },
    col(0, -2, 5, { w: 3.2, cap: false, glyph: true, color: 'gold' }),
    { type: 'urns', x0: -4.4, z0: 2.4, x1: -1.6, z1: 2.4, n: 4, seed: 3 }, { type: 'urns', x0: 4.4, z0: -6.4, x1: 4.4, z1: -4.2, n: 3, seed: 5 },
    { type: 'spinner', x: PYR.x, y: 24, z: PYR.z, size: 2.2, color: 'gold' },
    { type: 'obelisk', x: -20.5, z: -16, h: 6.5 }, { type: 'obelisk', x: 20.5, z: -16, h: 6.5 }, { type: 'obelisk', x: -16, z: 15.5, h: 5.5 }, { type: 'obelisk', x: 16, z: 15.5, h: 5.5 },
    { type: 'torch', x: -0.5, z: 12 }, { type: 'torch', x: 5.5, z: 12 }, { type: 'torch', x: -5.5, z: -16 }, { type: 'torch', x: .5, z: -16 }, { type: 'torch', x: -14, z: -2.5 }, { type: 'torch', x: -14, z: 3 }, { type: 'torch', x: 14, z: -7 }, { type: 'torch', x: 14, z: -2 },
    // ---- C: Sphinx Temple ----
    { type: 'sphinx', x: -14, z: -29, face: 'S', compact: { z: -27.4, s: .78 } }, { type: 'sphinx', x: 14, z: -29, face: 'S', compact: { z: -27.4, s: .78 } },
    { type: 'kiosk', x: 0, z: -53, y: 1.6, s: 2.2, h: 3.2 }, { type: 'obelisk', x: -12, z: -42, y: 1.6, h: 5.5 }, { type: 'obelisk', x: 12, z: -42, y: 1.6, h: 5.5 }, { type: 'obelisk', x: -12, z: -54.5, y: 1.6, h: 5 }, { type: 'obelisk', x: 12, z: -54.5, y: 1.6, h: 5 },
    col(-8.5, -51, 2.2, { y: 1.6, cap: false, glyph: true }), col(8.5, -43, 3.4, { y: 1.6, glyph: true }), { type: 'column', x: -8, z: -43.5, fallen: 2.6, y: 1.6 },
    { type: 'urns', x0: -6, z0: -55.5, x1: -3, z1: -55.5, n: 4, y: 1.6, seed: 7 }, { type: 'urns', x0: 3, z0: -55.5, x1: 6, z1: -55.5, n: 4, y: 1.6, seed: 9 },
    { type: 'frieze', x0: -24, z0: -35.04, x1: -9, z1: -35, y: 2.6 }, { type: 'frieze', x0: 9, z0: -35.04, x1: 24, z1: -35, y: 2.6 }, { type: 'frieze', x0: -23.96, z0: -60, x1: -23.92, z1: -54, y: 2.6 }, { type: 'frieze', x0: 23.92, z0: -60, x1: 23.96, z1: -54, y: 2.6 },
    { type: 'torch', x: -7, z: -34 }, { type: 'torch', x: 7, z: -34 }, { type: 'torch', x: -23, z: -55.5 }, { type: 'torch', x: 23, z: -55.5 },
    { type: 'rug', x0: -5, z0: -31, x1: 5, z1: -26, c1: 'gold', c2: 'cyan' }, { type: 'rug', x0: -3, z0: -23.5, x1: 3, z1: -19, c1: 'coral', c2: 'gold' }, // sun mosaics
    { type: 'torch', x: -10, z: -32.5 }, { type: 'torch', x: 10, z: -32.5 }, { type: 'torch', x: -10, z: -25.5 }, { type: 'torch', x: 10, z: -25.5 },
    { type: 'column', x: -21, z: -30.5, fallen: -3 }, col(21, -31, 2.4, { cap: false, glyph: true }), { type: 'urns', x0: -23.2, z0: -26, x1: -23.2, z1: -24.4, n: 2, seed: 21 }, { type: 'urns', x0: 23.2, z0: -27, x1: 23.2, z1: -24.4, n: 3, seed: 23 },
    { type: 'frieze', x0: -57.96, z0: -57, x1: -57.92, z1: -50, y: 1.4 }, { type: 'frieze', x0: -49.96, z0: -57, x1: -49.92, z1: -50, y: 1.4 }, { type: 'frieze', x0: -37, z0: -57.04, x1: -31, z1: -57, y: 1.4 },
    { type: 'urns', x0: -57, z0: -57, x1: -51, z1: -57, n: 5, seed: 25 }, { type: 'urns', x0: -37, z0: -51, x1: -31, z1: -51, n: 4, seed: 27 },
    { type: 'rug', x0: -56, z0: -55, x1: -52, z1: -52, c1: 'cyan', c2: 'gold' }, { type: 'rug', x0: -36, z0: -56, x1: -32, z1: -53, c1: 'coral', c2: 'gold' },
    { type: 'frieze', x0: 28.04, z0: -57, x1: 28.08, z1: -51, y: 1.4 }, { type: 'urns', x0: 29, z0: -57, x1: 36, z1: -57, n: 4, seed: 29 },
    // ---- spawn courts: benches, planters, kites ----
    { type: 'urns', x0: -59, z0: -40, x1: -59, z1: -24, n: 6, seed: 31 }, { type: 'urns', x0: 59, z0: -40, x1: 59, z1: -24, n: 6, seed: 33 }, { type: 'urns', x0: -11, z0: 55, x1: 11, z1: 55, n: 8, seed: 35 },
    { type: 'rug', x0: -6, z0: 47.5, x1: 6, z1: 52.5, c1: 'coral', c2: 'gold' }, { type: 'rug', x0: -55, z0: -36, x1: -45, z1: -28, c1: 'mint', c2: 'cream' }, { type: 'rug', x0: 45, z0: -36, x1: 55, z1: -28, c1: 'cyan', c2: 'cream' },
    // ---- A: Bazaar ----
    { type: 'canopy', x0: -35.5, z0: 5.5, x1: -28.5, z1: 9.5, c1: 'coral', c2: 'cream' }, { type: 'canopy', x0: -58.5, z0: 5.5, x1: -52.5, z1: 9.5, c1: 'cyan', c2: 'cream' }, { type: 'canopy', x0: -47.5, z0: 29, x1: -42.5, z1: 32.5, c1: 'gold', c2: 'peach' },
    { type: 'canopy', x0: -59.5, z0: 30, x1: -51, z1: 35.5, y: 4.4, c1: 'rose', c2: 'cream' }, { type: 'well', x: -50, z: 18 }, { type: 'rug', x0: -34, z0: 24, x1: -29, z1: 28 }, { type: 'urns', x0: -59, z0: 15, x1: -59, z1: 24, n: 6, seed: 11 },
    { type: 'urns', x0: -58, z0: 34.6, x1: -52, z1: 34.6, n: 5, y: 1.6, seed: 13 }, { type: 'banner', x: -42, z: 4.5, y: 4, w: 8, rot: 0, color: 'coral' }, { type: 'banner', x: -24.5, z: 6.5, y: 3.6, w: 5, rot: Math.PI / 2, color: 'gold' },
    // ---- B: Launch Pad ----
    { type: 'bigRocket', x: 42, z: 20 }, { type: 'gantry', x: 49.2, z: 15.2, y: 3.2, h: 14, armTo: [43.4, 15.2] },
    { type: 'tank', x: 30.5, z: 13, color: 'cream', band: 'coral' }, { type: 'tank', x: 34.5, z: 13, r: 1.2, h: 4.2, color: 'mint', band: 'cyan' },
    { type: 'container', x0: 27, z0: 26, x1: 31, z1: 28.4, color: 'cyan' }, { type: 'container', x0: 54, z0: 27, x1: 58, z1: 29.4, color: 'coral' }, { type: 'container', x0: 55, z0: 31, x1: 57.4, z1: 35, color: 'gold' },
    { type: 'torch', x: 36.5, z: 26.5, h: 1.6 }, { type: 'banner', x: 42, z: 4.5, y: 4, w: 8, rot: 0, color: 'cyan' }, { type: 'banner', x: 24.5, z: 6.5, y: 3.6, w: 5, rot: Math.PI / 2, color: 'coral' },
    // ---- Z court + oasis lane ----
    { type: 'pool', x0: -58, z0: -14, x1: -50, z1: -6 }, col(-44, -8, 3.2, { glyph: true }), col(-44, -4, 1.6, { cap: false }), { type: 'column', x: -46, z: -16, fallen: 3 },
    { type: 'fountain', x: -32, z: -33 }, { type: 'kiosk', x: -50, z: -26, s: 1.6, h: 2.8, color: 'mint', roof: 'cyan' },
    // ---- CT court + old town street ----
    { type: 'fountain', x: 32, z: -33 }, { type: 'kiosk', x: 50, z: -26, s: 1.6, h: 2.8, color: 'cyan', roof: 'coral' },
    { type: 'canopy', x0: 42, z0: -9, x1: 48, z1: -5, c1: 'coral', c2: 'cream' }, { type: 'canopy', x0: 44, z0: 0.5, x1: 50, z1: 3.5, c1: 'gold', c2: 'cream' },
    { type: 'clock', x: 32, z: -10, y: 4.95, w: 4, h: 5 }, { type: 'lantern', x: 45, z: -18 }, { type: 'lantern', x: 55, z: 2 }, { type: 'lantern', x: -45, z: -18 }, { type: 'lantern', x: -55, z: 2 },
    // ---- necropolis / windmill yard ----
    { type: 'obelisk', x: -46, z: -52, h: 6 }, { type: 'obelisk', x: -27, z: -57.5, h: 5 }, col(-40, -46, 3.6, { glyph: true }), col(-34, -46, 2, { cap: false }), { type: 'column', x: -42, z: -50, fallen: -2.6 },
    { type: 'frieze', x0: -49, z0: -54, x1: -48.96, z1: -50, y: 1.6 }, { type: 'urns', x0: -57, z0: -50, x1: -51, z1: -50, n: 4, seed: 17 },
    { type: 'windmill', x: 50, z: -53, w: 4, h: 7, color: 'cream' }, { type: 'tree', x: 44, z: -57 }, { type: 'tree', x: 57, z: -47 }, { type: 'tree', x: 40, z: -48 },
    // ---- harbor (T west) / docks (T east) ----
    { type: 'lighthouse', x: -54, z: 50 }, { type: 'boat', x: -26, z: 51, len: 7, color: 'coral' }, { type: 'boat', x: -50, z: 41, len: 6, color: 'cyan', along: 'x' },
    { type: 'pier', x0: -36, z0: 54, x1: -14, z1: 56 }, { type: 'pier', x0: 14, z0: 54, x1: 46, z1: 56 },
    { type: 'canopy', x0: -33, z0: 39, x1: -27, z1: 41.5, c1: 'cyan', c2: 'cream' }, { type: 'urns', x0: -34, z0: 44, x1: -34, z1: 50, n: 5, seed: 19 },
    { type: 'crane', x: 40, z: 50, h: 13, len: 11, dir: [-1, 0], color: 'gold', box: 'cyan' },
    { type: 'container', x0: 28, z0: 46, x1: 34, z1: 48.4, color: 'coral' }, { type: 'container', x0: 34, z0: 40, x1: 38.4, z1: 43, color: 'gold' }, { type: 'container', x0: 18, z0: 49.5, x1: 22, z1: 51.9, color: 'mint' },
    { type: 'tank', x: 44, z: 54, r: 1.2, h: 4, color: 'cream', band: 'cyan' },
    // ---- T court ----
    { type: 'banner', x: 0, z: 42.2, y: 4.1, w: 7, rot: 0, color: 'coral' }, { type: 'lantern', x: -10, z: 43 }, { type: 'lantern', x: 10, z: 43 },
    // ---- sky ----
    { type: 'kite', x: -40, y: 22, z: 22, size: 3.6, color: 'coral' }, { type: 'kite', x: 40, y: 26, z: 18, size: 3.2, color: 'cyan' }, { type: 'kite', x: 0, y: 24, z: -52, size: 3.8, color: 'gold' },
    { type: 'kite', x: -30, y: 30, z: -70, size: 5, color: 'cyan' }, { type: 'kite', x: 60, y: 28, z: 70, size: 4.4, color: 'coral' },
  ],
  signs: [
    ['BAZAAR', -23.9, 3.9, 11.5, 'coral', 3.4, Math.PI / 2], ['LAUNCH PAD', 23.9, 3.9, 11.5, 'cyan', 3.8, -Math.PI / 2], ['SPHINX TEMPLE', 0, 4.6, -33.9, 'gold', 4.6],
    ['PYRAMID', 0, 4.3, 42.1, 'gold', 3.4], ['HARBOR INN', -5.9, 3.9, 28, 'cream', 3.6, Math.PI / 2], ['MISSION CONTROL', 5.9, 3.9, 28, 'cyan', 4.4, -Math.PI / 2],
    ['BAKERY', -23.9, 3.9, -6, 'gold', 3, Math.PI / 2], ['CLOCK HALL', 23.9, 3.9, -6, 'coral', 3.6, -Math.PI / 2], ['OASIS', -47, 3.8, -20.1, 'mint', 3, Math.PI],
    ['OLD TOWN', 47, 3.8, -20.1, 'cyan', 3.2, Math.PI], ['NECROPOLIS', -55.5, 3.8, -41.9, 'mint', 3.8], ['WINDMILL YARD', 55.5, 3.8, -41.9, 'cream', 4.4],
    ['HARBOR', -11.9, 3.8, 48, 'cyan', 3, Math.PI / 2], ['DOCKS', 11.9, 3.8, 48, 'coral', 3, -Math.PI / 2]],
  callouts: [['T SPAWN', 0, 50], ['SUN GATE', 0, 38], ['AVENUE', 0, 25], ['PYRAMID', 0, -2], ['TOMB', 0, -5], ['SUMMIT', -3, -6.5], ['WEST STEPS', -17, -9], ['EAST STEPS', 17, 5],
    ['SOUTH DOOR', 2.5, 13], ['NORTH DOOR', -2.5, -17], ['WEST DOOR', -15, .5], ['EAST DOOR', 15, -4.5], ['INN', -15, 27], ['MISSION', 15, 27], ['BAKERY', -32, -10], ['CLOCK HALL', 32, -10],
    ['A SITE', -42, 20], ['TEA TERRACE', -55, 31], ['BAZAAR HALL', -31.5, 27.5], ['WELL', -50, 18], ['BAZAAR GATE', -24, 6.5],
    ['B SITE', 42, 20], ['GANTRY', 51, 18], ['TANKS', 32.5, 13], ['LAUNCH GATE', 24, 6.5],
    ['C SITE', 0, -47], ['SHRINE', 0, -53], ['TEMPLE STEPS', 0, -37], ['SPHINX W', -14, -29], ['SPHINX E', 14, -29], ['WEST RAMP', -18, -49.5], ['EAST RAMP', 18, -49.5],
    ['Z SPAWN', -50, -32], ['OASIS', -50, -8], ['GARDENS W', -32, -30], ['NECROPOLIS', -42, -52], ['CT SPAWN', 50, -32], ['OLD TOWN', 50, -8], ['GARDENS E', 32, -30], ['WINDMILL', 46, -50],
    ['HARBOR', -22, 46], ['LIGHTHOUSE', -54, 46], ['BOAT SHED', -41, 47], ['DOCKS', 22, 46], ['CRANE', 34, 50], ['WAREHOUSE', 53, 47]],
};
// ---- compact Kite Plaza (Juan 2026-10-05: "un poco grande para solo 3"): everything outside the pyramid plaza moves in by factor k.
// The plaza core keeps its size; outside it, distances shrink. Props, covers, rocket, sphinxes etc. keep their size (only their
// position moves); stairs and ramps keep their run so treads stay gentle for bots; walls, buildings, lanes and rects shrink.
export function compactPlaza(L, k = .72, core = [-24, -24, 24, 18]) {
  const m = (v, a, b) => (v < a ? a + (v - a) * k : v > b ? b + (v - b) * k : v), r3 = (v) => Math.round(v * 1000) / 1000;
  const fx = (x) => r3(m(x, core[0], core[2])), fz = (z) => r3(m(z, core[1], core[3]));
  const rect = (q) => [fx(q[0]), fz(q[1]), fx(q[2]), fz(q[3]), ...q.slice(4)];
  const keep = (q) => { const cx = fx((q[0] + q[2]) / 2), cz = fz((q[1] + q[3]) / 2), hw = (q[2] - q[0]) / 2, hd = (q[3] - q[1]) / 2; return [r3(cx - hw), r3(cz - hd), r3(cx + hw), r3(cz + hd)]; };
  const run = (q, hiMax) => { // stairs/ramps: anchor the high end, keep the run along the axis
    const ax = q[4] === 'x', lo = ax ? q[0] : q[1], hi = ax ? q[2] : q[3], len = hi - lo, f = ax ? fx : fz, a = hiMax ? f(hi) - len : f(lo), b = a + len;
    return ax ? [r3(a), fz(q[1]), r3(b), fz(q[3]), ...q.slice(4)] : [fx(q[0]), r3(a), fx(q[2]), r3(b), ...q.slice(4)]; };
  const wallo = (w) => { const o = w[4]; if (!o || !o.open) return o; const along = (w[2] - w[0]) >= (w[3] - w[1]), f = along ? fx : fz; return { ...o, open: o.open.map((p) => [f(p[0]), f(p[1]), ...p.slice(2)]) }; };
  const sides = (b, d) => d && Object.fromEntries(Object.entries(d).map(([s, list]) => [s, list.map((p) => { const f = s === 'N' || s === 'S' ? fx : fz; return [f(p[0]), f(p[1]), ...p.slice(2)]; })]));
  const lm = (o) => { if (o.type === 'greatPyramid') return o; let n = { ...o, ...(o.compact || {}) }; delete n.compact;
    if (n.x0 != null) { const q = n.type === 'container' ? keep([n.x0, n.z0, n.x1, n.z1]) : rect([n.x0, n.z0, n.x1, n.z1]); n = { ...n, x0: q[0], z0: q[1], x1: q[2], z1: q[3] }; }
    if (n.x != null && !(o.compact && o.compact.x != null)) n.x = fx(n.x); if (n.z != null && !(o.compact && o.compact.z != null)) n.z = fz(n.z);
    if (n.armTo) n.armTo = [fx(n.armTo[0]), fz(n.armTo[1])]; return n; };
  return {
    ...L, version: L.version + .1, half: Math.ceil(Math.max(fx(L.half), -fx(-L.half), fz(L.half), -fz(-L.half))), shadow: Math.round((L.shadow || 56) * .9),
    voids: (L.voids || []).map(rect), sand: (L.sand || []).map(rect), paths: (L.paths || []).map(rect),
    sites: Object.fromEntries(Object.entries(L.sites).map(([k2, v]) => [k2, { ...v, x: fx(v.x), z: fz(v.z) }])),
    spawns: Object.fromEntries(Object.entries(L.spawns).map(([k2, a]) => [k2, a.map((p) => [fx(p[0]), fz(p[1])])])),
    blocks: L.blocks.map(rect), ramps: L.ramps.map((q) => run(q, q[6] > q[5])), stairs: L.stairs.map((q) => run(q, q[6] > q[5])),
    walls: L.walls.map((w) => [...rect(w.slice(0, 4)), wallo(w)]),
    buildings: L.buildings.map((b) => ({ ...b, x0: fx(b.x0), z0: fz(b.z0), x1: fx(b.x1), z1: fz(b.z1), doors: sides(b, b.doors), windows: sides(b, b.windows), inner: b.inner && b.inner.map((w) => [...rect(w.slice(0, 4)), wallo(w)]) })),
    covers: L.covers.map((c) => [fx(c[0]), fz(c[1]), ...c.slice(2)]), crates: L.crates.map((c) => [fx(c[0]), fz(c[1]), ...c.slice(2)]),
    palms: (L.palms || []).map((p) => [fx(p[0]), fz(p[1]), ...p.slice(2)]), landmarks: L.landmarks.map(lm),
    signs: L.signs.map((q) => [q[0], fx(q[1]), q[2], fz(q[3]), ...q.slice(4)]), callouts: L.callouts.map((c) => [c[0], fx(c[1]), fz(c[2])]),
  };
}
export const LAYOUTS = { a: () => scaleLayout(KITE_GARDEN_V4), b: () => compactPlaza(KITE_PLAZA) };
export default buildMap;
