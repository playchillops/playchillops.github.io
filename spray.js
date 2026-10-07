// spray.js - company-logo sprays (Juan 2026-10-06: "se tenga que poner la website y se coge el logo de ahí").
// T paints your company's logo (fetched by the game server from your company website, see /logo) on the surface you look at,
// up to 4 m away. The server checks distance + cooldown and relays it to everyone ('spray'). One spray per player stays on the map.
import { raycast } from './hitscan.js';
import { logoUrl } from './account.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
export const SPRAY_RANGE = 4;
export function createSprays(THREE, { scene, world }) {
  const decals = new Map(), texs = new Map(), geo = new THREE.PlaneGeometry(1.15, 1.15);
  function paint(img, co, team) {   // spray-paint look: soft overspray halo, the logo, speckles, a few drips, company name
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), col = TEAMC[team] || '#ffd166';
    const g = c.createRadialGradient(S / 2, S * 0.44, 20, S / 2, S * 0.44, S * 0.5); g.addColorStop(0, col + 'cc'); g.addColorStop(0.62, col + '55'); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.beginPath(); c.arc(S / 2, S * 0.44, S * 0.48, 0, 7); c.fill();
    if (img) { const r = 74; c.save(); c.translate(S / 2, S * 0.42); c.rotate(-0.08); c.beginPath(); c.roundRect ? c.roundRect(-r, -r, 2 * r, 2 * r, 26) : c.rect(-r, -r, 2 * r, 2 * r); c.fillStyle = '#fff'; c.fill(); c.clip();
      const k = Math.min((2 * r - 14) / img.width, (2 * r - 14) / img.height); c.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k); c.restore(); }
    else { c.fillStyle = '#1b2033'; c.font = '800 96px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((co || '?').trim().slice(0, 2).toUpperCase(), S / 2, S * 0.43); }
    c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 900; i++) { c.globalAlpha = Math.random() * 0.5; c.fillRect(Math.random() * S, Math.random() * S, 1.6, 1.6); }   // worn paint
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.75; c.fillStyle = col;
    for (let i = 0; i < 5; i++) { const x = S * 0.3 + Math.random() * S * 0.4, y = S * 0.62, l = 18 + Math.random() * 46; c.fillRect(x, y, 3, l); c.beginPath(); c.arc(x + 1.5, y + l, 3, 0, 7); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.strokeStyle = '#1b2033'; c.lineWidth = 6; c.font = '800 30px Fredoka, system-ui, sans-serif'; c.textAlign = 'center';
    const name = (co || '').toUpperCase().slice(0, 16); c.strokeText(name, S / 2, S * 0.86); c.fillText(name, S / 2, S * 0.86);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace || t.colorSpace; t.anisotropy = 4; return t;
  }
  function texture(site, co, team) {
    const key = (site || '') + '|' + (co || '') + '|' + team; if (texs.has(key)) return texs.get(key);
    const p = new Promise((res) => { if (!site) { res(paint(null, co, team)); return; } const img = new Image(); img.crossOrigin = 'anonymous';
      const t = setTimeout(() => res(paint(null, co, team)), 6000); img.onload = () => { clearTimeout(t); try { res(paint(img, co, team)); } catch (e) { res(paint(null, co, team)); } }; img.onerror = () => { clearTimeout(t); res(paint(null, co, team)); }; img.src = logoUrl(site); });
    texs.set(key, p); return p;
  }
  return {
    /** where a spray from this eye/direction would land: { p, n } or null */
    aim(eye, dir) { const h = raycast(eye, dir, { colliders: world, maxDistance: SPRAY_RANGE }); if (!h || h.kind !== 'world') return null; const n = h.normal; if (!n || Math.hypot(n.x, n.y, n.z) < 0.5) return null; return { p: [h.point.x, h.point.y, h.point.z], n: [n.x, n.y, n.z] }; },
    /** m = { id, p:[x,y,z], n:[x,y,z], st: site, co: company, team } */
    async add(m) {
      const tex = await texture(m.st, m.co, m.team); const old = decals.get(m.id); if (old) { scene.remove(old); old.material.dispose(); }
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.95, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat), n = new THREE.Vector3(...m.n).normalize(), p = new THREE.Vector3(...m.p).addScaledVector(n, 0.025);
      mesh.position.copy(p); mesh.lookAt(p.clone().add(n)); if (Math.abs(n.y) > 0.9) mesh.rotation.z = Math.random() * 6.28; mesh.renderOrder = 2; mesh.userData.noOutline = true; mesh.userData.spray = 1;
      scene.add(mesh); decals.set(m.id, mesh);
    },
    clear() { for (const d of decals.values()) { scene.remove(d); d.material.dispose(); } decals.clear(); },
    dispose() { this.clear(); geo.dispose(); },
  };
}
