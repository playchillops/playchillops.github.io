/**
 * graphics.js - "Sniper Chill" look module: stylized toon / low-poly rendering, sky, water, vegetation, props and a
 * cheap post chain (MSAA scene target -> depth outline + color grade + vignette). One self-contained ES module, no
 * imports (THREE is passed in), Three.js r160 compatible (WebGL2).
 *
 * QUICK INTEGRATION (game.js)
 *   import { applyLook } from './graphics.js';
 *   // after: this.scene.add(this.map.group); this.camera = new THREE.PerspectiveCamera(...)
 *   this.look = applyLook(THREE, this.renderer, this.scene, this.map);
 *   // in loop(), replace  this.renderer.render(this.scene, this.camera)  with:
 *   this.look.render(this.camera);
 *   // optional: this.look.resize() after renderer.setSize (render() also notices size changes by itself).
 *   // optional: new THREE.WebGLRenderer({antialias:false}) - MSAA is done in the scene target (saves memory).
 *   // destroy(): this.look.dispose();
 *
 * API
 *   applyLook(THREE, renderer, scene, map, opts?) -> look
 *     opts: { quality:'high'|'medium'|'low' (default 'high'), msaa:4, outline:true, grassCount:7000, seed:7,
 *             sunDir:[x,y,z] (direction TOWARD the sun) }
 *   look.render(camera)      draw the whole frame (sky follows the camera, animates grass/water/palms, post chain)
 *   look.update(dt)          optional: advance animation without rendering (render() does it automatically)
 *   look.resize()            re-sync internal target to renderer drawing-buffer size
 *   look.setQuality(q)       'high' (outline+MSAA+grass 100%), 'medium' (outline, MSAA 2), 'low' (no post, cheap draw)
 *   look.group               THREE.Group with all decoration (sky, water, grass, flowers, bushes, rocks, palms, fx).
 *                            Nothing in it has userData.solid, so bullet raycasts over map.group are unaffected.
 *   look.palette             colors used (sky, fog) in case other modules want to match tint (hit sparks, UI...)
 *   look.dispose()
 * It only touches visuals: no colliders, heights or userData.solid values change. Existing map meshes keep their
 * geometry and names; only their materials are swapped (MeshLambert -> MeshToon with procedural textures).
 */
export function applyLook(THREE, renderer, scene, map, opts = {}) {
  const O = Object.assign({ quality: 'high', msaa: 4, outline: true, grassCount: 9000, seed: 7, sunDir: [38, 30, 20] }, opts);
  const doc = typeof document !== 'undefined' ? document : null;
  let seed = O.seed >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const U = { time: { value: 0 } };
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const group = new THREE.Group(); group.name = 'SniperChillLook'; scene.add(group);

  const P = {
    skyTop: 0x2a7fe0, skyMid: 0x6fb8f0, horizon: 0xcfe8f8, fog: 0xbfdcf0, sun: 0xfff0cf,
    grass: 0x7fcf6e, sand: 0xf3dba6, water: 0x37c3d6, waterDeep: 0x1c7fc4, trunk: 0xa8703f, leafA: 0x2f9e5b, leafB: 0x7fd36a
  };
  const sunDir = new THREE.Vector3(...O.sunDir).normalize();

  // ---------------------------------------------------------------- renderer / scene state
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the post shader
  scene.background = new THREE.Color(P.horizon);
  scene.fog = new THREE.Fog(P.fog, 75, 230);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);

  // ---------------------------------------------------------------- canvas texture helpers
  function canvasTex(w, h, draw, repeat, srgb = true) {
    if (!doc) return null;
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return track(t);
  }
  const wrapDraw = (ctx, w, h, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); } };

  const grassTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7ccb6c'; ctx.fillRect(0, 0, w, h);
    // soft mowing stripes
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,170,0.07)' : 'rgba(20,110,70,0.07)'; ctx.fillRect(i * w / 4, 0, w / 4, h); }
    for (let i = 0; i < 160; i++) { // large blotches
      const x = rnd() * w, y = rnd() * h, r = rr(18, 60), light = rnd() > 0.5;
      wrapDraw(ctx, w, h, () => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = light ? '170,235,110' : '40,150,100'; g.addColorStop(0, `rgba(${c},0.22)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    }
    for (let i = 0; i < 1400; i++) { // little blade ticks
      const x = rnd() * w, y = rnd() * h, l = rr(4, 9), a = rr(-0.5, 0.5) - Math.PI / 2;
      ctx.strokeStyle = rnd() > 0.5 ? 'rgba(210,250,150,0.5)' : 'rgba(35,130,80,0.45)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) { // clover / daisy dots
      const x = rnd() * w, y = rnd() * h; ctx.fillStyle = ['#fff6d6', '#ffe27a', '#ffc2d4'][i % 3];
      ctx.beginPath(); ctx.arc(x, y, rr(1.6, 2.8), 0, 7); ctx.fill();
    }
  }, 9);

  const sandTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4dba4'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(190,140,80,0.16)'; ctx.fillRect(rnd() * w, rnd() * h, rr(1, 3), rr(1, 3)); }
    for (let i = 0; i < 10; i++) { ctx.strokeStyle = 'rgba(200,150,90,0.12)'; ctx.lineWidth = 3; ctx.beginPath(); const y = rnd() * h; ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + 10, w * .6, y - 10, w, y); ctx.stroke(); }
  }, 6);

  const wallTex = canvasTex(64, 128, (ctx, w, h) => { // vertical-only pattern: works on any wall length
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.82, '#f2f0f0'); g.addColorStop(1, '#bfb6b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(80,60,70,0.20)'; ctx.fillRect(0, h * 0.87, w, h * 0.13);   // base strip
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, 0, w, h * 0.04);       // top cap highlight
    ctx.fillStyle = 'rgba(80,60,70,0.14)'; ctx.fillRect(0, h * 0.04, w, h * 0.012);
  });

  const crateTex = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(90,50,20,${0.06 + 0.05 * (i % 2)})`; ctx.fillRect(0, i * h / 4, w, h / 4); ctx.fillStyle = 'rgba(70,40,15,0.35)'; ctx.fillRect(0, i * h / 4, w, 2); }
    ctx.strokeStyle = 'rgba(70,40,15,0.6)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(w - 8, h - 8); ctx.moveTo(w - 8, 8); ctx.lineTo(8, h - 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = 'rgba(40,25,10,0.7)'; for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); }
  });

  const tileTex = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 8;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ox = (r % 2) * (w / cols / 2), x = c * w / cols + ox, y = r * h / rows;
      ctx.fillStyle = `rgba(120,50,20,${rr(0, 0.12)})`; ctx.fillRect(x, y, w / cols, h / rows);
      ctx.strokeStyle = 'rgba(110,50,30,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + .5, y + .5, w / cols - 1, h / rows - 1);
    }
  });

  const blobTex = canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, 0, false);

  // toon ramp: 4 soft bands (nearest filtered) - "chill" so the darkest band is still bright
  const ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 195, 195, 195, 255, 232, 232, 232, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; track(ramp);

  const toon = (params) => { params = Object.assign({ gradientMap: ramp }, params); delete params.flatShading; return track(new THREE.MeshToonMaterial(params)); };

  // ---------------------------------------------------------------- lights
  const MAXY = 50;
  map.lights && map.lights.traverse((l) => {
    if (l.isHemisphereLight) { l.color.set(0xcfe9ff); l.groundColor.set(0xf0d8a8); l.intensity = 1.25; }
    if (l.isDirectionalLight) {
      l.color.set(P.sun); l.intensity = 1.9; l.position.copy(sunDir).multiplyScalar(MAXY);
      l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.radius = 3.5; l.shadow.blurSamples = 12;
      l.shadow.bias = -0.004; l.shadow.normalBias = 0.32;
      const s = l.shadow.camera; s.left = -48; s.right = 48; s.top = 48; s.bottom = -48; s.near = 1; s.far = 140; s.updateProjectionMatrix();
    }
  });

  // ---------------------------------------------------------------- re-skin existing map meshes
  const known = {
    wall: [0xf6efe6, 0xffb3c1, 0xa8d8ea], crate: [0xc98f5a, 0x7fb2d9], roof: [0xe8a87c]
  };
  const matCache = new Map();
  const getMat = (old, mesh) => {
    const hex = old.color ? old.color.getHex() : 0xffffff;
    const key = hex + (old.transparent ? 't' : '');
    if (matCache.has(key)) return matCache.get(key);
    const params = { color: hex, flatShading: true };
    if (known.wall.includes(hex)) { params.map = wallTex; params.color = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.08); }
    else if (known.crate.includes(hex)) params.map = crateTex;
    else if (known.roof.includes(hex)) params.map = tileTex;
    const m = toon(params); matCache.set(key, m); return m;
  };
  const markers = [], palmCones = [], palmTrunks = [];
  let ground = null, waterMesh = null;
  map.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'water') { waterMesh = o; o.visible = false; return; }
    if (o.name === 'beach') { o.visible = false; return; }
    if (o.name === 'ground') { ground = o; o.material = toon({ map: grassTex, color: 0xffffff }); o.receiveShadow = true; o.castShadow = false; return; }
    if (o.name === 'siteA_marker' || o.name === 'siteB_marker') { markers.push(o); return; }
    if (o.geometry && o.geometry.type === 'ConeGeometry' && o.name === 'plant') { palmCones.push(o); o.visible = false; return; } // only planter cones become palms; roofs/noses stay
    if (o.material && o.material.isMeshLambertMaterial) {
      if (Math.abs(o.geometry.parameters?.width - 0.5) < 1e-3 && o.geometry.parameters?.depth === 0.5 && o.material.color.getHex() === 0x9c6b3f) palmTrunks.push(o);
      o.material = getMat(o.material, o);
    }
  });
  // hide the stock trunk boxes' look (they stay for bullets/colliders); the nicer trunk is drawn around them
  palmTrunks.forEach((t) => { t.material = toon({ color: P.trunk, flatShading: true }); });

  // markers: glowing translucent hex pad with pulsing ring
  const pulses = [];
  markers.forEach((m) => {
    const isA = m.name === 'siteA_marker', col = isA ? 0xff6f7d : 0x59d98e;
    m.material = track(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, depthWrite: false, fog: true }));
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2;
    const rad = m.geometry.parameters.radiusTop;
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(rad * 0.92, rad * 1.0, 6, 1)), track(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 6 * 0; ring.position.set(m.position.x, m.position.y + 0.04, m.position.z); ring.renderOrder = 3; group.add(ring); pulses.push({ ring, base: 0.9 });
  });

  // ---------------------------------------------------------------- sky dome (gradient + sun + toon clouds)
  const skyMat = track(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uTop: { value: new THREE.Color(P.skyTop) }, uMid: { value: new THREE.Color(P.skyMid) }, uHor: { value: new THREE.Color(P.horizon) }, uSun: { value: sunDir.clone() }, uSunCol: { value: new THREE.Color(P.sun) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w*0.9999; }',
    fragmentShader: `varying vec3 vD; uniform float uTime; uniform vec3 uTop,uMid,uHor,uSun,uSunCol;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5;} return s; }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        float t1 = smoothstep(-0.02,0.35,y), t2 = smoothstep(0.25,0.95,y);
        vec3 col = mix(uHor,uMid,t1); col = mix(col,uTop,t2);
        if (y < 0.0) col = mix(uHor, uHor*0.95, clamp(-y*4.,0.,1.));
        // sun
        float sd = max(dot(d,normalize(uSun)),0.);
        col += uSunCol*(pow(sd,6.)*0.18 + pow(sd,40.)*0.35);
        col = mix(col, vec3(1.,.97,.86), smoothstep(0.9992,0.9996,sd));
        // clouds: planar projection, toon-thresholded with a lit top edge
        if (y > 0.02) {
          vec2 uv = d.xz/(y+0.18)*1.1 + vec2(uTime*0.006, uTime*0.002);
          float n = fbm(uv*1.4);
          float c = smoothstep(0.52,0.56,n);
          float hi = smoothstep(0.52,0.56,fbm(uv*1.4 + normalize(uSun.xz)*0.07));
          float edge = clamp(c-hi+0.0,0.,1.);
          vec3 cc = mix(vec3(1.7,1.65,1.6), vec3(1.2,1.35,1.55), edge*1.2);
          float fade = smoothstep(0.02,0.22,y);
          col = mix(col, cc, c*fade*0.95);
        }
        gl_FragColor = vec4(col,1.0);
      }`
  }));
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(300, 32, 16)), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);

  // ---------------------------------------------------------------- sand island ring + water
  const isl = new THREE.Mesh(track(new THREE.CylinderGeometry(55, 62, 3, 32, 1)), toon({ map: sandTex, color: 0xffffff, flatShading: true }));
  isl.position.y = -1.8; isl.receiveShadow = true; isl.name = 'look_island'; group.add(isl);
  // the original ground slab already has a hard seam; add a soft grass skirt around it (visual only, below walkable y)
  const waterMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.time, uShallow: { value: new THREE.Color(0x2fd0d8) }, uDeep: { value: new THREE.Color(P.waterDeep) }, uFog: { value: new THREE.Color(P.fog) }, uSun: { value: sunDir.clone() }, uFogRange: { value: new THREE.Vector2(110, 300) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uShallow,uDeep,uFog,uSun; uniform vec2 uFogRange;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 p = vW.xz; float r = length(p);
        float shore = r - 47.8;                      // distance from the beach waterline
        float wob = vn(p*0.25+uTime*0.15)*2.0;
        float sd = shore + wob*0.5 - 1.0;
        float depth = clamp(sd/18.0, 0., 1.);
        vec3 col = mix(uShallow, uDeep, pow(depth,0.6));
        col = mix(vec3(0.62,0.95,0.92), col, smoothstep(0.0,5.0,sd));
        // toon wave stripes
        float w = vn(p*vec2(0.5,0.5) + vec2(uTime*0.25, -uTime*0.18)) + vn(p*1.3 - uTime*0.3)*0.5;
        float stripe = smoothstep(0.78,0.80, fract(w*2.2));
        col += vec3(0.10,0.14,0.12)*stripe;
        // sparkles
        float sp = step(0.985, h21(floor(p*3.0)+floor(uTime*2.0 + h21(floor(p*3.0))*6.0)));
        col += sp*0.5;
        // foam rings at the shore
        float f1 = 1.0 - smoothstep(0.0, 0.5, abs(sd - 0.4 - sin(uTime*0.9)*0.3));
        float f2 = 1.0 - smoothstep(0.0, 0.35, abs(sd - 2.2 - sin(uTime*0.7+1.)*0.4 + vn(p*0.7)*0.8));
        float foam = max(f1, f2*0.7) * step(0.0, sd+0.6);
        col = mix(col, vec3(1.), clamp(foam,0.,1.)*0.95);
        // fog
        float dist = length(vW - cameraPosition);
        float fg = smoothstep(uFogRange.x, uFogRange.y, dist);
        col = mix(col, uFog, fg);
        float alpha = mix(0.9, 1.0, depth);
        gl_FragColor = vec4(col, alpha);
      }`
  }));
  const water = new THREE.Mesh(track(new THREE.PlaneGeometry(900, 900)), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = -1.2; water.renderOrder = -1; group.add(water);

  // ---------------------------------------------------------------- contact shadows (blobs under props)
  const blobMat = track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0x24305a }));
  const blobGeo = track(new THREE.PlaneGeometry(1, 1)); blobGeo.rotateX(-Math.PI / 2);
  const blocked = []; // xz boxes where vegetation must not spawn
  { // contact-shadow blobs: one merged mesh for all of them (was one draw call per collider)
    const bp = [], bu = [];
    (map.colliders || []).forEach((b) => {
      if (b.solid === false || b.name === 'edge' || b.max.y - b.min.y > 3.2) return;
      const hx = (b.max.x - b.min.x + 1.4) / 2, hz = (b.max.z - b.min.z + 1.4) / 2, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, y = b.min.y + 0.02;
      bp.push(cx - hx, y, cz - hz, cx - hx, y, cz + hz, cx + hx, y, cz + hz, cx - hx, y, cz - hz, cx + hx, y, cz + hz, cx + hx, y, cz - hz);
      bu.push(0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1);
    });
    if (bp.length) { const bg = track(new THREE.BufferGeometry()); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(bu, 2));
      bg.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(bp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      const blobs = new THREE.Mesh(bg, blobMat); blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.name = 'contact blobs'; group.add(blobs); }
  }
  (map.colliders || []).forEach((b) => { if (b.solid !== false) blocked.push([b.min.x - 0.5, b.max.x + 0.5, b.min.z - 0.5, b.max.z + 0.5]); });
  (map.floors || []).forEach((f) => { if (f.y > 0.1) blocked.push([f.minX - 0.5, f.maxX + 0.5, f.minZ - 0.5, f.maxZ + 0.5]); });
  (map.ramps || []).forEach((r) => blocked.push([r.minX - 0.3, r.maxX + 0.3, r.minZ - 0.3, r.maxZ + 0.3]));
  ((map.layout && map.layout.sand) || []).forEach((r) => blocked.push([r[0], r[2], r[1], r[3]])); // paved / sandy ground: no grass tufts
  const sites = [map.bombsites && map.bombsites.A, map.bombsites && map.bombsites.B].filter(Boolean);
  const free = (x, z, pad = 0, keepSites = true) => {
    for (const q of blocked) if (x > q[0] - pad && x < q[1] + pad && z > q[2] - pad && z < q[3] + pad) return false;
    if (keepSites) for (const s of sites) if (Math.hypot(x - s.center.x, z - s.center.z) < s.radius * 0.95) return false;
    return true;
  };
  // sightlines: spawn lanes stay a bit cleaner (short grass), tall tufts only away from the player lane
  const place = (n, fn, tries = 40) => { const out = []; for (let i = 0; i < n; i++) for (let t = 0; t < tries; t++) { const p = fn(); if (p) { out.push(p); break; } } return out; };

  // ---------------------------------------------------------------- grass tufts (instanced, swaying)
  const grassGeo = (() => {
    const pos = [], col = [], nor = [];
    const blades = 5;
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + rnd() * 0.6, h = rr(0.14, 0.26), w = rr(0.04, 0.06), r0 = rr(0.02, 0.1);
      const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0, lx = Math.cos(a) * rr(0.04, 0.14), lz = Math.sin(a) * rr(0.04, 0.14);
      const sx = -Math.sin(a) * w, sz = Math.cos(a) * w;
      pos.push(bx - sx, 0, bz - sz, bx + sx, 0, bz + sz, bx + lx, h, bz + lz);
      col.push(0.55, 0.78, 0.45, 0.55, 0.78, 0.45, 1.15, 1.2, 0.8);
      for (let k = 0; k < 3; k++) nor.push(0, 1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return track(g);
  })();
  const grassMat = toon({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x*0.6 + instanceMatrix[3].z*0.45;
      #else
        float ph = 0.0;
      #endif
      float sw = sin(uTime*1.7+ph)*0.07 + sin(uTime*0.9+ph*1.7)*0.04;
      transformed.x += sw*position.y*2.2; transformed.z += sw*0.6*position.y*2.2;`);
  };
  const gHalf = 31;
  const gpts = place(O.grassCount, () => { const x = rr(-gHalf, gHalf), z = rr(-gHalf, gHalf); return free(x, z, 0, false) ? [x, z] : null; }, 6);
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, gpts.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), c = new THREE.Color();
    const tints = [0x6fbf62, 0x62b45f, 0x86cc66, 0x55a860, 0x93d070];
    gpts.forEach(([x, z], i) => { e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); const s = rr(0.8, 1.5); sc.set(s, s * rr(0.8, 1.3), s);
      m.compose(new THREE.Vector3(x, 0, z), q, sc); grass.setMatrixAt(i, m); c.set(tints[(rnd() * tints.length) | 0]); grass.setColorAt(i, c); });
    grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true; }
  grass.frustumCulled = false; grass.receiveShadow = true; grass.name = 'look_grass'; group.add(grass);

  // ---------------------------------------------------------------- flowers
  const flowerGeo = track(new THREE.OctahedronGeometry(0.09, 0)); flowerGeo.translate(0, 0.26, 0);
  const stemGeo = track(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 3)); stemGeo.translate(0, 0.13, 0);
  const fpts = place(260, () => { const x = rr(-gHalf, gHalf), z = rr(-gHalf, gHalf); return free(x, z, 0.3) ? [x, z] : null; }, 6);
  const flowers = new THREE.InstancedMesh(flowerGeo, toon({ color: 0xffffff, flatShading: true }), fpts.length);
  const stems = new THREE.InstancedMesh(stemGeo, toon({ color: 0x4aa05a }), fpts.length);
  { const m = new THREE.Matrix4(), c = new THREE.Color(), cols = [0xff8fb3, 0xffe066, 0xffffff, 0xb79cff, 0xff9d6b];
    fpts.forEach(([x, z], i) => { const s = rr(0.8, 1.5); m.makeScale(s, s, s).setPosition(x, 0, z); flowers.setMatrixAt(i, m); stems.setMatrixAt(i, m); c.set(cols[(rnd() * cols.length) | 0]); flowers.setColorAt(i, c); }); }
  flowers.receiveShadow = true; group.add(flowers, stems);

  // ---------------------------------------------------------------- bushes, rocks
  const bushGeo = track(new THREE.IcosahedronGeometry(1, 1));
  const bushMats = [toon({ color: 0x4fb86a, flatShading: true }), toon({ color: 0x6acb6a, flatShading: true }), toon({ color: 0x3fa766, flatShading: true })];
  const bpts = place(22, () => {
    const edge = rnd() > 0.5, t = rr(-35, 35), s = rr(0, 1) > 0.5 ? 1 : -1;
    const x = edge ? s * rr(31, 36) : rr(-34, 34), z = edge ? t : s * rr(31, 36);
    return free(x, z, 0.6) ? [x, z] : null; });
  const bush = (x, z, sc) => { const g = new THREE.Group(); const mm = bushMats[(rnd() * 3) | 0];
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(bushGeo, mm); const s = sc * rr(0.6, 1); b.scale.set(s, s * 0.8, s); b.position.set(rr(-.6, .6) * sc, s * 0.6, rr(-.6, .6) * sc); b.castShadow = true; b.receiveShadow = true; g.add(b); }
    g.position.set(x, 0, z); g.rotation.y = rnd() * 6; group.add(g); };
  bpts.forEach(([x, z]) => bush(x, z, rr(0.7, 1.1)));
  const rockGeo = track(new THREE.DodecahedronGeometry(1, 0));
  const rockMat = toon({ color: 0xb9b4c9, flatShading: true }), rockMat2 = toon({ color: 0x9fa6bd, flatShading: true });
  const rock = (x, y, z, s) => { const r = new THREE.Mesh(rockGeo, rnd() > 0.5 ? rockMat : rockMat2); r.scale.set(s * rr(.9, 1.4), s * rr(.6, 1), s * rr(.9, 1.4)); r.position.set(x, y + s * 0.3, z); r.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); r.castShadow = r.receiveShadow = true; group.add(r); };
  place(14, () => { const a = rnd() * 6.28, rad = rr(50, 62); return [Math.cos(a) * rad, Math.sin(a) * rad]; }, 1).forEach(([x, z]) => rock(x, -0.3, z, rr(0.6, 1.8)));
  place(10, () => { const x = rr(-34, 34), z = rr(-34, 34); return free(x, z, 0.5) ? [x, z] : null; }).forEach(([x, z]) => rock(x, 0, z, rr(0.25, 0.5)));

  // ---------------------------------------------------------------- palms (bent trunk + curved fronds + coconuts)
  const frondGeo = (() => {
    const pos = [], col = [], idx = []; const leaves = 8, seg = 6;
    for (let l = 0; l < leaves; l++) {
      const a = (l / leaves) * 6.2832 + rr(-0.2, 0.2), L = rr(2.3, 3.0), droop = rr(1.1, 1.8), base = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg, r = t * L, y = 0.9 * t - droop * t * t * 0.9, w = 0.85 * Math.pow(1 - t, 0.6) + 0.02;
        const ca = Math.cos(a), sa = Math.sin(a), px = ca * r, pz = sa * r, nx = -sa * w, nz = ca * w;
        const k = 0.55 + 0.6 * t;
        pos.push(px - nx, y - 0.12 * w, pz - nz, px + nx, y - 0.12 * w, pz + nz); // slight V shape
        const mid = 1.0;
        col.push(0.5 * k, 0.8 * k * mid, 0.5 * k, 0.5 * k, 0.8 * k * mid, 0.5 * k);
        if (i > 0) { const i0 = base + (i - 1) * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); const ng = g.toNonIndexed(); ng.computeVertexNormals(); return track(ng);
  })();
  const frondMat = toon({ color: 0x4caf6a, vertexColors: true, side: THREE.DoubleSide, flatShading: true });
  const trunkGeo = (() => { const g = new THREE.CylinderGeometry(0.26, 0.4, 3.6, 7, 6, true); g.translate(0, 1.8, 0);
    const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(y / 3.6, 2) * 0.55); const band = Math.floor(y / 0.45) % 2; c.push(band ? 0.82 : 1, band ? 0.78 : 0.95, band ? 0.7 : 0.9); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.computeVertexNormals(); return track(g); })();
  const trunkMat = toon({ color: P.trunk, vertexColors: true, flatShading: true });
  const nutGeo = track(new THREE.IcosahedronGeometry(0.17, 0)), nutMat = toon({ color: 0x6b4423, flatShading: true });
  const palms = [];
  // palms are instanced: all trunks, all frond crowns and all coconuts are three draw calls; crowns sway per instance (see palmSway)
  const palmList = [];
  const palm = (x, z, sc = 1, y0 = 0) => { palmList.push({ x, z, sc, y0, ry: rnd() * 6.28, fr: rnd() * 6, ph: rnd() * 6 }); };
  if (map.palmSpots) map.palmSpots.forEach((p) => palm(p.x, p.z, p.s, p.y0)); else {
  palmCones.forEach((c, i) => { if (i % 2 === 0) palm(c.position.x, c.position.z, 1.05); });
  // beach palms beyond the arena walls
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.2832 + rr(-0.15, 0.15), rad = rr(55, 61); palm(Math.cos(a) * rad, Math.sin(a) * rad, rr(0.9, 1.5), -0.35); }
  }

  const palmInst = (() => { const N = palmList.length; if (!N) return null;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N), fronds = new THREE.InstancedMesh(frondGeo, frondMat, N), nuts = new THREE.InstancedMesh(nutGeo, nutMat, N * 3);
    trunks.castShadow = fronds.castShadow = true; trunks.receiveShadow = true; for (const m of [trunks, fronds, nuts]) { m.frustumCulled = false; group.add(m); }
    const base = palmList.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y0, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.ry, 0)), new THREE.Vector3(p.sc, p.sc, p.sc)));
    base.forEach((m, i) => trunks.setMatrixAt(i, m)); trunks.instanceMatrix.needsUpdate = true;
    const crownM = new THREE.Matrix4(), tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), cpos = new THREE.Vector3(0.55, 3.62, 0), npos = [0, 1, 2].map((i) => new THREE.Vector3(Math.cos(i * 2.1) * 0.22, -0.18, Math.sin(i * 2.1) * 0.22));
    const sway = (t) => { for (let i = 0; i < N; i++) { const p = palmList[i];
        e.set(Math.cos(t * 0.6 + p.ph) * 0.03, 0, Math.sin(t * 0.8 + p.ph) * 0.03); crownM.compose(cpos, q.setFromEuler(e), one).premultiply(base[i]);
        fronds.setMatrixAt(i, tmpM.makeRotationY(p.fr).premultiply(crownM)); for (let k = 0; k < 3; k++) nuts.setMatrixAt(i * 3 + k, tmpM.makeTranslation(npos[k].x, npos[k].y, npos[k].z).premultiply(crownM)); }
      fronds.instanceMatrix.needsUpdate = true; nuts.instanceMatrix.needsUpdate = true; };
    sway(0); return { sway }; })();

  // ---------------------------------------------------------------- floating pollen / petals
  const pn = 140, ppos = new Float32Array(pn * 3), pseed = new Float32Array(pn);
  for (let i = 0; i < pn; i++) { ppos[i * 3] = rr(-41, 41); ppos[i * 3 + 1] = rr(0.3, 6); ppos[i * 3 + 2] = rr(-41, 41); pseed[i] = rnd() * 100; }
  const pgeo = track(new THREE.BufferGeometry()); pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3)); pgeo.setAttribute('seed', new THREE.BufferAttribute(pseed, 1));
  const pmat = track(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: U.time },
    vertexShader: `attribute float seed; uniform float uTime; varying float vA; void main(){ vec3 p = position; p.x += sin(uTime*0.3+seed)*1.8 + uTime*0.25; p.z += cos(uTime*0.27+seed*1.3)*1.8; p.y += sin(uTime*0.5+seed*2.)*0.4; p.x = mod(p.x+34.,68.)-34.;
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(60./(-mv.z), 1.5, 7.); vA = 0.55+0.45*sin(uTime+seed); }`,
    fragmentShader: 'varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float a = smoothstep(.5,.15,length(c)); gl_FragColor = vec4(1.,.96,.8,a*vA*0.8); }' }));
  const pollen = new THREE.Points(pgeo, pmat); pollen.frustumCulled = false; group.add(pollen);

  // ---------------------------------------------------------------- post chain
  const size = new THREE.Vector2();
  let rt = null, quad = null, post = null, quality = O.quality, lastW = 0, lastH = 0;
  const makeRT = (w, h, samples) => {
    const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; return t;
  };
  const postMat = track(new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.05 }, uFar: { value: 400 }, uOutline: { value: 1 }, uTime: U.time, uScale: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor,tDepth; uniform vec2 uRes; uniform float uNear,uFar,uOutline,uTime,uScale;
      float lin(float d){ return (uNear*uFar)/(uFar - d*(uFar-uNear)); }
      float iw(vec2 uv){ return 1.0/lin(texture2D(tDepth,uv).x); }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
      void main(){
        vec2 px = uScale/uRes;
        vec3 c = texture2D(tColor,vUv).rgb;
        float w0 = iw(vUv), wl = iw(vUv-vec2(px.x,0.)), wr = iw(vUv+vec2(px.x,0.)), wu = iw(vUv+vec2(0.,px.y)), wd = iw(vUv-vec2(0.,px.y));
        float lap = abs(wl+wr-2.*w0)+abs(wu+wd-2.*w0);
        float edge = smoothstep(0.22,0.45, lap/max(w0,1e-5)) * uOutline;
        float dist = 1.0/max(w0,1e-5);
        edge *= 1.0 - smoothstep(60.,160.,dist)*0.7;   // outlines fade with distance
        // grade
        c *= 1.08;
        float l = dot(c,vec3(.2126,.7152,.0722));
        c = mix(vec3(l), c, 1.16);                          // saturation
        c *= mix(vec3(0.93,1.0,1.1), vec3(1.07,1.0,0.90), smoothstep(0.1,0.9,l)); // teal shadows, warm lights
        c = aces(c*0.95);
        c = mix(c, c*vec3(0.30,0.26,0.38), edge*0.85);     // colored ink outline
        vec2 q = vUv-0.5; c *= 1.0 - dot(q,q)*0.55;        // vignette
        c = pow(c, vec3(1./2.2));                           // sRGB-ish
        c += (fract(sin(dot(gl_FragCoord.xy+uTime,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.;
        gl_FragColor = vec4(c,1.);
      }`
  }));
  quad = new THREE.Mesh(track(new THREE.BufferGeometry()), postMat);
  quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quad.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    renderer.getDrawingBufferSize(size); const w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
    if (w === lastW && h === lastH && rt) return; lastW = w; lastH = h;
    if (rt) rt.dispose();
    const samples = quality === 'high' ? O.msaa : quality === 'medium' ? 2 : 0;
    rt = makeRT(w, h, renderer.capabilities.isWebGL2 ? samples : 0);
    postMat.uniforms.uRes.value.set(w, h); postMat.uniforms.uScale.value = Math.max(1, h / 720);
  }
  function setQuality(q) {
    quality = q; sky.visible = true; grass.count = Math.floor(gpts.length * (q === 'low' ? 0.35 : q === 'medium' ? 0.7 : 1));
    pollen.visible = q !== 'low'; lastW = 0; resize(); postMat.uniforms.uOutline.value = O.outline && q !== 'low' ? 1 : 0;
  }

  // ---------------------------------------------------------------- per-frame
  let t0 = (typeof performance !== 'undefined' ? performance.now() : 0), tPrev = t0;
  function update(dt) {
    U.time.value += dt; const t = U.time.value;
    if (palmInst) palmInst.sway(t);
    pulses.forEach((p, i) => { const k = (Math.sin(t * 2 + i) + 1) / 2; p.ring.material.opacity = 0.5 + 0.4 * k; p.ring.scale.setScalar(1 + 0.03 * k); });
  }
  function render(camera) {
    const now = performance.now(); const dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; update(dt);
    sky.position.copy(camera.position);
    if (quality === 'low') { renderer.setRenderTarget(null); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.render(scene, camera); renderer.toneMapping = THREE.NoToneMapping; return; }
    resize();
    postMat.uniforms.uNear.value = camera.near; postMat.uniforms.uFar.value = camera.far;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
    postMat.uniforms.tColor.value = rt.texture; postMat.uniforms.tDepth.value = rt.depthTexture;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  setQuality(quality);

  function dispose() { scene.remove(group); disposables.forEach((d) => d.dispose && d.dispose()); rt && rt.dispose(); matCache.forEach((m) => m.dispose()); }
  return { render, update, resize, setQuality, dispose, group, palette: P, sunDirection: sunDir };
}
export default applyLook;
