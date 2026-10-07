// animations.js - Sniper Chill ANIMATIONS + GAME FEEL module. Single ES module, no deps (THREE is passed in; tested on r160).
// Style: chill, stylized, non-realistic: toon-shaded jellybean bots with ink outlines, pastel tracers, soft puffs, confetti.
//
// QUICK START (exact game.js patch at the bottom of this file)
//   import { createAnimations } from './animations.js';
//   const anim = createAnimations(THREE, { scene, camera, vm, root, renderer, bots });
//   every frame:   const sdt = anim.timeScale(realDt);            // kill-cam slow-mo; use sdt for ALL game updates
//                  ...game update with sdt (ctrl.update, ws.update, bots.update)...
//                  ctrl.applyToCamera(camera);                    // base camera first
//                  anim.update(sdt, { moving, sprinting, grounded, playerEye, feetY, bots: bots.list });
//   anim.update runs AFTER applyToCamera and BEFORE render: it layers gun sway/bob/recoil on vm.group, adds
//   camera kick/roll/fov punch, drives bot rigs and all particles. Camera offsets are tiny and visual-only.
//
// API
//   createAnimations(THREE, opts) -> anim
//     opts.scene (required)  opts.camera (required, must be in scene)  opts.vm (player.js viewmodels, for gun rig + muzzle)
//     opts.root DOM element for the slow-mo vignette (optional)  opts.renderer (optional)  opts.palette bot colours (optional)
//   anim.timeScale(realDt) -> scaled dt         call once per frame, first
//   anim.update(dt, ctx)       ctx: {moving, sprinting, grounded, playerEye:{x,y,z}, feetY, bots:list}
//   -- player events --
//   anim.onShot({weapon, end:{x,y,z}, hit?:{kind,point,normal}, origin?})  muzzle flash, tracer, casing, recoil springs, camera kick,
//        world impact particles (use INSTEAD of game.tracer)
//   anim.onImpact(point, normal, 'world'|'bot', {bot?, headshot?, dir?})
//   anim.onBotHit(bot, {dir, point, headshot, killed, damage?})  flinch / death / hit text / particles / kill-cam. Once per hit
//   anim.onReload(duration)  anim.onSwitch()  anim.onEmpty()
//   anim.onBotShot({from,to,hit,damage})   bot muzzle flash + arm recoil + pink tracer; shakes camera if hit
//   anim.onPlayerHurt(fromPos?, damage?)   anim.onKill({headshot, weapon})   anim.onBombPlant(pos)   anim.onExplosion(pos)
//   anim.fx  { puff(pos,n,color) sparks(pos,n,color) confetti(pos,n) text(pos,str,color,big) ring(pos,normal,color,size) }
//   anim.bots { rigOf(bot), sync(list, dt, ctx) }  rigs are attached lazily by update(); old box meshes are hidden
//   anim.settings { slowmo:true, camShake:1, gunSway:1, particles:1, outlines:true }   anim.dispose()
//
// Bot rig faces -Z like bots.js. hitscan zones unchanged: silhouette is 1.8m tall, head sphere at ~1.61m.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = { out: (t) => 1 - (1 - t) * (1 - t), outBack: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, inOut: (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, in: (t) => t * t };
const rnd = (a = -1, b = 1) => a + Math.random() * (b - a);

class Spring {
  constructor(k = 220, c = 16) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  kick(v) { this.v += v; }
  step(dt, target = 0) { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { this.v += (-this.k * (this.x - target) - this.c * this.v) * h; this.x += this.v * h; } return this.x; }
}

// per-weapon feel. kickZ/kickPit/twist: gun spring impulses, cam: camera pitch kick, fov: fov punch (deg), shake: trauma
const WEAPON_FEEL = {
  pistol:     { kickZ: 5.5, kickPit: 9,   twist: 2.5, cam: 0.0045, fov: 0.5,  shake: 0.10, flash: 1.0, light: .5, core: 0xffffff, halo: 0xffd27a, len: 3.5, width: 0.009 },
  machinegun: { kickZ: 3.2, kickPit: 4.5, twist: 3.5, cam: 0.0030, fov: 0.35, shake: 0.09, flash: 1.1, light: .6, core: 0xffffff, halo: 0xff9ec2, len: 4.5, width: 0.008 },
  sniper:     { kickZ: 9.0, kickPit: 15,  twist: 5.0, cam: 0.0110, fov: 1.8,  shake: 0.30, flash: 1.6, light: .9, core: 0xffffff, halo: 0x7fffe0, len: 9.0, width: 0.012 },
  thunderpop: { kickZ: 8.0, kickPit: 14,  twist: 4.0, cam: 0.0090, fov: 1.2,  shake: 0.22, flash: 1.4, light: .8, core: 0xffffff, halo: 0xffe08a, len: 5.0, width: 0.011 },
  fizztwin:   { kickZ: 4.5, kickPit: 7,   twist: 2.2, cam: 0.0035, fov: 0.4,  shake: 0.08, flash: 0.9, light: .45, core: 0xffffff, halo: 0xffc0d0, len: 3.5, width: 0.008 },
  buzzbox:    { kickZ: 2.6, kickPit: 3.6, twist: 3.0, cam: 0.0024, fov: 0.3,  shake: 0.07, flash: 0.9, light: .5, core: 0xffffff, halo: 0xd9c4e8, len: 3.8, width: 0.007 },
  bigpuff:    { kickZ: 10,  kickPit: 18,  twist: 5.0, cam: 0.0120, fov: 2.0,  shake: 0.32, flash: 1.8, light: 1.0, core: 0xffffff, halo: 0xffb38a, len: 2.5, width: 0.010 },
  partypopper:{ kickZ: 3.4, kickPit: 4.8, twist: 4.0, cam: 0.0032, fov: 0.4,  shake: 0.10, flash: 1.2, light: .65, core: 0xffffff, halo: 0xb6ffd9, len: 4.5, width: 0.009 },
  breeze:     { kickZ: 2.9, kickPit: 4.0, twist: 2.8, cam: 0.0026, fov: 0.3,  shake: 0.08, flash: 1.0, light: .55, core: 0xffffff, halo: 0x9ff5ff, len: 4.5, width: 0.008 },
  taptap:     { kickZ: 3.0, kickPit: 4.2, twist: 2.6, cam: 0.0028, fov: 0.32, shake: 0.08, flash: 1.0, light: .55, core: 0xffffff, halo: 0xfff0a0, len: 4.5, width: 0.008 },
  skyneedle:  { kickZ: 7.0, kickPit: 12,  twist: 4.0, cam: 0.0080, fov: 1.4,  shake: 0.22, flash: 1.3, light: .8, core: 0xffffff, halo: 0x9fe7ff, len: 8.0, width: 0.011 },
};

export function createAnimations(THREE, opts = {}) {
  const { scene, camera } = opts;
  if (!scene || !camera) throw new Error('createAnimations needs {scene, camera}');
  const vm = opts.vm || null;
  const settings = { slowmo: true, camShake: 1, gunSway: 1, particles: 1, outlines: true };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const palette = opts.palette || [0xff7a93, 0xffb35c, 0x7a9bff, 0xa98bff, 0x4fd6a2];
  const disposables = [];
  const root = new THREE.Group(); root.name = 'anim-fx'; scene.add(root);

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; disposables.push(t); return t; }
  const starTex = canvasTex(128, 128, (g, w, h) => {
    const cx = w / 2, cy = h / 2; const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 60); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,160,.9)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 14 : (i % 4 === 0 ? 62 : 38); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.fill();
  });
  const ringTex = canvasTex(64, 64, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke(); });

  // ---- particles: one draw call per system, soft round points
  function makeParticles(max, additive) {
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;\nvoid main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = aSize*uScale/max(0.1,-mv.z); vC=aColor; vA=aAlpha; }',
      fragmentShader: 'varying vec3 vC; varying float vA;\nvoid main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0,0.5,d)*vA; if(a<0.01) discard; gl_FragColor = vec4(vC, a);\n#include <colorspace_fragment>\n}',
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 4; root.add(pts);
    const P = Array.from({ length: max }, () => ({ life: 0 })); let head = 0; const c = new THREE.Color();
    return {
      mat, pts,
      emit(o) {
        const p = P[head]; head = (head + 1) % max; c.set(o.color ?? 0xffffff);
        p.life = p.max = o.life ?? 0.5; p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
        p.g = o.gravity ?? 0; p.drag = o.drag ?? 0; p.s0 = o.size ?? 0.1; p.s1 = o.size1 ?? p.s0; p.a0 = o.alpha ?? 1; p.r = c.r; p.gc = c.g; p.b = c.b; p.floor = o.floor ?? -1e9; p.pow = o.pow ?? 1.5;
      },
      update(dt) {
        for (let i = 0; i < max; i++) {
          const p = P[i];
          if (p.life <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
          p.life -= dt; const k = 1 - Math.max(0, p.life) / p.max;
          p.vy -= p.g * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; col[i * 3] = p.r; col[i * 3 + 1] = p.gc; col[i * 3 + 2] = p.b;
          size[i] = lerp(p.s0, p.s1, k); alpha[i] = p.a0 * Math.pow(1 - k, p.pow);
        }
        g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = true;
      },
    };
  }
  const soft = makeParticles(900, false), glow = makeParticles(600, true);
  disposables.push(soft.pts.geometry, soft.mat, glow.pts.geometry, glow.mat);
  const PN = (n) => Math.max(1, Math.round(n * settings.particles));

  const fx = {
    puff(p, n = 5, color = 0xf4ead2, o = {}) {
      for (let i = 0; i < PN(n); i++) soft.emit({ x: p.x + rnd(-.05, .05), y: p.y + rnd(-.03, .05), z: p.z + rnd(-.05, .05), vx: rnd(-.5, .5) + (o.nx || 0) * 1.2, vy: rnd(.2, 1) + (o.ny || 0) * 1.2, vz: rnd(-.5, .5) + (o.nz || 0) * 1.2, drag: 2.5, size: rnd(.14, .26) * (o.scale || 1), size1: rnd(.5, .8) * (o.scale || 1), life: rnd(.45, .8), alpha: .75, color });
    },
    sparks(p, n = 6, color = 0xffe08a, o = {}) {
      for (let i = 0; i < PN(n); i++) glow.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-2, 2) + (o.nx || 0) * 3, vy: rnd(1, 3.5) + (o.ny || 0) * 3, vz: rnd(-2, 2) + (o.nz || 0) * 3, gravity: 9, drag: .6, size: rnd(.03, .06), size1: .01, life: rnd(.25, .5), alpha: 1, color, floor: o.floor });
    },
    confetti(p, n = 22, o = {}) {
      for (let i = 0; i < PN(n); i++) { const c = palette[(Math.random() * palette.length) | 0]; soft.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-2.6, 2.6), vy: rnd(1.5, 5), vz: rnd(-2.6, 2.6), gravity: 7, drag: 1.1, size: rnd(.06, .11), size1: .03, life: rnd(.7, 1.3), alpha: 1, color: o.color ?? c, pow: 0.7, floor: o.floor }); }
    },
  };
  const texts = [], textPool = [];
  fx.text = (p, str, color = '#ffffff', big = false) => {
    let s = textPool.pop();
    if (!s) { const c = document.createElement('canvas'); c.width = 400; c.height = 96; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: true, depthWrite: false })); sp.renderOrder = 20; s = { sp, c, tx }; disposables.push(tx, sp.material); root.add(sp); }
    const g = s.c.getContext('2d'); g.clearRect(0, 0, 400, 96); g.font = '900 ' + (big ? 56 : 50) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 12; g.strokeStyle = 'rgba(30,34,64,.9)'; g.strokeText(str, 200, 50); g.fillStyle = color; g.fillText(str, 200, 50); s.tx.needsUpdate = true;
    s.sp.position.set(p.x, p.y, p.z); s.sp.visible = true; s.t = 0; s.dur = big ? 1.0 : .8; s.big = big; s.vx = rnd(-.3, .3); texts.push(s); if (texts.length > 10) { const o = texts.shift(); o.sp.visible = false; textPool.push(o); }
  };
  const rings = [], ringPool = [];
  fx.ring = (p, n, color = 0xffffff, size = 1) => {
    let r = ringPool.pop();
    if (!r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.renderOrder = 5; root.add(m); r = { m }; disposables.push(m.geometry, m.material); }
    r.m.material.color.set(color); r.m.position.set(p.x + n.x * .02, p.y + n.y * .02, p.z + n.z * .02); r.m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z); r.m.visible = true; r.t = 0; r.size = size; rings.push(r);
  };
  const flashes = [], flashPool = [];
  function flashSprite(p, color, scale, dur = .06) {
    let f = flashPool.pop();
    if (!f) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending })); s.renderOrder = 8; root.add(s); f = { s }; disposables.push(s.material); }
    f.s.material.color.set(color); f.s.material.rotation = Math.random() * 6.28; f.s.position.copy(p); f.t = 0; f.dur = dur; f.scale = scale; f.s.visible = true; flashes.push(f); return f;
  }
  const mLight = new THREE.PointLight(0xffd9a0, 0, 7, 2); root.add(mLight); let mLightT = 0, mLightI = 0;
  const tracers = [], tracerPool = [], Y = V3(0, 1, 0);
  function tracer(a, b, w, o) {
    let t = tracerPool.pop();
    if (!t) {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      const mk = () => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      const core = mk(), halo = mk(); core.renderOrder = halo.renderOrder = 7; root.add(core, halo); t = { core, halo, dir: V3() }; disposables.push(core.material, halo.material, geo);
    }
    t.a = a.clone(); t.dir.subVectors(b, a); t.len = t.dir.length(); t.dir.normalize();
    t.core.material.color.set(o.core); t.halo.material.color.set(o.halo); t.w = w; t.streak = Math.min(o.len, t.len);
    t.speed = o.speed || 140; t.dur = t.len / t.speed + 0.1; t.t = 0; t.core.visible = t.halo.visible = true; t.core.quaternion.setFromUnitVectors(Y, t.dir); t.halo.quaternion.copy(t.core.quaternion); tracers.push(t);
  }
  const casings = [], casingGeo = new THREE.BoxGeometry(.009, .009, .026), casingMat = new THREE.MeshBasicMaterial({ color: 0xffd36e }); disposables.push(casingGeo, casingMat);

  // ---- kill-cam time scale
  const time = { scale: 1, target: 1, hold: 0, depth: .3 }; let vignetteEl = null, vignetteK = 0;
  if (opts.root) {
    vignetteEl = document.createElement('div');
    vignetteEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,0) 52%,rgba(255,170,215,.34) 100%);';
    opts.root.appendChild(vignetteEl);
  }
  function timeScale(realDt) {
    if (!settings.slowmo) { time.scale = 1; return realDt; }
    if (time.hold > 0) { time.hold -= realDt; time.target = time.depth; } else time.target = 1;
    time.scale += (time.target - time.scale) * Math.min(1, realDt * (time.target < time.scale ? 30 : 5));
    vignetteK += ((1 - time.scale) / (1 - time.depth) - vignetteK) * Math.min(1, realDt * 10);
    if (vignetteEl) vignetteEl.style.opacity = clamp(vignetteK, 0, 1).toFixed(3);
    return realDt * time.scale;
  }

  // ---- camera + gun rig layers
  const S = {
    recZ: new Spring(260, 20), recP: new Spring(300, 20), recR: new Spring(260, 18), recY: new Spring(240, 18),
    camP: new Spring(180, 16), camR: new Spring(120, 10), camY: new Spring(150, 12), fov: new Spring(120, 12), land: new Spring(160, 12), hurtR: new Spring(90, 9), hurtP: new Spring(110, 11),
    swap: new Spring(150, 11), aimPush: new Spring(200, 18),
  };
  const st = { t: 0, bobPhase: 0, bobAmp: 0, swayX: 0, swayY: 0, lastYaw: null, lastPitch: null, grounded: true, airT: 0, trauma: 0, reload: -1, reloadDur: 1, reloadRattled: false, bolt: -1, lastAim: 0, weapon: 'pistol', empty: 0 };
  const feel = () => WEAPON_FEEL[st.weapon] || WEAPON_FEEL.pistol;
  const _m = V3();
  function muzzlePos() { if (vm && vm.muzzleWorldPosition) { camera.updateMatrixWorld(true); return vm.muzzleWorldPosition(_m); } _m.set(0.2, -0.2, -0.8).applyMatrix4(camera.matrixWorld); return _m; }

  function applyCameraAndGun(dt, ctx) {
    const vmAim = vm ? vm.aimAmount : 0; if (vm) st.weapon = vm.current;
    st.t += dt;
    const yaw = camera.rotation.y, pit = camera.rotation.x;
    let dy = 0, dp = 0; if (st.lastYaw !== null && dt > 0) { dy = Math.atan2(Math.sin(yaw - st.lastYaw), Math.cos(yaw - st.lastYaw)); dp = pit - st.lastPitch; } st.lastYaw = yaw; st.lastPitch = pit;
    const idt = Math.max(dt, 1e-3);
    const lookX = clamp(-dy / idt * 0.010, -0.05, 0.05), lookY = clamp(dp / idt * 0.010, -0.04, 0.04);
    const sw = settings.gunSway * (1 - vmAim * 0.75), k = 1 - Math.exp(-dt / 0.09);
    st.swayX += (lookX - st.swayX) * k; st.swayY += (lookY - st.swayY) * k;
    const moving = !!ctx.moving, sprint = !!ctx.sprinting && moving, grounded = ctx.grounded !== false;
    if (grounded && !st.grounded) { const f = clamp(st.airT / 0.5, 0.25, 1.4); S.land.kick(-3.2 * f); S.camP.kick(0.5 * f); }
    if (!grounded && st.grounded) S.land.kick(1.5);
    st.airT = grounded ? 0 : st.airT + dt; st.grounded = grounded;
    const targetAmp = moving && grounded ? (sprint ? 1.5 : 1) : 0; st.bobAmp += (targetAmp - st.bobAmp) * Math.min(1, dt * 8);
    st.bobPhase += dt * (sprint ? 12 : 8.5) * (moving ? 1 : 0.4);
    const aimDamp = 1 - vmAim * 0.9, ba = st.bobAmp * aimDamp;
    if (vmAim > 0.05 && st.lastAim <= 0.05) { S.aimPush.kick(-0.9); S.fov.kick(-40); }
    if (vmAim < 0.5 && st.lastAim >= 0.5) { S.aimPush.kick(0.6); S.fov.kick(25); }
    st.lastAim = vmAim;
    const rz = S.recZ.step(dt), rp = S.recP.step(dt), rr = S.recR.step(dt), ry = S.recY.step(dt), ln = S.land.step(dt), ap = S.aimPush.step(dt), sp = S.swap.step(dt);
    let rlx = 0, rly = 0, rlrx = 0, rlrz = 0, rlry = 0;
    if (st.reload >= 0) {
      st.reload += dt; const t = clamp(st.reload / st.reloadDur, 0, 1);
      const down = ease.out(clamp(t / 0.22, 0, 1)) - ease.inOut(clamp((t - 0.72) / 0.28, 0, 1));
      rly = -0.05 * down; rlx = 0.03 * down; rlrz = Math.sin(t * Math.PI * 2) * 0.22 * down; rlry = -0.35 * down; rlrx = -0.25 * down;
      if (t > 0.5 && !st.reloadRattled) { st.reloadRattled = true; S.recZ.kick(-14); S.recP.kick(-50); S.camP.kick(-.5); }
      if (t > 0.3 && t < 0.65) rlx += Math.sin(t * 90) * 0.003 * Math.sin(t * Math.PI);
      if (t >= 1) { st.reload = -1; S.recP.kick(110); S.recZ.kick(20); S.recR.kick(-20); }
    }
    let bolt = 0; if (st.bolt >= 0) { st.bolt += dt; const t = st.bolt / 0.55; bolt = t < 1 ? Math.sin(clamp((t - 0.1) / 0.9, 0, 1) * Math.PI) : 0; if (t >= 1) st.bolt = -1; }
    st.empty = Math.max(0, st.empty - dt * 8);
    if (vm) {
      const g = vm.group, bx = Math.sin(st.bobPhase) * 0.011 * ba, by = Math.sin(st.bobPhase * 2) * 0.007 * ba, idle = Math.sin(st.t * 1.5) * 0.0018 * aimDamp;
      g.position.set(
        bx + st.swayX * sw + rlx + bolt * 0.012 + ry * 0.002,
        by + idle + st.swayY * sw * 0.6 + rly + ln * 0.012 + ap * 0.01 + (sprint ? -0.015 * st.bobAmp : 0) - sp * 0.01 - st.empty * 0.004,
        rz * 0.02 + ap * 0.02 + bolt * 0.02);
      g.rotation.set(
        rp * 0.02 + st.swayY * sw * 1.2 + rlrx + ln * 0.05 + bolt * 0.05 + st.empty * 0.03 + sp * 0.02,
        -st.swayX * sw * 2.2 + rlry + bolt * 0.12 + Math.sin(st.bobPhase) * 0.012 * ba + ry * 0.01,
        rr * 0.08 + rlrz - bolt * 0.35 - st.swayX * sw * 1.5 + Math.cos(st.bobPhase) * 0.01 * ba + (sprint ? -0.06 * st.bobAmp : 0));
    }
    // camera: tiny, visual only (the crosshair/bullets stay honest)
    const shakeT = st.trauma * st.trauma; st.trauma = Math.max(0, st.trauma - dt * 1.9); const sh = settings.camShake;
    const n1 = Math.sin(st.t * 63.1) * Math.sin(st.t * 21.7), n2 = Math.sin(st.t * 51.3 + 1.7) * Math.sin(st.t * 17.1);
    const cp = S.camP.step(dt), cr = S.camR.step(dt), cy = S.camY.step(dt), hp = S.hurtP.step(dt), hr = S.hurtR.step(dt), fv = S.fov.step(dt);
    camera.rotation.x += (cp + hp) * sh + n2 * shakeT * 0.012 * sh;
    camera.rotation.y += cy * sh + n1 * shakeT * 0.008 * sh;
    camera.rotation.z = (cr + hr) * sh + Math.sin(st.bobPhase) * 0.0035 * ba + n1 * shakeT * 0.02 * sh - st.swayX * 0.08 * sw + vignetteK * 0.012;
    camera.position.y += (ln * 0.045 + Math.sin(st.bobPhase * 2) * 0.013 * ba) * Math.max(0.5, sh);
    if (Math.abs(fv) > 0.001) { camera.fov += fv; camera.updateProjectionMatrix(); }
  }

  // ---- bot rigs
  const gradTex = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat); gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true; disposables.push(gradTex);
  const G = { cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12), sph: (r) => new THREE.SphereGeometry(r, 16, 12), cyl: (r, h) => new THREE.CylinderGeometry(r, r, h, 8), box: (x, y, z) => new THREE.BoxGeometry(x, y, z) };
  const hullMat = new THREE.MeshBasicMaterial({ color: 0x1f2340, side: THREE.BackSide }); disposables.push(hullMat);
  const visorMat = new THREE.MeshToonMaterial({ color: 0x1d2547, gradientMap: gradTex }); disposables.push(visorMat);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc9f8ff }), eyeDeadMat = new THREE.MeshBasicMaterial({ color: 0xff8fb0 }); disposables.push(eyeMat, eyeDeadMat);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a40, transparent: true, opacity: 0.28, depthWrite: false }), shadowGeo = new THREE.CircleGeometry(0.42, 20); disposables.push(shadowMat, shadowGeo);
  const rigs = new WeakMap();

  function buildRig(bot) {
    const col = new THREE.Color(bot.baseColor ?? palette[0]); const hsl = {}; col.getHSL(hsl);
    const accent = new THREE.Color().setHSL((hsl.h + 0.5) % 1, 0.75, 0.62);
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradTex, emissive: 0x000000 });
    const mats = { body: toon(col), belly: toon(new THREE.Color().setHSL(hsl.h, 0.6, 0.82)), limb: toon(new THREE.Color().setHSL(hsl.h, 0.55, 0.38)), accent: toon(accent), gun: toon(0x3a4060) };
    const holder = new THREE.Group(); holder.name = 'bot-rig'; const R = { holder, mats }; const hulls = [];
    const part = (geo, mat, parent, x, y, z, hull = 1.08) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m);
      if (hull) { const h = new THREE.Mesh(geo, hullMat); h.scale.setScalar(hull); h.name = 'hull'; m.add(h); hulls.push(h); }
      return m;
    };
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 1; holder.add(shadow); R.shadow = shadow;
    const rt = new THREE.Group(); holder.add(rt); R.root = rt;
    const mkLeg = (x) => { const p = new THREE.Group(); p.position.set(x, 0.72, 0); rt.add(p); part(G.cap(.09, .38), mats.limb, p, 0, -.30, 0, 1.2); const foot = part(G.sph(.1), mats.accent, p, 0, -.66, -.05, 1.18); foot.scale.set(1, .75, 1.5); return p; };
    R.legL = mkLeg(-.12); R.legR = mkLeg(.12);
    const torso = new THREE.Group(); torso.position.y = .72; rt.add(torso); R.torso = torso;
    part(G.cap(.25, .2), mats.body, torso, 0, .33, 0, 1.07);
    part(G.sph(.17), mats.belly, torso, 0, .27, -.14, 0).scale.set(1, 1.15, .55);
    part(G.box(.26, .3, .12), mats.accent, torso, 0, .38, .25, 1.12);
    const mkArm = (x) => { const p = new THREE.Group(); p.position.set(x, .6, 0); torso.add(p); part(G.cap(.07, .24), mats.limb, p, 0, -.2, 0, 1.22); part(G.sph(.088), mats.belly, p, 0, -.43, 0, 1.2); return p; };
    R.armL = mkArm(-.31); R.armR = mkArm(.31);
    const gun = new THREE.Group(); gun.position.set(0, -.43, 0); gun.rotation.x = -Math.PI / 2; R.armR.add(gun);
    part(G.box(.07, .1, .3), mats.gun, gun, 0, 0, -.1, 1.15); part(G.cyl(.022, .16), mats.accent, gun, 0, .01, -.3, 1.3).rotation.x = Math.PI / 2; part(G.box(.05, .12, .06), mats.gun, gun, 0, -.08, .02, 1.15);
    const mz = new THREE.Object3D(); mz.position.set(0, .01, -.4); gun.add(mz); R.muzzle = mz;
    const head = new THREE.Group(); head.position.y = .7; torso.add(head); R.head = head;
    part(G.sph(.21), mats.body, head, 0, .19, 0, 1.08);
    const visor = new THREE.Mesh(G.sph(.2), visorMat); visor.scale.set(.93, .55, .6); visor.position.set(0, .21, -.1); head.add(visor);
    R.eyes = [-.075, .075].map((x) => { const e = new THREE.Mesh(G.sph(.036), eyeMat); e.position.set(x, .215, -.19); e.scale.set(1, 1.2, .6); head.add(e); return e; });
    for (const sx of [-1, 1]) part(G.sph(.07), mats.accent, head, sx * .21, .19, .01, 1.2).scale.set(.6, 1, 1);
    const ant = new THREE.Group(); ant.position.set(0, .39, 0); head.add(ant); R.ant = ant; part(G.cyl(.012, .15), mats.limb, ant, 0, .075, 0, 0); part(G.sph(.05), mats.accent, ant, 0, .17, 0, 1.25);
    R.hulls = hulls;
    Object.assign(R, {
      phase: Math.random() * 6, speed: 0, px: bot.position.x, pz: bot.position.z, born: 0, blink: 2 + Math.random() * 3, blinkT: 0, aim: 0,
      flash: 0, fireK: 0, hit: new Spring(220, 14), hitSide: new Spring(200, 13), headSnap: new Spring(260, 12), antS: new Spring(90, 5), squash: new Spring(160, 9),
      dead: false, deadT: 0, fall: { dir: V3(0, 0, 1), angle: 0, vel: 0, bounced: 0 }, headshot: false, headVel: null, poof: false, stars: [],
    });
    return R;
  }
  function rigOf(bot) {
    let R = rigs.get(bot);
    if (!R) {
      R = buildRig(bot); rigs.set(bot, R);
      for (const c of bot.group.children) if (c.isMesh) c.visible = false;
      bot.group.add(R.holder); if (bot.bar) bot.bar.spr.position.y = 2.22;
      fx.puff({ x: bot.position.x, y: bot.position.y + .1, z: bot.position.z }, 6, 0xffffff, { scale: .8 }); fx.sparks({ x: bot.position.x, y: bot.position.y + .9, z: bot.position.z }, 6, 0xbff6ff);
    }
    return R;
  }
  const _q = new THREE.Quaternion(), _ax = V3(), _up = V3(0, 1, 0), _wp = V3();
  function updateRig(b, R, dt, ctx) {
    const t = st.t; R.born += dt;
    for (const h of R.hulls) h.visible = settings.outlines;
    R.flash = Math.max(0, R.flash - dt); const fl = R.flash > 0 ? 0.75 : 0; for (const k in R.mats) R.mats[k].emissive.setRGB(fl, fl, fl);
    const dx = b.position.x - R.px, dz = b.position.z - R.pz; R.px = b.position.x; R.pz = b.position.z;
    const sp = dt > 0 ? Math.hypot(dx, dz) / dt : 0; R.speed += (sp - R.speed) * Math.min(1, dt * 10);
    if (!b.alive && !R.dead) startDeath(b, R, null);
    if (R.dead) { updateDeath(b, R, dt); return; }
    const popS = ease.outBack(clamp(R.born / 0.45, 0, 1));
    const walk = clamp(R.speed / 2.4, 0, 1.6), moving = R.speed > 0.35;
    R.phase += dt * (moving ? R.speed * 3.3 : 0);
    R.aim += ((b.seen > 0.55 ? 1 : 0) - R.aim) * Math.min(1, dt * 9);
    const sw = Math.sin(R.phase) * walk * 0.75 * (1 - R.aim * .3);
    R.legL.rotation.x = sw; R.legR.rotation.x = -sw;
    const hop = Math.abs(Math.sin(R.phase)) * 0.045 * walk, breathe = Math.sin(t * 2 + R.px) * 0.008;
    const hitP = R.hit.step(dt), hitS = R.hitSide.step(dt), hs = R.headSnap.step(dt), sq = R.squash.step(dt); R.antS.step(dt, 0);
    R.root.position.set(0, hop + breathe, 0); R.root.quaternion.identity();
    R.root.scale.set(popS * (1 + sq * .15), popS * (1 - sq * .2), popS * (1 + sq * .15));
    R.torso.rotation.set(0.05 * walk + hitP * 0.5 - R.aim * 0.1, Math.sin(R.phase) * 0.12 * walk * (1 - R.aim), hitS * 0.35);
    R.fireK = Math.max(0, R.fireK - dt * 7);
    const low = 0.75 + Math.sin(R.phase + Math.PI) * 0.18 * walk, raised = Math.PI / 2 - 0.08;
    R.armR.rotation.set(lerp(low, raised, R.aim) - R.fireK * 0.35, 0, lerp(-0.12, 0.0, R.aim));
    R.armL.rotation.set(lerp(Math.sin(R.phase) * walk * 0.7, raised - 0.1, R.aim), 0, lerp(0.1, 0.38, R.aim));
    const hy = Math.sin(t * 0.7 + b.pathT) * 0.25 * (1 - R.aim) * (moving ? .3 : 1); let hp = Math.sin(t * 1.1 + R.px) * 0.05;
    if (R.aim > 0.2 && ctx.playerEye) { const ex = ctx.playerEye.x - b.position.x, ey = ctx.playerEye.y - (b.position.y + 1.6), ez = ctx.playerEye.z - b.position.z; hp = -Math.atan2(ey, Math.hypot(ex, ez)) * 0.8 * R.aim; }
    R.head.rotation.set(hp + hs * 0.6 - hitP * 0.4, hy, hs * 0.2); R.head.position.y = .7 + Math.abs(Math.sin(R.phase)) * 0.01 * walk;
    R.blink -= dt; if (R.blink <= 0) { R.blinkT = 0.12; R.blink = 2 + Math.random() * 3.5; } R.blinkT = Math.max(0, R.blinkT - dt);
    const bl = R.blinkT > 0 ? 0.1 : 1.2; for (const e of R.eyes) e.scale.y += (bl - e.scale.y) * 0.6;
    R.ant.rotation.set(Math.sin(R.phase) * 0.3 * walk + Math.sin(t * 3 + R.px) * 0.07 + hitP * .8 + R.antS.x, 0, Math.cos(R.phase) * 0.25 * walk + hitS);
    R.shadow.scale.setScalar(popS * (1 - hop * 2));
  }
  function startDeath(b, R, info) {
    R.dead = true; R.deadT = 0;
    const d = info && info.dir ? info.dir : { x: 0, y: 0, z: 1 }; let hx = d.x, hz = d.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    const yaw = b.group.rotation.y, c = Math.cos(-yaw), s = Math.sin(-yaw); R.fall.dir.set(hx * c + hz * s, 0, -hx * s + hz * c);
    R.fall.angle = 0; R.fall.vel = info && info.headshot ? 3 : 1.5; R.headshot = !!(info && info.headshot);
    R.eyes.forEach((e) => { e.material = eyeDeadMat; e.scale.set(1.5, .3, .6); e.rotation.z = Math.PI / 4; });
    if (R.headshot) { R.head.updateMatrixWorld(true); R.holder.attach(R.head); R.headVel = V3(R.fall.dir.x * 1.4 + rnd(-.8, .8), 4.2, R.fall.dir.z * 1.4 + rnd(-.8, .8)); R.headSpin = V3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); }
    R.armL.rotation.z = .5; R.armR.rotation.z = -.5;
    fx.puff({ x: b.position.x, y: b.position.y + 1.1, z: b.position.z }, 4, 0xffffff, { scale: .8 });
  }
  function updateDeath(b, R, dt) {
    R.deadT += dt; const t = R.deadT, F = R.fall;
    R.holder.rotation.set(-b.group.rotation.x, 0, 0); // cancel bots.js' flat fall; we animate our own
    F.vel += 22 * dt * Math.sin(Math.min(1.4, F.angle) + .3); F.angle += F.vel * dt;
    if (F.angle > Math.PI / 2 - 0.12) { F.angle = Math.PI / 2 - 0.12; if (F.bounced < 2) { F.vel = -F.vel * (F.bounced ? .15 : .28); F.bounced++; if (F.bounced === 1) { fx.puff({ x: b.position.x + F.dir.x * .6, y: b.position.y + .08, z: b.position.z + F.dir.z * .6 }, 5, 0xf4ead2); R.squash.kick(-2); } } else F.vel = 0; }
    _ax.crossVectors(_up, F.dir).normalize(); _q.setFromAxisAngle(_ax, F.angle); R.root.quaternion.copy(_q); R.root.scale.setScalar(1);
    const slide = 0.7 * (1 - Math.exp(-t * 5)); R.root.position.set(F.dir.x * slide, Math.min(F.angle / (Math.PI / 2), 1) * 0.2, F.dir.z * slide);
    R.legL.rotation.x = lerp(R.legL.rotation.x, .5 + Math.sin(t * 10) * .1 * Math.exp(-t * 2), .2); R.legR.rotation.x = lerp(R.legR.rotation.x, -.4, .2);
    R.armL.rotation.x = lerp(R.armL.rotation.x, -1.0 + Math.sin(t * 9) * .1, .15); R.armR.rotation.x = lerp(R.armR.rotation.x, -0.6, .15);
    R.ant.rotation.z = Math.sin(t * 9) * .4 * Math.exp(-t * 1.5); R.shadow.scale.setScalar(1 + F.angle * .2);
    if (R.headVel) {
      const h = R.head, v = R.headVel; v.y -= 12 * dt; h.position.addScaledVector(v, dt); h.rotation.x += R.headSpin.x * dt; h.rotation.y += R.headSpin.y * dt; h.rotation.z += R.headSpin.z * dt;
      if (h.position.y < .22 && v.y < 0) { h.position.y = .22; v.y *= -.45; v.x *= .6; v.z *= .6; R.headSpin.multiplyScalar(.6); if (Math.abs(v.y) > 0.6) fx.puff({ x: b.position.x, y: b.position.y + .15, z: b.position.z }, 2, 0xf4ead2, { scale: .5 }); }
    }
    if (R.headshot && t > .05 && R.stars.length === 0) for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe27a })); s.scale.setScalar(.2); s.renderOrder = 8; R.holder.add(s); R.stars.push(s); }
    R.stars.forEach((s, i) => { const a = t * 6 + i * 2.09, hp = R.head.position; s.position.set(hp.x + Math.cos(a) * .3, hp.y + .35 + Math.sin(t * 5 + i) * .05, hp.z + Math.sin(a) * .3); s.material.opacity = clamp(1.8 - t * .8, 0, 1); s.visible = s.material.opacity > 0; });
    const vanish = 2.4; if (t > vanish) { const k = clamp((t - vanish) / 0.35, 0, 1); R.holder.scale.setScalar(1 - ease.in(k)); if (!R.poof) { R.poof = true; fx.confetti({ x: b.position.x, y: b.position.y + .4, z: b.position.z }, 26, { floor: b.position.y + .03 }); fx.puff({ x: b.position.x, y: b.position.y + .3, z: b.position.z }, 8, 0xffffff, { scale: 1.2 }); } if (k >= 1) R.holder.visible = false; }
  }
  const botsApi = { rigOf, sync(list, dt, ctx) { for (const b of list) { if (!b.group || !b.group.visible) continue; updateRig(b, rigOf(b), dt, ctx); } } };

  // ---- public events
  let lastBots = [], ctxLast = {};
  function onShot(s) {
    const w = s.weapon || (vm ? vm.current : 'pistol'), f = WEAPON_FEEL[w] || WEAPON_FEEL.pistol; st.weapon = w;
    const m = s.origin ? V3(s.origin.x, s.origin.y, s.origin.z) : muzzlePos().clone(), e = V3(s.end.x, s.end.y, s.end.z);
    const scoped = vm && vm.aimAmount > .8 && w === 'sniper';
    S.recZ.kick(f.kickZ * 10); S.recP.kick(f.kickPit * 10); S.recR.kick((Math.random() - .5) * f.twist * 10); S.recY.kick((Math.random() - .5) * 6);
    S.camP.kick(f.cam * 28); S.camR.kick((Math.random() - .5) * f.cam * 20); S.fov.kick(f.fov * 18); st.trauma = Math.min(1, st.trauma + f.shake);
    if (w === 'sniper') st.bolt = 0;
    if (!scoped) flashSprite(m, f.halo, .5 * f.flash, .06);
    mLight.position.copy(m); mLightI = f.light * (scoped ? .3 : 1); mLightT = .09; mLight.color.set(f.halo);
    const dir = V3().subVectors(e, m), L = dir.length(); dir.normalize();
    if (settings.tracers !== false) tracer(m.clone().addScaledVector(dir, Math.min(1.8, L * .5)), e, f.width, { core: f.core, halo: f.halo, len: f.len, speed: w === 'sniper' ? 260 : 170 });
    if (!scoped) {
      const right = V3(1, 0, 0).applyQuaternion(camera.quaternion), c = new THREE.Mesh(casingGeo, casingMat);
      c.position.copy(m).addScaledVector(dir, -.35).addScaledVector(right, .05); c.quaternion.copy(camera.quaternion); root.add(c);
      casings.push({ m: c, v: right.clone().multiplyScalar(rnd(1.8, 2.8)).addScaledVector(_up, rnd(1.5, 2.5)).addScaledVector(dir, rnd(-.6, .2)), spin: V3(rnd(-15, 15), rnd(-15, 15), 0), t: 0, floor: (ctxLast.feetY ?? camera.position.y - 1.6) + .01 });
    }
    if (s.hit && s.hit.point && s.hit.kind !== 'target') onImpact(s.hit.point, s.hit.normal || { x: 0, y: 1, z: 0 }, 'world');
  }
  function onImpact(p, n, kind, o = {}) {
    n = n || { x: 0, y: 1, z: 0 };
    if (kind === 'world') {
      fx.puff(p, 5, 0xf2e6c9, { nx: n.x, ny: n.y, nz: n.z, scale: .9 }); fx.sparks(p, 6, 0xffe9a0, { nx: n.x, ny: n.y, nz: n.z }); fx.ring(p, n, 0xfff1c0, 1);
      flashSprite(V3(p.x + n.x * .05, p.y + n.y * .05, p.z + n.z * .05), 0xffe9b0, .22, .08);
    } else {
      const c = o.bot && o.bot.baseColor !== undefined ? o.bot.baseColor : 0xffffff, d = o.dir || { x: 0, y: 0, z: 0 };
      fx.sparks(p, o.headshot ? 14 : 8, o.headshot ? 0xffe27a : 0xffffff); fx.puff(p, 3, c, { scale: .6 });
      for (let i = 0; i < PN(o.headshot ? 10 : 5); i++) soft.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-2, 2) + d.x * 2, vy: rnd(.5, 3), vz: rnd(-2, 2) + d.z * 2, gravity: 8, drag: 1, size: rnd(.05, .09), size1: .02, life: rnd(.4, .8), color: c });
      fx.ring(p, V3(-d.x, -d.y, -d.z).normalize(), o.headshot ? 0xffe27a : 0xffffff, o.headshot ? 2.2 : 1.3);
    }
  }
  function onBotHit(bot, info = {}) {
    const R = rigOf(bot), d = info.dir || { x: 0, y: 0, z: 1 }, p = info.point || { x: bot.position.x, y: bot.position.y + 1.2, z: bot.position.z };
    R.flash = 0.1;
    const dl = Math.hypot(d.x, d.z) || 1, yaw = bot.group.rotation.y, c = Math.cos(-yaw), s = Math.sin(-yaw), lx = (d.x * c + d.z * s) / dl, lz = (-d.x * s + d.z * c) / dl;
    R.hit.kick(-lz * (info.headshot ? 7 : 4) + 0.001); R.hitSide.kick(lx * 4); R.headSnap.kick(info.headshot ? -12 : -4); R.squash.kick(info.killed ? 3 : 2); R.antS.kick(rnd(-6, 6));
    onImpact(p, null, 'bot', { bot, headshot: info.headshot, dir: d });
    const top = V3(bot.position.x, bot.position.y + (info.headshot ? 2.0 : 1.7), bot.position.z);
    if (info.killed) { fx.text(top, info.headshot ? 'HEADSHOT!' : 'POP!', info.headshot ? '#ffe27a' : '#ffffff', true); startDeath(bot, R, info); onKill({ headshot: info.headshot, weapon: st.weapon }); }
    else fx.text(top, info.damage ? '-' + Math.round(info.damage) : (info.headshot ? 'HEAD' : 'hit'), info.headshot ? '#ffe27a' : '#e8f4ff', !!info.headshot);
    S.camP.kick(info.killed ? .08 : .02); S.fov.kick(info.killed ? 20 : 5);
  }
  function onKill(o = {}) {
    if (!settings.slowmo) return;
    const big = o.weapon === 'sniper' || o.headshot; time.depth = big ? 0.18 : 0.35; time.hold = Math.max(time.hold, big ? 0.55 : 0.28);
    S.fov.kick(big ? -80 : -40); S.camR.kick((Math.random() < .5 ? -1 : 1) * (big ? .35 : .18));
  }
  function onBotShot(e) {
    let best = null, bd = 1.2; for (const b of lastBots) { if (!b.alive) continue; const d = Math.hypot(b.position.x - e.from.x, b.position.z - e.from.z); if (d < bd) { bd = d; best = b; } }
    let m = V3(e.from.x, e.from.y, e.from.z);
    if (best) { const R = rigOf(best); R.fireK = 1; R.squash.kick(1.2); R.muzzle.getWorldPosition(_wp); m = _wp.clone(); }
    flashSprite(m, 0xff9ec2, .4, .07); fx.sparks(m, 3, 0xff9ec2);
    tracer(m, V3(e.to.x, e.to.y, e.to.z), 0.012, { core: 0xffffff, halo: 0xff7aa8, len: 3, speed: 70 });
    if (e.hit) onPlayerHurt(e.from, e.damage);
  }
  function onPlayerHurt(from, dmg = 10) {
    const k = clamp(dmg / 15, .5, 2);
    st.trauma = Math.min(1, st.trauma + .35 * k); S.hurtP.kick(-1.2 * k); S.fov.kick(25 * k);
    let side = 1; if (from) { const l = V3(from.x - camera.position.x, 0, from.z - camera.position.z).applyAxisAngle(_up, -camera.rotation.y); side = l.x >= 0 ? 1 : -1; }
    S.hurtR.kick(-side * 3.4 * k);
  }
  function onExplosion(p) { fx.confetti(p, 80); fx.sparks(p, 40, 0xffd27a); fx.puff(p, 24, 0xffffff, { scale: 3 }); fx.ring(p, V3(0, 1, 0), 0xffc27a, 4); st.trauma = 1; }
  function onBombPlant(p) { fx.confetti({ x: p.x, y: p.y + .3, z: p.z }, 24); fx.ring(p, V3(0, 1, 0), 0x9ad1ff, 2); }

  function update(dt, ctx = {}) {
    ctxLast = ctx; lastBots = ctx.bots || (opts.bots && opts.bots.list) || [];
    const h = ctx.viewHeight || (opts.renderer ? opts.renderer.domElement.height : window.innerHeight * (window.devicePixelRatio || 1));
    soft.mat.uniforms.uScale.value = glow.mat.uniforms.uScale.value = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) * 0.5;
    applyCameraAndGun(dt, ctx); botsApi.sync(lastBots, dt, ctx); soft.update(dt); glow.update(dt);
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i]; t.t += dt; const head = Math.min(t.len, t.t * t.speed), tail = Math.max(0, head - t.streak), len = Math.max(.001, head - tail);
      const fade = clamp(1 - Math.max(0, t.t - t.len / t.speed) / .1, 0, 1);
      t.core.position.copy(t.a).addScaledVector(t.dir, (head + tail) / 2); t.halo.position.copy(t.core.position);
      t.core.scale.set(t.w * .45, len, t.w * .45); t.halo.scale.set(t.w * 1.5, len, t.w * 1.5); t.core.material.opacity = fade; t.halo.material.opacity = fade * .45;
      if (t.t > t.dur) { t.core.visible = t.halo.visible = false; tracerPool.push(t); tracers.splice(i, 1); }
    }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; const k = f.t / f.dur; if (k >= 1) { f.s.visible = false; flashPool.push(f); flashes.splice(i, 1); continue; } f.s.scale.setScalar(f.scale * (.7 + .8 * ease.out(k))); f.s.material.opacity = 1 - k * k; }
    mLightT -= dt; mLight.intensity = mLightT > 0 ? mLightI * (mLightT / .09) : 0;
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / .28; if (k >= 1) { r.m.visible = false; ringPool.push(r); rings.splice(i, 1); continue; } r.m.scale.setScalar(r.size * (.5 + 2.2 * ease.out(k))); r.m.material.opacity = 1 - k; }
    for (let i = texts.length - 1; i >= 0; i--) { const s = texts[i]; s.t += dt; const k = s.t / s.dur; if (k >= 1) { s.sp.visible = false; textPool.push(s); texts.splice(i, 1); continue; } s.sp.position.y += dt * (1.1 - k * .7); s.sp.position.x += s.vx * dt; const sc = (s.big ? 1.5 : 1.0) * (k < .15 ? ease.outBack(k / .15) : 1); s.sp.scale.set(sc * 1.56, sc * .375, 1); s.sp.material.opacity = k > .65 ? 1 - (k - .65) / .35 : 1; }
    for (let i = casings.length - 1; i >= 0; i--) { const c = casings[i]; c.t += dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt; if (c.m.position.y < c.floor) { c.m.position.y = c.floor; c.v.y *= -.35; c.v.x *= .6; c.v.z *= .6; c.spin.multiplyScalar(.5); } if (c.t > 1.4) { root.remove(c.m); casings.splice(i, 1); } }
  }
  return {
    settings, fx, bots: botsApi, time, timeScale, update,
    onShot, onImpact, onBotHit, onKill, onBotShot, onPlayerHurt, onExplosion, onBombPlant,
    onReload(d) { st.reload = 0; st.reloadDur = d || 1; st.reloadRattled = false; S.recP.kick(-60); S.camP.kick(-.3); },
    onSwitch() { S.swap.kick(-4); S.recP.kick(-50); S.recZ.kick(-20); },
    onEmpty() { st.empty = 1; S.recZ.kick(20); S.camP.kick(.1); },
    dispose() { scene.remove(root); for (const d of disposables) d.dispose && d.dispose(); if (vignetteEl) vignetteEl.remove(); },
  };
}

// ======================================================================= INTEGRATION (game.js)
// 1) import + construct (after this.hud / this.bots exist):
//      import { createAnimations } from './animations.js';
//      this.anim = createAnimations(THREE, { scene: this.scene, camera: this.camera, vm: this.vm, root: this.root, renderer: this.renderer, bots: this.bots });
// 2) loop(): const dt = this.state === 'play' ? this.anim.timeScale(rawDt) : rawDt;   // kill-cam slow-mo
// 3) update(dt): at the END of update() (after bots.update, after c.applyToCamera and the fov line):
//      this.anim.update(dt, { moving, sprinting: st.speed > 5.5, grounded: st.grounded, playerEye: st.eye, feetY: st.position.y, bots: this.bots.list });
//    In the non-play branch of loop() also call this.anim.update(dt, {bots: this.bots.list}) so bots/particles keep animating on the end screen.
// 4) fireShots(): replace this.tracer(...) with this.anim.onShot({ weapon: s.weapon, end, hit });
//      in the target branch after applyDamage: this.anim.onBotHit(b, { dir, point: hit.point, headshot: r.headshot, killed: r.killed, damage: r.damage });
// 5) onWeaponEvent: 'reload' -> this.anim.onReload(); 'switch' -> this.anim.onSwitch(); 'empty' -> this.anim.onEmpty()
// 6) bot 'shot' events: replace this.tracer(...) with this.anim.onBotShot(e)   (also does camera shake when e.hit)
// 7) plant(): this.anim.onBombPlant(this.bomb.pos);  explosion: this.anim.onExplosion(this.bomb.pos)
