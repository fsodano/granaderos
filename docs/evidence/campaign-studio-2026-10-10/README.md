# Campaign studio evidence

Started: 10 October 2026. Updated: 11 October 2026. Scope: the active campaign authoring website work,
starting from the engine/package separation implementation. The historical
`0.1` tag remains unchanged.

[Author guide](../../authoring/campaign-studio.md) · [Acceptance plan](../../plans/campaign-studio.md)

## Completed foundation checks

The shared portable project, scaffold, browser file/archive and IndexedDB
modules were committed as `e7c1e986` on the campaign studio work branch. The
commit normalized a trailing blank line in the scaffold source. The check
below ran before that formatting-only cleanup. It does not cover later master
website changes.

```sh
node --test tests/campaign-studio-project.test.mjs tests/campaign-studio-files.test.mjs tests/campaign-studio-storage.test.mjs tests/campaign-authoring.test.mjs
```

Terminal result: **21 passed, 0 failed, 0 skipped**, exit `0`, duration
**3373.458 ms**. No raw terminal log was saved for this run. This paragraph is
a transcribed terminal receipt, not a newly reconstructed raw log.

Covered cases:

- A browser project uses the same complete neutral scaffold as the folder CLI.
- Authored optional data and editor metadata survive controlled edits and
  portable project JSON roundtrip.
- Campaign ID changes rewrite own resource URLs atomically.
- Semantic draft errors remain editable; invalid resource bytes and unsafe
  JSON structures are rejected.
- Actual byte replacement retains resource identity and refreshes SHA-256.
- A browser-produced ZIP extracts to a folder that passes
  `verifyCampaignFolder`, the existing build/CLI validator.
- Stored and deflated ZIPs, directory selections, nested map paths and custom
  manifest document paths preserve the raw documents.
- The installed Granaderos package roundtrips with all **208** declared
  resource files; its compiled definitions equal the folder validator output.
- Import rejects traversal, duplicate names, mixed roots, symlinks, unsupported
  files, false sizes and CRC corruption.
- The installed-project loader checks registry/manifest identity and actual
  resource hashes.
- IndexedDB stores separate complete projects with binary Blob resources;
  failed malformed replacements retain the previous record.
- The three existing author CLI tests still pass in this batch.

## Archive repair follow-up

An additional interoperability case first failed: a normal ZIP containing
empty deflated directory entries was rejected. The archive guard now checks
those directory headers and admits valid empty directories.

```sh
node --test --test-name-pattern='directory entries from ordinary|missing-file draft|editor-only templates' tests/campaign-studio-files.test.mjs
```

Terminal result: **3 passed, 0 failed, 0 skipped**, exit `0`, duration
**730.042417 ms**. This is a separate focused run after the foundation commit.
No combined 24-case receipt was taken at that checkpoint. The later final
57-case group below includes the updated archive tests. No raw log was saved
for this separate three-case run.

The other two cases establish that a missing-file draft can be repaired while
retaining its resource ID and content, and that editor-only templates survive
portable project JSON while being excluded from an installable runtime ZIP.

## World, map and building workspace checks

The completed workspace logs below are copied from the original terminal
captures. Their scopes and source times differ; they are separate affected
runs, not an aggregate final website gate.

| Receipt | Result | Scope |
| --- | --- | --- |
| [World and mesh batch](world-mesh-affected.log) | 40 passed, 0 failed or skipped; 3527.602542 ms | Actual authored and generated material, roof and slab meshes; existing stock building coverage. |
| [Slab form batch](world-slab-form.log) | 9 passed, 0 failed or skipped; 3137.393167 ms | Authored slab controls and admitted shared climb topology. |
| [Physical preview batch](world-physical-preview.log) | 14 passed, 0 failed or skipped; 2100.699875 ms | Finite selected resources and arsenal preview wiring. |
| [Final five-file workspace batch](world-map-building-final.log) | 33 passed, 0 failed or skipped; 3356.232542 ms | Actual selected 7-medkit cache and owned swivel arsenal reveal through tactical container actions, selected materials and 4 m slab meshes. |
| [Workspace typecheck](world-preliminary-typecheck.log) | Exit 0 | Preliminary typecheck at the world workspace freeze; later master changes need a final typecheck. |

The embedded map workspace edits the current project's map directly. These
runs do not establish the final master page's shared undo/recovery or visible
browser acceptance. The expanded master mounted gate exposed a controlled-map
sync loop during global undo. The guarded synchronization fix now passes the
integrated master workflow run below.

## Content editor and sandbox checks

The content editor uses the shared project and real character rendering.
The sandbox runs actual recruitment, travel, dialogue, quest conditions,
treasury effects, deadlines, finite delivery and save continuation. These
affected checks are recorded in the original copied logs:

| Receipt | Result | Scope |
| --- | --- | --- |
| [Content editor and dialogue](content-editor-dialogue.log) | 118 passed, 0 failed or skipped; 72587.439458 ms | Full story editor, actual Three character projection, controlled document edits, hiring, dialogue, deadlines, costs, saves, custom-world movement and finite cache collection/re-entry. |
| [Errands, saves and sandbox](errands-save-sandbox.log) | 86 passed, 0 failed or skipped; 28695.366084 ms | All nine new sandbox cases, physical delivery, selected errand/save/squad/inventory/service-return behavior. |
| [Character preview runtime handoff](character-preview-runtime.log) | 4 passed, 0 failed or skipped; 2179.059083 ms | Actual sector renderer updates from the character preview's physical scene and actor projection. |
| [Authored escort sandbox](escort-sandbox.log) | 29 passed, 0 failed or skipped; 27290.60575 ms | Ten sandbox cases plus content errands and campaign escort checks; real custom-world escort completion and save/re-entry. |

The final physical-delivery assertion exposed and corrected selected-world
context in errand admission. The correction changed context arguments and
signatures; it added no saved fields. Neither run is a historical campaign
route or visible master website acceptance.

Later browser review found a character renderer handoff gap that the earlier
projection checks had not covered. The preview now passes the same physical
scene cache as Battlefield and keeps the roster in the actor projection. The
four-case runtime handoff receipt checks actual renderer updates. The final
escort receipt verifies selected-world safe exits, real elapsed movement,
boundary/adjacency admission, one-time reward and strict save/re-entry.

## Integrated master workflow

```sh
node --test tests/campaign-studio-mounted.test.mjs
```

The [original master workflow log](master-workflow.log) records **5 passed,
0 failed, 0 skipped**, exit `0`, duration **7158.647875 ms**. This run uses the
actual `/studio` page and its workspaces mounted in JSDOM with React StrictMode
and a fresh IndexedDB implementation. It is not a live browser capture.

Covered behavior:

- Specialized presentation and full document views edit one project.
- Map title changes participate in master keyboard undo/redo, while preserving
  the presentation edit and other maps.
- Two projects retain separate document and resource bytes through autosave,
  unmount, reload and selection. Installed gameplay save keys remain intact.
- The actual download control blocks an invalid calendar; after repair it
  produces a full ZIP that can be reimported and validated.
- A missing nested resource opens the repair panel; uploading a different
  basename replaces the selected nested path and retains its asset ID/content.
- Importing an existing project ID requires a new copy and retains the
  original saved project's content.

A separate bounded guard case then passed:

```sh
node --test --test-name-pattern='master rejects invalid portable' tests/campaign-studio-mounted.test.mjs
```

The [original guard/recovery log](master-guard-recovery.log) records **1 passed,
0 failed, 0 skipped**, exit `0`, duration **3902.631708 ms**. Directly entering an
invalid portable campaign ID and applying a nonobject required world document
both retain the previous project. That project remains downloadable,
decodable, valid and recoverable after reload. This separate receipt is not
a combined six-case final master run.

The [author guide's content coverage table](../../authoring/campaign-studio.md#workspaces)
maps every admitted authored content group to a controlled form or the complete
structured field view. Optional import, artillery supply/trading, ammunition
market and roadside placement fields use structured controls where a domain
form is absent. Compiler/save-generated origin is deliberately excluded.

## Final combined studio gate and typecheck

The published logs `studio-build-final.log`, `studio-build-hosting-final.log`,
`studio-typecheck-final.log` and `world-preliminary-typecheck.log` normalize
trailing spaces or empty lines at EOF only. Their reported commands and results
are unchanged. Other original logs retain their captured content.

```sh
node --test --test-concurrency=2 tests/campaign-studio-project.test.mjs tests/campaign-studio-files.test.mjs tests/campaign-studio-storage.test.mjs tests/campaign-studio-history-assets.test.mjs tests/campaign-editor-world.test.mjs tests/campaign-editor-world-mounted.test.mjs tests/campaign-studio-content.test.mjs tests/campaign-editor-sandbox.test.mjs tests/campaign-studio-mounted.test.mjs tests/campaign-authoring.test.mjs
npm run typecheck
```

The [final ten-file studio and CLI gate](studio-combined-final.log) records
**57 passed, 0 failed, 0 skipped**, exit `0`, duration **16248.493 ms**.
The [final typecheck](studio-typecheck-final.log), `npm run typecheck`, also
exited `0`. Both ran at commit `43decf73`, with runtime source digest
`d020aa84e2c7558c553cb0a290d5993b8b22a6e29e613f9aedf576de95390883`
(build identity `d020aa84e2c7`). Documentation is excluded from that digest.
These final affected results do not constitute the full game test suite or
a historical campaign route.

The [production export log](studio-build-final.log) records exit `0` for:

```sh
GRANADEROS_BASE_PATH=/granaderos npm run build
```

At the same source identity `d020aa84e2c7`, the build prerendered **7 routes,
0 skipped**, including `/studio`, and exported **1409 files with 1043 static
references**. The deployment base was `/granaderos`. This is the studio build;
earlier engine-separation exports have different counts and source identities.

A later static hosting review found that `/studio/` needed its own staged
directory entry. Deployment staging now copies the studio HTML and optional
RSC companion into that directory. The
[affected deployment/path gate](studio-static-deployment.log) passed **9/9**,
with no failed or skipped cases, in **220.018708 ms**.

The [replacement hosted export](studio-build-hosting-final.log) passed at
commit `26847f3faa7ee73d8fde398983143d6c4b9f37d9`, with full source digest
`ee2f1aaf0cb1a7d9620bda824bb10fe4ab4c365108de6802cf2f0d74213ab091`
(build identity `ee2f1aaf0cb1`). It used the same `/granaderos` production build
command and prerendered **7 routes, 0 skipped**, exporting **1411 files and
1043 static references**. This receipt supersedes the earlier export for
static `/studio/` hosting. Browser acceptance is using this final export at
`http://127.0.0.1:3172/granaderos/studio/`; its visible results follow below.

## Historical package copy admission

A package-only check of the actual installed Granaderos project after changing
its ID selected `generic-v1` and retained its raw authored definitions. That
copy is an editable invalid draft: all 15 original maps need authored player
spawns, generic admission also requires enemy spawns, and the presentation's
original numeric sample-battle actor selection is invalid for generic actor
IDs. No campaign route was started. The copy helper does not automatically
replace these definitions. The author guide names the repair work, and new
chapter objectives must be authored if campaign progression is required.

## Production browser acceptance and limits

The master `/studio` page and specialized workspaces are present in source.
The final website build is recorded above. The production static browser
review used build `ee2f1aaf0cb1`. Earlier engine-separation build and browser
results belong to their named source; they do not validate this website.

Production browser review has created the valid `studio-static-review` project
through normal controls and authored a neutral quest through the optional
visible document editor. Actual hiring changed treasury **1000 → 940**. The
guide approached and spoke with the authored NPC, accepted a **5-peso** cost
(**940 → 935**) with a **24-hour** deadline, and completed the **50-peso**
reward (**935 → 985**). The journal showed completion and the resulting save
passed the strict game reader. The
[production quest screenshot](studio-quest-browser.jpg) records the visible
scene. The authored quest was `supply-report`; its fixed local resident,
dialogue and deadline are also preserved in the downloaded package.

The remaining completed browser results are:

- The [actual 3D character preview](studio-character-browser.jpg) rendered
  selected dark skin, southwest direction, walking then idle motion, and
  crouched posture.
- Ctrl/Cmd + Z restored the project name; Shift + Z redid it; another undo
  restored the original name.
- At **390 × 844**, the [Resources panel](studio-mobile-browser.jpg) had a
  **390 px** document and **366 px** panel, with no outer horizontal overflow.
  Both resource images loaded, each with a **96 px** natural dimension. This
  is a Resources-panel check, not an exhaustive review of every mobile panel.
- Reload recovered `studio-static-review`, displayed **Borrador recuperado
  con sus documentos y recursos**, retained the name **Prueba del estudio
  publicado**, and returned to **Guardado en este navegador**. Resources kept
  the local guide image and its four references; both image views loaded.
- The actual ZIP control saved the archive. The automation's download-event
  listener timed out, but the file existed and was independently verified;
  the timeout is not presented as a missing download or a successful listener.

The exact [browser-produced archive](studio-static-review-1.zip) is
**37,494 bytes**, SHA-256
`9f96977dbd99a1eb327329246fdf0acb6535b8cd9bba7f62c99e07bbf86dd7bd`.
The [original archive verification receipt](browser-zip-verification.json)
records **9 files, 2 maps and 1 resource**, admission by
`importCampaignArchive` and `validateCampaignProject`, and acceptance by
`verifyCampaignFolder` with equal compiled definitions. Its `guide.png` has
**429 bytes**, SHA-256
`63f3a344addd5f0c6db71924fa235fbd1f240805077dd68a2dcc4c3243ff6f7f`,
matching both the manifest and extracted bytes. The quest's 24-hour deadline,
5-peso payment, 50-peso reward and local dialogue placement survived export.

Production file import was blocked by the browser extension's local-file URL
access and the locked host's native file picker. Therefore production ZIP
reimport and sandbox test-save continuation were **not visually verified**.
Archive/directory import, project recovery, strict saved continuation and
missing-file repair are covered by the mounted/API receipts above. Actual
production IndexedDB project reload was verified separately. This record does
not claim every production UI path was exercised.

An early foundation typecheck found no outstanding errors in its affected
files, but another workspace still had a concurrent type error. The later
workspace typecheck copied above passed. Final website typecheck evidence is
now recorded above against the combined source. Production export and the
scoped visible browser acceptance are complete. Publication to `main` through
PR #334 is recorded separately in the studio plan. The recorded build
identities and browser limits remain unchanged.

## Repository documentation and baseline audits

At source `43decf73`, the documentation audit passed: **275 requirements,
50 original rows, 87 parity rows and 150 evidence entries**. An optional
baseline audit reported **37 passed, 1 failed**. These are transcribed terminal
receipts; original stdout was not saved to a log file.

The failing baseline row is `default-authored-loose-bayonet`: expected
`[16, 24, 1]`, actual `[16, 50, 2]`. This preexisting stock baseline mismatch
is separate from studio authoring acceptance. Stock data was not changed in
this studio scope, and no campaign data correction was made for this audit.
The receipt does not establish that every repository audit passed.
The read-only diff against pre-studio source `a3579f01` was empty for
`campaigns/granaderos/content.json`, `game/weapons.js` and
`tools/audit-baseline.mjs`, confirming those inputs were unchanged here.

The final changed-Markdown local review reported **359 file/anchor links across
11 documents, 0 failures**. It removed the README video URL's query only when
resolving its local file. This is a transcribed receipt; no original stdout
file was saved. The receipt was appended after that review.

No full historical campaign routes were run for this task. These receipts do
not establish campaign completion, game balance, unrestricted mesh authoring,
a community publishing service or final game acceptance.
