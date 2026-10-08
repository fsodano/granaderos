# Supported sideways entry, stop and crouched unarmed loops

The native sideways loops had a separate start and stop defect. The ordinary 120 ms idle blend put complete boots below the floor by up to 8.017 mm while standing and 47.193 mm while crouched. This cut adds a bounded visual transition and repairs the four crouched unarmed source clips. Saved cells, facing, movement cost and distance-driven pace remain unchanged.

## Native source scope

Only `crouch.strafeLeft.unarmed` and `crouch.strafeRight.unarmed` change in each anatomy. The transplant replaces eight thigh, calf, foot and ball rotation channels per clip. All 332 other clips and 302 selected non-leg channels per anatomy remain exact. This includes the released rifle idle/strike guard, lance idle, standing sideways loops, climbing, loading and prone support. The complete rig, mesh, skin, native lengths, offsets/scales, Root, pelvis and upper channels remain exact.

Actual stored periods remain 1.600000023841858 s left and 1.3666666746139526 s right. The older nominal manifest fields remain 1.61666 s and 1.399994 s. Pace remains male .7564/.8492 m/s and female .9402/.9318 m/s. The profile is unchanged. Manifest changes are four `nativeSidewaysSupport` records plus the two bank byte/hash pairs. Authoring fits the selected leg rotations at 60 Hz against the retained 30 Hz parent trajectory and reapplies only those channels after the existing rifle guard build pass.

## Visual transition scope

`NativeGaitTransitionSupport` admits same-posture idle to supported sideways travel and its return to idle. It reads the current native idle and loop endpoints, including the released rifle and lance guards. The opposite foot remains planted while the other foot recovers. Stop lasts .8 s: first landing at .3 s, opposite foot return by .6 s, exact native idle by .8 s. The measured zero-phase entry interval is .792–.808 s standing and .408–.826 s crouched. A held source phase restores native transforms before the next mixer evaluation. Changed floor or unsupported reach returns to finite native playback without stretching.

The consumer changes six leg rotations and an explicit temporary native Root Y curve. Standing entry can settle the native body by at most 50 mm, then restores it continuously before ordinary native playback. The upper body and held equipment move with that temporary vertical settle; their native rotations and local socket bindings stay exact. Saved wrapper position/yaw, native offsets/scales and published Root channels remain exact. The measured crouched routes need no vertical settle. Source forecasts have a bounded intrinsic cache; actor world targets and fitted poses are not cached.

## Local verification and integration

The publication copy uses main `0e14d1c` plus the physical rifle runtime input SHA256 `75d8271d668f4010bf8e7155fbe75db329fb6cee776570af7f7d6f5e2d173465`. Seven gait hooks preserve the physical rifle selector and the upright yaw reset exactly. The composed runtime SHA256 is `17d952734d6fca1c9eca06a45b565576e3409f17a402e806db9ed132c0049ad8`; the melee helper and presentation dependency stay unchanged.

The composed copy passes 129 focused source/gait/runtime/seat checks in 22.04 s and 15 physical rifle, paid-facing and scene-order checks in 36.07 s. Native assets, locomotion profile, type checks and four authoring source compilations pass. The runtime tests cover both anatomies, six standing equipment categories, crouched unarmed travel, both directions, first visible movement frames at 0/16.7/33.3 ms, held phases, unsupported reach and changed floors. They sample complete boots during two-cell travel and assert floor contact, planted speed, recovery speed, continuous native release, exact native dimensions, wrapper placement and unchanged upper rotations.

The frozen 120 Hz proof measured complete-boot floor clearance of at least .960 mm standing and 1.126 mm crouched. Planted horizontal speed was at most .098 mm/s standing and .015 mm/s crouched. Recovery/release maxima were 3.735/.846 m/s standing and 5.866/1.846 m/s crouched. LOD 1 and 2 checks also passed for unarmed/rifle standing and unarmed crouched routes. These measurements use the identical published bank outputs and identical transition helper. Fresh combined-copy checks use those actual banks.

Reproduce the focused gait checks with:

```sh
node --test tests/characters-crouched-sideways-support.test.mjs tests/three-gait-transition-support.test.mjs tests/three-actor-runtime.test.mjs tests/characters-seat-transition.test.mjs
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
npm run typecheck
```

## Measured cost and limits

A fresh composed CPU run uses 20 alternating male/female LOD 0 actors, all synchronized, five 6 s cycles at 60 Hz, actual `ActorRuntime.update` and `tick`, no GPU or decoding. Standing active median/p95 is .934/1.348 ms; crouched is .767/1.078 ms. Added active medians are .708/.566 ms. Idle medians are .214/.159 ms versus .215/.173 ms without gait fitting; these differences are normal run noise. The cold standing first transition takes 19.122 ms for all 20 actors; the remaining starts take 1.961–2.603 ms. Crouched start/stop maximum is 4.035 ms. First-fit and sustained cost are recorded separately.

The earlier rendered owned-rifle route measured 60.0 FPS with five loaded/three active LOD 1 actors. It does not prove 100-actor performance. The frozen 100 synchronized LOD 0 crouched workload reached 17.95 ms p95 CPU work before GPU. This cut does not claim 100-actor 60 FPS, unrelated gesture blend support, or support for the unchanged equipped crouched sideways loops.

## Integrated normal movement review

The parent applies the nine text changes with exact source pins and the four-crouch named transplant to current main, retaining the scalar rifle helper. All twelve selected outputs match the frozen composed publication byte for byte. The fresh 132-check source/gait/runtime/seat/paid-rifle/scene gate passes in 22.17 seconds. Native asset, unchanged profile, Python source, type, documentation and all 38 baseline checks pass. Initial static export is `d4ee76f572f0`.

Eight normal browser routes pass in 192 captures without errors on source `ab66804c71afb2817a2e90f6698119149166cc15`: both directions for standing owned-rifle travel and crouched unarmed travel, for both bodies. Standing setup retains the owned Brown Bess. Crouched setup uses ordinary inventory controls to stow it in an available large pocket, then selects the crouched posture. Normal Alt+Enter movement saves C5/G5 for Marcha, F5/J5 for Carrera, I5/M5 for Agachado and O5/S5 for Arrastre femenino. Selected entry, travel and stop poses were compared with the current walking/stance reference sheets. Floor and speed acceptance also uses the independent complete-boot checks.

Publication source `efbd4b97efab9f057a55e60e8d6efaaefafa5c68` includes the barracks correction from PR #243 and retains every captured source/helper/actor/native/profile hash byte for byte. Its type check and static export `934caef41466` pass. `artifacts/three-supported-sideways-cut-review/` records the named channel proof, actual capture source and publication bridge. Equipped crouched sideways loops and broader body/performance polish remain open.
