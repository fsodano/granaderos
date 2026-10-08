# Long cloth on the current native prone pose

The friar habit and woman's long skirt used a corrective shape fitted to an older leg pose. On current main #255, the six appearance/LOD checks fail the existing 330 mm prone hem height limit. The same six measurements reproduce with the previous ActorRuntime `17d95273`; this is not a new standing-contact regression.

| Appearance | Original prone hem top, LOD 0 / 1 / 2 | Corrected native armed pose, LOD 0 / 1 / 2 |
| --- | --- | --- |
| Friar | 360.245 / 357.392 / 360.719 mm | 314.637 / 312.637 / 322.108 mm |
| Woman with shawl | 355.181 / 355.441 / 355.694 mm | 317.475 / 315.488 / 305.305 mm |

Source commit `72d967aa` changes only six published bodies and their manifest records, the reproducible fitting tools, library build registration, regression checks and source documentation. It fits 741 existing prone position offsets and updates normals on 908 vertices adjacent to changed triangles. The post-pack preservation check compares every other decoded attribute, index, morph, skin, node, texture/material record and animation channel against the original body. Those values remain exact. ActorRuntime, equipment, native banks and the locomotion profile are unchanged. All targets remain sparse; the six body files grow by 812 bytes in total.

The fit uses the actual runtime's `prone.idle.long-gun` and its weighted skin transforms. It caps the raised hem smoothly while retaining horizontal placement. Its manifest record contains that exact semantic clip hash. A repeated run changes no body or manifest. A changed native pose rejects a second nonlinear correction; regenerate the authored long-cloth bodies first. A full library build runs this correction after native pose support. Partial builds retain a reviewed cloth record if that exact body was not rebuilt and its hash still matches.

## Local validation

- 29 affected checks pass in 5.45 seconds: long cloth, clothing wear, prone arm support and normal sandbox fixtures. The ten cloth checks include the existing height/floor/crawl/transition/replacement bounds, finite unit shading normals, repeated fitting and stale-pose rejection. Existing limits are unchanged.
- A read-only movement probe covers 84 cases: two appearances, three LODs and fourteen standing, crouched, prone, armed, crawling and interaction states. The 36 standing/crouched cases remain numerically exact. None of the selected cloth hem vertices cross the floor; the minimum is 11.453 mm. Crawling retains its existing 370 mm height bound. This sample set is not every animation.
- Native library verification, locomotion calibration, TypeScript, documentation audit, 38 baseline checks and diff checks pass. Production export `6c525c747e9f` verifies 1,244 files and 1,039 asset references.
- Before and final sparse-asset browser runs each cover six normal HUD states: standing, crouched and prone for both appearances. All eight actors load. No game-state injection or private renderer access is used. Source and served body/manifest/bank hashes remain exact through the final run; browser errors are empty. The final capture commit is `72d967aa`.

The screenshots are compared with the current civilian sprite atlas and the retained supplied references. The change lowers the prone rear hem and retains the standing/crouched silhouette. It does not add an outfit, change period clothing, or establish complete cloth/boot collision clearance. That geometry check and remaining upper-body interaction contact work are still open.

Local evidence is in `artifacts/three-long-garment-current-review/`: original body/manifest copies, the original six failing results, baseline and corrected 84-case surfaces, packing receipts, rejected development/test runs, repeat results, build/check logs, and before/final sparse HUD captures. The earlier dense candidate captures are retained separately; final acceptance uses the sparse assets. The verification documentation commit adds no runtime or asset changes after the recorded source commit.
