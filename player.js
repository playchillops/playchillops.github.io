// player.js - Sniper Chill PLAYER + WEAPONS module (ES module, no deps, THREE passed in).
//
// API
//   WEAPONS                          weapon defs (11 guns: cls pistol|hpistol|smg|shotgun|lmg|rifle|sniper, slot, price, burst, pattern, falloff)
//   WEAPON_ORDER                     = common.js WEAPON_IDS (network index order; append only)
//   computeDamage(weaponId, zone)    zone: 'head'|'body'|'limb' -> number
//   applyDamage(hp, weaponId, zone)  -> {hp, damage, killed, headshot}
//   createViewmodels(THREE)          -> viewmodels: {group, setWeapon(id), fire(), reload(dur), update(dt, state), muzzleWorldPosition(v3), current}
//        add `group` to the camera (and camera to scene). Procedural low-poly guns.
//   createWeaponSystem(THREE, vm, hud?) -> ws: ammo/cooldown/reload/spread/recoil logic
//        ws.select(id|index) ws.cycle(dir) ws.setTrigger(bool) ws.setAim(bool) ws.reload()
//        ws.update(dt, {moving, sprinting, grounded}) -> shots[]   (host raycasts each shot)
//        shot = {weapon, dir:{x,y}, damage:{head,body,limb}, range, pellets, tracer}
//        dir is an angular offset in radians (spread) to apply to camera yaw/pitch before the ray.
//        ws.consumeLook() -> {pitch, yaw} recoil kick (radians) to ADD to camera rotation this frame
//        ws.fov(baseFov) -> fov to set on camera (scope zoom, smoothed)
//        ws.onEvent = (name, data) => {}   names: 'shot','empty','reload','reloaded','switch'
//   createHUD(container)             -> hud: {setHealth(hp,max), setAmmo(mag,reserve,name,reloading), setScope(on,t), hitMarker(kill,head),
//                                            damageFlash(), setCrosshair(spreadPx,visible), setBombText(text), dispose()}
//   createPlayerState(opts)          -> {hp,max,alive,damage(n),heal(n),reset()}
//
// Typical loop:
//   const vm=createViewmodels(THREE); camera.add(vm.group); scene.add(camera);
//   const hud=createHUD(document.body); const ws=createWeaponSystem(THREE,vm,hud);
//   each frame: const shots=ws.update(dt,{moving,sprinting}); for(s of shots) raycast...; 
//     const k=ws.consumeLook(); pitch+=k.pitch; yaw+=k.yaw; camera.fov=ws.fov(75); camera.updateProjectionMatrix();
//   on hit: const r=applyDamage(bot.hp, s.weapon, zone); hud.hitMarker(r.killed, r.headshot);

import { WEAPON_IDS } from './common.js';
// Order = network index (input `w`, snapshot weapon). Only APPEND new weapons: indices 0-2 are the original three.
export const WEAPON_ORDER = WEAPON_IDS;

// Spray patterns (CS-style): per shot [pitch, yaw] multipliers of recoil.pitch / recoil.yaw. After the last entry the
// last 6 repeat. Kicks are added to the camera aim, so the server sees exactly where you were looking.
const P_AK = [[1, 0], [1.15, .1], [1.3, .2], [1.4, .5], [1.3, 1], [1.1, 1.6], [.9, 1.4], [.7, .6], [.6, -.6], [.5, -1.5], [.45, -2], [.4, -1.6], [.35, -.6], [.35, .8], [.35, 1.6], [.35, 1.2], [.3, -.4], [.3, -1.2]];
const P_M4 = [[1, 0], [1.1, .1], [1.15, .3], [1.1, .7], [.95, 1], [.8, .7], [.65, -.2], [.55, -.9], [.5, -1.1], [.45, -.6], [.4, .3], [.4, .9], [.4, .6], [.35, -.3], [.35, -.8]];
const P_SMG = [[1, 0], [1.1, -.3], [1.1, .3], [1, .8], [.9, .3], [.8, -.6], [.7, -1], [.6, -.2], [.55, .7], [.5, 1], [.5, .2], [.5, -.8]];
const P_LMG = [[1, 0], [1.2, .3], [1.3, .7], [1.2, 1.2], [1, .9], [.8, 0], [.6, -1], [.5, -1.6], [.45, -1.1], [.4, 0], [.4, 1.2], [.4, 1.6], [.4, .6], [.4, -.8], [.4, -1.4]];
const P_BURST = [[1, 0], [1.25, .4], [1.4, -.3]];

export const WEAPONS = {
  // ---------------- original three (unchanged balance) ----------------
  pistol: { id: 'pistol', name: 'Chill Pistol', cls: 'pistol', slot: 'secondary', price: 200, auto: false, rpm: 360, mag: 12, reserve: 60, reloadTime: 1.2,
    damage: { head: 60, body: 20, limb: 12 }, range: 80, pellets: 1, spread: 0.004, spreadMove: 0.012, spreadPerShot: 0.004, spreadMax: 0.02, spreadRecover: 6,
    recoil: { pitch: 0.014, yaw: 0.004, kick: 0.05, recover: 10 }, zoom: 1, scope: false, adsZoom: 1.25, color: 0x5ad1ff, flash: 0.8,
    desc: '12 rounds · quick reload · crisp headshots' },
  machinegun: { id: 'machinegun', name: 'Chill-O-Matic', cls: 'rifle', slot: 'primary', price: 1800, auto: true, rpm: 780, mag: 30, reserve: 120, reloadTime: 1.8,
    damage: { head: 38, body: 11, limb: 7 }, range: 70, pellets: 1, spread: 0.007, spreadMove: 0.02, spreadPerShot: 0.0035, spreadMax: 0.05, spreadRecover: 5,
    recoil: { pitch: 0.007, yaw: 0.005, kick: 0.04, recover: 9 }, pattern: P_AK, zoom: 1, scope: false, adsZoom: 1.3, color: 0xffb347, flash: 1,
    desc: 'Full auto rifle · hits hard · learn the spray (up, then right, then left)' },
  sniper: { id: 'sniper', name: 'Quiet Storm', cls: 'sniper', slot: 'primary', price: 3500, auto: false, rpm: 48, mag: 5, reserve: 20, reloadTime: 2.6,
    damage: { head: 90, body: 55, limb: 40 }, range: 300, pellets: 1, spread: 0.03, spreadMove: 0.06, spreadPerShot: 0, spreadMax: 0.06, spreadRecover: 4, adsSpread: 0.0,
    recoil: { pitch: 0.05, yaw: 0.008, kick: 0.12, recover: 5 }, zoom: 4, scope: true, adsZoom: 4, color: 0x9affc4, flash: 1.3,
    desc: 'Bolt-action · 4× scope · two hits anywhere' },
  // ---------------- new arsenal ----------------
  thunderpop: { id: 'thunderpop', name: 'Thunder Pop', cls: 'hpistol', slot: 'secondary', price: 700, auto: false, rpm: 150, mag: 7, reserve: 35, reloadTime: 2.1,
    damage: { head: 85, body: 38, limb: 26 }, range: 90, pellets: 1, spread: 0.005, spreadMove: 0.06, spreadPerShot: 0.03, spreadMax: 0.08, spreadRecover: 4,
    recoil: { pitch: 0.075, yaw: 0.02, kick: 0.16, recover: 4 }, zoom: 1, scope: false, adsZoom: 1.3, color: 0xffd166, flash: 1.4,
    desc: 'Hand cannon · huge hits · wild when you move' },
  fizztwin: { id: 'fizztwin', name: 'Fizz Twin', cls: 'pistol', slot: 'secondary', price: 450, auto: false, burst: 3, burstDelay: 0.38, rpm: 1100, mag: 18, reserve: 72, reloadTime: 1.6,
    damage: { head: 40, body: 14, limb: 9 }, range: 60, pellets: 1, spread: 0.007, spreadMove: 0.016, spreadPerShot: 0.005, spreadMax: 0.03, spreadRecover: 6,
    recoil: { pitch: 0.011, yaw: 0.006, kick: 0.04, recover: 10 }, pattern: P_BURST, zoom: 1, scope: false, adsZoom: 1.25, color: 0xf2a9b8, flash: 0.8,
    desc: '3-round burst pistol · one click, three pops' },
  buzzbox: { id: 'buzzbox', name: 'Buzz Box', cls: 'smg', slot: 'primary', price: 1200, auto: true, rpm: 900, mag: 32, reserve: 128, reloadTime: 1.9,
    damage: { head: 30, body: 9, limb: 6 }, falloff: { start: 15, end: 40, min: 0.7 }, range: 45, pellets: 1, spread: 0.009, spreadMove: 0.013, spreadPerShot: 0.0028, spreadMax: 0.045, spreadRecover: 6,
    recoil: { pitch: 0.0045, yaw: 0.006, kick: 0.03, recover: 10 }, pattern: P_SMG, zoom: 1, scope: false, adsZoom: 1.2, color: 0xc8b3cb, flash: 0.8,
    desc: 'Run-and-gun SMG · accurate on the move · weak far away' },
  bigpuff: { id: 'bigpuff', name: 'Big Puff', cls: 'shotgun', slot: 'primary', price: 1100, auto: false, rpm: 68, mag: 6, reserve: 24, reloadTime: 2.8,
    damage: { head: 22, body: 13, limb: 8 }, falloff: { start: 5, end: 18, min: 0.2 }, range: 26, pellets: 9, spread: 0.06, spreadMove: 0.075, spreadPerShot: 0, spreadMax: 0.075, spreadRecover: 5, adsSpread: 0.045,
    recoil: { pitch: 0.07, yaw: 0.02, kick: 0.17, recover: 5 }, zoom: 1, scope: false, adsZoom: 1.15, color: 0xff846e, flash: 1.6,
    desc: 'Pump shotgun · 9 pellets · one pump up close' },
  partypopper: { id: 'partypopper', name: 'Party Popper', cls: 'lmg', slot: 'primary', price: 2600, auto: true, rpm: 800, mag: 100, reserve: 200, reloadTime: 4.3,
    damage: { head: 34, body: 10, limb: 7 }, range: 70, pellets: 1, spread: 0.011, spreadMove: 0.03, spreadPerShot: 0.0028, spreadMax: 0.055, spreadRecover: 4,
    recoil: { pitch: 0.006, yaw: 0.008, kick: 0.045, recover: 7 }, pattern: P_LMG, zoom: 1, scope: false, adsZoom: 1.25, color: 0xa9e0c4, flash: 1.1,
    desc: '100-round belt · hold the line · slow reload' },
  breeze: { id: 'breeze', name: 'Breeze M4', cls: 'rifle', slot: 'primary', price: 2100, auto: true, rpm: 690, mag: 25, reserve: 100, reloadTime: 2.0,
    damage: { head: 36, body: 10, limb: 7 }, range: 75, pellets: 1, spread: 0.005, spreadMove: 0.018, spreadPerShot: 0.0026, spreadMax: 0.038, spreadRecover: 6,
    recoil: { pitch: 0.0055, yaw: 0.0035, kick: 0.035, recover: 10 }, pattern: P_M4, zoom: 1, scope: false, adsZoom: 1.35, color: 0x68e3db, flash: 0.9,
    desc: 'Smooth rifle · gentle spray · precise' },
  taptap: { id: 'taptap', name: 'Tap-Tap', cls: 'rifle', slot: 'primary', price: 1600, auto: false, burst: 3, burstDelay: 0.34, rpm: 1000, mag: 24, reserve: 96, reloadTime: 2.1,
    damage: { head: 36, body: 11, limb: 7 }, range: 70, pellets: 1, spread: 0.0055, spreadMove: 0.02, spreadPerShot: 0.002, spreadMax: 0.03, spreadRecover: 6,
    recoil: { pitch: 0.006, yaw: 0.003, kick: 0.035, recover: 11 }, pattern: P_BURST, zoom: 1, scope: false, adsZoom: 1.35, color: 0xffda8d, flash: 0.9,
    desc: 'Burst rifle · three bullets per click · cheap and tidy' },
  skyneedle: { id: 'skyneedle', name: 'Sky Needle', cls: 'sniper', slot: 'primary', price: 1900, auto: false, rpm: 70, mag: 10, reserve: 30, reloadTime: 2.3,
    damage: { head: 80, body: 40, limb: 28 }, range: 250, pellets: 1, spread: 0.022, spreadMove: 0.03, spreadPerShot: 0, spreadMax: 0.04, spreadRecover: 5, adsSpread: 0.001,
    recoil: { pitch: 0.035, yaw: 0.006, kick: 0.09, recover: 6 }, zoom: 3, scope: true, adsZoom: 3, color: 0x7fe3ff, flash: 1.1,
    desc: 'Light scout sniper · 3× scope · fast and mobile' },
};
// shop / UI helpers
export const WEAPON_CATEGORIES = ['PISTOLS', 'SMG & HEAVY', 'RIFLES', 'SNIPERS'];
export const weaponCategory = (w) => (w.cls === 'pistol' || w.cls === 'hpistol' ? 0 : w.cls === 'smg' || w.cls === 'shotgun' || w.cls === 'lmg' ? 1 : w.cls === 'rifle' ? 2 : 3);
// 0..1 bars for the buy menu: damage per second-ish, fire rate, control (low recoil/spread), range
export function weaponBars(w) {
  const dps = (w.damage.body * w.pellets * Math.min(w.rpm, w.burst ? 60 / (w.burstDelay + (w.burst - 1) * 60 / w.rpm) * w.burst : w.rpm)) / 60;
  const cl = (x, a, b) => Math.max(0.06, Math.min(1, (x - a) / (b - a)));
  return { damage: cl(w.damage.body * w.pellets, 0, 60), rate: cl(w.burst ? 60 * w.burst / (w.burstDelay + 60 / w.rpm * w.burst) : w.rpm, 40, 950), dps: cl(dps, 20, 190),
    control: cl(1 - (w.recoil.pitch * 6 + w.spreadMax * 6 + w.spread * 4), 0, 1), range: cl(w.range, 20, 300) };
}

export const HEADSHOT_KILLS = false;   // headshots hurt a lot but no longer one-shot (helmet cuts them further)
export const PLAYER_MAX_HP = 100;

export function computeDamage(weaponId, zone = 'body', distance = 0) {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  let d = w.damage[zone] ?? w.damage.body;
  if (w.falloff && distance > w.falloff.start) { const f = w.falloff, t = Math.min(1, (distance - f.start) / (f.end - f.start)); d = Math.max(1, Math.round(d * (1 - t * (1 - f.min)))); }
  return d;
}
export const weaponClass = (id) => (WEAPONS[id] && WEAPONS[id].cls) || 'pistol';
export const shotSound = (id) => ({ pistol: 'shot_pistol', hpistol: 'shot_hpistol', smg: 'shot_smg', shotgun: 'shot_shotgun', lmg: 'shot_lmg', rifle: id === 'machinegun' ? 'shot_mg' : 'shot_m4', sniper: id === 'sniper' ? 'shot_sniper' : 'shot_scout' }[weaponClass(id)] || 'shot_pistol');

export function applyDamage(hp, weaponId, zone = 'body', distance = 0) {
  const headshot = zone === 'head';
  let damage = computeDamage(weaponId, zone, distance);
  if (headshot && HEADSHOT_KILLS) damage = Math.max(damage, hp);
  const next = Math.max(0, hp - damage);
  return { hp: next, damage, killed: next <= 0, headshot };
}

export function createPlayerState(opts = {}) {
  const s = {
    max: opts.max ?? PLAYER_MAX_HP, hp: opts.max ?? PLAYER_MAX_HP, alive: true,
    damage(n) { if (!s.alive) return 0; s.hp = Math.max(0, s.hp - n); if (s.hp <= 0) s.alive = false; return s.hp; },
    heal(n) { if (s.alive) s.hp = Math.min(s.max, s.hp + n); return s.hp; },
    reset() { s.hp = s.max; s.alive = true; },
  };
  return s;
}

// ---------------------------------------------------------------- viewmodels (gunvm.js: models for the whole arsenal + part animations)
export { createViewmodels } from './gunvm.js';

// ---------------------------------------------------------------- weapon system
export function createWeaponSystem(THREE, vm, hud) {
  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  const ws = {
    current: 'pistol', ammo, onEvent: null,
    trigger: false, aiming: false, cooldown: 0, reloadLeft: 0, bloom: 0, fovNow: null, pendingTap: false,
    lookPitch: 0, lookYaw: 0, scopeT: 0, burstLeft: 0, sprayN: 0, sprayT: 0,
  };
  const emit = (n, d) => { if (ws.onEvent) ws.onEvent(n, d); };
  const W = () => WEAPONS[ws.current];
  const hudSync = () => { if (hud) hud.setAmmo(ammo[ws.current].mag, ammo[ws.current].reserve, W().name, ws.reloadLeft > 0); };

  ws.select = (v) => {
    const id = typeof v === 'number' ? WEAPON_ORDER[v] : v;
    if (!WEAPONS[id] || id === ws.current) return;
    ws.current = id; ws.reloadLeft = 0; ws.cooldown = 0.25; ws.burstLeft = 0; ws.sprayN = 0; vm.setWeapon(id); vm.setAim(ws.aiming);
    emit('switch', { weapon: id }); hudSync();
  };
  ws.cycle = (dir = 1) => { const i = WEAPON_ORDER.indexOf(ws.current); ws.select(WEAPON_ORDER[(i + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length]); };
  ws.setTrigger = (down) => { if (down && !ws.trigger) ws.pendingTap = true; ws.trigger = down; };
  ws.setAim = (on) => { ws.aiming = on; vm.setAim(on); };
  ws.reload = () => {
    const a = ammo[ws.current], w = W();
    if (ws.reloadLeft > 0 || a.mag >= w.mag || a.reserve <= 0) return false;
    ws.reloadLeft = w.reloadTime; vm.reload(w.reloadTime); emit('reload', { weapon: ws.current }); hudSync(); return true;
  };
  ws.refill = () => { for (const id of WEAPON_ORDER) { ammo[id].mag = WEAPONS[id].mag; ammo[id].reserve = WEAPONS[id].reserve; } ws.reloadLeft = 0; hudSync(); };
  ws.consumeLook = () => { const r = { pitch: ws.lookPitch, yaw: ws.lookYaw }; ws.lookPitch = 0; ws.lookYaw = 0; return r; };
  ws.fov = (base) => {
    const w = W(); const target = base / (ws.aiming ? w.adsZoom : 1);
    if (ws.fovNow == null) ws.fovNow = base;
    ws.fovNow += (target - ws.fovNow) * 0.25; return ws.fovNow;
  };
  ws.spread = (s = {}) => {
    const w = W(); let sp = w.spread;
    if (ws.aiming && w.adsSpread !== undefined) sp = w.adsSpread; else if (ws.aiming) sp *= 0.5;
    if (s.moving) sp = Math.max(sp, w.spreadMove) * (s.sprinting ? 1.3 : 1);
    if (s.grounded === false) sp += 0.04;
    return Math.min(w.spreadMax + (s.moving ? w.spreadMove : 0), sp + ws.bloom);
  };

  ws.update = (dt, s = {}) => {
    const w = W(), a = ammo[ws.current], shots = [];
    ws.cooldown = Math.max(0, ws.cooldown - dt);
    ws.bloom = Math.max(0, ws.bloom - w.spreadRecover * dt * 0.01);
    if (ws.reloadLeft > 0) {
      ws.reloadLeft -= dt;
      if (ws.reloadLeft <= 0) {
        ws.reloadLeft = 0; const need = w.mag - a.mag, take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take; emit('reloaded', { weapon: ws.current }); hudSync();
      }
    }
    // bursts: one press fires w.burst shots at rpm then waits burstDelay (server enforces the same cadence)
    if (w.burst && ws.pendingTap && !ws.burstLeft && ws.cooldown <= 0 && ws.reloadLeft <= 0) ws.burstLeft = w.burst;
    const wants = w.burst ? ws.burstLeft > 0 : w.auto ? ws.trigger : ws.pendingTap;
    ws.pendingTap = false;
    ws.sprayT += dt; if (ws.sprayT > 60 / w.rpm * 2.2 + (w.burstDelay || 0) + 0.08) ws.sprayN = 0;   // spray pattern restarts after a pause
    if (wants && ws.reloadLeft <= 0 && ws.cooldown <= 0) {
      if (a.mag <= 0) { ws.burstLeft = 0; emit('empty', { weapon: ws.current }); if (!ws.reload()) ws.cooldown = 0.25; }
      else {
        a.mag--; if (w.burst) { ws.burstLeft--; ws.cooldown = ws.burstLeft > 0 ? 60 / w.rpm : w.burstDelay; } else ws.cooldown = 60 / w.rpm;
        if (a.mag === 0) ws.burstLeft = 0;
        const sp = ws.spread(s);
        for (let i = 0; i < w.pellets; i++) {
          const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
          shots.push({ weapon: ws.current, dir: { x: Math.cos(ang) * r, y: Math.sin(ang) * r },
            damage: { ...w.damage }, range: w.range, pellets: w.pellets, tracer: true });
        }
        ws.bloom = Math.min(w.spreadMax, ws.bloom + w.spreadPerShot);
        let kp = 1, ky = (Math.random() - 0.5) * 2; const pat = w.pattern;   // CS-style spray: learnable pattern + a little noise
        if (pat) { const i = ws.sprayN < pat.length ? ws.sprayN : pat.length - 6 + ((ws.sprayN - pat.length) % 6); kp = pat[Math.max(0, i)][0]; ky = pat[Math.max(0, i)][1] + (Math.random() - 0.5) * 0.35; }
        ws.lookPitch += w.recoil.pitch * kp * (ws.aiming ? 0.7 : 1);
        ws.lookYaw += ky * w.recoil.yaw; ws.sprayN++; ws.sprayT = 0;
        vm.fire(); emit('shot', { weapon: ws.current, mag: a.mag });
        if (a.mag === 0 && a.reserve > 0 && w.auto) ws.reload();
        hudSync();
      }
    }
    vm.update(dt, s);
    if (hud) {
      const scoped = w.scope && vm.aimAmount > 0.6;
      ws.scopeT += ((scoped ? 1 : 0) - ws.scopeT) * Math.min(1, dt * 20);
      hud.setScope(scoped, ws.scopeT);
      hud.setCrosshair(ws.spread(s) * 900, !scoped);
    }
    return shots;
  };
  vm.setWeapon('pistol'); hudSync();
  return ws;
}

// ---------------------------------------------------------------- HUD (DOM)
export function createHUD(container = document.body) {
  const css = document.createElement('style');
  css.textContent = `
.sc-hud{position:absolute;inset:0;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff;z-index:20;user-select:none}
.sc-hp{position:absolute;left:24px;bottom:24px;width:240px}
.sc-hp-label{font-weight:800;font-size:13px;letter-spacing:.12em;opacity:.85;margin-bottom:4px;text-shadow:0 2px 0 rgba(0,0,0,.4)}
.sc-hp-track{position:relative;height:24px;box-sizing:border-box;border-radius:14px;background:rgba(10,14,30,.55);border:2px solid rgba(255,255,255,.7);overflow:hidden}
.sc-hp-fill{height:100%;width:100%;background:#52f0a0;border-radius:10px;transition:width .15s,background .2s}
.sc-hp-num{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;line-height:1;text-shadow:0 1px 2px #000,0 0 3px #000}
.sc-ammo{position:absolute;right:28px;bottom:24px;text-align:right;text-shadow:0 2px 0 rgba(0,0,0,.45)}
.sc-ammo-n{font-size:56px;font-weight:700;line-height:1}.sc-ammo-n small{font-size:22px;opacity:.65;font-weight:500}
.sc-ammo-w{font-size:13px;font-weight:700;letter-spacing:.1em;opacity:.85}
.sc-ammo.low .sc-ammo-n{color:#ff6b6b}
.sc-ch{position:absolute;left:50%;top:50%;width:0;height:0}
.sc-ch i{position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.sc-ch .t{width:2px;height:8px;left:-1px}.sc-ch .l{width:8px;height:2px;top:-1px}.sc-ch .d{width:2px;height:2px;left:-1px;top:-1px;border-radius:50%}
.sc-hit{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;opacity:0;transition:opacity .25s}
.sc-hit.on{opacity:1;transition:none}
.sc-hit:before,.sc-hit:after{content:"";position:absolute;left:12px;top:-2px;width:2px;height:30px;background:var(--c,#fff);transform:rotate(45deg)}
.sc-hit:after{transform:rotate(-45deg)}
.sc-scope{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at center,transparent 0,transparent 33vmin,#000 33.4vmin)}
.sc-scope:before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:#000}
.sc-scope:after{content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;background:#000}
.sc-scope b{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#ff3b3b}
.sc-flash{position:absolute;inset:0;background:radial-gradient(circle,transparent 40%,rgba(255,40,60,.65));opacity:0;transition:opacity .4s}
.sc-flash.on{opacity:1;transition:none}
.sc-bomb{position:absolute;top:18px;left:50%;transform:translateX(-50%);font-weight:800;font-size:18px;text-shadow:0 2px 0 rgba(0,0,0,.5)}
.sc-reload{position:absolute;right:200px;bottom:76px;font-weight:800;opacity:0;transition:opacity .15s}
`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.className = 'sc-hud';
  root.innerHTML = `
<div class="sc-flash"></div><div class="sc-scope"><b></b></div>
<div class="sc-ch"><i class="t" style="top:-12px"></i><i class="t" style="top:4px"></i><i class="l" style="left:-12px"></i><i class="l" style="left:4px"></i><i class="d"></i></div>
<div class="sc-hit"></div><div class="sc-bomb"></div><div class="sc-reload">RELOADING...</div>
<div class="sc-hp"><div class="sc-hp-label">HEALTH</div><div class="sc-hp-track"><div class="sc-hp-fill"></div><div class="sc-hp-num"></div></div></div>
<div class="sc-ammo"><div class="sc-ammo-n"></div><div class="sc-ammo-w"></div></div>`;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(root);
  const q = (s) => root.querySelector(s);
  const fill = q('.sc-hp-fill'), num = q('.sc-hp-num'), ammoBox = q('.sc-ammo'), ammoN = q('.sc-ammo-n'), ammoW = q('.sc-ammo-w');
  const scope = q('.sc-scope'), ch = q('.sc-ch'), hit = q('.sc-hit'), flash = q('.sc-flash'), bomb = q('.sc-bomb'), rel = q('.sc-reload');
  let hitT = 0;
  return {
    root,
    setHealth(hp, max = 100) {
      const f = Math.max(0, Math.min(1, hp / max)); fill.style.width = f * 100 + '%';
      fill.style.background = f > 0.6 ? '#52f0a0' : f > 0.3 ? '#ffd24a' : '#ff5566'; num.textContent = Math.ceil(hp);
    },
    setAmmo(mag, reserve, name, reloading) {
      ammoN.innerHTML = mag == null ? '' : `${mag} <small>/ ${reserve}</small>`; ammoW.textContent = name || ''; // mag null = melee (knife): name only
      ammoBox.classList.toggle('low', mag <= 2); rel.style.opacity = reloading ? 1 : 0;
    },
    setScope(on, t = on ? 1 : 0) { scope.style.opacity = t; root.querySelector('.sc-hp').style.opacity = on ? 0.5 : 1; },
    setCrosshair(px, visible = true) {
      ch.style.display = visible ? '' : 'none'; const o = Math.round(Math.max(0, Math.min(40, px)));
      const w = root.clientWidth, h = root.clientHeight; ch.style.left = Math.round(w / 2) + 'px'; ch.style.top = Math.round(h / 2) + 'px';
      const [t1, t2, l1, l2] = ch.children, g = 4 + o, L = 8; // equal ticks, equal gap g on all four sides
      t1.style.top = -g - L + 'px'; t2.style.top = g + 'px'; l1.style.left = -g - L + 'px'; l2.style.left = g + 'px';
    },
    hitMarker(kill = false, head = false) {
      hit.style.setProperty('--c', kill ? '#ff3b3b' : head ? '#ffd24a' : '#fff');
      hit.classList.add('on'); clearTimeout(hitT); hitT = setTimeout(() => hit.classList.remove('on'), 90);
    },
    damageFlash() { flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 80); },
    setBombText(t) { bomb.textContent = t || ''; },
    dispose() { root.remove(); css.remove(); },
  };
}
