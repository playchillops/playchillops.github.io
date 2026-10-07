// emblem.js - prestige emblems (Juan 2026-10-06: "Prestige: reset your level for an exclusive emblem").
// One SVG per prestige 1..10, drawn in code (no assets). Shown in the profile, the menu, the killfeed, the scoreboard and the MVP card.
const E = [
  null,
  ['#d08a4b', '#7a4520', 'M16 3l3.7 8.2 8.9.9-6.7 6 1.9 8.8L16 22.4 8.2 26.9l1.9-8.8-6.7-6 8.9-.9z'],                           // 1 bronze star
  ['#e3e8f2', '#6c7a90', 'M16 3l3.7 8.2 8.9.9-6.7 6 1.9 8.8L16 22.4 8.2 26.9l1.9-8.8-6.7-6 8.9-.9z'],                           // 2 silver star
  ['#ffd34d', '#a06a00', 'M16 3l3.7 8.2 8.9.9-6.7 6 1.9 8.8L16 22.4 8.2 26.9l1.9-8.8-6.7-6 8.9-.9z'],                           // 3 gold star
  ['#7fe3ff', '#1d6f8c', 'M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z'],                                                       // 4 shield
  ['#7dffb0', '#16784a', 'M5 13l11-8 11 8v5L16 10 5 18z M5 22l11-8 11 8v5l-11-8-11 8z'],                                          // 5 double chevron
  ['#ff9f4a', '#9a3d00', 'M4 24l2-14 6 6 4-10 4 10 6-6 2 14z M4 26h24v3H4z'],                                                    // 6 crown
  ['#ff6b6b', '#8c1d1d', 'M16 2c2 6 9 8 9 17a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 3 4 0-5 0-8 2-11z'],                              // 7 flame
  ['#c9a2ff', '#5a2ea6', 'M16 3l12 10-12 16L4 13z M4 13h24 M11 13l5 16 5-16 M10 3l1 10M22 3l-1 10'],                             // 8 diamond
  ['#ff7ad9', '#86206b', 'M16 4a11 11 0 0 1 11 11c0 4-2 6-4 7v5h-4v-3h-2v3h-2v-3h-2v3H9v-5c-2-1-4-3-4-7A11 11 0 0 1 16 4z M11 14a2.5 2.5 0 1 0 .1 0z M21 14a2.5 2.5 0 1 0 .1 0z'],   // 9 skull
  ['url(#emk)', '#14203d', 'M16 2l12 13-12 15L4 15z M16 2v28 M4 15h24 M16 30c-3 0-4 3-2 5'],                                      // 10 rainbow kite (ChillOps)
];
let uid = 0;
/** inline SVG for prestige n (0 = nothing) */
export function emblemSVG(n, size = 18, title = true) {
  n = Math.max(0, Math.min(10, n | 0)); if (!n) return '';
  const [fill, stroke, d] = E[n], id = 'emk' + (++uid);
  const grad = n === 10 ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset=".35" stop-color="#ffd34d"/><stop offset=".65" stop-color="#7dffb0"/><stop offset="1" stop-color="#7fe3ff"/></linearGradient></defs>` : '';
  return `<svg class="emb" viewBox="0 0 32 32" width="${size}" height="${size}" style="vertical-align:-0.18em;flex:0 0 auto" aria-label="Prestige ${n}">${title ? `<title>Prestige ${n}</title>` : ''}${grad}<path d="${d}" fill="${n === 10 ? `url(#${id})` : fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
export const PRESTIGE_NAMES = ['', 'Bronze Star', 'Silver Star', 'Gold Star', 'Guardian', 'Climber', 'Crowned', 'On Fire', 'Diamond', 'Skull', 'Rainbow Kite'];
