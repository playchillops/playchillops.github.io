// profilegate.js - nobody plays without a name and a company (Juan 2026-10-06). Blocking 2-step card over the menu:
// 1) name (2-16 chars, not "Player")  2) company (2-24 chars, suggestions from the company leaderboard so spellings match).
// Saved in localStorage (sc_name, sc_company) and on the anonymous server account (ACC.update) for leaderboards/matches.
import * as ACC from './account.js';
const LSN = 'sc_name', LSC = 'sc_company';
const get = (k) => { try { return (localStorage.getItem(k) || '').trim(); } catch (e) { return ''; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const tidy = (s) => String(s || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
export function nameError(v) { v = tidy(v); if (v.length < 2) return 'At least 2 characters'; if (v.length > 16) return 'Max 16 characters'; if (!/\p{L}/u.test(v)) return 'Use at least one letter'; if (/^player\s*\d*$/i.test(v)) return 'Pick your own name, not "Player"'; return ''; }
export function companyError(v) { v = tidy(v); if (v.length < 2) return 'Tell us where you work (2+ characters)'; if (v.length > 24) return 'Max 24 characters'; if (!/[\p{L}\p{N}]/u.test(v)) return 'Use letters or numbers'; return ''; }
export const profileComplete = () => !nameError(get(LSN)) && !companyError(get(LSC));
export const localProfile = () => ({ name: tidy(get(LSN)), company: tidy(get(LSC)) });
// push the local name/company to the server account when they differ (e.g. saved while the server was asleep)
export async function syncProfile() { if (!profileComplete()) return; const l = localProfile(); try { const p = await ACC.ensure(); if (p && (p.name !== l.name || (p.company || '') !== l.company)) await ACC.update(l); } catch (e) {} }
export function requireProfile(root, onDone) {
  if (profileComplete()) { syncProfile(); onDone && onDone(); return true; }
  const wrap = document.createElement('div'); wrap.className = 'pg-wrap';
  if (!document.getElementById('pg-css')) { const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = `
.pg-wrap{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(6,10,22,.78);backdrop-filter:blur(3px);font-family:Fredoka,system-ui,sans-serif;color:#fff}
.pg-card{width:min(440px,92vw);padding:26px 26px 20px;border-radius:20px;background:#141a33;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 60px rgba(0,0,0,.5)}
.pg-step{font-size:12px;letter-spacing:.22em;opacity:.6}.pg-h{font-weight:700;font-size:30px;margin:4px 0 2px}.pg-p{font-size:14px;opacity:.75;margin:0 0 14px}
.pg-in{width:100%;box-sizing:border-box;font:600 20px Fredoka,system-ui,sans-serif;padding:12px 14px;border-radius:12px;border:2px solid rgba(255,255,255,.18);background:#0b1020;color:#fff;outline:none}
.pg-in:focus{border-color:#ffd166}.pg-err{min-height:18px;font-size:13px;color:#ff8f8f;margin:6px 2px 10px}
.pg-row{display:flex;gap:10px;align-items:center}.pg-btn{flex:1;font:700 17px Fredoka,system-ui,sans-serif;padding:12px;border:0;border-radius:12px;background:#ffd166;color:#1b2033;cursor:pointer}
.pg-btn[disabled]{opacity:.45;cursor:default}.pg-back{flex:0 0 auto;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)}
.pg-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}.pg-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25)}.pg-dots i.on{background:#ffd166}
.pg-alt{font-size:12px;opacity:.7;margin-top:12px;text-align:center}.pg-alt a{color:#9fe7ff;cursor:pointer}`; document.head.appendChild(st); }
  (root || document.body).appendChild(wrap);
  let step = nameError(get(LSN)) ? 0 : 1, name = tidy(get(LSN)), company = tidy(get(LSC)), cos = [];
  ACC.companies().then((l) => { cos = (l || []).map((c) => c.company).filter(Boolean).slice(0, 60); const dl = wrap.querySelector('#pg-co'); if (dl) dl.innerHTML = cos.map((c) => `<option value="${tidy(c)}">`).join(''); }).catch(() => {});
  const stop = (e) => e.stopPropagation();   // typing here must not reach the game / menu key handlers
  for (const ev of ['keydown', 'keyup', 'keypress', 'mousedown']) wrap.addEventListener(ev, stop);
  function render() {
    const s0 = step === 0, val = s0 ? name : company;
    wrap.innerHTML = `<div class="pg-card" role="dialog" aria-modal="true">
      <div class="pg-step">CREATE YOUR PLAYER · STEP ${step + 1} OF 2</div>
      <div class="pg-h">${s0 ? 'What’s your name?' : 'Where do you work?'}</div>
      <p class="pg-p">${s0 ? 'Everyone in the match and on the leaderboards sees it.' : 'Your company plays for the company leaderboard. Pick it from the list if it is already there.'}</p>
      <input class="pg-in" id="pg-v" maxlength="${s0 ? 16 : 24}" autocomplete="${s0 ? 'nickname' : 'organization'}" ${s0 ? '' : 'list="pg-co"'} placeholder="${s0 ? 'Your name' : 'Company'}" value="${tidy(val)}">
      ${s0 ? '' : `<datalist id="pg-co">${cos.map((c) => `<option value="${tidy(c)}">`).join('')}</datalist>`}
      <div class="pg-err" id="pg-e"></div>
      <div class="pg-row">${s0 ? '' : '<button class="pg-btn pg-back" id="pg-b">Back</button>'}<button class="pg-btn" id="pg-ok">${s0 ? 'Continue' : 'Start playing'}</button></div>
      <div class="pg-dots"><i class="${s0 ? 'on' : ''}"></i><i class="${s0 ? '' : 'on'}"></i></div>
      ${s0 ? '<div class="pg-alt">Played before on another device? <a id="pg-r">Use a recovery code</a></div>' : ''}</div>`;
    const inp = wrap.querySelector('#pg-v'), err = wrap.querySelector('#pg-e'), ok = wrap.querySelector('#pg-ok');
    const check = () => { const e = (s0 ? nameError : companyError)(inp.value); ok.disabled = !!e; return e; };
    inp.oninput = () => { err.textContent = ''; check(); }; check(); setTimeout(() => { inp.focus(); inp.select(); }, 30);
    const go = () => { const e = check(); if (e) { err.textContent = e; return; }
      if (s0) { name = tidy(inp.value); set(LSN, name); step = 1; render(); return; }
      company = tidy(inp.value); set(LSC, company); finish(); };
    ok.onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    const back = wrap.querySelector('#pg-b'); if (back) back.onclick = () => { company = tidy(inp.value); step = 0; render(); };
    const rc = wrap.querySelector('#pg-r'); if (rc) rc.onclick = () => {
      wrap.querySelector('.pg-alt').innerHTML = '<input class="pg-in" id="pg-rc" placeholder="Paste your recovery code" style="font-size:14px;padding:9px 12px"><div class="pg-row" style="margin-top:8px"><button class="pg-btn" id="pg-rg" style="font-size:14px;padding:9px">Restore</button></div><div class="pg-err" id="pg-re"></div>';
      wrap.querySelector('#pg-rg').onclick = async () => { const p = await ACC.restore(wrap.querySelector('#pg-rc').value).catch(() => null); if (!p) { wrap.querySelector('#pg-re').textContent = 'That code is not valid'; return; }
        name = tidy(p.name); company = tidy(p.company); set(LSN, name); if (company) set(LSC, company); step = nameError(name) ? 0 : 1; if (profileComplete()) finish(); else render(); }; };
  }
  function finish() { wrap.remove(); syncProfile(); onDone && onDone(); }
  render(); return false;
}
