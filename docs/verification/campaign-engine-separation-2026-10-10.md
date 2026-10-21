# Engine and campaign separation

Date: 10 October 2026. Scope: local development work in `feature/campaigns`.
This record does not replace the earlier [`0.1` checkpoint](version-0.1.md),
retag it, or establish full historical campaign acceptance.

## Implemented boundary

The shared engine loads validated campaign definitions. The installed campaign
folder owns its world, tactical maps, cast, weapon definitions, physical
resources, menu and introduction, portrait menu, character creation display
data and image assets. Named historical scenario rules and mission panels live
under `campaigns/granaderos/`. Generic packages select supported shared rules
and their own chapter objectives, forces and timed events.

Only Granaderos is installed in the source tree. Development and production
builds discover installed manifests and generate the menu registry. Authors
can scaffold, validate and install a local generic campaign using the
[campaign guide](../development/campaign-authoring.md). The checker and build
share the package compiler, path validation and resource hash checks.

Installed saves are keyed by campaign ID. Editor launches use their content
identity hash. Story and sector drafts are scoped to the selected installed
campaign. Saves retain their package definitions; newer installed world or
content data does not overwrite them. Resource admission checks the actual
image bytes against the pinned SHA-256 values before Continue or import.

Shared renderer models, animation atlases, terrain and building archetypes
remain engine resources. Campaigns select supported styles and skin palettes.
External animated mesh imports, a community catalogue and a browser package
installer remain outside this implementation.

## Completed local checks

These batches have different scopes and snapshots. Counts must not be added
together as one full test run.

Published logs omit trailing spaces and empty lines at the end of a file.
Their test output and reported results are unchanged.

| Scope | Result | Evidence |
| --- | --- | --- |
| Core selected-world travel, weather, retained cell scenes, configured roles, authored dialogue/quests, pinned saves, compact package storage and rejected artillery requests | 59 passed, 0 skipped | [Core context log](../evidence/campaign-engine-separation-2026-10-10/core-context.log) |
| Menu introduction, mounted Continue, autosave lifecycle, cast rendering, errand editor, portrait choices, portrait assets and appearance | 233 passed, 0 skipped | [Web and asset log](../evidence/campaign-engine-separation-2026-10-10/web-assets.log) |
| Package loading, authored scaffold, static map references and equipment rendering | 17 passed, 0 skipped | [Package/UI log](../evidence/campaign-engine-separation-2026-10-10/package-ui.log) |
| Scaffold/check/resource refresh, changed resources and linked-file rejection | 3 passed, 0 skipped | [Authoring log](../evidence/campaign-engine-separation-2026-10-10/authoring.log) |
| Browser loader, revision-specific resource rejection, authored-copy fallback, portable export and development middleware | 5 passed, 0 skipped | [Loader resource log](../evidence/campaign-engine-separation-2026-10-10/loader-resources.log) |
| Selected editor map preview, frozen map geometry, stock strategic controls, tactical appearance and mounted enemy playback | 35 passed, 0 skipped | [Editor/playback/render log](../evidence/campaign-engine-separation-2026-10-10/editor-playback-render.log) |
| Portrait categories, independent gameplay fields, authored appearance and creation/deployment/save round trips | 5 passed, 0 skipped | [Portrait catalogue log](../evidence/campaign-engine-separation-2026-10-10/portrait-catalogue.log) |
| Editor selected faction labels, local errands, initial territory and authored roles | 15 passed, 0 skipped | [Editor labels log](../evidence/campaign-engine-separation-2026-10-10/editor-labels.log) |
| Shared foundry UI with explicit authored role fixtures | 5 passed, 0 skipped | [Foundry UI log](../evidence/campaign-engine-separation-2026-10-10/foundry-ui.log) |
| Selected turn/faction names, HUD behavior, authored map preview, tactical rendering and mounted enemy playback | 70 passed, 0 skipped | [Turn label log](../evidence/campaign-engine-separation-2026-10-10/turn-faction-label.log) |
| Selected strategic map faction labels and hidden-strength counts | 12 passed, 0 skipped | [Strategic label log](../evidence/campaign-engine-separation-2026-10-10/strategic-faction-label.log) |
| Selected tactical faction/equipment/radar captions, neutral mounted label, HUD, authored map preview, tactical rendering and mounted playback | 98 passed, 0 skipped | [Tactical selected-label log](../evidence/campaign-engine-separation-2026-10-10/tactical-selected-labels.log) |
| Full mounted story editor file, including optional-field removal and undo, effective resident selection, stock-to-authored mode switch, isolated drafts and real launched saves | 79 passed, 0 skipped | [Story editor log](../evidence/campaign-engine-separation-2026-10-10/story-editor-final.log) |
| Selected tactical context through mounted campaign playback, inventory captions and campaign-owned victory text | 21 passed, 0 skipped | [Campaign panel log](../evidence/campaign-engine-separation-2026-10-10/tactical-campaign-panels.log) |
| Ten affected fixture files with explicit authored ability, arrival, resident, force and regional-weather settings | 73 passed, 0 skipped | [Residual fixture log](../evidence/campaign-engine-separation-2026-10-10/residual-ten-files.log) |
| Selected building wall/trim pigments, height and roof geometry, supported exterior flags, save/re-entry admission and preserved stock renderer signatures | 74 passed, 0 skipped | [Affected building log](../evidence/campaign-engine-separation-2026-10-10/building-style-affected.log) |
| Final real building meshes and scene admission, including two grid district houses across tile/thatch/terrace roofs | 10 passed, 0 skipped | [Final building log](../evidence/campaign-engine-separation-2026-10-10/building-style-final.log) |

The San Lorenzo geometry receipt normalizes only the relocated convent
illustration URL. Its wall edges, room membership, props and lighting remain
pinned. The mounted playback fixture waits for real asynchronous package
admission while retaining its recorded animation timers.

An independent capture of original primary `main` was used to compare the
installed stock campaign. The regression fixture covers all 61 character
mechanics, effective primary ammunition and secondary blade profiles, 488
hire and renewal quotes, startup, and an actual recruit and deployment. That
comparison found a secondary blade and six weekly-pay rounding differences;
the installed definitions and historical quote hook were corrected. The
affected catalogue, contract and blade batch passed 23 tests, with no failures
or skips, in 2.854 seconds. This result was captured in the tool terminal;
there is no saved raw log for that batch. The retained regression is in
[`campaign-catalogue.test.mjs`](https://github.com/fsodano/granaderos/blob/fc584dd4878be2b777c6ce1aa7c7f28f07e80d69/tests/campaign-catalogue.test.mjs) and
[`stock-startup-baseline.json`](../../tests/stock-startup-baseline.json).

The building regression renders actual mesh geometry and material pigments.
It checks generic colour, roof, height and exterior flags, explicit map finish
precedence, metric slab precedence, active saves and retained scene re-entry.
Six stock mesh signatures captured from the feature renderer before the
style fix remain exact in ordinary and installed Granaderos maps. They are
not an original-main renderer comparison. The shared renderer does not mutate simulation records.

The documentation audit and baseline audit passed after the core context
changes. The baseline audit covered 38 documented rows. These audits check
documentation consistency; they do not certify route completion.

The frozen private asset copy completed 60 passing cases across apparel
surfaces, cloth depth, coarse garment surfaces and family cloth depth, with
no failures. The coarse replay and family export replay completed. The owner
then stopped the process during `characters-library-pipeline.test.mjs`.
The [terminal log](../evidence/campaign-engine-separation-2026-10-10/asset-pipeline-completed-prefix.log)
records both the completed cases and the interruption. That interruption is
not a pipeline timeout or a passing library-file result. The interrupted
library file was then rerun in the same frozen copy: all 9 cases passed, with
no skips, in 615.324 seconds. The [resumed library log](../evidence/campaign-engine-separation-2026-10-10/asset-library-resumed.log)
records the complete result. No asset pipeline process remains active.

## Completed type check and static export

The type check completed with exit 0. The one-package production export also
completed with exit 0 using `GRANADEROS_BASE_PATH=/preview/granaderos`.
Its static audit checked 1405 files and 1040 asset references. The generated
registry contains only Granaderos; the second package was added to a private
served copy after this export.

| Receipt | Evidence |
| --- | --- |
| Type check | [Completed log](../evidence/campaign-engine-separation-2026-10-10/final-typecheck.log) |
| One-package nested-path export | [Completed log](../evidence/campaign-engine-separation-2026-10-10/final-one-campaign-build.log) |
| Generated installed registry | [Registry](../evidence/campaign-engine-separation-2026-10-10/final-source-registry.json) |
| Tested build metadata | [Build identity](../evidence/campaign-engine-separation-2026-10-10/final-build-info.json) |

The tested build ID is `a5ad3a5621c6`. Its source digest is
`a5ad3a5621c6ce2475fab5e4d57f00dbb447c5b80967e7b3bf7238b5a303cf44`.
The recorded Git revision, `12ac2d9b0576a56f8499b70782d581b78f5fd373`,
was the candidate's base commit; the build included uncommitted separation
work. This digest identifies that tested candidate. The production source in
the later progress commits differs from it only by removal of one trailing
blank line in `game/campaign-physical.js`. The current source digest after that
formatting-only cleanup is
`6ea00196c26162ef15cbab66f8245782e09fcf3ba975309788fbf2252d1eacf8`.
It is a different source identity from the tested export. No new checks were
run for that cleanup.

## Visible browser checks

### Earlier bounded browser evidence

The initial nested-base production snapshot used build ID `c454aebe8c29` at
`/preview/granaderos/`. Its static audit checked 1414 files and 1040 local
references. A temporary second generic package was present for that build and
was then removed from the source tree. The isolated served copy retained it
for menu and save checks. See the [initial build log](../evidence/campaign-engine-separation-2026-10-10/initial-two-package-build.log).

The browser showed both package choices. The generic package used its own
portrait, one recruit, local map outline and chapter objective. Hiring that
recruit changed funds from 1000 to 940 pesos. Reload and Continue restored 940
pesos and one recruit. Selecting stock used its separate progress and original
introduction. Stock creation retained its 180 selectable portrait choices.

The story editor showed the selected cast. Changing the generic guide's name,
switching to stock, and switching back retained the generic edit without
changing the stock character. Launching that draft used its own content hash.
The generic creator showed its own one-face catalogue and neutral class.

With Continue available, removing the generic portrait from the isolated
export blocked restoration and named the missing path. Changing its bytes
also blocked restoration. Restoring the original bytes resumed the saved
940-peso campaign. These changes affected only the temporary served copy.

| Browser view | Evidence |
| --- | --- |
| Two installed menu choices | [Menu](../evidence/campaign-engine-separation-2026-10-10/two-campaign-menu.png) |
| Generic recruitment | [Desk](../evidence/campaign-engine-separation-2026-10-10/generic-campaign-desk.png) |
| Reloaded generic progress and map | [Continue](../evidence/campaign-engine-separation-2026-10-10/generic-continued-map.png) |
| Separate selected story draft | [Editor](../evidence/campaign-engine-separation-2026-10-10/independent-editor.png) |
| Selected generic portrait catalogue | [Creator](../evidence/campaign-engine-separation-2026-10-10/generic-creator.png) |
| Missing saved resource | [Missing resource](../evidence/campaign-engine-separation-2026-10-10/missing-campaign-resource.png) |
| Changed saved resource bytes | [Changed resource](../evidence/campaign-engine-separation-2026-10-10/changed-campaign-resource.png) |

### Stopped browser refresh of build a5ad3a5621c6

The isolated copy was refreshed from the completed one-package export. A
validated generic fixture at revision 2 was added only to that copy. The
browser menu listed both packages. At the preserved `localhost:3142` origin,
Continue restored the existing generic save with 940 pesos, one guide at
70 PS, and its local map and objective. The new installed revision did not
replace the saved definitions. These two views were captured before the
owner stopped the browser work.

| Captured view | Evidence |
| --- | --- |
| Menu from the tested build, with both choices in its state transcript | [Image](../evidence/campaign-engine-separation-2026-10-10/final-two-campaign-menu.jpg) · [State](../evidence/campaign-engine-separation-2026-10-10/final-two-campaign-menu.txt) |
| Existing generic progress continued on the tested build | [Image](../evidence/campaign-engine-separation-2026-10-10/final-generic-pinned-continue.jpg) · [State](../evidence/campaign-engine-separation-2026-10-10/final-generic-pinned-continue.txt) |

The refresh is incomplete. The final build was not checked in the browser for
stock/generic save switching, independent editor drafts, selected tactical
labels, the blue/yellow thatch building, or missing/changed resource rejection.
Earlier browser evidence and focused tests above cover their stated snapshots
and scopes. They do not turn this stopped refresh into a complete final browser
pass. The preview server and test tab were closed. No browser work remains active.

## Stopped broad regression run

The first broad boundary run passed 333 of 344 selected files and failed 11.
The [first run log](../evidence/campaign-engine-separation-2026-10-10/first-boundary-run.log)
retains that failed result. The residual fixture and editor issues then passed
the affected checks recorded above.

A final run selected 357 test files. The team stopped it at the user's
instruction before completion. Its [partial log](../evidence/campaign-engine-separation-2026-10-10/stopped-boundary-run.log)
and [timing report](../evidence/campaign-engine-separation-2026-10-10/stopped-boundary-timings.json)
are retained; the timing report has `complete: false`. This run is incomplete.
It is not a passing 357-file gate, the quick suite, or the full suite. Full
historical story routes were excluded. No replacement run was started.

## Limits

The type check, one-package export and completed focused batches have the exact
scopes recorded above. The private asset pipeline applies to its frozen copy.
The stock correction has a passing focused regression; the earlier full browser
sequence predates it, and the final refresh is incomplete.

The user instructed the team not to run further campaign checks. No complete
historical story route, passing full release gate, sustained performance run,
balance review, final art/audio review or deployment was performed for this
separation work. Earlier route failures and dated route receipts retain their
original scope. Passing these focused checks and the export does not certify
a finished game. The historical `0.1` tag retains its original checkpoint.

## Publication

The implementation's three progress commits are merged into `feature/campaigns`
through [PR #333](https://github.com/fsodano/granaderos/pull/333). The author guide
and this evidence record followed through a separate work PR to that branch.
Publication update, 11 October 2026: [PR #334](https://github.com/fsodano/granaderos/pull/334)
merged the feature branch into `main` as
`0a04f72c1c0a1b0ec56a8db84668f2e3b12a722e`. This update records publication;
the checks above retain their original sources and limits. No production
deployment was performed by this merge.
