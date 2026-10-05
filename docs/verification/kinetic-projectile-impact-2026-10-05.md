# Kinetic-energy projectile impact — 2026-10-05

This checkpoint adds optional `projectileEnergy` to an authored firearm and to
each alternative load. It affects actual material exhaustion, body passage and
injury. It does not use weapon weight as projectile mass. Omitted profiles keep
the legacy rule. An omitted alternative does not inherit the primary profile.
Old pinned campaigns receive no automatic update.

The exact profile is `{model:'kinetic-energy-v1', massGrams, muzzleVelocityMps}`.
Mass must be finite, from 0.1 to 40 grams. Velocity must be finite, from 25 to
600 metres per second. The projectile mass cannot exceed the existing carried
charge mass of 40 grams. Extra fields, unknown models and blade profiles are
rejected. These are bounded content limits, not a claim about all period arms.

## Physical rule and balance limits

Launch energy is `0.5 × (massGrams / 1000) × muzzleVelocityMps²` joules. The
launch impact budget is energy divided by 20. **Twenty joules per reference
impact point is declared Granaderos tuning.** It is not a measured force,
material coefficient, wound calibration or exact Jagged Alliance 2 formula.
For sensitivity, a 1000-joule profile gives 66.67, 50 or 40 impact points with
conversions of 15, 20 or 25 joules per point. This version fixes the conversion
at 20 so a pinned model has one stable meaning.

The existing crossed-depth sweep spends this budget progressively. Distinct
material overlaps add. Each merged span retains its entry-distance factor,
including a reflection while still inside the material. A real exit and reentry
uses a new cumulative entry distance. The existing body costs and 50 percent
stone reflection retention remain game rules. No contact can spend the same
launch energy twice. Exact exhaustion can stop inside a volume.

Authored weapon damage remains the separate nominal injury cap and denominator.
A low-energy contact therefore has lower nominal injury even in open air.
Surplus energy can pay more penetration costs without increasing that cap. The
existing damage draw and struck-body-region effects still apply after the cap.
A tiny positive-energy contact can round to zero injury. It then causes no
wound, bleeding, bodyguard AP debit, harm speech, morale effect or extra contact
practice. The real discharge still spends its charge, AP, time and wear, and
retains ordinary paid-shot practice. There is no minimum-one energy floor.

Nine pellet rays share the **total** profile mass and energy through their
existing weights and final residual arithmetic. Their private launch budgets
sum to the one load's budget; their nominal injury shares sum to authored load
damage. Each paired hand selects its own primary or alternative profile. No
new random draws are added. Changed contacts or conditional passage can change
later RNG ordering; equal-contact controls are the only claim of identical
ordering.

Fresh default content opts in only the native Brown Bess family 1800: its ball
profile is 32 grams at 265 m/s, or 1123.6 joules and 56.18 impact points; its
existing shot alternative is **total** 16 grams at 265 m/s, or 561.8 joules and
28.09 impact points. These are labelled game profiles informed by period-type
reproduction evidence. Other native firearms stay neutral. The weapon editor
and selected-load control disclose total mass, initial velocity and the tuning
boundary. All profiles persist through authored content, compiled weapons,
carried metadata, official saves, load changes, return and reentry.

## Primary-source boundary

The [ASAC reproduction report](https://americansocietyofarmscollectors.org/wp-content/uploads/2024/07/I-Roundball-Shooting-Phase-1-Report-Revised-3-20-24.pdf#page=34),
printed page 27, reports a Pattern 1742 Long Land reproduction with a .69-inch
ball and muzzle velocities of 780–870 ft/s, averaging 822 ft/s. Those convert
to 237.744–265.176 m/s, averaging 250.5456 m/s. The native 265 m/s profile is
near that experiment's upper value. The 32-gram ball and 16-gram total shot
profiles are game choices; this checkpoint does not claim that the experiment
measured these exact Granaderos loads or Argentine service in 1812.

[Krenn, Kalaus and Hall's original-arms tests](https://journals.lib.unb.ca/index.php/MCR/article/download/17669/22312),
printed pages 102 and 104, used modern powder and a fixed test installation in
1988–1989. They measured at 7.5 or 8.5 metres and at 24 metres; muzzle values
were extrapolated. Table 1 gives 30.93 grams and near speed 473 m/s for STG 1318,
with extrapolated muzzle speed 494 m/s; STP 1128 has 14.45 grams and near speed
362 m/s, with extrapolated muzzle speed 385 m/s. These are not matched loads
with the reproduction above, nor evidence for an HP conversion. The
[Stracciatella impact/resistance source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Tactical/LOS.cc)
is a game implementation reference, not a verified SI mass/velocity model.

The tactical horizontal and vertical units have no common calibrated SI scale.
Mass and initial speed therefore set impact energy, not flight time, range or
drop. The public-flight admission correction is described below.
Air drag, velocity loss in open flight, tissue simulation and fragmentation
remain open. No measured-1812-Argentina or exact classic-parity claim is made.

## Acceptance evidence and public admission

Declared subsystem controls compare lighter, heavier, slower, faster and
same-energy profiles. They check actual paid injury, surplus penetration under
the injury cap, rounded-zero contacts, merged depth, overlapping costs,
reflection, curved exhaustion, selected alternatives and finite paired hands.
Geometry and forecasts consume no RNG or resources. Schema and mounted editor
checks retain independent profiles through save and load controls.

The paid encounter starts from explicit fresh default content. Native 110 and
107 receive their actual weekly quotes of 420 and 588 pesos, arrive after six
hours, and leave treasury 2192. Four ordinary Retiro actions approach, open and
take two actual shot cartridges from the finite chest. Both the acquisition
and all later actions have ordinary/presented equality and complete official
saved replay. The flat dry Buenos Aires arena, passive hostile posts, known
hay screen and seed 8 are declared before the arena's first official save. It
retains the issued force, native health, kit and contracts. This is a declared
encounter acceptance, not a stock conquest or full historical campaign win.

The first ball reaches the observed enemy with 48.17000624219969 impact points;
the otherwise equal omitted-profile control has 49.990006242199684. Actual HP
becomes 56 and 54. The native ball spends one charge and six seconds. A physical
retreat, return and Retiro reentry preserve both results. Selecting the actual
shot alternative, reloading and firing spend only one of the two acquired shot
charges. A real ignition failure is retained, followed by paid reprime and
retry. Final gun condition is 98, musket reserve is nine and shot reserve is
one. The same profile, inventory, treasury and paid terms survive another
physical return/reentry. The omission control is also saved after firing and
return; its profile remains absent.

An extra unobserved material volume changes real injury without changing the
public projectile sequence, endpoints, duration or camera focus. A separate
same-injury control changes actual body passage, and a private body changes
real shielding; neither can control the public trail. The kinetic-only trail
is a precomputed possible flight in the observed scene. Neutral missing
contacts drain from the last displayed complete state. Actual known injury
appears at its admitted contact before the next projected segment. Unknown
bodies get no hit cue. Raw profiles, force, private IDs and trajectory models
do not enter the public shot event. Legacy omitted-profile presentation keeps
its prior branch and existing event interface.

The initial native privacy failure and later actual-passage scheduling failure
were retained. The first scheduling prototype restored private equality but
put real injury after the projected tail; the fixed schedule now admits the
injury at contact before draining the same public continuation. No equality
assertion was weakened. A real combat-AP reload shortfall and an ignition
failure were also retained and handled with ordinary return/reload/reprime
orders, without stock, health, condition or RNG resets.

## Final validation

The first complete short run finished all 707 selected files with
`complete: true`: 4882/4930 checks passed, 48 failed, and no checks were
cancelled, skipped or marked todo. Its log and report were retained. Forty-four
failures came from a returned-artillery test helper firing outside the actual
retained front arc. An ordinary paid pivot toward the already selected empty
point fixes that setup; victory, load, reserve, custody and save assertions stay
intact. Its four-file affected check passed 31/31.

The other four failures came from the older declared clinical route. The new
native profile changed its actual wounds and hostile critical state, so the
same sequence no longer earned the prior fear checkpoint. That failed route
was retained. No health, morale, RNG or outcome was rewritten. The two clinical
fixtures now explicitly pin the original Brown Bess primary
and alternative profile omissions before campaign creation. Official restored
package and selected-load assertions prove that boundary. All original paid
injury, fear, care, capture, contract, finite-custody and replay assertions stay.
The five-file clinical/native acceptance check passed 19/19. The separate
kinetic acceptance still uses the fresh explicit native profiles. All 18
previously failing files then passed 88/88 checks without removing assertions
or adding exclusions.

The corrected complete short run passed **4930/4930 checks**. All **707/707**
selected files finished in 341.37 seconds with `complete: true`, zero failures,
cancellations, skips or todos, and no name filters. The eight established
extended files remain separate from the 715-file full partition. The final
18-file feature gate passed 221/221; the corrected consumer gate passed 88/88.
All test processes are terminal. The failed complete run remains part of this
record; no test was removed or excluded to obtain the passing result.

Typecheck and production export **58c55f739507** passed. The export contains
1133 files and 1033 verified asset references. The current runtime digest is
`58c55f739507450925096611e87d8d75dc0eb4da7b1b11531cbe59210455daa8`.
All 883 test and support inputs retained the frozen digest
`636c418af40c39464b996e62dcc7e0f8759997e7ba042d56165e2cb86182dae3`
through the corrected complete run. Documentation and baseline audits, local
link checks, five shard self-tests, complete 715-file shard coverage,
quick/extended partition checks and whitespace checks passed on the final
candidate. The only post-run edits record these results and update the V11
scope; runtime and test inputs remain unchanged.

This is bounded physical-fire, authoring, custody and saved-replay evidence.
Extended campaign simulations and live player-browser acceptance were not
repeated. It does not prove SI spatial calibration, measured period wound or
material behavior, air drag, fragmentation, full-video parity or a complete
stock-campaign ending. Cannon, renderer and 3D files were not changed.
