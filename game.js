// game.js - Sniper Chill: wires map, movement, hitscan, player/weapons, audio and bots together.
import * as THREE from './three.module.min.js';
import { buildMap } from './map.js';
import { createController } from './movement.js';
import { raycast, wallBlocked } from './hitscan.js';
import { createViewmodels, createWeaponSystem, createHUD, createPlayerState, applyDamage, WEAPON_ORDER } from './player.js';
import { initAudio, play, setListener, startAmbient, setVolume } from './audio.js';
import { startMusic, stopMusic, setMusicMode, setMusicLevel } from './music.js';
import { createBots } from './bots.js';
import { createKillCam } from './killcam.js';
import { applyLook } from './graphics.js';
import { createAnimations } from './animations.js';
import { createKillFX } from './killfx.js';
import { getContext } from './audio.js';
import { DIFFICULTY } from './botsai.js';
import { createStreaks } from './streaks.js';
import { addDecor } from './decor.js';
import { addAds } from './ads.js';
import { recordRound } from './stats.js';
import { createEconomy, WEAPON_STATS } from './economy.js';
import { createDestruction } from './destruction.js';
import { createGrenades } from './grenades.js';
import { playIntro } from './intro.js';
import { buildMenu } from './menu.js';
import { createMultiplayer } from './mp.js';
import { showTutorial } from './tutorial.js';
import { createCharacter, ROSTER } from './characters.js';

const CSS = `
@font-face{font-family:Fredoka;font-weight:500;src:url('./Fredoka-Medium.ttf') format('truetype');font-display:swap}
@font-face{font-family:Fredoka;font-weight:600 900;src:url('./Fredoka-Bold.ttf') format('truetype');font-display:swap}
.sg{font-family:Fredoka,system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;background:#9fdcff}
.sg canvas.main{width:100%;height:100%;display:block}
.sg .scb{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:30;display:none;align-items:center;gap:10px;pointer-events:none;background:rgba(14,20,28,.55);border-radius:999px;padding:4px 16px;font-family:Fredoka,system-ui,sans-serif;color:#fff;backdrop-filter:blur(3px)}
.sg .sbm{position:absolute;left:50%;top:50px;transform:translateX(-50%);z-index:21;display:none;align-items:center;gap:12px;font:600 13px Fredoka,system-ui,sans-serif;text-shadow:0 0 3px #000,0 1px 4px #000;pointer-events:none;white-space:nowrap}.sg .sbm .l{font-size:10px;letter-spacing:.14em;color:#fff;opacity:.7}
.sg .scb b{font-size:20px;font-weight:600;line-height:1;min-width:14px;text-align:center}
.sg .scb .sep{opacity:.5;font-size:16px}
.sg .scb .rd{font-size:10px;letter-spacing:.14em;opacity:.65;font-weight:500}
.sg .scb .pips{display:flex;gap:3px}
.sg .pip{display:inline-block;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.2)}
.sg .pip.on{background:var(--c)}
.sg .setov{position:absolute;inset:0;z-index:400;background:rgba(14,22,34,.82);align-items:center;justify-content:center}
.sg .setp{background:#1d2b3d;border:3px solid #fff;border-radius:22px;padding:16px 28px;min-width:min(420px,88vw);display:flex;flex-direction:column;gap:6px;max-height:92vh;overflow-y:auto;box-shadow:0 8px 0 rgba(0,0,0,.3)}
.sg .setp h2{margin:0 0 4px;font-size:26px}
.sg .sr{display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:16px;text-align:left}
.sg .sr small{opacity:.65;font-weight:500;font-size:12px}.sg .sr em{font-style:normal;color:#ffd166;float:right}
.sg .sr:has(input[type=checkbox]){flex-direction:row;justify-content:space-between;align-items:center}
.sg .sr input[type=checkbox]{width:24px;height:24px;accent-color:#37c97c}
.sg .sr input[type=range]{accent-color:#ffd166;width:100%}
.sg .sr select{font:inherit;padding:8px;border-radius:10px;border:0;background:#2e4259;color:#fff}
.sg .invb{position:absolute;right:12px;bottom:112px;z-index:22;display:flex;flex-direction:column;gap:4px;align-items:stretch;pointer-events:none;font-family:Fredoka,system-ui,sans-serif}
.sg .invb .it{min-width:104px;padding:3px 10px 3px 8px;border-radius:8px;background:rgba(10,14,24,.5);border:2px solid rgba(255,255,255,.22);color:#fff;line-height:1.1;display:flex;align-items:center;gap:8px;transition:transform .12s,background .12s}
.sg .invb .it kbd{background:rgba(255,255,255,.9);color:#222;font:700 11px Fredoka,system-ui;padding:1px 6px;border-radius:5px}
.sg .invb .it b{font-size:12px;font-weight:600;letter-spacing:.03em;white-space:nowrap;flex:1;text-align:left}
.sg .invb .it small{font-size:11px;opacity:.8;font-weight:600}
.sg .invb .it.cur{background:rgba(255,209,102,.92);color:#222;border-color:#fff;transform:translateX(-6px)}
.sg .invb .it.cur kbd{background:#222;color:#fff}
.sg .invb .it.empty{opacity:.4}
.sg .invb .it.gr{background:rgba(54,98,150,.6)}
.sg .invb .sep{height:4px}
.sg .invh{position:absolute;right:128px;bottom:140px;max-width:240px;z-index:22;font-weight:600;font-size:12px;color:#ffe9a8;text-shadow:0 1px 3px #000;pointer-events:none;opacity:0;transition:opacity .3s;text-align:right}
.sg .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(20,30,45,.74);text-align:center;padding:16px;z-index:100}
.sg .ov h2{margin:0;font-size:clamp(24px,4.5vw,44px)}
.sg .ov p{margin:0;font-size:clamp(12px,1.6vw,16px);opacity:.92;max-width:680px;line-height:1.45}
.sg button.b{font:inherit;font-weight:700;padding:12px 20px;border-radius:10px;border:0;background:#ffd166;color:#222;cursor:pointer;min-height:44px}
.sg button.b.alt{background:#9ad1ff}
.sg .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.sg .info{position:absolute;top:76px;left:50%;transform:translateX(-50%);z-index:21;font-weight:700;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}
.sg .kf{position:absolute;right:24px;top:70px;z-index:21;font-weight:700;text-align:right;text-shadow:0 1px 3px #000;pointer-events:none}
`;
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Game {
  constructor(root) {
    this.root = root; root.classList.add('sg');
    if (!document.getElementById('sg-css')) { const s = document.createElement('style'); s.id = 'sg-css'; s.textContent = CSS; document.head.appendChild(s); }

    { const s = document.createElement('style'); s.id = 'sg-css2'; s.textContent = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600&display=swap');
.sc-hud:before{content:"";position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(transparent,rgba(4,8,16,.5));pointer-events:none}
.sc-hud .sc-hp-track{background:rgba(6,10,20,.82);border-color:#fff}
.sc-hud .sc-hp-label,.sc-hud .sc-ammo,.sc-hud .sc-ammo-w,.sc-hud .sc-bomb{text-shadow:0 0 3px #000,0 1px 3px #000,0 2px 8px rgba(0,0,0,.8);opacity:1}
.sc-hud .sc-ammo-n{filter:drop-shadow(0 2px 3px rgba(0,0,0,.9))}
.sk .slot{background:rgba(6,10,20,.82)!important}.sk .slot.have{background:rgba(120,90,10,.85)!important}
.sc-economy .eco-chip{background:none!important;border:0!important;box-shadow:none!important;padding:0 6px!important;color:#ffe9a8!important;font-family:Teko,'Bebas Neue',Impact,'Arial Narrow',sans-serif!important;font-weight:600;letter-spacing:.04em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.85)}
.sc-economy .eco-chip strong{font-size:40px!important;font-weight:600;line-height:1}.sc-economy .eco-chip span{display:none}
.sg .info{text-shadow:0 0 3px #000,0 1px 4px #000}`; document.head.appendChild(s); }
    this.canvas = document.createElement('canvas'); this.canvas.className = 'main'; root.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.scene = new THREE.Scene();
    this.map = buildMap(THREE); this.scene.add(this.map.group); try { if (!/[?&]noads/.test(location.search)) addAds(THREE, this.scene, { ground: (x, z) => { const h = this.map.getHeight ? this.map.getHeight(x, z) : 0; return Number.isFinite(h) ? h : 0; } }); } catch (e) { console.warn('ads failed', e); } try { if (!/[?&]nodecor/.test(location.search)) addDecor(THREE, this.map, this.scene); } catch (e) { console.warn('decor failed', e); }
    this.scene.background = new THREE.Color(this.map.sky.background);
    this.scene.fog = new THREE.Fog(this.map.sky.fog.color, this.map.sky.fog.near, this.map.sky.fog.far);
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 300); this.scene.add(this.camera);
    try { this.look = /[?&]look=off/.test(location.search) ? null : applyLook(THREE, this.renderer, this.scene, this.map); } catch (err) { console.error('look', err); this.look = null; }

    // physics world: map blocking boxes + roof slabs + ramps (from the map's floor/ramp data)
    const m = this.map; const phys = m.physicsColliders ? [...m.physicsColliders] : [...m.colliders];
    for (const f of m.physicsColliders ? [] : m.floors) if (f.y > 0) phys.push({ min: { x: f.minX, y: f.y - 3, z: f.minZ }, max: { x: f.maxX, y: f.y, z: f.maxZ } });
    for (const r of m.physicsColliders ? [] : m.ramps) phys.push({ type: 'ramp', axis: r.axis, direction: r.y1 > r.y0 ? 1 : -1, min: { x: r.minX, y: Math.min(r.y0, r.y1), z: r.minZ }, max: { x: r.maxX, y: Math.max(r.y0, r.y1), z: r.maxZ } });
    this.phys = phys;
    this.world = [...phys, { min: { x: -60, y: -2, z: -60 }, max: { x: 60, y: 0, z: 60 } }]; // ground also stops bullets

    this.destruction = createDestruction(THREE, { scene: this.scene, map: m,
      colliderArrays: [this.phys, this.world], onCollidersChanged: () => this.bots?.refreshNavigation?.() });

    const spawnT = m.spawnPoints.filter((s) => s.team === 'T')[0];
    this.spawnT = spawnT.position.clone();
    this.ctrl = createController(this.phys, { position: { x: this.spawnT.x, y: this.spawnT.y, z: this.spawnT.z }, yaw: 0 });
    this.ctrl.connect(this.canvas);
    this.vm = createViewmodels(THREE); this.camera.add(this.vm.group);
    this.hud = createHUD(root); this.hud.root.style.display = 'none';
    this.ws = createWeaponSystem(THREE, this.vm, this.hud);
    this.ws.onEvent = (n, d) => this.onWeaponEvent(n, d);
    this.player = createPlayerState();
    this.bots = createBots(THREE, this.scene, m, { raycast, colliders: this.world });
    this.anim = createAnimations(THREE, { scene: this.scene, camera: this.camera, vm: this.vm, root: root, renderer: this.renderer, bots: this.bots }); this.anim.settings.slowmo = false; this.anim.settings.tracers = false;
    this.killfx = createKillFX(THREE, { scene: this.scene, camera: this.camera, container: root, audioContext: getContext,
      groundAt: (x, z, y) => { const h = this.map.getHeight(x, z); return isFinite(h) ? h : y; },
      raycastWorld: (o, d, max) => { const h = raycast(o, d, { colliders: this.world, maxDistance: max }); return h && h.kind === 'world' ? { point: h.point, normal: h.normal } : null; } });
    this.killfx.config.slowmo = false; // killcam owns time; only last-enemy kills get the cinematic
    this.streaks = createStreaks({ THREE, renderer: this.renderer, scene: this.scene, camera: this.camera, root, ctrl: this.ctrl, bots: this.bots, map: m, world: this.world, raycast, play, vm: this.vm,
      isPlaying: () => this.state === 'play',
      damageBot: (b, amount, meta) => { if (this.mp && this.mp.active) { this.mp.xdmg(b, amount); return false; } const hp = b.health; this.bots.damage(b, Math.max(0, hp - amount), false); return !b.alive; },
      onKill: ({ bot }) => { this.kills++; this.score += 100; this.kf.textContent = 'Streak kill +100'; this.kfT = 1.5; this.hud.hitMarker(true, false); play('kill'); } });
    this.streaks.on('earned', () => play('streak_earned')); this.streaks.on('called', ({ id }) => play(id === 'nuke' ? 'nuke' : 'streak_call'));
    this.streaks.on('explosion', ({ position, radius, source }) => this.destruction.damage(position, radius, source === 'rc' ? 150 : 200, { source }));
    this.grenades = createGrenades(THREE, { scene: this.scene, map: m, colliders: this.world,
      raycast, destruction: this.destruction, getTargets: () => this.bots.list,
      onDamage: (b, amount) => { if (this.mp && this.mp.active) { this.mp.xdmg(b, amount); return; } const alive = b.alive; this.bots.damage(b, Math.max(0, b.health - amount), false);
        if (alive && !b.alive) { this.eco.recordKill({ id: b.id, weapon: 'frag' }); this.streaks.registerKill({ headshot: false }); this.kills++; this.score += 100; } },
      onFlash: (b, seconds) => { b.grenadeFlash = Math.max(b.grenadeFlash || 0, seconds); }
    });
    this.bots.smokeLOS = (a, b) => this.grenades.blocksSight(a, b);
    this.bots.refreshNavigation?.();
    this.streaks.show(false);
    this.info = document.createElement('div'); this.info.className = 'info'; root.appendChild(this.info);
    this.kf = document.createElement('div'); this.kf.className = 'kf'; root.appendChild(this.kf);
    this.hint = document.createElement('div'); this.hint.style.cssText = 'position:absolute;right:200px;bottom:34px;z-index:21;font-weight:800;font-size:18px;text-shadow:0 2px 4px #000;pointer-events:none'; root.appendChild(this.hint);
    this.sb = document.createElement('div'); this.sb.className = 'scb'; this.sb.style.display = 'none'; root.appendChild(this.sb); this.sbm = document.createElement('div'); this.sbm.className = 'sbm'; this.sbm.style.display = 'none'; root.appendChild(this.sbm);
    this.match = { p: 0, b: 0, round: 1, over: false };
    this.perf = document.createElement('div'); this.perf.style.cssText = 'position:absolute;left:8px;top:8px;z-index:200;font:700 10px/1 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.45);padding:5px 8px;border-radius:8px;pointer-events:none'; this.perf.textContent = '-- FPS · -- ms'; root.appendChild(this.perf); this.pf = { n: 0, t: 0, worst: 0 };
    this.setOv = document.createElement('div'); this.setOv.className = 'setov'; this.setOv.style.display = 'none'; root.appendChild(this.setOv);
    this.invb = document.createElement('div'); this.invb.className = 'invb'; this.invb.style.display = 'none'; root.appendChild(this.invb); this.invh = document.createElement('div'); this.invh.className = 'invh'; root.appendChild(this.invh); this.invSig = '';
    this.knifeOn = false; this.knifeCd = 0; this.slashT = -1; this.makeKnife();
    this.ov = document.createElement('div'); this.ov.className = 'ov'; root.appendChild(this.ov);
    this.kc = createKillCam(THREE, { scene: this.scene, camera: this.camera, renderer: this.renderer, root, raycast, colliders: this.world, getGround: (x, z) => m.getHeight(x, z), hideHud: (on) => { this.kcHide = on; this.hud.root.style.display = on || this.state === 'menu' ? 'none' : ''; this.info.style.visibility = this.kf.style.visibility = on ? 'hidden' : ''; } });
    this.fx = []; this.cineOK = false;
    { const q = /[?&]diff=(rookie|chill|easy|medium|hard|veteran|elite|insane)/.exec(location.search); this.diff = q ? q[1] : 'hard';
      } this.state = 'menu'; this.mode = 'bomb'; this.locked = false; this.wasLocked = false;
    this.ctrl.setEnabled(false);
    this.bomb = { planted: false, pos: new THREE.Vector3(), t: 0, site: '', defuseT: 0, beepT: 0 };
    this.bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xff0000, emissiveIntensity: 0.7 }));
    this.bombMesh.visible = false; this.scene.add(this.bombMesh);
    this.eDown = false; this.plantT = 0; this.stepT = 0; this.score = 0; this.kills = 0; this.heads = 0;
    initAudio({ volume: 0.7, ambient: true }); this.loadSettings(); this.applySettings();
    { const kick = () => { ['pointerdown', 'keydown'].forEach((ev) => window.removeEventListener(ev, kick, true)); setTimeout(() => { try { startMusic(this.musicMode || 'menu'); this.applySettings(); } catch (e) {} }, 80); }; ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, kick, true)); }
    this.bindEvents(); this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(root);
    this.last = performance.now(); this.running = true; this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    this.mp = createMultiplayer(this, THREE);
    this.showMenu(); if (!/[?&]nointro/.test(location.search)) playIntro(root, () => {});
    if (/[?&]room=/.test(location.search)) setTimeout(() => this.openMP(), 50);
  }
  resize() {
    const w = this.root.clientWidth || 640, h = this.root.clientHeight || 360;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  bindEvents() {
    const d = document, c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => {
      if (this.state !== 'play') return;
      if (this.streaks.controlling || (this.eco && this.eco.getState().menuOpen)) { return; }
      if (!this.ctrl.state.pointerLocked) this.ctrl.requestPointerLock();
      if (e.button === 0 && this.plantT <= 0) { if (this.knifeOn) this.slash(); else this.ws.setTrigger(true); }
      if (e.button === 2 && !this.knifeOn) { this.aimDownAt = performance.now(); if (this.ws.aiming) { this.ws.setAim(false); this.aimSkipUp = true; } else this.ws.setAim(true); }
      e.preventDefault();
    });
    d.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.ws.setTrigger(false);
      if (e.button === 2) { if (this.aimSkipUp) this.aimSkipUp = false; else if (performance.now() - this.aimDownAt > 350) this.ws.setAim(false); } // tap = toggle, hold = classic
    });
    d.addEventListener('keydown', (e) => { if (this.state === 'play' && e.code === 'KeyQ' && !e.repeat) this.ws.setAim(!this.ws.aiming); });
    d.addEventListener('wheel', (e) => { if (this.state === 'play') { const inv = this.eco.getState().inventory; this.pick(this.ws.current === inv.primary ? 'secondary' : 'primary'); } }, { passive: true });
    d.addEventListener('pointerlockchange', () => {
      const on = d.pointerLockElement === c;
      if (on) { this.wasLocked = true; } else if (this.wasLocked) { this.wasLocked = false; if (this.state === 'play' && !(this.mp && this.mp.active) && !(this.eco && this.eco.getState().menuOpen) && !this.streaks.controlling) this.pause(); }
    });
    d.addEventListener('keydown', (e) => {
      if (this.state !== 'play') return;
      if (e.code === 'Escape') { if (this.setOv.style.display !== 'none') { this.closeSettings(); return; } if (this.mp && this.mp.active) return; this.pause(); return; }
      if (this.eco && this.eco.getState().menuOpen) return;
      if (e.code === 'Digit1') this.pick('primary'); else if (e.code === 'Digit2') this.pick('secondary'); else if (e.code === 'Digit3' && !e.repeat) this.toggleKnife(); else if (e.code === 'KeyF' && !e.repeat) this.inspect();
      if (!e.repeat && ['KeyV', 'KeyH', 'KeyJ'].includes(e.code)) { this.throwGrenade({ KeyV: 'frag', KeyH: 'smoke', KeyJ: 'flash' }[e.code]); return; }
      else if (e.code === 'KeyR') { if (!this.knifeOn) this.ws.reload(); } else if (e.code === 'KeyE') { this.eDown = true; if (!e.repeat) this.tryPickup(); }
    });
    d.addEventListener('keyup', (e) => { if (e.code === 'KeyE') this.eDown = false; });
  }
  makeKnife() {
    const k = new THREE.Group(), mat = (c) => new THREE.MeshToonMaterial({ color: c }); this.kn = {}; const S = 1.5;
    const add = (name, m, x, y, z) => { m.position.set(x, y, z); k.add(m); if (name) this.kn[name] = m; return m; };
    const outline = (m, s = 1.08) => { const o = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: 0x2a2140, side: THREE.BackSide })); o.scale.setScalar(s); m.add(o); };
    // curved karambit blade: side profile extruded thin, bevelled
    const sh = new THREE.Shape(); const P = (u, v) => [u * S, v * S];
    sh.moveTo(...P(0, 0.018)); sh.quadraticCurveTo(...P(0.06, 0.042), ...P(0.115, 0.012)); sh.quadraticCurveTo(...P(0.15, -0.012), ...P(0.158, -0.082));
    sh.quadraticCurveTo(...P(0.112, -0.03), ...P(0.07, -0.012)); sh.quadraticCurveTo(...P(0.035, 0.0), ...P(0, -0.014)); sh.closePath();
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 14 }); bg.translate(0, 0, -0.003);
    const blade = new THREE.Mesh(bg, mat(0xe8f4ff)); blade.rotation.y = Math.PI / 2; add('blade', blade, 0, 0, -0.04); outline(blade, 1.07);
    // spine ridge (thicker contour along the top edge) + bevel highlight along the edge
    const sp = new THREE.Shape(); sp.moveTo(...P(0, 0.018)); sp.quadraticCurveTo(...P(0.06, 0.042), ...P(0.115, 0.012)); sp.quadraticCurveTo(...P(0.15, -0.012), ...P(0.158, -0.082));
    sp.quadraticCurveTo(...P(0.152, -0.05), ...P(0.12, 0.0)); sp.quadraticCurveTo(...P(0.06, 0.03), ...P(0, 0.006)); sp.closePath();
    const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 14 }); sg.translate(0, 0, -0.0055);
    const spine = new THREE.Mesh(sg, mat(0xffffff)); spine.rotation.y = Math.PI / 2; add('spine', spine, 0, 0, -0.04);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(0xffffff)); add('tip', tip, 0, -0.082 * S, -0.04 - 0.158 * S);
    // handle: tapered cylinder along z with wrap rings
    const hg = new THREE.CylinderGeometry(0.019, 0.024, 0.15, 14); hg.rotateX(Math.PI / 2);
    const handle = new THREE.Mesh(hg, mat(0xff7a3c)); add('handle', handle, 0, -0.004, 0.035); outline(handle, 1.12);
    this.kn.wraps = []; for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.0225 + i * 0.0005, 0.0042, 6, 16), mat(0xffd9a8)); w.position.set(0, -0.004, -0.03 + i * 0.0205); w.userData.z = w.position.z; k.add(w); this.kn.wraps.push(w); }
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.009, 16), mat(0xffb347)); guard.rotation.x = Math.PI / 2; add('guard', guard, 0, -0.004, -0.045); outline(guard, 1.1);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat(0xffb347)); add('kite', pom, 0, -0.004, 0.118); outline(pom, 1.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0085, 8, 20), mat(0xffb347)); ring.position.set(0, -0.045, 0.125); ring.rotation.y = Math.PI / 2; k.add(ring); this.kn.ring = ring; outline(ring, 1.12);
    // hand: palm + four fingers wrapped over the handle + thumb
    const skin = 0xf2c9a0; const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), mat(skin)); add('hand', palm, 0.005, -0.012, 0.075); outline(palm, 1.1);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 4, 8), mat(skin)); f.rotation.z = Math.PI / 2; add(null, f, -0.02, 0.012, 0.012 + i * 0.0165); }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.04, 4, 8), mat(skin)); th.rotation.x = Math.PI / 2; th.rotation.z = 0.2; add(null, th, 0.03, 0.02, 0.01);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.2, 12), mat(0x2a6fd6)); sl.rotation.x = Math.PI / 2 - 0.15; add('sleeve', sl, 0.01, -0.02, 0.2); outline(sl, 1.06);
    k.visible = false; k.userData.home = new THREE.Vector3(0.15, -0.13, -0.5); k.position.copy(k.userData.home); k.rotation.set(0.6, 0.3, -0.2);
    this.camera.add(k); this.knife = k; this.knSkin = false; this.inspectT = -1;
  }
  applyKnifeSkin(on) {
    if (on === this.knSkin) return; this.knSkin = on; const K = this.kn, c = (m, h) => m.material.color.set(h);
    if (on) { c(K.blade, 0xff9ac8); c(K.tip, 0x9ad1ff); c(K.spine, 0xffffff); c(K.guard, 0xffd166); c(K.kite, 0x7dffb0); c(K.handle, 0x8f5cff); c(K.ring, 0xffd166); K.wraps.forEach((w) => c(w, 0xd9c2ff)); c(K.handle, 0x8f5cff); }
    else { c(K.blade, 0xe8f4ff); c(K.tip, 0xe8f4ff); c(K.spine, 0xffffff); c(K.guard, 0xffb347); c(K.kite, 0xffb347); c(K.handle, 0xff7a3c); c(K.ring, 0xffb347); K.wraps.forEach((w) => c(w, 0xffd9a8)); }
  }
  toggleKnife() { if (this.knifeOn) { const inv = this.eco.getState().inventory; this.pick('primary'); if (this.knifeOn) this.unKnife(); return; } this.ws.setTrigger(false); this.ws.setAim(false); this.knifeOn = true; this.vm.group.visible = false; this.knife.visible = true; this.slashT = -1; play('ui_click'); }
  unKnife() { if (!this.knifeOn) return; this.knifeOn = false; this.knife.visible = false; this.vm.group.visible = true; }
  inspect() { if (this.knifeOn && this.slashT < 0 && this.inspectT < 0) this.inspectT = 0; }
  slash() {
    if (!this.player.alive || this.knifeCd > 0 || this.state !== 'play') return;
    const es = this.eco.getState(); if (es.menuOpen) return;
    this.knifeCd = 0.42; this.slashT = 0; play('hit');
    if (this.mp && this.mp.active && this.mp.net) { this.mp.net.sendRaw({ t: 'knife' }); return; }   // server decides the hit (one-hit kill)
    const o = this.ctrl.state.eye, d = this.ctrl.getDirection(); let best = null, bd = 1e9;
    for (const b of this.bots.list) {
      if (!b.alive) continue; const p = b.position, vx = p.x - o.x, vy = p.y + 1.0 - o.y, vz = p.z - o.z, dist = Math.hypot(vx, vy, vz);
      if (dist > 2.7 || dist < 0.01) continue; const dot = (vx * d.x + vy * d.y + vz * d.z) / dist; if (dot < 0.55) continue;
      const wall = raycast(o, { x: vx / dist, y: vy / dist, z: vz / dist }, { colliders: this.world, maxDistance: dist }); if (wall) continue;
      if (dist < bd) { bd = dist; best = { b, dist, dir: { x: vx / dist, y: vy / dist, z: vz / dist }, point: { x: p.x, y: p.y + 1.0, z: p.z } }; }
    }
    if (!best) return;
    const b = best.b, fx = -Math.sin(b.yaw || 0), fz = -Math.cos(b.yaw || 0), back = fx * d.x + fz * d.z > 0.35, dmg = back ? 200 : 55;
    const hp0 = b.health, hp = Math.max(0, hp0 - dmg), killed = hp <= 0;
    this.bots.damage(b, hp, false); this.cineOK = killed && this.bots.aliveCount() <= 1;
    try { this.killfx.hit({ bot: b, point: best.point, zone: 'body', weapon: 'knife', damage: hp0 - hp, killed, headshot: false, origin: o, dir: best.dir, distance: best.dist, scoped: false, last: this.cineOK }); } catch (e) { try { this.killfx.hit({ bot: b, point: best.point, zone: 'body', weapon: 'pistol', damage: hp0 - hp, killed, headshot: false, origin: o, dir: best.dir, distance: best.dist, scoped: false, last: this.cineOK }); } catch (e2) {} }
    play(killed ? 'kill' : 'hit');
    if (killed) {
      this.streaks.registerKill({ headshot: false }); this.eco.recordKill({ id: b.id, headshot: false, weapon: 'pistol' });
      const bw = (b.ch && b.ch.weapon) || 'machinegun'; if (!(this.mp && this.mp.active)) this.addDrop({ dropId: 'bot-' + b.id + '-' + Date.now(), weapon: bw, ammo: { mag: 12, reserve: 24 }, position: { x: b.position.x, y: b.position.y, z: b.position.z } });
      this.kills++; this.score += back ? 150 : 100; this.kf.textContent = back ? 'BACKSTAB +150' : 'Kill +100'; this.kfT = 1.5;
    } else { this.kf.textContent = 'Slash -55'; this.kfT = 0.8; }
  }
  updateKnife(dt) {
    if (this.knifeCd > 0) this.knifeCd -= dt;
    const k = this.knife; if (!k.visible) return; const h = k.userData.home; this.applyKnifeSkin(!!this.eco.getState().inventory.knifeskin);
    if (this.knSkin) { const hue = (performance.now() / 2500) % 1; this.kn.blade.material.color.setHSL(0.9 - 0.3 * Math.abs(Math.sin(hue * 6.28)), 0.8, 0.78); }
    const R0 = [0.6, 0.3, -0.2];
    if (this.slashT >= 0) { this.slashT += dt; const t = Math.min(1, this.slashT / 0.32), e = Math.sin(t * Math.PI), w = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      k.position.set(h.x - 0.34 * t + 0.08 * Math.sin(Math.min(1, t * 2) * Math.PI / 2) * (1 - t), h.y + 0.08 * e - 0.04 * t, h.z - 0.14 * e);
      k.rotation.set(R0[0] - 0.9 * e, R0[1] + 1.0 * t - 0.4 * w, R0[2] - 1.1 * e); if (t >= 1) this.slashT = -1; }
    else if (this.inspectT >= 0) { this.inspectT += dt; const t = Math.min(1, this.inspectT / 2.2), e = Math.sin(Math.min(1, t * 1.2) * Math.PI);
      k.position.set(h.x - 0.14 * e, h.y + 0.1 * e, h.z + 0.08 * e); k.rotation.set(R0[0] + 0.3 * e, R0[1] - 0.6 * e, R0[2] + Math.PI * 2 * t - 0.5 * e); if (t >= 1) { this.inspectT = -1; } }
    else { const b = Math.sin(performance.now() / 600) * 0.004; k.position.set(h.x, h.y + b, h.z); k.rotation.set(R0[0], R0[1], R0[2] + Math.sin(performance.now() / 900) * 0.02); }
  }
  renderInv() {
    const es = this.eco.getState(), inv = es.inventory, cur = this.knifeOn ? 'knife' : this.ws.current, gr = inv.grenades || {};
    const nm = (id) => (id && WEAPON_STATS[id] && WEAPON_STATS[id].name) || id || '';
    const sig = [inv.primary, inv.secondary, cur, gr.frag, gr.smoke, gr.flash, this.state].join('|'); if (sig === this.invSig) return; this.invSig = sig;
    const it = (key, label, sub, on, extra = '') => `<div class="it${on ? ' cur' : ''}${extra}"><kbd>${key}</kbd><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    let h = '';
    h += inv.primary ? it('1', nm(inv.primary), '', cur === inv.primary) : it('1', 'Primary', 'empty', false, ' empty');
    h += it('2', nm(inv.secondary || 'pistol'), '', cur === (inv.secondary || 'pistol'));
    h += it('3', inv.knifeskin ? 'Kite Cutter' : 'Knife', '', cur === 'knife');
    const gl = [['V', 'frag', 'Frag'], ['H', 'smoke', 'Smoke'], ['J', 'flash', 'Flash']].filter(([, id]) => gr[id] > 0);
    if (gl.length) { h += '<div class="sep"></div>'; for (const [k, id, lab] of gl) h += it(k, lab, '×' + gr[id], false, ' gr'); }
    this.invb.innerHTML = h;
  }
  throwGrenade(type) {
    const s = this.eco.getState();
    if (this.state !== 'play' || s.phase !== 'live' || s.menuOpen || !this.player.alive || this.streaks.controlling) return;
    this.grenades.throwGrenade(type, { position: this.ctrl.state.eye, direction: this.ctrl.getDirection(), owner: 'player', team: s.team });
  }
  endMatchEffects(id) { this.destruction.reset(id); this.grenades.reset(id); }
  onWeaponEvent(n, d) {
    const map = { pistol: 'shot_pistol', machinegun: 'shot_mg', sniper: 'shot_sniper' };
    if (n === 'shot') play(map[d.weapon]); else if (n === 'empty') { play('empty'); this.anim.onEmpty(); } else if (n === 'reload') { play('reload'); this.anim.onReload(); } else if (n === 'switch') { play('ui_click'); this.anim.onSwitch(); }
  }
  newEconomy() {
    if (this.eco) { try { this.eco.dispose(); } catch (e) {} }
    this.owned = new Set(['pistol']);
    this.grenades?.clearRound();
    this.eco = createEconomy({ container: this.root, team: 'T', freezeTime: 10, autoOpen: false, inZone: () => this.inBuyZone(), onEvent: (n, d) => this.onEco(n, d) });
    if (this.grenades) this.grenades.setEconomy(this.eco);
  }
  syncAmmoToEco() { if (!this.eco) return; for (const id of ['pistol', 'machinegun', 'sniper']) { const a = this.ws.ammo[id]; if (a && this.eco.getState().inventory.ammo[id]) this.eco.setAmmo(id, { mag: a.mag, reserve: a.reserve }); } }
  onEco(n, d) {
    if (n === 'purchase') play('buy'); else if (n === 'denied') play('buy_fail'); else if (n === 'pickup') play('ui_click');
    if (n === 'menu') {
      if (d.open) { this.syncAmmoToEco(); this.ws.setTrigger(false); this.eDown = false; this.ctrl.exitPointerLock(); }
      else if (this.state === 'play') { try { this.ctrl.requestPointerLock(); } catch (e) {} }
    } else if (n === 'inventory' || n === 'equip' || n === 'purchase') {
      if (n === 'purchase' && d && ['frag', 'smoke', 'flash'].includes(d.id)) { const k = { frag: 'V', smoke: 'H', flash: 'J' }[d.id]; this.invh.textContent = `Grenade ready: press ${k} to throw it (once the buy phase ends)`; this.invh.style.opacity = 1; clearTimeout(this.invhT); this.invhT = setTimeout(() => { this.invh.style.opacity = 0; }, 7000); }
      const s = d.state, inv = s.inventory;
      for (const id of [inv.primary, inv.secondary]) { if (id && !this.owned.has(id)) { this.owned.add(id); const a = inv.ammo[id]; if (a) { this.ws.ammo[id].mag = a.mag; this.ws.ammo[id].reserve = a.reserve; } } }
      for (const id of Array.from(this.owned)) if (id !== inv.primary && id !== inv.secondary) this.owned.delete(id);
      if (!this.owned.has(this.ws.current)) { this.ws.select(inv.secondary || 'pistol'); }
      if (n === 'equip' && d.weapon) { this.unKnife(); this.ws.select(d.weapon); }
    } else if (n === 'drop') { if (d.drop) this.addDrop(d.drop); else if (d.dropId) this.addDrop(d); }
    else if (n === 'reward' || n === 'money') { /* eco chip shows money */ }
  }
  renderSB() {
    const m = this.match, pips = (w, c) => Array.from({ length: 3 }, (_, i) => `<i class="pip${i < w ? ' on' : ''}" style="--c:${c}"></i>`).join('');
    this.sb.style.display = this.state === 'menu' ? 'none' : 'flex';
    this.sb.innerHTML = `<span class="pips">${pips(m.p, '#7dffb0')}</span><b>${m.p}</b><span class="sep">:</span><b>${m.b}</b><span class="pips">${pips(m.b, '#ffb35c')}</span><span class="rd">R${Math.min(5, m.round)}/5</span>`;
    this.updSBMoney();
  }
  updSBMoney() {
    if (this.mp && this.mp.active && this.mp.net && this.sbm) { const n = this.mp.net, av = n.avg || [0, 0], f = (v) => '$' + Math.round(v).toLocaleString('en-US'); this.sbm.style.display = 'flex'; this.sbm.innerHTML = `<span style="color:#7dffb0">${f(this.eco.getState().money)}</span><span class="l">AVG $ / PLAYER</span><span style="color:#ffb35c">${f(n.team === 'T' ? av[1] : av[0])}</span>`; return; }
  }
  setMusicMode(m) { this.musicMode = m; try { setMusicMode(m); } catch (e) {} }
  loadSettings() { let s = {}; try { s = JSON.parse(localStorage.getItem('sc_settings') || '{}'); if (!localStorage.getItem('sc_diff_hard')) { delete s.diff; localStorage.setItem('sc_diff_hard', '1'); localStorage.setItem('sc_settings', JSON.stringify(s)); } } catch (e) {} this.set = Object.assign({ fps: false, sens: 1, bots: 4, vol: 0.7, fx: 1, music: 0.5, sfxOn: true, musicOn: true, diff: this.diff }, s); }
  saveSettings() { try { localStorage.setItem('sc_settings', JSON.stringify(this.set)); } catch (e) {} }
  applySettings() {
    const s = this.set; this.perf.style.display = s.fps ? '' : 'none';
    if (this.ctrl.setSensitivity) this.ctrl.setSensitivity(0.0022 * s.sens);
    try { setVolume(s.sfxOn === false ? 0 : s.vol * s.fx); setMusicLevel(s.music, s.vol, s.musicOn !== false); } catch (e) {}
    this.diff = s.diff;
  }
  openSettings() {
    const s = this.set, o = this.setOv; o.style.display = 'flex';
    o.innerHTML = `<div class="setp"><h2>Settings</h2>
<label class="sr"><span>FPS / ms counter</span><input type="checkbox" data-k="fps" ${s.fps ? 'checked' : ''}></label>
<label class="sr"><span>Sensitivity <em data-v="sens">${s.sens.toFixed(2)}x</em></span><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sens}" data-k="sens"></label>
<label class="sr"><span>Master volume <em data-v="vol">${Math.round(s.vol * 100)}%</em></span><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-k="vol"></label>
<label class="sr"><span>Effects volume <em data-v="fx">${Math.round(s.fx * 100)}%</em></span><input type="range" min="0" max="1" step="0.05" value="${s.fx}" data-k="fx"></label>
<label class="sr"><span>Music volume <em data-v="music">${Math.round(s.music * 100)}%</em></span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
<label class="sr"><span>Sound effects</span><input type="checkbox" data-k="sfxOn" ${s.sfxOn !== false ? 'checked' : ''}></label>
<label class="sr"><span>Music</span><input type="checkbox" data-k="musicOn" ${s.musicOn !== false ? 'checked' : ''}></label>
<label class="sr"><span>Bots in Play vs bots <small>(next room)</small></span><select data-k="bots"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
<label class="sr"><span>Bot difficulty <small>(from next round)</small></span><select data-k="diff"><option value="rookie">Rookie</option><option value="chill">Chill</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="veteran">Veteran</option><option value="elite">Elite</option><option value="insane">Insane</option></select></label>
<button class="b" data-close>Back</button></div>`;
    o.querySelector('select[data-k=diff]').value = s.diff; o.querySelector('select[data-k=bots]').value = String(s.bots || 4);
    o.querySelectorAll('[data-k]').forEach((el) => { el.oninput = el.onchange = () => { const k = el.dataset.k; s[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? (k === 'bots' ? parseInt(el.value, 10) : el.value) : parseFloat(el.value); const v = o.querySelector(`[data-v="${k}"]`); if (v) v.textContent = k === 'sens' ? s.sens.toFixed(2) + 'x' : Math.round(s[k] * 100) + '%'; this.applySettings(); this.saveSettings(); }; });
    o.querySelector('[data-close]').onclick = () => this.closeSettings();
  }
  closeSettings() { this.setOv.style.display = 'none'; this.setOv.innerHTML = ''; }
  setZone() {
    const sp = this.spawnT; this.zone = { x: sp.x, z: sp.z, y: sp.y, h: 2.5 };
    if (!this.zoneMesh) {
      const gp = new THREE.Group(); const fill = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: 0x7affc4, transparent: true, opacity: 0.18, depthWrite: false })); fill.rotation.x = -Math.PI / 2; gp.add(fill);
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.5, 0, -2.5), new THREE.Vector3(2.5, 0, -2.5), new THREE.Vector3(2.5, 0, 2.5), new THREE.Vector3(-2.5, 0, 2.5)]), new THREE.LineBasicMaterial({ color: 0xffffff })); gp.add(edge);
      const wm = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }); this.barMat = wm;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cx = cv.getContext('2d'); cx.fillStyle = 'rgba(160,220,255,.45)'; cx.fillRect(0, 0, 64, 64); cx.strokeStyle = 'rgba(255,255,255,.95)'; cx.lineWidth = 4; cx.strokeRect(0, 0, 64, 64); cx.beginPath(); cx.moveTo(0, 64); cx.lineTo(64, 0); cx.stroke();
      const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(5, 2.5); wm.map = tx; wm.color.set(0xd6f0ff);
      this.barrier = new THREE.Group();
      for (const [x, z, ry] of [[0, -2.5, 0], [0, 2.5, 0], [-2.5, 0, Math.PI / 2], [2.5, 0, Math.PI / 2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), wm); w.position.set(x, 1.25, z); w.rotation.y = ry; this.barrier.add(w); }
      const rail = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.5, 2.5, -2.5), new THREE.Vector3(2.5, 2.5, -2.5), new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(-2.5, 2.5, 2.5)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true })); this.barRail = rail; this.barrier.add(rail); gp.add(this.barrier);
      this.zoneMesh = gp; this.scene.add(gp);
    }
    this.barA = 1;
    this.zoneMesh.position.set(sp.x, sp.y + 0.05, sp.z); this.drops = this.drops || [];
    for (const d of this.drops) this.scene.remove(d.mesh); this.drops = [];
  }
  inBuyZone() { const p = this.ctrl.state.position, z = this.zone; return !!z && Math.abs(p.x - z.x) <= z.h && Math.abs(p.z - z.z) <= z.h && Math.abs(p.y - z.y) < 2; }
  addDrop(drop) {
    const idx = { pistol: 0, machinegun: 1, sniper: 2 }[drop.weapon] ?? 0; let mesh;
    const src = this.vm.group.children[idx];
    if (src) { mesh = src.clone(true); mesh.visible = true; mesh.traverse((o) => { o.visible = o.userData && o.userData.isFlash ? false : true; }); mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(1.7); }
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const holder = new THREE.Group(); holder.add(mesh); mesh.rotation.z = Math.PI / 2; mesh.position.y = 0.12;
    const gh = this.map.getHeight(drop.position.x, drop.position.z); const gy = Number.isFinite(gh) ? Math.max(gh, (drop.position.y || 0) - 0.5) : (drop.position.y || 0);
    holder.position.set(drop.position.x, gy + 0.03, drop.position.z); holder.rotation.y = Math.random() * 6.28; this.scene.add(holder);
    (this.drops = this.drops || []).push({ drop, mesh: holder, t: 0 });
  }
  nearestDrop() { const p = this.ctrl.state.position; let best = null, bd = 1.6; for (const d of this.drops || []) { const dd = Math.hypot(p.x - d.mesh.position.x, p.z - d.mesh.position.z); if (dd < bd && Math.abs(p.y - d.mesh.position.y) < 2 && d.t > 0.6) { bd = dd; best = d; } } return best; }
  tryPickup() {
    const d = this.nearestDrop(); if (!d) return false;
    if (this.mp && this.mp.active) { this.mp.pickup(d.drop.dropId); return true; }
    this.syncAmmoToEco(); const r = this.eco.pickupDrop(d.drop); if (!r || r.ok === false) { this.kf.textContent = (r && r.reason) || 'Cannot pick up now'; this.kfT = 1.2; return false; }
    this.scene.remove(d.mesh); this.drops.splice(this.drops.indexOf(d), 1);
    if (d.drop.ammo && this.ws.ammo[d.drop.weapon]) { this.ws.ammo[d.drop.weapon].mag = d.drop.ammo.mag ?? this.ws.ammo[d.drop.weapon].mag; this.ws.ammo[d.drop.weapon].reserve = d.drop.ammo.reserve ?? this.ws.ammo[d.drop.weapon].reserve; }
    this.owned.add(d.drop.weapon); this.kf.textContent = 'Weapon picked up'; this.kfT = 1.2; return true;
  }
  updateDrops(dt) {
    for (const d of this.drops || []) d.t += dt;
    const n = this.nearestDrop(); this.hint.textContent = n ? 'E · pick up ' + (WEAPON_STATS[n.drop.weapon] ? WEAPON_STATS[n.drop.weapon].name : n.drop.weapon) : '';
  }
  pick(slot) { this.unKnife(); const inv = this.eco.getState().inventory; const id = slot === 'primary' ? inv.primary : inv.secondary; if (id && this.eco.selectWeapon(id)) this.ws.select(id); }
  overlay(html, btns) {
    if (this.menuStop) { this.menuStop(); this.menuStop = null; }
    this.ov.style.display = 'flex'; this.ov.innerHTML = html;
    const row = document.createElement('div'); row.className = 'row';
    for (const [t, fn, alt] of btns) { const b = document.createElement('button'); b.className = 'b' + (alt ? ' alt' : ''); b.textContent = t; b.onclick = fn; row.appendChild(b); }
    if (btns.length) this.ov.appendChild(row);
  }
  plantAnimTick(dt) {
    if (!this.handBomb) {
      const grp = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.13), new THREE.MeshLambertMaterial({ color: 0x2b3340 }));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b })); led.position.set(0.07, 0.05, 0);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.07), new THREE.MeshBasicMaterial({ color: 0x7fe3ff })); pad.position.set(-0.03, 0.05, 0);
      const skin = new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }), hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.09), skin), hr = hl.clone(); hl.position.set(-0.12, 0, 0.05); hr.position.set(0.12, 0, 0.05);
      grp.add(box, led, pad, hl, hr); grp.visible = false; this.camera.add(grp); this.handBomb = { grp, led, hr, a: 0 };
    }
    const H = this.handBomb, want = (this.plantT > 0 && !this.bomb.planted) ? 1 : 0; H.a += (want - H.a) * Math.min(1, dt * 10); const a = H.a;
    H.grp.visible = a > 0.02; if (a >= 0.5 && !H.hid) { H.hid = true; H.was = this.vm.group.visible; this.vm.group.visible = false; } else if (a < 0.5 && H.hid) { H.hid = false; this.vm.group.visible = this.knifeOn ? false : true; }
    if (H.grp.visible) { const t = performance.now() / 1000; H.grp.position.set(0, -0.42 + 0.22 * a, -0.5); H.grp.rotation.set(0.5 - 0.25 * a, 0, 0); H.hr.position.y = Math.abs(Math.sin(t * 7)) * 0.03; H.led.visible = Math.sin(t * 14) > 0; }
  }
  startDeathCam(from, msg) {
    if (!from) return;
    this.deathCam = { t: 0, from: from.clone ? from.clone() : new THREE.Vector3(from.x, from.y, from.z), msg, banner: document.createElement('div') };
    const b = this.deathCam.banner; b.style.cssText = 'position:absolute;left:50%;bottom:14%;transform:translateX(-50%);z-index:40;font:600 34px Fredoka,system-ui;letter-spacing:.14em;color:#fff;text-shadow:0 0 4px #000,0 3px 10px rgba(0,0,0,.8);pointer-events:none'; b.textContent = 'ELIMINATED'; this.root.appendChild(b);
    try { this.vm.group.visible = false; } catch (e) {} this.hud.root.style.display = 'none';
  }
  deathCamApply(real) {
    const d = this.deathCam; if (!d) return; d.t += real;
    const pe = this.ctrl.state.eye, k = Math.min(1, d.t / 0.5);
    this.camera.position.set(d.from.x + (pe.x - d.from.x) * 0.03, d.from.y + 0.05, d.from.z + (pe.z - d.from.z) * 0.03);
    this.camera.lookAt(pe.x, pe.y - 0.1 * k, pe.z); this.camera.fov = 75 - 20 * k; this.camera.updateProjectionMatrix();
    if (d.t > 2.4) { d.banner.remove(); this.deathCam = null; this.hud.root.style.display = ''; this.camera.fov = 75; this.camera.updateProjectionMatrix(); try { this.vm.group.visible = true; } catch (e) {} }
  }
  openSolo() { let seen = false; try { seen = !!localStorage.getItem('sc_tut'); } catch (e) {} if (!seen) { this.tutorial(() => this.openSolo()); return; } if (this.menuStop) { this.menuStop(); this.menuStop = null; } this.ov.style.display = 'none'; play('ui_start'); this.mp.solo(); }
  openMP() { if (this.menuStop) { this.menuStop(); this.menuStop = null; } this.ov.style.display = 'none'; this.mp.open(); }
  renderMP() { if (this.look) this.look.render(this.camera); else this.renderer.render(this.scene, this.camera); }
  showMenu() {
    if (this.mp && this.mp.active) this.mp.stop(); this.ov.style.display = 'flex';
    this.state = 'menu'; this.sb.style.display = 'none'; if (this.sbm) this.sbm.style.display = 'none'; this.streaks.cancel('menu'); this.streaks.show(false); this.hud.root.style.display = 'none'; this.info.textContent = ''; this.kf.textContent = '';
    this.ctrl.setEnabled(false); this.ctrl.exitPointerLock();
    this.overlay('', []); this.menuStop = buildMenu(this, THREE, createCharacter, ROSTER);
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; this.ctrl.setEnabled(false); this.ws.setTrigger(false); this.ws.setAim(false); this.eDown = false; this.ctrl.exitPointerLock();
    this.overlay('<h2>Paused</h2><p>Click to continue (captures the mouse).</p>', [['Resume', () => this.resume()], ['Settings', () => this.openSettings(), true], ['Quit to menu', () => this.showMenu(), true]]);
  }
  resume() { this.ov.style.display = 'none'; this.state = 'play'; this.ctrl.setEnabled(true); this.ctrl.requestPointerLock(); }
  tutorial(then) { if (this.menuStop) { try { this.menuStop(); } catch (e) {} } this.ov.style.display = 'none'; showTutorial(this.root, () => { try { localStorage.setItem('sc_tut', '1'); } catch (e) {} if (then) then(); else this.showMenu(); }); }
  tracer(a, b, color = 0xfff2a0, life = 0.07) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]); const m = new THREE.LineBasicMaterial({ color, transparent: true });
    const l = new THREE.Line(g, m); this.scene.add(l); this.fx.push({ l, t: life, life });
  }
  fireShots(shots) {
    const st = this.ctrl.state, o = { x: st.eye.x, y: st.eye.y, z: st.eye.z }, muzzle = new THREE.Vector3();
    this.vm.muzzleWorldPosition(muzzle);
    if (shots.length && this.bots.noise) this.bots.noise(o.x, o.z, 34);
    for (const s of shots) {
      const yaw = st.yaw + s.dir.x, pit = st.pitch + s.dir.y, cp = Math.cos(pit);
      const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pit), z: -Math.cos(yaw) * cp };
      let hit = raycast(o, dir, { colliders: this.world, targets: this.bots.list, maxDistance: s.range });
      if (hit && hit.kind === 'target' && wallBlocked(o, dir, hit.distance, this.world, 0.07)) hit = raycast(o, dir, { colliders: this.world, maxDistance: s.range }); // grazing a corner: wall wins
      else if (hit && hit.kind === 'target') { const mz = { x: muzzle.x - o.x, y: muzzle.y - o.y, z: muzzle.z - o.z }, ml = Math.hypot(mz.x, mz.y, mz.z); if (ml > 0.05 && ml < 2 && wallBlocked(o, mz, ml + 0.02, this.world, 0.02)) hit = raycast(o, dir, { colliders: this.world, maxDistance: s.range }); } // gun poking through a wall
      const end = hit ? hit.point : { x: o.x + dir.x * s.range, y: o.y + dir.y * s.range, z: o.z + dir.z * s.range };
      if (hit?.kind === 'world') this.destruction.damageHit(hit, WEAPON_STATS[s.weapon]?.damage.body || 30);
      this.anim.onShot({ weapon: s.weapon, end, hit });
      let kh = hit ? (hit.kind === 'target' ? null : { kind: 'world', normal: hit.normal }) : null;
      if (hit && hit.kind === 'target') {
        const b = hit.target, zone = hit.zone === 'legs' ? 'limb' : hit.zone;
        const hp0 = b.health, r = applyDamage(b.health, s.weapon, zone);
        kh = { kind: 'target', bot: b, zone, headshot: r.headshot, killed: r.killed };
        this.bots.damage(b, r.hp, r.headshot); 
        this.cineOK = r.killed && this.bots.aliveCount() <= 1;
        this.killfx.hit({ bot: b, point: hit.point, zone, weapon: s.weapon, damage: hp0 - r.hp, killed: r.killed, headshot: r.headshot, origin: o, dir, distance: hit.distance, scoped: this.ws.aiming, last: this.cineOK });
        play(r.killed ? 'kill' : r.headshot ? 'headshot' : 'hit');
        if (r.killed) {
          this.streaks.registerKill({ headshot: r.headshot }); this.eco.recordKill({ id: b.id, headshot: r.headshot, weapon: s.weapon }); { const bw = (b.ch && b.ch.weapon) || 'machinegun'; this.addDrop({ dropId: 'bot-' + b.id + '-' + Date.now(), weapon: bw === 'pistol' ? 'pistol' : bw, ammo: { mag: 12, reserve: 24 }, position: { x: b.position.x, y: b.position.y, z: b.position.z } }); } this.kf.textContent = ''; this.kills++; this.score += 100 + (r.headshot ? 50 : 0); if (r.headshot) this.heads++;
          this.kf.textContent = r.headshot ? 'HEADSHOT +150' : 'Kill +100'; this.kfT = 1.5;
        }
      }
      this.kc.config.gate = () => this.cineOK; this.kc.shoot({ muzzle, end, weapon: s.weapon, hit: kh });
    }
  }
  updateBarrier(dt) {
    if (!this.barrier) return; const fr = this.eco.getState().phase === 'freeze'; this.barA += ((fr ? 1 : 0) - this.barA) * Math.min(1, dt * 2.2);
    const pulse = 0.82 + Math.sin(performance.now() / 350) * 0.18; this.barMat.opacity = 0.6 * this.barA * pulse; this.barRail.material.opacity = this.barA; this.barrier.visible = this.barA > 0.02;
    if (this.barMat.map) this.barMat.map.offset.y = (performance.now() / 4000) % 1;
  }
  startBlast(pos) {
    const P = { x: pos.x, y: pos.y, z: pos.z }, grp = new THREE.Group(); grp.position.set(P.x, P.y, P.z);
    const mk = (geo, color, op) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    const sph = mk(new THREE.IcosahedronGeometry(1, 2), 0xff8a2a, 0.9), core = mk(new THREE.IcosahedronGeometry(1, 2), 0xfff3b0, 1), ring = mk(new THREE.TorusGeometry(1, 0.08, 6, 48), 0xffffff, 0.9), ring2 = mk(new THREE.TorusGeometry(1, 0.05, 6, 48), 0xffd166, 0.8);
    ring.rotation.x = ring2.rotation.x = Math.PI / 2; ring.position.y = ring2.position.y = 0.3; grp.add(sph, core, ring, ring2);
    const cols = [0xffd166, 0xff8a5c, 0xff9ac8, 0x9ad1ff, 0xffffff, 0x7dffb0], deb = [];
    for (let i = 0; i < 70; i++) { const m = mk(new THREE.BoxGeometry(0.25 + Math.random() * 0.4, 0.25 + Math.random() * 0.4, 0.25 + Math.random() * 0.4), cols[i % cols.length], 1); m.material.depthWrite = true; const a = Math.random() * 6.28, v = 6 + Math.random() * 16; m.position.set(0, 0.5, 0); grp.add(m); deb.push({ m, vx: Math.cos(a) * v, vy: 8 + Math.random() * 16, vz: Math.sin(a) * v, rx: (Math.random() - .5) * 12, rz: (Math.random() - .5) * 12 }); }
    const light = new THREE.PointLight(0xffa04a, 12, 60, 1.5); light.position.y = 3; grp.add(light);
    this.scene.add(grp); this.blastFx = { t: 0, grp, sph, core, ring, ring2, deb, light, P }; this.shake = 1.4;
    try { this.destruction.damage(P, 14, 600, { source: 'bomb' }); } catch (e) {}
    const R = 14; for (const b of this.bots.list) { if (!b.alive) continue; if (Math.hypot(b.position.x - P.x, b.position.z - P.z) < R && Math.abs(b.position.y - P.y) < 8) { this.bots.damage(b, 0, false); const bw = (b.ch && b.ch.weapon) || 'machinegun'; this.addDrop({ dropId: 'bomb-' + b.id + '-' + Date.now(), weapon: bw, ammo: { mag: 12, reserve: 24 }, position: { x: b.position.x + (Math.random() - .5) * 3, y: b.position.y, z: b.position.z + (Math.random() - .5) * 3 } }); } }
    const pp = this.ctrl.state.position, dd = Math.hypot(pp.x - P.x, pp.z - P.z), killedMe = dd < R && Math.abs(pp.y - P.y) < 8;
    if (killedMe) { const inv = this.eco.getState().inventory; if (inv.primary) this.addDrop({ dropId: 'bomb-me-' + Date.now(), weapon: inv.primary, ammo: { mag: 12, reserve: 24 }, position: { x: pp.x + 1.2, y: pp.y, z: pp.z } }); this.player.damage(999); try { this.streaks.registerDeath(); } catch (e) {} this.hud.damageFlash(); }
    this.blasting = true; this.blastEndT = 2.1; this.blastResult = killedMe ? [false, 'The bomb got you. Get further away before it blows.'] : [true, 'The bomb went off. Round won!']; this.bomb.t = 1e9;
    play('bomb_explode');
  }
  updateBlast(dt) {
    const f = this.blastFx; if (f) { f.t += dt; const t = f.t, e = Math.min(1, t / 0.7);
      f.sph.scale.setScalar(1 + e * 11); f.sph.material.opacity = Math.max(0, 0.9 - t * 0.55); f.core.scale.setScalar(1 + e * 6); f.core.material.opacity = Math.max(0, 1 - t * 1.6);
      f.ring.scale.setScalar(1 + t * 20); f.ring.material.opacity = Math.max(0, 0.9 - t * 0.6); f.ring2.scale.setScalar(1 + t * 13); f.ring2.material.opacity = Math.max(0, 0.8 - t * 0.5); f.light.intensity = Math.max(0, 12 - t * 8);
      for (const d of f.deb) { d.vy -= 24 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; if (d.m.position.y < 0.1) { d.m.position.y = 0.1; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; } d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt; d.m.material.opacity = Math.max(0, 1 - Math.max(0, t - 1.2) * 1.2); }
      if (t > 3) { this.scene.remove(f.grp); this.blastFx = null; } }
    if (this.blasting) { this.blastEndT -= dt; if (this.blastEndT <= 0) { this.blasting = false; } }
  }
  update(dt) {
    const c = this.ctrl, st = c.state; this.updateBarrier(dt); this.updateKnife(dt); this.invb.style.display = this.state === 'play' && !this.kcHide ? 'flex' : 'none'; this.renderInv();
    const es = this.eco.getState(); this.eco.update(dt);
    this.updateDrops(dt);
    if (es.menuOpen) {
      this.ws.setTrigger(false); this.eDown = false;
      const k0 = this.ws.consumeLook(); if (k0.pitch || k0.yaw) c.look(-k0.yaw / 0.0022, -k0.pitch / 0.0022);
      c.applyToCamera(this.camera); setListener(st.eye, c.getDirection());
      this.hud.setHealth(this.player.hp);
      this.info.textContent = es.phase === 'freeze' ? `BUY PHASE · ${Math.ceil(this.eco.getState().freezeRemaining)} s · B = shop` : '';
      this.anim.update(dt, { moving: false, sprinting: false, grounded: true, playerEye: st.eye, feetY: st.position.y, bots: [] });
      return;
    }
    const MP = !!(this.mp && this.mp.active);
    if (!MP) c.update(dt);
    if (!MP && es.phase === 'freeze' && this.zone) { const z = this.zone, p = st.position; const cx = Math.max(z.x - z.h, Math.min(z.x + z.h, p.x)), cz = Math.max(z.z - z.h, Math.min(z.z + z.h, p.z)); if (cx !== p.x || cz !== p.z) c.teleport({ x: cx, y: p.y, z: cz }, { yaw: st.yaw, pitch: st.pitch }); }
    const k = this.ws.consumeLook(); if (k.pitch || k.yaw) c.look(-k.yaw / 0.0022, -k.pitch / 0.0022);
    if (MP) { this.mp.drive(this._real || dt); c.applyToCamera(this.camera); this.mp.fixCam(this.camera); } else c.applyToCamera(this.camera);
    this.camera.fov = this.ws.fov(75); this.camera.updateProjectionMatrix();
    this.streaks.update(dt);
    if (this.player.hp < 100) this.killfx.setPlayerWound(st.position, this.player.hp, 100);
    if (this.streaks.controlling) { this.eDown = false; this.ws.setTrigger(false); }
    const moving = Math.hypot(st.velocity.x, st.velocity.z) > 0.5;
    if (es.phase === 'freeze') {
      this.ws.setTrigger(false); this.eDown = false; this.ws.update(dt, { moving, sprinting: false, grounded: st.grounded });
      setListener(st.eye, c.getDirection()); this.hud.setHealth(this.player.hp);
      this.info.textContent = `BUY PHASE · ${Math.ceil(es.freezeRemaining)} s · B = shop (stay in the barrier)`;
      this.anim.update(dt, { moving, sprinting: false, grounded: st.grounded, playerEye: st.eye, feetY: st.position.y, bots: [] });
      return;
    }
    if (this.plantT > 0) this.ws.setTrigger(false);
    const shots0 = this.streaks.controlling ? [] : this.ws.update(dt, { moving, sprinting: st.speed > 5.5, grounded: st.grounded }); const shots = this.plantT > 0 ? [] : shots0;
    if (shots.length) this.fireShots(shots);
    const fwd = c.getDirection(); setListener(st.eye, fwd);
    { const gr = !!st.grounded; if (this._pg === undefined) this._pg = gr; if (this._pg && !gr && st.velocity && st.velocity.y > 1) play('jump'); else if (!this._pg && gr) play('land'); this._pg = gr; }
    if (moving && st.grounded) { this.stepT -= dt; if (this.stepT <= 0) { play('footstep'); this.stepT = st.speed > 5.5 ? 0.3 : 0.45; } }
    this.hud.setHealth(this.player.hp);
    if (this.kfT > 0) { this.kfT -= dt; if (this.kfT <= 0) this.kf.textContent = ''; }

    // bomb planting
    const bs = this.map.bombsites; let site = null;
    for (const key of ['A', 'B']) { const s = bs[key], d = Math.hypot(st.position.x - s.center.x, st.position.z - s.center.z); if (d < s.radius && Math.abs(st.position.y - s.center.y) < 2) site = key; }
    let hint = '';
    if (this.plantT > 0 && !this._plS) { this._plS = true; play('plant_start'); } else if (this.plantT <= 0) this._plS = false;
    this.plantAnimTick(dt);
    // bots
    const self = this;
    this._sbT = (this._sbT || 0) + dt; if (this._sbT > 0.5) { this._sbT = 0; this.updSBMoney(); }
    const events = this.bots.update(dt, {
      playerEye: st.eye, playerAlive: this.player.alive,
      bomb: { planted: this.bomb.planted, pos: this.bomb.pos, site: this.bomb.site, defuse(d) { self.bomb.defuseT += d; return self.bomb.defuseT >= 5; } },
    });
    for (const e of events) {
      if (e.type === 'shot') {
        play('bot_shot', e.from); this.anim.onBotShot(e.hit ? e : { ...e, to: e.to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5), (Math.random() - 0.5) * 3)) });
      }
    }
    this.anim.update(dt, { moving, sprinting: false, grounded: st.grounded, playerEye: st.eye, feetY: st.position.y, bots: [] });
    if (MP) this.mp.hud(dt, hint);
  }
  loop(now) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    { const fr = now - this.last; const p = this.pf; p.n++; p.t += fr; if (fr > p.worst) p.worst = fr; if (p.t >= 500) { this.perf.textContent = Math.round(p.n * 1000 / p.t) + ' FPS · ' + Math.round(p.t / p.n) + ' ms (max ' + Math.round(p.worst) + ')'; p.n = 0; p.t = 0; p.worst = 0; } }
    const real = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const dt = real * this.kc.update(real) * this.killfx.update(real) * (this.deathCam ? 0.35 : 1);
    this._real = real;
    this.updateBlast(dt);
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t -= dt; f.l.material.opacity = Math.max(0, f.t / f.life); if (f.t <= 0) { this.scene.remove(f.l); f.l.geometry.dispose(); f.l.material.dispose(); this.fx.splice(i, 1); } }
    if (this.state === 'play') { this.destruction.update(dt); const es = this.eco.getState(); if (es.phase === 'live' && !es.menuOpen) this.grenades.update(dt); this.update(dt); }
    else if (this.state !== 'pause') { this.bots.update(dt * (this.state === 'over' ? 1 : 0), { playerEye: this.ctrl.state.eye, playerAlive: false, bomb: null }); this.ctrl.applyToCamera(this.camera); this.anim.update(dt, { bots: [] }); }
    this.kc.applyCamera(); this.killfx.applyCamera(this.camera); if (this.deathCam) this.deathCamApply(real);
    if (this.shake > 0.01) { const s = this.shake; this.camera.position.x += (Math.random() - .5) * 0.5 * s; this.camera.position.y += (Math.random() - .5) * 0.5 * s; this.camera.rotation.z += (Math.random() - .5) * 0.05 * s; this.shake *= Math.pow(0.02, dt); }
    if (this.look) this.look.render(this.camera); else this.renderer.render(this.scene, this.camera);
    this.kc.afterRender();
  }
  destroy() { this.running = false; this.ro && this.ro.disconnect(); this.ctrl.dispose(); this.renderer.dispose(); }
  }
