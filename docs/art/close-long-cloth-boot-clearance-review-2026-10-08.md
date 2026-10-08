# Close long garments and boot clearance

The detailed friar habit and woman's long skirt crossed the complete boot surfaces in supported native prone poses. A third additive corrective shape now clears those crossings. The original rest mesh, rig, skin weights, two cloth targets, materials and textures remain exact after packing. Standing and crouching retain their authored shapes; settled crawling uses its original prone target without the added correction.

| Detailed body | Changed position vertices | Largest world displacement | Largest added shape offset | Body growth |
| --- | ---: | ---: | ---: | ---: |
| Friar | 100 | 121.631 mm | 108.532 mm | 6,148 bytes |
| Woman with shawl | 83 | 87.989 mm | 86.607 mm | 5,636 bytes |

The source pass fits the current native weighted skin. It admits only clips whose complete lower-body tracks match the supported fixed pose within the recorded tolerance. Each body records the exact source pose and compatible clip-set hashes. Repeated fitting changes no asset. A changed support set is rejected before a proposal or published asset is written.

The actor applies the added shape using actual scheduled native action weights, including a paid action held with `timeScale = 0`. It uses the existing native fade when leaving the supported pose. Mirrored clips and moving lower-body clips are excluded. The original cloth targets and animation banks remain unchanged.

## Reachable detail in normal gameplay

The previous 160-pixel close-model threshold could not be reached at the normal maximum camera zoom. The shared character thresholds are now 120 and 65 projected pixels. The normal camera selects LOD 2, 1 and 0 at zoom 1, 2 and 3 respectively. A camera regression checks this at mobile, tablet and desktop widths. The renderer exposes pending actor replacements so browser checks can wait for the actual selected body, rather than photographing the previous LOD during rebinding.

An existing climbing projection test assumed a linear midpoint that differs from the current physical rung motion. Its replacement checks actual geometry-scaled height, matched ascending/descending midpoints, valid vertical bounds and both endpoints. No climbing runtime changes are included. The original failing result is retained.

## Local validation

- All 91 admitted native clips pass complete garment/full-boot triangle crossing checks at start, midpoint and end. The check uses actual weighted surfaces in both directions. Combined corrective normals remain finite and unit length.
- All 28 current garment, projection, prone pistol and held-clock checks pass in 21.34 seconds. Five final close-garment checks pass in 7.06 seconds, including repeat fitting, stale-set rejection and actual paid action/fade behavior. Earlier affected actor, worker, seat and posture checks also pass.
- TypeScript, native library verification, locomotion calibration, documentation and all 38 baseline checks pass. Production export `52b1e1a21f9b` verifies 1,245 files and 1,040 asset references.
- Twelve final normal HUD views cover both appearances in standing, crouched and prone postures, with three additional prone camera directions each. All use loaded LOD 0 bodies, retain the eight actors and paid/owned states, and have no browser errors. Ten source/model hashes are exact before and after capture at source commit `ab585e98`; served body, bank and manifest hashes match. Earlier captures that still used LOD 1 are retained as limited evidence.

The review uses the current civilian sprite atlas and retained supplied references. The bounded shape repairs visible boot penetration without changing the period costume. Surface crossing checks do not establish enclosed-volume separation, coplanar contact, garment self-collision or clearance in every motion. Coarse LOD 1/2 garments, standing/crouched boot crossings, crawling and moving/mirrored poses still require work. The higher normal camera detail also requires broader graphics performance review. This change does not establish final art polish or 60 FPS.

Local evidence is in `artifacts/three-long-cloth-boot-clearance-review/`: original source copies, rejected broad and filtered fits, complete-surface measurements, packing and repeat receipts, current checks/export, retained failed test runs and before/final normal HUD captures. Final publication adds only the last validation helper/test cleanup and documentation after the captured runtime/assets; its source bridge retains all tested runtime and model hashes.
