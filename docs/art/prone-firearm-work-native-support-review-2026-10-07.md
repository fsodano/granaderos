# Prone firearm work: native boot support

The remaining fixed prone firearm work poses put the full weighted boot surface below the floor. Across both native anatomies and all three footwear LODs, the male minimum was −53.188 mm and the female minimum was −47.412 mm. The previously released nine prone rifle aim/fire/loading clips and the supported idle/crawl clips remain unchanged.

This cut corrects 19 named clips in each bank: rifle priming, repair, generic unloading and six owned rifle unloading variants; pistol aim, fire, priming, repair, generic loading/unloading and four owned loading/barrel variants. It copies six static thigh/calf/foot rotation outputs from each equipment category's own supported prone idle. The full weighted boots then remain above the floor. There is no added body lift or runtime contact solver.

The builder checks the native Root and pelvis against the owned idle, checks static lower poses against the measured original or already supported pose, then writes only the named outputs into the current complete banks. It keeps all original input times, interpolation, actual duration, nominal manifest duration, markers, upper-body/hand/item/ball channels, joint offsets and scales. It refuses changed parents, dynamic lower motion, an unaudited lower pose, or concurrent bank/manifest changes. The complete-library builder runs this postpass after the prior nine-clip prone rifle postpass. Manifest output uses Node `JSON.stringify`, as the native profile compiler requires.

Per anatomy, the preservation proof lists 114 changed rotation outputs, 2,907 exact other selected channels and 315 exact unrelated clips. Native meshes, skin weights, rest rig and inverse bind matrices are exact. Manifest changes are only the 19 selected `nativeBootSupport` records and the bank byte/hash values. The locomotion profile, pace, action contract and runtime consumers are unchanged. Current-bank integration also keeps the released rifle guard, lance, prone-nine, bayonet and standing gesture cuts and the released equipped crouch sources.

Validation uses the actual published weighted footwear surfaces, rather than bone pivots. The six native checks sample every selected clip at 121 phases for both anatomies and all three LODs. The real presentation check covers 114 routes through `presentedActBattle`, the actual admitted work ranges, `presentedFrameDuration`, `presentActors` and `ActorRuntime`. These include owned rifle unloading, priming, finite-material repair, three owned pistol models, ordinary aim/fire, an affordable two-hand combat reload and all four pistol bores during exploration. It compares the returned state with `actBattle`, checks one exact combat AP charge, preserves owned instance IDs and total rounds, and checks exact wrapper placement and native offsets/scales.

The real routes have a lowest complete-boot point of 0.963264 mm, both boot contacts within 2.271381 mm, and maximum full-boot speed of 0.018913 mm/s through entry, hand/barrel changes and return. The 0.963 mm male LOD2 minimum is the retained native idle limit; this cut does not claim a new 1 mm clearance. The combat 1805+1806 reload pays 90 AP and plays both owned hands over 9,600 ms. Exploration with two owned 1808 pistols plays all four admitted bores over 19,200 ms and spends no combat AP.

The isolated UI review uses normal selection, Shift+R priming/loading, inventory inspection/unloading and the existing repair control. It covers before/after, both anatomies, rifle priming/unloading and pistol priming/repair/loading: 20 routes, 80 same-camera captures, no browser errors, and retained prone placement. The review fixture changes only finite owned gear, condition, supplies and initial load; it does not add an animation control or alter the normal command flow.

Run the affected checks:

```sh
python3 tools/characters-3d/build-prone-work-support.py
node --test tests/characters-prone-work-support.test.mjs tests/three-prone-work-support.test.mjs tests/characters-rifle-loading.test.mjs tests/characters-pistol-loading.test.mjs tests/unit-motion-clock.test.mjs
node tools/characters-3d/compile-locomotion-profile.mjs --check
python3 tools/characters-3d/verify-library.py
npm run typecheck
```

Scope limit: twelve remaining static prone interactions and the two prone throwing motions still need separate review. A wider native surface audit also found hands and forearms below the floor in several prone interactions and hands below the floor in the retained prone pistol idle. Those upper-body defects are separate from this boot-only source correction and remain open. There is no supported prone brace capability in the current contract. This cut does not certify those actions or all 3D motion as complete.

## Integrated current gameplay review

The named builder was applied to current main after the equipped crouch cut, retaining the standing gesture, bayonet, prior prone-rifle and movement changes. Current-bank preservation confirms 114 changed lower outputs, 2,907 exact other selected channels and 315 unrelated clips per anatomy. The emitted banks are male `a945df6be3b66c51b19bb2ba43556ca46b08605fd8b1abc33711a4efd071ed4c` and female `f62c5e320dc144c48746b154f04e01b9c9f076b068cd6796e048ab700c1f5371`.

The compiled Spanish `Armas cuerpo a tierra` choice exposes the five tasks through a public selector. Every task starts a fresh valid battle with two owned weapons, finite reserve ammunition and repair material. The ordinary paid reducer checks legal initial load/condition, one AP payment, retained weapon identity and cell, conserved total rounds, material consumption and loadable immutable snapshots.

Current source `0c563a75371a49da4f4c0b272978e3effb85bcb7` passes 45 focused native/presentation/loading/clock checks (14.764 s), 14 combined fixture checks (1.126 s), native library/calibration, TypeScript, documentation and 38 baseline checks. Production export `d561cdb30b51` verifies 1,244 files and 1,039 asset references.

The normal compiled-page review passes all 20 before/after routes with 80 same-camera captures. Both anatomies use normal actor selection, Shift+R priming/loading, inventory inspection/unloading and the repair control. Each stays prone in N5 or Q5. No browser error occurs. Nine source/runtime/model hashes stay exact across the capture run; served bank and manifest bytes match the recorded corrected source or explicit baseline asset substitution. No private pose or browser battle state is injected. The rifle priming/unloading and female pistol priming/repair views were inspected against baseline captures, the current prone rifle sprite atlas and the existing female pistol authoring preview. These support the bounded boot correction, not full body or garment acceptance.

The captured source paths are unchanged by the final documentation commit. This publication bridge is recorded alongside the local UI report in `artifacts/three-prone-firearm-work-current-review/`.
