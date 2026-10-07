// account.js - anonymous account (random id + secret token, no email, no personal data). Token lives in a first-party cookie and localStorage.
import { getStats } from './stats.js';
const TH = (/[?&]mphost=([\w.:-]+)/.exec(location.search) || [])[1], HOST = TH ? 'http://' + TH : 'https://sniper-chill-mp.onrender.com', LS = 'sc_acct', CK = 'cc_acct';
const getCk = () => { const m = document.cookie.match(/(?:^|; )cc_acct=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
const setCk = (v) => { try { document.cookie = `${CK}=${encodeURIComponent(v)}; max-age=${60 * 60 * 24 * 365 * 2}; path=/; SameSite=Lax; Secure`; } catch (e) {} };
let cred = ''; try { cred = getCk() || localStorage.getItem(LS) || ''; } catch (e) {}
if (cred) { try { localStorage.setItem(LS, cred); } catch (e) {} setCk(cred); }
let profile = null, creating = null, lastSync = 0;
const off = () => /[?&]nostats/.test(location.search);
async function api(path, method = 'GET', body) {
  const c = new AbortController(), to = setTimeout(() => c.abort(), 70000);
  try { const r = await fetch(HOST + path, { method, signal: c.signal, cache: 'no-store', headers: { ...(cred ? { authorization: 'Bearer ' + cred } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => null); return { ok: r.ok, status: r.status, j }; }
  catch (e) { return { ok: false, status: 0, j: null }; } finally { clearTimeout(to); }
}
export const hasAccount = () => !!cred;
export const token = () => cred;
export const idOf = () => cred.split('.')[0] || '';
export async function ensure() {
  if (off()) return null; if (profile) return profile;
  if (cred) { const r = await api('/acct/me'); if (r.ok) { profile = r.j; return profile; } if (r.status !== 401) return null; cred = ''; }
  if (creating) return creating;
  creating = (async () => { const r = await api('/acct/new', 'POST', {}); creating = null; if (!r.ok || !r.j) return null; cred = r.j.token; profile = r.j.profile; try { localStorage.setItem(LS, cred); } catch (e) {} setCk(cred); return profile; })();
  return creating;
}
export async function sync(force) {
  if (off() || (!force && Date.now() - lastSync < 4000)) return profile; lastSync = Date.now();
  if (!await ensure()) return null; const r = await api('/acct/sp', 'POST', { sp: getStats() }); if (r.ok) profile = r.j; return profile;
}
export async function update(f) { if (!await ensure()) return null; const r = await api('/acct/update', 'POST', f); if (r.ok) profile = r.j; return r.ok ? profile : null; }
export const getProfile = () => profile;
export const recoveryCode = () => cred;
export async function restore(code) { const old = cred; cred = String(code || '').trim(); const r = await api('/acct/me'); if (r.ok) { profile = r.j; try { localStorage.setItem(LS, cred); } catch (e) {} setCk(cred); return profile; } cred = old; return null; }
export const publicProfile = async (id) => (await api('/u/' + encodeURIComponent(id))).j;
export const companies = async () => (await api('/leaderboard/companies')).j || [];
export const players = async () => (await api('/leaderboard/players')).j || [];
export const board = async (range) => (await api('/leaderboard/players?range=' + (range || 'all'))).j || [];
export const feed = async () => (await api('/feed')).j || [];
export const online = async () => (await api('/online')).j || [];
// company logo (spray / MVP card / profile): served by the game server, which fetches it from the company website
export const logoUrl = (site) => site ? HOST + '/logo?d=' + encodeURIComponent(site) : '';
/** prestige: back to level 1 for the next emblem (server checks the level) */
export async function prestige() { if (!await ensure()) return null; const r = await api('/acct/prestige', 'POST', {}); if (r.j && r.j.profile) profile = r.j.profile; return r.j || null; }
