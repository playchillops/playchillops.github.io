// bots.js - Sniper Chill BOTS module. Self-contained ES module, no dependencies, no DOM, no Three.js.
// Works headless (Node 18+) and in the browser.
//
// COORDINATES: x/z = ground plane, y = up. Entity x,y,z = FEET position. Eye height 1.6.
// Yaw 0 faces -z (Three.js camera convention): forward = (-sin(yaw), 0, -cos(yaw)). Pitch > 0 looks up.
//
// ---------------------------------------------------------------------------------------------
// PUBLIC API
//   createBot(opts)                      -> bot   opts: {id,name,team:'T'|'CT',role,difficulty:'easy'|'medium'|'hard',
//                                                  x,y,z,yaw,weapons:[...],seed}
//   update(bots, dt, world)              advance every alive bot by dt seconds (call once per frame, dt capped at 0.1)
//   newRound(world)                      reset team brain (call at round start, after respawning bots with resetBot)
//   resetBot(bot, {x,y,z,yaw})           respawn: full hp, full ammo, clears memory/paths
//   damageBot(bot, dmg, fromX, fromZ, headshot)   apply damage (returns true if bot died) - bot turns toward attacker
//   emitSound(bots, x, z, radius, team)  gunshot noise: enemy bots in radius may investigate (call for HUMAN shots too)
//   findPath(grid, ax,az, bx,bz)         A* + string-pulling -> [{x,z}...] or null
//   raycastGrid(grid, ox,oz, dx,dz, maxD)distance to first wall (or maxD)
//   hasLOS(grid, ax,az, bx,bz)           wall-only line of sight
//   makeGrid(w,h,cell,data,ox,oz), gridFromAscii(rows, cell)   helpers
//   DIFFICULTY, WEAPONS                  tuning tables (mutable at runtime)
//
// WORLD OBJECT (you own it, bots only read it and call its callbacks)
//   world.grid     {w,h,cell,ox,oz,data:Uint8Array}  data[iz*w+ix] !== 0 means wall/solid. If walls change call invalidateNav(grid).
//   world.sites    [{id:'A',x,z,r}]                 bomb sites (r = plant radius)
//   world.bomb     {state:'carried'|'dropped'|'planted'|'defused'|'exploded', carrierId, x,z, site, timeLeft}
//   world.players  [{id,team,alive,x,y,z}]         optional human players (enemies of the bots on other team)
//   world.attackTeam  'T' (default)                 team that plants
//   world.rng      optional () => [0,1) for determinism
//   CALLBACKS (all optional except shoot):
//   world.shoot(bot, origin{x,y,z}, dir{x,y,z}, weaponName)  -> optional {hit:bool}. YOU resolve hit/damage (raycast, headshot...)
//                                                            and call damageBot(victim, ...). Bots never cheat on hit chance:
//                                                            aim error + spread are in `dir`.
//   world.plant(bot, siteId)   bot finished planting (set world.bomb state 'planted', x,z,site,timeLeft)
//   world.defuse(bot)          bot finished defusing
//   world.pickupBomb(bot)      bot reached dropped bomb (set carrierId = bot.id, state 'carried')
//   world.onBotEvent(bot, name, data)  'reload','switch','spot','plantStart','defuseStart','cover'... for sfx/UI
//
// BOT FIELDS you can read for rendering: x,y,z,yaw,pitch,hp,alive,team,weapon,speed (current ground speed),
//   moving, planting (0..1 progress or 0), defusing (0..1), scoped(bool), reloading(bool), state (debug label), firedAt (time).
// ---------------------------------------------------------------------------------------------

import * as Brain from './botsbrain.js';
export { PERSONAS, PERSONA_ORDER } from './botsbrain.js';
export const EYE = 1.6, HEAD_Y = 1.62, CHEST_Y = 1.15;

// Levels, easiest -> hardest. DEFAULT is 'hard'. hear = chance to notice a sound at point blank, hearR = hearing radius multiplier.
export const DIFFICULTY_ORDER = ['rookie', 'chill', 'easy', 'medium', 'hard', 'veteran', 'elite', 'insane'];
export const DEFAULT_DIFFICULTY = 'hard';
export const DIFFICULTY = {
  rookie:  { reaction: 1.00, aimSigma: 0.110, turn: 2.2,  fov: 90,  view: 30, speed: 3.6, coverBias: 0.05, strafe: 0.10, headAim: 0.00, hear: 0.25, hearR: 0.55, burst: 14, burstPause: 0.20, patience: 2.5, peekDur: 1.6, closeCombat: 0.2 },
  chill:   { reaction: 0.85, aimSigma: 0.095, turn: 2.8,  fov: 95,  view: 34, speed: 3.8, coverBias: 0.10, strafe: 0.20, headAim: 0.01, hear: 0.32, hearR: 0.65, burst: 8,  burstPause: 0.80, patience: 3.0, peekDur: 1.5, closeCombat: 0.3 },
  easy:    { reaction: 0.70, aimSigma: 0.080, turn: 3.0,  fov: 100, view: 38, speed: 4.0, coverBias: 0.15, strafe: 0.30, headAim: 0.02, hear: 0.40, hearR: 0.75, burst: 12, burstPause: 0.15, patience: 3.0, peekDur: 1.4, closeCombat: 0.4 },
  medium:  { reaction: 0.38, aimSigma: 0.036, turn: 6.0,  fov: 110, view: 55, speed: 4.7, coverBias: 0.50, strafe: 0.60, headAim: 0.12, hear: 0.70, hearR: 0.9,  burst: 6,  burstPause: 0.28, patience: 4.5, peekDur: 1.1, closeCombat: 0.7 },
  hard:    { reaction: 0.20, aimSigma: 0.015, turn: 11.0, fov: 120, view: 75, speed: 5.2, coverBias: 0.85, strafe: 0.95, headAim: 0.35, hear: 1.00, hearR: 1.0,  burst: 4,  burstPause: 0.34, patience: 6.0, peekDur: 0.9, closeCombat: 1.0 },
  veteran: { reaction: 0.15, aimSigma: 0.011, turn: 13.0, fov: 125, view: 85, speed: 5.4, coverBias: 0.90, strafe: 1.00, headAim: 0.45, hear: 1.00, hearR: 1.1,  burst: 4,  burstPause: 0.30, patience: 6.5, peekDur: 0.85, closeCombat: 1.0 },
  elite:   { reaction: 0.12, aimSigma: 0.008, turn: 15.0, fov: 130, view: 95, speed: 5.6, coverBias: 0.95, strafe: 1.00, headAim: 0.55, hear: 1.00, hearR: 1.25, burst: 3,  burstPause: 0.28, patience: 7.0, peekDur: 0.8, closeCombat: 1.0 },
  insane:  { reaction: 0.09, aimSigma: 0.005, turn: 18.0, fov: 140, view: 110, speed: 5.9, coverBias: 1.00, strafe: 1.00, headAim: 0.70, hear: 1.00, hearR: 1.5, burst: 3,  burstPause: 0.24, patience: 8.0, peekDur: 0.7, closeCombat: 1.0 },
};

// rate = shots/s, spread = radians cone (half angle), range = effective metres, mag/reload in shots/s.
export const WEAPONS = {
  pistol:      { rate: 3.5, spread: 0.014, range: 28, mag: 12, reload: 1.4, auto: false, dmg: 25, noise: 30, scope: 0 },
  machinegun:  { rate: 9.0, spread: 0.032, range: 34, mag: 30, reload: 2.0, auto: true,  dmg: 17, noise: 40, scope: 0 },
  sniper:      { rate: 0.9, spread: 0.002, range: 90, mag: 5,  reload: 2.4, auto: false, dmg: 100, noise: 60, scope: 0.45 },
};

const RADIUS = 0.4;
const PLANT_TIME = 3.2, DEFUSE_TIME = 5.0;
let _uid = 0, _persona = 0;

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const gauss = (r) => (r() + r() + r() + r() - 2) * 1.7;

// ------------------------------------------------------------------ grid helpers
export function makeGrid(w, h, cell, data, ox = 0, oz = 0) { return { w, h, cell, ox, oz, data }; }
export function gridFromAscii(rows, cell = 1) {
  const h = rows.length, w = rows[0].length, data = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) data[z * w + x] = rows[z][x] === '#' ? 1 : 0;
  return makeGrid(w, h, cell, data, 0, 0);
}
const cxOf = (g, x) => Math.floor((x - g.ox) / g.cell);
const czOf = (g, z) => Math.floor((z - g.oz) / g.cell);
const cenX = (g, ix) => g.ox + (ix + 0.5) * g.cell;
const cenZ = (g, iz) => g.oz + (iz + 0.5) * g.cell;
const solidAt = (g, ix, iz) => ix < 0 || iz < 0 || ix >= g.w || iz >= g.h || g.data[iz * g.w + ix] !== 0;
export function invalidateNav(g) { g._nav = null; }

export function raycastGrid(g, ox, oz, dx, dz, maxD) {
  const l = Math.hypot(dx, dz); if (l < 1e-9) return maxD;
  dx /= l; dz /= l;
  let ix = cxOf(g, ox), iz = czOf(g, oz);
  if (solidAt(g, ix, iz)) return 0;
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1, c = g.cell;
  let tx = dx !== 0 ? ((dx > 0 ? g.ox + (ix + 1) * c : g.ox + ix * c) - ox) / dx : Infinity;
  let tz = dz !== 0 ? ((dz > 0 ? g.oz + (iz + 1) * c : g.oz + iz * c) - oz) / dz : Infinity;
  const tdx = dx !== 0 ? c / Math.abs(dx) : Infinity, tdz = dz !== 0 ? c / Math.abs(dz) : Infinity;
  for (let n = 0; n < 4096; n++) {
    let t;
    if (tx < tz) { t = tx; ix += sx; tx += tdx; } else { t = tz; iz += sz; tz += tdz; }
    if (t > maxD) return maxD;
    if (solidAt(g, ix, iz)) return t;
  }
  return maxD;
}
export function hasLOS(g, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return raycastGrid(g, ax, az, dx, dz, d) >= d - 1e-4;
}
// wall LOS with a little width (so bots can see people peeking corners): any of 3 rays clear
function seeLOS(g, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const px = -dz / d * 0.3, pz = dx / d * 0.3;
  return hasLOS(g, ax, az, bx, bz) || hasLOS(g, ax + px, az + pz, bx + px, bz + pz) || hasLOS(g, ax - px, az - pz, bx - px, bz - pz);
}
function freeCircle(g, x, z, r) {
  const x0 = cxOf(g, x - r), x1 = cxOf(g, x + r), z0 = czOf(g, z - r), z1 = czOf(g, z + r);
  for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) if (solidAt(g, ix, iz)) return false;
  return true;
}
function navOf(g) {
  if (g._nav) return g._nav;
  const free = new Uint8Array(g.w * g.h), near = new Uint8Array(g.w * g.h);
  for (let iz = 0; iz < g.h; iz++) for (let ix = 0; ix < g.w; ix++) free[iz * g.w + ix] = freeCircle(g, cenX(g, ix), cenZ(g, iz), RADIUS) ? 1 : 0;
  for (let iz = 0; iz < g.h; iz++) for (let ix = 0; ix < g.w; ix++) {
    if (!free[iz * g.w + ix]) continue;
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (solidAt(g, ix + dx, iz + dz)) n = 1;
    near[iz * g.w + ix] = n;
  }
  g._nav = { free, near, stamp: 0, mark: new Int32Array(g.w * g.h), gs: new Float32Array(g.w * g.h), parent: new Int32Array(g.w * g.h), closed: new Int32Array(g.w * g.h) };
  return g._nav;
}
function snapFree(g, nav, ix, iz) {
  if (ix >= 0 && iz >= 0 && ix < g.w && iz < g.h && nav.free[iz * g.w + ix]) return [ix, iz];
  for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = ix + dx, z = iz + dz;
    if (x >= 0 && z >= 0 && x < g.w && z < g.h && nav.free[z * g.w + x]) return [x, z];
  }
  return null;
}
function lineClear(g, ax, az, bx, bz, w = 0.35) {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const px = -dz / d * w, pz = dx / d * w;
  return hasLOS(g, ax, az, bx, bz) && hasLOS(g, ax + px, az + pz, bx + px, bz + pz) && hasLOS(g, ax - px, az - pz, bx - px, bz - pz);
}

// ------------------------------------------------------------------ A*
export function findPath(g, ax, az, bx, bz) {
  if (g.customPath) {   // map-supplied pathfinder: memoize by 1-unit start/goal cells (bots share spawns and goals), shared across rooms of the same map
    const cp = g.customPath, C = cp._c || (cp._c = new Map()), key = Math.round(ax) + ',' + Math.round(az) + '>' + Math.round(bx) + ',' + Math.round(bz);
    if (C.has(key)) return C.get(key);
    const r = cp(ax, az, bx, bz); if (C.size > 600) C.clear(); C.set(key, r); return r;
  }
  const nav = navOf(g), W = g.w;
  const s = snapFree(g, nav, cxOf(g, ax), czOf(g, az)), e = snapFree(g, nav, cxOf(g, bx), czOf(g, bz));
  if (!s || !e) return null;
  const sIdx = s[1] * W + s[0], eIdx = e[1] * W + e[0];
  const st = ++nav.stamp, { mark, gs, parent, closed } = nav;
  const heap = []; // [f, idx]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hF = (i) => { const dx = Math.abs((i % W) - e[0]), dz = Math.abs(((i / W) | 0) - e[1]); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
  mark[sIdx] = st; gs[sIdx] = 0; parent[sIdx] = -1; push(hF(sIdx), sIdx);
  let found = false;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur] === st) continue;
    closed[cur] = st;
    if (cur === eIdx) { found = true; break; }
    const cx = cur % W, cz = (cur / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const ni = nz * W + nx;
      if (!nav.free[ni] || closed[ni] === st) continue;
      if (dx && dz && (!nav.free[cz * W + nx] || !nav.free[nz * W + cx])) continue; // no corner cutting
      const cost = gs[cur] + (dx && dz ? 1.4142 : 1) + (nav.near[ni] ? 0.35 : 0);
      if (mark[ni] !== st || cost < gs[ni]) { mark[ni] = st; gs[ni] = cost; parent[ni] = cur; push(cost + hF(ni), ni); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = eIdx; i !== -1; i = parent[i]) cells.push({ x: cenX(g, i % W), z: cenZ(g, (i / W) | 0) });
  cells.reverse();
  // string pulling
  const out = []; let a = { x: ax, z: az }, i = 0;
  if (!freeCircle(g, ax, az, 0.2)) a = cells[0];
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !lineClear(g, a.x, a.z, cells[j].x, cells[j].z)) j--;
    out.push(cells[j]); a = cells[j]; i = j + 1;
  }
  return out;
}

// ------------------------------------------------------------------ bot creation
export function createBot(o = {}) {
  const difficulty = DIFFICULTY[o.difficulty] ? o.difficulty : DEFAULT_DIFFICULTY;
  const id = o.id ?? ('bot' + (++_uid));
  let seed = o.seed; if (seed == null) { seed = 1234567; for (const ch of String(id)) seed = (seed * 31 + ch.charCodeAt(0)) | 0; }
  const bot = {
    id, name: o.name || id, team: o.team || 'CT', role: o.role || 'auto', difficulty, d: DIFFICULTY[difficulty], isBot: true,
    x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, yaw: o.yaw ?? 0, pitch: 0, radius: RADIUS,
    hp: 100, maxHp: 100, alive: true,
    weapons: (o.weapons || ['pistol', 'machinegun', 'sniper']).slice(),
    rng: mulberry32(seed),
  };
  Brain.initBot(bot, o.persona || Brain.PERSONA_ORDER[(_persona++) % 4]);
  resetBot(bot, bot);
  return bot;
}
export function resetBot(bot, sp = {}) {
  if (sp.x != null) { bot.x = sp.x; bot.y = sp.y ?? 0; bot.z = sp.z; }
  if (sp.yaw != null) bot.yaw = sp.yaw;
  bot.hp = bot.maxHp; bot.alive = true; bot.pitch = 0;
  bot.ammo = {}; for (const w of bot.weapons) bot.ammo[w] = WEAPONS[w].mag;
  bot.weapon = bot.weapons.includes('sniper') ? 'sniper' : bot.weapons.includes('machinegun') ? 'machinegun' : bot.weapons[0];
  bot.cooldown = 0; bot.reloadT = 0; bot.switchT = 0; bot.lastSwitch = -9; bot.scopeT = 0; bot.scoped = false; bot.reloading = false;
  bot.state = 'idle'; bot.path = null; bot.pi = 0; bot.pathGoal = null; bot.repathT = 0;
  bot.speed = 0; bot.moving = false; bot.vx = 0; bot.vz = 0;
  bot.target = null; bot.vis = []; bot.memory = null; bot.reactT = 0; bot.timeOnTarget = 0; bot.lostT = 99;
  bot.aimNoise = { yaw: 0, pitch: 0, t: 0 }; bot.aimHead = false; bot.burstN = 0; bot.burstT = 0;
  bot.cover = null; bot.coverCool = 0; bot.engageT = 0; bot.openFightLimit = 0;
  bot.planting = 0; bot.defusing = 0; bot.stuckT = 0; bot.sidestep = 0; bot.strafeDir = 1; bot.strafeT = 0;
  bot.wp = null; bot.waitT = 0; bot.lookPhase = bot.rng() * 6.28; bot.hitT = -9; bot.firedAt = -9; bot.hold = null; bot.investT = 0;
  bot.lastX = bot.x; bot.lastZ = bot.z; bot.stuckCheck = 0;
  Brain.resetBotBrain(bot);
}
export function newRound(world) { world._brain = null; Brain.newRound(world); }

export function damageBot(bot, dmg, fromX, fromZ, headshot = false) {
  if (!bot.alive) return false;
  bot.hp -= dmg; bot.hitT = (bot._now || 0);
  if (bot.hp <= 0) { bot.hp = 0; bot.alive = false; bot.state = 'dead'; bot.planting = 0; bot.defusing = 0; return true; }
  if (fromX != null && bot.d) {
    const e = 3.5 * (1.1 - Math.min(1, bot.d.hear * 0.7));
    bot.memory = { x: fromX + (bot.rng() - 0.5) * e, z: fromZ + (bot.rng() - 0.5) * e, t: bot._now || 0, src: 'hit' };
    bot.hitReact = true; bot._world = bot._world || null; Brain.noteHit(bot, fromX, fromZ);
  }
  return false;
}
// HEARING. kind: 'shot' (gunshots, default), 'step' (footsteps), 'bomb' (plant/defuse/beep). Chance to notice falls with
// distance: p = hear * (1 - (d / (radius * hearR))^1.4); beyond radius*hearR nothing is heard. Louder = further.
// The bot remembers the (blurred) spot, and the personality decides whether to turn, push, rotate, flank or ignore it.
export function emitSound(bots, x, z, radius, team, kind = 'shot') {
  for (const b of bots) {
    if (!b.alive || b.team === team) continue;
    const d = Math.hypot(b.x - x, b.z - z), R = radius * (b.d.hearR || 1);
    if (d > R) continue;
    const p = b.d.hear * (1 - Math.pow(d / R, 1.4)) * (kind === 'step' ? 0.85 : 1);
    if (b.rng() > p) continue;
    const e = 1 + d * 0.12 * (kind === 'step' ? 1.4 : 1);
    const now = b._now || 0, m = b.memory;
    if (m && m.src === 'seen' && now - m.t < 2) continue;
    if (m && m.src === 'heard' && now - m.t < 1.0 && Math.hypot(m.x - b.x, m.z - b.z) < d) continue; // already tracking a closer noise
    b.memory = { x: x + (b.rng() - 0.5) * e, z: z + (b.rng() - 0.5) * e, t: now, src: 'heard', kind, d };
    Brain.noteHeard(b, x, z, d, now);
    if (b.state === 'idle' || b.state === 'hold' || b.state === 'check') b.hearT = now;
  }
}
// footsteps for a moving player/bot: call each frame with its ground speed (walk <= 2.5 m/s is silent)
export function footstepNoise(bots, ent, speed, dt) {
  if (speed < 3.0) { ent._stepT = 0; return; }
  ent._stepT = (ent._stepT || 0) - dt;
  if (ent._stepT <= 0) { ent._stepT = speed > 5.5 ? 0.3 : 0.45; emitSound(bots, ent.x, ent.z, 7 + speed * 2.2, ent.team, 'step'); }
}

// ------------------------------------------------------------------ helpers
function emit(world, bot, name, data) { if (world.onBotEvent) world.onBotEvent(bot, name, data); }
function brainOf(world, rnd) {
  if (!world._brain) {
    const sites = world.sites || [];
    world._brain = { t: 0, targetSite: sites.length ? sites[Math.floor(rnd() * sites.length)].id : null, defuserId: null, hold: {}, planterId: null };
  }
  return world._brain;
}
function siteById(world, id) { return (world.sites || []).find((s) => s.id === id) || (world.sites || [])[0]; }
function enemiesOf(bot, bots, world) {
  const out = [];
  for (const b of bots) if (b.alive && b.team !== bot.team && b !== bot) out.push(b);
  if (world.players) for (const p of world.players) if (p.alive !== false && p.team !== bot.team) out.push(p);
  return out;
}
function randomFreeCellNear(g, rnd, cx, cz, rMin, rMax, tries = 30, needLOS = null) {
  const nav = navOf(g);
  for (let k = 0; k < tries; k++) {
    const a = rnd() * 6.283, r = rMin + rnd() * (rMax - rMin);
    const ix = cxOf(g, cx + Math.cos(a) * r), iz = czOf(g, cz + Math.sin(a) * r);
    if (ix < 0 || iz < 0 || ix >= g.w || iz >= g.h || !nav.free[iz * g.w + ix]) continue;
    const x = cenX(g, ix), z = cenZ(g, iz);
    if (g.heightAt) { const h0 = g.heightAt(cx, cz), h = g.heightAt(x, z); if (isFinite(h0) && (!isFinite(h) || Math.abs(h - h0) > 1.0)) continue; }
    if (needLOS && !hasLOS(g, x, z, needLOS.x, needLOS.z)) continue;
    return { x, z };
  }
  return null;
}
function tryMove(g, bot, dx, dz) {
  const nx = bot.x + dx, nz = bot.z + dz;
  const hOk = (x, z) => { if (!g.heightAt) return true; const h = g.heightAt(x, z); return isFinite(h) && Math.abs(h - bot.y) <= (g.stepMax || 0.7); };
  if (freeCircle(g, nx, bot.z, RADIUS - 0.02) && hOk(nx, bot.z)) bot.x = nx;
  if (freeCircle(g, bot.x, nz, RADIUS - 0.02) && hOk(bot.x, nz)) bot.z = nz;
}
function turnTo(bot, desired, rate, dt) {
  const d = angDiff(bot.yaw, desired), m = rate * dt;
  bot.yaw += clamp(d, -m, m);
  bot.yaw = ((bot.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

// Move along bot.path toward goal. returns true when arrived.
function goTo(bot, world, gx, gz, dt, speedMul = 1, arrive = 0.6) {
  const g = world.grid;
  const dGoal = Math.hypot(gx - bot.x, gz - bot.z);
  if (dGoal < arrive) { bot.path = null; return true; }
  bot.repathT -= dt;
  if (!bot.path || !bot.pathGoal || Math.hypot(bot.pathGoal.x - gx, bot.pathGoal.z - gz) > 1.5 || bot.repathT <= 0 && bot.pi >= bot.path.length) {
    if (world._pb !== undefined && world._pb <= 0) { if (!bot.path) return false; }   // path budget used up this tick: keep the old path (or wait one tick), repath on a later tick
    else {
    if (world._pb !== undefined) world._pb--;
    bot.path = findPath(g, bot.x, bot.z, gx, gz); bot.pi = 0; bot.pathGoal = { x: gx, z: gz }; bot.repathT = 1.5;
    if (!bot.path) { bot.pathGoal = null; return false; }
    }
  }
  while (bot.pi < bot.path.length && Math.hypot(bot.path[bot.pi].x - bot.x, bot.path[bot.pi].z - bot.z) < 0.35) bot.pi++;
  if (bot.pi >= bot.path.length) { bot.path = null; return dGoal < arrive + 1.2; }
  const wp = bot.path[bot.pi];
  moveToward(bot, g, wp.x, wp.z, dt, speedMul);
  return false;
}
function moveToward(bot, g, tx, tz, dt, speedMul = 1, sideDir = 0) {
  let dx = tx - bot.x, dz = tz - bot.z; const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  let vx = dx, vz = dz;
  if (sideDir) { vx = dx * 0.35 - dz * sideDir; vz = dz * 0.35 + dx * sideDir; const l = Math.hypot(vx, vz); vx /= l; vz /= l; }
  if (bot.sidestep > 0) { vx = -dz; vz = dx; }
  const sp = bot.d.speed * speedMul;
  tryMove(g, bot, vx * sp * dt, vz * sp * dt);
  bot._mvx = vx * sp; bot._mvz = vz * sp; bot._moved = true;
}

// ------------------------------------------------------------------ perception (no wallhacks: LOS + FOV + range only)
function perceive(bot, bots, world, now) {
  const g = world.grid, d = bot.d, eyeX = bot.x, eyeZ = bot.z;
  const vis = [];
  const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
  for (const e of enemiesOf(bot, bots, world)) {
    const dx = e.x - eyeX, dz = e.z - eyeZ, dist = Math.hypot(dx, dz);
    if (dist > d.view) continue;
    const cosA = (dx * fx + dz * fz) / (dist || 1);
    const inFov = dist < 2.0 || cosA > Math.cos(d.fov * Math.PI / 360);
    if (!inFov) continue;
    if (!seeLOS(g, eyeX, eyeZ, e.x, e.z)) continue;
    if (world.los && !world.los(bot, e)) continue;
    vis.push({ e, dist });
  }
  vis.sort((a, b) => a.dist - b.dist);
  bot.vis = vis;
  const prev = bot.target;
  if (vis.length) {
    // stick with current target while visible
    let pick = vis[0];
    if (prev) { const same = vis.find((v) => v.e === prev.e); if (same && same.dist < pick.dist * 1.6) pick = same; }
    if (!prev || prev.e !== pick.e) {
      if (bot.lostT > 1.0 || !prev || prev.e !== pick.e) { bot.reactT = d.reaction * Brain.reactMul(bot, pick.e, pick.dist, now); bot.timeOnTarget = 0; bot.aimHead = bot.rng() < d.headAim; bot.engageStart = { x: bot.x, z: bot.z }; emit(world, bot, 'spot', { enemy: pick.e.id }); }
    }
    // speed estimate
    const pe = pick.e, tp = prev && prev.e === pe ? prev : null;
    pick.speed = tp && tp.dt ? 0 : 0;
    bot.target = { e: pe, dist: pick.dist, px: tp ? tp.x : pe.x, pz: tp ? tp.z : pe.z, x: pe.x, z: pe.z };
    bot.lostT = 0; Brain.noteSeen(bot, pe, now);
    bot.memory = { x: pe.x, z: pe.z, t: now, src: 'seen' };
  } else {
    bot.lostT += bot._dt;
    if (bot.target && bot.lostT > 0.4) bot.target = null;
  }
}

// ------------------------------------------------------------------ weapon logic
function chooseWeapon(bot, dist, now, world) {
  const has = (w) => bot.weapons.includes(w);
  let want = bot.weapon;
  const mgOk = has('machinegun') && (bot.ammo.machinegun > 0 || bot.reloadT > 0 && bot.weapon === 'machinegun');
  if (has('sniper') && dist > 26 && bot.ammo.sniper > 0) want = 'sniper';
  else if (has('machinegun') && dist <= 26 && bot.ammo.machinegun > 0) want = 'machinegun';
  else if (has('pistol') && (!mgOk || dist < 3)) want = 'pistol';
  else if (has('sniper') && !has('machinegun') && dist > 10) want = 'sniper';
  else if (has('machinegun') && bot.ammo.machinegun > 0) want = 'machinegun';
  else if (has('pistol')) want = 'pistol';
  // sniper-only style bots keep the sniper at any range except point blank
  if (want !== bot.weapon && now - bot.lastSwitch > 1.2 && bot.reloadT <= 0 && bot.switchT <= 0) {
    bot.weapon = want; bot.lastSwitch = now; bot.switchT = 0.4; bot.scopeT = 0; bot.scoped = false; emit(world, bot, 'switch', { weapon: want });
  }
}
function startReloadIfNeeded(bot, world) {
  const w = WEAPONS[bot.weapon];
  if (bot.reloadT <= 0 && bot.ammo[bot.weapon] <= 0) { bot.reloadT = w.reload; bot.reloading = true; emit(world, bot, 'reload', { weapon: bot.weapon }); }
}

// ------------------------------------------------------------------ combat
function aimAndShoot(bot, bots, world, dt, now, moving) {
  const t = bot.target, d = bot.d, w = WEAPONS[bot.weapon];
  const e = t.e, dx = e.x - bot.x, dz = e.z - bot.z, dist = Math.hypot(dx, dz) || 0.01;
  // noise resample
  bot.aimNoise.t -= dt;
  if (bot.aimNoise.t <= 0) {
    const tspd = Math.hypot(e.x - (t.px ?? e.x), e.z - (t.pz ?? e.z)) / Math.max(dt, 0.001);
    const settle = 1 - 0.65 * Math.min(1, bot.timeOnTarget / 2.0);
    const sig = d.aimSigma * Brain.aimMul(bot, dist, moving, now) * settle * (1 + Math.min(1, (e._spd || 0) / 6) * 0.7) * (moving ? 1.35 : 1);
    bot.aimNoise.yaw = gauss(bot.rng) * sig; bot.aimNoise.pitch = gauss(bot.rng) * sig * 0.8; bot.aimNoise.t = 0.18 + bot.rng() * 0.1;
  }
  const aimY = (bot.aimHead && dist < 40) ? HEAD_Y - 0.06 : CHEST_Y;
  const ey = (e.y || 0) + aimY - (bot.y + EYE);
  const desYaw = yawTo(dx, dz) + bot.aimNoise.yaw;
  const desPitch = Math.atan2(ey, dist) + bot.aimNoise.pitch;
  turnTo(bot, desYaw, d.turn * Brain.turnMul(bot) * (bot.timeOnTarget < 0.3 ? 1 : 1.6), dt);
  bot.pitch += clamp(desPitch - bot.pitch, -d.turn * dt, d.turn * dt);
  bot.timeOnTarget += dt;
  if (bot.reactT > 0) { bot.reactT -= dt; return; }
  // scope handling
  if (w.scope > 0) { if (!moving) bot.scopeT = Math.min(w.scope + 0.1, bot.scopeT + dt); else bot.scopeT = 0; bot.scoped = bot.scopeT > 0.05; }
  if (bot.switchT > 0 || bot.reloadT > 0) return;
  if (bot.cooldown > 0) return;
  if (bot.burstT > 0) return;
  if (w.scope > 0 && bot.scopeT < w.scope) return;
  const aimErr = Math.abs(angDiff(bot.yaw, yawTo(dx, dz)));
  const tol = Math.atan(0.42 / dist) + 0.012;
  if (aimErr > tol * (bot.difficulty === 'easy' ? 3.2 : 2.0)) return;
  if (bot.ammo[bot.weapon] <= 0) { startReloadIfNeeded(bot, world); return; }
  // fire
  const spread = w.spread * (moving ? 1.8 : 1) * (1 + (w.auto ? Math.min(bot.burstN, 8) * 0.1 : 0));
  const yaw = bot.yaw + gauss(bot.rng) * spread * 0.6, pitch = bot.pitch + gauss(bot.rng) * spread * 0.6;
  const cp = Math.cos(pitch);
  const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  bot.ammo[bot.weapon]--; bot.cooldown = 1 / w.rate; bot.firedAt = now; bot.burstN++;
  if (w.auto && bot.burstN >= d.burst * (0.7 + bot.rng() * 0.6)) { bot.burstT = d.burstPause * (0.7 + bot.rng() * 0.6); bot.burstN = 0; }
  if (w.scope > 0) bot.scopeT = 0;
  if (world.shoot) world.shoot(bot, { x: bot.x, y: bot.y + EYE, z: bot.z }, dir, bot.weapon);
  emitSound(bots, bot.x, bot.z, w.noise, bot.team);
  startReloadIfNeeded(bot, world);
}

// find a cell near the bot that has no LOS to `from`
function findCover(bot, world, fromX, fromZ) {
  const g = world.grid, nav = navOf(g), rnd = bot.rng;
  let best = null, bestScore = 1e9;
  const R = 9, ix0 = cxOf(g, bot.x), iz0 = czOf(g, bot.z), r = Math.ceil(R / g.cell);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const ix = ix0 + dx, iz = iz0 + dz;
    if (ix < 0 || iz < 0 || ix >= g.w || iz >= g.h || !nav.free[iz * g.w + ix]) continue;
    const x = cenX(g, ix), z = cenZ(g, iz), dme = Math.hypot(x - bot.x, z - bot.z);
    if (dme > R) continue;
    const dEn = Math.hypot(x - fromX, z - fromZ);
    if (dEn < 4) continue;
    if (g.heightAt) { const h = g.heightAt(x, z); if (!isFinite(h) || Math.abs(h - bot.y) > 1.0) continue; }
    if (seeLOS(g, x, z, fromX, fromZ)) continue;
    // prefer cells next to a wall that are close to us and not further from our side
    const score = dme + (nav.near[iz * g.w + ix] ? -0.8 : 0) + rnd() * 1.5 + (dEn < Math.hypot(bot.x - fromX, bot.z - fromZ) ? 2 : 0);
    if (score < bestScore) { bestScore = score; best = { x, z }; }
  }
  return best;
}

const HELP = { findPath, freeCircle, cxOf, czOf, solidAt, hasLOS, raycastGrid, yawTo, turnTo, angDiff, goTo };
// ------------------------------------------------------------------ main per-bot think
function tickBot(bot, bots, world, dt, now, brain) {
  bot._now = now; bot._dt = dt; bot._moved = false; bot._mvx = 0; bot._mvz = 0;
  const g = world.grid, d = bot.d;
  bot.cooldown -= dt; bot.burstT -= dt; bot.switchT -= dt; bot.sidestep -= dt; bot.coverCool -= dt;
  if (bot.reloadT > 0) { bot.reloadT -= dt; if (bot.reloadT <= 0) { bot.ammo[bot.weapon] = WEAPONS[bot.weapon].mag; bot.reloading = false; } }
  const prevPlanting = bot.planting, prevDefusing = bot.defusing;
  perceive(bot, bots, world, now);
  if (bot.memory && now - bot.memory.t > 8) bot.memory = null;
  if (bot.target) { const e = bot.target.e; e._spd = Math.hypot(e.x - (bot.target.px ?? e.x), e.z - (bot.target.pz ?? e.z)) / Math.max(dt, 1e-3); bot.target.px = e.x; bot.target.pz = e.z; }

  const attack = world.isAttacker ? !!world.isAttacker(bot) : bot.team === (world.attackTeam || 'T');   // ffa3: the attacking side changes every round, so the room decides
  const bomb = world.bomb || { state: 'none' };
  const planted = bomb.state === 'planted';
  const visible = bot.vis.length > 0;
  const running = bot.cover && bot.cover.phase === 'run';
  let moving = false;

  if (visible && !running) {
    // ---------------- ENGAGE
    bot.state = 'engage'; bot.engageT += dt;
    brain.contact = { x: bot.target.e.x, z: bot.target.e.z, t: now, by: bot.team }; // team callout (only ever a spotted enemy)
    if (bot.planting) bot.planting = 0; if (bot.defusing) bot.defusing = 0;
    const t = bot.target, dist = t.dist;
    chooseWeapon(bot, dist, now, world);
    const w = WEAPONS[bot.weapon];
    // decide to take cover
    if (bot.coverCool <= 0 && !bot.cover) {
      const hurt = bot.hp < bot.maxHp * 0.55 || bot.reloadT > 0 || bot.engageT > d.patience;
      if (hurt && bot.rng() < d.coverBias) {
        const c = findCover(bot, world, t.e.x, t.e.z);
        if (c) { bot.cover = { phase: 'run', pos: c, peek: bot.engageStart || { x: bot.x, z: bot.z }, peeks: 0, until: 0, threat: { x: t.e.x, z: t.e.z } }; emit(world, bot, 'cover', {}); }
        else bot.coverCool = 2;
      } else bot.coverCool = 1.0;
    }
    if (bot.cover && bot.cover.phase === 'run') { /* handled next frame */ }
    // movement
    let moveMode = 'stand';
    if (w.scope > 0) moveMode = dist < 8 ? 'back' : 'stand';
    else if (dist > w.range * 0.7) moveMode = 'advance';
    else if (bot.rng() < 2) moveMode = 'strafe';
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) { bot.strafeDir = bot.rng() < 0.5 ? -1 : 1; bot.strafeT = 0.35 + bot.rng() * 0.9; bot.doStrafe = bot.rng() < d.strafe; }
    if (moveMode === 'advance') { moving = !goTo(bot, world, t.e.x, t.e.z, dt, 0.9, 3) || true; }
    else if (moveMode === 'back') {
      const dx = bot.x - t.e.x, dz = bot.z - t.e.z, l = Math.hypot(dx, dz) || 1;
      moveToward(bot, g, bot.x + dx / l * 2, bot.z + dz / l * 2, dt, 0.6); moving = true;
    } else if (moveMode === 'strafe' && bot.doStrafe && bot.reactT <= d.reaction * 0.3 && bot.switchT <= 0) {
      const dx = t.e.x - bot.x, dz = t.e.z - bot.z, l = Math.hypot(dx, dz) || 1;
      const sx = -dz / l * bot.strafeDir, sz = dx / l * bot.strafeDir;
      const close = dist < 5 ? -0.3 : (dist > 14 ? 0.3 : 0);
      tryMove(g, bot, (sx + dx / l * close) * d.speed * 0.6 * dt, (sz + dz / l * close) * d.speed * 0.6 * dt);
      moving = true; bot._moved = true;
    }
    aimAndShoot(bot, bots, world, dt, now, moving);
  } else if (bot.cover) {
    // ---------------- COVER (run / hide / peek)
    const c = bot.cover; bot.state = 'cover-' + c.phase;
    if (c.phase === 'run') {
      const arrived = goTo(bot, world, c.pos.x, c.pos.z, dt, 1.1, 0.5); moving = true;
      if (visible) { chooseWeapon(bot, bot.target.dist, now, world); aimAndShoot(bot, bots, world, dt, now, true); }
      if (arrived || bot.stuckT > 0.8) { c.phase = 'hide'; c.until = now + 0.8 + bot.rng() * 1.2 + Math.max(0, bot.reloadT); c.t0 = now; bot.path = null; }
    } else if (c.phase === 'hide') {
      bot.stuckT = 0;
      turnTo(bot, yawTo(c.threat.x - bot.x, c.threat.z - bot.z), d.turn * 0.6, dt);
      if (bot.reloadT <= 0 && bot.ammo[bot.weapon] < WEAPONS[bot.weapon].mag * 0.5 && bot.reloadT <= 0) { bot.reloadT = WEAPONS[bot.weapon].reload; bot.reloading = true; bot.ammo[bot.weapon] = Math.max(bot.ammo[bot.weapon], 0); }
      if (now >= c.until && bot.reloadT <= 0) { c.phase = 'peek'; c.t0 = now; c.arrivedAt = 0; }
    } else { // peek
      const arrived = goTo(bot, world, c.peek.x, c.peek.z, dt, 1.0, 0.6); moving = !arrived;
      if (arrived && !c.arrivedAt) c.arrivedAt = now;
      turnTo(bot, yawTo(c.threat.x - bot.x, c.threat.z - bot.z), d.turn * 0.8, dt);
      if (c.arrivedAt && now - c.arrivedAt > d.peekDur) {
        c.peeks++;
        if (c.peeks >= 2) { bot.cover = null; bot.coverCool = 3; bot.memory = bot.memory || { x: c.threat.x, z: c.threat.z, t: now, src: 'seen' }; }
        else { const alt = findCover(bot, world, c.threat.x, c.threat.z); if (alt) c.pos = alt; c.phase = 'run'; bot.path = null; }
      }
    }
    if (visible && c.phase !== 'run') { bot.cover = null; bot.coverCool = 2.5; }
  } else {
    bot.engageT = Math.max(0, bot.engageT - dt * 0.5);
    // ---------------- NON-COMBAT
    if (bot.hitReact) { bot.hitReact = false; bot.waitT = 0; bot.path = null; }
    if (Brain.think(bot, bots, world, dt, now, brain, HELP, attack, bomb, planted)) { moving = bot._moved; } else {
    let mem = bot.memory;
    if (mem && mem.src === 'heard' && !attack && !planted && world.sites && world.sites.length) {
      // defenders hold their site: they face a noise but do not chase it far from their post
      const st = siteById(world, bot.assigned) || world.sites[0];
      if (Math.hypot(mem.x - st.x, mem.z - st.z) > st.r + 6 || (bot._hrd !== mem && ((bot._hrd = mem), bot.rng() < 0.5))) { turnTo(bot, yawTo(mem.x - bot.x, mem.z - bot.z), d.turn * 0.5, dt); bot.memory = mem = null; }
    }
    if (mem && (mem.src === 'seen' || bot.rng() < 1) && !(bot.planting > 0 && mem.src === 'heard')) {
      // investigate
      bot.state = 'investigate'; moving = true;
      const arrived = goTo(bot, world, mem.x, mem.z, dt, 0.85, 1.2);
      if (arrived) {
        bot.investT += dt; moving = false;
        bot.yaw += Math.sin(now * 3 + bot.lookPhase) * dt * 2.2;
        if (bot.investT > 1.4) { bot.memory = null; bot.investT = 0; bot.path = null; }
      }
      if (bot.stuckT > 1) { bot.memory = null; }
    } else {
      objective(bot, bots, world, dt, now, brain, attack, bomb, planted);
      moving = bot._moved;
    }
    }
  }

  // plant/defuse progress sanity
  if (bot.state !== 'plant' && prevPlanting) bot.planting = 0;
  if (bot.state !== 'defuse' && prevDefusing) bot.defusing = 0;

  // face movement direction when walking without a target
  if (bot._moved && !bot.target && !bot.cover && !(bot.H && bot.H.phase === 'peek')) {
    const l = Math.hypot(bot._mvx, bot._mvz);
    if (l > 0.01) turnTo(bot, yawTo(bot._mvx, bot._mvz), d.turn * 0.9, dt);
    bot.pitch += (0 - bot.pitch) * Math.min(1, dt * 4);
  }
  if (!bot.target && bot.scoped) { bot.scoped = false; bot.scopeT = 0; }
  // stuck detection
  bot.stuckCheck += dt;
  if (bot.stuckCheck >= 0.5) {
    const moved = Math.hypot(bot.x - bot.lastX, bot.z - bot.lastZ);
    if (bot._moved && moved < 0.25 && !(bot.state === 'engage' && !moving)) { bot.stuckT += 0.5; if (bot.stuckT >= 1.0) { bot.path = null; bot.sidestep = 0.35; bot.repathT = 0; } }
    else bot.stuckT = Math.max(0, bot.stuckT - 0.5);
    bot.lastX = bot.x; bot.lastZ = bot.z; bot.stuckCheck = 0;
  }
  bot.moving = bot._moved; bot.speed = bot._moved ? Math.hypot(bot._mvx, bot._mvz) : 0;
}

function holdPointsFor(bot, world, brain, key, cx, cz, rMin, rMax, needLOS, n = 6) {
  if (!brain.hold[key]) {
    const pts = [];
    for (let i = 0; i < n; i++) { const p = randomFreeCellNear(world.grid, bot.rng, cx, cz, rMin, rMax, 40, needLOS); if (p) pts.push(p); }
    brain.hold[key] = pts;
  }
  return brain.hold[key];
}

function objective(bot, bots, world, dt, now, brain, attack, bomb, planted) {
  const g = world.grid, sites = world.sites || [];
  const idleSwing = () => { bot.yaw += Math.sin(now * 1.7 + bot.lookPhase) * dt * 1.2; };
  if (attack) {
    if (planted) {
      // post-plant: hold angles on the bomb
      bot.state = 'guard-bomb';
      if (!bot.hold || bot.hold.key !== 'pp') {
        const pts = holdPointsFor(bot, world, brain, 'pp' + bomb.site, bomb.x, bomb.z, 4, 12, { x: bomb.x, z: bomb.z }, 8);
        bot.hold = { key: 'pp', p: pts.length ? pts[Math.floor(bot.rng() * pts.length)] : { x: bomb.x, z: bomb.z } };
      }
      if (goTo(bot, world, bot.hold.p.x, bot.hold.p.z, dt, 0.9, 0.6)) { turnTo(bot, yawTo(bomb.x - bot.x, bomb.z - bot.z), bot.d.turn * 0.4, dt); idleSwing(); }
      return;
    }
    const carrying = bomb.state === 'carried' && bomb.carrierId === bot.id;
    const site = siteById(world, brain.targetSite);
    if (!site) { patrol(bot, world, dt, now); return; }
    if (carrying) {
      const dS = Math.hypot(bot.x - site.x, bot.z - site.z);
      if (dS > Math.max(0.8, site.r * 0.45)) { bot.state = 'to-site'; bot.planting = 0; goTo(bot, world, site.x, site.z, dt, 1.0, 0.5); }
      else {
        // calm check: don't plant with recent enemy memory
        if (bot.memory && now - bot.memory.t < 2.5) { bot.state = 'to-site'; bot.planting = 0; return; }
        bot.state = 'plant'; bot.planting = Math.min(1, (bot.planting || 0) + dt / PLANT_TIME);
        if (bot.planting === dt / PLANT_TIME) emit(world, bot, 'plantStart', { site: site.id });
        idleSwing();
        if (bot.planting >= 1) { bot.planting = 0; if (world.plant) world.plant(bot, site.id); }
      }
      return;
    }
    if (bomb.state === 'dropped') {
      // nearest living attacker picks it up
      let best = null, bd = 1e9; for (const b of bots) if (b.alive && b.team === bot.team) { const dd = Math.hypot(b.x - bomb.x, b.z - bomb.z); if (dd < bd) { bd = dd; best = b; } }
      if (best === bot) { bot.state = 'get-bomb'; if (goTo(bot, world, bomb.x, bomb.z, dt, 1.05, 0.9) || Math.hypot(bot.x - bomb.x, bot.z - bomb.z) < 1.1) { if (world.pickupBomb) world.pickupBomb(bot); } return; }
    }
    // escort: hold angles around the target site
    bot.state = 'escort';
    if (!bot.hold || bot.hold.key !== 'es' + site.id) {
      const pts = holdPointsFor(bot, world, brain, 'es' + site.id, site.x, site.z, 2, Math.max(7, site.r + 5), { x: site.x, z: site.z }, 8);
      bot.hold = { key: 'es' + site.id, p: pts.length ? pts[Math.floor(bot.rng() * pts.length)] : { x: site.x, z: site.z } };
    }
    if (goTo(bot, world, bot.hold.p.x, bot.hold.p.z, dt, 0.95, 0.7)) {
      bot.waitT += dt; idleSwing();
      if (bot.waitT > 3 + bot.rng() * 3) { bot.waitT = 0; bot.hold = null; }
    }
    return;
  }
  // ---------- defenders
  if (planted) {
    // pick / validate defuser
    const alive = bots.filter((b) => b.alive && b.team === bot.team);
    let df = alive.find((b) => b.id === brain.defuserId);
    if (!df) { let bd = 1e9; for (const b of alive) { const dd = Math.hypot(b.x - bomb.x, b.z - bomb.z) + (b.cover ? 10 : 0); if (dd < bd) { bd = dd; df = b; } } brain.defuserId = df ? df.id : null; }
    if (df === bot) {
      const dB = Math.hypot(bot.x - bomb.x, bot.z - bomb.z);
      if (dB > 1.3) { bot.state = 'to-bomb'; bot.defusing = 0; goTo(bot, world, bomb.x, bomb.z, dt, 1.1, 1.0); }
      else {
        bot.state = 'defuse'; const first = !bot.defusing; bot.defusing = Math.min(1, (bot.defusing || 0) + dt / DEFUSE_TIME);
        if (first) emit(world, bot, 'defuseStart', {});
        turnTo(bot, yawTo(bomb.x - bot.x, bomb.z - bot.z), 4, dt);
        if (bot.defusing >= 1) { bot.defusing = 0; if (world.defuse) world.defuse(bot); }
      }
    } else {
      bot.state = 'cover-defuser';
      if (!bot.hold || bot.hold.key !== 'cd') {
        const pts = holdPointsFor(bot, world, brain, 'cd' + bomb.site, bomb.x, bomb.z, 3, 10, { x: bomb.x, z: bomb.z }, 8);
        bot.hold = { key: 'cd', p: pts.length ? pts[Math.floor(bot.rng() * pts.length)] : { x: bomb.x, z: bomb.z } };
      }
      if (goTo(bot, world, bot.hold.p.x, bot.hold.p.z, dt, 1.0, 0.7)) { turnTo(bot, yawTo(bomb.x - bot.x, bomb.z - bot.z), bot.d.turn * 0.4, dt); idleSwing(); }
    }
    return;
  }
  // guard assigned site
  if (!sites.length) { patrol(bot, world, dt, now); return; }
  if (bot.assigned == null) { const idx = bots.filter((b) => b.team === bot.team).indexOf(bot); bot.assigned = sites[Math.max(0, idx) % sites.length].id; }
  if (brain.contact && brain.contact.by === bot.team && now - brain.contact.t > 1.5 && now - brain.contact.t < 25) {
    // rotate to the site the callout is closest to
    let bs = null, bd = 1e9; for (const st of sites) { const dd = Math.hypot(st.x - brain.contact.x, st.z - brain.contact.z); if (dd < bd) { bd = dd; bs = st; } }
    if (bs && bs.id !== bot.assigned && bd < 22) { bot.assigned = bs.id; bot.hold = null; }
  }
  const site = siteById(world, bot.assigned);
  bot.state = 'guard';
  const key = 'gd' + site.id;
  if (!bot.hold || bot.hold.key !== key) {
    const pts = holdPointsFor(bot, world, brain, key, site.x, site.z, 2, site.r + 5, { x: site.x, z: site.z }, 8);
    bot.hold = { key, p: pts.length ? pts[Math.floor(bot.rng() * pts.length)] : { x: site.x, z: site.z } };
  }
  if (goTo(bot, world, bot.hold.p.x, bot.hold.p.z, dt, 0.8, 0.7)) {
    bot.waitT += dt; idleSwing();
    if (bot.waitT > 2.5 + bot.rng() * 3.5) { bot.waitT = 0; bot.hold = null; }
  }
}

function patrol(bot, world, dt, now) {
  bot.state = 'patrol';
  if (!bot.wp) bot.wp = randomFreeCellNear(world.grid, bot.rng, bot.x, bot.z, 8, 30);
  if (!bot.wp) return;
  if (goTo(bot, world, bot.wp.x, bot.wp.z, dt, 0.8, 0.7)) { bot.waitT += dt; bot.yaw += Math.sin(now * 2) * dt; if (bot.waitT > 1.5) { bot.waitT = 0; bot.wp = null; } }
}

// automatic sounds: human footsteps (from position delta unless world.players[i]._spd is set), planted-bomb beeps, plant/defuse
function autoSounds(bots, dt, world, brain) {
  for (const p of world.players || []) {
    if (p.alive === false) continue;
    if (p._lx != null && dt > 0) { const sp = p._spd != null && p._spd > 0 ? p._spd : Math.hypot(p.x - p._lx, p.z - p._lz) / dt; footstepNoise(bots, p, Math.min(sp, 9), dt); }
    p._lx = p.x; p._lz = p.z;
  }
  const bm = world.bomb;
  if (bm && bm.state === 'planted') { brain.beepT = (brain.beepT || 0) - dt; if (brain.beepT <= 0) { brain.beepT = 1.0; emitSound(bots, bm.x, bm.z, 40, world.attackTeam || 'T', 'bomb'); } }
  for (const b of bots) if (b.alive && (b.planting > 0 || b.defusing > 0)) { b._wt = (b._wt || 0) - dt; if (b._wt <= 0) { b._wt = 0.7; emitSound(bots, b.x, b.z, 18, b.team, 'bomb'); } }
}

// ------------------------------------------------------------------ public update
export function update(bots, dt, world) {
  dt = Math.min(dt, 0.1);
  const rnd = world.rng || Math.random;
  const brain = brainOf(world, rnd);
  brain.t += dt;
  world._pb = 1;   // at most one A* search per room per tick (CPU spikes on the small server)
  autoSounds(bots, dt, world, brain);
  for (const b of bots) b._world = world;
  // separation so bots don't stack
  for (const a of bots) {
    if (!a.alive) continue;
    for (const b of bots) {
      if (a === b || !b.alive) continue;
      const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.5 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (0.7 - d) * 0.5 * Math.min(1, dt * 8); tryMove(world.grid, a, dx / d * p, dz / d * p); }
    }
  }
  const n = bots.length, off = (brain.frame = ((brain.frame || 0) + 1) % Math.max(1, n)); // rotate order so nobody always shoots first
  for (let i = 0; i < n; i++) { const b = bots[(i + off) % n]; if (b.alive) tickBot(b, bots, world, dt, brain.t, brain); }
}
