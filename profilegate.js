// profilegate.js - nobody plays without a name, a company and the company website (Juan 2026-10-06). Blocking 3-step card over the menu:
// 1) name (2-16 chars, not "Player")  2) company (2-24 chars, suggestions from the company leaderboard so spellings match)
// 3) company website (a domain: the game server fetches its logo for the spray, the MVP card and the scoreboard).
// Saved in localStorage (sc_name, sc_company, sc_site) and on the anonymous server account (ACC.update) for leaderboards/matches.
import * as ACC from './account.js';
import { siteDomain } from './common.js';
const LSN = 'sc_name', LSC = 'sc_company', LSS = 'sc_site';
const get = (k) => { try { return (localStorage.getItem(k) || '').trim(); } catch (e) { return ''; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const tidy = (s) => String(s || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
export function nameError(v) { v = tidy(v); if (v.length < 2) return 'At least 2 characters'; if (v.length > 16) return 'Max 16 characters'; if (!/\p{L}/u.test(v)) return 'Use at least one letter'; if (/^player\s*\d*$/i.test(v)) return 'Pick your own name, not "Player"'; return ''; }
export function companyError(v) { v = tidy(v); if (v.length < 2) return 'Tell us where you work (2+ characters)'; if (v.length > 24) return 'Max 24 characters'; if (!/[\p{L}\p{N}]/u.test(v)) return 'Use letters or numbers'; return ''; }
export function siteError(v) { return siteDomain(v) ? '' : 'Your company website, like harbor.ai'; }
export const profileComplete = () => !nameError(get(LSN)) && !companyError(get(LSC)) && !siteError(get(LSS));
export const localProfile = () => ({ name: tidy(get(LSN)), company: tidy(get(LSC)), site: siteDomain(get(LSS)) });
// push the local name/company to the server account when they differ (e.g. saved while the server was asleep)
export async function syncProfile() { if (!profileComplete()) return; const l = localProfile(); try { const p = await ACC.ensure(); if (p && (p.name !== l.name || (p.company || '') !== l.company || (p.site || '') !== l.site)) await ACC.update(l); } catch (e) {} }
let waiters = null;   // one card at a time: a second caller (menu + invite link / play button) waits for the open one
export function requireProfile(root, onDone) {
  if (profileComplete()) { syncProfile(); onDone && onDone(); return true; }
  if (waiters) { if (onDone) waiters.push(onDone); return false; }
  waiters = onDone ? [onDone] : [];
  const wrap = document.createElement('div'); wrap.className = 'pg-wrap';
  if (!document.getElementById('pg-css')) { const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = `
.pg-wrap{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;background:rgba(6,10,22,.78);backdrop-filter:blur(3px);font-family:Fredoka,system-ui,sans-serif;color:#fff}
.pg-card{width:min(440px,92vw);padding:26px 26px 20px;border-radius:20px;background:#141a33;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 60px rgba(0,0,0,.5)}
.pg-step{font-size:12px;letter-spacing:.22em;opacity:.6}.pg-h{font-weight:700;font-size:30px;margin:4px 0 2px}.pg-p{font-size:14px;opacity:.75;margin:0 0 14px}
.pg-in{width:100%;box-sizing:border-box;font:600 20px Fredoka,system-ui,sans-serif;padding:12px 14px;border-radius:12px;border:2px solid rgba(255,255,255,.18);background:#0b1020;color:#fff;outline:none}
.pg-in:focus{border-color:#ffd166}.pg-err{min-height:18px;font-size:13px;color:#ff8f8f;margin:6px 2px 10px}
.pg-row{display:flex;gap:10px;align-items:center}.pg-btn{flex:1;font:700 17px Fredoka,system-ui,sans-serif;padding:12px;border:0;border-radius:12px;background:#ffd166;color:#1b2033;cursor:pointer}
.pg-btn[disabled]{opacity:.45;cursor:default}.pg-back{flex:0 0 auto;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)}
.pg-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}.pg-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25)}.pg-dots i.on{background:#ffd166}
.pg-alt{font-size:12px;opacity:.7;margin-top:12px;text-align:center}.pg-alt a{color:#9fe7ff;cursor:pointer}
.pg-logo{display:flex;align-items:center;gap:10px;min-height:52px;margin:2px 0 4px;font-size:13px;opacity:.85}.pg-logo i{width:48px;height:48px;border-radius:10px;background:#0b1020 center/contain no-repeat;border:1px solid rgba(255,255,255,.18);flex:0 0 auto}`; document.head.appendChild(st); }
  (root || document.body).appendChild(wrap);
  let step = nameError(get(LSN)) ? 0 : companyError(get(LSC)) ? 1 : 2, name = tidy(get(LSN)), company = tidy(get(LSC)), site = get(LSS), cos = [], lt = 0;
  ACC.companies().then((l) => { cos = (l || []).map((c) => c.company).filter(Boolean).slice(0, 60); const dl = wrap.querySelector('#pg-co'); if (dl) dl.innerHTML = cos.map((c) => `<option value="${tidy(c)}">`).join(''); }).catch(() => {});
  const stop = (e) => e.stopPropagation();   // typing here must not reach the game / menu key handlers
  for (const ev of ['keydown', 'keyup', 'keypress', 'mousedown']) wrap.addEventListener(ev, stop);
  const T = [['What’s your name?', 'Everyone in the match and on the leaderboards sees it.', 16, 'nickname', 'Your name'],
    ['Where do you work?', 'Your company plays for the company leaderboard. Pick it from the list if it is already there.', 24, 'organization', 'Company'],
    ['Your company website', 'We grab your company logo from it: you spray it on walls with T, and it shows on the scoreboard and the MVP card.', 60, 'url', 'harbor.ai']];
  function render() {
    const s0 = step === 0, last = step === 2, val = [name, company, site][step], [h, sub, max, ac, ph] = T[step];
    wrap.innerHTML = `<div class="pg-card" role="dialog" aria-modal="true">
      <div class="pg-step">CREATE YOUR PLAYER · STEP ${step + 1} OF 3</div>
      <div class="pg-h">${h}</div>
      <p class="pg-p">${sub}</p>
      <input class="pg-in" id="pg-v" maxlength="${max}" autocomplete="${ac}" ${step === 1 ? 'list="pg-co"' : ''} ${last ? 'inputmode="url" autocapitalize="off" spellcheck="false"' : ''} placeholder="${ph}" value="${tidy(val)}">
      ${step === 1 ? `<datalist id="pg-co">${cos.map((c) => `<option value="${tidy(c)}">`).join('')}</datalist>` : ''}
      ${last ? '<div class="pg-logo"><i id="pg-l"></i><span id="pg-ls">Type the website to see your logo</span></div>' : ''}
      <div class="pg-err" id="pg-e"></div>
      <div class="pg-row">${s0 ? '' : '<button class="pg-btn pg-back" id="pg-b">Back</button>'}<button class="pg-btn" id="pg-ok">${last ? 'Start playing' : 'Continue'}</button></div>
      <div class="pg-dots">${[0, 1, 2].map((i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
      ${s0 ? '<div class="pg-alt">Played before on another device? <a id="pg-r">Use a recovery code</a></div>' : ''}</div>`;
    const inp = wrap.querySelector('#pg-v'), err = wrap.querySelector('#pg-e'), ok = wrap.querySelector('#pg-ok');
    const check = () => { const e = [nameError, companyError, siteError][step](inp.value); ok.disabled = !!e; return e; };
    const preview = () => { if (!last) return; clearTimeout(lt); lt = setTimeout(() => { const d = siteDomain(inp.value), li = wrap.querySelector('#pg-l'), ls = wrap.querySelector('#pg-ls'); if (!li) return;
      if (!d) { li.style.backgroundImage = ''; ls.textContent = 'Type the website to see your logo'; return; } ls.textContent = 'Looking for the ' + d + ' logo...';
      const img = new Image(); img.onload = () => { if (siteDomain(inp.value) !== d) return; li.style.backgroundImage = `url("${img.src}")`; li.style.backgroundColor = '#fff'; ls.textContent = 'Your spray logo'; }; img.onerror = () => { if (siteDomain(inp.value) === d) ls.textContent = 'No logo found yet: your spray uses the company initials'; }; img.src = ACC.logoUrl(d); }, 450); };
    inp.oninput = () => { err.textContent = ''; check(); preview(); }; check(); preview(); setTimeout(() => { inp.focus(); inp.select(); }, 30);
    const go = () => { const e = check(); if (e) { err.textContent = e; return; }
      if (step === 0) { name = tidy(inp.value); set(LSN, name); step = 1; render(); return; }
      if (step === 1) { company = tidy(inp.value); set(LSC, company); step = 2; render(); return; }
      site = siteDomain(inp.value); set(LSS, site); finish(); };
    ok.onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    const back = wrap.querySelector('#pg-b'); if (back) back.onclick = () => { if (step === 1) company = tidy(inp.value); else site = inp.value.trim(); step--; render(); };
    const rc = wrap.querySelector('#pg-r'); if (rc) rc.onclick = () => {
      wrap.querySelector('.pg-alt').innerHTML = '<input class="pg-in" id="pg-rc" placeholder="Paste your recovery code" style="font-size:14px;padding:9px 12px"><div class="pg-row" style="margin-top:8px"><button class="pg-btn" id="pg-rg" style="font-size:14px;padding:9px">Restore</button></div><div class="pg-err" id="pg-re"></div>';
      wrap.querySelector('#pg-rg').onclick = async () => { const p = await ACC.restore(wrap.querySelector('#pg-rc').value).catch(() => null); if (!p) { wrap.querySelector('#pg-re').textContent = 'That code is not valid'; return; }
        name = tidy(p.name); company = tidy(p.company); site = siteDomain(p.site); set(LSN, name); if (company) set(LSC, company); if (site) set(LSS, site); step = nameError(name) ? 0 : companyError(company) ? 1 : 2; if (profileComplete()) finish(); else render(); }; };
  }
  function finish() { wrap.remove(); syncProfile(); const w = waiters || []; waiters = null; for (const f of w) try { f(); } catch (e) {} }
  render(); return false;
}
