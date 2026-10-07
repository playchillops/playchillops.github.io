// announcer.js - Black Ops style announcer + medals + kill sounds (Juan 2026-10-06).
// Voice: the browser's speech synthesis (free, no audio files), low pitch, one line at a time, higher priority cuts lower.
// Medals: big text popups under the crosshair ("DOUBLE KILL +50"). Sounds: small WebAudio synths (kill ding, headshot tink, multi-kill sting).
const CSS = `.an-box{position:fixed;left:50%;top:31%;transform:translateX(-50%);z-index:44;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font-family:Fredoka,system-ui,sans-serif}
.an-m{font-weight:800;font-size:30px;letter-spacing:.1em;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.35),0 0 18px var(--c,#ffd166);animation:anin .32s cubic-bezier(.2,1.6,.4,1) both;transition:opacity .45s,transform .45s;white-space:nowrap}
.an-m small{display:block;text-align:center;font-size:14px;font-weight:600;letter-spacing:.16em;color:var(--c,#ffd166);text-shadow:0 1px 4px #000}
@keyframes anin{from{opacity:0;transform:scale(1.8)}to{opacity:1;transform:scale(1)}}
@media(max-width:700px){.an-m{font-size:20px}}`;
export function createAnnouncer({ volume = () => 1 } = {}) {
  if (!document.getElementById('an-css')) { const s = document.createElement('style'); s.id = 'an-css'; s.textContent = CSS; document.head.appendChild(s); }
  const box = document.createElement('div'); box.className = 'an-box'; document.body.appendChild(box);
  const syn = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  let voice = null, busyUntil = 0, curPrio = 0, ac = null;
  const pickVoice = () => { if (!syn) return; const vs = syn.getVoices().filter((v) => /^en/i.test(v.lang)); voice = vs.find((v) => /Daniel|Google UK English Male|Arthur|Fred|Alex|Male/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs[0] || null; };
  if (syn) { pickVoice(); try { syn.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
  function say(text, prio = 1) {
    const vol = volume(); if (!syn || !text || vol <= 0) return;
    const now = performance.now(); if (now < busyUntil && prio <= curPrio) return;
    try { syn.cancel(); const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.pitch = 0.62; u.rate = 1.06; u.volume = Math.min(1, vol * 1.1); syn.speak(u); } catch (e) { return; }
    curPrio = prio; busyUntil = now + 380 + text.length * 70;
  }
  function medal(text, sub, color = '#ffd166', secs = 2.2) {
    const m = document.createElement('div'); m.className = 'an-m'; m.style.setProperty('--c', color); m.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    box.appendChild(m); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { m.style.opacity = '0'; m.style.transform = 'translateY(-14px)'; setTimeout(() => m.remove(), 480); }, secs * 1000);
  }
  // ---- synth sounds ----
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; };
  function tone(f0, f1, dur, type = 'sine', gain = 0.25, at = 0) {
    const a = ctx(), vol = volume(); if (!a || vol <= 0) return; const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain = 0.2, hp = 2000, at = 0) {
    const a = ctx(), vol = volume(); if (!a || vol <= 0) return; const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = gain * vol; s.connect(f).connect(g).connect(a.destination); s.start(t);
  }
  const SOUNDS = {
    kill: () => { tone(880, 660, 0.09, 'triangle', 0.22); tone(1320, 1320, 0.12, 'sine', 0.14, 0.05); },
    headshot: () => { tone(2600, 1800, 0.16, 'sine', 0.22); tone(3900, 3100, 0.1, 'triangle', 0.1, 0.01); noise(0.05, 0.18, 4000); },
    multi: (n = 2) => { for (let i = 0; i < Math.min(5, n + 1); i++) tone(520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i), 0.11, 'square', 0.07, i * 0.07); },
    level: () => { tone(440, 880, 0.18, 'sawtooth', 0.08); tone(660, 1320, 0.22, 'triangle', 0.12, 0.08); },
    spray: () => noise(0.42, 0.16, 2600),
    death: () => tone(300, 90, 0.4, 'sawtooth', 0.08),
  };
  return {
    say, medal,
    sound(id, a) { try { (SOUNDS[id] || (() => {}))(a); } catch (e) {} },
    clear() { box.innerHTML = ''; try { syn && syn.cancel(); } catch (e) {} },
    dispose() { this.clear(); box.remove(); try { ac && ac.close(); } catch (e) {} },
  };
}
