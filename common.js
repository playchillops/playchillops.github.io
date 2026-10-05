// common.js - constants + tiny pure helpers shared by server and client (no imports, runs in Node and browser).
export const TICK = 30;                 // server simulation rate (Hz); client input rate is the same
export const DT = 1 / TICK;
export const SNAP_DIV = 1;              // snapshot every tick -> 30 Hz (~8 kB/s per client)
export const MAX_PLAYERS = 12;
export const REWIND_TICKS = 10;         // lag compensation window (~333 ms)
export const HIST_TICKS = 32;
export const SENS = 0.0022;             // must equal movement.js default sensitivity
export const WEAPON_IDS = ['pistol', 'machinegun', 'sniper'];
export const PROTOCOL = 1;

export const R = { // rules (all server side, tweak freely)
  FREEZE: 4, ROUND: 120, END: 5, PLANT: 3.2, FUSE: 40, DEFUSE: 5, BLAST: 14, DEFUSE_RADIUS: 2.5,
  WIN_ROUNDS: 3, SWAP_AFTER: 3, MATCH_END: 8, RECONNECT_GRACE: 30, VOID_Y: -8,
};

export const q = (n, d = 2) => { const m = 10 ** d; return Math.round(n * m) / m; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpAngle = (a, b, t) => a + wrapPi(b - a) * t;

/** Point a movement.js controller at an absolute yaw/pitch using its look() (controller has no setter).
 *  Server and client both use this so prediction matches. */
export function aimTo(ctrl, yaw, pitch) {
  const s = ctrl.state;
  const ty = wrapPi(Number.isFinite(yaw) ? yaw : 0), tp = clamp(Number.isFinite(pitch) ? pitch : 0, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  ctrl.look(wrapPi(s.yaw - ty) / SENS, (s.pitch - tp) / SENS);
}

/** Direction from yaw/pitch, same convention as movement.getDirection(). */
export function dirFrom(yaw, pitch) { const cp = Math.cos(pitch); return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }; }
