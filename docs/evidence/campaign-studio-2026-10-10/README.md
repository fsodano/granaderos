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
There is no combined 24-case final receipt yet. No raw log was saved.

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
sync loop during global undo; that integration fix and rerun are pending.

## Content editor and sandbox checks

The content editor uses the shared project and real character rendering.
The sandbox runs actual recruitment, travel, dialogue, quest conditions,
treasury effects, deadlines, finite delivery and save continuation. These
affected checks are recorded in the original copied logs:

| Receipt | Result | Scope |
| --- | --- | --- |
| [Content editor and dialogue](content-editor-dialogue.log) | 118 passed, 0 failed or skipped; 72587.439458 ms | Full story editor, actual Three character projection, controlled document edits, hiring, dialogue, deadlines, costs, saves, custom-world movement and finite cache collection/re-entry. |
| [Errands, saves and sandbox](errands-save-sandbox.log) | 86 passed, 0 failed or skipped; 28695.366084 ms | All nine new sandbox cases, physical delivery, selected errand/save/squad/inventory/service-return behavior. |

The final physical-delivery assertion exposed and corrected selected-world
context in errand admission. The correction changed context arguments and
signatures; it added no saved fields. Neither run is a historical campaign
route or visible master website acceptance.

## Historical package copy admission

A package-only check of the actual installed Granaderos project after changing
its ID selected `generic-v1` and retained its raw authored definitions. That
copy is an editable invalid draft: all 15 original maps need authored player
spawns, generic admission also requires enemy spawns, and the presentation's
original numeric sample-battle actor selection is invalid for generic actor
IDs. No campaign route was started. The copy helper does not automatically
replace these definitions. The author guide names the repair work, and new
chapter objectives must be authored if campaign progression is required.

## Pending website acceptance

The master `/studio` page and specialized workspaces are under implementation.
At this checkpoint there is no completed final website build or visible
end-to-end browser receipt. Earlier engine-separation build and browser
results belong to their named source; they do not validate this website.

Required next evidence remains:

1. Create or import a project through `/studio`, edit all supported documents,
   resource bytes and tactical maps, and inspect actual selected previews.
2. Verify project autosave/recovery, shared undo/redo and isolation from an
   installed campaign save.
3. Exercise real authored dialogue/quest success, failure, deadlines, finite
   costs and save/restore in the integrated sandbox.
4. Download a project and installable ZIP through visible browser controls,
   reimport them, and validate the exported folder with the existing compiler.
5. Check error recovery for missing/changed resources and unsupported content.
6. Verify keyboard access and narrow layouts, then record the final typecheck,
   affected editor checks and production export against the final source.

The foundation's affected files have no outstanding TypeScript errors from the
latest preliminary typecheck. That preliminary run was not a passing whole
website gate because another workspace had a concurrent type error. Final
website typecheck evidence is pending.

No full historical campaign routes were run for this task. These receipts do
not establish campaign completion, game balance, unrestricted mesh authoring,
a community publishing service or final game acceptance.
