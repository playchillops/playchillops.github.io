// music.js - tiny procedural chill/lofi music (WebAudio, no assets). Menu = softer, match = a bit more pulse.
import { getContext } from './audio.js';
let ctx = null, out = null, timer = null, nextT = 0, step = 0, mode = 'menu', on = true, level = 0.5, master = 1, noise = null, started = false;
const PROG = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];   // Fmaj7 Em7 Dm7 Cmaj7
const SCALE = [0, 2, 4, 7, 9];                                                              // pentatonic for the little lead
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function setup() {
  ctx = getContext(); if (!ctx || out) return !!ctx;
  out = ctx.createGain(); out.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  out.connect(lp); lp.connect(ctx.destination);
  const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noise = n;
  return true;
}
function applyGain() { if (out) out.gain.setTargetAtTime(on ? level * master * 0.35 : 0, ctx.currentTime, 0.15); }
function tone(m, t, dur, type, g, det = 0) {
  const o = ctx.createOscillator(), v = ctx.createGain(); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.02); v.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(v); v.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function hat(t, g) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0006, t + 0.05); s.connect(f); f.connect(v); v.connect(out); s.start(t, Math.random() * 0.5, 0.06); }
function kick(t) { const o = ctx.createOscillator(), v = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); v.gain.setValueAtTime(0.55, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(v); v.connect(out); o.start(t); o.stop(t + 0.22); }
const BEAT = 60 / 74;
function sched() {
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % 4, s8 = step % 8, ch = PROG[bar], t = nextT, swing = (s8 % 2) ? BEAT * 0.06 : 0;
    if (s8 === 0) { ch.forEach((m, i) => tone(m, t + i * 0.012, BEAT * 3.6, 'triangle', 0.16, i * 3)); tone(ch[0] - 24, t, BEAT * 2.2, 'sine', 0.3); }
    if (s8 === 4) tone(ch[0] - 24, t, BEAT * 1.5, 'sine', 0.22);
    if (mode === 'match') { if (s8 === 0 || s8 === 5) kick(t); }
    if (s8 % 2 === 1 || mode === 'match') hat(t + swing, mode === 'match' ? 0.05 : 0.03);
    if (Math.random() < (mode === 'match' ? 0.35 : 0.5) && s8 % 2 === 0) tone(ch[1] + 12 + SCALE[(Math.random() * 5) | 0], t + swing, BEAT * 1.4, 'sine', 0.09);
    nextT += BEAT / 2; step++;
  }
}
export function startMusic(m = 'menu') {
  mode = m; if (!setup()) return; applyGain();
  if (timer) return; nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(() => { try { sched(); } catch (e) {} }, 120); started = true;
}
export function stopMusic() { if (timer) { clearInterval(timer); timer = null; } if (out) out.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
export function setMusicMode(m) { mode = m; }
export function setMusicLevel(vol, masterVol, enabled) { level = vol; master = masterVol; on = enabled; applyGain(); }
export const musicRunning = () => !!timer;
