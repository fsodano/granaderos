# Autonomous local artillery crews

Runtime/test source: `3e8801f6ca99cc68b43da51fde36a5e5e4af73d9`.

Enemy soldiers and local militia can operate a nearby friendly cannon. They use
the same firing, pivoting, movement, stance and reload orders as the hired squad.
The cannon retains its identity, allegiance, loaded shot, reserve and unfinished
work. This is a Granaderos period adaptation; it does not assert that JA2 had
these field cannons.

A gun reserves its nearest capable local crew within six tiles and line of sight.
Militia and hired soldiers cannot lend each other action points. A short approach
uses legal movement, at most three steps and 24 AP per order, then makes a fresh
decision. Prone operators pay to stand. Adjacent operators wait while the rest of
their crew approaches or stands; a close enemy within 2.5 tiles takes priority.
Serviceable posts retain their crew through quiet exploration ticks. Empty guns
release them to ordinary patrol/combat behavior. The AI does not relocate guns.

All enemy AP budgets are issued before the first shared action of a phase.
Helping another gunner cannot grant a second budget when the helper's own slot
starts. Reaction spending is deducted once. Militia spend their existing allied
budget, followed by the normal next-round refresh. Partial loading is limited by
the least available assigned member; only completion consumes a reserve round.

Loaded guns require a visible target and the actual model's range. A paid pivot
also requires enough AP for the following shot. A shared read-only physical trace
drives both targeting and execution. Known friends, protected incapacitated or
surrendered people and visible civilians exclude unsafe shot choices. Canister
checks the whole cone. The chooser uses visible opponents and known friendly
positions; private opposing supplies do not affect its score. Actual execution
still resolves against the complete field. Local approach planning also filters
unseen opponents.

## Verification

Seventeen simulations and two mounted production Battlefield cases pass. The
final artillery/emplacement overlap passes **29/29**, following an earlier
**55/55** overlap with allied combat, patrols and loading. Complete regression
passes **1073/1073**, zero failures or skips (247,254.318 ms), on the source above.
Types, production export (722 files, 632 asset references), all 36 reference
comparisons and the documentation audit (241 requirements, 80 evidence records)
pass. Exact-head CI passed before publication.

The first full regression passed 1071/1071 on
`32f7ed31e41f96de6b97e19c576aa4bc05703f4b`. A separate scattered-crew probe
then exposed premature abandonment. The final source retains adjacent operators,
uses short approach steps and adds two regressions for scattered and prone
helpers. Only the subsequent 1073-case run accepts that correction.

A real purchased swivel survives the established-area assault victory at San
Nicolás. Paid militia training creates the actual local cohort. A declared compact
ambush around the retained emplacement then uses the real allied turn to fire
and win. Complete campaign/tactical saves, return and reentry preserve the same
gun, depleted load, reserve, exact militiaman, supplies and earned experience.
The ambush geometry is prepared; campaign funds, identities and ammunition are
not fabricated and the victory is not assigned.

Tactical boundaries cover all models, shared reaction budgets, heavy work across
turns, distinct hired/militia control, stance and movement costs, pivot affordability,
blocked contact, water, missing/incapable crews, penetrating-line and cone safety,
visibility, private-state independence, quiet posts and deterministic saves.
Mounted controls advance actual enemy loading and allied fire through the turn
button. These are DOM checks, not live-browser or loaded-performance acceptance.

## Remaining work

Remote crew assembly, autonomous gun relocation, indirect fire, distinct solid and
canister reserves, transport, trading and editable gun profiles remain separate.
Advanced interrupt queues from the preserved development source are not part of
this synchronous published engine. The broad artillery, militia and integration
requirements remain partial. The [dated development record](../gameplay/tactical/artillery-ai.md)
retains its separate scope and test counts; it is not the acceptance record here.

## Publication

Published in [PR #103](https://github.com/fsodano/granaderos/pull/103) on 2026-09-28.
Exact head `3ad3565d8a4b9adf5f490e654b338f11cae51140` passed [CI run 36493237943](https://github.com/fsodano/granaderos/actions/runs/36493237943), including the full suite, types and production build. Merge commit: `4d85860b8fe2390a7323fbf62b8b3809485c7c5f`. This publication does not close the broader artillery or campaign requirements.
