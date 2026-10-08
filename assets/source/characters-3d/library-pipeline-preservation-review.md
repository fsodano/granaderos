# Character source pipeline: record preservation and ordered cloth passes

The source builder now keeps every current library record unless an explicit,
checked worker job rebuilt that record. It then applies the reviewed cloth,
palette and hem passes in order. This source-only change writes no released
model, texture, animation bank, gameplay rule, cue or clock.

## Confirmed problem

On main `4ec028f541272ee5579d5c7fa1d4259042b2fec7`, the old
`build-library.py --manifest-only` exited successfully with an empty `.build`
cache but changed the complete library to an incomplete one: 24 appearance LOD
records and two animation bank records became zero records. The manifest hash
changed from `f57f1710b6e6c29b29ca53e9182c29b2b4f97b4e7849c1d57bf87ec8db2412b0`
to a different hash. No model bytes changed in that negative control.

The old builder read every JSON receipt in `.build`. A partial worker run could
therefore use stale triangle counts or overwrite current support and anchor
records. Its limited cloth-field copy did not cover the reviewed coarse topology,
hem, or all animation support data.

## Source boundary

Only receipts for requested jobs are read. Their kind, preset, LOD, output
identity, byte length and SHA-256 must match the actual output. Missing or
duplicate selected LOD records are rejected. An unchanged output retains all its
reviewed fields; a contradictory triangle count is rejected. A changed output
gets its fresh record and must obtain new geometry-specific support in the
following passes. Every untouched appearance, bank, equipment, garment and horse
record remains authoritative.

Retained animation anchors are already in GLTF model space. The source-to-GLTF
conversion runs only for explicitly rebuilt banks. The fixtures compare both
complete bank JSON records and both actual bank file hashes. They retain the
mounted seat fields and current `nativeProneHealArmSupport` data.

After the native animation/support passes, the cloth passes run in this order:

1. Existing long-cloth posture shapes.
2. Close garment boot clearance.
3. Reviewed close garment topology copied to coarse bodies.
4. Charcoal skirt palette, with the burgundy shawl retained.
5. Inset rust hem on the sewn skirt.

The coarse pass copies the donor's hem metadata and its retained charcoal UV0
material/resources. The latter are required when a fresh coarse recipient does
not yet have the inactive reviewed material. The active hem keeps UV1; original
normal and roughness maps keep UV0. Palette guards accept verified legacy
burgundy, raw charcoal, completed charcoal and completed hem states. They reject
an unknown pigment before writing the three body outputs. Completed hem detail
is retained. The final coarse donor SHA refers to the final close body.

## Local proof

Eight new pipeline checks pass. They cover empty/stale caches, wrong receipts,
identical and genuinely different valid GLB receipts, missing/duplicate LODs,
both complete bank records, four palette states, unknown pigment rejection and
a coarse recipient without the required retained UV0 material or hem metadata.
The changed GLB and material-state fixtures are synthetic fixtures; they are not
fresh Blender exports. The coarse fixture runs the actual surface-fitting,
palette and hem tools twice and proves an exact ordered repeat.

Sixteen existing palette, hem and coarse full-surface checks pass. Python source
compilation, the native library verifier and the locomotion profile check pass.
The verifier confirms 24 body LODs, both native anatomies, 334 clips per anatomy,
26 equipment items and three horse LODs.

Three actual current-assets `--manifest-only` repetitions preserve all 106
checked model/texture/manifest/profile files byte for byte. The later repetitions
include an invalid stale receipt with the exact name of a current body; it is
ignored because no worker job was requested. The final candidate assets also
match the exact current main assets.

Current preserved identities:

| File | SHA-256 |
| --- | --- |
| Manifest | `f57f1710b6e6c29b29ca53e9182c29b2b4f97b4e7849c1d57bf87ec8db2412b0` |
| Male animation bank | `49f5d77abe97ae560f46060f93d3fdd31661eda97e47dfdf029216ade2beeb27` |
| Female animation bank | `509a9c2c1ab0cb2a7d38c8f50cb7809cfa9f6c4cc946c69652b6918fdeb1ac10` |
| Locomotion profile | `d3a9d3d1af2468a7a07ccb4d2a422b1d860b2526f9faa25b8b11e8603f8c3431` |

Run from the repository root:

```sh
node --test tests/characters-library-pipeline.test.mjs tests/three-woman-shawl-palette.test.mjs tests/three-woman-shawl-hem.test.mjs tests/three-coarse-long-cloth-boot-clearance.test.mjs
python3 -m py_compile tools/characters-3d/build-library.py tools/characters-3d/library_manifest.py tools/characters-3d/build-woman-shawl-palette.py tools/characters-3d/build-reviewed-long-cloth-lods.py
python3 tools/characters-3d/build-library.py --manifest-only
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
```

## Retained failure boundary and next source check

Selected Blender workers still export directly to the published output directory.
Receipt validation happens afterward. A worker or receipt failure can therefore
leave a changed selected GLB beside the old manifest. The permanent failed-output
fixture proves this boundary; this change does not roll that selected file back.
Likewise, the ordered postpasses are not a transaction over the whole library.

The next bounded change must stage selected worker outputs and receipts in a
private job directory and validate them before installing released output. A
targeted fresh woman-shawl Blender export remains a separate source-reproduction
check. No full fresh library rebuild or transactional rebuild claim is made here.

## Current-main integration check

The guarded six-source-file cut was installed on main `4ec028f5` and committed as `7cd093b9`. All 24 focused checks pass in 15.70 s. Python source compilation, the native library verifier, locomotion profile check, document audit and all 38 baseline checks pass.

Root independently ran the actual installed `--manifest-only` command twice: first with the empty current cache, then with an invalid receipt named `woman-shawl-lod0.json`. Both runs preserve the complete 106-file model/texture/manifest/profile tree exactly, with no added or removed files. The temporary stale fixture was removed. The installed source is exact against the frozen receipt.

The old-main negative control used a separate exact-asset copy and the real old command. It exited zero while dropping all 24 body-LOD and both bank records. Its receipt is retained with the current repeat logs in `artifacts/three-character-source-build-current-review/` and the private frozen package. The current application source, runtime and released asset bytes are unchanged; this cut requires no new visual acceptance claim. This final validation update changes only this review record. The documented direct-output and postpass failure limits remain open for the next staging increment.
