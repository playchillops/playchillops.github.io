// common.js - constants + tiny pure helpers shared by server and client (no imports, runs in Node and browser).
export const TICK = 30;                 // server simulation rate (Hz); client input rate is the same
export const DT = 1 / TICK;
export const SNAP_DIV = 1;              // snapshot every tick -> 30 Hz (~8 kB/s per client)
export const MAX_PLAYERS = 12;
export const REWIND_TICKS = 10;         // lag compensation window (~333 ms)
export const HIST_TICKS = 32;
export const SENS = 0.0022;             // must equal movement.js default sensitivity
export const WEAPON_IDS = ['pistol', 'machinegun', 'sniper', 'thunderpop', 'fizztwin', 'buzzbox', 'bigpuff', 'partypopper', 'breeze', 'taptap', 'skyneedle']; // append only (network index)
export const PROTOCOL = 1;

export const R = { // rules (all server side, tweak freely)
  FREEZE: 4, ROUND: 120, END: 5, PLANT: 3.2, FUSE: 40, DEFUSE: 5, BLAST: 14, DEFUSE_RADIUS: 2.5,
  WIN_ROUNDS: 3, SWAP_AFTER: 3, MATCH_END: 24, RECONNECT_GRACE: 30, VOID_Y: -8,
};

// Continuous modes (Juan 2026-10-06: "más modo csgo rápido, parecido al black ops 2"): respawn after RESPAWN s, no rounds,
// no bomb, no economy. tdm = 2 teams race to `limit` kills; ffa = everyone for themselves; gun = Gun Game (a kill = next gun, knife to win).
export const DM = {
  tdm: { name: 'Team Deathmatch', short: 'TDM', limit: 30, time: 360, teams: 2 },
  ffa: { name: 'Free-for-all', short: 'FFA', limit: 15, time: 360, teams: 0 },
  gun: { name: 'Gun Game', short: 'GUN GAME', limit: 0, time: 480, teams: 0 },
};
export const RESPAWN = 2, DM_FREEZE = 3, DM_PROTECT = 1.5, DM_END = 26;   // match end: final killcam (~9 s) + MVP screen
// Gun Game ladder: rifles first, pistols last, the knife kill wins. Index = level.
export const GUN_ORDER = ['machinegun', 'breeze', 'taptap', 'partypopper', 'buzzbox', 'bigpuff', 'skyneedle', 'sniper', 'thunderpop', 'fizztwin', 'pistol', 'knife'];
export const isDM = (mode) => !!DM[mode];
export const isFree = (mode) => mode === 'ffa' || mode === 'gun';   // every player is an enemy

/** "https://www.Harbor.ai/about" -> "harbor.ai"; '' when it is not a plausible public domain (used for the spray logo) */
export function siteDomain(v) {
  let d = String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:\s]/)[0];
  if (!/^(?=.{4,60}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return '';
  if (/^(localhost|.*\.local|.*\.internal)$/.test(d)) return '';
  return d;
}

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
