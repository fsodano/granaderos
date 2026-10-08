# Character source jobs: private outputs before release

Selected source workers now write to one fresh private job directory. The builder
waits for every worker, validates the requested receipts and referenced textures,
and checks and serializes the prospective manifest before it installs any
released content.
This closes the worker/receipt failure boundary documented in the preceding
record-preservation change.

## Source scope

The basis is main `c96ed32bd3f3f20250a491959343fec2891553f7`, which contains
PR #272. This separate source-only change modifies the library builder, its
manifest helper and the Blender worker. It adds a private job install helper,
focused tests and this review. It retains the preceding validation document.
No released GLB, atlas, manifest, profile, runtime, cue, cost or gameplay state
is changed by this source cut.

Every selected worker receives explicit `--output-dir` and `--metadata-dir`
arguments. GLBs and extracted atlas files go to the private asset directory;
receipts, logs and optional preview images go to private metadata. The default
source output directories are created only after these paths are selected.
The builder prints the private job path for inspection. Failed jobs retain it;
successful jobs without previews remove it after installation. With `--review`,
the private previews remain at the printed metadata path.

The worker prints its final `ASSET_READY` marker after optional preview rendering.
This matters because Blender can return zero after a Python error: an export
marker printed before a failed preview must not count as full worker completion.

## Checks before any installation

Duplicate requested output names are rejected before launch. Every worker must
finish successfully with the final marker. Only exact requested receipts are
read. Their public URL, kind, preset, LOD, byte count and SHA-256 must match.
The staged GLB header and JSON chunk are checked; actual triangle and draw counts
must match the receipt. Non-finite JSON constants and numeric overflow are rejected in receipts and
staged GLB documents. The final prospective manifest must also pass the exact
Node canonical JSON serialization before installation, with identical decoded
values. This also rejects a source integer that JavaScript would silently round.

External texture paths must be content-addressed PNG/JPG names inside the private
`textures` directory. Their actual bytes must match the filename hash. Missing,
changed or unsafe paths are rejected. No unrelated private output, receipt, log
or preview is installed.

The prospective complete manifest uses staged paths only for selected GLBs. All
untouched released assets must still match their retained records. Both complete
animation records, support fields and final mounted anchors remain authoritative.
The released manifest bytes and selected released GLB hashes are checked again
before installation. A changed selected file or a conflicting existing texture
name rejects the batch before any writes.

The installer adds referenced textures first, then replaces selected GLBs using
atomic file replacement. It keeps existing texture files and preserves selected
file permissions. The builder writes the checked manifest afterward. The reviewed
native support and ordered cloth/palette/hem passes then run as before.

## Local proof

Six staging tests include the actual builder command with controlled workers,
without Blender. The worker fixture writes a genuinely different valid GLB into
the private path. It then covers one failed worker among three, zero exit without
the final marker, a bad receipt, corrupt private texture bytes and non-finite
receipt coordinates and a coordinate that JavaScript would silently round. In all six
cases the entire released model/texture tree, both banks and manifest remain
exact. No source `.build` cache is created by those commands.

Other checks cover a valid prospective manifest and install, unrelated output
exclusion, incorrect geometry counts, missing/changed/unsafe texture resources,
selected-file changes, texture name collisions, an alternate public URL and a
changed untouched bank. These are controlled fixtures, not fresh Blender exports.

The eight preceding manifest/material pipeline checks and 16 existing palette,
hem and coarse full-surface checks also pass. An actual current-library
`--manifest-only` repeat retains all 106 pinned model/texture/manifest/profile
files exactly. Python source compilation, the native verifier and profile check
remain part of the local gate.

Run from the repository root:

```sh
node --test tests/characters-library-job-staging.test.mjs tests/characters-library-pipeline.test.mjs tests/three-woman-shawl-palette.test.mjs tests/three-woman-shawl-hem.test.mjs tests/three-coarse-long-cloth-boot-clearance.test.mjs
python3 -m py_compile tools/characters-3d/library_jobs.py tools/characters-3d/library_manifest.py tools/characters-3d/build-library.py assets/source/characters-3d/authoring/build.py
python3 tools/characters-3d/build-library.py --manifest-only
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
```

## Remaining boundary

This isolates worker, receipt and pre-install validation failures. It is not a
transaction over several atomic replacements, the manifest write and all later
postpasses. An installation I/O failure or a later support/cloth pass failure can
still leave partial released changes. Such failures must be checked before a
source rebuild is published.

A targeted fresh woman-shawl Blender export remains a separate reproduction
check. No full library rebuild or complete source-reproduction claim is made in
this source-only increment.

## Independent integration validation

On main `a4fe7335799feea325acae7eb8dff4606454c92e`, implementation commit `0b31125a08736869d80afc8c0a3f09bde9de6cc0` passes all 30 affected checks in 19.83 s. The actual controlled-builder failures and their entire released-tree assertions pass in that run. Python compilation, the native verifier, profile consistency, documentation and all 38 baseline checks pass.

The installed builder's current `--manifest-only` command runs the ordered postpasses and retains all 106 released model, texture, manifest and profile files exactly, with no new files. All six installed source hashes and the preceding published validation appendix, palette/coarse helpers and pipeline test remain exact before the publication appendix.

The application and released assets are unchanged from the palace implementation whose production build and browser review passed. This source-only change does not claim a new rendered-model or Blender-export acceptance. The publication commit changes only this review text after the checked implementation. Later installation and postpass failures remain outside the transaction, as stated above.
