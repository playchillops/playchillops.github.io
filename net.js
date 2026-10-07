// net.js - browser/Node client adapter for the Sniper Chill authoritative server.
// No imports of Three or the DOM; you inject what it needs, so it also runs headless in tests.
//
//   import { createController } from './movement.js';
//   import { NetClient } from './net.js';
//   const net = new NetClient({ createController, colliders: physList, url: 'wss://host/ws?room=new&name=Juan' });
//   net.on('welcome', w => history.replaceState(0, '', '?room=' + w.room));      // shareable link
//   net.connect();
//   // every render frame:
//   net.look(mouseDx, mouseDy);                       // pixels, same as movement.look()
//   net.setInput({ f, r, j, c, aim, rl, use, w });    // held keys: f/r in -1..1, jump, crouch, aim, reload, use(E), weapon 0|1|2
//   net.setInput({ fire: triggerHeld });              // auto weapons: held. Semi-auto: call net.tap() on click
//   net.update(frameDt);                              // runs fixed 30 Hz ticks: predict + send
//   const me = net.eye();                             // {x,y,z,yaw,pitch,...} camera (interpolated between ticks)
//   for (const p of net.remotes()) { /* move your player meshes to p.x,p.y,p.z,p.yaw, p.crouched, p.alive */ }
//
// Do NOT call ctrl.connect(element) in multiplayer: this adapter owns the controller (net.ctrl) and
// feeds it inputs at the server tick rate, which is what keeps prediction identical to the server.
import { DT, TICK, aimTo, clamp, lerp, lerpAngle, wrapPi, SENS, rocketVel, TURBO } from './common.js';

export class NetClient {
  constructor(o) {
    this.o = { interpTicks: null, now: () => performance.now() / 1000, setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h),
      makeSocket: (url) => new WebSocket(url), reconnectMs: [250, 500, 1000, 2000, 2000, 3000], reconnectGiveUp: 28, ...o };
    this.ctrl = o.createController(o.colliders, { sensitivity: SENS });
    this.handlers = {};
    this.url = o.url; this.ws = null; this.token = null; this.id = 0; this.room = null; this.team = null;
    this.yaw = 0; this.pitch = 0; this.input = { f: 0, r: 0, j: false, c: false, fire: false, aim: false, rl: false, use: false, w: -1 };
    this.pendingFire = false; this.acc = 0; this.seq = 0; this.pending = []; this.pred = new Map();
    this.snaps = []; this.roster = new Map(); this.phase = 'waiting'; this.alive = false; this.respawns = -1;
    this.tickRate = TICK; this.snapDiv = 2; this.latestK = 0; this.latestRecv = 0; this.rttMs = 0; this.hasPing = false; this.serverPerf = null;
    this.prev = null; this.cur = null; this.stats = { corrections: 0, maxErr: 0, snaps: 0 };
    this.closing = false; this.attempt = 0; this.dropAt = 0; this.pingTimer = null; this.connected = false;
    this.me = { mag: 0, res: 0, rl: 0, hp: 100, weapon: 0, pp: 0, dp: 0 }; this.score = [0, 0]; this.round = 1; this.phaseLeft = 0; this.bomb = null;
  }

  on(name, fn) { (this.handlers[name] ||= []).push(fn); return this; }
  emit(name, a) { for (const f of this.handlers[name] || []) f(a); }

  connect(url = this.url) {
    this.url = url; this.closing = false;
    const u = new URL(url, 'http://x'); // only used to rebuild query on reconnect
    void u;
    const full = this.token && this.room ? withParams(this.url, { room: this.room, token: this.token }) : this.url;
    const ws = this.o.makeSocket(full); this.ws = ws;
    ws.onopen = () => { this.connected = true; this.attempt = 0; this.pingTimer = this.o.setTimeout(() => this.ping(), 200); };
    ws.onmessage = (ev) => { this.lastRx = this.o.now(); this.onMessage(typeof ev === 'string' ? ev : ev.data); };
    ws.onclose = (e) => { if (ws !== this.ws) return; this.connected = false; this.o.clearTimeout(this.pingTimer); this.emit('close', { intentional: this.closing, code: e && e.code, sinceRx: this.lastRx ? this.o.now() - this.lastRx : -1 }); if (!this.closing) this.retry(); };
    ws.onerror = () => {};
  }
  close() { this.closing = true; this.o.clearTimeout(this.pingTimer); try { this.ws?.close(); } catch {} }
  retry() {
    if (!this.dropAt) this.dropAt = this.o.now();
    if (!this.token || this.o.now() - this.dropAt > this.o.reconnectGiveUp) { this.emit('disconnected', { reason: 'gave_up' }); return; }
    const ms = this.o.reconnectMs[Math.min(this.attempt++, this.o.reconnectMs.length - 1)];
    this.emit('reconnecting', { attempt: this.attempt, inMs: ms });
    this.o.setTimeout(() => this.connect(), ms);
  }
  sendRaw(m) { if (this.connected && this.ws) { try { this.ws.send(JSON.stringify(m)); } catch {} } }
  ping() { this.sendRaw({ t: 'ping', c: this.o.now() }); this.pingTimer = this.o.setTimeout(() => this.ping(), 2000); }
  chat(text) { this.sendRaw({ t: 'chat', text }); }

  // ---- host-facing input ----
  look(dx, dy) {
    this.yaw = wrapPi(this.yaw - dx * SENS);
    this.pitch = clamp(this.pitch - dy * SENS, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }
  setInput(i) { Object.assign(this.input, i); }
  tap() { this.pendingFire = true; }

  // ---- fixed-step loop ----
  update(frameDt) {
    this.acc += Math.min(frameDt, 0.25);
    while (this.acc >= DT) { this.acc -= DT; this.stepTick(); }
  }
  gate() { return this.phase !== 'freeze' && this.phase !== 'match_end' && this.alive; }
  applyPredicted(inp) {
    aimTo(this.ctrl, inp.yaw, inp.pitch);
    const m = this.phase !== 'match_end' && this.alive;
    if (m && inp.rk) this.ctrl.impulse(rocketVel(inp.yaw, inp.pitch));   // Starship: predicted like the server does it
    this.ctrl.update(DT, m ? { forward: inp.f, right: inp.r, jump: inp.j, crouch: inp.c, sprint: false, knife: !!inp.kn, speedMul: inp.sm ? TURBO : 1 } : { forward: 0, right: 0, jump: false, crouch: inp.c, sprint: false, knife: !!inp.kn });
    if (this.phase === 'freeze' && this.sz) { const ps = this.ctrl.state.position, cx = Math.max(this.sz[0] - 2.5, Math.min(this.sz[0] + 2.5, ps.x)), cz = Math.max(this.sz[1] - 2.5, Math.min(this.sz[1] + 2.5, ps.z)); if (cx !== ps.x || cz !== ps.z) this.ctrl.teleport({ x: cx, y: ps.y, z: cz }, { yaw: this.ctrl.state.yaw, pitch: this.ctrl.state.pitch }); }
  }
  stepTick() {
    const i = this.input;
    const inp = { t: 'in', seq: ++this.seq, f: i.f, r: i.r, j: i.j, c: i.c, kn: i.kn ? 1 : 0, yaw: round(this.yaw, 4), pitch: round(this.pitch, 4),
      fire: i.fire || this.pendingFire, aim: i.aim, rl: i.rl, use: i.use, w: i.w, vt: round(this.renderTick(), 2), pw: i.pw ? 1 : 0, rk: i.rk ? 1 : 0, sm: i.sm ? 1 : 0 };
    this.pendingFire = false; i.pw = false; i.rk = false;   // the power press is one input frame
    if (inp.w === this.me.weapon) inp.w = -1;
    this.prev = this.cur;
    this.applyPredicted(inp);
    const p = this.ctrl.state.position;
    this.cur = { x: p.x, y: p.y, z: p.z };
    this.pred.set(inp.seq, [p.x, p.y, p.z]);
    this.pending.push(inp);
    if (this.pending.length > 120) this.pending.shift();
    this.sendRaw(inp);
  }

  // ---- views ----
  eye() {
    const s = this.ctrl.state, a = this.prev && this.cur ? this.acc / DT : 1, p0 = this.prev || this.cur || s.position, p1 = this.cur || s.position;
    const x = lerp(p0.x, p1.x, a), y = lerp(p0.y, p1.y, a), z = lerp(p0.z, p1.z, a);
    return { x, y: y + (s.eye.y - s.position.y), z, yaw: this.yaw, pitch: this.pitch, feet: { x, y, z }, crouched: s.crouched, grounded: s.grounded, speed: s.speed };
  }
  renderTick() {
    if (!this.snaps.length) return 0;
    const delay = this.o.interpTicks ?? Math.max(3, this.snapDiv * 2);
    return this.latestK + (this.o.now() - this.latestRecv) * this.tickRate - delay;
  }
  /** interpolated remote players (not including yourself) */
  remotes() {
    const n = this.snaps.length; if (!n) return [];
    const rt = this.renderTick();
    let a = this.snaps[0], b = this.snaps[0];
    for (let i = 0; i < n; i++) { if (this.snaps[i].k <= rt) a = this.snaps[i]; if (this.snaps[i].k >= rt) { b = this.snaps[i]; break; } b = this.snaps[i]; }
    const f = b.k === a.k ? 0 : clamp((rt - a.k) / (b.k - a.k), 0, 1), out = [];
    for (const [id, eb] of b.pl) {
      if (id === this.id) continue;
      const ea = a.pl.get(id) || eb, r = this.roster.get(id) || {};
      out.push({ id, name: r.name || '?', team: r.team, ch: r.ch, x: lerp(ea.x, eb.x, f), y: lerp(ea.y, eb.y, f), z: lerp(ea.z, eb.z, f), yaw: lerpAngle(ea.yaw, eb.yaw, f), pitch: lerp(ea.pitch, eb.pitch, f),
        crouched: eb.crouched, alive: eb.alive, connected: eb.connected, hp: eb.hp, weapon: eb.weapon, cloak: eb.cloak, stun: eb.stun, pwr: eb.pwr });
    }
    return out;
  }

  // ---- incoming ----
  onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'welcome':
        this.id = m.id; this.token = m.token; this.room = m.room; this.team = m.team; this.mode = m.mode || '1v1'; this.ch = m.ch || ''; this.tickRate = m.tickRate; this.snapDiv = m.snapDiv; this.dropAt = 0;
        if (m.resumed) { this.pending = []; this.pred.clear(); }
        this.emit('welcome', m); break;
      case 'roster': this.roster.clear(); for (const r of m.list) this.roster.set(r.id, r); this.emit('roster', m); break;
      case 'join': this.roster.set(m.id, { id: m.id, name: m.name, team: m.team, ch: m.ch, k: 0, d: 0 }); this.emit('join', m); break;
      case 'swap': if (m.teams) { if (m.teams[this.id]) this.team = m.teams[this.id]; for (const [id, t] of Object.entries(m.teams)) { const r = this.roster.get(+id); if (r) r.team = t; } } this.emit('swap', m); break;
      case 'leave': this.roster.delete(m.id); this.emit('leave', m); break;
      case 'pong': this.hasPing = true; this.rttMs = (this.o.now() - m.c) * 1000; break;
      case 's': this.onSnapshot(m); break;
      case 'error': if (m.code === 'room_not_found' && this.token && this.dropAt) break;   /* server may still be restoring the room: onclose retries */ this.closing = m.code !== 'x'; this.emit('error', m); break;
      default: this.emit(m.t, m);
    }
  }
  onSnapshot(m) {
    this.serverPerf = Array.isArray(m.sp) ? m.sp : null;
    const pl = new Map();
    for (const e of m.pl) pl.set(e[0], { x: e[1], y: e[2], z: e[3], yaw: e[4], pitch: e[5], crouched: !!(e[6] & 1), alive: !!(e[6] & 2), grounded: !!(e[6] & 4), connected: !!(e[6] & 8), cloak: !!(e[6] & 16), stun: !!(e[6] & 32), pwr: !!(e[6] & 64), hp: e[7], weapon: e[8] });
    this.snaps.push({ k: m.k, pl }); this.snaps[this.snaps.length - 1].recv = this.o.now();
    if (this.snaps.length > 30) this.snaps.shift();
    this.latestK = m.k; this.latestRecv = this.o.now(); this.stats.snaps++;
    this.sd = m.sd || null; this.lobby = !!m.ls; this.phase = m.ph; this.phaseLeft = m.pt; this.score = m.sc; this.round = m.rd; if (m.fs) this.fs = m.fs; this.bomb = m.bomb ? { site: m.bomb[0], x: m.bomb[1], y: m.bomb[2], z: m.bomb[3], t: m.bomb[4] } : null;
    const mine = pl.get(this.id), me = m.me;
    if (mine && me) {
      this.alive = mine.alive; this.sz = me.sz || null; Object.assign(this.me, { mag: me.mag, res: me.res, rl: me.rl, hp: mine.hp, weapon: mine.weapon, pp: me.pp, dp: me.dp, m: me.m, inv: me.inv, gr: me.gr, ar: me.ar, he: me.he, ks: me.ks, gl: me.gl, pt: me.pt, pw: me.pw || 0, pa: me.pa || 0, st: me.st || 0, sk: me.sk || '', tz: !!me.tz }); if (m.av) this.avg = m.av;
      this.reconcile(me, mine);
    }
    this.emit('snap', m);
  }
  reconcile(me, mine) {
    const s = this.ctrl.state;
    if (me.re !== this.respawns) {            // (re)spawned: hard reset
      this.respawns = me.re; this.pending = []; this.pred.clear();
      Object.assign(s.position, { x: me.p[0], y: me.p[1], z: me.p[2] }); Object.assign(s.velocity, { x: 0, y: 0, z: 0 });
      this.yaw = mine.yaw; this.pitch = mine.pitch; this.prev = this.cur = { x: me.p[0], y: me.p[1], z: me.p[2] }; return;
    }
    while (this.pending.length && this.pending[0].seq <= me.ack) this.pending.shift();
    const pr = this.pred.get(me.ack);
    for (const k of this.pred.keys()) if (k < me.ack) this.pred.delete(k);
    if (!pr) return;
    const err = Math.hypot(pr[0] - me.p[0], pr[1] - me.p[1], pr[2] - me.p[2]);
    this.stats.maxErr = Math.max(this.stats.maxErr, err);
    if (err < 0.01) return;
    this.stats.corrections++;
    Object.assign(s.position, { x: me.p[0], y: me.p[1], z: me.p[2] }); Object.assign(s.velocity, { x: me.v[0], y: me.v[1], z: me.v[2] });
    this.pred.clear();
    for (const inp of this.pending) { this.applyPredicted(inp); const p = s.position; this.pred.set(inp.seq, [p.x, p.y, p.z]); }
    const p = s.position; this.cur = { x: p.x, y: p.y, z: p.z };
    this.prev = this.prev ? { x: lerp(this.prev.x, p.x, 0.5), y: lerp(this.prev.y, p.y, 0.5), z: lerp(this.prev.z, p.z, 0.5) } : this.cur; // soften the pop
  }
}

function round(n, d) { const m = 10 ** d; return Math.round(n * m) / m; }
function withParams(url, kv) { const u = new URL(url); for (const [k, v] of Object.entries(kv)) u.searchParams.set(k, v); return u.toString(); }
