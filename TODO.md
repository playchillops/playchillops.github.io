# ChillOps - master TODO and project memory
Last updated: 2026-10-04 ~6:55 PM PDT. Maintained by the lead integrator agent (task "sniper game real hosting"). Update on every deploy.
Status words: DONE (deployed), LOCAL (built and tested, not deployed yet), IN PROGRESS, QUEUED, DROPPED, UNVERIFIED (not re-checked by me).
Owners: LEAD = lead integrator (this agent). MAP = Kite map agent (agent-01M44S21TSMHKKRRQ94K4KZGWK). RENDER = Render deploy agent (agent-01M44V196NH7HKRJSNYP1TRG5V). MAIN = main agent, talks to Juan.

## 0. Hard rules and facts
- Juan Vecino (spoken language Spanish, all IN-GAME text must be English - 2026-10-04 6:13 PM).
- NEVER touch juanvecino/triathlon-hub (Juan was angry about a change there at 4:15 PM). Juan's own GitHub account is off limits except a pending collaborator invite for "juanvecino".
- Everything lives in GitHub, nothing left loose on any system (4:50 PM: "I do not want shit left on your system"). Free only, no paid services, no hacking/cheats, no personal data from Juan (5:01 PM: use the agent's own email/accounts, never his data).
- Repos: private source of truth `instinct-juan-train/sniper-chill-src` (this file lives here). Public `instinct-juan-train/sniper-chill` only serves GitHub Pages: https://instinct-juan-train.github.io/sniper-chill/ (Pages cache 1-10 min).
- Multiplayer server code goes ONLY to the private repo, never the public one. Deploying it (Render) is done by the RENDER agent, not LEAD.
- Deploy flow: LEAD uploads via the cloud browser to both repos (game files) with /tmp/deploy.sh; verify by curling Pages. After each deploy send MAIN a one-line "what went live" with screenshots.
- Do NOT change the characters or the world art style: Juan loves them (4:56 PM "I love the characters now, it is fun"; 5:50 PM "I like the player style, do not change it"). Complaints are about menu/HUD style only. Kept the "bottom" set of characters (5:11 PM), the earlier teletubby-like ones were dropped.
- Style: toon pastel, chill, stylized, viral. Goal: addictive, fun, "CS:GO but online and chiller": pistol, machine gun, sniper.
- Juan was away until ~8:10 PM; wants a consolidated screenshot set on return.

## 1. Core game (done unless noted)
1. Fullscreen game, trackpad/pointer lock working (3:59-4:00 PM) - DONE.
2. Weapons: pistol, machine gun, sniper; sniper one-shot kill, other weapons need several hits, headshot kills (3:47 PM) - DONE.
3. Health bar for the player (3:47 PM). Enemy health bars hidden (5:08 PM) - DONE. "100%" must be centred inside the health bar (5:37 PM) - DONE.
4. Bomb plant (E) and bomb explosion spectacle: fireball, rings, debris, shake, destruction, kills everyone within 14 m including the player who planted it, dropping weapons (3:47 PM, 5:46 PM) - DONE 2026-10-04 ~6:04 PM.
5. Sniper ADS: toggle scope, so you can aim and fire (4:41 PM). Right click toggles scope, Q too. Juan 6:40 PM: "solved" - DONE.
6. Crouch on Shift, NO sprint/run (4:48-4:49 PM) - DONE.
7. Bots: very hard to build (4:01 PM); calmer, less aggressive (5:09 PM) - DONE (calmer). Further bot quality on v4 map in a real round: UNVERIFIED (headless FPS too low).
8. No head missing bug on characters (5:07 PM) - DONE.
9. Blood: they bleed/drip a little (4:57 PM) - DONE earlier; blood between rounds not wanted (5:31 PM) - DONE.
10. Weapons: no auto pickup, press E; weapons lie on the floor, not floating, and show the real weapon model (5:31 PM) - DONE.
11. Bullet tracers thinner (5:07 PM) - DONE. Hits on players feel good (5:07 PM, keep).
12. Latency display bottom-right always (5:02 PM) - UNVERIFIED, check it exists (FPS counter is top-left, off by default, in Settings; Juan 5:37 PM).
13. Weapon sound, bullet sound, how sound propagates through the air (4:54 PM) - audio exists; true distance/air-propagation delay: UNVERIFIED, QUEUED to verify.
14. Kill animations when you kill (5:18 PM, "I love them"), double kill etc. (5:18 PM) - DONE, KEEP.
15. Kill cam: bullet flies out and kills (4:43 PM). Current rule (Juan 6:45 PM via MAIN): kill cam ONLY when the last enemy is killed, and ALSO a kill cam when you get killed. REMOVE headshot slow-mo/cam. Spectate teammate on death if any. Status: current build has killcam on last kill only; remove headshot slow-mo and add death kill cam - QUEUED (LEAD).
16. Destruction physics: shots, explosive RC car, grenades destroy things; stays destroyed until the end of the best-of-5, then the map resets (5:15 PM) - DONE (destruction.js), reset per match.
17. Knife on key 3 (55 dmg front, instakill from behind, silent) (5:44 PM) - DONE. Knife 3D model (default + Kite Cutter skin) rebuilt as a karambit-style toon knife, F inspect (6:15 PM) - DONE 2026-10-04 6:24 PM.
18. Grenades: V frag, H smoke, J flash; hint after buying; inventory bar bottom-right shows weapons + keys (5:44 PM) - DONE.
19. Visible buy-zone barrier at round start (5:45 PM) - DONE. 10 s buy phase, move only about 5 m inside a rectangle (5:21 PM) - DONE.
20. Shop: B opens, 1-5 pick a category, numbers buy, Esc/B back (6:04 PM) - DONE. Items: shield/armor, helmet, health, grenades, gear (Kite Cutter knife $300). Kill-streak rewards.
21. Money: show only the money (not "wallet" wording), top right, scoreboard thin pill at top; not big top bar (5:27 PM, 5:37 PM, 5:51 PM) - DONE.
22. Do not exit fullscreen option removed (5:27 PM) - DONE. "D key does not work" (4:14 PM) - UNVERIFIED, test A/S/D/W in the real build, QUEUED.
23. Floor vibration while moving (4:47 PM) - Juan 6:45 PM: REMOVE from the list (DROPPED).
24. Grass looks weird (4:41 PM) - improved in v3/v4 art, UNVERIFIED by Juan.
25. Ramps broken, cannot shoot from below, jump on ramp bug (4:56 PM, 5:11 PM) - map v4 has solid wedge ramps and real treads; UNVERIFIED in play.
26. Name: ChillOps (5:39 PM), animated intro (`?nointro` skips it) - DONE.
27. Main menu Black Ops III style: text list left, big lit character right, key hints, Streaks and Help panels, Settings (5:49-6:00 PM) - DONE. Do NOT put anything in the screen centre except the crosshair (6:02 PM).
28. Settings: FPS toggle (top-left, default off), sensitivity, volume, difficulty (5:37 PM) - DONE.
29. Crosshair symmetric, left gap bug fixed (5:41 PM) - DONE.
30. Everything in English (6:13 PM) - DONE 2026-10-04 6:16 PM.

## 2. Killstreaks
31. Streaks: UAV, guided missile, RC bomb car, airstrike (4:55 PM). Persist between rounds, reset on death or new match (5:42 PM, 5:47 PM) - DONE.
32. Streak slots: bottom-centre row, bigger crisp icons with kill counts (6:14 PM) - DONE 6:29 PM. The "glow" meaning was unclear to Juan; it marks earned slots - leave as is.
33. Streaks visible in the main menu: Streaks panel with logo cards (5:47-5:49 PM) - DONE.
34. Missile starts much higher (6:02 PM) - superseded by 35.
35. Airstrike and missile are called from a TABLET/iPad pulled out in first person (6:14 PM). Tablet slides up (raise/lower animation) - DONE 6:29 PM.
36. Tablet content: first "2D plan, NOT live (too OP)" (6:14 PM), then (6:31-6:36 PM) a REALISTIC view like a helicopter overhead; helicopter appears when the streak is called, missiles/bombs launch from it. Latest: LIVE helicopter CAMERA feed with camera HUD/noise. Status: heli flight and launch DONE (6:29 PM deploy, with aerial render); live perspective camera feed LOCAL (tested, not deployed). Enemies are hidden in the feed to avoid a wallhack - ask Juan if he wants them visible.

## 3. Map
37. Kite Garden v3 interim (done); Kite Garden v4 (deep redesign by MAP agent, 70x70 m) integrated - DONE 6:34 PM. Spawn T south z+32, CT north z-31, sites A (-28,-14) B (26,-13).
38. Layout requirements (5:45 PM, 5:56 PM): T and CT spawns cannot see each other; B cannot aim at A; routes, wall stairs to a tower, enterable buildings, windows, tunnels, slopes (not flat), several routes per site, a Mirage-like quality but a totally different, viral map. Notes: /downloads/KITE_GARDEN_V4_NOTES (validation: LOS and nav tested headless).
39. Polish pass (Juan 6:20 PM on mid plaza shots: layout good but visuals poor: flat giant teal blocks, plain walls): add trim, bevels, window frames, shutters, awnings, planters, props, signs, more colour/material variety, lighting/AO, decals, plants, lamps, crates/clutter that does not block, readable callout signs. Status: decor.js written (trims, pilasters, painted windows with shutters and flower boxes, planters, lamps, bunting, decals, AO strips, barrels), NOT wired in yet - IN PROGRESS (LEAD). Needs before/after screenshots (before: /tmp/b/v4mid.png).
40. Several maps later, same style (5:25 PM) - QUEUED (MAP).
41. Kites and wall banners/billboards as ad slots with swappable sponsor texture slots (6:20 PM) - QUEUED, design the surfaces ad-ready.

## 4. Modes and multiplayer
42. Best of 5 rounds (5:12 PM) - DONE in single player.
43. Multiplayer modes: 1v1 and 2v2, always best of 5 (5:12 PM). 2v2: a downed teammate can be revived within 10 s, otherwise dead; the dead player can only spectate teammate (5:12 PM; 6:45 PM). Revive rules and spectate: QUEUED (needs teams).
44. Multiplayer server LIVE (MAIN 6:54 PM): wss://sniper-chill-mp.onrender.com/ws (?room=new&name=NAME or ?room=CODE), health https://sniper-chill-mp.onrender.com/healthz, sleeps after 15 min (~50 s wake, client must retry and show a 'waking server' message), allowed origin https://instinct-juan-train.github.io. Wire client/net.js into game.js with 1v1/2v2 modes + reconnect/wake message: QUEUED (LEAD). Earlier note:  code pushed to PRIVATE repo root 2026-10-04 6:50 PM (server/src/room.js, server.js, shared.js; client/net.js; common.js; package.json; render.yaml; fetch-shared.sh; test/*; MULTIPLAYER-README.md). Deploying to Render = RENDER agent. Client integration of net.js into game.js: QUEUED (LEAD) after the server is live. Constraints: free tier, no accounts of Juan.
45. Daily minigame with ranking (3:47 PM) - Juan 5:22 PM and 6:45 PM: DROPPED. Career mode: DROPPED. modes.js (best-of-3 daily flow) intentionally not integrated.

## 4b. New HUD/bug asks (MAIN relay, 6:58-7:00 PM) - QUEUED, do in this order
52. Multiplayer client wired in (6:55 PM priority): lobby (name, 1v1/2v2, room code), "Waking up the server..." screen with auto retry, share link ?room=CODE. DEPLOYED 7:0x PM (v1: bomb mode, remote characters, basic HUD). Caveat: server does not yet enforce 1v1/2v2 caps (needs a server change by the RENDER agent). Still to do: spectate teammate, kill cams, chat, sounds in MP.
53. [DONE 7:10 PM: stronger text shadows + bottom gradient, darker bars; verify indoors] BUG (Juan 6:58 PM): inside houses the HUD/UI (weapon bar etc.) looks washed out/faded, like over grass earlier. Fix UI contrast (opaque text shadows / backing), no transparency tied to the scene.
54. [PARTIAL 7:10 PM: interior floor slab lowered from 4.5 cm to 1 cm; needs indoor bot screenshot to confirm] BUG (Juan 6:58 PM): a bot standing inside a house has its feet sunk into the floor. Fix floor height / foot placement indoors.
55. [DONE 7:10 PM] Killstreak slots on the RIGHT side of the screen and SMALLER (Juan 6:59 PM; supersedes bottom-center).
56. [DONE 7:10 PM] "STREAK n" label overlaps the money: remove the label; show streak progress as slots filling/lighting up on the right (Juan 7:00 PM).
57. [DONE 7:10 PM] Money: just the number, no rounded box, iconic CoD/Black Ops style font (Juan 7:00 PM).
58. [DONE 7:10 PM] New 10-kill reward: NUKE (tactical nuke): kills everyone and wins the round for you. Add slot + effect (Juan 7:00 PM).
59. [DONE v1 7:13 PM] Multiplayer: "Find match" quick matchmaking button (auto-join or create a room for the chosen mode) (Juan via MAIN 7:06 PM). Needs server support.
60. [DONE v1 7:13 PM, list inside lobby; BO3 restyle pending] Multiplayer: screen listing all current open/live games (public rooms) to browse and join (Juan via MAIN 7:06 PM). Needs server room list endpoint + public flag.
61. [DONE v1 7:34 PM: restyled in the main menu look (orange highlight, left-aligned list, Teko headings); not yet a literal sub-panel of the menu] Multiplayer screens restyled in the Black Ops 3 menu style and placed inside the main menu (Juan via MAIN 7:07 PM).
62. [DONE 7:32 PM v1] Intro/opening animation redone Black Ops 3 style: high hype, "wow" cinematic (Juan via MAIN 7:07 PM; current intro is bad).
63. [DONE 7:12 PM, pushed to private repo; Render redeploy to verify] Server: mode param (1v1 = 2 players, 2v2 = 4) enforced in room creation, push to private repo (MAIN 7:05 PM).
64. [DONE 7:16 PM, hand-bomb animation + no shooting while planting; verify in browser] Cannot shoot while planting or defusing, both need an animation (Juan via MAIN 7:13 PM). Defuse animation for MP still to do (server handles defuse).
65. [DONE 7:16 PM] "LET'S GO" button in the buy menu also triggers with Enter (Juan via MAIN 7:13 PM). Also fixed leftover Spanish strings (Planting, bomb defused, Space).
66. Streak column: Juan says fine on his Mac; overlap with weapon list only in headless; slots made smaller and sized by viewport height anyway (7:11 PM).
67. [WIRED 7:22 PM, not listened to in a real browser] AUDIO PASS (sound-expert workstream, Juan via MAIN 7:14 PM): menu hover/click/start, bomb plant, bomb defuse, bomb beeps/explosion, jump, landing, footsteps, buy, streak earned/called, nuke, kill/hit, round win/lose. QUEUED.
68. Bomb explosion radius-based (Juan via MAIN 7:15 PM): current code already kills only inside R = 14 m (bots and player, planter only if inside) with the full blast animation; round is awarded to T on detonation. Verify in play and tune radius if Juan wants.
69. [DONE 7:19 PM] Kill cam when YOU die: camera jumps to the killer's eye view, slow-mo, zoom, "ELIMINATED" caption, 2.4 s, then the round ends. Last-enemy kill cam already gated to last enemy only (cineOK); headshot slow-mo/cam off (headshots no longer trigger a cam unless last enemy). Spectate teammate: only for 2v2 MP, still TODO.
70. Audio integration notes: sound specialist's engine saved as chillaudio.js (global ChillAudio); audio.js now routes old play() names to it (ui, shots, hit/kill/hurt, footsteps, bomb plant/beeps/explosion/defuse, reload, empty) and game.js adds jump/land, plant start, streak earned/called, nuke, round win/lose, start. Menu hover/click wired. Buy sound wired 7:36 PM. Not wired yet: MP-specific sounds (remote footsteps/shots), sound propagation verification.
71. [DONE 7:25 PM, untested with 2 real players] MP: bomb plant/defuse hand-bomb animation + no firing while planting/defusing (uses server pp/dp progress); spectate living teammate when dead (camera follows teammate, "Spectating NAME" caption). 2v2 revive within 10 s: needs server support, still TODO.
72. Indoor check 7:23 PM: HUD readable inside the bakery (dark backing); bot feet y = floor y numerically (0) and interior slab only 1 cm high now. Still no screenshot of a bot's feet indoors (buy barrier in the way); recheck after a live round.
73. [DONE 7:45 PM] BUG (Juan voice note via MAIN 7:42 PM): bomb device stayed in the hand after planting. Fixed (plantT reset on plant, animation only while not planted).
74. [DONE 7:45 PM] Tutorial (Juan voice note): 5-step onboarding (move/aim, buy phase, bomb, streaks, grenades/knife), shown automatically the first time you press Play, also in the menu as "How to play". Enter/click = next, Esc = skip. Stored in localStorage sc_tut.
75. [DONE 7:45 PM, needs Juan's eyes] Indoor decor flicker (Juan voice note): the solid baseboard box that overlapped every house interior is now four outside-only strips, and decor on interior partitions is skipped. If shimmer remains, try ?nodecor to compare and tell me where.
76. QUEUED, big: BOTS MUCH MORE HUMAN (Juan voice note via MAIN 7:43 PM): too fixed (go to fixed spots). Needs randomness, practically endless varied routes, hold/check angles where enemies usually come from, smarter positioning, varied timing. Plan: route generator from the nav grid (random waypoint chains weighted by lane risk), per-bot personality (aggressive/passive/lurker/anchor), angle-holding at chokepoints with peek timing jitter, reaction time and aim error variance, flank and rotate on sound, avoid repeating the same path twice in a row. Candidate for a specialist agent.
77. [DONE 7:49 PM] Default difficulty HARD (Juan via MAIN 7:47 PM; old saved difficulty reset once) and more levels: Chill, Easy, Medium, Hard, Veteran, Insane (new tuning rows in botsai.js). Menu item "Difficulty" cycles levels with Enter; Settings dropdown has them too. Bot hearing of shots stays in the bot AI module (item 76).

78. [DONE 7:52 PM] "N playing now" badge in main menu (fetches server /stats; also wakes the sleeping server early; CORS header added to /stats in private repo server.js, Render redeploy needed). Hidden if server unreachable.

## 5. Ideas backlog (Juan 6:19 PM, from his notes for another game; execute after the current queue)
46. Multiplayer (see 44).
47. Ads as free monetization (kites/banners as sponsor slots, see 41).
48. Play by company + company leaderboard.
49. Viral/shareable angle: results that show up on Twitter/X, shareable result card.
50. Per-player stats and a clickable profile page.
51. Not "just a game": combine with another hook.
Constraint for all: free, no personal data, GitHub-only hosting. Rough order: stats/profile and share card (static, GitHub Pages friendly) first; company leaderboard and multiplayer need a backend (Render).

## 6. Open items and checks
- UNVERIFIED in a real browser/GPU: FPS on v4 map, bot pathing in a live round, pointer-lock Esc also opening pause menu while the tablet is open.
- Not integrated on purpose: ui-1609af9a.js (Shadow DOM UI), audio2 module (AUDIO-V2 notes) - revisit if audio propagation needs it.
- GitHub collaborator invite to "juanvecino" still pending acceptance.
- Commits API rate limit: verify deploys by curling Pages.

## 7. Change log pointer
See CHANGELOG.md in this repo for per-deploy notes.

## 79. Human bot AI integrated (7:58 PM)
botsbrain.js (personas anchor/aggressive/rotator/lurker, routes, hold/peek, hearing, variance) + new botsai.js; 8 levels rookie..insane, default HARD; enemyHint heat map; noise(kind). Headless smoke test on Kite Garden nav grid: bots leave spawn, no errors.
## 80. Juan 7:59 PM: walls flicker/change color when walking past (indoor+outdoor). Fix decor z-fighting; compare ?nodecor.
## 81. Wall flicker fix (8:11 PM): decor materials get polygonOffset (pull toward camera, no coplanar z-fight), window/pane layers keep >=2.5 cm standoff, camera near 0.05->0.1 and far 400->300 (about 2x depth precision). Needs Juan's eyes; if still flickering, next step is disabling decor wall layers (pilasters/windows) or ?nodecor comparison.
## 82. 2v2 revive (9:10 PM): server tryRevive (hold E within 2.2 m of a fallen teammate, 2.5 s, within 10 s of the fall, 50 hp, only 2v2). Kill msg now carries body x,y,z and rv window. Client: body lies down 10 s, "Hold E to revive NAME" hint, "You were revived". Test added (run-all.js), passes. Server file room.js pushed to private repo only.
## 83. Wall shimmer root cause found (9:17 PM): sun shadow-map acne (fine hatching on interior and sun-grazing walls, shifts as the view moves). Fix: shadow bias -0.0008 -> -0.004, normalBias 0.09 -> 0.32 in graphics.js. Before/after screenshots (/tmp/b/ms_a_3.png vs ms_c_3.png): hatching gone, outdoors unchanged.
## 84. MP sounds (9:22 PM): mp.js now plays gunshots (own = plain, other players = positional via ChillAudio with distance rolloff and air delay), hit/hurt/headshot/kill, remote footsteps (running only), bomb plant/defuse/explode + beeps that speed up, round start/win/lose; listener follows camera. Not heard in a real browser yet (headless).
## 85. Verified (9:25 PM): W/A/S/D all move correctly in the real build (D = +x, tested by key events, 4 keys). MP ping shows bottom-right (single player has no network, so no latency readout there). MP bomb plant/defuse/explode/elimination/match end covered by passing server tests. Bot feet indoors verified by screenshot (/tmp/b/bots_indoor_feet.png): feet on the floor.
## 86. Ad slots live (9:27 PM): ads.js adds 3 framed wall billboards (billboard-plaza-1, billboard-plaza-2, billboard-court-1), neutral "YOUR BRAND HERE" placeholders, swappable via ads.json (slots -> image) or window.ChillAds.setSlot(name,url). Visual only, no colliders. ?noads hides them. Kites as slots: not yet (kites keep their art). Free monetization: Juan only needs to drop images in the Pages repo + ads.json.
## 87. Stats, profile, share card live (9:31 PM): stats.js records every finished round on this device (kills, headshots, rounds/matches won, best round, favourite level, rank). Main menu has a Profile page with the numbers plus a 1200x630 share card (Download card, Post on X link prefilled with the game URL). Local only, no account, no personal data. Remaining: company leaderboard (needs Render backend), kite ad slots.
## 88. Ads v2 (9:34 PM, Juan: v1 billboards looked bad): wall billboards removed. Now: 5 freestanding billboards on posts in open ground beside the lanes (4.4 x 2.2 m, clear of doors/windows/walls, both faces printed), 6 tall banner flags on poles, and a hot air balloon (drifting slowly, high near the clouds, rotating company name). All filled from the YC Summer 2026 list (50 companies, name + tagline, generated text cards, no logos; billboards fixed per slot, balloon rotates company every 25 s). Per-slot override via ads.json or ChillAds.setSlot. Kites keep their original art. ?noads hides all.
## 89. Juan 9:34 PM: profile must be an ACCOUNT via cookie (not only localStorage): anonymous persistent account (random id + token in a cookie, no email/personal data), stats stored server-side; powers stats, company leaderboard, clickable profiles. Free only. Needs persistent free store (Render free disk is ephemeral). Plan sent to main; no signups without telling main first.
- [x] 90. Bot economy (Juan 9:44 PM): each of the 5 bots has its own wallet, starts at $800 like the player and begins with the pistol only. Same rewards as the player (win $3250, loss $1400 +$500 per streak up to $3400, kill $300). Bots buy a Chill-O-Matic ($1800) or Quiet Storm ($3500) when they can afford it, keep it while alive, and lose it on death. Verified headless: round 1 all pistols, round 2 rifles and snipers by budget. TODO: show bot money on the scoreboard, armor and grenade buys for bots, kill rewards per exact killer.
- [x] 91. Accounts live (9:56 PM). Server: GitHub-backed store verified (persist:true, accounts/ + index.json in sniper-chill-data). Client: account.js (anonymous id.token in a first-party cookie plus localStorage, created on first Profile open / round end / MP join), Profile shows account id, Name and Company fields with Save, public page link and recovery code; stats sync to the server after every round; MP join sends the token so server-verified results count. New Leaderboard menu page (companies and top players, MP wins). Public profile page via ?u=<id>. English fix for the fullscreen button.
- [x] 93. First-time onboarding (Juan 9:59 PM): on the first visit the menu opens a Welcome step (name + optional company, creates the anonymous account), then the tutorial with an illustration on every step (WASD + mouse, shop wheel, bomb site map, killstreak cards, grenades + knife). Everything in English. Skip is always available.
- [x] 94. (10:08 PM) Neon store live: /acct/status store:neon, persist:true. Round trip create/read verified; restart check done on the next Render redeploy.

- [ ] 92. Open items, need Juan's call or eyes: (a) kite ads - kites are part of the world art he asked us not to change, so only do this if he says yes; (b) bot armor and grenade buys - low value, bots already buy guns by budget; (c) bots at real FPS on HARD; (d) wall flicker and shimmer gone on his GPU; (e) accounts: the last 45 s before a server restart can be lost if Neon is slow, acceptable for now.
- [ ] 95. LAST: new cooler game URL on GitHub Pages (replaces the Vercel/game.juanvecino.com plan, dropped 10:10 PM). chillops and chill-ops are taken on GitHub. Free (checked via the GitHub API): playchillops, chillopsgame, chillops-game, chillopsio, getchillops. Plan: create a free GitHub org with the chosen name, repo <name>.github.io, move the Pages site, redirect the old URL. Org creation may ask for a human check, needs Juan's go.- [x] 96. Account name is used as the multiplayer name (onboarding and Profile Save both set it).
- [x] 97. Scoreboard shows average money per player for both teams (you left, bots right), updates live. Multiplayer has no economy yet so it only shows in bot mode.
- [x] 98. Competitive and social layer (Juan 10:34 PM), step 1 live: server keeps a recent-matches feed and time-ranged boards (feed.json in Neon/GitHub store), endpoints /leaderboard/players?range=day|week|all, /feed, /online. Client: always-visible TOP PLAYERS box (top 3) in the menu, MP lobby side panel (top 3, online now with names/companies, recent winners), Leaderboard page with tabs Today / This week / All time / Companies plus online and recent winners. Anonymous names and company only.
- [ ] 99. Social layer step 2: clickable names everywhere (public profile page exists), win-streak and "on fire" badges, company vs company weekly banner, share card of a match win, optional rematch button after a MP match.
- [x] 100. Solo mode is 4v1 (Juan 11:42 PM): 4 defending bots instead of 5. Defenders no longer rush the player: your gunshots are only heard within 34 m (was 55), defenders ignore half of the sounds they hear, only react to noises near their own site, and the "push the sound" personality now pushes 40% of the time (was 80%). They hold their site and rotate on a seen callout.
- [x] 101. Shots through corners (Juan 11:44 PM): bullets that graze a wall corner no longer hit the target behind it (walls are padded 7 cm sideways when a shot is checked against a player/bot), a gun barrel poking through a wall cannot hit, and bots' shots use the same rule. The multiplayer server uses the same check for hit validation (private repo).
- [x] 102. Bigger map (Juan 11:44 PM): the whole Kite Garden is 20% longer and wider (84 x 84 m instead of 70 x 70, about 44% more floor area). Same layout, same buildings, same heights and art; lanes, courtyards, doorways and the Long corridor are stretched sideways, spawns, sites, covers, signs, ads, bunting and the island moved with it. Shared by the multiplayer server. Scale is one number (MAP_SCALE in map.js) so it is easy to dial back to 1.0 or up to 1.3.
- [x] 103. Multiplayer fixes (Juan 11:56 PM): enemy name tags are hidden completely (teammates only, only when visible); "waking up" no longer loops forever, after 3 failed rounds it says "Can't reach the server" with TRY AGAIN; modules are now loaded through a content-hash import map so a player can never run a mix of old and new files (this caused the bad spawns: new server map plus cached old client map).
- [x] 104. (LIVE: 30 Hz snapshots, gap 66->34 ms, keep-warm Action every 10 min) Netcode feel: measure snapshot rate/ping, raise snapshot rate (15 Hz now), interpolate opponent, smaller payloads, check Render region, keep-warm GitHub Action cron on /health, ping /health on page load.
- [x] 105. Sound pass and chill music (menu + in-match) with Music/Sound toggles and volumes in Settings.
- [x] 106. Multiplayer now uses the solo HUD (health bar, ammo with weapon name, crosshair that follows spread, scope vignette, hit markers, damage flash), viewmodel fire/reload animation, opponent aim pose when shooting and crouch. Same sounds as solo. Still to share: streak slots, kill cam, killfx banners (next).
- [x] 107. Multiplayer match rules match solo: best of 5 (first to 3 rounds), and sides swap after round 3 (planter becomes defender, defender becomes planter, scores follow the players) with a "Switching sides" banner. Scoreboard uses the solo pill. Server-side (private repo).
- [ ] 108. Next for MP parity: shared economy/shop/avg $ row, killstreaks, kill cam, solo-style kill banners, opponent source adapter into the solo Game loop.
- [x] 109 MP shop/money: server-owned economy (room.js, same economy.js), client game.eco mirrors server state via eco.remote(), buys sent to server (B opens the same shop). Avg $ row in MP pill. Version label (bottom right of menu). Heartbeat {t:hb} every 20s from server.
- [ ] 110 MP killstreaks, killcam, kill banners via solo modules; 111 delete mp.js loop (MP runs in Game loop, opponent source switch).
- [x] 111 TRUE MERGE step: MP now runs inside the solo Game loop (game.js update/loop). Opponents are the same bots module in remote mode (bots.setRemote/syncRemote, same characters/hit zones/death+hit anims/killfx blood/killcam/HUD/inventory panel/eco shop). mp.js is now only lobby + network adapter (drive/fixCam/hud hooks). Server stays authoritative.
- [x] 112 (LIVE streaks, grenades, drops, revive) MP: killstreaks (server-side), grenades, weapon drops, 2v2 revive prompt, bomb plant/defuse progress text parity, stats of kills in killcam from server.

- [x] 113 MP rooms: host can optionally add bots (Juan 9:14 AM). Server-side bots run the SAME botsai.js brain inside room.js as ordinary room players (same economy, buy logic, drops, kill rewards); remote clients render them like any other player. Host keys in buy phase / waiting: K = enemy bot, L = ally bot, U = remove bots. Message types addbot / rmbots, host = lowest player id. (Pending live test on 2v2 with a human opponent.)
- [x] 114 ONE MODE (Juan 9:30 AM): "Play vs bots" = private MP room with server-side bots (LIVE step 1: 4 Hard CT bots, you T). 
- [x] 115 ONE MODE step 2 (LIVE): local solo loop deleted from game.js (start, end, bot economy, local round timers and plant). Play vs bots = private server room, bot count 1-4 and difficulty in Settings. Left: friendly nap message, solo stats via server.
- [x] 116 (LIVE settings + procedural music) Audio Settings panel (Juan 9:35 AM): master, effects and music volumes, mute and toggles, persisted in localStorage; chill procedural music (menu and in-match). Joins TODO 105.
- [x] 117 Disconnect fix (Juan 10:05 AM): cause = every commit to the private repo restarted the Render server (rooms wiped). render.yaml buildFilter limits redeploys to server-side files; client changes go to the public repos only. Client waits 4 s before the banner. Permanent logging: GET /diag on the server (uptime, worst tick, rooms, last 150 events incl. close codes, dead peers, slow ticks, event-loop lag) plus client close reports.
- [x] 118 Knife = one-hit kill, server-authoritative ('knife' message, 2.9 m, in front, no wall).
- [x] 119 Join a Play-vs-bots room mid-match with the room code or link (room holds 6, a joiner replaces a bot when full).
- [ ] 120 Sync client files to the private repo only in batches (each push restarts the server unless buildFilter works).

121. Restart-proof rooms: rooms saved to Neon kv every 2s, lazy restore on reconnect, SIGTERM final save + close 1012; client retries room_not_found while reconnecting. DONE (10:2x)
122. Version label + "new version available" hint (polls index.html every 90s). DONE
123. Sound pass 1+2 (death, grenade bang positional, menu hover added 10:5x) (LIVE 10:4x): remote shots use their real weapon sound (pistol/mg/sniper), bullet whiz when a shot passes within 3 m of you, positional bullet impact at the hit point, weapon-switch sound. NEXT: death sound, grenade bang/bounce positional, own-shot impact, UI hover sounds, footstep surface variety. Live knife test still owed.
124. [x] BUG bots did not shoot (Juan 10:54): server rebuilt the player objects every tick so the bot brain saw a "new" target each tick and its reaction timer never finished. Fixed: stable per-player objects (room.js stepBots). Tested: bot engages, hits, kills.
125. [x] Round start (buy phase, 10 s): player moves freely inside the spawn barrier (+-2.5 m), clamped identically on server and in client prediction (server sends the barrier centre as sz in snapshots). Firing stays locked in the buy phase.
126. [x] Shop openable any time while alive (inZone always true on client and server; server still validates money, ownership, phase).
127. [x] Host bot hint: shown once at the start (banner) plus clickable buttons (+ Enemy bot K, + Ally bot L, Remove bots U) top-centre during waiting/buy phase.
128. [ ] Live knife test with two real players.
129. [ ] Review again: sounds (death, grenade bang, menu hover shipped, not listened to); footstep surfaces; own-shot impact.
130. [x] MP barrier: the buy-phase barrier was missing in multiplayer (setZone never ran after the local loop was removed). Now created in MP, centred on the server spawn zone sz, visible during the 10 s buy phase, fades when it ends; clamp lifts at the same phase change on server and client. Host bot buttons moved below the buy-phase text.
131. [x] Barrier fade now uses real elapsed time (was frame-count bound, looked stuck at low FPS). Normal rooms start automatically when both teams have a player (host adds a bot or a friend joins by code); no Enter needed. Verified join: joiner gets the other team, waiting->freeze->live.
132. [x] Host-controlled start (Juan 11:56): normal rooms stay in a free-roam lobby until the host presses Enter (or the START MATCH button). Lobby: move the whole map, shoot, die and respawn after 2 s, infinite money for the shop (reset to 800 at start with score and kills). Server-authoritative: 'start' message, host only, needs a player on each team. After a match ends the room returns to the lobby. Vs-bots rooms keep auto-start. Hint: PRESS ENTER TO START (host) / Waiting for the host (others).
133. [x] Shop rule = solo rule (Juan 12:42): in a live round the shop only works inside your own team's spawn square (server-validated by position, +-2.8 m, same height), on both sides; buy phase: inside the barrier; lobby: anywhere with infinite money. Supersedes #126. Server sends the zone centre sz (x,z,y) every tick outside the lobby; client uses it for the shop and the barrier.
134. [x] Fallback client host (Pages Actions incident 12:11-?): the Render server now also serves the game files (index.html, js, fonts) from the repo root at https://sniper-chill-mp.onrender.com/ (whitelisted extensions only; server/, .git, package files are never served). Does not depend on GitHub Actions.
135. [x] Key conflict: M = leave room (was L, which is the host's ally-bot key).
136. [x] Remote kills: the kill event now applies the victim's death immediately (no wait for the interpolated snapshot); snapshot cannot revive for 0.7 s.
137. [x] showMenu always stops a previous menu (key-handler leak guard).
138. [x] Buy feedback: server buyr reply now plays buy / buy_fail sound and shows "Purchased" or the refusal reason.
139. [x] Fix: bots showed the death animation but stayed alive. In multiplayer the client applied its own hit/kill locally (against interpolated bot positions) and the server snapshot then revived the bot. Now the server alone decides hits and kills; the client only shows hit feedback, and kill credit text/streak comes from the server kill event.

138. [x] Buy menu: money drops immediately on purchase (optimistic, server confirms), purchase animation (card flies to loadout, -$ float, money ticks down).
139. [x] Palm trees have trunk collision (players, bots, bullets, cars) - palm spots now come from map.js, shared with the server.
140. [x] Fullscreen button always visible; any click while playing grabs pointer lock (trackpad look); F11 toggles fullscreen.
141. [x] Tab = in-match scoreboard grouped by team (kills, deaths, damage dealt); server roster now carries damage.
142. [x] Version label bottom-right reads v1005b.

143. [x] Grenades fixed: throws were silently rejected (no economy hook) and MP client never received grenade/armor counts. Now thrown, visible to all players (replicated), explode and damage.
144. [x] Texture glitch (stippled wall patches near windows): decor trim z-fighting with walls, stronger depth offset.
145. [x] Round start banner reminds players to press B to open the shop.
146. [x] MATCH POINT banner when a team is one round from winning.
147. [x] Knife run speed +22% vs guns (client prediction and server agree).
148. [x] Version label v1005d.

149. [x] 1v1v1 mode "Triple Threat" (multiplayer, room mode ffa3): three teams (orange T / cyan CT / green Z), third spawn on the current map, last team standing wins, no bomb, bots fill empty teams, 3-team Tab scoreboard, 3-way MATCH POINT. Classic 1v1/2v2 unchanged.
150. [ ] 1v1v1 v2: bigger map with three sites A / B / C.

151. [x] Kite Plaza = Kite Garden (intact) + walled west extension (Z spawn, site C, 2 gates, buildings, cover).
152. [x] Map picker + mode picker (1v1 / 2v2 / 1v1v1) in MULTIPLAYER; page reloads onto the chosen map.
153. [x] Esc pause menu in MP (Resume / Settings / Leave room), stays fullscreen via keyboard lock (Chrome), releases the mouse; M shortcut removed.

154. [x] BUG mid-round teleport to spawn: every push/deploy restarted the server and the restored room restarted the round (respawn). Rooms now save phase, timer, bomb, positions, hp and resume the round in place after a restart.

155. [x] 1v1v1 bomb objective (done): 3 sites A/B/C; each round random roles (1 attacker team vs 2 defender teams, or 2 vs 1); allies do not damage each other; plant/defuse/explode/elimination/timeout rules; role banner + plant/defuse prompts.
156. [ ] Kite Plaza polish pass (flow, cover, signage, details, no empty areas).


## Night audio feedback - 2026-10-07

- Owner request: audio received 00:33, transcript ratified at 00:42 ("Bien pues ponte no?"). Voices not attributed; uncertain Gates phrase and badge thresholds remain unimplemented.
- Implemented: headshot markers/medals neon green, sustained vertical recoil +25% to +91%, owned taser visible as X in inventory, Fire in the hole on grenade throws, flash radius14→32m with line-of-sight/duration unchanged.
- Implemented: Bezos +20 HP capped100 without gear/ammo; Hawking Quantum Dash 3x shared/predicted movement for7s with wheelchair model. Rambo streak5kills, key9, unlimited heavy gun ammo for12s, previous primary restored. Rambo chosen instead of turret from the preference expressed in the audio.
- Implemented: bazooka and grenade launcher, same shared weapon table and server-authoritative projectile travel/collision/splash. Bazooka1+4 rockets, 34m/s, max85 splash; launcher4+12, 22m/s arcing, max65 splash. Both primary weapons, available in heavy shop. Self-splash enabled, armor/cover reduce damage, no full-health one-shot.
- Existing sandstorm and Starship map event confirmed, not duplicated; controls remain Q aim/Y power and knife1.5m. Map unchanged.
- Tests:29/29 simulated +8WebSocket, projectile travel and bounded damage, Rambo restoration, Hawking prediction, cap100. Visual models inspected, HUD taser inspected. No human multiplayer playtest.
- Shipping: v1007a; principal+legacy Pages mirrors and Render must be verified before marking live.


## 2026-10-07 daytime feedback, v1007b
- Implemented: authoritative floating damage and helmet-break cue; a helmet absorbs its first headshot at the existing 0.4 multiplier then breaks.
- Latest balance: rifle head110/body25-26; sniper head180/body75, scout head150/body60; shotgun body22 per pellet. Shared table for all modes.
- Respawn: standing-volume spawn checks; controller teleport reset; keep network updates running while shop is open; clear death/aim/streak state on respawn.
- Performance: cached HUD/visible economy DOM state, single antialias path, pixel ratio cap1.25, medium defaults and sustained-low-FPS fallback. Network uses wall-time rather than the capped visual delta. No claim that laptop or internet lag is eliminated.
- Events: first18s active play, next35-50s; shared across1v1/2v2/FFA3/TDM/FFA/Gun Game; visual animations use real time.
- Tomb: two100HP pharaohs in pyramid chamber for45s, killable by hitscan weapons; visible bandage projectiles slow by18% per hit to46%, recover after5s; walls block their shots. No map geometry changed. Launcher splash/knife interaction with NPCs is not implemented.
- QA:29/29 base tests,8WebSocket, all6mode event simulation and real Chrome+WebSocket receipt with visible sand overlays,100clear respawns. Inspected damage/helmet/model/event pixels. Tests used local game server and controlled events, not six public matches or Juan laptop benchmark.
- All client changes verified equal across principal Pages, legacy Pages, Render. Final server deployment observed Live.

## 2026-10-07: v1007e wall-visible shot feedback (Juan)
- [x] World muzzle flashes and legacy world text in animations.js now depth-test. Same onBotShot path for human opponents and bots, all modes.
- [x] World hit flash/ring/comic sprites in killfx.js now depth-test. HUD-confirmed damage numbers unchanged.
- [x] Published animations.js, killfx.js, mp.js and index.html match on all three mirrors. v1007e.
- [x] 29/29 unit checks + 8 WebSocket checks. Browser component regression: pink remote muzzle visible without wall, hidden behind wall; original depth bypass reproduces leak. Impact sprites also depth-test. No damage/map/tick/quality changes.
- [ ] Juan's "comentarios" needs clarification: legend voice lines/bubbles vs match announcer vs event banners. No removals yet.

## 2026-10-07: v1007f bubble visibility / private hit feedback
- [x] Juan clarified comments stay. Remote character speech bubbles start hidden and appear only with camera line of sight to the speaker's chest, within screen, uncloaked and outside smoke. Walls/ramps use shared hitscan raycast. Rechecked every frame, same code in every mode.
- [x] Damage numbers already restricted in mp.js to m.by === net.id and m.id !== net.id. Browser receipt-handler regression: shooter 1 number, victim 0, third party 0, spectator-view case 0. No observer-driven damage number render.
- [x] Browser component pixels inspected: pink muzzle and impact sprites hidden by wall; actual character bubble hidden by wall and visible after wall removed. Synthetic controlled scene, not a two-human production match.
- [x] v1007f published with identical client files across three mirrors. No voice lines removed, damage/quality/tick/map unchanged.
- [x] 1007g (2026-10-07 night, Claude for Juan): hit registration parity. Juan: "sale la animacion de que le he dado pero no sale el numero del dano". Root cause: client predicted against the legend MODEL hit boxes, server against a generic 1.8 m capsule (never lowered when crouched) + independent spread rolls + view tick of the next input instead of the click. Measured 6-29% client-hit/server-miss standing, 10-33% crouched. Fix: hitprofiles.js (baked per-legend boxes, test/gen-hitprofiles.mjs) used by BOTH sides via hitscan.profileZones; client reports each bullet's spread offset + view tick (`sh`), server reuses it inside its cone; snapshot flag 128 = spawn protected (client skips those targets, and teammates); REWIND 10->15 ticks because Render free stalls the event loop 190-400 ms every 30-60 s (logs). Tests 31/31. Render free tier: still the "sometimes" factor (CPU throttling + 50 s cold start); recommend Starter or another always-on host, region closest to the players.
