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
// Silicon Valley legends (Juan 2026-10-06): every player gets one at random when they join (server-picked, so everybody
// sees the same person); bots are named after theirs. Models in characters.js, same toon style as the original cast.
export const LEGENDS = [
  { id: 'jobs', name: 'Steve Jobs', co: 'Apple', site: 'apple.com' },   // site: logo for bots (calling card, MVP screen)
  { id: 'zuck', name: 'Mark Zuckerberg', co: 'Meta', site: 'meta.com' },
  { id: 'altman', name: 'Sam Altman', co: 'OpenAI', site: 'openai.com' },
  { id: 'musk', name: 'Elon Musk', co: 'Tesla · SpaceX', site: 'spacex.com' },
  { id: 'bezos', name: 'Jeff Bezos', co: 'Amazon', site: 'amazon.com' },
  { id: 'jensen', name: 'Jensen Huang', co: 'NVIDIA', site: 'nvidia.com' },
  { id: 'gates', name: 'Bill Gates', co: 'Microsoft', site: 'microsoft.com' },
  { id: 'lisa', name: 'Lisa Su', co: 'AMD', site: 'amd.com' },
];
export const LEGEND_IDS = LEGENDS.map((l) => l.id);
// Superpowers (Juan 2026-10-06: "cada persona tiene un superpoder que se rellena con el tiempo y cuando matas"): one per legend.
// Charge 0..100: POWER_CHARGE.perSec every second alive in a live round, +perKill per kill, +perDmg per damage point. Y fires it at 100.
export const POWERS = {
  jobs: { k: 'xray', name: 'One More Thing', desc: 'See every enemy through walls', dur: 8 },
  zuck: { k: 'cloak', name: 'Metaverse', desc: 'Turn almost invisible (shooting flickers you back)', dur: 7 },
  altman: { k: 'agi', name: 'AGI Mode', desc: 'Perfect aim: zero spread', dur: 7 },
  musk: { k: 'rocket', name: 'Starship', desc: 'Rocket jump high and far where you look', dur: 0 },
  bezos: { k: 'prime', name: 'Prime Delivery', desc: '+20 HP. Nothing else.', dur: 0 },
  jensen: { k: 'overclock', name: 'Overclock', desc: 'Double fire rate and instant reloads', dur: 7 },
  gates: { k: 'bsod', name: 'Blue Screen', desc: 'Enemies within 14 m freeze for 2.5 s', dur: 0 },
  lisa: { k: 'turbo', name: 'Ryzen Turbo', desc: 'Run 60% faster', dur: 7 },
};
export const POWER_CHARGE = { perSec: 1.25, perKill: 25, perDmg: 0.12 };
export const KNIFE_REACH = 1.5; // metres, shared by client and server
export const TURBO = 1.6, STUN_TASER = 5, STUN_BSOD = 2.5, TASER_RANGE = 6.5;
/** Starship launch: same numbers on the client (prediction) and the server */
export function rocketVel(yaw, pitch) { const up = Math.max(0, Math.min(.9, pitch)); return { x: -Math.sin(yaw) * (14 - up * 6), y: 14 + up * 6, z: -Math.cos(yaw) * (14 - up * 6) }; }   // flat: ~18 m far, 4.5 m high; looking up: 8.5 m high
export const legendOf = (id) => LEGENDS.find((l) => l.id === id) || null;
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
