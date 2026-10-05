# Range-dependent material penetration — 2026-10-04

This checkpoint adds optional `materialRangeSlope` to an authored firearm and
to each of its alternative loads. Each value must be finite and between zero
and one. A missing value is neutral. An alternative with no value does not
inherit the primary load's value. Newly created default content explicitly
sets 0.25 for native handheld firearms and their existing alternatives. Older
pinned content and plain legacy campaigns receive no automatic update.

The weapon editor names this setting **Pérdida de penetración por distancia**.
It explains that distance increases material resistance beyond the selected
load's own range. The setting is Granaderos tuning, not measured speed, an SI
energy model, or an exact Jagged Alliance 2 formula.

## Physical rule

At each merged material span's entry, the force loss per crossed game unit is
multiplied by:

`1 + materialRangeSlope × max(0, cumulativeHorizontalDistance / selectedRange − 1)`

The factor stays fixed while the ray crosses that span. Progressive loss still
uses the actual three-dimensional crossed length. A body inside the material
receives force remaining at its own physical contact. Exhaustion stops the ray
at the exact point inside material. Distinct overlapping volumes add their
losses. A wide object does not pay a second time at each cell boundary.

A reflection uses cumulative travel from the original discharge. If it occurs
while the ball remains inside material, that material retains its original
entry factor across the reflection. A real exit and later reentry obtains a
new factor. That bookkeeping is transient; it adds no save or shot-event field.
Each pellet spends only its existing finite share of the load's force.

This rule does not change free-flight force, range, gravity, material geometry,
body resistance, stone reflection retention, AP, or ammunition. It adds no
random draws. Existing injury and passage decisions use the remaining force,
so different physical contacts or conditional passage flow can change the
downstream seed. Identical RNG ordering is proved only by the equal-contact
controls. Results may change when opted-in material loss changes.

## Primary-source boundary

The [classic source resistance adjustment](https://github.com/dariusk/ja2/blob/876ccf5dfdad7e6821c5b26d6d783132ea1ab7a2/ja2/Build/Tactical/LOS.c#L2222-L2234)
and [Stracciatella resistance adjustment](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/c527753eb635216c21bfcbeb058b6ed86823072a/src/game/Tactical/LOS.cc#L2126-L2137)
support a range-dependent structure-resistance design. Granaderos uses its
existing depth model and applies the new factor only beyond the selected
range. The classic calculation also adjusts shorter distances; its exact
formula is not copied here. These sources do not establish projectile mass or
measured velocity for Granaderos weapons. The weapons' existing weight is
carried equipment weight and is not used as projectile mass.

## Acceptance evidence

The existing geometry tests now cover within-range neutrality, distant entry,
an embedded body, exact exhaustion, oblique depth, distinct overlaps, frozen
material at a reflection, real exit/reentry, and nine finite pellet shares.
Schema tests reject malformed values and blades, preserve omitted fields,
and reject altered pinned weapon metadata in official saves. The actual editor
controls preserve separate primary and alternative values through validation,
undo, launched paid service, load selection, reload and saved state.

The paid acceptance starts two otherwise identical campaigns from explicitly
authored content. The control omits the field before campaign creation. Both
pay native 107 and 110 weekly prices of 588 and 420 pesos and wait for their
actual six-hour arrivals. Treasury is 2192. The flat Buenos Aires firing arena,
dry weather, passive hostile posts, material and representative seed 8 are
declared before its first official save. This is an encounter proof, not a
fresh conquest or full historical campaign proof.

The native pistol has selected range eight and force 42. Material begins at
horizontal distance 12.5. The opted-in shot reaches the observed target with
force 14.618715644804919; the omission control reaches it with
17.994490428322123. Actual target HP becomes 87 and 83 respectively. Each
real shot costs 19 AP, six seconds and one charge, and changes condition from
100 to 99. Native soldiers retain 72 and 85 HP. Their original ten charges
become nine and ten. Four ordinary actions complete the shot and physical
retreat. Treasury and paid contract terms remain unchanged.

An unrevealed extra material volume reduces the actual injury but leaves the
complete initial public flight, endpoint, duration and camera focus equal.
The forecast omits that private material. It exposes no raw object ID or
trajectory model. Full ordinary/presented states match, all actions replay
through official saves, and return/reentry preserve exact equipment, health,
hostile injuries and actual deaths. No execution step grants stock or health.

## Frozen validation

The physics, content, load and editor gate passed 208/208 checks in 14 files.
The affected care and primary-family gate passed 97/97 checks in 20 files.
The final complete short suite passed 4900/4900 checks, with 702/702 selected
files finished and `complete: true`, in 353.071 seconds. It had zero failures,
cancellations, skips or todos. The verified partition has 710 total test files;
its eight extended campaign/artwork files were not part of this short gate.

The first complete run finished all 702 files but failed 42 setup checks:
41 failed because the copied training gun retained an alternative with the
newly selected primary family; one primary-family fixture did the same. The
training gun now explicitly declares no alternatives. The primary-family
fixture removes only an alternative equal to its selected primary family.
All wound, outcome, reload, reserve and family assertions remain. The failed
report was retained; the second complete run is the final passing receipt.

Both independent implementation reviews found no blocker. Typecheck, the
documentation and baseline audits, the five shard self-tests, complete
partition coverage, production build and diff checks passed. The static build
verified 1133 files and 1033 asset references. No gameplay, renderer, cannon or
artwork change was made after the build.

Source and build SHA-256:
`413c4b2f70412613f5cf26f39146d20764c9a9c228c5b0c69592fef3caf514b4`.
All 878 test/support paths were frozen at SHA-256
`135fa622776a8b15e83068af03c3a4f1ef3bdbeb2b6f64a9437e24027be139cc`.
Both digests matched before and after the final complete short suite.

## Remaining scope

Other ricochet materials, fragmentation and a supported mass/velocity model
remain open. This checkpoint does not claim historical calibration, exact
classic parity, a full campaign win, or changes to artillery or graphics.
