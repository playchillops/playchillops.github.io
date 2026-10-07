import { weaponClass } from './player.js';
// killfx.js - Sniper Chill KILL ANIMATIONS + FEEDBACK (ES module, THREE passed in, no other deps).
// See KILLFX.md for the full API. Quick start:
//   import { createKillFX } from './killfx.js';
//   const killfx = createKillFX(THREE, { scene, camera, container: root, audioContext: getContext() });
//   on every hit:   killfx.hit({ bot, point, zone, weapon, damage, killed, headshot, origin, distance, scoped, last });
//   every frame:    const ts = killfx.update(realDt);   // returns time scale (1 = normal, <1 = finishing slow-mo)
//                   ...simulate game with dt*ts...
//                   after camera pose is set + fov set:  killfx.applyCamera(camera);
//   on player death / new round: killfx.reset();
//   events:         killfx.on('sound'|'kill'|'streak'|'medal'|'score'|'hit'|'slowmo', fn)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const backOut = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

export const STYLES = ['headpop', 'blastback', 'stagger', 'spinfall', 'confetti'];

const COMIC = {
  headpop: ['POP!', 'BONK!', 'BOINK!', 'NOGGIN!'],
  blastback: ['BOOM!', 'KABLAM!', 'WHAM!', 'YEET!'],
  stagger: ['RATATAT!', 'OOF!', 'BRRRT!', 'DUN GOOF!'],
  spinfall: ['WHEE!', 'PEW!', 'OOPS!', 'TWIRL!'],
  confetti: ['PARTY!', 'YAY!', 'POOF!', 'TADA!'],
};
const COMIC_COLOR = { headpop: '#ffb703', blastback: '#ff5d5d', stagger: '#4cc9f0', spinfall: '#b8f35c', confetti: '#ff7ad9' };
const CONFETTI = [0xff5d73, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb388ff, 0xff9f1c, 0xffffff];

const CSS = `
.kfx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:30;font-family:'Arial Black',Impact,system-ui,sans-serif}
.kfx *{box-sizing:border-box}
.kfx-hm{position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;opacity:0}
.kfx-hm svg{width:100%;height:100%;overflow:visible}
.kfx-fl{position:absolute;left:0;top:0;font-weight:900;white-space:nowrap;color:#fff;text-shadow:0 2px 0 #000,2px 0 0 #000,-2px 0 0 #000,0 -2px 0 #000,0 4px 10px rgba(0,0,0,.5);will-change:transform,opacity}
.kfx-banner{position:absolute;left:50%;top:11%;transform:translate(-50%,0);text-align:center;opacity:0;white-space:nowrap}
.kfx-banner b{display:block;font-size:clamp(34px,6.5vw,84px);letter-spacing:.04em;font-style:italic;-webkit-text-stroke:3px #1a1030;paint-order:stroke fill;text-shadow:0 6px 0 #1a1030,0 10px 24px rgba(0,0,0,.45)}
.kfx-banner i{display:block;font-size:clamp(13px,1.7vw,22px);font-style:normal;color:#fff;letter-spacing:.3em;margin-top:4px;text-shadow:0 2px 0 #000}
.kfx-medals{position:absolute;left:50%;bottom:24%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px}
.kfx-medal{display:flex;align-items:center;gap:10px;padding:6px 18px 6px 8px;border-radius:40px;background:linear-gradient(90deg,rgba(18,14,34,.88),rgba(18,14,34,.55));border:2px solid var(--c,#ffd166);color:#fff;font-weight:900;font-size:clamp(14px,1.8vw,22px);letter-spacing:.12em;opacity:0;will-change:transform,opacity;box-shadow:0 0 18px var(--c,#ffd166)}
.kfx-medal .ic{width:38px;height:38px;border-radius:50%;background:var(--c,#ffd166);display:flex;align-items:center;justify-content:center}
.kfx-medal .ic svg{width:26px;height:26px}
.kfx-medal small{display:block;font-size:.55em;letter-spacing:.2em;color:#ffd166;opacity:.9}
.kfx-vig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,0) 45%,var(--c,#ff3860) 130%)}
.kfx-flash{position:absolute;inset:0;opacity:0;background:#fff}
.kfx-bars{position:absolute;left:0;right:0;height:0;background:#000;opacity:.85}
`;

function svgIcon(kind) {
  const s = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="#1a1030" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  switch (kind) {
    case 'noscope': return s('<circle cx="12" cy="12" r="8"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/><path d="M4 4l16 16" stroke="#c1121f"/>');
    case 'longshot': return s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12L22 2"/>');
    case 'headshot': return s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="#1a1030"/>');
    case 'pointblank': return s('<path d="M12 2l2.5 6 6.5.6-5 4.3 1.6 6.4L12 16l-5.6 3.3L8 12.9 3 8.6 9.5 8z"/>');
    case 'firstblood': return s('<path d="M12 2c4 5.5 6 8.5 6 12a6 6 0 0 1-12 0c0-3.5 2-6.5 6-12z"/>');
    case 'headhunter': return s('<circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/>');
    case 'streak': return s('<path d="M13 2L5 14h6l-1 8 9-13h-6z"/>');
    default: return s('<circle cx="12" cy="12" r="8"/>');
  }
}

const MEDALS = {
  noscope: { label: 'NO-SCOPE', color: '#ff9f1c', bonus: 75 },
  longshot: { label: 'LONG SHOT', color: '#4cc9f0', bonus: 50 },
  headshot: { label: 'HEADSHOT', color: '#39ff14', bonus: 0 },
  pointblank: { label: 'POINT BLANK', color: '#b8f35c', bonus: 25 },
  firstblood: { label: 'FIRST BLOOD', color: '#ff3860', bonus: 50 },
  headhunter: { label: 'HEAD HUNTER', color: '#b388ff', bonus: 100 },
};
const MULTI = [null, null,
  { text: 'DOUBLE KILL', color: '#ffd166', sub: 'x2', bonus: 50 },
  { text: 'TRIPLE KILL', color: '#ff9f1c', sub: 'x3', bonus: 100 },
  { text: 'QUAD KILL', color: '#ff5d73', sub: 'x4', bonus: 200 },
  { text: 'RAMPAGE!', color: '#d94bff', sub: 'x5+', bonus: 400 }];

export function createKillFX(THREE, opts = {}) {
  const { scene, camera } = opts;
  const rng = opts.rng || Math.random;
  const R = (a = 1, b) => (b === undefined ? rng() * a : a + rng() * (b - a));
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const hasDOM = typeof document !== 'undefined' && !!opts.container;

  const config = {
    slowmo: true,            // finishing-move slow-mo (set false if killcam.js owns time)
    shake: 1,                // screen-shake multiplier (0 disables)
    fovPunch: 1,             // FOV-punch multiplier
    particles: 1,            // particle density multiplier
    multiKillWindow: 4.0,    // seconds between kills that chain a multi-kill
    longShotDist: 40,        // metres for LONG SHOT medal
    pointBlankDist: 4,       // metres for POINT BLANK medal
    corpseLife: 4.5,         // seconds before a corpse shrinks away
    points: { head: 150, body: 100, limb: 100 }, // used only to display; game keeps its own score
    cashPerPoint: 0.5,
    styleFor: null,          // (info) => 'headpop'|'blastback'|'stagger'|'spinfall'|'confetti'  override
    synth: !!opts.audioContext && opts.synth !== false, // built-in WebAudio blips on 'sound' events
  };

  // ---------- events ----------
  const handlers = {};
  const on = (n, f) => { (handlers[n] || (handlers[n] = [])).push(f); return () => off(n, f); };
  const off = (n, f) => { handlers[n] = (handlers[n] || []).filter((x) => x !== f); };
  const emit = (n, d) => { for (const f of handlers[n] || []) { try { f(d); } catch (e) { console.error('killfx handler', e); } } };
  const sound = (name, pos, extra = {}) => { const d = { name, pos, ...extra }; emit('sound', d); if (config.synth) synth(d); };

  // ---------- tiny synth (optional) ----------
  const getCtx = () => (typeof opts.audioContext === 'function' ? opts.audioContext() : opts.audioContext) || null;
  function tone(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    const actx = getCtx(); if (!actx) return;
    try {
      const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(opts.audioDestination || actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }
  function synth(d) {
    switch (d.name) {
      case 'fx_headpop': tone(900, 0.12, 'sine', 0.14, -600); tone(300, 0.1, 'triangle', 0.1, 400, 0.05); break;
      case 'fx_blast': tone(120, 0.35, 'sawtooth', 0.14, -80); break;
      case 'fx_stagger': tone(180, 0.18, 'square', 0.07, -60); break;
      case 'fx_spin': tone(400, 0.5, 'sine', 0.08, 700); break;
      case 'fx_confetti': tone(700, 0.08, 'triangle', 0.1, 800); tone(1100, 0.1, 'triangle', 0.1, 600, 0.06); break;
      case 'fx_medal': tone(660, 0.1, 'square', 0.08); tone(880, 0.1, 'square', 0.08, 0, 0.09); tone(1320, 0.22, 'square', 0.08, 0, 0.18); break;
      case 'fx_streak': { const l = d.level || 2; for (let i = 0; i < l + 1; i++) tone(440 * Math.pow(1.26, i), 0.12, 'sawtooth', 0.08, 0, i * 0.07); break; }
      case 'fx_cash': tone(1568, 0.07, 'sine', 0.09); tone(2093, 0.18, 'sine', 0.09, 0, 0.06); break;
      case 'fx_slowmo_in': tone(500, 0.4, 'sine', 0.07, -380); break;
      case 'fx_slowmo_out': tone(150, 0.3, 'sine', 0.07, 400); break;
      default: break;
    }
  }

  // ---------- DOM overlay ----------
  let root = null, hmEl, hmSvg, vigEl, flashEl, bannerEl, medalsEl, barsTop, barsBot;
  const floaters = [], medalQ = [];
  if (hasDOM) {
    if (!document.getElementById('kfx-css')) { const st = document.createElement('style'); st.id = 'kfx-css'; st.textContent = CSS; document.head.appendChild(st); }
    root = document.createElement('div'); root.className = 'kfx';
    root.innerHTML = `<div class="kfx-vig"></div><div class="kfx-flash"></div><div class="kfx-bars" style="top:0"></div><div class="kfx-bars" style="bottom:0"></div>
<div class="kfx-hm"><svg viewBox="-35 -35 70 70"><g class="t"><path d="M-9-9L-21-21M9-9L21-21M-9 9L-21 21M9 9L21 21" stroke-width="5" stroke-linecap="round" stroke="currentColor"/></g></svg></div>
<div class="kfx-banner"><b></b><i></i></div><div class="kfx-medals"></div>`;
    opts.container.appendChild(root);
    vigEl = root.querySelector('.kfx-vig'); flashEl = root.querySelector('.kfx-flash'); [barsTop, barsBot] = root.querySelectorAll('.kfx-bars');
    hmEl = root.querySelector('.kfx-hm'); hmSvg = hmEl.querySelector('.t');
    bannerEl = root.querySelector('.kfx-banner'); medalsEl = root.querySelector('.kfx-medals');
  }
  const hm = { t: 1, dur: 0.3, kind: 'hit', rot: 0 };
  const vig = { t: 1, dur: 0.4, peak: 0 };
  const flash = { t: 1, dur: 0.15, peak: 0 };
  const banner = { t: 99, dur: 1.9 };
  let bars = 0, barsTarget = 0;

  function showHitmarker(kind) {
    hm.t = 0; hm.kind = kind; hm.dur = kind === 'kill' ? 0.5 : kind === 'head' ? 0.38 : 0.22;
    if (!hasDOM) return;
    hmEl.style.color = kind === 'kill' ? '#ff3860' : kind === 'head' ? '#39ff14' : '#ffffff';
    hmEl.style.filter = 'drop-shadow(0 0 3px #000)';
  }
  function pulseVignette(color, peak, dur) { vig.t = 0; vig.peak = peak; vig.dur = dur; if (hasDOM) vigEl.style.setProperty('--c', color); }
  function pulseFlash(peak, dur) { flash.t = 0; flash.peak = peak; flash.dur = dur; }
  function showBanner(text, color, sub) {
    banner.t = 0; if (!hasDOM) return;
    bannerEl.querySelector('b').textContent = text; bannerEl.querySelector('b').style.color = color; bannerEl.querySelector('i').textContent = sub || '';
  }
  function pushMedal(type, extra) {
    const m = MEDALS[type]; if (!m) return;
    emit('medal', { type, label: m.label, bonus: m.bonus, ...extra }); sound('fx_medal');
    if (!hasDOM) return;
    const el = document.createElement('div'); el.className = 'kfx-medal'; el.style.setProperty('--c', m.color);
    el.innerHTML = `<div class="ic">${svgIcon(type)}</div><div>${m.label}${m.bonus ? `<small>+${m.bonus} BONUS</small>` : ''}</div>`;
    medalsEl.appendChild(el); medalQ.push({ el, t: 0, life: 2.2 });
    while (medalQ.length > 2) { const o = medalQ.shift(); o.el.remove(); }
  }
  function floatText(pos, text, o = {}) {
    if (!hasDOM) return null;
    const el = document.createElement('div'); el.className = 'kfx-fl'; el.textContent = text;
    el.style.fontSize = (o.size || 30) + 'px'; el.style.color = o.color || '#fff'; if (o.italic) el.style.fontStyle = 'italic';
    root.appendChild(el);
    const f = { el, p: new THREE.Vector3(pos.x, pos.y, pos.z), t: 0, life: o.life || 1.1, dx: o.dx || 0, dy: o.dy || 0, rise: o.rise || 70, size: o.size || 30, pop: o.pop !== false, damage: !!o.damage, key: o.key, amount: o.amount };
    floaters.push(f); return f;
  }

  // One confirmed damage path for every mode. Pin at receipt, so delayed hits
  // remain readable after the camera turns. Same-tick pellets share one total.
  let damageLane = 0;
  function damageText(pos, amount, o = {}) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (o.key != null) {
      const f = floaters.find(f => f.damage && f.key === o.key && f.t < .12);
      if (f) { f.amount += amount; f.el.textContent = String(Math.round(f.amount)); if (o.head) f.el.style.color = '#39ff14'; return f; }
    }
    const lane = damageLane++ % 5;
    return floatText(pos || camera?.position || {x:0,y:0,z:0}, String(Math.round(amount)), {
      size: o.head ? 36 : 28, color: o.head ? '#39ff14' : '#fff',
      rise: 48, life: 1.25, dx: (lane - 2) * 34, dy: -30 - (lane % 2) * 32,
      pop: true, damage: true, key: o.key, amount
    });
  }

  // ---------- 3D: particles ----------
  const MAXP = 700;
  const pGeo = new THREE.BoxGeometry(1, 1, 1);
  const pMat = new THREE.MeshBasicMaterial({ fog: false });
  const pMesh = new THREE.InstancedMesh(pGeo, pMat, MAXP);
  pMesh.frustumCulled = false; pMesh.renderOrder = 15;
  const P = { x: new Float32Array(MAXP), y: new Float32Array(MAXP), z: new Float32Array(MAXP), vx: new Float32Array(MAXP), vy: new Float32Array(MAXP), vz: new Float32Array(MAXP),
    life: new Float32Array(MAXP), max: new Float32Array(MAXP), size: new Float32Array(MAXP), g: new Float32Array(MAXP), rx: new Float32Array(MAXP), ry: new Float32Array(MAXP),
    vr: new Float32Array(MAXP), flat: new Uint8Array(MAXP), gy: new Float32Array(MAXP) };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAXP; i++) { pMesh.setMatrixAt(i, zeroM); pMesh.setColorAt(i, tmpC.set(0xffffff)); }
  let pCur = 0;
  if (scene) scene.add(pMesh);
  function spawnP(x, y, z, vx, vy, vz, color, size, life, g = 14, flat = false) {
    const i = pCur; pCur = (pCur + 1) % MAXP;
    P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.life[i] = P.max[i] = life; P.size[i] = size; P.g[i] = g;
    P.rx[i] = R(TAU); P.ry[i] = R(TAU); P.vr[i] = R(-9, 9); P.flat[i] = flat ? 1 : 0;
    pMesh.setColorAt(i, tmpC.set(color)); pMesh.instanceColor.needsUpdate = true; return i;
  }
  function burst(pos, n, o = {}) {
    n = Math.round(n * config.particles);
    const sp = o.speed || 6, cols = o.colors || CONFETTI;
    for (let i = 0; i < n; i++) {
      const a = R(TAU), u = R(-0.3, 1), r = Math.sqrt(1 - u * u), s = sp * R(0.35, 1);
      const bx = o.dir ? o.dir.x * (o.bias || 0) : 0, bz = o.dir ? o.dir.z * (o.bias || 0) : 0;
      spawnP(pos.x, pos.y, pos.z, Math.cos(a) * r * s + bx, Math.abs(u) * s + (o.up || 1.5), Math.sin(a) * r * s + bz, pick(cols), (o.size || 0.1) * R(0.6, 1.4), R(0.7, 1.4) * (o.life || 1), o.g === undefined ? 12 : o.g, o.flat);
    }
  }
  function updateParticles(dt) {
    let dirty = false;
    for (let i = 0; i < MAXP; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt; dirty = true;
      if (P.life[i] <= 0) { pMesh.setMatrixAt(i, zeroM); continue; }
      P.vy[i] -= P.g[i] * dt; const drag = Math.exp(-1.2 * dt); P.vx[i] *= drag; P.vz[i] *= drag; if (P.g[i] < 6) P.vy[i] *= drag;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt; P.rx[i] += P.vr[i] * dt; P.ry[i] += P.vr[i] * 0.7 * dt;
      if (P.flat[i] === 2 && P.y[i] <= P.gy[i]) { dropLanded(P.x[i], P.gy[i], P.z[i], P.size[i]); P.life[i] = 0; pMesh.setMatrixAt(i, zeroM); continue; }
      const k = clamp(P.life[i] / Math.min(0.35, P.max[i]), 0, 1), sz = P.size[i] * k;
      if (P.flat[i] === 2) { tmpQ.identity(); tmpS.set(sz * 0.75, sz * 1.25, sz * 0.75); }
      else { tmpE.set(P.rx[i], P.ry[i], 0); tmpQ.setFromEuler(tmpE); tmpS.set(sz, P.flat[i] ? sz * 0.25 : sz * 0.6, sz); } tmpP.set(P.x[i], P.y[i], P.z[i]);
      tmpM.compose(tmpP, tmpQ, tmpS); pMesh.setMatrixAt(i, tmpM);
    }
    if (dirty) pMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- 3D: sprites (flash, ring, comic text) ----------
  const texCache = {};
  function canvasTex(key, w, h, draw) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return (texCache[key] = t);
  }
  const glowTex = () => canvasTex('glow', 64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const ringTex = () => canvasTex('ring', 128, 128, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.stroke(); });
  function comicTex(word, color) {
    return canvasTex('c:' + word + color, 320, 190, (x, w, h) => {
      x.translate(w / 2, h / 2); const n = 14; x.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, r = i % 2 ? 0.62 : 1; x.lineTo(Math.cos(a) * r * 152, Math.sin(a) * r * 88); }
      x.closePath(); x.fillStyle = '#fffbe6'; x.strokeStyle = '#1a1030'; x.lineWidth = 8; x.lineJoin = 'round'; x.fill(); x.stroke();
      x.font = '900 58px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let size = 58; while (x.measureText(word).width > 215 && size > 20) { size -= 3; x.font = `900 ${size}px Impact, "Arial Black", sans-serif`; }
      x.rotate(-0.08); x.lineWidth = 10; x.strokeStyle = '#1a1030'; x.strokeText(word, 0, 4); x.fillStyle = color; x.fillText(word, 0, 4);
    });
  }
  const sprites = [];
  function addSprite(tex, pos, o) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, color: o.color || 0xffffff, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m); s.position.set(pos.x, pos.y, pos.z); s.renderOrder = o.order || 20; scene.add(s);
    const sp = { s, t: 0, life: o.life || 0.3, size: o.size || 1, grow: o.grow || 1, vy: o.vy || 0, atten: o.atten, rot: o.rot || 0, kind: o.kind || 'fade', aspect: o.aspect || 1 };
    sprites.push(sp); return sp;
  }
  function distTo(p) { return camera ? camera.position.distanceTo(tmpP.set(p.x, p.y, p.z)) : 10; }
  function updateSprites(dt) {
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i]; sp.t += dt; const u = sp.t / sp.life;
      if (u >= 1) { scene.remove(sp.s); sp.s.material.dispose(); sprites.splice(i, 1); continue; }
      const d = sp.atten ? clamp(distTo(sp.s.position) * 0.16, 1, 9) : 1;
      let k;
      if (sp.kind === 'pop') { k = u < 0.2 ? backOut(u / 0.2) : u > 0.75 ? 1 - easeIn((u - 0.75) / 0.25) : 1; sp.s.material.opacity = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1; sp.s.position.y += sp.vy * dt; sp.s.material.rotation = sp.rot * (1 - u * 0.5); }
      else { k = lerp(1, sp.grow, easeOut(u)); sp.s.material.opacity = 1 - u; }
      sp.s.scale.set(sp.size * k * d * sp.aspect, sp.size * k * d, 1);
    }
  }
  function comicText(pos, style) {
    if (!hasDOM) return;
    const word = pick(COMIC[style] || COMIC.confetti), col = COMIC_COLOR[style] || '#fff';
    addSprite(comicTex(word, col), { x: pos.x, y: pos.y + 0.5, z: pos.z }, { life: 1.1, size: 0.62, aspect: 320 / 190, kind: 'pop', vy: 0.6, rot: R(-0.25, 0.25), atten: true, order: 25 });
  }
  function impactFlash(pos, color, size = 0.8) {
    addSprite(glowTex(), pos, { life: 0.18, size, grow: 2.2, color, additive: true });
    addSprite(ringTex(), pos, { life: 0.3, size: size * 0.5, grow: 4, color, additive: true });
  }

  // ---------- camera shake / fov punch / roll ----------
  const cam = { trauma: 0, t: 0, fov: 0, fovV: 0, roll: 0, rollV: 0, fovTarget: 0 };
  function shake(a) { cam.trauma = clamp(cam.trauma + a * config.shake, 0, 1); }
  function fovPunch(deg) { cam.fovV += deg * config.fovPunch * 14; }
  function rollKick(deg) { cam.rollV += deg * (Math.PI / 180) * 14 * (rng() < 0.5 ? -1 : 1); }

  // ---------- slow motion ----------
  const slow = { scale: 1, t: 99, dur: 0, hold: 0, inT: 0.06, outT: 0.25, to: 1, name: '', active: false, zoom: 0 };
  function slowmo(scale, hold, o = {}) {
    if (!config.slowmo) return;
    if (slow.active && slow.scale < scale && slow.t < slow.hold) return; // a stronger one is running
    Object.assign(slow, { scale, t: 0, hold, inT: o.in || 0.06, outT: o.out || 0.28, name: o.name || '', zoom: o.zoom || 0, active: true });
    if (o.zoom) fovPunch(-o.zoom);
    if (o.roll) rollKick(o.roll);
    sound('fx_slowmo_in'); emit('slowmo', { name: slow.name, scale, hold });
  }
  function slowScale() {
    if (!slow.active) return 1;
    const { t, inT, outT, hold, scale } = slow;
    if (t < inT) return lerp(1, scale, easeOut(t / inT));
    if (t < inT + hold) return scale;
    if (t < inT + hold + outT) return lerp(scale, 1, easeIn((t - inT - hold) / outT));
    return 1;
  }

  // ---------- bots: flinch + health-bar pop ----------
  const botState = new WeakMap();
  function stateOf(bot) {
    let s = botState.get(bot);
    if (!s) {
      const ch = bot.group ? bot.group.children : [];
      const meshes = ch.filter((c) => c.isMesh);
      s = { body: meshes[0], legs: meshes[1], head: meshes[2], f: 0, ft: 99, lx: 0, lz: 1, amp: 0, pop: 99, barBase: bot.bar && bot.bar.spr ? bot.bar.spr.scale.clone() : null, barY: bot.bar && bot.bar.spr ? bot.bar.spr.position.y : 0 };
      botState.set(bot, s); activeBots.add(bot);
    }
    return s;
  }
  const activeBots = new Set();
  function flinch(bot, info, strong) {
    const s = stateOf(bot); if (!bot.group) return;
    const d = info.dir || { x: 0, y: 0, z: -1 }, yaw = bot.group.rotation.y, c = Math.cos(yaw), si = Math.sin(yaw);
    // world dir -> bot local (inverse Y rotation)
    s.lx = d.x * c - d.z * si; s.lz = d.x * si + d.z * c;
    const w = { pistol: 0.16, hpistol: 0.24, smg: 0.09, rifle: 0.1, lmg: 0.1, shotgun: 0.28, sniper: 0.3 }[weaponClass(info.weapon)] || 0.15;
    s.amp = w * (info.zone === 'head' ? 2 : 1) * (strong ? 1.4 : 1); s.ft = 0;
    s.pop = 0;
  }
  function updateBots(dt) {
    for (const bot of activeBots) {
      const s = botState.get(bot);
      if (!bot.alive && bot.alive !== undefined) { activeBots.delete(bot); continue; }
      if (s.ft < 1.2) {
        s.ft += dt; const e = Math.exp(-s.ft * 9) * Math.cos(s.ft * 26) * s.amp;
        if (s.body) { s.body.rotation.x = s.lz * e; s.body.rotation.z = -s.lx * e; s.body.scale.y = 1 - Math.abs(e) * 0.5; }
        if (s.head) { s.head.rotation.x = s.lz * e * 1.8; s.head.rotation.z = -s.lx * e * 1.8; s.head.position.y = 1.62 - Math.abs(e) * 0.2; }
        if (s.ft >= 1.2) { if (s.body) { s.body.rotation.set(0, 0, 0); s.body.scale.y = 1; } if (s.head) { s.head.rotation.set(0, 0, 0); s.head.position.y = 1.62; } }
      }
      if (s.barBase && s.pop < 0.5) {
        s.pop += dt; const u = s.pop / 0.5, k = 1 + 0.9 * Math.exp(-u * 5) * Math.cos(u * 11) ;
        bot.bar.spr.scale.set(s.barBase.x * k, s.barBase.y * k * 1.3, 1); bot.bar.spr.position.y = s.barY + 0.08 * (k - 1);
        if (s.pop >= 0.5) { bot.bar.spr.scale.copy(s.barBase); bot.bar.spr.position.y = s.barY; }
      }
    }
  }

  // ---------- corpses ----------
  const corpses = [];
  const UP = new THREE.Vector3(0, 1, 0);
  function makeCorpse(bot, style, info) {
    const g = bot.group, root3 = new THREE.Group();
    const wp = new THREE.Vector3(); g.getWorldPosition(wp);
    const clone = g.clone(true); const rm = [];
    clone.traverse((o) => { if (o.isSprite) rm.push(o); if (o.isMesh) { o.material = o.material.clone(); if (o.material.emissive) o.material.emissive.setHex(0); } });
    rm.forEach((o) => o.parent.remove(o));
    clone.position.set(0, 0, 0); clone.rotation.set(0, g.rotation.y, 0); clone.scale.set(1, 1, 1);
    root3.add(clone); root3.position.copy(wp); scene.add(root3);
    g.visible = false;
    const meshes = clone.children.filter((c) => c.isMesh);
    let d = info.dir ? { x: info.dir.x, z: info.dir.z } : { x: 0, z: -1 };
    const L = Math.hypot(d.x, d.z) || 1; d = { x: d.x / L, z: d.z / L };
    const c = { root: root3, clone, body: meshes[0], legs: meshes[1], head: meshes[2], gun: meshes[3], style, t: 0, d, y0: wp.y, base: wp.clone(), axis: new THREE.Vector3(d.z, 0, -d.x), v: new THREE.Vector3(), th: 0, spin: 0, free: [], bounced: 0, done: false, fade: 0, seed: R(TAU), popped: false, dust: 0 };
    return c;
  }
  const GR = 24;
  function poseFall(c, theta) { c.root.quaternion.setFromAxisAngle(c.axis, theta); c.root.rotateOnAxis(UP, 0); }
  function updateCorpse(c, dt) {
    c.t += dt; const t = c.t, r = c.root, d = c.d;
    switch (c.style) {
      case 'blastback': {
        if (t === dt) { c.v.set(d.x * 13, 6.5, d.z * 13); }
        if (!c.landed) {
          c.v.y -= GR * dt; r.position.x += c.v.x * dt; r.position.z += c.v.z * dt; r.position.y += c.v.y * dt;
          c.th = Math.min(lerp(0, Math.PI * 2.5, t / 0.95), Math.PI * 2.5);
          if (r.position.y <= c.y0 && c.v.y < 0) {
            r.position.y = c.y0; c.bounced++; c.dustAt = r.position.clone();
            if (c.bounced === 1) { burst({ x: r.position.x, y: c.y0 + 0.1, z: r.position.z }, 14, { speed: 3.5, colors: [0xe8dcc0, 0xcfc3a5], size: 0.14, g: 4, life: 0.8, up: 0.3 }); shake(0.18); sound('fx_blast', r.position, { phase: 'land' }); }
            c.v.y *= -0.3; c.v.x *= 0.5; c.v.z *= 0.5;
            if (c.bounced >= 2 || Math.abs(c.v.y) < 1.5) { c.landed = true; c.th = Math.PI * 2.5; }
          }
        }
        poseFall(c, c.th); r.rotation.order = 'YXZ'; if (c.landed) r.position.y = c.y0 + 0.12; break;
      }
      case 'stagger': {
        const u = clamp(t / 0.55, 0, 1), step = Math.sin(t * 22);
        const walk = easeOut(u) * 1.1;
        r.position.set(c.base.x + d.x * walk, c.y0 + Math.abs(step) * 0.07 * (1 - u), c.base.z + d.z * walk);
        if (t < 0.55) { c.th = -0.25 * Math.sin(t * 14) * (1 - u) + 0.15 * u; if (c.legs) c.legs.rotation.x = step * 0.4 * (1 - u); }
        else { const f = clamp((t - 0.55) / 0.5, 0, 1); c.th = lerp(0.15, Math.PI / 2, easeIn(f)); if (f > 0.99 && !c.landed) { c.landed = true; shake(0.1); burst({ x: r.position.x, y: c.y0 + 0.1, z: r.position.z }, 8, { speed: 2.5, colors: [0xe8dcc0], size: 0.12, g: 4, up: 0.2 }); } }
        poseFall(c, c.th); if (c.landed) r.position.y = c.y0 + 0.12 + 0.03 * Math.exp(-(t - 1.05) * 12) * Math.cos((t - 1.05) * 30);
        break;
      }
      case 'spinfall': {
        const u = clamp(t / 0.95, 0, 1), spinE = 1 - Math.pow(1 - u, 2);
        r.position.set(c.base.x + d.x * 0.5 * spinE, c.y0 + Math.sin(clamp(t / 0.5, 0, 1) * Math.PI) * 0.35, c.base.z + d.z * 0.5 * spinE);
        r.rotation.order = 'YXZ';
        if (t < 0.95) { c.clone.rotation.y = c.clone.userData.y0 + spinE * TAU * 3; }
        const f = clamp((t - 0.6) / 0.5, 0, 1); c.th = lerp(0, Math.PI / 2, easeIn(f));
        poseFall(c, c.th); if (f >= 1 && !c.landed) { c.landed = true; shake(0.08); burst({ x: r.position.x, y: c.y0 + 0.1, z: r.position.z }, 10, { speed: 3, size: 0.12, g: 8 }); }
        if (c.landed) r.position.y = c.y0 + 0.12; break;
      }
      case 'headpop': {
        const u = clamp((t - 0.3) / 0.6, 0, 1);
        // stunned wobble then crumple straight down
        c.th = t < 0.3 ? Math.sin(t * 40) * 0.05 : lerp(0.05, Math.PI / 2, easeIn(u));
        r.position.set(c.base.x + d.x * 0.35 * u, c.y0 - 0.0, c.base.z + d.z * 0.35 * u);
        poseFall(c, c.th); if (u >= 1 && !c.landed) { c.landed = true; shake(0.06); } if (c.landed) r.position.y = c.y0 + 0.12;
        if (c.body) c.body.scale.y = 1 - 0.18 * Math.sin(clamp(t / 0.3, 0, 1) * Math.PI);
        break;
      }
      case 'confetti': {
        const u = clamp(t / 0.28, 0, 1);
        if (t < 0.28) { const k = 1 + 0.35 * Math.sin(u * Math.PI / 2); r.scale.set(k, k, k); }
        else { const f = clamp((t - 0.28) / 0.18, 0, 1); const k = 1.35 * (1 - easeIn(f)); r.scale.set(k, k, k); }
        if (t > 0.28 && !c.popped) {
          c.popped = true; const p = r.position; const mid = { x: p.x, y: p.y + 1.0, z: p.z };
          burst(mid, 90, { speed: 9, size: 0.13, g: 9, life: 1.6, up: 2.5 }); impactFlash(mid, 0xffe08a, 1.8); sound('fx_confetti', mid); shake(0.2); pulseFlash(0.22, 0.12);
          for (let i = 0; i < 18; i++) spawnP(p.x, p.y + 1, p.z, R(-3, 3), R(3, 8), R(-3, 3), 0xffffff, 0.09, 1.8, 6, true);
        }
        if (t > 0.5) c.done = true; break;
      }
      default: break;
    }
    // head free pieces
    for (const f of c.free) {
      f.t += dt; f.v.y -= GR * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.w.x * dt; f.m.rotation.z += f.w.z * dt;
      if (!f.popped) {
        const k = 1 + 0.9 * clamp(f.t / 0.5, 0, 1); f.m.scale.setScalar(k);
        if (f.t > 0.55) {
          f.popped = true; const p = f.m.position; f.m.visible = false;
          burst(p, 55, { speed: 7, size: 0.12, g: 8, life: 1.3, up: 1 }); impactFlash(p, 0xffc94a, 1.5);
          for (let i = 0; i < 10; i++) spawnP(p.x, p.y, p.z, R(-4, 4), R(1, 6), R(-4, 4), 0xffe14a, 0.2, 0.9, 6);
          sound('fx_headpop', p); shake(0.25); pulseFlash(0.28, 0.1);
        }
      }
    }
    // shrink away
    if (t > config.corpseLife) { c.fade += dt; const k = clamp(1 - c.fade / 0.5, 0, 1); r.scale.setScalar(Math.max(0.001, k)); if (k <= 0) c.done = true; }
  }
  function disposeCorpse(c) {
    scene.remove(c.root); c.root.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
    for (const f of c.free) { scene.remove(f.m); f.m.material.dispose(); }
  }
  function detachHead(c, info) {
    if (!c.head) return;
    c.root.updateMatrixWorld(true);
    const wp = new THREE.Vector3(); c.head.getWorldPosition(wp);
    const m = c.head; c.clone.remove(m); m.material = m.material.clone(); m.position.copy(wp); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); scene.add(m);
    c.free.push({ m, t: 0, v: new THREE.Vector3(R(-1.5, 1.5) + c.d.x * 1.5, R(6.5, 8), R(-1.5, 1.5) + c.d.z * 1.5), w: new THREE.Vector3(R(-12, 12), 0, R(-12, 12)), popped: false });
    c.head = null;
  }


  // ---------- cartoon blood: drops, ground/wall splats, drip trails ----------
  // Stylised (flat red blobs + little droplets, no gore). Everything is pooled and fades after splatLife seconds.
  const BLOOD = [0xff3b5c, 0xff5470, 0xe8264a, 0xff6b81];
  const splatTex = (v) => canvasTex('splat' + v, 128, 128, (x) => {
    x.translate(64, 64); x.fillStyle = '#fff'; x.beginPath();
    const n = 9 + v * 2; for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, r = 24 + ((i * 7 + v * 13) % 5) * 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
    for (let i = 0; i < 6 + v; i++) { const a = (i * 2.4 + v) % TAU, d = 38 + ((i * 11) % 4) * 6, r = 4 + ((i * 5) % 3) * 2; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(-6, 6, 14, 0, TAU); x.fill();
  });
  const SPLATN = 140, splatGeo = new THREE.PlaneGeometry(1, 1), splatPool = [];
  let splatCur = 0;
  config.splatLife = 12;        // seconds before splats are fully faded (10-15 looks right)
  config.blood = true;          // master switch for all blood
  config.bleedMinMissing = 0.12;// fraction of missing health before a bot starts dripping
  config.raycastWorld = opts.raycastWorld || null;   // (origin{x,y,z}, dir{x,y,z}, maxDist) => {point, normal} | null  (optional: enables wall splats)
  config.groundAt = opts.groundAt || null;           // (x, z, fallbackY) => ground y (optional)
  function getSplat() {
    if (!splatPool.length) for (let i = 0; i < SPLATN; i++) {
      const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ map: splatTex(i % 3), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; m.renderOrder = 4; scene.add(m); splatPool.push({ m, t: 0, life: 1, size: 1, on: false });
    }
    const sp = splatPool[splatCur]; splatCur = (splatCur + 1) % SPLATN; return sp;
  }
  function splat(pos, normal, size) {
    if (!scene || !config.blood) return;
    const sp = getSplat(), m = sp.m, n = normal || { x: 0, y: 1, z: 0 };
    m.position.set(pos.x + n.x * 0.02, pos.y + n.y * 0.02, pos.z + n.z * 0.02);
    tmpP.set(pos.x + n.x, pos.y + n.y, pos.z + n.z); m.up.set(0, 1, 0);
    if (Math.abs(n.y) > 0.9) { m.rotation.set(-Math.PI / 2 * Math.sign(n.y || 1), 0, R(TAU)); } else { m.lookAt(tmpP); m.rotateZ(R(TAU)); }
    m.material.color.set(pick(BLOOD)); m.material.opacity = 1; m.visible = true;
    sp.t = 0; sp.life = config.splatLife * R(0.8, 1.1); sp.size = size; sp.on = true; m.scale.setScalar(0.01);
  }
  function updateSplats(dt) {
    for (const sp of splatPool) {
      if (!sp.on) continue; sp.t += dt; const u = sp.t / sp.life;
      if (u >= 1) { sp.on = false; sp.m.visible = false; continue; }
      sp.m.scale.setScalar(sp.size * (u < 0.08 ? backOut(u / 0.08) : 1) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 * 0.4 : 1));
      sp.m.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    }
  }
  const groundOf = (x, z, y) => (config.groundAt ? config.groundAt(x, z, y) : y);
  function dropLanded(x, gy, z, size) { splat({ x, y: gy, z }, null, clamp(size * 4.8, 0.2, 0.9)); }
  // one falling blood drop (pooled in the particle system). gy = ground height under it.
  function drop(pos, vel, gy, size = 0.07) {
    if (!config.blood) return;
    const i = spawnP(pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, pick(BLOOD), size, 2.5, 16, false);
    P.flat[i] = 2; P.gy[i] = gy;
  }
  // blood spray from a hit: drops fly out/down, splats land on ground + (optional) wall behind the target
  function bleedHit(info, pos, killed) {
    if (!config.blood) return;
    const bot = info.bot, feet = bot && bot.position ? bot.position.y : pos.y - 1;
    const gy = groundOf(pos.x, pos.z, feet), d = info.dir || { x: 0, z: -1 };
    const n = Math.round((killed ? 14 : info.zone === 'head' ? 9 : 6) * config.particles);
    for (let i = 0; i < n; i++) drop(pos, { x: d.x * R(1, 4) + R(-2, 2), y: R(1.5, 4.5), z: d.z * R(1, 4) + R(-2, 2) }, gy, R(0.05, killed ? 0.11 : 0.08));
    splat({ x: pos.x + d.x * R(0.3, 1.2), y: gy, z: pos.z + d.z * R(0.3, 1.2) }, null, killed ? R(0.7, 1.1) : R(0.3, 0.55));
    if (config.raycastWorld && info.dir) {
      const h = config.raycastWorld(pos, { x: d.x, y: info.dir.y || 0, z: d.z }, 4);
      if (h && h.point && h.normal) splat(h.point, h.normal, killed ? R(0.8, 1.2) : R(0.4, 0.7));
    }
  }
  // wounded drip trails: bots registered on first hit, removed when dead. Intensity by missing health.
  const bleeders = new Map();   // key -> {get:()=>{pos,hp,max,alive}, acc, last}
  function healthOf(b) { const hp = b.hp !== undefined ? b.hp : b.health; return hp; }
  function addBleeder(key, get) { if (!bleeders.has(key)) bleeders.set(key, { get, acc: R(), lx: NaN, lz: NaN }); }
  function bleedBot(bot) { addBleeder(bot, () => ({ pos: bot.position, hp: healthOf(bot), max: bot.maxHealth || 100, alive: bot.alive !== false, h: 0.9 })); }
  let playerWound = null, playerWoundT = 0;
  function updateBleed(dt) {
    if (!config.blood) return;
    const list = [...bleeders.entries()];
    if (playerWound && realTime - playerWoundT < 0.25) list.push(['__player', { get: () => playerWound, acc: playerAcc.v, player: true }]);
    for (const [key, b] of list) {
      const s = b.get(); if (!s || !s.alive || s.hp === undefined) { if (key !== '__player') bleeders.delete(key); continue; }
      const missing = clamp(1 - s.hp / (s.max || 100), 0, 1); if (missing < config.bleedMinMissing) continue;
      const moved = isFinite(b.lx) ? Math.hypot(s.pos.x - b.lx, s.pos.z - b.lz) : 0; b.lx = s.pos.x; b.lz = s.pos.z;
      const rate = lerp(1.6, 7, missing) * (moved > 0.01 ? 1 : 0.45);     // drops per second
      b.acc += rate * dt; if (key === '__player') playerAcc.v = b.acc;
      while (b.acc >= 1) {
        b.acc -= 1; if (key === '__player') playerAcc.v = b.acc;
        const gy = groundOf(s.pos.x, s.pos.z, s.pos.y), sz = lerp(0.07, 0.12, missing);
        drop({ x: s.pos.x + R(-0.15, 0.15), y: s.pos.y + (s.h || 0.9) * R(0.3, 1), z: s.pos.z + R(-0.15, 0.15) }, { x: R(-0.4, 0.4), y: R(0, 0.5), z: R(-0.4, 0.4) }, gy, sz);
        if (missing > 0.6 && rng() < 0.35) splat({ x: s.pos.x + R(-0.2, 0.2), y: gy, z: s.pos.z + R(-0.2, 0.2) }, null, R(0.25, 0.4)); // heavier wounds leave bigger smears
      }
    }
  }
  const playerAcc = { v: 0 };
  // call every frame while the player is hurt (hp < max): player drips onto the ground at pos (feet)
  function setPlayerWound(pos, hp, max = 100) { playerWound = { pos, hp, max, alive: hp > 0, h: 1.0 }; playerWoundT = realTime; }

  // ---------- main entry: hit ----------
  let lastKillT = -99, multi = 0, streak = 0, headRun = 0, totalKills = 0, now = 0;
  function chooseStyle(info) {
    if (config.styleFor) { const s = config.styleFor(info); if (s) return s; }
    if (multi >= 3 && rng() < 0.6) return 'confetti';
    if (info.zone === 'head') return rng() < 0.18 ? 'confetti' : 'headpop';
    if (info.weapon === 'sniper') return 'blastback';
    if (['rifle', 'smg', 'lmg'].includes(weaponClass(info.weapon))) return rng() < 0.12 ? 'confetti' : 'stagger';
    if (info.weapon === 'pistol') return rng() < 0.15 ? 'confetti' : 'spinfall';
    return pick(STYLES);
  }
  const SPARK = { head: [0xffb703, 0xffe14a, 0xffffff], body: [0xffffff, 0xffd166], limb: [0xcfe8ff, 0xffffff] };
  function hit(info) {
    const zone = info.zone === 'legs' ? 'limb' : info.zone || 'body';
    info = { ...info, zone };
    const head = !!info.headshot || zone === 'head', pos = info.point || (info.bot && info.bot.position) || { x: 0, y: 1, z: 0 };
    if (!info.dir && info.origin) { const dx = pos.x - info.origin.x, dz = pos.z - info.origin.z, l = Math.hypot(dx, dz) || 1; info.dir = { x: dx / l, y: 0, z: dz / l }; }
    if (info.distance === undefined && info.origin) info.distance = Math.hypot(pos.x - info.origin.x, pos.y - info.origin.y, pos.z - info.origin.z);
    emit('hit', info);
    const bot = info.bot;
    // generic hit feedback
    showHitmarker(head ? 'head' : info.killed ? 'kill' : 'hit');
    impactFlash(pos, head ? 0xffc94a : 0xffffff, info.killed ? 1.1 : 0.6);
    burst(pos, info.killed ? 16 : 8, { speed: info.killed ? 5 : 3.5, colors: SPARK[zone] || SPARK.body, size: 0.07, g: 10, life: 0.6, up: 0.4, dir: info.dir, bias: 2 });
    shake({ sniper: 0.4, shotgun: 0.3, hpistol: 0.2, rifle: 0.07, smg: 0.06, lmg: 0.08 }[weaponClass(info.weapon)] || 0.12);
    bleedHit(info, pos, !!info.killed);
    damageText(pos, info.damage, { head });
    if (!info.killed) {
      if (bot) { flinch(bot, info, false); bleedBot(bot); }
      sound(head ? 'fx_hit_head' : 'fx_hit_body', pos, { zone });
      return { killed: false };
    }
    return kill(info, head, pos);
  }
  function kill(info, head, pos) {
    const bot = info.bot; now = performance.now ? performance.now() / 1000 : now;
    const t = info.time !== undefined ? info.time : now;
    multi = t - lastKillT <= config.multiKillWindow ? multi + 1 : 1; lastKillT = t; streak++; totalKills++; headRun = head ? headRun + 1 : 0;
    const style = chooseStyle(info); info.style = style;
    // corpse
    if (bot && bot.group && scene) {
      const c = makeCorpse(bot, style, info); c.clone.userData.y0 = c.clone.rotation.y;
      if (style === 'headpop') detachHead(c, info);
      corpses.push(c); activeBots.delete(bot);
    }
    const mid = { x: pos.x, y: pos.y, z: pos.z };
    comicText({ x: pos.x, y: pos.y + 0.3, z: pos.z }, style);
    sound({ headpop: 'fx_headpop', blastback: 'fx_blast', stagger: 'fx_stagger', spinfall: 'fx_spin', confetti: 'fx_confetti' }[style], mid, { style });
    if (style === 'blastback') { burst(mid, 20, { speed: 9, colors: [0xffd166, 0xff8a3d, 0xffffff], size: 0.1, dir: info.dir, bias: 8, g: 5, life: 0.7 }); impactFlash(mid, 0xff9f1c, 2.2); }
    if (style === 'stagger') for (let i = 0; i < 5; i++) spawnP(mid.x, mid.y, mid.z, R(-2, 2) + (info.dir ? info.dir.x * 4 : 0), R(2, 5), R(-2, 2) + (info.dir ? info.dir.z * 4 : 0), 0xffd166, 0.06, 0.8, 18); // shell-casing-ish sparks
    // camera feedback
    shake(info.weapon === 'sniper' ? 0.55 : 0.3); fovPunch(info.weapon === 'sniper' ? 6 : 3.5);
    pulseVignette(head ? '#ffb703' : '#ff3860', head ? 0.45 : 0.3, 0.45);
    // score + medals
    const points = info.points !== undefined ? info.points : (config.points[info.zone] || 100) ;
    const medals = [];
    if (totalKills === 1) medals.push('firstblood');
    if (info.weapon === 'sniper' && info.scoped === false) medals.push('noscope');
    if ((info.distance || 0) >= config.longShotDist) medals.push('longshot');
    if ((info.distance || 99) <= config.pointBlankDist) medals.push('pointblank');
    if (headRun >= 3 && headRun % 3 === 0) medals.push('headhunter');
    if (head && !medals.length && multi < 2) medals.push('headshot');
    let bonus = 0; medals.forEach((m, i) => { bonus += MEDALS[m].bonus; pendingMedals.push({ type: m, at: i * 0.18, info: { distance: info.distance } }); });
    if (multi >= 2) { const m = MULTI[Math.min(5, multi)]; bonus += m.bonus; showBanner(m.text, m.color, `${m.sub}  ·  STREAK ${streak}`); sound('fx_streak', mid, { level: Math.min(5, multi) }); emit('streak', { multi, streak, text: m.text, bonus: m.bonus }); pulseFlash(0.2, 0.15); shake(0.3); slowmo(0.4, 0.25, { name: 'multikill', zoom: 4 }); }
    const cash = Math.round(points * config.cashPerPoint + bonus * 0.5);
    const fp = { x: pos.x, y: pos.y + 0.3, z: pos.z };
    floatText(fp, '+' + points, { size: head ? 40 : 34, color: head ? '#ffb703' : '#fff', rise: 70, life: 1.25, italic: true, dy: -34 });
    floatText(fp, '+$' + cash, { size: 26, color: '#6cff8a', rise: 60, life: 1.25, dx: 62, dy: -6 });
    if (head) floatText(fp, 'HEADSHOT!', { size: 17, color: '#39ff14', rise: 52, life: 1.1, dy: -72 });
    if (bonus && multi < 2) floatText(fp, '+' + bonus + ' BONUS', { size: 20, color: '#4cc9f0', rise: 50, life: 1.4, dx: -72, dy: 22 });
    sound('fx_cash', mid);
    emit('score', { points, bonus, cash, total: points + bonus, medals, multi, streak });
    emit('kill', { bot, style, zone: info.zone, weapon: info.weapon, head, distance: info.distance, medals, multi, streak, points, bonus, cash });
    // finishing slow-mo variants (priority: last enemy > noscope/longshot sniper head > sniper kill > headshot)
    if (info.last) slowmo(0.12, 0.85, { name: 'finale', zoom: 10, roll: 4, out: 0.5 });
    else if (info.weapon === 'sniper' && head && (info.distance || 0) >= config.longShotDist) slowmo(0.15, 0.7, { name: 'longshot_head', zoom: 12 });
    else if (medals.includes('noscope')) slowmo(0.25, 0.55, { name: 'noscope', roll: 6, zoom: 4 });
    else if (medals.includes('longshot')) slowmo(0.22, 0.55, { name: 'longshot', zoom: 9 });
    else if (info.weapon === 'sniper' && head) slowmo(0.3, 0.4, { name: 'snipe_head', zoom: 6 });
    else if (head && rng() < 0.4) slowmo(0.45, 0.25, { name: 'head' });
    return { killed: true, style, points, bonus, cash, medals, multi, streak };
  }
  const pendingMedals = [];

  // ---------- frame update ----------
  let realTime = 0;
  function update(dt) {
    dt = Math.min(dt, 0.1); realTime += dt;
    // slow-mo clock runs in real time
    if (slow.active) { slow.t += dt; if (slow.t > slow.inT + slow.hold + slow.outT) { slow.active = false; sound('fx_slowmo_out'); } }
    const ts = slowScale(); const wdt = dt * ts;
    // pending medals
    for (let i = pendingMedals.length - 1; i >= 0; i--) { pendingMedals[i].at -= dt; if (pendingMedals[i].at <= 0) { const m = pendingMedals.splice(i, 1)[0]; pushMedal(m.type, m.info); } }
    updateParticles(wdt); updateSplats(wdt); updateBleed(wdt); updateSprites(wdt); updateBots(wdt);
    for (let i = corpses.length - 1; i >= 0; i--) { updateCorpse(corpses[i], wdt); if (corpses[i].done) { disposeCorpse(corpses[i]); corpses.splice(i, 1); } }
    // camera dynamics (real time so punches feel crisp)
    cam.t += dt; cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
    cam.fovV += (-cam.fov * 120 - cam.fovV * 14) * dt; cam.fov += cam.fovV * dt;
    cam.rollV += (-cam.roll * 120 - cam.rollV * 14) * dt; cam.roll += cam.rollV * dt;
    // DOM
    if (hasDOM) {
      if (hm.t < hm.dur) {
        hm.t += dt; const u = clamp(hm.t / hm.dur, 0, 1), big = hm.kind === 'kill' ? 1.2 : hm.kind === 'head' ? 1.0 : 0.8;
        const s = big * (hm.kind === 'kill' ? 0.5 + backOut(clamp(u / 0.35, 0, 1)) * 0.7 : 1.15 - 0.3 * easeOut(u));
        hmEl.style.opacity = String(1 - easeIn(u)); hmEl.style.transform = `scale(${s.toFixed(3)}) rotate(${hm.kind === 'kill' ? (45 * (1 - easeOut(clamp(u * 2, 0, 1)))).toFixed(1) : 0}deg)`;
      } else hmEl.style.opacity = '0';
      if (vig.t < vig.dur) { vig.t += dt; vigEl.style.opacity = String(vig.peak * (1 - clamp(vig.t / vig.dur, 0, 1))); } else vigEl.style.opacity = '0';
      if (flash.t < flash.dur) { flash.t += dt; flashEl.style.opacity = String(flash.peak * (1 - clamp(flash.t / flash.dur, 0, 1))); } else flashEl.style.opacity = '0';
      // cinematic bars during deep slow-mo
      barsTarget = slow.active && slow.scale < 0.2 ? 7 : 0; bars += (barsTarget - bars) * Math.min(1, dt * 10);
      barsTop.style.height = barsBot.style.height = bars.toFixed(2) + '%';
      if (banner.t < banner.dur) {
        banner.t += dt; const u = banner.t / banner.dur, k = u < 0.12 ? 0.4 + 0.6 * backOut(u / 0.12) + 0.25 * (1 - u / 0.12) : 1 + 0.03 * Math.sin(u * 20) * (1 - u);
        bannerEl.style.opacity = String(u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1); bannerEl.style.transform = `translate(-50%,${(u > 0.8 ? -(u - 0.8) * 60 : 0).toFixed(1)}px) scale(${k.toFixed(3)}) rotate(${(-3 * (1 - clamp(u * 6, 0, 1))).toFixed(2)}deg)`;
      } else bannerEl.style.opacity = '0';
      for (let i = medalQ.length - 1; i >= 0; i--) {
        const m = medalQ[i]; m.t += dt; const u = m.t / m.life;
        if (u >= 1) { m.el.remove(); medalQ.splice(i, 1); continue; }
        const k = u < 0.15 ? backOut(u / 0.15) : 1, x = u > 0.85 ? (u - 0.85) / 0.15 * 40 : 0;
        m.el.style.opacity = String(u > 0.85 ? 1 - (u - 0.85) / 0.15 : clamp(u / 0.08, 0, 1)); m.el.style.transform = `translateX(${x.toFixed(1)}px) scale(${k.toFixed(3)})`;
      }
      for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; if (f.t >= f.life) { f.el.remove(); floaters.splice(i, 1); } }
    }
    return ts;
  }
  const _v = new THREE.Vector3();
  function applyCamera(cm = camera) {
    if (!cm) return;
    const tr = cam.trauma, a = tr * tr, tt = cam.t * 38;
    if (a > 0.0001) {
      cm.position.x += Math.sin(tt * 1.3) * 0.045 * a; cm.position.y += Math.sin(tt * 1.9 + 1) * 0.045 * a; cm.position.z += Math.sin(tt * 1.1 + 2) * 0.02 * a;
      cm.rotateX(Math.sin(tt * 1.7 + 3) * 0.05 * a); cm.rotateY(Math.sin(tt * 1.5 + 4) * 0.05 * a); cm.rotateZ(Math.sin(tt * 2.1 + 5) * 0.06 * a);
    }
    if (Math.abs(cam.roll) > 1e-4) cm.rotateZ(cam.roll);
    if (Math.abs(cam.fov) > 0.01 && cm.isPerspectiveCamera) { cm.fov = clamp(cm.fov + cam.fov, 20, 120); cm.updateProjectionMatrix(); }
    cm.updateMatrixWorld(true);
    if (hasDOM && floaters.length) {
      const W = opts.container.clientWidth || 1, H = opts.container.clientHeight || 1;
      for (const f of floaters) {
        const u = f.t / f.life; _v.copy(f.p).project(cm);
        if (f.damage && f.px === undefined) {
          const visible = _v.z >= -1 && _v.z <= 1 && Math.abs(_v.x) < .92 && Math.abs(_v.y) < .85;
          f.px = visible ? (_v.x * .5 + .5) * W : W * .5;
          f.py = visible ? (-_v.y * .5 + .5) * H : H * .5;
        }
        if (!f.damage && (_v.z > 1 || _v.z < -1)) { f.el.style.opacity = '0'; continue; }
        const x0 = f.damage ? f.px : (_v.x * .5 + .5) * W, y0 = f.damage ? f.py : (-_v.y * .5 + .5) * H;
        const x = f.damage ? clamp(x0 + f.dx, 50, W - 50) : x0 + f.dx * easeOut(u);
        const y = f.damage ? clamp(y0 + f.dy - f.rise * easeOut(u), 60, H - 60) : y0 - f.rise * easeOut(u) + f.dy;
        const k = f.pop ? (u < 0.12 ? backOut(u / 0.12) : 1) : 1;
        f.el.style.opacity = String(u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
        f.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(3)})`;
      }
    }
  }
  function reset() {
    multi = 0; streak = 0; headRun = 0; totalKills = 0; lastKillT = -99; pendingMedals.length = 0;
    for (const c of corpses) disposeCorpse(c); corpses.length = 0;
    for (const f of floaters) f.el.remove(); floaters.length = 0; for (const m of medalQ) m.el.remove(); medalQ.length = 0;
    bleeders.clear(); playerWound = null; for (const sp of splatPool) { sp.on = false; sp.m.visible = false; }
    for (let i = 0; i < MAXP; i++) { P.life[i] = 0; pMesh.setMatrixAt(i, zeroM); } pMesh.instanceMatrix.needsUpdate = true;
    slow.active = false; cam.trauma = 0; cam.fov = cam.fovV = cam.roll = cam.rollV = 0;
  }
  function playerDied() { playerWound = null; streak = 0; multi = 0; headRun = 0; lastKillT = -99; }
  function dispose() { reset(); if (root) root.remove(); for (const sp of splatPool) { scene.remove(sp.m); sp.m.material.dispose(); } scene && scene.remove(pMesh); pGeo.dispose(); pMat.dispose(); }

  return {
    config, on, off, hit, update, applyCamera, reset, playerDied, dispose,
    shake, fovPunch, rollKick, slowmo, setPlayerWound, splat, drop, floatText, damageText, burst, showBanner, pushMedal, comicText,
    get timeScale() { return slowScale(); },
    get streak() { return streak; }, get multi() { return multi; },
    _debug: { corpses, hm, cam, slow },
  };
                                                                            }
