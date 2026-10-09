# Fresh northern continuation through Yatasto

**Current status — 4 October 2026:** The completion figures and methods below
describe the dated September source. The current ordinary 3,200-peso route has
separate [stock campaign evidence](stock-campaign-route-2026-10-04.md).
Finite field aid, stable rest and the Córdoba continuation pass; current
Yatasto and ending acceptance remain under test. Separate 32,000-peso funded
fixtures do not establish ordinary-start acceptance.

The published mixed-force route now continues from untouched Retiro startup to
saved phase 3 at Yatasto. It uses the [accepted coastal opening](fresh-coastal-opening.md),
then wins the actual Córdoba, Tucumán and Salta maps, pays for supplies and
replacements, signs the northern agreements and reaches the conference in person.

Source: `63dadebad11cdabaf372ea36d9557beab2a16407`.

Later manual-care integration changed the reproducible route costs and casualties.
See [the finite first-aid regression record](finite-first-aid.md) for that source;
the checkpoint below remains evidence of this earlier release.

[Recorded checkpoints](../evidence/fresh-northern-2026-09-28.json) retain the battles,
payments, replacements, deaths and final figures.

## Method

`tests/fresh-northern-route.test.mjs` runs the entire fresh mixed coastal prefix,
then continues the same campaign. There is no granted money, health, territory,
equipment or victory. A controller correction lets scouting advance through
expensive forest terrain; movement still spends the game's actual AP and energy.
The earlier stall was a controller scoring problem, not a demonstrated game bug.

Each northern battle records ordinary orders against visible targets and remembered
locations. A second execution uses the campaign clock for every order, reloads a
save halfway through the fight, and checks identical final units, randomness and
elapsed time. Actual victory then permits exploration and available finite field
care before campaign settlement. Duplicate settlement is rejected.

At the controlled Córdoba workshop, repair and resupply use their actual prices.
Replacements come only from living people outside current service, pay week terms,
and wait for real arrival at the current controlled valid destination. Deaths
remain permanent. The created officer dies at Córdoba; the remaining force can
continue. The route does not assume that Paroissien survived the capital battle.

After Salta, the northern pact and partisan supply cost 550 pesos together. Actual
travel reaches Tucumán, where the squad enters the distinct Yatasto scene. It walks
to Belgrano for the reports and to San Martín for the assessment and frontier
agreement, with save/reload between conversations. Premature conference completion
and repeated completion are rejected. Final state has phase 3, completed Yatasto,
the northern agreements, supply to Salta, a living uncontracted commander, positive
funds and no pending scene. The final campaign ending remains false.

The coastal pair and new northern test pass as a focused group. Release checks:
**793/793 tests**, zero failures or skips (193,717 ms); type check; production
export (721 files, 631 asset references); 36 baseline checks; documentation audit
(200 requirements, all 50 original and 87 parity rows, 39 evidence records).
[PR #62](https://github.com/fsodano/granaderos/pull/62) merged after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36396068305/job/108842643134)
passed on `09b9d2bed0be8d72a22d3af266f3d9009de0f712`.

The final saved checkpoint is hour 102, second 227, with 4,118 pesos, five current
squad members and twelve permanent deaths. Six strategic localities are controlled.

## Limits

This accepts one published stock seed and force strategy through Yatasto. It uses
the published field-care and equipment model. It does not repair or accept the
advanced checkout's doctor-assignment, Córdoba recapture or prisoner-rescue paths.
Those failures keep their separate records and source identities.

The hired-only northern continuation, Jujuy, Humahuaca, Cuyo, the historical ending,
an independently authored full campaign and sustained performance remain open.
This is simulation, deterministic replay and save evidence, not live-browser or
general balance acceptance. No gameplay rules or difficulty change in this delivery.
