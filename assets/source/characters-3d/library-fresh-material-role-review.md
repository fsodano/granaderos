# Selected fresh garment material-role repeat

A real selected woman-shawl LOD0 Blender job exposed a repeat failure after the reviewed source pipeline completed. The fresh donor supplied updated normal and roughness atlas resources. The coarse bodies correctly retained their old inactive donor materials, so each could contain two materials named `Apparel_Atlas_Charcoal_Legwear`. The palette and coarse helpers used name uniqueness as identity. A subsequent manifest-only repeat therefore failed. A separate palette assertion also assumed every old source tile was burgundy, although the current authored skirt is charcoal.

This source-only increment resolves the retained UV0 charcoal material from the active sewn-skirt hem primitive and its complete non-colour surface bindings. Texture links resolve to their image and sampler resources, so equivalent index aliases are accepted. Different colour resources with the same surface remain an error. Old inactive donor provenance is retained; no material, image or texture is renamed or removed.

The pipeline still runs native cloth support, close boot clearance, reviewed coarse topology, palette and sewn hem in that order. A final coarse composition copies the completed donor UV1 and packs the output once. This makes the first completed selected fresh output canonical, so a subsequent full repeat does not change its coarse binary packing. Current released completed outputs remain byte for byte exact.

The palette proof distinguishes the two supported source states. A legacy burgundy source changes only the 32-by-32 legwear tile (1,024 decoded pixels); a fresh authored charcoal source changes no decoded pixels. Every other old atlas pixel stays exact, and the actual shawl still samples burgundy. Surface-map bindings, native dimensions, support limits, clips and gameplay rules are unchanged. Controlled donor fixtures exercise different map bindings while retaining the old inactive material. That fixture is separate from the real Blender job.

## Exact evidence

The first real job, failing repeat, source/output pins and failed test log are retained under `/tmp/granaderos-character-source-fresh-woman-shawl-failure-evidence`. The first failed test and mutating repeat overlapped in that private tree; they are investigation evidence, not independent acceptance. Final asset repeats and tests ran sequentially on stable output.

The corrected selected job ran `build-library.py --only appearance --preset woman-shawl --lod 0 --jobs 1 --review` and completed with exit 0. Its raw worker body has 28,792 triangles and 1,348,204 bytes. The raw Cycles preview precedes the ordered support/palette/hem postpasses and is not evidence for their final geometry or rust stripe. Raw outputs and worker receipt are retained in `/tmp/granaderos-character-source-fresh-woman-shawl-corrected-proof/raw-selected-worker`.

The completed selected job changes only the three woman-shawl bodies, their manifest records and four content-addressed texture files. Both complete bank records, every other appearance, all other released assets and the locomotion profile remain exact. Both banks retain 334 clips and all current anchors/support metadata. Two subsequent full repeats keep all 110 completed files byte for byte exact. The same source change on the unchanged released library keeps all 106 files exact, with no extra files. Receipts are `fresh-output-pins.json` and `legacy-current-repeat.json` in that corrected-proof folder.

All 38 affected material-role, pipeline, selected-worker staging, palette, hem and complete-garment boot checks pass. Native verification, profile verification and Python compilation pass. The tests cover missing or ambiguous active surface links, equivalent texture aliases, fresh coarse donor classification/UV1, every untouched bank record, and the current held/fade cloth support paths.

## Fresh appearance limit

The actual rebuilt body has exact native positions, normals, joints, weights, indices, rig, inverse binds and reviewed cloth targets at all three LODs. Coarse decoded attributes remain exact. LOD0 shawl atlas UVs regroup 1,133 vertices; bilinear samples of its base, normal and roughness maps remain equal at all native vertices. Its generated `COLOR_0` values change: maximum component difference is 0.048824668 and maximum vector difference is 0.084566806. Complete appearance-attribute equality is therefore false. This source-only cut installs no fresh body or texture assets; their normal HUD review is recorded separately.

## Failure boundary

The published selected-worker staging and pre-install receipt/manifest checks remain intact. This increment does not add a whole-pipeline transaction. A later ordered postpass or I/O failure can still occur after a valid selected worker output installs. The first failure remains part of the record. Full-library fresh export, unrelated character changes and general rendering performance are outside this cut.
