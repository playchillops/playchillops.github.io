// parkour.js - additive parkour layer for the maps. map.js is not touched.
// Pure data + two helpers, so the browser (game.js) and the server (shared.js) build the exact same collision boxes.
// Jump rules used to size this: jump height ~1.15 m, air time ~0.65 s, so each step up is 0.8 m and each gap is 1.5 m.
export const PARKOUR = {
  // Kite Garden: a staircase of floating blocks in the empty south-west yard (x -34..-20, z 33..40), well away from the spawns and lanes.
  a: [
    { min: [-33.0, 0, 34.0], max: [-31.0, 0.8, 36.0], color: 0xffb3c7 },
    { min: [-29.5, 0, 34.0], max: [-27.5, 1.6, 36.0], color: 0xffd98a },
    { min: [-26.0, 0, 34.0], max: [-24.0, 2.4, 36.0], color: 0xa9e6c4 },
    { min: [-22.5, 0, 33.0], max: [-19.5, 3.2, 38.0], color: 0x9fd3ff },   // the high ledge at the end
    { min: [-19.8, 3.2, 33.0], max: [-19.5, 3.9, 38.0], color: 0x9fd3ff }, // low parapet on the far edge
  ],
  b: [],
};
export function parkourColliders(id) {
  return (PARKOUR[id] || []).map((b) => ({ min: { x: b.min[0], y: b.min[1], z: b.min[2] }, max: { x: b.max[0], y: b.max[1], z: b.max[2] }, parkour: true }));
}
export function parkourMeshes(THREE, id) {
  const g = new THREE.Group(); g.name = 'parkour';
  for (const b of PARKOUR[id] || []) {
    const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: b.color, flatShading: true }));
    m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x2b3350 })); e.position.copy(m.position); g.add(e);
  }
  return g;
}
