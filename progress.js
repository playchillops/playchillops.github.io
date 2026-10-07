// progress.js - level / rank / XP and domination ("tamed") on the client. Server is authoritative: it sends 'dom', 'free' and
// 'reward' events (room.js) and the account profile carries xp + dom. This file only shows them.
import * as ACC from './account.js';
import { progress, levelOf, rankOf, matchXp, XP_BASE, XP_KILL, XP_WIN, PRESTIGE_LEVEL, MAX_PRESTIGE, canPrestige } from './rank.js';
import { emblemSVG, PRESTIGE_NAMES } from './emblem.js';
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
const css = `.pr-toast{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:9400;padding:12px 22px;border-radius:14px;font:700 22px Fredoka,system-ui,sans-serif;color:#fff;text-align:center;pointer-events:none;box-shadow:0 10px 40px rgba(0,0,0,.45);animation:prin .35s ease-out}
.pr-toast small{display:block;font-size:13px;font-weight:500;opacity:.9;margin-top:3px}
@keyframes prin{from{opacity:0;transform:translate(-50%,-14px) scale(.9)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
.pr-badge{position:fixed;left:14px;top:230px;z-index:9300;padding:5px 11px;border-radius:999px;font:700 13px Fredoka,system-ui,sans-serif;background:#7a1e3acc;color:#fff;border:1px solid #ff9fb8;display:none}
.pr-rw{position:fixed;inset:0;z-index:9450;display:flex;align-items:center;justify-content:center;background:rgba(6,10,22,.7);font-family:Fredoka,system-ui,sans-serif;color:#fff}
.pr-card{width:min(420px,92vw);padding:24px;border-radius:20px;background:#141a33;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 60px rgba(0,0,0,.55)}
.pr-card h2{margin:0 0 4px;font-size:30px;letter-spacing:.04em}.pr-win{color:#7dffb0}.pr-lose{color:#ffb4a8}
.pr-row{display:flex;justify-content:space-between;font-size:16px;padding:3px 0;opacity:.92}.pr-row b{color:#ffd166}
.pr-bar{height:16px;border-radius:9px;background:#0b1020;overflow:hidden;margin:12px 0 4px;border:1px solid rgba(255,255,255,.15)}.pr-fill{height:100%;width:0;background:linear-gradient(90deg,#ffd166,#ff8f4d);transition:width 1.6s ease-out}
.pr-lv{font-size:14px;opacity:.85;display:flex;justify-content:space-between}.pr-up{margin-top:10px;font-size:20px;font-weight:700;color:#ffd166;text-align:center;animation:prin .5s ease-out}
.pr-go{margin-top:14px;width:100%;font:700 17px Fredoka,system-ui,sans-serif;padding:11px;border:0;border-radius:12px;background:#ffd166;color:#1b2033;cursor:pointer}`;
const addCss = () => { if (document.getElementById('pr-css')) return; const s = document.createElement('style'); s.id = 'pr-css'; s.textContent = css; document.head.appendChild(s); };

/** HTML for the profile panel: level, rank, XP bar, who you tamed and who tamed you */
export function profileHtml(p) {
  if (!p) return '';
  const pr = progress(p.xp || 0), d = p.dom || { tamed: [], by: [] };
  const names = (l) => l.length ? l.map((x) => `<b>${esc(x.name)}</b>${x.company ? ' <span style="opacity:.6">(' + esc(x.company) + ')</span>' : ''}`).join(', ') : '<span style="opacity:.6">nobody</span>';
  return `<div style="margin:6px 0 12px;padding:10px 12px;border-radius:12px;background:#0007;border:1px solid #fff2"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:22px;font-weight:700">LEVEL ${pr.level}</span><span style="color:#ffb347;letter-spacing:.12em;font-size:14px">${pr.rank.toUpperCase()}</span></div><div style="height:10px;border-radius:6px;background:#000a;overflow:hidden;margin:6px 0"><div style="height:100%;width:${Math.round(pr.pct * 100)}%;background:linear-gradient(90deg,#ffd166,#ff8f4d)"></div></div><div style="font-size:12px;opacity:.75">${pr.into} / ${pr.span} XP to level ${pr.level + 1} &nbsp;·&nbsp; ${pr.xp} XP total</div>${prestigeHtml(p)}<div style="font-size:13px;margin-top:8px">Tamed: ${names(d.tamed)}</div><div style="font-size:13px;margin-top:3px;color:${d.by.length ? '#ff9fb8' : 'inherit'}">You are tamed by: ${names(d.by)}</div></div>`;
}

/** prestige block of the profile: current emblem, and from level PRESTIGE_LEVEL the button to reset for the next one */
function prestigeHtml(p) {
  const n = p.prestige | 0, can = canPrestige(p.xp || 0, n), next = Math.min(MAX_PRESTIGE, n + 1);
  const cur = n ? `<span style="display:inline-flex;align-items:center;gap:6px;color:#ffd166;font-weight:700;letter-spacing:.08em">${emblemSVG(n, 22)} PRESTIGE ${n} · ${PRESTIGE_NAMES[n].toUpperCase()}</span>` : '';
  const act = n >= MAX_PRESTIGE ? '<span style="opacity:.75">Max prestige. Respect.</span>' : can ? `<button class="mn-i" data-prestige style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;font-size:13px;background:#ffd16622;border:1px solid #ffd166">${emblemSVG(next, 18)} PRESTIGE ${next}</button> <span style="font-size:11px;opacity:.7">back to level 1 for the ${PRESTIGE_NAMES[next]} emblem</span>` : `<span style="font-size:12px;opacity:.7">Prestige ${next} ${emblemSVG(next, 14)} unlocks at level ${PRESTIGE_LEVEL}</span>`;
  return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center">${cur}${act}</div>`;
}
/** wire the prestige button inside `box` (two clicks: confirm, then reset); onDone(profile) re-renders */
export function wirePrestige(box, onDone) {
  const b = box.querySelector('[data-prestige]'); if (!b) return; let armed = false;
  b.onclick = async () => { if (!armed) { armed = true; b.innerHTML = 'Sure? Your level goes back to 1. Click again'; b.style.background = '#ff6b6b33'; b.style.borderColor = '#ff6b6b'; return; }
    b.disabled = true; b.textContent = 'Prestiging...'; const r = await ACC.prestige().catch(() => null); if (r && r.ok) { toastOnce(`${emblemSVG(r.profile.prestige, 30)} PRESTIGE ${r.profile.prestige}<small>${PRESTIGE_NAMES[r.profile.prestige]} emblem unlocked</small>`); onDone && onDone(r.profile); } else { b.textContent = 'Not yet'; } };
}
function toastOnce(html) { addCss(); const e = document.createElement('div'); e.className = 'pr-toast'; e.style.background = '#6b4a12'; e.innerHTML = html; document.body.appendChild(e); setTimeout(() => e.remove(), 4000); }

export function initProgress(net, { me = () => '', defer = (f) => f() } = {}) {   // defer: the reward card waits for the end-of-match screen
  addCss();
  const toast = (html, color, secs) => { const e = document.createElement('div'); e.className = 'pr-toast'; e.style.background = color; e.innerHTML = html; document.body.appendChild(e); setTimeout(() => e.remove(), (secs || 3.5) * 1000); };
  let badge = document.querySelector('.pr-badge'); if (!badge) { badge = document.createElement('div'); badge.className = 'pr-badge'; document.body.appendChild(badge); }
  const by = new Set(), mine = new Set();
  const paint = () => { const l = [...by]; badge.style.display = l.length ? 'block' : 'none'; badge.textContent = l.length ? 'TAMED BY ' + l.join(', ').toUpperCase() : ''; };
  const myName = () => { try { return String(me() || '').trim().toLowerCase(); } catch (e) { return ''; } };
  ACC.sync().then((p) => { const d = p && p.dom; if (d) { for (const x of d.by) by.add(x.name); for (const x of d.tamed) mine.add(x.name); paint(); } }).catch(() => {});
  net.on('dom', (m) => { if (!m) return; const iv = m.id === net.id, ik = m.by === net.id;
    if (iv) { by.add(m.bn); paint(); toast(`${esc(m.bn)} TAMED YOU<small>Lead them by 4 kills or beat them in a match to break free</small>`, '#a31d45'); }
    else if (ik) { mine.add(m.vn); toast(`YOU TAMED ${esc(m.vn).toUpperCase()}<small>4 kills ahead. They stay tamed until they break free</small>`, '#1d7a4c'); }
    else toast(`${esc(m.bn)} TAMED ${esc(m.vn).toUpperCase()}`, '#33406b', 2.8); });
  net.on('free', (m) => { if (!m) return; const freedMe = m.by === net.id, domMe = m.id === net.id;   // by = the player who broke free, id = their dominator
    if (freedMe) { by.delete(m.vn); paint(); }
    if (domMe) mine.delete(m.bn);
    toast(freedMe ? `YOU BROKE FREE OF ${esc(m.vn).toUpperCase()}` : `${esc(m.bn)} BROKE FREE OF ${esc(m.vn).toUpperCase()}`, '#c47a1a', 3); });
  net.on('reward', (r) => { if (!r) return; defer(() => rewardCard(r)); });
}

export function rewardCard(r) {
  addCss(); { const prev = document.querySelector('.pr-rw'); if (prev) prev._close ? prev._close() : prev.remove(); }
  const w = document.createElement('div'); w.className = 'pr-rw';
  const base = XP_BASE, kx = XP_KILL * Math.max(0, r.kills | 0), wx = r.win ? XP_WIN : 0, a = progress(r.before), b = progress(r.after);
  const up = b.level > a.level;
  w.innerHTML = `<div class="pr-card"><h2 class="${r.win ? 'pr-win' : 'pr-lose'}">${r.win ? 'VICTORY' : 'MATCH OVER'}</h2><div style="opacity:.7;font-size:13px;margin-bottom:8px">MATCH REWARD</div><div class="pr-row"><span>Played</span><b>+${base} XP</b></div><div class="pr-row"><span>${r.kills | 0} kills</span><b>+${kx} XP</b></div>${r.win ? `<div class="pr-row"><span>Match win</span><b>+${wx} XP</b></div>` : ''}<div class="pr-row" style="border-top:1px solid #fff2;margin-top:6px;padding-top:8px;font-size:19px"><span>Total</span><b>+${r.gain} XP</b></div><div class="pr-bar"><div class="pr-fill"></div></div><div class="pr-lv"><span>Level ${a.level} · ${a.rank}</span><span class="pr-nx">${b.into} / ${b.span} XP</span></div><button class="pr-go">Continue [Enter]</button></div>`;
  document.body.appendChild(w);
  let closed = false, timer;
  const key = (e) => { if (!w.isConnected || e.code !== 'Enter') return; e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) close(); };
  const fill = w.querySelector('.pr-fill'), card = w.querySelector('.pr-card'), close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', key, true); clearTimeout(timer); w.remove(); };
  w._close = close; document.addEventListener('keydown', key, true);
  w.querySelector('.pr-go').onclick = close; w.addEventListener('keydown', (e) => e.stopPropagation());
  const run = (from, to, done) => { fill.style.transition = 'none'; fill.style.width = Math.round(from * 100) + '%'; void fill.offsetWidth; fill.style.transition = ''; fill.style.width = Math.round(to * 100) + '%'; setTimeout(done, 1700); };
  const lv = w.querySelector('.pr-lv span');
  const finish = () => { if (closed) return; if (up) { lv.textContent = `Level ${b.level} · ${b.rank}`; card.insertAdjacentHTML('beforeend', `<div class="pr-up">LEVEL UP! ${b.level} · ${b.rank}${rankOf(b.level) !== rankOf(a.level) ? ' (new rank)' : ''}</div>`); } };
  if (up) run(a.pct, 1, () => run(0, b.pct, finish)); else run(a.pct, b.pct, finish);
  timer = setTimeout(close, 25000);
}
