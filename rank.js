// rank.js - XP, level and rank names. Pure functions shared by the server (rewards) and the client (profile, HUD).
export const XP_BASE = 60, XP_KILL = 25, XP_WIN = 150;
export const matchXp = ({ kills = 0, win = false } = {}) => XP_BASE + XP_KILL * Math.max(0, kills | 0) + (win ? XP_WIN : 0);
const need = (lv) => 35 * (lv - 1) * (lv - 1);                 // total xp needed to reach level lv (lv 1 = 0)
export const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 35)) + 1;
export const RANKS = [[1, 'Rookie'], [5, 'Chiller'], [10, 'Sharp'], [15, 'Ace'], [25, 'Legend']];
export const rankOf = (lv) => { let r = RANKS[0][1]; for (const [l, n] of RANKS) if (lv >= l) r = n; return r; };
export const progress = (xp) => { const lv = levelOf(xp), a = need(lv), b = need(lv + 1); return { level: lv, rank: rankOf(lv), xp, into: xp - a, span: b - a, pct: Math.min(1, (xp - a) / (b - a)) }; };
// Prestige (Juan 2026-10-06): from PRESTIGE_LEVEL you can reset to level 1 for the next exclusive emblem (up to MAX_PRESTIGE).
export const PRESTIGE_LEVEL = 15, MAX_PRESTIGE = 10;
export const canPrestige = (xp, pr = 0) => levelOf(xp) >= PRESTIGE_LEVEL && (pr | 0) < MAX_PRESTIGE;
