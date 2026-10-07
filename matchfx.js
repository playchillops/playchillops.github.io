// matchfx.js - the "fast CS / Black Ops 2" presentation layer of a multiplayer match (Juan 2026-10-06), on top of the net events:
// killfeed, announcer + medals + kill sounds, Gun Game level ups, lead changes, enemy streak warnings, company-logo sprays,
// FINAL KILLCAM and the end-of-match MVP screen (the XP reward card waits until it is closed). One instance per connection.
import { createKillfeed } from './killfeed.js';
import { createAnnouncer } from './announcer.js';
import { createFinalCam } from './finalcam.js';
import { createSprays } from './spray.js';
import { createPowers } from './powers.js';
import { createVoices } from './voices.js';
import { createCallingCards } from './callingcard.js';
import { createEvents } from './events.js';
import { showSummary } from './matchsummary.js';
import { DM, GUN_ORDER, isFree, legendOf } from './common.js';
import { legendOutfit } from './characters.js';
import { WEAPONS } from './player.js';
const MULTI = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'ULTRA KILL', 'RAMPAGE'], SAYM = ['', '', 'Double kill', 'Triple kill', 'Multi kill', 'Ultra kill', 'Rampage'];
const STREAK = { uav: ['UAV online', 'Enemy UAV online'], missile: ['Missile away', 'Enemy missile incoming'], rc: ['RC car deployed', 'Enemy RC car spotted'], airstrike: ['Airstrike inbound', 'Enemy airstrike inbound'], nuke: ['Tactical nuke inbound', 'Enemy tactical nuke inbound'] };
const mmss = (s) => { s = Math.max(0, Math.ceil(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const gname = (lv) => { const id = GUN_ORDER[Math.min(lv, GUN_ORDER.length - 1)]; return id === 'knife' ? 'Knife' : (WEAPONS[id] && WEAPONS[id].name) || id; };
export function createMatchFx({ game, net, THREE, play, banner = () => {} }) {
  if (!document.getElementById('mfx-css')) { const st = document.createElement('style'); st.id = 'mfx-css';   // deathmatch: no money; final killcam: clean screen
    st.textContent = '.sc-dm .eco-chip{display:none!important}.fc-on .sc-hud,.fc-on .info,.fc-on .scb,.fc-on .sbm,.fc-on .kfd,.fc-on .an-box,.fc-on .eco-chip,.fc-on .sk,.fc-on .mp-hud,.fc-on .mp-mini,.fc-on .sc-ch,.fc-on .sc-scope,.fc-on .pr-badge,.fc-on .invb,.fc-on .invh{display:none!important}'; document.head.appendChild(st); }
  const vol = () => { const s = game.set || {}; return s.sfxOn === false ? 0 : (s.vol ?? 0.7) * (s.fx ?? 1); };
  const kf = createKillfeed(), an = createAnnouncer({ volume: vol });
  const cam = createFinalCam(THREE, { camera: game.camera, world: game.world, play, onShot: ({ o, e }) => { try { game.anim.onBotShot({ from: new THREE.Vector3(...o), to: new THREE.Vector3(...e), hit: false }); } catch (er) {} } });
  const sprays = createSprays(THREE, { scene: game.scene, world: game.world });
  const pow = createPowers({ game, net, THREE, an, play, banner });   // superpowers (Q) + taser (X)
  const voices = createVoices({ game, net, an, THREE });               // legend lines: Z taunts, kill lines, power lines
  const cards = createCallingCards({ game, net, an });                 // killer's calling card + nemesis
  const events = createEvents({ game, net, THREE, an, banner, play });  // live map events + care packages
  const who = (id) => { if (!id) return null; const r = net.roster.get(id); return { name: (r && r.name) || (id === net.id ? 'You' : 'Player'), team: id === net.id ? net.team : r && r.team, pr: r && r.pr, ch: (r && r.ch) || (id === net.id ? net.ch : '') }; };
  // your Silicon Valley legend: intro card + voice, and first-person sleeves / bare hands / team cuff
  let shownLegend = '', outfitKey = '';
  const outfit = () => { const key = net.ch + net.team; if (key === outfitKey) return; outfitKey = key; const o = legendOutfit(net.ch, net.team); try { game.vm.setOutfit && game.vm.setOutfit(o); game.kvm && game.kvm.setOutfit && game.kvm.setOutfit(o); } catch (e) {} };
  const introduce = () => { const lg = legendOf(net.ch); if (!lg || shownLegend === net.ch) return; shownLegend = net.ch; an.medal('YOU ARE ' + lg.name.toUpperCase(), lg.co.toUpperCase(), '#ffd166', 3.6); an.say('You are ' + lg.name, 2); };
  net.on('welcome', () => { outfit(); setTimeout(introduce, 900); });
  net.on('roster', () => { const r = net.roster.get(net.id); if (r && r.ch && r.ch !== net.ch) { net.ch = r.ch; shownLegend = ''; setTimeout(introduce, 300); } outfit(); });
  net.on('tsw', () => outfit()); net.on('teamr', () => outfit()); net.on('swap', () => setTimeout(outfit, 50));
  const free = () => isFree(net.mode);
  let multi = 0, multiT = 0, spree = 0, lastKiller = 0, lead = null, sum = null, summaryShown = false, waiting = [], warned = {}, lastGl = 0;
  const flushWaiting = () => { const w = waiting; waiting = []; for (const f of w) try { f(); } catch (e) {} };
  function openSummary() {
    if (!sum || summaryShown) return; summaryShown = true;
    showSummary(sum, { myId: net.id, myTeam: net.team, onClose: flushWaiting });
  }
  function gunLevel(gl, quiet) {
    if (gl == null || gl === lastGl) return; const up = gl > lastGl; lastGl = gl; if (quiet) return;
    const last = GUN_ORDER[gl] === 'knife';
    if (up) { an.sound('level'); an.medal(last ? 'FINAL LEVEL' : 'LEVEL ' + (gl + 1), last ? 'KNIFE KILL TO WIN' : gname(gl).toUpperCase(), last ? '#ff6b6b' : '#7dffb0', 2.4); if (last) an.say('Final level. Knife kill to win', 3); }
  }
  net.on('kill', (m) => {
    if (!m) return;
    const mine = m.by === net.id && m.id !== net.id, me = m.id === net.id;
    const w = m.cause === 'void' ? 'void' : m.cause === 'bomb' ? 'bomb' : (m.w || m.cause || '');
    kf.add({ k: m.by && m.by !== m.id ? who(m.by) : null, v: who(m.id), w, hs: !!m.hs, fb: !!m.fb, mine, me });
    if (mine) {
      const now = performance.now(); multi = now - multiT < 4500 ? multi + 1 : 1; multiT = now; spree++;
      if (m.hs) an.sound('headshot');
      if (multi >= 2) { const i = Math.min(6, multi); an.medal(MULTI[i], '+' + 25 * i, '#ff8f4d'); an.say(SAYM[i], 3); an.sound('multi', multi); }
      else if (m.fb) { an.medal('FIRST BLOOD', '+50', '#ff6b6b'); an.say('First blood', 2); }
      else if (m.id === lastKiller) { an.medal('PAYBACK', '+25', '#7fe3ff'); an.say('Payback', 2); lastKiller = 0; }
      else if (w === 'knife') { an.medal('HUMILIATION', '+25', '#c9a2ff'); an.say('Humiliation', 2); }
      else if (m.hs) { an.medal('HEADSHOT', '+25', '#39ff14'); an.say('Headshot', 1); }
      if (spree === 5) { an.medal('KILLING SPREE', '5 IN A ROW', '#ff8f4d', 2.6); an.say('Killing spree', 3); } else if (spree === 10) { an.medal('UNSTOPPABLE', '10 IN A ROW', '#ff4d6d', 2.6); an.say('Unstoppable', 3); }
      if (net.mode === 'gun') gunLevel(m.gl);
    } else if (!me && m.fb && m.by) an.say('First blood', 1);
    if (me) { spree = 0; multi = 0; lastKiller = m.by && m.by !== net.id ? m.by : 0; if (m.dg) { an.medal('LEVEL LOST', 'KNIFED BY ' + String((who(m.by) || {}).name || '').toUpperCase(), '#ff6b6b'); an.say('Humiliation', 2); } }
    if (net.mode === 'gun' && m.by && m.by !== net.id && GUN_ORDER[m.gl] === 'knife' && !warned['k' + m.by]) { warned['k' + m.by] = 1; banner((who(m.by) || {}).name + ' is on the KNIFE level', 3); an.say('Enemy on the final level', 2); }
  });
  net.on('streak', (m) => { if (!m || !STREAK[m.s]) return; const mine = m.id === net.id, r = net.roster.get(m.id), ally = !mine && !free() && r && r.team === net.team, L = STREAK[m.s];
    an.say(mine || ally ? (ally ? 'Friendly ' + L[0].toLowerCase() : L[0]) : L[1], m.s === 'nuke' ? 4 : 2); if (!mine) banner((ally ? '' : 'ENEMY ') + L[0].toUpperCase().replace(' ONLINE', '') + ' · ' + ((r && r.name) || ''), 3); });
  net.on('round_start', (m) => { if (!m) return; kf.clear(); if (cam.active && (m.dm || m.round === 1)) cam.stop(); if (m.dm) { const d = DM[m.dm]; spree = 0; lead = null; warned = {}; lastGl = 0; if (!document.querySelector('.ms')) { summaryShown = false; sum = null; } sprays.clear();
    an.say(d.name, 2); banner(d.name.toUpperCase() + (m.dm === 'tdm' ? ' · first team to ' + m.limit + ' kills' : m.dm === 'ffa' ? ' · first to ' + m.limit + ' kills · everyone is an enemy' : ' · a kill = next gun · knife kill on the last level wins') + (m.dm !== 'gun' ? ' · B = free loadout' : ''), 5); }
    else if (m.round === 1 && !document.querySelector('.ms')) { summaryShown = false; sum = null; } });
  let tipShown = false;   // once per session: the new keys
  net.on('go', () => { if (!tipShown) { tipShown = true; setTimeout(() => banner('Y superpower · X taser (shop) · T spray your logo · Z taunt', 6), 1200); } });
  net.on('go', () => { if (DM[net.mode]) { an.medal('GO!', '', '#7dffb0', 1.2); } });
  net.on('round_end', (m) => { if (!m || !m.match) return; const draw = !m.winner && !m.wid, won = m.wid ? m.wid === net.id : m.winner === net.team; an.say(draw ? 'Draw' : won ? 'Victory' : 'Defeat', 4); });
  net.on('summary', (m) => { sum = m; summaryShown = false; setTimeout(() => { if (!cam.active) openSummary(); }, 2800); });   // no killcam clip coming -> straight to the scoreboard
  net.on('fkc', (m) => { if (summaryShown) return; cam.play(m, who, () => setTimeout(openSummary, 300)); });
  net.on('spray', (m) => { if (!m) return; sprays.add(m).catch(() => {}); if (m.id === net.id) an.sound('spray'); else { try { const e = net.eye(); if (Math.hypot(e.x - m.p[0], e.z - m.p[2]) < 14) an.sound('spray'); } catch (er) {} } });
  net.on('snap', () => {   // lead changes (FFA / Gun Game) and "kills to win" (TDM)
    try {
      if (net.phase !== 'live') return;
      if (free() && net.fs) { let mine = 0, best = 0; for (const [id, v] of net.fs) { if (id === net.id) mine = v; else best = Math.max(best, v); } if (mine + best === 0) return;
        const st = mine > best ? 'lead' : mine === best ? 'tied' : 'lost'; if (st !== lead) { const was = lead; lead = st; if (was !== null || st === 'lead') { if (st === 'lead') an.say('You are in the lead', 1); else if (st === 'tied') an.say('Tied for the lead', 1); else if (was === 'lead' || was === 'tied') an.say('Lead lost', 1); } } }
      if (net.mode === 'tdm' && net.score) { const d = DM.tdm.limit, my = net.team === 'T' ? 0 : 1, a = net.score[my] | 0, b = net.score[1 - my] | 0;
        if (a >= d - 5 && !warned.a) { warned.a = 1; an.say('Five kills to victory', 2); } if (b >= d - 5 && !warned.b) { warned.b = 1; an.say('Enemy team is five kills from victory', 2); } }
      if (net.mode === 'gun' && net.me.gl != null && net.me.gl < lastGl) lastGl = net.me.gl;
    } catch (e) {}
  });
  const api = {
    cam, sprays, kf, an, pow, voices, cards, events,
    update(dt) { pow.update(dt); voices.update(dt); events.update(dt); },
    /** the XP reward card waits for the MVP screen */
    afterSummary(f) { if (sum && !summaryShown) waiting.push(f); else if (document.querySelector('.ms')) waiting.push(f); else f(); },
    /** T: spray your company logo where you look */
    spray() { if (!net.alive) return; const e = game.ctrl.state.eye, d = game.ctrl.getDirection(), r = sprays.aim(e, d); if (!r) { banner('Get closer to a wall to spray', 1.2); return; } net.sendRaw({ t: 'spray', ...r }); },
    /** HUD line for the continuous modes (mp.hud) */
    info() {
      const d = DM[net.mode]; if (!d) return '';
      if (net.phase === 'freeze') return `${d.name.toUpperCase()} · STARTS IN ${Math.ceil(net.phaseLeft || 0)}${net.mode !== 'gun' ? ' · B = loadout' : ''}`;
      if (net.phase === 'match_end') return 'MATCH OVER';
      const t = mmss(net.phaseLeft);
      if (net.mode === 'gun') { const gl = net.me.gl | 0; return GUN_ORDER[gl] === 'knife' ? `KNIFE LEVEL · knife kill wins · ${t}` : `LEVEL ${gl + 1}/${GUN_ORDER.length} ${gname(gl)} · next ${gname(gl + 1)} · ${t}`; }
      if (net.mode === 'ffa') return `FIRST TO ${d.limit} · ${t}`;
      return `FIRST TEAM TO ${d.limit} · ${t}`;
    },
    /** top scoreboard numbers: {p, b, label} */
    score() {
      const d = DM[net.mode]; if (!d) return null;
      if (net.mode === 'tdm') { const my = net.team === 'T' ? 0 : 1, s = net.score || [0, 0]; return { p: s[my] | 0, b: s[1 - my] | 0, label: '/ ' + d.limit }; }
      let mine = 0, best = 0; for (const [id, v] of net.fs || []) { if (id === net.id) mine = v; else best = Math.max(best, v); }
      return net.mode === 'gun' ? { p: Math.min(mine + 1, GUN_ORDER.length), b: Math.min(best + 1, GUN_ORDER.length), label: 'LVL / ' + GUN_ORDER.length } : { p: mine, b: best, label: 'YOU · TOP / ' + d.limit };
    },
    dispose() { for (const x of [voices, cards, events]) try { x.dispose(); } catch (e) {} try { pow.dispose(); } catch (e) {} try { game.vm.setOutfit && game.vm.setOutfit(null); game.kvm && game.kvm.setOutfit && game.kvm.setOutfit(null); } catch (e) {} document.body.classList.remove('sc-dm', 'fc-on'); cam.dispose(); kf.dispose(); an.dispose(); sprays.dispose(); document.querySelector('.ms')?.remove(); flushWaiting(); },
  };
  return api;
}
