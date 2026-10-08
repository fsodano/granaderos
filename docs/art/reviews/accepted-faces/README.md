# Accepted faces, October 8

This delivery transfers the accepted head, neck, eye, brow and hair surfaces onto main's current bodies. It does not transfer the older mixed draft's hands, hats, clothing, rig or motion banks.

The source package is under `assets/source/characters-3d/authoring/vendor/reviewed-faces`. Its content hashes and source rights are part of that package. The compositor runs only for appearance exports. The two screenshots show the actual local browser preview, not generated concept art.

- `acceptance-summary.json` and `final-preservation-proof.json`: final 24-body replay, source identities and preservation checks.
- `source-integration-receipt.json`: source package, seven regression checks and two actual byte-exact Blender rebuilds.
- `independent-body-boundary-preservation.json` and `independent-hand-preservation.json`: independent comparison before the final metadata-only provenance refresh. The hand check covers 69,266 drawn triangles.
- `cloth-provenance-refresh.json`: four coarse friar/shawl donor references updated after face composition. Only the donor hash in GLB metadata and body records changes; binary geometry, materials and completed hem records are exact. The existing pipeline idempotence test passes.
- `neck-boundary-proof.json` and `posed-neck-proof.json`: lower-neck changes are bounded to 0.201 mm at rest and 0.447 mm in sampled poses. The large military collar opening also exists on main and remains separate clothing work.

The receipts retain local paths as evidence of the recorded review. Their source base was 724a9c72. Subsequent main animation-bank updates are retained when this focused change is integrated; they do not replace any of the 24 reviewed body files.

Local checks: 99 facial-surface, eye, palette and actor-runtime checks; 27 lab checks; 15 pipeline/source checks (including the seven source checks); and three actual pistol-face clearance checks pass. Typecheck, native library verification, locomotion-profile freshness and the production build pass. These checks do not certify all animation contacts or crowd performance.
