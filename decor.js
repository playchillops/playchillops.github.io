// decor.js - visual-only polish for Kite Garden: trims, shutters, flower boxes, planters, bunting, ground decals, soft AO.
// No colliders are added. Batched per colour. Seeded so it is stable between runs.
import { MAP_SCALE } from './map.js';
export function addDecor(THREE, map, parent) {
  const L = (map.layout && map.layout.__raw) || map.layout; if (!L) return null;
  const SC = map.layout && map.layout.__raw ? MAP_SCALE : 1;
  const g = new THREE.Group(); g.name = 'decor';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const batches = new Map(), mats = new Map();
  const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const boxG = new THREE.BoxGeometry(1, 1, 1), sphG = new THREE.IcosahedronGeometry(0.5, 1), cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone = new THREE.ConeGeometry(0.5, 1, 4);
  function put(geo, color, x, y, z, w, h, d, ry = 0, rz = 0, alpha = 1) {
    const key = color + ':' + alpha; let b = batches.get(key); if (!b) { b = { p: [], n: [], i: [], alpha, color }; batches.set(key, b); }
    e.set(0, ry, rz, 'YXZ'); q.setFromEuler(e); v.set(x, y, z); s.set(w, h, d); tmpM.compose(v, q, s);
    const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index, base = b.p.length / 3; const nm = new THREE.Matrix3().getNormalMatrix(tmpM); const t = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) { t.fromBufferAttribute(pos, k).applyMatrix4(tmpM); b.p.push(t.x, t.y, t.z); t.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize(); b.n.push(t.x, t.y, t.z); }
    if (idx) { for (let k = 0; k < idx.count; k++) b.i.push(base + idx.getX(k)); } else { for (let k = 0; k < pos.count; k++) b.i.push(base + k); }
  }
  const box = (c, x, y, z, w, h, d, ry, rz, a) => put(boxG, c, x, y, z, w, h, d, ry, rz, a);
  const ground = (x, z) => { const h = map.getHeight ? map.getHeight(x * SC, z * SC) : 0; return Number.isFinite(h) ? h : 0; };
  const inOpen = (o, a, b) => (o.open || []).some((r) => a < r[1] + 0.3 && b > r[0] - 0.3);
  const shut = [0xff846e, 0x68e3db, 0xffda8d, 0xc8b3cb, 0xa9e0c4], flowers = [0xff6b9a, 0xffe066, 0xffffff, 0xff9f43];
  // ---- walls ----
  for (const w of L.walls || []) {
    const [x0, z0, x1, z1, o = {}] = w, h = o.h || 3, lenX = x1 - x0, lenZ = z1 - z0, alongX = lenX >= lenZ, len = alongX ? lenX : lenZ, th = alongX ? lenZ : lenX;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const y0 = o.y0 ?? Math.max(0, ground(alongX ? cx : x0 - 1, alongX ? z0 - 1 : cz));
    if (h < 1.5 || len < 2.5) continue;
    if ((L.buildings || []).some((bb) => cx > bb.x0 + 0.3 && cx < bb.x1 - 0.3 && cz > bb.z0 + 0.3 && cz < bb.z1 - 0.3)) continue; // interior partitions: no decor (flicker)
    // trim: cap + baseboard
    if (alongX) { box(0xfff3da, cx, y0 + h + 0.09, cz, len + 0.3, 0.18, th + 0.3); box(0xb9a98e, cx, y0 + 0.28, cz, len + 0.12, 0.56, th + 0.12); }
    else { box(0xfff3da, cx, y0 + h + 0.09, cz, th + 0.3, 0.18, len + 0.3); box(0xb9a98e, cx, y0 + 0.28, cz, th + 0.12, 0.56, len + 0.12); }
    // soft AO strips at the foot of each face
    for (const sd of [-1, 1]) { if (alongX) box(0x2a3a2a, cx, y0 + 0.035, sd > 0 ? z1 + 0.45 : z0 - 0.45, len + 0.6, 0.02, 0.9, 0, 0, 0.16); else box(0x2a3a2a, sd > 0 ? x1 + 0.45 : x0 - 0.45, y0 + 0.035, cz, 0.9, 0.02, len + 0.6, 0, 0, 0.16); }
    const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
    for (const sd of [-1, 1]) {
      const face = alongX ? (sd > 0 ? z1 : z0) : (sd > 0 ? x1 : x0); let n = 0;
      for (let a = a0 + 0.7; a < a1 - 0.4; a += 3.1, n++) {
        if (inOpen(o, a - 0.7, a + 0.7)) continue;
        const px = alongX ? a : face + sd * 0.04, pz = alongX ? face + sd * 0.04 : a;
        if (n % 3 === 0) { // pilaster
          if (alongX) box(0xfff3da, a, y0 + h / 2, face + sd * 0.07, 0.34, h, 0.14); else box(0xfff3da, face + sd * 0.07, y0 + h / 2, a, 0.14, h, 0.34);
        } else if (h >= 3 && len >= 6) { // painted window + shutters + flower box
          const wy = y0 + 1.95, sc = shut[(n + (sd > 0 ? 1 : 3)) % shut.length], fl = flowers[n % flowers.length];
          const T = (dx, dy, ww, hh, c, dd = 0.05, off0 = 0.03) => { const off = Math.max(off0, 0.025); if (alongX) box(c, a + dx, wy + dy, face + sd * (off + dd / 2), ww, hh, dd); else box(c, face + sd * (off + dd / 2), wy + dy, a + dx, dd, hh, ww); };
          T(0, 0, 1.3, 1.6, 0xfff3da, 0.06, 0.01); T(0, 0, 1.0, 1.3, 0x8fc8e8, 0.08, 0.02); T(0, 0, 0.06, 1.3, 0xfff3da, 0.1, 0.02); T(0, 0, 1.0, 0.06, 0xfff3da, 0.1, 0.02);
          T(-0.82, 0, 0.42, 1.5, sc, 0.07, 0.02); T(0.82, 0, 0.42, 1.5, sc, 0.07, 0.02);
          T(0, -1.0, 1.3, 0.26, 0xb98b64, 0.34, 0.01); for (let k = -1; k <= 1; k++) T(k * 0.4, -0.8, 0.28, 0.24, k === 0 ? 0x73b787 : fl, 0.3, 0.05);
          if (h >= 4 && n % 2 === 0) { // second-storey kite poster
            const kx = alongX ? a : face + sd * 0.04, kz = alongX ? face + sd * 0.04 : a; put(boxG, sc, kx, y0 + h - 0.9, kz, 0.7, 0.7, 0.05, alongX ? 0 : Math.PI / 2, Math.PI / 4);
          }
        }
        if (n % 4 === 1 && h >= 3) { // planter with bush at the foot (visual only, hugs the wall)
          const bx = alongX ? a + 1.2 : face + sd * 0.55, bz = alongX ? face + sd * 0.55 : a + 1.2; if (!inOpen(o, a + 0.4, a + 2)) { box(0xd9825b, bx, y0 + 0.28, bz, 0.9, 0.56, 0.6, alongX ? 0 : Math.PI / 2); put(sphG, 0x73b787, bx, y0 + 0.85, bz, 0.85, 0.7, 0.75); put(sphG, flowers[(n + 1) % 4], bx + 0.2, y0 + 1.1, bz, 0.22, 0.22, 0.22); put(sphG, flowers[n % 4], bx - 0.25, y0 + 1.0, bz + 0.1, 0.2, 0.2, 0.2); }
        }
      }
    }
  }
  // ---- building trims (corner pillars + sign boards + lamps by doors) ----
  for (const b of L.buildings || []) {
    const y0 = b.y0 || 0, h = b.h || 4.4;
    for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) box(0xfff3da, x, y0 + h / 2, z, 0.5, h + 0.1, 0.5);
    { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, W = b.x1 - b.x0 + 0.24, D = b.z1 - b.z0 + 0.24; // outside-only baseboard strips (nothing inside the house, so no shimmer indoors)
      box(0xb9a98e, cx, y0 + 0.3, b.z0 - 0.06, W, 0.6, 0.12); box(0xb9a98e, cx, y0 + 0.3, b.z1 + 0.06, W, 0.6, 0.12); box(0xb9a98e, b.x0 - 0.06, y0 + 0.3, cz, 0.12, 0.6, D); box(0xb9a98e, b.x1 + 0.06, y0 + 0.3, cz, 0.12, 0.6, D); }
    for (const k of ['N', 'S', 'W', 'E']) for (const r of (b.doors && b.doors[k]) || []) { // lamp beside each door
      const m = (r[0] + r[1]) / 2, off = (r[1] - r[0]) / 2 + 0.5, lx = k === 'N' ? m + off : k === 'S' ? m - off : (k === 'W' ? b.x0 - 0.2 : b.x1 + 0.2), lz = k === 'W' ? m + off : k === 'E' ? m - off : (k === 'N' ? b.z0 - 0.2 : b.z1 + 0.2);
      put(cylG, 0x4b5b70, lx, y0 + 2.5, lz, 0.06, 1.0, 0.06); put(sphG, 0xffe9a0, lx, y0 + 3.15, lz, 0.32, 0.32, 0.32);
    }
  }
  // ---- bunting between market rows and across the T-court gate ----
  const bunt = (x0, y0, z0, x1, y1, z1, sag) => { const n = Math.max(6, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9)); const cols = [0xff846e, 0xffda8d, 0x68e3db, 0xf2a9b8, 0xc8b3cb]; const ang = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t); put(boxG, 0x333a55, x, y, z, 0.05, 0.05, Math.hypot(x1 - x0, z1 - z0) / n + 0.02, ang); put(cone, cols[i % 5], x, y - 0.22, z, 0.34, 0.45, 0.08, ang, Math.PI); } };
  bunt(-6, 3.55, 21, 6, 3.55, 21, 1.0); bunt(-6, 3.4, 11, 7, 3.4, 11, 0.8); bunt(-10, 4.4, 30.5, 10, 4.4, 30.5, 1.4);
  // ---- ground decals (flat, just above floor) ----
  const dec = (c, x, z, w, d, a = 1, ry = 0) => box(c, x, ground(x, z) + 0.045, z, w, 0.012, d, ry, 0, a);
  for (let i = -3; i <= 3; i++) { dec(0xfff3da, i * 1.1, 26.6, 0.6, 1.7, 0.9); }
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) dec(k % 2 ? 0xffda8d : 0xff846e, sx * 15 + (k - 3) * 0.9, 17.2, 0.6, 0.8, 0.8);
  put(new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2), 0xfff3da, 0, ground(0, 11) + 0.05, 11, 11, 1, 11, 0, 0, 0.9);
  put(new THREE.RingGeometry(0.30, 0.34, 40).rotateX(-Math.PI / 2), 0xff846e, 0, ground(0, 11) + 0.052, 11, 15, 1, 15, 0, 0, 0.9);
  // ---- scattered barrels / sacks hugging walls (visual only) ----
  for (const w of (L.walls || []).filter((x) => (x[4] && x[4].h) >= 3 && Math.max(x[2] - x[0], x[3] - x[1]) >= 6)) {
    if (rnd() < 0.45) continue; const [x0, z0, x1, z1] = w, alongX = x1 - x0 >= z1 - z0, a = (alongX ? x0 : z0) + 1 + rnd() * ((alongX ? x1 - x0 : z1 - z0) - 2), sd = rnd() < 0.5 ? -1 : 1;
    const px = alongX ? a : (sd > 0 ? x1 + 0.45 : x0 - 0.45), pz = alongX ? (sd > 0 ? z1 + 0.45 : z0 - 0.45) : a, y = Math.max(0, ground(px, pz));
    if (rnd() < 0.5) { put(cylG, 0x8a5a3c, px, y + 0.4, pz, 0.7, 0.8, 0.7); box(0x333a55, px, y + 0.55, pz, 0.74, 0.07, 0.74); box(0x333a55, px, y + 0.25, pz, 0.74, 0.07, 0.74); }
    else { put(sphG, 0xf1dcae, px, y + 0.3, pz, 0.8, 0.6, 0.6); put(sphG, 0xe8cf9a, px + 0.35, y + 0.22, pz + 0.2, 0.6, 0.44, 0.5); }
  }
  // build meshes
  for (const [, b] of batches) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); geo.setIndex(b.i);
    const m = new THREE.MeshLambertMaterial({ color: b.color, flatShading: true, transparent: b.alpha < 1, opacity: b.alpha, depthWrite: b.alpha >= 1, polygonOffset: true, polygonOffsetFactor: b.alpha < 1 ? -8 : -6, polygonOffsetUnits: b.alpha < 1 ? -8 : -6 }); const mesh = new THREE.Mesh(geo, m); mesh.userData.decor = true; mesh.frustumCulled = true; g.add(mesh);
  }
  g.scale.set(SC, 1, SC); parent.add(g); return g;
}
