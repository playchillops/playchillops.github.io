# ChillOps changelog

Source of truth: this private repo. Live build is the public mirror served by GitHub Pages.

## 2026-10-07 (later): legend voices, calling cards, funding-round streaks, live map events
- Legend voice lines: Z taunts (server picks the line, 4 s cooldown), kill lines (killer and victim hear them) and superpower lines, each legend with its own voice (pitch, rate, system voice) and a speech bubble over the speaker.
- Calling cards: when you die you see the killer's card (company logo, legend, prestige, gun, distance, HP left, K/D) with NEMESIS / streak / headshot tags. Nemesis is marked on the Tab scoreboard; killing yours gives NEMESIS DOWN. Bots show their legend's company (Apple, Meta, OpenAI...).
- Kill streaks are funding rounds: Angel Round (radar, 3), Series A (care package, 4), Series B (guided missile, 6), Series C (airstrike, 8), IPO (mega-nuke, 11).
- Care packages: parachute down in 3 s; hold E to open (0.5 s yours, 1.2 s to steal): a big gun, a full superpower, shield + helmet + taser, or 150 HP. Bots grab crates they walk over.
- Live map events every ~2 min of play: Starship launch on Kite Plaza (10 s countdown, the real rocket lifts off, the exhaust kills anyone on the B pad, screen shake), funding blimp drops a care package, sandstorm (fog for 30 s, bots can't see far either), bull market (superpowers charge 2x, stock ticker).

## 2026-10-07: super trampolines, portal, taser, superpowers, bomb fix
- Kite Plaza: 5 red super trampolines at the edges throw you (11 m apex, ~1.8 s flight, steerable) onto the pyramid's upper terrace. movement.js flies any launch faster than 1.5x walk speed with no air drag (stateless, so prediction stays exact).
- Portal on the west edge of Kite Plaza: walk through the ring and raceday.gg opens in a new tab (button if the browser blocks it).
- Zap Taser (shop, gear, $400, X): one zap, 6.5 m, the enemy is paralysed for 5 s (can't move or shoot) and takes 10 damage.
- Superpowers, one per legend, Q when charged (time + kills + damage): One More Thing (Jobs, X-ray), Metaverse (Zuckerberg, cloak), AGI Mode (Altman, zero spread), Starship (Musk, rocket jump), Prime Delivery (Bezos, 150 HP + ammo + shield + frag), Overclock (Jensen, double fire rate, instant reload), Blue Screen (Gates, freezes enemies within 14 m), Ryzen Turbo (Lisa Su, +60% speed). Bots use theirs too.
- Knife: the base knife is a pirate cutlass (curved blade, brass guard + knuckle bow) and the butterfly a real balisong; the fist closes on the grip and no blade crosses the hand in any frame (checked at 240 fps); new draw / slashes / heavy stab / inspect / balisong flips.
- Grenades: smoke ~10 m wide, fully opaque, hides players and blocks bots' sight (server simulates the same flight); frag ~2x radius with a big toon fireball, shockwave, debris and distance camera shake; hold V/H/J to throw up to ~2.2x farther (meter + arc preview). Fix: TDM/FFA grenades were rejected by the server.
- Bomb: hold-E hint and progress bar in every bomb mode, you stand still while planting/defusing, defuse sounds, "Bomb has been planted / defused" voice. Progress runs on the server clock, so lag no longer slows or resets a plant.

## 2026-10-06 (late night): Silicon Valley legends
- Players are Silicon Valley legends: Steve Jobs, Mark Zuckerberg, Sam Altman, Elon Musk, Jeff Bezos, Jensen Huang, Bill Gates, Lisa Su. Built in the same toon style as the original cast (signature outfits, hair, glasses).
- The server gives every player a random legend when they join (a different one for each player while there are free ones), so everybody sees the same person. Bots are named after theirs. "YOU ARE STEVE JOBS" card + voice at the start; Tab scoreboard and MVP screen show "as <legend>".
- Teams stay readable: every legend wears a conference lanyard badge, an armband and a sneaker stripe in the team colour.
- First person: your sleeves are your legend's outfit (bare forearms for T-shirts), bare hands, team-coloured cuff.
- Main menu shows a random legend with name and company.

## 2026-10-06 (night): fast modes, killfeed, killcam, sprays, prestige
- New modes (lobby + "vs bots" in the menu): Team Deathmatch (first team to 30), Free-for-all (first to 15), Gun Game (kill = next of 11 guns, knife kill on level 12 wins, getting knifed costs a level). Back in 2 s, spawn far from enemies and out of their sight, 1.5 s spawn protection, free loadout with B anywhere (TDM/FFA), drop-in matchmaking. Bots hunt in these modes and never hide.
- Killfeed top right: killer, weapon icon, headshot icon, victim, team colours, prestige emblems, FIRST BLOOD.
- Announcer (browser speech) + medals + kill sounds: first blood, double/triple/multi kill, headshot, payback, humiliation, killing spree, lead changes, "five kills to victory", enemy UAV / airstrike / nuke, Gun Game final level.
- Final killcam at the end of every match: the last kill in slow motion over the killer's shoulder (server keeps ~8 s of snapshots). Space skips.
- End-of-match screen: MVP card, full scoreboard (K, D, headshot %, accuracy, damage, top weapon), best player per company. The XP reward card comes after it.
- Profile asks for the company website (step 3). The server fetches the logo (/logo?d=domain, public hosts only, no SVG, cached a day); T sprays it on the wall you look at.
- Prestige: from level 15 reset to level 1 for an exclusive emblem (10 emblems), shown in the menu, profile, killfeed, Tab scoreboard and MVP card.
- Match end lasts 24-26 s (killcam + MVP screen). The knife no longer fires your gun server-side.

## 2026-10-04 (evening)
- Aim toggle (right click), Shift crouch, no sprint.
- Grass/ground flicker fixed, opaque water, toon graphics look (?look=off disables).
- Specialist bots (height-aware adapter, ?ai=simple fallback), calmer default difficulty (?diff=easy|medium|hard).
- Characters (T variant) as enemy models, health bars hidden.
- Killcam: cinematic only for the last enemy; thin bullet trails.
- Killfx: hit markers, medals, cartoon blood (cleared every round), corpses.
- Economy: 10 s buy phase, B opens the shop, buy zone rectangle at spawn (also usable mid-round), money chip top-right.
- Weapon drops: real models on the ground, E to pick up.
- Killstreaks: UAV (4), missile (5), RC car (6), airstrike (7), G calls the first available.
- Kite Garden map v2 with physicsColliders and thin surface ramps.
- Ramp teleport bug fixed in movement.js (never snap across a footprint the player is inside; thin underside for head bumps).
- Best-of-5 match flow (first to 3), scoreboard at top, money carries between rounds.
- Grenades (V frag, H smoke, J flash) and destructible cover (destruction resets only per match).
- Daily challenge mode removed.
- FPS/ms readout bottom-right.

## Not done yet
modes.js / ui.js / audio2 integration, multiplayer client wiring (server/ and client/net.js are stored only), 1v1/2v2 + revive rules, more maps.

## HUD + branding pass
- Renamed to ChillOps; animated logo intro (confetti, click to skip, `?nointro` disables) and animated main menu.
- Fredoka (bundled locally, OFL) is the game font everywhere.
- New scoreboard (YOU / ROUND n/5 / BOTS with win pips).
- Wallet chip shows only the amount. Health number centered in the bar.
- FPS/ms counter top-left, off by default. Settings menu (main menu + pause): FPS toggle, sensitivity, volume, bot difficulty; saved in localStorage.
- Crosshair rebuilt: 4 equal ticks, equal gap, pixel-centered, plus dot; spread widens symmetrically.
- Killstreaks now persist between rounds; reset on death and on a new match.
- Grenades (V frag, H smoke, J flash) and destruction integrated.

## Menu, knife, bomb blast
- Main menu redone Black Ops style: dark vignette, plain text list (selected item orange), big lit character, key-hint bar; Rachas/Ayuda/Ajustes as list items.
- Scoreboard simplified to a thin pill. Knife (key 3), inventory bar, Kite Garden v3 map.
- Visible pastel barrier around the buy zone during the freeze phase (fades after).
- Bomb detonation: fireball, shockwave rings, debris, camera shake, panel destruction; everyone within 14 m dies (player included) and drops weapons.

## HUD steering + shop keys
- Black Ops style right edge: streak slots stacked vertically (stronger glow when earned), inventory/grenade rows below, bigger mag number. Centre of screen holds only the crosshair (banner/hints moved).
- Missile now starts 150 m up and dives faster.
- Shop: B opens, 1-5 pick a category, then 1-3 buy items in it (key shown on each card), Esc/B goes back, then closes. Z/X/C removed.

## Knife skin + grenade hint
- Shop: Gear > Kite Cutter ($300) knife skin, kite guard, iridescent blade; nicer knife model. Buying a grenade shows a "press V/H/J" hint.

## English pass
- All in-game text is English (menu, HUD, banners, shop, pause/end screens, settings, streaks, killcam).

## Knife + streak HUD + tablet
- Karambit-style knife (curved bevelled blade, guard, wrapped handle, pommel, ring), slash + F inspect.
- Streak slots: bottom-centre row, bigger crisp SVG icons.
- Airstrike and guided missile now use a first-person tablet with a 2D plan map (no live view); click/Space to call, Esc/Q cancels and refunds.

## Kite Garden v4 + heli tablet
- map.js replaced with Kite Garden v4 (70x70, same API). v3 kept in private repo history.
- Tablet map is now a real aerial render (enemies hidden). A support helicopter flies in and launches airstrike bombs / missile from above the target.

## 2026-10-04 6:55 PM
- TODO.md is the master project memory (BACKLOG.md merged into it).
