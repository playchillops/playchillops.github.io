import { Game } from './game.js';
import { requireProfile } from './profilegate.js';
const root = document.getElementById('game');
const g = new Game(root);
window.__g = g;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function goFS() { const el = document.documentElement; const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f && !fsEl()) { try { const p = f.call(el); p && p.catch && p.catch(() => {}); try { navigator.keyboard && navigator.keyboard.lock && navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) {} } catch (e) {} } }
function exitFS() { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
const btn = document.getElementById('fs');
btn.onclick = (e) => { e.stopPropagation(); fsEl() ? exitFS() : goFS(); };
document.addEventListener('fullscreenchange', () => { btn.textContent = fsEl() ? 'Exit fullscreen' : 'Fullscreen'; try { if (fsEl()) navigator.keyboard && navigator.keyboard.lock && navigator.keyboard.lock(['Escape']).catch(() => {}); else navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); } catch (e) {} });
btn.style.display = 'block'; btn.textContent = 'Fullscreen';
const lockNow = () => { try { const c = g.canvas; if (c && g.state === 'play' && !window.__pauseOpen && document.pointerLockElement !== c && c.requestPointerLock) { const p = c.requestPointerLock(); p && p.catch && p.catch(() => {}); } } catch (e) {} };
document.addEventListener('fullscreenchange', () => { btn.textContent = fsEl() ? 'Exit fullscreen' : 'Fullscreen'; setTimeout(lockNow, 150); });
// trackpads: any click on the game while playing grabs the mouse (pointer lock) so look follows the cursor
document.addEventListener('mousedown', (e) => { if (e.target && e.target.closest && e.target.closest('button,input,textarea,select,a')) return; lockNow(); }, true);
document.addEventListener('keydown', (e) => { if (e.code === 'F11') { e.preventDefault(); fsEl() ? exitFS() : goFS(); } });

document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.sg button')) goFS(); }, true);
document.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && g.state !== 'play') { fsEl() ? exitFS() : goFS(); } });

// public profile page: ?u=<id>
{ const u = (/[?&]u=([a-z0-9]{8})/.exec(location.search) || [])[1];
  if (u) import('./account.js').then(async (A) => { const p = await A.publicProfile(u); const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.88);font-family:Fredoka,system-ui,sans-serif;color:#fff';
    const e = (s) => String(s ?? '').replace(/[<>&"']/g, '');
    d.innerHTML = p && p.id ? `<div style="width:min(420px,90vw);padding:26px;border-radius:18px;background:#141a33;border:1px solid #fff3"><div style="font-size:12px;letter-spacing:.2em;opacity:.6">CHILLOPS PLAYER</div><h2 style="margin:4px 0">${e(p.name)}</h2><div style="opacity:.7;margin-bottom:12px">${p.company ? e(p.company) : 'No company'}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:15px"><div><b>${p.mp.wins}</b> MP wins</div><div><b>${p.mp.matches}</b> MP matches</div><div><b>${p.mp.kills}</b> MP kills</div><div><b>${p.sp.kills}</b> bot kills</div><div><b>${p.sp.heads}</b> headshots</div><div><b>${p.sp.matchesWon}</b> bot matches won</div></div><button id="pp-x" style="margin-top:16px;padding:8px 18px;border-radius:10px;border:0;background:#ffb347;font:inherit;font-weight:600;cursor:pointer">Play ChillOps</button></div>` : `<div style="padding:26px;background:#141a33;border-radius:18px">Player not found. <button id="pp-x" style="font:inherit">Close</button></div>`;
    document.body.appendChild(d); d.querySelector('#pp-x').onclick = () => d.remove(); }).catch(() => {}); }

// first visit: onboarding (profile, then tutorial) as soon as the menu is up
// every visit: name + company are required (profilegate.js), then the tutorial on the first visit
{ const skip = /[?&](u|noonboard)=?/.test(location.search); let n = 0;
  if (!skip) { const iv = setInterval(() => { if (g.state === 'menu' && g.menuStop || ++n > 120) { clearInterval(iv); if (g.state !== 'menu') return;
    requireProfile(document.body, () => { try { const nm = document.querySelector('.mn-name'); if (nm) nm.textContent = localStorage.getItem('sc_name') || nm.textContent; } catch (e) {} let seen = true; try { seen = !!localStorage.getItem('sc_tut'); } catch (e) {} if (!seen && !/[?&]nostats/.test(location.search)) { g._tutDone = true; g.tutorial(() => g.showMenu()); } }); } }, 500); } }
