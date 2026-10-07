// social.js - competitive layer UI: top 3 box, online list, recent winners, boards with day/week/all-time/company tabs. No personal data: names and companies are the anonymous profile fields.
import * as ACC from './account.js';
const esc = (s) => String(s ?? '').replace(/[<>&"']/g, '');
const off = () => /[?&]nostats/.test(location.search);
const MED = ['#ffd166', '#cfd8e8', '#e0a070'];
const who = (p) => `<a href="?u=${esc(p.id)}" style="color:inherit;text-decoration:none"><b>${esc(p.name)}</b></a>${p.company ? ` <span style="opacity:.6">${esc(p.company)}</span>` : ''}`;
const rows = (list, n, tail) => list.slice(0, n).map((p, i) => `<div style="display:flex;align-items:center;gap:8px;padding:2px 0"><span style="width:16px;height:16px;border-radius:50%;background:${MED[i] || '#667'};color:#101733;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${i + 1}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${who(p)}</span><span style="opacity:.8">${tail(p)}</span></div>`).join('');
const css = (el, s) => { el.style.cssText = s; return el; };
const HEAD = 'font-size:11px;letter-spacing:.2em;color:#ffb35c;margin:0 0 4px';
const BOX = 'font-family:Fredoka,system-ui,sans-serif;color:#fff;font-size:13px;background:rgba(14,20,36,.62);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 12px;backdrop-filter:blur(4px);width:200px;pointer-events:none';
/** always-visible Top 3 (menu). Returns the element; caller appends it. */
export function topBox() {
  const el = css(document.createElement('div'), BOX + ';font-size:20px;width:min(360px,32vw);box-sizing:border-box;padding:20px 22px;position:absolute;right:clamp(16px,2.5vw,36px);bottom:130px;z-index:4');
  el.innerHTML = `<div style="${HEAD};font-size:24px;font-weight:700;margin-bottom:12px">TOP PLAYERS</div><div class="b" style="opacity:.6">Loading...</div>`;
  if (off() || innerWidth < 760) { el.style.display = 'none'; return el; }
  ACC.board('all').then((l) => { el.querySelector('.b').innerHTML = l.length ? rows(l, 3, (p) => p.wins + ' W') : '<span style="opacity:.7">No wins yet. Win a multiplayer match to take the first spot.</span>'; for (const row of el.querySelector('.b').children) { row.style.padding = '7px 0'; const medal = row.firstElementChild; if (medal && medal.tagName === 'SPAN') medal.style.cssText += ';width:28px;height:28px;font-size:17px;flex-shrink:0'; } }).catch(() => {});
  return el;
}
/** lobby side panel: top 3, who is online, recent winners */
export function lobbyPanel() {
  const el = css(document.createElement('div'), 'position:absolute;right:clamp(12px,3vw,48px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;z-index:71');
  if (off() || innerWidth < 980) { el.style.display = 'none'; return el; }
  const box = (t) => { const d = css(document.createElement('div'), BOX); d.innerHTML = `<div style="${HEAD}">${t}</div><div class="b" style="opacity:.6">Loading...</div>`; el.appendChild(d); return d.querySelector('.b'); };
  const a = box('TOP 3 PLAYERS'), b = box('ONLINE NOW'), c = box('RECENT WINNERS');
  ACC.board('all').then((l) => { a.innerHTML = l.length ? rows(l, 3, (p) => p.wins + ' W') : '<span style="opacity:.7">No wins yet</span>'; }).catch(() => {});
  ACC.online().then((l) => { b.innerHTML = l.length ? l.slice(0, 6).map((p) => `<div style="padding:1px 0"><b>${esc(p.name)}</b>${p.company ? ` <span style="opacity:.6">${esc(p.company)}</span>` : ''} <span style="opacity:.5;font-size:11px">${esc(p.mode)}</span></div>`).join('') + (l.length > 6 ? `<div style="opacity:.6">+${l.length - 6} more</div>` : '') : '<span style="opacity:.7">Nobody yet. Be the first.</span>'; }).catch(() => {});
  ACC.feed().then((l) => { c.innerHTML = l.length ? l.slice(0, 5).map((f) => `<div style="padding:1px 0"><b>${esc(f.w[0].name)}</b>${f.w[1] ? ' + ' + esc(f.w[1].name) : ''} <span style="opacity:.6">beat ${esc(f.l[0] ? f.l[0].name : '?')}</span></div>`).join('') : '<span style="opacity:.7">No matches yet</span>'; }).catch(() => {});
  return el;
}
/** full leaderboard page with tabs */
export async function boardPanel(host) {
  const TABS = [['day', 'Today'], ['week', 'This week'], ['all', 'All time'], ['co', 'Companies']];
  host.innerHTML = `<div style="max-width:360px"><h3>LEADERBOARD</h3><div class="tabs" style="display:flex;gap:6px;margin:4px 0 8px;flex-wrap:wrap">${TABS.map(([k, t]) => `<button data-k="${k}" style="font:inherit;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid #fff4;background:#0006;color:#fff;cursor:pointer">${t}</button>`).join('')}</div><div class="lb" style="font-size:14px;min-height:60px"><span style="opacity:.6">Loading...</span></div><div style="${HEAD};margin-top:12px">ONLINE NOW</div><div class="on" style="font-size:13px"></div><div style="${HEAD};margin-top:10px">RECENT WINNERS</div><div class="fd" style="font-size:13px"></div><p style="font-size:11px;opacity:.55;margin-top:10px">Multiplayer wins. Names and companies are anonymous profile fields. Set yours in Profile.</p></div>`;
  const lb = host.querySelector('.lb'), tabs = [...host.querySelectorAll('.tabs button')];
  const pick = async (k) => { tabs.forEach((t) => { const on = t.dataset.k === k; t.style.background = on ? '#ff8a2a' : '#0006'; t.style.color = on ? '#101733' : '#fff'; });
    lb.innerHTML = '<span style="opacity:.6">Loading...</span>';
    if (k === 'co') { const c = await ACC.companies(); if (!host.contains(lb)) return; lb.innerHTML = c.length ? '<table style="width:100%;border-collapse:collapse"><tr style="opacity:.6;text-align:left"><th>#</th><th>Company</th><th>Wins</th><th>Players</th></tr>' + c.slice(0, 10).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.company)}</td><td>${x.wins}</td><td>${x.players}</td></tr>`).join('') + '</table>' : '<span style="opacity:.7">No companies yet. Set yours in Profile and win a match.</span>'; return; }
    const l = await ACC.board(k); if (!host.contains(lb)) return; lb.innerHTML = l.length ? rows(l, 10, (p) => p.wins + ' wins') : '<span style="opacity:.7">No wins in this period yet.</span>'; };
  tabs.forEach((t) => { t.onclick = () => pick(t.dataset.k); }); pick('all');
  ACC.online().then((l) => { const e = host.querySelector('.on'); if (e) e.innerHTML = l.length ? l.slice(0, 8).map((p) => `<span style="display:inline-block;margin:0 10px 2px 0"><b>${esc(p.name)}</b>${p.company ? ' <span style="opacity:.6">' + esc(p.company) + '</span>' : ''}</span>`).join('') : '<span style="opacity:.7">Nobody in multiplayer right now.</span>'; }).catch(() => {});
  ACC.feed().then((l) => { const e = host.querySelector('.fd'); if (e) e.innerHTML = l.length ? l.slice(0, 6).map((f) => `<div style="padding:1px 0"><b>${esc(f.w.map((p) => p.name).join(' + '))}</b> <span style="opacity:.6">beat ${esc(f.l.map((p) => p.name).join(' + ') || '?')}</span></div>`).join('') : '<span style="opacity:.7">No matches yet.</span>'; }).catch(() => {});
}
