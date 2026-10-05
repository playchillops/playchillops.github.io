// bots.js - simple enemy bots for Sniper Chill (patrol, spot, chase, shoot, one defuser).
// createBots(THREE, scene, map, { raycast, colliders }) -> manager
//   manager.list            targets for hitscan {id, position:{x,y,z feet}, height, radius, health, alive}
//   manager.spawn(pos, opts) / manager.clear()
//   manager.update(dt, env) env = {playerEye:{x,y,z}, playerAlive, bomb:{planted,pos,defuse(dt)}, camera}
//        returns events [{type:'shot', from, to, hit:bool, damage}, {type:'defused'}]
//   manager.damage(bot, newHealth, headshot)
//   manager.aliveCount()
import * as AI from './botsai.js';
import { wallBlocked } from './hitscan.js';
import { createCharacter, CHARACTER_IDS } from './characters.js';
export function createBots(THREE, scene, map, opts) {
  const { raycast, colliders } = opts;
  let smokeLOS = () => false;
  const useAI = !/[?&]ai=simple/.test(typeof location !== 'undefined' ? location.search : '');
  // ---- specialist AI adapter (height-aware): map.navGrid for walls/paths/heights, game raycast for LOS
  const ng = map.navGrid, aiList = [];
  const wallData = new Uint8Array(ng.cols * ng.rows); for (let i = 0; i < wallData.length; i++) wallData[i] = ng.walkable[i] ? 0 : 1;
  const grid = AI.makeGrid(ng.cols, ng.rows, ng.cellSize, wallData, ng.originX, ng.originZ);
  grid.heightAt = (x, z) => { const h = map.getHeight(x, z); return isFinite(h) ? h : NaN; };
  grid.stepMax = Math.max(0.7, (map.stepHeight || 0.5) + 0.25);
  grid.customPath = (ax, az, bx, bz) => {
    const p = ng.findPath(new THREE.Vector3(ax, grid.heightAt(ax, az), az), new THREE.Vector3(bx, grid.heightAt(bx, bz), bz));
    return p && p.length ? p.map((v) => ({ x: v.x, z: v.z })) : null;
  };
  const aiEvents = []; let lastEnv = null;
  const aiWorld = {
    grid, attackTeam: 'T', sites: ['A', 'B'].filter((k) => map.bombsites && map.bombsites[k]).map((k) => ({ id: k, x: map.bombsites[k].center.x, z: map.bombsites[k].center.z, r: map.bombsites[k].radius })),
    bomb: { state: 'carried', carrierId: 'player' }, players: [{ id: 'player', team: 'T', alive: true, x: 0, y: 0, z: 0, _spd: 0 }],
    los(bot, e) {
      const a = { x: bot.x, y: bot.y + 1.6, z: bot.z }, ey = (e.y || 0) + 1.2, dx = e.x - a.x, dy = ey - a.y, dz = e.z - a.z, d = Math.hypot(dx, dy, dz);
      if (smokeLOS(a, { x: e.x, y: ey, z: e.z }) || bot.grenadeFlash > 0) return false;
      return !raycast(a, { x: dx, y: dy, z: dz }, { colliders, maxDistance: Math.max(0.1, d - 0.3) });
    },
    shoot(bot, o, dir, wname) {
      if (bot.grenadeFlash > 0) return { hit: false };
      const W = AI.WEAPONS[wname], range = (W.range || 40) * 1.6, pl = aiWorld.players[0];
      const wh = raycast(o, dir, { colliders, maxDistance: range });
      const wd = wh ? Math.hypot(wh.point.x - o.x, wh.point.y - o.y, wh.point.z - o.z) : range;
      let hit = false;
      if (pl.alive) {
        const cx = pl.x - o.x, cy = pl.y + 0.9 - o.y, cz = pl.z - o.z, t = cx * dir.x + cy * dir.y + cz * dir.z;
        if (t > 0 && t < wd) {
          const qx = o.x + dir.x * t, qy = o.y + dir.y * t, qz = o.z + dir.z * t;
          hit = Math.hypot(qx - pl.x, qz - pl.z) < 0.4 && qy > pl.y && qy < pl.y + 1.85;
          if (hit && wallBlocked(o, dir, t, colliders, 0.07)) hit = false;
        }
      }
      const end = hit && lastEnv ? lastEnv.playerEye : (wh ? wh.point : { x: o.x + dir.x * range, y: o.y + dir.y * range, z: o.z + dir.z * range });
      aiEvents.push({ type: 'shot', from: V(o.x, o.y - 0.1, o.z), to: V(end.x, end.y, end.z), hit, damage: Math.max(6, Math.round(W.dmg * (wname === 'sniper' ? 0.5 : 0.55))) });
      return { hit };
    },
    plant() {}, pickupBomb() {},
    defuse() { aiEvents.push({ type: 'defused' }); },
  };
  { const _t = (map.spawnPoints || []).find((s) => s.team === "T"); if (_t) aiWorld.enemyHint = { x: _t.position.x, z: _t.position.z }; }
  function noise(x, z, r, kind) { AI.emitSound(aiList, x, z, r, 'T', kind); }
  const list = [];
  let nextId = 1;
  const palette = [0xe85d75, 0xf2a65a, 0x6c8cff, 0x8e6cf0, 0x3fb68b];
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0c3a0, flatShading: true });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x2b2f3a, flatShading: true });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function makeBar() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(0.9, 0.11, 1); spr.renderOrder = 10;
    const draw = (f) => {
      const x = c.getContext('2d'); x.clearRect(0, 0, 64, 8); x.fillStyle = '#10141f'; x.fillRect(0, 0, 64, 8);
      x.fillStyle = f > 0.5 ? '#52f0a0' : f > 0.25 ? '#ffd24a' : '#ff5566'; x.fillRect(1, 1, 62 * f, 6); tex.needsUpdate = true;
    };
    draw(1); return { spr, draw };
  }

  function spawn(pos, o = {}) {
    const col = palette[(nextId - 1) % palette.length];
    const ch = createCharacter(THREE, { id: CHARACTER_IDS[(nextId - 1) % CHARACTER_IDS.length], team: 'T', weapon: o.weapon || (o.pro && o.difficulty === 'hard' ? 'sniper' : 'machinegun') });
    const group = ch.group;
    const bodyMat = { emissive: { setHex() {} } };
    const bar = makeBar(); bar.spr.position.y = 2.05; Object.defineProperty(bar.spr, 'visible', { get: () => false, set() {} }); group.add(bar.spr);
    group.position.set(pos.x, pos.y, pos.z); scene.add(group);
    const b = {
      id: 'bot' + nextId++, group, bodyMat, baseColor: col, bar,
      position: { x: pos.x, y: pos.y, z: pos.z }, height: 1.8, radius: 0.3,
      health: 100, alive: true, defuser: !!o.defuser, path: [], pathT: Math.random(), seen: 0,
      shootT: 1 + Math.random(), yaw: 0, flash: 0, deadT: 0, defuseT: 0, speedMul: 0.85 + Math.random() * 0.3,
    };
    if (useAI && o.pro) {
      const ai = AI.createBot({ id: b.id, team: 'CT', difficulty: o.difficulty || 'hard', weapons: o.weapons, x: pos.x, y: pos.y, z: pos.z, yaw: Math.random() * 6.28 });
      Object.assign(ai, { slot: o.slot, group, bodyMat, baseColor: col, bar, ch, height: ch.height || 1.8, flash: 0, deadT: 0, pro: true, defuser: !!o.defuser });
      ai.position = ai;
      Object.defineProperty(ai, 'health', { get() { return ai.hp; } });
      if (!aiList.length) AI.newRound(aiWorld);
      Object.defineProperty(ai, 'hitZones', { get() { return ch.hitZones(); } });
      aiList.push(ai); list.push(ai); return ai;
    }
    b.ch = ch; Object.defineProperty(b, 'hitZones', { get() { return ch.hitZones(); } });
    list.push(b); return b;
  }
  function clear() { for (const b of list) scene.remove(b.group); list.length = 0; aiList.length = 0; AI.newRound(aiWorld); }
  function damage(b, newHealth, head) {
    if (b.pro) {
      const dmg = b.hp - newHealth; AI.damageBot(b, dmg, lastEnv ? lastEnv.playerEye.x : b.x, lastEnv ? lastEnv.playerEye.z : b.z, !!head);
      b.bar.draw(Math.max(0, b.hp) / 100); b.flash = 0.12; b.ch.setAnim(b.alive ? 'hit' : 'death'); if (!b.alive) { b.deadT = 0; b.bar.spr.visible = false; } return;
    }
    b.health = newHealth; b.bar.draw(Math.max(0, newHealth) / 100); b.flash = 0.12; b.ch.setAnim(newHealth <= 0 ? 'death' : 'hit');
    if (newHealth <= 0) { b.alive = false; b.deadT = 0; b.bar.spr.visible = false; }
  }
  function aliveCount() { let n = 0; for (const b of list) if (b.alive) n++; return n; }

  function setPath(b, to) {
    const p = map.navGrid.findPath(V(b.position.x, b.position.y, b.position.z), to);
    b.path = p.slice(1);
  }
  function step(b, dt, speed) {
    const wp = b.path[0]; if (!wp) return false;
    const dx = wp.x - b.position.x, dz = wp.z - b.position.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { b.path.shift(); return b.path.length > 0; }
    const m = Math.min(d, speed * dt);
    b.position.x += dx / d * m; b.position.z += dz / d * m;
    const h = map.getHeight(b.position.x, b.position.z);
    if (isFinite(h)) b.position.y += (h - b.position.y) * Math.min(1, dt * 12);
    b.yaw = Math.atan2(-dx, -dz);
    return true;
  }

  // drive the character rig from the bot's actual movement
  function charTick(b, dt, x, z) {
    let speed, aiming, pitch = 0, reloading = false, weapon;
    if (b.pro) {
      speed = b.speed || 0; weapon = b.weapon; reloading = !!b.reloading; pitch = b.pitch || 0;
      aiming = b.state === 'engage' || String(b.state).startsWith('cover') || !!b.scoped;
    } else {
      const lp = b._lp || (b._lp = { x, z }); const sp = dt > 0 ? Math.hypot(x - lp.x, z - lp.z) / dt : 0; lp.x = x; lp.z = z;
      b._sp = (b._sp ?? sp) + (sp - (b._sp ?? sp)) * 0.3; speed = b._sp; aiming = b.seen > 0.3;
      const pe = lastEnv ? lastEnv.playerEye : null; if (aiming && pe) pitch = Math.atan2(pe.y - (b.group.position.y + 1.5), Math.hypot(pe.x - x, pe.z - z));
    }
    b.ch.update(dt, { speed, aiming, pitch, reloading, weapon: weapon === 'machinegun' || weapon === 'pistol' || weapon === 'sniper' ? weapon : undefined, alive: true, distance: lastEnv && lastEnv.playerEye ? Math.hypot(lastEnv.playerEye.x - x, lastEnv.playerEye.z - z) : undefined });
  }
  // ---- network opponents: same bot objects (character, hit zones, death/hit anims), driven by server snapshots instead of AI
  const WN = ['pistol', 'machinegun', 'sniper']; let remote = false; const rmap = new Map();
  function setRemote(on) { if (remote === !!on) return; remote = !!on; clear(); rmap.clear(); }
  function syncRemote(players) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id); let b = rmap.get(p.id);
      if (!b) { b = spawn({ x: p.x, y: p.y, z: p.z }, { weapon: WN[p.weapon] || 'machinegun' }); b.id = 'net' + p.id; b.netId = p.id; b.alive = !!p.alive; b.health = p.hp; rmap.set(p.id, b); }
      b.net = p; b.name = p.name; b.team = p.team; b.position.x = p.x; b.position.y = p.y; b.position.z = p.z;
      if (p.alive && !b.alive) { b.alive = true; b.health = p.hp; b.deadT = 0; b.group.visible = true; b.ch.setAnim('idle'); }
      else if (!p.alive && b.alive) damage(b, 0, false);
      else if (p.alive && p.hp < b.health) damage(b, p.hp, false);
      else if (p.alive) b.health = p.hp;
    }
    for (const [id, b] of rmap) if (!seen.has(id)) { scene.remove(b.group); const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); rmap.delete(id); }
  }
  function remoteUpdate(dt) {
    for (const b of list) {
      const p = b.net; if (!p) continue;
      b.group.visible = p.connected !== false && (b.alive || b.deadT < 6);
      b.group.position.set(p.x, p.y, p.z); b.group.rotation.y = p.yaw;
      if (!b.alive) { b.deadT += dt; b.ch.update(dt, { alive: false }); continue; }
      const lp = b._lp || (b._lp = { x: p.x, z: p.z }); const sp = dt > 0 ? Math.hypot(p.x - lp.x, p.z - lp.z) / dt : 0; lp.x = p.x; lp.z = p.z; b._sp = (b._sp || 0) + (sp - (b._sp || 0)) * 0.3;
      b.aimT = Math.max(0, (b.aimT || 0) - dt);
      b.ch.update(dt, { speed: b._sp, crouched: !!p.crouched, aiming: b.aimT > 0, pitch: p.pitch, reloading: false, weapon: WN[p.weapon], alive: true });
    }
    return [];
  }
  function update(dt, env) {
    if (remote) return remoteUpdate(dt);
    for (const b of list) b.grenadeFlash = Math.max(0, (b.grenadeFlash || 0) - dt);
    const events = [];
    if (aiList.length && dt > 0) {
      lastEnv = env; const pl = aiWorld.players[0];
      pl.alive = !!env.playerAlive; pl.x = env.playerEye.x; pl.z = env.playerEye.z; pl.y = env.playerEye.y - 1.6;
      const bo = env.bomb;
      aiWorld.bomb = bo && bo.planted ? { state: 'planted', x: bo.pos.x, z: bo.pos.z, site: bo.site || 'A', timeLeft: 30 } : { state: 'carried', carrierId: 'player' };
      aiEvents.length = 0;
      if (!aiWorld.defuseOk) aiWorld.defuseOk = true;
      try { AI.update(aiList, dt, aiWorld); } catch (err) { console.error('AI error', err); }
      for (const b of aiList) if (b.alive) { const h = grid.heightAt(b.x, b.z); if (isFinite(h)) b.y += (h - b.y) * Math.min(1, dt * 12); }
      for (const e of aiEvents) { if (e.type === 'shot') { for (const b of aiList) if (b.alive && Math.hypot(b.x - e.from.x, b.z - e.from.z) < 0.6) b.ch.setAnim('shoot'); } if (e.type === 'defused') { if (bo && bo.defuse && bo.defuse(5)) events.push(e); } else events.push(e); }
    }
    for (const b of list) {
      if (b.pro && b.alive) { b.group.position.set(b.x, b.y, b.z); b.group.rotation.y = b.yaw; charTick(b, dt, b.x, b.z); continue; }
      if (!b.alive) {
        b.deadT += dt; b.ch.update(dt, { alive: false });
        if (b.deadT > 6) b.group.visible = false;
        continue;
      }
      b.flash = Math.max(0, b.flash - dt); b.bodyMat.emissive.setHex(b.flash > 0 ? 0xffffff : 0x000000);
      const eye = { x: b.position.x, y: b.position.y + 1.6, z: b.position.z };
      let sees = false, dist = 999, dx = 0, dy = 0, dz = 0;
      if (env.playerAlive) {
        dx = env.playerEye.x - eye.x; dy = env.playerEye.y - eye.y; dz = env.playerEye.z - eye.z; dist = Math.hypot(dx, dy, dz);
        if (dist < 50 && !b.grenadeFlash && !smokeLOS(eye, env.playerEye)) sees = !raycast(eye, { x: dx, y: dy, z: dz }, { colliders, maxDistance: dist - 0.3 });
      }
      b.seen = sees ? b.seen + dt : Math.max(0, b.seen - dt * 0.5);
      b.pathT -= dt;
      const bomb = env.bomb;
      if (sees && b.seen > 0.55) {
        b.yaw = Math.atan2(-dx, -dz);
        if (dist > 16) {
          if (b.pathT <= 0 || !b.path.length) { setPath(b, V(env.playerEye.x, env.playerEye.y - 1.6, env.playerEye.z)); b.pathT = 1.1 + Math.random() * 0.4; }
          step(b, dt, 3.0 * b.speedMul);
        }
        b.shootT -= dt;
        if (b.shootT <= 0) {
          b.shootT = 0.85 + Math.random() * 0.6;
          const p = Math.max(0.12, Math.min(0.65, 0.72 - dist * 0.012));
          const hit = Math.random() < p;
          events.push({ type: 'shot', from: V(eye.x, eye.y - 0.1, eye.z), to: V(env.playerEye.x, env.playerEye.y, env.playerEye.z), hit, damage: 9 });
        }
      } else if (b.defuser && bomb && bomb.planted) {
        const bd = Math.hypot(bomb.pos.x - b.position.x, bomb.pos.z - b.position.z);
        if (bd > 1.8) {
          if (b.pathT <= 0 || !b.path.length) { setPath(b, V(bomb.pos.x, bomb.pos.y, bomb.pos.z)); b.pathT = 2; }
          step(b, dt, 3.6 * b.speedMul);
        } else if (bomb.defuse(dt)) events.push({ type: 'defused' });
      } else {
        if (!b.path.length || b.pathT <= -8) {
          const tgt = Math.random() < 0.4 && map.bombsites ? (Math.random() < 0.5 ? map.bombsites.A.center : map.bombsites.B.center) : map.navGrid.randomWalkable();
          setPath(b, V(tgt.x, tgt.y, tgt.z)); b.pathT = 0;
        }
        step(b, dt, 2.2 * b.speedMul);
      }
      b.group.position.set(b.position.x, b.position.y, b.position.z); b.group.rotation.y = b.yaw;
      charTick(b, dt, b.position.x, b.position.z);
    }
    return events;
  }
  function refreshNavigation() {
    for (let i = 0; i < wallData.length; i++) wallData[i] = ng.walkable[i] ? 0 : 1;
    AI.invalidateNav(grid);
    for (const b of list) { b.path = []; b.pathT = 0; }
  }
  return { list, spawn, clear, update, setRemote, syncRemote, damage, aliveCount, noise, useAI,
    refreshNavigation, set smokeLOS(fn) { smokeLOS = fn; } };
}
