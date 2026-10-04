# Named-target shot paths

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

A single-bullet firearm shot at an observed enemy now follows a physical path on both a successful aiming roll and a miss. This extends parity row C04 and uses the same terrain and body traversal as location fire. It preserves ordinary equipped-gun targeting; no new command or action button is added.

A successful aiming roll retains the selected target's head, torso or leg height. A failed roll offsets the destination cell using the existing seeded scatter rule and retains the original aiming height. The path can strike another living soldier, including an ally, surrendered soldier or unconscious casualty. The first intersecting body stops the bullet. A failed accuracy roll excludes the selected soldier from incidental collision checks, preserving the existing miss result even if the coarse offset path crosses its cell. Other bodies and cover still apply. Dead and departed actors do not intercept it. Fallen and unconscious actors use prone height even when an older record still says standing.

Cover before the intercepted body can stop the shot or reduce injury. Cover after the body cannot protect it. Diagonal corner touches can strike cover but do not strike a body in the corner-adjacent cell. A descending close-range shot checks the whole crossed body interval, so it does not pass above a prone casualty merely because the midpoint of the last cell is still too high.

A single ball now continues beyond the chosen or scattered cell on the same straight ray. Its absolute height keeps the original muzzle-to-aim slope; it does not turn toward a later person or adopt a later floor's height. The first intersecting living body stops it. Terrain, furniture and floor slabs are checked in intersection order, including after the aim point. Weak cover reduces the remaining damage; solid ground and floor slabs stop the ray. The physical impact uses the actual intersection point rather than the centre of a person or obstacle.

The finite flight distance is the greater of the resolved aim distance and twice the weapon's effective range, clipped at the map boundary. This preserves existing legal shots beyond effective range. Effective range still affects the same accuracy calculation; it is not an admission limit. `firearmFlightRangeMultiplier: 2` is editable Granaderos tuning in [`game/combat-balance.js`](../../../game/combat-balance.js), not a claimed JA2 or historical firearm constant.

## Knowledge, previews and AI

The preview includes friendly bodies and observed opponents only. Hidden bodies can intercept the actual shot but cannot change the forecast or expose their name through the journal. A known intervening soldier gives zero forecast impact on the selected target and a warning that firing can injure the intervening soldier and consumes the charge. The player can still fire deliberately.

Enemy shot options use the actor's own sight for intervening opponents and retain friendly positions. The same body-region options let AI choose a clear target or region instead of shooting through a known ally. This does not guarantee that a random miss cannot injure an ally.

The bystander warning checks the same continued hit and scatter rays against known people. A person beyond the aim cell can therefore receive a warning. A failed roll excludes only the selected person's collection and identity: a civilian and soldier with the same ID remain distinct physical bodies. Hidden interceptions use an observed-body trace for the displayed fallback, so they do not expose the concealed body's position through the endpoint, camera or hit reaction.

If that fallback reaches a visible hard-cover stop, its existing material cue remains the same with or without an unknown person. If it instead reaches a known person, the fallback never invents that person's injury or hit reaction. Actual damage still uses the full physical trace.

AP, ignition failure, one finite loaded charge, firearm wear, smoke, noise, target memory, wounds, death, reactions and campaign time retain their common action pipeline. The journal reports a miss as failure to hit the chosen point, since another person may have been hit. Hidden injury and attacker names obey the journal observation rules.

## Evidence and limits

The manual's shooting section describes delivered bullets and factors affecting hits; the current source baseline also distinguishes intended and unintended victims in `engine/Tactical/LOS.cpp`. That engine checkout is JA2 v1.13, so it is corroboration of the behavior, not authority for classic numerical formulas. No v1.13 formula was copied.

The scatter radius remains `min(4, max(1, ceil(distance / 8)))`, with a nonzero cell offset. Cell-wide body silhouettes, abstract heights, fixed body-region thresholds, the finite flight multiplier and guaranteed stopping at the first body are explicit Granaderos tuning. Body penetration, ricochet, vertical miss scatter, gravity and muzzle velocity remain open ballistic work. Blunderbuss spread and artillery retain their existing separate multi-victim models. This does not complete all of C04 or full JA2 parity.

The [October video review](../../verification/ja2-video-review-2026-10-03.md), V10 at 10:53–11:48, supplies the player-facing requirement for a missed shot to strike an unintended person. It does not supply the flight multiplier or an exact physics formula. `tests/continued-projectiles.test.mjs` checks a fixed-seed downstream hit with ordinary costs, location fire, first-body stopping, weak/hard cover, every world edge, range, descending ground, elevated floors, diagonal corners, typed identities, hidden-state equivalence and saved replay. The mounted firearm-presentation test checks travel before the real downstream injury and holds input until one final commit.

Fifteen dedicated tests cover interception, warning/costs, obstacle ordering, prone/dead/departed bodies, unconscious low-shot impacts, all selected regions and postures, accidental miss hits, hidden-state forecast equivalence, AI selection, corners, save replay, rejection close fallen targets and preserving a failed accuracy roll. The existing final-tile medical-approach regression now verifies that the intervening patient can die from the reaction shot while the queued aid still consumes no dressing.

Live QA used two imported controlled saves. In the first, four aim increments and F on D8 showed the intervening-body warning and a 36 AP cost. Enter left the enemy at 100 HP, wounded Dorrego from 84 to 23 HP, and left Cabral with 64 AP, no loaded round and condition 99. Reload and Continue restored the exact public unit records and six-second clock. In the second, a seeded unaimed miss at the named enemy hit Dorrego beside the intended line for 55 damage; the target retained 100 HP, and Cabral had 88 AP, no load and condition 99. Browser warnings/errors were empty. Other cases have simulation coverage rather than individual live demonstrations.

Final isolated validation passed **1027/1027 tests**, type checking, production build and whitespace checks. Static export verified 278 files and 189 asset references using the committed art baseline. The shared checkout browser checks above included its concurrent visual work; the isolated run confirms no dependency on those uncommitted assets.
