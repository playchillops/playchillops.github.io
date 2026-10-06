// menu.js - ChillOps main menu (Black Ops style layout): modes left, section content center, player right.
import { getStats, shareCard, shareText, rank, favDiff } from './stats.js';
import { profileHtml } from './progress.js';
import * as ACC from './account.js';
import { nameError, companyError } from './profilegate.js';
import { topBox, boardPanel } from './social.js';
import { logoHTML, startConfetti } from './intro.js';
const CSS = `
.mn{position:absolute;inset:0;z-index:1;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-align:left;box-sizing:border-box}
.mn-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse at 72% 45%,#2b3560 0%,#141a33 45%,#070a14 100%);overflow:hidden}
.mn-bg canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.35;filter:blur(1.2px)}
.mn-bg:after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.65) 100%);pointer-events:none}
.mn-char{position:absolute;right:0;top:0;bottom:0;width:62%;z-index:1;pointer-events:none}
.mn-logo{position:absolute;left:clamp(20px,4vw,64px);top:clamp(14px,4vh,44px);font-size:clamp(46px,9vh,92px);line-height:1;z-index:3}
.mn-list{position:absolute;left:clamp(20px,4vw,64px);top:clamp(130px,26vh,240px);z-index:3;display:flex;flex-direction:column;gap:2px}
.mn-i{font:inherit;font-weight:500;font-size:clamp(15px,2.6vh,22px);letter-spacing:.14em;text-transform:uppercase;text-align:left;padding:7px 36px 7px 12px;border:0;background:transparent;color:#cfd6ea;cursor:pointer;min-width:210px;transition:padding .12s,background .12s;border-left:3px solid transparent}
.mn-i em{font-style:normal;font-size:.55em;opacity:.6;margin-left:8px;letter-spacing:.1em}
.mn-i.act{background:linear-gradient(90deg,#ff8a2a,#ff6a1a 70%,rgba(255,106,26,0));color:#fff;padding-left:20px;border-left-color:#ffd166;text-shadow:0 1px 6px rgba(0,0,0,.4)}
.mn-i.lock{opacity:.4;cursor:default}
.mn-gap{height:14px}
.mn-pan{position:absolute;left:clamp(260px,26vw,420px);top:clamp(130px,26vh,240px);right:34%;z-index:3;max-height:62vh;overflow:auto;padding:0 14px}
.pl-grp{margin:0 0 18px}.pl-grp b{display:block;letter-spacing:.2em;font-size:13px;color:#fff}.pl-grp i{display:block;font-style:normal;font-size:12px;opacity:.65;margin:2px 0 8px}.pl-row{display:flex;gap:10px;flex-wrap:wrap}.pl-row .mn-i{width:auto;padding:10px 18px;font-size:16px}.pl-go:focus{outline:2px solid #ffd166}
.mn-pan h3{margin:0 0 10px;font-weight:500;font-size:14px;letter-spacing:.25em;color:#ff9a4a}
.mn-row{display:grid;grid-template-columns:28px 1fr;gap:2px 14px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.12);animation:ch-fade .3s both}
.mn-row svg{grid-row:span 2;width:26px;height:26px;stroke:#ffd166;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.mn-row b{font-weight:600;font-size:15px;letter-spacing:.08em;text-transform:uppercase}.mn-row b i{font-style:normal;color:#ff9a4a;margin-left:10px;font-size:12px;letter-spacing:.1em}
.mn-row span{font-size:12.5px;opacity:.7;line-height:1.35}
.mn-keys{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}.mn-keys div{display:flex;gap:10px;align-items:center;font-size:13px;opacity:.9}
.mn-keys kbd{min-width:44px;text-align:center;border:1px solid rgba(255,255,255,.45);border-radius:5px;font:600 11px Fredoka,system-ui;padding:2px 6px}
.mn-who{position:absolute;right:clamp(20px,4vw,60px);bottom:clamp(50px,9vh,80px);z-index:3;text-align:right;text-shadow:0 2px 8px #000}
.mn-name{font-size:24px;font-weight:600;letter-spacing:.1em}.mn-lvl{font-size:12px;letter-spacing:.2em;opacity:.7}
.mn-bar{position:absolute;left:0;right:0;bottom:0;height:38px;z-index:3;display:flex;gap:26px;align-items:center;padding:0 clamp(20px,4vw,64px);background:linear-gradient(transparent,rgba(0,0,0,.6));font-size:12px;letter-spacing:.12em;opacity:.85}
.mn-bar kbd{border:1px solid rgba(255,255,255,.5);border-radius:5px;padding:1px 7px;margin-right:7px;font:600 11px Fredoka,system-ui}
@media(max-width:760px){.mn-char{width:100%;opacity:.35}.mn-pan{right:14px;left:14px;top:62%}}
`;
const ICONS = {
  nuke: '<svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke-width="3"/><circle cx="27" cy="27" r="4"/><path d="M27 27L15 7a23 23 0 0 1 24 0zM27 27l12 20a23 23 0 0 1-24 0zM27 27L51 27a23 23 0 0 1-12 20z" opacity="0"/><path d="M27 27L16 8a22 22 0 0 1 22 0z"/><path d="M27 27L16 8a22 22 0 0 1 22 0z" transform="rotate(120 27 27)"/><path d="M27 27L16 8a22 22 0 0 1 22 0z" transform="rotate(240 27 27)"/></svg>',
  uav: '<svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="6"/><path d="M14 27a13 13 0 0 1 13-13M8 27A19 19 0 0 1 27 8M40 27a13 13 0 0 1-13 13M46 27a19 19 0 0 1-19 19"/></svg>',
  missile: '<svg viewBox="0 0 54 54"><path d="M27 6c8 8 9 20 5 30H22c-4-10-3-22 5-30z"/><circle cx="27" cy="22" r="3.5"/><path d="M22 36l-7 7M32 36l7 7M27 40v8"/></svg>',
  rc: '<svg viewBox="0 0 54 54"><path d="M8 34h38v-8l-8-4h-14l-6 4H8z"/><circle cx="17" cy="38" r="4.5"/><circle cx="37" cy="38" r="4.5"/><path d="M27 18V8M23 8h8"/></svg>',
  airstrike: '<svg viewBox="0 0 54 54"><path d="M27 6l6 16 15 8-15 4-2 12h-8l-2-12-15-4 15-8z"/><path d="M17 46v4M27 48v4M37 46v4"/></svg>',
  frag: '<svg viewBox="0 0 54 54"><circle cx="27" cy="31" r="14"/><path d="M22 17l5-7 8 3M27 10v-3"/></svg>',
};
export const STREAK_INFO = [
  { id: 'uav', name: 'Radar UAV', at: 3, key: '4', desc: 'Reveals every enemy on the map for 20 s.' },
  { id: 'missile', name: 'Guided missile', at: 5, key: '5', desc: 'Steer a missile down from the sky and crash it wherever you like.' },
  { id: 'rc', name: 'RC bomb car', at: 7, key: '6', desc: 'Drive an explosive little car into the bots.' },
  { id: 'airstrike', name: 'Airstrike', at: 9, key: '7', desc: 'Mark a spot and bomb it in a line.' },
  { id: 'nuke', name: 'Tactical nuke', at: 10, key: '8', desc: 'Everyone goes boom. You win the round.' },
];
export function buildMenu(game, THREE, createCharacter, ROSTER) {
  if (!document.getElementById('mn-css')) { const s = document.createElement('style'); s.id = 'mn-css'; s.textContent = CSS; document.head.appendChild(s); }
  const ov = game.ov, bg = document.createElement('div'); bg.className = 'mn-bg'; bg.innerHTML = '<canvas></canvas>'; ov.appendChild(bg);
  const stopConf = startConfetti(bg.querySelector('canvas'), { rain: 22, speed: .35 });
  const name = (() => { try { return localStorage.getItem('sc_name') || 'Player'; } catch (e) { return 'Player'; } })();
  const el = document.createElement('div'); el.className = 'mn';
  const LV = ['rookie','chill','easy','medium','hard','veteran','elite','insane'];
  const cycleDiff = () => { const i = (LV.indexOf(game.diff) + 1) % LV.length; game.diff = LV[i]; try { const s = JSON.parse(localStorage.getItem('sc_settings') || '{}'); s.diff = game.diff; localStorage.setItem('sc_settings', JSON.stringify(s)); } catch (e) {} if (game.set) game.set.diff = game.diff; const b = list.querySelector('.mn-i.dif'); if (b) b.innerHTML = 'Difficulty<em>' + game.diff + '</em>'; };
  const items = [
    { t: 'Play', p: 'play', a: () => { const b = pan.querySelector('.pl-go'); if (b) b.focus(); } }, { gap: 1 },
    { t: 'Difficulty', diff: 1, a: () => cycleDiff() }, { t: 'How to play', a: () => game.tutorial() }, { t: 'Profile', p: 'profile' }, { t: 'Leaderboard', p: 'board' }, { t: 'Streaks', p: 'streaks' }, { t: 'Help', p: 'help' }, { t: 'Settings', a: () => game.openSettings() },
  ];
  el.innerHTML = `<div class="mn-char"><canvas style="width:100%;height:100%"></canvas></div><div class="mn-logo">${logoHTML()}</div><div class="mn-list"></div><div class="mn-pan"></div>
<div class="mn-who"><div class="mn-name">${name}</div><div class="mn-lvl">LEVEL 1</div></div>
<div class="mn-bar"><span><kbd>↑↓</kbd>Navigate</span><span><kbd>Enter</kbd>Select</span><span><kbd>Esc</kbd>Back</span></div>`;
  ov.appendChild(el); el.appendChild(topBox());
  { const bd = document.createElement('div'); bd.style.cssText = 'position:absolute;left:clamp(20px,4vw,64px);top:clamp(96px,19vh,176px);z-index:3;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9aa6c8;opacity:0;transition:opacity .4s'; el.appendChild(bd);
    const load = async () => { try { const c = new AbortController(); const to = setTimeout(() => c.abort(), 70000); const r = await (await fetch('https://sniper-chill-mp.onrender.com/stats', { cache: 'no-store', signal: c.signal })).json(); clearTimeout(to); bd.innerHTML = '<span style="color:#52f0a0">●</span> ' + r.players + ' playing now'; bd.style.opacity = 1; } catch (e) {} };
    if (!/[?&]nostats/.test(location.search)) load(); }
  const list = el.querySelector('.mn-list'), pan = el.querySelector('.mn-pan'); let sel = 0; const btns = [];
  const panels = {
    profile: () => { const s = getStats(), nm = String(name).replace(/[<>&"]/g, ""), card = shareCard(s, nm), txt = shareText(s, nm);
      return `<h3>PROFILE</h3><p style="margin:2px 0 8px;font-size:20px;font-weight:700">${nm} <span style="color:#ffb347;font-size:14px;letter-spacing:.12em">${rank(s).toUpperCase()}</span></p><p style="font-size:12px;opacity:.7;margin:0 0 10px"><span id="accbox">Loading account...</span></p><div class="mn-keys"><div><b>${s.kills}</b> kills</div><div><b>${s.heads}</b> headshots</div><div><b>${s.roundsWon}/${s.rounds}</b> rounds won</div><div><b>${s.matchesWon}/${s.matches}</b> matches won</div><div><b>${s.bestRoundKills}</b> best round kills</div><div><b>${favDiff(s) || '-'}</b> favourite level</div></div><img alt="Share card" src="${card}" style="width:78%;margin-top:12px;border-radius:10px"><p style="font-size:13px;margin-top:8px"><a style="color:#ffe9a8" download="chillops-card.png" href="${card}">Download card</a> &nbsp;·&nbsp; <a style="color:#ffe9a8" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}">Post on X</a></p>`; },
    board: () => `<h3>COMPANY LEADERBOARD</h3><div id="lbox" style="font-size:14px"><span style="opacity:.6">Loading...</span></div><p style="font-size:12px;opacity:.6">Multiplayer wins by company. Set your company in Profile. Everything is anonymous.</p>`,
    play: () => `<h3>PLAY</h3><div class="pl-grp"><b>LOCAL</b><i>You against bots, no one else needed</i><div class="pl-row"><button class="mn-i pl-go" data-g="a">Kite Garden</button><button class="mn-i pl-go" data-g="b">Kite Plaza</button></div></div><div class="pl-grp"><b>MULTIPLAYER</b><i>Online rooms: find a match, private room or join with a code</i><div class="pl-row"><button class="mn-i pl-go" data-g="mp">Open lobby</button></div></div>`,
    streaks: () => `<h3>STREAKS</h3>${STREAK_INFO.map((s, i) => `<div class="mn-row" style="animation-delay:${i * 60}ms">${ICONS[s.id]}<b>${s.name}<i>${s.at} KILLS · KEY ${s.key}</i></b><span>${s.desc}</span></div>`).join('')}<p style="font-size:12px;opacity:.6">G uses the first one. You lose your streak if you die; surviving the round keeps it.</p>`,
    help: () => `<h3>CONTROLS</h3><div class="mn-keys">${[['WASD', 'Move'], ['Mouse', 'Aim'], ['Click', 'Shoot'], ['Right click', 'Scope'], ['Shift', 'Crouch'], ['Space', 'Jump'], ['R', 'Reload'], ['E', 'Pick up / plant'], ['B', 'Shop'], ['1 2 3', 'Weapons / knife'], ['V H J', 'Grenades'], ['G', 'Use streak'], ['Esc', 'Pause']].map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`,
  };
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, '');
  const fillProfile = async () => { const box = pan.querySelector('#accbox'); if (!box) return; const p = await ACC.sync(true).catch(() => null) || await ACC.ensure().catch(() => null); if (!pan.contains(box)) return;
    if (!p) { box.textContent = 'Saved on this device. Account server is asleep or offline.'; return; }
    box.innerHTML = profileHtml(p) + `Account <b>${esc(p.id)}</b> (anonymous, saved on the server). <span style="display:block;margin:6px 0"><input id="acn" maxlength="16" placeholder="Name" value="${esc(p.name)}" style="width:110px"> <input id="acc" maxlength="24" placeholder="Company" value="${esc(p.company)}" style="width:150px"> <button id="acs" class="mn-i" style="display:inline-block;padding:2px 10px;font-size:13px">Save</button> <span id="acm"></span></span><span style="font-size:11px;opacity:.7">Public page: <a style="color:#9fd" href="?u=${esc(p.id)}">?u=${esc(p.id)}</a> · Recovery code: <button id="acr" style="font-size:11px">Show</button></span>`;
    box.querySelector('#acs').onclick = async () => { const n = box.querySelector('#acn').value, c = box.querySelector('#acc').value, bad = nameError(n) || companyError(c); if (bad) { box.querySelector('#acm').textContent = bad; return; } try { localStorage.setItem('sc_name', n.trim()); localStorage.setItem('sc_company', c.trim()); } catch (e) {} const r = await ACC.update({ name: n, company: c }); box.querySelector('#acm').textContent = r ? 'Saved' : 'Saved on this device'; if (r) try { localStorage.setItem('sc_name', r.name); } catch (e) {} };
    box.insertAdjacentHTML('beforeend', '<span style="display:block;margin-top:6px;font-size:11px;opacity:.8">Have a recovery code? <input id="acx" placeholder="paste code" style="width:150px;font-size:11px"> <button id="acy" style="font-size:11px">Restore</button> <span id="acz"></span></span>');
    box.querySelector('#acy').onclick = async () => { const r = await ACC.restore(box.querySelector('#acx').value); box.querySelector('#acz').textContent = r ? 'Restored: ' + r.name : 'Code not valid'; if (r) { try { localStorage.setItem('sc_name', r.name); } catch (e) {} setTimeout(show, 800); } };
    box.querySelector('#acr').onclick = (e) => { e.target.outerHTML = '<code style="user-select:all;word-break:break-all">' + esc(ACC.recoveryCode()) + '</code> (keep it private; it logs you in on another device)'; }; };
  const fillBoard = async () => { const b = pan.querySelector('#lbox'); if (!b) return; const [c, pl] = await Promise.all([ACC.companies(), ACC.players()]); if (!pan.contains(b)) return;
    b.innerHTML = (c.length ? '<table style="width:100%;border-collapse:collapse"><tr style="opacity:.6;text-align:left"><th>#</th><th>Company</th><th>Wins</th><th>Kills</th><th>Players</th></tr>' + c.slice(0, 12).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.company)}</td><td>${x.wins}</td><td>${x.kills}</td><td>${x.players}</td></tr>`).join('') + '</table>' : '<p>No companies yet. Be the first: set yours in Profile and win a multiplayer match.</p>') + (pl.length ? '<h4 style="margin:12px 0 4px">TOP PLAYERS</h4>' + pl.slice(0, 8).map((x, i) => `<div>${i + 1}. <a style="color:#9fd" href="?u=${esc(x.id)}">${esc(x.name)}</a> ${x.company ? '(' + esc(x.company) + ')' : ''} - ${x.wins} wins, ${x.kills} kills</div>`).join('') : ''); };
  // default view: your profile card (level, rank, XP, tamed lines) whenever no panel item is selected
  const fillHome = async () => { const box = pan.querySelector('#homebox'); if (!box) return; const paint = (p) => { if (pan.contains(box) && p) box.innerHTML = profileHtml(p); }; paint(ACC.getProfile()); paint(await ACC.sync().catch(() => null)); };
  const show = () => { const it = items[sel]; if (!it || !it.p) { pan.innerHTML = `<h3>YOUR PLAYER</h3><p style="margin:2px 0 4px;font-size:20px;font-weight:700">${String(name).replace(/[<>&"]/g, '')}</p><div id="homebox"><span style="opacity:.6">Loading...</span></div>`; fillHome(); return; } pan.innerHTML = panels[it.p](); if (it.p === 'play') pan.querySelectorAll('.pl-go').forEach((b) => { b.onclick = () => { const g = b.dataset.g; if (g === 'mp') game.openMP(); else game.openSolo(g); }; }); if (it.p === 'profile') fillProfile(); if (it.p === 'board') boardPanel(pan); };
  const setSel = (i) => { if (items[i].gap) return; if (i !== sel) { try { window.ChillAudio && window.ChillAudio.play('uiHover'); } catch (e) {} } sel = i; btns.forEach((b, k) => b && b.classList.toggle('act', k === i)); show(); };
  items.forEach((it, i) => { if (it.gap) { const d = document.createElement('div'); d.className = 'mn-gap'; list.appendChild(d); btns.push(null); return; }
    const b = document.createElement('button'); b.className = 'mn-i' + (it.lock ? ' lock' : '') + (it.diff ? ' dif' : ''); b.innerHTML = it.t + (it.lock ? `<em>${it.lock}</em>` : '') + (it.diff ? `<em>${game.diff}</em>` : ''); b.onmouseenter = () => setSel(i); b.onclick = () => { setSel(i); if (it.a) it.a(); }; list.appendChild(b); btns.push(b); });
  sel = -1; show();   // nothing selected on open: the profile card is the default view
  const onKey = (e) => { if (game.state !== 'menu' || game.setOv.style.display !== 'none') return; const dir = e.code === 'ArrowDown' ? 1 : e.code === 'ArrowUp' ? -1 : 0;
    if (dir) { let i = sel; do { i = (i + dir + items.length) % items.length; } while (items[i].gap); setSel(i); e.preventDefault(); } else if (e.code === 'Enter') { if (sel < 0 || pan.contains(document.activeElement)) return; try { window.ChillAudio && window.ChillAudio.play('uiClick'); } catch (e2) {} const it = items[sel]; if (it && it.a) it.a(); } else if (e.code === 'Escape') { sel = -1; btns.forEach((b) => b && b.classList.remove('act')); show(); } };
  addEventListener('keydown', onKey);
  // animated character (own tiny renderer)
  let run = true, rend = null, cleanup = () => {};
  try {
    const cv = el.querySelector('.mn-char canvas'); rend = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); rend.setClearColor(0, 0);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    sc.add(new THREE.AmbientLight(0x8890c0, 0.9)); const dl = new THREE.DirectionalLight(0xffe2c0, 1.0); dl.position.set(2, 3, 4); sc.add(dl); const rim = new THREE.DirectionalLight(0xff8a2a, 2.6); rim.position.set(-3, 2.5, -3); sc.add(rim); const rim2 = new THREE.DirectionalLight(0x6fb6ff, 2.2); rim2.position.set(3, 2, -3); sc.add(rim2);
    const ch = createCharacter(THREE, { id: ROSTER[0].id, team: 'CT', weapon: 'pistol' }); sc.add(ch.group); cam.position.set(0, 1.15, 4.0); cam.lookAt(0, 0.9, 0); ch.group.position.set(0.1, 0, 0);
    let last = performance.now(), t = 0;
    const loop = (now) => { if (!run) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const w = cv.clientWidth, h = cv.clientHeight; if (w && (cv.width !== w || cv.height !== h)) { rend.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      ch.group.rotation.y = Math.PI + Math.sin(t * 0.35) * 0.3 - 0.35; ch.update(dt, { speed: 0, alive: true, weapon: 'pistol', team: 'CT', distance: 4 }); rend.render(sc, cam); };
    requestAnimationFrame(loop);
  } catch (e) { /* no WebGL: panel stays empty */ }
  return () => { run = false; removeEventListener('keydown', onKey); stopConf(); try { rend && rend.dispose(); } catch (e) {} bg.remove(); el.remove(); };
}
