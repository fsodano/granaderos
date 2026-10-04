# Fire at a location

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The [classic JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 29, describes selecting the targeting cursor independently of an enemy and firing at an item or person. Granaderos now allows the existing **F** firearm cursor to target a map cell, including a location behind cover or outside current observation. This restores the choice to fire toward a sound or remembered position without requiring the simulation to disclose an enemy.

## Player controls

Equip a loaded firearm, press **F**, then click a cell or focus it and press Enter. Select up to four ordinary aim increments. The preview shows the actual fire-plus-aim cost and remaining AP, but no enemy identity, body region or hit percentage. It warns that cover and bodies can intercept the shot, including allies.

A visible enemy still uses the existing aimed enemy shot. A cell, corpse or friendly figure uses location fire. The current body-region selection applies to identified enemies; a location shot uses a fixed standing-torso destination height. **G** or Escape returns to contextual movement/item use. No separate action button was added. Medical and supply items retain their existing F/item behavior.

## Simulation contract

`pointFirePreview` reads the actor's legal turn/interrupt window, firearm readiness, AP, aim and map bounds. It never queries an occupant, enemy attributes, cover or sight. Empty and unobserved occupied coordinates produce identical previews. Invalid coordinates, an empty or jammed gun, a disabled actor, a mixed person/location request or insufficient AP leave equipment, RNG, time and continuation unchanged.

The reducer pays the same fire and aim costs as ordinary fire. Failed ignition keeps the load and weapon condition; success consumes one load, wears the gun by one point, emits ordinary firearm noise and smoke, and uses the shared wound, morale, incapacitation and death rules. A location shot clears identified-target reacquisition memory. Empty shots and friendly impacts do not grant marksmanship practice. Eligible enemy impacts can grant practice.

For a single projectile, the aim roll uses the existing accuracy inputs against a synthetic standing point, without a sight-line admission requirement or an identified-target bonus. A failed aim roll offsets the destination by a bounded seeded amount. The resulting ray uses the same terrain/furniture resistance and conditional body passage as ordinary fire. Bodies include allies, routed/surrendered soldiers and unconscious soldiers. Each body can receive one impact; successful passage spends finite force before checking later bodies and cover. All injuries use the same ball's damage variation. A prone soldier can be below the fixed ray. Corner-touching cells still block shots through solid cover but do not count as body intersections. Cover beyond a struck body cannot protect that earlier injury.

The same single-ball ray continues beyond an empty chosen cell or its scattered destination. It keeps its original absolute height and slope until failed body passage, exhausted force, solid ground/floor, map edge or finite flight limit. The limit is the greater of the resolved aim distance and twice the weapon's effective range. Empty and hidden occupied points retain identical public admission; continuation does not expose an unseen downstream person. See [directed projectile continuation](directed-projectiles.md) for geometry, warnings, presentation, pinned classic/Stracciatella evidence and tests.

[Physical shot loads](physical-shot-loads.md) now use nine bounded weighted rays around one resolved center, with the same cover, body, ground and floor order. The native trabuco's physical range remains six tiles; other actual selected shot loads use their own authored range. Each pellet has finite force, and a foreground body can shield a rear person. There is one shared center accuracy and damage variation, with fractional injuries aggregated before rounding. The former independent-per-person cone lottery is removed. Blind admission still does not inspect occupants or publish target probability.

Point-fire damage and rout messages are omitted for an unseen enemy. Later bleeding messages also require player ownership or squad sight. The public state continues to omit hidden actors. The subsequent [journal observation change](tactical-journal.md) also filters ordinary enemy actions, including equipment and treatment, at event time. A live blind-fire/self-treatment check and save restoration passed.

## Explicit tuning and limits

These are Granaderos adaptations, not claimed classic JA2 formulas: the 100-point AP scale, existing firearm accuracy/ignition rules, fixed 1.1-unit aim height above the selected surface, cell-wide body silhouettes, region thresholds, cover resistance, miss offsets and flight multiplier. Body passage uses a seeded chance capped at 95%, `incomingForce - 20`, and subtracts 15/30/23 force for head/torso/legs. Insufficient remaining force stops the ball without a passage roll. These period defaults are game tuning, not measured firearm data. The miss radius is `min(4, max(1, ceil(distance / 8)))` cells, with a nonzero offset. A shot continues past the aim point but can stop at a body or physical barrier, range limit or world edge. Gravity, ricochet and muzzle velocity remain open ballistic work.

This change does not add free aiming height or destructible furniture. Civilian interception retains the existing civilian harm rules. The subsequent [named-target shot change](directed-projectiles.md) adds missed-shot collisions to ordinary identified-enemy fire. AI still chooses identified-target shots through its existing policy; speculative location-fire decisions are not added. These remain parts of the wider parity audit.

`firePoint` is also available through the existing tactical WebMCP tool, with `unitId`, integer `x`/`y` and optional `aim`. Omit `targetId` and body-region selection. The UI explicitly sends `hitLocation: 'torso'` for compatibility with its shared order wrapper. No persistent state fields or save migration are required.

## Verification

Fifteen tests in `tests/point-fire.test.mjs` cover hidden/empty preview equivalence, costs, load/condition, cover, friendly interception, prone clearance, moved/dead/departed targets, seeded scatter, the blunderbuss cone, diagonal/window geometry, atomic rejection, failed ignition, exploration time, hidden bleeding, real saved interruptions and actual campaign save/load.

The [live verification record](../../verification/ja2-live-verification.md#location-fire-checkpoint) records keyboard targeting, friendly interception, hidden-location firing, empty-gun rejection and fresh-tab restoration. The full regression checkpoint passed 1,020 tests, excluding only the unchanged illustrated-sprite packing suite. Typecheck, production build and whitespace validation passed. The broader [parity audit](../../verification/ja2-parity-audit.md) remains incomplete.
