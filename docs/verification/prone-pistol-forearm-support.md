# Prone pistol free-arm and loading fade support

Three prone pistol guards had a free palm below the floor. Copy only the
certified left upper-arm, forearm and hand rotations from native prone unarmed
idle into `prone.idle.short-gun`, `prone.aim.short-gun` and
`prone.fire.short-gun`. Idle uses the retained breathing arm samples; aim and
fire retain their static input times. The right grip, Root, pelvis, spine,
legs, fingers, dimensions, periods and markers retain their own source data.

The source change exposes a 12.36 mm sleeve dip during an ordinary reload
return. Mirrored loading also has an inherited mixed-weight cuff dip. A small
runtime elbow-circle fit keeps the native world wrist and grip orientation
fixed while clearing the complete weighted upper-arm, forearm, hand and
finger skin. The fit uses the visible native skins and current morph weights,
including sleeves with mixed upper-arm/forearm weights. It restores its
rotations before the next mixer evaluation. Reload keeps a continuous 65 mrad
bend between working pulls, then returns to the exact native endpoint. A
nearest-safe-arc search stays within 0.72 rad and rejects unsupported reach.
No saved placement, action points, paid clocks or item ownership changes.

## Checks

- 36 native source cases: both anatomies, three LODs, three guards, single and
  paired owned pistols, 121 phase samples. Hands clear the floor by at least
  1.702 mm; forearms clear by at least 1.980 mm. The free forearm supports each
  guard throughout breathing. Held pistols clear the floor by at least 15 mm.
- 36 real paid presentation routes cover single/paired aim, fire and reload.
  Complete arm skin clears by at least 1.500 mm. Maximum world wrist change is
  0.093 micrometres; maximum item-matrix element change is 0.126 micrometres.
  Root, wrapper, all native offsets/scales and non-arm rotations stay exact.
  The visual elbow return finishes by 183.4 ms in the sampled male loading
  route and by 133.4 ms in the female route; the paid clock stays exact.
- The 480/960 Hz paired male reload checks give maximum elbow speed
  4.098/4.105 m/s versus 3.920 m/s native. The 36 ordinary 60 Hz routes keep the
  original overall 4.784 m/s maximum. The finer samples converge; the earlier
  branch-switch candidate was rejected.
- Held-phase repetition, degenerate reach, unsupported admission and
  nonfinite time checks pass. The three focused tests pass in 25.28 seconds.
  Native asset, locomotion profile and TypeScript checks pass.
- Four final ordinary UI routes use the prone weapon selector and Shift+R:
  male/female single and paired loading. All retain saved N5/Q5 placement and
  report no browser errors. Same-camera before/after idle, entry, work,
  hand-transfer, return and completion captures are in the review receipt.
- Defined CPU workload: 20 LOD1 native actors require a held loading-return
  fit; 160 warmed samples include helper and zero-time native mixer. Mean
  2.664 ms, p95 3.263 ms, maximum 4.121 ms. Inactive 20-actor mean is 0.0028 ms.
  First male/female template preparation costs 11.77/9.10 ms; later actors
  reuse immutable skin templates. This is CPU evidence, not a rendered FPS
  claim.

## Exact preservation and integration

Per bank, nine left rotation outputs change. Three idle input curves and their STEP-to-LINEAR interpolation change
explicitly to the supported native breathing samples. All 468 other selected
channels and all 331 other clips retain exact input/output float bytes and
interpolation. Native geometry, skin, rig, offsets and scales are exact. All
actual GLTF periods and existing metadata clocks/markers are exact. The
manifest changes only six new support records and four bank byte/hash values;
the locomotion profile is unchanged.

Use the current-bank installer in the frozen receipt. It adds the new helper,
three focused tests and review file, inserts one full-library postpass and
seven runtime hooks, then runs the guarded named source builder. It never
copies stale banks, the manifest, the runtime or the full library builder.
Keep existing gait, seven gesture, climb, melee, physical rifle, readiness and
cloth changes. An unrecognized prior left-arm pose causes a guarded failure.

## Remaining body work

This cut clears surfaces and retains real gun contact. It does not claim a
fully supported dual-pistol firing or loading pose: paired firing can lift
both forearms about 109 mm, and loading lifts them 243–245 mm. At the retained
world wrists, native limb reach prevents planting the holding elbow. A later
source hand-path/support-transfer change must solve that body mechanic while
retaining the admitted shot, muzzle, ramrod and owned-item timing. Rifle work,
interaction arms and actual adjacent-patient healing contact remain separate.

## Public paired review route

The current `Armas cuerpo a tierra` selector includes `Recargar dos pistolas`.
Both anatomies own an empty primary 1805 and an empty offhand 1806, with stable
instance IDs and eight real cartridges. Ordinary reload leaves one charge in
each pistol, six reserve cartridges and 10 internal AP. The existing single
case leaves one charge, seven cartridges and 52 internal AP. Both keep their
prone cells and use the same paid command and animation presentation as the
campaign. The fixture gate independently checks finite ammunition,
serialization, AP payment and owned identities; no private renderer pose is
needed to reach this route.

## Current integration evidence

Source commit `d2af80a5` passes all three focused tests in 21.785 seconds,
117 affected worker/runtime/clock/native/prone/garment checks in 20.562 seconds,
and 11 public-fixture checks. Native library, locomotion profile, TypeScript,
documentation and all 38 baseline checks pass. Production export `92763e4ceb02`
verifies 1,245 files and 1,040 asset references.

Four independent current HUD routes pass in 36 captures: male/female single
and paired loading through the public selector, normal inventory/camera and
Shift+R. They retain N5/Q5, prone posture, the exact 52/10 internal AP and
seven/six reserve cartridges, and one loaded charge in every owned pistol.
Browser errors are empty; thirteen implementation/model hashes stay exact
before and after capture, and served models match local bytes. Later review
updates change no tested implementation or assets. Local receipts are under
`artifacts/three-prone-pistol-current-review/`.
