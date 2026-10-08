// hitprofiles.js - per-legend hit zones in LOCAL space (feet at the origin, yaw 0, idle pose), baked from characters.js
// by test/gen-hitprofiles.mjs. Client (prediction against remote players) and server (authoritative fire) build the SAME
// world-space zones from this table with hitscan.profileZones, so a predicted hit is a server hit. No imports (Node + browser).
// Regenerate when a legend model changes: node test/gen-hitprofiles.mjs > hitprofiles.js ; test/run-all.js checks it against the models.
export const HIT_PROFILES = {
  jobs: {
    stand: { head: { y: 1.61, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.3, hz: 0.19, y0: 0.77, y1: 1.41 }, { zone: 'legs', cx: -0.09, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.77 }, { zone: 'legs', cx: 0.09, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.77 }] },
    crouch: { head: { y: 1.31, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.3, hz: 0.19, y0: 0.48, y1: 1.11 }, { zone: 'legs', cx: -0.1, cz: 0, hx: 0.15, hz: 0.17, y0: 0.03, y1: 0.48 }, { zone: 'legs', cx: 0.1, cz: 0.04, hx: 0.15, hz: 0.16, y0: 0.03, y1: 0.48 }] },
  },
  zuck: {
    stand: { head: { y: 1.56, r: 0.23 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.3, hz: 0.19, y0: 0.73, y1: 1.36 }, { zone: 'legs', cx: -0.09, cz: 0, hx: 0.14, hz: 0.13, y0: 0.03, y1: 0.73 }, { zone: 'legs', cx: 0.09, cz: 0, hx: 0.14, hz: 0.13, y0: 0.03, y1: 0.73 }] },
    crouch: { head: { y: 1.26, r: 0.23 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.3, hz: 0.19, y0: 0.45, y1: 1.06 }, { zone: 'legs', cx: -0.1, cz: 0, hx: 0.15, hz: 0.17, y0: 0.03, y1: 0.45 }, { zone: 'legs', cx: 0.1, cz: 0.04, hx: 0.15, hz: 0.16, y0: 0.03, y1: 0.45 }] },
  },
  altman: {
    stand: { head: { y: 1.57, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.28, hz: 0.18, y0: 0.74, y1: 1.37 }, { zone: 'legs', cx: -0.08, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.74 }, { zone: 'legs', cx: 0.08, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.74 }] },
    crouch: { head: { y: 1.26, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.28, hz: 0.18, y0: 0.46, y1: 1.06 }, { zone: 'legs', cx: -0.1, cz: 0, hx: 0.14, hz: 0.16, y0: 0.03, y1: 0.46 }, { zone: 'legs', cx: 0.1, cz: 0.04, hx: 0.14, hz: 0.15, y0: 0.03, y1: 0.46 }] },
  },
  musk: {
    stand: { head: { y: 1.66, r: 0.23 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.36, hz: 0.22, y0: 0.77, y1: 1.45 }, { zone: 'legs', cx: -0.11, cz: 0, hx: 0.15, hz: 0.15, y0: 0.03, y1: 0.77 }, { zone: 'legs', cx: 0.11, cz: 0, hx: 0.15, hz: 0.15, y0: 0.03, y1: 0.77 }] },
    crouch: { head: { y: 1.35, r: 0.23 }, boxes: [{ zone: 'body', cx: 0, cz: -0.04, hx: 0.36, hz: 0.22, y0: 0.48, y1: 1.14 }, { zone: 'legs', cx: -0.13, cz: 0, hx: 0.16, hz: 0.18, y0: 0.03, y1: 0.48 }, { zone: 'legs', cx: 0.13, cz: 0.04, hx: 0.16, hz: 0.17, y0: 0.03, y1: 0.48 }] },
  },
  bezos: {
    stand: { head: { y: 1.57, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.4, hz: 0.24, y0: 0.71, y1: 1.37 }, { zone: 'legs', cx: -0.13, cz: 0, hx: 0.16, hz: 0.16, y0: 0.03, y1: 0.71 }, { zone: 'legs', cx: 0.13, cz: 0, hx: 0.16, hz: 0.16, y0: 0.03, y1: 0.71 }] },
    crouch: { head: { y: 1.29, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.04, hx: 0.4, hz: 0.24, y0: 0.44, y1: 1.09 }, { zone: 'legs', cx: -0.15, cz: 0, hx: 0.17, hz: 0.19, y0: 0.03, y1: 0.44 }, { zone: 'legs', cx: 0.15, cz: 0.04, hx: 0.17, hz: 0.18, y0: 0.03, y1: 0.44 }] },
  },
  jensen: {
    stand: { head: { y: 1.55, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.33, hz: 0.2, y0: 0.71, y1: 1.35 }, { zone: 'legs', cx: -0.1, cz: 0, hx: 0.14, hz: 0.14, y0: 0.03, y1: 0.71 }, { zone: 'legs', cx: 0.1, cz: 0, hx: 0.14, hz: 0.14, y0: 0.03, y1: 0.71 }] },
    crouch: { head: { y: 1.27, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.33, hz: 0.2, y0: 0.44, y1: 1.07 }, { zone: 'legs', cx: -0.11, cz: 0, hx: 0.15, hz: 0.17, y0: 0.03, y1: 0.44 }, { zone: 'legs', cx: 0.11, cz: 0.04, hx: 0.15, hz: 0.16, y0: 0.03, y1: 0.44 }] },
  },
  gates: {
    stand: { head: { y: 1.56, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.3, hz: 0.19, y0: 0.73, y1: 1.36 }, { zone: 'legs', cx: -0.09, cz: 0, hx: 0.14, hz: 0.13, y0: 0.03, y1: 0.73 }, { zone: 'legs', cx: 0.09, cz: 0, hx: 0.14, hz: 0.13, y0: 0.03, y1: 0.73 }] },
    crouch: { head: { y: 1.26, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.3, hz: 0.19, y0: 0.45, y1: 1.06 }, { zone: 'legs', cx: -0.1, cz: 0, hx: 0.15, hz: 0.17, y0: 0.03, y1: 0.45 }, { zone: 'legs', cx: 0.1, cz: 0.04, hx: 0.15, hz: 0.16, y0: 0.03, y1: 0.45 }] },
  },
  hawking: {
    stand: { head: { y: 1.55, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.3, hz: 0.19, y0: 0.73, y1: 1.35 }, { zone: 'legs', cx: -0.1, cz: -0.2, hx: 0.14, hz: 0.33, y0: 0.18, y1: 0.73 }, { zone: 'legs', cx: 0.1, cz: -0.2, hx: 0.14, hz: 0.33, y0: 0.18, y1: 0.73 }] },
    crouch: { head: { y: 1.26, r: 0.22 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.3, hz: 0.19, y0: 0.45, y1: 1.06 }, { zone: 'legs', cx: -0.1, cz: -0.18, hx: 0.14, hz: 0.33, y0: 0, y1: 0.45 }, { zone: 'legs', cx: 0.1, cz: -0.18, hx: 0.14, hz: 0.33, y0: 0, y1: 0.45 }] },
  },
  lisa: {
    stand: { head: { y: 1.53, r: 0.21 }, boxes: [{ zone: 'body', cx: 0, cz: 0, hx: 0.28, hz: 0.18, y0: 0.73, y1: 1.34 }, { zone: 'legs', cx: -0.08, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.73 }, { zone: 'legs', cx: 0.08, cz: 0, hx: 0.13, hz: 0.13, y0: 0.03, y1: 0.73 }] },
    crouch: { head: { y: 1.24, r: 0.21 }, boxes: [{ zone: 'body', cx: 0, cz: -0.03, hx: 0.28, hz: 0.18, y0: 0.45, y1: 1.04 }, { zone: 'legs', cx: -0.09, cz: 0, hx: 0.14, hz: 0.16, y0: 0.03, y1: 0.45 }, { zone: 'legs', cx: 0.09, cz: 0.04, hx: 0.14, hz: 0.15, y0: 0.03, y1: 0.45 }] },
  },
};
/** fallback for unknown ids (bots before their legend is known, old clients): the average legend */
export const DEFAULT_PROFILE = HIT_PROFILES.gates;
export const hitProfile = (id) => HIT_PROFILES[id] || DEFAULT_PROFILE;
