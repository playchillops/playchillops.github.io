// ads.js - sponsor slots v2: freestanding billboards, banner flags, hot air balloon. All text cards are generated in code (no logos).
// Content: YC Summer 2026 batch (names + taglines, public). Override per slot with ads.json {"slots":{"billboard-1":{"image":"ads/x.png"}}} or ChillAds.setSlot(name,url).
// Visual only: no colliders, MeshBasicMaterial. ?noads hides everything.
const YC = [["6thSense", "Nervous System for Physical AI"], ["Agentcard", "cards for AI agents"], ["Alkera AI", "Reliable and safe data engineering and data science agents"], ["Amorphic Labs", "OpenRouter for Agent Tools"], ["Assemble", "Autonomous IT Delivery"], ["Atomarine", "Floating nuclear powered data centers at sea."], ["Baud", "AI chips for ultra-fast training and inference"], ["Bizmark", "OpenClaw for manufacturers"], ["CarSignal", "The AI Operating System for Auto Shops."], ["Click", "Research services for ChatGPT and Claude"], ["Computable", "Derivatives Exchange for Compute"], ["Cosmic Robotics", "Autonomous construction on Earth and beyond"], ["Datoric", "The secure training data R&D engine for physical AI"], ["Denta", "Fortune 500 Dental Benefits for Startups"], ["Dock", "Multiplayer workspace for agents and humans"], ["Edgerun", "Military exoskeletons"], ["Ekho Labs", "World Model for Freight"], ["Erinys", "We help lawyers start and scale AI-native law firms."], ["Exosat", "Building a neutral, sovereign alternative to Starlink"], ["Financial Datasets", "Connect your agents to the stock market"], ["Frontier Computing", "Frontier grows scalable biological brains as an ML training substrate"], ["Glen", "Institutional Learning Layer for Every Agent in Your Company"], ["Grocalo", "AI brain for creators that runs their social content"], ["Hebbian Robotics", "Automate Data Evaluations for Physical AI and Robotics"], ["Hop Aero", "Rocket cargo delivery to contested environments"], ["Illume Labs", "24/7 Personal Health & Longevity Companion"], ["Insurf", "The AI-Native Decision Layer for Health Insurance"], ["Kebra", "AI For The Skilled Workforce"], ["LemonLime", "Fully automated GTM for small business"], ["Locke", "The AI-native firm for public influence."], ["Magma", "Monetize your agent's traces."], ["Marengo", "AI-Native Engineering Firm designing Data Centers"], ["Mentlio", "Engineering Intelligence and Token Optimization for the AI-Coding Era"], ["Molagri", "Resistance free pesticides."], ["Moving Atoms", "Virtual Reality for Training Robots"], ["Neuron Industries", "Industrial Controllers built for AI"], ["Omanta", "A research lab for one"], ["OpenRelay", "Distributed, hardware-agnostic AI inference"], ["OS3", "Affordable, intelligent humanoid robots built to deploy at scale"], ["Palisade", "AI-native sales agents that run marketplaces"], ["Peer", "AI-native freight brokerage"], ["Pluto", "LinkedIn for agents"], ["Prescience, Inc.", "Superintelligent health insurance that keeps employees healthy"], ["Proprio Robotics", "Robots to maintain and assemble data centers"], ["Rapidfolio", "AI-native back-office for banks and fintechs"], ["rekursiv.ai", "Scale AI scientists whose own breakthroughs accelerate the next."], ["Rise Reforming", "We turn waste gases into supply-secure chemicals"], ["Salem Robotics Inc", "Deploying robots to replace workers in hazardous spaces"], ["Sidekick", "AI agent that manages manufacturing operations over text"], ["Speko", "OpenRouter for Voice AI: one API, every call on the best speech model"]];
const PAL = [['#ffe9a8', '#ff9f7a', '#333a55'], ['#bfeeff', '#7fb2ff', '#1f2a4a'], ['#d8ffd0', '#6fd09a', '#23403a'], ['#ffd3e4', '#ff8fb5', '#4a2340'], ['#fff1c2', '#ffc857', '#40331a'], ['#e3dcff', '#9a8cff', '#2a2450']];
function wrap(x, text, maxW, font) { x.font = font; const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
export function cardCanvas(i, W = 1024, H = 512) {
  const [name, tag] = YC[((i % YC.length) + YC.length) % YC.length], pal = PAL[i % PAL.length];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = pal[2]; x.fillRect(0, 0, W, 16); x.fillRect(0, H - 16, W, 16);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = pal[2];
  let fs = 150; do { x.font = '800 ' + fs + 'px Teko, Impact, "Arial Narrow", sans-serif'; fs -= 8; } while (x.measureText(name.toUpperCase()).width > W - 90 && fs > 50);
  x.fillText(name.toUpperCase(), W / 2, H * 0.34);
  const lines = wrap(x, tag, W - 140, '600 54px Teko, "Arial Narrow", sans-serif').slice(0, 3); x.font = '600 54px Teko, "Arial Narrow", sans-serif';
  lines.forEach((l, k) => x.fillText(l, W / 2, H * 0.58 + k * 58));
  x.font = '700 28px Teko, sans-serif'; x.globalAlpha = 0.7; x.fillText('Y COMBINATOR  SUMMER 2026', W / 2, H - 42); x.globalAlpha = 1;
  return c;
}
const tex = (THREE, canvas) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// name, x, z, rotY (0 faces +z), width. Freestanding on two posts, standing in open ground beside the lanes.
import { MAP_SCALE as _S } from './map.js';
const BOARDS0 = [
  ['billboard-1', -17, 15, Math.PI / 2, 4.4], ['billboard-2', 17, 15, -Math.PI / 2, 4.4],
  ['billboard-3', -17, -2, Math.PI / 2, 4.4], ['billboard-4', 17, -2, -Math.PI / 2, 4.4],
  ['billboard-5', 0, 36.5, Math.PI, 4.4],
];
const BOARDS = BOARDS0.map(([n, x, z, r, w]) => [n, x * _S, z * _S, r, w]);
const FLAGS0 = [['banner-1', -9, 24], ['banner-2', 9, 24], ['banner-3', -9, 8], ['banner-4', 9, 8], ['banner-5', -14, -24], ['banner-6', 14, -24]];
const FLAGS = FLAGS0.map(([n, x, z]) => [n, x * _S, z * _S]);

export function addAds(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'ads'; const slots = new Map(), loader = new THREE.TextureLoader(); let n = 0;
  const post = new THREE.MeshBasicMaterial({ color: 0x333a55 }), cloth = (i) => new THREE.MeshBasicMaterial({ map: tex(THREE, cardCanvas(i)), side: THREE.DoubleSide });
  const gh = opts.ground || (() => 0), lay = opts.layout && opts.layout.ads; // a map can bring its own slot positions
  for (const [name, x, z, ry, w] of (lay && lay.boards) || BOARDS) {
    const h = w / 2, y0 = gh(x, z), g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6 + h, 0.16), post); p.position.set(sx * (w / 2 - 0.35), (1.6 + h) / 2, -0.12); g.add(p); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.12), post); frame.position.set(0, 1.6 + h / 2 + 0.2, -0.04); g.add(frame);
    const mat = cloth(n++), face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); face.position.set(0, 1.6 + h / 2 + 0.2, 0.03); g.add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); back.position.set(0, 1.6 + h / 2 + 0.2, -0.11); back.rotation.y = Math.PI; g.add(back);
    group.add(g); slots.set(name, { mat });
  }
  for (const [name, x, z] of (lay && lay.flags) || FLAGS) {
    const y0 = gh(x, z), g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.2, 8), post); pole.position.y = 2.6; g.add(pole);
    const mat = cloth(n++), cv = cardCanvas(n, 512, 1024); mat.map = tex(THREE, cv);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), mat); flag.position.set(0.0, 3.9, 0.02); g.add(flag);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), post); arm.position.set(0, 4.95, 0.1); g.add(arm);
    group.add(g); slots.set(name, { mat });
  }
  // ---- hot air balloon, high up near the clouds, drifting in a slow circle ----
  const bal = new THREE.Group(); bal.name = 'balloon';
  const bc = document.createElement('canvas'); bc.width = 2048; bc.height = 512; { const x = bc.getContext('2d'); const cols = ['#ff846e', '#ffe9a8', '#68e3db', '#ffe9a8']; for (let k = 0; k < 8; k++) { x.fillStyle = cols[k % 4]; x.fillRect(k * 256, 0, 256, 512); } }
  const balTex = (i) => { const x = bc.getContext('2d'), [name, tag] = YC[i % YC.length]; x.fillStyle = '#fff7e6'; x.fillRect(0, 150, 2048, 210); x.fillStyle = '#333a55'; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = 150; do { x.font = '800 ' + fs + 'px Teko, Impact, sans-serif'; fs -= 8; } while (x.measureText(name.toUpperCase()).width > 880 && fs > 50); for (const cx of [512, 1536]) x.fillText(name.toUpperCase(), cx, 255); x.font = '600 36px Teko, sans-serif'; for (const cx of [512, 1536]) x.fillText(tag.length > 34 ? tag.slice(0, 32) + '...' : tag, cx, 330); const t = new THREE.CanvasTexture(bc); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; };
  const bmat = new THREE.MeshBasicMaterial({ map: balTex(0), fog: false });
  const env = new THREE.Mesh(new THREE.SphereGeometry(7, 28, 20), bmat); env.scale.set(1, 1.2, 1); env.position.y = 9; bal.add(env);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xff846e, side: THREE.DoubleSide, fog: false })); cone.rotation.x = Math.PI; cone.position.y = 0.6; bal.add(cone);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), new THREE.MeshBasicMaterial({ color: 0xb98b64, fog: false })); basket.position.y = -2.6; bal.add(basket);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 4), post); r.position.set(sx * 1.1, -0.9, sz * 1.1); bal.add(r); }
  bal.position.set(-70, 62, -120); bal.scale.setScalar(2.2); group.add(bal);
  let bi = 0, t0 = 0;
  const api = {
    group, names: () => [...slots.keys()],
    setSlot(name, url) { const s = slots.get(name); if (!s) return false; loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; s.mat.map = t; s.mat.needsUpdate = true; }); return true; },
    update(dt, camPos) { t0 += dt; const a = t0 * 0.02; bal.position.set(-70 + Math.cos(a) * 30, 62 + Math.sin(t0 * 0.2) * 1.5, -120 + Math.sin(a) * 20); bal.rotation.y = a * 2; if (Math.floor(t0 / 25) !== bi) { bi = Math.floor(t0 / 25); bmat.map = balTex(bi * 7 + 3); bmat.needsUpdate = true; } },
  };
  scene.add(group); window.ChillAds = api; { let last = performance.now(); const tick = (n) => { const dt = Math.min(0.1, (n - last) / 1000); last = n; try { api.update(dt); } catch (e) {} requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  fetch('ads.json?' + (Date.now() / 3600000 | 0)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.slots) for (const k in j.slots) if (j.slots[k].image) api.setSlot(k, j.slots[k].image); }).catch(() => {});
  return api;
}
