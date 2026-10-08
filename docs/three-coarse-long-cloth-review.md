# Coarse long-cloth topology and boot clearance

The friar habit and the woman with shawl now retain the reviewed close garment topology at body LOD1 and LOD2. The other coarse meshes, native rig, joint dimensions, binds and animation banks stay exact. The coarsest shawl also has a 2 mm inward trouser tuck in the added fixed-prone shape. The runtime, paid rules and existing action clocks do not change.

## Why the coarse topology changed

The old coarse garments had 152–339 complete boot/garment triangle crossings in the fixed prone pose. Some triangles spanned 0.907–0.926 m. The coarsest shawl also had native trouser crossings outside the previous garment-only filter. The current checks use the complete garment and both complete boots.

The failed trials remain in `/tmp/granaderos-long-cloth-lod-review`. Initial local fitting used a 125 mm world bound. A later 150 mm world trial still left 53 crossings, despite a 142.635 mm maximum native offset vector. Component-only trials do not qualify under the vector-length bound. Simple interpolated subdivision needed five skin influences on many faces and produced 26.9–202 mm pose errors. Dropping the fifth influence did not repair it. A two-face edge flip changed a folded seam by up to 159 degrees; it was rejected. None of those trials is published.

The replacement uses authored sewn topology from the already reviewed close garment. It changes the selected garment rest geometry deliberately. Both existing close cloth shapes, the original garment UVs, skin indices/weights, and all other coarse mesh payloads are exact. LOD2 keeps its old atlas for the other parts and adds the matching close garment atlas records; the referenced texture files already exist.

## Geometry and file cost

| Body | Garment triangles before → after | Whole-body triangles before → after | Bytes before → after |
|---|---:|---:|---:|
| Friar LOD1 | 3,983 → 7,700 | 11,891 → 15,608 | 621,420 → 824,936 |
| Friar LOD2 | 1,348 → 7,700 | 4,239 → 10,591 | 272,028 → 609,664 |
| Shawl LOD1 | 1,085 → 3,182 | 12,743 → 14,840 | 654,328 → 774,584 |
| Shawl LOD2 | 404 → 3,182 | 4,886 → 7,664 | 300,188 → 463,312 |

The four files add 824,532 bytes in total. The third shape's largest native offset vector is 126.544 mm for the habit and 90.129 mm for the shawl. Component maxima are 108.532 mm and 86.607 mm. The 48 coarsest-shawl tuck vertices move 2.000 mm in world space; their additional native offset vector is at most 2.333 mm. Duplicate sewn vertices receive equal offsets. The native vector-length limit remains strictly below 150 mm for every shape.

## Validation boundary

The published coarse files pass 546 full-surface checks: 45 friar clips and 46 shawl clips, at start/middle/end, for both coarse LODs. These clips retain fixed native prone lower parents. The actual paid held-action and 120 ms fade weights select the added shape, and settled crawling restores its exact original shape with no added correction. This is a bounded fixed-prone repair; it does not claim complete moving cloth clearance.

The build stages all four candidates and verifies every source pin before publication. A second build leaves all four files byte-identical. The 334 clips per anatomy stay exact, including the seven current rifle metadata records. The basis manifest at `71dd700df356dbbabd2cfc2f5a444205650fb1ab` is byte-identical to main `dfe419502195e94499fdf156e281063e15214d45`. The installer preserves current clock/cue sources and the eight new heal profile entries; it copies no profile or compiler. Male bank: `63fd64af5b31c93c34a63d6548a6de3d124e73a42a374bfb6bd4d92052aa1317`; female bank: `8e5f0f867c177baa762559421be9026c957142345b4bb5d3d15f1225d31792b7`.

Focused checks: 23 garment/clearance tests, native asset verifier, locomotion profile check, and type check. The current-source receipt and independent preservation proof are stored with the frozen cut.

## Normal-view review

The ordinary 100-character scenario was reviewed in one Chrome browser, in baseline/candidate/candidate/baseline order. The baseline serves the exact original four bodies and manifest from `71dd700d`; all other source, bank, equipment and texture responses are the current pinned files. Each route uses normal scenario and camera controls, records every loaded model hash, then visits wide → medium → close → medium → wide.

| View | Active characters | Baseline triangles | Candidate triangles | Draw calls |
|---|---:|---:|---:|---:|
| Wide, LOD2 | 100 | 1,348,248 | 1,457,808 (+8.13%) | 1,543 in both |
| Medium, LOD1 | 54 | 958,213–958,429 | 996,814–997,030 (+about 4.03%) | 581–582 in both |
| Close, LOD0 | 33 | 1,139,179–1,140,733 | 1,139,395–1,140,733 | 355–357 |

The extra wide triangles exactly match 12 habits and 12 shawls at the new coarse topology. Both runs keep all 100 characters loaded with no pending model or console errors. The close files and their geometry remain exact; small close triangle/draw-call variation also occurs in the baseline.

Each settled view was measured for 4.5 seconds. Three unrelated Blender processes were active (about 405%, 374% and 143% CPU at one reading). RAF gaps and long tasks are retained in the reports rather than filtered. Short, loaded-host samples do not establish sustained 60 FPS or isolate a frame-time benefit. The change deliberately pays for more garment triangles to repair source geometry.

The twelve ordinary garment captures show both appearances standing/crouched/prone at actual LOD1 and LOD2, through normal roster, inventory, posture and camera controls. Their loaded model hashes match the saved candidate. They retain the existing garment colours and silhouettes; these coarse screenshots do not replace the complete triangle checks.

The paired timing reports retain three 55–57 ms baseline long tasks and six 55–58 ms candidate long tasks. Baseline p95 gaps range 16.7–33.3 ms, candidate 16.7–16.8 ms; maximum gaps are 83.4 ms and 66.7 ms. The sample is too short and host load too variable to attribute a performance gain.

## Full-body reference limit

The review used the actual full-body sheets `assets/previews/sprite-consistency/friar-1.png` and `woman-shawl-1.png`, plus the current standing/crouched/prone HUD captures. Face and hand skin PNGs are not full-body references. The friar keeps the brown long habit; the woman keeps the red shawl, white sleeves and long skirt. The existing 3D skirt is burgundy while the sprite skirt is dark blue-gray. That palette difference remains visible and is a separate art follow-up. This cut retains the reviewed authored garment colours/materials and repairs coarse topology; it does not establish full supplied-reference parity or complete body polish.
