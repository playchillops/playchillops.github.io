// bombbeacon.js - once the bomb is planted everyone sees where (Juan 2026-10-05: "que salte donde se ha plantado y así hay más acción"):
// a pulsing light pillar over the bomb that rises above the rooftops, ground rings, and an edge-clamped HUD marker with site, distance and fuse.
// Visual only. Reads game.bomb every frame, so it works the same in solo and multiplayer.
export function createBombBeacon(THREE, scene, root) {
  const g = new THREE.Group(); g.name = 'bomb beacon'; g.visible = false; scene.add(g);
  const mk = (geo, color, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 5; m.frustumCulled = false; g.add(m); return m; };
  const outer = mk(new THREE.CylinderGeometry(1.7, 1.7, 70, 20, 1, true), 0xff3b2f, .42); outer.position.y = 35;
  const core = mk(new THREE.CylinderGeometry(.45, .45, 70, 10, 1, true), 0xffd27a, .8); core.position.y = 35;
  const ringG = new THREE.TorusGeometry(1, .07, 6, 40); ringG.rotateX(Math.PI / 2);
  const rings = [0, 1, 2].map(() => mk(ringG, 0xff846e, .8));
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:0;top:0;z-index:30;pointer-events:none;display:none;transform:translate(-50%,-50%);font-family:Fredoka,system-ui,sans-serif;font-weight:700;color:#fff;text-align:center;white-space:nowrap;text-shadow:0 0 3px #000,0 1px 4px #000';
  el.innerHTML = '<div style="width:30px;height:30px;margin:0 auto 2px;border-radius:50%;background:#ff5a3c;border:2px solid #fff3da;box-shadow:0 0 14px #ff5a3c;display:flex;align-items:center;justify-content:center;font-size:15px"></div><div style="font-size:13px;letter-spacing:.06em"></div>';
  root.appendChild(el); const ic = el.firstChild, tx = el.lastChild;
  const v = new THREE.Vector3(); let t = 0, wasOn = false, fade = 0, lastP = { x: 0, y: 0, z: 0 }, lastSite = '', lastLeft = 40, lastHasT = false; const FADE = 1.5;
  return {
    update(bomb, camera, dt) {
      // on while the bomb is planted and the fuse still runs; after explosion/defuse/round end it fades out over FADE seconds
      const on = !!(bomb && bomb.planted) && !(Number.isFinite(bomb.t) && bomb.t <= 0.05);
      if (on) { wasOn = true; fade = FADE; lastP = { x: bomb.pos.x, y: bomb.pos.y, z: bomb.pos.z }; lastSite = bomb.site; lastLeft = Number.isFinite(bomb.t) ? bomb.t : 40; lastHasT = Number.isFinite(bomb.t); }
      else if (wasOn) { fade -= dt; if (fade <= 0) { wasOn = false; fade = 0; } }
      if (!on && !wasOn) { g.visible = false; el.style.display = 'none'; t = 0; return; }
      g.visible = true; el.style.display = ''; const alpha = on ? 1 : Math.max(0, fade / FADE); el.style.opacity = alpha;
      t += dt; const p = lastP; g.position.set(p.x, p.y, p.z);
      const left = lastLeft, fast = left < 10 ? 3 : 1.2;
      outer.material.opacity = (.36 + .14 * Math.sin(t * 4 * fast)) * alpha; core.material.opacity = .8 * alpha;
      rings.forEach((r, i) => { const u = (t * .8 * fast + i / 3) % 1; r.scale.setScalar(.5 + u * 5); r.position.y = .08; r.material.opacity = .8 * (1 - u) * alpha; });
      // HUD marker: projected on screen, clamped to the edges when off-screen or behind the camera
      const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
      v.set(p.x, p.y + 1.6, p.z).project(camera); let x = v.x, y = v.y; const behind = v.z > 1;
      if (behind) { x = -x; y = -y; }
      const lim = .9; if (behind || Math.abs(x) > lim || Math.abs(y) > lim) { const s = lim / Math.max(Math.abs(x), Math.abs(y), 1e-3); x *= s; y *= s; }
      el.style.left = ((x + 1) / 2 * w) + 'px'; el.style.top = ((1 - y) / 2 * h) + 'px';
      const d = camera.position.distanceTo(v.set(p.x, p.y, p.z));
      ic.textContent = lastSite || '!'; tx.textContent = 'BOMB ' + Math.round(d) + ' m' + (lastHasT ? ' · ' + Math.max(0, Math.ceil(left)) + 's' : '');
      ic.style.transform = 'scale(' + (1 + .12 * Math.sin(t * 6 * fast)) + ')';
    },
    dispose() { scene.remove(g); el.remove(); g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
}
