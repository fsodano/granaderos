# Firearm air-energy loss — 2026-10-05

This candidate adds an optional per-load profile:
`projectileAirDrag:{model:'range-energy-retention-v1',retentionAtRange:r}`.
The profile has exactly these two fields. `r` must be finite, greater than zero
and at most one. That same load must have a valid `projectileEnergy` profile.
An omitted primary or alternative profile keeps its prior behavior. An
alternative never inherits the primary value. Older pinned content is not
updated. A value of one is exactly neutral.

Fresh default Brown Bess family 1800 opts in: the ball retains 0.80 of energy
per selected effective range of free flight; its existing shot alternative
retains 0.65. These are **Granaderos tuning values**, not measured drag
coefficients or a claim about Argentine ammunition in 1812. Other default
firearms remain unchanged. The selected primary/alternative range is the
`weaponFor` specification's `range`; apparent aiming range, sight range and
maximum physical flight distance do not replace it.

## Shared physical rule

For a free-flight interval of exact three-dimensional arc length `L`, remaining
energy is multiplied by `exp(log(r) * L / selectedRange)`. Length and range use
abstract tactical distance units. The implementation does not convert those
units to metres. It does not change gravity, physical range limits, projectile
mass, muzzle speed, flight animation timing or the simulation clock.

Air loss applies only while **no material interval is active**. Within wood,
hay, stone or another admitted material span, the existing progressive linear
material resistance applies. Overlaps add material density without adding an
air debit. Even an explicitly zero-resistance material span excludes air loss;
it adds no obstruction or reflection cue. Same-source spans retain the existing
merge and entry-distance factor. `materialRangeSlope` remains independent: it
can increase material resistance beyond range while this rule reduces energy
in the intervening free flight. Both losses can therefore reduce a later injury
or body-passage chance.

Air, material, body and reflection loss stay separate. The cover-damage tuning
setting cannot restore spent air energy. Each contact receives the current
remaining energy; exact material exhaustion still stops inside the volume.
Reflection spends half the current force and keeps its existing global range
and drop allowance. Air loss continues from the remaining force on the next
leg; it does not restart the launch energy. Nine pellet rays share one finite
mass/energy budget and apply the selected load's retention independently.
Paired hands select independent profiles. No random draw is added. Changed
passage or contacts may change subsequent conditional RNG ordering.

The known-scene scheduler, public event fields and presentation timings are
unchanged. Private material can change actual injury or passage, but cannot
add public flight legs, endpoints, duration or camera focus. Actual known HP
loss is admitted only at its real impact. No air-loss runtime receipt is saved;
the optional profile persists through the existing pinned content and weapon
metadata validation.

## Primary evidence and limits

[Krenn, Kalaus and Hall's original-arms experiment](https://journals.lib.unb.ca/index.php/MCR/article/download/17669/22312),
printed pages 102 and 104, measured spherical-projectile speed at 7.5 or
8.5 metres and at 24 metres, using modern powder and fixed test mounts. Muzzle
values were calculated from those measurements. The reported loss establishes a
range-related energy trend for those experiments. It does not calibrate this
game's selected range, retention values, material resistance or wounds.
[NASA's drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
describes drag through density, area, speed and an experimental coefficient.
This bounded rule does not model atmospheric density, Reynolds/Mach changes,
wind, lift, changing shape or fragment mass. It is not a full aerodynamic solver
or an exact classic JA2 formula. Cannon physics remains separate. Other surface
reflections, fragmentation and broader physical acceptance remain open.

## Finite acceptance

The strengthened existing paid kinetic route uses native 110 and 107, actual
weekly quotes of 420 and 588 pesos, six-hour arrivals and treasury 2192. Four
real Retiro actions acquire two finite shot charges from the armory chest.
Its disclosed dry seed-8 arena is declared before the first official arena
save; it is not a native Buenos Aires victory or a complete campaign proof.
All HP, kits, ammunition, contract terms and cash come from the paid request.

The actual ball contact has 45.4108507937 remaining impact points and leaves
the enemy at 58 HP. A separately pinned initial control omitting only air loss
has 48.1700062422 points and 56 HP. The earlier pre-kinetic control, omitting
both profiles before campaign creation, has 49.9900062422 points and 54 HP.
The real ball shot spends its ordinary AP, six seconds, one charge and one
condition point. The existing physical exit, retreat, official replay, selected
shot reload/fire and return/reentry keep nine musket charges, one shot charge
and condition 98. Treasury and contracts remain unchanged. A hidden-screen
variant can change actual injury while the complete public projectile sequence
and its duration/focus stay equal.

The two older clinical/fear experiments remain explicitly pre-kinetic content.
They now omit both coupled fields before `initialCampaign`, preserving their
original paid actions, wounds, care, captures, fear, costs and official replay.
No clinical state or outcome is changed during a route.

Core and content checks strengthen existing tests for exact free-arc decay,
occupied/zero-density/overlapping material, positive obstruction attribution,
curved interior exhaustion, cumulative reflection, finite pellet budgets,
paired selected profiles, omission neutrality, known-only forecasts/AI and
private-scene presentation. Editor/load checks cover independent authoring,
strict bounds/dependency, undo/import/launch and selected-load disclosure.

## Frozen local gates

The affected physical/content/clinical gate closed with **191/191** checks in
23 files; the independent editor/load gate closed with **86/86**. The complete
unfiltered short suite closed with **4942/4942**, **709/709** selected files,
`complete:true`, and zero failures, cancellations, skips or todos. Its unchanged
partition covers 717 test files: 709 short and the existing eight extended
acceptances. No file was newly excluded or name-filtered. This checkpoint does
not rerun the extended campaign or artwork simulations.

Typecheck, production build, documentation and baseline audits, shard/suite
self-tests (11/11), complete shard coverage, quick/extended partition validation
and `git diff --check` all closed with exit zero. The production export verifies
1133 files and 1033 asset references. The independent source review found no
remaining blocker after zero-density occupancy and positive exhaustion-receipt
attribution were corrected.

Frozen production source:
`06625bbab3dd57a283d1eac2b1c5a5acf620a1d0826113d7a48803d72e062c67`.
Frozen tests: 885 test/support paths, 717 test files,
`da6f5138ed82bcb56cd899a74ed4c916704fafe24c3111ea21ede66b546eabcb`.
The test digest is SHA-256 over sorted relative file paths under `tests/`, each
followed by NUL, exact file bytes and NUL. The input manifest and reusable
verification script remain in the ignored candidate cache. Documentation is
excluded from both source/test digests; only this terminal record changed after
those gates.

The initial diagnostic logs remain available: the first energy-normalizer
comparison missed the newly pinned drag field, the first paid comparison
incorrectly required equal terminal ground debits, and the first UI percentage
displayed binary rounding dust. Those test/display corrections changed no
physical route, HP, items, RNG seed, outcome or hidden-observation admission.
No renderer, cannon, 3D, browser state or external asset was changed. No new
classic-parity, SI calibration or complete-campaign claim is made.
