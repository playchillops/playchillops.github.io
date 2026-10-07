// portal.js - map portals (Juan 2026-10-06: "un portal que si lo atraviesas te lleva a https://raceday.gg/").
// Walk through the ring -> warp flash -> the link opens in a new tab (the match keeps running here). If the browser blocks
// the popup, a button opens it on click. 6 s cooldown so standing in the ring doesn't spam tabs. Visuals: map.js (L.portals).
export function createPortals(game) {
  let cool = 0, ov = null;
  const css = 'position:fixed;inset:0;z-index:9800;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-align:center;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95) 0%,rgba(127,227,255,.75) 18%,rgba(122,60,255,.7) 45%,rgba(255,63,180,.85) 75%,rgba(10,6,30,.92) 100%);animation:ptin .5s ease-out';
  function warp(pt) {
    let w = null; try { w = window.open(pt.url, '_blank'); if (w) w.opener = null; } catch (e) {}
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    if (!document.getElementById('pt-css')) { const st = document.createElement('style'); st.id = 'pt-css'; st.textContent = '@keyframes ptin{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:none}}'; document.head.appendChild(st); }
    ov?.remove(); ov = document.createElement('div'); ov.style.cssText = css;
    const host = pt.label || pt.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    ov.innerHTML = `<div style="font-weight:800;font-size:clamp(28px,6vh,56px);letter-spacing:.16em;text-shadow:0 4px 24px #7a3cff">WARPING TO ${host}</div>`
      + (w ? '<div style="font-size:15px;opacity:.9">Opened in a new tab · your match keeps running here</div>' : `<a href="${pt.url}" target="_blank" rel="noopener" style="font:700 20px Fredoka,system-ui,sans-serif;padding:13px 30px;border-radius:14px;background:#ffd166;color:#1b2033;text-decoration:none">OPEN ${host}</a>`)
      + '<div style="font-size:12px;letter-spacing:.14em;opacity:.75">CLICK ANYWHERE OR PRESS ESC TO STAY</div>';
    const close = () => { ov && ov.remove(); ov = null; document.removeEventListener('keydown', key, true); };
    const key = (e) => { if (e.code === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'A') close(); e.stopPropagation(); });
    document.addEventListener('keydown', key, true); setTimeout(close, w ? 2600 : 12000);
    try { game.mp && game.mp.fx && game.mp.fx.an.sound('level'); } catch (e) {}
  }
  return {
    update(dt, pos) {
      cool = Math.max(0, cool - dt); const ps = game.map && game.map.portals; if (cool > 0 || !ps || !ps.length || !pos) return;
      for (const pt of ps) {
        const dx = pos.x - pt.x, dz = pos.z - pt.z, n = dx * Math.sin(pt.yaw) + dz * Math.cos(pt.yaw), l = dx * Math.cos(pt.yaw) - dz * Math.sin(pt.yaw);
        if (Math.abs(n) < .35 && Math.abs(l) < pt.r - .2 && pos.y - pt.y < 1.2 && pos.y - pt.y > -.5) { cool = 6; warp(pt); return; }
      }
    },
  };
}
