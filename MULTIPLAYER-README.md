# Sniper Chill - multiplayer (prototype)

Authoritative Node server + client adapter. Rooms by link, up to 12 players, 30 Hz tick, 15 Hz snapshots,
client prediction + reconciliation, interpolation, server-side hitscan with lag compensation, bomb mode,
reconnect, basic anti-cheat. It reuses the game's own `movement.js`, `hitscan.js`, `map.js`, `player.js`
unchanged, so server and browser simulate the same thing.

## Layout (copy into the repo root next to movement.js / game.js)
```
common.js              constants + tiny helpers shared by server and client (no imports)
client/net.js          NetClient: connect, predict, reconcile, interpolate, reconnect (no Three, no DOM)
server/src/shared.js   loads the game modules in Node, builds the same colliders as game.js, fake canvas for map.js
server/src/room.js     one match: movement, weapons, lag-comp hitscan, bomb mode, snapshots (pure logic, no sockets/timers)
server/src/server.js   ws + HTTP: rooms, rate limits, origin check, fixed-step loop, /healthz, /stats
test/                  harness.js (virtual-time network sim), run-all.js (14 tests), ws-test.js (real sockets)
render.yaml            free-tier Render blueprint (not deployed)
fetch-shared.sh        standalone testing only: downloads the 4 game modules from the live site into ./game
```
Run: `npm i && sh fetch-shared.sh && npm test` (standalone) or `npm i && npm start` in the repo (port 8080).
Node >= 18. Dependencies: `ws`, `three` (three is only used to build the map's collider list in Node).

## How a match works
- Client connects `wss://HOST/ws?room=new&name=Juan` -> server answers `welcome {room:'K7M2Q', token, team}`.
  Put `?room=K7M2Q` in the page URL: that is the invite link. Friends open it, `room=CODE` joins.
- Client never sends positions. Every 1/30 s it sends one input `{seq,f,r,j,c,yaw,pitch,fire,aim,rl,use,w,vt}`.
  Server runs the real `createController` with fixed dt, one input per tick, with a time budget (so sending
  extra inputs does not make you faster), and answers 15x/s with a snapshot + `ack` of the last input it used.
- Client predicts with the same controller and the same inputs; on each snapshot it compares its predicted
  position at `ack` with the server's, and only if they differ by >1 cm it snaps and replays unacked inputs.
- Other players are drawn 2 snapshots (~133 ms) in the past, interpolated.
- Shooting: client sends `fire` plus `vt` (the server tick it is currently *seeing* other players at).
  Each bullet the local weapon system fires is also reported in the next input as `sh: [[spreadYaw, spreadPitch, vt]]`.
  Server rewinds enemy positions to that shot's `vt` (clamped to the last 15 ticks = 500 ms), re-uses the client's spread
  offset, aim and eye at the click (bots/old clients get a server roll from the input's aim), raycasts with the shared
  `hitscan.raycast` against the shared map colliders and the legend's hit boxes from `hitprofiles.js` (the same boxes the
  client predicts against: `hitscan.profileZones`), applies `applyDamage` from `player.js`. Damage, ammo, reload, fire rate
  are all server side. Teammates and spawn-protected players are not hit (the snapshot flag 128 = protected, so the client
  does not predict those hits either).
- Bomb mode (T plant, CT defuse), same numbers as single player: plant 3.2 s hold E on A/B, fuse 40 s,
  defuse 5 s, blast 14 m. 4 s freeze, 120 s round, first to 5 rounds (`R` in `common.js`). Round end on
  elimination / time (CT win) / explosion (T win) / defuse (CT win). Late joiners spectate until next round.
- Reconnect: token kept by the client; if the socket drops, `NetClient` retries automatically (250 ms ... 3 s)
  for 28 s and the server keeps the player for 30 s. The round is not aborted while someone is in grace.

## Wiring into game.js (what the integrator has to do)
```js
import { createController } from './movement.js'; import { NetClient } from './client/net.js';
const room = new URLSearchParams(location.search).get('room') || 'new';
const net = new NetClient({ createController, colliders: this.phys,            // same list game.js builds
  url: `wss://YOUR-SERVER/ws?room=${room}&name=${encodeURIComponent(name)}` });
net.on('welcome', w => history.replaceState(0, '', '?room=' + w.room));      // shareable link
net.on('shot', m => tracer(m.o, m.e));  net.on('hit', m => hud.hitMarker(m.kill, m.head));
net.on('kill', ...); net.on('round_start'|'round_end'|'planted'|'explode'|'defused'|'go'|'chat'|'roster'|'join'|'leave'|'reconnecting'|'error', ...);
net.connect();
// per frame, in multiplayer mode (instead of ctrl.update / ctrl.connect(el) / bots):
net.look(dx, dy);                                    // from mouse / touch
net.setInput({ f, r, j, c: crouchHeld, aim, rl, use: eHeld, w: weaponIndex, fire: autoWeaponTriggerHeld });
// semi-auto weapon click:  net.tap()
net.update(dt);                                      // fixed 30 Hz inside; predicts + sends
const e = net.eye();  camera.position.set(e.x, e.y, e.z); camera.rotation.set(e.pitch, e.yaw, 0, 'YXZ');
for (const p of net.remotes()) { /* move meshes: p.x p.y p.z p.yaw p.crouched p.alive p.team p.name p.weapon */ }
// HUD from net.me {mag,res,rl,hp,weapon,pp(plant 0..1),dp(defuse 0..1)}, net.phase, net.phaseLeft, net.score, net.bomb, net.rttMs
```
Notes: do not call `ctrl.connect(element)` in multiplayer (the adapter drives `net.ctrl`); there is no sprint on the
server (Juan: no running, Shift = crouch). The crouch key is `c`. The local weapon system (`createWeaponSystem`) should
only drive viewmodel animation/sounds; ammo and damage come from the server (`net.me`, `hit` events).
Economy/armor: hooks are `p.hp` in `room.fire()` damage and `startRound()` loadout; add money/armor there.

## Server rules that exist as anti-cheat
Server-authoritative position (no client position is ever read) - fixed dt, one input per tick, 3-tick time bank
(speedhack by flooding inputs does nothing, tested) - no sprint - weapon cooldown, ammo, reload, spread on server
- lag-comp window clamp 500 ms (cannot shoot "where he was 3 s ago", tested) - client spread offsets clamped to the server cone (tested) - NaN/garbage/huge values sanitised, never throw
(tested) - 1 KB max frame, 90 msg/s per socket, strike counter then disconnect, 6 sockets per IP, Origin allow-list
(`ALLOWED_ORIGINS`), name sanitised, room cap 12, max 20 rooms, falling into the void kills.
Not covered (honest list): aimbot/wallhack (snapshots contain all players; fixing it needs visibility culling), a modified client
reporting zero spread on its bullets (same class as an aimbot: since v1007h the server fires the bullet the client fired instead of re-rolling),
semi-auto "auto-clicker" up to the weapon's own rpm, collusion. Fine for friends; not for ranked public play.

## Test results (npm test)
See test-output.txt. Highlights: lag compensation hit rate 85% on vs 7% off for a strafing target at 100 ms one-way;
prediction error 0.0008 m on a clean network, 13 corrections / max 0.21 m over 10 s at 80 ms latency +-20 ms jitter + 2% loss;
12 players: server tick 0.2 ms avg (budget 33 ms), ~9 KB/s down per player (~370 MB/h for a full room), ~3.3 KB/s up.
Not tested here: a real browser against this server, real internet latency, the visual side (meshes for remote players,
HUD wiring). That is the integration step.

## Hosting at $0 (nothing is deployed or signed up; see report for sources)
Recommended: Render free web service (runs this code unchanged, `render.yaml` included). Cold start ~1 min after
15 min idle; 750 free hours/month; without a payment method Render suspends instead of charging.
Alternative: Cloudflare Durable Objects free plan (always-on, hard daily caps, no overage), but the server must be
ported to a Worker (Room is pure logic so it ports, not done). Fly.io requires a credit card on file: excluded.
