// callingcard.js - killer's calling card when you die (Juan 2026-10-07): their company logo, legend, prestige, the gun, distance,
// HP left, match K/D, and tags: NEMESIS (killed you 3+ more times than you killed them), ON A STREAK, HEADSHOT, FIRST BLOOD.
// Killing your nemesis gets a medal. Counts are per match, client side (from the kill events).
import { legendOf } from './common.js';
import { WEAPONS } from './player.js';
import { emblemSVG } from './emblem.js';
import { logoUrl } from './account.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
const ART = { jobs: ['#2b2b30', '#9ba1aa'], zuck: ['#0b3d91', '#1877f2'], altman: ['#0d3b33', '#10a37f'], musk: ['#1a1a1a', '#cc2222'], bezos: ['#232f3e', '#ff9900'], jensen: ['#1c2a0c', '#76b900'], gates: ['#0a3a66', '#00a4ef'], lisa: ['#3a0a10', '#ed1c24'] };
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
const wname = (w) => (WEAPONS[w] ? WEAPONS[w].name : { knife: 'Knife', streak: 'Killstreak', taser: 'Zap Taser', starship: 'Starship exhaust', frag: 'Frag' }[w] || '');
const CSS = `.cc{position:fixed;left:50%;bottom:16%;z-index:41;transform:translateX(-50%);width:min(500px,92vw);display:flex;align-items:stretch;border-radius:16px;overflow:hidden;pointer-events:none;font-family:Fredoka,system-ui,sans-serif;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:ccin .35s cubic-bezier(.2,1.3,.4,1);border:2px solid rgba(255,255,255,.25)}
@keyframes ccin{from{opacity:0;transform:translate(-50%,30px) scale(.95)}}
.cc .lg{position:relative;width:96px;flex:0 0 96px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)}
.cc .lg span{width:66px;height:66px;border-radius:14px;background:#fff center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:#1b2033;font-weight:800;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.cc .lg .emb{position:absolute;right:6px;bottom:6px}
.cc .bd{flex:1;padding:10px 14px;min-width:0}.cc .k{font-size:10px;letter-spacing:.28em;opacity:.8}.cc .n{font-size:24px;font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc .s{font-size:12px;opacity:.9;margin:1px 0 6px}.cc .ch{display:flex;gap:5px;flex-wrap:wrap}.cc .ch i{font-style:normal;font-size:11px;font-weight:700;padding:2px 7px;border-radius:7px;background:rgba(0,0,0,.35)}
.cc .tag{position:absolute;right:-6px;top:10px;transform:rotate(8deg);padding:4px 12px;border-radius:8px;font-weight:800;letter-spacing:.14em;font-size:14px;background:#ff3b3b;box-shadow:0 3px 10px rgba(0,0,0,.4)}
.cc-on .sp-ban{display:none!important}`;
export function createCallingCards({ game, net, an }) {
  if (!document.getElementById('cc-css')) { const s = document.createElement('style'); s.id = 'cc-css'; s.textContent = CSS; document.head.appendChild(s); }
  const by = new Map(), mine = new Map(), K = new Map(), D = new Map(); let card = null, hideT = 0;   // K / D: this match, from every kill event
  const lead = (id) => (by.get(id) || 0) - (mine.get(id) || 0);
  function hide() { if (card) { card.remove(); card = null; } document.body.classList.remove('cc-on'); clearTimeout(hideT); }
  function show(m) {
    hide(); const r = net.roster.get(m.by) || {}, lg = legendOf(r.ch), [c0, c1] = ART[r.ch] || ['#1b2340', '#7a3cff'];
    const b = game.bots.list.find((x) => x.netId === m.by), e = net.eye(), dist = b && b.net ? Math.round(Math.hypot(e.x - b.net.x, e.z - b.net.z)) : 0, hp = b && b.net ? Math.max(0, b.net.hp | 0) : 0;
    const tags = []; if (lead(m.by) >= 3) tags.push('NEMESIS'); else if (m.ks >= 3) tags.push(m.ks + ' KILL STREAK'); else if (m.hs) tags.push('HEADSHOT'); else if (m.fb) tags.push('FIRST BLOOD');
    card = document.createElement('div'); card.className = 'cc'; card.style.background = `linear-gradient(115deg,${c0} 0%,${c0} 55%,${c1} 55.2%,${c1} 62%,${c0} 62.2%)`;
    const co = r.co || (r.b && lg ? lg.co : ''), st = r.st || (r.b && lg ? lg.site : ''), ini = esc((co || r.name || '?').trim().slice(0, 2).toUpperCase());   // bots carry their legend's company
    card.innerHTML = `<div class="lg"><span style="${st ? `background-image:url('${logoUrl(st)}')` : ''}">${st ? '' : ini}</span>${r.pr ? emblemSVG(r.pr, 22) : ''}</div>
      <div class="bd"><div class="k">KILLED BY</div><div class="n" style="color:${TEAMC[r.team] || '#fff'}">${esc(r.name || 'Someone')}</div>
      <div class="s">${lg && !r.b ? 'as ' + esc(lg.name) + ' · ' : ''}${esc(co)}${r.b ? ' · bot' : ''}</div>
      <div class="ch">${wname(m.w) ? `<i>${esc(wname(m.w))}</i>` : ''}${dist ? `<i>${dist} m</i>` : ''}${b ? `<i>${hp} HP left</i>` : ''}<i>K/D ${K.get(m.by) || 0}/${D.get(m.by) || 0}</i>${lead(m.by) > 0 ? `<i>killed you ${by.get(m.by)}x</i>` : ''}</div></div>
      ${tags[0] ? `<div class="tag" style="${tags[0] === 'NEMESIS' ? '' : 'background:#ffb347;color:#1b2033'}">${tags[0]}</div>` : ''}`;
    document.body.appendChild(card); document.body.classList.add('cc-on'); hideT = setTimeout(hide, 3400);
  }
  net.on('kill', (m) => {
    if (!m) return;
    if (m.by && m.by !== m.id) K.set(m.by, (K.get(m.by) || 0) + 1); D.set(m.id, (D.get(m.id) || 0) + 1);
    if (m.id === net.id && m.by && m.by !== net.id) { by.set(m.by, (by.get(m.by) || 0) + 1); show(m); }
    else if (m.by === net.id && m.id !== net.id) { const was = lead(m.id) >= 3; mine.set(m.id, (mine.get(m.id) || 0) + 1); if (was) { an.medal('NEMESIS DOWN', 'REVENGE IS SWEET', '#ff3b3b', 2.6); an.say('Nemesis down', 3); } }
  });
  net.on('round_start', (m) => { if (m && (m.dm || m.round === 1)) { by.clear(); mine.clear(); K.clear(); D.clear(); } hide(); });
  net.on('respawn', (m) => { if (m && m.id === net.id) hide(); });
  return {
    /** the player who has killed you the most (3+ ahead), for the scoreboard */
    get nemesis() { let best = 0, id = 0; for (const [k] of by) { const l = lead(k); if (l >= 3 && l > best) { best = l; id = k; } } return id; },
    hide, dispose() { hide(); },
  };
}
