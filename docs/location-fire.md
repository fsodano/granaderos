# Fire at a location

The [classic JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 29, describes selecting the targeting cursor independently of an enemy and firing at an item or person. Granaderos now allows the existing **F** firearm cursor to target a map cell, including a location behind cover or outside current observation. This restores the choice to fire toward a sound or remembered position without requiring the simulation to disclose an enemy.

## Player controls

Equip a loaded firearm, press **F**, then click a cell or focus it and press Enter. Select up to four ordinary aim increments. The preview shows the actual fire-plus-aim cost and remaining AP, but no enemy identity, body region or hit percentage. It warns that cover and bodies can intercept the shot, including allies.

A visible enemy still uses the existing aimed enemy shot. A cell, corpse or friendly figure uses location fire. The current body-region selection applies to identified enemies; a location shot uses a fixed standing-torso destination height. **G** or Escape returns to contextual movement/item use. No separate action button was added. Medical and supply items retain their existing F/item behavior.

## Simulation contract

`pointFirePreview` reads the actor's legal turn/interrupt window, firearm readiness, AP, aim and map bounds. It never queries an occupant, enemy attributes, cover or sight. Empty and unobserved occupied coordinates produce identical previews. Invalid coordinates, an empty or jammed gun, a disabled actor, a mixed person/location request or insufficient AP leave equipment, RNG, time and continuation unchanged.

The reducer pays the same fire and aim costs as ordinary fire. Failed ignition keeps the load and weapon condition; success consumes one load, wears the gun by one point, emits ordinary firearm noise and smoke, and uses the shared wound, morale, incapacitation and death rules. A location shot clears identified-target reacquisition memory. Empty shots and friendly impacts do not grant marksmanship practice. Eligible enemy impacts can grant practice.

For a single projectile, the aim roll uses the existing accuracy inputs against a synthetic standing point, without a sight-line admission requirement or an identified-target bonus. A failed aim roll offsets the destination by a bounded seeded amount. The resulting ray uses the same terrain/furniture resistance as ordinary fire. The first living body that intersects it receives the impact; bodies include allies, routed/surrendered soldiers and unconscious soldiers. A prone soldier can be below the fixed ray. Corner-touching cells still block shots through solid cover but do not count as body intersections. Cover beyond the first struck body cannot protect that body.

The blunderbuss retains a six-tile directional cone. Each affected soldier receives an independent accuracy/cover check. Unlike the single-projectile trace, its existing cone abstraction does not model one body shielding another.

Point-fire damage and rout messages are omitted for an unseen enemy. Later bleeding messages also require player ownership or squad sight. The public state continues to omit hidden actors. The subsequent [journal observation change](tactical-journal.md) also filters ordinary enemy actions, including equipment and treatment, at event time. A live blind-fire/self-treatment check and save restoration passed.

## Explicit tuning and limits

These are Granaderos adaptations, not claimed classic JA2 formulas: the 100-point AP scale, existing firearm accuracy/ignition rules, fixed 1.1-unit endpoint height, cell-wide body silhouettes, region thresholds, cover resistance and miss offsets. The miss radius is `min(4, max(1, ceil(distance / 8)))` cells, with a nonzero offset. The shot terminates at that destination or its first body/cover stop. It does not model travel beyond the endpoint, penetration through bodies, gravity, ricochet or muzzle velocity.

This change does not add free aiming height, NPC civilian damage or destructible furniture. The subsequent [named-target shot change](directed-projectiles.md) adds missed-shot collisions to ordinary identified-enemy fire. AI still chooses identified-target shots through its existing policy; speculative location-fire decisions are not added. These remain parts of the wider parity audit.

`firePoint` is also available through the existing tactical WebMCP tool, with `unitId`, integer `x`/`y` and optional `aim`. Omit `targetId` and body-region selection. The UI explicitly sends `hitLocation: 'torso'` for compatibility with its shared order wrapper. No persistent state fields or save migration are required.

## Verification

Fifteen tests in `tests/point-fire.test.mjs` cover hidden/empty preview equivalence, costs, load/condition, cover, friendly interception, prone clearance, moved/dead/departed targets, seeded scatter, the blunderbuss cone, diagonal/window geometry, atomic rejection, failed ignition, exploration time, hidden bleeding, real saved interruptions and actual campaign save/load.

The [live verification record](ja2-live-verification.md#location-fire-checkpoint) records keyboard targeting, friendly interception, hidden-location firing, empty-gun rejection and fresh-tab restoration. The full regression checkpoint passed 1,020 tests, excluding only the unchanged illustrated-sprite packing suite. Typecheck, production build and whitespace validation passed. The broader [parity audit](ja2-parity-audit.md) remains incomplete.
