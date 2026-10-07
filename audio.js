// audio.js - Sniper Chill procedural sound. Web Audio only, no assets, no deps.
// API:
//   initAudio(opts?)  -> audio object. Call once; safe before a user gesture. opts: {volume:0.8, ambient:true}
//                        Auto-resumes the AudioContext on first pointerdown/keydown/touchstart.
//   play(name, pos?)  -> pos {x,y,z} makes it positional (3D). No pos = plain stereo (own weapon/UI).
//   setListener(pos, forward, up?) -> call every frame with camera position and forward dir ({x,y,z}).
//   setVolume(v 0..1), startAmbient(), stopAmbient(), getContext()
// Names: shot_pistol, shot_mg, shot_sniper, reload, empty, footstep, hit, headshot, kill,
//        bomb_beep, bomb_plant, bomb_defuse, bomb_explode, bot_shot, hurt, ui_click
let ctx = null, master = null, comp = null, noiseBuf = null, amb = null, volume = 0.8, wantAmbient = true;
let lastPlay = {};

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  master = ctx.createGain(); master.gain.value = volume;
  master.connect(comp); comp.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

import './chillaudio.js';
const CA_MAP = { ui_click: 'uiClick', ui_hover: 'uiHover', ui_start: 'uiStart', ui_back: 'uiBack', bomb_beep: 'bombBeep', beep: 'bombBeep', bomb_explode: 'bombExplosion', bomb_plant: 'bombPlanted', bomb_defuse: 'bombDefused',
  reload: 'reload', kill: 'kill', hurt: 'hurt', hit: 'hit', headshot: 'headshot', footstep: 'step', empty: 'empty', bot_shot: 'shot_mg', jump: 'jump', land: 'land', buy: 'buy', buy_fail: 'buyFail',
  streak_earned: 'killstreakEarned', streak_call: 'killstreakCall', nuke: 'nuke', nuke_siren: 'nukeSiren', round_win: 'roundWin', round_lose: 'roundLose', match_win: 'matchWin', match_lose: 'matchLose', death: 'death',
  shot_pistol: 'shot_pistol', shot_mg: 'shot_mg', shot_sniper: 'shot_sniper', shot_knife: 'shot_knife', shot_hpistol: 'shot_hpistol', shot_smg: 'shot_smg', shot_shotgun: 'shot_shotgun', shot_lmg: 'shot_lmg', shot_m4: 'shot_m4', shot_scout: 'shot_scout',
  plant_start: 'bombPlant', defuse_start: 'bombDefuseStart', round_start: 'roundStart', switch: 'switchWeapon', heli: 'heli', whiz: 'bulletWhiz', impact: 'bulletImpact' };
let caReady = false;
(function caUnlock() { const go = () => { try { if (window.ChillAudio && window.ChillAudio.init()) caReady = true; } catch (e) {} }; for (const ev of ['pointerdown', 'keydown', 'click']) document.addEventListener(ev, go, { capture: true }); })();
export function initAudio(opts = {}) {
  if (opts.volume != null) volume = opts.volume;
  if (opts.ambient != null) wantAmbient = opts.ambient;
  const unlock = () => {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (wantAmbient) startAmbient();
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, unlock));
  };
  if (typeof window !== 'undefined') ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock));
  return { play, setListener, setVolume, startAmbient, stopAmbient, getContext: () => ctx };
}

export function getContext() { return ctx; }
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

export function setListener(p, f, up = { x: 0, y: 1, z: 0 }) {
  if (caReady) { try { window.ChillAudio.setListener(p, f); } catch (e) {} }
  if (!ctx) return;
  const L = ctx.listener;
  if (L.positionX) {
    L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
    L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z;
    L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
  } else {
    L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, up.x, up.y, up.z);
  }
}

// output node: panner if pos given, else master
function out(pos, t) {
  if (!pos) return master;
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = 3; p.maxDistance = 80; p.rolloffFactor = 1.4;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 0; p.positionZ.value = pos.z; }
  else p.setPosition(pos.x, pos.y ?? 0, pos.z);
  p.connect(master);
  return p;
}

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function tone(o, type, f0, f1, t, dur, peak, a = 0.005, detune = 0) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  osc.detune.value = detune;
  env(g, t, a, peak, dur); osc.connect(g); g.connect(o);
  osc.start(t); osc.stop(t + dur + a + 0.05);
}
function noise(o, t, dur, peak, ftype, f0, f1, q = 1, a = 0.002) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  env(g, t, a, peak, dur);
  s.connect(f); f.connect(g); g.connect(o);
  s.start(t, Math.random()); s.stop(t + dur + a + 0.05);
}

const R = (a, b) => a + Math.random() * (b - a);

const SOUNDS = {
  shot_pistol(o, t) {
    noise(o, t, 0.12, 0.7, 'bandpass', 2500, 700, 0.8);
    tone(o, 'triangle', 320, 70, t, 0.12, 0.6);
  },
  shot_mg(o, t) {
    noise(o, t, 0.07, 0.5, 'bandpass', 1800, 500, 0.9);
    tone(o, 'square', R(170, 200), 60, t, 0.07, 0.35);
  },
  shot_sniper(o, t) {
    noise(o, t, 0.5, 0.9, 'lowpass', 5000, 300, 0.5);
    tone(o, 'sawtooth', 220, 35, t, 0.4, 0.8);
    noise(o, t + 0.12, 0.9, 0.18, 'bandpass', 900, 250, 0.6, 0.05); // echo tail
  },
  bot_shot(o, t) { noise(o, t, 0.1, 0.4, 'bandpass', 1500, 500, 0.9); tone(o, 'triangle', 260, 70, t, 0.09, 0.3); },
  reload(o, t) {
    noise(o, t, 0.04, 0.5, 'highpass', 3000, 3000, 2);           // mag out click
    tone(o, 'square', 900, 500, t, 0.04, 0.15);
    noise(o, t + 0.45, 0.05, 0.6, 'highpass', 2500, 2500, 2);     // mag in
    tone(o, 'square', 500, 300, t + 0.45, 0.06, 0.2);
    tone(o, 'square', 1200, 700, t + 0.75, 0.04, 0.2);            // chamber
    noise(o, t + 0.75, 0.05, 0.5, 'highpass', 3500, 3500, 2);
  },
  empty(o, t) { tone(o, 'square', 1500, 900, t, 0.03, 0.25); },
  footstep(o, t) {
    noise(o, t, 0.09, 0.35, 'lowpass', R(500, 800), 180, 0.7, 0.005);
    tone(o, 'sine', R(70, 95), 45, t, 0.08, 0.3);
  },
  hit(o, t) { tone(o, 'sine', 1400, 1000, t, 0.06, 0.4); },
  headshot(o, t) {
    tone(o, 'sine', 1800, 1800, t, 0.1, 0.45);
    tone(o, 'sine', 2700, 2700, t + 0.07, 0.25, 0.4);
    noise(o, t, 0.06, 0.4, 'highpass', 4000, 4000, 1);
  },
  kill(o, t) { [660, 880, 1320].forEach((f, i) => tone(o, 'triangle', f, f, t + i * 0.07, 0.15, 0.3)); },
  hurt(o, t) { tone(o, 'sawtooth', 200, 80, t, 0.2, 0.4); noise(o, t, 0.15, 0.3, 'lowpass', 800, 200); },
  ui_click(o, t) { tone(o, 'sine', 800, 800, t, 0.04, 0.25); },
  bomb_beep(o, t) { tone(o, 'square', 1800, 1800, t, 0.09, 0.3, 0.002); },
  bomb_plant(o, t) {
    [0, 0.18, 0.36].forEach((d, i) => tone(o, 'square', 600 + i * 200, 600 + i * 200, t + d, 0.12, 0.3));
    tone(o, 'sine', 200, 120, t + 0.6, 0.3, 0.4);
  },
  bomb_defuse(o, t) {
    [1200, 1000, 800, 1500].forEach((f, i) => tone(o, 'triangle', f, f, t + i * 0.12, 0.1, 0.35));
    tone(o, 'sine', 1500, 1500, t + 0.5, 0.5, 0.35);
  },
  bomb_explode(o, t) {
    noise(o, t, 2.2, 1.0, 'lowpass', 3000, 60, 0.6, 0.005);
    tone(o, 'sine', 90, 25, t, 1.6, 1.0);
    noise(o, t + 0.2, 1.5, 0.4, 'bandpass', 400, 100, 0.5, 0.1);
  },
};

// cooldowns (seconds) so spam (mg, footsteps) doesn't stack into clipping
const COOLDOWN = { shot_mg: 0.04, footstep: 0.12, hit: 0.03, bomb_beep: 0.05 };

export function play(name, pos) {
  const cm = CA_MAP[name];
  if (cm && caReady) { try { const o = {}; if (pos && typeof pos.x === 'number') o.pos = { x: pos.x, y: pos.y, z: pos.z }; if (name === 'footstep' || name === 'jump' || name === 'land') o.volume = 0.8; return window.ChillAudio.play(cm, o) !== false; } catch (e) {} }
  const c = ensure();
  if (!c || !SOUNDS[name]) return false;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  if (COOLDOWN[name] && lastPlay[name] && t - lastPlay[name] < COOLDOWN[name]) return false;
  lastPlay[name] = t;
  const o = out(pos, t);
  SOUNDS[name](o, t + 0.005);
  if (o !== master) setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 4000);
  return true;
}

export function startAmbient() {
  const c = ensure(); if (!c || amb) return;
  const g = c.createGain(); g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(0.12, c.currentTime + 3);
  g.connect(master);
  // wind: slow-swept filtered noise
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6;
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 250;
  lfo.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g);
  s.start(); lfo.start();
  // soft chill pad: Am7-ish drone
  const pad = c.createGain(); pad.gain.value = 0.05; pad.connect(g);
  const oscs = [110, 164.81, 196, 246.94].map((fr, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr; o.detune.value = i * 3 - 4;
    o.connect(pad); o.start(); return o;
  });
  // birds
  const birds = setInterval(() => {
    if (!ctx || ctx.state !== 'running' || Math.random() < 0.5) return;
    const t = ctx.currentTime, b = ctx.createGain(); b.gain.value = 0.25; b.connect(g);
    const base = R(2200, 3600);
    for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone(b, 'sine', base, base * R(1.1, 1.4), t + i * 0.11, 0.08, 0.2);
  }, 2500);
  amb = { g, s, lfo, oscs, birds };
}

export function stopAmbient() {
  if (!amb) return;
  clearInterval(amb.birds);
  amb.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
  const a = amb; amb = null;
  setTimeout(() => { try { a.s.stop(); a.lfo.stop(); a.oscs.forEach(o => o.stop()); a.g.disconnect(); } catch (e) {} }, 1200);
}
