// matchsummary.js - end-of-match screen (Juan 2026-10-06): MVP card, full scoreboard (K / D / headshots / accuracy / damage /
// favourite weapon) and the best player of every company in the room. Data = the server's 'summary' message (room.js summary()).
import { ICONS } from './economy.js';
import { WEAPONS } from './player.js';
import { DM, GUN_ORDER } from './common.js';
import { emblemSVG } from './emblem.js';
import { logoUrl } from './account.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' }, TEAMN = { T: 'Orange', CT: 'Cyan', Z: 'Green' };
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
const pct = (a, b) => (b ? Math.round(100 * a / b) + '%' : '-');
const wname = (id) => (WEAPONS[id] ? WEAPONS[id].name : id === 'knife' ? 'Knife' : id === 'streak' ? 'Killstreaks' : '-');
const wicon = (id, s = 30) => { const d = ICONS[id] || (id === 'knife' ? ICONS.knifeskin : ''); return d ? `<svg viewBox="0 0 76 76" width="${s}" height="${s * 0.7}" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"><path d="${d}"/></svg>` : ''; };
const logo = (st, co, s = 34) => { const ini = esc((co || '?').trim().slice(0, 2).toUpperCase()); return `<span class="ms-logo" style="width:${s}px;height:${s}px;font-size:${s * 0.38}px">${ini}${st ? `<img src="${logoUrl(st)}" alt="" onerror="this.remove()" onload="this.parentNode.classList.add('img')">` : ''}</span>`; };
const CSS = `.ms{position:fixed;inset:0;z-index:9440;display:flex;align-items:center;justify-content:center;background:rgba(5,9,20,.82);backdrop-filter:blur(4px);font-family:Fredoka,system-ui,sans-serif;color:#fff;animation:msin .35s ease-out}
@keyframes msin{from{opacity:0}to{opacity:1}}
.ms-w{width:min(1060px,95vw);max-height:92vh;overflow:auto;padding:22px 24px 18px;border-radius:22px;background:#111833;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 70px rgba(0,0,0,.6)}
.ms-h{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.ms-h h2{margin:0;font-size:40px;letter-spacing:.1em}.ms-h span{opacity:.7;letter-spacing:.14em;font-size:14px}
.ms-g{display:grid;grid-template-columns:290px 1fr;gap:18px;margin-top:14px}@media(max-width:820px){.ms-g{grid-template-columns:1fr}}
.ms-mvp{border-radius:18px;padding:16px;background:linear-gradient(160deg,#3a2a12,#1a1830 60%);border:2px solid #ffd166;box-shadow:0 0 30px rgba(255,209,102,.25);text-align:center}
.ms-mvp .t{font-size:13px;letter-spacing:.4em;color:#ffd166}.ms-mvp .n{font-size:30px;font-weight:700;margin:6px 0 2px;display:flex;align-items:center;justify-content:center;gap:6px}
.ms-mvp .c{display:flex;align-items:center;justify-content:center;gap:8px;opacity:.9;margin-bottom:10px}
.ms-st{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ms-st div{background:#0007;border-radius:10px;padding:6px 4px}.ms-st b{display:block;font-size:22px}.ms-st small{font-size:10px;letter-spacing:.16em;opacity:.7}
.ms-logo{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;background:#2a3358;font-weight:700;overflow:hidden;flex:0 0 auto}
.ms-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:3px;box-sizing:border-box}
table.ms-t{width:100%;border-collapse:collapse;font-size:15px}.ms-t th{font-size:10px;letter-spacing:.16em;opacity:.6;font-weight:600;text-align:right;padding:4px 6px}.ms-t th:nth-child(-n+2){text-align:left}
.ms-t td{padding:6px;text-align:right;border-top:1px solid rgba(255,255,255,.08)}.ms-t td:nth-child(-n+2){text-align:left}.ms-t tr.me td{background:rgba(255,255,255,.08)}.ms-t tr.win td:first-child{box-shadow:inset 3px 0 #7dffb0}
.ms-t .nm{display:flex;align-items:center;gap:7px;white-space:nowrap}.ms-t .wp{display:inline-flex;align-items:center;gap:5px;justify-content:flex-end;opacity:.9;font-size:13px}
.ms-co{margin-top:14px}.ms-co h4{margin:0 0 8px;font-size:12px;letter-spacing:.3em;opacity:.7;font-weight:600}.ms-chips{display:flex;flex-wrap:wrap;gap:8px}
.ms-chip{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:12px;background:#1d2547;border:1px solid rgba(255,255,255,.12);font-size:14px}.ms-chip b{display:block}.ms-chip small{opacity:.7}
.ms-go{margin-top:16px;display:flex;justify-content:flex-end;gap:12px;align-items:center}.ms-go small{opacity:.55;letter-spacing:.12em;font-size:11px}
.ms-go button{font:700 17px Fredoka,system-ui,sans-serif;padding:11px 28px;border:0;border-radius:12px;background:#ffd166;color:#1b2033;cursor:pointer}`;
export function showSummary(m, { myId, myTeam, onClose } = {}) {
  if (!document.getElementById('ms-css')) { const s = document.createElement('style'); s.id = 'ms-css'; s.textContent = CSS; document.head.appendChild(s); }
  document.querySelector('.ms')?.remove();
  const list = (m.list || []).slice(), me = list.find((r) => r.id === myId), mvp = list.find((r) => r.id === m.mvp), gun = m.mode === 'gun', dm = DM[m.mode];
  const won = me ? !!me.w : false, draw = !list.some((r) => r.w);
  const sc = (r) => (gun ? r.gl * 1000 + r.k : r.k * 100 + r.dmg / 10 - r.d);
  list.sort((a, b) => b.w - a.w || sc(b) - sc(a));
  const sub = dm ? dm.name.toUpperCase() : 'BOMB DEFUSAL';
  const scoreLine = m.mode === 'tdm' ? `<span style="color:${TEAMC.T}">${m.score.T || 0}</span> - <span style="color:${TEAMC.CT}">${m.score.CT || 0}</span>` : !dm ? `${m.score.T || 0} - ${m.score.CT || 0}${m.mode === 'ffa3' ? ' - ' + (m.score.Z || 0) : ''}` : '';
  const row = (r, i) => `<tr class="${r.id === myId ? 'me' : ''} ${r.w ? 'win' : ''}"><td style="opacity:.6">${i + 1}</td><td><span class="nm">${logo(r.st, r.co, 24)}${emblemSVG(r.pr, 16)}<span style="color:${TEAMC[r.t] || '#fff'}">${esc(r.n)}</span>${r.b ? '<small style="opacity:.5">BOT</small>' : r.co ? `<small style="opacity:.55">${esc(r.co)}</small>` : ''}${r.id === m.mvp ? ' <b style="color:#ffd166;font-size:11px;letter-spacing:.14em">MVP</b>' : ''}</span></td>
    ${gun ? `<td>${Math.min(r.gl + 1, GUN_ORDER.length)}/${GUN_ORDER.length}</td>` : ''}<td><b>${r.k}</b></td><td>${r.d}</td><td>${pct(r.hs, r.k)}</td><td>${pct(r.hi, r.sh)}</td><td>${r.dmg}</td><td><span class="wp">${r.top ? wicon(r.top, 26) + esc(wname(r.top)) : '-'}</span></td></tr>`;
  const comp = (m.comp || []).map((id) => list.find((r) => r.id === id)).filter(Boolean);
  const el = document.createElement('div'); el.className = 'ms';
  el.innerHTML = `<div class="ms-w"><div class="ms-h"><h2 style="color:${draw ? '#fff' : won ? '#7dffb0' : '#ffb4a8'}">${draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}</h2><span>${sub}</span>${scoreLine ? `<span style="font-size:22px;opacity:1;font-weight:700">${scoreLine}</span>` : ''}</div>
<div class="ms-g">${mvp ? `<div class="ms-mvp"><div class="t">MVP</div><div class="n">${emblemSVG(mvp.pr, 26)}<span style="color:${TEAMC[mvp.t] || '#fff'}">${esc(mvp.n)}</span></div><div class="c">${mvp.b ? '<span style="opacity:.6">Bot</span>' : logo(mvp.st, mvp.co, 40) + `<span>${esc(mvp.co || 'No company')}</span>`}</div>
<div class="ms-st"><div><b>${mvp.k}</b><small>KILLS</small></div><div><b>${mvp.d ? (mvp.k / mvp.d).toFixed(2) : mvp.k}</b><small>K / D</small></div><div><b>${pct(mvp.hs, mvp.k)}</b><small>HEADSHOTS</small></div><div><b>${pct(mvp.hi, mvp.sh)}</b><small>ACCURACY</small></div><div><b>${mvp.dmg}</b><small>DAMAGE</small></div><div style="color:#ffd166">${mvp.top ? wicon(mvp.top, 34) : '<b>-</b>'}<small style="display:block">${esc(wname(mvp.top)).toUpperCase()}</small></div></div></div>` : '<div></div>'}
<div><table class="ms-t"><tr><th>#</th><th>PLAYER</th>${gun ? '<th>LEVEL</th>' : ''}<th>K</th><th>D</th><th>HS</th><th>ACC</th><th>DMG</th><th>TOP WEAPON</th></tr>${list.map(row).join('')}</table>
${comp.length ? `<div class="ms-co"><h4>BEST PER COMPANY</h4><div class="ms-chips">${comp.map((r) => `<div class="ms-chip">${logo(r.st, r.co, 34)}<div><b>${esc(r.co)}</b><small>${esc(r.n)} · ${r.k} kills</small></div></div>`).join('')}</div></div>` : ''}</div></div>
<div class="ms-go"><small>ENTER TO CONTINUE</small><button>CONTINUE</button></div></div>`;
  document.body.appendChild(el);
  let closed = false; const close = () => { if (closed) return; closed = true; el.remove(); document.removeEventListener('keydown', key, true); clearTimeout(to); try { onClose && onClose(); } catch (e) {} };
  const key = (e) => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  el.querySelector('button').onclick = close; el.addEventListener('mousedown', (e) => e.stopPropagation());
  document.addEventListener('keydown', key, true); const to = setTimeout(close, 16000);
  return { close };
}
