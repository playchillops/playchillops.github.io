// loading.js - map loading screen (Black Ops II look): map name, real progress steps, details, rotating tips.
// start() when a match is requested, step() as the connection/room/map come up, done() once the first frame is playable.
// A map switch reloads the page; start() leaves a flag in sessionStorage so the screen reappears instantly after the reload.
const MAPS = { a: ['KITE GARDEN', 'Courtyards, flower beds and a bomb to plant. Two sites, A and B.'], b: ['KITE PLAZA', 'Open plaza, long sight lines and three sites: A, B and C.'] };
const TIPS = ['Hold E to plant the bomb. It takes 3 seconds, so cover yourself.', 'Press B in the buy phase to open the shop. Helmets cut headshot damage by 60%.', 'Press F to inspect your weapon. It is pure style and costs nothing.', 'Kill the same player 4 more times than they kill you and you tame them.', 'Smoke blocks sight, flash blinds. Throw them before you push a site.', 'Streaks reset when you die. Survive the round to keep yours.', 'Crouch to keep your aim steady and your head behind cover.', 'A 3.2 m ledge hides in the south-west yard of Kite Garden. Jump the blocks.', 'Defuse takes 5 seconds. A kit is not needed, a teammate watching is.', 'Beat a player who tamed you in a match and you break free automatically.'];
const KEY = 'sc_loading';
const CSS = `@keyframes ld-in{from{opacity:0}to{opacity:1}}@keyframes ld-bar{from{height:0}to{height:11vh}}@keyframes ld-scan{from{background-position:0 0}to{background-position:0 6px}}@keyframes ld-tip{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ld{position:fixed;inset:0;z-index:9600;background:radial-gradient(ellipse at 30% 40%,#16202f,#05070d 70%);color:#fff;font-family:Teko,Impact,'Arial Narrow',system-ui,sans-serif;overflow:hidden;animation:ld-in .25s ease-out;transition:opacity .5s}
.ld.out{opacity:0;pointer-events:none}
.ld::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);animation:ld-scan .5s linear infinite;pointer-events:none}
.ld .bar{position:absolute;left:0;right:0;background:#000;animation:ld-bar .4s ease-out forwards;z-index:2}.ld .bar.t{top:0}.ld .bar.b{bottom:0}
.ld .grid{position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,122,26,.07) 1px,transparent 1px) 0 0/72px 72px,linear-gradient(0deg,rgba(255,122,26,.07) 1px,transparent 1px) 0 0/72px 72px;-webkit-mask-image:radial-gradient(ellipse at 30% 50%,#000,transparent 70%);mask-image:radial-gradient(ellipse at 30% 50%,#000,transparent 70%)}
.ld .main{position:absolute;left:7vw;top:50%;transform:translateY(-58%);z-index:3;max-width:70vw}
.ld .lab{font-size:clamp(14px,2vw,22px);letter-spacing:.5em;color:#ff7a1a;font-weight:500}
.ld .map{font-size:clamp(60px,12vw,170px);font-weight:600;line-height:.9;letter-spacing:.05em;transform:skewX(-8deg);background:linear-gradient(180deg,#fff 25%,#8d98a8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 6px 18px rgba(0,0,0,.6))}
.ld .sub{font-size:clamp(16px,2.2vw,26px);color:#9aa6b8;letter-spacing:.12em;margin-top:8px;border-left:3px solid #ff7a1a;padding-left:12px}
.ld .det{position:absolute;right:6vw;top:22vh;z-index:3;font-size:clamp(14px,1.6vw,20px);letter-spacing:.2em;color:#9aa6b8;text-align:right;min-width:240px}
.ld .det div{opacity:0;transform:translateX(12px);transition:all .3s}.ld .det div.on{opacity:1;transform:none}.ld .det div.ok{color:#fff}.ld .det div.ok::before{content:'\\25A0  ';color:#ff7a1a}.ld .det div:not(.ok)::before{content:'\\25A1  ';color:#556}
.ld .foot{position:absolute;left:7vw;right:7vw;bottom:15vh;z-index:3}
.ld .tip{font-size:clamp(15px,1.9vw,24px);letter-spacing:.08em;color:#cdd6e4;min-height:1.6em;animation:ld-tip .4s ease-out}.ld .tip b{color:#ff7a1a;font-weight:600;letter-spacing:.3em;margin-right:10px}
.ld .row{display:flex;justify-content:space-between;font-size:clamp(14px,1.7vw,20px);letter-spacing:.25em;margin:14px 0 6px;color:#fff}
.ld .pb{height:8px;background:#0a0f18;border:1px solid rgba(255,255,255,.2);overflow:hidden;transform:skewX(-20deg)}.ld .pf{height:100%;width:0;background:linear-gradient(90deg,#ff7a1a,#ffd166);transition:width .35s ease-out}`;
let el = null, pct = 0, cap = 20, t0 = 0, timers = [], doneT = 0;
const MIN_MS = 1800;
const addCss = () => { if (document.getElementById('ld-css')) return; const s = document.createElement('style'); s.id = 'ld-css'; s.textContent = CSS; document.head.appendChild(s); };
const q = (s) => el && el.querySelector(s);
const paint = () => { if (!el) return; q('.pf').style.width = Math.round(pct) + '%'; q('.pc').textContent = Math.round(pct) + '%'; };

export function loadingStart({ map = 'a', mode = 'solo' } = {}) {
  if (el) return; addCss(); try { sessionStorage.setItem(KEY, JSON.stringify({ map, mode, t: Date.now() })); } catch (e) {}
  const [name, sub] = MAPS[map] || MAPS.a; pct = 3; cap = 24; t0 = performance.now();
  el = document.createElement('div'); el.className = 'ld';
  el.innerHTML = `<div class="grid"></div><div class="bar t"></div><div class="bar b"></div><div class="main"><div class="lab">${mode === 'solo' ? 'VS BOTS' : 'MULTIPLAYER'} // LOADING MAP</div><div class="map">${name}</div><div class="sub">${sub}</div></div><div class="det"><div data-k="link">SERVER LINK</div><div data-k="room">ROOM</div><div data-k="map">TERRAIN</div><div data-k="spawn">SPAWN</div></div><div class="foot"><div class="tip"></div><div class="row"><span class="st">CONNECTING</span><span class="pc">3%</span></div><div class="pb"><div class="pf"></div></div></div>`;
  document.body.appendChild(el);
  const det = [...el.querySelectorAll('.det div')]; det.forEach((d, i) => timers.push(setTimeout(() => d.classList.add('on'), 150 + i * 160)));
  let ti = Math.floor(Math.random() * TIPS.length); const tip = () => { const t = q('.tip'); if (!t) return; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; t.innerHTML = '<b>TIP</b>' + TIPS[ti++ % TIPS.length]; }; tip();
  timers.push(setInterval(tip, 3200));
  timers.push(setInterval(() => { if (pct < cap) { pct += (cap - pct) * 0.08 + 0.15; paint(); } }, 250));   // creeps while the server answers, never past the current cap
  timers.push(setTimeout(() => loadingDone(true), 90000));   // safety: never trap the player behind this screen
  paint();
}
export function loadingStep(label, to, key) {
  if (!el) return; q('.st').textContent = label; cap = Math.max(cap, Math.min(99, to)); if (pct < to - 8) pct = to - 8; paint();
  const d = key && q(`.det [data-k="${key}"]`); if (d) d.classList.add('ok');
}
export function loadingDone(force) {
  if (!el || doneT) return; const wait = force ? 0 : Math.max(0, MIN_MS - (performance.now() - t0));
  for (const k of ['link', 'room', 'map', 'spawn']) { const d = q(`.det [data-k="${k}"]`); if (d) d.classList.add('ok'); }
  doneT = setTimeout(() => { if (!el) return; q('.st').textContent = 'READY'; pct = 100; paint(); setTimeout(() => { if (!el) return; el.classList.add('out'); const e = el; timers.forEach((x) => { clearTimeout(x); clearInterval(x); }); timers = []; el = null; doneT = 0; try { sessionStorage.removeItem(KEY); } catch (e2) {} setTimeout(() => e.remove(), 600); }, 350); }, wait);
}
// after a map-switch reload: bring the screen back immediately; mp.js finishes it when the room is playable
try { const r = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (r && Date.now() - r.t < 60000) loadingStart({ map: r.map, mode: r.mode }); else sessionStorage.removeItem(KEY); } catch (e) {}
