// killfeed.js - CS-style kill feed, top right (Juan 2026-10-06): killer [weapon icon] [headshot icon] victim.
// Team colours, prestige emblems, your own kills get a white frame, your deaths a red one. Entries fade after 6 s, max 6.
import { ICONS } from './economy.js';
import { emblemSVG } from './emblem.js';
const TEAMC = { T: '#ffb35c', CT: '#7fe3ff', Z: '#7dff9a' };
const EXTRA = {
  knife: ICONS.knifeskin,
  streak: 'M38 6l6 16 16 2-12 10 4 16-14-9-14 9 4-16-12-10 16-2z',
  void: 'M38 8v40 M24 34l14 14 14-14 M14 64h48',
  bomb: 'M36 30a18 18 0 1 0 .1 0z M42 26l8-9 M50 17l7 1 M48 10l2 6',
  starship: 'M38 4c9 9 10 24 6 38H32C28 28 29 13 38 4z M32 42l-8 10M44 42l8 10M34 50l4 16 4-16',
};
const HS = '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="#ff5d5d" stroke-width="2.6" stroke-linecap="round"><circle cx="16" cy="13" r="7"/><path d="M11 25c1.5-2 3-3 5-3s3.5 1 5 3M16 1v6M16 19v3M2 13h7M23 13h7"/></svg>';
const esc = (s) => String(s ?? '').replace(/[<>&"'`]/g, '');
const CSS = `.kfd{position:fixed;right:70px;top:56px;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none;font:600 15px Fredoka,system-ui,sans-serif}
.kfd-r{display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:9px;background:rgba(8,12,26,.62);color:#fff;text-shadow:0 1px 3px #000;animation:kfin .18s ease-out;transition:opacity .5s,transform .5s;border:2px solid transparent;white-space:nowrap}
.kfd-r.me{border-color:#fff;background:rgba(40,16,16,.7)}.kfd-r.dead{border-color:#ff5d5d}
.kfd-r svg.w{width:34px;height:24px}.kfd-r .fb{font-size:10px;letter-spacing:.14em;color:#ffd166;margin-right:2px}
@keyframes kfin{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
@media(max-width:700px){.kfd{top:46px;right:58px;font-size:12px}.kfd-r svg.w{width:26px;height:18px}}`;
export function createKillfeed() {
  if (!document.getElementById('kfd-css')) { const s = document.createElement('style'); s.id = 'kfd-css'; s.textContent = CSS; document.head.appendChild(s); }
  const box = document.createElement('div'); box.className = 'kfd'; document.body.appendChild(box);
  const name = (p) => p ? `${p.pr ? emblemSVG(p.pr, 16) : ''}<span style="color:${TEAMC[p.team] || '#fff'}">${esc(p.name || 'Player')}</span>` : '';
  return {
    /** k / v: { name, team, pr } (k null = world: fell off, bomb); w: weapon id or 'knife'/'streak'/'void'/'bomb' */
    add({ k, v, w, hs, fb, mine, me }) {
      const d = ICONS[w] || EXTRA[w] || ICONS.pistol;
      const r = document.createElement('div'); r.className = 'kfd-r' + (mine ? ' me' : me ? ' dead' : '');
      r.innerHTML = `${fb ? '<span class="fb">FIRST BLOOD</span>' : ''}${name(k)}<svg class="w" viewBox="0 0 76 76" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"><path d="${d}"/></svg>${hs ? HS : ''}${name(v)}`;
      box.appendChild(r); while (box.children.length > 6) box.firstChild.remove();
      setTimeout(() => { r.style.opacity = '0'; r.style.transform = 'translateX(14px)'; setTimeout(() => r.remove(), 520); }, mine || me ? 8000 : 6000);
    },
    show(on) { box.style.display = on ? '' : 'none'; },
    clear() { box.innerHTML = ''; },
    dispose() { box.remove(); },
  };
}
