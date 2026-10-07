/* ChillOps audio.js - procedural WebAudio sound engine. No assets, no deps.
 * API (global `ChillAudio`, also ES/CommonJS export):
 *   ChillAudio.init()                    call on first user gesture (resumes context)
 *   ChillAudio.play(name, opts?)         opts: {pos:{x,y,z}, volume:0..1, rate, weapon}
 *   ChillAudio.setListener({x,y,z}, {x,y,z} forward)   call each frame
 *   ChillAudio.setVolume(master 0..1) / setMuted(bool) / setMusicVolume n/a
 *   ChillAudio.shot(weaponId, pos, isOwn) weapon: 'sniper'|'pistol'|'mg'|'knife'
 *   ChillAudio.footstep(pos, surface, isOwn)  surface 'concrete'|'grass'|'metal'|'wood'
 *   ChillAudio.bombBeep(progress01, pos)  progress 0 start -> 1 about to blow (beeps speed up)
 *   ChillAudio.stopAll()
 * Event names for play(): uiHover uiClick uiStart uiBack buy buyFail
 *   bombPlant bombPlanted bombDefuseStart bombDefused bombBeep bombExplosion
 *   jump land step reload empty switchWeapon
 *   killstreakEarned killstreakCall nuke nukeSiren heli
 *   hit headshot kill death hurt roundStart roundWin roundLose matchWin matchLose
 *   shot_sniper shot_pistol shot_mg shot_knife bulletWhiz bulletImpact
 * 3D: sounds with opts.pos are panned (HRTF) with distance rolloff, lowpass by distance
 * and delayed by distance/343 m/s (air propagation); far gunshots add a distant echo tail.
 */
(function (root) {
  'use strict';
  const SPEED = 343;
  let ctx = null, master = null, comp = null, noiseBuf = null, muted = false, vol = 0.8;
  const L = { p: { x: 0, y: 0, z: 0 }, f: { x: 0, y: 0, z: -1 } };
  const active = new Set();

  function init() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = muted ? 0 : vol;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const ok = () => ctx && ctx.state !== 'closed';

  /* ---------- building blocks ---------- */
  // output chain for a sound: optional spatialisation. returns {in, delay}
  function spatial(pos, t0) {
    if (!pos) return { node: master, t: t0 };
    const dx = pos.x - L.p.x, dy = pos.y - L.p.y, dz = pos.z - L.p.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = ctx.createGain();
    g.gain.value = Math.min(1, 1 / (1 + dist / 12));        // rolloff
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 16000 / (1 + dist / 25)); // air absorption
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      // right vector = forward x up
      const rx = -L.f.z, rz = L.f.x;
      const len = Math.hypot(rx, rz) || 1;
      const side = (dx * rx + dz * rz) / len;
      pan.pan.value = Math.max(-1, Math.min(1, side / (dist + 3) * 1.6));
    }
    g.connect(lp); if (pan) { lp.connect(pan); pan.connect(master); } else lp.connect(master);
    return { node: g, t: t0 + Math.min(dist / SPEED, 1.5), dist };
  }
  function env(g, t, a, d, peak, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d);
  }
  function osc(type, f0, f1, t, dur, peak, out, a) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a || 0.005, dur, peak); o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05); track(o); return o;
  }
  function noise(t, dur, peak, out, ftype, f0, f1, q, a) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(f0 || 4000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 0.7;
    const g = ctx.createGain(); env(g, t, a || 0.003, dur, peak);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random()); s.stop(t + dur + 0.05); track(s); return s;
  }
  function track(n) { active.add(n); n.onended = () => active.delete(n); }
  function tone(out, t, notes, type, step, dur, peak) {
    notes.forEach((f, i) => osc(type, f, f, t + i * step, dur, peak, out, 0.01));
  }
  function echo(out, t, delay, fb, peak) { // simple distant reverb-ish tail
    const d = ctx.createDelay(1); d.delayTime.value = delay;
    const g = ctx.createGain(); g.gain.value = fb;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    out.connect(d); d.connect(lp); lp.connect(g); g.connect(d); g.connect(master);
    setTimeout(() => { try { d.disconnect(); g.disconnect(); lp.disconnect(); } catch (e) {} }, 2500);
  }

  /* ---------- sound definitions: fn(out, t, opts) ---------- */
  const S = {
    uiHover: (o, t) => osc('sine', 900, 1200, t, 0.05, 0.12, o),
    uiClick: (o, t) => { osc('square', 520, 380, t, 0.07, 0.15, o); noise(t, 0.03, 0.1, o, 'highpass', 3000); },
    uiBack: (o, t) => osc('triangle', 500, 300, t, 0.1, 0.18, o),
    uiStart: (o, t) => { tone(o, t, [330, 440, 554, 660], 'triangle', 0.07, 0.25, 0.22); noise(t, 0.4, 0.06, o, 'bandpass', 800, 4000); },
    buy: (o, t) => { tone(o, t, [1318, 1760], 'square', 0.07, 0.15, 0.12); noise(t + 0.14, 0.12, 0.08, o, 'highpass', 6000); },
    buyFail: (o, t) => { osc('sawtooth', 180, 140, t, 0.2, 0.18, o); },

    bombPlant: (o, t) => { for (let i = 0; i < 4; i++) { noise(t + i * 0.18, 0.05, 0.15, o, 'bandpass', 2500, 2500, 6); osc('square', 700 + i * 60, 700 + i * 60, t + i * 0.18, 0.04, 0.06, o); } },
    bombPlanted: (o, t) => { tone(o, t, [880, 660, 880, 1320], 'square', 0.1, 0.12, 0.2); osc('sine', 80, 50, t, 0.4, 0.4, o); },
    bombDefuseStart: (o, t) => { for (let i = 0; i < 6; i++) noise(t + i * 0.12, 0.04, 0.1, o, 'bandpass', 3000 + i * 300, 3000, 8); },
    bombDefused: (o, t) => { tone(o, t, [523, 659, 784, 1046], 'triangle', 0.09, 0.3, 0.25); },
    bombBeep: (o, t) => { osc('square', 1800, 1800, t, 0.09, 0.22, o, 0.002); },
    bombExplosion: (o, t) => {
      noise(t, 2.5, 0.9, o, 'lowpass', 2500, 80, 0.8, 0.01);
      osc('sine', 90, 25, t, 2.2, 0.9, o, 0.01);
      noise(t + 0.05, 0.6, 0.5, o, 'bandpass', 1200, 300, 1);
      for (let i = 0; i < 6; i++) noise(t + 0.4 + i * 0.25, 0.3, 0.12, o, 'bandpass', 800 + Math.random() * 1500, 200, 2);
      echo(o, t, 0.28, 0.45);
    },

    jump: (o, t) => { noise(t, 0.12, 0.08, o, 'bandpass', 600, 1200, 1); osc('sine', 200, 300, t, 0.08, 0.06, o); },
    land: (o, t, op) => { const p = op.power || 0.5; osc('sine', 120, 50, t, 0.15, 0.35 * p + 0.1, o); noise(t, 0.1, 0.2 * p + 0.05, o, 'lowpass', 900, 200); },
    step: (o, t, op) => {
      const s = op.surface || 'concrete';
      const f = { concrete: 1400, grass: 700, metal: 2600, wood: 1000 }[s] || 1400;
      noise(t, 0.07, 0.12, o, 'bandpass', f * (0.85 + Math.random() * 0.3), f * 0.5, 1.5);
      osc('sine', 110, 70, t, 0.06, 0.1, o);
      if (s === 'metal') osc('triangle', 900, 880, t, 0.12, 0.04, o);
    },
    reload: (o, t) => { noise(t, 0.04, 0.2, o, 'bandpass', 2200, 2200, 6); noise(t + 0.5, 0.05, 0.25, o, 'bandpass', 1500, 1500, 6); noise(t + 0.8, 0.03, 0.3, o, 'highpass', 3500); },
    empty: (o, t) => noise(t, 0.03, 0.2, o, 'bandpass', 2800, 2800, 8),
    switchWeapon: (o, t) => { noise(t, 0.06, 0.15, o, 'bandpass', 1800, 1200, 4); osc('square', 300, 200, t + 0.05, 0.05, 0.08, o); },

    shot_pistol: (o, t) => { noise(t, 0.12, 0.7, o, 'lowpass', 6000, 400, 0.7, 0.001); osc('sine', 260, 70, t, 0.1, 0.5, o, 0.001); noise(t, 0.03, 0.4, o, 'highpass', 5000, 5000, 0.7, 0.001); },
    shot_mg: (o, t) => { noise(t, 0.09, 0.6, o, 'lowpass', 5000, 500, 0.8, 0.001); osc('sawtooth', 180, 60, t, 0.08, 0.4, o, 0.001); },
    shot_sniper: (o, t, op) => {
      noise(t, 0.5, 1.0, o, 'lowpass', 7000, 200, 0.7, 0.001);
      osc('sine', 150, 28, t, 0.5, 0.9, o, 0.001);
      noise(t, 0.06, 0.6, o, 'highpass', 4000, 4000, 0.7, 0.001);
      if (!op.pos || op.own) { noise(t + 0.55, 0.05, 0.12, o, 'bandpass', 2000, 2000, 6); noise(t + 0.8, 0.04, 0.15, o, 'bandpass', 1500, 1500, 6); } // bolt
      echo(o, t, 0.22, 0.4);
    },
    shot_knife: (o, t) => noise(t, 0.15, 0.2, o, 'bandpass', 1500, 4000, 1.5, 0.03),
    // arsenal: every class has its own voice
    shot_hpistol: (o, t) => { noise(t, 0.2, 0.95, o, 'lowpass', 7000, 260, 0.7, 0.001); osc('sine', 190, 45, t, 0.16, 0.75, o, 0.001); noise(t, 0.04, 0.55, o, 'highpass', 5000, 5000, 0.7, 0.001); echo(o, t, 0.12, 0.25); },
    shot_smg: (o, t) => { noise(t, 0.06, 0.45, o, 'lowpass', 6200, 800, 0.8, 0.001); osc('square', 320, 130, t, 0.045, 0.22, o, 0.001); },
    shot_shotgun: (o, t, op) => { noise(t, 0.38, 1.15, o, 'lowpass', 4200, 140, 0.6, 0.001); osc('sine', 95, 32, t, 0.32, 1.0, o, 0.001); noise(t, 0.05, 0.6, o, 'highpass', 3500, 3500, 0.7, 0.001); echo(o, t, 0.18, 0.3);
      if (!op.pos || op.own) { noise(t + 0.42, 0.05, 0.16, o, 'bandpass', 1300, 1300, 5); noise(t + 0.62, 0.05, 0.18, o, 'bandpass', 1700, 1700, 5); } },   // pump
    shot_lmg: (o, t) => { noise(t, 0.11, 0.7, o, 'lowpass', 4600, 380, 0.8, 0.001); osc('sawtooth', 140, 48, t, 0.1, 0.42, o, 0.001); },
    shot_m4: (o, t) => { noise(t, 0.085, 0.55, o, 'lowpass', 5600, 620, 0.8, 0.001); osc('triangle', 230, 80, t, 0.07, 0.35, o, 0.001); noise(t, 0.02, 0.25, o, 'highpass', 6000, 6000, 0.7, 0.001); },
    shot_scout: (o, t, op) => { noise(t, 0.34, 0.8, o, 'lowpass', 7600, 300, 0.7, 0.001); osc('sine', 210, 40, t, 0.3, 0.62, o, 0.001); noise(t, 0.05, 0.5, o, 'highpass', 4500, 4500, 0.7, 0.001); echo(o, t, 0.2, 0.3);
      if (!op.pos || op.own) noise(t + 0.4, 0.04, 0.12, o, 'bandpass', 2200, 2200, 6); },
    bulletWhiz: (o, t) => { const x = osc('sawtooth', 3200, 900, t, 0.18, 0.1, o, 0.01); noise(t, 0.15, 0.08, o, 'bandpass', 4000, 1500, 2, 0.02); },
    bulletImpact: (o, t) => { noise(t, 0.08, 0.3, o, 'bandpass', 1800, 600, 2); osc('sine', 200, 80, t, 0.06, 0.15, o); },

    killstreakEarned: (o, t) => { tone(o, t, [523, 659, 784, 1046, 1318], 'square', 0.07, 0.22, 0.14); tone(o, t, [523, 659, 784, 1046, 1318], 'triangle', 0.07, 0.3, 0.14); },
    killstreakCall: (o, t) => { for (let i = 0; i < 5; i++) { osc('square', 1500, 1500, t + i * 0.1, 0.04, 0.08, o); noise(t + i * 0.1, 0.03, 0.08, o, 'highpass', 5000); } osc('sawtooth', 220, 880, t + 0.5, 0.5, 0.12, o); },
    heli: (o, t, op) => { const n = Math.floor((op.dur || 1.5) / 0.09); for (let i = 0; i < n; i++) { noise(t + i * 0.09, 0.07, 0.25, o, 'lowpass', 300, 120); } osc('sawtooth', 70, 70, t, op.dur || 1.5, 0.08, o); },
    nuke: (o, t) => {
      noise(t, 5, 1, o, 'lowpass', 3500, 40, 0.6, 0.02);
      osc('sine', 60, 15, t, 5, 1, o, 0.02);
      noise(t, 0.3, 0.8, o, 'highpass', 2000, 8000, 0.5, 0.001);
      osc('sawtooth', 2000, 100, t, 3, 0.15, o);
      echo(o, t, 0.4, 0.5);
    },
    nukeSiren: (o, t) => { for (let i = 0; i < 3; i++) osc('sawtooth', 500, 900, t + i * 1.0, 0.5, 0.15, o, 0.1), osc('sawtooth', 900, 500, t + i * 1.0 + 0.5, 0.5, 0.15, o, 0.1); },

    hit: (o, t) => { osc('square', 1200, 900, t, 0.06, 0.2, o, 0.001); noise(t, 0.04, 0.2, o, 'highpass', 4000); },
    headshot: (o, t) => { osc('square', 1800, 1400, t, 0.1, 0.25, o, 0.001); osc('triangle', 2400, 2400, t + 0.05, 0.12, 0.2, o); noise(t, 0.05, 0.3, o, 'highpass', 5000); },
    kill: (o, t) => { tone(o, t, [880, 1320], 'square', 0.06, 0.18, 0.16); osc('sine', 100, 50, t, 0.25, 0.3, o); },
    death: (o, t) => { osc('sawtooth', 300, 60, t, 0.9, 0.25, o, 0.01); noise(t, 0.5, 0.2, o, 'lowpass', 1500, 100); },
    hurt: (o, t) => { osc('sawtooth', 220, 120, t, 0.15, 0.25, o); noise(t, 0.1, 0.2, o, 'lowpass', 1200, 300); },

    roundStart: (o, t) => { tone(o, t, [440, 440, 880], 'square', 0.35, 0.2, 0.18); },
    roundWin: (o, t) => { tone(o, t, [523, 659, 784, 1046], 'triangle', 0.12, 0.5, 0.25); tone(o, t + 0.5, [784, 1046], 'square', 0.15, 0.6, 0.1); },
    roundLose: (o, t) => { tone(o, t, [392, 349, 311, 262], 'triangle', 0.18, 0.5, 0.25); },
    matchWin: (o, t) => { tone(o, t, [523, 659, 784, 1046, 784, 1046, 1318], 'triangle', 0.14, 0.6, 0.25); },
    matchLose: (o, t) => { tone(o, t, [330, 294, 262, 196], 'sawtooth', 0.28, 0.7, 0.12); }
  };
  S.land.power = 0.5;

  function play(name, opts) {
    opts = opts || {};
    if (!ok() || muted) return null;
    if (!S[name]) return null;
    const now = ctx.currentTime + 0.005;
    const sp = spatial(opts.pos, now);
    const g = ctx.createGain(); g.gain.value = (opts.volume == null ? 1 : opts.volume);
    g.connect(sp.node);
    try { S[name](g, sp.t, opts); } catch (e) { if (root.console) console.warn('audio', name, e); }
    return { name, delay: sp.t - now, dist: sp.dist };
  }
  function shot(weapon, pos, own) {
    const n = { sniper: 'shot_sniper', pistol: 'shot_pistol', mg: 'shot_mg', knife: 'shot_knife' }[weapon] || 'shot_pistol';
    return play(n, { pos: own ? null : pos, own: own, volume: own ? 1 : 0.9 });
  }
  function footstep(pos, surface, own) { return play('step', { pos: own ? null : pos, surface, volume: own ? 0.7 : 1 }); }
  function bombBeep(progress, pos) { return play('bombBeep', { pos, volume: 0.6 + 0.4 * (progress || 0) }); }
  function setListener(p, f) { L.p = p || L.p; L.f = f || L.f; }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : vol; }
  function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : vol; }
  function stopAll() { active.forEach(n => { try { n.stop(); } catch (e) {} }); active.clear(); }
  // bomb beeps helper: interval from progress (1s -> 0.1s)
  function bombBeepInterval(progress) { return Math.max(0.1, 1 - 0.9 * progress); }

  const api = { init, play, shot, footstep, bombBeep, bombBeepInterval, setListener, setVolume, setMuted, stopAll,
    names: Object.keys(S), get ctx() { return ctx; }, _defs: S };
  root.ChillAudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
