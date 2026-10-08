# Character clothing review — 2026-10-08

The accepted faces are merged in [PR #284](https://github.com/fsodano/granaderos/pull/284). Clothing continues as a separate change. The model review uses actual exported meshes with the current native animation banks, the same isometric camera, and the same light skin palette.

## Military collar and shoulder pads

The original collar was a separate ring with neck-only weights. The coat neckline used different native weights. This produced an open join when the torso moved. The fitted collar shares the reduced coat's neckline and follows the accepted neck surface. Only the neckline seam and its adjacent triangles change in the coat. Ordered collar columns prevent the small folded strips found during the first repair.

The shoulder-pad ellipsoids had inward winding and duplicate vertices at each pole. Welding those poles and correcting their winding removes the dark holes in the top surface. It does not move the surrounding coat, straps, fringe, face or hands. The Granadero LOD0 comparison retains 13,533 exact coat and trim triangles; the two caps change from 400 to 360 triangles.

This is a bounded clothing repair. The inner shoulder-pad edge still intersects the sloped coat. A separate pad-fit experiment is required; lifting the whole assembly or wrapping it down the upper arm did not produce an acceptable result.

The final combined bodies pass 3,084 actual posed samples: 514 per body across ten native clips plus rest, at 30 Hz. All three collar levels keep their full sampled triangle rows. The test detects neck/collar edge crossings; it does not prove minimum positive clearance, wholly contained penetration, crossfade behavior or every paid combat pose. Separate visual checks cover idle, a peak backhand turn, crouch and prone aim. The final exported Granadero and Royalist also load in the lab without browser warnings or errors.

| Character | LOD0 triangles | LOD1 triangles | LOD2 triangles | Draw calls |
|---|---:|---:|---:|---|
| Granadero | 76,666 | 48,454 | 17,915 | 8 / 8 / 7 |
| Royalist | 76,309 | 48,383 | 17,858 | 8 / 8 / 7 |

Faces, hair, hands, rig, textures, other body parts and both motion banks remain exact. Outside the collar/cap regions, the coat positions, UVs, colours and weights remain exact. Joining the seam recomputes normals on 1 / 0 / 9 adjacent triangles at LOD0/1/2. The general builder also repacked four unrelated Friar/Shawl files without changing any drawn data; this focused delivery retains their original main bytes.

- [Before](reviews/military-clothing/granadero-before.png) and [after](reviews/military-clothing/granadero-after.png), same model pose and camera.
- [Royalist after](reviews/military-clothing/royalist-after.png).
- Actual lab views: [Granadero](reviews/military-clothing/lab-granadero.png), [Royalist](reviews/military-clothing/lab-royalist.png).
- [Combined preservation proof](reviews/military-clothing/combined-preservation.json), [sampled collar gate](reviews/military-clothing/collar-clearance.json), [render records](reviews/military-clothing/render-frames.json).

Run the contact gate with `node tools/characters-3d/review-military-collar-clearance.mjs path/to/receipt.json`.

## Validation

The focused checks pass: 27 lab tests, typecheck, all 24 appearances, both 334-clip anatomy banks, 26 equipment models, three horse LODs and the locomotion profile. The production export contains 1,304 files and 1,041 asset references (build `e4176a47c77b`, after synchronizing main `9002e91c`).

The quick suite completes all 870 files with **6,568 passed, 6 failed and 0 skipped** on base `f01916b0`. All six failures reproduce with the same names and assertions on an unchanged archive of that exact baseline, using Node v25.9.0. They concern climb interpolation, a mounted sound cue, chimney placement, tower materials and shop-sign height. The focused baseline reproduction has 23 passed and 6 failed. This is not a green quick suite or a claim about later main. See the [failure evidence](reviews/military-clothing/baseline-test-failures.json).

After synchronizing main `9002e91c`, the two incoming contact/door test files pass all nine tests. The production build above uses that synchronized source.

## Other clothing findings

The wider review sampled six outfits in three poses each: idle at 0.500 s, running at 0.192 s, and pickup at 0.700 s. These 18 frames identify work to do. They do not establish clearance across the full motion library.

| ID | Character | Observed problem | Status |
|---|---|---|---|
| C1 | Friar, woman with shawl | The upper skirt rim separates from the torso during pickup. | Open. A fitted seam reduces the gap, but the Friar rope still floats and lower folds remain stiff. The complete pilot was rejected. |
| C2 | Gaucho | The rear poncho and side strip project like stiff panels during a forward bend. | Open. Free-panel weights and hanging shape need review. |
| C3 | Royalist, Surgeon | Coat tails point upward and end in thin curled tips during pickup. | Open. The collar repair does not change these tails. |
| C4 | Scout | The rear belt/waist edge lifts into an uneven strip during pickup. | Open. The waist attachment needs review. |
| C5 | Friar, woman with shawl | The running hem forms large repeated zigzag folds. | Open. The waist-only pilot does not fix this shape. |
| C6 | Royalist, Surgeon, Scout | Sleeves and torso remain too smooth, with limited cloth compression at the elbows. | Open. Garment volume and larger folds need work before fine surface detail. |
| C7 | Worker | The vest has chest dents, jagged cut edges and shirt contact at the armholes. | In private review. A sewn edge clears the front patches, but underarm contact and garment weights still need verification. |
| C8 | Granadero, Royalist | The inner shoulder-pad edge cuts into the sloped coat. | Open. The outward-normal repair fixes the dark holes only. |

No rejected garment pilot is included in the published body files. The accepted face sources and motion banks are independent of this clothing work.

## Motion coordination

The comparison retains current walking/running and selects individual donor channels only when native anatomy and actual combat contacts both pass. The backhand donor improved the native wrist but missed four of 40 paid target pairs, so it was rejected. The knife-thrust donor is held because it slightly increases an existing diagonal phase jump.

The selected sabre thrust and its narrow prepare/contact continuity repair are merged separately in [PR #286](https://github.com/fsodano/granaderos/pull/286), on main `f01916b0`. The integration agent's [review record](../verification/standing-sabre-thrust-wrist-2026-10-08.md) covers 40 contact pairings and 11,496 paid-clock samples across both anatomies and all three LODs. The clothing branch starts from that merge and preserves both resulting banks. These results do not establish that the complete older motion branch is better.
