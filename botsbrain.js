// botsbrain.js - "human" behaviour layer for the Sniper Chill bots. Self-contained ES module, no imports, no DOM, no Three.js.
// Plugs into botsai.js through a handful of hooks (see INTEGRATION.md). It never cheats: bots only learn where
// enemies are from what they SEE, HEAR or get HIT by, plus an optional spawn hint (where enemies start the round).
//
// What it adds
//  - 4 personalities (aggressive / anchor / lurker / rotator), each with its own pace, hold times, peek style,
//    preferred zone, reaction and aim feel, and reaction to sounds.
//  - Random, endless route variety: targets are sampled around a zone, scored (heat = where enemies were met before,
//    LOS onto those places, wall cover, teammates, how often the spot was used recently) and picked with randomness;
//    long trips get 1-2 random via-points so two bots (or the same bot twice) rarely take the same path.
//  - Hold / peek: bots hold an angle, sweep their view over the hot angles with jittered dwell times, shoulder-peek
//    (step out 1-1.4 m, look, step back), pause mid-route to check corners.
//  - Rotation on sound: depending on personality a bot pushes the sound, rotates to the other site, flanks, only
//    glances, or ignores it.
//  - Human-like variance: per-bot skill draw + per-engagement "form" for reaction time and aim, faster reaction when
//    the bot was already holding the angle the enemy appears in, slower when caught moving / looking away.
export const PERSONAS = {
  aggressive: { speed: 1.0, holdMin: 0.8, holdMax: 2.6, dwell: [0.5, 1.4], peek: 0.85, wide: 0.55, via: 0.75, heatW: 1.3, coverW: 0.15, siteW: 0.3, pause: 0.12, soundRange: 60, sound: 'push', react: 0.9, aim: 1.1, turn: 1.15, retarget: 0.9 },
  anchor:     { speed: 0.8, holdMin: 4.0, holdMax: 10,  dwell: [1.2, 3.2], peek: 0.35, wide: 0.03, via: 0.25, heatW: 0.6, coverW: 1.1, siteW: 0.8, pause: 0.35, soundRange: 16, sound: 'look', react: 1.0, aim: 0.85, turn: 0.9, retarget: 0.45 },
  lurker:     { speed: 0.68, holdMin: 5.0, holdMax: 14, dwell: [1.6, 3.6], peek: 0.45, wide: 0.15, via: 0.95, heatW: 0.25, coverW: 0.9, siteW: 0.7, pause: 0.45, soundRange: 50, sound: 'flank', react: 1.1, aim: 0.95, turn: 1.0, retarget: 0.8 },
  rotator:    { speed: 0.92, holdMin: 1.6, holdMax: 4.8, dwell: [0.8, 2.0], peek: 0.5, wide: 0.2, via: 0.65, heatW: 0.9, coverW: 0.5, siteW: 0.6, pause: 0.25, soundRange: 45, sound: 'rotate', react: 1.0, aim: 1.0, turn: 1.05, retarget: 0.85, rotEvery: [11, 24] },
};
export const PERSONA_ORDER = ['anchor', 'aggressive', 'rotator', 'lurker'];

const CELL = 4;
const TAU = Math.PI * 2;
const R = (rng, a, b) => a + (rng() - 0.5 + 0.5) * (b - a);
const gaussR = (rng) => (rng() + rng() + rng() + rng() - 2) * 1.7;
const pickW = (rng, arr, wf) => { let t = 0; for (const a of arr) t += wf(a); let r = rng() * t; for (const a of arr) { r -= wf(a); if (r <= 0) return a; } return arr[arr.length - 1]; };

// ------------------------------------------------------------------ per-bot init
export function initBot(bot, persona) {
  const rng = bot.rng;
  const p = PERSONAS[persona] ? persona : PERSONA_ORDER[Math.floor(rng() * 4)];
  bot.persona = p; bot.P = PERSONAS[p];
  bot.H = {
    rng, ph: rng() * TAU, phase: 'choose', route: [], ri: 0, spot: null, zoneSite: null, holdT: 0, dwellT: 0, angles: [], ai: 0, look: null,
    peek: null, hist: [], lastVia: null, pauseT: 0, noPathT: 0, rotAt: 0, glance: null, delay: 0, form: 1, formT: 0, aimForm: 1, aimFormT: 0,
    skillReact: Math.exp(gaussR(rng) * 0.22), skillAim: Math.exp(gaussR(rng) * 0.18), react: null, restT: 0,
  };
}
export function resetBotBrain(bot) { if (bot.H) { const H = bot.H; H.phase = 'choose'; H.route = []; H.ri = 0; H.spot = null; H.peek = null; H.glance = null; H.react = null; H.delay = 0; H.rotAt = 0; H.pauseT = 0; H.noPathT = 0; } }

// ------------------------------------------------------------------ team memory (heat map of where enemies are met)
function state(world, X) {
  let S = world._hb;
  if (!S) { S = world._hb = { heat: { T: new Map(), CT: new Map() }, visits: new Map(), seeded: {}, decayT: 0, seenGate: new Map(), contacts: 0 }; }
  return S;
}
function keyOf(g, x, z) { return Math.floor((x - g.ox) / CELL) + ',' + Math.floor((z - g.oz) / CELL); }
function deposit(world, team, x, z, w) {
  const S = state(world), g = world.grid, m = S.heat[team] || (S.heat[team] = new Map()), k = keyOf(g, x, z), e = m.get(k);
  if (!e) m.set(k, { x, z, w }); else { e.x = (e.x * e.w + x * w) / (e.w + w); e.z = (e.z * e.w + z * w) / (e.w + w); e.w += w; }
}
export function hotPoints(world, team, n = 6) {
  const m = state(world).heat[team]; if (!m) return [];
  return [...m.values()].filter((e) => e.w > 0.05).sort((a, b) => b.w - a.w).slice(0, n);
}
function heatAt(world, team, x, z) { const m = state(world).heat[team], e = m && m.get(keyOf(world.grid, x, z)); return e ? e.w : 0; }
function seed(world, team, X) {
  const S = state(world); if (S.seeded[team] || !world.enemyHint) return; S.seeded[team] = 1;
  const hints = Array.isArray(world.enemyHint) ? world.enemyHint : [world.enemyHint];
  for (const h of hints) for (const st of (world.sites || [])) {
    const path = X.findPath(world.grid, h.x, h.z, st.x, st.z); if (!path) continue;
    let a = { x: h.x, z: h.z };
    for (const b of path) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.floor(d / 3)); for (let i = 1; i <= n; i++) deposit(world, team, a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, 0.35); a = b; }
  }
}
// hooks the AI calls ------------------------------------------------------
export function noteSeen(bot, e, now, X) {
  const w = bot._world; if (!w) return; const S = state(w), id = bot.team + (e.id || ''), last = S.seenGate.get(id) || -9;
  if (now - last < 0.6) return; S.seenGate.set(id, now); S.contacts++;
  deposit(w, bot.team, e.x, e.z, 1);
}
export function noteHeard(bot, x, z, dist, now) { const w = bot._world; if (w) deposit(w, bot.team, x, z, 0.3); }
export function noteHit(bot, x, z) { const w = bot._world; if (w && x != null) deposit(w, bot.team, x, z, 0.6); }
export function newRound(world) {
  const S = world._hb; if (!S) return;
  for (const t of ['T', 'CT']) { const m = S.heat[t]; for (const [k, e] of m) { e.w *= 0.65; if (e.w < 0.05) m.delete(k); } }
  for (const [k, v] of S.visits) { if (v < 0.4) S.visits.delete(k); else S.visits.set(k, v * 0.5); }
  S.seenGate.clear();
}
function decay(world, now) {
  const S = state(world); if (now - S.decayT < 2) return; const f = Math.exp(-(now - S.decayT) / 70); S.decayT = now;
  for (const t of ['T', 'CT']) { const m = S.heat[t]; for (const [k, e] of m) { e.w *= f; if (e.w < 0.03) m.delete(k); } }
}

// ------------------------------------------------------------------ human variance
export function reactMul(bot, e, dist, now) {
  const H = bot.H; if (!H) return 0.75 + bot.rng() * 0.5;
  if (now - H.formT > 4 + H.rng() * 5) { H.formT = now; const r = H.rng(); H.form = r < 0.1 ? 1.7 : r < 0.2 ? 0.6 : 0.85 + H.rng() * 0.4; }
  // prepared (holding / facing that way) vs caught off guard
  const bearing = Math.atan2(-(e.x - bot.x), -(e.z - bot.z)); let d = Math.abs(((bearing - bot.yaw) % TAU + TAU + Math.PI) % TAU - Math.PI);
  const prep = H.phase === 'hold' ? (d < 0.45 ? 0.72 : 1.0) : (bot.moving ? (d < 0.6 ? 0.95 : 1.3) : 1.0);
  return bot.P.react * H.skillReact * H.form * prep * (1 + dist / 140) * (0.8 + H.rng() * 0.4);
}
export function aimMul(bot, dist, moving, now) {
  const H = bot.H; if (!H) return 1;
  if (now - H.aimFormT > 1.2 + H.rng() * 1.6) { H.aimFormT = now; const r = H.rng(); H.aimForm = r < 0.07 ? 2.2 : r < 0.2 ? 0.55 : 0.85 + H.rng() * 0.35; }
  return bot.P.aim * H.skillAim * H.aimForm * (1 + Math.min(1, dist / 80) * 0.25);
}
export function turnMul(bot) { return bot.P ? bot.P.turn : 1; }

// ------------------------------------------------------------------ spot / route selection
function freeAt(g, X, bot, x, z, refH) {
  if (x < g.ox + 1 || z < g.oz + 1 || x > g.ox + g.w * g.cell - 1 || z > g.oz + g.h * g.cell - 1) return false;
  if (!X.freeCircle(g, x, z, 0.5)) return false;
  if (g.heightAt && refH != null) { const h = g.heightAt(x, z); if (!isFinite(h) || Math.abs(h - refH) > 1.0) return false; }
  return true;
}
function wallCount(g, X, x, z) { let n = 0; const ix = X.cxOf(g, x), iz = X.czOf(g, z); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (X.solidAt(g, ix + dx, iz + dz)) n++; return n; }
function sampleAround(g, X, bot, cx, cz, rMin, rMax, tries, refH) {
  const out = [];
  for (let i = 0; i < tries; i++) {
    const a = bot.rng() * TAU, r = rMin + bot.rng() * (rMax - rMin), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (freeAt(g, X, bot, x, z, refH)) out.push({ x, z });
  }
  return out;
}
function pickSpot(bot, world, X, c, rMin, rMax, bots) {
  const g = world.grid, P = bot.P, H = bot.H, S = state(world);
  const refH = g.heightAt ? g.heightAt(c.x, c.z) : null;
  const cands = sampleAround(g, X, bot, c.x, c.z, rMin, rMax, 40, isFinite(refH) ? refH : null);
  if (!cands.length) return null;
  const hot = hotPoints(world, bot.team, 5), sites = world.sites || [];
  const mates = bots.filter((b) => b !== bot && b.alive && b.team === bot.team);
  let wsum = 0; for (const h of hot) wsum += h.w; wsum = wsum || 1;
  for (const s of cands) {
    let view = 0; for (const h of hot) if (Math.hypot(h.x - s.x, h.z - s.z) < 60 && X.hasLOS(g, s.x, s.z, h.x, h.z)) view += h.w / wsum;
    let sv = 0; for (const st of sites) if (Math.hypot(st.x - s.x, st.z - s.z) < 40 && X.hasLOS(g, s.x, s.z, st.x, st.z)) sv = 1;
    const cover = Math.min(4, wallCount(g, X, s.x, s.z)) / 4;
    let pen = (S.visits.get(keyOf(g, s.x, s.z)) || 0) * 1.1;
    for (const k of H.hist) if (Math.hypot(k.x - s.x, k.z - s.z) < 3) pen += 1.2;
    for (const m of mates) { const ms = m.H && m.H.spot; if (ms && Math.hypot(ms.x - s.x, ms.z - s.z) < 4) pen += 1.5; if (Math.hypot(m.x - s.x, m.z - s.z) < 2) pen += 0.6; }
    const dme = Math.hypot(s.x - bot.x, s.z - bot.z);
    s.score = P.heatW * view * 2 + P.siteW * sv + P.coverW * cover - pen - dme / 60 + bot.rng() * 1.1;
  }
  cands.sort((a, b) => b.score - a.score);
  const top = cands.slice(0, 4);
  return pickW(bot.rng, top, (s) => 0.2 + Math.max(0, s.score - top[top.length - 1].score + 0.3));
}
function zoneCenter(bot, world, X, brain, attack, bots) {
  const sites = world.sites || [], P = bot.P, H = bot.H, rng = bot.rng, g = world.grid;
  const byId = (id) => sites.find((s) => s.id === id) || sites[0];
  if (!H.zoneSite) {
    if (attack && brain && brain.targetSite) H.zoneSite = brain.targetSite;
    else { const idx = Math.max(0, bots.filter((b) => b.team === bot.team).indexOf(bot)); H.zoneSite = bot.assigned || sites[idx % sites.length].id; }
  }
  if (attack && brain && brain.targetSite && bot.persona !== 'rotator') H.zoneSite = brain.targetSite;
  bot.assigned = H.zoneSite;
  const site = byId(H.zoneSite), hot = hotPoints(world, bot.team, 8).filter((h) => Math.hypot(h.x - site.x, h.z - site.z) < 45);
  if (bot.persona === 'aggressive' && hot.length && rng() < 0.8) { const h = pickW(rng, hot, (e) => e.w); return { x: h.x, z: h.z, rMin: 0, rMax: 7 }; }
  if (bot.persona === 'lurker') {
    const cs = sampleAround(g, X, bot, site.x, site.z, 12, 34, 8, null);
    if (cs.length) { cs.sort((a, b) => heatAt(world, bot.team, a.x, a.z) - heatAt(world, bot.team, b.x, b.z) + (rng() - 0.5) * 0.6); return { x: cs[0].x, z: cs[0].z, rMin: 0, rMax: 5 }; }
  }
  return { x: site.x, z: site.z, rMin: 2, rMax: site.r + 6 };
}
function buildRoute(bot, world, X, target, bots) {
  const g = world.grid, H = bot.H, P = bot.P, rng = bot.rng, d = Math.hypot(target.x - bot.x, target.z - bot.z), route = [];
  const refH = g.heightAt ? g.heightAt(bot.x, bot.z) : null;
  const nVia = d > 14 && rng() < P.via ? (d > 32 && rng() < 0.45 ? 2 : 1) : 0;
  let a = { x: bot.x, z: bot.z };
  for (let v = 0; v < nVia; v++) {
    const t = (v + 1) / (nVia + 1), mx = a.x + (target.x - a.x) * (nVia === 1 ? 0.5 : 0.45), mz = a.z + (target.z - a.z) * (nVia === 1 ? 0.5 : 0.45);
    const dd = Math.hypot(target.x - a.x, target.z - a.z) || 1, px = -(target.z - a.z) / dd, pz = (target.x - a.x) / dd;
    let best = null, bs = -1e9;
    for (let i = 0; i < 7; i++) {
      const off = (rng() * 2 - 1) * Math.min(12, dd * 0.45), x = mx + px * off, z = mz + pz * off;
      if (!freeAt(g, X, bot, x, z, isFinite(refH) ? refH : null)) continue;
      if (Math.hypot(x - a.x, z - a.z) + Math.hypot(target.x - x, target.z - z) > dd * 1.6) continue;
      const h = heatAt(world, bot.team, x, z);
      const sc = (bot.persona === 'lurker' ? -h : bot.persona === 'aggressive' ? h * 0.5 : 0) + rng() * 1.2 - (H.lastVia && Math.hypot(H.lastVia.x - x, H.lastVia.z - z) < 4 ? 1.2 : 0);
      if (sc > bs) { bs = sc; best = { x, z, via: true }; }
    }
    if (best) { route.push(best); H.lastVia = best; a = best; }
  }
  route.push({ x: target.x, z: target.z });
  return route;
}

// ------------------------------------------------------------------ hold angles + head control
function computeAngles(bot, world, X, spot) {
  const g = world.grid, rng = bot.rng, out = [];
  const hot = hotPoints(world, bot.team, 6), sites = world.sites || [];
  const pts = hot.map((h) => ({ x: h.x, z: h.z, w: h.w })).concat(sites.map((s) => ({ x: s.x, z: s.z, w: 0.4 })));
  for (const p of pts) if (Math.hypot(p.x - spot.x, p.z - spot.z) > 2 && X.hasLOS(g, spot.x, spot.z, p.x, p.z)) out.push({ yaw: X.yawTo(p.x - spot.x, p.z - spot.z), w: p.w });
  // probe the open directions too (so an unlearned map still gets sensible angles)
  for (let i = 0; i < 12; i++) { const yaw = rng() * TAU, d = X.raycastGrid(g, spot.x, spot.z, -Math.sin(yaw), -Math.cos(yaw), 40); if (d > 9) out.push({ yaw, w: 0.15 + Math.min(d, 40) / 200 }); }
  out.sort((a, b) => b.w - a.w);
  const res = []; for (const a of out) { if (res.every((r) => Math.abs(X.angDiff(r.yaw, a.yaw)) > 0.35)) res.push(a); if (res.length >= 4) break; }
  return res.length ? res : [{ yaw: bot.yaw, w: 1 }];
}
function head(bot, X, yaw, dt, now, rateMul = 1) {
  const H = bot.H, sway = Math.sin(now * 1.3 + H.ph) * 0.025 + Math.sin(now * 3.1 + H.ph * 2) * 0.008;
  X.turnTo(bot, yaw + sway, bot.d.turn * bot.P.turn * 0.5 * rateMul, dt);
  bot.pitch += (0 - bot.pitch) * Math.min(1, dt * 3);
}
function startHold(bot, world, X, now) {
  const H = bot.H, P = bot.P, rng = bot.rng;
  H.phase = 'hold'; H.holdT = now + P.holdMin + rng() * (P.holdMax - P.holdMin) + gaussR(rng) * 0.3;
  H.angles = H.spot ? computeAngles(bot, world, X, H.spot) : [{ yaw: bot.yaw, w: 1 }];
  H.ai = Math.floor(rng() * H.angles.length); H.dwellT = now + P.dwell[0] + rng() * (P.dwell[1] - P.dwell[0]); H.look = H.angles[H.ai].yaw;
  if (H.spot) { H.hist.push({ x: H.spot.x, z: H.spot.z }); if (H.hist.length > 6) H.hist.shift(); const S = state(world), k = keyOf(world.grid, H.spot.x, H.spot.z); S.visits.set(k, (S.visits.get(k) || 0) + 1); }
}
function tryPeek(bot, world, X, now) {
  const g = world.grid, H = bot.H, P = bot.P, rng = bot.rng, yaw = H.look != null ? H.look : bot.yaw;
  if (rng() > P.peek) return false;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), px = -fz, pz = fx, refH = g.heightAt ? g.heightAt(bot.x, bot.z) : null;
  const dist = rng() < P.wide ? 2.2 + rng() * 1.6 : 0.9 + rng() * 0.6; let best = null, bd = -1;
  for (const s of [-1, 1]) {
    const x = bot.x + px * s * dist, z = bot.z + pz * s * dist;
    if (!freeAt(g, X, bot, x, z, isFinite(refH) ? refH : null) || !X.hasLOS(g, bot.x, bot.z, x, z)) continue;
    const open = X.raycastGrid(g, x, z, fx, fz, 40) + rng() * 6; if (open > bd) { bd = open; best = { x, z }; }
  }
  if (!best) return false;
  H.peek = { x: best.x, z: best.z, hx: bot.x, hz: bot.z, until: 0, dur: 0.35 + rng() * 0.8 + (dist > 2 ? 0.5 : 0), back: false, arrived: 0 };
  H.phase = 'peek'; return true;
}

// ------------------------------------------------------------------ reactions to memory (seen / heard / hit)
function nearestSite(world, x, z) { let b = null, bd = 1e9; for (const s of world.sites || []) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; b = s; } } return b; }
function decide(bot, mem, world, X, now, bots) {
  const P = bot.P, rng = bot.rng, H = bot.H, d = Math.hypot(mem.x - bot.x, mem.z - bot.z), yaw = X.yawTo(mem.x - bot.x, mem.z - bot.z);
  if (mem.src === 'heard') {
    if (d > P.soundRange) return rng() < 0.5 ? { a: 'glance', yaw } : { a: 'ignore' }; // too far to investigate: maybe turn the head
    if (P.sound === 'look') return d < 12 && rng() < 0.4 ? { a: 'goto', x: mem.x, z: mem.z, short: true } : { a: 'glance', yaw };
    if (P.sound === 'push') return rng() < 0.4 ? { a: 'goto', x: mem.x, z: mem.z } : { a: 'glance', yaw };
    if (P.sound === 'rotate') {
      const ns = nearestSite(world, mem.x, mem.z);
      if (ns && ns.id !== H.zoneSite && Math.hypot(ns.x - mem.x, ns.z - mem.z) < 28) return { a: 'rotate', site: ns.id, delay: 0.2 + rng() * 1.0 };
      return rng() < 0.45 ? { a: 'goto', x: mem.x, z: mem.z } : { a: 'glance', yaw };
    }
    if (P.sound === 'flank') {
      if (rng() < 0.65) { const pa = yaw + (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.7), r = 7 + rng() * 5; return { a: 'goto', x: mem.x - Math.sin(pa) * r * 0.0 + Math.cos(pa) * r, z: mem.z - Math.sin(pa) * r, delay: 1.2 + rng() * 2.8, flank: true }; }
      return { a: 'glance', yaw };
    }
  }
  // seen / hit: someone was just here
  if (bot.persona === 'anchor' && mem.src !== 'hit' && d > 8) return { a: 'glance', yaw, long: true };
  if (mem.src === 'hit' && bot.persona !== 'aggressive' && rng() < 0.5) return { a: 'glance', yaw };
  if (bot.persona === 'lurker' && rng() < 0.6) return { a: 'goto', x: mem.x + (rng() - 0.5) * 8, z: mem.z + (rng() - 0.5) * 8, delay: rng() * 1.5 };
  if (bot.persona === 'rotator') { const ns = nearestSite(world, mem.x, mem.z); if (ns && ns.id !== H.zoneSite && Math.hypot(ns.x - mem.x, ns.z - mem.z) < 28) return { a: 'rotate', site: ns.id, delay: 0 }; }
  return { a: 'goto', x: mem.x + (rng() - 0.5) * 3, z: mem.z + (rng() - 0.5) * 3 };
}

// ------------------------------------------------------------------ main hook: returns true when it handled the bot's non-combat behaviour
export function think(bot, bots, world, dt, now, brain, X, attack, bomb, planted) {
  const H = bot.H; if (!H || !world.sites || !world.sites.length) return false;
  if (planted) return false;
  if (attack) { const carrying = bomb.state === 'carried' && bomb.carrierId === bot.id; if (carrying || bomb.state === 'dropped' || bot.planting) return false; }
  const g = world.grid, P = bot.P, rng = bot.rng;
  bot._world = world; seed(world, bot.team === (world.attackTeam || 'T') ? 'T' : 'CT', X); decay(world, now);
  if (!H.rotAt && P.rotEvery) H.rotAt = now + P.rotEvery[0] + rng() * (P.rotEvery[1] - P.rotEvery[0]);
  const smul = P.speed * (0.93 + 0.14 * Math.sin(now * 0.7 + H.ph));

  // new information -> decision (once per memory object)
  const mem = bot.memory;
  if (mem && !mem.dec) {
    mem.dec = decide(bot, mem, world, X, now, bots); const D = mem.dec; bot.memory = null; bot.investT = 0; H.react = D;
    bot.state = 'react-' + D.a;
    if (D.a === 'glance') { H.glance = { yaw: D.yaw, until: now + (D.long ? 2.5 : 0.8) + rng() * 1.2 }; }
    else if (D.a === 'rotate') { H.zoneSite = D.site; bot.assigned = D.site; H.delay = now + (D.delay || 0); H.phase = 'choose'; H.spot = null; H.peek = null; bot.path = null; }
    else if (D.a === 'goto') { H.delay = now + (D.delay || 0); H.route = buildRoute(bot, world, X, D, bots); H.ri = 0; H.spot = { x: D.x, z: D.z }; H.phase = 'move'; H.peek = null; H.shortHold = true; bot.path = null; if (D.delay) H.waitFirst = true; }
  }
  if (H.glance) { if (now < H.glance.until) { head(bot, X, H.glance.yaw, dt, now, 1.6); if (H.phase === 'hold') return true; } else H.glance = null; }
  if (now < H.delay) { bot.state = 'wait'; head(bot, X, H.look != null ? H.look : bot.yaw, dt, now); return true; }

  // rotator timer
  if (P.rotEvery && now > H.rotAt && (H.phase === 'hold' || H.phase === 'choose')) {
    const others = world.sites.filter((s) => s.id !== H.zoneSite); if (others.length) { H.zoneSite = others[Math.floor(rng() * others.length)].id; bot.assigned = H.zoneSite; H.phase = 'choose'; H.spot = null; }
    H.rotAt = now + P.rotEvery[0] + rng() * (P.rotEvery[1] - P.rotEvery[0]);
  }

  switch (H.phase) {
    case 'choose': {
      bot.state = 'choose'; const c = zoneCenter(bot, world, X, brain, attack, bots);
      const s = pickSpot(bot, world, X, c, c.rMin, c.rMax, bots) || { x: c.x, z: c.z };
      H.spot = s; H.route = buildRoute(bot, world, X, s, bots); H.ri = 0; H.phase = 'move'; H.shortHold = false; H.noPathT = 0; bot.path = null; return true;
    }
    case 'move': {
      bot.state = 'roam-' + bot.persona;
      if (H.pauseT > now) { bot.state = 'check'; head(bot, X, H.look != null ? H.look : bot.yaw, dt, now, 1.2); return true; }
      const p = H.route[H.ri]; if (!p) { startHold(bot, world, X, now); if (H.shortHold) { H.holdT = now + 1.2 + rng() * 2.2; H.shortHold = false; } return true; }
      if (!H.prog || H.prog.ri !== H.ri) H.prog = { ri: H.ri, d: Math.hypot(p.x - bot.x, p.z - bot.z), t: now, n: 0 };
      else if (now - H.prog.t > 1.5) { const dn = Math.hypot(p.x - bot.x, p.z - bot.z); if (H.prog.d - dn < 0.6) H.prog.n++; else H.prog.n = 0; H.prog.d = dn; H.prog.t = now; if (H.prog.n >= 2) { const S = state(world), k = keyOf(g, p.x, p.z); S.visits.set(k, (S.visits.get(k) || 0) + 3); H.phase = 'choose'; H.spot = null; H.prog = null; bot.path = null; bot.sidestep = 0.3; return true; } }
      const last = H.ri === H.route.length - 1, arrived = X.goTo(bot, world, p.x, p.z, dt, smul * (last ? 1 : 1.05), last ? 0.7 : 1.2);
      if (!arrived && !bot.path) { H.noPathT += dt; if (H.noPathT > 1.2) { const S = state(world), k = keyOf(g, p.x, p.z); S.visits.set(k, (S.visits.get(k) || 0) + 3); H.phase = 'choose'; H.noPathT = 0; H.spot = null; } } else H.noPathT = 0;
      if (arrived) {
        H.ri++; bot.path = null;
        if (p.via && rng() < P.pause) { H.pauseT = now + 0.3 + rng() * 0.8; const hot = hotPoints(world, bot.team, 3); const h = hot.length ? hot[Math.floor(rng() * hot.length)] : null; H.look = h ? X.yawTo(h.x - bot.x, h.z - bot.z) : bot.yaw + (rng() - 0.5) * 1.6; }
      }
      return true;
    }
    case 'hold': {
      bot.state = 'hold'; bot.path = null;
      if (now >= H.dwellT) {
        if (tryPeek(bot, world, X, now)) return true;
        H.ai = (H.ai + 1 + Math.floor(rng() * Math.max(1, H.angles.length - 1))) % H.angles.length; H.look = H.angles[H.ai].yaw + (rng() - 0.5) * 0.25;
        H.dwellT = now + P.dwell[0] + rng() * (P.dwell[1] - P.dwell[0]);
      }
      head(bot, X, H.look, dt, now);
      if (now >= H.holdT) {
        if (rng() < P.retarget) H.phase = 'choose';
        else H.holdT = now + P.holdMin + rng() * (P.holdMax - P.holdMin);
      }
      return true;
    }
    case 'peek': {
      const k = H.peek; if (!k) { H.phase = 'hold'; return true; }
      bot.state = k.back ? 'peek-back' : 'peek';
      const tx = k.back ? k.hx : k.x, tz = k.back ? k.hz : k.z, arrived = X.goTo(bot, world, tx, tz, dt, 1.0, 0.25);
      head(bot, X, H.look != null ? H.look : bot.yaw, dt, now, 1.3);
      if (!k.back) { if (arrived && !k.arrived) { k.arrived = now; k.until = now + k.dur; } if (k.arrived && now >= k.until) { k.back = true; bot.path = null; } else if (!k.arrived && !bot.path) { k.back = true; } }
      else if (arrived) { H.peek = null; H.phase = 'hold'; H.dwellT = now + P.dwell[0] + rng() * (P.dwell[1] - P.dwell[0]); }
      return true;
    }
  }
  return false;
}
