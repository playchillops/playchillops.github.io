// knifevm.js - first-person knife (Juan 2026-10-06: "el cuchillo base es una espada pirata y el otro mariposa", no blade through the hand).
// createKnifeVM(THREE, camera) -> { root, setType(type), setOutfit(o), draw(), slash(), stab(), inspect(), busy(), update(dt, look) }
//   type: 'default' (pirate cutlass) | 'kite' (Kite Cutter: the cutlass in kite colours) | 'butterfly' (balisong)
// One rigid chain: rig (camera space) -> forearm + roll (around the forearm) -> wrist (bend) -> hand (fist, grip axis = +Y) -> weapon.
// The grip runs through the fist along +Y; blades start above the fist (guard / pivot), so a rigid pose can never cut the hand.
// The balisong flips swing the blade + bite handle in a plane beside the palm while the fingers open out of that plane.
// Animations are keyframed channels sampled with monotone cubic splines (smooth, no overshoot: the bite handle never swings past closed).
// Visual only (game.js / the server decide hits). Toon materials + ink outlines like the rest of the game.
const PI = Math.PI, TAU = 2 * PI;
const CH = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'wb', 'ws', 'roll', 'b', 'h', 'curl'];
const REST = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, wb: 0, ws: 0, roll: 0, b: 0, h: 0, curl: 1 };
// key: [time, {channel: value}]; channels left out keep the previous key's value (first key: REST)
function compile(keys) {
  const ts = keys.map((k) => k[0]), out = { ts, ch: {} };
  for (const c of CH) { let last = REST[c]; const vs = keys.map((k) => (last = k[1][c] ?? last)); out.ch[c] = { vs, ms: tangents(ts, vs) }; }
  out.end = ts[ts.length - 1]; return out;
}
function tangents(ts, vs) {   // Fritsch-Carlson monotone cubic tangents
  const n = vs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / Math.max(1e-6, ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
  return m;
}
function sample(A, t, o) {
  const ts = A.ts; let i = 0; while (i < ts.length - 2 && t > ts[i + 1]) i++;
  const t0 = ts[i], t1 = ts[Math.min(i + 1, ts.length - 1)], h = Math.max(1e-6, t1 - t0), u = Math.max(0, Math.min(1, (t - t0) / h)), u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (const c of CH) { const { vs, ms } = A.ch[c], j = Math.min(i + 1, vs.length - 1); o[c] = h00 * vs[i] + h10 * h * ms[i] + h01 * vs[j] + h11 * h * ms[j]; }
  return o;
}
const k = (t, o) => [t, o];
const ANIM = {
  // rx pitch / ry yaw: the arm turns about the shoulder behind the camera; rz: the blade tilts left/right about the wrist (screen roll);
  // roll: forearm rotation (presents the flat or the knuckle guard); wb / ws: wrist flex / side bend; p = small extra offsets
  // cutlass: rises from the lower right while the hand twirls it a full turn around the forearm, settles with a small bounce
  draw: compile([k(0, { px: .03, py: -.1, pz: .05, rx: -.5, ry: -.25, rz: -.35, roll: 0, wb: .3 }), k(.18, { px: .01, py: -.03, pz: .01, rx: -.16, ry: -.08, rz: -.1, roll: -3.2, wb: -.1 }),
    k(.36, { px: 0, py: .006, pz: -.006, rx: .04, ry: .02, rz: .03, roll: -TAU + .12, wb: -.18 }), k(.5, { px: 0, py: -.003, pz: .002, rx: -.015, ry: 0, rz: -.008, roll: -TAU, wb: .04 }), k(.68, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, roll: -TAU, wb: 0 })]),
  // light slash, right to left: blade cocked up-right (anticipation), fast arc down-left with the wrist snapping through, follow-through, recovery
  slashA: compile([k(0, {}), k(.07, { px: .03, py: .03, pz: .01, rx: .1, ry: -.1, rz: -.5, wb: -.3 }), k(.14, { px: 0, py: 0, pz: -.02, rx: 0, ry: .1, rz: .3, wb: .15 }),
    k(.2, { px: -.02, py: -.005, pz: -.01, rx: -.08, ry: .15, rz: .68, wb: .4 }), k(.27, { px: -.024, py: -.01, pz: -.005, rx: -.1, ry: .16, rz: .72, wb: .36 }), k(.46, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, wb: 0 })]),
  // light slash, left to right (backhand): blade cocked flat to the left, sweeps right
  slashB: compile([k(0, {}), k(.07, { px: -.03, py: .03, pz: 0, rx: .1, ry: .1, rz: .8, wb: -.25, ws: .1 }), k(.14, { px: .005, py: 0, pz: -.02, rx: 0, ry: -.05, rz: -.1, wb: .15, ws: -.05 }),
    k(.2, { px: .04, py: -.03, pz: -.01, rx: -.12, ry: -.15, rz: -.85, wb: .35, ws: -.1 }), k(.27, { px: .045, py: -.035, pz: -.005, rx: -.14, ry: -.16, rz: -.9, wb: .3, ws: -.1 }), k(.46, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, wb: 0, ws: 0 })]),
  // heavy stab: wind up (hand up and back, point turned forward), lunge, hold, twist out, recover
  stab: compile([k(0, {}), k(.2, { px: .01, py: .02, pz: .03, rx: .15, ry: -.03, rz: -.15, roll: -.4, wb: -.25 }), k(.3, { px: -.01, py: -.005, pz: -.08, rx: -.2, ry: .08, rz: .05, roll: -.8, wb: .2 }),
    k(.42, { px: -.012, py: -.008, pz: -.075, rx: -.19, ry: .08, rz: .05, roll: -.8, wb: .18 }), k(.56, { px: -.005, py: -.015, pz: -.03, rx: -.08, ry: .03, rz: .2, roll: -.3, wb: .05 }), k(.85, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, wb: 0, roll: 0 })]),
  // cutlass inspect: raise it and turn the forearm to show the flat, rotate over to the knuckle guard and the other side, back with a flick
  inspect: compile([k(0, {}), k(.45, { px: 0, py: .03, pz: 0, rx: .25, ry: .2, roll: 1.5, wb: -.05 }), k(1.1, { px: -.004, py: .034, rx: .27, ry: .21, roll: 1.62, wb: -.08 }),
    k(1.7, { px: -.04, py: .06, rx: .15, ry: .05, roll: -1.7, wb: -.4 }), k(2.25, { px: -.044, py: .062, rx: .17, ry: .05, roll: -1.85, wb: -.42 }),
    k(2.6, { px: 0, py: .01, pz: 0, rx: .02, ry: 0, rz: .08, roll: .15, wb: .15 }), k(2.95, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, roll: 0, wb: 0 })]),
  // balisong draw: comes up closed with the hand open, classic flip open (blade + bite handle swing out the front, the bite handle
  // goes over the top and closes against the safe handle), then the fist closes
  drawB: compile([k(0, { px: .03, py: -.1, pz: .04, rx: -.42, ry: -.22, rz: -.3, b: PI, h: 0, curl: 0, wb: .2 }), k(.2, { px: .005, py: -.015, pz: .005, rx: -.07, ry: -.03, rz: -.05, b: PI, h: 0, curl: 0, wb: 0 }),
    k(.36, { px: 0, py: -.008, pz: 0, rx: -.03, b: 0, h: PI, curl: 0, wb: -.25 }), k(.52, { px: 0, py: -.004, pz: 0, rx: -.015, b: 0, h: TAU, curl: 0, wb: .15 }),
    k(.58, { h: TAU, curl: 0 }), k(.7, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, h: TAU, curl: 1, wb: 0 }), k(.82, { h: TAU, curl: 1 })]),
  // balisong inspect: show the blade, open the hand, flip it closed and open twice, close the fist, back
  inspectB: compile([k(0, {}), k(.4, { py: .03, rx: .25, ry: .15, roll: 1.3 }), k(.9, { py: .033, rx: .27, ry: .16, roll: 1.4 }),
    k(1.05, { curl: 0, roll: .15, rx: .18, ry: .08, py: .025 }), k(1.17, { h: PI, curl: 0, wb: -.15 }), k(1.35, { b: PI, h: 0, wb: .15 }), k(1.41, { b: PI, h: 0 }),
    k(1.57, { b: 0, h: PI, wb: -.2 }), k(1.73, { b: 0, h: TAU, wb: .15 }), k(1.79, { h: TAU }),
    k(1.91, { b: 0, h: TAU + PI, wb: -.15 }), k(2.09, { b: PI, h: TAU, wb: .15 }), k(2.15, { b: PI, h: TAU }),
    k(2.31, { b: 0, h: TAU + PI, wb: -.2 }), k(2.47, { b: 0, h: 2 * TAU, wb: .1 }), k(2.53, { h: 2 * TAU, curl: 0 }), k(2.65, { h: 2 * TAU, curl: 1, wb: 0 }),
    k(3.05, { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, roll: 0, h: 2 * TAU, curl: 1 })]),
};
// fist geometry (hand space: grip axis +Y through the origin, knuckles toward -Z, palm block on +X, wrist behind it)
const WRIST = [.035, 0, .05];
const FING = [0, 1, 2, 3].map((i) => ({ y: .027 - i * .0185, r: .0098 - i * .0006, s: 1 - i * .06 }));
const CLOSED = [[-.0140, -.0242], [-.0279, -.0024], [-.0214, .0180]];   // finger joints on a ring of r 0.028 around the grip (x, z)
const KNUCKLE = [.022, -.026];
export function createKnifeVM(THREE, camera) {
  const T = THREE, toon = (c) => new T.MeshToonMaterial({ color: c }), ink = new T.MeshBasicMaterial({ color: 0x2a2140, side: T.BackSide });
  const mesh = (g, c, parent, x = 0, y = 0, z = 0, line = 1.08) => { const m = new T.Mesh(g, typeof c === 'number' ? toon(c) : c); m.position.set(x, y, z); parent.add(m); if (line) { const o = new T.Mesh(g, ink); o.scale.setScalar(line); m.add(o); } m.renderOrder = 2; return m; };
  const caps = (r, len) => { const g = new T.CapsuleGeometry(r, Math.max(.001, len - 2 * r), 4, 10); g.rotateZ(-PI / 2); g.translate(len / 2, 0, 0); return g; };   // along +X from the origin
  const root = new T.Group(); root.name = 'knife viewmodel'; root.visible = false; camera.add(root);
  const colliders = [], blades = [];   // for tests/knifeclip.mjs: hand capsules + blade meshes
  const coll = (obj, a, b, r, tag = 'hand') => colliders.push({ obj, a: new T.Vector3(...a), b: new T.Vector3(...b), r, tag });
  // ---- rig (camera space) + base orientation: forearm from the lower right, blade forward-up-left ----
  const HOME = new T.Vector3(.16, -.19, -.34), SHOULDER = new T.Vector3(.25, -.35, .15), ZC = new T.Vector3(0, 0, 1), DEV = 1.0;
  const rig = new T.Group(); root.add(rig);
  // base orientation from two camera-space directions: the forearm (rig +Z) and the blade (in the forearm/blade plane)
  const orient = (F, B) => { F = new T.Vector3(...F).normalize(); B = new T.Vector3(...B).normalize();
    const fl = new T.Vector3(0, 0, 1), bl = new T.Vector3(0, Math.cos(DEV), -Math.sin(DEV)), basis = (a, b) => { const u = b.clone().addScaledVector(a, -b.dot(a)).normalize(); return new T.Matrix4().makeBasis(a, u, new T.Vector3().crossVectors(a, u)); };
    return new T.Quaternion().setFromRotationMatrix(basis(F, B).multiply(basis(fl, bl).transpose())); };
  let baseQ = orient([.85, -.3, .43], [-.55, .62, -.55]);   // forearm in from the right, blade up-left with its flat to the camera
  // ---- forearm + sleeve: from the wrist toward a fixed elbow point off-screen (lower right), so a swing of the hand reads like an arm
  //      pivoting at the elbow instead of the whole forearm sweeping across the view ----
  const skin = 0xf2c9a0, sleeveC = 0x2a6fd6, skinM = toon(skin), arm = new T.Group(); root.add(arm);
  const fa = new T.CylinderGeometry(.033, .039, .17, 16); fa.rotateX(PI / 2); mesh(fa, skinM, arm, 0, 0, .085, 1.06);
  const sl = new T.CylinderGeometry(.047, .053, .28, 16); sl.rotateX(PI / 2); const slM = mesh(sl, sleeveC, arm, 0, 0, .3, 1.05);
  const cuffG = new T.CylinderGeometry(.05, .05, .035, 16); cuffG.rotateX(PI / 2); const cuM = mesh(cuffG, 0xffd166, arm, 0, 0, .165, 1.06);
  coll(arm, [0, 0, .02], [0, 0, .16], .04, 'arm'); coll(arm, [0, 0, .16], [0, 0, .45], .054, 'arm');
  const ELBOW = new T.Vector3(), Z1 = new T.Vector3(0, 0, 1), armDir = new T.Vector3(), BENDMAX = .42, qB = new T.Quaternion(), qI = new T.Quaternion();
  const setElbow = () => ELBOW.copy(Z1).applyQuaternion(baseQ).multiplyScalar(.42).add(HOME);
  // ---- roll (spins hand + weapon around the forearm) -> wrist (bend) -> hand ----
  const roll = new T.Group(); rig.add(roll);
  const wrist = new T.Group(); roll.add(wrist);
  const hand = new T.Group(); hand.position.set(-WRIST[0], -WRIST[1], -WRIST[2]); wrist.add(hand);
  mesh(new T.SphereGeometry(.031, 14, 10), skinM, hand, WRIST[0] - .002, WRIST[1], WRIST[2] - .006, 1.06);    // wrist joint
  const palm = mesh(new T.SphereGeometry(1, 18, 12), skinM, hand, .034, -.002, .008, 0); palm.scale.set(.019, .042, .038);
  { const ol = new T.Mesh(palm.geometry, ink); ol.scale.setScalar(1.08); palm.add(ol); }
  coll(hand, [.034, -.03, .0], [.034, .028, .0], .018); coll(hand, [.034, -.03, .025], [.034, .028, .025], .017); coll(hand, [WRIST[0], 0, WRIST[2] - .006], [WRIST[0], 0, WRIST[2]], .03);
  // fingers: three phalanges each, curl 1 = wrapped round the grip on a ring of r 0.028, curl 0 = straight out forward-right (clear of the balisong swing plane)
  const fingers = FING.map((F, i) => {
    const kx = KNUCKLE[0], kz = KNUCKLE[1] + i * .001, pts = [[kx, kz], ...CLOSED.map(([x, z]) => [x, z])];
    const lens = [0, 1, 2].map((j) => Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]) * (j === 2 ? .8 : 1) * (j ? F.s : 1));
    const absC = [0, 1, 2].map((j) => Math.atan2(-(pts[j + 1][1] - pts[j][1]), pts[j + 1][0] - pts[j][0]));
    const absO = [Math.atan2(.95, .3), Math.atan2(.95, .3) + .25, Math.atan2(.95, .3) + .45];
    const rel = (abs) => [abs[0], abs[1] - abs[0], abs[2] - abs[1]].map((a, j) => (j ? Math.atan2(Math.sin(a), Math.cos(a)) : a));
    const RC = rel(absC), RO = rel(absO); RO[0] = RC[0] + Math.atan2(Math.sin(RO[0] - RC[0]), Math.cos(RO[0] - RC[0]));
    const j0 = new T.Group(); j0.position.set(kx, F.y, kz); hand.add(j0);
    const j1 = new T.Group(); j1.position.x = lens[0]; j0.add(j1); const j2 = new T.Group(); j2.position.x = lens[1]; j1.add(j2);
    mesh(caps(F.r, lens[0] + F.r), skinM, j0, -F.r * .5, 0, 0, 1.1); mesh(caps(F.r * .97, lens[1] + F.r * .4), skinM, j1, 0, 0, 0, 1.1); mesh(caps(F.r * .92, lens[2]), skinM, j2, 0, 0, 0, 1.1);
    mesh(new T.SphereGeometry(F.r * 1.12, 10, 8), skinM, j0, 0, 0, 0, 0);
    coll(j0, [0, 0, 0], [lens[0], 0, 0], F.r); coll(j1, [0, 0, 0], [lens[1], 0, 0], F.r * .97); coll(j2, [0, 0, 0], [lens[2], 0, 0], F.r * .92);
    return { j: [j0, j1, j2], RC, RO };
  });
  // thumb: wraps round the back of the grip above the index finger; opens up along the palm side for balisong flips
  const thumb = new T.Group(); thumb.position.set(.03, .036, .02); hand.add(thumb);
  const th1 = new T.Group(); thumb.add(th1); const th2 = new T.Group(); th2.position.x = .034; th1.add(th2);
  mesh(caps(.0115, .038), skinM, th1, -.004, 0, 0, 1.1); mesh(caps(.0108, .025), skinM, th2, 0, 0, 0, 1.1);
  coll(th1, [0, 0, 0], [.034, 0, 0], .0115); coll(th2, [0, 0, 0], [.025, 0, 0], .0108);
  const X1 = new T.Vector3(1, 0, 0), qDir = (x, y, z) => new T.Quaternion().setFromUnitVectors(X1, new T.Vector3(x, y, z).normalize());
  const THC = [qDir(-.977, 0, .21), new T.Quaternion().setFromEuler(new T.Euler(0, -.82, 0))];   // closed: round the back of the grip to the -X side
  const THO = [qDir(.25, .8, .55), new T.Quaternion().setFromEuler(new T.Euler(0, 0, .15))];        // open: up and back, the path stays behind the blade plane
  // ---- pirate cutlass (+ Kite Cutter colours): grip through the fist, brass shell guard, knuckle bow in front of the fingers ----
  const cut = new T.Group(); hand.add(cut); const CM = {};
  { const grip = new T.CylinderGeometry(.0125, .0125, .108, 14); CM.grip = mesh(grip, 0x4a2c1a, cut, 0, .002, 0, 1.08);
    CM.wire = []; for (let i = 0; i < 8; i++) { const w = new T.TorusGeometry(.0128, .0016, 5, 16); w.rotateX(PI / 2); w.rotateZ(.25); CM.wire.push(mesh(w, 0xffd166, cut, 0, -.044 + i * .0125, 0, 0)); }
    const shell = new T.SphereGeometry(.034, 18, 8, 0, TAU, 0, PI * .32); CM.guard = mesh(shell, 0xd9a640, cut, 0, .04, 0, 1.08); CM.guard.scale.set(1, .55, 1.15);
    const ring = new T.TorusGeometry(.03, .004, 6, 22); ring.rotateX(PI / 2); CM.rim = mesh(ring, 0xffc94d, cut, 0, .05, 0, 0); CM.rim.scale.set(1, 1, 1.15);
    const bow = new T.CatmullRomCurve3([new T.Vector3(0, .052, -.033), new T.Vector3(0, .036, -.05), new T.Vector3(0, 0, -.055), new T.Vector3(0, -.04, -.044), new T.Vector3(0, -.058, -.016)]);
    CM.bow = mesh(new T.TubeGeometry(bow, 24, .0045, 6, false), 0xd9a640, cut, 0, 0, 0, 1.15);
    CM.pom = mesh(new T.SphereGeometry(.0145, 14, 10), 0xd9a640, cut, 0, -.062, 0, 1.1); CM.pom.scale.set(1, .85, 1);
    CM.cap = mesh(new T.SphereGeometry(.006, 8, 6), 0xffe08a, cut, 0, -.075, 0, 0);
    // curved single-edged blade (edge toward the knuckle bow), clipped tip; shape in (along blade, across), extruded thin in X
    const sh = new T.Shape(); sh.moveTo(.058, .011); sh.quadraticCurveTo(.21, .016, .3, .043); sh.lineTo(.335, .028); sh.quadraticCurveTo(.31, -.034, .21, -.026); sh.quadraticCurveTo(.12, -.021, .058, -.021); sh.closePath();
    const swap = new T.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);   // shape x -> hand y, shape y -> hand z, depth -> hand x
    const bg = new T.ExtrudeGeometry(sh, { depth: .0035, bevelEnabled: true, bevelThickness: .0016, bevelSize: .002, bevelSegments: 1, curveSegments: 16 }); bg.translate(0, 0, -.00175); bg.applyMatrix4(swap);
    CM.blade = mesh(bg, 0xdfe9f5, cut, 0, 0, 0, 1.05); blades.push(CM.blade);
    const eg = new T.Shape(); eg.moveTo(.07, -.0215); eg.quadraticCurveTo(.13, -.022, .21, -.0265); eg.quadraticCurveTo(.305, -.034, .331, .024); eg.lineTo(.322, .022); eg.quadraticCurveTo(.3, -.026, .21, -.02); eg.quadraticCurveTo(.13, -.016, .07, -.0155); eg.closePath();
    const egg = new T.ExtrudeGeometry(eg, { depth: .0058, bevelEnabled: false, curveSegments: 14 }); egg.translate(0, 0, -.0029); egg.applyMatrix4(swap); CM.edge = mesh(egg, 0xffffff, cut, 0, 0, 0, 0);
    const fu = new T.Shape(); fu.moveTo(.075, .004); fu.quadraticCurveTo(.17, .008, .24, .022); fu.lineTo(.238, .016); fu.quadraticCurveTo(.17, .002, .075, -.002); fu.closePath();
    const fug = new T.ExtrudeGeometry(fu, { depth: .0062, bevelEnabled: false, curveSegments: 10 }); fug.translate(0, 0, -.0031); fug.applyMatrix4(swap); CM.fuller = mesh(fug, 0x9db3c9, cut, 0, 0, 0, 0);
    CM.tip = new T.Object3D(); CM.tip.position.set(0, .332, .026); cut.add(CM.tip); CM.mid = new T.Object3D(); CM.mid.position.set(0, .19, -.005); cut.add(CM.mid); }
  // ---- balisong: safe handle against the palm, blade + bite handle swing beside it (pins along X, pivot above the fist) ----
  const bfly = new T.Group(); hand.add(bfly); const BM = {}, PIV = .062, HL = .178, XS = .011, XB = .00375, XBi = -.00375;
  { const pivot = new T.Group(); pivot.position.set(0, PIV, 0); bfly.add(pivot); BM.pivot = pivot;
    const handleG = new T.BoxGeometry(.007, HL, .025); handleG.translate(0, -HL / 2, 0);
    const holes = (g, c) => { for (let i = 0; i < 6; i++) mesh(new T.BoxGeometry(.0076, .015, .009), c, g, 0, -.03 - i * .025, 0, 0); };
    BM.safe = new T.Group(); BM.safe.position.x = XS; pivot.add(BM.safe); BM.safeM = mesh(handleG, 0xff846e, BM.safe, 0, 0, 0, 1.08); holes(BM.safe, 0x7a2a44);
    BM.bite = new T.Group(); BM.bite.position.x = XBi; pivot.add(BM.bite); BM.biteM = mesh(handleG, 0x68e3db, BM.bite, 0, 0, 0, 1.08); holes(BM.bite, 0x1d6670);
    const latch = new T.BoxGeometry(.006, .026, .006); latch.translate(0, -.013, 0); BM.latch = mesh(latch, 0xffd166, BM.bite, 0, -HL + .002, -.01, 1.1);
    for (const [g, x] of [[BM.safe, 0], [BM.bite, 0]]) { const pin = new T.CylinderGeometry(.0042, .0042, .0105, 10); pin.rotateZ(PI / 2); mesh(pin, 0xffd166, g, x, 0, 0, 0); }
    const blade = new T.Group(); blade.position.x = XB; pivot.add(blade); BM.blade = blade;
    const sh = new T.Shape(); sh.moveTo(-.004, .0115); sh.lineTo(.12, .0115); sh.quadraticCurveTo(.148, .011, .168, -.001); sh.lineTo(.137, -.0065); sh.quadraticCurveTo(.07, -.0125, .008, -.0115); sh.lineTo(-.004, -.0088); sh.closePath();
    const swap = new T.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
    const bg = new T.ExtrudeGeometry(sh, { depth: .0026, bevelEnabled: true, bevelThickness: .0012, bevelSize: .0012, bevelSegments: 1, curveSegments: 10 }); bg.translate(0, 0, -.0013); bg.applyMatrix4(swap);
    BM.steel = mesh(bg, 0xe8f4ff, blade, 0, 0, 0, 1.06); blades.push(BM.steel);
    mesh(new T.BoxGeometry(.0045, .085, .0026), 0x9ab4cc, blade, 0, .07, .004, 0);   // fuller
    BM.tip = new T.Object3D(); BM.tip.position.set(0, .166, 0); blade.add(BM.tip); BM.mid = new T.Object3D(); BM.mid.position.set(0, .09, .004); blade.add(BM.mid);
    coll(BM.bite, [0, -.005, 0], [0, -HL + .005, 0], .0035, 'bite'); }
  // ---- slash trail (camera-space ribbon between tip and mid-blade) ----
  const NT = 10, tpos = new Float32Array(NT * 2 * 3), tcol = new Float32Array(NT * 2 * 4), tg2 = new T.BufferGeometry(); tg2.setAttribute('position', new T.BufferAttribute(tpos, 3)); tg2.setAttribute('color', new T.BufferAttribute(tcol, 4));
  const tidx = []; for (let i = 0; i < NT - 1; i++) { const a = i * 2; tidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg2.setIndex(tidx);
  const trail = new T.Mesh(tg2, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide })); trail.frustumCulled = false; trail.renderOrder = 3; camera.add(trail); trail.visible = false;
  const hist = []; const wv = new T.Vector3(), wv2 = new T.Vector3(), qA = new T.Quaternion(), eA = new T.Euler();
  let type = 'default', cur = null, curName = '', t = 0, flip = false, trailOn = 0, swayX = 0, swayY = 0, lastYaw = null, lastPitch = null, walk = 0, clock = 0;
  const S = { ...REST };
  function colors(kind) { const c = (m, h) => m.material.color.set(h);
    if (kind === 'kite') { c(CM.blade, 0xff9ac8); c(CM.edge, 0xffe1f0); c(CM.fuller, 0xd66aa0); c(CM.grip, 0x8f5cff); c(CM.guard, 0x7dffb0); c(CM.rim, 0xffd166); c(CM.bow, 0x7dffb0); c(CM.pom, 0xffd166); CM.wire.forEach((w) => c(w, 0xd9c2ff)); }
    else { c(CM.blade, 0xdfe9f5); c(CM.edge, 0xffffff); c(CM.fuller, 0x9db3c9); c(CM.grip, 0x4a2c1a); c(CM.guard, 0xd9a640); c(CM.rim, 0xffc94d); c(CM.bow, 0xd9a640); c(CM.pom, 0xd9a640); CM.wire.forEach((w) => c(w, 0xffd166)); } }
  function pose(s, extra = {}) {   // apply channel values to the rig
    qA.setFromEuler(eA.set(s.rx + (extra.rx || 0), s.ry + (extra.ry || 0), 0, 'YXZ'));   // yaw + pitch: the whole arm turns about the shoulder
    rig.position.copy(HOME).sub(SHOULDER).applyQuaternion(qA).add(SHOULDER); rig.position.x += s.px + (extra.x || 0); rig.position.y += s.py + (extra.y || 0); rig.position.z += s.pz;
    rig.quaternion.setFromAxisAngle(ZC, s.rz + (extra.rz || 0)).multiply(qA).multiply(baseQ);   // screen roll: the blade tilts left/right about the wrist
    roll.rotation.z = s.roll; wrist.rotation.set(-DEV + s.wb, s.ws, 0);
    arm.position.copy(wv2.set(.02, 0, 0).applyQuaternion(roll.quaternion).applyQuaternion(rig.quaternion)).add(rig.position);   // root a bit toward the back of the hand (clear of the balisong swing plane)
    // forearm: points at the elbow, but never bends more than BENDMAX away from the hand's own forearm axis (no knife part reaches it)
    wv.copy(Z1).applyQuaternion(rig.quaternion); armDir.subVectors(ELBOW, arm.position).normalize();
    { const ang = Math.acos(Math.max(-1, Math.min(1, wv.dot(armDir)))); if (ang > BENDMAX) { qB.setFromUnitVectors(wv, armDir); qB.slerpQuaternions(qI, qB, BENDMAX / ang); armDir.copy(wv).applyQuaternion(qB); } }
    arm.quaternion.setFromUnitVectors(Z1, armDir);
    BM.blade.rotation.x = -s.b; BM.bite.rotation.x = s.h;   // blade: 0 = up (open), PI = folded down between the handles; bite: 0/2PI = closed on the safe handle
    const c = Math.max(0, Math.min(1, s.curl));
    for (const f of fingers) for (let j = 0; j < 3; j++) f.j[j].rotation.y = f.RO[j] + (f.RC[j] - f.RO[j]) * c;
    th1.quaternion.slerpQuaternions(THO[0], THC[0], c); th2.quaternion.slerpQuaternions(THO[1], THC[1], c);
  }
  const api = {
    root,
    /** your legend's sleeve + team cuff (null = default blue sleeve, yellow cuff) */
    setOutfit(o) { slM.material.color.setHex(o ? o.sleeve : sleeveC); cuM.material.color.setHex(o ? o.cuff : 0xffd166); },
    setType(kk) { kk = kk === 'butterfly' || kk === 'kite' ? kk : 'default'; if (kk === type) return; type = kk; cut.visible = kk !== 'butterfly'; bfly.visible = kk === 'butterfly'; if (kk !== 'butterfly') colors(kk); },
    play(name) { if (!ANIM[name]) return; cur = ANIM[name]; curName = name; t = 0; trailOn = name.startsWith('slash') ? .32 : name === 'stab' ? .5 : 0; hist.length = 0; },
    draw() { api.play(type === 'butterfly' ? 'drawB' : 'draw'); },
    slash() { flip = !flip; api.play(flip ? 'slashA' : 'slashB'); },
    stab() { api.play('stab'); },
    inspect() { if (!cur) api.play(type === 'butterfly' ? 'inspectB' : 'inspect'); },
    busy() { return !!cur; },
    update(dt, look = {}) {
      if (!root.visible) { trail.visible = false; return; }
      clock += dt;
      if (cur) { t += dt; sample(cur, Math.min(t, cur.end), S); if (t >= cur.end) { cur = null; curName = ''; } }
      if (!cur) { const wrap = (x) => { x %= TAU; return x > PI ? x - TAU : x < -PI ? x + TAU : x; }; S.roll = wrap(S.roll); S.h = wrap(S.h);   // full turns are home already: never unwind them
        for (const c of CH) S[c] += (REST[c] - S[c]) * Math.min(1, dt * 14); }
      // look sway (the arm lags behind mouse turns) + walk bob + idle breathing
      if (look.yaw != null) { if (lastYaw != null) { let dy = look.yaw - lastYaw; if (dy > PI) dy -= TAU; if (dy < -PI) dy += TAU; swayX += (Math.max(-.6, Math.min(.6, dy * 6)) - swayX) * Math.min(1, dt * 10); swayY += (Math.max(-.4, Math.min(.4, (look.pitch - lastPitch) * 6)) - swayY) * Math.min(1, dt * 10); } lastYaw = look.yaw; lastPitch = look.pitch; }
      swayX *= Math.pow(.02, dt); swayY *= Math.pow(.02, dt);
      const sp = Math.min(1, (look.speed || 0) / 4.6); walk += dt * (4 + 6 * sp);
      const breathe = Math.sin(clock * 1.6), bx = Math.sin(walk) * .012 * sp + swayX * .03, by = -Math.abs(Math.cos(walk)) * .012 * sp + breathe * .0035 - swayY * .02;
      if (api._hold) Object.assign(S, REST, api._hold);
      pose(S, { x: bx, y: by, rx: swayY * .4 + breathe * .01, ry: swayX * .5, rz: Math.sin(clock * 1.1) * .012 });
      // trail: tip + mid in camera space while a swing is active
      if (trailOn > 0) { trailOn -= dt; const tip = type === 'butterfly' ? BM.tip : CM.tip, mid = type === 'butterfly' ? BM.mid : CM.mid;
        tip.getWorldPosition(wv); mid.getWorldPosition(wv2); camera.worldToLocal(wv); camera.worldToLocal(wv2); hist.unshift([wv.x, wv.y, wv.z, wv2.x, wv2.y, wv2.z]); if (hist.length > NT) hist.length = NT; }
      else if (hist.length) hist.pop();
      trail.visible = hist.length > 1;
      if (trail.visible) { for (let i = 0; i < NT; i++) { const h = hist[Math.min(i, hist.length - 1)], a = i < hist.length ? (1 - i / NT) * .55 : 0;
          tpos.set(h.slice(0, 3), i * 6); tpos.set(h.slice(3, 6), i * 6 + 3); tcol.set([1, .97, .9, a, 1, .85, .95, a * .2], i * 8); }
        tg2.attributes.position.needsUpdate = true; tg2.attributes.color.needsUpdate = true; tg2.computeBoundingSphere(); }
    },
    /** test hook (test/knifeclip.mjs): capsules of the hand / arm / bite handle, blade meshes, animation names + lengths */
    _debug: { colliders, blades, parts: { default: cut, kite: cut, butterfly: bfly }, anims: Object.fromEntries(Object.entries(ANIM).map(([n, a]) => [n, a.end])), get type() { return type; },
      setBase(F, B, home) { baseQ = orient(F, B); if (home) HOME.set(...home); setElbow(); }, pose(v) { cur = null; Object.assign(S, REST, v); pose(S); }, hold: (v) => { api._hold = v; } },
    dispose() { camera.remove(root); camera.remove(trail); root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== ink && o.material !== skinM) o.material.dispose(); } }); skinM.dispose(); ink.dispose(); tg2.dispose(); trail.material.dispose(); },
  };
  setElbow(); bfly.visible = false; colors('default'); pose(S);
  return api;
}
