// player.js - Sniper Chill PLAYER + WEAPONS module (ES module, no deps, THREE passed in).
//
// API
//   WEAPONS                          weapon defs {pistol, machinegun, sniper}
//   WEAPON_ORDER                     ['pistol','machinegun','sniper'] (keys 1,2,3)
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

export const WEAPON_ORDER = ['pistol', 'machinegun', 'sniper'];

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Chill Pistol', auto: false, rpm: 360, mag: 12, reserve: 60, reloadTime: 1.2,
    damage: { head: 60, body: 20, limb: 12 },
    range: 80, pellets: 1, spread: 0.004, spreadMove: 0.012, spreadPerShot: 0.004, spreadMax: 0.02, spreadRecover: 6,
    recoil: { pitch: 0.014, yaw: 0.004, kick: 0.05, recover: 10 },
    zoom: 1, scope: false, adsZoom: 1.25, color: 0x5ad1ff, flash: 0.8,
  },
  machinegun: {
    id: 'machinegun', name: 'Chill-O-Matic', auto: true, rpm: 780, mag: 30, reserve: 120, reloadTime: 1.8,
    damage: { head: 38, body: 11, limb: 7 },
    range: 70, pellets: 1, spread: 0.007, spreadMove: 0.02, spreadPerShot: 0.0035, spreadMax: 0.05, spreadRecover: 5,
    recoil: { pitch: 0.007, yaw: 0.005, kick: 0.04, recover: 9 },
    zoom: 1, scope: false, adsZoom: 1.3, color: 0xffb347, flash: 1,
  },
  sniper: {
    id: 'sniper', name: 'Quiet Storm', auto: false, rpm: 48, mag: 5, reserve: 20, reloadTime: 2.6,
    damage: { head: 90, body: 55, limb: 40 }, // never one-shots at 100 hp: headshot 90 leaves 10, two hits kill
    range: 300, pellets: 1, spread: 0.03, spreadMove: 0.06, spreadPerShot: 0, spreadMax: 0.06, spreadRecover: 4,
    adsSpread: 0.0, // perfectly accurate when scoped and still
    recoil: { pitch: 0.05, yaw: 0.008, kick: 0.12, recover: 5 },
    zoom: 4, scope: true, adsZoom: 4, color: 0x9affc4, flash: 1.3,
  },
};

export const HEADSHOT_KILLS = false;   // headshots hurt a lot but no longer one-shot (helmet cuts them further)
export const PLAYER_MAX_HP = 100;

export function computeDamage(weaponId, zone = 'body') {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  return w.damage[zone] ?? w.damage.body;
}

export function applyDamage(hp, weaponId, zone = 'body') {
  const headshot = zone === 'head';
  let damage = computeDamage(weaponId, zone);
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

// ---------------------------------------------------------------- viewmodels
export function createViewmodels(THREE) {
  const group = new THREE.Group();
  group.name = 'viewmodels';
  const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
  const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); if (parent) parent.add(me); return me;
  };
  const cyl = (r, l, m, x, y, z, parent, seg = 8) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
    me.rotation.x = Math.PI / 2; me.position.set(x, y, z); parent.add(me); return me;
  };
  const dark = mat(0x2b2f3a), mid = mat(0x4a5163), skin = mat(0xf0c3a0), sleeve = mat(0x3d6bff);

  function hand(parent, x, y, z) {
    const h = new THREE.Group(); h.position.set(x, y, z); parent.add(h);
    box(0.05, 0.05, 0.07, skin, 0, 0, 0, h);
    box(0.055, 0.05, 0.14, sleeve, 0, -0.01, 0.1, h);
    return h;
  }
  function flashMesh(color) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), m); a.rotation.x = -Math.PI / 2; a.position.z = -0.06; g.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), m); g.add(b);
    const c = b.clone(); c.rotation.z = Math.PI / 4; g.add(c);
    g.visible = false; g.userData.mat = m; return g;
  }

  const models = {};
  // pistol
  { const g = new THREE.Group(); const body = mat(WEAPONS.pistol.color);
    const slide = box(0.05, 0.06, 0.26, body, 0, 0.02, -0.05, g);
    box(0.045, 0.09, 0.06, dark, 0, -0.045, 0.04, g).rotation.x = 0.25;
    box(0.04, 0.03, 0.1, dark, 0, -0.01, -0.05, g);
    box(0.012, 0.015, 0.012, mid, 0, 0.055, -0.16, g); box(0.02, 0.015, 0.012, mid, 0, 0.055, 0.05, g);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.2); g.add(muzzle);
    const fl = flashMesh(0xfff2a0); fl.position.copy(muzzle.position); g.add(fl);
    hand(g, 0, -0.08, 0.07);
    models.pistol = { g, muzzle, flash: fl, slide, slideRest: slide.position.z, home: new THREE.Vector3(0.17, -0.17, -0.38), ads: new THREE.Vector3(0, -0.09, -0.34) }; }
  // machine gun
  { const g = new THREE.Group(); const body = mat(WEAPONS.machinegun.color);
    box(0.07, 0.09, 0.42, body, 0, 0, -0.1, g);
    cyl(0.018, 0.3, dark, 0, 0.01, -0.45, g);
    box(0.045, 0.16, 0.07, dark, 0, -0.12, -0.02, g).rotation.x = -0.2;
    box(0.04, 0.1, 0.06, dark, 0, -0.08, 0.1, g).rotation.x = 0.3;
    box(0.06, 0.07, 0.2, mid, 0, -0.01, 0.2, g);
    box(0.02, 0.03, 0.03, mid, 0, 0.07, -0.3, g); box(0.03, 0.03, 0.03, mid, 0, 0.07, 0.05, g);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.01, -0.62); g.add(muzzle);
    const fl = flashMesh(0xffc15a); fl.position.copy(muzzle.position); g.add(fl);
    hand(g, 0, -0.06, -0.3); hand(g, 0.0, -0.1, 0.12);
    models.machinegun = { g, muzzle, flash: fl, slide: null, home: new THREE.Vector3(0.19, -0.2, -0.4), ads: new THREE.Vector3(0, -0.12, -0.36) }; }
  // sniper
  { const g = new THREE.Group(); const body = mat(WEAPONS.sniper.color);
    box(0.05, 0.07, 0.6, body, 0, 0, -0.1, g);
    cyl(0.014, 0.55, dark, 0, 0.01, -0.68, g);
    box(0.05, 0.1, 0.22, dark, 0, -0.03, 0.3, g);
    box(0.04, 0.09, 0.06, dark, 0, -0.09, 0.08, g);
    cyl(0.03, 0.26, mid, 0, 0.09, -0.12, g, 10);           // scope tube
    cyl(0.04, 0.03, dark, 0, 0.09, -0.27, g, 10); cyl(0.036, 0.03, dark, 0, 0.09, 0.02, g, 10);
    box(0.012, 0.04, 0.012, mid, 0, 0.05, -0.12, g);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.01, -0.97); g.add(muzzle);
    const fl = flashMesh(0xbfffe0); fl.position.copy(muzzle.position); fl.scale.setScalar(1.4); g.add(fl);
    hand(g, 0, -0.1, 0.06); hand(g, 0, -0.04, -0.3);
    models.sniper = { g, muzzle, flash: fl, slide: null, home: new THREE.Vector3(0.2, -0.2, -0.42), ads: new THREE.Vector3(0, -0.09, -0.3) }; }

  for (const id of WEAPON_ORDER) { models[id].g.visible = false; group.add(models[id].g); }

  const st = {
    current: 'pistol', recoil: 0, flash: 0, reloadT: -1, reloadDur: 1, aim: 0, aimTarget: 0,
    bob: 0, swap: 1, kick: 0, time: 0, inspT: -1,
  };
  const api = {
    group, models,
    get current() { return st.current; },
    setWeapon(id) {
      if (!models[id] || id === st.current && models[id].g.visible) return;
      models[st.current].g.visible = false;
      st.current = id; models[id].g.visible = true; st.swap = 0; st.reloadT = -1; st.flash = 0; st.inspT = -1;
    },
    fire() { const w = WEAPONS[st.current]; st.recoil = Math.min(1.6, st.recoil + 1); st.flash = 0.06; st.kick = w.recoil.kick;
      models[st.current].flash.rotation.z = Math.random() * 6.28; },
    inspect() { if (st.reloadT >= 0 || st.inspT >= 0 || st.aimTarget > 0 || st.recoil > 0.15 || st.swap < 1) return false; st.inspT = 0; return true; },
    get inspecting() { return st.inspT >= 0; },
    reload(dur) { st.inspT = -1; st.reloadT = 0; st.reloadDur = dur ?? WEAPONS[st.current].reloadTime; },
    setAim(on) { st.aimTarget = on ? 1 : 0; },
    get aimAmount() { return st.aim; },
    get reloading() { return st.reloadT >= 0; },
    muzzleWorldPosition(v) { models[st.current].muzzle.getWorldPosition(v); return v; },
    // state: {moving, sprinting}
    update(dt, s = {}) {
      st.time += dt;
      const m = models[st.current], w = WEAPONS[st.current];
      st.aim += (st.aimTarget - st.aim) * Math.min(1, dt * 14);
      st.swap = Math.min(1, st.swap + dt * 5);
      st.recoil = Math.max(0, st.recoil - dt * w.recoil.recover);
      st.kick = Math.max(0, st.kick - dt * 0.6);
      if (s.moving) st.bob += dt * (s.sprinting ? 13 : 8);
      const bobAmt = (s.moving ? 1 : 0) * (1 - st.aim * 0.9) * (s.sprinting ? 1.6 : 1);
      const idle = Math.sin(st.time * 1.6) * 0.0015;
      const p = m.home.clone().lerp(m.ads, st.aim);
      p.x += Math.cos(st.bob * 0.5) * 0.012 * bobAmt;
      p.y += Math.abs(Math.sin(st.bob * 0.5)) * 0.014 * bobAmt + idle - (1 - st.swap) * 0.25;
      p.z += st.recoil * w.recoil.kick * 1.4;
      m.g.position.copy(p);
      m.g.rotation.set(st.recoil * w.recoil.kick * 2.2 - (1 - st.swap) * 0.8, 0, 0);
      if (s.sprinting && s.moving) { m.g.rotation.y = 0.35 * (1 - st.aim); m.g.rotation.z = -0.1; } else m.g.rotation.z = 0;
      if (m.slide) m.slide.position.z = m.slideRest + Math.min(1, st.recoil) * 0.07;
      // reload
      if (st.reloadT >= 0) {
        st.reloadT += dt; const t = Math.min(1, st.reloadT / st.reloadDur);
        const dip = Math.sin(t * Math.PI);                       // down and back up
        m.g.position.y -= dip * 0.12; m.g.position.x += dip * 0.04;
        m.g.rotation.x += dip * 0.7; m.g.rotation.z += Math.sin(t * Math.PI * 2) * 0.25 * dip;
        if (t >= 1) st.reloadT = -1;
      }
      // inspect: slow turn of the weapon in front of the camera (cancelled by fire, reload, aim)
      if (st.inspT >= 0) {
        if (st.recoil > 0.05 || st.aimTarget > 0 || st.reloadT >= 0) st.inspT = -1;
        else { st.inspT += dt; const t = Math.min(1, st.inspT / 2.2), e = Math.sin(Math.PI * Math.min(1, t * 1.05)), e2 = e * e * (3 - 2 * e);
          m.g.position.x -= e2 * 0.07; m.g.position.y += e2 * 0.035; m.g.position.z += e2 * 0.07;
          m.g.rotation.y += e2 * 0.95 * Math.cos(t * Math.PI * 1.5); m.g.rotation.x -= e2 * 0.3; m.g.rotation.z += Math.sin(t * Math.PI * 2) * 0.4 * e2;
          if (t >= 1) st.inspT = -1; } }
      // muzzle flash
      st.flash = Math.max(0, st.flash - dt);
      const fl = m.flash; fl.visible = st.flash > 0 && !(w.scope && st.aim > 0.8);
      if (fl.visible) { const k = st.flash / 0.06; fl.userData.mat.opacity = k; fl.scale.setScalar((w.id === 'sniper' ? 1.4 : 1) * (0.7 + 0.6 * k) * w.flash); }
      // hide gun when fully scoped (overlay takes over)
      m.g.visible = !(w.scope && st.aim > 0.9);
    },
  };
  api.setWeapon('pistol'); models.pistol.g.visible = true;
  return api;
}

// ---------------------------------------------------------------- weapon system
export function createWeaponSystem(THREE, vm, hud) {
  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  const ws = {
    current: 'pistol', ammo, onEvent: null,
    trigger: false, aiming: false, cooldown: 0, reloadLeft: 0, bloom: 0, fovNow: null, pendingTap: false,
    lookPitch: 0, lookYaw: 0, scopeT: 0,
  };
  const emit = (n, d) => { if (ws.onEvent) ws.onEvent(n, d); };
  const W = () => WEAPONS[ws.current];
  const hudSync = () => { if (hud) hud.setAmmo(ammo[ws.current].mag, ammo[ws.current].reserve, W().name, ws.reloadLeft > 0); };

  ws.select = (v) => {
    const id = typeof v === 'number' ? WEAPON_ORDER[v] : v;
    if (!WEAPONS[id] || id === ws.current) return;
    ws.current = id; ws.reloadLeft = 0; ws.cooldown = 0.25; vm.setWeapon(id); vm.setAim(ws.aiming);
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
    const wants = w.auto ? ws.trigger : ws.pendingTap;
    ws.pendingTap = false;
    if (wants && ws.reloadLeft <= 0 && ws.cooldown <= 0) {
      if (a.mag <= 0) { emit('empty', { weapon: ws.current }); if (!ws.reload()) ws.cooldown = 0.25; }
      else {
        a.mag--; ws.cooldown = 60 / w.rpm;
        const sp = ws.spread(s);
        for (let i = 0; i < w.pellets; i++) {
          const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
          shots.push({ weapon: ws.current, dir: { x: Math.cos(ang) * r, y: Math.sin(ang) * r },
            damage: { ...w.damage }, range: w.range, pellets: w.pellets, tracer: true });
        }
        ws.bloom = Math.min(w.spreadMax, ws.bloom + w.spreadPerShot);
        ws.lookPitch += w.recoil.pitch * (ws.aiming ? 0.7 : 1);
        ws.lookYaw += (Math.random() - 0.5) * 2 * w.recoil.yaw;
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
