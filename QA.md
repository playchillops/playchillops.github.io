# QA checklist (manual, real browser with GPU)

Menu and flow
- [ ] Menu shows only "Jugar contra bots"; click starts, pointer locks.
- [ ] 10 s buy phase: HUD timer, move only inside the green rectangle, B opens/closes the shop, Esc closes.
- [ ] After 10 s the round goes live; B works again only while standing in the rectangle.
- [ ] Best-of-5: scoreboard updates; match ends at 3 wins; next round keeps money.

Combat
- [ ] Shoot bots: hit markers, headshot feedback, kill reward money.
- [ ] Killcam only when the last enemy dies.
- [ ] Bullet trails thin; no blood left after a new round.
- [ ] Enemy heads visible; no health bars above enemies.
- [ ] Drops lie on the ground, E picks up, hint shows.
- [ ] Grenades V/H/J; cover breaks; bots replan.
- [ ] Streaks at 3/5/7/9 kills (keys 4-7, G).

Map and movement
- [ ] Walk, jump on/along/off all 4 ramps; no teleport, no sticking.
- [ ] Head bump under decks; shoot under a deck works.
- [ ] No ground flicker, no z-fighting; steady FPS (see readout).

Known limits
- Headless Chrome tests are software rendered (1-2 FPS); only logic is verified there.
