// voices.js - legend voice lines (Juan 2026-10-07): Z taunts, kill lines, superpower lines, each legend with its own voice
// (browser speech synthesis: pitch / rate / a different system voice when there are several) and a speech bubble over the speaker.
// Parody one-liners, nothing official. The server picks the taunt index so everyone hears the same line ('taunt').
import { legendOf, isFree } from './common.js';
import { wallBlocked } from './hitscan.js';
export const LINES = {
  jobs: { taunt: ['One more thing.', 'Stay hungry. Stay foolish.', 'It just works.', 'Think different.'], kill: ['It just works.', 'Insanely great.', 'Boom. That is it.'], power: 'And one more thing.' },
  zuck: { taunt: ['Move fast and break things.', 'Senator, we run ads.', 'Welcome to the metaverse.', 'Is this the metaverse?'], kill: ['Move fast. Break things.', 'Connection removed.', 'Thanks for the data.'], power: 'Welcome to the metaverse.' },
  altman: { taunt: ['Feel the A G I.', 'This is the worst it will ever be.', 'We need more compute.', 'Scale is all you need.'], kill: ['You have been deprecated.', 'Alignment failed.', 'Context window closed.'], power: 'A G I achieved internally.' },
  musk: { taunt: ['Occupy Mars!', 'Let that sink in.', 'First principles.', 'Full send.'], kill: ['Rapid unscheduled disassembly.', 'Ratio.', 'Funding secured.'], power: 'Occupy Mars!' },
  bezos: { taunt: ['It is still day one.', 'Your package is out for delivery.', 'Customer obsession!', 'Ha ha ha ha ha!'], kill: ['Delivered.', 'Same day delivery.', 'Return to sender.'], power: 'Prime delivery!' },
  jensen: { taunt: ['The more you buy, the more you save.', 'Accelerated computing!', 'R T X on.', 'Nice jacket, right?'], kill: ['Ray traced.', 'Frame generated.', 'Overclocked.'], power: 'The more you buy, the more you save!' },
  gates: { taunt: ['Have you tried turning it off and on again?', 'Clippy says hi.', 'Control, alt, delete.', 'Your PC needs to restart.'], kill: ['Blue screen.', 'Fatal exception.', 'Update installed.'], power: 'Have you tried turning it off and on again?' },
  hawking: { taunt: ['Look up at the stars.', 'Time for a quantum leap.', 'The universe has no limits.', 'Keep moving forward.'], kill: ['A singularity.', 'Event horizon crossed.', 'Quantum precision.'], power: 'Quantum dash engaged.' },
  lisa: { taunt: ['Performance per watt!', 'Team red, let us go.', 'More cores!', 'We are just getting started.'], kill: ['Outperformed.', 'Benchmark that.', 'Too many cores.'], power: 'Turbo boost!' },
};
const VOICE = { hawking: [1.0, 1.15], jobs: [0.95, 0.95], zuck: [1.15, 1.12], altman: [1.05, 0.98], musk: [0.88, 0.92], bezos: [0.72, 1.0], jensen: [1.0, 1.1], gates: [1.12, 1.04], lisa: [1.18, 1.02, 'f'] };   // pitch, rate, female
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
const CSS = `.vb{position:fixed;z-index:42;transform:translate(-50%,-100%);pointer-events:none;max-width:280px;padding:7px 12px;border-radius:14px;background:#fff;color:#1b2033;font:700 14px Fredoka,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35);animation:vbin .2s ease-out;white-space:normal;text-align:center}
.vb:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-top-color:#fff;border-bottom:0}.vb small{display:block;font-size:10px;letter-spacing:.14em;color:var(--c)}
.vb.me{left:50%!important;top:auto!important;bottom:150px;transform:translateX(-50%)}
@keyframes vbin{from{opacity:0;transform:translate(-50%,-80%) scale(.85)}}`;
export function createVoices({ game, net, an, THREE }) {
  if (!document.getElementById('vb-css')) { const s = document.createElement('style'); s.id = 'vb-css'; s.textContent = CSS; document.head.appendChild(s); }
  const syn = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null, bubbles = [], v3 = new THREE.Vector3();
  let lastTaunt = 0;
  const chOf = (id) => { const r = net.roster.get(id); return (r && r.ch) || (id === net.id ? net.ch : ''); };
  const posOf = (id) => { if (id === net.id) return null; const b = game.bots.list.find((x) => x.netId === id); return b && b.net ? b.net : null; };
  function voiceFor(ch) {   // spread the system voices over the legends (male / female)
    if (!syn) return null; const all = syn.getVoices().filter((v) => /^en/i.test(v.lang)); if (!all.length) return null;
    const fem = all.filter((v) => /Samantha|Karen|Victoria|Moira|Tessa|Fiona|Female|Zira|Susan|Serena/i.test(v.name)), male = all.filter((v) => !fem.includes(v));
    const pool = VOICE[ch] && VOICE[ch][2] === 'f' ? (fem.length ? fem : all) : (male.length ? male : all), i = Object.keys(VOICE).indexOf(ch);
    return pool[Math.max(0, i) % pool.length];
  }
  function speak(id, text, prio = 1, kind = '') {
    const ch = chOf(id), lg = legendOf(ch); if (!text || !lg) return;
    const p = posOf(id), me = id === net.id; let near = 1;
    if (!me && p) { const e = net.eye(); const d = Math.hypot(e.x - p.x, e.z - p.z); if (d > 45) return; near = Math.max(0.25, 1 - d / 45); }
    const [pitch, rate] = VOICE[ch] || [1, 1]; an.say(text, prio, { voice: voiceFor(ch), pitch, rate, vol: near });
    const r = net.roster.get(id), el = document.createElement('div'); el.className = 'vb' + (me ? ' me' : ''); if (!me) el.style.display = 'none'; el.style.setProperty('--c', TEAMC[(r && r.team) || net.team] || '#7a3cff');
    el.innerHTML = `<small>${esc(lg.name.toUpperCase())}${kind ? ' · ' + kind : ''}</small>${esc(text)}`; document.body.appendChild(el);
    bubbles.push({ el, id, until: performance.now() + 2600 + text.length * 40 }); while (bubbles.length > 4) bubbles.shift().el.remove();
  }
  net.on('gnade', (m) => { if (m && m.by !== net.id) speak(m.by, 'Fire in the hole!', 2.5, 'GRENADE'); });
  net.on('taunt', (m) => { if (m) speak(m.id, (LINES[chOf(m.id)] || {}).taunt?.[m.i % 4], 1.5); });
  net.on('kill', (m) => {   // the killer's line, heard by the killer and the victim
    if (!m || !m.by || m.by === m.id || (m.by !== net.id && m.id !== net.id)) return; const L = LINES[chOf(m.by)]; if (!L) return;
    const line = L.kill[Math.floor(Math.random() * L.kill.length)]; setTimeout(() => speak(m.by, line, 1.2), m.by === net.id ? 900 : 350);
  });
  net.on('power', (m) => { if (m && LINES[m.ch]) speak(m.id, LINES[m.ch].power, 3, 'POWER'); });
  return {
    /** Z: taunt (server picks the line, 4 s cooldown) */
    taunt() { if (!net.alive || performance.now() - lastTaunt < 4000) return; lastTaunt = performance.now(); net.sendRaw({ t: 'taunt' }); },
    update() {
      const now = performance.now(), cam = game.camera;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; if (now > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
        if (b.id === net.id) continue; const p = posOf(b.id); if (!p) { b.el.style.display = 'none'; continue; }
        v3.set(p.x, p.y + 2.35, p.z).project(cam); const eye = cam.position, target = {x:p.x,y:p.y + (p.crouch ? 0.8 : 1.2),z:p.z}, dir = {x:target.x-eye.x,y:target.y-eye.y,z:target.z-eye.z}, dist = Math.hypot(dir.x,dir.y,dir.z);
        const blocked = !game.world || wallBlocked(eye, dir, dist, game.world, 0.02);
        const vis = !blocked && v3.z > -1 && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && !p.cloak;
        b.el.style.display = vis ? '' : 'none'; if (vis) { b.el.style.left = ((v3.x + 1) / 2 * 100) + '%'; b.el.style.top = ((1 - v3.y) / 2 * 100) + '%'; }
      }
    },
    dispose() { for (const b of bubbles) b.el.remove(); bubbles.length = 0; },
  };
}
